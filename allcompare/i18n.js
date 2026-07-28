(function attachI18n(global) {
  "use strict";

  const STORAGE_KEY = "allcompare-language";
  const SUPPORTED_LANGUAGES = ["ko", "en"];
  const FALLBACK_LANGUAGE = "ko";

  const KO = {
    "meta.title": "AllCompare — 모든 파일 비교",
    "meta.description":
      "브라우저 안에서 텍스트, 문서, PDF, 압축파일과 모든 바이너리의 차이를 비교하는 AllCompare",

    "header.brandHome": "AllCompare 홈",
    "header.privacy": "파일은 브라우저 밖으로 나가지 않아요",
    "header.themeTitle": "화면 테마 전환",
    "header.themeToDark": "다크 모드 전환",
    "header.themeToLight": "라이트 모드 전환",
    "header.language": "표시 언어",
    "header.languageKo": "한국어로 보기",
    "header.languageEn": "영어로 보기",

    "hero.title": "파일은 달라도,<br><em>차이는 선명하게.</em>",
    "hero.copy":
      "확장자 대신 실제 내용을 읽습니다. 텍스트, Office, PDF, 압축파일은 구조와 내용을, 이미지는 픽셀을, 그 밖의 파일은 HEX로 비교하세요.",
    "hero.formats": "지원 형식 예시",

    "workspace.label": "파일 비교 작업 영역",
    "panel.format": "자동 정리",
    "panel.clear": "비우기",
    "panel.open": "파일 열기",
    "panel.sourceImageAlt": "원본 이미지 미리보기",
    "panel.targetImageAlt": "대상 이미지 미리보기",
    "panel.sourceText": "원본 텍스트",
    "panel.targetText": "대상 텍스트",
    "panel.textPlaceholder": "파일을 놓거나 비교할 텍스트를 붙여넣으세요.",
    "panel.sourceFooter": "파일 1개/2개 드롭 · 붙여넣기 가능",
    "panel.targetFooter": "모든 파일 · 최대 100 MB",
    "panel.encoding": "인코딩",
    "panel.sourceEncoding": "원본 파일 인코딩",
    "panel.targetEncoding": "대상 파일 인코딩",
    "encoding.auto": "자동 감지",
    "drop.title": "한 개 또는 두 파일 놓기",
    "drop.hint": "두 파일이면 SOURCE / TARGET에 자동 배치합니다",
    "swap.label": "원본과 대상 바꾸기",
    "swap.title": "원본과 대상 바꾸기 · 이 영역에도 파일 드롭 가능",

    "options.legend": "비교 규칙",
    "options.trim": "앞뒤 공백 무시",
    "options.collapse": "연속 공백 무시",
    "options.case": "대소문자 무시",
    "options.blank": "빈 줄 무시",
    "options.sort": "정렬",
    "options.sortLabel": "정렬 후 비교 기준",
    "sort.none": "원본 순서",
    "sort.lineAsc": "전체 라인 ↑",
    "sort.lineDesc": "전체 라인 ↓",
    "sort.fieldAsc": "첫 필드 ↑",
    "sort.fieldDesc": "첫 필드 ↓",
    "action.compare": "차이 비교하기",

    "results.title": "비교 결과",
    "results.statsLabel": "비교 통계",
    "stat.similarity": "유사도",
    "stat.added": "추가",
    "stat.addedNote": "새로운 라인",
    "stat.changed": "변경",
    "stat.changedNote": "수정된 라인",
    "stat.removed": "삭제",
    "stat.removedNote": "사라진 라인",
    "stat.total": "검사",
    "stat.totalNote": "정렬된 라인",
    "view.label": "결과 보기 방식",
    "view.split": "나란히",
    "view.unified": "한 줄로",
    "context.label": "문맥",
    "context.3": "3줄",
    "context.5": "5줄",
    "context.all": "모두",
    "position.label": "현재 차이 위치",
    "nav.prev": "이전",
    "nav.prevTitle": "이전 차이",
    "nav.next": "다음",
    "nav.nextTitle": "다음 차이",
    "imageDiff.label": "이미지 픽셀 차이",
    "imageDiff.title": "시각적 차이 마스크",
    "imageDiff.alt": "변경된 이미지 픽셀을 표시하는 차이 마스크",
    "imageDiff.identical": "디코딩된 픽셀이 동일합니다",
    "imageDiff.changed": "변경 픽셀 차이 마스크",
    "diff.bodyLabel": "파일 차이",
    "diff.mapLabel": "차이 위치 미니맵",
    "result.footnoteIdle": "모든 비교는 이 탭 안에서만 처리됩니다.",
    "action.copyPatch": "패치 복사",
    "action.exportCsv": "CSV 내보내기",

    "features.label": "AllCompare 특징",
    "feature.1.title": "텍스트부터 바이너리까지",
    "feature.1.body":
      "Office·PDF·압축파일은 내용을, 이미지는 픽셀을 비교하고 나머지 형식은 전체 바이트를 HEX로 스캔합니다.",
    "feature.2.title": "맥락 있는 정렬",
    "feature.2.body":
      "추가·삭제된 줄을 정렬해 양쪽 위치를 유지하고, 바뀐 구간만 한 번 더 강조합니다.",
    "feature.3.title": "완전한 로컬 처리",
    "feature.3.body":
      "업로드 서버와 계정이 없습니다. 선택한 파일은 현재 브라우저 메모리 안에서만 비교됩니다.",

    "doc.originSample": "샘플",
    "doc.originManual": "직접 입력",
    "doc.meta": ({ origin, lines, encoding, edited }) =>
      `${origin} · ${lines}줄 · ${encoding}${edited ? " · 편집됨" : ""}`,
    "image.sampleSuffix": ({ percent }) => ` · ${percent}% 픽셀 샘플`,
    "imageDiff.meta": ({ changed, compared, percent, bounds }) =>
      `${changed} / ${compared}픽셀 변경 · 차이 ${percent}% · 영역 ${bounds}`,
    "footnote.hex": ({ bytes, elapsed }) =>
      `브라우저 로컬 HEX 전체 스캔 · ${bytes}바이트 차이 · ${elapsed}ms`,
    "footnote.image": ({ pixels, elapsed }) =>
      `브라우저 로컬 이미지 픽셀 비교 · ${pixels}픽셀 차이 · ${elapsed}ms`,
    "footnote.text": ({ left, right, elapsed, sort }) =>
      `브라우저 로컬 처리 · ${left}줄 ↔ ${right}줄 · ${elapsed}ms${sort}`,

    "diff.emptyTitle": "비교할 텍스트가 없습니다",
    "diff.emptyBody": "위 입력 칸에 파일을 놓거나 텍스트를 붙여넣으세요.",
    "diff.blankLine": "빈 줄",
    "diff.gap": ({ count }) => `${count}개 동일 라인 접힘`,
    "result.identical": "두 텍스트가 같습니다",
    "result.differences": ({ count }) => `차이 ${count}개를 찾았습니다`,
    "position.current": ({ current, total }) => `현재 차이 ${current}, 전체 ${total}`,
    "position.none": ({ total }) => `선택된 차이 없음, 전체 ${total}`,

    "toast.fileTooLarge": ({ limit, size }) =>
      `${limit} MB 이하 파일을 선택해 주세요. 현재 파일: ${size}`,
    "toast.fileOpened": ({ name }) => `${name} 파일을 로컬에서 열었습니다.`,
    "toast.onlyOneFile": "두 파일 중 한 개만 열었습니다. 다른 파일 형식을 확인해 주세요.",
    "toast.formatUnsupported":
      "문서·아카이브·HEX 보기는 원본 구조를 유지하기 위해 자동 정리하지 않습니다.",
    "toast.formatEmpty": "정리할 텍스트가 없습니다.",
    "toast.formatJson": "JSON 들여쓰기를 정리했습니다.",
    "toast.formatText": "줄바꿈과 줄 끝 공백을 정리했습니다.",
    "toast.formatJsonError": "JSON 문법을 확인해 주세요. 원문은 변경하지 않았습니다.",
    "toast.swapped": "원본과 대상의 위치를 바꿨습니다.",
    "toast.exportEmpty": "내보낼 차이가 없습니다.",
    "toast.exported": ({ count }) => `차이 ${count}개를 CSV로 내보냈습니다.`,
    "toast.copyEmpty": "복사할 결과가 없습니다.",
    "toast.copied": "통합 패치를 클립보드에 복사했습니다.",
    "error.binaryFile": "이 파일은 바이너리 형식으로 보입니다. 텍스트로 저장한 뒤 다시 시도해 주세요.",
    "error.readFile": "파일을 읽지 못했습니다.",
    "error.redecode": "선택한 인코딩으로 읽지 못했습니다.",

    "reader.zipCentralDirectory": "ZIP 중앙 디렉터리를 읽지 못했습니다.",
    "reader.zipStructure": "올바른 ZIP 구조가 아닙니다.",
    "reader.zipEncrypted": ({ path }) => `암호화된 ZIP 항목은 열 수 없습니다: ${path}`,
    "reader.zipEntryTooLarge": ({ path }) => `압축 해제할 내부 파일이 너무 큽니다: ${path}`,
    "reader.zipHeaderDamaged": ({ path }) => `ZIP 내부 파일 헤더가 손상되었습니다: ${path}`,
    "reader.zipMethod": ({ method, path }) =>
      `지원하지 않는 ZIP 압축 방식(${method})입니다: ${path}`,
    "reader.zipEntryLabel": ({ path }) => `ZIP 내부 파일 ${path}`,
    "reader.decompressUnsupported": ({ label }) =>
      `${label} 압축 해제를 지원하는 최신 브라우저가 필요합니다.`,
    "reader.decompressTooLarge": ({ label }) => `${label}의 압축 해제 결과가 너무 큽니다.`,
    "reader.decompressFailed": ({ label }) => `${label}의 압축을 풀지 못했습니다.`,
    "reader.xmlFailed": ({ path }) => `문서 XML을 읽지 못했습니다: ${path}`,
    "reader.hashUnavailable": "사용 불가",
    "reader.imageDecodeFailed": "이미지를 디코딩하지 못했습니다.",
    "reader.imageFormatUnknown": "이미지 형식을 확인하지 못했습니다.",
    "reader.imageSizeUnknown": "이미지 크기를 확인하지 못했습니다.",
    "reader.imagePixelsUnavailable": "이미지 픽셀을 읽을 수 없습니다.",
    "reader.imageScaled": ({ percent }) => `${percent}% 축소`,
    "reader.imageOriginal": "원본 크기",
    "reader.wordBodyMissing": "Word 본문을 찾지 못했습니다.",
    "reader.pptSlidesMissing": "PowerPoint 슬라이드를 찾지 못했습니다.",
    "reader.odfBodyMissing": "OpenDocument 본문을 찾지 못했습니다.",
    "reader.pdfStreamTooLarge": "PDF 텍스트 스트림이 너무 큽니다.",
    "reader.pdfStreamLabel": "PDF 스트림",
    "reader.pdfNoText": "[추출 가능한 텍스트 없음 — 원본 SHA-256으로 바이너리 변경 확인]",
    "reader.gzipLabel": "GZIP 파일",
    "encodingLabel.pptx": ({ count }) => `PowerPoint · ${count}슬라이드`,
    "encodingLabel.zip": ({ count }) => `ZIP · ${count}파일`,
    "encodingLabel.pdf": ({ pages }) => `PDF · ${pages}페이지`,
    "encodingLabel.tar": ({ count }) => `TAR · ${count}파일`,
    "encodingLabel.excel": ({ sheets, tables }) => `Excel · ${sheets}시트 · ${tables}테이블`,

    "excel.centralDirectory": "Excel ZIP 중앙 디렉터리를 읽지 못했습니다.",
    "excel.entryTooLarge": ({ name }) => `Excel 내부 파일이 너무 큽니다: ${name}`,
    "excel.zipStructure": "올바른 XLSX ZIP 구조가 아닙니다.",
    "excel.encrypted": "암호화된 Excel 파일은 비교할 수 없습니다.",
    "excel.headerDamaged": ({ path }) => `Excel 내부 파일 헤더가 손상되었습니다: ${path}`,
    "excel.method": ({ method }) => `지원하지 않는 Excel ZIP 압축 방식입니다: ${method}`,
    "excel.decompressUnsupported":
      "이 브라우저는 XLSX 압축 해제를 지원하지 않습니다. 최신 브라우저를 사용해 주세요.",
    "excel.decompressFailed": ({ path }) => `Excel 내부 파일의 압축을 풀지 못했습니다: ${path}`,
    "excel.xmlFailed": ({ path }) => `Excel XML을 읽지 못했습니다: ${path}`,
    "excel.rangeTooLarge": ({ range, cells }) =>
      `Excel 표 범위가 너무 큽니다: ${range} (${cells}셀)`,
    "excel.sheetFailed": "읽기 실패",
    "excel.tooManyCells": ({ limit }) =>
      `Excel 셀이 너무 많습니다. 한 파일당 ${limit}셀까지 지원합니다.`,
    "excel.workbookMissing": "Excel 통합 문서 정보를 찾지 못했습니다.",
    "excel.noSheets": "비교할 수 있는 Excel 시트를 찾지 못했습니다.",

    "sample.left": `{
  "name": "AllCompare",
  "version": "1.0.0",
  "features": [
    "모든 텍스트 포맷",
    "로컬 처리",
    "라인 비교"
  ],
  "theme": "paper"
}`,
    "sample.right": `{
  "name": "AllCompare",
  "version": "1.1.0",
  "features": [
    "모든 텍스트 포맷",
    "브라우저 로컬 처리",
    "라인 비교",
    "CSV 내보내기"
  ],
  "theme": "ink"
}`
  };

  const EN = {
    "meta.title": "AllCompare — Compare Any File",
    "meta.description":
      "AllCompare diffs text, documents, PDFs, archives and any binary file entirely inside your browser",

    "header.brandHome": "AllCompare home",
    "header.privacy": "Your files never leave the browser",
    "header.themeTitle": "Switch color theme",
    "header.themeToDark": "Switch to dark mode",
    "header.themeToLight": "Switch to light mode",
    "header.language": "Display language",
    "header.languageKo": "View in Korean",
    "header.languageEn": "View in English",

    "hero.title": "Different files,<br><em>crystal-clear diffs.</em>",
    "hero.copy":
      "AllCompare reads the real content instead of the extension. Text, Office, PDF and archives are compared by structure and content, images by pixels, and everything else in HEX.",
    "hero.formats": "Supported format examples",

    "workspace.label": "File comparison workspace",
    "panel.format": "Auto-format",
    "panel.clear": "Clear",
    "panel.open": "Open file",
    "panel.sourceImageAlt": "Source image preview",
    "panel.targetImageAlt": "Target image preview",
    "panel.sourceText": "Source text",
    "panel.targetText": "Target text",
    "panel.textPlaceholder": "Drop a file, or paste the text you want to compare.",
    "panel.sourceFooter": "Drop 1 or 2 files · paste supported",
    "panel.targetFooter": "Any file · up to 100 MB",
    "panel.encoding": "Encoding",
    "panel.sourceEncoding": "Source file encoding",
    "panel.targetEncoding": "Target file encoding",
    "encoding.auto": "Auto detect",
    "drop.title": "Drop one or two files",
    "drop.hint": "Two files go to SOURCE / TARGET automatically",
    "swap.label": "Swap source and target",
    "swap.title": "Swap source and target · files can be dropped here too",

    "options.legend": "Comparison rules",
    "options.trim": "Ignore leading/trailing spaces",
    "options.collapse": "Ignore repeated spaces",
    "options.case": "Ignore case",
    "options.blank": "Ignore blank lines",
    "options.sort": "Sort",
    "options.sortLabel": "Sort order applied before comparing",
    "sort.none": "Original order",
    "sort.lineAsc": "Whole line ↑",
    "sort.lineDesc": "Whole line ↓",
    "sort.fieldAsc": "First field ↑",
    "sort.fieldDesc": "First field ↓",
    "action.compare": "Compare differences",

    "results.title": "Comparison result",
    "results.statsLabel": "Comparison statistics",
    "stat.similarity": "Similarity",
    "stat.added": "Added",
    "stat.addedNote": "New lines",
    "stat.changed": "Changed",
    "stat.changedNote": "Modified lines",
    "stat.removed": "Removed",
    "stat.removedNote": "Deleted lines",
    "stat.total": "Checked",
    "stat.totalNote": "Aligned lines",
    "view.label": "Result view mode",
    "view.split": "Side by side",
    "view.unified": "Unified",
    "context.label": "Context",
    "context.3": "3 lines",
    "context.5": "5 lines",
    "context.all": "All",
    "position.label": "Current difference position",
    "nav.prev": "Prev",
    "nav.prevTitle": "Previous difference",
    "nav.next": "Next",
    "nav.nextTitle": "Next difference",
    "imageDiff.label": "Image pixel difference",
    "imageDiff.title": "Visual difference mask",
    "imageDiff.alt": "Difference mask showing the changed image pixels",
    "imageDiff.identical": "Decoded pixels are identical",
    "imageDiff.changed": "Changed pixel difference mask",
    "diff.bodyLabel": "File differences",
    "diff.mapLabel": "Difference position minimap",
    "result.footnoteIdle": "Every comparison runs inside this tab only.",
    "action.copyPatch": "Copy patch",
    "action.exportCsv": "Export CSV",

    "features.label": "AllCompare highlights",
    "feature.1.title": "From text to binary",
    "feature.1.body":
      "Office, PDF and archives are compared by content, images by pixels, and every other format is scanned byte by byte in HEX.",
    "feature.2.title": "Alignment with context",
    "feature.2.body":
      "Added and removed lines stay aligned on both sides, and the changed part of a line is highlighted once more.",
    "feature.3.title": "Fully local processing",
    "feature.3.body":
      "No upload server, no account. The files you pick are compared only in this browser's memory.",

    "doc.originSample": "Sample",
    "doc.originManual": "Typed in",
    "doc.meta": ({ origin, lines, encoding, edited }) =>
      `${origin} · ${lines} lines · ${encoding}${edited ? " · edited" : ""}`,
    "image.sampleSuffix": ({ percent }) => ` · ${percent}% pixel sample`,
    "imageDiff.meta": ({ changed, compared, percent, bounds }) =>
      `${changed} / ${compared} pixels changed · ${percent}% different · area ${bounds}`,
    "footnote.hex": ({ bytes, elapsed }) =>
      `Full HEX scan in your browser · ${bytes} bytes differ · ${elapsed}ms`,
    "footnote.image": ({ pixels, elapsed }) =>
      `Local image pixel comparison · ${pixels} pixels differ · ${elapsed}ms`,
    "footnote.text": ({ left, right, elapsed, sort }) =>
      `Processed locally in your browser · ${left} ↔ ${right} lines · ${elapsed}ms${sort}`,

    "diff.emptyTitle": "There is nothing to compare",
    "diff.emptyBody": "Drop a file into the panels above, or paste some text.",
    "diff.blankLine": "Blank line",
    "diff.gap": ({ count }) => `${count} identical lines collapsed`,
    "result.identical": "Both sides are identical",
    "result.differences": ({ count }) => `Found ${count} differences`,
    "position.current": ({ current, total }) => `Difference ${current} of ${total}`,
    "position.none": ({ total }) => `No difference selected, ${total} in total`,

    "toast.fileTooLarge": ({ limit, size }) =>
      `Please choose a file of ${limit} MB or less. This one is ${size}.`,
    "toast.fileOpened": ({ name }) => `Opened ${name} locally.`,
    "toast.onlyOneFile": "Only one of the two files could be opened. Please check the other format.",
    "toast.formatUnsupported":
      "Document, archive and HEX views are not auto-formatted so the original structure stays intact.",
    "toast.formatEmpty": "There is no text to format.",
    "toast.formatJson": "JSON indentation has been cleaned up.",
    "toast.formatText": "Line endings and trailing spaces have been cleaned up.",
    "toast.formatJsonError": "Please check the JSON syntax. The original text was left unchanged.",
    "toast.swapped": "Source and target have been swapped.",
    "toast.exportEmpty": "There are no differences to export.",
    "toast.exported": ({ count }) => `Exported ${count} differences to CSV.`,
    "toast.copyEmpty": "There is no result to copy.",
    "toast.copied": "The unified patch has been copied to the clipboard.",
    "error.binaryFile": "This file looks like a binary format. Save it as text and try again.",
    "error.readFile": "The file could not be read.",
    "error.redecode": "The file could not be read with the selected encoding.",

    "reader.zipCentralDirectory": "The ZIP central directory could not be read.",
    "reader.zipStructure": "This is not a valid ZIP structure.",
    "reader.zipEncrypted": ({ path }) => `Encrypted ZIP entries cannot be opened: ${path}`,
    "reader.zipEntryTooLarge": ({ path }) => `The entry to extract is too large: ${path}`,
    "reader.zipHeaderDamaged": ({ path }) => `The ZIP local file header is damaged: ${path}`,
    "reader.zipMethod": ({ method, path }) =>
      `Unsupported ZIP compression method (${method}): ${path}`,
    "reader.zipEntryLabel": ({ path }) => `ZIP entry ${path}`,
    "reader.decompressUnsupported": ({ label }) =>
      `A modern browser is required to decompress ${label}.`,
    "reader.decompressTooLarge": ({ label }) => `The decompressed result of ${label} is too large.`,
    "reader.decompressFailed": ({ label }) => `${label} could not be decompressed.`,
    "reader.xmlFailed": ({ path }) => `The document XML could not be read: ${path}`,
    "reader.hashUnavailable": "unavailable",
    "reader.imageDecodeFailed": "The image could not be decoded.",
    "reader.imageFormatUnknown": "The image format could not be identified.",
    "reader.imageSizeUnknown": "The image size could not be determined.",
    "reader.imagePixelsUnavailable": "The image pixels could not be read.",
    "reader.imageScaled": ({ percent }) => `scaled to ${percent}%`,
    "reader.imageOriginal": "original size",
    "reader.wordBodyMissing": "The Word document body could not be found.",
    "reader.pptSlidesMissing": "No PowerPoint slides were found.",
    "reader.odfBodyMissing": "The OpenDocument body could not be found.",
    "reader.pdfStreamTooLarge": "The PDF text stream is too large.",
    "reader.pdfStreamLabel": "PDF stream",
    "reader.pdfNoText": "[no extractable text — binary changes are still detected by the original SHA-256]",
    "reader.gzipLabel": "GZIP file",
    "encodingLabel.pptx": ({ count }) => `PowerPoint · ${count} slides`,
    "encodingLabel.zip": ({ count }) => `ZIP · ${count} files`,
    "encodingLabel.pdf": ({ pages }) => `PDF · ${pages} pages`,
    "encodingLabel.tar": ({ count }) => `TAR · ${count} files`,
    "encodingLabel.excel": ({ sheets, tables }) => `Excel · ${sheets} sheets · ${tables} tables`,

    "excel.centralDirectory": "The Excel ZIP central directory could not be read.",
    "excel.entryTooLarge": ({ name }) => `An entry inside the Excel file is too large: ${name}`,
    "excel.zipStructure": "This is not a valid XLSX ZIP structure.",
    "excel.encrypted": "Encrypted Excel files cannot be compared.",
    "excel.headerDamaged": ({ path }) => `An Excel local file header is damaged: ${path}`,
    "excel.method": ({ method }) => `Unsupported Excel ZIP compression method: ${method}`,
    "excel.decompressUnsupported":
      "This browser cannot decompress XLSX files. Please use a modern browser.",
    "excel.decompressFailed": ({ path }) => `An entry inside the Excel file could not be decompressed: ${path}`,
    "excel.xmlFailed": ({ path }) => `The Excel XML could not be read: ${path}`,
    "excel.rangeTooLarge": ({ range, cells }) =>
      `The Excel table range is too large: ${range} (${cells} cells)`,
    "excel.sheetFailed": "read failed",
    "excel.tooManyCells": ({ limit }) =>
      `This Excel file has too many cells. Up to ${limit} cells per file are supported.`,
    "excel.workbookMissing": "The Excel workbook information could not be found.",
    "excel.noSheets": "No comparable Excel sheet was found.",

    "sample.left": `{
  "name": "AllCompare",
  "version": "1.0.0",
  "features": [
    "every text format",
    "local processing",
    "line comparison"
  ],
  "theme": "paper"
}`,
    "sample.right": `{
  "name": "AllCompare",
  "version": "1.1.0",
  "features": [
    "every text format",
    "browser-local processing",
    "line comparison",
    "CSV export"
  ],
  "theme": "ink"
}`
  };

  const dictionaries = { ko: KO, en: EN };
  const listeners = new Set();
  let language = detectLanguage();

  function detectLanguage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (SUPPORTED_LANGUAGES.includes(saved)) {
        return saved;
      }
    } catch {
      // Storage can be unavailable in privacy-focused browser modes.
    }

    const preferred = global.navigator?.languages?.length
      ? global.navigator.languages
      : [global.navigator?.language || FALLBACK_LANGUAGE];
    return preferred.some((tag) => String(tag).toLowerCase().startsWith("ko")) ? "ko" : "en";
  }

  function translate(key, params) {
    const entry = dictionaries[language][key] ?? dictionaries[FALLBACK_LANGUAGE][key];
    if (entry === undefined) {
      return key;
    }
    return typeof entry === "function" ? entry(params || {}) : entry;
  }

  function applyAttributes(element) {
    element.getAttribute("data-i18n-attr").split(";").forEach((pair) => {
      const separator = pair.indexOf(":");
      if (separator < 0) {
        return;
      }
      const attribute = pair.slice(0, separator).trim();
      const key = pair.slice(separator + 1).trim();
      if (attribute && key) {
        element.setAttribute(attribute, translate(key));
      }
    });
  }

  function applyDocument() {
    document.documentElement.lang = language;
    document.title = translate("meta.title");
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", translate("meta.description"));

    document.querySelectorAll("[data-i18n]").forEach((element) => {
      element.textContent = translate(element.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-html]").forEach((element) => {
      element.innerHTML = translate(element.dataset.i18nHtml);
    });
    document.querySelectorAll("[data-i18n-attr]").forEach(applyAttributes);
  }

  function setLanguage(nextLanguage) {
    if (!SUPPORTED_LANGUAGES.includes(nextLanguage) || nextLanguage === language) {
      return;
    }
    language = nextLanguage;
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // Storage can be unavailable in privacy-focused browser modes.
    }
    applyDocument();
    listeners.forEach((listener) => listener(language));
  }

  global.AllCompareI18n = {
    languages: SUPPORTED_LANGUAGES,
    t: translate,
    getLanguage: () => language,
    setLanguage,
    apply: applyDocument,
    onChange: (listener) => listeners.add(listener)
  };

  // This script runs at the end of <body>, so the markup is ready and the
  // static text is translated before app.js renders any dynamic text.
  applyDocument();
})(globalThis);
