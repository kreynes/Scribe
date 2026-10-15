# Scribe prototype: Lore parity audit

Audit of the Variant D prototype (`prototype/ui/src/proto/`) against Lore's CLI surface and Rust library. Prototype is throwaway and nothing talks to Lore, so "Present" means "a UI element for the operation exists in the mockup", not "works".

Abbreviations for citations: **V** = `variantD.tsx`, **S** = `shared.tsx`, **SC** = `screens.tsx`, **ST** = `state.tsx` (all under `prototype/ui/src/proto/`).

Status rules used:
- **Present**: an interactive UI element covers the operation's core purpose (minor/rare flags may be noted).
- **Partial**: an entry point exists (even a toast-only stub) but real options/flows are missing, or only part of the sub-operations are covered.
- **Missing**: no interactive entry point. A bare text label in the Advanced sheet (V:1355) is a placeholder, not an entry point, so it counts as Missing.

---

## 1. Sources

**Read (all accessible):**
- Lore CLI reference, rendered page https://epicgames.github.io/lore/reference/lore-cli-commands/ (WebFetch truncated it at ~100k chars of 154k), so I pulled the **full source markdown** it is generated from (clap-markdown output): https://github.com/EpicGames/lore/raw/main/docs/reference/lore-cli-commands.md (2,640 lines, every command, subcommand, flag; read in full).
- Lore client config reference: https://github.com/EpicGames/lore/raw/main/docs/reference/lore-cli-config.md (per-repo `.lore/config.toml`, user `cli.toml`, user `config.toml` `[service]`).
- **Lore source is public**: https://github.com/EpicGames/lore (MIT). Not private. Read via raw.githubusercontent.com / GitHub API tree (2,327 files). Workspace crates: `lore` (the library Scribe will depend on per issue #3/#9), `lore-capi`, `lore-client` (the CLI, `src/cli/commands/*.rs`), `lore-revision` (internals), `lore-storage`, `lore-notification`, `lore-credential`, `lore-proto`, `lore-server`, others.
  - `lore/src/interface.rs` (417 KB): the full `extern "C" fn lore_*` surface, listed in section 2 as the "Rust binding" column.
  - `lore/src/{branch,revision,repository,file,auth,lock,link,layer,shared_store,service,notification,dependency}.rs`: the public `pub async fn` names (used for the Rust-binding column). Signature shape is `async fn(globals: LoreGlobalArgs, args: Lore<Op>Args, callback: LoreEventCallback) -> i32` (verified for `lock::file_acquire`, `revision::amend`).
  - `lore/src/lock.rs`: lock args (`paths`, `branch`; release adds `owner`, `owner_id`) and `file_acquire_as_owner`.
- Local: `CONTEXT.md` (main checkout), the 5 prototype files, `prototype/README.md`.
- Planning: GitHub kreynes/Scribe issues #2 (map), #6 (MVP operations), #7 (Artist Mode workflow), #9 (architecture), read via `gh api` (`gh issue view 2 --comments` printed nothing in this environment, so I used `gh api repos/kreynes/Scribe/issues/N[/comments]`). #10 itself not re-read; #2's decisions were sufficient.

**Not accessible / not verified:**
- No local Lore crates: no `Cargo.toml`/`Cargo.lock`/vendor dir in the worktree or main checkout (only `prototype/ui`, a JS project), and `~/.cargo/registry` does not exist. `lore` is `publish = false` (not on crates.io, so no docs.rs page). Binding names below therefore come from the **upstream GitHub source at `main`**, not from the tag Scribe will pin. Names may differ at the pinned release.
- Not read in full: per-function bodies/arg structs other than `lock`, the event enums (`LoreEvent`), `lore-proto`/server APIs, the Lore glossary, ADRs, release notes, and the Lore Server config. Behaviour claims about what an operation does at runtime are from the CLI help text only, unless stated.
- `docs/adr/` does not exist in this repo, so no ADR was read.
- I did not run Lore or the prototype.

**Rust-binding naming:** CLI `lore X Y` maps to `lore::X::Y` (e.g. `lore branch create` -> `lore::branch::create`, C ABI `lore_branch_create`). Where the CLI has a sub-subcommand the Rust fn is flattened with underscores (`branch::merge_resolve_mine`, `revision::cherry_pick_resolve_theirs`). Marked "(C-ABI only)" where I only saw the `lore_*` symbol.

---

## 2. Parity table

Columns: Lore command | what it does | Rust binding | Scribe status | Mode (D = Developer, A = Artist, Both) | UI surface.

Top-level aliases (`lore status|clone|stage|dirty|unstage|reset|diff|history|commit|sync|push|login`) are identical to their `repository`/`file`/`revision`/`branch`/`auth` namesakes and are covered by those rows, not repeated.

### 2.1 Global options (apply to every command)

| Option | What it does | Binding | Status | Mode | Suggested surface |
|---|---|---|---|---|---|
| `--repository <path>` | Pick the working tree | `LoreGlobalArgs.repository_path` | **Present**: project switcher, V:139-155 (list at V:25-29) | Both | n/a |
| `--identity` | Identity recorded on commits | `LoreGlobalArgs.identity`; `identity` in `.lore/config.toml` | **Partial**: account switcher V:249-281 and Settings > Account V:1174-1199 switch sign-in, but nothing sets the per-project commit identity | Both | Settings > Projects > (project) "Commit identity" field. Commit fails without one ("No commit identity configured"), so surface it as an inline fix on the Commit button error |
| `--identity-token`, `--access-token` | Use a token instead of the secure store | `LoreGlobalArgs` | **Missing**: onboarding shows "Sign in with a token" as static text only, SC:83 | D (A via Advanced) | Account > Add account > "Use a token" (see `auth login --token`) |
| `--offline` / `--local` / `--remote` | Force offline / local data / remote data | `LoreGlobalArgs.offline/local/remote` | **Missing** | Both | Status-bar "Offline" chip + palette "Work offline"; per-Operation "use local data" in the Sync dialog (D) |
| `-f/--force`, `--dry-run` | Force; report-only | `LoreGlobalArgs.force/dry_run` | **Missing** (no dry-run anywhere) | D (dry-run also A in Sync) | "Preview" button next to Sync/Switch/Merge start: shows what would change without touching the working tree |
| `--max-connections`, `--file-count-limit`, `--file-size-limit`, `--compress-limit` | Parallelism / throughput tuning | `LoreGlobalArgs` | **Missing** | D | Settings > Performance (4 numeric fields, defaults shown) |
| `--no-gc`, `--sync-data`, `--cache` | Skip background GC; fsync on flush; cache remote fragments | `LoreGlobalArgs.no_gc/sync_data/cache` | **Missing** | D | Settings > Storage toggles (see `[store]` config) |
| `--search-limit`, `--search-nearest` | Revision-matching search bounds | `LoreGlobalArgs` | **Missing** | D | Settings > Performance (advanced, collapsed) |
| `--stats <level>` | Report what an Operation cost | `LoreGlobalArgs.stats/stats_full` | **Missing** | D | Operation bar: "Details" link after completion showing totals/per-fragment cost |
| `--log-level`, `-d/--debug` | Logging | `lore_log_configure` | **Partial**: static "Lore log" tab, V:1749 / S:169-175, no level picker | D | Lore log toolbar: level select + "Open log file" |
| `--event-interval` | Progress cadence | `LoreGlobalArgs.event_interval` | **Missing** | none | Not UI (issue #9 fixes 100 ms and coalesces) |
| `--non-interactive`, `-P/--no-pager` | CLI prompts / pager | n/a | n/a | none | Not applicable to a GUI |

### 2.2 `lore repository`

| Lore command | What it does | Binding | Status | Mode | Suggested surface |
|---|---|---|---|---|---|
| `repository status` / `status` (`--scan`, `--check-dirty`, `--reset`, `--revision-only`, `--count`, `--targets`) | Staged revision + dirty files; `--scan` reconciles from disk | `repository::status` | **Partial**: Staging tab lists changes, V:443-500; no "Scan for changes" control. Lore does not walk the disk unless asked, so the list can be stale | Both | Refresh icon in Staging header = `--scan`; auto-run on window focus; D gets a "Check dirty" / "Reset scan" overflow menu; Explorer header can show `--count` |
| `repository info` | Info about a repository (URL) | `repository::info` | **Partial**: project info popover V:156-174, Settings > Projects V:1301-1310 | Both | Same popover; D adds raw repo ID |
| `repository list <url>` | List repositories at a remote | `repository::list` | **Missing**: clone picker is a hard-coded "forest-game" box, SC:101-104 | Both | Clone dialog: searchable list of server repos (Onboarding step 4 and "Clone or open a project…" V:152, which is a toast) |
| `repository create` (`--description`, `--id`, `--vfs`, `--use-shared-store`, `--shared-store-path`, offline = name only) | New repository | `repository::create` / `create_with_metadata` | **Partial**: "Create new" radio, SC:93-97, but no form | Both (A hides vfs/id) | Create dialog: name, description; D: `--id`, VFS (none/default/swfs, Preview), shared-store options |
| `repository clone` (`--view`, `--revision`, `--branch`, `--bare`, `--direct-file-write`, `--vfs`, `--layer`, `--layer-metadata`, `--prefetch`, `--use-shared-store`, `--shared-store-path`, `--no-tracking`, `--root-file`, `--dependency-tag/-recursive/-depth-limit`) | Clone to disk | `repository::clone` | **Partial**: view-filter folder picker SC:106-114 (D adds file option as static text SC:114); everything else missing | Both | Clone dialog: A = project, folders, location. D adds "Branch/revision", "Bare (no files)", "Prefetch list", "Only these files and their dependencies" (root file + tag + recursive + depth), "Offline-ready" (`--offline`/`--cache`), VFS, shared store |
| `repository delete <url>` | Delete a repository **on the server** | `repository::delete` | **Missing**: "Remove from Scribe…" V:1336 only forgets the local copy | D (A via Advanced) | Settings > Projects > (project) > "Delete from server…" typed-confirmation (per issue #6). Keep visually separate from "Remove from Scribe" |
| `repository verify [state\|fragment]` (`--path`, `--heal`, `--context`) | Consistency check, optional heal | `repository::verify_state` / `verify_fragment` | **Missing** | D (A via Advanced) | Settings > Projects > (project) > "Check project health" (state, optional path, "Repair" = `--heal`); fragment verify is debug-only (section 4) |
| `repository dump` (`--path`, `--revision`, `--max-depth`) | Dump state tree | `repository::dump` | **Missing** | D | Probably not UI (section 4) |
| `repository gc` | Full local GC pass | `repository::gc` | **Missing** | D | Settings > Storage > "Clean up local storage now"; A: automatic only |
| `repository store immutable query` | Query a fragment address | `repository::store_immutable_query` | **Missing** | D | Not UI (section 4) |
| `repository metadata get/set/clear` (`--binary`, `--numeric`) | Repo-level key/values | `repository::metadata_*` | **Missing** (Advanced sheet text V:1355 mentions only "Revision metadata") | D | Settings > Projects > (project) > "Metadata" key/value table (D); Advanced in A |
| `repository instance list/prune` | Registered working trees of this repo | `repository::instance_list/_prune` | **Missing** | D | Settings > Projects: "Other copies of this project on this computer" list + "Remove stale entries". Natural fit with the existing project list V:1286 |
| `repository config get <key>` | Read a config value | `repository::config_get` | **Missing** | D | Read-only values inside the Storage/Project settings pages; no generic key box |
| `repository update-path` | Tell Lore the working tree moved | `repository::repository_update_path` | **Partial**: "Move…" V:1328 (toast) and "Open a folder…" V:1283 | Both | "Move…" should do the move then `update-path`; "Locate…" for a project whose folder vanished |

### 2.3 `lore branch`

| Lore command | What it does | Binding | Status | Mode | Suggested surface |
|---|---|---|---|---|---|
| `branch list` (`--archived`) | List branches | `branch::list` | **Partial**: side-panel list V:225-230 with search and favorites (V:177-190); no archived toggle | Both | Side-panel header filter popover: "Show archived" (D; A in Advanced) |
| `branch info` | Branch facts | `branch::info` | **Present**: Branch information dialog V:284-345 (mock data) | Both | Add D-only raw fields: branch ID, latest pointer (see `latest list`) |
| `branch create` (`--id`) | New branch from the current revision | `branch::create` | **Present**: New branch dialog V:1008-1088; `--id` not exposed. **Note:** V:1070 prints `lore branch create <name> --from <branch>`, but the CLI has no `--from`; see open question 1 | Both | D-only advanced "Branch ID" field |
| `branch switch [revision]` (`--dry-run`, `--local`, `--reset`, `--bare`) | Switch branch / revision | `branch::switch` | **Partial**: switch by double-click V:116 / menu S:97 / palette V:1690-1695; guard V:103; no revision, no `--reset`, no dry-run | Both | Switch confirm dialog when dirty: "Discard local changes and switch" (`--reset`) as a third choice beside Commit / Commit & Push; "Switch to revision…" in RevisionMenu; D: "Preview changes" (`--dry-run`) |
| `branch push` (`--fast-forward-merge`) | Push a branch | `branch::push` | **Partial**: Push button V:1758 and palette V:1679; Commit & Push (A) V:492 | Both | Push split-button arrow: "Allow server to fast-forward merge"; "Push another branch…" via BranchMenu |
| `branch merge <branch>` (`--id`, `--message`, `--inherit-metadata`) | Merge source into current | `branch::merge_start` (auto-commit when clean) | **Partial**: "Merge into current" S:107, toast-only | D (A via Advanced) | Merge dialog from BranchMenu: source, message, "Carry over metadata keys" (`--inherit-metadata`, D) |
| `branch merge start` (`--no-commit`, `--dry-run`, `--link`, `--ignore-links`) | Start a merge, optionally without committing | `branch::merge_start` | **Missing** | D | Merge dialog options: "Don't commit automatically", "Preview only", link scope (`--link`/`--ignore-links`) |
| `branch merge into <target> <message>` | Merge **current** into a target branch | `branch::merge_into` | **Missing** | D | BranchMenu on a branch other than current: "Merge current branch into this…" (the existing item only does the other direction) |
| `branch merge resolve mine/theirs` | Resolve conflicts by side | `branch::merge_resolve_mine/_theirs` | **Present** for choosing a side: "Keep mine"/"Use theirs", SC:263-264 | Both | n/a |
| `branch merge resolve [paths]` | Mark paths resolved after editing | `branch::merge_resolve` | **Missing** | D | Conflict screen: "I merged it by hand, mark resolved" + "Open in editor" |
| `branch merge unresolve` / `restart` | Reopen a resolved path / reset its merge state | `branch::merge_unresolve`, `merge_restart` | **Missing**: resolved rows are final in SC:177-185 | D | Right-click on a resolved row in the conflict list SC:206-225: "Undo my choice" (unresolve), "Start this file over" (restart) |
| `branch merge abort` (`--link`, `--ignore-links`) | Abort merge | `branch::merge_abort` | **Missing**: no way out of the conflict screen except resolving all | Both | "Abort merge" button in the conflict screen header/footer SC:189-197, 256-268 (A: "Cancel and go back") |
| `branch diff <target>` (`--source`, `--auto-resolve`) | What a merge would change/conflict | `branch::diff` | **Missing** | Both | BranchMenu "Compare with current…" and a pre-merge summary in the merge dialog; "Try to resolve automatically" (`--auto-resolve`) |
| `branch archive` (`--include-layers`, `--layer`, `--include-links`, `--link`) | Archive a branch | `branch::archive` | **Partial**: "Delete (Advanced)" S:108 toast; Lore has archive, not delete (open question 4) | D (A Advanced) | Relabel to "Archive…" with checkboxes "also in layers/links" |
| `branch reset <revision>` (`--branch`) | Move local latest pointer | `branch::reset` | **Missing** | D | Typed confirmation (issue #6). Branch info dialog > "Reset local branch to…" (D) |
| `branch protect` / `unprotect` | Push protection | `branch::protect/_unprotect` | **Partial**: shown read-only V:326, V:1475, V:1489; mock rule is invented (V:1475) | D (A Advanced) | Branch info dialog: "Protect from direct pushes" switch (D); BranchMenu item |
| `branch latest list [limit]` (`--branch`) | History of the local latest pointer | `branch::latest_list` | **Missing** | D | Branch info > "Pointer history" list, the undo trail for `branch reset`/sync |
| `branch metadata get/set/clear` (`--branch`, `--binary`, `--numeric`) | Branch key/values | `branch::metadata_*` | **Missing** | D | Branch info dialog > "Metadata" table |

### 2.4 `lore revision`

| Lore command | What it does | Binding | Status | Mode | Suggested surface |
|---|---|---|---|---|---|
| `revision history [length]` (`--revision`, `--branch`, `--only-branch`, `--oneline`) | List revisions | `revision::history` | **Present**: History tab V:546-674 (branch select V:592, search/author/date, sort, paging). `--only-branch` not exposed | Both | D toggle "Stop at branch point" |
| `revision info` (`--delta`, `--metadata`) | Revision details | `revision::info` | **Partial**: CommitDetails panel V:676-725 (mock file list; D parent/metadata lines V:698 are static text) | Both | D: expand "Delta" and "Metadata" sections from real data |
| `revision commit <msg>` (`--link`, `--link-message`, `--layer`, `--layer-message`) | Commit staged | `revision::commit` / `commit_with_metadata` | **Partial**: Commit button V:491, message box V:487; no link/layer scoping | Both | D: "Also commit linked repositories" list with per-link messages, shown only when links/layers exist |
| `revision amend <msg>` | **Change the latest commit's message only** | `revision::amend` | **Missing**: Advanced sheet text V:1355, not interactive | D (A Advanced) | RevisionMenu on the newest local revision: "Edit message…". See open question 2: this does **not** fold files in |
| `revision sync [revision]` (`--forward-changes`, `--reset`, `--root-file`, `--dependency-tag/-recursive/-depth-limit`, `--view`) | Sync working tree to a revision | `revision::sync` | **Partial**: Sync button V:1757, palette V:1676, Ctrl+Shift+S V:1728; mock only toasts (ST:155). No target, no flags | Both | Sync split button: "Sync to…" (branch@number / revision), "Overwrite my local changes" (`--reset`), "Keep my local changes" (`--forward-changes`), "Change folders…" (`--view`), D: dependency-based partial sync; RevisionMenu "Sync to this revision" |
| `revision bisect --start --end` | Find the revision that introduced a change | `revision::bisect` | **Missing** | D | History tab: select two revisions > "Find the revision that broke it…" |
| `revision diff <src>` (`--target`, `--path`, `--targets`) | Compare two revisions | `revision::diff` | **Partial**: "Compare with previous" V:703, toast | Both | "Compare…" on any two selected history rows (multi-select), result shown as changed-file list (same list component as V:706-718) |
| `revision find metadata` / `find number` | Look up a revision by metadata or number | `revision::find` | **Missing**: History search only filters loaded rows by message/id V:577 | Both | History search box: "#123" jumps to number; D: `key=value` metadata filter |
| `revision restore [msg]` | Re-make the current revision the latest | `revision::restore` | **Partial**: "Restore this revision…" S:78, V:702 (toasts); semantics unclear (open question 5) | Both | Keep S:78 but split: "Restore all files from this revision" vs per-file (file `reset --revision`) |
| `revision cherry-pick <rev>` (`--message`, `--no-commit`, `--inherit-metadata`) | Apply one revision | `revision::cherry_pick` | **Partial**: "Cherry-pick (Advanced)" S:83, toast | D (A Advanced) | Dialog: message, "Don't commit", metadata keys |
| `revision cherry-pick resolve [mine\|theirs]`, `unresolve`, `restart`, `abort` | Conflict handling for a cherry-pick | `revision::cherry_pick_*` | **Missing** | D | Reuse the existing conflict screen with title "Cherry-pick of 4b81d0c7"; same Abort/Undo controls as merge |
| `revision revert <rev>` + `resolve/unresolve/restart/abort` | Undo a revision | `revision::revert*` | **Partial**: "Revert (Advanced)" S:82, toast; subcommands missing | D (A Advanced) | Same pattern as cherry-pick |
| `revision metadata get/set/clear` (`--binary`) | Metadata on a **staged** revision / read any | `revision::metadata_*` (+ `metadata_list`) | **Missing** | D | Commit area: "Add metadata…" disclosure (staged revision); CommitDetails: read-only list |

### 2.5 `lore file`

| Lore command | What it does | Binding | Status | Mode | Suggested surface |
|---|---|---|---|---|---|
| `file info` (`--revision`, `--local`, `--filtered`) | Size/hash/info of paths | `file::info` | **Partial**: FileDetails V:382-441 (type, size, status, lock, last revision, static hash V:406) | Both | D: "Size on disk (filtered)" and real content hash |
| `file metadata get/set/clear` (`--revision`, `--binary`) | Per-file key/values (staged) | `file::metadata_*` (+ `metadata_list`) | **Missing** | D | FileDetails (D): "Metadata" section with add/remove |
| `file dependency add/remove/list` (`--tag`, `--force`, `--reverse`, `--recursive`, `--depth`, `--revision`) | Dependency edges between files (drives selective sync) | `dependency::dependency_add/_remove/_list` | **Missing** | D (A read-only "Used by / Uses") | FileDetails: "Dependencies" and "Used by" lists; context-menu "Add dependency…"; this is the editing counterpart of sync/clone `--root-file` |
| `file stage` (`--case`, `--scan`, `--targets`) | Stage paths | `file::stage` | **Present** for D: checkboxes V:479-480, FileMenu "Stage" S:61. `--case`, `--scan` not exposed. A never stages (by design, issue #7) | D | `--scan` = the Refresh/Scan control; `--case` shown only if a case-only rename is detected |
| `file stage move <from> <to>` | Record a rename | `file::stage_move` | **Missing** | Both (A automatic) | Staging: detect delete+add pair > "This looks like a rename: Hero.psd -> Hero_v2.psd [Treat as move]"; D right-click "Rename/Move…" |
| `file stage merge` | Stage paths as a merge result | `file::stage_merge` | **Missing** | D | Part of the merge flow (not a standalone button) |
| `file dirty` (+ `move`, `copy`) | Tell Lore a path changed without scanning | `file::dirty/_move/_copy` | **Missing** | D | Plumbing used by the file watcher; surface only "Mark as copied" in the rename suggestion (section 4) |
| `file unstage` | Unstage | `file::unstage` | **Present**: "Unstage all" V:479, FileMenu S:61 | D | n/a |
| `file reset` (`--purge`, `--revision`, `--last-merged-from`, `--mine`, `--theirs`, `--targets`) | Discard local changes / reset to a revision | `file::reset`, `file::reset_to_last_merged` | **Partial**: "Reset (discard my changes)" S:56 and FileDetails V:411 (`p.reset`) | Both | Reset dialog (simple confirm per issue #6) with: "Also delete untracked files" (`--purge`), "Reset to revision…" (`--revision`), D: "to the last merge from branch X: mine/theirs" |
| `file obliterate` (`--address`, `--path`) | Permanently remove from history | `file::obliterate` | **Missing** (Advanced sheet text V:1355) | D (A Advanced) | FileMenu (D) > "Obliterate from history…" typed confirmation |
| `file history <path>` (`--revision`, `--branch`, `--depth`, `--oneline`, LENGTH) | Revisions touching a file | `file::history` | **Present**: FileDetails history list V:413-435 ("Show history" S:54 is a toast) | Both | "Show history" should open FileDetails scrolled to History; "Load more" for `LENGTH`/`--depth` |
| `file diff` (`--source`, `--target`, `--diff3`, `-U`, `--ignore-space-at-eol`, `--ignore-space-change`, `--targets`) | Diff file(s) | `file::diff` | **Partial**: "Show diff" S:55 and V:409 are toasts; no diff viewer exists (conflict screen shows thumbnails only, SC:242) | Both | A: visual before/after for images; D: text unified diff viewer with context lines, ignore-whitespace toggles, `--diff3` for conflicts |
| `file write` (`--address`/`--path`, `--revision`, `--output`) | Export a file version to a path | `file::write` | **Missing**: needed by "Save a copy of mine first" SC:257 and "Use theirs ... saved as .mine" SC:180 | Both | FileMenu / History file rows: "Save this version as…"; used internally by conflict "Save a copy" |
| `file hash` | Hash local file | `file::hash` | **Missing** | D | Not UI (section 4); hash display is in FileDetails |

### 2.6 `lore auth` / `login`

| Lore command | What it does | Binding | Status | Mode | Suggested surface |
|---|---|---|---|---|---|
| `auth login` / `login` [url] (`--token-type`, `--token`, `--auth-url`, `--no-browser`) | Sign in (device flow or token) | `auth::login_interactive`, `auth::login_with_token` | **Partial**: Onboarding device code SC:74-87; "Add account…" V:275, V:1200 (toasts). Token path and `--no-browser` are static text SC:83 | Both | Add account dialog: "Sign in with browser" (A) and "Use a token" (token type + value + auth URL, D/Advanced); "Copy sign-in link" for `--no-browser` |
| `auth info [user-id]` (`--with-identity-token`, `--with-access-token`) | Who am I / resolve user IDs | `auth::local_user_info`, `auth::resolve_user_info` | **Partial**: Account page header V:1176-1183; user-ID resolution (to show names for lock owners/authors) not visible | Both | Resolve IDs to names everywhere (Locked by Ana, History author). Token display options: not UI (security) |
| `auth list` (`--with-token`) | Stored identities | `auth::list` | **Present**: "Accounts on this computer" V:1185-1199, switcher V:263-273 | Both | Never expose `--with-token` |
| `auth logout` (`--auth-url`, `--resource`, `--user-id`) | Remove a login / one resource authorization | `auth::logout` | **Partial**: Sign out V:277, V:1182 (toasts); no per-account / per-server removal | Both | Per-account "Sign out" button on each row V:1189-1197; per-server sign-out on Lore Servers rows V:1205-1215 |
| `auth clear` | Wipe all stored auth | `auth::clear` | **Missing** | D | Settings > Account > "Sign out of everything…" (confirm; warn that it signs the Lore CLI out too when the profile is shared, V:1222) |

### 2.7 `lore lock`

| Lore command | What it does | Binding | Status | Mode | Suggested surface |
|---|---|---|---|---|---|
| `lock acquire <paths>` (`--branch`) | Acquire advisory lock on files | `lock::file_acquire` | **Present**: "Lock" in FileMenu S:52, FileDetails V:410. Locks are modelled per project, not per branch (open question 3) | Both | Show lock branch in tooltip V:48-64; D `--branch` picker |
| `lock acquire` as another owner | Admin acquire | `lock::file_acquire_as_owner` (lib only) | **Missing** | D (A Advanced) | Admin action, simple confirm (issue #6) |
| `lock status [paths]` (`--branch`) | Who holds what | `lock::file_status` | **Present**: lock icons V:48-64, FileDetails Lock row V:402-403, LockWarningDialog S:135-154 | Both | n/a |
| `lock query` (`--branch`, `--owner`, `--path`) | List locks by branch/owner/path | `lock::file_query` | **Partial**: Explorer "Show locked" split button with all/me/others V:885-920, V:963. No by-owner (person), no by-branch, no list of locked files **outside the current view filter** | Both | A: "Locks" board: people list, "Ana: 3 files" (the who's-editing-what idea from issue #2). D: owner/branch/path filter fields in the lock menu |
| `lock release <paths>` (`--branch`, `--owner`) | Release; admin release of others' locks | `lock::file_release` | **Partial**: "Release lock" S:52, V:410; for others' locks the menu only says who holds it S:50. No admin release | Both | FileMenu on someone else's lock: "Release Ana's lock… (admin)" with simple confirm; "Release all my locks" in the Lock filter menu |

### 2.8 `lore link` / `layer` (Preview upstream)

| Lore command | What it does | Binding | Status | Mode | Suggested surface |
|---|---|---|---|---|---|
| `link add <path> <url> <source>` (`--pin`, `--disable-branching`) | Mount part of another repo | `link::add` | **Missing**: text-only "Links and layers (Preview)" V:1355 | D (A Advanced) | Settings > Projects > (project) > "Linked repositories (Preview)" table + "Add link…" dialog |
| `link remove`, `update` (`--pin`), `list` (`--staged`), `info` | Manage links | `link::remove/_update/_list/_list_staged/_info` | **Missing** | D | Same table: row actions "Update pin", "Remove", row details = `info`; Staging shows "Linked repo changes" section when `list --staged` is non-empty |
| `layer add <path> <repo> <path>` (`--metadata`) | Overlay another repo | `layer::layer_add` | **Missing** | D | Same page, "Layers (Preview)" table |
| `layer remove` (`--purge`), `layer list` | Remove / list layers | `layer::layer_remove/_list` (+ `layer_list_staged`, not in CLI) | **Missing** | D | Row action "Remove" with "also delete untracked files" checkbox |

### 2.9 Everything else

| Lore command | What it does | Binding | Status | Mode | Suggested surface |
|---|---|---|---|---|---|
| `logfile info` | Where the log file is | C-ABI only (`lore_log_configure`); CLI `logfile info` | **Partial**: Lore log tab V:1749, S:169-175 | D | Lore log toolbar: "Open log folder" |
| `notification subscribe [seconds]` | Server push events for the repo | `notification::subscribe` / `unsubscribe` | **Missing** | none (plumbing) | No button; it feeds live lock/branch/push updates (issue #9 "global emit events"). At most Settings > General "Live updates" on/off |
| `service run/start/stop/status/set-executable/set-use-automatically` | Lore background service | `service::start/stop/status/set_executable/set_use_automatically` | **Missing** | D (Advanced in A) | Settings > Advanced > "Lore background service (Preview)": status, Start/Stop. Conflicts with issue #9's forced in-process (`LORE_USE_SERVICE=0`), open question 7 |
| `shared-store create/info/list/set-use-automatically` | Dedup store shared by working trees | `shared_store::create/info/list/set_use_automatically` | **Missing** | D (Advanced in A) | Settings > Storage: "Shared store" status card, "Create shared store…", "Use for new projects" switch, list with "Used by" instances (`--include-instances`) |
| `completions <shell>` | Shell completions | n/a | n/a | none | Not for a GUI |

### 2.10 Config files Lore documents (not CLI commands, but user-facing settings)

| Setting | Source | Status | Mode | Suggested surface |
|---|---|---|---|---|
| `[store] max_capacity / max_size / eviction_delay / compaction_delay / verify_write` | `.lore/config.toml` | **Missing** | D | Settings > Storage (per project): "Local cache size limit" (`max_size`, 10 GiB default), D: capacity, delays, "Verify every write" |
| `[file] direct_write` (`flush_write` is currently inert) | `.lore/config.toml` | **Missing** | D | Settings > Storage toggle "Write files directly (faster, not atomic)" |
| `identity`, `remote_url` | `.lore/config.toml` | **Missing** (remote is read-only fact, V:164) | D | Identity: see global options. Remote: show only, never edit (docs warn) |
| `pager` | `cli.toml` | n/a | none | Not applicable |
| `[service]` | user `config.toml` | **Missing** | D | See service row |

---

## 3. Missing features grouped by area

Concrete proposals, using the existing idioms: **side panel** (branches, project, account), **tabs** (Staging, History, Explorer, Graph, Lore log), **context menus** (S:40-112), **Details panel** (V:374), **Settings dialog** (V:1111) and **Ctrl+K palette** (V:1665). Every item should also get a palette entry (V:1675-1709 currently has ten actions).

### 3.1 Sync / remote
- **Sync options (Both):** turn the Sync button (V:1757) into a split button like `LockFilterButton` (V:894-920). Arrow menu: "Sync to a revision or branch…", "Overwrite my local changes" (`--reset`), "Keep my local changes" (`--forward-changes`), "Choose folders to keep on this computer…" (`--view`, ties to the Settings > Projects "View filter" V:1319-1323). D adds "Preview changes" (`--dry-run`) and the dependency-based options. Palette: "Sync to…".
- **Push options (D):** Push button (V:1758) gets the same arrow: "Allow server to fast-forward merge", "Push a different branch…".
- **Work offline (Both):** a status chip near the Commands button (V:1753) toggling `--offline`; Onboarding "Connect" step can offer "Work offline". Offline behaviour is listed as unspecified in issue #2.
- **Operation cost (D):** after an Operation finishes, the Operation bar (S:156-167) shows "Details" (`--stats`). Today it only has Hide (S:164) and no Cancel; issue #9 says Cancel only where verified, so leave it.

### 3.2 Branching and merging
- **Merge dialog (D, Advanced in A):** replace the stub S:107. Fields: source, message, "Don't commit automatically", "Preview only", "Carry over metadata keys", link scope. Pre-flight summary from `branch diff` (changed files, predicted conflicts, "Try to resolve automatically").
- **Merge into… (D):** BranchMenu item on non-current branches: "Merge current branch into this one…" (`merge into`).
- **Conflict screen additions (Both):** Abort button, per-row "Undo my choice" / "Start this file over", "Mark resolved after editing by hand", "Open in editor". Title varies by origin (merge / cherry-pick / revert / sync). The screen is currently only reachable from the prototype switcher (SC:275-295), not from Sync, Switch or Merge; the real flow needs those entry points.
- **Archive instead of Delete (D):** relabel S:108.
- **Protect (D):** switch in Branch information (V:326 becomes editable).
- **Reset / pointer history (D):** Branch information > "Reset local branch to…" (typed confirmation) and "Pointer history". 
- **Branch metadata (D):** key/value table in Branch information.
- **Switch with dirty tree (Both):** extend the toast guard (V:103, S:114-119) into a dialog: Commit / Commit & Push / Discard changes (`--reset`).

### 3.3 History and revisions
- **Multi-select compare (Both):** `revision diff` between any two History rows; result reuses the changed-files list in CommitDetails (V:706-718).
- **RevisionMenu additions (S:70-87):** "Sync to this revision", "Create branch from here" (needs open question 1), "Compare with current", "Save a copy of file…" (`file write`), D: "Find the revision that broke it (bisect)", "Edit message" (amend, newest local revision only).
- **History search (Both):** `#123` revision-number jump (`find number`), D: `key=value` metadata search (`find metadata`).
- **CommitDetails (D):** real delta + metadata sections (V:698 is static).
- **Cherry-pick / Revert flows (D):** dialog + shared conflict screen with Abort.
- **Revision metadata (D):** "Add metadata" disclosure under the commit message (V:487) for the staged revision.

### 3.4 Files, staging and diff
- **Diff viewer (Both):** the biggest hole in the file area. "Show diff" appears in four places (S:55, V:409, V:703 and History) and all are toasts. A: visual compare for images/audio waveform/3D if feasible, else "before / after" sizes. D: text diff with context lines, ignore-whitespace toggles; `--diff3` for conflicts.
- **Scan / refresh (Both):** Lore does not walk the disk unless told (`status --scan`). Add a refresh icon in the Staging header (V:1745 area) and run on window focus.
- **Renames/copies (Both):** suggestion banner in Staging for a delete+add pair (`stage move`, `dirty copy`).
- **Reset dialog (Both):** upgrade S:56 / V:411 to a dialog with `--purge`, "to revision…", D "to last merge: mine/theirs".
- **File dependencies (D; A read-only):** FileDetails sections "Uses" and "Used by", "Add dependency…" action, tag field, cycle-check override.
- **File metadata (D):** FileDetails section.
- **Obliterate (D):** FileMenu item with typed confirmation.
- **Save a copy (Both):** FileMenu / FileDetails history rows: "Save this version as…".
- **Info (D):** "Size on disk with my folder selection" (`file info --filtered/--local`).

### 3.5 Locks
- **Admin release / acquire-as-owner (D; A Advanced):** FileMenu item when another user holds a lock (S:49-51 currently a dead label).
- **Release all my locks:** Lock filter menu footer (V:907-916).
- **Locks board (A):** group the Explorer "Locked by others" result by person ("Ana: 3 files") as a view in the same split-button popover. Needs `lock query --owner`.
- **Branch awareness:** show the lock's branch in the tooltip (V:50-51) and in Branch information's "locked files" count (V:289, which is mocked).
- **Auto-lock patterns:** Settings > General has only an empty input (V:1160-1163). Needs: shared pattern list read from `.scribelock` (read-only), local overrides list with add/remove, "Test a path" box.

### 3.6 Projects, repositories, storage
- **Clone dialog (Both):** server repo list (`repository list`), folders, destination; D: branch/revision, bare, prefetch, dependency-based partial clone, offline-ready, VFS, shared store.
- **Create dialog (Both):** name/description; D: ID, VFS, shared store.
- **Delete on server (D):** Settings > Projects > (project) > "Delete from server…" (typed confirmation), visually apart from "Remove from Scribe…" (V:1336).
- **Health (D):** "Check project health" and "Repair" (`verify --heal`), "Clean up local storage" (`gc`).
- **Other copies (D):** `instance list/prune` in Settings > Projects.
- **Locate / Move (Both):** wire "Move…" V:1328 and add "Locate…" (`update-path`).
- **Metadata (D):** repository metadata table.
- **Storage settings (D):** new Settings section "Storage": local cache limit, shared store card, direct-write, verify-write, GC button.
- **Links / layers (D, Preview):** "Linked repositories" and "Layers" tables in Settings > Projects > (project), plus a "Linked repo changes" group in Staging when staged links exist.

### 3.7 Accounts / auth
- **Add account dialog (Both):** browser sign-in (A), token sign-in with token type + auth URL (D/Advanced), "no browser" copy-link option. Today V:275, V:1200 are toasts and SC:83 is plain text.
- **Per-account sign-out (Both):** buttons per row (V:1189-1197, V:1205-1215).
- **Sign out of everything (D):** `auth clear`.
- **Resolve user IDs (Both):** everywhere a person is shown.

### 3.8 Diagnostics
- **Lore log (D):** level picker, Open log folder (V:1749).
- **Settings > Advanced (D; A reaches via Advanced sheet):** service controls (Preview), performance limits (`--max-connections` etc.), stats default.
- **Advanced sheet (A):** V:1349-1359 is a static list of seven labels; each needs to become a real entry that opens the Developer-style dialog from above. Missing from the list: dependencies, file metadata, repository/branch metadata, verify/gc, instance prune, delete from server, bisect, archive vs delete.

---

## 4. Things that probably should NOT be UI

| Command / option | Reason |
|---|---|
| `repository dump` | Debug dump of internal state tree; no user task. Offer only through "Copy diagnostics" if support needs it. |
| `repository store immutable query` | Raw fragment-address lookup; storage internals. |
| `repository verify fragment` | Needs a fragment hash/context; only meaningful to Lore developers. Keep `verify state` (health check). |
| `file hash` | Prints a local file's hash; FileDetails can show the hash without a command. |
| `file dirty` / `dirty move` / `dirty copy` | Bookkeeping to avoid a disk walk; Scribe's file watcher and `--scan` replace it. Surface only the rename/copy suggestion. |
| `file stage merge` | Internal step of merge resolution. |
| `--event-interval` | Fixed by Scribe (issue #9: 100 ms, coalesced to ~10 Hz). |
| `--identity-token`, `--access-token`, `auth info --with-*-token`, `auth list --with-token` | Secrets in plain view; the Lore profile (CONTEXT.md) handles tokens. |
| `--targets <file>` on many commands | CLI convenience for long path lists; the UI already has selections. |
| `--non-interactive`, `--no-pager`, `completions`, `pager` in `cli.toml` | Terminal concerns. |
| `service run` | Meant to be the service process itself; and issue #9 forces in-process. |
| `notification subscribe/unsubscribe` | Plumbing that feeds live updates; no standalone control. |
| `revision metadata`, `branch metadata`, `repository metadata`, `file metadata` (`--binary`, `--numeric`) | Arguably Developer-only power features, not "never": keep behind Developer Mode / Advanced if the user wants Parity. |
| `repository config get` (arbitrary key) | Generic key reader; expose specific settings instead. |
| `storage::*` and `revision_tree::*` (library only) | Already excluded by CONTEXT.md "Parity". |
| `lock::file_acquire_as_owner` | Library-only admin path (not a CLI command, but the user listed it in issue #6): admin menu item only. |

---

## 5. Open questions

1. **`branch create` has no base option in the CLI** (`branch create [--id] <branch>` only). The prototype shows `--from <branch>` at V:1070 and offers "Start from" any branch in the dialog V:1058-1071 plus "New branch from here…" S:104. Probably Lore branches from the **currently synced revision**. Branching from another branch may need switch-then-create (guess), or `switch <branch> [revision]` first. Needs a test against a local `loreserver`. Also V:1076-1077 "your changes come with you" matches Git semantics; verify against Lore.
2. **`revision amend` only edits the message** (CLI help: "Amend the latest commit's message"; Rust doc: "Amends the most recent revision by updating its commit message"). Issue #7's Commit & Push is "stages the ticked files, amends them into that revision". If amend can't fold in files, the amend-chain design does not work and Commit & Push needs another approach (second commit + push; wait for squash). Highest-impact open question.
3. **Locks are keyed by branch** (`lock acquire/status/release --branch`, `lock query --branch`). The prototype's lock model has no branch notion (ST file entries have `lock: {by}`). What does "locked on main" mean for a user on `art/env-pass`? Does `status` without `--branch` default to the current branch? (guess: yes).
4. **Is there a branch "delete"?** CLI has `archive` and `reset` only. "Delete (Advanced)" S:108 and the Advanced sheet's "Create, merge, delete, protect branches" V:1355 may need renaming to archive. Is archive reversible (`branch list --archived` shows "local" archived branches)? Is it server-side?
5. **`revision restore`:** "Restore current revision as latest revision" with a message. Is that "make the revision I'm synced to a new head" (rollback by new commit)? The prototype's "Restore (one file / all)" (issue #7) seems to combine `file reset --revision` (one file) and `revision restore` (all). Guess, needs confirming.
6. **Sync conflicts:** how does a conflict from `revision sync` with locally modified files surface (flags `--reset`, `--forward-changes`)? Is it the same merge-resolution machinery (`merge resolve mine/theirs`)? The prototype's header text "revision.sync reported file_conflict=N" (SC:195) is an invented event name (guess). I did not read `LoreEvent`.
7. **Service vs in-process:** issue #6 puts `service` in Parity; issue #9 sets `LORE_USE_SERVICE=0` and runs in-process. Is a service-control UI wanted at all (maybe read-only status), given `set-use-automatically` would be ineffective or harmful for Scribe?
8. **Change requests:** the Developer CommitDetails shows `change-request: none` metadata (V:698). Issue #2 says Lore has no CR API; unclear whether that's a real revision-metadata key. Treat as invented.
9. **Branch protection semantics:** V:326 says "changes need a review before they land" and V:1475 invents protection for `release/*`. CLI says only "Protect a branch from direct pushes". Is review implied? (guess: no; it's server-enforced rejection of direct push). What does Scribe offer when push is rejected: merge via another branch?
10. **`repository delete <url>` argument** accepts a name/ID "resolved against this repository's remote", so deletion works from inside a working tree. Deleting needs server permission; how are permission errors surfaced (the error set in issue #9 has no `PermissionDenied`)?
11. **`--local`/`--remote`/`--offline` interplay** with `Disconnected` vs `NoRemote` errors (config docs): which should Scribe surface as "Offline" vs "Server unreachable"?
12. **Names in the Rust-binding column come from `main`**, not from the tag Scribe pins; recheck after pinning (issue #9 already plans a per-release Parity check).

---

## 6. Counts

Rows in sections 2.1-2.9 (CLI surface, a few rows bundle several sub-flags or subcommands): **Present 11, Partial 29, Missing 48** (88 rows; a further 6 rows are n/a for a GUI). Section 2.10 (config settings): 4 Missing, 1 n/a. Overall: Present 11, Partial 29, Missing 52.

Rows are not equal weight: a bundled row such as `branch merge ...` is split into several, but `repository clone` is one row with 14 flags.
