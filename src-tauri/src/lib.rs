use parking_lot::Mutex;
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State, WebviewWindow};
use tauri_plugin_dialog::DialogExt;

mod ssh;
mod ftp;
mod sftp;
use ssh::SshState;
use ftp::FtpState;
use sftp::SftpState;

struct PtyInstance {
    writer: Box<dyn Write + Send>,
    master: Box<dyn MasterPty + Send>,
    shell_name: String,
    pid: Option<u32>,
}

struct PtyState {
    instances: Mutex<HashMap<u32, PtyInstance>>,
    next_id: AtomicU32,
}

impl PtyState {
    fn new() -> Self {
        Self {
            instances: Mutex::new(HashMap::new()),
            next_id: AtomicU32::new(1),
        }
    }
}

fn detect_shell() -> String {
    // Unix: check SHELL environment variable
    #[cfg(not(target_os = "windows"))]
    {
        if let Ok(shell) = std::env::var("SHELL") {
            return shell;
        }
        for candidate in &["/bin/zsh", "/bin/bash", "/bin/sh"] {
            if std::path::Path::new(candidate).exists() {
                return candidate.to_string();
            }
        }
        return "/bin/sh".to_string();
    }

    // Windows: check common PowerShell locations, fall back to cmd.exe
    #[cfg(target_os = "windows")]
    {
        // Check for PowerShell 7+ (pwsh) first, then Windows PowerShell
        let candidates = [
            "C:\\Program Files\\PowerShell\\7\\pwsh.exe",
            "C:\\Program Files\\PowerShell\\6\\pwsh.exe",
            "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
        ];
        for candidate in &candidates {
            if std::path::Path::new(candidate).exists() {
                return candidate.to_string();
            }
        }
        // Fall back to cmd.exe which should always exist
        "C:\\Windows\\System32\\cmd.exe".to_string()
    }
}

#[tauri::command]
fn create_pty(
    app: AppHandle,
    state: State<'_, Arc<PtyState>>,
    shell: Option<String>,
    cwd: Option<String>,
) -> Result<u32, String> {
    let pty_system = native_pty_system();

    let pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let shell_path = shell.filter(|s| !s.is_empty()).unwrap_or_else(detect_shell);
    let shell_name = std::path::Path::new(&shell_path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| shell_path.clone());

    let mut cmd = CommandBuilder::new(&shell_path);
    cmd.env("TERM", "xterm-256color");

    if let Some(dir) = cwd {
        let dir = dir.trim().to_string();
        if !dir.is_empty() {
            cmd.cwd(&dir);
        }
    }

    let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    let pid = child.process_id();

    drop(pair.slave);

    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;

    let id = state.next_id.fetch_add(1, Ordering::SeqCst);

    state.instances.lock().insert(
        id,
        PtyInstance {
            writer,
            master: pair.master,
            shell_name,
            pid,
        },
    );

    let app_handle = app.clone();
    let pty_id = id;
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app_handle.emit(&format!("pty-output-{}", pty_id), data);
                }
                Err(_) => break,
            }
        }
        let _ = app_handle.emit(&format!("pty-exit-{}", pty_id), ());
    });

    Ok(id)
}

#[tauri::command]
fn write_to_pty(state: State<'_, Arc<PtyState>>, id: u32, data: String) -> Result<(), String> {
    let mut instances = state.instances.lock();
    let instance = instances.get_mut(&id).ok_or("PTY not found")?;
    instance
        .writer
        .write_all(data.as_bytes())
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn resize_pty(state: State<'_, Arc<PtyState>>, id: u32, rows: u16, cols: u16) -> Result<(), String> {
    let instances = state.instances.lock();
    let instance = instances.get(&id).ok_or("PTY not found")?;
    instance
        .master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn close_pty(state: State<'_, Arc<PtyState>>, id: u32) -> Result<(), String> {
    let mut instances = state.instances.lock();
    instances.remove(&id).ok_or("PTY not found")?;
    Ok(())
}

#[tauri::command]
fn toggle_devtools(window: WebviewWindow) {
    // Only allow in debug builds
    #[cfg(debug_assertions)]
    {
        if window.is_devtools_open() {
            window.close_devtools();
        } else {
            window.open_devtools();
        }
    }
}

#[tauri::command]
async fn save_session_dialog(app: AppHandle, content: String, default_name: String) -> Result<bool, String> {
    let file_path = app.dialog()
        .file()
        .set_file_name(&default_name)
        .add_filter("Text files", &["txt"])
        .add_filter("All files", &["*"])
        .blocking_save_file();

    if let Some(file_path) = file_path {
        let path: std::path::PathBuf = file_path.try_into().map_err(|e| format!("Invalid path: {:?}", e))?;
        match std::fs::write(&path, content) {
            Ok(_) => {
                log::info!("Session saved to {:?}", path);
                Ok(true)
            }
            Err(e) => {
                log::error!("Failed to save session: {}", e);
                Err(format!("Failed to save file: {}", e))
            }
        }
    } else {
        // User cancelled
        Ok(false)
    }
}

#[tauri::command]
fn get_pty_info(state: State<'_, Arc<PtyState>>, id: u32) -> Result<serde_json::Value, String> {
    let instances = state.instances.lock();
    let instance = instances.get(&id).ok_or("PTY not found")?;
    let mut info = serde_json::Map::new();
    info.insert("shell".to_string(), serde_json::Value::String(instance.shell_name.clone()));
    if let Some(pid) = instance.pid {
        info.insert("pid".to_string(), serde_json::Value::Number(pid.into()));
    }
    Ok(serde_json::Value::Object(info))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let pty_state = Arc::new(PtyState::new());
    let ssh_state = Arc::new(SshState::new());
    let ftp_state = Arc::new(FtpState::new());
    let sftp_state = Arc::new(SftpState::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Warn)  // Only show warnings and errors by default
            .build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(pty_state)
        .manage(ssh_state)
        .manage(ftp_state)
        .manage(sftp_state)
        .invoke_handler(tauri::generate_handler![
            toggle_devtools,
            create_pty,
            write_to_pty,
            resize_pty,
            close_pty,
            get_pty_info,
            save_session_dialog,
            ssh::create_ssh_session,
            ssh::write_to_ssh_session,
            ssh::resize_ssh_session,
            ssh::close_ssh_session,
            ssh::get_ssh_session_info,
            ftp::create_ftp_session,
            ftp::ftp_list_directory,
            ftp::ftp_change_directory,
            ftp::ftp_download_file,
            ftp::ftp_upload_file,
            ftp::ftp_delete_file,
            ftp::ftp_make_directory,
            ftp::ftp_remove_directory,
            ftp::close_ftp_session,
            sftp::create_sftp_session,
            sftp::sftp_list_directory,
            sftp::sftp_download_file,
            sftp::sftp_upload_file,
            sftp::sftp_delete_file,
            sftp::sftp_make_directory,
            sftp::sftp_remove_directory,
            sftp::close_sftp_session,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
