# Building Casterm v0.9.0 Beta

## Prerequisites

Make sure you have completed the installation steps in [INSTALL.md](INSTALL.md) first.

## Build Commands

### Development Build (with DevTools)
```bash
./casterm.sh dev
```

### Production Build (Release)

#### All Platforms (from source)
```bash
npm run tauri build
```

This creates platform-specific installers in:
- `src-tauri/target/release/bundle/`

#### Platform-Specific Builds

**Windows (.msi installer):**
```bash
npm run tauri build -- --target x86_64-pc-windows-msvc
```

**Linux (.AppImage, .deb):**
```bash
npm run tauri build -- --target x86_64-unknown-linux-gnu
```

## Build Outputs

After building, you'll find installers in:

```
src-tauri/target/release/bundle/
├── msi/          # Windows installer
├── appimage/     # Linux AppImage
├── deb/          # Linux Debian package
└── rpm/          # Linux RPM package (if enabled)
```

## Code Signing (Optional but Recommended)

### Windows
Requires a code signing certificate. Set environment variables:
```bash
export WINDOWS_CERTIFICATE_PATH="/path/to/certificate.pfx"
export WINDOWS_CERTIFICATE_PASSWORD="your-password"
```

## Beta Testing Checklist

Before distributing the beta:

1. **Test on target platforms:**
   - [ ] Windows 10/11
   - [ ] Linux (Ubuntu/Debian, Fedora)

2. **Test core features:**
   - [ ] Create local terminal tab
   - [ ] Create SSH connection
   - [ ] Create FTP connection
   - [ ] Create SFTP connection
   - [ ] Use file browser (FTP/SFTP)
   - [ ] Save and load settings
   - [ ] Import/export connections
   - [ ] Theme switching

3. **Test edge cases:**
   - [ ] Invalid connection details
   - [ ] Network disconnection
   - [ ] Very long sessions
   - [ ] Corrupted settings file
   - [ ] Multiple dialogs (should be prevented)

4. **Verify no DevTools in release:**
   - [ ] Shift+Right Click does nothing in release build
   - [ ] DevTools menu not accessible

## Distribution

### GitHub Releases (Recommended)

1. Create a new release on GitHub
2. Tag: `v0.9.0-beta`
3. Title: "Casterm v0.9.0 Beta"
4. Attach built installers from `src-tauri/target/release/bundle/`
5. Include changelog highlights in release notes

### Direct Distribution

**For Linux - Use AppImage (Recommended):**
The AppImage is the most portable option for Linux as it bundles all dependencies:
- `casterm_0.9.0_amd64.AppImage` - Works on all Linux distros

Users just need to:
```bash
chmod +x Casterm_0.9.0_amd64.AppImage
./Casterm_0.9.0_amd64.AppImage
```

See [INSTALL-LINUX.md](INSTALL-LINUX.md) for detailed Linux installation instructions.

**Other platforms:**
- `casterm_0.9.0_x64_en-US.msi` (Windows)
- `casterm_0.9.0_amd64.deb` (Debian/Ubuntu - requires dependency install)
- `Casterm-0.9.0-1.x86_64.rpm` (Fedora/RHEL - requires dependency install)

## Known Issues in Beta

- DevTools only work in debug builds (intentional)
- Keyboard shortcuts are not customizable yet
- No auto-updater implemented

## Debug Logging

By default, release builds only show warnings and errors to reduce console spam.

To enable debug logging (e.g., for SSH troubleshooting):

1. Edit `src-tauri/src/lib.rs`
2. Change `.level(log::LevelFilter::Warn)` to `.level(log::LevelFilter::Debug)`
3. Rebuild with `./casterm.sh dev`

**Note:** Debug mode will show verbose SSH connection logs from the `russh` library.

## Feedback

Please report issues with:
- Operating system and version
- Casterm version
- Steps to reproduce
- Expected vs actual behavior
