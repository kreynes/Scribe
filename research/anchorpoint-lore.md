# What does Anchorpoint for Lore offer artists?

Resolves kreynes/Scribe#11 (part of #2). Researched 2026-10-14 from Anchorpoint's own site and docs, plus the Lore repo and roadmap. No binaries were downloaded or run. No independent user reviews turned up; everything below is first-party (vendor) material.

## TL;DR

- **What it is:** Anchorpoint for Lore is a standalone desktop client released 21 Sep 2026. It is a rewrite on a new stack and will become the base of Anchorpoint 2.0, which adds Git back in (alpha "in the coming month", full 2.0 in H1 2027). It is built on Lore 0.10 and works with any Lore server, or a local repo. [R1][R2][D1]
- **What it covers:** submit/commit/push/sync, revision history with undo/checkout/restore, trunk-based branching with read-only branch preview, strong visual previews and diffs (images, 3D, video, audio, documents, code, metadata), and a guided conflict resolver. It also has a built-in console with the bundled `lore` CLI. [D1–D5]
- **What it doesn't cover yet:** file locking (none of the Lore docs mention it), selective/partial checkout, metadata management, DCC or Unreal integration, and Lore's layered repositories and repository links. [D1–D5][R1][R2]
- **Cost:** the client is free, "always" when used with your own Lore servers. Paid offerings are managed Lore hosting (sales-led, priced on usage, no per-seat fee) and planned team subscriptions. For reference, the Git product costs €25/user/month (Team). [L1][R1][H1][P1]
- **Platforms:** Windows; macOS on Apple silicon only; Linux AppImage x86_64. The site contradicts itself on this (see Uncertainties). [DL1]
- **Room for Scribe:** Anchorpoint is review- and preview-first, but it still teaches VCS concepts. Its docs say users still need version-control concepts and comfort with a CLI. Locking, a who's-editing-what view, and a "my files" scoped workspace are all absent for Lore today, and those are exactly Scribe's candidate Artist Mode differentiators.

## Workflows covered

| Area | What Anchorpoint for Lore does | Source |
|---|---|---|
| Commit/submit | Changed files list with checkboxes. **Submit** does commit, sync and push in one click (Ctrl+Return). **Commit** makes a local checkpoint only. **Revert** cannot be undone. A setting controls whether Submit auto-syncs first. | [D5] |
| History | **Revisions** page with filter (by message, author or id). **Undo Revision** (non-destructive: it creates a commit), **Checkout Revision** (destructive, current branch only), and per-file **Restore** with Overwrite or Keep original. | [D5] |
| Branches | Trunk-based: short-lived branches off `main`. Branch overview with status icons. You can **preview** another branch read-only (turquoise eye icon) without switching. Publish, merge and delete are supported. You can't switch branches with dirty files. "Change request" review is mentioned as the Lore concept before merge. | [D3] |
| Previews/review | Space for quick look, plus a sidebar or overlay viewer. Compare modes: slider, side-by-side, unified/split for text. A **Before/After** metadata diff shows, for example, poly count and video length. Per-format tools include camera sync, playback sync and "Highlight changes". You can compare any two files of the same type. Custom thumbnails are supported. | [D2] |
| Conflicts | A "Merge conflicts detected" message, then **Resolve conflicts**. Per-file red/green state. For binaries: mine, theirs and result side by side, with **Take mine** / **Take other** (and "take all" variants). For text: Accept Current/Incoming/Both. The docs stress that "nothing is lost" because both versions stay in history. If you have local edits to a file that changed upstream, sync stops and you must move your work to a branch first. | [D4] |
| Locking | **Not present for Lore.** Anchorpoint's Git product auto-locks on modify, makes others' copies read-only, has a locks page with owners and admin release, and shows lock status in Unreal/Unity content browsers. None of that is documented for the Lore client. Lore itself has (advisory) lock RPCs and CLI commands. | [F1][LR1][LR2] |
| Partial workspace | Not documented. Selective checkout is a Team-plan feature of the Git product only. | [P1][D1] |
| Power-user escape hatch | Built-in console (Ctrl+J) with the bundled, version-matched `lore` CLI, plus a background activity Log tab. | [D5] |

## How it presents to non-technical users

- **Tone:** visual-first. Files are browsed like a file manager, with thumbnails, and review happens before merge. The marketing emphasises "clear guidance for non developers" on conflicts and says onboarding takes one click. [L1]
- **Vocabulary is still VCS vocabulary:** commit, push, sync, branch, checkout, publish, merge, revision. The UI relies on plain button labels and status icons rather than renaming the concepts. The quick start says it makes concepts "more approachable rather than hiding them" and that users still need comfort with a CLI. [D1][D3]
- **Reassurance patterns worth noting:** "nothing is lost" messaging, "Take mine" flagged as the safest choice, non-destructive Undo Revision, and Keep original on restore. [D4][D5]
- **Sharp edges a novice still hits:** sync blocked by local changes (with "move to a branch" as the fix), no branch switching while dirty, irreversible Revert, and destructive Checkout Revision. [D3][D5]

## Cost and platforms

- **Client:** free. The site says it will always be free with your existing Lore servers. The download page also mentions a "free 14-day trial" wording, which contradicts that. [R1][L1][DL1]
- **Lore hosting:** managed by Anchorpoint (in Anchorpoint cloud, a dedicated AWS environment, or self-hosted). No per-user fee, priced by project size and usage via sales. The FAQ notes Lore is pre-1.0 with updates every two weeks. [H1]
- **Git product, for reference:** Personal is free (non-commercial). Team is €25/user/month or €240/year, and includes locking and selective checkout. Organization pricing is custom. Indie developers get 50% off. Lore is not listed under any plan. [P1]
- **Platforms:** Windows (Setup.exe), macOS (Apple-silicon .dmg only) and Linux (x86_64 AppImage), with a download of about 75 MB. [DL1]

## Where Scribe's Artist Mode can differ

Each item is mapped to the earlier candidate differentiators from #5:

1. **Out-of-engine auto-lock for any file type:** open lane. Anchorpoint has this for Git, but not (yet) for Lore. Lore's locking is advisory, and enforcement is on Epic's 2026 roadmap. Expect Anchorpoint to port its Git auto-lock once Lore enforcement lands, so the window may be short. [F1][LR2]
2. **Plain-language locks / who's-editing-what board:** open lane for Lore today. Anchorpoint's Git "locks page" is the closest analogue and is a list view, not an activity board. [F1]
3. **History/diff up front:** Anchorpoint is strong here. Visual compare and metadata diff are its headline features. Scribe should treat this as table stakes rather than a differentiator, unless it goes further (for example, a timeline per asset or "what changed since I last looked"). [D2]
4. **Partial "my files" workspace:** open lane. Nothing is documented for Lore. It depends on Lore's sparse/VFS work, which is on the 2026 roadmap. [LR2]
5. **Hide VCS vocabulary entirely:** Anchorpoint keeps commit/push/sync/branch and accepts that users need concepts and a CLI. An Artist Mode that speaks in "save to team" and "get latest" terms, and hides branches and the console, is a real positioning gap. Developer Mode, meanwhile, overlaps Anchorpoint's console and branch UI.
6. **Open source:** Anchorpoint for Lore is closed. Epic's own desktop client is slated to go open source in 2027 [LR2], which would affect Scribe's positioning more than Anchorpoint does.

## Open uncertainties

- **Locking roadmap:** does Anchorpoint for Lore plan to add locking, or is it just undocumented? No changelog entry or docs mention it. The `/releases` page only covers the 1.x Git app. [R3]
- **Platforms:** the download page lists Linux and macOS builds, yet its own text says "Windows or macOS only" and "macOS and Linux coming soon". Unverified without running the builds. [DL1]
- **Free vs trial:** the client is "free" in the FAQ and blog but has "14-day trial" wording on the download page. Which features any future team subscription will gate is unstated. [DL1][L1]
- **Review/approval:** the branching docs mention Lore "change requests" before merge, but don't describe a full approval UI. [D3]
- **No independent user feedback:** searches found only vendor pages. Anchorpoint's Discord is where real feedback would be, and it was not read.
- **Lore version coupling:** the client is built on Lore 0.10. How it tracks Lore's two-week release cadence and compatibility is unknown. [D1][H1]

## Sources

- [L1] Anchorpoint for Lore product page: https://www.anchorpoint.app/lore
- [R1] "Releasing Anchorpoint for Lore" (21 Sep 2026): https://www.anchorpoint.app/blog/releasing-anchorpoint-for-lore
- [R2] "The way to Anchorpoint 2.0" (23 Sep 2026): https://www.anchorpoint.app/blog/the-way-to-anchorpoint-2-0
- [R3] Anchorpoint releases/changelog: https://www.anchorpoint.app/releases
- [A1] "Announcing Anchorpoint for Lore" (17 Jun 2026): https://www.anchorpoint.app/blog/announcing-anchorpoint-for-lore
- [DL1] Lore client download page: https://www.anchorpoint.app/lore/download
- [H1] Lore hosting: https://www.anchorpoint.app/lore-hosting
- [P1] Pricing: https://www.anchorpoint.app/pricing
- [F1] File locking (Git product): https://www.anchorpoint.app/features/file-locking
- [D1] Docs, Lore quick start: https://docs.anchorpoint.app/lore/quick-start/
- [D2] Docs, Reviews: https://docs.anchorpoint.app/lore/reviews/
- [D3] Docs, Branching: https://docs.anchorpoint.app/lore/branching/
- [D4] Docs, Resolving conflicts: https://docs.anchorpoint.app/lore/resolving-conflicts/
- [D5] Docs, Settings and commands: https://docs.anchorpoint.app/lore/settings-and-commands/
- [LR1] Lore source, lock CLI/RPC (e.g. `lore-client/src/cli/commands/lock.rs`, `lore-proto/proto/lock.proto`): https://github.com/EpicGames/lore
- [LR2] Lore roadmap (advisory to enforced locking, VFS, open-source desktop client): https://epicgames.github.io/lore/roadmap/
