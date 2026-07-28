"use strict";

const MAX_FILE_MEGABYTES = 100;
const MAX_FILE_BYTES = MAX_FILE_MEGABYTES * 1024 * 1024;
const MAX_EXACT_DIFF_CELLS = 1_500_000;
const MAX_RENDERED_ROWS = 12_000;

const SAMPLE_LEFT = `{
  "name": "AllCompare",
  "version": "1.0.0",
  "features": [
    "모든 텍스트 포맷",
    "로컬 처리",
    "라인 비교"
  ],
  "theme": "paper"
}`;

const SAMPLE_RIGHT = `{
  "name": "AllCompare",
  "version": "1.1.0",
  "features": [
    "모든 텍스트 포맷",
    "브라우저 로컬 처리",
    "라인 비교",
    "CSV 내보내기"
  ],
  "theme": "ink"
}`;

const state = {
  left: createDocumentState("before.config.json", SAMPLE_LEFT),
  right: createDocumentState("after.config.json", SAMPLE_RIGHT),
  rows: [],
  differences: [],
  stats: null,
  view: "split",
  activeDifference: -1,
  compareTimer: null,
  toastTimer: null,
  imageSummary: null
};

const elements = {
  leftText: document.querySelector("#leftText"),
  rightText: document.querySelector("#rightText"),
  leftFileInput: document.querySelector("#leftFileInput"),
  rightFileInput: document.querySelector("#rightFileInput"),
  leftEncoding: document.querySelector("#leftEncoding"),
  rightEncoding: document.querySelector("#rightEncoding"),
  leftDropzone: document.querySelector("#leftDropzone"),
  rightDropzone: document.querySelector("#rightDropzone"),
  inputGrid: document.querySelector(".input-grid"),
  leftFileName: document.querySelector("#leftFileName"),
  rightFileName: document.querySelector("#rightFileName"),
  leftFileMeta: document.querySelector("#leftFileMeta"),
  rightFileMeta: document.querySelector("#rightFileMeta"),
  leftImagePreview: document.querySelector("#leftImagePreview"),
  rightImagePreview: document.querySelector("#rightImagePreview"),
  leftImage: document.querySelector("#leftImage"),
  rightImage: document.querySelector("#rightImage"),
  leftImageCaption: document.querySelector("#leftImageCaption"),
  rightImageCaption: document.querySelector("#rightImageCaption"),
  leftDiffTitle: document.querySelector("#leftDiffTitle"),
  rightDiffTitle: document.querySelector("#rightDiffTitle"),
  trimWhitespace: document.querySelector("#trimWhitespace"),
  collapseWhitespace: document.querySelector("#collapseWhitespace"),
  ignoreCase: document.querySelector("#ignoreCase"),
  ignoreBlank: document.querySelector("#ignoreBlank"),
  sortMode: document.querySelector("#sortMode"),
  compareButton: document.querySelector("#compareButton"),
  swapButton: document.querySelector("#swapButton"),
  contextSelect: document.querySelector("#contextSelect"),
  diffHead: document.querySelector("#diffHead"),
  diffBody: document.querySelector("#diffBody"),
  diffRows: document.querySelector("#diffRows"),
  diffMap: document.querySelector("#diffMap"),
  similarityStat: document.querySelector("#similarityStat"),
  similarityMeter: document.querySelector("#similarityMeter"),
  addedStat: document.querySelector("#addedStat"),
  changedStat: document.querySelector("#changedStat"),
  removedStat: document.querySelector("#removedStat"),
  totalStat: document.querySelector("#totalStat"),
  resultState: document.querySelector("#resultState"),
  resultStateText: document.querySelector("#resultStateText"),
  resultFootnote: document.querySelector("#resultFootnote"),
  diffPosition: document.querySelector("#diffPosition"),
  imageDiffPanel: document.querySelector("#imageDiffPanel"),
  imageDiffTitle: document.querySelector("#imageDiffTitle"),
  imageDiffMeta: document.querySelector("#imageDiffMeta"),
  imageDiffImage: document.querySelector("#imageDiffImage"),
  prevDiffButton: document.querySelector("#prevDiffButton"),
  nextDiffButton: document.querySelector("#nextDiffButton"),
  copyButton: document.querySelector("#copyButton"),
  exportButton: document.querySelector("#exportButton"),
  themeButton: document.querySelector("#themeButton"),
  toast: document.querySelector("#toast")
};

function createDocumentState(name, text) {
  return {
    name,
    text,
    buffer: null,
    size: new TextEncoder().encode(text).byteLength,
    encoding: "UTF-8",
    kind: "text",
    hash: null,
    image: null,
    previewUrl: null,
    source: "sample",
    edited: false
  };
}

function optionsFromUi() {
  return {
    trimWhitespace: elements.trimWhitespace.checked,
    collapseWhitespace: elements.collapseWhitespace.checked,
    ignoreCase: elements.ignoreCase.checked,
    ignoreBlank: elements.ignoreBlank.checked,
    sortMode: elements.sortMode.value
  };
}

function lineCount(text) {
  if (!text) {
    return 0;
  }
  return normalizeLineEndings(text).split("\n").length;
}

function normalizeLineEndings(text) {
  return text.replace(/\r\n?/g, "\n");
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

function updateDocumentUi(side) {
  const documentState = state[side];
  const textArea = elements[`${side}Text`];
  const fileName = elements[`${side}FileName`];
  const fileMeta = elements[`${side}FileMeta`];
  const diffTitle = elements[`${side}DiffTitle`];
  const encodingSelect = elements[`${side}Encoding`];
  const dropzone = elements[`${side}Dropzone`];
  const imagePreview = elements[`${side}ImagePreview`];
  const imageElement = elements[`${side}Image`];
  const imageCaption = elements[`${side}ImageCaption`];

  if (textArea.value !== documentState.text) {
    textArea.value = documentState.text;
  }

  fileName.textContent = documentState.name;
  diffTitle.textContent = documentState.name;
  encodingSelect.disabled = documentState.kind !== "text";
  const hasImage = documentState.kind === "image" &&
    documentState.image &&
    documentState.previewUrl;
  dropzone.classList.toggle("image-mode", Boolean(hasImage));
  imagePreview.hidden = !hasImage;
  if (hasImage) {
    if (imageElement.src !== documentState.previewUrl) {
      imageElement.src = documentState.previewUrl;
    }
    imageCaption.textContent =
      `${documentState.image.format} · ${documentState.image.width}×${documentState.image.height}` +
      (documentState.image.scale < 1
        ? ` · ${(documentState.image.scale * 100).toFixed(1)}% 픽셀 샘플`
        : "");
  } else {
    imageElement.removeAttribute("src");
    imageCaption.textContent = "";
  }

  const origin = documentState.source === "sample"
    ? "샘플"
    : documentState.source === "file"
      ? formatBytes(documentState.size)
      : "직접 입력";
  const edited = documentState.edited ? " · 편집됨" : "";
  fileMeta.textContent = `${origin} · ${lineCount(documentState.text)}줄 · ${documentState.encoding}${edited}`;
}

function releaseDocumentResources(documentState) {
  if (documentState?.previewUrl) {
    URL.revokeObjectURL(documentState.previewUrl);
    documentState.previewUrl = null;
  }
}

function renderImageComparison(summary) {
  elements.imageDiffPanel.hidden = !summary;
  if (!summary) {
    elements.imageDiffImage.removeAttribute("src");
    elements.imageDiffMeta.textContent = "";
    return;
  }
  elements.imageDiffImage.src = summary.diffDataUrl;
  elements.imageDiffTitle.textContent = summary.changedPixels === 0
    ? "디코딩된 픽셀이 동일합니다"
    : "변경 픽셀 차이 마스크";
  elements.imageDiffMeta.textContent =
    `${summary.changedPixels.toLocaleString()} / ${summary.comparedPixels.toLocaleString()}픽셀 변경` +
    ` · 차이 ${summary.changePercent.toFixed(4)}% · 영역 ${summary.bounds}`;
}

function updateAllDocumentUi() {
  updateDocumentUi("left");
  updateDocumentUi("right");
}

function normalizeForComparison(value, options) {
  let normalized = value;

  if (options.trimWhitespace) {
    normalized = normalized.trim();
  }
  if (options.collapseWhitespace) {
    normalized = normalized.replace(/\s+/g, " ");
  }
  if (options.ignoreCase) {
    normalized = normalized.toLocaleLowerCase();
  }

  return normalized;
}

function getFirstField(value) {
  const delimiter = ["\t", ",", ";", "|"].find((candidate) => value.includes(candidate));
  if (!delimiter) {
    return value;
  }

  if (!value.startsWith('"')) {
    return value.slice(0, value.indexOf(delimiter));
  }

  let field = "";
  for (let index = 1; index < value.length; index += 1) {
    const character = value[index];
    if (character === '"' && value[index + 1] === '"') {
      field += '"';
      index += 1;
    } else if (character === '"') {
      break;
    } else {
      field += character;
    }
  }
  return field;
}

function sortPreparedLines(lines, options) {
  const sortMode = options.sortMode || "none";
  if (sortMode === "none") {
    return lines;
  }

  const useFirstField = sortMode.startsWith("field-");
  const direction = sortMode.endsWith("-desc") ? -1 : 1;
  const collator = new Intl.Collator("ko", {
    numeric: true,
    sensitivity: options.ignoreCase ? "base" : "variant"
  });

  return [...lines].sort((left, right) => {
    const leftValue = normalizeForComparison(
      useFirstField ? getFirstField(left.content) : left.content,
      options
    );
    const rightValue = normalizeForComparison(
      useFirstField ? getFirstField(right.content) : right.content,
      options
    );
    return collator.compare(leftValue, rightValue) * direction || left.number - right.number;
  });
}

function prepareLines(text, options) {
  if (!text) {
    return [];
  }

  const lines = normalizeLineEndings(text).split("\n").map((content, index) => ({
    number: index + 1,
    content,
    key: normalizeForComparison(content, options)
  }));

  const filteredLines = options.ignoreBlank ? lines.filter((line) => line.key !== "") : lines;
  return sortPreparedLines(filteredLines, options);
}

function exactLcsDiff(left, right, leftStart, leftEnd, rightStart, rightEnd, output) {
  const leftLength = leftEnd - leftStart;
  const rightLength = rightEnd - rightStart;
  const matrix = Array.from(
    { length: leftLength + 1 },
    () => new Uint32Array(rightLength + 1)
  );

  for (let leftIndex = leftLength - 1; leftIndex >= 0; leftIndex -= 1) {
    for (let rightIndex = rightLength - 1; rightIndex >= 0; rightIndex -= 1) {
      matrix[leftIndex][rightIndex] =
        left[leftStart + leftIndex].key === right[rightStart + rightIndex].key
          ? matrix[leftIndex + 1][rightIndex + 1] + 1
          : Math.max(matrix[leftIndex + 1][rightIndex], matrix[leftIndex][rightIndex + 1]);
    }
  }

  let leftIndex = 0;
  let rightIndex = 0;

  while (leftIndex < leftLength && rightIndex < rightLength) {
    const leftLine = left[leftStart + leftIndex];
    const rightLine = right[rightStart + rightIndex];

    if (leftLine.key === rightLine.key) {
      output.push({ type: "equal", left: leftLine, right: rightLine });
      leftIndex += 1;
      rightIndex += 1;
    } else if (matrix[leftIndex + 1][rightIndex] >= matrix[leftIndex][rightIndex + 1]) {
      output.push({ type: "delete", left: leftLine });
      leftIndex += 1;
    } else {
      output.push({ type: "insert", right: rightLine });
      rightIndex += 1;
    }
  }

  while (leftIndex < leftLength) {
    output.push({ type: "delete", left: left[leftStart + leftIndex] });
    leftIndex += 1;
  }

  while (rightIndex < rightLength) {
    output.push({ type: "insert", right: right[rightStart + rightIndex] });
    rightIndex += 1;
  }
}

function findPatienceAnchors(left, right, leftStart, leftEnd, rightStart, rightEnd) {
  const leftOccurrences = new Map();
  const rightOccurrences = new Map();

  for (let index = leftStart; index < leftEnd; index += 1) {
    const key = left[index].key;
    const occurrence = leftOccurrences.get(key);
    leftOccurrences.set(key, occurrence ? { count: occurrence.count + 1, index } : { count: 1, index });
  }

  for (let index = rightStart; index < rightEnd; index += 1) {
    const key = right[index].key;
    const occurrence = rightOccurrences.get(key);
    rightOccurrences.set(key, occurrence ? { count: occurrence.count + 1, index } : { count: 1, index });
  }

  const candidates = [];
  for (const [key, leftOccurrence] of leftOccurrences) {
    const rightOccurrence = rightOccurrences.get(key);
    if (leftOccurrence.count === 1 && rightOccurrence?.count === 1) {
      candidates.push({ left: leftOccurrence.index, right: rightOccurrence.index });
    }
  }
  candidates.sort((a, b) => a.left - b.left);

  if (candidates.length < 2) {
    return candidates;
  }

  const tails = [];
  const tailIndices = [];
  const previous = new Int32Array(candidates.length);
  previous.fill(-1);

  candidates.forEach((candidate, candidateIndex) => {
    let low = 0;
    let high = tails.length;

    while (low < high) {
      const middle = (low + high) >> 1;
      if (tails[middle] < candidate.right) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }

    tails[low] = candidate.right;
    if (low > 0) {
      previous[candidateIndex] = tailIndices[low - 1];
    }
    tailIndices[low] = candidateIndex;
  });

  const anchors = [];
  let cursor = tailIndices[tails.length - 1];
  while (cursor >= 0) {
    anchors.push(candidates[cursor]);
    cursor = previous[cursor];
  }

  return anchors.reverse();
}

function diffRange(left, right, leftStart, leftEnd, rightStart, rightEnd, output) {
  while (
    leftStart < leftEnd &&
    rightStart < rightEnd &&
    left[leftStart].key === right[rightStart].key
  ) {
    output.push({ type: "equal", left: left[leftStart], right: right[rightStart] });
    leftStart += 1;
    rightStart += 1;
  }

  let commonSuffix = 0;
  while (
    leftStart < leftEnd - commonSuffix &&
    rightStart < rightEnd - commonSuffix &&
    left[leftEnd - commonSuffix - 1].key === right[rightEnd - commonSuffix - 1].key
  ) {
    commonSuffix += 1;
  }

  const middleLeftEnd = leftEnd - commonSuffix;
  const middleRightEnd = rightEnd - commonSuffix;
  const leftLength = middleLeftEnd - leftStart;
  const rightLength = middleRightEnd - rightStart;

  if (leftLength === 0) {
    for (let index = rightStart; index < middleRightEnd; index += 1) {
      output.push({ type: "insert", right: right[index] });
    }
  } else if (rightLength === 0) {
    for (let index = leftStart; index < middleLeftEnd; index += 1) {
      output.push({ type: "delete", left: left[index] });
    }
  } else if (leftLength * rightLength <= MAX_EXACT_DIFF_CELLS) {
    exactLcsDiff(left, right, leftStart, middleLeftEnd, rightStart, middleRightEnd, output);
  } else {
    const anchors = findPatienceAnchors(
      left,
      right,
      leftStart,
      middleLeftEnd,
      rightStart,
      middleRightEnd
    );

    if (anchors.length === 0) {
      for (let index = leftStart; index < middleLeftEnd; index += 1) {
        output.push({ type: "delete", left: left[index] });
      }
      for (let index = rightStart; index < middleRightEnd; index += 1) {
        output.push({ type: "insert", right: right[index] });
      }
    } else {
      let previousLeft = leftStart;
      let previousRight = rightStart;

      anchors.forEach((anchor) => {
        diffRange(left, right, previousLeft, anchor.left, previousRight, anchor.right, output);
        output.push({ type: "equal", left: left[anchor.left], right: right[anchor.right] });
        previousLeft = anchor.left + 1;
        previousRight = anchor.right + 1;
      });

      diffRange(
        left,
        right,
        previousLeft,
        middleLeftEnd,
        previousRight,
        middleRightEnd,
        output
      );
    }
  }

  for (let index = commonSuffix; index > 0; index -= 1) {
    output.push({
      type: "equal",
      left: left[leftEnd - index],
      right: right[rightEnd - index]
    });
  }
}

function alignAtomicChanges(atomicDiff) {
  const rows = [];
  let atomicIndex = 0;

  while (atomicIndex < atomicDiff.length) {
    const item = atomicDiff[atomicIndex];
    if (item.type === "equal") {
      rows.push({ type: "equal", left: item.left, right: item.right });
      atomicIndex += 1;
      continue;
    }

    const deleted = [];
    const inserted = [];
    while (atomicIndex < atomicDiff.length && atomicDiff[atomicIndex].type !== "equal") {
      const change = atomicDiff[atomicIndex];
      if (change.type === "delete") {
        deleted.push(change.left);
      } else {
        inserted.push(change.right);
      }
      atomicIndex += 1;
    }

    const blockLength = Math.max(deleted.length, inserted.length);
    for (let blockIndex = 0; blockIndex < blockLength; blockIndex += 1) {
      const left = deleted[blockIndex] || null;
      const right = inserted[blockIndex] || null;
      rows.push({
        type: left && right ? "changed" : left ? "removed" : "added",
        left,
        right
      });
    }
  }

  let differenceIndex = 0;
  rows.forEach((row, rowIndex) => {
    row.rowIndex = rowIndex;
    if (row.type !== "equal") {
      row.differenceIndex = differenceIndex;
      differenceIndex += 1;
    }
  });

  return rows;
}

function compareDocuments(leftText, rightText, options) {
  const leftLines = prepareLines(leftText, options);
  const rightLines = prepareLines(rightText, options);
  const atomicDiff = [];
  diffRange(leftLines, rightLines, 0, leftLines.length, 0, rightLines.length, atomicDiff);
  const rows = alignAtomicChanges(atomicDiff);

  const stats = rows.reduce(
    (summary, row) => {
      summary[row.type] += 1;
      return summary;
    },
    { equal: 0, added: 0, removed: 0, changed: 0 }
  );

  const denominator = Math.max(leftLines.length, rightLines.length, 1);
  stats.similarity = Math.round((stats.equal / denominator) * 100);
  stats.total = rows.length;
  stats.leftLines = leftLines.length;
  stats.rightLines = rightLines.length;

  return {
    rows,
    differences: rows.filter((row) => row.type !== "equal"),
    stats
  };
}

function compareNow(shouldScroll = false) {
  window.clearTimeout(state.compareTimer);
  const startedAt = performance.now();
  let leftText = state.left.text;
  let rightText = state.right.text;
  let compareOptions = optionsFromUi();
  let hexSummary = null;
  let imageSummary = null;
  const hexMode =
    globalThis.AllCompareBinary &&
    (state.left.kind === "binary" || state.right.kind === "binary");
  const imageMode =
    globalThis.AllCompareBinary &&
    state.left.kind === "image" &&
    state.right.kind === "image" &&
    state.left.image &&
    state.right.image;

  [
    elements.trimWhitespace,
    elements.collapseWhitespace,
    elements.ignoreCase,
    elements.ignoreBlank,
    elements.sortMode
  ].forEach((control) => {
    control.disabled = Boolean(hexMode || imageMode);
  });

  if (hexMode) {
    const encoder = new TextEncoder();
    const leftBuffer = state.left.buffer || encoder.encode(state.left.text).buffer;
    const rightBuffer = state.right.buffer || encoder.encode(state.right.text).buffer;
    hexSummary = globalThis.AllCompareBinary.buildHexComparison(leftBuffer, rightBuffer, {
      leftHash: state.left.hash,
      rightHash: state.right.hash
    });
    leftText = hexSummary.leftText;
    rightText = hexSummary.rightText;
    compareOptions = {
      trimWhitespace: false,
      collapseWhitespace: false,
      ignoreCase: false,
      ignoreBlank: false,
      sortMode: "none"
    };
  } else if (imageMode) {
    imageSummary = globalThis.AllCompareBinary.buildImageComparison(
      state.left.image,
      state.right.image,
      {
        leftHash: state.left.hash,
        rightHash: state.right.hash
      }
    );
    leftText = imageSummary.leftText;
    rightText = imageSummary.rightText;
    compareOptions = {
      trimWhitespace: false,
      collapseWhitespace: false,
      ignoreCase: false,
      ignoreBlank: false,
      sortMode: "none"
    };
  }

  const result = compareDocuments(leftText, rightText, compareOptions);
  if (hexSummary) {
    const encoder = new TextEncoder();
    const comparedBytes = Math.max(
      state.left.buffer?.byteLength ?? encoder.encode(state.left.text).byteLength,
      state.right.buffer?.byteLength ?? encoder.encode(state.right.text).byteLength,
      1
    );
    result.stats.similarity = Math.round(
      ((comparedBytes - hexSummary.changedBytes) / comparedBytes) * 100
    );
    result.stats.total = hexSummary.totalRows;
  } else if (imageSummary) {
    result.stats.similarity = Math.round(imageSummary.similarity);
  }

  state.rows = result.rows;
  state.differences = result.differences;
  state.stats = result.stats;
  state.activeDifference = -1;
  state.imageSummary = imageSummary;

  renderResults();
  renderImageComparison(imageSummary);

  const elapsed = Math.max(1, Math.round(performance.now() - startedAt));
  const sortLabel = hexSummary || imageSummary || elements.sortMode.value === "none"
    ? ""
    : ` · ${elements.sortMode.selectedOptions[0].textContent}`;
  elements.resultFootnote.textContent = hexSummary
    ? `브라우저 로컬 HEX 전체 스캔 · ${hexSummary.changedBytes.toLocaleString()}바이트 차이 · ${elapsed}ms`
    : imageSummary
      ? `브라우저 로컬 이미지 픽셀 비교 · ${imageSummary.changedPixels.toLocaleString()}픽셀 차이 · ${elapsed}ms`
      : `브라우저 로컬 처리 · ${result.stats.leftLines.toLocaleString()}줄 ↔ ${result.stats.rightLines.toLocaleString()}줄 · ${elapsed}ms${sortLabel}`;

  if (shouldScroll) {
    document.querySelector("#resultsSection").scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function scheduleCompare() {
  window.clearTimeout(state.compareTimer);
  state.compareTimer = window.setTimeout(() => compareNow(false), 280);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function highlightPair(leftValue, rightValue) {
  const leftCharacters = Array.from(leftValue);
  const rightCharacters = Array.from(rightValue);
  let prefix = 0;
  let suffix = 0;

  while (
    prefix < leftCharacters.length &&
    prefix < rightCharacters.length &&
    leftCharacters[prefix] === rightCharacters[prefix]
  ) {
    prefix += 1;
  }

  while (
    suffix < leftCharacters.length - prefix &&
    suffix < rightCharacters.length - prefix &&
    leftCharacters[leftCharacters.length - suffix - 1] ===
      rightCharacters[rightCharacters.length - suffix - 1]
  ) {
    suffix += 1;
  }

  const buildHighlightedValue = (characters) => {
    const before = characters.slice(0, prefix).join("");
    const middle = characters.slice(prefix, characters.length - suffix || characters.length).join("");
    const after = suffix > 0 ? characters.slice(characters.length - suffix).join("") : "";
    const highlightedMiddle = middle
      ? `<mark class="inline-change">${escapeHtml(middle)}</mark>`
      : `<mark class="inline-change">&nbsp;</mark>`;
    return `${escapeHtml(before)}${highlightedMiddle}${escapeHtml(after)}`;
  };

  return {
    left: buildHighlightedValue(leftCharacters),
    right: buildHighlightedValue(rightCharacters)
  };
}

function lineMarkup(line, highlightedValue = null) {
  if (!line) {
    return {
      number: "",
      content: `<span aria-hidden="true">&nbsp;</span>`
    };
  }
  return {
    number: line.number.toLocaleString(),
    content: highlightedValue ?? (line.content ? escapeHtml(line.content) : `<span aria-label="빈 줄">&nbsp;</span>`)
  };
}

function splitRowMarkup(row) {
  let leftHighlight = null;
  let rightHighlight = null;

  if (row.type === "changed") {
    const highlighted = highlightPair(row.left.content, row.right.content);
    leftHighlight = highlighted.left;
    rightHighlight = highlighted.right;
  }

  const left = lineMarkup(row.left, leftHighlight);
  const right = lineMarkup(row.right, rightHighlight);
  const differenceAttribute = row.type === "equal"
    ? ""
    : ` data-diff-index="${row.differenceIndex}" tabindex="0"`;

  return `
    <div class="diff-row ${row.type}"${differenceAttribute}>
      <div class="code-side">
        <span class="line-number">${left.number}</span>
        <span class="line-content">${left.content}</span>
      </div>
      <div class="code-side">
        <span class="line-number">${right.number}</span>
        <span class="line-content">${right.content}</span>
      </div>
    </div>`;
}

function unifiedLineMarkup(line, type, leftNumber, rightNumber, content, prefix) {
  return `
    <div class="unified-line ${type}">
      <span class="line-number">${leftNumber}</span>
      <span class="line-number">${rightNumber}</span>
      <span class="prefix">${prefix}</span>
      <span class="line-content">${content}</span>
    </div>`;
}

function unifiedRowMarkup(row) {
  const differenceAttribute = row.type === "equal"
    ? ""
    : ` data-diff-index="${row.differenceIndex}" tabindex="0"`;

  if (row.type === "equal") {
    const value = lineMarkup(row.left);
    return `<div class="unified-row equal">${unifiedLineMarkup(
      row.left,
      "equal",
      row.left.number,
      row.right.number,
      value.content,
      " "
    )}</div>`;
  }

  if (row.type === "changed") {
    const highlighted = highlightPair(row.left.content, row.right.content);
    return `
      <div class="unified-row changed"${differenceAttribute}>
        ${unifiedLineMarkup(row.left, "removed", row.left.number, "", highlighted.left, "−")}
        ${unifiedLineMarkup(row.right, "added", "", row.right.number, highlighted.right, "+")}
      </div>`;
  }

  if (row.type === "removed") {
    const value = lineMarkup(row.left);
    return `<div class="unified-row removed"${differenceAttribute}>${unifiedLineMarkup(
      row.left,
      "removed",
      row.left.number,
      "",
      value.content,
      "−"
    )}</div>`;
  }

  const value = lineMarkup(row.right);
  return `<div class="unified-row added"${differenceAttribute}>${unifiedLineMarkup(
    row.right,
    "added",
    "",
    row.right.number,
    value.content,
    "+"
  )}</div>`;
}

function visibleRowsWithContext(rows) {
  const contextValue = elements.contextSelect.value;
  if (contextValue === "all") {
    if (rows.length <= MAX_RENDERED_ROWS) {
      return rows;
    }

    const startRows = rows.slice(0, MAX_RENDERED_ROWS / 2);
    const endRows = rows.slice(rows.length - MAX_RENDERED_ROWS / 2);
    return [
      ...startRows,
      { type: "gap", hiddenCount: rows.length - MAX_RENDERED_ROWS },
      ...endRows
    ];
  }

  if (state.differences.length === 0) {
    return rows.slice(0, Math.min(rows.length, 80));
  }

  const context = Number(contextValue);
  const visibleIndices = new Set();
  state.differences.forEach((difference) => {
    const from = Math.max(0, difference.rowIndex - context);
    const to = Math.min(rows.length - 1, difference.rowIndex + context);
    for (let index = from; index <= to; index += 1) {
      visibleIndices.add(index);
    }
  });

  const output = [];
  let previousIndex = -1;
  [...visibleIndices].sort((a, b) => a - b).forEach((rowIndex) => {
    if (previousIndex >= 0 && rowIndex - previousIndex > 1) {
      output.push({ type: "gap", hiddenCount: rowIndex - previousIndex - 1 });
    } else if (previousIndex === -1 && rowIndex > 0) {
      output.push({ type: "gap", hiddenCount: rowIndex });
    }
    output.push(rows[rowIndex]);
    previousIndex = rowIndex;
  });

  if (previousIndex < rows.length - 1) {
    output.push({ type: "gap", hiddenCount: rows.length - previousIndex - 1 });
  }

  return output;
}

function renderDiffRows() {
  if (state.rows.length === 0) {
    elements.diffRows.innerHTML = `
      <div class="empty-result">
        <strong>비교할 텍스트가 없습니다</strong>
        <p>위 입력 칸에 파일을 놓거나 텍스트를 붙여넣으세요.</p>
      </div>`;
    return;
  }

  const visibleRows = visibleRowsWithContext(state.rows);
  elements.diffRows.innerHTML = visibleRows.map((row) => {
    if (row.type === "gap") {
      return `<div class="diff-gap">${row.hiddenCount.toLocaleString()}개 동일 라인 접힘</div>`;
    }
    return state.view === "split" ? splitRowMarkup(row) : unifiedRowMarkup(row);
  }).join("");

  if (state.activeDifference >= 0) {
    const active = elements.diffRows.querySelector(`[data-diff-index="${state.activeDifference}"]`);
    active?.classList.add("active");
    active?.setAttribute("aria-current", "true");
  }
}

function renderDiffMap() {
  if (state.differences.length === 0 || state.rows.length === 0) {
    elements.diffMap.innerHTML = "";
    return;
  }

  elements.diffMap.innerHTML = state.differences.map((difference) => {
    const top = Math.min(99, (difference.rowIndex / state.rows.length) * 100);
    return `<i class="map-mark ${difference.type}" style="top:${top}%"></i>`;
  }).join("");
}

function renderStatistics() {
  const stats = state.stats;
  const differenceCount = state.differences.length;
  elements.similarityStat.textContent = `${stats.similarity}%`;
  elements.similarityMeter.style.width = `${stats.similarity}%`;
  elements.addedStat.textContent = `+${stats.added.toLocaleString()}`;
  elements.changedStat.textContent = `~${stats.changed.toLocaleString()}`;
  elements.removedStat.textContent = `−${stats.removed.toLocaleString()}`;
  elements.totalStat.textContent = stats.total.toLocaleString();

  elements.resultState.classList.toggle("identical", differenceCount === 0);
  elements.resultStateText.textContent = differenceCount === 0
    ? "두 텍스트가 같습니다"
    : `차이 ${differenceCount.toLocaleString()}개를 찾았습니다`;

  elements.prevDiffButton.disabled = differenceCount === 0;
  elements.nextDiffButton.disabled = differenceCount === 0;
  elements.copyButton.disabled = state.rows.length === 0;
  elements.exportButton.disabled = differenceCount === 0;
  updateDifferencePosition();
}

function updateDifferencePosition() {
  const differenceCount = state.differences.length;
  const hasCurrent = state.activeDifference >= 0 && differenceCount > 0;
  const current = hasCurrent ? (state.activeDifference + 1).toLocaleString() : "—";
  const total = differenceCount.toLocaleString();
  elements.diffPosition.textContent = `${current} / ${total}`;
  elements.diffPosition.classList.toggle("has-current", hasCurrent);
  elements.diffPosition.setAttribute(
    "aria-label",
    hasCurrent
      ? `현재 차이 ${current}, 전체 ${total}`
      : `선택된 차이 없음, 전체 ${total}`
  );
}

function renderResults() {
  elements.diffHead.classList.toggle("unified-head", state.view === "unified");
  updateAllDocumentUi();
  renderStatistics();
  renderDiffRows();
  renderDiffMap();
}

function activateDifference(index) {
  if (state.differences.length === 0) {
    return;
  }

  const normalizedIndex = (index + state.differences.length) % state.differences.length;
  state.activeDifference = normalizedIndex;
  const previous = elements.diffRows.querySelector(".active");
  previous?.classList.remove("active");
  previous?.removeAttribute("aria-current");
  const target = elements.diffRows.querySelector(`[data-diff-index="${normalizedIndex}"]`);
  target?.classList.add("active");
  target?.setAttribute("aria-current", "true");
  updateDifferencePosition();
}

function showToast(message) {
  window.clearTimeout(state.toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  state.toastTimer = window.setTimeout(() => elements.toast.classList.remove("show"), 2400);
}

function looksBinary(bytes) {
  if (
    (bytes[0] === 0xff && bytes[1] === 0xfe) ||
    (bytes[0] === 0xfe && bytes[1] === 0xff)
  ) {
    return false;
  }

  const sampleLength = Math.min(bytes.length, 8192);
  let zeroBytes = 0;
  let controlBytes = 0;

  for (let index = 0; index < sampleLength; index += 1) {
    const byte = bytes[index];
    if (byte === 0) {
      zeroBytes += 1;
    } else if (byte < 8 || (byte > 13 && byte < 32)) {
      controlBytes += 1;
    }
  }

  return zeroBytes / Math.max(sampleLength, 1) > 0.01 ||
    controlBytes / Math.max(sampleLength, 1) > 0.18;
}

function decodeBuffer(buffer, requestedEncoding = "auto") {
  const bytes = new Uint8Array(buffer);
  if (looksBinary(bytes)) {
    throw new Error("이 파일은 바이너리 형식으로 보입니다. 텍스트로 저장한 뒤 다시 시도해 주세요.");
  }

  if (requestedEncoding !== "auto") {
    return {
      text: new TextDecoder(requestedEncoding).decode(bytes),
      encoding: requestedEncoding.toUpperCase()
    };
  }

  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return {
      text: new TextDecoder("utf-8").decode(bytes.subarray(3)),
      encoding: "UTF-8 BOM"
    };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return {
      text: new TextDecoder("utf-16le").decode(bytes.subarray(2)),
      encoding: "UTF-16 LE"
    };
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return {
      text: new TextDecoder("utf-16be").decode(bytes.subarray(2)),
      encoding: "UTF-16 BE"
    };
  }

  try {
    return {
      text: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      encoding: "UTF-8"
    };
  } catch {
    try {
      return {
        text: new TextDecoder("euc-kr", { fatal: true }).decode(bytes),
        encoding: "EUC-KR"
      };
    } catch {
      return {
        text: new TextDecoder("windows-1252").decode(bytes),
        encoding: "Windows-1252"
      };
    }
  }
}

async function loadFile(side, file, { compare = true, notify = true } = {}) {
  if (!file) {
    return false;
  }
  if (file.size > MAX_FILE_BYTES) {
    showToast(`${MAX_FILE_MEGABYTES} MB 이하 파일을 선택해 주세요. 현재 파일: ${formatBytes(file.size)}`);
    return false;
  }

  try {
    const buffer = await file.arrayBuffer();
    let decoded;
    let kind = "text";

    if (globalThis.AllCompareExcel?.isModernExcelFile(file.name)) {
      try {
        decoded = await globalThis.AllCompareExcel.readWorkbook(buffer, file.name);
        kind = "excel";
      } catch {
        decoded = await globalThis.AllCompareBinary.readFile(buffer, file.name);
        kind = decoded.kind;
      }
    } else if (globalThis.AllCompareBinary?.isProbablyBinary(buffer, file.name)) {
      decoded = await globalThis.AllCompareBinary.readFile(buffer, file.name);
      kind = decoded.kind;
    } else {
      const requestedEncoding = elements[`${side}Encoding`].value;
      decoded = decodeBuffer(buffer, requestedEncoding);
    }

    const previewUrl = kind === "image" && decoded.image
      ? URL.createObjectURL(new Blob([buffer], { type: decoded.image.mimeType }))
      : null;
    releaseDocumentResources(state[side]);
    state[side] = {
      name: file.name,
      text: decoded.text,
      buffer,
      size: file.size,
      encoding: decoded.encoding,
      kind,
      hash: decoded.hash || null,
      image: decoded.image || null,
      previewUrl,
      source: "file",
      edited: false
    };
    updateDocumentUi(side);
    if (compare) {
      compareNow(false);
    }
    if (notify) {
      showToast(`${file.name} 파일을 로컬에서 열었습니다.`);
    }
    return true;
  } catch (error) {
    showToast(error instanceof Error ? error.message : "파일을 읽지 못했습니다.");
    return false;
  }
}

async function loadSelectedFiles(fileList, preferredSide) {
  const files = Array.from(fileList || []).slice(0, 2);
  if (files.length === 0) {
    return;
  }

  if (files.length === 1) {
    await loadFile(preferredSide, files[0]);
    return;
  }

  const loaded = await Promise.all([
    loadFile("left", files[0], { compare: false, notify: false }),
    loadFile("right", files[1], { compare: false, notify: false })
  ]);
  compareNow(false);

  const loadedCount = loaded.filter(Boolean).length;
  if (loadedCount === 2) {
    showToast(`${files[0].name} → SOURCE · ${files[1].name} → TARGET`);
  } else if (loadedCount === 1) {
    showToast("두 파일 중 한 개만 열었습니다. 다른 파일 형식을 확인해 주세요.");
  }
}

function redecodeFile(side) {
  const documentState = state[side];
  if (!documentState.buffer || documentState.kind !== "text") {
    return;
  }

  try {
    const decoded = decodeBuffer(documentState.buffer, elements[`${side}Encoding`].value);
    documentState.text = decoded.text;
    documentState.encoding = decoded.encoding;
    documentState.edited = false;
    updateDocumentUi(side);
    compareNow(false);
  } catch (error) {
    showToast(error instanceof Error ? error.message : "선택한 인코딩으로 읽지 못했습니다.");
  }
}

function updateManualText(side) {
  const text = elements[`${side}Text`].value;
  const documentState = state[side];
  releaseDocumentResources(documentState);
  documentState.text = text;
  documentState.buffer = null;
  documentState.size = new TextEncoder().encode(text).byteLength;
  documentState.source = "manual";
  documentState.encoding = "UTF-8";
  documentState.kind = "text";
  documentState.hash = null;
  documentState.image = null;
  documentState.edited = true;
  updateDocumentUi(side);
  scheduleCompare();
}

function clearDocument(side) {
  releaseDocumentResources(state[side]);
  state[side] = {
    name: side === "left" ? "source.txt" : "target.txt",
    text: "",
    buffer: null,
    size: 0,
    encoding: "UTF-8",
    kind: "text",
    hash: null,
    image: null,
    previewUrl: null,
    source: "manual",
    edited: false
  };
  elements[`${side}FileInput`].value = "";
  updateDocumentUi(side);
  compareNow(false);
  elements[`${side}Text`].focus();
}

function formatDocument(side) {
  const documentState = state[side];
  if (documentState.kind !== "text") {
    showToast("문서·아카이브·HEX 보기는 원본 구조를 유지하기 위해 자동 정리하지 않습니다.");
    return;
  }
  const trimmed = documentState.text.trim();
  if (!trimmed) {
    showToast("정리할 텍스트가 없습니다.");
    return;
  }

  try {
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      documentState.text = `${JSON.stringify(JSON.parse(trimmed), null, 2)}\n`;
      showToast("JSON 들여쓰기를 정리했습니다.");
    } else {
      documentState.text = normalizeLineEndings(documentState.text)
        .split("\n")
        .map((line) => line.replace(/[ \t]+$/g, ""))
        .join("\n");
      showToast("줄바꿈과 줄 끝 공백을 정리했습니다.");
    }
    documentState.buffer = null;
    documentState.size = new TextEncoder().encode(documentState.text).byteLength;
    documentState.source = "manual";
    documentState.kind = "text";
    documentState.hash = null;
    documentState.image = null;
    documentState.edited = true;
    updateDocumentUi(side);
    compareNow(false);
  } catch {
    showToast("JSON 문법을 확인해 주세요. 원문은 변경하지 않았습니다.");
  }
}

function swapDocuments() {
  const previousLeft = state.left;
  state.left = state.right;
  state.right = previousLeft;

  const leftEncodingValue = elements.leftEncoding.value;
  elements.leftEncoding.value = elements.rightEncoding.value;
  elements.rightEncoding.value = leftEncodingValue;

  elements.leftFileInput.value = "";
  elements.rightFileInput.value = "";
  updateAllDocumentUi();
  compareNow(false);
  showToast("원본과 대상의 위치를 바꿨습니다.");
}

function csvEscape(value) {
  const stringValue = String(value ?? "");
  return `"${stringValue.replaceAll('"', '""')}"`;
}

function downloadBlob(fileName, type, content) {
  const blob = new Blob(["\ufeff", content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportCsv() {
  if (state.differences.length === 0) {
    showToast("내보낼 차이가 없습니다.");
    return;
  }

  const header = ["No.", "Difference", "Source line", "Target line", "Source", "Target"];
  const rows = state.differences.map((difference, index) => [
    index + 1,
    difference.type,
    difference.left?.number ?? "",
    difference.right?.number ?? "",
    difference.left?.content ?? "",
    difference.right?.content ?? ""
  ]);
  const content = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n");
  const date = new Date().toISOString().slice(0, 10);
  downloadBlob(`allcompare-${date}.csv`, "text/csv;charset=utf-8", content);
  showToast(`차이 ${state.differences.length.toLocaleString()}개를 CSV로 내보냈습니다.`);
}

function buildUnifiedPatch() {
  const patch = [`--- ${state.left.name}`, `+++ ${state.right.name}`];

  state.rows.forEach((row) => {
    if (row.type === "equal") {
      patch.push(` ${row.left.content}`);
    } else if (row.type === "changed") {
      patch.push(`-${row.left.content}`, `+${row.right.content}`);
    } else if (row.type === "removed") {
      patch.push(`-${row.left.content}`);
    } else {
      patch.push(`+${row.right.content}`);
    }
  });

  return patch.join("\n");
}

async function copyPatch() {
  if (state.rows.length === 0) {
    showToast("복사할 결과가 없습니다.");
    return;
  }

  try {
    await navigator.clipboard.writeText(buildUnifiedPatch());
    showToast("통합 패치를 클립보드에 복사했습니다.");
  } catch {
    const textArea = document.createElement("textarea");
    textArea.value = buildUnifiedPatch();
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.append(textArea);
    textArea.select();
    document.execCommand("copy");
    textArea.remove();
    showToast("통합 패치를 클립보드에 복사했습니다.");
  }
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  elements.themeButton.setAttribute(
    "aria-label",
    theme === "dark" ? "라이트 모드 전환" : "다크 모드 전환"
  );
  try {
    localStorage.setItem("allcompare-theme", theme);
  } catch {
    // Storage can be unavailable in privacy-focused browser modes.
  }
}

function initializeTheme() {
  let savedTheme = null;
  try {
    savedTheme = localStorage.getItem("allcompare-theme");
  } catch {
    savedTheme = null;
  }
  const preferredTheme = window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  setTheme(savedTheme || preferredTheme);
}

function attachDropzone(side) {
  const dropzone = elements[`${side}Dropzone`];
  let dragDepth = 0;

  dropzone.addEventListener("dragenter", (event) => {
    event.preventDefault();
    dragDepth += 1;
    dropzone.classList.add("dragging");
  });

  dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }
  });

  dropzone.addEventListener("dragleave", (event) => {
    event.preventDefault();
    dragDepth -= 1;
    if (dragDepth <= 0) {
      dragDepth = 0;
      dropzone.classList.remove("dragging");
    }
  });

  dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    dragDepth = 0;
    dropzone.classList.remove("dragging");
    loadSelectedFiles(event.dataTransfer?.files, side);
  });
}

function attachCenterDropzone() {
  const grid = elements.inputGrid;
  const isPanelEvent = (event) =>
    event.target instanceof Element && Boolean(event.target.closest(".file-panel"));
  const sideFromPointer = (event) => {
    const bounds = grid.getBoundingClientRect();
    const columnCount = getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length;
    if (columnCount === 1) {
      return event.clientY < bounds.top + bounds.height / 2 ? "left" : "right";
    }
    return event.clientX < bounds.left + bounds.width / 2 ? "left" : "right";
  };
  const clearHighlight = () => {
    elements.leftDropzone.classList.remove("dragging");
    elements.rightDropzone.classList.remove("dragging");
  };
  const showHighlight = (side) => {
    elements.leftDropzone.classList.toggle("dragging", side === "left");
    elements.rightDropzone.classList.toggle("dragging", side === "right");
  };

  grid.addEventListener("dragenter", (event) => {
    if (isPanelEvent(event)) {
      return;
    }
    event.preventDefault();
    showHighlight(sideFromPointer(event));
  });

  grid.addEventListener("dragover", (event) => {
    if (isPanelEvent(event)) {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }
    showHighlight(sideFromPointer(event));
  });

  grid.addEventListener("dragleave", (event) => {
    if (isPanelEvent(event)) {
      return;
    }
    if (!(event.relatedTarget instanceof Node) || !grid.contains(event.relatedTarget)) {
      clearHighlight();
    }
  });

  grid.addEventListener("drop", (event) => {
    if (isPanelEvent(event)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const side = sideFromPointer(event);
    clearHighlight();
    loadSelectedFiles(event.dataTransfer?.files, side);
  });
}

function bindEvents() {
  document.addEventListener("dragstart", (event) => {
    if (event.target instanceof Element && event.target.closest("img")) {
      event.preventDefault();
    }
  });

  elements.leftText.addEventListener("input", () => updateManualText("left"));
  elements.rightText.addEventListener("input", () => updateManualText("right"));
  elements.leftFileInput.addEventListener("change", (event) => loadSelectedFiles(event.target.files, "left"));
  elements.rightFileInput.addEventListener("change", (event) => loadSelectedFiles(event.target.files, "right"));
  elements.leftEncoding.addEventListener("change", () => redecodeFile("left"));
  elements.rightEncoding.addEventListener("change", () => redecodeFile("right"));
  elements.compareButton.addEventListener("click", () => compareNow(true));
  elements.swapButton.addEventListener("click", swapDocuments);
  elements.contextSelect.addEventListener("change", renderDiffRows);
  elements.prevDiffButton.addEventListener("click", () => activateDifference(state.activeDifference - 1));
  elements.nextDiffButton.addEventListener("click", () => activateDifference(state.activeDifference + 1));
  elements.copyButton.addEventListener("click", copyPatch);
  elements.exportButton.addEventListener("click", exportCsv);
  elements.themeButton.addEventListener("click", () => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  });

  document.querySelector("#leftClearButton").addEventListener("click", () => clearDocument("left"));
  document.querySelector("#rightClearButton").addEventListener("click", () => clearDocument("right"));
  document.querySelector("#leftFormatButton").addEventListener("click", () => formatDocument("left"));
  document.querySelector("#rightFormatButton").addEventListener("click", () => formatDocument("right"));

  [
    elements.trimWhitespace,
    elements.collapseWhitespace,
    elements.ignoreCase,
    elements.ignoreBlank,
    elements.sortMode
  ]
    .forEach((input) => input.addEventListener("change", () => compareNow(false)));

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-view]").forEach((viewButton) => {
        viewButton.classList.toggle("active", viewButton === button);
      });
      state.view = button.dataset.view;
      renderResults();
    });
  });

  elements.diffRows.addEventListener("click", (event) => {
    const row = event.target.closest("[data-diff-index]");
    if (row) {
      activateDifference(Number(row.dataset.diffIndex));
    }
  });

  elements.diffRows.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      const row = event.target.closest("[data-diff-index]");
      if (row) {
        activateDifference(Number(row.dataset.diffIndex));
      }
    }
  });

  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      compareNow(true);
    }
    if (event.altKey && event.key === "ArrowDown") {
      event.preventDefault();
      activateDifference(state.activeDifference + 1);
    }
    if (event.altKey && event.key === "ArrowUp") {
      event.preventDefault();
      activateDifference(state.activeDifference - 1);
    }
  });

  window.addEventListener("beforeunload", () => {
    releaseDocumentResources(state.left);
    releaseDocumentResources(state.right);
  });

  attachDropzone("left");
  attachDropzone("right");
  attachCenterDropzone();
}

function initialize() {
  initializeTheme();
  updateAllDocumentUi();
  bindEvents();
  compareNow(false);

  window.AllCompare = {
    compare: compareDocuments,
    getState: () => ({
      rows: state.rows,
      differences: state.differences,
      stats: state.stats
    })
  };
}

initialize();
