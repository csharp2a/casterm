# Casterm

A modern, cross-platform connection and terminal manager built with Tauri 2, Rust, and xterm.js. Designed for speed, simplicity, and productivity.

![Version](https://img.shields.io/badge/version-0.9.5-blue)
> See [BUILD.md](BUILD.md) for build instructions.
![License](https://img.shields.io/badge/license-GPL%20v3-blue)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux-lightgrey)

## Features

### Phase 1 (Current)
- ✅ **Multi-tab terminal support** - Work with multiple sessions
- ✅ **PTY management** - Native pseudoterminal via `portable-pty`
- ✅ **xterm.js rendering** - WebGL-accelerated terminal with 256 colors
- ✅ **Connection tree** - Organize local and remote connections
- ✅ **Cross-platform** - Windows (ConPTY), Linux (forkpty)
- ✅ **Keyboard shortcuts** - Ctrl+T new tab, Ctrl+W close tab

### Phase 2 (New)
- ✅ **SSH connections** - Full SSH client with password and key auth
- ✅ **FTP/FTPS client** - Browse, upload, download files via FTP
- ✅ **SFTP client** - SSH File Transfer Protocol support
- ✅ **Settings system** - Persistent user preferences with working Save/Cancel/Reset
- ✅ **Themes** - Ubuntu Aubergine (default), Classic Dark, Light, and custom colors
- ✅ **Resizable sidebar** - Drag to resize connections panel
- ✅ **Connection dialog** - Rich UI for configuring connections
- ✅ **Search/filter** - Find connections quickly
- ✅ **Import/export** - Backup and share connection configs
- ✅ **Copy/paste** - Clipboard integration with keyboard shortcuts
- ✅ **Improved UI** - Better styling and hover actions
- ✅ **Folder management** - Organize connections in folders
- ✅ **Session saving** - Export terminal output to file
- ✅ **Theme customization** - Ubuntu Aubergine default with custom color support
- ✅ **Resizable sidebar** - Drag to resize connections panel
- ✅ **Encryption** - Master password with AES-256-GCM for connection data

### Planned (Future Phases)
- ✅ **FTP client** - Browse, upload, download files via FTP
- RDP/VNC integration
- Expect scripting automation
- KeePassXC integration
- Cluster connections
- Session logging

## Architecture

```
┌─────────────────────────────────────────┐
│  Frontend: TypeScript + xterm.js        │
│  - Terminal rendering (WebGL)           │
│  - Tab management                       │
│  - Connection tree UI                   │
│  - Settings persistence                 │
├─────────────────────────────────────────┤
│  Backend: Rust (Tauri 2)                │
│  - portable-pty: Local PTY management   │
│  - russh: SSH client implementation     │
│  - Cross-platform process spawning      │
│  - Native window integration            │
│  - Secure storage API                   │
└─────────────────────────────────────────┘
```

## Quick Start

### Prerequisites
- [Rust](https://rustup.rs/) 1.70+
- [Node.js](https://nodejs.org/) 18+

### Installation

Using the provided launcher script:

```bash
# Clone the repository
git clone https://github.com/yourusername/casterm.git
cd casterm

# Install all dependencies
./casterm.sh install-deps

# Run in development mode
./casterm.sh dev

# Build for production
./casterm.sh build
```

Or manually:

```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

### Platform-Specific Notes

**Windows:**
- Requires Windows 10 build 19041+ for ConPTY support
- Falls back to WinPTY on older versions

**Linux:**
- See [INSTALL-LINUX.md](INSTALL-LINUX.md) for installation instructions
- **Recommended:** Use the AppImage for easiest distribution
- .deb and .rpm packages available but require dependency installation

## Development

### Project Structure
```
casterm/
├── src/                          # Frontend TypeScript
│   ├── main.ts                  # App entry point
│   ├── terminal-manager.ts      # Tab/terminal management
│   ├── connection-tree.ts       # Connection sidebar
│   ├── connection-dialog.ts     # Connection configuration UI
│   ├── ftp-browser.ts           # FTP/SFTP file browser
│   ├── settings.ts              # Settings management
│   ├── settings-dialog.ts       # Settings UI
│   └── styles.css              # App styling
├── src-tauri/                   # Rust backend
│   ├── src/
│   │   ├── lib.rs              # PTY commands
│   │   ├── ssh.rs              # SSH client implementation
│   │   ├── ftp.rs              # FTP client implementation
│   │   └── sftp.rs             # SFTP client implementation
│   ├── Cargo.toml              # Rust dependencies
│   └── tauri.conf.json         # Tauri configuration
├── package.json                # Node dependencies
├── casterm.sh                  # Launcher script
└── INSTALL.md                  # Detailed installation guide
```

### Logging

By default, only warnings and errors are logged to reduce console spam. To enable debug logging (for SSH troubleshooting), edit `src-tauri/src/lib.rs` and change `Warn` to `Debug` in the log builder.

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+T` | New local tab |
| `Ctrl+Shift+T` | New connection |
| `Ctrl+W` | Close current tab |
| `Ctrl+B` | Toggle sidebar |
| `Ctrl+Shift+C` | Copy selection |
| `Ctrl+Shift+V` | Paste |
| `Ctrl+Tab` | Next tab |
| `Ctrl+Shift+Tab` | Previous tab |
| `Ctrl+Comma` | Open Settings |
| `F11` | Toggle fullscreen |

**DevTools:** Shift+Right Click to toggle DevTools for debugging.

### Tech Stack

- **Tauri 2**: Cross-platform desktop framework
- **Rust**: Systems programming for PTY and SSH
- **TypeScript**: Frontend type safety
- **xterm.js**: Terminal emulation (same as VS Code)
- **portable-pty**: Cross-platform PTY abstraction
- **russh**: Async SSH client library
- **suppaftp**: FTP client library
- **ssh2**: SSH/SFTP client library
- **Vite**: Fast development server

## SSH Connection Setup

### Password Authentication
1. Click "+" in the Connections sidebar
2. Select "SSH" as the type
3. Enter host, port (default: 22), and username
4. Choose "Password" authentication
5. Optionally save password (or leave empty to prompt)

### Key Authentication
1. Create a new SSH connection
2. Select "Private Key" authentication
3. Enter the path to your private key (e.g., `~/.ssh/id_rsa`)
4. If your key has a passphrase, it will be prompted at connection time

### Import/Export
Export your connections to JSON for backup:
```bash
# Click the export button in the toolbar
# or use the API
```

Import connections from a JSON file:
```bash
# Click the import button in the toolbar
```

## Folder Management

Organize your connections into folders for easy access:

### Create a Folder
1. Click the 📁 button in the Connections sidebar header
2. Enter a folder name
3. The folder appears in the tree, ready for connections

### Move Connections
1. Hover over any connection
2. Click the 📁 (Move) button that appears
3. Select the destination folder (or 0 for root)

### Create Connection in Folder
1. Click + to add a new connection
2. Select the folder from the "Folder" dropdown
3. Save - the connection is placed in that folder

## Settings & Customization

Press `Ctrl+,` or click the ⚙ button in the toolbar to open Settings.

**DevTools:** Shift+Right Click anywhere to toggle DevTools (for debugging).

### Appearance Tab
- **UI Theme**: Dark, Light, or System preference for the application UI
- **Font Family**: Change terminal font (JetBrains Mono default)
- **Font Size**: Adjustable from 10px to 24px

### Theme Tab
- **Color Preset**: Ubuntu Aubergine (default), Classic Dark, Light, or Custom
- **Background Color**: Terminal background color picker
- **Foreground Color**: Terminal text color picker
- **Advanced Colors**: Customize individual ANSI colors
- **Live Preview**: See changes before saving
- **Reset**: One-click reset to Ubuntu Aubergine theme

### Terminal Tab
- **Cursor Style**: Block, Line, or Bar
- **Cursor Blink**: Enable/disable blinking
- **Scrollback Lines**: Buffer size (1,000 - 50,000)
- **Word Wrap**: Wrap long lines

### Behavior Tab
- **Confirm Close**: Warn before closing tabs
- **Auto-reconnect**: Automatically reconnect on disconnect
- **Show Status Bar**: Toggle status bar visibility

### Using the Settings Dialog
- **Save**: Applies settings and closes the dialog (shows "Saved!" confirmation)
- **Cancel**: Closes dialog without saving changes
- **Reset**: Resets all settings to defaults (with confirmation)
- **X button**: Closes the dialog

### Keyboard Shortcuts
The following keyboard shortcuts are available:
- `Ctrl+T` - New local tab
- `Ctrl+Shift+T` - New connection  
- `Ctrl+W` - Close current tab
- `Ctrl+B` - Toggle sidebar
- `Ctrl+Shift+C` - Copy selection
- `Ctrl+Shift+V` - Paste
- `Ctrl+Tab` - Next tab
- `Ctrl+Shift+Tab` - Previous tab
- `Ctrl+Comma` - Open Settings
- `F11` - Toggle fullscreen

## Resizable Sidebar

The connections panel can be resized to accommodate long connection names:

- **Drag to resize** - Click and drag the handle between the sidebar and terminal
- **Width range** - 150px minimum, 600px maximum (or 50% of window)
- **Double-click to reset** - Double-click the resize handle to return to 250px default
- **Persistent** - Sidebar width is saved in settings

## File Transfer (FTP/FTPS/SFTP)

Browse and transfer files via FTP, FTPS, or SFTP:

### FTP/FTPS Connections
1. Create a new connection with type "FTP"
2. Enter host, port (default: 21), username, and password
3. Check "Use FTPS (TLS/SSL)" for secure connections (coming soon)
4. Click the FTP connection in the sidebar to open the browser

### SFTP Connections
1. Create a new connection with type "SFTP (SSH)"
2. Enter host, port (default: 22), username
3. Choose password or key-based authentication
4. Click the SFTP connection to open the file browser

### File Browser Features
- **Browse directories** - Double-click folders to navigate
- **Download files** - Click the ⬇ button next to any file
- **Upload files** - Click ⬆ Upload button to select local files
- **Create folders** - Click 📁+ to create new directories
- **Delete items** - Click 🗑 to delete files or folders
- **File sizes** - See file sizes in human-readable format

### Protocol Differences
| Protocol | Port | Security | Use Case |
|----------|------|----------|----------|
| FTP | 21 | Plain text | Legacy systems |
| FTPS | 21 | TLS/SSL | Secure file transfer |
| SFTP | 22 | SSH | Modern secure transfer |

### Authentication
- **FTP/FTPS**: Username/password, anonymous login supported
- **SFTP**: Password or SSH key-based (RSA/ED25519)

## Session Saving

Save terminal session output for later review:

### Save Session
1. Open any terminal session (local or SSH)
2. Click the 💾 Save Session button in the toolbar
3. The session content downloads as a text file
4. Filename includes connection name and timestamp

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

GNU General Public License v3.0 or later (GPL-3.0-or-later) - see [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built as a modern, cross-platform terminal and connection manager
- Terminal emulation powered by [xterm.js](https://xtermjs.org/)
- Built with [Tauri](https://tauri.app/)
- PTY management via [portable-pty](https://github.com/wez/wezterm/tree/main/portable-pty)
- SSH client via [russh](https://github.com/warp-tech/russh)

## Roadmap

See [CHANGELOG.md](CHANGELOG.md) for detailed version history and planned features.

### Phase 3 (Planned)
- SFTP file transfer
- RDP/VNC support
- SSH tunneling/proxy jump
- Expect scripting
- Session recording

### Phase 4 (Future)
- KeePassXC integration
- Credential encryption
- Cluster operations
- Plugin system
