// Throwaway probe for kreynes/Scribe#24: run one Lore Operation through the library, the
// way Scribe will, and print every raw LoreEvent as JSON. The CLI hides the `Complete`
// event's error payload; this shows it.
//
//   live-probe sync   <working tree> [revision]
//   live-probe switch <working tree> <branch>
//
// Per-file progress events are counted, not printed, unless LIVE_PROBE_ALL=1.
// LIVE_PROBE_LOG=1 calls lore::log::initialize() first, which routes Lore's log lines to the
// same callback as `log` events (at Debug level); only Warn and Error ones are printed.
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;

use lore::branch::LoreBranchSwitchArgs;
use lore::interface::{LoreEvent, LoreEventCallback, LoreGlobalArgs};
use lore::revision::LoreRevisionSyncArgs;

fn main() {
    let a: Vec<String> = std::env::args().collect();
    let op = a[1].clone();
    let dir = a[2].clone();
    let arg = a.get(3).cloned().unwrap_or_default();
    let all = std::env::var("LIVE_PROBE_ALL").is_ok_and(|v| v == "1");
    if std::env::var("LIVE_PROBE_LOG").is_ok_and(|v| v == "1") {
        lore::log::initialize();
    }

    let skipped = Arc::new(AtomicUsize::new(0));
    let sk = skipped.clone();
    let callback: LoreEventCallback = Some(Box::new(move |event: &LoreEvent| {
        let v = serde_json::to_value(event).unwrap_or_default();
        let tag = v.get("tagName").and_then(|t| t.as_str()).unwrap_or("?");
        let noisy = tag.ends_with("File") || tag.ends_with("Progress");
        let quiet_log = tag == "log"
            && !matches!(v.pointer("/data/level").and_then(|l| l.as_str()), Some("warn" | "error" | "Warn" | "Error"));
        if (noisy || quiet_log) && !all {
            sk.fetch_add(1, Ordering::SeqCst);
            return;
        }
        println!("EVENT {v}");
    }));

    let globals = LoreGlobalArgs { repository_path: dir.as_str().into(), ..Default::default() };
    let status = lore::runtime().block_on(async move {
        match op.as_str() {
            "sync" => {
                let args = LoreRevisionSyncArgs { revision: arg.as_str().into(), ..Default::default() };
                lore::revision::sync(globals, args, callback).await
            }
            "switch" => {
                let args = LoreBranchSwitchArgs { branch: arg.as_str().into(), revision: "".into(), reset: 0, bare: 0 };
                lore::branch::switch(globals, args, callback).await
            }
            _ => panic!("usage: live-probe sync|switch <dir> [arg]"),
        }
    });
    println!("STATUS {status} ({} per-file/progress events not printed)", skipped.load(Ordering::SeqCst));
    lore::shutdown();
}
