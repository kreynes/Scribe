# Spike findings: Locks and `LocalModifications` against a live `loreserver` (Lore v0.10.1)

Resolves [What do lock enforcement and `LocalModifications` look like against a live `loreserver`?](https://github.com/kreynes/Scribe/issues/24). Throwaway code; the deliverable is the facts below. Every answer comes from running Lore, 2026-10-15.

## Short answers

1. **Locks are advisory for commit and push.** With Alice holding the Lock on `a.txt`, Bob could stage, commit **and push** `a.txt`. The server took the push, and the Lock stayed with Alice. The server does enforce the Lock *itself*: Bob can't acquire it or release it.
2. **The `Complete` event carries no paths.** It has `errorCode: 44`, `message: "Local modifications prevent synchronization"` and source trace locations, nothing else. The clashing paths do exist, but only as free-text error **log** lines ("File has local changes: a.txt …"). Lore sends these to the Operation's callback as `log` events, but only after `lore::log::initialize()` has been called. All clashing files are listed, untracked ones included; dirty files the target doesn't touch are not.
3. **A Lock owner is the user id from the JWT's identity claim** (`sub` by default), and Lore shows that raw value. Lore turns it into a name (`preferred_username`/`name`) only for **your own** id, from your own token. Other users' ids need the server's user directory (`user_url`, falling back to `auth_url`). Without one, they show as the raw id, e.g. `7c9e6679-7425-40de-944b-e07fc1f90ae7`. Without auth, every owner is empty (`<unknown>`) and anyone can release anyone's Lock.
4. **In a merge that `sync` starts, `mine` is the remote tip and `theirs` is your own unpushed commit.** `branch merge resolve mine` keeps the *other person's* pushed content. The conflict markers in the file say the opposite (`<<<<<<< ours` holds your local commit). The merge commit's first parent is the remote revision, and your commit becomes the merged-in ("incoming") one.

## Setup

- Lore at tag `v0.10.1` (commit `95a9a83`), debug build on Windows 11, local `loreserver` with a temporary store.
- **Unauthenticated runs** (questions 2 and 4, and the first attempt at 1): plain `loreserver.exe`.
- **Authenticated runs** (questions 1 and 3): `loreserver --config auth/config`, with JWT verification against a stand-in identity provider. `auth/mint.py` writes an RSA key, a JWKS and an OIDC discovery document, served with `python -m http.server 8765`, and mints RS256 tokens per user (`sub` = user, `roles` = `["read","write"]`). The CLI is driven with `--access-token <jwt>`, which also sets the identity from `sub`.
- **Library probe:** `live-probe/` is a binary added as a member of the Lore workspace. It runs `lore::revision::sync` or `lore::branch::switch` the way Scribe will and prints every raw `LoreEvent` as JSON. `LIVE_PROBE_LOG=1` calls `lore::log::initialize()` first.
- Scripts: `lock-enforce.sh` (question 1), `localmods-merge.sh` (questions 2 and 4), `sync-merge-sides.sh` (question 4, minimal). Raw output is in `logs/`.

### Two Lore v0.10.1 client gaps hit while enabling auth

Neither is about Locks, but anyone repeating this will hit them, and so will Scribe on an OIDC-style server:

- **`repository create` and `clone <name>` can't send a supplied access token.** Both connect with no repository id, and the client only attaches a token for a non-zero repository, so the server answers `authorization header required`. Workaround used: create the repository while the server runs without auth, wait for the store flush (about 10 s), restart the same store with auth, and copy that seed Working tree for each user.
- **`push` (and any storage upload) fails with `Not authorized to access repository`** when the server has `[server.auth]` but no `auth_url`. The QUIC storage session only sends a token when the server advertises an `auth_url` (`lore-transport/src/quic/storage_service/client.rs`). That's every push, by anyone, with or without Locks (`logs/lock-enforce-unpatched-client.log`). To test push against a Lock anyway, the client got the one-line patch in `client-storage-token.patch`: send the supplied access token there. **The server was not changed.** The original binary is kept as `lore-v0.10.1-unpatched.exe`.

## 1. Lock enforcement

Two Working trees on the auth-enabled server, Alice and Bob (`logs/lock-enforce-patched-client.log`):

| Step (as Bob, unless noted) | Result |
|---|---|
| Alice: `lock acquire a.txt` | acquired |
| `lock status` / `lock query` | `a.txt by alice` |
| `lock acquire a.txt` | **refused**: `Internal error`, "resource already locked" (exit 255) |
| `lock release a.txt` | **refused**: "resource locked by somebody else" (exit 255) |
| edit `a.txt`, `stage` | succeeds, no warning |
| `revision commit` | succeeds, no warning |
| `branch push` | **succeeds**: revision 2 by `bob` is on the server |
| Alice: `lock status a.txt` | still `by alice` |
| Alice: `sync` | pulls Bob's change into her locked file, no warning |

Without auth (first attempt, unauthenticated server): `--identity` doesn't separate owners. Every Lock shows `<unknown>`, Bob's `lock acquire` on Alice's Lock answers "Lock already owned" (exit 0), and Bob's `lock release` **succeeds**. So Lock ownership only means something on a server with auth.

## 2. `LocalModifications` from `sync` and `branch switch`

Working tree `y` at revision 1 with an uncommitted edit to `a.txt` (changed by revision 2), an edit to `c.txt` (not changed by revision 2), and an untracked `d.txt` (added by revision 2).

`Complete` event from `lore::revision::sync` (the same for `lore::branch::switch`, plus one trace location "Failed to synchronize state during branch switch"):

```json
{"tagName":"complete","data":{"status":44,"error":{"errorCode":44,
  "message":"Local modifications prevent synchronization",
  "traceLocations":[{"file":"lore-revision\\src\\fs\\realize.rs","line":779,"column":47,"context":""}]}}}
```

Before it, the only other events are `revisionSyncTarget` (source and target revision) and, for switch, `branchSwitchBegin`. **No event carries a path** unless logging is on. With `lore::log::initialize()`:

```json
{"tagName":"log","data":{"level":"error","location":"lore_revision::fs::realize","message":"File has local changes: d.txt (incoming size 6 bytes, file system size 18 bytes)"}}
{"tagName":"log","data":{"level":"error","location":"lore_revision::fs::realize","message":"File has local changes: a.txt (incoming size 18 bytes, file system size 13 bytes)"}}
{"tagName":"log","data":{"level":"error","location":"lore_revision::relay","message":"Local modifications prevent synchronization\n  at …"}}
```

- Every clashing file gets a line: both `a.txt` (tracked edit) and `d.txt` (untracked file the target adds). `c.txt`, dirty but untouched by the target, is not listed.
- `initialize()` sets the global log level to Debug. One sync gave 34 debug, 2 info and 3 error `log` events, so Scribe would filter by level and `location`.
- The failed Operation **changes nothing**: the tree stays on revision 1 and all three local files keep their content.
- With only the non-clashing `c.txt` dirty, sync **succeeds** to the new revision and keeps the edit to `c.txt`.

## 3. Lock owner id and display name

Third user Carol: `sub` = `7c9e6679-7425-40de-944b-e07fc1f90ae7`, `preferred_username` = `carol`, `name` = `Carol Example`.

| Who looks | `lock status` / `lock query` shows |
|---|---|
| Carol (her own Lock) | `b.txt by carol` |
| Bob | `b.txt by 7c9e6679-7425-40de-944b-e07fc1f90ae7` |

The owner id is the `identity_claim` value (`sub` by default; a server can point it at another claim). It's the same id recorded as creator/committer on revisions. The server knows no names. The CLI's lookup (`resolve_local_user_info`) decodes your own token for your own id and gives up on everyone else's. Remote lookup goes through the user directory, which this server didn't have. For Scribe, the library has `lore::auth::resolve_user_info` for that, which works only on a server with a user directory. Otherwise, show the id.

## 4. Which side is `mine` in a sync-triggered merge

`sync-merge-sides.sh` (`logs/sync-merge-sides.log`): `remote-side` pushes `f.txt = REMOTE` and a change to `g.txt`. `local-side` commits `f.txt = LOCAL` without pushing, then syncs.

- Sync **succeeds** (`status 0`). The conflict shows up in events, not as an error: `branchMergeStartEnd {hasConflicts: 1, fileConflict: 1}` and `revisionSyncRevision {flagMerge: true, flagConflict: true}`.
- `status`: "Pending merge, incoming revision `<local-side's own commit>`". The non-conflicting `g.txt` is already staged with the remote content.
- The file on disk:
  ```
  <<<<<<< ours
  LOCAL
  ||||||| original
  BASE
  =======
  REMOTE
  >>>>>>> theirs
  ```
- `branch merge resolve mine f.txt` → `REMOTE`. `branch merge resolve theirs f.txt` → `LOCAL`.
- The merge commit's parents are **remote revision first, local commit second**. Server history shows the remote revision on the main line and the local commit as `Merge: …`.

So Lore runs a sync over split history as "merge my local commits into the remote tip". `mine`/`theirs` follow that, while the markers follow the user's point of view. The same run in `localmods-merge.sh` (`logs/localmods-merge.log`) gave the same result.

Not tested: which side is `mine` in an explicit `branch merge <other branch>`.

## What this means for Scribe

- **Locks:** Scribe is the only enforcer of Locks on commit and push (this confirms the glossary's "Advisory today"). Before Commit & Push, Scribe should check `lock status` on the files it sends and stop or warn on a file locked by someone else. A sync can also overwrite a file the user holds a Lock on with someone else's push, so Scribe can't rely on a Lock to protect local work.
- **Lock owner display:** store and compare the raw owner id. Show "you" by comparing it to the signed-in identity, and show other users by name only when `resolve_user_info` returns one. Treat an empty owner (server without auth) as "unknown", and don't offer "locked by someone else" logic there.
- **Clashes on Sync and Switch:** from the `Complete` error, Scribe can tell *that* local edits clashed (`errorCode 44`), not *which* files. Two ways to get the paths:
  1. call `lore::log::initialize()` and parse the error-level `log` events from `lore_revision::fs::realize` (free text, may change between Lore releases), or
  2. compute them: dirty and untracked files in the Working tree, intersected with the files the target revision changes. The `revisionSyncTarget` event gives both revision ids.
  Option 2 doesn't depend on log wording. Option 1 is a cheap cross-check. A failed Sync or Switch leaves the tree untouched, so trying first and explaining afterwards is safe.
- **Merges from Sync:** never show Lore's `mine`/`theirs` words, or the file's `ours`/`theirs` markers, to the user as-is. In a sync-triggered merge, "keep my version" is `resolve theirs` and "take theirs" is `resolve mine`. Detect the merge from `flagMerge`/`flagConflict` or `hasConflicts`, not from `Complete`, which reports success.
- **Auth on OIDC-style servers:** at v0.10.1 the Lore client can't push, create or clone-by-name with a supplied access token when the server has no `auth_url`. That's worth a Lore issue and a note in Scribe's sign-in design.

## Not tested

- Explicit `branch merge` (not sync-triggered): which side is `mine`.
- A server with a real user directory (`user_url`), so other users' names never resolved.
- Lock behaviour across branches (Locks are keyed by branch; only `main` was used).
- Release builds, and a remote or slow server.
