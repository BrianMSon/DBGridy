# DBGridy v1.0.4 Release Notes

---

## v1.0.4
**Date:** 2026-01-10
**Status:** Major Feature Update

### New Features

#### SSH/SFTP Browser
- SSH terminal connection support
- SFTP file browser (upload/download/delete/rename)
- Drag & Drop file transfer
- Symbolic link support
- Copy SSH Command menu
- Current folder selection dialog

#### WSL (Windows Subsystem for Linux) Support
- WSL terminal connection
- WSL file browser
- WSL file copy/edit support
- Open WSL files in editor tab

#### Terminal in Tab
- Open SSH/WSL terminals as tabs
- Terminal tab state save/restore
- Terminal tab context menu support
- Auto switch to query tab when executing from terminal

#### TreeView Filtering
- Filter tables/views/procedures/functions/triggers by name
- All SQL DB support (MySQL, PostgreSQL, MSSQL, ClickHouse, SQLite)
- MongoDB collection filtering support
- Tab key to switch between filter and TreeView

#### Oracle Database Support
- Oracle connection and table queries

#### Editor Font Selection
- Editor font family selection dialog

### Improvements
- **Column Sorting**: Improved sort triangle display, refresh full data on sort
- **Double-click Selection**: Improved word separator (removed `/`)
- **Clipboard**: Auto-allow clipboard permission on paste
- **Max Result Rows**: Increased to 1 million rows
- **SQL Variables**: `SET @var` available for all SQL databases
- **Web Links**: Open URLs with Ctrl+Click
- **Column Width**: FitColumnWidthsOptimized performance improvement

### Bug Fixes
- Disabled PgDn Load More for editor query execution
- Fixed left/right panel context menu focusing

![Terminal in tab](terminal.png)

---

## v1.0.3
**Date:** 2025-12-16
**Status:** Maintenance Update

### Improvements

#### Supported Icons
Icon resources have been added for TreeView:
- Table
- View
- Procedure
- Trigger

### Technical Changes
- Improved additional loading performance of DataGridView

---

## v1.0.2
**Date:** 2025-12-12
**Status:** Feature Update

### New Features

#### Utility Tools
A comprehensive collection of developer tools added to the **"Co(n)vert Util"** menu:

**Text & Case Transformation**
- **Case Conversion**: Convert text to UPPERCASE or lowercase
- **Whitespace Management**: Remove Whitespace utility

**Date & Time Operations**
- **Unix Timestamp**: Insert current UnixTimestamp, convert UnixTimestamp <-> UTC DateTime
- **Date Formats**: Convert ISO8601 <-> DB DateTime formats

**Encoding & Decoding**
- **Base64**: Base64 Encode, Decode, toggle Text <-> Base64
- **URL**: URL Encode, Decode, toggle Text <-> URL
- **UTF-8**: Bidirectional conversion Text <-> UTF-8 Hex

**Numeric & Data Conversion**
- **Hex/Decimal**: Convert Hex <-> Decimal

**UUID Management**
- **Generation**: Generate New UUIDs
- **Formatting**: Toggle UUIDs between "No Hyphens" and "Uppercase/Lowercase"
- **Inspection**: View UUID Summary

**Security, Web & Developer Tools**
- **JWT Tools**: JWT Generate and JWT Decode
- **Encryption & Hash**: AES Encrypt/Decrypt, Hash generation
- **JSON**: JsonPath Tester for JSON expressions

#### Tab Management Improvements
- Added functionality to move query tabs to the right panel

#### Compare Mode
- **Character-Level Diff Highlighting**: Differences highlighted at character level including whitespace
- **Line Copy Between Editors**:
  - `Alt+Right`: Copy current line from left to right editor
  - `Alt+Left`: Copy current line from right to left editor
- **Diff Navigation**:
  - `Alt+Up`: Navigate to previous difference
  - `Alt+Down`: Navigate to next difference
- **Manual Refresh**: `F5` to manually refresh diff comparison

---

## v1.0.1 (Initial Release)
**Date:** 2025-12-05
**Status:** Initial Release

### Key Features

#### Multi-Database Support
Connect to and manage various database systems:

**Relational Databases (SQL):**
- MySQL
- MS-SQL (SQL Server)
- PostgreSQL
- SQLite
- ClickHouse

**NoSQL / Key-Value Stores:**
- MongoDB
- Redis

#### Powerful Grid Editor
- **Unified Grid Interface**: Edit records in Excel-like grid
- **Direct Data Editing**: Modify data without writing UPDATE statements
- **Blob Support**: View and edit binary data with Blob-to-Hex conversion

#### Advanced Query Editor
- **Syntax Highlighting**: Intelligent coloring for SQL and JSON queries
- **Multi-Tab Support**: Run multiple queries simultaneously in different tabs
- **Bulk Operations**: "Merge INSERT Statements" tool for bulk data entry

#### Visualization & UI
- **Theme Support**: Light and Dark themes
- **JSON Formatter**: Built-in pretty-printer for JSON data
- **Tree View Navigation**: Visual tree for database schemas and Redis keys

#### Data Management & Export
Export grid data to:
- CSV
- SQL (Insert statements)
- JSON
- TXT

#### Utility Tools
- **JWT Generator**: Create JWTs with HS256, HS384, HS512 algorithms
- **UUID Generator**: Generate V1, V4, V6, and V7 UUIDs
- **Base64 & Hash**: Base64 encode/decode, Hash generation (MD5, SHA-1, SHA-256/512, SHA-3, CRC32/64)
- **URL Encode/Decode**: Convert to/from URL-encoded format
- **Unix Timestamp Converter**: Convert Unix timestamps <-> UTC DateTimes

### System Requirements
- **OS:** Windows (Native WinForms Application)
- **Framework:** .NET 6.0 or later

---

Thank you for using DBGridy!
