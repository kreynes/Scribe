// Throwaway probe for kreynes/Scribe#13: what happens when the future of a running
// Lore Operation is dropped part-way, the way Scribe would "cancel" it.
//
//   scribe-probe clone <url> <dir> <cancel_ms>
//   scribe-probe sync  <repo_dir> <cancel_ms>
//
// The Operation runs via lore::runtime().block_on(timeout(..)) on a plain thread, as in
// the Tauri spike. After the timeout drops the future, the process stays alive for
// 8 s (Lore's runtime keeps running, like in Scribe) and samples whether events keep
// arriving and whether files keep appearing on disk.
use std::path::Path;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use lore::interface::{LoreEvent, LoreEventCallback, LoreGlobalArgs};
use lore::repository::LoreRepositoryCloneArgs;
use lore::revision::LoreRevisionSyncArgs;

fn count_files(dir: &Path) -> usize {
    let mut n = 0;
    let Ok(rd) = std::fs::read_dir(dir) else { return 0 };
    for e in rd.flatten() {
        let p = e.path();
        if p.file_name().is_some_and(|f| f == ".lore" || f == ".urc") {
            continue;
        }
        if p.is_dir() { n += count_files(&p) } else { n += 1 }
    }
    n
}

fn main() {
    let a: Vec<String> = std::env::args().collect();
    let (op, dir, cancel_ms) = match a[1].as_str() {
        "clone" => ("clone", a[3].clone(), a[4].parse::<u64>().unwrap()),
        "sync" => ("sync", a[2].clone(), a[3].parse::<u64>().unwrap()),
        _ => panic!("usage"),
    };
    let url = if op == "clone" { a[2].clone() } else { String::new() };

    let events = Arc::new(AtomicUsize::new(0));
    let files_events = Arc::new(AtomicUsize::new(0));
    let last = Arc::new(Mutex::new(String::new()));
    let t0 = Instant::now();
    let (ev, fe, la) = (events.clone(), files_events.clone(), last.clone());
    let callback: LoreEventCallback = Some(Box::new(move |event: &LoreEvent| {
        ev.fetch_add(1, Ordering::SeqCst);
        let v = serde_json::to_value(event).unwrap_or_default();
        let tag = v.get("tagName").and_then(|t| t.as_str()).unwrap_or("?").to_string();
        if tag == "revisionSyncFile" {
            fe.fetch_add(1, Ordering::SeqCst);
        }
        if tag == "complete" || tag == "end" || tag == "error" || tag.ends_with("Begin") || tag.ends_with("End") {
            println!("[{:>6} ms] event {tag} {}", t0.elapsed().as_millis(), v.get("data").map(|d| d.to_string()).unwrap_or_default().chars().take(200).collect::<String>());
        }
        *la.lock().unwrap() = tag;
    }));

    let dir2 = dir.clone();
    let handle = std::thread::spawn(move || {
        let globals = LoreGlobalArgs { repository_path: dir2.as_str().into(), ..Default::default() };
        lore::runtime().block_on(async move {
            let d = Duration::from_millis(cancel_ms);
            if op == "clone" {
                let args = LoreRepositoryCloneArgs { repository_url: url.as_str().into(), ..Default::default() };
                tokio::time::timeout(d, lore::repository::clone(globals, args, callback)).await
            } else {
                let args = LoreRevisionSyncArgs::default();
                tokio::time::timeout(d, lore::revision::sync(globals, args, callback)).await
            }
        })
    });
    let result = handle.join().unwrap();
    let at_drop = (events.load(Ordering::SeqCst), files_events.load(Ordering::SeqCst), count_files(Path::new(&dir)));
    match result {
        Ok(status) => println!("[{:>6} ms] finished before cancel, status {status}", t0.elapsed().as_millis()),
        Err(_) => println!("[{:>6} ms] DROPPED future: {} events, {} sync-file events, {} files on disk, last event {:?}", t0.elapsed().as_millis(), at_drop.0, at_drop.1, at_drop.2, last.lock().unwrap()),
    }
    for s in 1..=8 {
        std::thread::sleep(Duration::from_secs(1));
        println!(
            "  +{s}s after drop: {} events (+{}), {} sync-file events, {} files on disk",
            events.load(Ordering::SeqCst),
            events.load(Ordering::SeqCst) - at_drop.0,
            files_events.load(Ordering::SeqCst),
            count_files(Path::new(&dir))
        );
    }
    println!("lore::shutdown() -> {}", lore::shutdown());
}
