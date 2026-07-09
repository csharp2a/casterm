import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import '@xterm/xterm/css/xterm.css';
import { Connection } from './connection-tree';
import { AppSettings, settingsManager, UBUNTU_THEME } from './settings';

interface Tab {
  id: number;
  name: string;
  terminal: Terminal;
  fitAddon: FitAddon;
  ptyId: number | null;
  sshId: number | null;
  connectionType: 'local' | 'ssh';
  connectionInfo?: Connection;
  element: HTMLElement;
  active: boolean;
  unlistenOutput?: UnlistenFn;
  unlistenExit?: UnlistenFn;
}

export class TerminalManager {
  private tabs: Map<number, Tab> = new Map();
  private activeTabId: number | null = null;
  private nextTabId = 1;
  private container: HTMLElement;
  private tabBar: HTMLElement;

  constructor(containerId: string) {
    this.container = document.getElementById(containerId)!;
    this.tabBar = document.getElementById('tab-bar')!;
  }

  async createLocalTab(): Promise<void> {
    const tabId = this.nextTabId++;
    const tabName = `Local ${tabId}`;

    const terminalElement = document.createElement('div');
    terminalElement.className = 'terminal-instance';
    terminalElement.style.display = 'none';
    this.container.appendChild(terminalElement);

    const terminal = this.createTerminal(terminalElement);
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    try {
      terminal.loadAddon(new WebglAddon());
    } catch {
      // WebGL not available, fallback to canvas
    }

    terminal.open(terminalElement);

    const tab: Tab = {
      id: tabId,
      name: tabName,
      terminal,
      fitAddon,
      ptyId: null,
      sshId: null,
      connectionType: 'local',
      element: terminalElement,
      active: false,
    };

    this.tabs.set(tabId, tab);
    this.createTabElement(tab);
    await this.activateTab(tabId);
    await this.spawnLocalPty(tab);

    this.attachTerminalListeners(tab);
  }

  async createSshTab(connection: Connection): Promise<void> {
    const tabId = this.nextTabId++;
    const tabName = connection.name || connection.host || 'SSH';

    const terminalElement = document.createElement('div');
    terminalElement.className = 'terminal-instance';
    terminalElement.style.display = 'none';
    this.container.appendChild(terminalElement);

    const terminal = this.createTerminal(terminalElement);
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    try {
      terminal.loadAddon(new WebglAddon());
    } catch {
      // WebGL not available
    }

    terminal.open(terminalElement);
    terminal.writeln(`Connecting to ${connection.host}...`);

    const tab: Tab = {
      id: tabId,
      name: tabName,
      terminal,
      fitAddon,
      ptyId: null,
      sshId: null,
      connectionType: 'ssh',
      connectionInfo: connection,
      element: terminalElement,
      active: false,
    };

    this.tabs.set(tabId, tab);
    this.createTabElement(tab);
    await this.activateTab(tabId);
    await this.spawnSshSession(tab, connection);

    this.attachTerminalListeners(tab);
  }

  private createTerminal(_element: HTMLElement): Terminal {
    const settings = settingsManager.getSettings();
    const theme = settings.terminalTheme || UBUNTU_THEME;
    
    return new Terminal({
      fontFamily: settings.fontFamily || 'JetBrains Mono, Consolas, monospace',
      fontSize: settings.fontSize || 14,
      theme: theme,
      cursorBlink: settings.cursorBlink ?? true,
      cursorStyle: (settings.cursorStyle as 'block' | 'bar' | 'underline') || 'block',
      scrollback: settings.scrollback || 10000,
      allowProposedApi: true,
    });
  }

  private attachTerminalListeners(tab: Tab): void {
    tab.terminal.onData((data) => {
      if (tab.connectionType === 'local' && tab.ptyId !== null) {
        invoke('write_to_pty', { id: tab.ptyId, data });
      } else if (tab.connectionType === 'ssh' && tab.sshId !== null) {
        invoke('write_to_ssh_session', { id: tab.sshId, data });
      }
    });

    tab.terminal.onResize(({ cols, rows }) => {
      if (tab.connectionType === 'local' && tab.ptyId !== null) {
        invoke('resize_pty', { id: tab.ptyId, rows, cols });
      } else if (tab.connectionType === 'ssh' && tab.sshId !== null) {
        invoke('resize_ssh_session', { id: tab.sshId, rows, cols });
      }
    });

    // Handle copy/paste
    tab.terminal.attachCustomKeyEventHandler((event) => {
      if (event.ctrlKey && event.shiftKey) {
        if (event.key === 'C') {
          const selection = tab.terminal.getSelection();
          if (selection) {
            navigator.clipboard.writeText(selection);
          }
          return false;
        } else if (event.key === 'V') {
          navigator.clipboard.readText().then((text) => {
            if (tab.connectionType === 'local' && tab.ptyId !== null) {
              invoke('write_to_pty', { id: tab.ptyId, data: text });
            } else if (tab.connectionType === 'ssh' && tab.sshId !== null) {
              invoke('write_to_ssh_session', { id: tab.sshId, data: text });
            }
          });
          return false;
        }
      }
      return true;
    });
  }

  private async spawnLocalPty(tab: Tab): Promise<void> {
    try {
      const ptyId = await invoke<number>('create_pty', { shell: null, cwd: null });
      tab.ptyId = ptyId;

      const unlistenOutput = await listen<string>(`pty-output-${ptyId}`, (event) => {
        tab.terminal.write(event.payload);
      });

      const unlistenExit = await listen(`pty-exit-${ptyId}`, () => {
        tab.terminal.writeln('\r\n[Process exited]');
        this.updateStatusBar('Disconnected');
      });

      tab.unlistenOutput = unlistenOutput;
      tab.unlistenExit = unlistenExit;

      const info = await invoke<{ shell: string; pid?: number }>('get_pty_info', { id: ptyId });
      this.updateStatusBar(info.shell, info.pid);

      setTimeout(() => {
        tab.fitAddon.fit();
        const { cols, rows } = tab.terminal;
        invoke('resize_pty', { id: ptyId, rows, cols });
      }, 100);
    } catch (error) {
      tab.terminal.writeln(`\r\n[Error: ${error}]`);
    }
  }

  private async spawnSshSession(tab: Tab, connection: Connection): Promise<void> {
    try {
      const options = {
        host: connection.host || '',
        port: connection.port || 22,
        username: connection.username || '',
        auth_type: connection.auth_type || (connection.privateKey ? 'key' : 'password'),
        password: connection.password || undefined,
        privateKey: connection.privateKey || undefined,
        privateKeyPassphrase: undefined,
      };

      // Prompt for password if not saved
      if (options.auth_type === 'password' && !options.password) {
        const password = prompt(`Enter password for ${connection.username}@${connection.host}:`);
        if (!password) {
          tab.terminal.writeln('\r\n[Connection cancelled]');
          return;
        }
        options.password = password;
      }

      const sshId = await invoke<number>('create_ssh_session', { options });
      tab.sshId = sshId;

      tab.terminal.clear();
      tab.terminal.writeln(`Connected to ${connection.host}\r\n`);

      const unlistenOutput = await listen<string>(`ssh-output-${sshId}`, (event) => {
        tab.terminal.write(event.payload);
      });

      const unlistenExit = await listen(`ssh-exit-${sshId}`, () => {
        tab.terminal.writeln('\r\n[SSH session closed]');
        this.updateStatusBar('Disconnected');
      });

      tab.unlistenOutput = unlistenOutput;
      tab.unlistenExit = unlistenExit;

      this.updateStatusBar(`SSH: ${connection.host}`);

      setTimeout(() => {
        tab.fitAddon.fit();
        const { cols, rows } = tab.terminal;
        invoke('resize_ssh_session', { id: sshId, rows, cols });
      }, 100);
    } catch (error) {
      tab.terminal.writeln(`\r\n[SSH Error: ${error}]`);
      this.updateStatusBar('Connection failed');
    }
  }

  private createTabElement(tab: Tab): void {
    const tabElement = document.createElement('div');
    tabElement.className = 'tab';
    tabElement.dataset.tabId = tab.id.toString();
    
    const icon = tab.connectionType === 'ssh' ? '🔒' : '⌨';
    
    tabElement.innerHTML = `
      <span class="tab-icon">${icon}</span>
      <span class="tab-name" title="${tab.name}">${tab.name}</span>
      <button class="tab-close" title="Close">×</button>
    `;

    tabElement.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).classList.contains('tab-close')) {
        this.closeTab(tab.id);
      } else {
        this.activateTab(tab.id);
      }
    });

    this.tabBar.appendChild(tabElement);
  }

  async activateTab(tabId: number): Promise<void> {
    if (this.activeTabId === tabId) return;

    for (const [id, tab] of this.tabs) {
      if (id === tabId) {
        tab.element.style.display = 'block';
        tab.active = true;
        this.getTabElement(id)?.classList.add('active');
        setTimeout(() => tab.fitAddon.fit(), 0);

        // Update status bar
        if (tab.connectionType === 'local' && tab.ptyId !== null) {
          const info = await invoke<{ shell: string; pid?: number }>('get_pty_info', { id: tab.ptyId });
          this.updateStatusBar(info.shell, info.pid);
        } else if (tab.connectionType === 'ssh' && tab.sshId !== null) {
          const host = tab.connectionInfo?.host || 'SSH';
          this.updateStatusBar(`SSH: ${host}`);
        }
      } else {
        tab.element.style.display = 'none';
        tab.active = false;
        this.getTabElement(id)?.classList.remove('active');
      }
    }

    this.activeTabId = tabId;
  }

  async closeTab(tabId: number): Promise<void> {
    const tab = this.tabs.get(tabId);
    if (!tab) return;

    // Cleanup listeners
    if (tab.unlistenOutput) await tab.unlistenOutput();
    if (tab.unlistenExit) await tab.unlistenExit();

    // Close backend session
    if (tab.connectionType === 'local' && tab.ptyId !== null) {
      await invoke('close_pty', { id: tab.ptyId });
    } else if (tab.connectionType === 'ssh' && tab.sshId !== null) {
      await invoke('close_ssh_session', { id: tab.sshId });
    }

    tab.terminal.dispose();
    tab.element.remove();
    this.getTabElement(tabId)?.remove();
    this.tabs.delete(tabId);

    if (this.activeTabId === tabId) {
      const remainingTabs = Array.from(this.tabs.keys());
      if (remainingTabs.length > 0) {
        await this.activateTab(remainingTabs[remainingTabs.length - 1]);
      } else {
        this.activeTabId = null;
        await this.createLocalTab();
      }
    }
  }

  closeActiveTab(): void {
    if (this.activeTabId !== null) {
      this.closeTab(this.activeTabId);
    }
  }

  fitActiveTerminal(): void {
    if (this.activeTabId !== null) {
      const tab = this.tabs.get(this.activeTabId);
      if (tab) {
        tab.fitAddon.fit();
        const { cols, rows } = tab.terminal;
        if (tab.connectionType === 'local' && tab.ptyId !== null) {
          invoke('resize_pty', { id: tab.ptyId, rows, cols });
        } else if (tab.connectionType === 'ssh' && tab.sshId !== null) {
          invoke('resize_ssh_session', { id: tab.sshId, rows, cols });
        }
      }
    }
  }

  getActiveTab(): Tab | undefined {
    if (this.activeTabId !== null) {
      return this.tabs.get(this.activeTabId);
    }
    return undefined;
  }

  async saveActiveSession(): Promise<void> {
    const tab = this.getActiveTab();
    if (!tab) {
      alert('No active session to save');
      return;
    }

    try {
      // Get terminal buffer content using xterm.js API
      const buffer = tab.terminal.buffer.active;
      const lines: string[] = [];

      // Get all lines in the buffer (scrollback + viewport)
      const bufferLength = buffer.length;

      for (let i = 0; i < bufferLength; i++) {
        const line = buffer.getLine(i);
        if (line) {
          // Get the text content of the line, trimming trailing whitespace
          const lineText = line.translateToString(true).trimEnd();
          lines.push(lineText);
        }
      }

      // Filter out empty lines at the end
      while (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop();
      }

      const content = lines.join('\n') + '\n';

      // Create filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const connectionName = tab.connectionInfo?.name || tab.name || 'session';
      const filename = `${connectionName}-${timestamp}.txt`;

      // Use native save dialog via Tauri
      const { invoke } = await import('@tauri-apps/api/core');
      const saved = await invoke<boolean>('save_session_dialog', {
        content,
        defaultName: filename
      });

      if (saved) {
        // Show status
        this.updateStatusBar(`Saved: ${filename}`);
        console.log(`Session saved: ${filename} (${lines.length} lines)`);
      }
    } catch (error) {
      console.error('Error saving session:', error);
      alert('Failed to save session: ' + error);
    }
  }

  private getTabElement(tabId: number): HTMLElement | null {
    return this.tabBar.querySelector(`[data-tab-id="${tabId}"]`);
  }

  private updateStatusBar(shell: string, pid?: number): void {
    const shellInfo = document.getElementById('shell-info');
    if (shellInfo) {
      shellInfo.textContent = pid ? `${shell} (PID: ${pid})` : shell;
    }
  }

  cycleTab(direction: number): void {
    if (this.tabs.size < 2) return;
    
    const tabIds = Array.from(this.tabs.keys());
    const currentIndex = this.activeTabId !== null ? tabIds.indexOf(this.activeTabId) : -1;
    
    let newIndex = currentIndex + direction;
    if (newIndex < 0) newIndex = tabIds.length - 1;
    if (newIndex >= tabIds.length) newIndex = 0;
    
    this.activateTab(tabIds[newIndex]);
  }

  applySettings(settings: AppSettings): void {
    // Map cursor styles: xterm.js uses 'block' | 'bar' | 'underline'
    const cursorStyleMap: Record<string, 'block' | 'bar' | 'underline'> = {
      'block': 'block',
      'line': 'bar',  // xterm.js calls it 'bar'
      'bar': 'bar',
    };
    
    // Update all terminals with new settings
    for (const tab of this.tabs.values()) {
      tab.terminal.options.fontFamily = settings.fontFamily;
      tab.terminal.options.fontSize = settings.fontSize;
      tab.terminal.options.cursorBlink = settings.cursorBlink;
      tab.terminal.options.cursorStyle = cursorStyleMap[settings.cursorStyle] || 'block';
      tab.terminal.options.scrollback = settings.scrollback;
      
      // Apply terminal theme if available
      if (settings.terminalTheme) {
        tab.terminal.options.theme = settings.terminalTheme;
      }
    }
    
    // Fit active terminal
    this.fitActiveTerminal();
  }
}
