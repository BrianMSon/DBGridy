(function attachExcelReader(global) {
  "use strict";

  const MODERN_EXCEL_PATTERN = /\.(xlsx|xlsm|xltx|xltm)$/i;
  const LEGACY_EXCEL_PATTERN = /\.(xls|xlsb)$/i;
  const RELATIONSHIP_NAMESPACE =
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const MAX_EXCEL_CELLS = 250_000;
  const MAX_EXCEL_GRID_CELLS = 500_000;
  const MAX_UNCOMPRESSED_ENTRY_BYTES = 256 * 1024 * 1024;

  function t(key, params) {
    return global.AllCompareI18n ? global.AllCompareI18n.t(key, params) : key;
  }

  class ZipArchive {
    constructor(buffer) {
      this.bytes = new Uint8Array(buffer);
      this.view = new DataView(buffer);
      this.entries = new Map();
      this.readCentralDirectory();
    }

    readCentralDirectory() {
      const endOffset = this.findEndOfCentralDirectory();
      const entryCount = this.view.getUint16(endOffset + 10, true);
      const centralDirectoryOffset = this.view.getUint32(endOffset + 16, true);
      let offset = centralDirectoryOffset;

      for (let index = 0; index < entryCount; index += 1) {
        if (this.view.getUint32(offset, true) !== 0x02014b50) {
          throw new Error(t("excel.centralDirectory"));
        }

        const flags = this.view.getUint16(offset + 8, true);
        const compressionMethod = this.view.getUint16(offset + 10, true);
        const compressedSize = this.view.getUint32(offset + 20, true);
        const uncompressedSize = this.view.getUint32(offset + 24, true);
        const fileNameLength = this.view.getUint16(offset + 28, true);
        const extraLength = this.view.getUint16(offset + 30, true);
        const commentLength = this.view.getUint16(offset + 32, true);
        const localHeaderOffset = this.view.getUint32(offset + 42, true);
        const fileNameBytes = this.bytes.subarray(offset + 46, offset + 46 + fileNameLength);
        const fileName = normalizeArchivePath(new TextDecoder("utf-8").decode(fileNameBytes));

        if (uncompressedSize > MAX_UNCOMPRESSED_ENTRY_BYTES) {
          throw new Error(t("excel.entryTooLarge", { name: fileName }));
        }

        this.entries.set(fileName, {
          flags,
          compressionMethod,
          compressedSize,
          uncompressedSize,
          localHeaderOffset
        });

        offset += 46 + fileNameLength + extraLength + commentLength;
      }
    }

    findEndOfCentralDirectory() {
      const minimumOffset = Math.max(0, this.bytes.length - 65_557);
      for (let offset = this.bytes.length - 22; offset >= minimumOffset; offset -= 1) {
        if (this.view.getUint32(offset, true) === 0x06054b50) {
          return offset;
        }
      }
      throw new Error(t("excel.zipStructure"));
    }

    has(path) {
      return this.entries.has(normalizeArchivePath(path));
    }

    findPath(suffix) {
      const normalizedSuffix = normalizeArchivePath(suffix).toLowerCase();
      return [...this.entries.keys()].find((path) => path.toLowerCase().endsWith(normalizedSuffix));
    }

    async bytesFor(path) {
      const normalizedPath = normalizeArchivePath(path);
      const entry = this.entries.get(normalizedPath);
      if (!entry) {
        return null;
      }
      if ((entry.flags & 0x0001) !== 0) {
        throw new Error(t("excel.encrypted"));
      }

      const localOffset = entry.localHeaderOffset;
      if (this.view.getUint32(localOffset, true) !== 0x04034b50) {
        throw new Error(t("excel.headerDamaged", { path: normalizedPath }));
      }
      const fileNameLength = this.view.getUint16(localOffset + 26, true);
      const extraLength = this.view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + fileNameLength + extraLength;
      const compressed = this.bytes.slice(dataStart, dataStart + entry.compressedSize);

      if (entry.compressionMethod === 0) {
        return compressed;
      }
      if (entry.compressionMethod !== 8) {
        throw new Error(t("excel.method", { method: entry.compressionMethod }));
      }
      if (typeof DecompressionStream === "undefined") {
        throw new Error(t("excel.decompressUnsupported"));
      }

      try {
        const stream = new Blob([compressed])
          .stream()
          .pipeThrough(new DecompressionStream("deflate-raw"));
        return new Uint8Array(await new Response(stream).arrayBuffer());
      } catch {
        throw new Error(t("excel.decompressFailed", { path: normalizedPath }));
      }
    }

    async text(path) {
      const bytes = await this.bytesFor(path);
      return bytes ? new TextDecoder("utf-8").decode(bytes) : null;
    }
  }

  function normalizeArchivePath(path) {
    return String(path || "").replaceAll("\\", "/").replace(/^\/+/, "");
  }

  function resolveArchivePath(sourcePath, targetPath) {
    const normalizedTarget = String(targetPath || "").replaceAll("\\", "/");
    if (normalizedTarget.startsWith("/")) {
      return normalizeArchivePath(normalizedTarget);
    }

    const parts = normalizeArchivePath(sourcePath).split("/");
    parts.pop();
    normalizedTarget.split("/").forEach((part) => {
      if (!part || part === ".") {
        return;
      }
      if (part === "..") {
        parts.pop();
      } else {
        parts.push(part);
      }
    });
    return parts.join("/");
  }

  function parseXml(xml, path) {
    const documentNode = new DOMParser().parseFromString(xml, "application/xml");
    if (documentNode.querySelector("parsererror")) {
      throw new Error(t("excel.xmlFailed", { path }));
    }
    return documentNode;
  }

  function elements(documentNode, localName) {
    const namespaced = documentNode.getElementsByTagNameNS("*", localName);
    return namespaced.length > 0
      ? Array.from(namespaced)
      : Array.from(documentNode.getElementsByTagName(localName));
  }

  function relationshipId(node) {
    return node.getAttribute("r:id") ||
      node.getAttributeNS(RELATIONSHIP_NAMESPACE, "id") ||
      "";
  }

  async function readRelationships(archive, relationshipPath, sourcePath) {
    const xml = await archive.text(relationshipPath);
    if (!xml) {
      return new Map();
    }

    const documentNode = parseXml(xml, relationshipPath);
    return new Map(elements(documentNode, "Relationship").map((node) => [
      node.getAttribute("Id"),
      {
        type: node.getAttribute("Type") || "",
        target: resolveArchivePath(sourcePath, node.getAttribute("Target") || "")
      }
    ]));
  }

  async function readSharedStrings(archive) {
    const path = archive.has("xl/sharedStrings.xml")
      ? "xl/sharedStrings.xml"
      : archive.findPath("/sharedStrings.xml");
    if (!path) {
      return [];
    }

    const xml = await archive.text(path);
    const documentNode = parseXml(xml, path);
    return elements(documentNode, "si").map((item) =>
      elements(item, "t").map((textNode) => textNode.textContent || "").join("")
    );
  }

  function parseCellAddress(address) {
    const match = String(address || "").replaceAll("$", "").match(/^([A-Z]+)(\d+)$/i);
    if (!match) {
      return null;
    }

    let column = 0;
    for (const character of match[1].toUpperCase()) {
      column = column * 26 + character.charCodeAt(0) - 64;
    }
    return { row: Number(match[2]), column };
  }

  function columnName(column) {
    let value = column;
    let name = "";
    while (value > 0) {
      value -= 1;
      name = String.fromCharCode(65 + (value % 26)) + name;
      value = Math.floor(value / 26);
    }
    return name;
  }

  function parseRange(reference) {
    const [startText, endText = startText] = String(reference || "").replaceAll("$", "").split(":");
    const start = parseCellAddress(startText);
    const end = parseCellAddress(endText);
    if (!start || !end) {
      return null;
    }
    return {
      startRow: Math.min(start.row, end.row),
      endRow: Math.max(start.row, end.row),
      startColumn: Math.min(start.column, end.column),
      endColumn: Math.max(start.column, end.column)
    };
  }

  function rangeAddress(range) {
    return `${columnName(range.startColumn)}${range.startRow}:${columnName(range.endColumn)}${range.endRow}`;
  }

  function readCellValue(cell, sharedStrings) {
    const type = cell.getAttribute("t") || "";
    const valueNode = elements(cell, "v")[0];
    const formulaNode = elements(cell, "f")[0];
    const rawValue = valueNode?.textContent ?? "";

    if (type === "s") {
      return sharedStrings[Number(rawValue)] ?? rawValue;
    }
    if (type === "inlineStr") {
      return elements(cell, "t").map((node) => node.textContent || "").join("");
    }
    if (type === "b") {
      return rawValue === "1" ? "TRUE" : "FALSE";
    }
    if (type === "e") {
      return rawValue ? `#${rawValue}` : "#ERROR";
    }
    if (rawValue !== "") {
      return rawValue;
    }
    return formulaNode?.textContent ? `=${formulaNode.textContent}` : "";
  }

  function worksheetRelationshipsPath(sheetPath) {
    const parts = normalizeArchivePath(sheetPath).split("/");
    const fileName = parts.pop();
    return `${parts.join("/")}/_rels/${fileName}.rels`;
  }

  async function readTableDefinitions(archive, sheetPath) {
    const relationships = await readRelationships(
      archive,
      worksheetRelationshipsPath(sheetPath),
      sheetPath
    );
    const tableDefinitions = [];

    for (const relationship of relationships.values()) {
      if (!relationship.type.endsWith("/table") && !relationship.target.includes("/tables/")) {
        continue;
      }
      const xml = await archive.text(relationship.target);
      if (!xml) {
        continue;
      }
      const documentNode = parseXml(xml, relationship.target);
      const table = elements(documentNode, "table")[0];
      const range = parseRange(table?.getAttribute("ref"));
      if (!table || !range) {
        continue;
      }
      tableDefinitions.push({
        name: table.getAttribute("displayName") || table.getAttribute("name") || "Table",
        range,
        path: relationship.target,
        columnNames: elements(documentNode, "tableColumn")
          .map((column) => column.getAttribute("name") || "")
      });
    }

    return tableDefinitions.sort((left, right) =>
      left.range.startRow - right.range.startRow ||
      left.range.startColumn - right.range.startColumn
    );
  }

  function normalizeCellText(value) {
    return String(value ?? "")
      .replace(/\r\n?|\n/g, "\\n")
      .replace(/\t/g, "\\t");
  }

  function rowsForRange(cellRows, range, fallbackHeaders = []) {
    const gridCellCount =
      (range.endRow - range.startRow + 1) *
      (range.endColumn - range.startColumn + 1);
    if (gridCellCount > MAX_EXCEL_GRID_CELLS) {
      throw new Error(
        t("excel.rangeTooLarge", {
          range: rangeAddress(range),
          cells: gridCellCount.toLocaleString()
        })
      );
    }

    const rows = [];
    for (let row = range.startRow; row <= range.endRow; row += 1) {
      const values = [];
      for (let column = range.startColumn; column <= range.endColumn; column += 1) {
        const cellValue = cellRows.get(row)?.get(column) ?? "";
        const fallback = row === range.startRow
          ? fallbackHeaders[column - range.startColumn] || ""
          : "";
        values.push(normalizeCellText(cellValue || fallback));
      }
      rows.push(values.join("\t"));
    }
    return rows;
  }

  async function readWorksheet(archive, sheetPath, sheetName, sharedStrings) {
    const xml = await archive.text(sheetPath);
    if (!xml) {
      return {
        sections: [`# Sheet: ${sheetName} [${t("excel.sheetFailed")}]`],
        cellCount: 0,
        tableCount: 0
      };
    }

    const documentNode = parseXml(xml, sheetPath);
    const cellRows = new Map();
    let cellCount = 0;
    let minRow = Infinity;
    let maxRow = 0;
    let minColumn = Infinity;
    let maxColumn = 0;

    for (const cell of elements(documentNode, "c")) {
      const address = parseCellAddress(cell.getAttribute("r"));
      if (!address) {
        continue;
      }
      const value = readCellValue(cell, sharedStrings);
      if (!cellRows.has(address.row)) {
        cellRows.set(address.row, new Map());
      }
      cellRows.get(address.row).set(address.column, value);
      cellCount += 1;
      minRow = Math.min(minRow, address.row);
      maxRow = Math.max(maxRow, address.row);
      minColumn = Math.min(minColumn, address.column);
      maxColumn = Math.max(maxColumn, address.column);
      if (cellCount > MAX_EXCEL_CELLS) {
        throw new Error(
          t("excel.tooManyCells", { limit: MAX_EXCEL_CELLS.toLocaleString() })
        );
      }
    }

    const tables = await readTableDefinitions(archive, sheetPath);
    if (tables.length > 0) {
      const sections = tables.map((table) => {
        const title = `# Table: ${normalizeCellText(table.name)} [${normalizeCellText(sheetName)}!${rangeAddress(table.range)}]`;
        return [
          title,
          ...rowsForRange(cellRows, table.range, table.columnNames)
        ].join("\n");
      });
      return { sections, cellCount, tableCount: tables.length };
    }

    if (cellCount === 0) {
      return {
        sections: [`# Sheet: ${normalizeCellText(sheetName)} [empty]`],
        cellCount: 0,
        tableCount: 0
      };
    }

    const range = {
      startRow: minRow,
      endRow: maxRow,
      startColumn: minColumn,
      endColumn: maxColumn
    };
    return {
      sections: [
        [
          `# Sheet: ${normalizeCellText(sheetName)} [${rangeAddress(range)}]`,
          ...rowsForRange(cellRows, range)
        ].join("\n")
      ],
      cellCount,
      tableCount: 0
    };
  }

  async function readWorkbook(buffer, fileName = "workbook.xlsx") {
    const archive = new ZipArchive(buffer);
    const workbookPath = archive.has("xl/workbook.xml")
      ? "xl/workbook.xml"
      : archive.findPath("/workbook.xml");
    if (!workbookPath) {
      throw new Error(t("excel.workbookMissing"));
    }

    const workbookXml = await archive.text(workbookPath);
    const workbookDocument = parseXml(workbookXml, workbookPath);
    const workbookRelationships = await readRelationships(
      archive,
      "xl/_rels/workbook.xml.rels",
      workbookPath
    );
    const sharedStrings = await readSharedStrings(archive);
    const sections = [];
    let sheetCount = 0;
    let tableCount = 0;
    let cellCount = 0;

    for (const sheet of elements(workbookDocument, "sheet")) {
      const id = relationshipId(sheet);
      const relationship = workbookRelationships.get(id);
      if (!relationship?.target) {
        continue;
      }
      const sheetName = sheet.getAttribute("name") || `Sheet${sheetCount + 1}`;
      const worksheet = await readWorksheet(
        archive,
        relationship.target,
        sheetName,
        sharedStrings
      );
      sections.push(...worksheet.sections);
      sheetCount += 1;
      tableCount += worksheet.tableCount;
      cellCount += worksheet.cellCount;
    }

    if (sheetCount === 0) {
      throw new Error(t("excel.noSheets"));
    }

    return {
      text: `${sections.join("\n\n")}\n`,
      sheetCount,
      tableCount,
      cellCount,
      encoding: t("encodingLabel.excel", { sheets: sheetCount, tables: tableCount }),
      encodingKey: "encodingLabel.excel",
      encodingParams: { sheets: sheetCount, tables: tableCount },
      fileName
    };
  }

  global.AllCompareExcel = {
    isModernExcelFile(fileName) {
      return MODERN_EXCEL_PATTERN.test(String(fileName || ""));
    },
    isLegacyExcelFile(fileName) {
      return LEGACY_EXCEL_PATTERN.test(String(fileName || ""));
    },
    readWorkbook
  };
})(globalThis);
