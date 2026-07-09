import { ConnectionDialog } from './connection-dialog';
import { FtpBrowser } from './ftp-browser';
import {
  isEncryptionSetup,
  isEncrypted,
  decrypt,
  encrypt,
  getEncryptionStatus
} from './crypto';

export interface Connection {
  id: string;
  name: string;
  type: 'local' | 'ssh' | 'ftp' | 'sftp' | 'telnet' | 'vnc' | 'rdp';
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  privateKey?: string;
  auth_type?: 'password' | 'key';
  secure?: boolean;
  command?: string;
  children?: Connection[];
  expanded?: boolean;
}

export class ConnectionTree {
  private container: HTMLElement;
  private connections: Connection[] = [];
  private filterText: string = '';
  private masterPassword: string | null = null;
  private isEncrypted: boolean = false;

  constructor(containerId: string) {
    this.container = document.getElementById(containerId)!;
    // Don't load immediately - let main.ts handle encryption unlock first
  }

  /**
   * Initialize with optional master password for decryption
   */
  async initialize(masterPassword?: string): Promise<void> {
    this.masterPassword = masterPassword || null;
    await this.loadConnections();
    this.render();
  }

  /**
   * Check if connections are encrypted
   */
  isDataEncrypted(): boolean {
    const saved = localStorage.getItem('casterm-connections');
    return saved ? isEncrypted(saved) : false;
  }

  /**
   * Check if encryption is set up
   */
  isEncryptionEnabled(): boolean {
    return isEncryptionSetup();
  }

  /**
   * Set master password (for unlock or setup)
   */
  setMasterPassword(password: string): void {
    this.masterPassword = password;
    this.isEncrypted = true;
  }

  private async loadConnections(): Promise<void> {
    const saved = localStorage.getItem('casterm-connections');
    if (saved) {
      try {
        // Check if data is encrypted
        if (isEncrypted(saved)) {
          this.isEncrypted = true;
          if (this.masterPassword) {
            const decrypted = await decrypt(saved, this.masterPassword);
            if (decrypted !== null) {
              this.connections = JSON.parse(decrypted);
            } else {
              console.error('[ConnectionTree] Failed to decrypt - wrong password');
              this.connections = this.getDefaultConnections();
            }
          } else {
            // Encrypted but no password provided - can't load
            console.log('[ConnectionTree] Data encrypted, waiting for password');
            this.connections = this.getDefaultConnections();
          }
        } else {
          // Unencrypted data - migrate on next save if encryption is set up
          this.connections = JSON.parse(saved);
          this.isEncrypted = isEncryptionSetup();
        }
      } catch (error) {
        console.error('[ConnectionTree] Error loading connections:', error);
        this.connections = this.getDefaultConnections();
      }
    } else {
      this.connections = this.getDefaultConnections();
    }
  }

  private async saveConnections(): Promise<void> {
    try {
      const json = JSON.stringify(this.connections);

      // Encrypt if encryption is set up
      if (this.isEncrypted && this.masterPassword) {
        const encrypted = await encrypt(json, this.masterPassword);
        localStorage.setItem('casterm-connections', encrypted);
      } else {
        localStorage.setItem('casterm-connections', json);
      }
    } catch (error) {
      console.error('[ConnectionTree] Failed to save connections:', error);
      throw error;
    }
  }

  private getDefaultConnections(): Connection[] {
    return [
      {
        id: 'local',
        name: 'Local Shell',
        type: 'local',
        children: [],
      },
      {
        id: 'group-1',
        name: 'Production Servers',
        type: 'local',
        expanded: false,
        children: [
          {
            id: 'server-1',
            name: 'Web Server',
            type: 'ssh',
            host: 'web.example.com',
            port: 22,
            username: 'admin',
            auth_type: 'password',
          },
        ],
      },
      {
        id: 'group-2',
        name: 'Development',
        type: 'local',
        expanded: false,
        children: [],
      },
    ];
  }

  setFilter(text: string): void {
    this.filterText = text.toLowerCase();
    this.render();
  }

  render(): void {
    this.container.innerHTML = '';

    // Add search bar
    const searchContainer = document.createElement('div');
    searchContainer.style.cssText = 'padding: 8px; border-bottom: 1px solid var(--border-color);';
    searchContainer.innerHTML = `
      <input type="text" id="conn-search" placeholder="Search connections..."
        style="width: 100%; padding: 6px 10px; background: var(--bg-tertiary); border: 1px solid var(--border-color);
               border-radius: 4px; color: var(--text-primary); font-size: 13px;"
        value="${this.filterText}">
    `;
    const searchInput = searchContainer.querySelector('#conn-search') as HTMLInputElement;
    searchInput?.addEventListener('input', (e) => {
      this.setFilter((e.target as HTMLInputElement).value);
    });
    this.container.appendChild(searchContainer);

    // Show encryption indicator if enabled
    if (this.isEncrypted) {
      const encryptionIndicator = document.createElement('div');
      encryptionIndicator.style.cssText = 'padding: 4px 8px; background: rgba(76, 175, 80, 0.2); border-bottom: 1px solid var(--border-color); font-size: 11px; color: #4caf50; display: flex; align-items: center; gap: 6px;';
      encryptionIndicator.innerHTML = '🔒 Encrypted';
      this.container.appendChild(encryptionIndicator);
    }

    // Render connections
    const treeContainer = document.createElement('div');
    treeContainer.className = 'connection-tree-container';
    treeContainer.style.cssText = 'overflow-y: auto; flex: 1;';

    this.connections.forEach((conn) => {
      this.renderConnection(conn, 0, treeContainer);
    });

    this.container.appendChild(treeContainer);
  }

  private renderConnection(conn: Connection, depth: number, container: HTMLElement): HTMLElement | null {
    // Filter logic
    if (this.filterText) {
      const matches = conn.name.toLowerCase().includes(this.filterText) ||
        (conn.host && conn.host.toLowerCase().includes(this.filterText));
      const hasMatchingChildren = conn.children?.some(child =>
        child.name.toLowerCase().includes(this.filterText) ||
        (child.host && child.host.toLowerCase().includes(this.filterText))
      );
      if (!matches && !hasMatchingChildren) {
        return null;
      }
    }

    const element = document.createElement('div');
    element.className = 'connection-item';
    element.style.paddingLeft = `${depth * 16}px`;

    const hasChildren = conn.children && conn.children.length > 0;
    const expandIcon = hasChildren ? (conn.expanded ? '▼' : '▶') : '•';
    const icon = this.getConnectionIcon(conn.type);

    element.innerHTML = `
      <div class="connection-row" data-id="${conn.id}" style="
        display: flex;
        align-items: center;
        padding: 6px 8px;
        cursor: pointer;
        border-radius: 4px;
        transition: background 0.15s;
      ">
        <span class="expand-icon" style="width: 16px; font-size: 10px;">${expandIcon}</span>
        <span class="connection-icon" style="margin-right: 6px;">${icon}</span>
        <span class="connection-name" style="flex: 1; overflow: hidden; text-overflow: ellipsis;">${conn.name}</span>
        ${conn.host ? `<span style="font-size: 11px; color: var(--text-secondary); margin-left: 8px;">${conn.host}</span>` : ''}
        <div class="connection-actions" style="display: none; gap: 4px;">
          <button class="btn-move" title="Move to Folder" style="background: none; border: none; cursor: pointer; padding: 2px;">📁</button>
          <button class="btn-edit" title="Edit" style="background: none; border: none; cursor: pointer; padding: 2px;">✎</button>
          <button class="btn-delete" title="Delete" style="background: none; border: none; cursor: pointer; padding: 2px;">🗑</button>
        </div>
      </div>
      <div class="connection-children" style="display: ${conn.expanded ? 'block' : 'none'}"></div>
    `;

    const row = element.querySelector('.connection-row') as HTMLElement;
    const actions = element.querySelector('.connection-actions') as HTMLElement;

    // Show/hide actions on hover
    row.addEventListener('mouseenter', () => {
      actions.style.display = 'flex';
    });
    row.addEventListener('mouseleave', () => {
      actions.style.display = 'none';
    });

    row.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('btn-edit')) {
        e.stopPropagation();
        this.editConnection(conn);
      } else if (target.classList.contains('btn-move')) {
        e.stopPropagation();
        this.moveConnectionPrompt(conn.id);
      } else if (target.classList.contains('btn-delete')) {
        e.stopPropagation();
        this.deleteConnection(conn.id);
      } else if (hasChildren && (target.classList.contains('expand-icon'))) {
        e.stopPropagation();
        this.toggleExpanded(conn);
      } else {
        this.connect(conn);
      }
    });

    if (hasChildren && conn.expanded) {
      const childrenContainer = element.querySelector('.connection-children') as HTMLElement;
      conn.children!.forEach((child) => {
        const childEl = this.renderConnection(child, depth + 1, childrenContainer);
        if (childEl) {
          childrenContainer.appendChild(childEl);
        }
      });
    }

    container.appendChild(element);
    return element;
  }

  private getConnectionIcon(type: string): string {
    const icons: Record<string, string> = {
      local: '⌨',
      ssh: '🔒',
      ftp: '📂',
      sftp: '🔐',
      telnet: '📞',
      vnc: '🖥',
      rdp: '🖥',
    };
    return icons[type] || '?';
  }

  private toggleExpanded(conn: Connection): void {
    conn.expanded = !conn.expanded;
    this.saveConnections();
    this.render();
  }

  private connect(conn: Connection): void {
    console.log('Connecting to:', conn.name);

    if (conn.type === 'ftp' || conn.type === 'sftp') {
      // Open file browser (FTP or SFTP)
      this.openFileBrowser(conn);
    } else {
      // Emit event for other connection types
      const event = new CustomEvent('casterm-connect', { detail: conn });
      document.dispatchEvent(event);
    }
  }

  private openFileBrowser(conn: Connection): void {
    // Create modal container for FTP browser
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
      padding: 20px;
    `;

    const container = document.createElement('div');
    container.id = 'ftp-browser-container';
    container.style.cssText = `
      width: 90%;
      max-width: 900px;
      height: 80%;
      background: var(--bg-primary);
      border-radius: 8px;
      overflow: hidden;
    `;

    modal.appendChild(container);
    document.body.appendChild(modal);

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });

    // Initialize FTP browser
    new FtpBrowser('ftp-browser-container', conn, () => {
      if (modal.parentNode) {
        document.body.removeChild(modal);
      }
    });
  }

  addConnectionPrompt(): void {
    new ConnectionDialog(
      (conn, folderId) => {
        if (folderId) {
          // Add to specific folder
          const addToFolder = (conns: Connection[]): boolean => {
            for (const c of conns) {
              if (c.id === folderId) {
                if (!c.children) c.children = [];
                c.children.push(conn);
                c.expanded = true;
                return true;
              }
              if (c.children && addToFolder(c.children)) {
                return true;
              }
            }
            return false;
          };
          if (!addToFolder(this.connections)) {
            this.connections.push(conn);
          }
        } else {
          this.connections.push(conn);
        }
        this.saveConnections();
        this.render();
      },
      undefined,
      this.getAllFolders()
    );
  }

  addFolderPrompt(): void {
    const name = prompt('Folder name:');
    if (!name) return;

    const newFolder: Connection = {
      id: `folder-${Date.now()}`,
      name,
      type: 'local',
      children: [],
      expanded: true,
    };

    this.connections.push(newFolder);
    this.saveConnections();
    this.render();
  }

  moveConnectionPrompt(connId: string): void {
    const conn = this.findConnectionById(connId);
    if (!conn) return;

    const folders = this.getAllFolders().filter(f => f.id !== connId);
    if (folders.length === 0) {
      alert('No folders available. Create a folder first.');
      return;
    }

    const folderNames = folders.map((f, i) => `${i + 1}. ${f.name}`).join('\n');
    const choice = prompt(
      `Move "${conn.name}" to which folder?\n\n${folderNames}\n\nEnter number (or 0 for root):`
    );

    if (choice === null) return;
    const index = parseInt(choice) - 1;

    if (choice === '0') {
      // Move to root
      this.moveConnectionToRoot(connId);
    } else if (index >= 0 && index < folders.length) {
      this.moveConnectionToFolder(connId, folders[index].id);
    }
  }

  private findConnectionById(id: string): Connection | null {
    const find = (conns: Connection[]): Connection | null => {
      for (const c of conns) {
        if (c.id === id) return c;
        if (c.children) {
          const found = find(c.children);
          if (found) return found;
        }
      }
      return null;
    };
    return find(this.connections);
  }

  private getAllFolders(): Connection[] {
    const folders: Connection[] = [];
    const collect = (conns: Connection[]) => {
      for (const c of conns) {
        if (c.children) {
          folders.push(c);
          collect(c.children);
        }
      }
    };
    collect(this.connections);
    return folders;
  }

  private moveConnectionToFolder(connId: string, folderId: string): void {
    // Remove from current location
    let movedConn: Connection | null = null;
    const remove = (conns: Connection[]): boolean => {
      const idx = conns.findIndex(c => c.id === connId);
      if (idx >= 0) {
        movedConn = conns[idx];
        conns.splice(idx, 1);
        return true;
      }
      for (const c of conns) {
        if (c.children && remove(c.children)) return true;
      }
      return false;
    };

    if (!remove(this.connections) || !movedConn) return;

    // Add to new folder
    const add = (conns: Connection[]): boolean => {
      for (const c of conns) {
        if (c.id === folderId) {
          if (!c.children) c.children = [];
          c.children.push(movedConn!);
          c.expanded = true;
          return true;
        }
        if (c.children && add(c.children)) return true;
      }
      return false;
    };

    add(this.connections);
    this.saveConnections();
    this.render();
  }

  private moveConnectionToRoot(connId: string): void {
    let movedConn: Connection | null = null;
    const remove = (conns: Connection[]): boolean => {
      const idx = conns.findIndex(c => c.id === connId);
      if (idx >= 0) {
        movedConn = conns[idx];
        conns.splice(idx, 1);
        return true;
      }
      for (const c of conns) {
        if (c.children && remove(c.children)) return true;
      }
      return false;
    };

    if (remove(this.connections) && movedConn) {
      this.connections.push(movedConn);
      this.saveConnections();
      this.render();
    }
  }

  private editConnection(conn: Connection): void {
    new ConnectionDialog((updatedConn) => {
      const updateRecursive = (conns: Connection[]): boolean => {
        const index = conns.findIndex((c) => c.id === conn.id);
        if (index >= 0) {
          conns[index] = updatedConn;
          return true;
        }
        for (const c of conns) {
          if (c.children && updateRecursive(c.children)) {
            return true;
          }
        }
        return false;
      };

      updateRecursive(this.connections);
      this.saveConnections();
      this.render();
    }, conn, this.getAllFolders());
  }

  private deleteConnection(id: string): void {
    if (!confirm('Delete this connection?')) return;

    const removeRecursive = (conns: Connection[]): boolean => {
      const index = conns.findIndex((c) => c.id === id);
      if (index >= 0) {
        conns.splice(index, 1);
        return true;
      }
      for (const conn of conns) {
        if (conn.children && removeRecursive(conn.children)) {
          return true;
        }
      }
      return false;
    };

    removeRecursive(this.connections);
    this.saveConnections();
    this.render();
  }

  // Export connections to JSON (unencrypted for portability)
  exportConnections(): string {
    return JSON.stringify(this.connections, null, 2);
  }

  // Import connections from JSON
  importConnections(json: string): boolean {
    try {
      const connections = JSON.parse(json);
      if (Array.isArray(connections)) {
        this.connections = connections;
        this.saveConnections();
        this.render();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}