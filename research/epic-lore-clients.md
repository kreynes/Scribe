# What Epic's existing Lore clients already offer

Research for [kreynes/Scribe#5](https://github.com/kreynes/Scribe/issues/5). Gathered 2026-10-14, against Lore v0.10.1 and the nightly release notes. I did not download or run any binaries. Everything below comes from public docs, release notes, GitHub issues, and community threads, and I mark which statements are inferences.

## TL;DR

- **Lore Desktop** (Epic, closed source, binary only) is an early, developer-shaped client. It can list repositories on a server, add a local repository, sign in, and switch branches. As of v0.10.0 it **cannot show what changed in a revision or diff two revisions**. That is the most-requested gap. Epic publishes no feature docs, screenshots, or changelog for it. It is mostly known through bug reports. Epic plans to open-source it in 2027, after removing a dependency on Epic's internal design system.
- **The general VS Code plugin** is on the 2026 roadmap as "In progress" but has not been published. No repository or Marketplace listing exists yet. A separate, shipping **UEFN Lore extension for VS Code** already exists for Verse files. It offers a Source Control panel, Branch History, File History, a side-by-side diff, and a "Create Revision" button. It cannot sync; you have to sync in UEFN.
- **UEFN's built-in Lore / Unreal Revision Control** is Epic's real artist-facing UX, and the strongest prior art. Checkout happens automatically when you edit (that is the lock). Auto Revert undoes your edit if a teammate holds the file. There are two buttons ("Sync Latest" / "At Latest" and "Check-in Changes"), lock badges on thumbnails, and a "pick a version" conflict screen. It handles Unreal-native assets only, with no Blender or Photoshop history.
- **How each treats artists vs developers:** Epic has no artist-specific mode anywhere. The OSS clients are generic and developer-shaped. Artist friendliness exists only inside UEFN, and is planned for the Unreal Editor plugin (2027, shipping inside the engine). The only competitor openly targeting artists is **Anchorpoint for Lore** (a third-party desktop client with previews of 3D, audio, and images, visual review, and one-click submit).
- **Where Scribe's Artist Mode can genuinely differ:** take UEFN's "edit = lock, two buttons, thumbnails" model out of the engine and apply it to any file type (Blender, Photoshop, Substance, audio). Add a "who has what" lock view. Use lock-denial messages that tell the user what to sync, in Artist Mode wording, built on the approved successor-locks LEP. Default to a partial "just my files" view, in the style of Gluon. Show visual history and diffs (thumbnails, side-by-side images) on day one, since that is exactly Lore Desktop's biggest gap.

## 1. Lore Desktop (Epic, closed source)

### What's public

- **Status and distribution.** Lore Desktop is shipped as installers from `releases.lore.org/desktop/releases/stable/` for Windows, macOS arm64, Ubuntu 24.04 `.deb`, and AppImage. Every GitHub release says it is "available as binaries only" ([v0.10.1 release](https://github.com/EpicGames/lore/releases/tag/v0.10.1)). The FAQ says it depends on proprietary components, including Epic's internal design system, and that everything it does is also reachable via the CLI and API ([FAQ](https://epicgames.github.io/lore/faq/)).
- **Roadmap.** "Desktop client: 2027, In progress". The goal is to *open-source* the existing client, not to build a new one ([roadmap](https://epicgames.github.io/lore/roadmap/); confirmed by maintainers in [lore#6](https://github.com/EpicGames/lore/issues/6)).
- **No feature docs.** The docs tree has no Desktop tutorial or reference. The quickstart is CLI-only. There is no Desktop changelog: its version numbers (0.8.301, 0.8.5, 0.9.3, 0.10.0) roughly follow the CLI, but [lore#105](https://github.com/EpicGames/lore/issues/105) shows Desktop releases don't always ship alongside CLI releases.
- **UEFN projects can't be opened** in Lore Desktop yet, because UEFN uses Oodle compression and OSS Lore uses Zstd. Migration is in progress ([FAQ](https://epicgames.github.io/lore/faq/), [roadmap](https://epicgames.github.io/lore/roadmap/)).

### Features I could infer from issue reports

| Capability | Evidence |
| --- | --- |
| List repositories on a server, with a refresh button | [lore#113](https://github.com/EpicGames/lore/issues/113) (repository appears only after you press refresh) |
| Add a server/repository by `lore://` URL | [lore#142](https://github.com/EpicGames/lore/issues/142) (URL parsing bug) |
| "Add an existing local repository" | [lore#217](https://github.com/EpicGames/lore/issues/217) |
| Interactive sign-in (browser flow) | [lore#217](https://github.com/EpicGames/lore/issues/217) logs show `authLocalUserInfo` / `authLoginInteractive` calls |
| Switch branches from a title-bar dropdown and a Branches pane | [lore#144](https://github.com/EpicGames/lore/issues/144) |
| Repository status and revision info, plus watching the working tree for changes | [lore#217](https://github.com/EpicGames/lore/issues/217) logs (`repositoryStatus`, `revisionInfo`, "Watching repository") |
| Auto-update (unreliable) | [lore#105](https://github.com/EpicGames/lore/issues/105) |
| **No** view of the files changed in a revision | [lore#229](https://github.com/EpicGames/lore/issues/229) (v0.10.0, open) |
| **No** diff between two revisions ("planned for an upcoming update") | [lore#8](https://github.com/EpicGames/lore/issues/8), with a maintainer reply pointing to `lore diff --source --target` |

**Architecture (inference):** the logs mention `main.log`, `Invoke into Lore (...)` IPC calls, and a `redux_state` in `%APPDATA%\lore-desktop\app_state.db` ([lore#217](https://github.com/EpicGames/lore/issues/217)). Together with the AppImage/`Setup.exe` packaging, this strongly suggests an **Electron + React/Redux app calling Lore through the napi-rs JS bindings**. [ADR-00009](https://github.com/EpicGames/lore/blob/main/docs/developing/decisions/00009-lore-library-js-bindings.md) picked napi-rs in 2024 for the VS Code plugin and "future Electron applications". So the bindings Scribe would need exist and are battle-tested by Epic's own client. Scribe, being Tauri, would instead reach Lore through the Rust crate or the C API.

### Complaints and gaps raised

- **No diff or changed-files view** ([#8](https://github.com/EpicGames/lore/issues/8), [#229](https://github.com/EpicGames/lore/issues/229)). This is the most basic history feature, and it is still missing after 4 months.
- **Reliability regressions against the CLI.** Branch switching fails in the GUI but works in the CLI ([#144](https://github.com/EpicGames/lore/issues/144)). Desktop 0.10.0 aborts "add repository" on unauthenticated LAN servers that the CLI handles fine ([#217](https://github.com/EpicGames/lore/issues/217)). URL parsing is broken ([#142](https://github.com/EpicGames/lore/issues/142)). Repositories don't show until a manual refresh ([#113](https://github.com/EpicGames/lore/issues/113)). Auto-update is broken ([#105](https://github.com/EpicGames/lore/issues/105)). The recurring theme is that the GUI takes its own path through auth and sync and falls behind the CLI.
- **Closed source despite "fully open source" marketing.** This was the top criticism in the [Hacker News launch thread](https://news.ycombinator.com/item?id=48571081) ([subthread](https://news.ycombinator.com/item?id=48571674)).
- **Users want an artist-friendly app.** [lore#175](https://github.com/EpicGames/lore/issues/175) asks for something like GitHub Desktop but "user friendly. And artist friendly". A member replied that "plenty of lore clients [are] being made", which tells us Epic isn't gatekeeping third-party clients.

## 2. VS Code plugin(s)

### General Lore VS Code plugin (roadmap, unreleased)

- Roadmap: "VS Code plugin: 2026, In progress". It aims to surface CLI/API operations visually so that "version control [is] discoverable instead of something you have to memorize". The plugin and its source are to ship as a separate repository ([roadmap](https://epicgames.github.io/lore/roadmap/); [lore#80](https://github.com/EpicGames/lore/issues/80)).
- As of 2026-10-14, the [EpicGames org](https://github.com/EpicGames) has no `lore-vscode` repository, only `lore`, `lore-js`, `lore-python`, `lore-dotnet`, and `lore-go`. I found no Marketplace listing either.
- Its target audience is explicitly **developers** ("an editor many developers already use").
- Epic said Visual Studio and JetBrains are not on its roadmap. Community work is welcome: Mads Kristensen's [LoreVS](https://www.madskristensen.net/blog/lore-for-visual-studio-source-control-without-leaving-the-ide/) for Visual Studio 2026 ([lore#91](https://github.com/EpicGames/lore/issues/91), [lore#80](https://github.com/EpicGames/lore/issues/80)). LoreVS is a useful reference for the scope of a developer client. It has a Changes window with tri-state folder checkboxes, commit or commit-and-push, amend, and discard. It also has a paged History with per-file diffs, branch create, switch, and merge with a 3-way merge editor, `.loreignore` "Ignore and Untrack", and sign-in in the browser only when an operation needs it.

### UEFN's Lore extension for VS Code (shipping)

From [Lore version control extensions in UEFN](https://dev.epicgames.com/documentation/fortnite/lore-version-control-extensions-in-unreal-editor-for-fortnite):

- It is installed by default alongside UEFN and covers Verse files only.
- **Source Control** panel: uncommitted Verse changes marked M/A/D. Clicking a file opens a side-by-side diff of the synced and local versions.
- **Branch History** panel (revision history) and **File History** (open older versions read-only in a new tab, so you can't overwrite current work).
- Changed lines are highlighted in the editor and Explorer.
- **Create Revision** opens UEFN's Submit window (Changelist Description, then Submit).
- **Can't sync from VS Code**; you must sync in UEFN. If you edit Verse without syncing first, you can get conflicts, and Verse conflicts don't show thumbnails ([URC docs](https://dev.epicgames.com/documentation/uefn/unreal-revision-control-in-unreal-editor-for-fortnite)).

## 3. UEFN built-in Lore / "Unreal Revision Control": artist-facing prior art

From [Lore version control in UEFN](https://dev.epicgames.com/documentation/fortnite/lore-version-control-in-unreal-editor-for-fortnite), [Unreal Revision Control in UEFN](https://dev.epicgames.com/documentation/uefn/unreal-revision-control-in-unreal-editor-for-fortnite) and the [conflicts page](https://dev.epicgames.com/documentation/fortnite/conflicts-in-unreal-revision-control-in-unreal-editor-for-fortnite):

- **Three status-bar controls**: a revision-control indicator (green check), **Sync Latest / At Latest**, and **Check-in Changes / No Changes**. Each button's label doubles as its state.
- **Auto Checkout** (on by default): editing or moving an asset checks it out to you, which locks it. **Auto Revert**: if a teammate has the asset checked out, your edit is undone and you see a warning. The lock happens implicitly, so users never think "lock" as a separate step.
- **Visual status**: icons in the Outliner, a red check on assets you have checked out, a different icon for teammates' checkouts, and a download badge on the project thumbnail when there is something to sync.
- **Check-in window**: lists changed assets with icons, requires a description, has a "Keep files checked out" option, and lets you revert individual assets.
- **History and rewind**: per-asset and project history, a Branch History tab, and syncing to an earlier revision through a "Rewind" icon.
- **Conflicts** surface as a popup during sync, check-in, or merge. The Conflict Resolution tab is a binary choice of which version becomes current, which creates a new revision.
- **Vocabulary is Perforce-flavoured** (check out, check in, changelist description), while OSS Lore docs deliberately ban Perforce-isms ("changelist", "submit") and Git-isms ([language.md](https://github.com/EpicGames/lore/blob/main/docs/developing/doc-standards/canon/language.md), [Vale rules](https://github.com/EpicGames/lore/blob/main/docs/developing/doc-standards/tools/vale/styles/Lore/PerforceIsmSubstitutions.yml)). So Epic already uses different words for artists (UEFN) and for engineers (OSS docs).
- **Limitations**: only Unreal-native assets are versioned (no Blender or Photoshop history). You can't edit a checked-out asset at all. Auto Revert discards edits. Forum users report confusing "assets expired" reverts when editing older revisions ([forum](https://forums.unrealengine.com/t/i-am-experiencing-an-issue-with-unreal-revision-control-in-uefn/2740078)).
- **Future:** the Unreal Editor plugin (2027) builds on the UEFN plugin and will ship inside the engine. Epic pitches it so "artists who never touch a terminal can manage it themselves" ([roadmap](https://epicgames.github.io/lore/roadmap/)). **This is Epic's artist story: in-engine, not desktop.**

## 4. How Lore's own model treats artists

- **Locks are advisory today** ("informs rather than enforces") and are queried globally ([FAQ](https://epicgames.github.io/lore/faq/)). Scalable, enforced locking is a 2026 roadmap item, and the roadmap calls it "foundational for large art teams".
- The approved **successor-locks LEP** ([2026-06-19](https://github.com/EpicGames/lore/blob/main/docs/proposals/2026-06-19-successor-locks-unmergeable-files.md)) adds causal locks. You can only lock an unmergeable file from a branch that already contains every prior edit in its *scope*. Server-side enforcement is strict or advisory by policy. Denials are meant to be actionable ("names the revision, branch, and scope"). **Auto-acquired locks on file open are explicitly deferred to a future LEP**, which leaves clients room to design that UX.
- **Binary conflicts** are a "choose which version" decision, with no merging ([FAQ](https://epicgames.github.io/lore/faq/)). That is the same as UEFN's Conflict Resolution tab.
- **View filters** (per-instance partial working trees, changeable in place with `lore sync --view`, added in v0.10.1) and the planned **VFS** are the building blocks for a Gluon-like "only my files" workspace ([release notes](https://github.com/EpicGames/lore/blob/main/docs/release-notes.md), [language.md](https://github.com/EpicGames/lore/blob/main/docs/developing/doc-standards/canon/language.md)).
- **Moves and renames must be recorded explicitly** (`lore stage move`), which HN commenters flagged as fragile when outside tools move files ([HN](https://news.ycombinator.com/item?id=48571081)). An artist client has to detect moves itself or nudge the user.

## 5. Brief comparison: P4V and Plastic / Unity VCS Gluon

- **Perforce P4V**: artists work on a single mainline. You check out a file (with exclusive `+l` file types set via `p4 typemap`, or `p4 lock`), edit, and submit a changelist ([Perforce: preventing multiple checkouts](https://perforce.com/manuals/p4guide/Content/P4Guide/resolve.lock.exclusive.html)). It's the industry default. HN commenters say artists learn it fast but dislike it, and that it leans heavily on editor plugins ([HN](https://news.ycombinator.com/item?id=48571081)). Perforce now markets **P4 One** as a lighter, artist-friendly client with exclusive locking and file-type support for creative tools ([P4 One](https://www.perforce.com/products/helix-core/p4-one)). Known pitfall: paired files (for example Unity `.meta`) not being locked together ([Unity issue](https://issuetracker-mig.prd.it.unity3d.com/issues/locking-a-file-for-opening-exclusively-through-p4v-doesnt-lock-the-meta-file-with-it)).
- **Plastic / Unity VCS Gluon**: a **separate simplified app for artists**. You pick the files you want (a partial workspace), lock them, and check in without updating the whole workspace, normally on `main`. Developers use the full Plastic GUI with branches ([Plastic blog](https://blog.plasticscm.com/2015/03/plastic-gluon-is-out-version-control.html), [Unity docs](https://docs.unity3d.com/Packages/com.unity.collab-proxy@1.7/manual/ExistingPlasticRepo.html)). Its recurring pain is the seam between the two modes: switching branches forces a full update and breaks the partial workspace, and moving to the full GUI requires "full mode" ([forum](https://forum.plasticscm.com/topic/23436-working-with-branches-in-partial-mode/), [forum](https://forum.plasticscm.com/topic/20140-gluon-conceptually-incompatible-with-branch-per-task-how-can-devs-and-artists-work-together-then/)).
- **Lesson for Scribe**: Gluon proves that "two presentations over one VCS" works. It also shows that the hard part is the **seam**: what happens to an artist's partial workspace and locks when they touch branches, or when a developer hands them a branch. Scribe's two Modes run in one app over one working tree, which can avoid Gluon's split-app problem, but only if Artist Mode has a defined answer for branches.

## 6. Where Scribe's Artist Mode could genuinely differ

Ordered roughly by how distinct each idea is from what already exists:

1. **UEFN-style "edit means lock" outside the engine, for any file type.** Use a file watcher with an auto-lock prompt on first modification of a lockable file. Add an Auto Revert equivalent, or better a "this file is locked by Alex, save a copy?" offer. UEFN only covers Unreal-native assets, and Lore Desktop and Anchorpoint don't advertise anything like this. The successor-locks LEP leaves auto-acquire UX to clients.
2. **Actionable lock and causality messages in plain language**, built on the LEP's denial payload (revision, branch, scope). For example: "Someone updated this file after your copy. Get latest, then try again." Add a team-wide "who's working on what" lock board.
3. **Visual history and diff first.** Lore Desktop can't show changed files or diffs ([#8](https://github.com/EpicGames/lore/issues/8), [#229](https://github.com/EpicGames/lore/issues/229)). Artist Mode can lead with thumbnail timelines and image side-by-side or onion-skin views. This is Anchorpoint's pitch too, so it's table stakes for an artist client rather than a differentiator against them.
4. **A partial "my files" workspace by default**, via view filters now and VFS later. It should be a Gluon-like file picker that survives branch changes, avoiding Gluon's known seam.
5. **Two-button surface with state-as-label** (Get latest / Up to date, Share changes / Nothing to share), following UEFN's pattern. Branches stay hidden or reduced to "workspaces assigned to me" in Artist Mode, with all detail kept in Developer Mode.
6. **Vocabulary layer.** Use artist words in Artist Mode and Lore-native words in Developer Mode ("revision", "stage", "sync", "view filter"), matching Epic's own split between UEFN and OSS docs.
7. **Robustness as a feature.** Lore Desktop's bugs mostly come from the GUI drifting from CLI behaviour, around auth on unauthenticated servers, branch switching, and refresh. Scribe should drive the same library code paths as the CLI and treat "works wherever the CLI works" as a requirement.
8. **Open source and Tauri.** Scribe would be open source today, while Lore Desktop is closed until 2027, and Tauri is lighter than Electron (the inferred stack). This is a modest differentiator with a shelf life: when Epic open-sources Desktop, Scribe's edge has to be Artist Mode itself.

## Open uncertainties

- **Lore Desktop's real feature set is unverified.** No docs or screenshots exist, and I didn't install it. Locking UI, commit and stage UI, history view, and merge/conflict UI are all unknown. Someone could inspect it hands-on, without redistributing anything, to settle this.
- **The "Electron + Redux + napi-rs" stack is an inference** from log and file names in [lore#217](https://github.com/EpicGames/lore/issues/217).
- **VS Code plugin scope and timing are unknown.** It's "In progress" for 2026 with no public repo. ADR-00009 (2024) says it was the first consumer of the JS bindings, so a prototype existed internally for a long time.
- **Discord** (`#feature-requests`, `#show-and-tell`), where most community feedback reportedly lives, was not reviewed because it isn't publicly indexable.
- I couldn't fetch the body of UEFN's revision history and conflict resolution page. The conflict-UX details above come from search-result summaries of the URC docs.
- **Anchorpoint for Lore**'s actual locking support for Lore is unclear: its Lore page doesn't mention locking ([anchorpoint.app/lore](https://www.anchorpoint.app/lore), [announcement](https://www.anchorpoint.app/blog/announcing-anchorpoint-for-lore)).
- I didn't find Reddit threads specifically about artists' reactions to Lore. The HN discussion is the main community source.

## Sources

- Lore repo and docs: [README](https://github.com/EpicGames/lore), [FAQ](https://epicgames.github.io/lore/faq/), [roadmap](https://epicgames.github.io/lore/roadmap/), [release notes](https://github.com/EpicGames/lore/blob/main/docs/release-notes.md), [releases](https://github.com/EpicGames/lore/releases), [ADR-00009 JS bindings](https://github.com/EpicGames/lore/blob/main/docs/developing/decisions/00009-lore-library-js-bindings.md), [successor-locks LEP](https://github.com/EpicGames/lore/blob/main/docs/proposals/2026-06-19-successor-locks-unmergeable-files.md), [language.md vocabulary](https://github.com/EpicGames/lore/blob/main/docs/developing/doc-standards/canon/language.md)
- Lore issues: [#6](https://github.com/EpicGames/lore/issues/6), [#8](https://github.com/EpicGames/lore/issues/8), [#80](https://github.com/EpicGames/lore/issues/80), [#91](https://github.com/EpicGames/lore/issues/91), [#105](https://github.com/EpicGames/lore/issues/105), [#113](https://github.com/EpicGames/lore/issues/113), [#142](https://github.com/EpicGames/lore/issues/142), [#144](https://github.com/EpicGames/lore/issues/144), [#175](https://github.com/EpicGames/lore/issues/175), [#217](https://github.com/EpicGames/lore/issues/217), [#229](https://github.com/EpicGames/lore/issues/229)
- UEFN: [Lore version control in UEFN](https://dev.epicgames.com/documentation/fortnite/lore-version-control-in-unreal-editor-for-fortnite), [Lore VS Code extension in UEFN](https://dev.epicgames.com/documentation/fortnite/lore-version-control-extensions-in-unreal-editor-for-fortnite), [Unreal Revision Control in UEFN](https://dev.epicgames.com/documentation/uefn/unreal-revision-control-in-unreal-editor-for-fortnite), [conflicts](https://dev.epicgames.com/documentation/fortnite/conflicts-in-unreal-revision-control-in-unreal-editor-for-fortnite)
- Community: [HN launch thread](https://news.ycombinator.com/item?id=48571081), [HN closed-client subthread](https://news.ycombinator.com/item?id=48571674), [Asawicki first look](https://asawicki.info/news_1803_first_look_at_epic_games_lore_vcs), [LoreVS](https://www.madskristensen.net/blog/lore-for-visual-studio-source-control-without-leaving-the-ide/), [Anchorpoint for Lore](https://www.anchorpoint.app/blog/announcing-anchorpoint-for-lore)
- Prior art: [Perforce exclusive locking](https://perforce.com/manuals/p4guide/Content/P4Guide/resolve.lock.exclusive.html), [P4 One](https://www.perforce.com/products/helix-core/p4-one), [Plastic Gluon announcement](https://blog.plasticscm.com/2015/03/plastic-gluon-is-out-version-control.html), [Unity VCS docs](https://docs.unity3d.com/Packages/com.unity.collab-proxy@1.7/manual/ExistingPlasticRepo.html), [Plastic forum: partial mode and branches](https://forum.plasticscm.com/topic/23436-working-with-branches-in-partial-mode/), [Plastic forum: Gluon vs branch-per-task](https://forum.plasticscm.com/topic/20140-gluon-conceptually-incompatible-with-branch-per-task-how-can-devs-and-artists-work-together-then/)
