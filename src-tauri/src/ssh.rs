use async_trait::async_trait;
use russh::{client, ChannelId};
use russh_keys::key;
use std::collections::HashMap;
use std::io::Cursor;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::{mpsc, Mutex};

pub struct SshSession {
    pub id: u32,
    pub channel_id: ChannelId,
    pub writer: mpsc::Sender<Vec<u8>>,
    pub shell_name: String,
    pub host: String,
}

pub struct SshState {
    pub sessions: Mutex<HashMap<u32, SshSession>>,
    pub next_id: AtomicU32,
}

impl SshState {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
            next_id: AtomicU32::new(1),
        }
    }
}

pub struct ClientHandler {
    app_handle: AppHandle,
    session_id: u32,
}

impl ClientHandler {
    pub fn new(app_handle: AppHandle, session_id: u32) -> Self {
        Self {
            app_handle,
            session_id,
        }
    }
}

#[async_trait]
impl client::Handler for ClientHandler {
    type Error = anyhow::Error;

    async fn check_server_key(
        &mut self,
        server_public_key: &key::PublicKey,
    ) -> Result<bool, Self::Error> {
        let key_fingerprint = server_public_key.fingerprint();
        let _ = self
            .app_handle
            .emit(&format!("ssh-server-key-{}", self.session_id), key_fingerprint);
        Ok(true)
    }

    async fn data(
        &mut self,
        _channel: ChannelId,
        data: &[u8],
        _session: &mut client::Session,
    ) -> Result<(), Self::Error> {
        let data = String::from_utf8_lossy(data).to_string();
        let _ = self
            .app_handle
            .emit(&format!("ssh-output-{}", self.session_id), data);
        Ok(())
    }

    async fn extended_data(
        &mut self,
        _channel: ChannelId,
        _ext: u32,
        data: &[u8],
        _session: &mut client::Session,
    ) -> Result<(), Self::Error> {
        let data = String::from_utf8_lossy(data).to_string();
        let _ = self
            .app_handle
            .emit(&format!("ssh-output-{}", self.session_id), data);
        Ok(())
    }

    async fn channel_close(
        &mut self,
        _channel: ChannelId,
        _session: &mut client::Session,
    ) -> Result<(), Self::Error> {
        let _ = self
            .app_handle
            .emit(&format!("ssh-exit-{}", self.session_id), ());
        Ok(())
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SshConnectionOptions {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_type: String,
    pub password: Option<String>,
    pub private_key: Option<String>,
    pub private_key_passphrase: Option<String>,
}

#[tauri::command]
pub async fn create_ssh_session(
    app: AppHandle,
    state: tauri::State<'_, Arc<SshState>>,
    options: SshConnectionOptions,
) -> Result<u32, String> {
    let id = state.next_id.fetch_add(1, Ordering::SeqCst);

    let config = client::Config {
        inactivity_timeout: Some(std::time::Duration::from_secs(300)),
        ..Default::default()
    };

    let config = Arc::new(config);
    let handler = ClientHandler::new(app.clone(), id);

    let mut session = client::connect(config, (options.host.clone(), options.port), handler)
        .await
        .map_err(|e| format!("Failed to connect: {}", e))?;

    // Authenticate
    match options.auth_type.as_str() {
        "password" => {
            let password = options.password.ok_or("Password required")?;
            let auth_res = session
                .authenticate_password(&options.username, password)
                .await
                .map_err(|e| format!("Authentication failed: {}", e))?;
            if !auth_res {
                return Err("Password authentication failed".to_string());
            }
        }
        "key" => {
            // Load private key from file
            let key_path = options.private_key.ok_or("Private key path required")?;
            let key_path = shellexpand::tilde(&key_path).to_string();
            
            let key_pair = if let Some(ref passphrase) = options.private_key_passphrase {
                russh_keys::load_secret_key(&key_path, Some(passphrase))
                    .map_err(|e| format!("Failed to load encrypted key: {}", e))?
            } else {
                russh_keys::load_secret_key(&key_path, None)
                    .map_err(|e| format!("Failed to load key: {}", e))?
            };
            
            let auth_res = session
                .authenticate_publickey(&options.username, Arc::new(key_pair))
                .await
                .map_err(|e| format!("Authentication failed: {}", e))?;
            if !auth_res {
                return Err("Key authentication failed".to_string());
            }
        }
        _ => return Err("Invalid authentication type".to_string()),
    }

    let mut channel = session
        .channel_open_session()
        .await
        .map_err(|e| format!("Failed to open channel: {}", e))?;

    channel
        .request_pty(true, "xterm-256color", 80, 24, 0, 0, &[])
        .await
        .map_err(|e| format!("Failed to request PTY: {}", e))?;

    channel
        .exec(true, "/bin/bash")
        .await
        .map_err(|e| format!("Failed to exec shell: {}", e))?;

    let channel_id = channel.id();

    // Create channel for writing data to SSH session
    let (tx, mut rx) = mpsc::channel::<Vec<u8>>(100);

    // Spawn task to handle writing to the channel
    tokio::spawn(async move {
        while let Some(data) = rx.recv().await {
            let cursor = Cursor::new(data);
            let _ = channel.data(cursor).await;
        }
    });

    let ssh_session = SshSession {
        id,
        channel_id,
        writer: tx,
        shell_name: "SSH".to_string(),
        host: options.host,
    };

    state.sessions.lock().await.insert(id, ssh_session);

    Ok(id)
}

#[tauri::command]
pub async fn write_to_ssh_session(
    state: tauri::State<'_, Arc<SshState>>,
    id: u32,
    data: String,
) -> Result<(), String> {
    let sessions = state.sessions.lock().await;
    let session = sessions.get(&id).ok_or("SSH session not found")?;
    let data = data.into_bytes();
    let tx = session.writer.clone();
    drop(sessions);

    tx.send(data).await
        .map_err(|e| format!("Failed to send data: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn resize_ssh_session(
    state: tauri::State<'_, Arc<SshState>>,
    id: u32,
    _rows: u32,
    _cols: u32,
) -> Result<(), String> {
    let sessions = state.sessions.lock().await;
    let _session = sessions.get(&id).ok_or("SSH session not found")?;
    // Window change is handled through the session, but we don't have access to it here
    // For now, we'll just acknowledge the resize
    drop(sessions);

    Ok(())
}

#[tauri::command]
pub async fn close_ssh_session(
    state: tauri::State<'_, Arc<SshState>>,
    id: u32,
) -> Result<(), String> {
    let _session = {
        let mut sessions = state.sessions.lock().await;
        sessions.remove(&id).ok_or("SSH session not found")?
    };

    // The session will be dropped, which should close the connection
    Ok(())
}

#[tauri::command]
pub async fn get_ssh_session_info(
    state: tauri::State<'_, Arc<SshState>>,
    id: u32,
) -> Result<serde_json::Value, String> {
    let sessions = state.sessions.lock().await;
    let session = sessions.get(&id).ok_or("SSH session not found")?;

    let mut info = serde_json::Map::new();
    info.insert(
        "shell".to_string(),
        serde_json::Value::String(session.shell_name.clone()),
    );
    info.insert(
        "host".to_string(),
        serde_json::Value::String(session.host.clone()),
    );

    Ok(serde_json::Value::Object(info))
}
