import {
  isEncryptionSetup,
  setupEncryption,
  decrypt,
  encrypt,
  changePassword,
  removeEncryption,
  getEncryptionStatus,
  isEncrypted
} from './crypto';

export type MasterPasswordCallback = (password: string | null) => void;

export class MasterPasswordDialog {
  private overlay: HTMLElement | null = null;
  private dialog: HTMLElement | null = null;
  private onComplete: MasterPasswordCallback;
  private mode: 'setup' | 'unlock' | 'change';
  private existingData: string | null = null;

  constructor(
    onComplete: MasterPasswordCallback,
    mode: 'setup' | 'unlock' | 'change' = 'unlock',
    existingData: string | null = null
  ) {
    this.onComplete = onComplete;
    this.mode = mode;
    this.existingData = existingData;
    this.createDialog();
  }

  private createDialog(): void {
    // Create overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'dialog-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    // Create dialog
    this.dialog = document.createElement('div');
    this.dialog.className = 'master-password-dialog';
    this.dialog.style.cssText = `
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 28px;
      width: 90%;
      max-width: 420px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    `;

    this.renderContent();
    this.overlay.appendChild(this.dialog);
    document.body.appendChild(this.overlay);

    // Focus first input
    setTimeout(() => {
      const firstInput = this.dialog?.querySelector('input');
      firstInput?.focus();
    }, 100);
  }

  private renderContent(): void {
    if (!this.dialog) return;

    const titles = {
      setup: '🔐 Set Master Password',
      unlock: '🔐 Enter Master Password',
      change: '🔐 Change Master Password'
    };

    const descriptions = {
      setup: 'Create a master password to encrypt your connection data. You\'ll need this every time you start Casterm.',
      unlock: 'Enter your master password to unlock your connections.',
      change: 'Enter your current password, then set a new one.'
    };

    let formHtml = '';

    if (this.mode === 'setup') {
      formHtml = `
        <div class="form-group" style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 6px; font-size: 12px; color: var(--text-secondary); font-weight: 500;">Master Password</label>
          <input type="password" id="mp-password" 
            style="width: 100%; padding: 10px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary); font-size: 14px; box-sizing: border-box;"
            placeholder="Enter a strong password">
        </div>
        <div class="form-group" style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 6px; font-size: 12px; color: var(--text-secondary); font-weight: 500;">Confirm Password</label>
          <input type="password" id="mp-confirm" 
            style="width: 100%; padding: 10px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary); font-size: 14px; box-sizing: border-box;"
            placeholder="Confirm your password">
        </div>
      `;
    } else if (this.mode === 'unlock') {
      formHtml = `
        <div class="form-group" style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 6px; font-size: 12px; color: var(--text-secondary); font-weight: 500;">Master Password</label>
          <input type="password" id="mp-password" 
            style="width: 100%; padding: 10px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary); font-size: 14px; box-sizing: border-box;"
            placeholder="Enter your master password">
        </div>
      `;
    } else if (this.mode === 'change') {
      formHtml = `
        <div class="form-group" style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 6px; font-size: 12px; color: var(--text-secondary); font-weight: 500;">Current Password</label>
          <input type="password" id="mp-current" 
            style="width: 100%; padding: 10px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary); font-size: 14px; box-sizing: border-box;"
            placeholder="Enter current password">
        </div>
        <div class="form-group" style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 6px; font-size: 12px; color: var(--text-secondary); font-weight: 500;">New Password</label>
          <input type="password" id="mp-password" 
            style="width: 100%; padding: 10px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary); font-size: 14px; box-sizing: border-box;"
            placeholder="Enter new password">
        </div>
        <div class="form-group" style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 6px; font-size: 12px; color: var(--text-secondary); font-weight: 500;">Confirm New Password</label>
          <input type="password" id="mp-confirm" 
            style="width: 100%; padding: 10px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary); font-size: 14px; box-sizing: border-box;"
            placeholder="Confirm new password">
        </div>
      `;
    }

    this.dialog.innerHTML = `
      <h2 style="margin: 0 0 12px 0; font-size: 18px; color: var(--text-primary);">${titles[this.mode]}</h2>
      <p style="margin: 0 0 24px 0; font-size: 13px; color: var(--text-secondary); line-height: 1.5;">${descriptions[this.mode]}</p>
      
      <form id="master-password-form">
        ${formHtml}
        
        <div id="mp-error" style="display: none; margin-bottom: 16px; padding: 10px; background: rgba(220, 53, 69, 0.2); border: 1px solid rgba(220, 53, 69, 0.4); border-radius: 4px; color: #ff6b6b; font-size: 13px;"></div>
        
        <div class="form-actions" style="display: flex; gap: 12px; justify-content: flex-end;">
          ${this.mode === 'unlock' ? `
            <button type="button" id="mp-reset" 
              style="padding: 10px 16px; background: transparent; border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-secondary); cursor: pointer; font-size: 13px;">
              Reset Data
            </button>
          ` : ''}
          <button type="button" id="mp-cancel" 
            style="padding: 10px 16px; background: transparent; border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary); cursor: pointer; font-size: 13px;">
            ${this.mode === 'unlock' ? 'Skip' : 'Cancel'}
          </button>
          <button type="submit" 
            style="padding: 10px 16px; background: var(--accent-primary); border: none; border-radius: 4px; color: white; cursor: pointer; font-size: 13px; font-weight: 500;">
            ${this.mode === 'unlock' ? 'Unlock' : 'Confirm'}
          </button>
        </div>
      </form>
    `;

    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    if (!this.dialog || !this.overlay) return;

    const form = this.dialog.querySelector('#master-password-form');
    const cancelBtn = this.dialog.querySelector('#mp-cancel');
    const resetBtn = this.dialog.querySelector('#mp-reset');

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleSubmit();
    });

    cancelBtn?.addEventListener('click', () => {
      this.onComplete(null);
      this.close();
    });

    resetBtn?.addEventListener('click', () => {
      if (confirm('WARNING: This will permanently delete all your connections. This cannot be undone.\n\nAre you sure?')) {
        if (confirm('Final confirmation: All connection data will be lost forever.\n\nProceed?')) {
          removeEncryption();
          localStorage.removeItem('casterm-connections');
          this.onComplete('__RESET__');
          this.close();
        }
      }
    });

    // Close on escape
    const escapeHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.onComplete(null);
        this.close();
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);
  }

  private async handleSubmit(): Promise<void> {
    if (!this.dialog) return;

    const errorDiv = this.dialog.querySelector('#mp-error') as HTMLElement;
    errorDiv.style.display = 'none';
    errorDiv.textContent = '';

    try {
      if (this.mode === 'setup') {
        const password = (this.dialog.querySelector('#mp-password') as HTMLInputElement)?.value;
        const confirm = (this.dialog.querySelector('#mp-confirm') as HTMLInputElement)?.value;

        if (!password || password.length < 4) {
          throw new Error('Password must be at least 4 characters');
        }
        if (password !== confirm) {
          throw new Error('Passwords do not match');
        }

        await setupEncryption(password);
        this.onComplete(password);
        this.close();

      } else if (this.mode === 'unlock') {
        const password = (this.dialog.querySelector('#mp-password') as HTMLInputElement)?.value;

        if (!password) {
          throw new Error('Please enter your password');
        }

        // Verify password works
        if (this.existingData) {
          const decrypted = await decrypt(this.existingData, password);
          if (decrypted === null) {
            throw new Error('Incorrect password');
          }
        }

        this.onComplete(password);
        this.close();

      } else if (this.mode === 'change') {
        const current = (this.dialog.querySelector('#mp-current') as HTMLInputElement)?.value;
        const password = (this.dialog.querySelector('#mp-password') as HTMLInputElement)?.value;
        const confirm = (this.dialog.querySelector('#mp-confirm') as HTMLInputElement)?.value;

        if (!current || !password || !confirm) {
          throw new Error('All fields are required');
        }
        if (password.length < 4) {
          throw new Error('New password must be at least 4 characters');
        }
        if (password !== confirm) {
          throw new Error('New passwords do not match');
        }

        this.onComplete(JSON.stringify({ current, new: password }));
        this.close();
      }
    } catch (error) {
      errorDiv.textContent = error instanceof Error ? error.message : 'An error occurred';
      errorDiv.style.display = 'block';
    }
  }

  private close(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    this.dialog = null;
  }
}

/**
 * Show dialog to set up encryption for the first time
 */
export function showSetupEncryption(onComplete: MasterPasswordCallback): void {
  new MasterPasswordDialog(onComplete, 'setup');
}

/**
 * Show dialog to unlock encrypted data
 */
export function showUnlockEncryption(
  encryptedData: string,
  onComplete: MasterPasswordCallback
): void {
  new MasterPasswordDialog(onComplete, 'unlock', encryptedData);
}

/**
 * Show dialog to change master password
 */
export function showChangePassword(onComplete: MasterPasswordCallback): void {
  new MasterPasswordDialog(onComplete, 'change');
}

/**
 * Check if we need to show encryption setup or unlock dialog
 */
export async function checkEncryptionStatus(): Promise<{
  needsSetup: boolean;
  needsUnlock: boolean;
  hasData: boolean;
}> {
  const status = getEncryptionStatus();
  const connectionsData = localStorage.getItem('casterm-connections');

  return {
    needsSetup: !status.setup && !connectionsData,
    needsUnlock: status.setup && connectionsData !== null,
    hasData: connectionsData !== null
  };
}
