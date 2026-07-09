import { invoke } from '@tauri-apps/api/core';
import { Connection } from './connection-tree';

interface FtpFile {
  name: string;
  size: number;
  is_dir: boolean;
}

export class FtpBrowser {
  private container: HTMLElement;
  private connection: Connection;
  private sessionId: number | null = null;
  private currentPath: string = '/';
  private files: FtpFile[] = [];
  private onClose: () => void;
  private isSftp: boolean;

  constructor(containerId: string, connection: Connection, onClose: () => void) {
    this.container = document.getElementById(containerId)!;
    this.connection = connection;
    this.onClose = onClose;
    this.isSftp = connection.type === 'sftp';
    this.createUI();
    this.connect();
  }

  private createUI(): void {
    this.container.innerHTML = `
      <div class="ftp-browser" style="
        display: flex;
        flex-direction: column;
        height: 100%;
        background: var(--bg-primary);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        overflow: hidden;
      ">
        <div class="ftp-header" style="
          display: flex;
          align-items: center;
          padding: 12px;
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border-color);
          gap: 12px;
        ">
          <span style="font-weight: 600;">${this.isSftp ? '🔐' : '📂'} ${this.connection.name}</span>
          <span id="ftp-path" style="flex: 1; color: var(--text-secondary); font-family: monospace;">${this.currentPath}</span>
          <button id="ftp-refresh" title="Refresh">🔄</button>
          <button id="ftp-mkdir" title="New Folder">📁+</button>
          <button id="ftp-upload" title="Upload">⬆</button>
          <button id="ftp-close" title="Close">✕</button>
        </div>
        
        <div id="ftp-file-list" style="
          flex: 1;
          overflow-y: auto;
          padding: 8px;
        ">
          <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
            Connecting to ${this.connection.host}...
          </div>
        </div>
        
        <div class="ftp-status" style="
          padding: 8px 12px;
          background: var(--bg-secondary);
          border-top: 1px solid var(--border-color);
          font-size: 12px;
          color: var(--text-secondary);
        ">
          Ready
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    document.getElementById('ftp-close')?.addEventListener('click', () => {
      this.disconnect();
      this.onClose();
    });

    document.getElementById('ftp-refresh')?.addEventListener('click', () => {
      this.refresh();
    });

    document.getElementById('ftp-mkdir')?.addEventListener('click', () => {
      this.createDirectory();
    });

    document.getElementById('ftp-upload')?.addEventListener('click', () => {
      this.uploadFile();
    });
  }

  private async connect(): Promise<void> {
    try {
      if (this.isSftp) {
        await this.connectSftp();
      } else {
        await this.connectFtp();
      }
      this.updateStatus('Connected');
      await this.refresh();
    } catch (error) {
      this.showError(`Connection failed: ${error}`);
    }
  }

  private async connectFtp(): Promise<void> {
    const options = {
      host: this.connection.host || '',
      port: this.connection.port || 21,
      username: this.connection.username || 'anonymous',
      password: this.connection.password || '',
      secure: this.connection.secure || false,
    };

    // Prompt for password if not saved
    if (!options.password) {
      const password = prompt(`Enter password for ${options.username}@${options.host}:`);
      if (!password) {
        throw new Error('Connection cancelled - password required');
      }
      options.password = password;
    }

    this.sessionId = await invoke<number>('create_ftp_session', { options });
  }

  private async connectSftp(): Promise<void> {
    const options = {
      host: this.connection.host || '',
      port: this.connection.port || 22,
      username: this.connection.username || '',
      auth_type: this.connection.auth_type || 'password',
      password: this.connection.password || undefined,
      private_key: this.connection.privateKey || undefined,
    };

    // Prompt for password if using password auth and not saved
    if (options.auth_type === 'password' && !options.password) {
      const password = prompt(`Enter password for ${options.username}@${options.host}:`);
      if (!password) {
        throw new Error('Connection cancelled - password required');
      }
      options.password = password;
    }

    this.sessionId = await invoke<number>('create_sftp_session', { options });
  }

  private async disconnect(): Promise<void> {
    if (this.sessionId !== null) {
      try {
        const cmd = this.isSftp ? 'close_sftp_session' : 'close_ftp_session';
        await invoke(cmd, { id: this.sessionId });
      } catch (e) {
        // Ignore errors on disconnect
      }
      this.sessionId = null;
    }
  }

  private async refresh(): Promise<void> {
    if (this.sessionId === null) return;

    try {
      this.updateStatus('Loading...');
      const cmd = this.isSftp ? 'sftp_list_directory' : 'ftp_list_directory';
      const path = this.isSftp ? this.currentPath : null;
      this.files = await invoke<FtpFile[]>(cmd, { 
        id: this.sessionId,
        path 
      });
      this.renderFileList();
      this.updateStatus(`${this.files.length} items`);
    } catch (error) {
      this.showError(`Failed to list directory: ${error}`);
    }
  }

  private renderFileList(): void {
    const listContainer = document.getElementById('ftp-file-list');
    if (!listContainer) return;

    if (this.files.length === 0) {
      listContainer.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
          Empty directory
        </div>
      `;
      return;
    }

    // Sort: directories first, then files
    const sorted = [...this.files].sort((a, b) => {
      if (a.is_dir && !b.is_dir) return -1;
      if (!a.is_dir && b.is_dir) return 1;
      return a.name.localeCompare(b.name);
    });

    listContainer.innerHTML = sorted.map(file => `
      <div class="ftp-file-item" data-name="${file.name}" data-is-dir="${file.is_dir}" style="
        display: flex;
        align-items: center;
        padding: 8px 12px;
        cursor: pointer;
        border-radius: 4px;
        transition: background 0.15s;
      ">
        <span style="margin-right: 8px;">${file.is_dir ? '📁' : '📄'}</span>
        <span style="flex: 1; overflow: hidden; text-overflow: ellipsis;">${file.name}</span>
        <span style="color: var(--text-secondary); font-size: 12px; margin-left: 8px;">
          ${file.is_dir ? '' : this.formatSize(file.size)}
        </span>
        <div class="file-actions" style="display: none; gap: 4px; margin-left: 8px;">
          ${file.is_dir ? '' : '<button class="btn-download" title="Download">⬇</button>'}
          <button class="btn-delete" title="Delete">🗑</button>
        </div>
      </div>
    `).join('');

    // Add click handlers
    listContainer.querySelectorAll('.ftp-file-item').forEach(item => {
      const name = item.getAttribute('data-name')!;
      const isDir = item.getAttribute('data-is-dir') === 'true';

      item.addEventListener('mouseenter', () => {
        const actions = item.querySelector('.file-actions') as HTMLElement;
        if (actions) actions.style.display = 'flex';
      });

      item.addEventListener('mouseleave', () => {
        const actions = item.querySelector('.file-actions') as HTMLElement;
        if (actions) actions.style.display = 'none';
      });

      item.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('btn-download')) {
          e.stopPropagation();
          this.downloadFile(name);
        } else if (target.classList.contains('btn-delete')) {
          e.stopPropagation();
          this.deleteFile(name, isDir);
        } else if (isDir) {
          this.changeDirectory(name);
        }
      });
    });
  }

  private async changeDirectory(dirName: string): Promise<void> {
    if (this.sessionId === null) return;

    try {
      // For SFTP, just update the path locally
      if (this.isSftp) {
        this.currentPath = this.currentPath === '/' ? `/${dirName}` : `${this.currentPath}/${dirName}`;
        document.getElementById('ftp-path')!.textContent = this.currentPath;
        await this.refresh();
        return;
      }
      
      // For FTP, use the change directory command
      const newPath = await invoke<string>('ftp_change_directory', {
        id: this.sessionId,
        path: dirName,
      });
      this.currentPath = newPath;
      document.getElementById('ftp-path')!.textContent = newPath;
      await this.refresh();
    } catch (error) {
      this.showError(`Failed to change directory: ${error}`);
    }
  }

  private async downloadFile(fileName: string): Promise<void> {
    if (this.sessionId === null) return;

    try {
      this.updateStatus(`Downloading ${fileName}...`);
      const cmd = this.isSftp ? 'sftp_download_file' : 'ftp_download_file';
      const remotePath = this.isSftp ? `${this.currentPath}/${fileName}` : fileName;
      const data = await invoke<number[]>(cmd, {
        id: this.sessionId,
        remotePath,
      });

      // Convert to blob and download
      const blob = new Blob([new Uint8Array(data)]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);

      this.updateStatus(`Downloaded ${fileName}`);
    } catch (error) {
      this.showError(`Download failed: ${error}`);
    }
  }

  private async uploadFile(): Promise<void> {
    if (this.sessionId === null) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        this.updateStatus(`Uploading ${file.name}...`);
        const arrayBuffer = await file.arrayBuffer();
        const data = Array.from(new Uint8Array(arrayBuffer));

        const cmd = this.isSftp ? 'sftp_upload_file' : 'ftp_upload_file';
        const remotePath = this.isSftp ? `${this.currentPath}/${file.name}` : file.name;
        await invoke(cmd, {
          id: this.sessionId,
          remotePath,
          data,
        });

        this.updateStatus(`Uploaded ${file.name}`);
        await this.refresh();
      } catch (error) {
        this.showError(`Upload failed: ${error}`);
      }
    };
    input.click();
  }

  private async deleteFile(name: string, isDir: boolean): Promise<void> {
    if (this.sessionId === null) return;
    if (!confirm(`Delete ${isDir ? 'folder' : 'file'} "${name}"?`)) return;

    try {
      const path = this.isSftp ? `${this.currentPath}/${name}` : name;
      if (isDir) {
        const cmd = this.isSftp ? 'sftp_remove_directory' : 'ftp_remove_directory';
        await invoke(cmd, {
          id: this.sessionId,
          path,
        });
      } else {
        const cmd = this.isSftp ? 'sftp_delete_file' : 'ftp_delete_file';
        await invoke(cmd, {
          id: this.sessionId,
          path,
        });
      }
      this.updateStatus(`Deleted ${name}`);
      await this.refresh();
    } catch (error) {
      this.showError(`Delete failed: ${error}`);
    }
  }

  private async createDirectory(): Promise<void> {
    if (this.sessionId === null) return;

    const name = prompt('New folder name:');
    if (!name) return;

    try {
      const cmd = this.isSftp ? 'sftp_make_directory' : 'ftp_make_directory';
      const path = this.isSftp ? `${this.currentPath}/${name}` : name;
      await invoke(cmd, {
        id: this.sessionId,
        path,
      });
      this.updateStatus(`Created folder ${name}`);
      await this.refresh();
    } catch (error) {
      this.showError(`Failed to create folder: ${error}`);
    }
  }

  private formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  private updateStatus(message: string): void {
    const status = this.container.querySelector('.ftp-status');
    if (status) {
      status.textContent = message;
    }
  }

  private showError(message: string): void {
    const listContainer = document.getElementById('ftp-file-list');
    if (listContainer) {
      listContainer.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #f14c4c;">
          ${message}
        </div>
      `;
    }
    this.updateStatus('Error');
  }
}
