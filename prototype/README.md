# PROTOTYPE: Scribe Modes side by side

Throwaway UI mockups for [How do Developer Mode and Artist Mode look side by side?](https://github.com/kreynes/Scribe/issues/10). In-memory mock data; nothing talks to Lore. Not production code.

```bash
npm --prefix prototype/ui install
npm --prefix prototype/ui run dev
```

URL parameters:
- `?variant=A|B|C`: A three-pane desktop, B status-first column, C file browser + team board
- `?mode=artist|developer`
- `?screen=onboarding|main|conflict`

The floating bar switches all three (← / → cycle variants) and can trigger the "Locked by Ana" warning and the expired sign-in banner. Right-click files, branches (hover the left edge for the branch pane) and history entries for context menus.
