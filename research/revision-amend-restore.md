# What do `lore revision amend` and `lore revision restore` actually change?

Resolves kreynes/Scribe#14. Source: [EpicGames/lore](https://github.com/EpicGames/lore) (MIT), release tag **v0.10.1** (latest release, published 2026-10-06), commit `95a9a834f18402cbacf43d43518c0ac771e029eb`. All links below are pinned to that tag. Everything here was read from code; nothing was run (no local `loreserver`). Guesses are marked **[guess]**.

`main` is 94 commits ahead of v0.10.1. `lore-revision/src/revision/amend.rs` and the CLI command definitions are unchanged. `restore.rs` is listed as modified in the GitHub compare view but with zero changed lines (likely line endings only). `lore-revision/src/commit.rs` changed on `main` and was not re-read.

## Short answer

- **`revision amend` changes only the commit message** (plus two bookkeeping metadata keys). It cannot fold staged files into the latest revision.
- **`revision restore [msg]`** takes the revision you are currently synced to, makes a **new revision on top of the remote branch head** whose tree is that old revision's tree, and **pushes it immediately**. It is not a local operation and it does not move the latest pointer backwards.
- Lore has **no squash command** at v0.10.1. Squash is described as a data-model possibility that is "still on the roadmap".
- The amend chain in issue #7 (Commit = amend; Commit & Push = amend files in) **does not work** as written.

## `revision amend`

CLI: `lore revision amend <MESSAGE>`, one required positional, no other flags ([`RevisionAmendArgs`, cli/commands/revision.rs L183-L187](https://github.com/EpicGames/lore/blob/v0.10.1/lore-client/src/cli/commands/revision.rs#L183-L187); help text "Amend the latest commit's message", [L460-L461](https://github.com/EpicGames/lore/blob/v0.10.1/lore-client/src/cli/commands/revision.rs#L460-L461)).

Library entry: `LoreRevisionAmendArgs` has a single field `message` ([lore/src/revision.rs L222-L229](https://github.com/EpicGames/lore/blob/v0.10.1/lore/src/revision.rs#L222-L229)); the doc comment says "Amends the most recent revision by updating its commit message" (L231). The handler builds `AmendRevisionOptions { message: Some(..) }` and calls `amend_revision_boxed` ([L260-L277](https://github.com/EpicGames/lore/blob/v0.10.1/lore/src/revision.rs#L260-L277)).

Implementation ([lore-revision/src/revision/amend.rs L86-L174](https://github.com/EpicGames/lore/blob/v0.10.1/lore-revision/src/revision/amend.rs#L86-L174)):

1. Loads the current anchor (revision + branch) and deserializes that revision's state (L91-L99).
2. Loads its metadata blob, clones it, sets `MESSAGE` to the new message (L101-L115).
3. If a user id is known, sets `COMMITTED_BY` to the current user and sets `CREATED_BY` only if it was missing (L117-L130).
4. Serializes the metadata; if its hash equals the old one it returns `IdenticalMetadata` (L132-L139). So amending with the same message and same user is an error.
5. Calls `state_current.set_metadata_hash(..)` and serializes the **same state** with the new metadata hash (L141-L147). The tree, parent and revision number are untouched. The new signature differs because the metadata hash is part of the state.
6. Stores the new signature as the branch's local latest and as the current anchor, marked `Divergent` ([`store_branch_latest_and_make_current`, commit.rs L1698-L1719](https://github.com/EpicGames/lore/blob/v0.10.1/lore-revision/src/commit.rs#L1698-L1719)).

Nothing in the function reads the staged state or the working tree, so staged files are ignored. There is no flag to include files.

### Local vs pushed revisions

There is no check that the revision is unpushed. Amend works on whatever the current anchor is, including a revision already on the server. What it produces is a new revision with the **same parent** as the old one, so a pushed revision that is amended becomes a sibling of the remote head, not a replacement. In `branch push`, a remote head that is not the local revision's parent triggers a history reconciliation, and when the remote side has revisions the local side lacks, push stops with "Branch has diverged, sync to merge remote changes" unless `--force` or fast-forward-merge is on ([branch/push.rs L905-L940](https://github.com/EpicGames/lore/blob/v0.10.1/lore-revision/src/branch/push.rs#L905-L940)). What the server does with a forced push of such a sibling **[guess]**: not read; the server side was out of scope. Practical rule: amend only unpushed revisions.

### Effect on the user

`COMMITTED_BY` is overwritten with the amender; `CREATED_BY` stays the original author. Revision number and parent are unchanged.

## `revision restore [message]`

CLI: `lore revision restore [MESSAGE]`; help "Restore current revision as latest revision"; message optional ([cli/commands/revision.rs L291-L295](https://github.com/EpicGames/lore/blob/v0.10.1/lore-client/src/cli/commands/revision.rs#L291-L295), [L476-L477](https://github.com/EpicGames/lore/blob/v0.10.1/lore-client/src/cli/commands/revision.rs#L476-L477)). The library doc: "Restores the current branch to a previously synced revision" ([lore/src/revision.rs L648-L657](https://github.com/EpicGames/lore/blob/v0.10.1/lore/src/revision.rs#L648-L657)).

Implementation ([lore-revision/src/revision/restore.rs L216-L541](https://github.com/EpicGames/lore/blob/v0.10.1/lore-revision/src/revision/restore.rs#L216-L541)):

- **"Which revision" is whatever you are currently synced to.** It takes no revision argument. It reads the current anchor as the revision to restore (L224-L226, L250-L253). The workflow is therefore `lore sync <old revision>` then `lore revision restore ["message"]`.
- **Requires a remote and an up-to-date branch.** It loads the remote branch head and errors with "Invalid head" if there is none (L228-L238), and errors "Branch behind latest revision" if the local head differs from the remote head unless forced (L240-L246). It also errors "Branch divergent from remote" unless forced (L255-L279). Offline use is effectively blocked by the first check.
- **Creates a new revision on top of the remote head.** It diffs the remote head state against the old (current) state (L285-L299), applies those changes to a staged copy of the head state without touching the disk (L359-L381), re-hashes it, sets `parent_self` to the head revision and clears `parent_other` (L449-L452). The tree equals the old revision's tree; history keeps growing. Nothing is deleted or rewound.
- **Metadata:** message is the argument, or the old revision's message when omitted (L411-L416); adds a `RESTORED_FROM` hash key pointing at the old revision (L418-L420); other metadata is merged from the old revision (`MetadataInherit::All`, L397-L405).
- **Pushes in the same call.** If a remote exists it uploads missing fragments and calls `branch_push` for the new revision (L468-L541), stores it as the local latest as `Convergent` and records last sync. The local branch ends up pushed; there is no "restore locally, push later" mode. `--dry-run` only lists affected files (L354-L357).
- **Whole revision only.** There is no path argument; restoring a single file is a different command (`lore file reset --revision`, mentioned in the release notes, not read here).
- The working directory is not touched by the restore (changes are applied "on state, not disk", L369-L370); because the user was already synced to the old revision, the disk already matches the new tree. Behaviour with uncommitted local changes at the time of restore **[guess]**: not verified.

For Scribe's "Restore this revision" (whole revision): sync to it, then `restore`. This is immediately a pushed revision, so Scribe should confirm before doing it, and should require being on the branch head. Per-file restore should use `file reset`, not this.

## Can "Commit locally, then Commit & Push" be one revision?

Not through `amend`. Options found in code:

1. **No squash command exists.** A search of all `*.rs` for "squash" finds nothing. The only mentions are docs: [system-design.md section 10.6](https://github.com/EpicGames/lore/blob/v0.10.1/docs/explanation/system-design.md#L1134) and [glossary.md "Squash"](https://github.com/EpicGames/lore/blob/v0.10.1/docs/glossary.md#L341), where it is a concept; the doc ends "Not all of these operations are fully implemented in the canonical implementation today ... some are still on the roadmap". [docs/roadmap.md](https://github.com/EpicGames/lore/blob/v0.10.1/docs/roadmap.md) lists no squash or history-rewrite item (themes: OSS/UEFN, VS Code plugin, scalable locking, VFS, links/layers, desktop client, Unreal plugin, web, edge, forks). Release notes through "Nightly" mention neither squash nor a files-capable amend.
2. **Reset + recommit** (plausible, not verified end to end). `lore branch reset <revision>` moves the local latest pointer to an earlier revision on the same branch; it **syncs the working tree** to that revision and refuses when anything is staged ([branch/reset.rs L100-L137, L204-L230](https://github.com/EpicGames/lore/blob/v0.10.1/lore-revision/src/branch/reset.rs#L100-L137); CLI [BranchResetArgs L395-L402](https://github.com/EpicGames/lore/blob/v0.10.1/lore-client/src/cli/commands/branch.rs#L395-L402)). Sync has a `forward_changes` option ("Keep local changes", [sync.rs L216-L221](https://github.com/EpicGames/lore/blob/v0.10.1/lore-revision/src/revision/sync.rs#L216-L221)), but `branch reset` builds `SyncOptions` with defaults (`forward_changes: false`), so squashing local-only commits by reset would revert the working files to the parent unless the changes are preserved otherwise **[guess]**. The abandoned local revisions would remain in the local store but be unreachable from the branch ([system-design 10.6](https://github.com/EpicGames/lore/blob/v0.10.1/docs/explanation/system-design.md#L1146-L1150)).
3. **Keep the work uncommitted until Commit & Push.** "Commit" (local) would then be a Scribe-side checkpoint, not a Lore revision. Lore has no mechanism for a staged revision that stays "open" across several commits beyond the ordinary staged state, so nothing in Lore itself saves the interim work.
4. **Accept two revisions.** Commit = `lore commit <msg>`; Commit & Push = `lore commit <msg>` then `lore branch push`. Each local commit becomes its own revision in the history. This is the only option that uses documented, ordinary commands with no unverified behaviour.
5. **Message-only amend still has a use**: let the user edit the message of the latest unpushed revision at Commit & Push time (`revision amend`), while file changes go in a normal `commit` first.

## Impact on issue #7

Issue #7's resolution says: the first local commit is a normal `commit`, each later Commit `amend`s it, and Commit & Push "stages the ticked files, amends them into that revision with the final message". `amend` only rewrites the message, so later Commits cannot add files. The amend chain does not work as written, and the decision needs replacing; its own closing line ("Revisit this amend-chain approach if Lore exposes squash") is where this lands, since squash does not exist at v0.10.1.

## Open items (not verified)

- Whether `branch reset` plus `sync --forward-changes` (or another path) can collapse local-only revisions while keeping the working tree.
- Server behaviour for a forced push of an amended already-pushed revision.
- Restore with uncommitted local changes.
- Whether `commit.rs` changes on `main` since v0.10.1 affect any of the above.
