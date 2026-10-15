# Spike findings: cancellation and lock release at runtime (Lore v0.10.1)

Resolves [How do Lore's cancellation and lock release behave at runtime?](https://github.com/kreynes/Scribe/issues/13). Throwaway code; the deliverable is the facts below. 2026-10-15.

## Setup

- Lore at tag `v0.10.1` (commit `95a9a83`), built from source on Windows 11 (debug profile). Local `loreserver` with its zero-config defaults: no auth, temporary store, self-signed certificate.
- **Lock test:** `lock-test.sh` drives the `lore` CLI, which calls the same `lore::revision::commit` / `amend` and `lore::branch::push` library functions Scribe will call.
- **Cancellation test:** `scribe-probe/` is a small binary added as a member of the Lore workspace. It runs `lore::repository::clone` or `lore::revision::sync` exactly as the Tauri spike does, on a plain thread via `lore::runtime().block_on(...)`, wrapped in `tokio::time::timeout`. When the timeout fires it drops the Operation's future. The process then stays alive 8 s, sampling events and files on disk, and calls `lore::shutdown()`.
- **Test data:** a 300 MB repository (600 × 512 KB random files) and a 1 GB one (2,000 × 512 KB). Revision 2 of the 1 GB repository rewrites every file. A full 1 GB clone takes about 12 s locally.

Build note: on Windows, blake3's `ml64` step fails when the target directory path is long. Build with a short `CARGO_TARGET_DIR`.

## 1. Lock release

**Neither commit, amend nor push releases the committer's locks.** Only an explicit `lock release` does.

| Step | `a.txt` | `b.txt` |
|---|---|---|
| `lock acquire a.txt b.txt` | locked | locked |
| edit, stage and `revision commit` `a.txt` | locked | locked |
| `revision amend` | locked | locked |
| `branch push` (revision 2 lands on the server) | locked | locked |
| `lock release a.txt` | free | locked |

This matches the source: the server's lock store is only changed by the lock service's `lock`/`unlock` RPCs, and nothing in the push handler touches it.

Caveat: the server ran unauthenticated, so the owner shows as `<unknown>`. The push code path has no auth-dependent lock handling, so the result should hold with auth on, but that wasn't run.

## 2. Cancellation by dropping the future

| Case | What happened |
|---|---|
| **Events** | Stop at the instant of the drop. `Complete` and `End` never arrive. |
| **Background work** | **Keeps running.** Lore's internally spawned tasks carry on writing files with no events. Clone: in-flight file writes finished within about 2 s, then work stopped. Sync: still moving temporary files into place 8 s after the drop, until `lore::shutdown()` stopped it. |
| **File integrity** | Writes are atomic (`<name>.~loretemp`, then rename). No partial or corrupt file in any run; every file was either the old or the new content, byte for byte. |
| **Working tree state** | Stays on the **old revision**. Files already written show up as local changes: untracked additions after a cancelled clone, "modified" after a cancelled sync (1,752 of 2,000 in one run). `repository verify state` passes. |
| **Recovery** | **One plain `lore sync` (no `--reset`) always recovered** to the target revision with no changes. It checks the files on disk against the target and accepts those already matching. This held for every cancelled clone (0.3 s, 0.7 s, 1 s, 1.5 s), the cancelled sync, and a hard-killed sync. |
| **Hard kill** (`taskkill /F` on `lore sync` at 1.5 s) | Left 1,981 `.~loretemp` files and the tree on revision 1. The next `lore sync` removed them and finished cleanly. |
| **Second Operation while orphaned work runs** | A `lore sync` from another process, started 1.5 s after the drop, was **not blocked** and ended consistent. Both were writing the same target content, so this shows no corruption in that case, not that concurrent Operations are safe. |

### What this means for Scribe

- **Clone and Sync can show Cancel**, implemented as "drop the future". It stops the visible progress immediately and never corrupts files.
- **A cancelled tree is "interrupted", not rolled back.** Files already written stay, and Lore reports them as local changes. Scribe should mark the tree as interrupted and offer **Resume**, which is a plain sync. It must not offer Commit or Reset on those "changes", because they are really part of the unfinished sync.
- **Cancel doesn't free the tree right away.** Orphaned tasks keep writing for seconds, and there is no event when they finish. Scribe's "one changing Operation per working tree" rule needs a quiet period after Cancel. A safe default: the next changing Operation on that tree is the Resume sync (proven safe against the leftovers), and other changing Operations wait until it has run.
- **App exit during an Operation** (or a crash) leaves `.~loretemp` files. The next sync cleans them, so Scribe should run or offer a sync when it opens an interrupted tree.
- **Locks:** Commit & Push must call `lock release` on the pushed files itself if "released on push" stays the rule. A local Commit keeps locks, so committing locally never exposes a file to someone else.

## Not tested

- Cancelling `commit`, `push`, `merge` or `stage`. Only clone and sync were asked about.
- A slow or remote network. The local server is fast, so the time window for orphaned work may be much longer over a WAN.
- An authenticated server (lock owner identity) and release builds.
