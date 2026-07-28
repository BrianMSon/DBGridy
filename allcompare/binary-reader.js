(function attachBinaryReader(global) {
  "use strict";

  const MAX_ARCHIVE_ENTRY_BYTES = 256 * 1024 * 1024;
  const MAX_PDF_STREAM_BYTES = 64 * 1024 * 1024;
  const MAX_HEX_ROWS = 2_000;
  const HEX_CONTEXT_ROWS = 2;
  const MAX_IMAGE_SAMPLE_PIXELS = 16_777_216;
  const MAX_IMAGE_SAMPLE_DIMENSION = 4_096;
  const MAX_IMAGE_CHANGED_PIXELS = 2_000;
  const IMAGE_DIFF_MASK_SIZE = 512;
  const IMAGE_EXTENSION_PATTERN =
    /\.(?:png|jpe?g|gif|webp|bmp|tiff?|ico|cur|heic|heif|avif|svg)$/i;
  const BINARY_EXTENSION_PATTERN =
    /\.(?:pdf|docx?|docm|dotx|dotm|pptx?|pptm|potx|potm|ppsx|ppsm|xlsb?|xlam|zip|jar|war|apk|epub|odt|ods|odp|pages|numbers|key|rar|7z|gz|gzip|tgz|tar|bz2|xz|zst|png|jpe?g|gif|webp|bmp|tiff?|ico|cur|heic|heif|avif|svg|mp3|wav|flac|aac|ogg|m4a|mp4|m4v|mov|avi|mkv|webm|woff2?|ttf|otf|eot|exe|dll|so|dylib|bin|dat|db|sqlite|class|wasm|psd|ai)$/i;

  function t(key, params) {
    return global.AllCompareI18n ? global.AllCompareI18n.t(key, params) : key;
  }

  function normalizeArchivePath(path) {
    return String(path || "").replaceAll("\\", "/").replace(/^\/+/, "");
  }

  function formatBytes(bytes) {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(bytes >= 10240 ? 0 : 1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function imageMimeType(bytes, fileName) {
    if (hasBytes(bytes, [0x89, 0x50, 0x4e, 0x47])) return "image/png";
    if (hasBytes(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
    if (hasBytes(bytes, [0x47, 0x49, 0x46, 0x38])) return "image/gif";
    if (
      hasBytes(bytes, [0x52, 0x49, 0x46, 0x46]) &&
      hasBytes(bytes, [0x57, 0x45, 0x42, 0x50], 8)
    ) return "image/webp";
    if (hasBytes(bytes, [0x42, 0x4d])) return "image/bmp";
    if (hasBytes(bytes, [0x00, 0x00, 0x01, 0x00])) return "image/x-icon";
    if (hasBytes(bytes, [0x00, 0x00, 0x02, 0x00])) return "image/x-icon";
    if (hasBytes(bytes, [0x49, 0x49, 0x2a, 0x00]) || hasBytes(bytes, [0x4d, 0x4d, 0x00, 0x2a])) {
      return "image/tiff";
    }
    const brand = bytes.length >= 12
      ? new TextDecoder("ascii").decode(bytes.subarray(4, 12))
      : "";
    if (brand.startsWith("ftypavif") || brand.startsWith("ftypavis")) return "image/avif";

    const extension = extensionOf(fileName);
    return {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      bmp: "image/bmp",
      tif: "image/tiff",
      tiff: "image/tiff",
      ico: "image/x-icon",
      cur: "image/x-icon",
      avif: "image/avif",
      heic: "image/heic",
      heif: "image/heif",
      svg: "image/svg+xml"
    }[extension] || "";
  }

  function imageFormatName(mimeType, fileName) {
    const names = {
      "image/png": "PNG",
      "image/jpeg": "JPEG",
      "image/gif": "GIF",
      "image/webp": "WebP",
      "image/bmp": "BMP",
      "image/tiff": "TIFF",
      "image/x-icon": extensionOf(fileName) === "cur" ? "CUR" : "ICO",
      "image/avif": "AVIF",
      "image/heic": "HEIC",
      "image/heif": "HEIF",
      "image/svg+xml": "SVG"
    };
    return names[mimeType] || extensionOf(fileName).toUpperCase() || "Image";
  }

  function isImageFile(bytes, fileName) {
    return IMAGE_EXTENSION_PATTERN.test(String(fileName || "")) ||
      Boolean(imageMimeType(bytes, ""));
  }

  function hasBytes(bytes, signature, offset = 0) {
    return signature.every((value, index) => bytes[offset + index] === value);
  }

  function extensionOf(fileName) {
    return String(fileName || "").toLowerCase().match(/\.([^.]+)$/)?.[1] || "";
  }

  function decodeArchiveName(bytes, utf8) {
    try {
      return new TextDecoder(utf8 ? "utf-8" : "windows-1252").decode(bytes);
    } catch {
      return Array.from(bytes, (value) => String.fromCharCode(value)).join("");
    }
  }

  class ZipArchive {
    constructor(buffer) {
      this.bytes = new Uint8Array(buffer);
      this.view = new DataView(buffer);
      this.entries = [];
      this.entryMap = new Map();
      this.readCentralDirectory();
    }

    readCentralDirectory() {
      const endOffset = this.findEndOfCentralDirectory();
      const entryCount = this.view.getUint16(endOffset + 10, true);
      const centralDirectoryOffset = this.view.getUint32(endOffset + 16, true);
      let offset = centralDirectoryOffset;

      for (let index = 0; index < entryCount; index += 1) {
        if (offset + 46 > this.bytes.length || this.view.getUint32(offset, true) !== 0x02014b50) {
          throw new Error(t("reader.zipCentralDirectory"));
        }

        const flags = this.view.getUint16(offset + 8, true);
        const compressionMethod = this.view.getUint16(offset + 10, true);
        const crc32 = this.view.getUint32(offset + 16, true);
        const compressedSize = this.view.getUint32(offset + 20, true);
        const uncompressedSize = this.view.getUint32(offset + 24, true);
        const fileNameLength = this.view.getUint16(offset + 28, true);
        const extraLength = this.view.getUint16(offset + 30, true);
        const commentLength = this.view.getUint16(offset + 32, true);
        const localHeaderOffset = this.view.getUint32(offset + 42, true);
        const nameStart = offset + 46;
        const nameBytes = this.bytes.subarray(nameStart, nameStart + fileNameLength);
        const path = normalizeArchivePath(decodeArchiveName(nameBytes, (flags & 0x0800) !== 0));

        const entry = {
          path,
          flags,
          compressionMethod,
          crc32,
          compressedSize,
          uncompressedSize,
          localHeaderOffset,
          directory: path.endsWith("/")
        };
        this.entries.push(entry);
        this.entryMap.set(path, entry);
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
      throw new Error(t("reader.zipStructure"));
    }

    has(path) {
      return this.entryMap.has(normalizeArchivePath(path));
    }

    pathsMatching(pattern) {
      return this.entries.map((entry) => entry.path).filter((path) => pattern.test(path));
    }

    async bytesFor(path) {
      const normalizedPath = normalizeArchivePath(path);
      const entry = this.entryMap.get(normalizedPath);
      if (!entry) {
        return null;
      }
      if (entry.directory) {
        return new Uint8Array();
      }
      if ((entry.flags & 0x0001) !== 0) {
        throw new Error(t("reader.zipEncrypted", { path: normalizedPath }));
      }
      if (entry.uncompressedSize > MAX_ARCHIVE_ENTRY_BYTES) {
        throw new Error(t("reader.zipEntryTooLarge", { path: normalizedPath }));
      }

      const localOffset = entry.localHeaderOffset;
      if (
        localOffset + 30 > this.bytes.length ||
        this.view.getUint32(localOffset, true) !== 0x04034b50
      ) {
        throw new Error(t("reader.zipHeaderDamaged", { path: normalizedPath }));
      }

      const fileNameLength = this.view.getUint16(localOffset + 26, true);
      const extraLength = this.view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + fileNameLength + extraLength;
      const compressed = this.bytes.slice(dataStart, dataStart + entry.compressedSize);

      if (entry.compressionMethod === 0) {
        return compressed;
      }
      if (entry.compressionMethod !== 8) {
        throw new Error(
          t("reader.zipMethod", { method: entry.compressionMethod, path: normalizedPath })
        );
      }
      return decompress(compressed, "deflate-raw", t("reader.zipEntryLabel", { path: normalizedPath }));
    }

    async text(path) {
      const bytes = await this.bytesFor(path);
      return bytes === null ? null : new TextDecoder("utf-8").decode(bytes);
    }
  }

  async function decompress(bytes, format, label) {
    if (typeof DecompressionStream === "undefined") {
      throw new Error(t("reader.decompressUnsupported", { label }));
    }
    try {
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format));
      const result = new Uint8Array(await new Response(stream).arrayBuffer());
      if (result.byteLength > MAX_ARCHIVE_ENTRY_BYTES) {
        const oversized = new Error(t("reader.decompressTooLarge", { label }));
        oversized.oversized = true;
        throw oversized;
      }
      return result;
    } catch (error) {
      if (error?.oversized) {
        throw error;
      }
      throw new Error(t("reader.decompressFailed", { label }));
    }
  }

  function parseXml(xml, path) {
    const documentNode = new DOMParser().parseFromString(xml, "application/xml");
    if (documentNode.querySelector("parsererror")) {
      throw new Error(t("reader.xmlFailed", { path }));
    }
    return documentNode;
  }

  function elements(node, localName) {
    const namespaced = node.getElementsByTagNameNS?.("*", localName);
    return namespaced?.length
      ? Array.from(namespaced)
      : Array.from(node.getElementsByTagName?.(localName) || []);
  }

  function cleanLine(value) {
    return String(value || "")
      .replace(/\r\n?/g, "\n")
      .replace(/[\t ]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  async function sha256(buffer) {
    if (!global.crypto?.subtle) {
      return t("reader.hashUnavailable");
    }
    const digest = await global.crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
  }

  function binaryHeader(_fileName, format, buffer, hash) {
    return [
      `# Format: ${format}`,
      `# Size: ${formatBytes(buffer.byteLength)} (${buffer.byteLength.toLocaleString()} bytes)`,
      `# SHA-256: ${hash}`
    ];
  }

  function readIcoEntries(bytes) {
    if (
      bytes.length < 6 ||
      bytes[0] !== 0 ||
      bytes[1] !== 0 ||
      (bytes[2] !== 1 && bytes[2] !== 2) ||
      bytes[3] !== 0
    ) {
      return [];
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const count = Math.min(view.getUint16(4, true), Math.floor((bytes.length - 6) / 16));
    const entries = [];
    for (let index = 0; index < count; index += 1) {
      const offset = 6 + index * 16;
      const width = bytes[offset] || 256;
      const height = bytes[offset + 1] || 256;
      const size = view.getUint32(offset + 8, true);
      const imageOffset = view.getUint32(offset + 12, true);
      if (imageOffset + size > bytes.length) {
        continue;
      }
      entries.push({
        width,
        height,
        colorCount: bytes[offset + 2],
        planes: view.getUint16(offset + 4, true),
        bitDepth: view.getUint16(offset + 6, true),
        size,
        offset: imageOffset,
        png: hasBytes(bytes, [0x89, 0x50, 0x4e, 0x47], imageOffset)
      });
    }
    return entries;
  }

  async function decodeImageSource(blob) {
    if (typeof createImageBitmap === "function") {
      try {
        const bitmap = await createImageBitmap(blob);
        return {
          source: bitmap,
          width: bitmap.width,
          height: bitmap.height,
          close: () => bitmap.close()
        };
      } catch {
        // HTMLImageElement 디코더로 다시 시도합니다.
      }
    }

    const url = URL.createObjectURL(blob);
    try {
      const image = await new Promise((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error(t("reader.imageDecodeFailed")));
        element.src = url;
      });
      return {
        source: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        close: () => URL.revokeObjectURL(url)
      };
    } catch (error) {
      URL.revokeObjectURL(url);
      throw error;
    }
  }

  async function readImage(buffer, fileName, hash) {
    const bytes = new Uint8Array(buffer);
    const mimeType = imageMimeType(bytes, fileName);
    if (!mimeType) {
      throw new Error(t("reader.imageFormatUnknown"));
    }

    const decoded = await decodeImageSource(new Blob([buffer], { type: mimeType }));
    if (!decoded.width || !decoded.height) {
      decoded.close();
      throw new Error(t("reader.imageSizeUnknown"));
    }

    const scale = Math.min(
      1,
      MAX_IMAGE_SAMPLE_DIMENSION / Math.max(decoded.width, decoded.height),
      Math.sqrt(MAX_IMAGE_SAMPLE_PIXELS / (decoded.width * decoded.height))
    );
    const sampleWidth = Math.max(1, Math.round(decoded.width * scale));
    const sampleHeight = Math.max(1, Math.round(decoded.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = sampleWidth;
    canvas.height = sampleHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      decoded.close();
      throw new Error(t("reader.imagePixelsUnavailable"));
    }
    context.clearRect(0, 0, sampleWidth, sampleHeight);
    context.drawImage(decoded.source, 0, 0, sampleWidth, sampleHeight);
    const pixels = context.getImageData(0, 0, sampleWidth, sampleHeight).data;
    decoded.close();

    let transparentPixels = 0;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] < 255) {
        transparentPixels += 1;
      }
    }

    const format = imageFormatName(mimeType, fileName);
    const icoEntries = mimeType === "image/x-icon" ? readIcoEntries(bytes) : [];
    const sampleLabel = scale < 1
      ? `${sampleWidth}×${sampleHeight} (${t("reader.imageScaled", { percent: (scale * 100).toFixed(1) })})`
      : `${sampleWidth}×${sampleHeight} (${t("reader.imageOriginal")})`;
    const lines = [
      ...binaryHeader(fileName, `${format} image`, buffer, hash),
      `# Dimensions: ${decoded.width}×${decoded.height}`,
      `# Pixel sample: ${sampleLabel}`,
      `# Alpha pixels: ${transparentPixels.toLocaleString()}`,
      ...(icoEntries.length ? [
        `# ICO entries: ${icoEntries.length}`,
        ...icoEntries.map((entry, index) =>
          `ICO ${index + 1}\t${entry.width}×${entry.height}\t${entry.bitDepth || "?"}bit\t${entry.size} bytes\t${entry.png ? "PNG" : "DIB"}`
        )
      ] : [])
    ];

    return {
      text: `${lines.join("\n")}\n`,
      encoding: `Image · ${format} · ${decoded.width}×${decoded.height}`,
      kind: "image",
      hash,
      image: {
        format,
        mimeType,
        width: decoded.width,
        height: decoded.height,
        sampleWidth,
        sampleHeight,
        scale,
        pixels,
        transparentPixels,
        icoEntries
      }
    };
  }

  function wordParagraph(paragraph) {
    const pieces = [];
    const walk = (node) => {
      for (const child of node.childNodes || []) {
        if (child.nodeType !== 1) {
          continue;
        }
        if (child.localName === "t") {
          pieces.push(child.textContent || "");
        } else if (child.localName === "tab") {
          pieces.push("\t");
        } else if (child.localName === "br" || child.localName === "cr") {
          pieces.push("\\n");
        } else {
          walk(child);
        }
      }
    };
    walk(paragraph);
    return pieces.join("");
  }

  function wordTable(table) {
    return elements(table, "tr").map((row) =>
      elements(row, "tc").map((cell) =>
        elements(cell, "p").map(wordParagraph).filter(Boolean).join(" / ")
      ).join("\t")
    );
  }

  function wordXmlLines(xml, path) {
    const documentNode = parseXml(xml, path);
    const body = elements(documentNode, "body")[0] || documentNode.documentElement;
    const lines = [];

    for (const child of body?.childNodes || []) {
      if (child.nodeType !== 1) {
        continue;
      }
      if (child.localName === "p") {
        const value = wordParagraph(child);
        if (value) {
          lines.push(value);
        }
      } else if (child.localName === "tbl") {
        lines.push(...wordTable(child));
      }
    }
    if (lines.length === 0) {
      for (const paragraph of elements(body, "p")) {
        const value = wordParagraph(paragraph);
        if (value) {
          lines.push(value);
        }
      }
    }
    return lines;
  }

  async function readWord(archive, buffer, fileName, hash) {
    const sections = [];
    const documentPath = archive.has("word/document.xml")
      ? "word/document.xml"
      : archive.pathsMatching(/\/document\.xml$/i)[0];
    if (!documentPath) {
      throw new Error(t("reader.wordBodyMissing"));
    }

    sections.push("# Document body", ...wordXmlLines(await archive.text(documentPath), documentPath));
    const supplementaryPaths = archive.pathsMatching(
      /^word\/(?:header\d+|footer\d+|footnotes|endnotes|comments)\.xml$/i
    ).sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));

    for (const path of supplementaryPaths) {
      const lines = wordXmlLines(await archive.text(path), path);
      if (lines.length) {
        sections.push("", `# ${path}`, ...lines);
      }
    }

    return {
      text: `${binaryHeader(fileName, "Word OOXML", buffer, hash).concat("", sections).join("\n")}\n`,
      encoding: "Word · DOCX",
      kind: "document",
      hash
    };
  }

  function presentationXmlLines(xml, path) {
    const documentNode = parseXml(xml, path);
    const paragraphs = elements(documentNode, "p");
    const lines = paragraphs.map((paragraph) =>
      elements(paragraph, "t").map((node) => node.textContent || "").join("")
    ).filter(Boolean);
    if (lines.length) {
      return lines;
    }
    return elements(documentNode, "t").map((node) => node.textContent || "").filter(Boolean);
  }

  async function readPowerPoint(archive, buffer, fileName, hash) {
    const slidePaths = archive.pathsMatching(/^ppt\/slides\/slide\d+\.xml$/i)
      .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
    if (!slidePaths.length) {
      throw new Error(t("reader.pptSlidesMissing"));
    }

    const lines = [];
    for (let index = 0; index < slidePaths.length; index += 1) {
      const path = slidePaths[index];
      lines.push(`# Slide ${index + 1}`, ...presentationXmlLines(await archive.text(path), path), "");
    }

    const notePaths = archive.pathsMatching(/^ppt\/notesSlides\/notesSlide\d+\.xml$/i)
      .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
    for (let index = 0; index < notePaths.length; index += 1) {
      const path = notePaths[index];
      const noteLines = presentationXmlLines(await archive.text(path), path);
      if (noteLines.length) {
        lines.push(`# Notes ${index + 1}`, ...noteLines, "");
      }
    }

    return {
      text: `${binaryHeader(fileName, "PowerPoint OOXML", buffer, hash)
        .concat(`# Slides: ${slidePaths.length}`, "", lines)
        .join("\n")}\n`,
      encoding: t("encodingLabel.pptx", { count: slidePaths.length }),
      encodingKey: "encodingLabel.pptx",
      encodingParams: { count: slidePaths.length },
      kind: "document",
      hash
    };
  }

  async function readOpenDocument(archive, buffer, fileName, hash) {
    const contentXml = await archive.text("content.xml");
    if (!contentXml) {
      throw new Error(t("reader.odfBodyMissing"));
    }
    const documentNode = parseXml(contentXml, "content.xml");
    const lines = [];
    for (const node of elements(documentNode, "p")) {
      const value = cleanLine(node.textContent);
      if (value) {
        lines.push(value);
      }
    }
    return {
      text: `${binaryHeader(fileName, "OpenDocument", buffer, hash)
        .concat("", "# Document content", ...lines)
        .join("\n")}\n`,
      encoding: "OpenDocument · XML",
      kind: "document",
      hash
    };
  }

  function crcHex(value) {
    return value.toString(16).toUpperCase().padStart(8, "0");
  }

  function readZipManifest(archive, buffer, fileName, hash) {
    const files = archive.entries.filter((entry) => !entry.directory)
      .sort((left, right) => left.path.localeCompare(right.path, undefined, { numeric: true }));
    const totalUncompressed = files.reduce((total, entry) => total + entry.uncompressedSize, 0);
    const lines = [
      ...binaryHeader(fileName, "ZIP archive", buffer, hash),
      `# Entries: ${files.length}`,
      `# Uncompressed: ${formatBytes(totalUncompressed)}`,
      "",
      "PATH\tSIZE\tPACKED\tMETHOD\tCRC32\tFLAGS"
    ];
    for (const entry of files) {
      lines.push([
        entry.path.replaceAll("\t", "\\t"),
        entry.uncompressedSize,
        entry.compressedSize,
        entry.compressionMethod,
        crcHex(entry.crc32),
        (entry.flags & 0x0001) !== 0 ? "encrypted" : "-"
      ].join("\t"));
    }
    return {
      text: `${lines.join("\n")}\n`,
      encoding: t("encodingLabel.zip", { count: files.length }),
      encodingKey: "encodingLabel.zip",
      encodingParams: { count: files.length },
      kind: "archive",
      hash
    };
  }

  function pdfBytesFromLiteral(source, start) {
    const bytes = [];
    let depth = 1;
    let index = start + 1;

    while (index < source.length && depth > 0) {
      const code = source.charCodeAt(index) & 0xff;
      if (code === 0x5c) {
        index += 1;
        if (index >= source.length) {
          break;
        }
        const escaped = source[index];
        const escapedMap = { n: 10, r: 13, t: 9, b: 8, f: 12 };
        if (escaped in escapedMap) {
          bytes.push(escapedMap[escaped]);
        } else if (/[0-7]/.test(escaped)) {
          const octal = source.slice(index).match(/^[0-7]{1,3}/)?.[0] || escaped;
          bytes.push(Number.parseInt(octal, 8));
          index += octal.length - 1;
        } else if (escaped === "\r" || escaped === "\n") {
          if (escaped === "\r" && source[index + 1] === "\n") {
            index += 1;
          }
        } else {
          bytes.push(source.charCodeAt(index) & 0xff);
        }
      } else if (code === 0x28) {
        depth += 1;
        bytes.push(code);
      } else if (code === 0x29) {
        depth -= 1;
        if (depth > 0) {
          bytes.push(code);
        }
      } else {
        bytes.push(code);
      }
      index += 1;
    }
    return { bytes: new Uint8Array(bytes), end: index };
  }

  function decodePdfText(bytes) {
    if (bytes[0] === 0xfe && bytes[1] === 0xff) {
      const characters = [];
      for (let index = 2; index + 1 < bytes.length; index += 2) {
        characters.push(String.fromCharCode((bytes[index] << 8) | bytes[index + 1]));
      }
      return characters.join("");
    }
    return new TextDecoder("windows-1252").decode(bytes);
  }

  function textFromPdfContent(content) {
    const lines = [];
    const blocks = content.match(/BT[\s\S]*?ET/g) || [];

    for (const block of blocks) {
      const pieces = [];
      let index = 0;
      while (index < block.length) {
        if (block[index] === "(") {
          const literal = pdfBytesFromLiteral(block, index);
          const value = decodePdfText(literal.bytes);
          if (value) {
            pieces.push(value);
          }
          index = literal.end;
          continue;
        }
        if (block[index] === "<" && block[index + 1] !== "<") {
          const end = block.indexOf(">", index + 1);
          if (end > index) {
            const hex = block.slice(index + 1, end).replace(/\s+/g, "");
            const padded = hex.length % 2 ? `${hex}0` : hex;
            const bytes = new Uint8Array(padded.length / 2);
            for (let byteIndex = 0; byteIndex < bytes.length; byteIndex += 1) {
              bytes[byteIndex] = Number.parseInt(padded.slice(byteIndex * 2, byteIndex * 2 + 2), 16);
            }
            const value = decodePdfText(bytes);
            if (value) {
              pieces.push(value);
            }
            index = end + 1;
            continue;
          }
        }
        index += 1;
      }
      const line = cleanLine(pieces.join(" "));
      if (line) {
        lines.push(line);
      }
    }
    return lines;
  }

  async function inflatePdfStream(bytes) {
    const ensurePdfLimit = (result) => {
      if (result.byteLength > MAX_PDF_STREAM_BYTES) {
        throw new Error(t("reader.pdfStreamTooLarge"));
      }
      return result;
    };
    try {
      return ensurePdfLimit(await decompress(bytes, "deflate", t("reader.pdfStreamLabel")));
    } catch {
      return ensurePdfLimit(await decompress(bytes, "deflate-raw", t("reader.pdfStreamLabel")));
    }
  }

  async function readPdf(buffer, fileName, hash) {
    const bytes = new Uint8Array(buffer);
    const source = new TextDecoder("windows-1252").decode(bytes);
    const pageCount = (source.match(/\/Type\s*\/Page\b/g) || []).length;
    const objectCount = (source.match(/\b\d+\s+\d+\s+obj\b/g) || []).length;
    const metadata = [];

    for (const key of ["Title", "Author", "Subject", "Creator", "Producer"]) {
      const match = source.match(new RegExp(`\\/${key}\\s*\\(`));
      if (match?.index !== undefined) {
        const start = match.index + match[0].length - 1;
        const literal = pdfBytesFromLiteral(source, start);
        const value = cleanLine(decodePdfText(literal.bytes));
        if (value) {
          metadata.push(`# ${key}: ${value}`);
        }
      }
    }

    const textLines = [];
    const streamPattern = /stream\r?\n/g;
    let streamMatch;
    let processedBytes = 0;
    while ((streamMatch = streamPattern.exec(source)) && processedBytes < MAX_PDF_STREAM_BYTES) {
      const dataStart = streamPattern.lastIndex;
      const end = source.indexOf("endstream", dataStart);
      if (end < 0) {
        break;
      }
      let dataEnd = end;
      while (dataEnd > dataStart && (source[dataEnd - 1] === "\r" || source[dataEnd - 1] === "\n")) {
        dataEnd -= 1;
      }
      const dictionary = source.slice(Math.max(0, streamMatch.index - 1_500), streamMatch.index);
      let streamBytes = bytes.slice(dataStart, dataEnd);
      try {
        if (/\/FlateDecode\b/.test(dictionary)) {
          streamBytes = await inflatePdfStream(streamBytes);
        } else if (/\/(?:LZWDecode|DCTDecode|JPXDecode|CCITTFaxDecode)\b/.test(dictionary)) {
          streamPattern.lastIndex = end + 9;
          continue;
        }
        if (processedBytes + streamBytes.byteLength > MAX_PDF_STREAM_BYTES) {
          break;
        }
        processedBytes += streamBytes.byteLength;
        textLines.push(
          ...textFromPdfContent(new TextDecoder("windows-1252").decode(streamBytes))
        );
      } catch {
        // 손상되었거나 지원하지 않는 스트림은 건너뛰고 다른 스트림을 계속 확인합니다.
      }
      streamPattern.lastIndex = end + 9;
    }

    const uniqueLines = textLines.filter((line, index) => line !== textLines[index - 1]);
    const lines = [
      ...binaryHeader(fileName, "PDF", buffer, hash),
      `# Pages: ${pageCount || "unknown"}`,
      `# Objects: ${objectCount}`,
      ...metadata,
      "",
      "# Extracted text",
      ...(uniqueLines.length ? uniqueLines : [t("reader.pdfNoText")])
    ];
    return {
      text: `${lines.join("\n")}\n`,
      encoding: t("encodingLabel.pdf", { pages: pageCount || "?" }),
      encodingKey: "encodingLabel.pdf",
      encodingParams: { pages: pageCount || "?" },
      kind: "pdf",
      hash
    };
  }

  function readTar(contentBuffer, fileName, hash, sourceBuffer = contentBuffer) {
    const bytes = new Uint8Array(contentBuffer);
    const decoder = new TextDecoder("utf-8");
    const lines = [
      ...binaryHeader(fileName, "TAR archive", sourceBuffer, hash),
      ...(sourceBuffer === contentBuffer ? [] : [`# Uncompressed: ${formatBytes(contentBuffer.byteLength)}`]),
      "",
      "PATH\tSIZE\tTYPE\tMTIME"
    ];
    let offset = 0;
    let count = 0;

    while (offset + 512 <= bytes.length) {
      const header = bytes.subarray(offset, offset + 512);
      if (header.every((value) => value === 0)) {
        break;
      }
      const stringField = (start, length) =>
        decoder.decode(header.subarray(start, start + length)).replace(/\0.*$/s, "").trim();
      const name = stringField(0, 100);
      const prefix = stringField(345, 155);
      const path = prefix ? `${prefix}/${name}` : name;
      const size = Number.parseInt(stringField(124, 12).replace(/\s/g, "") || "0", 8) || 0;
      const mtime = Number.parseInt(stringField(136, 12).replace(/\s/g, "") || "0", 8) || 0;
      const type = stringField(156, 1) || "0";
      lines.push(`${path}\t${size}\t${type}\t${mtime}`);
      count += 1;
      offset += 512 + Math.ceil(size / 512) * 512;
    }
    lines.splice(4, 0, `# Entries: ${count}`);
    return {
      text: `${lines.join("\n")}\n`,
      encoding: t("encodingLabel.tar", { count }),
      encodingKey: "encodingLabel.tar",
      encodingParams: { count },
      kind: "archive",
      hash
    };
  }

  function formatHexRow(bytes, rowIndex, addressWidth) {
    const offset = rowIndex * 16;
    const hex = [];
    const ascii = [];
    for (let index = 0; index < 16; index += 1) {
      const value = bytes[offset + index];
      if (value === undefined) {
        hex.push("  ");
        ascii.push(" ");
      } else {
        hex.push(value.toString(16).toUpperCase().padStart(2, "0"));
        ascii.push(value >= 32 && value <= 126 ? String.fromCharCode(value) : ".");
      }
    }
    const left = hex.slice(0, 8).join(" ");
    const right = hex.slice(8).join(" ");
    return `${offset.toString(16).toUpperCase().padStart(addressWidth, "0")}  ${left}  ${right}  |${ascii.join("")}|`;
  }

  function detectedBinaryFormat(bytes, fileName) {
    if (hasBytes(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
      const extension = extensionOf(fileName).toUpperCase();
      return `OLE Compound Document${extension ? ` · ${extension}` : ""}`;
    }
    if (hasBytes(bytes, [0x89, 0x50, 0x4e, 0x47])) return "PNG image";
    if (hasBytes(bytes, [0xff, 0xd8, 0xff])) return "JPEG image";
    if (hasBytes(bytes, [0x47, 0x49, 0x46, 0x38])) return "GIF image";
    if (hasBytes(bytes, [0x42, 0x4d])) return "BMP image";
    if (hasBytes(bytes, [0x00, 0x00, 0x01, 0x00])) return "ICO image";
    if (hasBytes(bytes, [0x00, 0x00, 0x02, 0x00])) return "CUR image";
    if (
      hasBytes(bytes, [0x52, 0x49, 0x46, 0x46]) &&
      hasBytes(bytes, [0x57, 0x45, 0x42, 0x50], 8)
    ) return "WebP image";
    if (hasBytes(bytes, [0x52, 0x61, 0x72, 0x21])) return "RAR archive";
    if (hasBytes(bytes, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])) return "7-Zip archive";
    if (hasBytes(bytes, [0x7f, 0x45, 0x4c, 0x46])) return "ELF executable";
    if (hasBytes(bytes, [0x4d, 0x5a])) return "Windows executable";
    if (hasBytes(bytes, [0x00, 0x61, 0x73, 0x6d])) return "WebAssembly";
    return extensionOf(fileName).toUpperCase() || "Binary";
  }

  function readHexPreview(buffer, fileName, hash) {
    const bytes = new Uint8Array(buffer);
    const rowCount = Math.min(Math.ceil(bytes.length / 16), 64);
    const addressWidth = Math.max(8, Math.ceil(bytes.length.toString(16).length / 2) * 2);
    const lines = [
      ...binaryHeader(fileName, `${detectedBinaryFormat(bytes, fileName)} · HEX`, buffer, hash),
      "",
      "# Preview: first 1,024 bytes (comparison scans the complete file)"
    ];
    for (let row = 0; row < rowCount; row += 1) {
      lines.push(formatHexRow(bytes, row, addressWidth));
    }
    return {
      text: `${lines.join("\n")}\n`,
      encoding: `HEX · ${detectedBinaryFormat(bytes, fileName)}`,
      kind: "binary",
      hash
    };
  }

  function isZip(bytes) {
    return hasBytes(bytes, [0x50, 0x4b, 0x03, 0x04]) ||
      hasBytes(bytes, [0x50, 0x4b, 0x05, 0x06]) ||
      hasBytes(bytes, [0x50, 0x4b, 0x07, 0x08]);
  }

  function isPdf(bytes) {
    return hasBytes(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]);
  }

  function isGzip(bytes) {
    return hasBytes(bytes, [0x1f, 0x8b]);
  }

  function isTar(bytes, fileName) {
    return extensionOf(fileName) === "tar" ||
      (bytes.length > 262 && new TextDecoder("ascii").decode(bytes.subarray(257, 262)) === "ustar");
  }

  function isProbablyBinary(buffer, fileName = "") {
    const bytes = new Uint8Array(buffer);
    if (
      BINARY_EXTENSION_PATTERN.test(String(fileName || "")) ||
      isImageFile(bytes, fileName) ||
      isZip(bytes) ||
      isPdf(bytes)
    ) {
      return true;
    }
    if (
      hasBytes(bytes, [0xd0, 0xcf, 0x11, 0xe0]) ||
      hasBytes(bytes, [0x7f, 0x45, 0x4c, 0x46]) ||
      hasBytes(bytes, [0x4d, 0x5a]) ||
      isGzip(bytes)
    ) {
      return true;
    }
    if (
      hasBytes(bytes, [0xef, 0xbb, 0xbf]) ||
      hasBytes(bytes, [0xff, 0xfe]) ||
      hasBytes(bytes, [0xfe, 0xff])
    ) {
      return false;
    }

    const sample = bytes.subarray(0, Math.min(bytes.length, 65_536));
    let nulls = 0;
    let controls = 0;
    for (const value of sample) {
      if (value === 0) {
        nulls += 1;
      }
      if (value < 9 || (value > 13 && value < 32)) {
        controls += 1;
      }
    }
    return nulls > 0 || (sample.length > 0 && controls / sample.length > 0.02);
  }

  async function readFile(buffer, fileName = "binary.bin") {
    const bytes = new Uint8Array(buffer);
    const hash = await sha256(buffer);

    if (isImageFile(bytes, fileName)) {
      try {
        return await readImage(buffer, fileName, hash);
      } catch {
        return readHexPreview(buffer, fileName, hash);
      }
    }
    if (isPdf(bytes)) {
      try {
        return await readPdf(buffer, fileName, hash);
      } catch {
        return readHexPreview(buffer, fileName, hash);
      }
    }
    if (isZip(bytes)) {
      try {
        const archive = new ZipArchive(buffer);
        if (archive.has("word/document.xml")) {
          return await readWord(archive, buffer, fileName, hash);
        }
        if (archive.pathsMatching(/^ppt\/slides\/slide\d+\.xml$/i).length) {
          return await readPowerPoint(archive, buffer, fileName, hash);
        }
        if (archive.has("content.xml") && archive.has("META-INF/manifest.xml")) {
          return await readOpenDocument(archive, buffer, fileName, hash);
        }
        return readZipManifest(archive, buffer, fileName, hash);
      } catch {
        return readHexPreview(buffer, fileName, hash);
      }
    }
    if (isGzip(bytes)) {
      try {
        const unpacked = await decompress(bytes, "gzip", t("reader.gzipLabel"));
        if (isTar(unpacked, fileName.replace(/\.(?:gz|gzip|tgz)$/i, ".tar"))) {
          return readTar(
            unpacked.buffer.slice(unpacked.byteOffset, unpacked.byteOffset + unpacked.byteLength),
            fileName,
            hash,
            buffer
          );
        }
      } catch {
        return readHexPreview(buffer, fileName, hash);
      }
      return readHexPreview(buffer, fileName, hash);
    }
    if (isTar(bytes, fileName)) {
      try {
        return readTar(buffer, fileName, hash);
      } catch {
        return readHexPreview(buffer, fileName, hash);
      }
    }
    return readHexPreview(buffer, fileName, hash);
  }

  function bytesDiffer(left, right, offset, length) {
    for (let index = 0; index < length; index += 1) {
      if (left[offset + index] !== right[offset + index]) {
        return true;
      }
    }
    return false;
  }

  function pixelAt(image, x, y) {
    if (!image || x < 0 || y < 0 || x >= image.sampleWidth || y >= image.sampleHeight) {
      return null;
    }
    const offset = (y * image.sampleWidth + x) * 4;
    return [
      image.pixels[offset],
      image.pixels[offset + 1],
      image.pixels[offset + 2],
      image.pixels[offset + 3]
    ];
  }

  function pixelHex(pixel) {
    return pixel
      ? `#${pixel.map((value) => value.toString(16).toUpperCase().padStart(2, "0")).join("")}`
      : "<outside>";
  }

  function buildImageComparison(leftImage, rightImage, metadata = {}) {
    const width = Math.max(leftImage.sampleWidth, rightImage.sampleWidth);
    const height = Math.max(leftImage.sampleHeight, rightImage.sampleHeight);
    const comparedPixels = Math.max(1, width * height);
    const retainedCount = Math.floor(MAX_IMAGE_CHANGED_PIXELS / 2);
    const firstChanged = [];
    const recentChanged = [];
    let recentCursor = 0;
    let changedPixels = 0;
    let totalDelta = 0;
    let maxDelta = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    const maskScale = Math.min(1, IMAGE_DIFF_MASK_SIZE / Math.max(width, height));
    const maskWidth = Math.max(1, Math.round(width * maskScale));
    const maskHeight = Math.max(1, Math.round(height * maskScale));
    const maskPixels = new Uint8ClampedArray(maskWidth * maskHeight * 4);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const leftInside = x < leftImage.sampleWidth && y < leftImage.sampleHeight;
        const rightInside = x < rightImage.sampleWidth && y < rightImage.sampleHeight;
        let pixelDelta = 0;
        let different = !leftInside || !rightInside;

        if (leftInside && rightInside) {
          const leftOffset = (y * leftImage.sampleWidth + x) * 4;
          const rightOffset = (y * rightImage.sampleWidth + x) * 4;
          for (let channel = 0; channel < 4; channel += 1) {
            const delta = Math.abs(
              leftImage.pixels[leftOffset + channel] - rightImage.pixels[rightOffset + channel]
            );
            pixelDelta += delta;
            maxDelta = Math.max(maxDelta, delta);
            if (delta > 0) {
              different = true;
            }
          }
        } else {
          pixelDelta = 255 * 4;
          maxDelta = 255;
        }

        if (!different) {
          continue;
        }

        changedPixels += 1;
        totalDelta += pixelDelta;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);

        const coordinate = y * width + x;
        if (firstChanged.length < retainedCount) {
          firstChanged.push(coordinate);
        }
        if (recentChanged.length < retainedCount) {
          recentChanged.push(coordinate);
        } else {
          recentChanged[recentCursor] = coordinate;
          recentCursor = (recentCursor + 1) % retainedCount;
        }

        const maskX = Math.min(maskWidth - 1, Math.floor(x * maskScale));
        const maskY = Math.min(maskHeight - 1, Math.floor(y * maskScale));
        const maskOffset = (maskY * maskWidth + maskX) * 4;
        const intensity = Math.max(
          maskPixels[maskOffset + 3],
          Math.min(255, 96 + Math.round(pixelDelta / 4))
        );
        maskPixels[maskOffset] = 255;
        maskPixels[maskOffset + 1] = Math.max(0, 180 - Math.round(pixelDelta / 4));
        maskPixels[maskOffset + 2] = 32;
        maskPixels[maskOffset + 3] = intensity;
      }
    }

    const orderedRecent = recentChanged.length < retainedCount || recentCursor === 0
      ? recentChanged
      : recentChanged.slice(recentCursor).concat(recentChanged.slice(0, recentCursor));
    const visibleCoordinates = [...new Set([...firstChanged, ...orderedRecent])]
      .sort((left, right) => left - right);
    const changePercent = (changedPixels / comparedPixels) * 100;
    const similarity = Math.max(0, 100 - changePercent);
    const meanDelta = changedPixels
      ? totalDelta / (changedPixels * 4)
      : 0;
    const bounds = changedPixels
      ? `${minX},${minY} → ${maxX},${maxY}`
      : "none";
    const commonLines = [
      "# IMAGE Compare · decoded RGBA pixels",
      `# Changed sampled pixels: ${changedPixels.toLocaleString()} / ${comparedPixels.toLocaleString()} (${changePercent.toFixed(4)}%)`,
      `# Pixel similarity: ${similarity.toFixed(4)}%`,
      `# Mean channel delta: ${meanDelta.toFixed(2)} / 255`,
      `# Maximum channel delta: ${maxDelta} / 255`,
      `# Change bounds (sample): ${bounds}`,
      `# Visible changed pixels: ${visibleCoordinates.length.toLocaleString()}`
    ];
    const leftLines = [
      `# Format: ${leftImage.format}`,
      `# Dimensions: ${leftImage.width}×${leftImage.height}`,
      `# Pixel sample: ${leftImage.sampleWidth}×${leftImage.sampleHeight}`,
      `# SHA-256: ${metadata.leftHash || "unknown"}`,
      ...commonLines,
      ""
    ];
    const rightLines = [
      `# Format: ${rightImage.format}`,
      `# Dimensions: ${rightImage.width}×${rightImage.height}`,
      `# Pixel sample: ${rightImage.sampleWidth}×${rightImage.sampleHeight}`,
      `# SHA-256: ${metadata.rightHash || "unknown"}`,
      ...commonLines,
      ""
    ];

    for (const coordinate of visibleCoordinates) {
      const x = coordinate % width;
      const y = Math.floor(coordinate / width);
      const label = `@ ${x.toString().padStart(5, "0")},${y.toString().padStart(5, "0")}`;
      leftLines.push(`${label}\t${pixelHex(pixelAt(leftImage, x, y))}`);
      rightLines.push(`${label}\t${pixelHex(pixelAt(rightImage, x, y))}`);
    }
    if (changedPixels > visibleCoordinates.length) {
      const omitted = `... ${(changedPixels - visibleCoordinates.length).toLocaleString()} changed pixels omitted ...`;
      leftLines.push(omitted);
      rightLines.push(omitted);
    }
    if (changedPixels === 0) {
      leftLines.push("[identical decoded pixels]");
      rightLines.push("[identical decoded pixels]");
    }

    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = maskWidth;
    maskCanvas.height = maskHeight;
    const maskContext = maskCanvas.getContext("2d");
    let diffDataUrl = "";
    if (maskContext) {
      maskContext.putImageData(new ImageData(maskPixels, maskWidth, maskHeight), 0, 0);
      diffDataUrl = maskCanvas.toDataURL("image/png");
    }

    return {
      leftText: `${leftLines.join("\n")}\n`,
      rightText: `${rightLines.join("\n")}\n`,
      changedPixels,
      comparedPixels,
      similarity,
      changePercent,
      meanDelta,
      maxDelta,
      bounds,
      visiblePixels: visibleCoordinates.length,
      diffDataUrl,
      maskWidth,
      maskHeight
    };
  }

  function buildHexComparison(leftBuffer, rightBuffer, metadata = {}) {
    const left = new Uint8Array(leftBuffer);
    const right = new Uint8Array(rightBuffer);
    const maxLength = Math.max(left.length, right.length);
    const rowCount = Math.ceil(maxLength / 16);
    const retainedCount = Math.floor(MAX_HEX_ROWS / 2);
    const firstChanged = [];
    const recentChanged = [];
    let recentCursor = 0;
    let changedRows = 0;
    let changedBytes = 0;

    for (let row = 0; row < rowCount; row += 1) {
      const offset = row * 16;
      const length = Math.min(16, maxLength - offset);
      if (!bytesDiffer(left, right, offset, length)) {
        continue;
      }
      changedRows += 1;
      for (let index = 0; index < length; index += 1) {
        if (left[offset + index] !== right[offset + index]) {
          changedBytes += 1;
        }
      }
      if (firstChanged.length < retainedCount) {
        firstChanged.push(row);
      }
      if (recentChanged.length < retainedCount) {
        recentChanged.push(row);
      } else {
        recentChanged[recentCursor] = row;
        recentCursor = (recentCursor + 1) % retainedCount;
      }
    }

    const orderedRecent = recentChanged.length < retainedCount || recentCursor === 0
      ? recentChanged
      : recentChanged.slice(recentCursor).concat(recentChanged.slice(0, recentCursor));
    const selected = new Set([...firstChanged, ...orderedRecent]);
    for (const row of [...selected]) {
      for (let context = 1; context <= HEX_CONTEXT_ROWS; context += 1) {
        if (row - context >= 0) selected.add(row - context);
        if (row + context < rowCount) selected.add(row + context);
      }
    }
    const visibleRows = [...selected].sort((leftRow, rightRow) => leftRow - rightRow);
    const addressWidth = Math.max(8, Math.ceil(maxLength.toString(16).length / 2) * 2);
    const commonHeader = [
      "# HEX Compare · complete-file scan",
      `# Changed bytes: ${changedBytes.toLocaleString()}`,
      `# Changed 16-byte rows: ${changedRows.toLocaleString()} / ${rowCount.toLocaleString()}`,
      `# Visible changed/context rows: ${visibleRows.length.toLocaleString()}`
    ];
    const leftLines = [
      ...commonHeader,
      `# Size: ${left.length.toLocaleString()} bytes`,
      `# SHA-256: ${metadata.leftHash || "unknown"}`,
      ""
    ];
    const rightLines = [
      ...commonHeader,
      `# Size: ${right.length.toLocaleString()} bytes`,
      `# SHA-256: ${metadata.rightHash || "unknown"}`,
      ""
    ];

    let previousRow = -1;
    for (const row of visibleRows) {
      if (previousRow >= 0 && row > previousRow + 1) {
        const gap = `... ${(row - previousRow - 1).toLocaleString()} rows omitted ...`;
        leftLines.push(gap);
        rightLines.push(gap);
      }
      leftLines.push(formatHexRow(left, row, addressWidth));
      rightLines.push(formatHexRow(right, row, addressWidth));
      previousRow = row;
    }
    if (visibleRows.length === 0) {
      leftLines.push("[identical binary content]");
      rightLines.push("[identical binary content]");
    }

    return {
      leftText: `${leftLines.join("\n")}\n`,
      rightText: `${rightLines.join("\n")}\n`,
      changedBytes,
      changedRows,
      totalRows: rowCount,
      visibleRows: visibleRows.length
    };
  }

  global.AllCompareBinary = {
    isProbablyBinary,
    readFile,
    buildImageComparison,
    buildHexComparison
  };
})(globalThis);
