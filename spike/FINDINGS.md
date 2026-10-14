# Spike findings: Tauri 2 + Lore v0.10.1 on Windows, macOS, Linux

Resolves [kreynes/Scribe#12](https://github.com/kreynes/Scribe/issues/12). Throwaway code; the deliverable is the facts below. 2026-10-14.

## What the spike is

- `spike/src-tauri`: a Tauri 2 app with one command, `local_user_info`. It calls `lore::auth::local_user_info` on a plain `std::thread` via `lore::runtime().block_on(...)` and forwards each `LoreEvent` as serde JSON over a Tauri `ipc::Channel`.
- `lore::shutdown()` runs on `RunEvent::Exit`.
- A headless `--smoke` mode makes the same call so CI can execute it.
- `spike/dist/index.html` is a static page; no React yet (the spike is about the Rust build).
- CI: `.github/workflows/spike-build.yml`, `fail-fast: false`.

## Results

| Platform | Build + bundle | Smoke (real Lore call) | Cold release build | Binary | Bundle |
|---|---|---|---|---|---|
| Windows x64 (windows-latest) | pass (NSIS) | pass | 9m54s | 30.3 MB | 6.4 MB installer |
| macOS arm64 (macos-latest) | pass (.app) | pass | 7m17s | 31.2 MB | 29.9 MiB .app |
| Linux x64 (ubuntu-latest) | pass (.deb) | pass | 6m00s | 41.5 MB | 12.7 MB .deb |

The smoke call returns status 89 "Repository not found" (expected, no repository), then `Complete` and `End`; `lore::shutdown()` returns true.

- Run 1 (baseline, CRT variants, plugins), all 9 jobs green: https://github.com/kreynes/Scribe/actions/runs/38592230688
- Run 2 (no-cfg builds on all three OSes, TLS-config-first smoke), all 12 jobs green: https://github.com/kreynes/Scribe/actions/runs/38594849237

## Recipe that works

`Cargo.toml` (edition 2024):

```toml
[dependencies]
tauri = "2"
lore = { git = "https://github.com/EpicGames/lore", tag = "v0.10.1" }

[build-dependencies]
tauri-build = "2"

[patch.crates-io]
quinn-proto = { git = "https://github.com/EpicGames/lore", tag = "v0.10.1" }
glob-match  = { git = "https://github.com/EpicGames/lore", tag = "v0.10.1" }
```

Cargo finds the `vendor/` packages by name. No special `build.rs` beyond `tauri_build::build()`.

`.cargo/config.toml`: `[build] rustflags = ["--cfg", "tokio_unstable", "--cfg", "uuid_unstable"]`, and the `x86_64-pc-windows-msvc` block repeats them (a per-target table replaces `[build]`), optionally adding `+crt-static`.

## The four clash questions

1. **MSVC CRT: does not bite.**
   - tauri-build 2.7 defaults `build.windows.staticVCRuntime = true`: vcruntime static, UCRT dynamic. Its link args override `+crt-static`'s UCRT choice.
   - All four combinations link and pass smoke:
     - Tauri default (with or without `+crt-static`): no `VCRUNTIME140.dll`, imports `api-ms-win-crt-*`, no warnings.
     - `+crt-static` and `staticVCRuntime: false`: no CRT DLLs at all (fully static).
     - Plain `/MD`: links with only `LNK4098 defaultlib 'LIBCMT' conflicts` (rpmalloc is built `/MT`); imports `VCRUNTIME140` and UCRT; smoke passes.
   - Recommendation: Tauri's default, or fully static. Avoid plain `/MD`.
2. **rustls crypto provider: ring only.**
   - No `aws-lc-rs`/`aws-lc-sys` in the graph, in the base app or with `tauri-plugin-http` 2.8.2 and `tauri-plugin-updater` 2.13.3.
   - The updater pulls reqwest 0.13.5 with `rustls-no-provider`; Lore uses reqwest 0.12.28; Tauri core pulls no reqwest.
   - Building a `rustls::ClientConfig` *before* Lore's first call (`SMOKE_TLS_FIRST=1`) does not panic on any platform: with ring as the only provider feature, rustls picks it up.
3. **`uuid_unstable` / `tokio_unstable`: not required at v0.10.1.** Full build plus smoke passes without either cfg on Linux, Windows and macOS (run 2). Keeping them to match Lore's own builds is harmless.
4. **Dependency graph unifies.**
   - One copy each of tokio 1.53.3, rustls 0.23.46, bitcode 0.6.9 (Lore's pin) and uuid 1.28.0.
   - quinn-proto 0.11.13 and glob-match come from Lore's git tag.
   - 70 duplicate crates in the base graph (81 with plugins), all common build-time ones (syn, toml, thiserror, hashbrown, getrandom…), none Lore-critical.

## Open questions (for the architecture ticket)

- Runtime topology was only exercised as a plain thread + `lore::runtime().block_on`, headless. `tauri::async_runtime::set(lore::runtime())` and awaiting directly on Tauri's runtime are untested.
- Whether to install the ring provider explicitly at startup and add a CI guard that fails if `aws-lc-rs` enters the graph.
- CRT mode choice: Tauri default (hybrid) or fully static.
- Commit `Cargo.lock` (CI generated it fresh each run).
- CI caching strategy for the 6–10 minute cold build.
- Pushing workflow files needs a `gh` token with the `workflow` scope.
