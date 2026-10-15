# Lore branch create / switch / archive semantics

Answers kreynes/Scribe#15. Source: https://github.com/EpicGames/lore at release tag **v0.10.1** (commit `95a9a834f18402cbacf43d43518c0ac771e029eb`, published 2026-10-06, latest release at time of reading). All links below are pinned to that tag. Everything here was read in code; nothing was run (no local `loreserver` was built). Anything not read in code is marked **GUESS**.

`main` is 94 commits ahead of v0.10.1 and touches `lore-revision/src/branch.rs`, `repository.rs`, `fs/realize.rs`, `revision/sync.rs` and `branch/push.rs`. I did not diff those; re-check if Scribe moves to a newer pin.

Shorthand: `CLI` = `lore-client/src/cli/commands/branch.rs`.

## Gist

- `branch create` forks from the revision the working tree is currently synced to (not the branch's latest), switches to the new branch, touches no working files, and is local until `branch push`.
- `branch switch` without `--reset` keeps locally modified files only if they are unchanged between the two revisions; if the incoming revision changes a locally modified file it refuses the whole switch (`LocalModifications`). Staged changes also refuse it. `--reset` overwrites the working tree. Unpushed commits on the branch you leave are untouched.
- `branch archive` is a reversible, non-destructive tombstone, applied locally and then on the server (unless `--local`). There is no real delete anywhere.

## 1. `branch create <name> [--id <id>]`

CLI args are only `name` and `--id` ([CLI#L63-L72](https://github.com/EpicGames/lore/blob/v0.10.1/lore-client/src/cli/commands/branch.rs#L63-L72)). The category is hard-coded empty ([CLI#L559-L572](https://github.com/EpicGames/lore/blob/v0.10.1/lore-client/src/cli/commands/branch.rs#L559-L572)). It calls `lore_revision::branch::create::create`.

- **Base revision**: `state_current.revision()`, the current anchor, i.e. the revision the working tree is synced to. It becomes `stack[0] = BranchPoint { branch: current_branch, revision }` ([create.rs#L100-L131](https://github.com/EpicGames/lore/blob/v0.10.1/lore-revision/src/branch/create.rs#L100-L131)). It is not the latest of the current branch: if you are behind latest, the new branch forks from where you are. Verified.
- **Needs a revision**: errors "Unable to create a branch without a previous revision, commit something first" if the current revision is zero ([create.rs#L109-L113](https://github.com/EpicGames/lore/blob/v0.10.1/lore-revision/src/branch/create.rs#L109-L113)).
- **Switches**: yes. After creation it stores the new branch as the current anchor branch and the current anchor revision ([create.rs#L211-L222](https://github.com/EpicGames/lore/blob/v0.10.1/lore-revision/src/branch/create.rs#L211-L222)). No sync runs, so no working files change; local modifications and staged state stay exactly as they were (the staged anchor is re-stored). So "create" is already "create and switch"; a separate switch afterwards is not needed.
- **Server**: not required on the code path read. The new branch is written to the local mutable store and its latest pointer is stored with `BranchLatestStatus::Divergent` ([branch.rs#L1504](https://github.com/EpicGames/lore/blob/v0.10.1/lore-revision/src/branch.rs#L1504) and following; the `store_latest` call is near the end of `create`). It reaches the server only on `lore branch push`. The name-taken check is best effort remote: `load_name_to_id` asks the server only if the local lookup misses, and ignores remote errors ([branch.rs#L684-L730](https://github.com/EpicGames/lore/blob/v0.10.1/lore-revision/src/branch.rs#L684-L730)). So offline create should work but cannot detect a name already used on the server. **GUESS** on exact offline behaviour since not run.
- **Extras**: creates same-named branches in layers and linked repositories ([create.rs#L226-L300](https://github.com/EpicGames/lore/blob/v0.10.1/lore-revision/src/branch/create.rs#L226-L300)); with links this can produce a new revision (`is_commit`), reported as "at new revision ... (updated for linked repositories)". Global `--force` with an existing name archives the old branch locally and remotely and recreates it ([create.rs#L148-L190](https://github.com/EpicGames/lore/blob/v0.10.1/lore-revision/src/branch/create.rs#L148-L190)).
- **Restore via create**: if the branch ID (`--id`) already has metadata, create "restores" it: it re-writes the name-to-id mapping and keeps the old latest and stack ([branch.rs#L1560-L1600](https://github.com/EpicGames/lore/blob/v0.10.1/lore-revision/src/branch.rs#L1560-L1600)).

## 2. `branch switch <branch> [revision] [--reset] [--local] [--dry-run] [--bare]`

CLI args: [CLI#L92-L117](https://github.com/EpicGames/lore/blob/v0.10.1/lore-client/src/cli/commands/branch.rs#L92-L117). `--force`, `--dry-run`, `--local`, `--offline` are global flags ([cli.rs#L46-L66](https://github.com/EpicGames/lore/blob/v0.10.1/lore-client/src/cli/cli.rs#L46-L66)). Core: `repository::branch_switch` ([repository.rs#L2796](https://github.com/EpicGames/lore/blob/v0.10.1/lore-revision/src/repository.rs#L2796)).

**Target revision** (`branch_switch_target`, [repository.rs#L2964](https://github.com/EpicGames/lore/blob/v0.10.1/lore-revision/src/repository.rs#L2964)): explicit `revision` if given (must be on that branch or be its branch point); else, if both local and remote heads exist, the remote latest when the remote is ahead and coherent, otherwise the local latest (divergent or local ahead); else whichever exists. If the branch exists only on the server it is created locally first. `--local` (or `--offline`) skips the remote query entirely and uses the local latest ([repository.rs#L3006](https://github.com/EpicGames/lore/blob/v0.10.1/lore-revision/src/repository.rs#L3006)). The CLI prints "using current local/remote latest revision".

**Staged changes**: a switch is refused with "Unable to switch branch when there is a staged state" if anything is actually staged, unless `--force` or `--reset` ([repository.rs#L2833-L2862](https://github.com/EpicGames/lore/blob/v0.10.1/lore-revision/src/repository.rs#L2833-L2862)).

**Locally modified (unstaged) files, no `--reset`**: the switch runs a normal sync from current to target. The sync computes the diff between the two revisions, then verifies each *changed* path against the file system before writing anything ([realize.rs#L133-L148](https://github.com/EpicGames/lore/blob/v0.10.1/lore-revision/src/fs/realize.rs#L133-L148), [#L236-L247](https://github.com/EpicGames/lore/blob/v0.10.1/lore-revision/src/fs/realize.rs#L236-L247)). Result per file:

- Modified locally, and identical in both revisions: not in the diff, so **kept as is**.
- Modified locally, and the incoming revision changes that file: **error `LocalModifications`** ("Local modifications prevent synchronization"; log "File has local changes: ..."), [realize.rs#L773-L780](https://github.com/EpicGames/lore/blob/v0.10.1/lore-revision/src/fs/realize.rs#L773-L780). The whole switch fails; no merge, no conflict markers. The anchor is only updated after the sync succeeds ([repository.rs#L2867-L2905](https://github.com/EpicGames/lore/blob/v0.10.1/lore-revision/src/repository.rs#L2867-L2905)), so you stay on the old branch. (One exception: a remote-only target branch has already been created locally by then.)
- Modified locally but already equal to the incoming content: accepted ("already holds the incoming content").
- Global `--force` sets `forward_changes`: conflicting files are **kept as locally modified** ("Keeping modified file as locally modified", [realize.rs#L753](https://github.com/EpicGames/lore/blob/v0.10.1/lore-revision/src/fs/realize.rs#L753)), and staged state is dropped.
- Deleted locally and changed incoming: restored (or kept deleted under `--force`).

**`--reset`**: the diff is taken from the file system to the target state instead, and verification is skipped, so every locally modified file is overwritten to match the target ([realize.rs#L133-L160](https://github.com/EpicGames/lore/blob/v0.10.1/lore-revision/src/fs/realize.rs#L133-L160), [#L236](https://github.com/EpicGames/lore/blob/v0.10.1/lore-revision/src/fs/realize.rs#L236)). Local edits are discarded. It also bypasses the staged-changes refusal. **GUESS**: whether staged entries are dropped under `--reset` alone; the code only deletes the staged anchor under `--force` and otherwise rebases it ([repository.rs#L2890-L2900](https://github.com/EpicGames/lore/blob/v0.10.1/lore-revision/src/repository.rs#L2890-L2900)).

**Unpushed local commits on the branch you leave**: untouched. Commits store the branch's local latest pointer (`store_latest`, Divergent; [commit.rs#L1695-L1715](https://github.com/EpicGames/lore/blob/v0.10.1/lore-revision/src/commit.rs#L1695-L1715)), and switch never rewinds or pushes it. Switching back resolves the local latest again (the "Local revision is ahead, sync to local latest" path). Nothing blocks the switch because of unpushed commits.

**`--dry-run`**: reports what would change, no file system changes. **`--bare`**: only updates anchor tracking, no file work. Layers follow the switch; a layer with uncommitted staged changes blocks it unless `--force`.

## 3. `branch archive <branch> [--include-layers | --layer <path>] [--include-links | --link <path>]`

CLI args: [CLI#L337-L358](https://github.com/EpicGames/lore/blob/v0.10.1/lore-client/src/cli/commands/branch.rs#L337-L358). Implementation: `archive_impl` ([lore/src/branch.rs#L1182](https://github.com/EpicGames/lore/blob/v0.10.1/lore/src/branch.rs#L1182)).

- **Order and scope**: refuses if the branch is the current one ("Cannot archive the current branch", [L1202](https://github.com/EpicGames/lore/blob/v0.10.1/lore/src/branch.rs#L1202)); archives the local branch; then, unless global `--local`, archives it on the server too. A branch never pushed, or already archived by someone else, is not an error. Any other remote failure (for example not authorized) fails the call. So it is **local and server-side** by default.
- **Refusals** (`branch::delete`, [branch.rs#L1931-L1990](https://github.com/EpicGames/lore/blob/v0.10.1/lore-revision/src/branch.rs#L1931-L1990)): current branch, protected branch (`DeleteProtected`), default branch (`DeleteDefault`). The server enforces the same checks ([server branch_delete.rs#L91-L170](https://github.com/EpicGames/lore/blob/v0.10.1/lore-server/src/grpc/revision/v1/branch_delete.rs#L91-L170)). No check for unpushed commits or unmerged work was found.
- **`--include-layers` / `--layer <path>`, `--include-links` / `--link <path>`**: layers and links are separate repositories that each own their branch lifecycle, so by default archive only touches the outer repository; these flags cascade the archive to every layer/link, or to the one at the mount path. `--include-X` and `--X <path>` are mutually exclusive ([lore/src/branch.rs#L1260-L1296](https://github.com/EpicGames/lore/blob/v0.10.1/lore/src/branch.rs#L1260-L1296)). The cascade runs even if the outer archive failed, so a repeat converges.
- **Reversible: yes, as a tombstone.** Archive calls `delete_name_to_id` only: it erases the name-to-id mapping. Metadata, latest and history stay. The server proto says the same: "Tombstoned (deleted=true) branches are preserved by id but their name → id mapping is erased", name freed for reuse ([model.proto#L124-L147](https://github.com/EpicGames/lore/blob/v0.10.1/lore-proto/proto/lore/model/v1/model.proto#L124-L147)). `lore branch list --archived` shows archived local branches ([CLI#L388-L392](https://github.com/EpicGames/lore/blob/v0.10.1/lore-client/src/cli/commands/branch.rs#L388-L392)). Restoring: `lore branch create <name> --id <old-id>` re-attaches the existing branch (see section 1). There is **no dedicated unarchive command** (none in `BranchCommands`, [CLI#L410-L440](https://github.com/EpicGames/lore/blob/v0.10.1/lore-client/src/cli/commands/branch.rs#L410-L440)). **GUESS**: that the same restore works against the server-side tombstone on push; I read only the local path and the server delete.
- **Real delete**: none found in CLI, lib (`lore/src/branch.rs`), revision crate, or server. The server RPC is named `BranchDelete` but implements the tombstone above. So the product term is "Archive"; the prototype menu should not say "Delete".

## Prototype guesses vs findings

| Prototype guess | Verdict |
|---|---|
| New branch dialog: switch to base branch, create, switch to new | **Unnecessary.** Create forks from the currently synced revision of the current branch and switches itself, with no file changes. There is no base option; to branch from another branch's tip you must first switch to it (which can hit `LocalModifications`). |
| Switch dialog assumes local edits come along without `--reset` | **Partly right.** Kept only when the target revision does not change those files; otherwise the switch fails with `LocalModifications` and nothing changes. `--reset` discards edits; `--force` keeps them. Staged changes refuse the switch. The UI needs a preflight and a cancel/discard choice. |
| Branch menu says "Delete" | **Wrong.** It is Archive: reversible tombstone, local plus server, refused for the current/default/protected branch. |

## Not verified

- Not run against a live `loreserver`; all behaviour is from code reading at v0.10.1.
- Offline create name-collision behaviour, staged handling under `--reset` alone, server-side restore of a tombstoned branch.
- Whether `main` (94 commits ahead) changes any of this.
