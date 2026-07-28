/* DBSchemaView — 한국어 / 영어 문자열
 *
 * 화면에 보이는 글, 경고, 만들어 주는 스크립트의 주석까지 모두 여기에 모은다.
 * 정적인 글은 data-i18n 속성으로 표시해 두고 applyStatic 이 한 번에 갈아 끼운다.
 * 코드 주석은 개발자가 읽는 것이라 번역 대상이 아니다. */
(function (global) {
  "use strict";

  const STORAGE_KEY = "dbschemaview-lang";
  const LANGS = ["ko", "en"];

  /* 샘플 스키마. 테이블·컬럼 이름은 그대로 두고 설명만 각 언어로 적는다. */

  const SAMPLE_KO = `-- 쇼핑몰 예시 스키마
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

  const SAMPLE_V2_KO = `-- 쇼핑몰 예시 스키마 v2
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

  const SAMPLE_EN = SAMPLE_KO.replace(/-- 쇼핑몰 예시 스키마/, "-- Sample shop schema")
    .replace(/COMMENT '회원 번호'/, "COMMENT 'Member no.'")
    .replace(/COMMENT '로그인 이메일'/, "COMMENT 'Login email'")
    .replace(/COMMENT='회원 마스터'/, "COMMENT='Member master'")
    .replace(/COMMENT '상위 분류'/, "COMMENT 'Parent category'");

  const SAMPLE_V2_EN = SAMPLE_V2_KO.replace(/-- 쇼핑몰 예시 스키마 v2/, "-- Sample shop schema v2")
    .replace(/COMMENT '회원 번호'/, "COMMENT 'Member no.'")
    .replace(/COMMENT '로그인 이메일'/, "COMMENT 'Login email'")
    .replace(/COMMENT='회원 마스터'/, "COMMENT='Member master'")
    .replace(/COMMENT '휴대폰'/, "COMMENT 'Mobile'")
    .replace(/COMMENT '탈퇴 시각'/, "COMMENT 'Withdrawn at'")
    .replace(/COMMENT '상위 분류'/, "COMMENT 'Parent category'")
    .replace(/COMMENT='브랜드'/, "COMMENT='Brand'")
    .replace(/COMMENT 'PG 거래 번호'/, "COMMENT 'PG transaction id'");

  const ko = {
    "meta.title": "DBSchemaView — DB 스키마 시각화와 비교",
    "meta.description":
      "CREATE TABLE 구문을 붙여넣으면 테이블 관계를 ER 다이어그램으로 그리고, 두 스키마를 비교해 마이그레이션 DDL을 만드는 DBSchemaView",

    "header.home": "DBSchemaView 홈",
    "header.privacy": "스키마는 브라우저 밖으로 나가지 않아요",
    "header.themeTitle": "화면 테마 전환",
    "header.themeToDark": "다크 모드 전환",
    "header.themeToLight": "라이트 모드 전환",
    "header.language": "언어 선택",

    "hero.title": '<span class="sql-token">CREATE TABLE</span>에서<br><em>ER 다이어그램까지.</em>',
    "hero.copy.single":
      "CREATE TABLE 구문을 그대로 붙여넣으세요. 컬럼과 키, 외래키를 읽어 ER 다이어그램으로 그립니다. 외래키가 없는 스키마는 컬럼 이름으로 관계를 추정합니다.",
    "hero.copy.compare":
      "바뀌기 전과 후의 스키마를 나란히 붙여넣으세요. 달라진 테이블과 컬럼을 짚어주고, SOURCE 를 TARGET 으로 만드는 마이그레이션 DDL 을 방언에 맞춰 만들어 줍니다.",
    "hero.dialects": "지원 방언",

    "workspace.aria": "스키마 입력 영역",
    "mode.aria": "작업 모드",
    "mode.single": "단일 스키마",
    "mode.compare": "스키마 비교",
    "mode.note.single": "DDL 하나를 읽어 ER 다이어그램을 그립니다.",
    "mode.note.compare": "두 스키마를 대조해 변경 목록과 마이그레이션 DDL 을 만듭니다. 파일 두 개를 한 번에 놓아도 됩니다.",
    "swap.label": "좌우 바꾸기",
    "swap.title": "SOURCE 와 TARGET 을 서로 바꿉니다",

    "panel.source.single": "DDL INPUT",
    "panel.source.compare": "SOURCE · 기준",
    "panel.target": "TARGET · 목표",
    "panel.sample": "샘플 넣기",
    "panel.clear": "비우기",
    "panel.openFile": "파일 열기",
    "panel.ddlAria": "테이블 구조 DDL",
    "panel.targetDdlAria": "비교 대상 DDL",
    "panel.targetPlaceholder": "바뀐 뒤의 스키마를 붙여넣으세요.",
    "panel.targetFooter": "파일 1개/2개 드롭 · 이 모습이 되도록 만듭니다",
    "panel.targetDropTitle": "한 개 또는 두 파일 놓기",
    "panel.targetDropNote": "두 파일이면 SOURCE / TARGET 에 자동 배치합니다",
    "panel.meta.sample": "샘플 · {count}개 테이블",
    "panel.meta.tables": "{count}개 테이블",
    "panel.meta.empty": "해석된 테이블 없음",

    "drop.single.hint": ".sql 또는 SQLite .db 파일 드롭 · 붙여넣기 가능",
    "drop.single.title": "SQL 또는 SQLite 파일 놓기",
    "drop.single.note": ".db 파일은 안에 저장된 스키마를 꺼내 그립니다",
    "drop.compare.hint": "파일 1개/2개 드롭 · 붙여넣기 가능",
    "drop.compare.title": "한 개 또는 두 파일 놓기",
    "drop.compare.note": "두 파일이면 SOURCE / TARGET 에 자동 배치합니다",

    "options.rules": "해석 규칙",
    "options.infer": "관계 자동 추정",
    "options.inferNote": "외래키가 없어도 <code>user_id</code> → <code>users</code> 처럼 이름으로 연결합니다.",
    "options.showTypes": "데이터 타입 표시",
    "options.showComments": "컬럼 설명 우선 표시",
    "options.migration": "마이그레이션",
    "options.dialect": "DDL 방언",
    "options.dialectAria": "마이그레이션 DDL 방언",
    "options.dialectNote": "SOURCE 를 TARGET 으로 만드는 스크립트를 이 문법으로 적습니다.",
    "options.hideSame": "변경된 테이블만 목록에 표시",
    "options.warningTitle": "확인이 필요합니다",
    "action.render.single": "다이어그램 그리기",
    "action.render.compare": "스키마 비교",

    "results.eyebrow.single": "TABLES & RELATIONS",
    "results.eyebrow.compare": "SCHEMA DIFF",
    "results.title.single": "ER DIAGRAM",
    "results.title.compare": "SCHEMA DIFF",
    "results.statsAria": "스키마 통계",
    "state.empty": "읽을 테이블이 없습니다",
    "state.summary": "테이블 {tables}개 · 관계 {relations}개",
    "state.identical": "두 스키마가 같습니다",
    "state.diffSummary": "테이블 +{added} · −{removed} · ~{changed}",

    "stat.tables": "테이블",
    "stat.tables.note": "해석된 정의",
    "stat.columns": "컬럼",
    "stat.columns.note": "전체 필드",
    "stat.explicit": "명시 관계",
    "stat.explicit.note": "FOREIGN KEY",
    "stat.inferred": "추정 관계",
    "stat.inferred.note": "이름 기반",
    "stat.isolated": "고립",
    "stat.isolated.note": "연결 없음",
    "stat.diff.tables.note": "양쪽 합계",
    "stat.diff.columns": "컬럼 변경",
    "stat.diff.added": "추가",
    "stat.diff.added.note": "TARGET 에만 있음",
    "stat.diff.changed": "변경",
    "stat.diff.changed.note": "내용이 다름",
    "stat.diff.removed": "삭제",
    "stat.diff.removed.note": "SOURCE 에만 있음",

    "toolbar.columnsAria": "컬럼 표시 방식",
    "toolbar.allColumns": "전체 컬럼",
    "toolbar.keyColumns": "키 컬럼만",
    "toolbar.searchPlaceholder": "테이블 · 컬럼 검색",
    "toolbar.searchAria": "테이블 또는 컬럼 검색",
    "toolbar.zoomAria": "확대 축소",
    "toolbar.zoomOut": "축소",
    "toolbar.zoomIn": "확대",
    "toolbar.fit": "맞춤",
    "toolbar.fitTitle": "화면에 맞추기",
    "toolbar.relayout": "재배치",
    "toolbar.relayoutTitle": "자동 재배치",

    "rail.aria": "테이블 목록",
    "rail.empty": "테이블이 없습니다",
    "rail.item": "컬럼 {columns} · 관계 {relations}",
    "canvas.aria": "관계 다이어그램. 위아래 방향키로 테이블을 선택하고, Ctrl과 마우스 휠로 확대·축소합니다.",
    "canvas.svgAria": "테이블 관계 다이어그램",
    "diagram.emptyTitle": "읽을 테이블이 없습니다",
    "diagram.emptyNote": "CREATE TABLE 구문을 붙여넣고 다시 그려보세요.",
    "node.more": "+{count}개 더",

    "legend.aria": "범례",
    "legend.fk": "외래키",
    "legend.inferred": "추정 관계",
    "legend.pk": "기본키",
    "legend.unique": "고유",
    "legend.diffAria": "변경 범례",
    "legend.added": "추가",
    "legend.changed": "변경",
    "legend.removed": "삭제",
    "legend.same": "그대로",

    "report.title": "변경 목록과 마이그레이션 스크립트",
    "report.copyChanges": "변경 목록 CSV",
    "report.copyScript": "스크립트 복사",
    "report.saveScript": ".sql 저장",
    "report.scriptAria": "생성된 마이그레이션 스크립트",
    "report.notesTitle": "확인이 필요합니다",
    "report.statements": "{count}개 문장",
    "report.noStatements": "실행할 문장 없음",

    "change.empty.noChanges": "바뀐 테이블이 없습니다.",
    "change.empty.noTables": "읽을 테이블이 없습니다.",
    "change.flag.added": "추가",
    "change.flag.removed": "삭제",
    "change.flag.changed": "변경",
    "change.flag.same": "동일",
    "change.count": "{count}건",
    "change.columns": "컬럼 {count}",
    "change.more": "외 {count}건",
    "change.pk": "PRIMARY KEY",
    "change.unique": "UNIQUE",
    "change.index": "INDEX",
    "change.fk": "FK",
    "change.tableComment": "테이블 설명",

    "detail.emptyTitle": "테이블을 선택하세요",
    "detail.emptyNote": "다이어그램이나 왼쪽 목록에서 테이블을 누르면 컬럼과 관계를 자세히 보여줍니다.",
    "detail.close": "선택 해제",
    "detail.table": "TABLE",
    "detail.key": "키",
    "detail.column": "컬럼",
    "detail.type": "타입",
    "detail.null": "NULL",
    "detail.default": "기본값",
    "detail.comment": "설명",
    "detail.noRelations": "연결된 관계가 없습니다.",
    "relation.fk": "FK",
    "relation.inferred": "추정",
    "relation.optional": "선택",

    "footer.note.single": "모든 해석은 이 탭 안에서만 처리됩니다.",
    "footer.note.compare": "생성한 스크립트는 DDL 텍스트만 보고 만든 것입니다. 실행 전에 검토하세요.",
    "footer.copyRelations": "관계 목록 복사",
    "footer.exportSvg": "SVG 내보내기",
    "footer.exportPng": "PNG 내보내기",

    "features.aria": "DBSchemaView 특징",
    "features.1.title": "방언을 가리지 않는 해석",
    "features.1.body":
      "MySQL 백틱, SQL Server 대괄호, PostgreSQL 따옴표와 배열 타입, Oracle 스키마 한정자를 같은 규칙으로 읽습니다.",
    "features.2.title": "관계가 없어도 그립니다",
    "features.2.body":
      "FOREIGN KEY가 빠진 스키마는 컬럼 이름과 기본키를 대조해 관계를 추정하고, 점선으로 구분해 표시합니다.",
    "features.3.title": "두 스키마의 차이와 이어 붙일 DDL",
    "features.3.body":
      "운영과 개발 스키마를 나란히 놓으면 바뀐 테이블과 컬럼을 짚어주고, 한쪽을 다른 쪽으로 만드는 ALTER 스크립트를 방언에 맞춰 적어줍니다.",
    "features.4.title": "완전한 로컬 처리",
    "features.4.body": "업로드 서버와 계정이 없습니다. 붙여넣은 스키마는 현재 브라우저 메모리 안에서만 해석됩니다.",

    "toast.sqliteBroken": "SQLite 파일이 손상되었거나 암호화되어 스키마를 읽을 수 없습니다.",
    "toast.sqliteNotRecognized": "SQLite 파일로 인식되지 않습니다.",
    "toast.sqliteClipped": "파일 앞 {mb}MB만 읽어 일부 테이블이 빠졌을 수 있습니다.",
    "toast.sqliteNoTables": "SQLite 파일에 테이블이 없습니다.",
    "toast.sqliteLoaded": "SQLite에서 테이블 {tables}개{indexes}를 읽었습니다.",
    "toast.sqliteIndexes": " · 인덱스 {count}개",
    "toast.fileTooLarge": "SQL 파일이 너무 큽니다. 최대 {mb}MB까지 읽습니다.",
    "toast.notText": "텍스트 SQL이나 SQLite 파일이 아닙니다.",
    "toast.readFailed": "파일을 읽지 못했습니다.",
    "toast.singleModeDrop": "파일을 하나만 읽었습니다. 스키마 비교 모드에서는 두 개를 SOURCE·TARGET 으로 나눠 담습니다.",
    "toast.relayout": "자동으로 다시 배치했습니다.",
    "toast.swapped": "SOURCE 와 TARGET 을 바꿨습니다. 이제 {source} → {target} 입니다.",
    "toast.noDiagram": "내보낼 다이어그램이 없습니다.",
    "toast.svgSaved": "SVG로 내보냈습니다.",
    "toast.pngSaved": "PNG로 내보냈습니다.",
    "toast.pngFailed": "PNG 변환에 실패했습니다.",
    "toast.noRelations": "복사할 관계가 없습니다.",
    "toast.relationsCopied": "관계 {count}개를 복사했습니다.",
    "toast.clipboardBlocked": "클립보드 복사가 차단되었습니다.",
    "toast.noChanges": "복사할 변경이 없습니다.",
    "toast.changesCopied": "변경 {count}건을 CSV로 복사했습니다.",
    "toast.scriptCopied": "마이그레이션 스크립트를 복사했습니다.",
    "toast.scriptSaved": "스크립트를 저장했습니다.",

    "copy.relationsHeader": "# {tables}개 테이블 · {relations}개 관계",
    "csv.kind": "구분",
    "csv.table": "테이블",
    "csv.target": "대상",
    "csv.item": "항목",
    "csv.before": "이전",
    "csv.after": "이후",
    "csv.tableRow": "테이블",
    "csv.columnRow": "컬럼 {name}",
    "csv.columnCount": "컬럼 {count}개",
    "csv.pk": "기본키",
    "csv.unique": "고유 제약",
    "csv.index": "인덱스",
    "csv.fk": "외래키",
    "csv.comment": "테이블 설명",

    "warn.unresolved": "{from}의 외래키가 참조하는 {target} 정의를 찾지 못했습니다.",
    "warn.more": "외 {count}건",

    "parse.noName": "이름을 읽을 수 없는 CREATE TABLE 문을 건너뛰었습니다.",
    "parse.noColumns": "{table}: 컬럼 정의가 없어 건너뛰었습니다.",
    "parse.duplicate": "{table}: 같은 이름의 테이블이 여러 번 정의되어 마지막 정의만 사용합니다.",
    "parse.tooLarge": "입력이 너무 커서 앞쪽 {mb}MB만 해석했습니다.",
    "parse.statementError": "구문 해석 중 오류가 발생해 한 문장을 건너뛰었습니다: {message}",
    "parse.tooManyTables": "테이블이 {count}개를 넘어 이후 정의는 표시하지 않습니다.",

    "sqlite.partial": "파일 일부를 읽지 못해 일부 테이블이 빠졌을 수 있습니다.",
    "sqlite.internalSkipped": "SQLite 내부 테이블 {count}개는 제외했습니다.",
    "sqlite.headerTitle": "-- SQLite 데이터베이스에서 추출한 스키마",
    "sqlite.headerMeta": "-- 테이블 {tables}개 · 인덱스 {indexes}개 · 페이지 {pageSize}B · {encoding}",

    "field.type": "타입",
    "field.nullable": "NULL",
    "field.default": "기본값",
    "field.auto": "자동 증가",
    "field.generated": "생성 컬럼",
    "field.comment": "설명",
    "field.action": "참조 동작",

    "ddl.header": "-- DBSchemaView 마이그레이션 스크립트",
    "ddl.dialect": "-- 방언: {dialect}",
    "ddl.direction": "-- 방향: SOURCE → TARGET (기준 스키마를 목표 스키마로 맞춥니다)",
    "ddl.counts":
      "-- 테이블 +{addedTables} / -{removedTables} / ~{changedTables} · 컬럼 +{addedColumns} / -{removedColumns} / ~{changedColumns} · 외래키 +{addedRelations} / -{removedRelations}",
    "ddl.caution": "-- DDL 텍스트만 보고 만든 스크립트입니다. 실행 전에 반드시 검토하고 백업하세요.",
    "ddl.noSchemas": "-- 비교할 스키마가 없습니다.",
    "ddl.identical": "-- 두 스키마가 같습니다. 생성할 변경이 없습니다.",
    "ddl.section.dropFk": "1. 외래키 제거",
    "ddl.section.dropTable": "2. 테이블 삭제 — 데이터가 함께 사라집니다",
    "ddl.section.addTable": "3. 테이블 추가",
    "ddl.section.columns": "4. 컬럼 변경",
    "ddl.section.keys": "5. 기본키 · 제약 · 인덱스",
    "ddl.section.addFk": "6. 외래키 추가",
    "ddl.section.comments": "7. 설명",
    "ddl.dataLoss": "데이터가 사라집니다",
    "ddl.sqliteSection": "SQLite 제약 — 아래 테이블은 재생성이 필요합니다",
    "ddl.sqliteLine1": "SQLite 는 컬럼 타입·기본키·제약 변경을 ALTER 로 처리하지 못합니다.",
    "ddl.sqliteLine2": "새 테이블 생성 → INSERT SELECT 로 복사 → 기존 테이블 DROP → RENAME 순서로 바꾸세요.",

    "note.generated": "{column} 은(는) 생성 컬럼입니다. 계산식은 DDL 원문에 남아 있지 않으므로 직접 채워야 합니다.",
    "note.notNullAdd": "{table}.{column} 을(를) NOT NULL 로 추가합니다. 기존 행이 있으면 기본값을 먼저 정해야 합니다.",
    "note.oracleOnUpdate": "Oracle 은 ON UPDATE 를 지원하지 않아 해당 절을 뺐습니다.",
    "note.unnamedFk": "이름 없는 외래키는 관례 이름(fk_테이블_컬럼)으로 적었습니다. 실제 제약 이름을 확인하세요.",
    "note.unnamedUnique": "이름 없는 고유 제약은 관례 이름(uq_테이블_컬럼)으로 적었습니다. 실제 이름을 확인하세요.",
    "note.unnamedIndex": "이름 없는 인덱스는 관례 이름(idx_테이블_컬럼)으로 적었습니다. 실제 이름을 확인하세요.",
    "note.pkName": "{table} 의 기본키 제약 이름을 {name} 으로 가정했습니다. 실제 이름을 확인하세요.",
    "note.mssqlDefault":
      "SQL Server 의 기본값은 이름 있는 제약입니다. {table}.{column} 은 기존 DEFAULT 제약을 먼저 지워야 합니다.",
    "note.mssqlSchema": "SQL Server 컬럼 설명의 스키마를 dbo 로 가정했습니다.",
    "note.sqliteComment": "SQLite 는 컬럼 설명 구문이 없어 주석으로만 남겼습니다.",
    "note.sqliteAuto": "SQLite 자동 증가는 INTEGER 만 허용해 {column} 의 타입을 {type} 에서 INTEGER 로 바꿨습니다.",
    "note.sqliteAutoNonPk": "SQLite 는 기본키가 아닌 {column} 의 자동 증가를 표현하지 못합니다.",
    "note.sqliteRecreate": "SQLite 라서 {count}개 테이블은 ALTER 로 바꾸지 못하고 재생성해야 합니다.",
    "ddl.commentLine": "{table}.{column} 설명: {text}",

    "dialect.sqlite": "SQLite (제한)",

    "search.hits": "{count}개",
    "search.none": "없음",

    "sample.v1": SAMPLE_KO,
    "sample.v2": SAMPLE_V2_KO
  };

  const en = {
    "meta.title": "DBSchemaView — visualize and compare DB schemas",
    "meta.description":
      "DBSchemaView draws an ER diagram from pasted CREATE TABLE statements and compares two schemas to generate migration DDL",

    "header.home": "DBSchemaView home",
    "header.privacy": "Your schema never leaves the browser",
    "header.themeTitle": "Switch colour theme",
    "header.themeToDark": "Switch to dark mode",
    "header.themeToLight": "Switch to light mode",
    "header.language": "Language",

    "hero.title": '<span class="sql-token">CREATE TABLE</span> in,<br><em>ER diagram out.</em>',
    "hero.copy.single":
      "Paste your CREATE TABLE statements as they are. DBSchemaView reads columns, keys and foreign keys and draws them as an ER diagram. When a schema has no foreign keys, relations are guessed from column names.",
    "hero.copy.compare":
      "Paste the before and after schemas side by side. DBSchemaView points out every changed table and column, and writes the migration DDL that turns SOURCE into TARGET in the dialect you pick.",
    "hero.dialects": "Supported dialects",

    "workspace.aria": "Schema input",
    "mode.aria": "Working mode",
    "mode.single": "Single schema",
    "mode.compare": "Compare schemas",
    "mode.note.single": "Reads one DDL and draws an ER diagram.",
    "mode.note.compare": "Compares two schemas into a change list and migration DDL. You can drop both files at once.",
    "swap.label": "Swap sides",
    "swap.title": "Swap SOURCE and TARGET",

    "panel.source.single": "DDL INPUT",
    "panel.source.compare": "SOURCE · base",
    "panel.target": "TARGET · goal",
    "panel.sample": "Load sample",
    "panel.clear": "Clear",
    "panel.openFile": "Open file",
    "panel.ddlAria": "Table structure DDL",
    "panel.targetDdlAria": "DDL to compare against",
    "panel.targetPlaceholder": "Paste the schema you want to end up with.",
    "panel.targetFooter": "Drop 1 or 2 files · this is the shape to reach",
    "panel.targetDropTitle": "Drop one or two files",
    "panel.targetDropNote": "Two files go to SOURCE and TARGET automatically",
    "panel.meta.sample": "Sample · {count} tables",
    "panel.meta.tables": "{count} tables",
    "panel.meta.empty": "No tables parsed",

    "drop.single.hint": "Drop a .sql or SQLite .db file · paste works too",
    "drop.single.title": "Drop a SQL or SQLite file",
    "drop.single.note": "A .db file is read for the schema stored inside it",
    "drop.compare.hint": "Drop 1 or 2 files · paste works too",
    "drop.compare.title": "Drop one or two files",
    "drop.compare.note": "Two files go to SOURCE and TARGET automatically",

    "options.rules": "Parsing rules",
    "options.infer": "Guess relations",
    "options.inferNote": "Links <code>user_id</code> → <code>users</code> by name even without a foreign key.",
    "options.showTypes": "Show data types",
    "options.showComments": "Prefer column comments",
    "options.migration": "Migration",
    "options.dialect": "DDL dialect",
    "options.dialectAria": "Migration DDL dialect",
    "options.dialectNote": "The script that turns SOURCE into TARGET is written in this syntax.",
    "options.hideSame": "List changed tables only",
    "options.warningTitle": "Worth checking",
    "action.render.single": "Draw diagram",
    "action.render.compare": "Compare schemas",

    "results.eyebrow.single": "TABLES & RELATIONS",
    "results.eyebrow.compare": "SCHEMA DIFF",
    "results.title.single": "ER DIAGRAM",
    "results.title.compare": "SCHEMA DIFF",
    "results.statsAria": "Schema statistics",
    "state.empty": "No tables to read",
    "state.summary": "{tables} tables · {relations} relations",
    "state.identical": "The two schemas are identical",
    "state.diffSummary": "Tables +{added} · −{removed} · ~{changed}",

    "stat.tables": "Tables",
    "stat.tables.note": "Parsed definitions",
    "stat.columns": "Columns",
    "stat.columns.note": "All fields",
    "stat.explicit": "Declared",
    "stat.explicit.note": "FOREIGN KEY",
    "stat.inferred": "Guessed",
    "stat.inferred.note": "By column name",
    "stat.isolated": "Isolated",
    "stat.isolated.note": "No relation",
    "stat.diff.tables.note": "Both sides",
    "stat.diff.columns": "Column changes",
    "stat.diff.added": "Added",
    "stat.diff.added.note": "TARGET only",
    "stat.diff.changed": "Changed",
    "stat.diff.changed.note": "Content differs",
    "stat.diff.removed": "Removed",
    "stat.diff.removed.note": "SOURCE only",

    "toolbar.columnsAria": "Column display",
    "toolbar.allColumns": "All columns",
    "toolbar.keyColumns": "Key columns",
    "toolbar.searchPlaceholder": "Search tables · columns",
    "toolbar.searchAria": "Search tables or columns",
    "toolbar.zoomAria": "Zoom",
    "toolbar.zoomOut": "Zoom out",
    "toolbar.zoomIn": "Zoom in",
    "toolbar.fit": "Fit",
    "toolbar.fitTitle": "Fit to view",
    "toolbar.relayout": "Re-lay out",
    "toolbar.relayoutTitle": "Lay out automatically",

    "rail.aria": "Table list",
    "rail.empty": "No tables",
    "rail.item": "{columns} columns · {relations} relations",
    "canvas.aria": "Relation diagram. Use the up and down arrow keys to select a table, and Ctrl with the mouse wheel to zoom.",
    "canvas.svgAria": "Table relation diagram",
    "diagram.emptyTitle": "No tables to read",
    "diagram.emptyNote": "Paste CREATE TABLE statements and draw again.",
    "node.more": "+{count} more",

    "legend.aria": "Legend",
    "legend.fk": "Foreign key",
    "legend.inferred": "Guessed",
    "legend.pk": "Primary key",
    "legend.unique": "Unique",
    "legend.diffAria": "Change legend",
    "legend.added": "Added",
    "legend.changed": "Changed",
    "legend.removed": "Removed",
    "legend.same": "Unchanged",

    "report.title": "Change list and migration script",
    "report.copyChanges": "Changes as CSV",
    "report.copyScript": "Copy script",
    "report.saveScript": "Save .sql",
    "report.scriptAria": "Generated migration script",
    "report.notesTitle": "Worth checking",
    "report.statements": "{count} statements",
    "report.noStatements": "Nothing to run",

    "change.empty.noChanges": "No tables changed.",
    "change.empty.noTables": "No tables to read.",
    "change.flag.added": "Added",
    "change.flag.removed": "Removed",
    "change.flag.changed": "Changed",
    "change.flag.same": "Same",
    "change.count": "{count} changes",
    "change.columns": "{count} columns",
    "change.more": "{count} more",
    "change.pk": "PRIMARY KEY",
    "change.unique": "UNIQUE",
    "change.index": "INDEX",
    "change.fk": "FK",
    "change.tableComment": "Table comment",

    "detail.emptyTitle": "Select a table",
    "detail.emptyNote": "Click a table in the diagram or the list on the left to see its columns and relations.",
    "detail.close": "Clear selection",
    "detail.table": "TABLE",
    "detail.key": "Key",
    "detail.column": "Column",
    "detail.type": "Type",
    "detail.null": "NULL",
    "detail.default": "Default",
    "detail.comment": "Comment",
    "detail.noRelations": "No relations attached.",
    "relation.fk": "FK",
    "relation.inferred": "guess",
    "relation.optional": "optional",

    "footer.note.single": "Everything is parsed inside this tab.",
    "footer.note.compare": "The script is written from DDL text alone. Review it before running.",
    "footer.copyRelations": "Copy relations",
    "footer.exportSvg": "Export SVG",
    "footer.exportPng": "Export PNG",

    "features.aria": "What DBSchemaView does",
    "features.1.title": "One reader for every dialect",
    "features.1.body":
      "MySQL backticks, SQL Server brackets, PostgreSQL quotes and array types, Oracle schema qualifiers — all read by the same rules.",
    "features.2.title": "Draws even without relations",
    "features.2.body":
      "When FOREIGN KEY is missing, column names are matched against primary keys to guess relations, drawn as dashed lines.",
    "features.3.title": "The diff, and the DDL to close it",
    "features.3.body":
      "Put production and development schemas side by side to see every changed table and column, and get the ALTER script that turns one into the other in your dialect.",
    "features.4.title": "Entirely local",
    "features.4.body": "No upload server, no account. A pasted schema is parsed in this browser's memory and nowhere else.",

    "toast.sqliteBroken": "This SQLite file is damaged or encrypted, so its schema cannot be read.",
    "toast.sqliteNotRecognized": "This is not recognised as a SQLite file.",
    "toast.sqliteClipped": "Only the first {mb}MB was read, so some tables may be missing.",
    "toast.sqliteNoTables": "This SQLite file has no tables.",
    "toast.sqliteLoaded": "Read {tables} tables{indexes} from SQLite.",
    "toast.sqliteIndexes": " and {count} indexes",
    "toast.fileTooLarge": "This SQL file is too large. Up to {mb}MB is read.",
    "toast.notText": "This is neither a text SQL nor a SQLite file.",
    "toast.readFailed": "Could not read the file.",
    "toast.singleModeDrop": "Only one file was read. Compare mode splits two files into SOURCE and TARGET.",
    "toast.relayout": "Laid out again automatically.",
    "toast.swapped": "Swapped SOURCE and TARGET. Now {source} → {target}.",
    "toast.noDiagram": "There is no diagram to export.",
    "toast.svgSaved": "Exported as SVG.",
    "toast.pngSaved": "Exported as PNG.",
    "toast.pngFailed": "PNG conversion failed.",
    "toast.noRelations": "There are no relations to copy.",
    "toast.relationsCopied": "Copied {count} relations.",
    "toast.clipboardBlocked": "Clipboard access was blocked.",
    "toast.noChanges": "There are no changes to copy.",
    "toast.changesCopied": "Copied {count} changes as CSV.",
    "toast.scriptCopied": "Copied the migration script.",
    "toast.scriptSaved": "Saved the script.",

    "copy.relationsHeader": "# {tables} tables · {relations} relations",
    "csv.kind": "Kind",
    "csv.table": "Table",
    "csv.target": "Target",
    "csv.item": "Item",
    "csv.before": "Before",
    "csv.after": "After",
    "csv.tableRow": "Table",
    "csv.columnRow": "Column {name}",
    "csv.columnCount": "{count} columns",
    "csv.pk": "Primary key",
    "csv.unique": "Unique constraint",
    "csv.index": "Index",
    "csv.fk": "Foreign key",
    "csv.comment": "Table comment",

    "warn.unresolved": "The foreign key on {from} references {target}, which is not defined here.",
    "warn.more": "and {count} more",

    "parse.noName": "Skipped a CREATE TABLE statement whose name could not be read.",
    "parse.noColumns": "{table}: skipped because it has no column definitions.",
    "parse.duplicate": "{table}: defined more than once, so only the last definition is used.",
    "parse.tooLarge": "The input is too large, so only the first {mb}MB was parsed.",
    "parse.statementError": "Skipped one statement after a parsing error: {message}",
    "parse.tooManyTables": "More than {count} tables, so later definitions are not shown.",

    "sqlite.partial": "Part of the file could not be read, so some tables may be missing.",
    "sqlite.internalSkipped": "Skipped {count} internal SQLite tables.",
    "sqlite.headerTitle": "-- Schema extracted from a SQLite database",
    "sqlite.headerMeta": "-- {tables} tables · {indexes} indexes · page {pageSize}B · {encoding}",

    "field.type": "Type",
    "field.nullable": "NULL",
    "field.default": "Default",
    "field.auto": "Auto increment",
    "field.generated": "Generated",
    "field.comment": "Comment",
    "field.action": "Referential action",

    "ddl.header": "-- DBSchemaView migration script",
    "ddl.dialect": "-- Dialect: {dialect}",
    "ddl.direction": "-- Direction: SOURCE → TARGET (brings the base schema up to the goal schema)",
    "ddl.counts":
      "-- Tables +{addedTables} / -{removedTables} / ~{changedTables} · Columns +{addedColumns} / -{removedColumns} / ~{changedColumns} · Foreign keys +{addedRelations} / -{removedRelations}",
    "ddl.caution": "-- Written from DDL text alone. Review it and take a backup before running.",
    "ddl.noSchemas": "-- There is no schema to compare.",
    "ddl.identical": "-- The two schemas are identical. Nothing to generate.",
    "ddl.section.dropFk": "1. Drop foreign keys",
    "ddl.section.dropTable": "2. Drop tables — their data goes with them",
    "ddl.section.addTable": "3. Create tables",
    "ddl.section.columns": "4. Column changes",
    "ddl.section.keys": "5. Primary keys, constraints and indexes",
    "ddl.section.addFk": "6. Add foreign keys",
    "ddl.section.comments": "7. Comments",
    "ddl.dataLoss": "this drops data",
    "ddl.sqliteSection": "SQLite limits — the tables below need recreating",
    "ddl.sqliteLine1": "SQLite cannot change a column type, primary key or constraint with ALTER.",
    "ddl.sqliteLine2": "Create a new table, INSERT SELECT into it, DROP the old one, then RENAME.",

    "note.generated": "{column} is a generated column. Its expression is not kept in the DDL text, so fill it in yourself.",
    "note.notNullAdd": "{table}.{column} is added as NOT NULL. If rows already exist, decide on a default first.",
    "note.oracleOnUpdate": "Oracle does not support ON UPDATE, so that clause was dropped.",
    "note.unnamedFk": "Unnamed foreign keys were written with conventional names (fk_table_column). Check the real constraint names.",
    "note.unnamedUnique": "Unnamed unique constraints were written with conventional names (uq_table_column). Check the real names.",
    "note.unnamedIndex": "Unnamed indexes were written with conventional names (idx_table_column). Check the real names.",
    "note.pkName": "Assumed the primary key constraint on {table} is called {name}. Check the real name.",
    "note.mssqlDefault":
      "Defaults in SQL Server are named constraints. {table}.{column} needs its existing DEFAULT constraint dropped first.",
    "note.mssqlSchema": "Assumed the schema for SQL Server column comments is dbo.",
    "note.sqliteComment": "SQLite has no column comment syntax, so comments were left as remarks.",
    "note.sqliteAuto": "SQLite auto increment allows INTEGER only, so {column} was changed from {type} to INTEGER.",
    "note.sqliteAutoNonPk": "SQLite cannot express auto increment on {column} because it is not the primary key.",
    "note.sqliteRecreate": "Because this is SQLite, {count} tables cannot be altered and must be recreated.",
    "ddl.commentLine": "{table}.{column} comment: {text}",

    "dialect.sqlite": "SQLite (limited)",

    "search.hits": "{count} found",
    "search.none": "none",

    "sample.v1": SAMPLE_EN,
    "sample.v2": SAMPLE_V2_EN
  };

  const DICT = { ko, en };
  let current = "ko";

  function t(key, params) {
    const text = DICT[current][key];
    if (text === undefined) return key;
    if (!params) return text;
    return text.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
  }

  function detect() {
    let saved = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      saved = null;
    }
    if (LANGS.includes(saved)) return saved;
    const preferred = (global.navigator && global.navigator.language) || "";
    return preferred.toLowerCase().startsWith("ko") ? "ko" : "en";
  }

  function setLang(lang) {
    current = LANGS.includes(lang) ? lang : "ko";
    try {
      localStorage.setItem(STORAGE_KEY, current);
    } catch (error) {
      // 저장이 막힌 환경에서는 이번 세션에만 적용한다.
    }
    return current;
  }

  /* data-i18n 계열 속성이 붙은 요소를 현재 언어로 갈아 끼운다. */
  function applyStatic(root) {
    const scope = root || global.document;
    if (!scope) return;

    for (const node of scope.querySelectorAll("[data-i18n]")) {
      node.textContent = t(node.dataset.i18n);
    }
    for (const node of scope.querySelectorAll("[data-i18n-html]")) {
      node.innerHTML = t(node.dataset.i18nHtml);
    }
    for (const [attribute, dataset] of [
      ["placeholder", "i18nPlaceholder"],
      ["title", "i18nTitle"],
      ["aria-label", "i18nLabel"],
      ["content", "i18nContent"]
    ]) {
      for (const node of scope.querySelectorAll(`[data-${dataset.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}]`)) {
        node.setAttribute(attribute, t(node.dataset[dataset]));
      }
    }
  }

  global.DBSchemaI18n = { t, setLang, getLang: () => current, detect, applyStatic, LANGS };
})(globalThis);
