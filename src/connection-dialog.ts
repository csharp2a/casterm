import { Connection } from './connection-tree';

export class ConnectionDialog {
  private overlay: HTMLElement;
  private dialog: HTMLElement;
  private onSave: (conn: Connection, folderId?: string) => void;
  private connection: Connection;
  private isEdit: boolean;
  private folders: Connection[];

  constructor(
    onSave: (conn: Connection, folderId?: string) => void,
    connection?: Connection,
    folders?: Connection[]
  ) {
    this.onSave = onSave;
    this.isEdit = !!connection;
    this.folders = folders || [];
    this.connection = connection || {
      id: `conn-${Date.now()}`,
      name: '',
      type: 'ssh',
      host: '',
      port: 22,
      username: '',
    };

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
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    `;

    // Create dialog
    this.dialog = document.createElement('div');
    this.dialog.className = 'connection-dialog';
    this.dialog.style.cssText = `
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 24px;
      width: 90%;
      max-width: 500px;
      max-height: 90vh;
      overflow-y: auto;
    `;

    this.renderContent();
    this.overlay.appendChild(this.dialog);
    document.body.appendChild(this.overlay);

    // Close on overlay click
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.close();
      }
    });

    // Close on Escape
    const escapeHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.close();
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);
  }

  private renderContent(): void {
    const title = this.isEdit ? 'Edit Connection' : 'New Connection';
    const type = this.connection.type;
    
    // Build folder options
    const folderOptions = this.folders.length > 0 
      ? `
        <div class="form-group" style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 4px; font-size: 12px; color: var(--text-secondary);">Folder (optional)</label>
          <select id="conn-folder" 
            style="width: 100%; padding: 8px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary);">
            <option value="">-- Root (no folder) --</option>
            ${this.folders.map(f => `<option value="${f.id}">${f.name}</option>`).join('')}
          </select>
        </div>
      `
      : '';

    this.dialog.innerHTML = `
      <h2 style="margin-top: 0; margin-bottom: 20px;">${title}</h2>
      
      <form id="connection-form">
        <div class="form-group" style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 4px; font-size: 12px; color: var(--text-secondary);">Name</label>
          <input type="text" id="conn-name" value="${this.connection.name}" 
            style="width: 100%; padding: 8px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary);"
            placeholder="My Server" required>
        </div>

        ${folderOptions}

        <div class="form-group" style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 4px; font-size: 12px; color: var(--text-secondary);">Type</label>
          <select id="conn-type" 
            style="width: 100%; padding: 8px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary);">
            <option value="ssh" ${type === 'ssh' ? 'selected' : ''}>SSH</option>
            <option value="ftp" ${type === 'ftp' ? 'selected' : ''}>FTP</option>
            <option value="sftp" ${type === 'sftp' ? 'selected' : ''}>SFTP (SSH)</option>
            <option value="local" ${type === 'local' ? 'selected' : ''}>Local Shell</option>
          </select>
        </div>

        <div id="remote-fields" style="display: ${type === 'ssh' || type === 'ftp' || type === 'sftp' ? 'block' : 'none'};">
          <div class="form-group" style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 4px; font-size: 12px; color: var(--text-secondary);">Host</label>
            <input type="text" id="conn-host" value="${this.connection.host || ''}"
              style="width: 100%; padding: 8px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary);"
              placeholder="server.example.com">
          </div>

          <div class="form-group" style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 4px; font-size: 12px; color: var(--text-secondary);">Port</label>
            <input type="number" id="conn-port" value="${this.connection.port || (type === 'ftp' ? 21 : 22)}"
              style="width: 100%; padding: 8px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary);">
          </div>

          <div class="form-group" style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 4px; font-size: 12px; color: var(--text-secondary);">Username</label>
            <input type="text" id="conn-username" value="${this.connection.username || ''}"
              style="width: 100%; padding: 8px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary);"
              placeholder="root">
          </div>

          <div class="form-group" style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 4px; font-size: 12px; color: var(--text-secondary);">Password</label>
            <input type="password" id="conn-password" value="${this.connection.password || ''}"
              style="width: 100%; padding: 8px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary);"
              placeholder="Leave empty to prompt">
          </div>

          <div id="ssh-extra-fields" style="display: ${type === 'ssh' || type === 'sftp' ? 'block' : 'none'};">
            <div class="form-group" style="margin-bottom: 16px;">
              <label style="display: block; margin-bottom: 4px; font-size: 12px; color: var(--text-secondary);">Authentication</label>
              <select id="conn-auth-type"
                style="width: 100%; padding: 8px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary);">
                <option value="password" ${!this.connection.privateKey ? 'selected' : ''}>Password</option>
                <option value="key" ${this.connection.privateKey ? 'selected' : ''}>Private Key</option>
              </select>
            </div>

            <div id="key-field" style="display: ${this.connection.privateKey ? 'block' : 'none'};">
              <div class="form-group" style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 4px; font-size: 12px; color: var(--text-secondary);">Private Key Path</label>
                <input type="text" id="conn-private-key" value="${this.connection.privateKey || ''}"
                  style="width: 100%; padding: 8px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary); font-family: monospace;"
                  placeholder="/home/user/.ssh/id_rsa"
                  autocomplete="off"
                  autocorrect="off"
                  autocapitalize="off"
                  spellcheck="false">
                <small style="display: block; margin-top: 4px; font-size: 11px; color: var(--text-secondary);">Example: /home/user/.ssh/id_rsa or ~/.ssh/id_ed25519</small>
              </div>
            </div>
          </div>

          <div id="ftp-extra-fields" style="display: ${type === 'ftp' ? 'block' : 'none'};">
            <div class="form-group" style="margin-bottom: 16px;">
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" id="conn-secure" ${this.connection.secure ? 'checked' : ''}>
                <span style="font-size: 12px; color: var(--text-secondary);">Use FTPS (TLS/SSL)</span>
              </label>
            </div>
          </div>
          <div id="sftp-note" style="display: ${type === 'sftp' ? 'block' : 'none'}; margin-bottom: 16px; padding: 8px; background: var(--bg-tertiary); border-radius: 4px;">
            <span style="font-size: 12px; color: var(--text-secondary);">SFTP runs over SSH on port 22</span>
          </div>
        </div>

        <div class="form-actions" style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
          <button type="button" id="btn-cancel" 
            style="padding: 8px 16px; background: transparent; border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary); cursor: pointer;">
            Cancel
          </button>
          <button type="submit" 
            style="padding: 8px 16px; background: var(--accent-primary); border: none; border-radius: 4px; color: white; cursor: pointer;">
            Save
          </button>
        </div>
      </form>
    `;

    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    const typeSelect = this.dialog.querySelector('#conn-type') as HTMLSelectElement;
    const authSelect = this.dialog.querySelector('#conn-auth-type') as HTMLSelectElement;
    const cancelBtn = this.dialog.querySelector('#btn-cancel');
    const form = this.dialog.querySelector('#connection-form');

    typeSelect?.addEventListener('change', () => {
      const remoteFields = this.dialog.querySelector('#remote-fields') as HTMLElement;
      const sshExtraFields = this.dialog.querySelector('#ssh-extra-fields') as HTMLElement;
      const ftpExtraFields = this.dialog.querySelector('#ftp-extra-fields') as HTMLElement;
      const sftpNote = this.dialog.querySelector('#sftp-note') as HTMLElement;
      const portInput = this.dialog.querySelector('#conn-port') as HTMLInputElement;
      
      const type = typeSelect.value;
      const isRemote = type === 'ssh' || type === 'ftp' || type === 'sftp';
      remoteFields.style.display = isRemote ? 'block' : 'none';
      sshExtraFields.style.display = type === 'ssh' || type === 'sftp' ? 'block' : 'none';
      ftpExtraFields.style.display = type === 'ftp' ? 'block' : 'none';
      if (sftpNote) sftpNote.style.display = type === 'sftp' ? 'block' : 'none';
      
      if (type === 'ftp') {
        portInput.value = '21';
      } else if (type === 'ssh' || type === 'sftp') {
        portInput.value = '22';
      }
    });

    authSelect?.addEventListener('change', () => {
      const keyField = this.dialog.querySelector('#key-field') as HTMLElement;
      const isKey = authSelect.value === 'key';
      keyField.style.display = isKey ? 'block' : 'none';
      if (isKey) {
        // Focus the key input when switching to key auth
        setTimeout(() => {
          const keyInput = this.dialog.querySelector('#conn-private-key') as HTMLInputElement;
          keyInput?.focus();
        }, 0);
      }
    });

    // Add input validation for SSH key path to ensure special characters are preserved
    const privateKeyInput = this.dialog.querySelector('#conn-private-key') as HTMLInputElement;
    privateKeyInput?.addEventListener('input', (e) => {
      const input = e.target as HTMLInputElement;
      // Log for debugging - helps identify if characters are being lost
      console.log('[ConnectionDialog] Key path input:', input.value);
    });

    cancelBtn?.addEventListener('click', () => this.close());

    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.save();
    });
  }

  private save(): void {
    const name = (this.dialog.querySelector('#conn-name') as HTMLInputElement).value;
    const type = (this.dialog.querySelector('#conn-type') as HTMLSelectElement).value as Connection['type'];

    if (!name) {
      alert('Name is required');
      return;
    }

    const updatedConn: Connection = {
      ...this.connection,
      name,
      type,
    };

    if (type === 'ssh' || type === 'ftp' || type === 'sftp') {
      updatedConn.host = (this.dialog.querySelector('#conn-host') as HTMLInputElement).value;
      updatedConn.port = parseInt((this.dialog.querySelector('#conn-port') as HTMLInputElement).value) || (type === 'ftp' ? 21 : 22);
      updatedConn.username = (this.dialog.querySelector('#conn-username') as HTMLInputElement).value;
      updatedConn.password = (this.dialog.querySelector('#conn-password') as HTMLInputElement).value || undefined;

      if (type === 'ssh' || type === 'sftp') {
        const authType = (this.dialog.querySelector('#conn-auth-type') as HTMLSelectElement).value;
        updatedConn.auth_type = authType === 'password' ? 'password' : 'key';
        if (authType === 'key') {
          updatedConn.privateKey = (this.dialog.querySelector('#conn-private-key') as HTMLInputElement).value || undefined;
        } else {
          updatedConn.privateKey = undefined;
        }
      } else if (type === 'ftp') {
        updatedConn.secure = (this.dialog.querySelector('#conn-secure') as HTMLInputElement).checked;
      }
    }

    // Get selected folder
    const folderSelect = this.dialog.querySelector('#conn-folder') as HTMLSelectElement;
    const folderId = folderSelect?.value || undefined;
    
    this.onSave(updatedConn, folderId);
    this.close();
  }

  private close(): void {
    this.overlay.remove();
  }
}
