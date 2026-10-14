# Lore's Rust client API: surface, runtime, build, stability

Research for [kreynes/Scribe#3](https://github.com/kreynes/Scribe/issues/3). Date: 2026-10-14.

Sources are the EpicGames/lore source tree at `main` = `21c2bd1`
([tree](https://github.com/EpicGames/lore/tree/21c2bd1d0f86676cedf77f8f139b24b90460c918)) and the
release tags `v0.8.3` … `v0.10.1` (`v0.10.1` = `95a9a83`). Links below point at `main` unless they
name a tag.

## TL;DR

- **Depend on the `lore` crate** (package `lore` at `lore/`, lib `lore`). Use a **git dependency
  pinned to a release tag**, e.g. `lore = { git = "https://github.com/EpicGames/lore", tag = "v0.10.1" }`.
  Every crate is `publish = false`, so nothing is on crates.io. `lore-client` is the CLI, not a client
  library. `lore-capi` is the C ABI (`lore.h`, a cdylib or staticlib) wrapped around the same `lore` crate.
  `lore-notification` is internal plumbing that `lore::notification::subscribe` sits on.
- **A git dependency needs three things the Lore workspace normally supplies.**
  (1) Restate `[patch.crates-io] quinn-proto` (and, for correct ignore and view filters, `glob-match`)
  pointing at Lore's `vendor/` copies. Lore's own in-tree out-of-workspace consumer does exactly this
  and says `lore-transport` *does not compile* against the published quinn-proto.
  (2) Copy the rustflags `--cfg uuid_unstable` (and `--cfg tokio_unstable`) from Lore's `.cargo/config.toml`,
  because a dependency's `.cargo/config.toml` is never read.
  (3) Use Rust edition 2024 (rustc 1.85 or newer) on current stable.
- **API shape.** Every operation is
  `pub async fn op(globals: LoreGlobalArgs, args: LoreXxxArgs, callback: LoreEventCallback) -> i32`.
  The args structs are `#[repr(C)]`. The `i32` is a status code (0 = ok).
  `LoreEventCallback = Option<Box<dyn Fn(&LoreEvent) + Send + Sync>>`. All results, progress and
  errors arrive as `LoreEvent`s (≈237 variants) on library worker threads. Each call ends with
  `Complete` then `End`. `LoreEvent` implements `serde::Serialize` (`{tagName, data}`, camelCase), so
  it can be forwarded to a webview almost as-is.
- **Runtime.** Tokio. Lore lazily builds its own process-global multi-thread "core" runtime plus a
  dedicated "net" runtime (QUIC and gRPC), but `lore::runtime()` *returns the caller's runtime if one
  is current*. Call `lore::shutdown()` exactly once at exit; it is terminal for the process.
  Optionally, calls are relayed to a local "Lore service" daemon. That depends on the user's global
  config `[service] use_automatically` or `LORE_USE_SERVICE`.
- **Coverage.** Clone, create, status, sync, stage and unstage, commit and amend, branch (create,
  switch, push, merge with resolve mine/theirs, protect, archive, diff), cherry-pick, revert,
  history (revision and file), diff (revision, branch, file), locks (acquire, status, query, release),
  links, layers, shared stores, dependencies, metadata, auth (login and logout), notifications
  (branch created, deleted or pushed; resource locked or unlocked), and low-level storage and
  revision-tree APIs. View filters are a `view` path argument on clone and sync. **Change requests
  and reviews have no API.** `change-request` is only a reserved revision metadata key. A
  review web client is a 2027 roadmap item.
- **Stability.** Pre-1.0, with no Rust-API stability promise. There were 7 releases in about 4
  months (2026-06-16 → 2026-10-06), roughly one every 2–3 weeks. At the *function-name* level the
  `lore` crate has been almost purely additive (170 → 214 public fns, about 5 removed, all internal
  relay helpers or a `_local`). But **every release since v0.8.6 lists "Breaking changes"** to
  argument and event struct fields, error codes and semantics. Expect to touch Scribe's adapter on
  every bump.

---

## 1. Which crates, and how to depend on them

Workspace members ([Cargo.toml](https://github.com/EpicGames/lore/blob/main/Cargo.toml)): `lore`,
`lore-aws`, `lore-base`, `lore-capi`, `lore-chaos-client`, `lore-client`, `lore-credential`,
`lore-error-set(-macro)`, `lore-hashicorp`, `lore-integration-tests`, `lore-io`, `lore-macro`,
`lore-notification`, `lore-proto`, `lore-revision`, `lore-server`, `lore-storage`, `lore-telemetry`,
`lore-transport`. Workspace version on `main` is `0.10.2-nightly`. Every crate has `publish = false`.

| Crate | What it is | Does Scribe use it? |
|---|---|---|
| `lore` ([lore/Cargo.toml](https://github.com/EpicGames/lore/blob/main/lore/Cargo.toml)) | The public library API: the Rust surface that `lore.h` mirrors | **Yes, this is the dependency** |
| `lore-client` ([lore-client/Cargo.toml](https://github.com/EpicGames/lore/blob/main/lore-client/Cargo.toml)) | The `lore` CLI binary. Its lib (`lore_client`) exports only `client_main`, and the modules are private unless `test-util` is on | No, but it is the best usage reference ([commands/](https://github.com/EpicGames/lore/tree/main/lore-client/src/cli/commands)) |
| `lore-capi` ([lore-capi/Cargo.toml](https://github.com/EpicGames/lore/blob/main/lore-capi/Cargo.toml)) | `crate-type = ["cdylib","staticlib"]` with lib name `lore`. Builds `lore.h` with cbindgen. Split out of `lore` in v0.10.1 | No. It is only useful if Scribe ever wanted to link the prebuilt `liblore` instead of compiling from source |
| `lore-notification` | Server-push notification client (tonic, gRPC). `lore::notification::subscribe` calls `lore_notification::initialize()` | Indirectly, through `lore` |
| `lore-revision`, `lore-base`, … | Internals. `lore::interface` re-exports the core types as aliases (`LoreEvent`, `LoreGlobalArgs`, `LoreEventCallback`, `LoreString`, `LoreArray`, `LoreError`, `LoreMetadata`, …) ([interface.rs](https://github.com/EpicGames/lore/blob/main/lore/src/interface.rs)). Per-event payload structs such as `LoreRevisionSyncProgressEventData` are defined in `lore-revision` | Possibly, as a direct dependency to name event payload types when matching on events |

The system design names the C header as the canonical interface, with "language bindings (Rust,
Python, JavaScript, etc.) [as] equivalent surfaces over the same operations"
([system-design §5.1, §6.1](https://github.com/EpicGames/lore/blob/main/docs/explanation/system-design.md)).
The FAQ says "The library interface is directly usable in C/C++ and Rust"
([faq.md](https://github.com/EpicGames/lore/blob/main/docs/faq.md)). Epic's own JS bindings (for
the VS Code plugin) are napi-rs written in Rust on top of this crate
([ADR-00009](https://github.com/EpicGames/lore/blob/main/docs/developing/decisions/00009-lore-library-js-bindings.md)).
That is the same embedding pattern Scribe would use. Those bindings are not in the repo.

### Git dependency recipe (what downstream must replicate)

Lore ships an in-tree example of a consumer outside the workspace,
[`contrib/bazel/Cargo.toml`](https://github.com/EpicGames/lore/blob/main/contrib/bazel/Cargo.toml).
It depends on `lore`, `lore-base`, `lore-macro` and `lore-revision` by path, and states:

> "A patch table belongs to a workspace root, so standing outside that workspace means restating
> it: the Lore crates reach lore-transport, which is written against the vendored crate rather than
> the published one."

Its [README](https://github.com/EpicGames/lore/blob/main/contrib/bazel/README.md) adds that the root
`.cargo/config.toml` "sets the rustflags `loreserver` needs (`--cfg tokio_unstable`, `--cfg uuid_unstable`)".

So, for Scribe's `src-tauri` workspace:

1. `lore = { git = "https://github.com/EpicGames/lore", tag = "vX.Y.Z" }` (a `rev =` works too).
   Commit `Cargo.lock`.
2. `[patch.crates-io]` with `quinn-proto` and `glob-match` from the same git tag. Both live in
   [`vendor/`](https://github.com/EpicGames/lore/tree/main/vendor). quinn-proto is pinned
   `=0.11.19` on main (`=0.11.13` at v0.10.1) and is actively patched (BBR changes landed 2026-10-11).
   glob-match fixes a `**` defect that made ignore and view filters "silently under-exclude"
   ([vendor/glob-match/Cargo.toml](https://github.com/EpicGames/lore/blob/main/vendor/glob-match/Cargo.toml)).
3. `.cargo/config.toml` rustflags: `--cfg uuid_unstable` and `--cfg tokio_unstable`
   ([Lore's .cargo/config.toml](https://github.com/EpicGames/lore/blob/main/.cargo/config.toml)).
   `uuid` gates its zerocopy derives behind `cfg(uuid_unstable)`
   ([uuid v1.23.1 src/lib.rs](https://github.com/uuid-rs/uuid/blob/v1.23.1/src/lib.rs)), and Lore
   enables `uuid/zerocopy`. In client crates `tokio_unstable` appears to matter only for `lore-server`
   telemetry, but setting it is harmless. A per-target `[target.<triple>] rustflags` table
   *replaces* `[build] rustflags`, so repeat both cfgs in every target block.
4. The `bitcode` dependency is pinned `=0.6.9` workspace-wide ("C API pointer types implement the
   derive-support traits … which its semver guarantees do not cover"). Scribe must not pull in a
   different 0.6.x bitcode.

## 2. Async model and runtime

- **Tokio.** Features `rt-multi-thread`, `fs`, `net`, `signal`, `sync`, `time`, `parking_lot`
  ([workspace deps](https://github.com/EpicGames/lore/blob/main/Cargo.toml)).
- **Lore's own runtimes** ([lore-base/src/runtime.rs](https://github.com/EpicGames/lore/blob/main/lore-base/src/runtime.rs)):
  a process-global *core* runtime and a dedicated *net* runtime (quinn, tonic and transport loops,
  with a single blocking thread). Both are built lazily on first use, sized from a thread budget
  (`lore::set_thread_limit`, `LORE_MAX_THREADS`), and torn down by `lore::shutdown()`. Design
  background is in [LEP 2026-07-24 tokio runtime split](https://github.com/EpicGames/lore/blob/main/docs/proposals/2026-07-24-tokio-runtime-split-and-async-io.md)
  (status: Approved).
- **`lore::runtime()` follows the caller.** `runtime_with_settings` returns
  `Handle::try_current()` if a runtime is current and only otherwise creates the core runtime. So
  if Scribe `await`s Lore calls from inside Tauri's tokio runtime, Lore's unpinned `lore_spawn!`
  tasks land on Tauri's runtime, while `lore_spawn_core!`/`lore_spawn_net!` tasks go to Lore's.
  The CLI does not do this: it calls from plain threads via `lore::runtime().block_on(...)`
  ([call_delegation.rs `block_on_command`](https://github.com/EpicGames/lore/blob/main/lore/src/call_delegation.rs)).
  Options for Scribe (needs a spike):
  (a) Run Lore calls on a dedicated thread or pool outside any runtime, blocking on `lore::runtime()`.
  (b) Build Lore's runtime first in `main` and hand it to Tauri with `tauri::async_runtime::set(handle)`,
  so there is one runtime.
  (c) Just `await` from Tauri commands and accept the mix.
- **`shutdown()`** is synchronous, drains handles with a 10 s budget, and is terminal: any later call
  fails with `ShutDown` (code 193). It handles three caller contexts. A `current_thread` runtime gets
  only a bounded best effort ([lib.rs](https://github.com/EpicGames/lore/blob/main/lore/src/lib.rs),
  `shutdown_block_on`). Wire it to Tauri's exit event.
- **Callbacks** ([lore-revision/src/interface.rs](https://github.com/EpicGames/lore/blob/main/lore-revision/src/interface.rs),
  `LoreEventCallbackConfig` docs). The callback runs "on a thread the library manages … not the
  calling thread". Event data is valid only until the callback returns, so copy it out. Concurrent
  calls can invoke a shared callback simultaneously, and a blocking callback stalls other in-flight
  calls. For Tauri: serialize the event inside the callback and push it to an `ipc::Channel` or
  mpsc. Do no work in the callback.
- **Progress throttling.** `LoreGlobalArgs.event_interval_ms` (default interval, minimum 10 ms) and
  `stats` (0/1/2) control how chatty progress events are.
- **Service relay.** If `[service] use_automatically` is set in the user's Lore global config, or
  `LORE_USE_SERVICE=1`, calls are relayed over a local socket to a long-lived `lore` service process
  instead of running in-process ([remote/service_process.rs](https://github.com/EpicGames/lore/blob/main/lore/src/remote/service_process.rs),
  [call_delegation.rs](https://github.com/EpicGames/lore/blob/main/lore/src/call_delegation.rs)).
  Since the nightly after v0.10.1, client and service "must come from the same build" (bitcode,
  message protocol v2; [ADR-00022](https://github.com/EpicGames/lore/blob/main/docs/developing/decisions/00022-service-ipc-bitcode.md),
  [release notes, Nightly](https://github.com/EpicGames/lore/blob/main/docs/release-notes.md)).
  A Scribe build embedding Lore vX could therefore be handed to a user's installed vY service.
  Scribe probably wants `LORE_USE_SERVICE=0`, or to own the decision explicitly. `lore::will_use_service()`
  reports it, and `working_directory` in `LoreGlobalArgs` exists for relayed calls.

## 3. What operations are exposed

All of these are `pub async fn(globals, args, callback) -> i32` in the
[`lore` crate](https://github.com/EpicGames/lore/tree/main/lore/src). The list below is the
complete set from `main` (214 public fns including helpers).

| Area | Functions (module::fn) |
|---|---|
| Repository ([repository.rs](https://github.com/EpicGames/lore/blob/main/lore/src/repository.rs)) | `clone`, `create`, `create_with_metadata`, `delete` (remote), `info`, `status`, `list`, `release`, `flush`, `gc`, `dump`, `verify_state`, `verify_fragment`, `store_immutable_query`, `metadata_{get,set,clear}`, `instance_list`, `instance_prune`, `repository_update_path`, `config_get` |
| Revision ([revision.rs](https://github.com/EpicGames/lore/blob/main/lore/src/revision.rs)) | `commit`, `commit_with_metadata`, `amend`, `sync`, `history`, `info`, `diff`, `find`, `restore`, `bisect`, `cherry_pick{,_abort,_unresolve,_restart,_resolve,_resolve_mine,_resolve_theirs}`, `revert{…same set}`, `metadata_{get,set,clear,list}` |
| Branch ([branch.rs](https://github.com/EpicGames/lore/blob/main/lore/src/branch.rs)) | `create`, `list`, `info`, `switch`, `push`, `diff`, `reset`, `archive`, `protect`, `unprotect`, `latest_list`, `merge_start`, `merge_into`, `merge_abort`, `merge_restart`, `merge_unresolve`, `merge_resolve{,_mine,_theirs}`, `metadata_{get,set,clear}` |
| File ([file.rs](https://github.com/EpicGames/lore/blob/main/lore/src/file.rs)) | `stage`, `stage_merge`, `stage_move`, `unstage`, `dirty`, `dirty_move`, `dirty_copy`, `reset`, `reset_to_last_merged`, `info`, `diff`, `history`, `hash`, `write`, `dump`, `obliterate`, `metadata_{get,set,clear,list}` |
| Locks ([lock.rs](https://github.com/EpicGames/lore/blob/main/lore/src/lock.rs)) | `file_acquire`, `file_acquire_as_owner`, `file_status`, `file_query`, `file_release`. The roadmap says locking currently "informs rather than enforces" ([roadmap](https://github.com/EpicGames/lore/blob/main/docs/roadmap.md)) |
| Notifications ([notification.rs](https://github.com/EpicGames/lore/blob/main/lore/src/notification.rs)) | `subscribe` / `unsubscribe`: a long-lived callback receiving `NotificationBranchCreated/Deleted/Pushed`, `NotificationResourceLocked/Unlocked` |
| Links, layers, dependencies | `link::{add,remove,list,info,list_staged,update}`, `layer::{layer_add,layer_remove,layer_list,layer_list_staged}`, `dependency::{dependency_add,dependency_remove,dependency_list}` |
| Auth ([auth.rs](https://github.com/EpicGames/lore/blob/main/lore/src/auth.rs)) | `login_interactive` (opens a browser via the `open` crate and emits `AuthUrl`/`AuthPending`), `login_with_token`, `logout`, `list`, `clear`, `local_user_info`, `resolve_user_info` |
| Shared store, service | `shared_store::{create,info,list,set_use_automatically}`, `service::{start,stop,status,set_executable,set_use_automatically}` |
| Low level | `storage::*` (open, put, get, `*_file`, `*_resolved`, copy, obliterate, upload, mutable load/store/CAS/list), `revision_tree::*` (load, resolve_path, list_children, node_info, add, modify, delete, move_node, metadata, commit, close) |
| Process | `lore::shutdown`, `runtime`, `set_thread_limit`, `will_use_service`, `size_threads_for_relaying`, `log::{initialize,configure,log_level}`, `log_file_path` |

- **Status and working-tree view.** `repository::status` emits `RepositoryStatusFile`, `…Count`,
  `…Summary` and `…Revision` events.
- **View filters.** `LoreRepositoryCloneArgs.view` and `LoreRevisionSyncArgs.view` take a path to a
  view filter file. The sync variant was added in v0.10.1 and "changes the view filter an instance
  materializes … rather than re-cloning". `.loreignore` is the outbound filter
  ([system-design §1.3](https://github.com/EpicGames/lore/blob/main/docs/explanation/system-design.md)).
- **Change requests and reviews.** No API. `change-request` is a reserved built-in revision metadata
  key ([system-design §11.3](https://github.com/EpicGames/lore/blob/main/docs/explanation/system-design.md)).
  Review state is meant to be layered on as application metadata keys. "Web client and code review
  tools" is *Committed* for 2027 ([roadmap](https://github.com/EpicGames/lore/blob/main/docs/roadmap.md)).
  There is also a gRPC `lore.thin_client.v1` protocol (diff, content diff, revision list) in
  [lore-proto](https://github.com/EpicGames/lore/tree/main/lore-proto/proto). It is presumably what
  a web client talks to, and it changes too (it broke in v0.10.1).

### Progress and event reporting

- Single sink: the `callback`. The event enum lives in
  [lore-revision/src/event.rs](https://github.com/EpicGames/lore/blob/main/lore-revision/src/event.rs)
  (`#[repr(C, u32)] pub enum LoreEvent`, 237 variants on main, 213 at v0.8.3). Its serde form is
  `tag = "tagName", content = "data", rename_all = "camelCase"`.
- Every call emits `Log` (diagnostics), `Error` (non-fatal), then `Complete { status, error: LoreErrorDetail }`
  and finally `End`. The per-op events are documented in each fn's rustdoc. Clone, for example, emits
  `RepositoryCloneBegin/Progress/End`, `RevisionSyncTarget/Progress/File/Revision`, `FilterExclude`
  and `FragmentWrite`.
- Progress payloads are concrete counters. For example `LoreRevisionSyncProgressEventData` carries
  `file_update/_total`, `file_delete/_total`, `file_automerge`, `file_conflict`,
  `bytes_update/_total` and `discovery_complete`
  ([revision/sync.rs](https://github.com/EpicGames/lore/blob/main/lore-revision/src/revision/sync.rs)).
- There is no cancellation token in the API surface. Cancellation would mean dropping the future,
  which is unverified. See the open questions.

## 4. Building on Windows, macOS, Linux; Tauri clashes

**Toolchain.** Stable Rust with edition 2024 (rustc ≥ 1.85; Lore tracks latest stable, and nightly
is only for `rustfmt`) ([CONTRIBUTING.md](https://github.com/EpicGames/lore/blob/main/CONTRIBUTING.md)).
`protoc` is *not* required: `lore-proto/build.rs` falls back to the pregenerated sources in `src/grpc`
([build.rs](https://github.com/EpicGames/lore/blob/main/lore-proto/build.rs)).

**Native (C) code compiled by build scripts.** A C compiler is required on every platform:
- `lore-base/build.rs` compiles **rpmalloc** with `cc` using `.static_crt(true)`. On MSVC it adds
  `/experimental:c11atomics /std:c11`, which needs a recent VS 2022 toolset
  ([lore-base/build.rs](https://github.com/EpicGames/lore/blob/main/lore-base/build.rs)).
- `zstd-sys`, `lz4-sys` (via `lore-storage`) and `ring` (rustls crypto) are C, with assembly for ring.
- On Linux, `keyring` uses the `linux-native` feature (kernel keyutils), so no libdbus or
  libsecret is needed. On macOS it uses Keychain (`apple-native`). On Windows it uses Credential
  Manager. `reqwest` uses `macos-system-configuration`.
- Windows ProjFS (`ProjectedFSLib`) is only compiled with `lore-revision/vfs`, which `lore` does not
  enable. VFS/SWFS (`swfs` feature) and Oodle (`oodle` feature, proprietary) are both off by default.
  Leave them off.

**Platforms Epic ships** (v0.10.1 release assets): `x86_64-pc-windows-msvc`, `aarch64-apple-darwin`,
`x86_64-unknown-linux-gnu`, `aarch64-unknown-linux-gnu`. There is **no Intel macOS and no Windows on ARM**.
Public CI currently runs unit and smoke tests on **linux-x86_64 only**. The macOS and Windows matrix
entries are commented out "while this workflow is still being changed"
([pr-validate.yml](https://github.com/EpicGames/lore/blob/main/.github/workflows/pr-validate.yml)).

**Things that can clash with a Tauri 2 app:**
1. **Static vs dynamic MSVC CRT.** Lore builds Windows with `-C target-feature=+crt-static`, and
   rpmalloc is compiled `/MT` regardless (`static_crt(true)`). A default Tauri build uses the dynamic
   CRT (`/MD`), which risks `LNK4098`/CRT-mismatch link problems. Likely fix: build Scribe with
   `+crt-static` on Windows, as Lore does. **Unverified, so spike it.**
2. **rustls crypto provider.** Lore uses rustls with the **ring** provider only, deliberately avoiding
   aws-lc-sys ("seems to have build issues on Windows"). It calls
   `CryptoProvider::install_default(ring)` on first execution and ignores failure
   ([interface.rs `install_crypto_provider`](https://github.com/EpicGames/lore/blob/main/lore-revision/src/interface.rs)).
   If a Tauri plugin (updater, http) or another dependency enables rustls' default `aws_lc_rs`
   feature, both providers are compiled in. Then any rustls config built before Lore's first call
   can panic for lack of a process default. Scribe should keep reqwest and rustls features ring-only,
   or install the ring provider at the top of `main`.
3. **Process-global side effects** on the first Lore call: raises `RLIMIT_NOFILE` on Unix, installs a
   panic hook in debug builds, installs the rustls default provider, and spawns its thread pools
   (sized from the CPU count unless `set_thread_limit` is called *before* the first call).
4. **Tokio runtime coexistence**: see §2. It is workable but needs a deliberate choice.
5. **Pinned and patched dependencies** (`bitcode =0.6.9`, vendored `quinn-proto`, tokio, tonic 0.14,
   reqwest 0.12, rustls 0.23) must unify with Tauri's dependency graph. Tauri 2 also uses tokio,
   reqwest 0.12 and rustls 0.23, so no obvious conflict, but it is unverified.
6. **Build size and time.** It is a large dependency graph (tonic, quinn, opentelemetry, prost, …).
   Lore's `profile.dev` uses `debug = "line-tables-only"` for link-time reasons, and Scribe may want
   the same for `lore*` packages.
7. **Credentials and config** are global per user: `LORE_GLOBAL_PATH`, `LORE_AUTH_PATH`, and the
   token store (`tokenstore.toml`, changed in v0.9.0). Scribe and the user's CLI share login state by
   default. That is probably desirable.

## 5. How often has the public API changed?

Releases: v0.8.3 (2026-06-17), v0.8.4 (06-26), v0.8.5 (07-16), v0.8.6 (07-31), v0.9.0 (08-31),
v0.10.0 (09-18), v0.10.1 (10-06) ([releases](https://github.com/EpicGames/lore/releases)). The open
source history starts with "Initial code copy from private repo" on 2026-05-29, and there are 774
commits on main. Per-release notes are in [docs/release-notes.md](https://github.com/EpicGames/lore/blob/main/docs/release-notes.md),
starting at v0.8.4.

The table below was computed from the tags by `git grep` of `^pub (async )?fn` in `lore/src`
(module-qualified), `pub struct Lore*` in `lore/src` and `lore-revision/src`, and the `LoreEvent`
variant count.

| Tag | Public fns | `Lore*` structs | `LoreEvent` variants | Fns +/− vs previous | Structs +/− | "Breaking changes" section in notes |
|---|---|---|---|---|---|---|
| v0.8.3 | 170 | 387 | 213 | — | — | (predates file) |
| v0.8.4 | 175 | 408 | 224 | +5 / −0 | +23 / −2 | no |
| v0.8.5 | 182 | 410 | 226 | +7 / −0 | +3 / −1 | no |
| v0.8.6 | 184 | 412 | 227 | +2 / −0 | +2 / −0 | yes (error codes, CLI flags) |
| v0.9.0 | 196 | 427 | 230 | +12 / −0 | +15 / −0 | yes (metadata type discriminants, error codes, token store, ms timestamps) |
| v0.10.0 | 209 | 440 | 233 | +13 / −0 | +13 / −0 | yes (`no_atime` removed, field renames, struct appends, revision-id parsing, `ShutDown` code, struct rename) |
| v0.10.1 | 212 | 441 | 233 | +4 / −1 | +1 / −0 | yes (storage item events carry an error detail, empty strings become NULL, sync `view` appended, C lib moved to `lore-capi`, thin_client proto) |
| main | 214 | 448 | 237 | +6 / −4 | +7 / −0 | yes (service IPC is bitcode, same-build requirement) |

Removed over the whole span: `remote/message::{blocking_read_v1_message, deserialize_message,
serialize_message, write_v1_message}` and `revision::cherry_pick_local`. Removed structs:
`LoreLockFileAcquireIgnoreEventData`, `LoreLockFileReleaseNotFoundEventData`, `LoreRevisionTreeRootInfoData`.

Reading:
- **Function names and signatures are stable and growing.** The `(globals, args, callback) -> i32`
  convention has held throughout.
- **Struct fields, event payloads, error codes and semantics break almost every release.** The
  release notes phrase these as C ABI changes ("Rebuild against the new `lore.h`"), but every one is
  equally a Rust source or behavior change for `lore` consumers. Many are "append a field" changes,
  which break Rust struct literals unless Scribe uses `..Default::default()`. Many args structs
  derive `Default`, though not all: a single-line grep finds `Default` on about 60 of 159
  `Lore*Args` structs, and multi-line derives may account for more.
- The stability promise covers on-disk and wire formats only: "a newer version of the library can
  always read what an older version has written". APIs and protocols "may still change in
  incompatible ways between minor revisions" until 1.0
  ([system-design §6.7](https://github.com/EpicGames/lore/blob/main/docs/explanation/system-design.md),
  [roadmap](https://github.com/EpicGames/lore/blob/main/docs/roadmap.md)).
- Client/server compatibility pre-1.0 is "clients and servers should run compatible builds". Scribe's
  pinned Lore version is therefore also a statement about which servers it can talk to.

## Recommendations for downstream decisions

1. Put the Lore dependency behind one Rust adapter module in `src-tauri`, and keep `Lore*` types
   out of the rest of the app and the TS bindings. Upgrades then touch one place.
2. Pin to release tags, not `main`. Bump deliberately, reading the "Breaking changes" section.
   Build all structs with `..Default::default()`.
3. Turn `LoreEvent` into Scribe's own event types in the callback, or forward the serde JSON as-is
   to the frontend over a Tauri `Channel` per call.
4. Decide the runtime topology (§2 options a, b, c) and the CRT and crypto-provider settings (§4)
   in a build spike before any feature work.

## Open uncertainties

- **Untested build.** No compile spike was run. Need to confirm that a fresh Tauri 2 crate with the
  git dependency, patches and rustflags above builds on all three OSes. In particular, check whether
  `uuid_unstable` is strictly required for the `lore` dependency graph, and whether `/MD` vs `/MT`
  actually fails.
- **Cancellation.** Is dropping a `lore::*` future safe, and does it stop work? The `Complete`/`End`
  contract suggests calls are expected to run to completion. Long syncs and clones may not be
  cancellable.
- **Mixed runtimes.** Behaviour when `lore` futures are polled on Tauri's runtime (`runtime()`
  returning the foreign handle) has not been verified, nor has `tauri::async_runtime::set` with
  Lore's handle.
- **Type re-exports.** Does Scribe need direct dependencies on `lore-revision` and `lore-base` to name
  event and data types? `lore::interface` re-exports some, and `contrib/bazel` depends on both.
- **Service relay version skew** if the user's machine runs an installed `lore` service of another
  version. Is `LORE_USE_SERVICE=0` per process enough, and is it the right policy?
- **Change requests.** Is there any server-side review or CR API on Epic's hosted service that the
  OSS library will expose? There is nothing in the tree today.
- **Notification transport.** Does `subscribe` work against all server deployments (it needs the
  notification service)? What is its reconnect behaviour?
- Intel Mac and Windows-on-ARM support: there are no official artifacts, and no evidence either way
  for building from source.
