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

const SAMPLE_DDL = `-- 쇼핑몰 예시 스키마
CREATE TABLE members (
  member_id   BIGINT       NOT NULL AUTO_INCREMENT COMMENT '회원 번호',
  email       VARCHAR(255) NOT NULL COMMENT '로그인 이메일',
  nickname    VARCHAR(40)  NOT NULL,
  grade       ENUM('BASIC','SILVER','GOLD') NOT NULL DEFAULT 'BASIC',
  point       INT          NOT NULL DEFAULT 0,
  joined_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (member_id),
  UNIQUE KEY uk_members_email (email)
) COMMENT='회원 마스터';

CREATE TABLE addresses (
  address_id  BIGINT       NOT NULL AUTO_INCREMENT,
  member_id   BIGINT       NOT NULL,
  receiver    VARCHAR(40)  NOT NULL,
  zipcode     CHAR(5)      NOT NULL,
  detail      VARCHAR(200) NOT NULL,
  is_default  TINYINT(1)   NOT NULL DEFAULT 0,
  PRIMARY KEY (address_id),
  CONSTRAINT fk_addresses_member FOREIGN KEY (member_id) REFERENCES members (member_id) ON DELETE CASCADE
);

CREATE TABLE categories (
  category_id BIGINT      NOT NULL AUTO_INCREMENT,
  parent_id   BIGINT      NULL COMMENT '상위 분류',
  name        VARCHAR(60) NOT NULL,
  depth       INT         NOT NULL DEFAULT 1,
  PRIMARY KEY (category_id),
  CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES categories (category_id)
);

CREATE TABLE products (
  product_id  BIGINT        NOT NULL AUTO_INCREMENT,
  category_id BIGINT        NOT NULL,
  name        VARCHAR(160)  NOT NULL,
  price       DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  stock       INT           NOT NULL DEFAULT 0,
  status      VARCHAR(20)   NOT NULL DEFAULT 'SALE',
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (product_id),
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories (category_id)
);

CREATE TABLE product_images (
  image_id   BIGINT       NOT NULL AUTO_INCREMENT,
  product_id BIGINT       NOT NULL,
  url        VARCHAR(500) NOT NULL,
  sort_order INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (image_id),
  CONSTRAINT fk_images_product FOREIGN KEY (product_id) REFERENCES products (product_id) ON DELETE CASCADE
);

CREATE TABLE orders (
  order_id    BIGINT        NOT NULL AUTO_INCREMENT,
  member_id   BIGINT        NOT NULL,
  address_id  BIGINT        NOT NULL,
  order_no    VARCHAR(30)   NOT NULL,
  total_price DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  status      VARCHAR(20)   NOT NULL DEFAULT 'PLACED',
  ordered_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (order_id),
  UNIQUE KEY uk_orders_no (order_no),
  CONSTRAINT fk_orders_member  FOREIGN KEY (member_id)  REFERENCES members (member_id),
  CONSTRAINT fk_orders_address FOREIGN KEY (address_id) REFERENCES addresses (address_id)
);

CREATE TABLE order_items (
  order_item_id BIGINT        NOT NULL AUTO_INCREMENT,
  order_id      BIGINT        NOT NULL,
  product_id    BIGINT        NOT NULL,
  quantity      INT           NOT NULL DEFAULT 1,
  unit_price    DECIMAL(12,2) NOT NULL,
  PRIMARY KEY (order_item_id),
  CONSTRAINT fk_items_order   FOREIGN KEY (order_id)   REFERENCES orders (order_id) ON DELETE CASCADE,
  CONSTRAINT fk_items_product FOREIGN KEY (product_id) REFERENCES products (product_id)
);

CREATE TABLE payments (
  payment_id BIGINT        NOT NULL AUTO_INCREMENT,
  order_id   BIGINT        NOT NULL,
  method     VARCHAR(20)   NOT NULL,
  amount     DECIMAL(14,2) NOT NULL,
  paid_at    DATETIME      NULL,
  PRIMARY KEY (payment_id),
  UNIQUE KEY uk_payments_order (order_id),
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders (order_id)
);

CREATE TABLE reviews (
  review_id  BIGINT   NOT NULL AUTO_INCREMENT,
  product_id BIGINT   NOT NULL,
  member_id  BIGINT   NOT NULL,
  rating     TINYINT  NOT NULL DEFAULT 5,
  content    TEXT     NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (review_id),
  CONSTRAINT fk_reviews_product FOREIGN KEY (product_id) REFERENCES products (product_id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_member  FOREIGN KEY (member_id)  REFERENCES members (member_id)
);
`;

// 비교 모드 샘플. 위 스키마에서 테이블 추가·삭제와 컬럼·제약 변경이 섞여 있다.
const SAMPLE_DDL_V2 = `-- 쇼핑몰 예시 스키마 v2
CREATE TABLE members (
  member_id    BIGINT       NOT NULL AUTO_INCREMENT COMMENT '회원 번호',
  email        VARCHAR(320) NOT NULL COMMENT '로그인 이메일',
  nickname     VARCHAR(60)  NOT NULL,
  grade        ENUM('BASIC','SILVER','GOLD','VIP') NOT NULL DEFAULT 'BASIC',
  phone        VARCHAR(20)  NULL COMMENT '휴대폰',
  joined_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  withdrawn_at DATETIME     NULL COMMENT '탈퇴 시각',
  PRIMARY KEY (member_id),
  UNIQUE KEY uk_members_email (email)
) COMMENT='회원 마스터';

CREATE TABLE addresses (
  address_id  BIGINT       NOT NULL AUTO_INCREMENT,
  member_id   BIGINT       NOT NULL,
  receiver    VARCHAR(40)  NOT NULL,
  zipcode     CHAR(5)      NOT NULL,
  detail      VARCHAR(200) NOT NULL,
  is_default  TINYINT(1)   NOT NULL DEFAULT 0,
  PRIMARY KEY (address_id),
  CONSTRAINT fk_addresses_member FOREIGN KEY (member_id) REFERENCES members (member_id) ON DELETE CASCADE
);

CREATE TABLE categories (
  category_id BIGINT      NOT NULL AUTO_INCREMENT,
  parent_id   BIGINT      NULL COMMENT '상위 분류',
  name        VARCHAR(60) NOT NULL,
  depth       INT         NOT NULL DEFAULT 1,
  PRIMARY KEY (category_id),
  CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES categories (category_id)
);

CREATE TABLE brands (
  brand_id BIGINT      NOT NULL AUTO_INCREMENT,
  name     VARCHAR(80) NOT NULL,
  country  CHAR(2)     NULL,
  PRIMARY KEY (brand_id),
  UNIQUE KEY uk_brands_name (name)
) COMMENT='브랜드';

CREATE TABLE products (
  product_id  BIGINT        NOT NULL AUTO_INCREMENT,
  category_id BIGINT        NOT NULL,
  brand_id    BIGINT        NULL,
  name        VARCHAR(160)  NOT NULL,
  price       DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  stock       INT           NOT NULL DEFAULT 0,
  status      VARCHAR(20)   NOT NULL DEFAULT 'SALE',
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (product_id),
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories (category_id),
  CONSTRAINT fk_products_brand    FOREIGN KEY (brand_id)    REFERENCES brands (brand_id)
);

CREATE TABLE orders (
  order_id    BIGINT        NOT NULL AUTO_INCREMENT,
  member_id   BIGINT        NOT NULL,
  address_id  BIGINT        NOT NULL,
  order_no    VARCHAR(30)   NOT NULL,
  total_price DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  status      VARCHAR(20)   NOT NULL DEFAULT 'PLACED',
  ordered_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (order_id),
  UNIQUE KEY uk_orders_no (order_no),
  CONSTRAINT fk_orders_member  FOREIGN KEY (member_id)  REFERENCES members (member_id) ON DELETE RESTRICT,
  CONSTRAINT fk_orders_address FOREIGN KEY (address_id) REFERENCES addresses (address_id)
);

CREATE INDEX idx_orders_ordered_at ON orders (ordered_at);

CREATE TABLE order_items (
  order_item_id BIGINT        NOT NULL AUTO_INCREMENT,
  order_id      BIGINT        NOT NULL,
  product_id    BIGINT        NOT NULL,
  quantity      INT           NOT NULL DEFAULT 1,
  unit_price    DECIMAL(12,2) NOT NULL,
  PRIMARY KEY (order_item_id),
  CONSTRAINT fk_items_order   FOREIGN KEY (order_id)   REFERENCES orders (order_id) ON DELETE CASCADE,
  CONSTRAINT fk_items_product FOREIGN KEY (product_id) REFERENCES products (product_id)
);

CREATE TABLE payments (
  payment_id BIGINT        NOT NULL AUTO_INCREMENT,
  order_id   BIGINT        NOT NULL,
  method     VARCHAR(20)   NOT NULL,
  amount     DECIMAL(14,2) NOT NULL,
  pg_tid     VARCHAR(64)   NULL COMMENT 'PG 거래 번호',
  paid_at    DATETIME      NULL,
  PRIMARY KEY (payment_id),
  UNIQUE KEY uk_payments_order (order_id),
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders (order_id)
);

CREATE TABLE member_coupons (
  member_coupon_id BIGINT      NOT NULL AUTO_INCREMENT,
  member_id        BIGINT      NOT NULL,
  code             VARCHAR(30) NOT NULL,
  discount_rate    INT         NOT NULL DEFAULT 0,
  expires_at       DATETIME    NOT NULL,
  PRIMARY KEY (member_coupon_id),
  UNIQUE KEY uk_member_coupons_code (code),
  CONSTRAINT fk_member_coupons_member FOREIGN KEY (member_id) REFERENCES members (member_id) ON DELETE CASCADE
);

CREATE TABLE reviews (
  review_id  BIGINT   NOT NULL AUTO_INCREMENT,
  product_id BIGINT   NOT NULL,
  member_id  BIGINT   NOT NULL,
  rating     TINYINT  NOT NULL DEFAULT 5,
  content    TEXT     NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (review_id),
  CONSTRAINT fk_reviews_product FOREIGN KEY (product_id) REFERENCES products (product_id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_member  FOREIGN KEY (member_id)  REFERENCES members (member_id)
);
`;

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
      `<text class="row-more" x="${NODE_PADDING + BADGE_SLOT}" y="${y + 4}">+${hidden}개 더</text>`
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
    elements.tableRail.innerHTML = '<li class="rail-empty">테이블이 없습니다</li>';
    return;
  }

  const markup = schema.tables
    .map((table) => {
      const relationCount = table.outgoing.length + table.incoming.length;
      const flag = state.mode === "compare" ? `<i class="rail-flag ${table.diffStatus || ""}"></i>` : "";
      return (
        `<li><button class="rail-item" type="button" data-id="${escapeXml(table.id)}">` +
        `<strong>${flag}${escapeXml(table.name)}</strong>` +
        `<span>컬럼 ${table.columns.length} · 관계 ${relationCount}</span>` +
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
    `<span class="relation-tag ${relation.kind}">${relation.kind === "inferred" ? "추정" : "FK"}</span>` +
    `<b>${escapeXml(own.join(", "))}</b>` +
    `<em>${arrow}</em>` +
    `<button class="relation-link" type="button" data-goto="${escapeXml(other.id)}">${escapeXml(
      other.name
    )}.${escapeXml(target.join(", "))}</button>` +
    `<em>${cardinalityLabel(relation)}${relation.optional ? " · 선택" : ""}</em>` +
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
  elements.detailSchema.textContent = table.schema ? table.schema.toUpperCase() : "TABLE";
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
    : '<div class="relation-line"><em>연결된 관계가 없습니다.</em></div>';
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

  elements.searchPosition.textContent = hits.length ? `${hits.length}개` : "없음";
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
    showToast("내보낼 다이어그램이 없습니다.");
    return;
  }
  const { markup } = buildExportSvg();
  downloadBlob(new Blob([markup], { type: "image/svg+xml;charset=utf-8" }), `${baseFileName()}-diagram.svg`);
  showToast("SVG로 내보냈습니다.");
}

function exportPng() {
  if (!state.view.nodes.size) {
    showToast("내보낼 다이어그램이 없습니다.");
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
        showToast("PNG 변환에 실패했습니다.");
        return;
      }
      downloadBlob(blob, `${baseFileName()}-diagram.png`);
      showToast("PNG로 내보냈습니다.");
    }, "image/png");
  };

  image.onerror = () => {
    URL.revokeObjectURL(url);
    showToast("PNG 변환에 실패했습니다.");
  };

  image.src = url;
}

function copyRelations() {
  const schema = state.schema;
  if (!schema || !schema.relations.length) {
    showToast("복사할 관계가 없습니다.");
    return;
  }

  const lines = schema.relations.map((relation) => {
    const kind = relation.kind === "inferred" ? "추정" : "FK";
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

  const text = `# ${schema.tables.length}개 테이블 · ${schema.relations.length}개 관계\n${lines.join("\n")}\n`;

  navigator.clipboard
    ?.writeText(text)
    .then(() => showToast(`관계 ${schema.relations.length}개를 복사했습니다.`))
    .catch(() => showToast("클립보드 복사가 차단되었습니다."));
}

/* --------------------------------------------------------------- 파이프라인 */

function schemaMessages(schema, prefix) {
  const tag = prefix ? `${prefix} · ` : "";
  return [
    ...schema.warnings.map((message) => `${tag}${message}`),
    ...schema.unresolved.map(
      (entry) => `${tag}${entry.from}의 외래키가 참조하는 ${entry.target} 정의를 찾지 못했습니다.`
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
    elements.warningList.insertAdjacentHTML("beforeend", `<li>외 ${messages.length - shown.length}건</li>`);
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
  setStat(elements.tableStat, "테이블", stats.tableCount, "해석된 정의");
  setStat(elements.columnStat, "컬럼", stats.columnCount, "전체 필드");
  setStat(elements.explicitStat, "명시 관계", stats.relationCount - stats.inferredCount, "FOREIGN KEY");
  setStat(elements.inferredStat, "추정 관계", stats.inferredCount, "이름 기반");
  setStat(elements.isolatedStat, "고립", stats.isolatedCount, "연결 없음");

  const empty = stats.tableCount === 0;
  elements.resultState.classList.toggle("empty", empty);
  elements.resultStateText.textContent = empty
    ? "읽을 테이블이 없습니다"
    : `테이블 ${stats.tableCount}개 · 관계 ${stats.relationCount}개`;
}

function updateCompareStats(diff) {
  const stats = diff.stats;
  const columnChanges = stats.addedColumns + stats.removedColumns + stats.changedColumns;

  setStat(elements.tableStat, "테이블", diff.tables.length, "양쪽 합계");
  setStat(elements.columnStat, "컬럼 변경", columnChanges, `+${stats.addedColumns} −${stats.removedColumns} ~${stats.changedColumns}`);
  setStat(elements.explicitStat, "추가", stats.addedTables, "TARGET 에만 있음");
  setStat(elements.inferredStat, "변경", stats.changedTables, "내용이 다름");
  setStat(elements.isolatedStat, "삭제", stats.removedTables, "SOURCE 에만 있음");

  elements.resultState.classList.toggle("empty", diff.identical);
  elements.resultStateText.textContent = diff.identical
    ? "두 스키마가 같습니다"
    : `테이블 +${stats.addedTables} · −${stats.removedTables} · ~${stats.changedTables}`;
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
    push("changed", `${named("PRIMARY KEY")} ${note(`(${entry.pk.from.join(", ") || "—"}) → (${entry.pk.to.join(", ") || "—"})`)}`);
  }
  for (const unique of entry.uniques) {
    push(unique.status, `${named("UNIQUE")} ${note(`(${unique.columns.join(", ")})`)}`);
  }
  for (const index of entry.indexes) {
    push(index.status, `${named("INDEX")} ${note(`(${index.columns.join(", ")})`)}`);
  }
  for (const relation of entry.relations) {
    const model = relation.target || relation.source;
    const extra = relation.status === "changed" ? ` · ${relation.changes[0].to}` : "";
    push(relation.status, `${named("FK")} ${note(relationSummary(model) + extra)}`);
  }
  if (entry.comment) {
    push("changed", `${named("테이블 설명")} ${note(`${entry.comment.from || "—"} → ${entry.comment.to || "—"}`)}`);
  }
  return lines;
}

const CHANGE_FLAGS = { added: "추가", removed: "삭제", changed: "변경", same: "동일" };
const MAX_CHANGE_LINES = 14;

function renderChangeList() {
  const diff = state.diff;
  if (!diff) return;

  // 바뀐 테이블을 먼저 보여주고 그대로인 테이블은 뒤로 민다.
  const ordered = [...diff.tables].sort((a, b) => (a.status === "same" ? 1 : 0) - (b.status === "same" ? 1 : 0));
  const entries = elements.hideSameTables.checked ? ordered.filter((entry) => entry.status !== "same") : ordered;

  if (!entries.length) {
    elements.changeList.innerHTML = `<div class="change-empty">${
      diff.tables.length ? "바뀐 테이블이 없습니다." : "읽을 테이블이 없습니다."
    }</div>`;
    return;
  }

  elements.changeList.innerHTML = entries
    .map((entry) => {
      const lines = tableChangeLines(entry);
      const shown = lines.slice(0, MAX_CHANGE_LINES);
      if (lines.length > shown.length) {
        shown.push(`<li><i></i><span>외 ${lines.length - shown.length}건</span></li>`);
      }

      const table = entry.target || entry.source;
      const summary =
        entry.status === "changed" ? `${entry.changeCount}건` : `컬럼 ${table.columns.length}`;

      return (
        `<article class="change-table ${entry.status}">` +
        `<button class="change-head" type="button" data-id="${escapeXml(entry.displayId || "")}">` +
        `<span class="change-flag">${CHANGE_FLAGS[entry.status]}</span>` +
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
  elements.scriptMeta.textContent = result.statementCount ? `${result.statementCount}개 문장` : "실행할 문장 없음";

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
    ? `${name === panel.sampleName ? "샘플 · " : ""}${tableCount}개 테이블`
    : "해석된 테이블 없음";
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
    sample: () => SAMPLE_DDL,
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
    sample: () => SAMPLE_DDL_V2,
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
        ? "SQLite 파일이 손상되었거나 암호화되어 스키마를 읽을 수 없습니다."
        : "SQLite 파일로 인식되지 않습니다."
    );
    return;
  }

  loadText(panel, result.sql, name);

  if (clipped && result.truncated) {
    showToast(`파일 앞 ${MAX_SQLITE_BYTES / 1024 / 1024}MB만 읽어 일부 테이블이 빠졌을 수 있습니다.`);
  }
  if (!result.tableCount) {
    showToast("SQLite 파일에 테이블이 없습니다.");
    return;
  }
  showToast(
    `SQLite에서 테이블 ${result.tableCount}개${result.indexCount ? ` · 인덱스 ${result.indexCount}개` : ""}를 읽었습니다.`
  );
}

function readBytes(blob, onDone) {
  const reader = new FileReader();
  reader.onload = () => onDone(new Uint8Array(reader.result || new ArrayBuffer(0)));
  reader.onerror = () => showToast("파일을 읽지 못했습니다.");
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
      showToast(`SQL 파일이 너무 큽니다. 최대 ${MAX_TEXT_BYTES / 1024 / 1024}MB까지 읽습니다.`);
      return;
    }

    readBytes(file, (bytes) => {
      const text = decodeText(bytes);
      if (looksBinary(text)) {
        showToast("텍스트 SQL이나 SQLite 파일이 아닙니다.");
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
    showToast("파일을 하나만 읽었습니다. 스키마 비교 모드에서는 두 개를 SOURCE·TARGET 으로 나눠 담습니다.");
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
  elements.themeButton.setAttribute("aria-label", theme === "dark" ? "라이트 모드 전환" : "다크 모드 전환");
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

const HERO_COPY = {
  single:
    "CREATE TABLE 구문을 그대로 붙여넣으세요. 컬럼과 키, 외래키를 읽어 ER 다이어그램으로 그립니다. 외래키가 없는 스키마는 컬럼 이름으로 관계를 추정합니다.",
  compare:
    "바뀌기 전과 후의 스키마를 나란히 붙여넣으세요. 달라진 테이블과 컬럼을 짚어주고, SOURCE 를 TARGET 으로 만드는 마이그레이션 DDL 을 방언에 맞춰 만들어 줍니다."
};

const MODE_NOTE = {
  single: "DDL 하나를 읽어 ER 다이어그램을 그립니다.",
  compare: "두 스키마를 대조해 변경 목록과 마이그레이션 DDL 을 만듭니다. 파일 두 개를 한 번에 놓아도 됩니다."
};

// 비교 모드에서는 SOURCE 칸에도 파일 두 개를 놓을 수 있으므로 안내 문구를 바꾼다.
const SOURCE_DROP_TEXT = {
  single: {
    hint: ".sql 또는 SQLite .db 파일 드롭 · 붙여넣기 가능",
    title: "SQL 또는 SQLite 파일 놓기",
    note: ".db 파일은 안에 저장된 스키마를 꺼내 그립니다"
  },
  compare: {
    hint: "파일 1개/2개 드롭 · 붙여넣기 가능",
    title: "한 개 또는 두 파일 놓기",
    note: "두 파일이면 SOURCE / TARGET 에 자동 배치합니다"
  }
};

function applyMode() {
  const compare = state.mode === "compare";

  elements.inputGrid.classList.toggle("compare", compare);
  elements.ddlDropzoneB.hidden = !compare;
  elements.swapButton.hidden = !compare;
  elements.dialectField.hidden = !compare;
  elements.compareReport.hidden = !compare;
  elements.diffLegend.hidden = !compare;
  elements.diagramCanvas.classList.toggle("compare", compare);

  elements.sourceLabel.textContent = compare ? "SOURCE · 기준" : "DDL INPUT";

  const dropText = SOURCE_DROP_TEXT[state.mode];
  elements.sourceDropHint.textContent = dropText.hint;
  elements.sourceDropTitle.textContent = dropText.title;
  elements.sourceDropNote.textContent = dropText.note;

  elements.renderButtonLabel.textContent = compare ? "스키마 비교" : "다이어그램 그리기";
  elements.resultsEyebrow.textContent = compare ? "SCHEMA DIFF" : "TABLES & RELATIONS";
  elements.resultsTitle.textContent = compare ? "SCHEMA DIFF" : "ER DIAGRAM";
  elements.resultFootnote.textContent = compare
    ? "생성한 스크립트는 DDL 텍스트만 보고 만든 것입니다. 실행 전에 검토하세요."
    : "모든 해석은 이 탭 안에서만 처리됩니다.";
  elements.modeNote.textContent = MODE_NOTE[state.mode];
  elements.heroCopy.textContent = HERO_COPY[state.mode];

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
  if (mode === "compare" && !elements.ddlTextB.value.trim() && elements.ddlText.value === SAMPLE_DDL) {
    elements.ddlTextB.value = SAMPLE_DDL_V2;
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
  showToast(`SOURCE 와 TARGET 을 바꿨습니다. 이제 ${state.sourceName} → ${state.targetName} 입니다.`);
}

/* ------------------------------------------------------- 비교 내보내기 */

function csvCell(value) {
  const text = String(value == null ? "" : value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function changeRows() {
  const rows = [["구분", "테이블", "대상", "항목", "이전", "이후"]];

  for (const entry of state.diff.tables) {
    if (entry.status === "same") continue;
    const name = entry.qualified;

    if (entry.status !== "changed") {
      const table = entry.target || entry.source;
      rows.push([CHANGE_FLAGS[entry.status], name, "테이블", `컬럼 ${table.columns.length}개`, "", ""]);
      continue;
    }

    for (const column of entry.columns) {
      if (column.status === "same") continue;
      if (column.status === "changed") {
        for (const change of column.changes) {
          rows.push(["변경", name, `컬럼 ${column.name}`, change.label, change.from, change.to]);
        }
        continue;
      }
      const model = column.target || column.source;
      rows.push([CHANGE_FLAGS[column.status], name, `컬럼 ${column.name}`, columnSummary(model), "", ""]);
    }

    if (entry.pk) rows.push(["변경", name, "기본키", "PRIMARY KEY", entry.pk.from.join(" "), entry.pk.to.join(" ")]);
    for (const unique of entry.uniques) {
      rows.push([CHANGE_FLAGS[unique.status], name, "고유 제약", unique.columns.join(" "), "", ""]);
    }
    for (const index of entry.indexes) {
      rows.push([CHANGE_FLAGS[index.status], name, "인덱스", index.columns.join(" "), "", ""]);
    }
    for (const relation of entry.relations) {
      const model = relation.target || relation.source;
      const change = relation.changes[0];
      rows.push([
        CHANGE_FLAGS[relation.status],
        name,
        "외래키",
        relationSummary(model),
        change ? change.from : "",
        change ? change.to : ""
      ]);
    }
    if (entry.comment) rows.push(["변경", name, "테이블 설명", "COMMENT", entry.comment.from, entry.comment.to]);
  }

  return rows;
}

function copyChanges() {
  if (!state.diff || state.diff.identical) {
    showToast("복사할 변경이 없습니다.");
    return;
  }

  const rows = changeRows();
  const text = rows.map((row) => row.map(csvCell).join(",")).join("\n");

  navigator.clipboard
    ?.writeText(`${text}\n`)
    .then(() => showToast(`변경 ${rows.length - 1}건을 CSV로 복사했습니다.`))
    .catch(() => showToast("클립보드 복사가 차단되었습니다."));
}

function copyScript() {
  if (!state.migration) return;
  navigator.clipboard
    ?.writeText(state.migration.sql)
    .then(() => showToast("마이그레이션 스크립트를 복사했습니다."))
    .catch(() => showToast("클립보드 복사가 차단되었습니다."));
}

function saveScript() {
  if (!state.migration) return;
  const source = stripExtension(state.sourceName, "source");
  const target = stripExtension(state.targetName, "target");
  downloadBlob(
    new Blob([state.migration.sql], { type: "text/plain;charset=utf-8" }),
    `${source}-to-${target}.${state.dialect}.sql`
  );
  showToast("스크립트를 저장했습니다.");
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
    showToast("자동으로 다시 배치했습니다.");
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
    (dialect) => `<option value="${dialect.id}">${escapeXml(dialect.label)}</option>`
  ).join("");
  elements.dialectSelect.value = state.dialect;
}

function init() {
  initTheme();
  initDialects();
  bindEvents();
  applyMode();
  elements.ddlText.value = SAMPLE_DDL;
  elements.sourceName.textContent = state.sourceName;
  elements.targetName.textContent = state.targetName;
  renderAll();
}

init();
