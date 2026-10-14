# Lore authentication and credential storage

Research for [kreynes/Scribe#4](https://github.com/kreynes/Scribe/issues/4): how a client authenticates against a self-hosted Lore server, where credentials are stored, and what a minimal local test server looks like.

Sources were read from EpicGames/lore `main` at commit [`21c2bd1d`](https://github.com/EpicGames/lore/tree/21c2bd1d0f86676cedf77f8f139b24b90460c918) (2026-10-14). Lore is pre-1.0 and auth is mid-migration, so check these findings again before building on them. Links below are pinned to that commit.

## TL;DR

- **The server verifies bearer JWTs and never issues them.** `[server.auth]` turns on JWT verification: `jwt_issuer` and `jwt_audience` are required, and keys come from JWKS via OIDC discovery or an explicit `[server.auth.jwk].endpoint`. Without `[server.auth]`, the server accepts unauthenticated requests. Lore holds no signing key.
- **There are two login paths, and the server tells the client which ones exist:**
  1. **gRPC "UCS auth" path** (`UrcAuthApi`, 13 custom RPCs). This is the legacy path, served by Epic's auth service at `[environment.endpoint] auth_url` (schemes `ucs-auth://`, `https://`, `http://`). Login is a browser session-code flow. Non-interactive login uses `--token-type api-key|eg1|lore --token ...`, where `eg1` is an Epic-account token. No open-source auth service ships in the repo; the only one is a test stub.
  2. **OIDC / OAuth 2.0 path** (LEP approved 2026-08-20, landing in phases). `[server.auth.oidc]` advertises an issuer and a public `client_id`. The client logs in with the **RFC 8628 device authorization grant**, requests `offline_access`, and stores the access token and refresh token. In the Nightly build, only login works on this path. **Refresh, token exchange (per-partition tokens) and client_credentials are not implemented yet.** Planned providers include Keycloak, Auth0, Okta, Entra ID and Dex.
  - The client chooses a path with `--auth-mode auto|grpc|oidc`, the `LORE_AUTH_MODE` env var, or `LoreGlobalArgs.auth_mode` (`lore_auth_mode_t` in the C API). `auto` follows the server's `oidc.preferred` flag.
- **Credentials live in a file plus an OS keychain entry.** Tokens are kept AES-256-GCM-encrypted in `tokenstore.toml` in the per-user config dir, keyed by auth endpoint and user id. Only the **encryption key** goes in the OS secure store, under service `org.lore` and target `tokenstore_encryption_key`, via the `keyring` crate v3.6 (Windows Credential Manager, macOS Keychain, Linux kernel keyutils). If the secure store fails, the key falls back to a plaintext `sec-tokenstore_encryption_key` file next to the store. `LORE_AUTH_PATH` overrides the directory, and `LORE_AUTH_STORE=fallback` forces the file fallback.
- **Scribe can share the CLI's login.** If Scribe links lorelib (the `lore` Rust crate, or `lore-capi`), or calls `lore-credential` directly, it reads and writes the same `tokenstore.toml` and keychain entry. A cross-process file lock (`tokenstore.toml.lock`) makes this safe, so CLI and Scribe share a login automatically. lorelib also exposes the whole login flow as API calls with events (`AuthUrl` with url and user_code, `AuthPending`), which is what a GUI needs.
- **Demo mode is a zero-config `loreserver`.** It runs unauthenticated with an ephemeral self-signed cert, a store under `<temp>/lore-server`, QUIC/gRPC on 41337 and HTTP on 41339, and a remote URL of `lore://127.0.0.1:41337/`. To test auth locally, add `[server.auth]` and `[server.auth.oidc]` pointing at a local OIDC provider. Plain `http://` issuers are accepted only on loopback.

## 1. Auth flows a self-hosted server supports

### Server side: JWT verification only

From the [server config reference](https://github.com/EpicGames/lore/blob/21c2bd1d0f86676cedf77f8f139b24b90460c918/docs/reference/lore-server-config.md) (sections "Advertised endpoints" and "Authentication"):

- `[server.auth]` present: JWT verification is on for the gRPC API. Absent: "the services accept unauthenticated requests".
- `jwt_issuer` (string or array) and `jwt_audience` (array) are **mandatory**, and the server refuses to start without them. This changed in v0.10.x; earlier builds started a server that verified nothing ([release notes](https://github.com/EpicGames/lore/blob/21c2bd1d0f86676cedf77f8f139b24b90460c918/docs/release-notes.md), v0.10.0).
- `jwt_typ` can be set to `at+jwt` for the RFC 9068 access-token profile.
- JWKS comes from `<jwt_issuer>/.well-known/openid-configuration` unless `[server.auth.jwk].endpoint` overrides it. Keys are cached at startup and fetched again when an unknown `kid` appears.
- Authorization is configured by claims: `permission_claim` (Tier 1, global roles such as Keycloak `realm_access.roles` or Dex `groups`), and `resource_claim`, `resource_id_claim` and `resource_id_template` (Tier 2, per-repository grants; the default template is `urc-{id}`).
- `[environment.endpoint] auth_url` advertises the legacy auth service. It requires `[server.auth]`. `user_url` advertises a user directory for id-to-name lookups. When neither is set, user ids are shown as names.
- `[server.auth.oidc]` holds `client_id` (required), `scopes`, `preferred`, `token_exchange_issuer`, and `resource_template` or `scope_template`. When `[server.auth]` is set without `auth_url`, the server **refuses to start** unless `[server.auth.oidc]` is also set, because clients would have no way to log in (release notes, v0.10.1).
- The public QUIC endpoint defaults to `verify_client_certs = false`. Token auth carries verification, not mTLS.

### Client side: the gRPC "UCS auth" path (legacy, Epic's internal service)

- Implemented in [`lore-transport/src/auth/ucs_auth.rs`](https://github.com/EpicGames/lore/blob/21c2bd1d0f86676cedf77f8f139b24b90460c918/lore-transport/src/auth/ucs_auth.rs) and registered for the schemes `ucs-auth`, `https` and `http`. It speaks `epic_urc.UrcAuthApi` ([`lore-proto/proto/auth_api.proto`](https://github.com/EpicGames/lore/blob/21c2bd1d0f86676cedf77f8f139b24b90460c918/lore-proto/proto/auth_api.proto)): `StartAuthSession`/`GetAuthSession` (browser login with a session code, polled every 5 s up to 30 times), `ExchangeAPIKeyForUserToken`, `ExchangeExternalTokenForUserToken`, `ExchangeUserTokenForMultiresourceToken`, and others.
- The client trades the user token for **one authorization token per repository/partition** ([ADR-00003](https://github.com/EpicGames/lore/blob/21c2bd1d0f86676cedf77f8f139b24b90460c918/docs/developing/decisions/00003-auth-tokens-for-sub-repos.md)). Both kinds of token sit in the same store: the authentication token under key `{auth_url}`, and authorization tokens under `{auth_url}/{32-hex repo id}` (legacy form `{auth_url}/urc-…`).
- CLI ([command reference](https://github.com/EpicGames/lore/blob/21c2bd1d0f86676cedf77f8f139b24b90460c918/docs/reference/lore-cli-commands.md)): `lore auth login [remote-url]` (alias `lore login`), with `--no-browser`, `--token-type <api-key|eg1|lore> --token <t>` and `--auth-url`. Also `lore auth info|list|logout|clear`. The global flags `--identity-token` and `--access-token` bypass the store.
- **Epic accounts:** `eg1` is a token type exchanged through `ExchangeExternalTokenForUserToken`. That exchange only works if the deployment's auth service supports it. This repo ships no `UrcAuthApi` server, only the Python test stub [`scripts/test/mock_auth_server.py`](https://github.com/EpicGames/lore/blob/21c2bd1d0f86676cedf77f8f139b24b90460c918/scripts/test/mock_auth_server.py). **A self-hoster cannot practically use this path.** It exists for Epic's own deployment.

### Client side: the OIDC / OAuth 2.0 path (the future path for self-hosters)

- Design: [LEP 2026-08-20 "Replace the custom authn/authz token scheme with OIDC and OAuth 2.0"](https://github.com/EpicGames/lore/blob/21c2bd1d0f86676cedf77f8f139b24b90460c918/docs/proposals/2026-08-20-oidc-oauth2-authentication.md), status **Approved**, updated 2026-10-08. It defines five phases and keeps both paths running side by side until phase 5 retires the gRPC path.
- Implementation: [`lore-transport/src/auth/oidc/`](https://github.com/EpicGames/lore/blob/21c2bd1d0f86676cedf77f8f139b24b90460c918/lore-transport/src/auth/oidc) (`discovery.rs`, `device.rs`, `token.rs`).
- The flow (LEP D2/D3): the client fetches the environment from the Lore server and gets the issuer, client_id and scopes. It then fetches the issuer's discovery doc over HTTPS (no cross-origin redirects; the doc's `issuer` must match) and POSTs to the device authorization endpoint. It opens `verification_uri_complete` in the browser, or emits the URL, and shows the `user_code`. It polls the token endpoint at the interval the provider sets, handling `slow_down` and `access_denied`. Finally it stores the **access token and refresh token**. An ID token is used for display names only and is never stored or sent.
- **Status in the Nightly release notes:** "The OIDC path serves login alone for now: the refresh, token exchange and client credentials grants are not implemented yet." Until refresh ships, users must log in again whenever the access token expires. Tier 2 per-partition tokens wait on token exchange (phase 4).
- Planned beyond that: `client_credentials` for CI, API keys as RFC 8693 token exchange (`urn:lore:params:oauth:token-type:api-key`), and RFC 7009 revocation on `lore auth logout`.
- Choosing a path: [`lore-transport/src/auth/mode.rs`](https://github.com/EpicGames/lore/blob/21c2bd1d0f86676cedf77f8f139b24b90460c918/lore-transport/src/auth/mode.rs) `AuthMode { Auto, Grpc, Oidc }`. The CLI takes `--auth-mode` or `LORE_AUTH_MODE` ([`lore-client/src/cli/cli.rs`](https://github.com/EpicGames/lore/blob/21c2bd1d0f86676cedf77f8f139b24b90460c918/lore-client/src/cli/cli.rs)). Asking for a path the server does not advertise is an error, not a silent fallback.
- Loopback exception: OIDC URLs must be `https`, except `http://` to `localhost`, `127.0.0.1` or `::1` without userinfo ([`lore-transport/src/auth/mod.rs`](https://github.com/EpicGames/lore/blob/21c2bd1d0f86676cedf77f8f139b24b90460c918/lore-transport/src/auth/mod.rs) `is_loopback_http_url`, used in `oidc/mod.rs`). This makes a local provider on plain http usable for testing.

### Token anti-exfiltration (affects any client)

Each stored token records `acceptable_root_domains`, derived from the token and always including the auth endpoint's own domain. The client refuses to send a token to a host outside that list (`tokens_only_for_recipient_domain` and `verify_jwt_usage_for_remote` in [`lore-credential/src/jwt.rs`](https://github.com/EpicGames/lore/blob/21c2bd1d0f86676cedf77f8f139b24b90460c918/lore-credential/src/jwt.rs); LEP D5). If Scribe ever handles tokens itself instead of going through lorelib, it must apply the same filter.

## 2. How the CLI stores credentials (`lore-credential`)

Source: [`lore-credential/src/token_store.rs`](https://github.com/EpicGames/lore/blob/21c2bd1d0f86676cedf77f8f139b24b90460c918/lore-credential/src/token_store.rs), [`lore-base/src/directories.rs`](https://github.com/EpicGames/lore/blob/21c2bd1d0f86676cedf77f8f139b24b90460c918/lore-base/src/directories.rs), [`lore-base/src/env.rs`](https://github.com/EpicGames/lore/blob/21c2bd1d0f86676cedf77f8f139b24b90460c918/lore-base/src/env.rs), workspace [`Cargo.toml`](https://github.com/EpicGames/lore/blob/21c2bd1d0f86676cedf77f8f139b24b90460c918/Cargo.toml).

| Item | Value |
| --- | --- |
| Token file | `tokenstore.toml`, in `ProjectDirs::from("com", ORG, "lore").config_local_dir()` (`directories` crate). ORG is `Epic Games` on Windows and `epicgames` on Unix. Expected paths: Windows `%LOCALAPPDATA%\Epic Games\lore\config\`, macOS `~/Library/Application Support/com.epicgames.lore/`, Linux `$XDG_CONFIG_HOME/lore/` (usually `~/.config/lore/`). These follow `directories`' conventions and were not checked on a real machine. |
| Override | `LORE_AUTH_PATH=<dir>` (the Lore background service also honours the caller's value) |
| Layout | `remotes[] = { remote = "<auth endpoint>[/<repo id>]", token[] = { user_id, token, acceptable_root_domains, refresh_token? } }` |
| Token encryption | Each token is AES-256-GCM (`ring`) with a random 96-bit nonce per seal, stored as base64 `nonce‖ciphertext‖tag` |
| Encryption key | 32 random bytes, stored in the OS secure store via `keyring` 3.6.3 (features `apple-native`, `windows-native`, `linux-native`). Service `org.lore`, target/account `tokenstore_encryption_key`. On macOS: `Entry::new_with_target("User", "org.lore", "tokenstore_encryption_key")`. Elsewhere: `new_with_target("tokenstore_encryption_key", "org.lore", "identity")`. |
| Fallback | If keyring init or write fails, the key is written in plaintext to `<dir>/sec-tokenstore_encryption_key`, and the process sets `LORE_AUTH_STORE=fallback` for later reads. Setting `LORE_AUTH_STORE=fallback` up front forces this mode. |
| Concurrency | Cross-process `FSLock` on the `tokenstore.toml.lock` sidecar, held for each load-modify-store span. On Windows the file is opened with `FILE_SHARE_READ` so other writers are denied. Each process keeps an in-memory cache and reloads under the lock before it mutates. |
| Key loss | If the key is absent or unusable, a new key is generated, which makes every stored token unreadable (a silent logout). A keychain read that is denied or cancelled is an error, not a reason to rotate the key. |
| Versioning | v0.9.0 moved from `tokens.toml` to `tokenstore.toml` and a new key name, with no migration: "expect one `lore login` per generation". Older and newer clients keep separate credentials. |

The public API (all `async`): `store_user_token`, `load_user_token[_from_store]`, `store_refresh_token`/`load_refresh_token`, `load_identities`, `load_all_identities`, `remove_user_token`, `remove_user_tokens_for_auth_url`, `remove_all_tokens_for_auth_url`, `reset_tokens`.

### OS keychain per platform

- **Windows:** Windows Credential Manager (generic credential, target `tokenstore_encryption_key`), via `keyring`'s `windows-native`.
- **macOS:** the login Keychain (`apple-native`, target `User`). Source comments note that an earlier design, which rewrote the entry on every encrypt, made "each lore process re-authorize against the OS keychain (and, on macOS, prompt once per binary and per rebuild)". The current design only reads the key after it is created, but **a new binary such as Scribe will still hit a Keychain ACL prompt the first time it reads an item the `lore` CLI created** ("Always Allow" settles it). Each rebuild of an unsigned dev build may prompt again.
- **Linux:** `linux-native` in keyring 3.x is the **kernel keyutils** backend; `Cargo.lock` contains `linux-keyutils` and no `secret-service`/`dbus-secret-service`. **Neither GNOME Keyring nor KWallet is used.** My understanding of keyring 3's keyutils store is that it does not survive a reboot (it uses the session/persistent keyrings, which expire). After a reboot the key would be gone, a new key would be generated, and the user would have to log in again. This needs checking on a real Linux machine.

## 3. Can Scribe share the CLI's login?

**Yes, as long as Scribe goes through Lore's own code rather than a reimplementation.**

- `lore-credential`, `lore` (lorelib) and `lore-capi` are all `publish = false`, so none are on crates.io. A Tauri Rust backend can still take them as a **git dependency** on `EpicGames/lore` pinned to a tag, or link the `lore-capi` cdylib or staticlib ([`lore-capi/lore.h`](https://github.com/EpicGames/lore/blob/21c2bd1d0f86676cedf77f8f139b24b90460c918/lore-capi/lore.h)). Either way it uses the same directory, file format, keyring service/target and lock, so a `lore auth login` in the terminal is visible to Scribe and the reverse holds too.
- lorelib exposes the auth operations: [`lore/src/auth.rs`](https://github.com/EpicGames/lore/blob/21c2bd1d0f86676cedf77f8f139b24b90460c918/lore/src/auth.rs) has `login_interactive`, `login_with_token`, `list`, `logout`, `clear`, `local_user_info` and `resolve_user_info`. The C API has the matching `lore_auth_*` args structs. Interactive login ([`lore-revision/src/auth/login.rs`](https://github.com/EpicGames/lore/blob/21c2bd1d0f86676cedf77f8f139b24b90460c918/lore-revision/src/auth/login.rs)) calls `open::that(login_url)` unless `no_browser` is set. With `no_browser`, or whenever there is a `user_code`, it emits `LoreEvent::AuthUrl { url, user_code }`, then `LoreEvent::AuthPending` on each poll. **Scribe should call login with `no_browser = true`, show the URL and code in its own UI, and open the browser through Tauri's opener.**
- **Do not reimplement the store.** Its format has already changed once without migration (v0.9.0), and `lore-credential` is internal and unversioned. A Scribe build linked to Lore version N may not read tokens written by CLI version M, so the Scribe build and the user's CLI should stay on the same Lore release. The Nightly notes add that a client and the Lore background service it relays to must also come from the same build (bitcode protocol v2).
- To isolate Scribe's login from the CLI's (for tests, or a "separate profile" option), set `LORE_AUTH_PATH` on the Scribe process.

## 4. Minimal server for local testing

### Unauthenticated (this is "demo mode")

- Quickstart: `install.sh --demo` (or `LORE_DEMO=1` with `install.ps1`) installs `lore` and `loreserver` and starts the server ([quickstart](https://github.com/EpicGames/lore/blob/21c2bd1d0f86676cedf77f8f139b24b90460c918/docs/tutorials/quickstart.md), [`scripts/install.sh`](https://github.com/EpicGames/lore/blob/21c2bd1d0f86676cedf77f8f139b24b90460c918/scripts/install.sh)). "Demo mode" is only an installer flag. The server itself just runs with zero config.
- Running `loreserver` with no config gives the zero-config defaults ([config ref: Zero-config defaults](https://github.com/EpicGames/lore/blob/21c2bd1d0f86676cedf77f8f139b24b90460c918/docs/reference/lore-server-config.md), [deploy how-to](https://github.com/EpicGames/lore/blob/21c2bd1d0f86676cedf77f8f139b24b90460c918/docs/how-to/deploy-local-lore-server.md)): QUIC on UDP 41337, gRPC on TCP 41337, HTTP on 41339 (`GET /health_check` returns 200), an ephemeral self-signed cert for `localhost`, `127.0.0.1` and `::1` under `<temp>/lore-server/` that is regenerated on each restart, a store under `<temp>/lore-server`, and **no auth**. Commits record no author unless an identity is set in `.lore/config.toml`.
- To make it persistent, add `local.toml` with `[server.quic.certificate] cert_file/pkey_file` and `[immutable_store.local]`/`[mutable_store.local] path`, then run `loreserver --config <dir>`. Docker: `docker build -f lore-server/Dockerfile`, then run with ports 41337/tcp, 41337/udp and 41339 mapped. The image also runs with auth disabled.
- This is enough for Scribe development on everything except the auth UI.

### With auth (to exercise Scribe's login UI)

The OIDC smoke test ([`scripts/test/test_auth_oidc.py`](https://github.com/EpicGames/lore/blob/21c2bd1d0f86676cedf77f8f139b24b90460c918/scripts/test/test_auth_oidc.py), stub provider [`scripts/test/mock_oidc_provider.py`](https://github.com/EpicGames/lore/blob/21c2bd1d0f86676cedf77f8f139b24b90460c918/scripts/test/mock_oidc_provider.py)) shows the minimal config appended to a server config:

```toml
[server.auth]
jwt_issuer = "http://127.0.0.1:<port>"     # local provider; loopback http is allowed
jwt_audience = ["<audience>"]

[server.auth.oidc]
client_id = "<public client id>"
scopes = ["openid"]
```

The test runs the client with `LORE_AUTH_PATH` pointing at a throwaway store and the remote `lore://127.0.0.1:<port>/`. For manual testing, a local Keycloak or Dex configured with a public client that has the device grant enabled should work in place of the stub, though not with Tier 2 yet. The stub itself is test code and is not meant to be run by end users.

## Open uncertainties

1. **Linux keyutils persistence.** Does the encryption key survive a reboot or logout? If not, Linux users get logged out on every reboot. Verify on a real machine, and check whether Lore plans to switch to Secret Service.
2. **macOS Keychain prompts for Scribe.** What does the ACL prompt look like the first time Scribe reads a key the CLI created, and does code signing or notarization avoid repeated prompts on rebuilds?
3. **The OIDC refresh gap.** Refresh, token exchange and client_credentials are not implemented. When they land (LEP phases 3 and 4), what will the session-expired experience look like? Until then a GUI has to detect `NotAuthenticated` (C API status 12) and send the user back through login.
4. **Store-format stability.** Can a Scribe build and a CLI build from different Lore releases share `tokenstore.toml`? There is no compatibility promise. Scribe should probably pin to the same Lore release as the CLI.
5. **Exact config directories.** The paths come from `directories` crate conventions and should be checked on each OS.
6. **Pre-1.0 churn.** Auth config, flags (`--auth-mode`, `--token-type`) and C API structs have changed in each recent release (v0.9.0, v0.10.0, v0.10.1, Nightly). Re-read the release notes before implementing.
7. **Dependency shape.** Can Scribe link lorelib from git, or must it use `lore-capi` or spawn the CLI? This is tracked separately; it determines how much of section 3 applies.
