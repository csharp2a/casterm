export interface TerminalTheme {
  background: string;
  foreground: string;
  cursor: string;
  selectionBackground: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

export interface AppSettings {
  theme: 'dark' | 'light' | 'system';
  terminalTheme: TerminalTheme;
  fontFamily: string;
  fontSize: number;
  cursorBlink: boolean;
  cursorStyle: 'block' | 'line' | 'bar';
  scrollback: number;
  wordWrap: boolean;
  copyOnSelect: boolean;
  rightClickPaste: boolean;
  confirmClose: boolean;
  autoReconnect: boolean;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  showStatusBar: boolean;
  sidebarWidth: number;
  keyboardShortcuts: Record<string, string>;
}

// Ubuntu Aubergine Terminal Theme (Default)
export const UBUNTU_THEME: TerminalTheme = {
  background: '#300924',      // Dark aubergine
  foreground: '#FFFFFF',      // White primary text
  cursor: '#FFFFFF',
  selectionBackground: '#5e2750',
  black: '#2e3436',
  red: '#cc0000',
  green: '#4e9a06',
  yellow: '#c4a000',
  blue: '#3465a4',
  magenta: '#75507b',
  cyan: '#06989a',
  white: '#d3d7cf',
  brightBlack: '#555753',
  brightRed: '#ef2929',
  brightGreen: '#8ae234',
  brightYellow: '#fce94f',
  brightBlue: '#729fcf',
  brightMagenta: '#ad7fa8',
  brightCyan: '#34e2e2',
  brightWhite: '#eeeeec',
};

// Classic Dark Theme
export const DARK_THEME: TerminalTheme = {
  background: '#1e1e1e',
  foreground: '#d4d4d4',
  cursor: '#d4d4d4',
  selectionBackground: '#264f78',
  black: '#000000',
  red: '#cd3131',
  green: '#0dbc79',
  yellow: '#e5e510',
  blue: '#2472c8',
  magenta: '#bc3fbc',
  cyan: '#11a8cd',
  white: '#e5e5e5',
  brightBlack: '#666666',
  brightRed: '#f14c4c',
  brightGreen: '#23d18b',
  brightYellow: '#f5f543',
  brightBlue: '#3b8eea',
  brightMagenta: '#d670d6',
  brightCyan: '#29b8db',
  brightWhite: '#e5e5e5',
};

// Light Theme
export const LIGHT_THEME: TerminalTheme = {
  background: '#ffffff',
  foreground: '#333333',
  cursor: '#333333',
  selectionBackground: '#b3d7ff',
  black: '#000000',
  red: '#cd3131',
  green: '#008000',
  yellow: '#795e26',
  blue: '#007acc',
  magenta: '#af00db',
  cyan: '#098658',
  white: '#cccccc',
  brightBlack: '#666666',
  brightRed: '#f14c4c',
  brightGreen: '#168256',
  brightYellow: '#bf8803',
  brightBlue: '#04395e',
  brightMagenta: '#bc05bc',
  brightCyan: '#16827a',
  brightWhite: '#5e5e5e',
};

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  terminalTheme: UBUNTU_THEME,
  fontFamily: 'JetBrains Mono, Consolas, monospace',
  fontSize: 14,
  cursorBlink: true,
  cursorStyle: 'block',
  scrollback: 10000,
  wordWrap: false,
  copyOnSelect: false,
  rightClickPaste: true,
  confirmClose: true,
  autoReconnect: true,
  reconnectInterval: 5000,
  maxReconnectAttempts: 3,
  showStatusBar: true,
  sidebarWidth: 250,
  keyboardShortcuts: {
    'newTab': 'Ctrl+T',
    'newTabSsh': 'Ctrl+Shift+T',
    'closeTab': 'Ctrl+W',
    'nextTab': 'Ctrl+Tab',
    'prevTab': 'Ctrl+Shift+Tab',
    'toggleSidebar': 'Ctrl+B',
    'copy': 'Ctrl+Shift+C',
    'paste': 'Ctrl+Shift+V',
    'find': 'Ctrl+F',
    'fullscreen': 'F11',
    'settings': 'Ctrl+,',
  },
};

export class SettingsManager {
  private settings: AppSettings;
  private listeners: Set<(settings: AppSettings) => void> = new Set();

  constructor() {
    console.log('[SettingsManager] Initializing...');
    this.settings = this.loadSettings();
    // Apply theme immediately if DOM is ready
    if (typeof document !== 'undefined') {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.applyTheme());
      } else {
        this.applyTheme();
      }
    }
  }

  private loadSettings(): AppSettings {
    try {
      if (typeof localStorage === 'undefined') {
        console.log('[SettingsManager] localStorage not available');
        return { ...DEFAULT_SETTINGS };
      }
      const saved = localStorage.getItem('casterm-settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Validate parsed settings have required fields
        if (this.isValidSettings(parsed)) {
          console.log('[SettingsManager] Loaded from localStorage');
          return { ...DEFAULT_SETTINGS, ...parsed };
        } else {
          console.warn('[SettingsManager] Invalid settings found, using defaults');
          localStorage.removeItem('casterm-settings');
        }
      }
    } catch (e) {
      console.error('[SettingsManager] Error loading settings:', e);
      // Clear corrupted settings
      try {
        localStorage.removeItem('casterm-settings');
      } catch {}
    }
    return { ...DEFAULT_SETTINGS };
  }

  private isValidSettings(obj: any): boolean {
    // Basic validation that loaded object has expected structure
    return obj && typeof obj === 'object' && 
           ['dark', 'light', 'system'].includes(obj.theme) &&
           typeof obj.fontSize === 'number' &&
           typeof obj.scrollback === 'number';
  }

  saveSettings(): void {
    try {
      const json = JSON.stringify(this.settings);
      localStorage.setItem('casterm-settings', json);
      console.log('[SettingsManager] Saved:', json);
      this.notifyListeners();
      this.applyTheme();
    } catch (e) {
      console.error('[SettingsManager] Failed to save:', e);
      alert('Failed to save settings: ' + e);
    }
  }

  getSettings(): AppSettings {
    return { ...this.settings };
  }

  updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    this.settings[key] = value;
    this.saveSettings();
  }

  updateSettings(partial: Partial<AppSettings>): void {
    this.settings = { ...this.settings, ...partial };
    this.saveSettings();
  }

  onChange(listener: (settings: AppSettings) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const settings = this.getSettings();
    this.listeners.forEach(listener => {
      try {
        listener(settings);
      } catch (e) {
        console.error('[SettingsManager] Listener error:', e);
      }
    });
  }

  private applyTheme(): void {
    if (typeof document === 'undefined') return;
    
    const theme = this.settings.theme;
    const root = document.documentElement;
    
    console.log('[SettingsManager] Applying theme:', theme);
    
    // Default (:root) is dark theme, so we only toggle light-theme class
    if (theme === 'dark') {
      root.classList.remove('light-theme');
      console.log('[SettingsManager] Theme: dark (removed light-theme)');
    } else if (theme === 'light') {
      root.classList.add('light-theme');
      console.log('[SettingsManager] Theme: light (added light-theme)');
    } else {
      // System preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        root.classList.remove('light-theme');
        console.log('[SettingsManager] Theme: system (dark)');
      } else {
        root.classList.add('light-theme');
        console.log('[SettingsManager] Theme: system (light)');
      }
    }
  }

  getShortcut(action: string): string {
    return this.settings.keyboardShortcuts[action] || '';
  }

  setShortcut(action: string, shortcut: string): void {
    this.settings.keyboardShortcuts[action] = shortcut;
    this.saveSettings();
  }

  resetToDefaults(): void {
    this.settings = { ...DEFAULT_SETTINGS };
    this.saveSettings();
  }
}

export const settingsManager = new SettingsManager();
