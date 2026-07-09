import { TerminalManager } from './terminal-manager';
import { ConnectionTree, Connection } from './connection-tree';
import { SettingsDialog } from './settings-dialog';
import { settingsManager } from './settings';
import { invoke } from '@tauri-apps/api/core';
import {
  showSetupEncryption,
  showUnlockEncryption,
  showChangePassword
} from './master-password-dialog';
import {
  isEncryptionSetup,
  isEncrypted,
  decrypt,
  encrypt,
  changePassword,
  removeEncryption
} from './crypto';
import './styles.css';

class Casterm {
  private terminalManager: TerminalManager;
  private connectionTree: ConnectionTree;
  private sidebarVisible = true;
  private settingsDialogOpen = false;
  private masterPassword: string | null = null;

  constructor() {
    this.createLayout();
    this.terminalManager = new TerminalManager('terminal-container');
    this.connectionTree = new ConnectionTree('connection-tree');
    
    // Initialize encryption before setting up event listeners
    this.initializeEncryption().then(() => {
      this.setupEventListeners();
      this.createInitialTab();
    });
    
    // DevTools toggle (debug builds only)
    document.addEventListener('contextmenu', (e) => {
      if (e.shiftKey) {
        e.preventDefault();
        invoke('toggle_devtools');
      }
    });
  }

  private async initializeEncryption(): Promise<void> {
    const connectionsData = localStorage.getItem('casterm-connections');
    const encryptionSetup = isEncryptionSetup();

    if (connectionsData && isEncrypted(connectionsData)) {
      // Data is encrypted - show unlock dialog
      const password = await new Promise<string | null>((resolve) => {
        showUnlockEncryption(connectionsData, (result) => {
          if (result === '__RESET__') {
            // User chose to reset - reload with empty connections
            this.connectionTree.initialize();
            resolve(null);
          } else {
            resolve(result);
          }
        });
      });

      if (password) {
        this.masterPassword = password;
        await this.connectionTree.initialize(password);
      } else {
        // No password provided - initialize with defaults
        await this.connectionTree.initialize();
      }
    } else if (!encryptionSetup && !connectionsData) {
      // First run - no data, no encryption - offer to set up
      const setupEncryption = await new Promise<boolean>((resolve) => {
        if (confirm('🔐 Would you like to set up a master password to encrypt your connection data?\n\nThis protects your saved passwords and connection details.\n\nYou can skip this and set it up later in Settings.')) {
          showSetupEncryption((result) => {
            if (result && result !== '__RESET__') {
              this.masterPassword = result;
              resolve(true);
            } else {
              resolve(false);
            }
          });
        } else {
          resolve(false);
        }
      });

      await this.connectionTree.initialize(this.masterPassword || undefined);
    } else {
      // Unencrypted data exists or no encryption setup - normal load
      await this.connectionTree.initialize();
    }
  }

  private sidebarResizeHandle: HTMLElement | null = null;
  private isResizing = false;

  private createLayout(): void {
    const app = document.getElementById('app')!;
    app.innerHTML = `
      <div class="app-container">
        <div class="toolbar">
          <button id="new-tab-btn" title="New Tab (Ctrl+T)">+ New Tab</button>
          <button id="toggle-sidebar-btn" title="Toggle Sidebar">☰</button>
          <div class="spacer"></div>
          <span class="title">Casterm</span>
          <div class="spacer"></div>
          <button id="save-session-btn" title="Save Session Output">💾</button>
          <button id="import-btn" title="Import Connections">📥</button>
          <button id="export-btn" title="Export Connections">📤</button>
          <button id="settings-btn" title="Settings">⚙</button>
        </div>
        <div class="main-content">
          <div id="sidebar" class="sidebar">
            <div class="sidebar-header">
              <span>Connections</span>
              <div style="display: flex; gap: 4px;">
                <button id="add-folder-btn" title="New Folder">📁</button>
                <button id="add-connection-btn" title="Add Connection">+</button>
              </div>
            </div>
            <div id="connection-tree" class="connection-tree"></div>
          </div>
          <div class="sidebar-resize-handle" id="sidebar-resize-handle" title="Drag to resize"></div>
          <div class="terminal-area">
            <div id="tab-bar" class="tab-bar"></div>
            <div id="terminal-container" class="terminal-container"></div>
          </div>
        </div>
        <div class="status-bar">
          <span id="status-text">Ready</span>
          <span id="shell-info"></span>
          <span class="version-display">v0.9.3-beta</span>
        </div>
      </div>
    `;
  }

  private setupEventListeners(): void {
    // New tab button
    document.getElementById('new-tab-btn')?.addEventListener('click', () => {
      this.terminalManager.createLocalTab();
    });

    // Toggle sidebar
    document.getElementById('toggle-sidebar-btn')?.addEventListener('click', () => {
      this.toggleSidebar();
    });

    // Add folder
    document.getElementById('add-folder-btn')?.addEventListener('click', () => {
      this.connectionTree.addFolderPrompt();
    });

    // Add connection
    document.getElementById('add-connection-btn')?.addEventListener('click', () => {
      this.connectionTree.addConnectionPrompt();
    });

    // Save session
    document.getElementById('save-session-btn')?.addEventListener('click', async () => {
      await this.terminalManager.saveActiveSession();
    });

    // Settings
    document.getElementById('settings-btn')?.addEventListener('click', () => {
      if (this.settingsDialogOpen) return;
      this.settingsDialogOpen = true;
      new SettingsDialog(() => {
        this.settingsDialogOpen = false;
        this.applySettings();
      });
    });

    // Export connections
    document.getElementById('export-btn')?.addEventListener('click', () => {
      this.exportConnections();
    });

    // Import connections
    document.getElementById('import-btn')?.addEventListener('click', () => {
      this.importConnections();
    });

    // Handle connection requests from the tree
    document.addEventListener('casterm-connect', (e: Event) => {
      const connection = (e as CustomEvent).detail as Connection;
      this.handleConnection(connection);
    });

    // Apply initial settings
    this.applySettings();

    // Listen for settings changes
    settingsManager.onChange(() => {
      this.applySettings();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl+T: New local tab
      if ((e.ctrlKey || e.metaKey) && e.key === 't' && !e.shiftKey) {
        e.preventDefault();
        this.terminalManager.createLocalTab();
      }
      
      // Ctrl+Shift+T: New SSH connection (future)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        this.connectionTree.addConnectionPrompt();
      }
      
      // Ctrl+W: Close tab
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault();
        this.terminalManager.closeActiveTab();
      }
      
      // Ctrl+B: Toggle sidebar
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        this.toggleSidebar();
      }
      
      // Ctrl+Comma: Settings
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        new SettingsDialog(() => this.applySettings());
      }
      
      // Ctrl+Tab: Next tab
      if ((e.ctrlKey || e.metaKey) && e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        this.cycleTab(1);
      }
      
      // Ctrl+Shift+Tab: Previous tab
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Tab') {
        e.preventDefault();
        this.cycleTab(-1);
      }
      
      // F11: Fullscreen
      if (e.key === 'F11') {
        e.preventDefault();
        this.toggleFullscreen();
      }
      
      // Ctrl+Shift+I: Toggle DevTools
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        invoke('toggle_devtools');
      }
    });

    // Resize handler
    window.addEventListener('resize', () => {
      this.terminalManager.fitActiveTerminal();
    });

    // Setup sidebar resize handle
    this.setupSidebarResize();
  }

  private handleConnection(connection: Connection): void {
    switch (connection.type) {
      case 'local':
        this.terminalManager.createLocalTab();
        break;
      case 'ssh':
        this.terminalManager.createSshTab(connection);
        break;
      case 'ftp':
        // FTP is handled directly by the connection tree
        break;
      default:
        console.warn(`Connection type '${connection.type}' not yet implemented`);
        alert(`${connection.type.toUpperCase()} connections coming in Phase 3!`);
    }
  }

  private toggleSidebar(): void {
    const sidebar = document.getElementById('sidebar')!;
    const resizeHandle = document.getElementById('sidebar-resize-handle');
    this.sidebarVisible = !this.sidebarVisible;
    sidebar.style.display = this.sidebarVisible ? 'flex' : 'none';
    if (resizeHandle) {
      resizeHandle.style.display = this.sidebarVisible ? 'block' : 'none';
    }
    setTimeout(() => this.terminalManager.fitActiveTerminal(), 100);
  }

  private setupSidebarResize(): void {
    this.sidebarResizeHandle = document.getElementById('sidebar-resize-handle');
    if (!this.sidebarResizeHandle) return;

    this.sidebarResizeHandle.addEventListener('mousedown', (e) => {
      this.isResizing = true;
      e.preventDefault();
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.isResizing) return;
      
      const newWidth = e.clientX;
      const minWidth = 150;
      const maxWidth = Math.min(600, window.innerWidth * 0.5);
      
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
          sidebar.style.width = `${newWidth}px`;
          // Update settings
          settingsManager.updateSetting('sidebarWidth', newWidth);
        }
      }
    });

    document.addEventListener('mouseup', () => {
      if (this.isResizing) {
        this.isResizing = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        this.terminalManager.fitActiveTerminal();
      }
    });

    // Double-click to reset to default width
    this.sidebarResizeHandle.addEventListener('dblclick', () => {
      const sidebar = document.getElementById('sidebar');
      if (sidebar) {
        const defaultWidth = 250;
        sidebar.style.width = `${defaultWidth}px`;
        settingsManager.updateSetting('sidebarWidth', defaultWidth);
        this.terminalManager.fitActiveTerminal();
      }
    });
  }

  private createInitialTab(): void {
    this.terminalManager.createLocalTab();
  }

  private exportConnections(): void {
    const json = this.connectionTree.exportConnections();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `casterm-connections-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private importConnections(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const json = event.target?.result as string;
          if (this.connectionTree.importConnections(json)) {
            alert('Connections imported successfully!');
          } else {
            alert('Failed to import connections. Invalid format.');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }

  private cycleTab(direction: number): void {
    this.terminalManager.cycleTab(direction);
  }

  private toggleFullscreen(): void {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  private applySettings(): void {
    const settings = settingsManager.getSettings();
    
    // Apply font settings
    document.documentElement.style.setProperty('--terminal-font-family', settings.fontFamily);
    document.documentElement.style.setProperty('--terminal-font-size', `${settings.fontSize}px`);
    
    // Apply status bar visibility
    const statusBar = document.querySelector('.status-bar') as HTMLElement;
    if (statusBar) {
      statusBar.style.display = settings.showStatusBar ? 'flex' : 'none';
    }
    
    // Apply sidebar width
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      sidebar.style.width = `${settings.sidebarWidth}px`;
    }
    
    // Notify terminal manager to update terminals
    this.terminalManager.applySettings(settings);
    
    // Update body background to match terminal theme
    const bgColor = settings.terminalTheme?.background || '#300924';
    document.body.style.backgroundColor = bgColor;
    
    // Update CSS variables for UI theming
    document.documentElement.style.setProperty('--bg-primary', bgColor);
  }
}

new Casterm();
