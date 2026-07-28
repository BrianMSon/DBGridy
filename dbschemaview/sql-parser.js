(function attachSqlParser(global) {
  "use strict";

  const MAX_INPUT_CHARS = 4 * 1024 * 1024;
  const MAX_TABLES = 600;

  // 타입 토큰을 끝내는 컬럼 옵션 키워드.
  const TYPE_STOP_WORDS = new Set([
    "NOT", "NULL", "DEFAULT", "PRIMARY", "UNIQUE", "KEY", "REFERENCES", "CHECK",
    "COLLATE", "COMMENT", "CONSTRAINT", "AUTO_INCREMENT", "AUTOINCREMENT",
    "IDENTITY", "GENERATED", "ALWAYS", "AS", "ON", "STORED", "VIRTUAL",
    "INVISIBLE", "VISIBLE", "SRID", "COMPRESSED", "ENCRYPTED", "SPARSE",
    "ROWGUIDCOL", "FILESTREAM", "MASKED", "INDEX", "FULLTEXT", "SPATIAL",
    "DEFERRABLE", "INITIALLY", "ENFORCED", "CHARSET", "OPTIONS", "WITH",
    "STORAGE", "INLINE", "COLUMN_FORMAT", "SERIAL", "FIRST", "AFTER"
  ]);

  // CREATE 와 TABLE/INDEX 사이에 올 수 있는 수식어.
  const CREATE_MODIFIERS = new Set([
    "OR", "REPLACE", "GLOBAL", "LOCAL", "TEMP", "TEMPORARY", "UNLOGGED",
    "EXTERNAL", "VIRTUAL", "MULTISET", "SHARDED", "DUPLICATED", "CACHED",
    "MEMORY", "CLUSTERED", "NONCLUSTERED", "COLUMNSTORE", "BITMAP", "FOREIGN",
    "IF", "NOT", "EXISTS"
  ]);

  // 추정 관계에서 이름이 너무 일반적이라 링크 근거가 되지 못하는 컬럼.
  const GENERIC_KEY_NAMES = new Set([
    "id", "no", "num", "seq", "key", "code", "cd", "name", "type", "status",
    "idx", "index", "value", "data", "date", "time", "yn", "flag", "sort", "order"
  ]);

  const KEY_SUFFIXES = ["_id", "_no", "_seq", "_key", "_code", "_cd", "_pk", "_fk", "_sid", "_uid"];

  /* ---------------------------------------------------------------- 토큰 */

  const t = (key, params) => global.DBSchemaI18n.t(key, params);

  function isSpace(ch) {
    return ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\f" || ch === "\v";
  }

  function isDigit(ch) {
    return ch >= "0" && ch <= "9";
  }

  function isWordStart(ch) {
    return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_" || ch >= "\u0080";
  }

  function isWordPart(ch) {
    return isWordStart(ch) || isDigit(ch) || ch === "$" || ch === "#" || ch === "@";
  }

  function makeToken(type, value, text) {
    return { type, value, text, upper: type === "word" ? value.toUpperCase() : "" };
  }

  function readQuoted(source, start, open, close) {
    let i = start + 1;
    let value = "";
    while (i < source.length) {
      const ch = source[i];
      if (ch === close) {
        if (source[i + 1] === close) {
          value += close;
          i += 2;
          continue;
        }
        i += 1;
        break;
      }
      value += ch;
      i += 1;
    }
    return { value, end: i, text: source.slice(start, i) };
  }

  function readSingleQuoted(source, start) {
    let i = start + 1;
    let value = "";
    while (i < source.length) {
      const ch = source[i];
      if (ch === "\\" && i + 1 < source.length) {
        value += source[i + 1];
        i += 2;
        continue;
      }
      if (ch === "'") {
        if (source[i + 1] === "'") {
          value += "'";
          i += 2;
          continue;
        }
        i += 1;
        break;
      }
      value += ch;
      i += 1;
    }
    return { value, end: i, text: source.slice(start, i) };
  }

  function matchDollarTag(source, start) {
    const rest = source.slice(start, start + 64);
    const match = /^\$[A-Za-z_\u0080-\uffff][A-Za-z0-9_\u0080-\uffff]*\$|^\$\$/.exec(rest);
    return match ? match[0] : null;
  }

  function tokenize(source) {
    const tokens = [];
    const length = source.length;
    let i = 0;

    while (i < length) {
      const ch = source[i];

      if (isSpace(ch)) {
        i += 1;
        continue;
      }

      if (ch === "-" && source[i + 1] === "-") {
        while (i < length && source[i] !== "\n") i += 1;
        continue;
      }

      // MySQL 라인 주석. #tempTable 같은 식별자와 구분한다.
      if (ch === "#" && !isWordPart(source[i + 1] || "")) {
        while (i < length && source[i] !== "\n") i += 1;
        continue;
      }

      if (ch === "/" && source[i + 1] === "*") {
        i += 2;
        while (i < length && !(source[i] === "*" && source[i + 1] === "/")) i += 1;
        i = Math.min(length, i + 2);
        continue;
      }

      if (ch === "$") {
        const tag = matchDollarTag(source, i);
        if (tag) {
          const close = source.indexOf(tag, i + tag.length);
          const end = close === -1 ? length : close + tag.length;
          const body = source.slice(i + tag.length, close === -1 ? length : close);
          tokens.push(makeToken("string", body, source.slice(i, end)));
          i = end;
          continue;
        }
      }

      if (ch === "'") {
        const quoted = readSingleQuoted(source, i);
        tokens.push(makeToken("string", quoted.value, quoted.text));
        i = quoted.end;
        continue;
      }

      if (ch === '"' || ch === "`") {
        const quoted = readQuoted(source, i, ch, ch);
        tokens.push(makeToken("ident", quoted.value, quoted.text));
        i = quoted.end;
        continue;
      }

      // MSSQL 대괄호 식별자. int[] 같은 배열 표기와 구분한다.
      if (ch === "[" && source[i + 1] !== "]") {
        const quoted = readQuoted(source, i, "[", "]");
        tokens.push(makeToken("ident", quoted.value, quoted.text));
        i = quoted.end;
        continue;
      }

      if (isDigit(ch) || (ch === "." && isDigit(source[i + 1] || ""))) {
        let j = i;
        if (ch === "0" && (source[i + 1] === "x" || source[i + 1] === "X")) {
          j = i + 2;
          while (j < length && /[0-9a-fA-F]/.test(source[j])) j += 1;
        } else {
          while (j < length && (isDigit(source[j]) || source[j] === ".")) j += 1;
          if (source[j] === "e" || source[j] === "E") {
            let k = j + 1;
            if (source[k] === "+" || source[k] === "-") k += 1;
            if (isDigit(source[k] || "")) {
              while (k < length && isDigit(source[k])) k += 1;
              j = k;
            }
          }
        }
        tokens.push(makeToken("number", source.slice(i, j), source.slice(i, j)));
        i = j;
        continue;
      }

      if (isWordStart(ch) || ch === "@" || ch === "#") {
        let j = i + 1;
        while (j < length && isWordPart(source[j])) j += 1;
        const raw = source.slice(i, j);
        tokens.push(makeToken("word", raw, raw));
        i = j;
        continue;
      }

      tokens.push(makeToken("punct", ch, ch));
      i += 1;
    }

    return tokens;
  }

  function joinTokens(tokens) {
    let out = "";
    let previous = null;
    for (const token of tokens) {
      const text = token.type === "string" ? `'${token.value.replaceAll("'", "''")}'` : token.text;
      if (previous) {
        const tightBefore = token.type === "punct" && "(),[]:".includes(token.value);
        const tightAfter = previous.type === "punct" && "([,:".includes(previous.value);
        if (!tightBefore && !tightAfter) out += " ";
      }
      out += text;
      previous = token;
    }
    return out;
  }

  /* --------------------------------------------------------------- 커서 */

  class Cursor {
    constructor(tokens) {
      this.tokens = tokens;
      this.i = 0;
    }

    get done() {
      return this.i >= this.tokens.length;
    }

    peek(offset = 0) {
      return this.tokens[this.i + offset] || null;
    }

    next() {
      const token = this.tokens[this.i] || null;
      this.i += 1;
      return token;
    }

    isWord(word, offset = 0) {
      const token = this.peek(offset);
      return Boolean(token) && token.type === "word" && token.upper === word;
    }

    isPunct(value, offset = 0) {
      const token = this.peek(offset);
      return Boolean(token) && token.type === "punct" && token.value === value;
    }

    isName(offset = 0) {
      const token = this.peek(offset);
      return Boolean(token) && (token.type === "word" || token.type === "ident");
    }

    eatWord(word) {
      if (this.isWord(word)) {
        this.i += 1;
        return true;
      }
      return false;
    }

    eatPunct(value) {
      if (this.isPunct(value)) {
        this.i += 1;
        return true;
      }
      return false;
    }
  }

  function readName(cursor) {
    const parts = [];
    for (;;) {
      if (!cursor.isName()) break;
      parts.push(cursor.next().value);
      if (cursor.isPunct(".")) {
        cursor.next();
        continue;
      }
      break;
    }
    return parts;
  }

  function readBalanced(cursor) {
    const inner = [];
    if (!cursor.eatPunct("(")) return inner;
    let depth = 1;
    while (!cursor.done) {
      const token = cursor.next();
      if (token.type === "punct") {
        if (token.value === "(") depth += 1;
        else if (token.value === ")") {
          depth -= 1;
          if (depth === 0) break;
        }
      }
      inner.push(token);
    }
    return inner;
  }

  function readBalancedRaw(cursor) {
    const out = [];
    if (!cursor.isPunct("(")) return out;
    let depth = 0;
    while (!cursor.done) {
      const token = cursor.next();
      out.push(token);
      if (token.type === "punct") {
        if (token.value === "(") depth += 1;
        else if (token.value === ")") {
          depth -= 1;
          if (depth === 0) break;
        }
      }
    }
    return out;
  }

  function readColumnList(cursor) {
    const columns = [];
    if (!cursor.eatPunct("(")) return columns;
    let depth = 1;
    let expectName = true;
    while (!cursor.done) {
      const token = cursor.next();
      if (token.type === "punct") {
        if (token.value === "(") depth += 1;
        else if (token.value === ")") {
          depth -= 1;
          if (depth === 0) break;
        } else if (token.value === "," && depth === 1) {
          expectName = true;
        }
        continue;
      }
      if (expectName && depth === 1 && (token.type === "word" || token.type === "ident")) {
        columns.push(token.value);
        expectName = false;
      }
    }
    return columns;
  }

  function splitStatements(tokens) {
    const statements = [];
    let current = [];
    let depth = 0;
    for (const token of tokens) {
      if (token.type === "punct") {
        if (token.value === "(") depth += 1;
        else if (token.value === ")") depth = Math.max(0, depth - 1);
        else if (token.value === ";" && depth === 0) {
          if (current.length) statements.push(current);
          current = [];
          continue;
        }
      }
      current.push(token);
    }
    if (current.length) statements.push(current);
    return statements;
  }

  function splitTopLevel(tokens) {
    const groups = [];
    let current = [];
    let depth = 0;
    for (const token of tokens) {
      if (token.type === "punct") {
        if (token.value === "(") depth += 1;
        else if (token.value === ")") depth -= 1;
        else if (token.value === "," && depth === 0) {
          if (current.length) groups.push(current);
          current = [];
          continue;
        }
      }
      current.push(token);
    }
    if (current.length) groups.push(current);
    return groups;
  }

  /* ------------------------------------------------------------- 스키마 */

  function createTable(parts, index) {
    const name = parts[parts.length - 1];
    const schema = parts.length > 1 ? parts[parts.length - 2] : null;
    return {
      id: `t${index}`,
      name,
      schema,
      qualified: schema ? `${schema}.${name}` : name,
      comment: null,
      columns: [],
      indexes: [],
      uniqueSets: [],
      outgoing: [],
      incoming: []
    };
  }

  function createColumn(name) {
    return {
      name,
      type: "",
      nullable: true,
      pk: false,
      unique: false,
      auto: false,
      generated: false,
      defaultValue: null,
      comment: null,
      fk: false,
      inferredFk: false
    };
  }

  function findColumn(table, name) {
    const target = String(name || "").toLowerCase();
    return table.columns.find((column) => column.name.toLowerCase() === target) || null;
  }

  function isTypeStop(cursor) {
    const token = cursor.peek();
    if (!token || token.type !== "word") return false;
    if (token.upper === "CHARACTER") return cursor.isWord("SET", 1);
    if (token.upper === "WITH") return !cursor.isWord("TIME", 1) && !cursor.isWord("LOCAL", 1);
    return TYPE_STOP_WORDS.has(token.upper);
  }

  function readColumnType(cursor) {
    const parts = [];
    while (!cursor.done) {
      const token = cursor.peek();
      if (!token) break;

      if (token.type === "punct") {
        if (token.value === "(") {
          if (!parts.length) break;
          parts.push(...readBalancedRaw(cursor));
          continue;
        }
        if (token.value === "[" && cursor.isPunct("]", 1)) {
          parts.push(cursor.next(), cursor.next());
          continue;
        }
        break;
      }

      if (!parts.length) {
        if (token.type !== "word" && token.type !== "ident") break;
        parts.push(cursor.next());
        continue;
      }

      if (token.type !== "word") break;
      if (isTypeStop(cursor)) break;
      parts.push(cursor.next());
    }
    return joinTokens(parts);
  }

  function readDefaultExpression(cursor) {
    const parts = [];
    const first = cursor.peek();
    if (!first) return null;

    if (first.type === "punct" && first.value === "(") {
      parts.push(...readBalancedRaw(cursor));
    } else {
      parts.push(cursor.next());
      if (cursor.isPunct("(")) parts.push(...readBalancedRaw(cursor));
    }

    while (cursor.isPunct(":") && cursor.isPunct(":", 1)) {
      parts.push(cursor.next(), cursor.next());
      if (cursor.isName()) parts.push(cursor.next());
      if (cursor.isPunct("(")) parts.push(...readBalancedRaw(cursor));
      while (cursor.isPunct("[") && cursor.isPunct("]", 1)) parts.push(cursor.next(), cursor.next());
    }

    return joinTokens(parts) || null;
  }

  function readReferenceAction(cursor) {
    if (cursor.eatWord("CASCADE")) return "CASCADE";
    if (cursor.eatWord("RESTRICT")) return "RESTRICT";
    if (cursor.eatWord("SET")) {
      if (cursor.eatWord("NULL")) return "SET NULL";
      if (cursor.eatWord("DEFAULT")) return "SET DEFAULT";
      return "SET";
    }
    if (cursor.eatWord("NO")) {
      cursor.eatWord("ACTION");
      return "NO ACTION";
    }
    return null;
  }

  function readReferenceActions(cursor) {
    const actions = { onDelete: null, onUpdate: null };
    for (;;) {
      if (cursor.isWord("ON") && (cursor.isWord("DELETE", 1) || cursor.isWord("UPDATE", 1))) {
        cursor.next();
        const kind = cursor.next().upper;
        const value = readReferenceAction(cursor);
        if (kind === "DELETE") actions.onDelete = value;
        else actions.onUpdate = value;
        continue;
      }
      if (cursor.isWord("MATCH")) {
        cursor.next();
        if (cursor.isName()) cursor.next();
        continue;
      }
      if (cursor.isWord("NOT") && cursor.isWord("DEFERRABLE", 1)) {
        cursor.i += 2;
        continue;
      }
      if (cursor.isWord("DEFERRABLE")) {
        cursor.next();
        continue;
      }
      if (cursor.isWord("INITIALLY")) {
        cursor.i += 2;
        continue;
      }
      break;
    }
    return actions;
  }

  function readReferencesClause(cursor) {
    const parts = readName(cursor);
    if (!parts.length) return null;
    const columns = cursor.isPunct("(") ? readColumnList(cursor) : [];
    const actions = readReferenceActions(cursor);
    return { targetParts: parts, targetColumns: columns, onDelete: actions.onDelete, onUpdate: actions.onUpdate };
  }

  function parseColumnDefinition(cursor, table, pending) {
    if (!cursor.isName()) return null;
    const column = createColumn(cursor.next().value);
    column.type = readColumnType(cursor);

    if (/^(?:big|small)?serial\b/i.test(column.type)) {
      column.auto = true;
      column.nullable = false;
    }

    while (!cursor.done) {
      const token = cursor.next();
      if (!token) break;
      if (token.type !== "word") continue;

      switch (token.upper) {
        case "NOT":
          if (cursor.eatWord("NULL")) column.nullable = false;
          else if (cursor.isWord("DEFERRABLE")) cursor.next();
          break;
        case "NULL":
          column.nullable = true;
          break;
        case "PRIMARY":
          cursor.eatWord("KEY");
          column.pk = true;
          column.nullable = false;
          break;
        case "UNIQUE":
          cursor.eatWord("KEY");
          column.unique = true;
          break;
        case "AUTO_INCREMENT":
        case "AUTOINCREMENT":
          column.auto = true;
          break;
        case "IDENTITY":
          if (cursor.isPunct("(")) readBalanced(cursor);
          column.auto = true;
          break;
        case "GENERATED":
          cursor.eatWord("ALWAYS");
          if (cursor.eatWord("BY")) cursor.eatWord("DEFAULT");
          if (cursor.eatWord("AS")) {
            if (cursor.eatWord("IDENTITY")) {
              if (cursor.isPunct("(")) readBalanced(cursor);
              column.auto = true;
            } else if (cursor.isPunct("(")) {
              readBalanced(cursor);
              column.generated = true;
            }
          }
          break;
        case "AS":
          if (cursor.isPunct("(")) {
            readBalanced(cursor);
            column.generated = true;
          }
          break;
        case "DEFAULT":
          column.defaultValue = readDefaultExpression(cursor);
          if (column.defaultValue && /\bnextval\s*\(/i.test(column.defaultValue)) column.auto = true;
          break;
        case "COMMENT": {
          const next = cursor.peek();
          if (next && next.type === "string") {
            column.comment = next.value;
            cursor.next();
          }
          break;
        }
        case "CHECK":
          if (cursor.isPunct("(")) readBalanced(cursor);
          break;
        case "COLLATE":
          if (cursor.isName()) readName(cursor);
          break;
        case "CHARACTER":
          if (cursor.eatWord("SET") && cursor.isName()) cursor.next();
          break;
        case "CHARSET":
          if (cursor.isName()) cursor.next();
          break;
        case "CONSTRAINT":
          readName(cursor);
          break;
        case "REFERENCES": {
          const reference = readReferencesClause(cursor);
          if (reference) {
            pending.push({
              table,
              name: null,
              columns: [column.name],
              reference
            });
          }
          break;
        }
        default:
          break;
      }
    }

    return column;
  }

  function looksLikeColumnList(cursor) {
    const token = cursor.peek(1);
    return cursor.isPunct("(") && Boolean(token) && (token.type === "word" || token.type === "ident");
  }

  function parseTableConstraint(cursor, table, pending, constraintName) {
    const token = cursor.peek();
    if (!token || token.type !== "word") return false;

    switch (token.upper) {
      case "PRIMARY": {
        cursor.next();
        cursor.eatWord("KEY");
        if (cursor.isWord("CLUSTERED") || cursor.isWord("NONCLUSTERED")) cursor.next();
        const columns = readColumnList(cursor);
        table.pendingPrimaryKey = columns;
        return true;
      }
      case "UNIQUE": {
        cursor.next();
        cursor.eatWord("KEY");
        cursor.eatWord("INDEX");
        if (cursor.isName() && !cursor.isPunct("(")) readName(cursor);
        if (cursor.isWord("USING")) cursor.i += 2;
        const columns = readColumnList(cursor);
        if (columns.length) table.indexes.push({ name: constraintName, unique: true, columns });
        return true;
      }
      case "FOREIGN": {
        cursor.next();
        cursor.eatWord("KEY");
        if (cursor.isName() && !cursor.isPunct("(")) readName(cursor);
        const columns = readColumnList(cursor);
        if (!cursor.eatWord("REFERENCES")) return true;
        const reference = readReferencesClause(cursor);
        if (reference) pending.push({ table, name: constraintName, columns, reference });
        return true;
      }
      case "KEY":
      case "INDEX": {
        if (!looksLikeColumnList(cursor)) {
          const save = cursor.i;
          cursor.next();
          if (cursor.isName()) readName(cursor);
          if (cursor.isWord("USING")) cursor.i += 2;
          if (!looksLikeColumnList(cursor)) {
            cursor.i = save;
            return false;
          }
          const columns = readColumnList(cursor);
          if (columns.length) table.indexes.push({ name: constraintName, unique: false, columns });
          return true;
        }
        cursor.next();
        const columns = readColumnList(cursor);
        if (columns.length) table.indexes.push({ name: constraintName, unique: false, columns });
        return true;
      }
      case "FULLTEXT":
      case "SPATIAL": {
        cursor.next();
        cursor.eatWord("KEY");
        cursor.eatWord("INDEX");
        if (cursor.isName() && !cursor.isPunct("(")) readName(cursor);
        readColumnList(cursor);
        return true;
      }
      case "CHECK":
      case "EXCLUDE":
      case "PERIOD":
      case "LIKE":
      case "INHERITS":
      case "PARTITION":
        return true;
      default:
        return false;
    }
  }

  function parseCreateTable(cursor, context) {
    if (cursor.isWord("IF") && cursor.isWord("NOT", 1) && cursor.isWord("EXISTS", 2)) cursor.i += 3;

    const parts = readName(cursor);
    if (!parts.length) {
      context.warnings.push(t("parse.noName"));
      return;
    }

    if (!cursor.isPunct("(")) {
      context.warnings.push(t("parse.noColumns", { table: parts[parts.length - 1] }));
      return;
    }

    if (context.tables.length >= MAX_TABLES) {
      context.truncated = true;
      return;
    }

    const table = createTable(parts, context.tables.length);
    const existing = context.byQualified.get(table.qualified.toLowerCase());
    if (existing) {
      context.warnings.push(t("parse.duplicate", { table: table.qualified }));
      const index = context.tables.indexOf(existing);
      if (index !== -1) context.tables.splice(index, 1);
    }

    const body = readBalanced(cursor);
    for (const item of splitTopLevel(body)) {
      const itemCursor = new Cursor(item);
      let constraintName = null;
      if (itemCursor.isWord("CONSTRAINT")) {
        itemCursor.next();
        const nameParts = readName(itemCursor);
        constraintName = nameParts.length ? nameParts[nameParts.length - 1] : null;
      }
      if (parseTableConstraint(itemCursor, table, context.pending, constraintName)) continue;
      const column = parseColumnDefinition(itemCursor, table, context.pending);
      if (column && !findColumn(table, column.name)) table.columns.push(column);
    }

    if (table.pendingPrimaryKey) {
      for (const name of table.pendingPrimaryKey) {
        const column = findColumn(table, name);
        if (column) {
          column.pk = true;
          column.nullable = false;
        }
      }
      delete table.pendingPrimaryKey;
    }

    for (const index of table.indexes) {
      if (index.unique && index.columns.length === 1) {
        const column = findColumn(table, index.columns[0]);
        if (column) column.unique = true;
      }
    }

    context.tables.push(table);
    context.byQualified.set(table.qualified.toLowerCase(), table);
  }

  function parseAlterTable(cursor, context) {
    cursor.eatWord("ONLY");
    if (cursor.isWord("IF") && cursor.isWord("EXISTS", 1)) cursor.i += 2;

    const parts = readName(cursor);
    if (!parts.length) return;

    const rest = cursor.tokens.slice(cursor.i);
    for (const clause of splitTopLevel(rest)) {
      const clauseCursor = new Cursor(clause);
      if (!clauseCursor.eatWord("ADD")) continue;

      let constraintName = null;
      if (clauseCursor.isWord("CONSTRAINT")) {
        clauseCursor.next();
        const nameParts = readName(clauseCursor);
        constraintName = nameParts.length ? nameParts[nameParts.length - 1] : null;
      }

      context.deferredAlters.push({ targetParts: parts, cursor: clauseCursor, constraintName });
    }
  }

  function applyAlter(alter, context) {
    const table = resolveTable(alter.targetParts, context);
    if (!table) return;

    const cursor = alter.cursor;
    if (cursor.isWord("FOREIGN")) {
      parseTableConstraint(cursor, table, context.pending, alter.constraintName);
      return;
    }

    if (cursor.isWord("PRIMARY")) {
      parseTableConstraint(cursor, table, context.pending, alter.constraintName);
      if (table.pendingPrimaryKey) {
        for (const name of table.pendingPrimaryKey) {
          const column = findColumn(table, name);
          if (column) {
            column.pk = true;
            column.nullable = false;
          }
        }
        delete table.pendingPrimaryKey;
      }
      return;
    }

    if (cursor.isWord("UNIQUE")) {
      parseTableConstraint(cursor, table, context.pending, alter.constraintName);
      for (const index of table.indexes) {
        if (index.unique && index.columns.length === 1) {
          const column = findColumn(table, index.columns[0]);
          if (column) column.unique = true;
        }
      }
      return;
    }

    if (cursor.isWord("COLUMN") || cursor.isName()) {
      cursor.eatWord("COLUMN");
      const column = parseColumnDefinition(cursor, table, context.pending);
      if (column && !findColumn(table, column.name)) table.columns.push(column);
    }
  }

  function parseCreateIndex(cursor, context, unique) {
    if (cursor.isWord("IF") && cursor.isWord("NOT", 1) && cursor.isWord("EXISTS", 2)) cursor.i += 3;
    const nameParts = cursor.isName() && !cursor.isWord("ON") ? readName(cursor) : [];
    if (!cursor.eatWord("ON")) return;

    const parts = readName(cursor);
    if (!parts.length) return;
    if (cursor.isWord("USING")) cursor.i += 2;
    const columns = readColumnList(cursor);
    if (!columns.length) return;

    context.deferredIndexes.push({
      targetParts: parts,
      unique,
      columns,
      name: nameParts[nameParts.length - 1] || null
    });
  }

  function parseComment(cursor, context) {
    if (!cursor.eatWord("ON")) return;
    const kind = cursor.peek();
    if (!kind || kind.type !== "word") return;
    cursor.next();

    const parts = readName(cursor);
    if (!cursor.eatWord("IS")) return;
    const value = cursor.peek();
    if (!value || value.type !== "string") return;

    context.deferredComments.push({
      kind: kind.upper,
      parts,
      text: value.value
    });
  }

  function readCreateKind(cursor) {
    cursor.next();
    let unique = false;
    while (!cursor.done) {
      const token = cursor.peek();
      if (!token || token.type !== "word") break;
      if (token.upper === "TABLE") {
        cursor.next();
        return { kind: "table", unique };
      }
      if (token.upper === "INDEX") {
        cursor.next();
        return { kind: "index", unique };
      }
      if (token.upper === "UNIQUE") {
        unique = true;
        cursor.next();
        continue;
      }
      if (CREATE_MODIFIERS.has(token.upper)) {
        cursor.next();
        continue;
      }
      break;
    }
    return { kind: "other", unique };
  }

  /* ---------------------------------------------------------- 이름 해석 */

  function resolveTable(parts, context) {
    if (!parts.length) return null;
    const name = parts[parts.length - 1].toLowerCase();

    if (parts.length > 1) {
      const qualified = `${parts[parts.length - 2].toLowerCase()}.${name}`;
      const direct = context.byQualified.get(qualified);
      if (direct) return direct;
    }

    const exact = context.byQualified.get(name);
    if (exact) return exact;

    const matches = context.tables.filter((table) => table.name.toLowerCase() === name);
    return matches.length === 1 ? matches[0] : matches[0] || null;
  }

  function collectUniqueSets(table) {
    const sets = [];
    const pk = table.columns.filter((column) => column.pk).map((column) => column.name.toLowerCase());
    if (pk.length) sets.push(pk);
    for (const column of table.columns) {
      if (column.unique) sets.push([column.name.toLowerCase()]);
    }
    for (const index of table.indexes) {
      if (index.unique) sets.push(index.columns.map((name) => name.toLowerCase()));
    }
    return sets;
  }

  function isUniqueColumnSet(table, columns) {
    if (!columns.length) return false;
    const target = columns.map((name) => name.toLowerCase()).slice().sort();
    return table.uniqueSets.some((set) => {
      if (set.length !== target.length) return false;
      const sorted = set.slice().sort();
      return sorted.every((name, index) => name === target[index]);
    });
  }

  function buildRelation(id, from, fromColumns, to, toColumns, options) {
    const nullable = fromColumns.some((name) => {
      const column = findColumn(from, name);
      return !column || column.nullable;
    });

    return {
      id,
      name: options.name || null,
      from: from.id,
      fromTable: from,
      fromColumns,
      to: to.id,
      toTable: to,
      toColumns,
      onDelete: options.onDelete || null,
      onUpdate: options.onUpdate || null,
      kind: options.kind || "explicit",
      optional: nullable,
      identifying: isUniqueColumnSet(from, fromColumns) ? "one" : "many",
      selfReference: from.id === to.id
    };
  }

  /* ---------------------------------------------------------- 관계 추정 */

  function normalizeForMatch(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/^(?:tbl|tb|t|m|mst|dt)[_-]/, "")
      .replace(/[^a-z0-9\u0080-\uffff]/g, "");
  }

  function toSingular(value) {
    if (/ies$/.test(value)) return `${value.slice(0, -3)}y`;
    if (/(?:ches|shes|sses|xes|zes)$/.test(value)) return value.slice(0, -2);
    if (/s$/.test(value) && !/ss$/.test(value)) return value.slice(0, -1);
    return value;
  }

  function toPlural(value) {
    if (/y$/.test(value) && !/[aeiou]y$/.test(value)) return `${value.slice(0, -1)}ies`;
    if (/(?:s|x|z|ch|sh)$/.test(value)) return `${value}es`;
    return `${value}s`;
  }

  function splitKeySuffix(columnName) {
    const snake = String(columnName)
      .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
      .toLowerCase();

    for (const suffix of KEY_SUFFIXES) {
      if (snake.endsWith(suffix) && snake.length > suffix.length) {
        return snake.slice(0, -suffix.length);
      }
    }
    return null;
  }

  function buildTableIndex(tables) {
    const index = new Map();
    for (const table of tables) {
      const normalized = normalizeForMatch(table.name);
      if (!normalized) continue;
      for (const key of new Set([normalized, toSingular(normalized), toPlural(normalized)])) {
        if (!index.has(key)) index.set(key, []);
        index.get(key).push(table);
      }
    }
    return index;
  }

  function pickTargetColumn(table, hint) {
    const pk = table.columns.filter((column) => column.pk);
    if (pk.length === 1) return pk[0].name;
    if (hint) {
      const direct = findColumn(table, hint);
      if (direct) return direct.name;
    }
    const id = findColumn(table, "id");
    if (id) return id.name;
    const unique = table.columns.find((column) => column.unique);
    if (unique) return unique.name;
    return table.columns.length ? table.columns[0].name : "";
  }

  function inferRelations(context) {
    const tables = context.tables;
    const index = buildTableIndex(tables);
    const used = new Set(
      context.relations.map((relation) => `${relation.from}::${relation.fromColumns.join(",").toLowerCase()}`)
    );

    const singlePkOwners = new Map();
    for (const table of tables) {
      const pk = table.columns.filter((column) => column.pk);
      if (pk.length !== 1) continue;
      const key = pk[0].name.toLowerCase();
      if (GENERIC_KEY_NAMES.has(key)) continue;
      if (!singlePkOwners.has(key)) singlePkOwners.set(key, []);
      singlePkOwners.get(key).push(table);
    }

    const inferred = [];

    for (const table of tables) {
      for (const column of table.columns) {
        if (column.fk) continue;
        if (used.has(`${table.id}::${column.name.toLowerCase()}`)) continue;

        let target = null;
        let hint = null;

        const base = splitKeySuffix(column.name);
        if (base) {
          const normalized = normalizeForMatch(base);
          const candidates =
            index.get(normalized) || index.get(toSingular(normalized)) || index.get(toPlural(normalized)) || [];
          // orders.order_no 처럼 제 테이블 이름을 딴 컬럼은 외래키가 아니라 자기 속성이다.
          const usable = candidates.filter((candidate) => candidate !== table);
          if (usable.length === 1) {
            target = usable[0];
            hint = column.name;
          }
        }

        if (!target && !column.pk) {
          const owners = singlePkOwners.get(column.name.toLowerCase()) || [];
          const usable = owners.filter((owner) => owner !== table);
          if (usable.length === 1) {
            target = usable[0];
            hint = column.name;
          }
        }

        if (!target) continue;

        const targetColumn = pickTargetColumn(target, hint);
        if (!targetColumn) continue;

        used.add(`${table.id}::${column.name.toLowerCase()}`);
        column.inferredFk = true;
        inferred.push(
          buildRelation(
            `r${context.relations.length + inferred.length}`,
            table,
            [column.name],
            target,
            [targetColumn],
            { kind: "inferred" }
          )
        );
      }
    }

    return inferred;
  }

  /* ------------------------------------------------------------ 마무리 */

  function finalize(context, options) {
    for (const alter of context.deferredAlters) applyAlter(alter, context);

    for (const entry of context.deferredIndexes) {
      const table = resolveTable(entry.targetParts, context);
      if (!table) continue;
      table.indexes.push({ name: entry.name || null, unique: entry.unique, columns: entry.columns });
      if (entry.unique && entry.columns.length === 1) {
        const column = findColumn(table, entry.columns[0]);
        if (column) column.unique = true;
      }
    }

    for (const entry of context.deferredComments) {
      if (entry.kind === "TABLE") {
        const table = resolveTable(entry.parts, context);
        if (table) table.comment = entry.text;
        continue;
      }
      if (entry.kind === "COLUMN" && entry.parts.length >= 2) {
        const columnName = entry.parts[entry.parts.length - 1];
        const table = resolveTable(entry.parts.slice(0, -1), context);
        if (!table) continue;
        const column = findColumn(table, columnName);
        if (column) column.comment = entry.text;
      }
    }

    for (const table of context.tables) table.uniqueSets = collectUniqueSets(table);

    for (const entry of context.pending) {
      const target = resolveTable(entry.reference.targetParts, context);
      const targetName = entry.reference.targetParts.join(".");

      if (!target) {
        context.unresolved.push({ from: entry.table.qualified, target: targetName });
        continue;
      }

      const fromColumns = entry.columns.filter((name) => findColumn(entry.table, name));
      if (!fromColumns.length) continue;

      let toColumns = entry.reference.targetColumns.filter((name) => findColumn(target, name));
      if (!toColumns.length) {
        const pk = target.columns.filter((column) => column.pk).map((column) => column.name);
        toColumns = pk.length ? pk : [pickTargetColumn(target, fromColumns[0])].filter(Boolean);
      }
      if (!toColumns.length) continue;

      for (const name of fromColumns) {
        const column = findColumn(entry.table, name);
        if (column) column.fk = true;
      }

      context.relations.push(
        buildRelation(`r${context.relations.length}`, entry.table, fromColumns, target, toColumns, {
          name: entry.name,
          onDelete: entry.reference.onDelete,
          onUpdate: entry.reference.onUpdate,
          kind: "explicit"
        })
      );
    }

    const explicitCount = context.relations.length;
    if (options.inferRelations) context.relations.push(...inferRelations(context));

    const seen = new Set();
    context.relations = context.relations.filter((relation) => {
      const key = `${relation.from}|${relation.fromColumns.join(",").toLowerCase()}|${relation.to}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    for (const relation of context.relations) {
      relation.fromTable.outgoing.push(relation);
      relation.toTable.incoming.push(relation);
    }

    let columnCount = 0;
    let pkCount = 0;
    for (const table of context.tables) {
      columnCount += table.columns.length;
      if (table.columns.some((column) => column.pk)) pkCount += 1;
    }

    const isolated = context.tables.filter((table) => !table.outgoing.length && !table.incoming.length).length;

    return {
      tables: context.tables,
      relations: context.relations,
      warnings: context.warnings,
      unresolved: context.unresolved,
      truncated: context.truncated,
      stats: {
        tableCount: context.tables.length,
        columnCount,
        relationCount: context.relations.length,
        explicitCount: Math.min(explicitCount, context.relations.length),
        inferredCount: context.relations.filter((relation) => relation.kind === "inferred").length,
        pkCount,
        isolatedCount: isolated
      }
    };
  }

  function parseSchema(text, options = {}) {
    const settings = { inferRelations: true, ...options };
    const context = {
      tables: [],
      relations: [],
      pending: [],
      deferredAlters: [],
      deferredIndexes: [],
      deferredComments: [],
      byQualified: new Map(),
      warnings: [],
      unresolved: [],
      truncated: false
    };

    const source = String(text || "");
    if (source.length > MAX_INPUT_CHARS) {
      context.warnings.push(t("parse.tooLarge", { mb: Math.round(MAX_INPUT_CHARS / 1024 / 1024) }));
    }

    const statements = splitStatements(tokenize(source.slice(0, MAX_INPUT_CHARS)));

    for (const statement of statements) {
      const cursor = new Cursor(statement);
      const first = cursor.peek();
      if (!first || first.type !== "word") continue;

      try {
        switch (first.upper) {
          case "CREATE": {
            const created = readCreateKind(cursor);
            if (created.kind === "table") parseCreateTable(cursor, context);
            else if (created.kind === "index") parseCreateIndex(cursor, context, created.unique);
            break;
          }
          case "ALTER":
            cursor.next();
            if (cursor.eatWord("TABLE")) parseAlterTable(cursor, context);
            break;
          case "COMMENT":
            cursor.next();
            parseComment(cursor, context);
            break;
          default:
            break;
        }
      } catch (error) {
        context.warnings.push(t("parse.statementError", { message: error.message }));
      }
    }

    if (context.truncated) {
      context.warnings.push(t("parse.tooManyTables", { count: MAX_TABLES }));
    }

    return finalize(context, settings);
  }

  global.DBSchemaParser = { parseSchema, tokenize };
})(globalThis);
