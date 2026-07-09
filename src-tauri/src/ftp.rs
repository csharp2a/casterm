use std::collections::HashMap;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;
use parking_lot::Mutex;
use suppaftp::FtpStream;

pub struct FtpSession {
    pub id: u32,
    pub stream: Mutex<FtpStream>,
    pub host: String,
    pub current_dir: String,
}

pub struct FtpState {
    pub sessions: Mutex<HashMap<u32, Arc<FtpSession>>>,
    pub next_id: AtomicU32,
}

impl FtpState {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
            next_id: AtomicU32::new(1),
        }
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct FtpConnectionOptions {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub secure: bool,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct FtpFileInfo {
    pub name: String,
    pub size: u64,
    pub is_dir: bool,
    pub modified: Option<String>,
}

#[tauri::command]
pub async fn create_ftp_session(
    state: tauri::State<'_, Arc<FtpState>>,
    options: FtpConnectionOptions,
) -> Result<u32, String> {
    let id = state.next_id.fetch_add(1, Ordering::SeqCst);

    let host = options.host.clone();
    let port = options.port;
    let username = options.username.clone();
    let password = options.password.clone();
    let secure = options.secure;

    // Note: FTPS (secure) is currently disabled due to type complexity
    // Plain FTP works fine. FTPS can be added in a future update.
    let _ = secure; // Silence unused warning

    let session = tokio::task::spawn_blocking(move || {
        let mut ftp_stream = FtpStream::connect(format!("{}:{}", host, port))
            .map_err(|e| format!("Failed to connect: {}", e))?;

        ftp_stream.login(&username, &password)
            .map_err(|e| format!("Login failed: {}", e))?;

        let current_dir = ftp_stream.pwd()
            .map_err(|e| format!("Failed to get current directory: {}", e))?;

        Ok::<_, String>(Arc::new(FtpSession {
            id,
            stream: Mutex::new(ftp_stream),
            host: host.clone(),
            current_dir,
        }))
    }).await.map_err(|e| format!("Task failed: {}", e))?;

    let session = session?;
    state.sessions.lock().insert(id, session);

    Ok(id)
}

#[tauri::command]
pub async fn ftp_list_directory(
    state: tauri::State<'_, Arc<FtpState>>,
    id: u32,
    path: Option<String>,
) -> Result<Vec<FtpFileInfo>, String> {
    let session = {
        let sessions = state.sessions.lock();
        sessions.get(&id).cloned().ok_or("FTP session not found")?
    };

    let path_clone = path.clone();
    let files = tokio::task::spawn_blocking(move || {
        let mut stream = session.stream.lock();
        
        // Change to target directory if specified
        if let Some(ref path) = path_clone {
            stream.cwd(path).map_err(|e| format!("Failed to change directory: {}", e))?;
        }
        
        let list = stream.list(None)
            .map_err(|e| format!("Failed to list directory: {}", e))?;
        
        // Parse the directory listing - simple parser for common formats
        let files: Vec<FtpFileInfo> = list.into_iter()
            .filter_map(|line| {
                // Skip . and .. entries
                if line.starts_with("total ") {
                    return None;
                }
                
                // Parse Unix-style ls -l output
                // Format: drwxr-xr-x 2 user group 4096 Jan 1 12:00 filename
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() < 9 {
                    // Just a filename (from nlst)
                    if line != "." && line != ".." {
                        return Some(FtpFileInfo {
                            name: line,
                            size: 0,
                            is_dir: false,
                            modified: None,
                        });
                    }
                    return None;
                }
                
                let name = parts[8..].join(" ");
                if name == "." || name == ".." {
                    return None;
                }
                
                let is_dir = line.starts_with('d');
                let size = parts.get(4).and_then(|s| s.parse().ok()).unwrap_or(0);
                
                Some(FtpFileInfo {
                    name,
                    size,
                    is_dir,
                    modified: None,
                })
            })
            .collect();

        Ok::<_, String>(files)
    }).await.map_err(|e| format!("Task failed: {}", e))?;

    files
}

#[tauri::command]
pub async fn ftp_change_directory(
    state: tauri::State<'_, Arc<FtpState>>,
    id: u32,
    path: String,
) -> Result<String, String> {
    let session = {
        let sessions = state.sessions.lock();
        sessions.get(&id).cloned().ok_or("FTP session not found")?
    };

    tokio::task::spawn_blocking(move || {
        let mut stream = session.stream.lock();
        
        stream.cwd(&path)
            .map_err(|e| format!("Failed to change directory: {}", e))?;
        
        let new_dir = stream.pwd()
            .map_err(|e| format!("Failed to get current directory: {}", e))?;
        
        Ok(new_dir)
    }).await.map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub async fn ftp_download_file(
    state: tauri::State<'_, Arc<FtpState>>,
    id: u32,
    remote_path: String,
) -> Result<Vec<u8>, String> {
    let session = {
        let sessions = state.sessions.lock();
        sessions.get(&id).cloned().ok_or("FTP session not found")?
    };

    tokio::task::spawn_blocking(move || {
        let mut stream = session.stream.lock();
        
        let cursor = stream.retr_as_buffer(&remote_path)
            .map_err(|e| format!("Failed to download file: {}", e))?;
        
        Ok(cursor.into_inner())
    }).await.map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub async fn ftp_upload_file(
    state: tauri::State<'_, Arc<FtpState>>,
    id: u32,
    remote_path: String,
    data: Vec<u8>,
) -> Result<(), String> {
    let session = {
        let sessions = state.sessions.lock();
        sessions.get(&id).cloned().ok_or("FTP session not found")?
    };

    tokio::task::spawn_blocking(move || {
        let mut stream = session.stream.lock();
        
        stream.put_file(&remote_path, &mut data.as_slice())
            .map_err(|e| format!("Failed to upload file: {}", e))?;
        
        Ok(())
    }).await.map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub async fn ftp_delete_file(
    state: tauri::State<'_, Arc<FtpState>>,
    id: u32,
    path: String,
) -> Result<(), String> {
    let session = {
        let sessions = state.sessions.lock();
        sessions.get(&id).cloned().ok_or("FTP session not found")?
    };

    tokio::task::spawn_blocking(move || {
        let mut stream = session.stream.lock();
        
        stream.rm(&path)
            .map_err(|e| format!("Failed to delete file: {}", e))?;
        
        Ok(())
    }).await.map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub async fn ftp_make_directory(
    state: tauri::State<'_, Arc<FtpState>>,
    id: u32,
    path: String,
) -> Result<(), String> {
    let session = {
        let sessions = state.sessions.lock();
        sessions.get(&id).cloned().ok_or("FTP session not found")?
    };

    tokio::task::spawn_blocking(move || {
        let mut stream = session.stream.lock();
        
        stream.mkdir(&path)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
        
        Ok(())
    }).await.map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub async fn ftp_remove_directory(
    state: tauri::State<'_, Arc<FtpState>>,
    id: u32,
    path: String,
) -> Result<(), String> {
    let session = {
        let sessions = state.sessions.lock();
        sessions.get(&id).cloned().ok_or("FTP session not found")?
    };

    tokio::task::spawn_blocking(move || {
        let mut stream = session.stream.lock();
        
        stream.rmdir(&path)
            .map_err(|e| format!("Failed to remove directory: {}", e))?;
        
        Ok(())
    }).await.map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub async fn close_ftp_session(
    state: tauri::State<'_, Arc<FtpState>>,
    id: u32,
) -> Result<(), String> {
    let session = {
        let mut sessions = state.sessions.lock();
        sessions.remove(&id).ok_or("FTP session not found")?
    };

    tokio::task::spawn_blocking(move || {
        let mut stream = session.stream.lock();
        let _ = stream.quit();
        Ok(())
    }).await.map_err(|e| format!("Task failed: {}", e))?
}
