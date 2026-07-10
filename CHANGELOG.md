# Changelog

All notable changes to Casterm will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Protocol Support
- [x] FTP file transfer
- [ ] RDP (Remote Desktop)
- [ ] VNC connections
- [ ] Telnet support
- [ ] Serial port connections

### Advanced Features
- [ ] Expect scripting automation
- [ ] Macros and snippets
- [ ] Port forwarding (SSH tunnels)
- [ ] Proxy jump (bastion hosts)
- [ ] Connection templates

### Security
- [x] Credential encryption
- [x] Master password
- [ ] KeePassXC integration
- [ ] Automatic lock

### Cluster Operations
- [ ] Multi-session broadcasting
- [ ] Synchronized input
- [ ] Cluster groups

### Release / Distribution
- [ ] Code signing for Windows (certificate-based)
- [ ] Code signing for macOS (Apple Developer ID + notarization)
- [ ] Linux package signing (GPG for AppImage, deb, rpm)
- [ ] GitHub Actions automated release builds
- [ ] Auto-updater with Tauri signing keys

---

## [0.9.3-beta] - 2026-07-09

### Security: Encryption Support

**Master Password Encryption**
- Added AES-256-GCM encryption for connection data
- PBKDF2 key derivation with 100,000 iterations
- Master password setup on first run (optional)
- Unlock dialog for encrypted data on app start
- Change password functionality
- Reset data option if password forgotten
- Visual indicator when encryption is active (🔒)

**Security Improvements**
- Connection passwords are now encrypted at rest
- No plaintext storage of sensitive data
- Export produces unencrypted JSON for portability

**License Change**
- Changed from MIT License to GNU GPL v3
- Ensures open source distribution of derivative works

### Technical Details

**New Files:**
- `src/crypto.ts` - Web Crypto API encryption utilities (~150 lines)
- `src/master-password-dialog.ts` - Master password UI (~400 lines)

**Updated Files:**
- `src/connection-tree.ts` - Integrated encryption/decryption
- `src/main.ts` - Encryption initialization flow
- Version bumped to 0.9.3-beta

---

## [0.9.2-beta] - 2026-07-09

### Bug Fixes

**Session Save**
- Fixed session save functionality using native file dialog
- Now uses Tauri's dialog plugin for proper file saving
- Added better error handling and user feedback

**SSH Key Input**
- Improved SSH private key path input field
- Added monospace font for better visibility of special characters
- Added example text below the input field
- Fixed input attributes to prevent unwanted autocorrection
- Added input logging for debugging

### Technical Changes

**New Dependencies:**
- `@tauri-apps/plugin-dialog` ^2.0.0 - Native file dialogs

**Updated Files:**
- `src-tauri/Cargo.toml` - Added dialog plugin dependency
- `src-tauri/src/lib.rs` - Added save_session_dialog command
- `src/terminal-manager.ts` - Updated saveActiveSession to use native dialog
- `src/main.ts` - Updated to handle async save
- `src/connection-dialog.ts` - Improved SSH key input field
- `package.json` - Version bump to 0.9.2-beta

---

## [0.9.1-beta] - 2026-07-09

### Bug Fixes & UI Improvements

Fixed session save functionality, terminal overflow issues, and added theme customization.

#### Fixed

**Session Save**
- Fixed buffer iteration to properly capture all terminal output including scrollback
- Session content now correctly exports to text file

**Terminal Overflow**
- Fixed terminal extending beyond screen bounds in maximized mode
- Added proper flex container constraints (`min-height: 0`)
- Terminal viewport now stays within window boundaries

#### Added

**Resizable Connections Panel**
- Drag handle between sidebar and terminal area for horizontal resizing
- Sidebar width persisted in settings (150px - 600px range)
- Double-click handle to reset to default width (250px)
- Connection names no longer wrap - uses ellipsis for overflow

**Theme Customization**
- Ubuntu Aubergine theme as default (dark aubergine #300924 with white text)
- New "Theme" tab in Settings dialog
- Color preset selector: Ubuntu Aubergine, Classic Dark, Light, Custom
- Background and foreground color pickers with hex input
- Live preview of theme changes
- Advanced ANSI color customization
- Reset to Ubuntu theme button
- Terminal theme syncs with UI background color

**Version Display**
- Version number (v0.9.1-beta) shown in status bar at bottom right

#### Changed

- Default terminal theme changed from VS Code Dark+ to Ubuntu Aubergine
- Settings dialog now has 4 tabs: Appearance, Terminal, Behavior, Theme

#### Technical Details

**Updated Files:**
- `src/terminal-manager.ts` - Fixed session save, use theme from settings
- `src/main.ts` - Added sidebar resize handling
- `src/settings.ts` - Added TerminalTheme interface and Ubuntu/Dark/Light themes
- `src/settings-dialog.ts` - Added Theme tab with color customization
- `src/styles.css` - Added resize handle styles, fixed overflow issues, Ubuntu colors as default

---

## [0.9.0] - 2026-01-08

### Beta Release - Production Ready

Pre-1.0 beta release with robust error handling and polish.

#### Added

**Error Handling & Validation**
- Settings validation on load (recovers from corrupted settings)
- Prevent multiple settings dialogs from opening
- Graceful handling of localStorage errors
- Input validation for all settings fields

**Logging**
- Reduced console spam by filtering to warnings/errors only
- SSH debug logs suppressed in default builds

**Security & Polish**
- DevTools now only available in debug builds
- Removed debug alerts and console spam
- Clean error messages for users

**Documentation**
- Updated README with accurate feature list
- Clear changelog for beta release

#### Changed

- Version bumped to 0.9.0 for beta release
- Streamlined settings initialization

---

## [0.3.0] - 2026-01-08

### Phase 3: Production Readiness & Polish

Added settings persistence, themes, and UI improvements.

#### Added

**Settings System**
- Settings dialog with tabs (Appearance, Terminal, Behavior)
- Persistent user preferences in localStorage
- Working Save/Cancel/Reset/Close buttons
- Theme switching (Dark/Light/System) with live preview
- Font family and size customization
- Cursor style (Block/Line/Bar) and blink settings
- Scrollback buffer size configuration
- Word wrap toggle
- Confirm close / auto-reconnect / status bar toggles

**Theming**
- Dark theme (default)
- Light theme
- System preference detection
- CSS variables for easy theming
- Live preview when changing themes

**DevTools**
- Toggle DevTools with Shift+Right Click

**UI Improvements**
- Settings button (⚙) in toolbar
- Fullscreen mode (F11)
- Better status bar integration

#### Fixed

- Settings save now works - uses inline `onclick` handlers for Tauri WebView compatibility
- Cancel button now works - closes dialog without saving
- Reset button now works - resets all settings to defaults with confirmation
- Close (X) button now works - closes dialog
- Theme changes apply immediately with live preview

#### Technical Details

**New Files:**
- `src/settings.ts` - Settings management (~120 lines)
- `src/settings-dialog.ts` - Settings UI (~400 lines)

**Updated Files:**
- `src/main.ts` - Settings integration
- `src/terminal-manager.ts` - Apply settings API
- `src/styles.css` - CSS variables and light theme
- `README.md` - Updated documentation

**Lines of Code:**
- TypeScript (frontend): ~2,100 lines (+500)
- **Total: ~3,300 lines**

---

## [0.2.2] - 2026-01-08

### Phase 2.2: FTP & SFTP Client

Added FTP and SFTP file transfer capabilities.

#### Added

**FTP Client**
- Full FTP support via `suppaftp` library
- Browse remote directories
- Download files from remote server
- Upload files to remote server
- Create and delete directories
- Delete files

**SFTP Client**
- Full SFTP support via `ssh2` library
- SSH-based secure file transfer
- Password and key-based authentication
- Same browser interface as FTP

**File Browser UI**
- Modal file browser interface
- Works with both FTP and SFTP
- File/folder icons and size display
- Download/Upload/Delete actions
- New folder creation
- Path navigation
- Human-readable file sizes

**Connection Support**
- FTP connection type (port 21)
- SFTP connection type (port 22)
- Username/password authentication
- SSH key support for SFTP
- Anonymous FTP support

#### Technical Details

**New Dependencies:**
- `suppaftp` ^5.2 - FTP client
- `ssh2` ^0.9 - SSH/SFTP client

**New Files:**
- `src-tauri/src/ftp.rs` - FTP client implementation (~300 lines)
- `src-tauri/src/sftp.rs` - SFTP client implementation (~250 lines)
- `src/ftp-browser.ts` - File browser UI (~350 lines)

**Updated Files:**
- `src/connection-dialog.ts` - Added FTP/SFTP types
- `src/connection-tree.ts` - Connection handling
- `src-tauri/src/lib.rs` - Command registration
- `src-tauri/Cargo.toml` - New dependencies

**Lines of Code:**
- Rust (backend): ~1,000 lines (+400)
- TypeScript (frontend): ~1,600 lines (+400)
- **Total: ~2,800 lines**

---

## [0.2.1] - 2026-01-08

### Phase 2.1: Folder Management & Session Saving

Added folder organization and session saving capabilities.

#### Added

**Folder Management**
- Create folders to organize connections
- Move connections between folders
- Folder selection in connection dialog
- Visual folder indicators in connection tree
- Support for nested folders

**Session Saving**
- Save terminal session output to file
- Automatic filename with timestamp
- One-click export via toolbar button
- Works with both local and SSH sessions

**UI Improvements**
- 📁 New Folder button in sidebar header
- 📁 Move button on each connection
- 💾 Save Session button in toolbar
- Connection action buttons (move, edit, delete)

#### Technical Details

**Updated Files:**
- `src/connection-tree.ts` - Folder management methods
- `src/connection-dialog.ts` - Folder selection dropdown
- `src/terminal-manager.ts` - Session save functionality
- `src/main.ts` - New toolbar buttons

**Lines of Code:**
- TypeScript (frontend): ~1,200 lines (+200)
- **Total: ~2,200 lines**

---

## [0.2.0] - 2026-01-08

### Phase 2: SSH Support & Enhanced UI

Major update with SSH connection support and significant UI improvements.

#### Added

**SSH Client**
- Full SSH connection support via `russh` library
- Password authentication with optional credential saving
- Private key authentication (RSA, ED25519)
- Host key verification (accept/prompt)
- PTY allocation for interactive sessions
- Terminal resize support for SSH sessions
- Connection status indicators

**Connection Management**
- New connection dialog with rich UI
- Connection type selection (SSH, Local)
- Authentication method selection (Password, Key)
- Search/filter connections in sidebar
- Connection grouping with folders
- Import/export connections (JSON format)
- Drag-and-drop ready structure

**UI Improvements**
- Redesigned connection tree with hover actions
- Connection search bar
- Tab icons indicating connection type (⌨ local, 🔒 SSH)
- Status bar showing active connection info
- Dialog animations (fade/slide)
- Improved form styling
- CSS variables for theming support

**Terminal Improvements**
- Copy/paste with Ctrl+Shift+C/V
- Better color theme (bright colors added)
- Improved terminal resize handling
- Session cleanup on tab close

**Keyboard Shortcuts**
- `Ctrl+B` - Toggle sidebar
- `Ctrl+Shift+T` - New connection dialog
- `Ctrl+Shift+C` - Copy selection
- `Ctrl+Shift+V` - Paste

#### Technical Details

**New Dependencies:**
- `russh` ^0.46 - Async SSH client
- `russh-keys` ^0.46 - SSH key handling
- `tokio` ^1 - Async runtime
- `async-trait` ^0.1 - Async traits
- `thiserror` ^1.0 - Error handling
- `anyhow` ^1.0 - Error context

**New Files:**
- `src/ssh.rs` - SSH client implementation (~300 lines)
- `src/connection-dialog.ts` - Connection UI (~250 lines)
- `casterm.sh` - Launcher script (~250 lines)
- `INSTALL.md` - Installation guide

**Lines of Code:**
- Rust (backend): ~600 lines (+400)
- TypeScript (frontend): ~1000 lines (+400)
- CSS: ~400 lines (+100)
- **Total: ~2,000 lines** (+900)

#### Bug Fixes
- Fixed permission errors with Tauri 2 event system
- Fixed RGBA icon format requirement
- Fixed connection tree rendering issues

---

## [0.1.0] - 2026-01-08

### Phase 1: MVP Release

Initial release with core terminal emulator functionality.

#### Added
- **Terminal Core**
  - PTY support via `portable-pty` for cross-platform shell spawning
  - xterm.js integration with WebGL rendering
  - 256-color theme support (VS Code Dark+ inspired)
  - Terminal resize handling
  - Scrollback buffer (10,000 lines)
  
- **Tab Management**
  - Multiple terminal tabs
  - Tab creation (Ctrl+T)
  - Tab closing (Ctrl+W)
  - Active tab highlighting
  - Tab overflow scrolling
  
- **Connection Tree**
  - Sidebar with collapsible groups
  - Connection icons by type (local, SSH, telnet, VNC, RDP)
  - Add/Edit/Delete connections
  - LocalStorage persistence
  - Sample connection groups (Production, Development)
  
- **UI/UX**
  - Modern dark theme interface
  - Toolbar with quick actions
  - Status bar showing shell and PID
  - Collapsible sidebar
  - Responsive layout
  
- **Keyboard Shortcuts**
  - Ctrl+T: New tab
  - Ctrl+W: Close tab
  
- **Cross-Platform Support**
  - Windows: ConPTY support
  - macOS: forkpty support
  - Linux: forkpty support
  
- **Development Setup**
  - Tauri 2 project structure
  - TypeScript configuration
  - Vite build system
  - Hot reload development

#### Technical Details

**Dependencies:**
- `@tauri-apps/api` ^2.0.0
- `@xterm/xterm` ^5.5.0
- `@xterm/addon-fit` ^0.10.0
- `@xterm/addon-webgl` ^0.18.0
- `portable-pty` ^0.8 (Rust)
- `tauri` ^2.0 (Rust)

**Lines of Code:**
- Rust (backend): ~200 lines
- TypeScript (frontend): ~600 lines
- CSS: ~300 lines
- **Total: ~1,100 lines**

**Build Size:**
- Development: ~2MB
- Production (estimated): ~8-12MB

---

## Design Decisions

### Why Tauri 2?
- Smaller bundle size vs Electron (~10MB vs ~150MB)
- Native performance for PTY operations
- Memory safety with Rust
- Modern web frontend development

### Why xterm.js?
- Industry standard (VS Code, Hyper, etc.)
- Battle-tested terminal emulation
- WebGL acceleration support
- Active maintenance

### Why portable-pty?
- Abstracts platform differences
- Well-tested in WezTerm
- ConPTY/WinPTY/forkpty unified API
- Rust-native integration

### Why russh?
- Pure Rust SSH implementation
- Async/await support
- Active development
- Good integration with Tauri's async model

---

## Migration Notes

### From Phase 1 to Phase 2
Phase 2 adds SSH support while maintaining full backward compatibility:
- Existing local connections continue to work
- Connection storage format unchanged
- New SSH connections use extended schema

### Breaking Changes
None in Phase 2. All Phase 1 features work identically.
