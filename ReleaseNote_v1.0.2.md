DBGridy v1.0.2 Release Notes
============================
Date: 2025-12-12
Status: Feature Update

This release introduces a new suite of Utility Tools, adds the Compare Mode functionality, and improves tab management in split view.

---

## New Features

### 🛠 Utility Tools
A comprehensive collection of developer tools has been added to the **"Co(n)vert Util"** menu to assist with data manipulation and inspection directly within the editor:

#### Text & Case Transformation
* **Case Conversion**: Quickly convert text to **UPPERCASE** or **lowercase**.
* **Whitespace Management**: Added "Remove Whitespace" utility.

#### Date & Time Operations
* **Unix Timestamp**: Insert current UnixTimestamp and convert between UnixTimestamp <-> UTC DateTime.
* **Date Formats**: Convert between ISO8601 <-> DB DateTime formats.

#### Encoding & Decoding
* **Base64**: Support for Base64 Encode, Decode, and toggling between Text <-> Base64.
* **URL**: Support for URL Encode, Decode, and toggling between Text <-> URL.
* **UTF-8**: Bidirectional conversion between Text <-> UTF-8 Hex.

#### Numeric & Data Conversion
* **Hex/Decimal**: Convert values between Hex <-> Decimal.

#### UUID Management
* **Generation**: Generate New UUIDs instantly.
* **Formatting**: Toggle UUIDs between "No Hyphens" and "Uppercase/Lowercase" formats.
* **Inspection**: View UUID Summary.

#### Security, Web & Developer Tools
* **JWT Tools**: Full support for **JWT Generate** and **JWT Decode**.
* **Encryption & Hash**:
    * **AES Encrypt/Decrypt**: Encrypt and decrypt text using AES.
    * **Hash**: Generate hash values.
* **JSON**: **JsonPath Tester** to evaluate expressions against JSON data.

---

### Tab Management Improvements

- **Right Panel Tab**
  - Added functionality to move query tabs to the right panel.

---

### Compare Mode

- **Character-Level Diff Highlighting**
  - Differences are now highlighted at the character level, including whitespace (spaces and tabs)
  - Uses distinct colors for added (green) and removed (red) characters

- **Line Copy Between Editors**
  - Alt+Right: Copy current line from left editor to right editor
  - Alt+Left: Copy current line from right editor to left editor

- **Diff Navigation**
  - Alt+Up: Navigate to previous difference
  - Alt+Down: Navigate to next difference

- **Manual Refresh**
  - F5: Manually refresh diff comparison (replaces auto-refresh on line change)


---------------------------------------------------------------------
Thank you for using DBGridy!
