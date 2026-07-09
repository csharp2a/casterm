# Linux Installation Guide

## Casterm v0.9.0 Beta

## Recommended: AppImage (Most Portable)

The **AppImage** works on almost any Linux distribution without installation:

```bash
# Download Casterm_0.9.0_amd64.AppImage
chmod +x Casterm_0.9.0_amd64.AppImage
./Casterm_0.9.0_amd64.AppImage
```

**Pros:**
- No installation required
- No dependency issues
- Works on Ubuntu, Fedora, Arch, etc.
- Self-contained (79 MB)

**Cons:**
- Larger file size
- Must mark as executable

---

## Debian/Ubuntu (.deb)

```bash
sudo dpkg -i Casterm_0.9.0_amd64.deb
# If dependency errors:
sudo apt-get install -f
```

**Required Dependencies:**
```bash
sudo apt-get install libwebkit2gtk-4.1-0 libgtk-3-0
```

**Supported Systems:**
- Ubuntu 22.04+
- Debian 12+
- Linux Mint 21+

---

## Fedora/RHEL (.rpm)

```bash
sudo rpm -i Casterm-0.9.0-1.x86_64.rpm
# If dependency errors:
sudo dnf install libwebkit2gtk4.1 gtk3
```

**Supported Systems:**
- Fedora 38+
- RHEL 9+
- CentOS Stream 9+
- Rocky Linux 9+

---

## Troubleshooting

### "error while loading shared libraries"

Install missing dependencies:

**Debian/Ubuntu:**
```bash
sudo apt-get update
sudo apt-get install libwebkit2gtk-4.1-0 libgtk-3-0 libappindicator3-1
```

**Fedora:**
```bash
sudo dnf install webkit2gtk4.1 gtk3 libappindicator-gtk3
```

**Arch:**
```bash
sudo pacman -S webkit2gtk-4.1 gtk3 libappindicator-gtk3
```

### AppImage won't run

Make sure it's executable and you have FUSE:
```bash
chmod +x Casterm_0.9.0_amd64.AppImage
sudo apt-get install libfuse2  # Debian/Ubuntu
sudo dnf install fuse          # Fedora
```

### Wayland issues

If the app doesn't display on Wayland, try:
```bash
WEBKIT_DISABLE_COMPOSITING_MODE=1 ./Casterm
```

---

## Building from Source

See [BUILD.md](BUILD.md) for complete build instructions.

## Quick Test

After installation, verify it works:
```bash
casterm --version
```

Or launch from application menu.
