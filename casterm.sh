#!/bin/bash

# Casterm Development & Build Environment Launcher
# Usage: ./casterm.sh [dev|build|check|clean|install-deps]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Ensure Rust is in PATH
ensure_rust() {
    if ! command_exists rustc; then
        if [ -f "$HOME/.cargo/env" ]; then
            source "$HOME/.cargo/env"
        fi
    fi
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Ensure Rust is available
    ensure_rust
    
    local missing=()
    
    # Check Node.js
    if command_exists node; then
        NODE_VERSION=$(node --version | cut -d'v' -f2)
        log_success "Node.js found: v$NODE_VERSION"
    else
        missing+=("Node.js (v18+)")
    fi
    
    # Check npm
    if command_exists npm; then
        NPM_VERSION=$(npm --version)
        log_success "npm found: v$NPM_VERSION"
    else
        missing+=("npm")
    fi
    
    # Check Rust
    if command_exists rustc; then
        RUST_VERSION=$(rustc --version | awk '{print $2}')
        log_success "Rust found: v$RUST_VERSION"
    else
        missing+=("Rust")
    fi
    
    # Check Cargo
    if command_exists cargo; then
        CARGO_VERSION=$(cargo --version | awk '{print $2}')
        log_success "Cargo found: v$CARGO_VERSION"
    else
        missing+=("Cargo")
    fi
    
    # Check pkg-config
    if command_exists pkg-config; then
        log_success "pkg-config found"
    else
        missing+=("pkg-config")
    fi
    
    if [ ${#missing[@]} -ne 0 ]; then
        log_error "Missing prerequisites:"
        for item in "${missing[@]}"; do
            echo "  - $item"
        done
        echo ""
        log_info "Install missing prerequisites and try again."
        log_info "See INSTALL.md for detailed instructions."
        exit 1
    fi
    
    log_success "All prerequisites met!"
}

# Detect Linux distribution
detect_distro() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        echo "$ID"
    else
        echo "unknown"
    fi
}

# Install system dependencies
install_system_deps() {
    log_info "Installing system dependencies..."
    
    DISTRO=$(detect_distro)
    log_info "Detected distribution: $DISTRO"
    
    case "$DISTRO" in
        ubuntu|debian|linuxmint|pop)
            log_info "Installing dependencies for Debian/Ubuntu-based system..."
            
            # Detect if we need 4.1 or 4.0 version of webkit
            if apt-cache show libwebkit2gtk-4.1-dev >/dev/null 2>&1; then
                WEBKIT_PKG="libwebkit2gtk-4.1-dev"
            else
                WEBKIT_PKG="libwebkit2gtk-4.0-dev"
            fi
            
            sudo apt-get update
            sudo apt-get install -y \
                libgtk-3-dev \
                libgdk-pixbuf-2.0-dev \
                libglib2.0-dev \
                libcairo2-dev \
                libpango1.0-dev \
                libatk1.0-dev \
                libatk-bridge2.0-dev \
                "$WEBKIT_PKG" \
                libayatana-appindicator3-dev \
                librsvg2-dev \
                patchelf \
                pkg-config \
                build-essential \
                curl \
                wget \
                file \
                libssl-dev
            ;;
            
        fedora|rhel|centos)
            log_info "Installing dependencies for Fedora/RHEL-based system..."
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
                librsvg2-devel \
                patchelf \
                pkg-config \
                gcc \
                curl \
                wget \
                openssl-devel
            ;;
            
        arch|manjaro)
            log_info "Installing dependencies for Arch-based system..."
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
                librsvg \
                patchelf \
                pkg-config \
                base-devel \
                curl \
                wget \
                openssl
            ;;
            
        *)
            log_warn "Unknown distribution: $DISTRO"
            log_warn "Please install Tauri prerequisites manually."
            log_info "See: https://tauri.app/v1/guides/getting-started/prerequisites"
            exit 1
            ;;
    esac
    
    log_success "System dependencies installed!"
}

# Install Node.js dependencies
install_node_deps() {
    log_info "Installing Node.js dependencies..."
    
    if [ -d "node_modules" ]; then
        log_warn "node_modules already exists. Skipping npm install."
        log_info "Run './casterm.sh clean' first to force reinstall."
    else
        npm install
        log_success "Node.js dependencies installed!"
    fi
}

# Install Rust if not present
install_rust() {
    if ! command_exists rustc; then
        log_info "Rust not found. Installing..."
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
        source "$HOME/.cargo/env"
        log_success "Rust installed!"
    fi
}

# Run development environment
run_dev() {
    log_info "Starting development environment..."
    check_prerequisites
    check_tauri_deps || exit 1
    install_node_deps
    
    log_info "Launching Casterm in development mode..."
    log_info "Press Ctrl+C to stop"
    echo ""
    
    npm run tauri dev
}

# Build for production
run_build() {
    log_info "Building Casterm for production..."
    check_prerequisites
    install_node_deps
    
    log_info "Running production build..."
    npm run tauri build
    
    log_success "Build complete!"
    echo ""
    log_info "Build outputs:"
    
    # Find and display build artifacts
    if [ -d "src-tauri/target/release/bundle" ]; then
        find src-tauri/target/release/bundle -type f \( -name "*.deb" -o -name "*.AppImage" -o -name "*.rpm" -o -name "*.dmg" -o -name "*.msi" -o -name "*.exe" \) 2>/dev/null | while read -r file; do
            echo "  - $file"
        done
    fi
}

# Clean build artifacts
run_clean() {
    log_info "Cleaning build artifacts..."
    
    # Clean Rust build
    if [ -d "src-tauri/target" ]; then
        log_info "Cleaning Rust target directory..."
        cargo clean --manifest-path src-tauri/Cargo.toml 2>/dev/null || rm -rf src-tauri/target
    fi
    
    # Clean node_modules
    if [ -d "node_modules" ]; then
        log_info "Removing node_modules..."
        rm -rf node_modules
    fi
    
    # Clean package-lock
    if [ -f "package-lock.json" ]; then
        log_info "Removing package-lock.json..."
        rm -f package-lock.json
    fi
    
    log_success "Clean complete!"
}

# Run quick check
run_check() {
    log_info "Running environment check..."
    check_prerequisites
    
    echo ""
    log_info "Project status:"
    
    if [ -d "node_modules" ]; then
        log_success "Node.js dependencies installed"
    else
        log_warn "Node.js dependencies not installed (run './casterm.sh install-deps')"
    fi
    
    if [ -d "src-tauri/target" ]; then
        log_success "Rust build artifacts present"
    else
        log_warn "No Rust build artifacts (run './casterm.sh dev' or './casterm.sh build')"
    fi
}

# Check for specific Tauri system dependencies
check_tauri_deps() {
    log_info "Checking Tauri system dependencies..."
    
    local missing=()
    
    # Check for pkg-config files
    local pkg_checks=(
        "glib-2.0:libglib2.0-dev"
        "gobject-2.0:libglib2.0-dev"
        "gio-2.0:libglib2.0-dev"
        "gdk-3.0:libgtk-3-dev"
        "gtk+-3.0:libgtk-3-dev"
        "gdk-pixbuf-2.0:libgdk-pixbuf-2.0-dev"
        "cairo:cairo"
        "pango:pango"
        "atk:atk"
    )
    
    for check in "${pkg_checks[@]}"; do
        local pkg="${check%%:*}"
        local deb_pkg="${check##*:}"
        if ! pkg-config --exists "$pkg" 2>/dev/null; then
            missing+=("$deb_pkg (provides $pkg)")
        fi
    done
    
    if [ ${#missing[@]} -ne 0 ]; then
        log_error "Missing system packages:"
        printf '  - %s\n' "${missing[@]}"
        echo ""
        log_info "Run the following to install all dependencies:"
        log_info "  ./casterm.sh install-deps"
        return 1
    fi
    
    log_success "All Tauri system dependencies found!"
    return 0
}

# Show help
show_help() {
    echo "Casterm Development & Build Environment Launcher"
    echo ""
    echo "Usage: ./casterm.sh [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  dev          Launch development environment with hot-reload"
    echo "  build        Build application for production"
    echo "  check        Check prerequisites and environment status"
    echo "  check-deps   Check Tauri system dependencies only"
    echo "  clean        Remove build artifacts and dependencies"
    echo "  install-deps Install system and Node.js dependencies"
    echo "  help         Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./casterm.sh dev      # Start development server"
    echo "  ./casterm.sh build    # Create production build"
    echo "  ./casterm.sh check    # Verify environment"
    echo ""
    echo "For more information, see INSTALL.md"
}

# Main script logic
main() {
    case "${1:-dev}" in
        dev)
            run_dev
            ;;
        build)
            run_build
            ;;
        check)
            run_check
            ;;
        check-deps)
            check_tauri_deps
            ;;
        clean)
            run_clean
            ;;
        install-deps)
            install_rust
            install_system_deps
            install_node_deps
            log_success "All dependencies installed!"
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "Unknown command: $1"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
