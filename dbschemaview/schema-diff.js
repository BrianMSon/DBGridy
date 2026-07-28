/* DBSchemaView — 스키마 대조 엔진
 *
 * 파서가 만든 스키마 두 개를 받아 SOURCE 를 TARGET 으로 만들기 위한 변경 내역을 계산한다.
 * 방언마다 같은 뜻을 다른 표기로 적기 때문에 타입과 기본값은 정규화한 값으로 비교하고,
 * 화면과 스크립트에는 원문을 그대로 넘긴다. */
(function (global) {
  "use strict";

  /* --------------------------------------------------------------- 정규화 */

  // 같은 타입의 방언별 표기를 하나로 모은다. 앞선 규칙이 먼저 적용되므로 긴 이름을 위에 둔다.
  const TYPE_ALIASES = [
    [/\bCHARACTER VARYING\b/g, "VARCHAR"],
    [/\bCHARACTER\b/g, "CHAR"],
    [/\bDOUBLE PRECISION\b/g, "DOUBLE"],
    [/\bTIMESTAMP WITHOUT TIME ZONE\b/g, "TIMESTAMP"],
    [/\bTIMESTAMP WITH TIME ZONE\b/g, "TIMESTAMPTZ"],
    [/\bTIME WITHOUT TIME ZONE\b/g, "TIME"],
    [/\bTIME WITH TIME ZONE\b/g, "TIMETZ"],
    [/\bBOOLEAN\b/g, "BOOL"],
    [/\bNUMERIC\b/g, "DECIMAL"],
    [/\bDEC\b/g, "DECIMAL"],
    [/\bINTEGER\b/g, "INT"],
    [/\bINT4\b/g, "INT"],
    [/\bINT8\b/g, "BIGINT"],
    [/\bINT2\b/g, "SMALLINT"],
    [/\bFLOAT8\b/g, "DOUBLE"],
    [/\bFLOAT4\b/g, "REAL"],
    [/\bBPCHAR\b/g, "CHAR"],
    [/\bVARCHAR2\b/g, "VARCHAR"],
    [/\bNVARCHAR2\b/g, "NVARCHAR"]
  ];

  // MySQL 표시 너비는 의미가 없어서 비교에서 뺀다.
  const DISPLAY_WIDTH = /\b(TINYINT|SMALLINT|MEDIUMINT|INT|BIGINT)\(\d+\)/g;

  function lower(value) {
    return String(value == null ? "" : value).toLowerCase();
  }

  function normalizeType(raw) {
    let text = String(raw || "")
      .toUpperCase()
      .replace(/\s+/g, " ")
      .trim();
    if (!text) return "";

    text = text.replace(/\s*\(\s*/g, "(").replace(/\s*\)/g, ")").replace(/\s*,\s*/g, ",");
    for (const [pattern, canonical] of TYPE_ALIASES) text = text.replace(pattern, canonical);
    text = text.replace(DISPLAY_WIDTH, "$1");
    return text;
  }

  function parensBalanced(text) {
    let depth = 0;
    for (const character of text) {
      if (character === "(") depth += 1;
      else if (character === ")") depth -= 1;
      if (depth < 0) return false;
    }
    return depth === 0;
  }

  function normalizeDefault(raw) {
    if (raw == null) return null;
    let text = String(raw).trim();
    if (!text || /^null$/i.test(text)) return null;

    // SQL Server 는 ((0)) 처럼 괄호로 감싸 저장한다.
    while (text.length > 2 && text.startsWith("(") && text.endsWith(")") && parensBalanced(text.slice(1, -1))) {
      text = text.slice(1, -1).trim();
    }

    if (text.length >= 2 && text.startsWith("'") && text.endsWith("'")) {
      const inner = text.slice(1, -1);
      return /^-?\d+(\.\d+)?$/.test(inner) ? String(Number(inner)) : `'${inner}'`;
    }
    if (/^-?\d+(\.\d+)?$/.test(text)) return String(Number(text));

    return text.toUpperCase().replace(/\s+/g, " ").replace(/\(\s*\)$/, "");
  }

  /* ------------------------------------------------------- 테이블 부속 정보 */

  function primaryKeyColumns(table) {
    return table.columns.filter((column) => column.pk).map((column) => column.name);
  }

  // 인라인 UNIQUE 와 테이블 수준 UNIQUE 는 저장 위치가 달라서 한곳으로 모은다.
  function uniqueConstraints(table) {
    const list = [];
    const seen = new Set();

    const add = (columns, name) => {
      if (!columns.length) return;
      const key = columns.map(lower).slice().sort().join(",");
      if (seen.has(key)) return;
      seen.add(key);
      list.push({ key, columns, name: name || null });
    };

    for (const column of table.columns) {
      if (column.unique && !column.pk) add([column.name], null);
    }
    for (const index of table.indexes) {
      if (index.unique) add(index.columns, index.name);
    }
    return list;
  }

  function plainIndexes(table) {
    const list = [];
    const seen = new Set();
    for (const index of table.indexes) {
      if (index.unique || !index.columns.length) continue;
      const key = index.columns.map(lower).join(",");
      if (seen.has(key)) continue;
      seen.add(key);
      list.push({ key, columns: index.columns, name: index.name || null });
    }
    return list;
  }

  function explicitRelations(table) {
    return table.outgoing.filter((relation) => relation.kind === "explicit");
  }

  /* --------------------------------------------------------- 테이블 짝짓기 */

  function countBy(tables, pick) {
    const counts = new Map();
    for (const table of tables) {
      const key = pick(table);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }

  /* 이름이 완전히 같으면 바로 짝짓고, 스키마 한정자만 다른 경우는 양쪽에서 그 이름이
   * 하나뿐일 때만 같은 테이블로 본다. (`public.users` 와 `users`) */
  function matchTables(sourceTables, targetTables) {
    const matched = new Map();
    const takenTargets = new Set();

    const targetByQualified = new Map();
    const targetByName = new Map();
    for (const table of targetTables) {
      const qualified = lower(table.qualified);
      if (!targetByQualified.has(qualified)) targetByQualified.set(qualified, table);
      const bare = lower(table.name);
      if (!targetByName.has(bare)) targetByName.set(bare, table);
    }

    const sourceNameCount = countBy(sourceTables, (table) => lower(table.name));
    const targetNameCount = countBy(targetTables, (table) => lower(table.name));

    for (const source of sourceTables) {
      let target = targetByQualified.get(lower(source.qualified)) || null;
      if (target && takenTargets.has(target)) target = null;

      if (!target) {
        const bare = lower(source.name);
        if (sourceNameCount.get(bare) === 1 && targetNameCount.get(bare) === 1) {
          const candidate = targetByName.get(bare);
          if (candidate && !takenTargets.has(candidate)) target = candidate;
        }
      }

      if (target) {
        matched.set(source, target);
        takenTargets.add(target);
      }
    }

    return { matched, takenTargets };
  }

  /* ------------------------------------------------------------- 컬럼 비교 */

  // 라벨은 언어가 바뀔 수 있으니 이름표만 들고 있다가 쓸 때 옮긴다.
  const COLUMN_FIELDS = [
    { key: "type", labelKey: "field.type", read: (column) => column.type || "", normalize: normalizeType },
    { key: "nullable", labelKey: "field.nullable", read: (column) => (column.nullable ? "NULL" : "NOT NULL") },
    { key: "defaultValue", labelKey: "field.default", read: (column) => column.defaultValue, normalize: normalizeDefault },
    { key: "auto", labelKey: "field.auto", read: (column) => (column.auto ? "AUTO" : "—") },
    { key: "generated", labelKey: "field.generated", read: (column) => (column.generated ? "GENERATED" : "—") },
    { key: "comment", labelKey: "field.comment", read: (column) => column.comment || "" }
  ];

  function columnChanges(source, target) {
    const changes = [];
    for (const field of COLUMN_FIELDS) {
      const from = field.read(source);
      const to = field.read(target);
      const normalize = field.normalize || ((value) => (value == null ? "" : String(value)));
      if (normalize(from) === normalize(to)) continue;
      changes.push({
        field: field.key,
        label: global.DBSchemaI18n.t(field.labelKey),
        from: from == null ? "" : String(from),
        to: to == null ? "" : String(to)
      });
    }
    return changes;
  }

  function diffColumns(sourceTable, targetTable) {
    const sourceColumns = sourceTable ? sourceTable.columns : [];
    const targetColumns = targetTable ? targetTable.columns : [];

    const sourceByName = new Map();
    for (const column of sourceColumns) sourceByName.set(lower(column.name), column);

    const result = [];
    const seen = new Set();

    targetColumns.forEach((column, index) => {
      const key = lower(column.name);
      const source = sourceByName.get(key) || null;
      seen.add(key);

      if (!source) {
        result.push({ status: "added", name: column.name, source: null, target: column, changes: [], targetIndex: index });
        return;
      }
      const changes = columnChanges(source, column);
      result.push({
        status: changes.length ? "changed" : "same",
        name: column.name,
        source,
        target: column,
        changes,
        targetIndex: index
      });
    });

    sourceColumns.forEach((column, index) => {
      if (seen.has(lower(column.name))) return;
      result.push({
        status: "removed",
        name: column.name,
        source: column,
        target: null,
        changes: [],
        sourceIndex: index
      });
    });

    return result;
  }

  /* --------------------------------------------------------- 제약 · 인덱스 */

  function diffKeyedList(sourceList, targetList) {
    const sourceByKey = new Map(sourceList.map((entry) => [entry.key, entry]));
    const targetByKey = new Map(targetList.map((entry) => [entry.key, entry]));
    const result = [];

    for (const entry of targetList) {
      if (sourceByKey.has(entry.key)) continue;
      result.push({ status: "added", columns: entry.columns, name: entry.name, source: null, target: entry });
    }
    for (const entry of sourceList) {
      if (targetByKey.has(entry.key)) continue;
      result.push({ status: "removed", columns: entry.columns, name: entry.name, source: entry, target: null });
    }
    return result;
  }

  /* ----------------------------------------------------------- 외래키 비교 */

  function relationKey(relation, keyOf) {
    return `${relation.fromColumns.map(lower).join(",")}=>${keyOf(relation.toTable)}(${relation.toColumns
      .map(lower)
      .join(",")})`;
  }

  function relationAction(relation) {
    return `${lower(relation.onDelete) || "-"}/${lower(relation.onUpdate) || "-"}`;
  }

  function diffRelations(sourceTable, targetTable, keyOf) {
    const sourceList = sourceTable ? explicitRelations(sourceTable) : [];
    const targetList = targetTable ? explicitRelations(targetTable) : [];

    const sourceByKey = new Map();
    for (const relation of sourceList) sourceByKey.set(relationKey(relation, keyOf), relation);
    const targetByKey = new Map();
    for (const relation of targetList) targetByKey.set(relationKey(relation, keyOf), relation);

    const result = [];

    for (const relation of targetList) {
      const key = relationKey(relation, keyOf);
      const source = sourceByKey.get(key) || null;
      if (!source) {
        result.push({ status: "added", key, source: null, target: relation, changes: [] });
        continue;
      }
      const changes = [];
      if (relationAction(source) !== relationAction(relation)) {
        changes.push({
          field: "action",
          label: global.DBSchemaI18n.t("field.action"),
          from: `ON DELETE ${source.onDelete || "NO ACTION"} · ON UPDATE ${source.onUpdate || "NO ACTION"}`,
          to: `ON DELETE ${relation.onDelete || "NO ACTION"} · ON UPDATE ${relation.onUpdate || "NO ACTION"}`
        });
      }
      if (changes.length) result.push({ status: "changed", key, source, target: relation, changes });
    }

    for (const relation of sourceList) {
      const key = relationKey(relation, keyOf);
      if (targetByKey.has(key)) continue;
      result.push({ status: "removed", key, source: relation, target: null, changes: [] });
    }

    return result;
  }

  /* --------------------------------------------------------------- 메인 */

  function buildTableDiff(source, target, keyOf) {
    const columns = diffColumns(source, target);
    const sourcePk = source ? primaryKeyColumns(source) : [];
    const targetPk = target ? primaryKeyColumns(target) : [];

    const bothSides = Boolean(source && target);
    const pk =
      bothSides && sourcePk.map(lower).join(",") !== targetPk.map(lower).join(",")
        ? { from: sourcePk, to: targetPk }
        : null;

    const uniques = bothSides ? diffKeyedList(uniqueConstraints(source), uniqueConstraints(target)) : [];
    const indexes = bothSides ? diffKeyedList(plainIndexes(source), plainIndexes(target)) : [];
    const relations = diffRelations(source, target, keyOf);

    const comment =
      bothSides && (source.comment || "") !== (target.comment || "")
        ? { from: source.comment || "", to: target.comment || "" }
        : null;

    let status;
    if (!source) status = "added";
    else if (!target) status = "removed";
    else {
      const touched =
        columns.some((entry) => entry.status !== "same") ||
        pk ||
        uniques.length ||
        indexes.length ||
        relations.length ||
        comment;
      status = touched ? "changed" : "same";
    }

    const changeCount =
      status === "added" || status === "removed"
        ? 1
        : columns.filter((entry) => entry.status !== "same").length +
          (pk ? 1 : 0) +
          uniques.length +
          indexes.length +
          relations.length +
          (comment ? 1 : 0);

    const anchor = target || source;
    return {
      key: keyOf(anchor),
      name: anchor.name,
      schema: anchor.schema,
      qualified: anchor.qualified,
      status,
      source,
      target,
      columns,
      pk,
      uniques,
      indexes,
      relations,
      comment,
      changeCount
    };
  }

  function compare(sourceSchema, targetSchema) {
    const sourceTables = sourceSchema ? sourceSchema.tables : [];
    const targetTables = targetSchema ? targetSchema.tables : [];

    const { matched, takenTargets } = matchTables(sourceTables, targetTables);
    const targetToSource = new Map();
    for (const [source, target] of matched) targetToSource.set(target, source);

    // 짝지어진 테이블은 한 이름으로 부른다. 외래키 비교가 같은 기준을 써야 한다.
    const canonical = new Map();
    for (const target of targetTables) canonical.set(target, lower(target.qualified));
    for (const source of sourceTables) {
      const target = matched.get(source);
      canonical.set(source, target ? canonical.get(target) : lower(source.qualified));
    }
    const keyOf = (table) => (table && canonical.get(table)) || lower(table ? table.qualified : "");

    const tables = [];
    for (const target of targetTables) {
      tables.push(buildTableDiff(targetToSource.get(target) || null, target, keyOf));
    }
    for (const source of sourceTables) {
      if (matched.has(source)) continue;
      tables.push(buildTableDiff(source, null, keyOf));
    }

    const stats = {
      addedTables: 0,
      removedTables: 0,
      changedTables: 0,
      sameTables: 0,
      addedColumns: 0,
      removedColumns: 0,
      changedColumns: 0,
      addedRelations: 0,
      removedRelations: 0,
      changedRelations: 0,
      constraintChanges: 0
    };

    for (const table of tables) {
      if (table.status === "added") stats.addedTables += 1;
      else if (table.status === "removed") stats.removedTables += 1;
      else if (table.status === "changed") stats.changedTables += 1;
      else stats.sameTables += 1;

      for (const column of table.columns) {
        if (column.status === "added" && table.status !== "added") stats.addedColumns += 1;
        else if (column.status === "removed" && table.status !== "removed") stats.removedColumns += 1;
        else if (column.status === "changed") stats.changedColumns += 1;
      }

      for (const relation of table.relations) {
        if (relation.status === "added") stats.addedRelations += 1;
        else if (relation.status === "removed") stats.removedRelations += 1;
        else stats.changedRelations += 1;
      }

      stats.constraintChanges += table.uniques.length + table.indexes.length + (table.pk ? 1 : 0);
    }

    return {
      tables,
      stats,
      identical: stats.addedTables === 0 && stats.removedTables === 0 && stats.changedTables === 0
    };
  }

  // 뒤의 세 개는 ddl-writer 가 CREATE TABLE 을 다시 적을 때 같은 규칙으로 읽으려고 쓴다.
  global.DBSchemaDiff = { compare, primaryKeyColumns, uniqueConstraints, plainIndexes, explicitRelations };
})(globalThis);
