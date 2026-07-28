(function attachSqliteReader(global) {
  "use strict";

  // "SQLite format 3\0"
  const MAGIC = [0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00];

  const MAX_VISITED_PAGES = 200_000;
  const MAX_OBJECTS = 5_000;
  const MAX_TREE_DEPTH = 64;

  const PAGE_INTERIOR_TABLE = 0x05;
  const PAGE_LEAF_TABLE = 0x0d;

  function toBytes(source) {
    if (source instanceof Uint8Array) return source;
    if (source instanceof ArrayBuffer) return new Uint8Array(source);
    if (ArrayBuffer.isView(source)) return new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
    return new Uint8Array(0);
  }

  function isSqliteFile(source) {
    const bytes = toBytes(source);
    if (bytes.length < 100) return false;
    return MAGIC.every((value, index) => bytes[index] === value);
  }

  function readUint16(bytes, offset) {
    return (bytes[offset] << 8) | bytes[offset + 1];
  }

  function readUint32(bytes, offset) {
    return (
      bytes[offset] * 0x1000000 + ((bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3])
    );
  }

  // SQLite 가변 정수: 앞 8바이트는 7비트씩, 9번째 바이트만 8비트를 쓴다.
  function readVarint(bytes, offset) {
    let value = 0;
    for (let index = 0; index < 8; index += 1) {
      const byte = bytes[offset + index];
      if (byte === undefined) return { value, length: index };
      value = value * 128 + (byte & 0x7f);
      if ((byte & 0x80) === 0) return { value, length: index + 1 };
    }
    const last = bytes[offset + 8];
    return { value: value * 256 + (last === undefined ? 0 : last), length: 9 };
  }

  function serialSize(serial) {
    switch (serial) {
      case 0:
      case 8:
      case 9:
      case 10:
      case 11:
        return 0;
      case 1:
        return 1;
      case 2:
        return 2;
      case 3:
        return 3;
      case 4:
        return 4;
      case 5:
        return 6;
      case 6:
      case 7:
        return 8;
      default:
        return serial >= 12 ? Math.floor((serial - 12) / 2) : 0;
    }
  }

  function isTextSerial(serial) {
    return serial >= 13 && serial % 2 === 1;
  }

  function parseRecord(payload) {
    const header = readVarint(payload, 0);
    const headerEnd = Math.min(header.value, payload.length);
    const serials = [];

    let cursor = header.length;
    while (cursor < headerEnd) {
      const serial = readVarint(payload, cursor);
      if (!serial.length) break;
      serials.push(serial.value);
      cursor += serial.length;
    }

    const fields = [];
    let dataOffset = headerEnd;
    for (const serial of serials) {
      const size = serialSize(serial);
      fields.push({ serial, offset: dataOffset, size });
      dataOffset += size;
    }
    return fields;
  }

  function fieldText(payload, field, decoder) {
    if (!field || !isTextSerial(field.serial)) return null;
    const end = Math.min(field.offset + field.size, payload.length);
    if (field.offset >= end) return "";
    return decoder.decode(payload.subarray(field.offset, end));
  }

  function readCellPayload(context, cellOffset) {
    const bytes = context.bytes;
    let cursor = cellOffset;

    const payloadSize = readVarint(bytes, cursor);
    cursor += payloadSize.length;
    const rowid = readVarint(bytes, cursor);
    cursor += rowid.length;

    const total = payloadSize.value;
    if (total <= 0 || total > context.maxPayloadBytes) return null;

    const usable = context.usableSize;
    const maxLocal = usable - 35;

    if (total <= maxLocal) {
      if (cursor + total > bytes.length) {
        context.truncated = true;
        return null;
      }
      return bytes.subarray(cursor, cursor + total);
    }

    const minLocal = Math.floor(((usable - 12) * 32) / 255) - 23;
    let localSize = minLocal + ((total - minLocal) % (usable - 4));
    if (localSize > maxLocal) localSize = minLocal;

    if (cursor + localSize + 4 > bytes.length) {
      context.truncated = true;
      return null;
    }

    const out = new Uint8Array(total);
    out.set(bytes.subarray(cursor, cursor + localSize), 0);
    let written = localSize;

    let next = readUint32(bytes, cursor + localSize);
    const seen = new Set();

    while (next > 0 && written < total) {
      if (seen.has(next) || seen.size > MAX_VISITED_PAGES) break;
      seen.add(next);

      const pageStart = (next - 1) * context.pageSize;
      if (pageStart < 0 || pageStart + Math.min(context.pageSize, usable) > bytes.length) {
        context.truncated = true;
        break;
      }

      const chunk = Math.min(usable - 4, total - written);
      out.set(bytes.subarray(pageStart + 4, pageStart + 4 + chunk), written);
      written += chunk;
      next = readUint32(bytes, pageStart);
    }

    return out.subarray(0, written);
  }

  function walkTable(context, pageNumber, depth, visit) {
    if (depth > MAX_TREE_DEPTH) return;
    if (pageNumber < 1 || context.visited.size > MAX_VISITED_PAGES) return;
    if (context.visited.has(pageNumber)) return;
    context.visited.add(pageNumber);

    const bytes = context.bytes;
    const pageStart = (pageNumber - 1) * context.pageSize;
    if (pageStart + context.pageSize > bytes.length) {
      context.truncated = true;
      return;
    }

    // 1번 페이지는 100바이트 파일 헤더 뒤에서 b-tree 헤더가 시작된다.
    const headerStart = pageNumber === 1 ? pageStart + 100 : pageStart;
    const pageType = bytes[headerStart];
    if (pageType !== PAGE_INTERIOR_TABLE && pageType !== PAGE_LEAF_TABLE) return;

    const cellCount = readUint16(bytes, headerStart + 3);
    const pointerStart = headerStart + (pageType === PAGE_INTERIOR_TABLE ? 12 : 8);

    if (pageType === PAGE_INTERIOR_TABLE) {
      for (let index = 0; index < cellCount; index += 1) {
        const pointer = readUint16(bytes, pointerStart + index * 2);
        const cellOffset = pageStart + pointer;
        if (cellOffset + 4 > bytes.length) {
          context.truncated = true;
          continue;
        }
        walkTable(context, readUint32(bytes, cellOffset), depth + 1, visit);
      }
      walkTable(context, readUint32(bytes, headerStart + 8), depth + 1, visit);
      return;
    }

    for (let index = 0; index < cellCount; index += 1) {
      const pointer = readUint16(bytes, pointerStart + index * 2);
      const cellOffset = pageStart + pointer;
      if (cellOffset >= bytes.length) {
        context.truncated = true;
        continue;
      }
      const payload = readCellPayload(context, cellOffset);
      if (payload) visit(payload);
    }
  }

  function decoderFor(encodingFlag) {
    if (encodingFlag === 2) return { decoder: new TextDecoder("utf-16le"), label: "UTF-16LE" };
    if (encodingFlag === 3) return { decoder: new TextDecoder("utf-16be"), label: "UTF-16BE" };
    return { decoder: new TextDecoder("utf-8"), label: "UTF-8" };
  }

  /**
   * SQLite 파일의 sqlite_master 를 훑어 원본 DDL 문장을 그대로 뽑아낸다.
   * 테이블 구조를 재구성하지 않고 저장된 CREATE 문을 꺼내므로 방언 해석이 필요 없다.
   */
  function readSchema(source) {
    const bytes = toBytes(source);
    const warnings = [];

    if (!isSqliteFile(bytes)) {
      return { ok: false, reason: "not-sqlite", sql: "", warnings, tableCount: 0, indexCount: 0 };
    }

    let pageSize = readUint16(bytes, 16);
    if (pageSize === 1) pageSize = 65536;
    if (pageSize < 512 || (pageSize & (pageSize - 1)) !== 0) {
      return { ok: false, reason: "bad-page-size", sql: "", warnings, tableCount: 0, indexCount: 0 };
    }

    const reserved = bytes[20] || 0;
    const usableSize = pageSize - reserved;
    if (usableSize < 480) {
      return { ok: false, reason: "bad-page-size", sql: "", warnings, tableCount: 0, indexCount: 0 };
    }

    const encoding = decoderFor(readUint32(bytes, 56));

    const context = {
      bytes,
      pageSize,
      usableSize,
      visited: new Set(),
      truncated: false,
      maxPayloadBytes: 8 * 1024 * 1024
    };

    const tables = [];
    const indexes = [];
    let skippedInternal = 0;

    walkTable(context, 1, 0, (payload) => {
      if (tables.length + indexes.length >= MAX_OBJECTS) return;

      const fields = parseRecord(payload);
      if (fields.length < 5) return;

      const type = fieldText(payload, fields[0], encoding.decoder);
      const name = fieldText(payload, fields[1], encoding.decoder);
      const sql = fieldText(payload, fields[4], encoding.decoder);

      if (!sql || !sql.trim()) return; // 자동 생성 인덱스는 sql 이 NULL 이다.
      if (name && /^sqlite_/i.test(name)) {
        skippedInternal += 1;
        return;
      }

      const statement = `${sql.trim()};`;
      if (type === "table") tables.push(statement);
      else if (type === "index") indexes.push(statement);
    });

    const t = (key, params) => global.DBSchemaI18n.t(key, params);

    if (context.truncated) {
      warnings.push(t("sqlite.partial"));
    }
    if (skippedInternal) {
      warnings.push(t("sqlite.internalSkipped", { count: skippedInternal }));
    }

    const header = [
      t("sqlite.headerTitle"),
      t("sqlite.headerMeta", {
        tables: tables.length,
        indexes: indexes.length,
        pageSize,
        encoding: encoding.label
      })
    ].join("\n");

    const body = [...tables, ...indexes].join("\n\n");

    return {
      ok: true,
      sql: body ? `${header}\n\n${body}\n` : `${header}\n`,
      warnings,
      tableCount: tables.length,
      indexCount: indexes.length,
      pageSize,
      encoding: encoding.label,
      truncated: context.truncated
    };
  }

  global.DBSchemaSqlite = { isSqliteFile, readSchema };
})(globalThis);
