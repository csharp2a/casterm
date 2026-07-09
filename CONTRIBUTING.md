# Contributing to Casterm

Thank you for your interest in contributing to Casterm! This document provides guidelines and information for contributors.

## Code of Conduct

This project and everyone participating in it is governed by our commitment to:
- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on constructive feedback
- Prioritize user experience

## How to Contribute

### Reporting Bugs

Before creating a bug report, please:
1. Check if the issue already exists
2. Use the latest development version
3. Gather relevant information (OS, terminal type, error messages)

**Bug report template:**
```markdown
**Description:**
Clear description of the bug

**Steps to Reproduce:**
1. Step one
2. Step two
3. Step three

**Expected Behavior:**
What should happen

**Actual Behavior:**
What actually happens

**Environment:**
- OS: [e.g., Windows 11, macOS 14, Ubuntu 22.04]
- Version: [e.g., 0.1.0]
- Shell: [e.g., bash, zsh, PowerShell]
```

### Suggesting Features

Feature requests are welcome! Please:
1. Check if the feature is already planned in CHANGELOG.md
2. Describe the use case clearly
3. Explain why it would benefit users

### Pull Requests

1. **Fork** the repository
2. **Create a branch** (`git checkout -b feature/your-feature`)
3. **Make your changes**
4. **Test thoroughly**
5. **Commit** with clear messages
6. **Push** to your fork
7. **Open a Pull Request**

**Commit message format:**
```
type(scope): subject

body (optional)

footer (optional)
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Example: `feat(terminal): add split pane support`

## Development Setup

### Prerequisites
- Rust 1.70+
- Node.js 18+
- Git

### Setup Steps

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/casterm.git
cd casterm

# Install dependencies
npm install

# Run development server
npm run tauri dev
```

### Project Structure

```
casterm/
├── src/                 # Frontend (TypeScript)
│   ├── main.ts         # App entry
│   ├── terminal-manager.ts
│   ├── connection-tree.ts
│   └── styles.css
├── src-tauri/          # Backend (Rust)
│   └── src/lib.rs      # PTY commands
└── docs/               # Documentation
```

### Coding Standards

**TypeScript:**
- Use strict mode
- Prefer `const` and `let` over `var`
- Use descriptive variable names
- Add JSDoc for public functions

**Rust:**
- Follow `rustfmt` formatting
- Use `clippy` for linting
- Handle errors explicitly
- Document public APIs

**CSS:**
- Use CSS variables for theming
- Prefer flexbox/grid for layout
- Mobile-first responsive design

### Testing

Currently, automated testing is minimal. Please:
- Test manually on your platform
- Test edge cases (resize, rapid tab switching)
- Verify keyboard shortcuts work
- Check memory usage (DevTools)

### Documentation

Update documentation when:
- Adding new features
- Changing user-facing behavior
- Modifying configuration options

## Architecture Decisions

### Frontend (TypeScript)
- **Event-driven**: Use CustomEvents for component communication
- **State management**: Keep state in manager classes
- **DOM manipulation**: Direct but encapsulated

### Backend (Rust)
- **Command pattern**: All backend functions are Tauri commands
- **Error handling**: Return `Result<T, String>` to frontend
- **Thread safety**: Use `Arc<Mutex<T>>` for shared state

## Release Process

1. Update version in `package.json` and `Cargo.toml`
2. Update `CHANGELOG.md`
3. Create git tag: `git tag v0.x.x`
4. Push tag: `git push origin v0.x.x`
5. GitHub Actions builds releases automatically

## Questions?

- Open a [Discussion](https://github.com/yourusername/casterm/discussions)
- Join our chat (link TBD)
- Email: contact@casterm.dev (placeholder)

## Attribution

Contributors will be recognized in:
- Git commit history
- Release notes
- CONTRIBUTORS.md file

Thank you for helping make Casterm better!