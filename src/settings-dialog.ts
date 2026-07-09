import { settingsManager, AppSettings, DEFAULT_SETTINGS, TerminalTheme, UBUNTU_THEME, DARK_THEME, LIGHT_THEME } from './settings';

// Store dialog instance globally for inline handlers
let currentDialog: SettingsDialog | null = null;

// Expose to window for inline onclick
(window as any).settingsDialogClose = () => currentDialog?.close();
(window as any).settingsDialogSave = () => currentDialog?.doSave();
(window as any).settingsDialogReset = () => currentDialog?.doReset();
(window as any).settingsDialogApplyThemePreset = (preset: string) => currentDialog?.applyThemePreset(preset);
(window as any).settingsDialogResetTheme = () => currentDialog?.resetTheme();

export class SettingsDialog {
  private overlay!: HTMLElement;
  private dialog!: HTMLElement;
  private settings: AppSettings;
  private onClose: () => void;

  constructor(onClose: () => void) {
    this.onClose = onClose;
    this.settings = settingsManager.getSettings();
    currentDialog = this;
    this.createDialog();
  }

  private createDialog(): void {
    const existing = document.querySelector('.settings-dialog-overlay');
    if (existing) existing.remove();

    this.overlay = document.createElement('div');
    this.overlay.className = 'settings-dialog-overlay';
    this.overlay.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      display: flex; align-items: center; justify-content: center;
      z-index: 99999;
    `;

    this.dialog = document.createElement('div');
    this.dialog.style.cssText = `
      background: #1e1e1e; border: 2px solid #007acc; border-radius: 8px;
      width: 600px; max-height: 80vh; display: flex; flex-direction: column;
      overflow: hidden; color: #d4d4d4; font-family: sans-serif;
    `;

    this.render();
    this.overlay.appendChild(this.dialog);
    document.body.appendChild(this.overlay);

    // Close on overlay click
    this.overlay.onclick = (e) => {
      if (e.target === this.overlay) this.close();
    };

    // Close on Escape
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.close();
        document.removeEventListener('keydown', esc);
      }
    };
    document.addEventListener('keydown', esc);
  }

  private render(): void {
    const s = this.settings;
    
    const theme = s.terminalTheme || UBUNTU_THEME;
    const themeBg = theme.background;
    const themeFg = theme.foreground;
    
    this.dialog.innerHTML = `
      <div style="padding: 16px 20px; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center;">
        <h2 style="margin: 0; font-size: 20px;">Settings</h2>
        <button onclick="window.settingsDialogClose()" style="background: none; border: none; color: #858585; font-size: 24px; cursor: pointer;">✕</button>
      </div>
      
      <div style="display: flex; border-bottom: 1px solid #333;">
        <button onclick="this.style.borderBottom='2px solid #007acc'; this.style.color='#fff'; [...this.parentElement.children].forEach(b=>b!==this&&(b.style.borderBottom='none',b.style.color='#858585')); document.getElementById('tab-appearance').style.display='block'; document.getElementById('tab-terminal').style.display='none'; document.getElementById('tab-behavior').style.display='none'; document.getElementById('tab-theme').style.display='none';" style="flex: 1; padding: 12px; background: none; border: none; border-bottom: 2px solid #007acc; color: #fff; cursor: pointer;">Appearance</button>
        <button onclick="this.style.borderBottom='2px solid #007acc'; this.style.color='#fff'; [...this.parentElement.children].forEach(b=>b!==this&&(b.style.borderBottom='none',b.style.color='#858585')); document.getElementById('tab-appearance').style.display='none'; document.getElementById('tab-terminal').style.display='block'; document.getElementById('tab-behavior').style.display='none'; document.getElementById('tab-theme').style.display='none';" style="flex: 1; padding: 12px; background: none; border: none; border-bottom: none; color: #858585; cursor: pointer;">Terminal</button>
        <button onclick="this.style.borderBottom='2px solid #007acc'; this.style.color='#fff'; [...this.parentElement.children].forEach(b=>b!==this&&(b.style.borderBottom='none',b.style.color='#858585')); document.getElementById('tab-appearance').style.display='none'; document.getElementById('tab-terminal').style.display='none'; document.getElementById('tab-behavior').style.display='block'; document.getElementById('tab-theme').style.display='none';" style="flex: 1; padding: 12px; background: none; border: none; border-bottom: none; color: #858585; cursor: pointer;">Behavior</button>
        <button onclick="this.style.borderBottom='2px solid #007acc'; this.style.color='#fff'; [...this.parentElement.children].forEach(b=>b!==this&&(b.style.borderBottom='none',b.style.color='#858585')); document.getElementById('tab-appearance').style.display='none'; document.getElementById('tab-terminal').style.display='none'; document.getElementById('tab-behavior').style.display='none'; document.getElementById('tab-theme').style.display='block';" style="flex: 1; padding: 12px; background: none; border: none; border-bottom: none; color: #858585; cursor: pointer;">Theme</button>
      </div>
      
      <div style="flex: 1; overflow-y: auto; padding: 20px;">
        <!-- Appearance Tab -->
        <div id="tab-appearance">
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 6px; font-weight: bold;">UI Theme</label>
            <select id="st-theme" style="width: 100%; padding: 8px; background: #3c3c3c; border: 1px solid #555; color: #d4d4d4; border-radius: 4px;">
              <option value="dark" ${s.theme === 'dark' ? 'selected' : ''}>Dark</option>
              <option value="light" ${s.theme === 'light' ? 'selected' : ''}>Light</option>
              <option value="system" ${s.theme === 'system' ? 'selected' : ''}>System</option>
            </select>
          </div>
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 6px; font-weight: bold;">Font Family</label>
            <input id="st-font" type="text" value="${s.fontFamily}" style="width: 100%; padding: 8px; background: #3c3c3c; border: 1px solid #555; color: #d4d4d4; border-radius: 4px; box-sizing: border-box;">
          </div>
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 6px; font-weight: bold;">Font Size: <span id="st-fontsize-val">${s.fontSize}</span>px</label>
            <input id="st-fontsize" type="range" min="10" max="24" value="${s.fontSize}" oninput="document.getElementById('st-fontsize-val').textContent=this.value" style="width: 100%;">
          </div>
        </div>
        
        <!-- Terminal Tab -->
        <div id="tab-terminal" style="display: none;">
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 6px; font-weight: bold;">Cursor Style</label>
            <select id="st-cursor" style="width: 100%; padding: 8px; background: #3c3c3c; border: 1px solid #555; color: #d4d4d4; border-radius: 4px;">
              <option value="block" ${s.cursorStyle === 'block' ? 'selected' : ''}>Block</option>
              <option value="line" ${s.cursorStyle === 'line' ? 'selected' : ''}>Line</option>
              <option value="bar" ${s.cursorStyle === 'bar' ? 'selected' : ''}>Bar</option>
            </select>
          </div>
          <div style="margin-bottom: 16px;">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input id="st-blink" type="checkbox" ${s.cursorBlink ? 'checked' : ''}> Cursor Blink
            </label>
          </div>
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 6px; font-weight: bold;">Scrollback Lines</label>
            <input id="st-scroll" type="number" value="${s.scrollback}" min="1000" max="50000" step="1000" style="width: 100%; padding: 8px; background: #3c3c3c; border: 1px solid #555; color: #d4d4d4; border-radius: 4px; box-sizing: border-box;">
          </div>
          <div style="margin-bottom: 16px;">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input id="st-wrap" type="checkbox" ${s.wordWrap ? 'checked' : ''}> Word Wrap
            </label>
          </div>
        </div>
        
        <!-- Behavior Tab -->
        <div id="tab-behavior" style="display: none;">
          <div style="margin-bottom: 16px;">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input id="st-confirm" type="checkbox" ${s.confirmClose ? 'checked' : ''}> Confirm before closing tabs
            </label>
          </div>
          <div style="margin-bottom: 16px;">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input id="st-reconnect" type="checkbox" ${s.autoReconnect ? 'checked' : ''}> Auto-reconnect on disconnect
            </label>
          </div>
          <div style="margin-bottom: 16px;">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input id="st-status" type="checkbox" ${s.showStatusBar ? 'checked' : ''}> Show status bar
            </label>
          </div>
        </div>
        
        <!-- Theme Tab -->
        <div id="tab-theme" style="display: none;">
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 6px; font-weight: bold;">Color Preset</label>
            <select id="st-theme-preset" onchange="window.settingsDialogApplyThemePreset(this.value)" style="width: 100%; padding: 8px; background: #3c3c3c; border: 1px solid #555; color: #d4d4d4; border-radius: 4px;">
              <option value="ubuntu" ${themeBg === '#300924' ? 'selected' : ''}>Ubuntu Aubergine (Default)</option>
              <option value="dark" ${themeBg === '#1e1e1e' ? 'selected' : ''}>Classic Dark</option>
              <option value="light" ${themeBg === '#ffffff' ? 'selected' : ''}>Light</option>
              <option value="custom" ${(themeBg !== '#300924' && themeBg !== '#1e1e1e' && themeBg !== '#ffffff') ? 'selected' : ''}>Custom</option>
            </select>
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
            <div>
              <label style="display: block; margin-bottom: 4px; font-size: 12px; color: #858585;">Background</label>
              <div style="display: flex; gap: 8px; align-items: center;">
                <input type="color" id="st-theme-bg" value="${themeBg}" style="width: 40px; height: 30px; border: none; cursor: pointer;">
                <input type="text" id="st-theme-bg-text" value="${themeBg}" style="flex: 1; padding: 6px; background: #3c3c3c; border: 1px solid #555; color: #d4d4d4; border-radius: 4px; font-family: monospace;" onchange="document.getElementById('st-theme-bg').value=this.value">
              </div>
            </div>
            <div>
              <label style="display: block; margin-bottom: 4px; font-size: 12px; color: #858585;">Foreground</label>
              <div style="display: flex; gap: 8px; align-items: center;">
                <input type="color" id="st-theme-fg" value="${themeFg}" style="width: 40px; height: 30px; border: none; cursor: pointer;">
                <input type="text" id="st-theme-fg-text" value="${themeFg}" style="flex: 1; padding: 6px; background: #3c3c3c; border: 1px solid #555; color: #d4d4d4; border-radius: 4px; font-family: monospace;" onchange="document.getElementById('st-theme-fg').value=this.value">
              </div>
            </div>
          </div>
          
          <div style="padding: 12px; background: #252526; border-radius: 6px; margin-bottom: 16px;">
            <div style="font-size: 12px; color: #858585; margin-bottom: 8px;">Preview</div>
            <div id="theme-preview" style="padding: 16px; border-radius: 4px; font-family: monospace; white-space: pre-wrap;" style="background: ${themeBg}; color: ${themeFg};">$ echo "Hello, World!"
Hello, World!
$ </div>
          </div>
          
          <details style="margin-bottom: 16px;">
            <summary style="cursor: pointer; color: #858585; font-size: 13px;">Advanced Color Options</summary>
            <div style="margin-top: 12px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
              ${this.renderColorInput('Black', 'st-c-black', theme.black || '#000000')}
              ${this.renderColorInput('Red', 'st-c-red', theme.red || '#cc0000')}
              ${this.renderColorInput('Green', 'st-c-green', theme.green || '#4e9a06')}
              ${this.renderColorInput('Yellow', 'st-c-yellow', theme.yellow || '#c4a000')}
              ${this.renderColorInput('Blue', 'st-c-blue', theme.blue || '#3465a4')}
              ${this.renderColorInput('Magenta', 'st-c-magenta', theme.magenta || '#75507b')}
              ${this.renderColorInput('Cyan', 'st-c-cyan', theme.cyan || '#06989a')}
              ${this.renderColorInput('White', 'st-c-white', theme.white || '#d3d7cf')}
            </div>
          </details>
          
          <button onclick="window.settingsDialogResetTheme()" style="padding: 8px 16px; background: transparent; border: 1px solid #555; color: #d4d4d4; border-radius: 4px; cursor: pointer;">Reset to Ubuntu Theme</button>
        </div>
      </div>
      
      <div style="padding: 16px 20px; border-top: 1px solid #333; display: flex; justify-content: space-between;">
        <button onclick="window.settingsDialogReset()" style="padding: 8px 16px; background: transparent; border: 1px solid #555; color: #d4d4d4; border-radius: 4px; cursor: pointer;">Reset</button>
        <div style="display: flex; gap: 8px;">
          <button onclick="window.settingsDialogClose()" style="padding: 8px 16px; background: transparent; border: 1px solid #555; color: #d4d4d4; border-radius: 4px; cursor: pointer;">Cancel</button>
          <button onclick="window.settingsDialogSave()" id="btn-save" style="padding: 8px 16px; background: #007acc; border: none; color: white; border-radius: 4px; cursor: pointer; font-weight: bold;">Save</button>
        </div>
      </div>
    `;
  }

  doSave(): void {
    // Build terminal theme from inputs
    const terminalTheme: TerminalTheme = {
      background: (document.getElementById('st-theme-bg') as HTMLInputElement)?.value || UBUNTU_THEME.background,
      foreground: (document.getElementById('st-theme-fg') as HTMLInputElement)?.value || UBUNTU_THEME.foreground,
      cursor: (document.getElementById('st-theme-fg') as HTMLInputElement)?.value || UBUNTU_THEME.foreground,
      selectionBackground: '#5e2750',
      black: (document.getElementById('st-c-black') as HTMLInputElement)?.value || UBUNTU_THEME.black,
      red: (document.getElementById('st-c-red') as HTMLInputElement)?.value || UBUNTU_THEME.red,
      green: (document.getElementById('st-c-green') as HTMLInputElement)?.value || UBUNTU_THEME.green,
      yellow: (document.getElementById('st-c-yellow') as HTMLInputElement)?.value || UBUNTU_THEME.yellow,
      blue: (document.getElementById('st-c-blue') as HTMLInputElement)?.value || UBUNTU_THEME.blue,
      magenta: (document.getElementById('st-c-magenta') as HTMLInputElement)?.value || UBUNTU_THEME.magenta,
      cyan: (document.getElementById('st-c-cyan') as HTMLInputElement)?.value || UBUNTU_THEME.cyan,
      white: (document.getElementById('st-c-white') as HTMLInputElement)?.value || UBUNTU_THEME.white,
      brightBlack: UBUNTU_THEME.brightBlack,
      brightRed: UBUNTU_THEME.brightRed,
      brightGreen: UBUNTU_THEME.brightGreen,
      brightYellow: UBUNTU_THEME.brightYellow,
      brightBlue: UBUNTU_THEME.brightBlue,
      brightMagenta: UBUNTU_THEME.brightMagenta,
      brightCyan: UBUNTU_THEME.brightCyan,
      brightWhite: UBUNTU_THEME.brightWhite,
    };

    const newSettings: Partial<AppSettings> = {
      theme: (document.getElementById('st-theme') as HTMLSelectElement)?.value as 'dark' | 'light' | 'system' || 'dark',
      terminalTheme,
      fontFamily: (document.getElementById('st-font') as HTMLInputElement)?.value || DEFAULT_SETTINGS.fontFamily,
      fontSize: parseInt((document.getElementById('st-fontsize') as HTMLInputElement)?.value) || DEFAULT_SETTINGS.fontSize,
      cursorStyle: (document.getElementById('st-cursor') as HTMLSelectElement)?.value as 'block' | 'line' | 'bar' || DEFAULT_SETTINGS.cursorStyle,
      cursorBlink: (document.getElementById('st-blink') as HTMLInputElement)?.checked ?? DEFAULT_SETTINGS.cursorBlink,
      scrollback: parseInt((document.getElementById('st-scroll') as HTMLInputElement)?.value) || DEFAULT_SETTINGS.scrollback,
      wordWrap: (document.getElementById('st-wrap') as HTMLInputElement)?.checked ?? DEFAULT_SETTINGS.wordWrap,
      confirmClose: (document.getElementById('st-confirm') as HTMLInputElement)?.checked ?? DEFAULT_SETTINGS.confirmClose,
      autoReconnect: (document.getElementById('st-reconnect') as HTMLInputElement)?.checked ?? DEFAULT_SETTINGS.autoReconnect,
      showStatusBar: (document.getElementById('st-status') as HTMLInputElement)?.checked ?? DEFAULT_SETTINGS.showStatusBar,
    };

    settingsManager.updateSettings(newSettings);
    
    const btn = document.getElementById('btn-save') as HTMLButtonElement;
    if (btn) {
      btn.textContent = 'Saved!';
      btn.style.background = '#28a745';
      setTimeout(() => this.close(), 400);
    } else {
      this.close();
    }
  }

  doReset(): void {
    if (confirm('Reset all settings to defaults?')) {
      settingsManager.resetToDefaults();
      this.settings = settingsManager.getSettings();
      this.render();
    }
  }

  private renderColorInput(label: string, id: string, value: string): string {
    return `
      <div>
        <label style="display: block; margin-bottom: 2px; font-size: 11px; color: #858585;">${label}</label>
        <input type="color" id="${id}" value="${value}" style="width: 100%; height: 28px; border: none; cursor: pointer; border-radius: 3px;">
      </div>
    `;
  }

  applyThemePreset(preset: string): void {
    let theme: TerminalTheme;
    switch (preset) {
      case 'ubuntu':
        theme = UBUNTU_THEME;
        break;
      case 'dark':
        theme = DARK_THEME;
        break;
      case 'light':
        theme = LIGHT_THEME;
        break;
      default:
        return;
    }
    
    // Update color inputs
    const bgInput = document.getElementById('st-theme-bg') as HTMLInputElement;
    const bgText = document.getElementById('st-theme-bg-text') as HTMLInputElement;
    const fgInput = document.getElementById('st-theme-fg') as HTMLInputElement;
    const fgText = document.getElementById('st-theme-fg-text') as HTMLInputElement;
    
    if (bgInput) bgInput.value = theme.background;
    if (bgText) bgText.value = theme.background;
    if (fgInput) fgInput.value = theme.foreground;
    if (fgText) fgText.value = theme.foreground;
    
    // Update preview
    const preview = document.getElementById('theme-preview');
    if (preview) {
      preview.style.background = theme.background;
      preview.style.color = theme.foreground;
    }
    
    // Update advanced colors
    const colorMap: Record<string, keyof TerminalTheme> = {
      'st-c-black': 'black',
      'st-c-red': 'red',
      'st-c-green': 'green',
      'st-c-yellow': 'yellow',
      'st-c-blue': 'blue',
      'st-c-magenta': 'magenta',
      'st-c-cyan': 'cyan',
      'st-c-white': 'white',
    };
    
    for (const [id, key] of Object.entries(colorMap)) {
      const input = document.getElementById(id) as HTMLInputElement;
      if (input && theme[key]) {
        input.value = theme[key];
      }
    }
  }

  resetTheme(): void {
    this.applyThemePreset('ubuntu');
  }

  close(): void {
    currentDialog = null;
    this.overlay.remove();
    this.onClose();
  }
}
