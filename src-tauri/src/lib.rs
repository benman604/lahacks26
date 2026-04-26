use std::fs;
use std::path::PathBuf;

use rusqlite::{params, Connection};
use serde_json::Value;
use tauri::Manager;

fn db_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
  let dir = app
    .path()
    .app_data_dir()
    .map_err(|e| format!("failed to resolve app data directory: {e}"))?;

  fs::create_dir_all(&dir).map_err(|e| format!("failed to create app data directory: {e}"))?;

  Ok(dir.join("p2p-local.sqlite3"))
}

fn open_db(app: &tauri::AppHandle) -> Result<Connection, String> {
  let conn = Connection::open(db_path(app)?).map_err(|e| format!("failed to open sqlite db: {e}"))?;

  conn
    .execute_batch(
      "
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        start_ts TEXT NOT NULL,
        payload TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_start_ts ON sessions(start_ts DESC);
      ",
    )
    .map_err(|e| format!("failed to initialize sqlite schema: {e}"))?;

  Ok(conn)
}

#[tauri::command]
fn list_sessions(app: tauri::AppHandle) -> Result<Vec<Value>, String> {
  let conn = open_db(&app)?;
  let mut stmt = conn
    .prepare("SELECT payload FROM sessions ORDER BY start_ts DESC, id DESC")
    .map_err(|e| format!("failed to prepare list query: {e}"))?;

  let rows = stmt
    .query_map([], |row| row.get::<_, String>(0))
    .map_err(|e| format!("failed to query sessions: {e}"))?;

  let mut out = Vec::new();
  for row in rows {
    let payload = row.map_err(|e| format!("failed to read session row: {e}"))?;
    let parsed = serde_json::from_str::<Value>(&payload)
      .map_err(|e| format!("failed to parse stored session payload: {e}"))?;
    out.push(parsed);
  }

  Ok(out)
}

#[tauri::command]
fn replace_sessions(app: tauri::AppHandle, sessions: Vec<Value>) -> Result<(), String> {
  let mut conn = open_db(&app)?;
  let tx = conn
    .transaction()
    .map_err(|e| format!("failed to create transaction: {e}"))?;

  tx.execute("DELETE FROM sessions", [])
    .map_err(|e| format!("failed to clear sessions: {e}"))?;

  for session in sessions {
    let start_ts = session
      .get("startTimestamp")
      .and_then(Value::as_str)
      .unwrap_or("");

    let payload = serde_json::to_string(&session)
      .map_err(|e| format!("failed to serialize session payload: {e}"))?;

    tx.execute(
      "INSERT INTO sessions (start_ts, payload) VALUES (?1, ?2)",
      params![start_ts, payload],
    )
    .map_err(|e| format!("failed to insert session payload: {e}"))?;
  }

  tx.commit()
    .map_err(|e| format!("failed to commit transaction: {e}"))?;

  Ok(())
}

#[tauri::command]
fn append_session(app: tauri::AppHandle, session: Value) -> Result<(), String> {
  let conn = open_db(&app)?;

  let start_ts = session
    .get("startTimestamp")
    .and_then(Value::as_str)
    .unwrap_or("");

  let payload = serde_json::to_string(&session)
    .map_err(|e| format!("failed to serialize session payload: {e}"))?;

  conn
    .execute(
      "INSERT INTO sessions (start_ts, payload) VALUES (?1, ?2)",
      params![start_ts, payload],
    )
    .map_err(|e| format!("failed to append session payload: {e}"))?;

  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      list_sessions,
      replace_sessions,
      append_session
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
