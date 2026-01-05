# DBGridy v1.0.4 Release Notes

## New Features

### SSH/SFTP Browser
- SSH terminal connection support
- SFTP file browser (upload/download/delete/rename)
- Drag & Drop file transfer
- Symbolic link support
- Copy SSH Command menu
- Current folder selection dialog

### WSL (Windows Subsystem for Linux) Support
- WSL terminal connection
- WSL file browser
- WSL file copy/edit support
- Open WSL files in editor tab

### Terminal in Tab
- Open SSH/WSL terminals as tabs
- Terminal tab state save/restore
- Terminal tab context menu support
- Auto switch to query tab when executing from terminal

### TreeView Filtering
- Filter tables/views/procedures/functions/triggers by name
- All SQL DB support (MySQL, PostgreSQL, MSSQL, ClickHouse, SQLite)
- MongoDB collection filtering support
- Tab key to switch between filter and TreeView

### Oracle Database Support
- Oracle connection and table queries

### Editor Font Selection
- Editor font family selection dialog

---

![Terminal in tab](terminal.png)

---

## Improvements

- **Column Sorting**: Improved sort triangle display, refresh full data on sort
- **Double-click Selection**: Improved word separator (removed `/`)
- **Clipboard**: Auto-allow clipboard permission on paste
- **Max Result Rows**: Increased to 1 million rows
- **SQL Variables**: `SET @var` available for all SQL databases
- **Web Links**: Open URLs with Ctrl+Click
- **Column Width**: FitColumnWidthsOptimized performance improvement

---

## Bug Fixes

- Disabled PgDn Load More for editor query execution
- Fixed left/right panel context menu focusing
