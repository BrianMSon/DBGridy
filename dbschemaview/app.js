"use strict";

const MONO_STACK = '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace';
const FONT_TITLE = `800 13px ${MONO_STACK}`;
const FONT_SCHEMA = `700 9px ${MONO_STACK}`;
const FONT_COUNT = `700 10px ${MONO_STACK}`;
const FONT_ROW = `400 11.5px ${MONO_STACK}`;
const FONT_ROW_KEY = `700 11.5px ${MONO_STACK}`;
const FONT_SIDE = `400 10.5px ${MONO_STACK}`;

const HEADER_HEIGHT = 44;
const ROW_HEIGHT = 23;
const NODE_PADDING = 12;
const BADGE_SLOT = 26;
const MARK_SLOT = 13;
const MIN_NODE_WIDTH = 196;
const MAX_NODE_WIDTH = 400;
const MAX_VISIBLE_ROWS = 28;

const MIN_SCALE = 0.12;
const MAX_SCALE = 2.6;
const MAX_TEXT_BYTES = 12 * 1024 * 1024;
const MAX_SQLITE_BYTES = 64 * 1024 * 1024;

// 샘플 스키마와 화면 문구는 i18n.js 가 언어별로 들고 있다.
const t = (key, params) => DBSchemaI18n.t(key, params);

const state = {
  schema: null,
  sourceName: "shop-schema.sql",
  targetName: "shop-schema-v2.sql",
  mode: "single",
  diff: null,
  dialect: "mysql",
  migration: null,
  columnMode: "all",
  selected: null,
  matches: new Set(),
  view: { nodes: new Map(), edges: [], width: 0, height: 0 },
  transform: { scale: 1, x: 0, y: 0 },
  nodeElements: new Map(),
  edgeElements: new Map(),
  edgesByNode: new Map(),
  relationById: new Map(),
  pointer: null,
  toastTimer: null
};

const elements = {
  ddlText: document.querySelector("#ddlText"),
  ddlDropzone: document.querySelector("#ddlDropzone"),
  ddlFileInput: document.querySelector("#ddlFileInput"),
  sourceName: document.querySelector("#sourceName"),
  sourceMeta: document.querySelector("#sourceMeta"),
  sourceLabel: document.querySelector("#sourceLabel"),
  sourceDropHint: document.querySelector("#sourceDropHint"),
  sourceDropTitle: document.querySelector("#sourceDropTitle"),
  sourceDropNote: document.querySelector("#sourceDropNote"),
  sampleButton: document.querySelector("#sampleButton"),
  clearButton: document.querySelector("#clearButton"),
  ddlTextB: document.querySelector("#ddlTextB"),
  ddlDropzoneB: document.querySelector("#ddlDropzoneB"),
  ddlFileInputB: document.querySelector("#ddlFileInputB"),
  targetName: document.querySelector("#targetName"),
  targetMeta: document.querySelector("#targetMeta"),
  sampleButtonB: document.querySelector("#sampleButtonB"),
  clearButtonB: document.querySelector("#clearButtonB"),
  inputGrid: document.querySelector("#inputGrid"),
  modeNote: document.querySelector("#modeNote"),
  swapButton: document.querySelector("#swapButton"),
  heroCopy: document.querySelector("#heroCopy"),
  dialectField: document.querySelector("#dialectField"),
  dialectSelect: document.querySelector("#dialectSelect"),
  hideSameTables: document.querySelector("#hideSameTables"),
  resultsEyebrow: document.querySelector("#resultsEyebrow"),
  focusStep: document.querySelector("#focusStep"),
  diffLegend: document.querySelector("#diffLegend"),
  compareReport: document.querySelector("#compareReport"),
  changeList: document.querySelector("#changeList"),
  migrationScript: document.querySelector("#migrationScript"),
  scriptMeta: document.querySelector("#scriptMeta"),
  scriptNotes: document.querySelector("#scriptNotes"),
  scriptNoteList: document.querySelector("#scriptNoteList"),
  copyChangesButton: document.querySelector("#copyChangesButton"),
  copyScriptButton: document.querySelector("#copyScriptButton"),
  saveScriptButton: document.querySelector("#saveScriptButton"),
  renderButton: document.querySelector("#renderButton"),
  renderButtonLabel: document.querySelector("#renderButtonLabel"),
  inferRelations: document.querySelector("#inferRelations"),
  showTypes: document.querySelector("#showTypes"),
  showComments: document.querySelector("#showComments"),
  warningBox: document.querySelector("#warningBox"),
  warningList: document.querySelector("#warningList"),
  resultState: document.querySelector("#resultState"),
  resultStateText: document.querySelector("#resultStateText"),
  resultsTitle: document.querySelector("#resultsTitle"),
  resultFootnote: document.querySelector("#resultFootnote"),
  tableStat: document.querySelector("#tableStat"),
  columnStat: document.querySelector("#columnStat"),
  explicitStat: document.querySelector("#explicitStat"),
  inferredStat: document.querySelector("#inferredStat"),
  isolatedStat: document.querySelector("#isolatedStat"),
  searchInput: document.querySelector("#searchInput"),
  searchPosition: document.querySelector("#searchPosition"),
  zoomInButton: document.querySelector("#zoomInButton"),
  zoomOutButton: document.querySelector("#zoomOutButton"),
  zoomLevel: document.querySelector("#zoomLevel"),
  fitButton: document.querySelector("#fitButton"),
  relayoutButton: document.querySelector("#relayoutButton"),
  diagramCanvas: document.querySelector("#diagramCanvas"),
  diagramSvg: document.querySelector("#diagramSvg"),
  viewport: document.querySelector("#viewport"),
  edgeLayer: document.querySelector("#edgeLayer"),
  nodeLayer: document.querySelector("#nodeLayer"),
  diagramEmpty: document.querySelector("#diagramEmpty"),
  tableRail: document.querySelector("#tableRail"),
  railCount: document.querySelector("#railCount"),
  detailEmpty: document.querySelector("#detailEmpty"),
  detailBody: document.querySelector("#detailBody"),
  detailSchema: document.querySelector("#detailSchema"),
  detailName: document.querySelector("#detailName"),
  detailComment: document.querySelector("#detailComment"),
  detailColumnBody: document.querySelector("#detailColumnBody"),
  detailRelations: document.querySelector("#detailRelations"),
  detailCloseButton: document.querySelector("#detailCloseButton"),
  copyButton: document.querySelector("#copyButton"),
  exportSvgButton: document.querySelector("#exportSvgButton"),
  exportPngButton: document.querySelector("#exportPngButton"),
  themeButton: document.querySelector("#themeButton"),
  toast: document.querySelector("#toast")
};

/* ------------------------------------------------------------ 텍스트 계측 */

const measureContext = document.createElement("canvas").getContext("2d");
const measureCache = new Map();

function measureText(text, font) {
  const key = `${font}\u0000${text}`;
  let width = measureCache.get(key);
  if (width === undefined) {
    measureContext.font = font;
    width = measureContext.measureText(text).width;
    if (measureCache.size > 20000) measureCache.clear();
    measureCache.set(key, width);
  }
  return width;
}

function fitText(text, font, maxWidth) {
  const value = String(text ?? "");
  if (!value) return "";
  if (maxWidth <= 0) return "";
  if (measureText(value, font) <= maxWidth) return value;

  let low = 0;
  let high = value.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (measureText(`${value.slice(0, mid)}…`, font) <= maxWidth) low = mid;
    else high = mid - 1;
  }
  return low > 0 ? `${value.slice(0, low)}…` : "";
}

function escapeXml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      default: return "&apos;";
    }
  });
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/* ---------------------------------------------------------- 노드 모델링 */

function isKeyColumn(column) {
  return column.pk || column.fk || column.inferredFk || column.unique;
}

function rowSideText(column) {
  if (elements.showComments.checked && column.comment) return column.comment;
  if (elements.showTypes.checked) return column.type;
  return "";
}

function selectRows(table) {
  let columns = table.columns;
  if (state.columnMode === "keys") {
    // 키 컬럼만 볼 때도 바뀐 컬럼은 숨기지 않는다.
    const keys = columns.filter((column) => isKeyColumn(column) || column.diffStatus);
    columns = keys.length ? keys : columns.slice(0, 3);
  }
  const visible = columns.slice(0, MAX_VISIBLE_ROWS);
  return { visible, hidden: table.columns.length - visible.length };
}

const DIFF_MARKS = { added: "+", changed: "~", removed: "−" };

function buildNodeModel(table) {
  const { visible, hidden } = selectRows(table);
  const countLabel = `${table.columns.length}`;
  const markSlot = state.mode === "compare" ? MARK_SLOT : 0;

  let width = MIN_NODE_WIDTH;
  const titleNeed =
    NODE_PADDING * 2 +
    Math.max(measureText(table.name, FONT_TITLE), table.schema ? measureText(table.schema, FONT_SCHEMA) : 0) +
    measureText(countLabel, FONT_COUNT) +
    18;
  width = Math.max(width, titleNeed);

  for (const column of visible) {
    const font = isKeyColumn(column) ? FONT_ROW_KEY : FONT_ROW;
    const side = rowSideText(column);
    const need =
      NODE_PADDING +
      BADGE_SLOT +
      measureText(column.name, font) +
      (side ? 16 + measureText(side, FONT_SIDE) : 0) +
      markSlot +
      NODE_PADDING;
    width = Math.max(width, need);
  }

  width = Math.min(MAX_NODE_WIDTH, Math.ceil(width));
  const height = HEADER_HEIGHT + visible.length * ROW_HEIGHT + (hidden > 0 ? ROW_HEIGHT : 0) + 8;

  const columnY = new Map();
  visible.forEach((column, index) => {
    columnY.set(column.name.toLowerCase(), HEADER_HEIGHT + index * ROW_HEIGHT + ROW_HEIGHT / 2);
  });

  return { table, rows: visible, hidden, width, height, columnY, markSlot };
}

function buildView(preservePositions) {
  const schema = state.schema;
  const previous = state.view.nodes;
  const nodes = new Map();

  if (!schema) {
    state.view = { nodes, edges: [], width: 0, height: 0 };
    return;
  }

  for (const table of schema.tables) nodes.set(table.id, buildNodeModel(table));

  const keepable =
    preservePositions &&
    previous.size === nodes.size &&
    [...nodes.keys()].every((id) => previous.has(id));

  if (keepable) {
    for (const [id, node] of nodes) {
      const old = previous.get(id);
      node.x = old.x;
      node.y = old.y;
    }
  } else {
    const layoutNodes = [...nodes.values()].map((node) => ({
      id: node.table.id,
      width: node.width,
      height: node.height
    }));
    const layoutEdges = schema.relations.map((relation) => ({ from: relation.from, to: relation.to }));
    const result = DBSchemaLayout.layout(layoutNodes, layoutEdges);
    for (const [id, node] of nodes) {
      const point = result.positions.get(id) || { x: 0, y: 0 };
      node.x = point.x;
      node.y = point.y;
    }
  }

  let width = 0;
  let height = 0;
  for (const node of nodes.values()) {
    width = Math.max(width, node.x + node.width);
    height = Math.max(height, node.y + node.height);
  }

  state.view = { nodes, edges: schema.relations, width, height };
}

/* --------------------------------------------------------------- 마크업 */

function badgeMarkup(column, y) {
  let label = null;
  let kind = null;
  if (column.pk) {
    label = "PK";
    kind = "pk";
  } else if (column.fk || column.inferredFk) {
    label = "FK";
    kind = "fk";
  } else if (column.unique) {
    label = "UQ";
    kind = "uq";
  }
  if (!label) return "";

  const boxY = y - 6.5;
  return (
    `<rect class="badge-box ${kind}" x="${NODE_PADDING - 2}" y="${boxY}" width="20" height="13" rx="3"/>` +
    `<text class="badge-text ${kind}" x="${NODE_PADDING + 8}" y="${y + 3.2}">${label}</text>`
  );
}

function nodeMarkup(node) {
  const { table, rows, hidden, width, height, markSlot } = node;
  const parts = [];
  const tableDiff = table.diffStatus ? ` diff-${table.diffStatus}` : "";

  parts.push(`<g class="node${tableDiff}" data-id="${escapeXml(table.id)}" transform="translate(${node.x} ${node.y})">`);
  parts.push(`<rect class="node-body" x="0" y="0" width="${width}" height="${height}" rx="10"/>`);
  parts.push(
    `<path class="node-head" d="M0 10 A10 10 0 0 1 10 0 H${width - 10} A10 10 0 0 1 ${width} 10 V${HEADER_HEIGHT} H0 Z"/>`
  );
  parts.push(`<line class="node-divider" x1="0" y1="${HEADER_HEIGHT}" x2="${width}" y2="${HEADER_HEIGHT}"/>`);

  const countLabel = `${table.columns.length}`;
  if (table.schema) {
    parts.push(
      `<text class="node-schema" x="${NODE_PADDING}" y="17">${escapeXml(
        fitText(table.schema, FONT_SCHEMA, width - NODE_PADDING * 2 - 24)
      )}</text>`
    );
    parts.push(
      `<text class="node-title" x="${NODE_PADDING}" y="33">${escapeXml(
        fitText(table.name, FONT_TITLE, width - NODE_PADDING * 2 - 24)
      )}</text>`
    );
  } else {
    parts.push(
      `<text class="node-title" x="${NODE_PADDING}" y="28">${escapeXml(
        fitText(table.name, FONT_TITLE, width - NODE_PADDING * 2 - 24)
      )}</text>`
    );
  }
  parts.push(`<text class="node-count" x="${width - NODE_PADDING}" y="28">${escapeXml(countLabel)}</text>`);

  rows.forEach((column, index) => {
    const y = HEADER_HEIGHT + index * ROW_HEIGHT + ROW_HEIGHT / 2;
    const font = isKeyColumn(column) ? FONT_ROW_KEY : FONT_ROW;
    const side = rowSideText(column);
    const sideWidth = side
      ? Math.min(measureText(side, FONT_SIDE), (width - BADGE_SLOT - NODE_PADDING * 2 - markSlot) * 0.52)
      : 0;
    const nameSpace = width - NODE_PADDING * 2 - BADGE_SLOT - markSlot - (sideWidth ? sideWidth + 14 : 0);
    const rowDiff = column.diffStatus ? ` diff-${column.diffStatus}` : "";

    parts.push(`<g class="row${rowDiff}" data-column="${escapeXml(column.name)}">`);
    parts.push(`<rect class="row-hit" x="0" y="${y - ROW_HEIGHT / 2}" width="${width}" height="${ROW_HEIGHT}"/>`);
    parts.push(badgeMarkup(column, y));
    parts.push(
      `<text class="row-name${isKeyColumn(column) ? " is-key" : ""}" x="${NODE_PADDING + BADGE_SLOT}" y="${
        y + 4
      }">${escapeXml(fitText(column.name, font, nameSpace))}</text>`
    );
    if (side && sideWidth > 14) {
      parts.push(
        `<text class="row-type" x="${width - NODE_PADDING - markSlot}" y="${y + 4}">${escapeXml(
          fitText(side, FONT_SIDE, sideWidth)
        )}</text>`
      );
    }
    if (markSlot && column.diffStatus) {
      parts.push(
        `<text class="row-mark ${column.diffStatus}" x="${width - NODE_PADDING + 3}" y="${y + 4}">${
          DIFF_MARKS[column.diffStatus]
        }</text>`
      );
    }
    parts.push("</g>");
  });

  if (hidden > 0) {
    const y = HEADER_HEIGHT + rows.length * ROW_HEIGHT + ROW_HEIGHT / 2;
    parts.push(
      `<text class="row-more" x="${NODE_PADDING + BADGE_SLOT}" y="${y + 4}">${t("node.more", { count: hidden })}</text>`
    );
  }

  parts.push("</g>");
  return parts.join("");
}

/* --------------------------------------------------------------- 간선 */

function portFor(node, columnName) {
  const y = node.columnY.get(String(columnName || "").toLowerCase());
  return node.y + (y === undefined ? HEADER_HEIGHT / 2 : y);
}

function edgeGeometry(relation) {
  const from = state.view.nodes.get(relation.from);
  const to = state.view.nodes.get(relation.to);
  if (!from || !to) return null;

  const sy = portFor(from, relation.fromColumns[0]);
  const ty = portFor(to, relation.toColumns[0]);

  if (relation.selfReference) {
    const x = from.x + from.width;
    const targetY = Math.abs(ty - sy) < 6 ? sy + 18 : ty;
    return {
      path: `M ${x} ${sy} C ${x + 72} ${sy}, ${x + 72} ${targetY}, ${x} ${targetY}`,
      sx: x,
      sy,
      tx: x,
      ty: targetY,
      sourceDirection: 1,
      targetDirection: 1
    };
  }

  const fromCenter = from.x + from.width / 2;
  const toCenter = to.x + to.width / 2;

  let sx;
  let tx;
  let sourceDirection;
  let targetDirection;

  if (fromCenter <= toCenter) {
    sx = from.x + from.width;
    sourceDirection = 1;
    tx = to.x;
    targetDirection = -1;
  } else {
    sx = from.x;
    sourceDirection = -1;
    tx = to.x + to.width;
    targetDirection = 1;
  }

  const reach = clamp(Math.abs(tx - sx) * 0.5, 46, 170);
  return {
    path: `M ${sx} ${sy} C ${sx + sourceDirection * reach} ${sy}, ${tx + targetDirection * reach} ${ty}, ${tx} ${ty}`,
    sx,
    sy,
    tx,
    ty,
    sourceDirection,
    targetDirection
  };
}

function crowFootPath(x, y, direction) {
  const apex = x + direction * 13;
  return `M ${apex} ${y} L ${x} ${y - 7} M ${apex} ${y} L ${x} ${y} M ${apex} ${y} L ${x} ${y + 7}`;
}

function barPath(x, y, direction) {
  const at = x + direction * 11;
  return `M ${at} ${y - 7} L ${at} ${y + 7}`;
}

function edgeMarkup(relation) {
  const geometry = edgeGeometry(relation);
  if (!geometry) return "";

  const sourceMarker =
    relation.identifying === "one"
      ? barPath(geometry.sx, geometry.sy, geometry.sourceDirection)
      : crowFootPath(geometry.sx, geometry.sy, geometry.sourceDirection);
  const targetMarker = barPath(geometry.tx, geometry.ty, geometry.targetDirection);

  const optional = relation.optional
    ? `<circle class="edge-marker optional" data-role="optional" cx="${
        geometry.sx + geometry.sourceDirection * 20
      }" cy="${geometry.sy}" r="3.6"/>`
    : "";

  return (
    `<g class="edge ${relation.kind}" data-id="${escapeXml(relation.id)}">` +
    `<path class="edge-path" d="${geometry.path}"/>` +
    `<path class="edge-marker" data-role="source" d="${sourceMarker}"/>` +
    `<path class="edge-marker" data-role="target" d="${targetMarker}"/>` +
    optional +
    "</g>"
  );
}

function updateEdgeGeometry(relation) {
  const cached = state.edgeElements.get(relation.id);
  if (!cached) return;
  const geometry = edgeGeometry(relation);
  if (!geometry) return;

  cached.path.setAttribute("d", geometry.path);
  cached.source.setAttribute(
    "d",
    relation.identifying === "one"
      ? barPath(geometry.sx, geometry.sy, geometry.sourceDirection)
      : crowFootPath(geometry.sx, geometry.sy, geometry.sourceDirection)
  );
  cached.target.setAttribute("d", barPath(geometry.tx, geometry.ty, geometry.targetDirection));
  if (cached.optional) {
    cached.optional.setAttribute("cx", geometry.sx + geometry.sourceDirection * 20);
    cached.optional.setAttribute("cy", geometry.sy);
  }
}

/* --------------------------------------------------------------- 그리기 */

function paint() {
  const nodes = [...state.view.nodes.values()];
  elements.edgeLayer.innerHTML = state.view.edges.map(edgeMarkup).join("");
  elements.nodeLayer.innerHTML = nodes.map(nodeMarkup).join("");

  state.nodeElements = new Map();
  for (const element of elements.nodeLayer.querySelectorAll(".node")) {
    state.nodeElements.set(element.dataset.id, element);
  }

  state.edgeElements = new Map();
  for (const element of elements.edgeLayer.querySelectorAll(".edge")) {
    state.edgeElements.set(element.dataset.id, {
      group: element,
      path: element.querySelector(".edge-path"),
      source: element.querySelector('[data-role="source"]'),
      target: element.querySelector('[data-role="target"]'),
      optional: element.querySelector('[data-role="optional"]')
    });
  }

  state.edgesByNode = new Map();
  state.relationById = new Map();
  for (const relation of state.view.edges) {
    state.relationById.set(relation.id, relation);
    for (const id of new Set([relation.from, relation.to])) {
      if (!state.edgesByNode.has(id)) state.edgesByNode.set(id, []);
      state.edgesByNode.get(id).push(relation);
    }
  }

  elements.diagramEmpty.hidden = nodes.length > 0;
  updateEmphasis();
}

function applyTransform() {
  const { scale, x, y } = state.transform;
  elements.viewport.setAttribute("transform", `translate(${x} ${y}) scale(${scale})`);
  elements.zoomLevel.textContent = `${Math.round(scale * 100)}%`;
}

function canvasSize() {
  const rect = elements.diagramCanvas.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
}

function fitToView() {
  const { width, height } = canvasSize();
  const contentWidth = state.view.width;
  const contentHeight = state.view.height;
  if (!contentWidth || !contentHeight || !width || !height) return;

  const padding = 44;
  const scale = clamp(
    Math.min((width - padding * 2) / contentWidth, (height - padding * 2) / contentHeight),
    MIN_SCALE,
    1.3
  );
  state.transform.scale = scale;
  state.transform.x = (width - contentWidth * scale) / 2;
  state.transform.y = (height - contentHeight * scale) / 2;
  applyTransform();
}

function zoomBy(factor) {
  const { width, height } = canvasSize();
  zoomAt(width / 2, height / 2, factor);
}

function zoomAt(pointX, pointY, factor) {
  const current = state.transform.scale;
  const next = clamp(current * factor, MIN_SCALE, MAX_SCALE);
  if (next === current) return;
  state.transform.x = pointX - (pointX - state.transform.x) * (next / current);
  state.transform.y = pointY - (pointY - state.transform.y) * (next / current);
  state.transform.scale = next;
  applyTransform();
}

function centerOnTable(id) {
  const node = state.view.nodes.get(id);
  if (!node) return;
  const { width, height } = canvasSize();
  const scale = state.transform.scale;
  state.transform.x = width / 2 - (node.x + node.width / 2) * scale;
  state.transform.y = height / 2 - (node.y + node.height / 2) * scale;
  applyTransform();
}

/* --------------------------------------------------------------- 강조 */

function relatedTableIds(id) {
  const related = new Set();
  for (const relation of state.edgesByNode?.get(id) || []) {
    related.add(relation.from);
    related.add(relation.to);
  }
  related.delete(id);
  return related;
}

function updateEmphasis() {
  const selected = state.selected;
  const related = selected ? relatedTableIds(selected) : new Set();
  const searching = state.matches.size > 0 || Boolean(elements.searchInput.value.trim());

  for (const [id, element] of state.nodeElements) {
    element.classList.toggle("selected", id === selected);
    element.classList.toggle("related", Boolean(selected) && related.has(id));
    element.classList.toggle("match", searching && state.matches.has(id));

    let dimmed = false;
    if (searching) dimmed = !state.matches.has(id);
    else if (selected) dimmed = id !== selected && !related.has(id);
    element.classList.toggle("dimmed", dimmed);
  }

  for (const [id, cached] of state.edgeElements) {
    const relation = state.relationById.get(id);
    if (!relation) continue;
    const touchesSelection = Boolean(selected) && (relation.from === selected || relation.to === selected);
    const touchesMatch = searching && (state.matches.has(relation.from) || state.matches.has(relation.to));

    cached.group.classList.toggle("active", touchesSelection);
    let dimmed = false;
    if (searching) dimmed = !touchesMatch;
    else if (selected) dimmed = !touchesSelection;
    cached.group.classList.toggle("dimmed", dimmed);
  }

  for (const item of elements.tableRail.querySelectorAll(".rail-item")) {
    const id = item.dataset.id;
    item.classList.toggle("selected", id === selected);
    item.classList.toggle("dimmed", searching && !state.matches.has(id));
  }
}

/* ------------------------------------------------------------- 사이드바 */

function renderRail() {
  const schema = state.schema;
  elements.railCount.textContent = schema ? String(schema.tables.length) : "0";

  if (!schema || !schema.tables.length) {
    elements.tableRail.innerHTML = `<li class="rail-empty">${escapeXml(t("rail.empty"))}</li>`;
    return;
  }

  const markup = schema.tables
    .map((table) => {
      const relationCount = table.outgoing.length + table.incoming.length;
      const flag = state.mode === "compare" ? `<i class="rail-flag ${table.diffStatus || ""}"></i>` : "";
      return (
        `<li><button class="rail-item" type="button" data-id="${escapeXml(table.id)}">` +
        `<strong>${flag}${escapeXml(table.name)}</strong>` +
        `<span>${escapeXml(t("rail.item", { columns: table.columns.length, relations: relationCount }))}</span>` +
        "</button></li>"
      );
    })
    .join("");

  elements.tableRail.innerHTML = markup;
}

/* --------------------------------------------------------------- 상세 */

function cardinalityLabel(relation) {
  return relation.identifying === "one" ? "1 : 1" : "N : 1";
}

function relationLineMarkup(relation, perspective) {
  const outgoing = relation.from === perspective;
  const other = outgoing ? relation.toTable : relation.fromTable;
  const own = outgoing ? relation.fromColumns : relation.toColumns;
  const target = outgoing ? relation.toColumns : relation.fromColumns;
  const arrow = outgoing ? "→" : "←";
  const actions = [relation.onDelete ? `ON DELETE ${relation.onDelete}` : "", relation.onUpdate ? `ON UPDATE ${relation.onUpdate}` : ""]
    .filter(Boolean)
    .join(" · ");

  return (
    '<div class="relation-line">' +
    `<span class="relation-tag ${relation.kind}">${escapeXml(relation.kind === "inferred" ? t("relation.inferred") : t("relation.fk"))}</span>` +
    `<b>${escapeXml(own.join(", "))}</b>` +
    `<em>${arrow}</em>` +
    `<button class="relation-link" type="button" data-goto="${escapeXml(other.id)}">${escapeXml(
      other.name
    )}.${escapeXml(target.join(", "))}</button>` +
    `<em>${cardinalityLabel(relation)}${relation.optional ? ` · ${escapeXml(t("relation.optional"))}` : ""}</em>` +
    (actions ? `<em>${escapeXml(actions)}</em>` : "") +
    "</div>"
  );
}

function renderDetail() {
  const schema = state.schema;
  const table = schema && state.selected ? schema.tables.find((item) => item.id === state.selected) : null;

  if (!table) {
    elements.detailEmpty.hidden = false;
    elements.detailBody.hidden = true;
    return;
  }

  elements.detailEmpty.hidden = true;
  elements.detailBody.hidden = false;
  elements.detailSchema.textContent = table.schema ? table.schema.toUpperCase() : t("detail.table");
  elements.detailName.textContent = table.name;
  elements.detailComment.textContent = table.comment || "";

  elements.detailColumnBody.innerHTML = table.columns
    .map((column) => {
      const chips = [];
      if (column.pk) chips.push('<span class="key-chip pk">PK</span>');
      if (column.fk) chips.push('<span class="key-chip fk">FK</span>');
      else if (column.inferredFk) chips.push('<span class="key-chip fk">FK?</span>');
      if (column.unique && !column.pk) chips.push('<span class="key-chip uq">UQ</span>');

      const flags = [];
      if (column.auto) flags.push("AUTO");
      if (column.generated) flags.push("GENERATED");

      return (
        "<tr>" +
        `<td>${chips.join("") || ""}</td>` +
        `<td>${escapeXml(column.name)}</td>` +
        `<td>${escapeXml(column.type || "—")}</td>` +
        `<td>${column.nullable ? "NULL" : "NOT NULL"}</td>` +
        `<td>${escapeXml(column.defaultValue || (flags.length ? flags.join(" ") : "—"))}</td>` +
        `<td>${escapeXml(column.comment || "")}</td>` +
        "</tr>"
      );
    })
    .join("");

  const lines = [
    ...table.outgoing.map((relation) => relationLineMarkup(relation, table.id)),
    ...table.incoming.map((relation) => relationLineMarkup(relation, table.id))
  ];
  elements.detailRelations.innerHTML = lines.length
    ? lines.join("")
    : `<div class="relation-line"><em>${escapeXml(t("detail.noRelations"))}</em></div>`;
}

function selectTable(id, options = {}) {
  state.selected = state.selected === id && !options.keep ? null : id;
  updateEmphasis();
  renderDetail();
  if (state.selected && options.center) centerOnTable(state.selected);
}

// 목록 자체만 스크롤한다. scrollIntoView 는 페이지까지 함께 움직인다.
function revealRailItem(id) {
  const item = elements.tableRail.querySelector(`.rail-item[data-id="${id}"]`);
  if (!item) return;

  const listRect = elements.tableRail.getBoundingClientRect();
  const itemRect = item.getBoundingClientRect();
  if (itemRect.top < listRect.top) {
    elements.tableRail.scrollTop -= listRect.top - itemRect.top;
  } else if (itemRect.bottom > listRect.bottom) {
    elements.tableRail.scrollTop += itemRect.bottom - listRect.bottom;
  }
}

function stepSelection(delta) {
  const tables = state.schema?.tables || [];
  if (!tables.length) return;

  const current = tables.findIndex((table) => table.id === state.selected);
  const next =
    current === -1
      ? delta > 0
        ? 0
        : tables.length - 1
      : (current + delta + tables.length) % tables.length;

  selectTable(tables[next].id, { keep: true, center: true });
  revealRailItem(tables[next].id);
}

/* --------------------------------------------------------------- 검색 */

function runSearch() {
  const query = elements.searchInput.value.trim().toLowerCase();
  state.matches = new Set();

  if (!query || !state.schema) {
    elements.searchPosition.textContent = "—";
    updateEmphasis();
    return [];
  }

  const hits = [];
  for (const table of state.schema.tables) {
    const inName = table.name.toLowerCase().includes(query) || table.qualified.toLowerCase().includes(query);
    const inColumn = table.columns.some((column) => column.name.toLowerCase().includes(query));
    if (inName || inColumn) {
      state.matches.add(table.id);
      hits.push(table.id);
    }
  }

  elements.searchPosition.textContent = hits.length ? t("search.hits", { count: hits.length }) : t("search.none");
  updateEmphasis();
  return hits;
}

/* --------------------------------------------------------------- 포인터 */

function pointInCanvas(event) {
  const rect = elements.diagramCanvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function onPointerDown(event) {
  if (event.button !== 0 && event.pointerType === "mouse") return;

  // 기본 동작을 막지 않으면 끌기 도중 노드 텍스트가 블록 선택된다.
  // 대신 포커스도 함께 막히므로 방향키 조작을 위해 직접 포커스를 준다.
  event.preventDefault();
  elements.diagramCanvas.focus({ preventScroll: true });

  const point = pointInCanvas(event);
  const nodeElement = event.target.closest?.(".node");

  if (nodeElement) {
    const node = state.view.nodes.get(nodeElement.dataset.id);
    if (!node) return;
    state.pointer = {
      mode: "node",
      id: nodeElement.dataset.id,
      element: nodeElement,
      startX: point.x,
      startY: point.y,
      originX: node.x,
      originY: node.y,
      moved: false
    };
    nodeElement.classList.add("dragging");
    elements.diagramCanvas.classList.add("dragging-node");
  } else {
    state.pointer = {
      mode: "pan",
      startX: point.x,
      startY: point.y,
      originX: state.transform.x,
      originY: state.transform.y,
      moved: false
    };
    elements.diagramCanvas.classList.add("panning");
  }

  elements.diagramCanvas.setPointerCapture(event.pointerId);
}

function onPointerMove(event) {
  const pointer = state.pointer;
  if (!pointer) return;

  const point = pointInCanvas(event);
  const dx = point.x - pointer.startX;
  const dy = point.y - pointer.startY;
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) pointer.moved = true;

  if (pointer.mode === "pan") {
    state.transform.x = pointer.originX + dx;
    state.transform.y = pointer.originY + dy;
    applyTransform();
    return;
  }

  const node = state.view.nodes.get(pointer.id);
  if (!node) return;
  node.x = pointer.originX + dx / state.transform.scale;
  node.y = pointer.originY + dy / state.transform.scale;
  pointer.element.setAttribute("transform", `translate(${node.x} ${node.y})`);

  for (const relation of state.edgesByNode?.get(pointer.id) || []) updateEdgeGeometry(relation);
}

function onPointerUp(event) {
  const pointer = state.pointer;
  if (!pointer) return;
  state.pointer = null;

  elements.diagramCanvas.classList.remove("panning", "dragging-node");
  pointer.element?.classList.remove("dragging");
  if (elements.diagramCanvas.hasPointerCapture(event.pointerId)) {
    elements.diagramCanvas.releasePointerCapture(event.pointerId);
  }

  if (pointer.moved) {
    if (pointer.mode === "node") recomputeContentBounds();
    return;
  }

  if (pointer.mode === "node") selectTable(pointer.id);
  else if (state.selected) selectTable(state.selected);
}

function recomputeContentBounds() {
  let width = 0;
  let height = 0;
  for (const node of state.view.nodes.values()) {
    width = Math.max(width, node.x + node.width);
    height = Math.max(height, node.y + node.height);
  }
  state.view.width = width;
  state.view.height = height;
}

function onWheel(event) {
  // Ctrl(맥은 Cmd·트랙패드 핀치)일 때만 확대하고, 그냥 휠은 페이지 스크롤로 넘긴다.
  if (!event.ctrlKey && !event.metaKey) return;

  event.preventDefault();
  const point = pointInCanvas(event);
  const factor = Math.exp(-event.deltaY * (event.deltaMode === 1 ? 0.03 : 0.0014));
  zoomAt(point.x, point.y, factor);
}

/* --------------------------------------------------------------- 내보내기 */

function themeValue(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function diffExportRules() {
  if (state.mode !== "compare") return [];

  const rules = [];
  for (const status of ["added", "changed", "removed"]) {
    const strong = themeValue(`--diff-${status}`, "#568900");
    const soft = themeValue(`--diff-${status}-soft`, "#e6f6cb");
    rules.push(`.node.diff-${status} .node-body{stroke:${strong};stroke-width:2.2}`);
    rules.push(`.node.diff-${status} .node-head{fill:${soft}}`);
    rules.push(`.row.diff-${status} .row-hit{fill:${soft}}`);
    rules.push(`.row-mark.${status}{fill:${strong};font:800 11px ${MONO_STACK}}`);
  }
  rules.push(".node.diff-removed .node-body{stroke-dasharray:7 4}");
  rules.push(".node.diff-removed .node-title,.node.diff-removed .row-name{text-decoration:line-through}");
  rules.push(".row.diff-removed .row-name{text-decoration:line-through}");
  return rules;
}

function exportStylesheet() {
  const dark = document.documentElement.dataset.theme === "dark";
  const relationColor = dark ? themeValue("--cyan", "#55cdbd") : "#1f8d7d";

  return [
    `.node-body{fill:${themeValue("--surface", "#fbfaf6")};stroke:${themeValue("--line-strong", "#9d9e96")};stroke-width:1.5}`,
    `.node-head{fill:${themeValue("--surface-2", "#e9e5da")}}`,
    `.node-divider{stroke:${themeValue("--line", "#cbc8bd")};stroke-width:1}`,
    `.node-title{fill:${themeValue("--ink", "#191b18")};font:${FONT_TITLE}}`,
    `.node-schema{fill:${themeValue("--muted", "#696b64")};font:${FONT_SCHEMA}}`,
    `.node-count{fill:${themeValue("--muted", "#696b64")};font:${FONT_COUNT};text-anchor:end}`,
    `.row-name{fill:${themeValue("--ink", "#191b18")};font:${FONT_ROW}}`,
    `.row-name.is-key{font:${FONT_ROW_KEY}}`,
    `.row-type{fill:${themeValue("--muted", "#696b64")};font:${FONT_SIDE};text-anchor:end}`,
    `.row-more{fill:${themeValue("--muted", "#696b64")};font:${FONT_COUNT}}`,
    ".row-hit{fill:transparent}",
    `.badge-box.pk{fill:${themeValue("--amber", "#f4c753")}}`,
    `.badge-box.fk{fill:${themeValue("--cyan", "#55cdbd")}}`,
    `.badge-box.uq{fill:${themeValue("--violet", "#8a7bd8")}}`,
    `.badge-text{font:800 7.5px ${MONO_STACK};text-anchor:middle}`,
    ".badge-text.pk{fill:#4a3800}",
    ".badge-text.fk{fill:#0d3d36}",
    ".badge-text.uq{fill:#ffffff}",
    `.edge-path{fill:none;stroke:${relationColor};stroke-width:1.6}`,
    `.edge-marker{fill:none;stroke:${relationColor};stroke-width:1.6;stroke-linecap:round}`,
    `.edge-marker.optional{fill:${themeValue("--paper", "#f2efe7")}}`,
    `.edge.inferred .edge-path{stroke:${themeValue("--violet", "#8a7bd8")};stroke-dasharray:6 4}`,
    `.edge.inferred .edge-marker{stroke:${themeValue("--violet", "#8a7bd8")}}`,
    ...diffExportRules()
  ].join("");
}

function buildExportSvg() {
  const padding = 40;
  const width = Math.ceil(state.view.width + padding * 2);
  const height = Math.ceil(state.view.height + padding * 2);

  const clone = elements.diagramSvg.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.setAttribute("viewBox", `0 0 ${width} ${height}`);
  clone.removeAttribute("style");

  const viewport = clone.querySelector("#viewport");
  viewport.setAttribute("transform", `translate(${padding} ${padding})`);

  for (const element of clone.querySelectorAll(".dimmed, .selected, .related, .match, .active")) {
    element.classList.remove("dimmed", "selected", "related", "match", "active");
  }

  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = exportStylesheet();
  clone.insertBefore(style, clone.firstChild);

  const background = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  background.setAttribute("x", "0");
  background.setAttribute("y", "0");
  background.setAttribute("width", String(width));
  background.setAttribute("height", String(height));
  background.setAttribute("fill", themeValue("--paper", "#f2efe7"));
  clone.insertBefore(background, viewport);

  return { markup: new XMLSerializer().serializeToString(clone), width, height };
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function stripExtension(name, fallback) {
  return String(name || "").replace(/\.[^.]+$/, "") || fallback;
}

function baseFileName() {
  const source = stripExtension(state.sourceName, "schema");
  if (state.mode !== "compare") return source;
  return `${source}-vs-${stripExtension(state.targetName, "target")}`;
}

function exportSvg() {
  if (!state.view.nodes.size) {
    showToast(t("toast.noDiagram"));
    return;
  }
  const { markup } = buildExportSvg();
  downloadBlob(new Blob([markup], { type: "image/svg+xml;charset=utf-8" }), `${baseFileName()}-diagram.svg`);
  showToast(t("toast.svgSaved"));
}

function exportPng() {
  if (!state.view.nodes.size) {
    showToast(t("toast.noDiagram"));
    return;
  }

  const { markup, width, height } = buildExportSvg();
  const scale = clamp(2, 1, Math.max(1, Math.floor(4096 / Math.max(width, height))) || 1);
  const image = new Image();
  const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml;charset=utf-8" }));

  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext("2d");
    context.fillStyle = themeValue("--paper", "#f2efe7");
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);

    canvas.toBlob((blob) => {
      if (!blob) {
        showToast(t("toast.pngFailed"));
        return;
      }
      downloadBlob(blob, `${baseFileName()}-diagram.png`);
      showToast(t("toast.pngSaved"));
    }, "image/png");
  };

  image.onerror = () => {
    URL.revokeObjectURL(url);
    showToast(t("toast.pngFailed"));
  };

  image.src = url;
}

function copyRelations() {
  const schema = state.schema;
  if (!schema || !schema.relations.length) {
    showToast(t("toast.noRelations"));
    return;
  }

  const lines = schema.relations.map((relation) => {
    const kind = relation.kind === "inferred" ? t("relation.inferred") : t("relation.fk");
    const actions = [relation.onDelete ? `ON DELETE ${relation.onDelete}` : "", relation.onUpdate ? `ON UPDATE ${relation.onUpdate}` : ""]
      .filter(Boolean)
      .join(" ");
    return [
      kind,
      `${relation.fromTable.qualified}(${relation.fromColumns.join(", ")})`,
      "->",
      `${relation.toTable.qualified}(${relation.toColumns.join(", ")})`,
      cardinalityLabel(relation),
      actions
    ]
      .filter(Boolean)
      .join("\t");
  });

  const text = `${t("copy.relationsHeader", { tables: schema.tables.length, relations: schema.relations.length })}\n${lines.join("\n")}\n`;

  navigator.clipboard
    ?.writeText(text)
    .then(() => showToast(t("toast.relationsCopied", { count: schema.relations.length })))
    .catch(() => showToast(t("toast.clipboardBlocked")));
}

/* --------------------------------------------------------------- 파이프라인 */

function schemaMessages(schema, prefix) {
  const tag = prefix ? `${prefix} · ` : "";
  return [
    ...schema.warnings.map((message) => `${tag}${message}`),
    ...schema.unresolved.map(
      (entry) => `${tag}${t("warn.unresolved", { from: entry.from, target: entry.target })}`
    )
  ];
}

function showWarnings(messages) {
  if (!messages.length) {
    elements.warningBox.hidden = true;
    elements.warningList.innerHTML = "";
    return;
  }

  const shown = messages.slice(0, 6);
  elements.warningList.innerHTML = shown.map((message) => `<li>${escapeXml(message)}</li>`).join("");
  if (messages.length > shown.length) {
    elements.warningList.insertAdjacentHTML("beforeend", `<li>${escapeXml(t("warn.more", { count: messages.length - shown.length }))}</li>`);
  }
  elements.warningBox.hidden = false;
}

// 통계 칸은 모드에 따라 다른 값을 담는다. 라벨과 설명도 함께 바꾼다.
function setStat(target, label, value, note) {
  const cell = target.closest(".stat-cell");
  cell.querySelector("span").textContent = label;
  cell.querySelector("small").textContent = note;
  target.textContent = String(value);
}

function updateStats(schema) {
  const stats = schema.stats;
  setStat(elements.tableStat, t("stat.tables"), stats.tableCount, t("stat.tables.note"));
  setStat(elements.columnStat, t("stat.columns"), stats.columnCount, t("stat.columns.note"));
  setStat(elements.explicitStat, t("stat.explicit"), stats.relationCount - stats.inferredCount, t("stat.explicit.note"));
  setStat(elements.inferredStat, t("stat.inferred"), stats.inferredCount, t("stat.inferred.note"));
  setStat(elements.isolatedStat, t("stat.isolated"), stats.isolatedCount, t("stat.isolated.note"));

  const empty = stats.tableCount === 0;
  elements.resultState.classList.toggle("empty", empty);
  elements.resultStateText.textContent = empty
    ? t("state.empty")
    : t("state.summary", { tables: stats.tableCount, relations: stats.relationCount });
}

function updateCompareStats(diff) {
  const stats = diff.stats;
  const columnChanges = stats.addedColumns + stats.removedColumns + stats.changedColumns;

  setStat(elements.tableStat, t("stat.tables"), diff.tables.length, t("stat.diff.tables.note"));
  setStat(elements.columnStat, t("stat.diff.columns"), columnChanges, `+${stats.addedColumns} −${stats.removedColumns} ~${stats.changedColumns}`);
  setStat(elements.explicitStat, t("stat.diff.added"), stats.addedTables, t("stat.diff.added.note"));
  setStat(elements.inferredStat, t("stat.diff.changed"), stats.changedTables, t("stat.diff.changed.note"));
  setStat(elements.isolatedStat, t("stat.diff.removed"), stats.removedTables, t("stat.diff.removed.note"));

  elements.resultState.classList.toggle("empty", diff.identical);
  elements.resultStateText.textContent = diff.identical
    ? t("state.identical")
    : t("state.diffSummary", { added: stats.addedTables, removed: stats.removedTables, changed: stats.changedTables });
}

/* ------------------------------------------------------- 비교 결과 조립 */

/* 삭제된 컬럼은 TARGET 에 없으므로 원래 자리 근처에 다시 끼워 넣는다.
 * 그래야 다이어그램에서 무엇이 빠졌는지 위치로 알아볼 수 있다. */
function mergeDiffColumns(entry) {
  const merged = entry.columns
    .filter((column) => column.status !== "removed")
    .map((column) => ({ ...column.target, diffStatus: column.status === "same" ? null : column.status }));

  const removed = entry.columns
    .filter((column) => column.status === "removed")
    .sort((a, b) => a.sourceIndex - b.sourceIndex);
  const sourceNames = entry.source ? entry.source.columns.map((column) => column.name.toLowerCase()) : [];

  for (const column of removed) {
    let at = 0;
    for (let i = column.sourceIndex - 1; i >= 0; i -= 1) {
      const found = merged.findIndex((item) => item.name.toLowerCase() === sourceNames[i]);
      if (found !== -1) {
        at = found + 1;
        break;
      }
    }
    merged.splice(at, 0, { ...column.source, diffStatus: "removed" });
  }
  return merged;
}

/* TARGET 스키마를 그리되 삭제된 테이블을 함께 얹는다.
 * 삭제된 테이블의 관계는 이미 사라진 것이므로 선을 잇지 않는다. */
function buildCompareSchema(diff, targetSchema) {
  const tables = [];
  let goneIndex = 0;

  for (const entry of diff.tables) {
    if (entry.status === "removed") {
      const clone = {
        ...entry.source,
        id: `gone${goneIndex++}`,
        columns: mergeDiffColumns(entry),
        outgoing: [],
        incoming: [],
        diffStatus: "removed"
      };
      entry.displayId = clone.id;
      tables.push(clone);
      continue;
    }

    const clone = {
      ...entry.target,
      columns: mergeDiffColumns(entry),
      diffStatus: entry.status === "same" ? null : entry.status
    };
    entry.displayId = clone.id;
    tables.push(clone);
  }

  return {
    tables,
    relations: targetSchema.relations,
    warnings: [],
    unresolved: [],
    truncated: targetSchema.truncated,
    stats: targetSchema.stats
  };
}

/* --------------------------------------------------------- 변경 목록 */

function columnSummary(column) {
  const parts = [column.type || "—"];
  if (!column.nullable) parts.push("NOT NULL");
  if (column.defaultValue) parts.push(`DEFAULT ${column.defaultValue}`);
  if (column.auto) parts.push("AUTO");
  return parts.join(" ");
}

function relationSummary(relation) {
  return `${relation.fromColumns.join(", ")} → ${relation.toTable.name}(${relation.toColumns.join(", ")})`;
}

function tableChangeLines(entry) {
  const lines = [];
  const push = (status, body) => lines.push(`<li class="${status}"><i>${DIFF_MARKS[status]}</i>${body}</li>`);
  const named = (name) => `<b>${escapeXml(name)}</b>`;
  const note = (text) => `<span>${escapeXml(text)}</span>`;

  if (entry.status === "added" || entry.status === "removed") {
    const table = entry.status === "added" ? entry.target : entry.source;
    for (const column of table.columns) {
      const label = entry.status === "added" ? named(column.name) : `<s>${escapeXml(column.name)}</s>`;
      push(entry.status, `${label} ${note(columnSummary(column))}`);
    }
    return lines;
  }

  for (const column of entry.columns) {
    if (column.status === "added") push("added", `${named(column.name)} ${note(columnSummary(column.target))}`);
    else if (column.status === "removed") {
      push("removed", `<s>${escapeXml(column.name)}</s> ${note(columnSummary(column.source))}`);
    } else if (column.status === "changed") {
      const detail = column.changes.map((change) => `${change.label} ${change.from || "—"} → ${change.to || "—"}`).join(" · ");
      push("changed", `${named(column.name)} ${note(detail)}`);
    }
  }

  if (entry.pk) {
    push("changed", `${named(t("change.pk"))} ${note(`(${entry.pk.from.join(", ") || "—"}) → (${entry.pk.to.join(", ") || "—"})`)}`);
  }
  for (const unique of entry.uniques) {
    push(unique.status, `${named(t("change.unique"))} ${note(`(${unique.columns.join(", ")})`)}`);
  }
  for (const index of entry.indexes) {
    push(index.status, `${named(t("change.index"))} ${note(`(${index.columns.join(", ")})`)}`);
  }
  for (const relation of entry.relations) {
    const model = relation.target || relation.source;
    const extra = relation.status === "changed" ? ` · ${relation.changes[0].to}` : "";
    push(relation.status, `${named(t("change.fk"))} ${note(relationSummary(model) + extra)}`);
  }
  if (entry.comment) {
    push("changed", `${named(t("change.tableComment"))} ${note(`${entry.comment.from || "—"} → ${entry.comment.to || "—"}`)}`);
  }
  return lines;
}

const changeFlag = (status) => t(`change.flag.${status}`);
const MAX_CHANGE_LINES = 14;

function renderChangeList() {
  const diff = state.diff;
  if (!diff) return;

  // 바뀐 테이블을 먼저 보여주고 그대로인 테이블은 뒤로 민다.
  const ordered = [...diff.tables].sort((a, b) => (a.status === "same" ? 1 : 0) - (b.status === "same" ? 1 : 0));
  const entries = elements.hideSameTables.checked ? ordered.filter((entry) => entry.status !== "same") : ordered;

  if (!entries.length) {
    elements.changeList.innerHTML = `<div class="change-empty">${
      escapeXml(diff.tables.length ? t("change.empty.noChanges") : t("change.empty.noTables"))
    }</div>`;
    return;
  }

  elements.changeList.innerHTML = entries
    .map((entry) => {
      const lines = tableChangeLines(entry);
      const shown = lines.slice(0, MAX_CHANGE_LINES);
      if (lines.length > shown.length) {
        shown.push(`<li><i></i><span>${escapeXml(t("change.more", { count: lines.length - shown.length }))}</span></li>`);
      }

      const table = entry.target || entry.source;
      const summary =
        entry.status === "changed"
          ? t("change.count", { count: entry.changeCount })
          : t("change.columns", { count: table.columns.length });

      return (
        `<article class="change-table ${entry.status}">` +
        `<button class="change-head" type="button" data-id="${escapeXml(entry.displayId || "")}">` +
        `<span class="change-flag">${escapeXml(changeFlag(entry.status))}</span>` +
        `<strong>${escapeXml(entry.qualified)}</strong>` +
        `<em>${summary}</em>` +
        "</button>" +
        (shown.length ? `<ul class="change-lines">${shown.join("")}</ul>` : "") +
        "</article>"
      );
    })
    .join("");
}

/* ------------------------------------------------------ 마이그레이션 */

function renderMigration() {
  const result = DBSchemaDdl.generate(state.diff, state.dialect);
  state.migration = result;

  elements.migrationScript.textContent = result.sql;
  elements.scriptMeta.textContent = result.statementCount
    ? t("report.statements", { count: result.statementCount })
    : t("report.noStatements");

  if (result.notes.length) {
    elements.scriptNoteList.innerHTML = result.notes.map((note) => `<li>${escapeXml(note)}</li>`).join("");
    elements.scriptNotes.hidden = false;
  } else {
    elements.scriptNoteList.innerHTML = "";
    elements.scriptNotes.hidden = true;
  }
}

/* --------------------------------------------------------------- 파이프라인 */

function parseInput(text) {
  return DBSchemaParser.parseSchema(text, { inferRelations: elements.inferRelations.checked });
}

function updatePanelMeta(panel, tableCount) {
  const name = state[panel.stateKey];
  panel.metaLabel.textContent = tableCount
    ? t(name === panel.sampleName ? "panel.meta.sample" : "panel.meta.tables", { count: tableCount })
    : t("panel.meta.empty");
}

function renderSingle(options) {
  const schema = parseInput(elements.ddlText.value);

  state.schema = schema;
  state.diff = null;
  state.migration = null;
  if (state.selected && !schema.tables.some((table) => table.id === state.selected)) state.selected = null;

  updateStats(schema);
  showWarnings(schemaMessages(schema, ""));
  updatePanelMeta(panels.source, schema.stats.tableCount);
  renderRail();
  buildView(false);
  paint();
  runSearch();
  renderDetail();
  if (!options.keepTransform) fitToView();
}

function renderCompare(options) {
  const sourceSchema = parseInput(elements.ddlText.value);
  const targetSchema = parseInput(elements.ddlTextB.value);
  const diff = DBSchemaDiff.compare(sourceSchema, targetSchema);

  state.diff = diff;
  state.schema = buildCompareSchema(diff, targetSchema);
  if (state.selected && !state.schema.tables.some((table) => table.id === state.selected)) state.selected = null;

  updateCompareStats(diff);
  showWarnings([...schemaMessages(sourceSchema, "SOURCE"), ...schemaMessages(targetSchema, "TARGET")]);
  updatePanelMeta(panels.source, sourceSchema.stats.tableCount);
  updatePanelMeta(panels.target, targetSchema.stats.tableCount);
  renderRail();
  buildView(false);
  paint();
  runSearch();
  renderDetail();
  renderChangeList();
  renderMigration();
  if (!options.keepTransform) fitToView();
}

function renderAll(options = {}) {
  if (state.mode === "compare") renderCompare(options);
  else renderSingle(options);
}

function refreshDisplay() {
  if (!state.schema) return;
  buildView(true);
  paint();
  renderDetail();
}

/* --------------------------------------------------------------- 입력 */

const panels = {
  source: {
    stateKey: "sourceName",
    sampleName: "shop-schema.sql",
    emptyName: "untitled.sql",
    sample: () => t("sample.v1"),
    textarea: elements.ddlText,
    dropzone: elements.ddlDropzone,
    fileInput: elements.ddlFileInput,
    nameLabel: elements.sourceName,
    metaLabel: elements.sourceMeta
  },
  target: {
    stateKey: "targetName",
    sampleName: "shop-schema-v2.sql",
    emptyName: "untitled-v2.sql",
    sample: () => t("sample.v2"),
    textarea: elements.ddlTextB,
    dropzone: elements.ddlDropzoneB,
    fileInput: elements.ddlFileInputB,
    nameLabel: elements.targetName,
    metaLabel: elements.targetMeta
  }
};

function loadText(panel, text, name) {
  panel.textarea.value = text;
  state[panel.stateKey] = name;
  panel.nameLabel.textContent = name;
  state.selected = null;
  elements.searchInput.value = "";
  renderAll();
}

// BOM 이 있으면 그대로 따르고, 없으면 UTF-8 로 읽는다.
function decodeText(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(bytes.subarray(3));
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  }
  return new TextDecoder("utf-8").decode(bytes);
}

// 디코딩 결과로 판단한다. 바이트로 보면 UTF-16 SQL 이 NUL 때문에 바이너리로 걸린다.
function looksBinary(text) {
  const sample = text.slice(0, 4096);
  if (!sample) return false;
  if (sample.includes("\u0000")) return true;

  let broken = 0;
  for (const character of sample) {
    if (character === "\ufffd") broken += 1;
  }
  return broken > sample.length * 0.05;
}

function loadSqliteFile(panel, bytes, name, clipped) {
  const result = DBSchemaSqlite.readSchema(bytes);

  if (!result.ok) {
    showToast(
      result.reason === "bad-page-size"
        ? t("toast.sqliteBroken")
        : t("toast.sqliteNotRecognized")
    );
    return;
  }

  loadText(panel, result.sql, name);

  if (clipped && result.truncated) {
    showToast(t("toast.sqliteClipped", { mb: MAX_SQLITE_BYTES / 1024 / 1024 }));
  }
  if (!result.tableCount) {
    showToast(t("toast.sqliteNoTables"));
    return;
  }
  showToast(
    t("toast.sqliteLoaded", {
      tables: result.tableCount,
      indexes: result.indexCount ? t("toast.sqliteIndexes", { count: result.indexCount }) : ""
    })
  );
}

function readBytes(blob, onDone) {
  const reader = new FileReader();
  reader.onload = () => onDone(new Uint8Array(reader.result || new ArrayBuffer(0)));
  reader.onerror = () => showToast(t("toast.readFailed"));
  reader.readAsArrayBuffer(blob);
}

function readFile(panel, file) {
  if (!file) return;

  // 앞 100바이트로 형식을 먼저 가려낸다. .db 는 텍스트보다 훨씬 클 수 있다.
  readBytes(file.slice(0, 100), (head) => {
    if (DBSchemaSqlite.isSqliteFile(head)) {
      const limit = Math.min(file.size, MAX_SQLITE_BYTES);
      readBytes(file.slice(0, limit), (bytes) => loadSqliteFile(panel, bytes, file.name, file.size > limit));
      return;
    }

    if (file.size > MAX_TEXT_BYTES) {
      showToast(t("toast.fileTooLarge", { mb: MAX_TEXT_BYTES / 1024 / 1024 }));
      return;
    }

    readBytes(file, (bytes) => {
      const text = decodeText(bytes);
      if (looksBinary(text)) {
        showToast(t("toast.notText"));
        return;
      }
      loadText(panel, text, file.name);
    });
  });
}

/* 비교 모드에서 파일 두 개를 한 번에 놓으면 SOURCE 와 TARGET 으로 나눠 담는다. */
function readDroppedFiles(panel, files) {
  const list = [...(files || [])];
  if (!list.length) return;

  if (list.length > 1) {
    if (state.mode === "compare") {
      readFile(panels.source, list[0]);
      readFile(panels.target, list[1]);
      return;
    }
    // 단일 모드에서 조용히 하나만 읽으면 나머지가 어디 갔는지 알 수 없다.
    showToast(t("toast.singleModeDrop"));
  }
  readFile(panel, list[0]);
}

function showToast(message) {
  window.clearTimeout(state.toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  state.toastTimer = window.setTimeout(() => elements.toast.classList.remove("show"), 2400);
}

/* --------------------------------------------------------------- 테마 */

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  elements.themeButton.setAttribute("aria-label", t(theme === "dark" ? "header.themeToLight" : "header.themeToDark"));
  try {
    localStorage.setItem("dbschemaview-theme", theme);
  } catch (error) {
    // 저장이 막힌 환경에서는 이번 세션에만 적용한다.
  }
}

function initTheme() {
  let saved = null;
  try {
    saved = localStorage.getItem("dbschemaview-theme");
  } catch (error) {
    saved = null;
  }
  if (saved === "dark" || saved === "light") {
    setTheme(saved);
    return;
  }
  setTheme(window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light");
}

/* --------------------------------------------------------------- 모드 */

function applyMode() {
  const compare = state.mode === "compare";

  elements.inputGrid.classList.toggle("compare", compare);
  elements.ddlDropzoneB.hidden = !compare;
  elements.swapButton.hidden = !compare;
  elements.dialectField.hidden = !compare;
  elements.compareReport.hidden = !compare;
  elements.diffLegend.hidden = !compare;
  elements.diagramCanvas.classList.toggle("compare", compare);

  // 모드마다 달라지는 글은 여기서 한 번에 갈아 끼운다. 언어를 바꿔도 이 함수를 다시 부른다.
  const mode = state.mode;
  elements.sourceLabel.textContent = t(`panel.source.${mode}`);
  elements.sourceDropHint.textContent = t(`drop.${mode}.hint`);
  elements.sourceDropTitle.textContent = t(`drop.${mode}.title`);
  elements.sourceDropNote.textContent = t(`drop.${mode}.note`);
  elements.renderButtonLabel.textContent = t(`action.render.${mode}`);
  elements.resultsEyebrow.textContent = t(`results.eyebrow.${mode}`);
  elements.resultsTitle.textContent = t(`results.title.${mode}`);
  elements.resultFootnote.textContent = t(`footer.note.${mode}`);
  elements.modeNote.textContent = t(`mode.note.${mode}`);
  elements.heroCopy.textContent = t(`hero.copy.${mode}`);

  // 비교 모드에서는 03 을 마이그레이션 구역이 쓰므로 특징 구역을 04 로 민다.
  elements.focusStep.textContent = compare ? "04" : "03";

  for (const button of document.querySelectorAll("[data-mode]")) {
    const on = button.dataset.mode === state.mode;
    button.classList.toggle("active", on);
    button.setAttribute("aria-pressed", String(on));
  }
}

function setMode(mode) {
  if (state.mode === mode) return;
  state.mode = mode;
  state.selected = null;
  applyMode();

  // 샘플을 그대로 두고 비교로 넘어오면 비교용 샘플을 채워 바로 결과를 보여준다.
  if (mode === "compare" && !elements.ddlTextB.value.trim() && elements.ddlText.value === t("sample.v1")) {
    elements.ddlTextB.value = t("sample.v2");
  }

  renderAll();
}

/* 마이그레이션 방향을 뒤집는다. 어느 쪽이 기준인지 헷갈릴 때 되돌리기가 쉬워야 한다. */
function swapPanels() {
  const sourceText = elements.ddlText.value;
  const sourceName = state.sourceName;

  elements.ddlText.value = elements.ddlTextB.value;
  elements.ddlTextB.value = sourceText;
  state.sourceName = state.targetName;
  state.targetName = sourceName;
  elements.sourceName.textContent = state.sourceName;
  elements.targetName.textContent = state.targetName;

  state.selected = null;
  renderAll();
  showToast(t("toast.swapped", { source: state.sourceName, target: state.targetName }));
}

/* ------------------------------------------------------- 비교 내보내기 */

function csvCell(value) {
  const text = String(value == null ? "" : value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function changeRows() {
  const rows = [[t("csv.kind"), t("csv.table"), t("csv.target"), t("csv.item"), t("csv.before"), t("csv.after")]];

  for (const entry of state.diff.tables) {
    if (entry.status === "same") continue;
    const name = entry.qualified;

    if (entry.status !== "changed") {
      const table = entry.target || entry.source;
      rows.push([changeFlag(entry.status), name, t("csv.tableRow"), t("csv.columnCount", { count: table.columns.length }), "", ""]);
      continue;
    }

    for (const column of entry.columns) {
      if (column.status === "same") continue;
      if (column.status === "changed") {
        for (const change of column.changes) {
          rows.push([changeFlag("changed"), name, t("csv.columnRow", { name: column.name }), change.label, change.from, change.to]);
        }
        continue;
      }
      const model = column.target || column.source;
      rows.push([changeFlag(column.status), name, t("csv.columnRow", { name: column.name }), columnSummary(model), "", ""]);
    }

    if (entry.pk) rows.push([changeFlag("changed"), name, t("csv.pk"), "PRIMARY KEY", entry.pk.from.join(" "), entry.pk.to.join(" ")]);
    for (const unique of entry.uniques) {
      rows.push([changeFlag(unique.status), name, t("csv.unique"), unique.columns.join(" "), "", ""]);
    }
    for (const index of entry.indexes) {
      rows.push([changeFlag(index.status), name, t("csv.index"), index.columns.join(" "), "", ""]);
    }
    for (const relation of entry.relations) {
      const model = relation.target || relation.source;
      const change = relation.changes[0];
      rows.push([
        changeFlag(relation.status),
        name,
        t("csv.fk"),
        relationSummary(model),
        change ? change.from : "",
        change ? change.to : ""
      ]);
    }
    if (entry.comment) rows.push([changeFlag("changed"), name, t("csv.comment"), "COMMENT", entry.comment.from, entry.comment.to]);
  }

  return rows;
}

function copyChanges() {
  if (!state.diff || state.diff.identical) {
    showToast(t("toast.noChanges"));
    return;
  }

  const rows = changeRows();
  const text = rows.map((row) => row.map(csvCell).join(",")).join("\n");

  navigator.clipboard
    ?.writeText(`${text}\n`)
    .then(() => showToast(t("toast.changesCopied", { count: rows.length - 1 })))
    .catch(() => showToast(t("toast.clipboardBlocked")));
}

function copyScript() {
  if (!state.migration) return;
  navigator.clipboard
    ?.writeText(state.migration.sql)
    .then(() => showToast(t("toast.scriptCopied")))
    .catch(() => showToast(t("toast.clipboardBlocked")));
}

function saveScript() {
  if (!state.migration) return;
  const source = stripExtension(state.sourceName, "source");
  const target = stripExtension(state.targetName, "target");
  downloadBlob(
    new Blob([state.migration.sql], { type: "text/plain;charset=utf-8" }),
    `${source}-to-${target}.${state.dialect}.sql`
  );
  showToast(t("toast.scriptSaved"));
}

/* --------------------------------------------------------------- 바인딩 */

function bindPanel(panel) {
  panel.fileInput.addEventListener("change", (event) => {
    readFile(panel, event.target.files?.[0]);
    event.target.value = "";
  });

  let dragDepth = 0;

  panel.dropzone.addEventListener("dragenter", (event) => {
    event.preventDefault();
    dragDepth += 1;
    panel.dropzone.classList.add("dragging");
  });

  panel.dropzone.addEventListener("dragover", (event) => event.preventDefault());

  panel.dropzone.addEventListener("dragleave", () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) panel.dropzone.classList.remove("dragging");
  });

  panel.dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    dragDepth = 0;
    panel.dropzone.classList.remove("dragging");
    readDroppedFiles(panel, event.dataTransfer?.files);
  });
}

function bindEvents() {
  elements.renderButton.addEventListener("click", () => renderAll());

  for (const button of document.querySelectorAll("[data-mode]")) {
    button.addEventListener("click", () => setMode(button.dataset.mode));
  }

  for (const button of document.querySelectorAll("[data-lang]")) {
    button.addEventListener("click", () => setLanguage(button.dataset.lang));
  }

  for (const [panel, sampleButton, clearButton] of [
    [panels.source, elements.sampleButton, elements.clearButton],
    [panels.target, elements.sampleButtonB, elements.clearButtonB]
  ]) {
    bindPanel(panel);
    sampleButton.addEventListener("click", () => loadText(panel, panel.sample(), panel.sampleName));
    clearButton.addEventListener("click", () => {
      loadText(panel, "", panel.emptyName);
      panel.textarea.focus();
    });
  }

  elements.swapButton.addEventListener("click", swapPanels);

  elements.dialectSelect.addEventListener("change", () => {
    state.dialect = elements.dialectSelect.value;
    if (state.diff) renderMigration();
  });

  elements.hideSameTables.addEventListener("change", renderChangeList);

  elements.changeList.addEventListener("click", (event) => {
    const button = event.target.closest(".change-head");
    if (!button || !button.dataset.id) return;
    selectTable(button.dataset.id, { keep: true, center: true });
    elements.diagramCanvas.scrollIntoView({ block: "nearest", behavior: "smooth" });
  });

  elements.copyChangesButton.addEventListener("click", copyChanges);
  elements.copyScriptButton.addEventListener("click", copyScript);
  elements.saveScriptButton.addEventListener("click", saveScript);

  elements.inferRelations.addEventListener("change", () => renderAll());
  elements.showTypes.addEventListener("change", refreshDisplay);
  elements.showComments.addEventListener("change", refreshDisplay);

  for (const button of document.querySelectorAll("[data-columns]")) {
    button.addEventListener("click", () => {
      if (state.columnMode === button.dataset.columns) return;
      state.columnMode = button.dataset.columns;
      for (const sibling of document.querySelectorAll("[data-columns]")) {
        sibling.classList.toggle("active", sibling === button);
      }
      refreshDisplay();
    });
  }

  elements.searchInput.addEventListener("input", () => runSearch());
  elements.searchInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const hits = runSearch();
    if (hits.length) {
      state.selected = hits[0];
      updateEmphasis();
      renderDetail();
      centerOnTable(hits[0]);
    }
  });

  elements.zoomInButton.addEventListener("click", () => zoomBy(1.2));
  elements.zoomOutButton.addEventListener("click", () => zoomBy(1 / 1.2));
  elements.fitButton.addEventListener("click", fitToView);
  elements.relayoutButton.addEventListener("click", () => {
    buildView(false);
    paint();
    fitToView();
    showToast(t("toast.relayout"));
  });

  elements.diagramCanvas.addEventListener("pointerdown", onPointerDown);
  elements.diagramCanvas.addEventListener("pointermove", onPointerMove);
  elements.diagramCanvas.addEventListener("pointerup", onPointerUp);
  elements.diagramCanvas.addEventListener("pointercancel", onPointerUp);
  elements.diagramCanvas.addEventListener("wheel", onWheel, { passive: false });
  elements.diagramCanvas.addEventListener("contextmenu", (event) => event.preventDefault());

  elements.tableRail.addEventListener("click", (event) => {
    const button = event.target.closest(".rail-item");
    if (!button) return;
    selectTable(button.dataset.id, { keep: true, center: true });
  });

  elements.detailRelations.addEventListener("click", (event) => {
    const button = event.target.closest("[data-goto]");
    if (!button) return;
    selectTable(button.dataset.goto, { keep: true, center: true });
  });

  elements.detailCloseButton.addEventListener("click", () => {
    state.selected = null;
    updateEmphasis();
    renderDetail();
  });

  elements.copyButton.addEventListener("click", copyRelations);
  elements.exportSvgButton.addEventListener("click", exportSvg);
  elements.exportPngButton.addEventListener("click", exportPng);

  elements.themeButton.addEventListener("click", () => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  });

  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      renderAll();
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      // 다이어그램이나 테이블 목록에 포커스가 있을 때만 가로챈다.
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const active = document.activeElement;
      if (!elements.diagramCanvas.contains(active) && !elements.tableRail.contains(active)) return;
      event.preventDefault();
      stepSelection(event.key === "ArrowDown" ? 1 : -1);
      return;
    }

    if (event.key === "Escape" && state.selected) {
      state.selected = null;
      updateEmphasis();
      renderDetail();
    }
  });

  window.addEventListener("resize", () => {
    applyTransform();
  });
}

function initDialects() {
  elements.dialectSelect.innerHTML = DBSchemaDdl.DIALECTS.map(
    (dialect) => `<option value="${dialect.id}">${escapeXml(DBSchemaDdl.dialectLabel(dialect))}</option>`
  ).join("");
  elements.dialectSelect.value = state.dialect;
}

/* --------------------------------------------------------------- 언어 */

function applyLanguage() {
  const lang = DBSchemaI18n.getLang();
  document.documentElement.lang = lang;
  document.title = t("meta.title");

  DBSchemaI18n.applyStatic();
  initDialects();
  applyMode();
  setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");

  for (const button of document.querySelectorAll("[data-lang]")) {
    const on = button.dataset.lang === lang;
    button.classList.toggle("active", on);
    button.setAttribute("aria-pressed", String(on));
  }
}

/* 화면에 남아 있는 것이 그 언어의 샘플뿐이라면 새 언어의 샘플로 바꿔 준다.
 * 직접 붙여넣은 스키마는 건드리지 않는다. */
function swapSampleText(before) {
  for (const [panel, key] of [
    [panels.source, "sample.v1"],
    [panels.target, "sample.v2"]
  ]) {
    if (panel.textarea.value !== before[key]) continue;
    panel.textarea.value = t(key);
  }
}

function setLanguage(lang) {
  if (DBSchemaI18n.getLang() === lang) return;

  const before = { "sample.v1": t("sample.v1"), "sample.v2": t("sample.v2") };
  DBSchemaI18n.setLang(lang);
  swapSampleText(before);
  applyLanguage();
  renderAll({ keepTransform: true });
}

function init() {
  DBSchemaI18n.setLang(DBSchemaI18n.detect());
  initTheme();
  bindEvents();
  elements.ddlText.value = t("sample.v1");
  elements.sourceName.textContent = state.sourceName;
  elements.targetName.textContent = state.targetName;
  applyLanguage();
  renderAll();
}

init();
