// Throwaway spike for kreynes/Scribe#12: a minimal Tauri 2 app embedding Lore.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use lore::auth::LoreAuthLocalUserInfoArgs;
use lore::interface::{LoreEvent, LoreEventCallback, LoreGlobalArgs};
use tauri::ipc::Channel;

/// Calls `lore::auth::local_user_info`, forwarding every `LoreEvent` as serde
/// JSON to `sink`. Runs on a plain thread outside any tokio runtime, so
/// `lore::runtime()` builds Lore's own core runtime instead of borrowing
/// Tauri's (runtime option (a) in the research doc).
fn call_local_user_info(sink: impl Fn(serde_json::Value) + Send + Sync + 'static) -> i32 {
    std::thread::spawn(move || {
        let callback: LoreEventCallback = Some(Box::new(move |event: &LoreEvent| {
            // Event data is only valid inside the callback: serialize, hand off, return.
            let value = serde_json::to_value(event)
                .unwrap_or_else(|e| serde_json::json!({ "serializeError": e.to_string() }));
            sink(value);
        }));
        let args = LoreAuthLocalUserInfoArgs {
            auth_endpoint: Default::default(),
            user_ids: Default::default(),
            with_identity_token: 0,
            with_access_token: 0,
        };
        lore::runtime().block_on(lore::auth::local_user_info(
            LoreGlobalArgs::default(),
            args,
            callback,
        ))
    })
    .join()
    .expect("lore call thread panicked")
}

#[tauri::command]
async fn local_user_info(on_event: Channel<serde_json::Value>) -> Result<i32, String> {
    tauri::async_runtime::spawn_blocking(move || {
        call_local_user_info(move |value| {
            let _ = on_event.send(value);
        })
    })
    .await
    .map_err(|e| e.to_string())
}

/// Headless check for CI: make the Lore call without creating a window.
fn smoke() -> ! {
    println!(
        "rustls default provider before Lore call: {}",
        rustls::crypto::CryptoProvider::get_default().is_some()
    );
    if std::env::var_os("SMOKE_TLS_FIRST").is_some() {
        // Simulate a plugin (e.g. updater on reqwest 0.13 `rustls-no-provider`) building a
        // rustls config before Lore's first call has installed ring as the process default.
        let builder = rustls::ClientConfig::builder();
        drop(builder);
        println!(
            "built rustls ClientConfig before Lore call; default provider now installed: {}",
            rustls::crypto::CryptoProvider::get_default().is_some()
        );
    }
    let saw_complete = Arc::new(AtomicBool::new(false));
    let flag = saw_complete.clone();
    let status = call_local_user_info(move |value| {
        if value.get("tagName").and_then(|t| t.as_str()) == Some("complete") {
            flag.store(true, Ordering::SeqCst);
        }
        println!("event: {value}");
    });
    println!("local_user_info returned status {status}");
    println!(
        "rustls process-default CryptoProvider installed after Lore call: {}",
        rustls::crypto::CryptoProvider::get_default().is_some()
    );
    println!("lore::shutdown() -> {}", lore::shutdown());
    let ok = saw_complete.load(Ordering::SeqCst);
    println!("SMOKE {}", if ok { "OK" } else { "FAILED (no Complete event)" });
    std::process::exit(if ok { 0 } else { 1 });
}

fn main() {
    if std::env::args().any(|a| a == "--smoke") {
        smoke();
    }

    let builder = tauri::Builder::default();
    #[cfg(feature = "plugins")]
    let builder = builder
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_updater::Builder::new().build());

    builder
        .invoke_handler(tauri::generate_handler![local_user_info])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, event| {
            if let tauri::RunEvent::Exit = event {
                // Terminal for the process: call exactly once, at exit.
                lore::shutdown();
            }
        });
}
