# Installation Guide

This document provides instructions for setting up the development and build environment for Casterm on Linux Mint.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Development Environment Setup](#development-environment-setup)
- [Running the Application](#running-the-application)
- [Building for Production](#building-for-production)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

- **Node.js** (v18 or later)
- **Rust** (v1.70 or later)
- **System libraries** for Tauri 2

### Verify Prerequisites

```bash
# Check Node.js
node --version

# Check Rust (install via rustup if missing)
rustc --version
cargo --version
```

---

## Quick Start (Recommended)

The easiest way to get started is using the provided launcher script:

```bash
# Make the script executable (one time)
chmod +x casterm.sh

# Check what dependencies are missing
./casterm.sh check-deps

# Install all dependencies automatically
./casterm.sh install-deps

# Start development environment
./casterm.sh dev
```

---

## Development Environment Setup

### Step 1: Install Rust (if not already installed)

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
```

### Step 2: Install System Dependencies (Linux Mint)

Linux Mint 22.3 (Zena) is based on Ubuntu 24.04 and uses the **libwebkit2gtk-4.1-dev** package:

```bash
sudo apt-get update

# Install Tauri prerequisites for Linux Mint 22.x
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  libgtk-3-dev \
  libgdk-pixbuf-2.0-dev \
  libglib2.0-dev \
  libcairo2-dev \
  libpango1.0-dev \
  libatk1.0-dev \
  libatk-bridge2.0-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  patchelf \
  pkg-config \
  build-essential \
  curl \
  wget \
  file \
  libssl-dev
```

Or use the helper script to install automatically:
```bash
./casterm.sh install-deps
```

> **Note:** The package `libwebkit2gtk-4.0-dev` is not available on Linux Mint 22.x. Use `libwebkit2gtk-4.1-dev` instead.

#### For Other Distributions

**Debian/Ubuntu (older versions):**
```bash
sudo apt-get install -y \
  libgtk-3-dev \
  libgdk-pixbuf-2.0-dev \
  libwebkit2gtk-4.0-dev \
  libglib2.0-dev \
  libcairo2-dev \
  libpango1.0-dev \
  libatk1.0-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  patchelf
```

**Fedora:**
```bash
sudo dnf install -y \
  gtk3-devel \
  gdk-pixbuf2-devel \
  glib2-devel \
  cairo-devel \
  pango-devel \
  atk-devel \
  at-spi2-atk-devel \
  webkit2gtk3-devel \
  libayatana-appindicator3-devel \
  librsvg2-devel
```

**Arch Linux:**
```bash
sudo pacman -S --needed \
  gtk3 \
  gdk-pixbuf2 \
  glib2 \
  cairo \
  pango \
  atk \
  at-spi2-atk \
  webkit2gtk \
  libayatana-appindicator \
  librsvg
```

### Step 3: Install Node.js Dependencies

```bash
# Navigate to the project directory
cd /home/csharp2a/work/casterm

# Install npm dependencies
npm install
```

### Step 4: Install Rust Dependencies

```bash
# Cargo dependencies are automatically installed when building
# You can verify the installation by running:
cargo check
```

---

## Running the Application

### Development Mode

Run the application in development mode with hot-reload:

**Using the launcher script (recommended):**
```bash
./casterm.sh dev
```

**Or using npm directly:**
```bash
npm run tauri dev
```

This will:
1. Start the Vite development server
2. Build the Rust backend
3. Launch the Tauri application window

### Access the Application

Once running, the application window will open automatically. The dev server provides:
- Hot module replacement for frontend changes
- Automatic Rust recompilation for backend changes
- Chrome DevTools for debugging

---

## Building for Production

### Build the Application

**Using the launcher script (recommended):**
```bash
./casterm.sh build
```

**Or using npm directly:**
```bash
npm run tauri build
```

This creates platform-specific packages in `src-tauri/target/release/bundle/`:
- **Linux**: `.deb`, `.AppImage`, `.rpm` (depending on tooling)

### Build Outputs

| Platform | Output Location |
|----------|----------------|
| Linux | `src-tauri/target/release/bundle/deb/` |
| Linux | `src-tauri/target/release/bundle/appimage/` |

### Running the Production Build

```bash
# Linux (after installing the .deb)
casterm

# Or run the AppImage directly
./src-tauri/target/release/bundle/appimage/casterm_*.AppImage
```

---

## Troubleshooting

### Package Not Found: libwebkit2gtk-4.0-dev

**Problem:**
```
E: Unable to locate package libwebkit2gtk-4.0-dev
```

**Solution:**
Linux Mint 22.x uses the newer `libwebkit2gtk-4.1-dev` package:

```bash
sudo apt-get install -y libwebkit2gtk-4.1-dev
```

### Cargo Command Not Found

**Problem:**
```
-bash: cargo: command not found
```

**Solution:**
Source the cargo environment or restart your shell:

```bash
source "$HOME/.cargo/env"
```

### Build Failures

**Clean and rebuild:**
```bash
# Clean Rust build artifacts
cargo clean

# Remove node_modules and reinstall
rm -rf node_modules
npm install

# Rebuild
npm run tauri dev
```

### Permission Denied on Build

```bash
# Ensure proper permissions
chmod +x src-tauri/target/release/casterm
```

---

## Environment-Specific Notes

### Linux Mint 22.3 (Zena)

- Based on Ubuntu 24.04
- Uses `libwebkit2gtk-4.1-dev` instead of `libwebkit2gtk-4.0-dev`
- All other Tauri prerequisites remain the same

### WSL2 (Windows Subsystem for Linux)

If running on WSL2, additional setup may be required for GUI applications. See [Tauri's WSL documentation](https://tauri.app/v1/guides/getting-started/prerequisites#wsl).

---

## Launcher Script Commands

The `casterm.sh` script provides several convenient commands:

| Command | Description |
|---------|-------------|
| `./casterm.sh dev` | Start development environment with hot-reload |
| `./casterm.sh build` | Build application for production |
| `./casterm.sh check` | Check prerequisites and environment status |
| `./casterm.sh clean` | Remove build artifacts and dependencies |
| `./casterm.sh install-deps` | Install system and Node.js dependencies |
| `./casterm.sh help` | Show help message |

### Examples

```bash
# Check if your environment is ready
./casterm.sh check

# Install everything automatically
./casterm.sh install-deps

# Start coding
./casterm.sh dev

# Create production build
./casterm.sh build

# Clean everything and start fresh
./casterm.sh clean
```

---

## Next Steps

After installation:

1. Review the [README.md](README.md) for project overview
2. Check [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines
3. See [CHANGELOG.md](CHANGELOG.md) for version history

---

## Support

For issues or questions:
- Check the [Tauri documentation](https://tauri.app/)
- Review the project [README.md](README.md)
- Open an issue on the project repository
