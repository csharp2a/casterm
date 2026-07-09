use parking_lot::Mutex;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;

pub struct SftpSession {
    pub id: u32,
    pub sftp: Mutex<ssh2::Sftp>,
    pub _session: Mutex<ssh2::Session>, // Keep SSH session alive
    pub host: String,
}

pub struct SftpState {
    pub sessions: Mutex<HashMap<u32, Arc<SftpSession>>>,
    pub next_id: AtomicU32,
}

impl SftpState {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
            next_id: AtomicU32::new(1),
        }
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SftpConnectionOptions {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_type: String,
    pub password: Option<String>,
    pub private_key: Option<String>,
    pub private_key_passphrase: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct SftpFileInfo {
    pub name: String,
    pub size: u64,
    pub is_dir: bool,
    pub modified: Option<u64>,
}

#[tauri::command]
pub async fn create_sftp_session(
    state: tauri::State<'_, Arc<SftpState>>,
    options: SftpConnectionOptions,
) -> Result<u32, String> {
    let id = state.next_id.fetch_add(1, Ordering::SeqCst);

    let host = options.host.clone();
    let port = options.port;
    let username = options.username.clone();
    let password = options.password.clone();
    let private_key = options.private_key.clone();
    let auth_type = options.auth_type.clone();

    let session = tokio::task::spawn_blocking(move || {
        // Connect to SSH server
        let tcp = TcpStream::connect(format!("{}:{}", host, port))
            .map_err(|e| format!("Failed to connect to {}:{} - {}", host, port, e))?;

        let mut sess = ssh2::Session::new()
            .map_err(|e| format!("Failed to create SSH session: {}", e))?;
        
        sess.set_tcp_stream(tcp);
        sess.handshake()
            .map_err(|e| format!("SSH handshake failed: {}", e))?;

        // Authenticate
        match auth_type.as_str() {
            "password" => {
                let pass = password.ok_or("Password required")?;
                sess.userauth_password(&username, &pass)
                    .map_err(|e| format!("Password authentication failed: {}", e))?;
            }
            "key" => {
                let key_path = private_key.ok_or("Private key required")?;
                let key_path = shellexpand::tilde(&key_path).to_string();
                
                sess.userauth_pubkey_file(
                    &username,
                    None, // No public key file (will be derived from private key)
                    std::path::Path::new(&key_path),
                    password.as_deref(),
                ).map_err(|e| format!("Key authentication failed: {}", e))?;
            }
            _ => return Err("Invalid authentication type".to_string()),
        }

        if !sess.authenticated() {
            return Err("Authentication failed".to_string());
        }

        // Create SFTP session
        let sftp = sess.sftp()
            .map_err(|e| format!("Failed to create SFTP session: {}", e))?;

        Ok::<_, String>(Arc::new(SftpSession {
            id,
            sftp: Mutex::new(sftp),
            _session: Mutex::new(sess),
            host: host.clone(),
        }))
    }).await.map_err(|e| format!("Task failed: {}", e))?;

    let session = session?;
    state.sessions.lock().insert(id, session);

    Ok(id)
}

#[tauri::command]
pub async fn sftp_list_directory(
    state: tauri::State<'_, Arc<SftpState>>,
    id: u32,
    path: String,
) -> Result<Vec<SftpFileInfo>, String> {
    let session = {
        let sessions = state.sessions.lock();
        sessions.get(&id).cloned().ok_or("SFTP session not found")?
    };

    tokio::task::spawn_blocking(move || {
        let sftp = session.sftp.lock();
        
        let entries = sftp.readdir(std::path::Path::new(&path))
            .map_err(|e| format!("Failed to list directory: {}", e))?;

        let files: Vec<SftpFileInfo> = entries.into_iter()
            .filter_map(|(path, stat)| {
                let name = path.file_name()?.to_string_lossy().to_string();
                if name == "." || name == ".." {
                    return None;
                }
                
                Some(SftpFileInfo {
                    name,
                    size: stat.size.unwrap_or(0),
                    is_dir: stat.is_dir(),
                    modified: stat.mtime.map(|t| t as u64),
                })
            })
            .collect();

        Ok(files)
    }).await.map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub async fn sftp_download_file(
    state: tauri::State<'_, Arc<SftpState>>,
    id: u32,
    remote_path: String,
) -> Result<Vec<u8>, String> {
    let session = {
        let sessions = state.sessions.lock();
        sessions.get(&id).cloned().ok_or("SFTP session not found")?
    };

    tokio::task::spawn_blocking(move || {
        let sftp = session.sftp.lock();
        
        let mut file = sftp.open(std::path::Path::new(&remote_path))
            .map_err(|e| format!("Failed to open file: {}", e))?;
        
        let mut data = Vec::new();
        file.read_to_end(&mut data)
            .map_err(|e| format!("Failed to read file: {}", e))?;

        Ok(data)
    }).await.map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub async fn sftp_upload_file(
    state: tauri::State<'_, Arc<SftpState>>,
    id: u32,
    remote_path: String,
    data: Vec<u8>,
) -> Result<(), String> {
    let session = {
        let sessions = state.sessions.lock();
        sessions.get(&id).cloned().ok_or("SFTP session not found")?
    };

    tokio::task::spawn_blocking(move || {
        let sftp = session.sftp.lock();
        
        let mut file = sftp.create(std::path::Path::new(&remote_path))
            .map_err(|e| format!("Failed to create file: {}", e))?;
        
        file.write_all(&data)
            .map_err(|e| format!("Failed to write file: {}", e))?;

        Ok(())
    }).await.map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub async fn sftp_delete_file(
    state: tauri::State<'_, Arc<SftpState>>,
    id: u32,
    path: String,
) -> Result<(), String> {
    let session = {
        let sessions = state.sessions.lock();
        sessions.get(&id).cloned().ok_or("SFTP session not found")?
    };

    tokio::task::spawn_blocking(move || {
        let sftp = session.sftp.lock();
        
        sftp.unlink(std::path::Path::new(&path))
            .map_err(|e| format!("Failed to delete file: {}", e))?;

        Ok(())
    }).await.map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub async fn sftp_make_directory(
    state: tauri::State<'_, Arc<SftpState>>,
    id: u32,
    path: String,
) -> Result<(), String> {
    let session = {
        let sessions = state.sessions.lock();
        sessions.get(&id).cloned().ok_or("SFTP session not found")?
    };

    tokio::task::spawn_blocking(move || {
        let sftp = session.sftp.lock();
        
        sftp.mkdir(std::path::Path::new(&path), 0o755)
            .map_err(|e| format!("Failed to create directory: {}", e))?;

        Ok(())
    }).await.map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub async fn sftp_remove_directory(
    state: tauri::State<'_, Arc<SftpState>>,
    id: u32,
    path: String,
) -> Result<(), String> {
    let session = {
        let sessions = state.sessions.lock();
        sessions.get(&id).cloned().ok_or("SFTP session not found")?
    };

    tokio::task::spawn_blocking(move || {
        let sftp = session.sftp.lock();
        
        sftp.rmdir(std::path::Path::new(&path))
            .map_err(|e| format!("Failed to remove directory: {}", e))?;

        Ok(())
    }).await.map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub async fn close_sftp_session(
    state: tauri::State<'_, Arc<SftpState>>,
    id: u32,
) -> Result<(), String> {
    let _session = {
        let mut sessions = state.sessions.lock();
        sessions.remove(&id).ok_or("SFTP session not found")?
    };

    // Session will be dropped, closing SFTP and SSH connections
    Ok(())
}
