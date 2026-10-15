// PROTOTYPE: in-memory mock state for the Scribe Mode mockups. Nothing here talks to Lore.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

export type Mode = "artist" | "developer"
export type Screen = "onboarding" | "main" | "conflict"

/** Lore keys locks by branch (`lock acquire --branch`). No branch means the lock was taken on main. */
export type LockState = { by: string; branch?: string } | null

export type FileEntry = {
  path: string
  kind: "image" | "model" | "audio" | "scene" | "text"
  change: "modified" | "added" | "deleted" | null
  staged: boolean
  ticked: boolean
  lock: LockState
  size: string
}

export type Revision = {
  id: string
  /** The summary line. Lore stores one message; Scribe writes it as summary, blank line, description. */
  message: string
  description?: string
  author: string
  when: string
  files: number
  /** Not pushed yet: a local Commit. */
  local?: boolean
  /** Files a local Commit changed, so pushing it can release their Locks. */
  paths?: string[]
}

/** What the commit boxes collect. Both parts are required. */
export type CommitMsg = { summary: string; description: string }
export const EMPTY_MSG: CommitMsg = { summary: "", description: "" }
export const msgReady = (m: CommitMsg) => !!m.summary.trim() && !!m.description.trim()
/** How the message reaches `lore commit`: one string, summary then a blank line then the description. */
export const cliMsg = (m: CommitMsg) => `"${m.summary.trim() || "<summary>"}\\n\\n${m.description.trim() || "<description>"}"`

/** Mock descriptions, keyed by revision id. */
export const DESCRIPTIONS: Record<string, string> = {
  "9f3c2a1e": "Rebaked the forest lightmaps after the new sun angle. Fog density down 15%, bounce light up on the moss.",
  "4b81d0c7": "Third pass on the villain's textures: sharper armour edges, less saturated cape, roughness fixed on the gloves.",
  "e02a77f5": "First blockout of the new hero sculpt. Proportions only; no detail pass yet.",
  "71cc9b20": "Imported Sam's footstep library: grass, stone, wood and metal, 4 variations each.",
  "a41f7c09": "Added facial controls to the hero rig: brows, jaw, lip corners. Weights still rough around the mouth.",
  "5d0b8e44": "Brings the environment pass into main: rock and moss textures plus forest tile set 03.",
  "f7e2a913": "New rock albedo and normal maps, moss blend material, tiling fixed on the large boulders.",
  "0be93d6f": "Takes Sam's crash fix into the 1.2 release candidate.",
  "93c7f05b": "forest.umap crashed on load when its textures hadn't streamed in yet. The level now waits for them.",
  "2c6d1b70": "Third forest tile set: ferns, roots and the path edges.",
  "1f84c2ad": "Branch for the hero rework: new sculpt, rig and materials.",
  "6a1e40d2": "Version bump and changelog for the 1.2 candidate build.",
  "d1e4b6a0": "Six gravel footstep variations to break up repetition on the castle path.",
  "e8b5a6c1": "Blockout for the environment pass: terrain, rough rocks and placeholder trees.",
  "8c72fe31": "Front, side and back turnaround of the hero for the modelling team.",
  "3a90f1b2": "Folder structure, project settings and starter content for the vertical slice.",
  "b07a9d52": "Grey placeholder icons for the inventory and pause menus until the UI pass.",
  "c55d0e7a": "First import of the project from the old repository.",
  "5d0e8f21": "Warmer colour on forest tile 03 so it matches the lighting pass, plus notes on the new export settings.",
}
export const descriptionOf = (r: { id: string; description?: string; message?: string }) =>
  r.description ?? DESCRIPTIONS[r.id] ?? (r.message ? `${r.message.split(":")[0]}: ${r.message.split(": ")[1] ?? "update"} for the character pass. Notes are in the review sheet.` : "")

export type Teammate = { name: string; initials: string; editing: string[]; online: boolean }

export const BRANCHES = [
  "main", "release/1.2", "release/1.1", "feature/new-hero", "feature/inventory-ui", "feature/dialogue-system",
  "feature/save-system", "art/env-pass", "art/character-pass-2", "art/ui-icons", "bugfix/crash-on-load", "experiment/new-lighting",
]

/** A branch removed with `lore branch archive`: its name is freed, its history kept, restorable by id. */
export type ArchivedBranch = { name: string; id: string; by: string; when: string }
const INITIAL_ARCHIVED: ArchivedBranch[] = [
  { name: "experiment/water-shader", id: "3f9c0a4e1b7d2c58e6a1f09b4d73c2e8", by: "Marco", when: "3 weeks ago" },
  { name: "feature/old-inventory", id: "a81e5d2c94f03b7612ce8d0a5f4b9e17", by: "Ana", when: "2 months ago" },
]
/** A short, stable branch id for the mock (Lore ids are 16 bytes, hex). */
export const branchId = (name: string) => { let h = 2166136261; for (const c of name) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return (h.toString(16).padStart(8, "0") + "d41c7e09b2a5f683").repeat(2).slice(0, 32) }

const INITIAL_FILES: FileEntry[] = [
  { path: "Art/Characters/hero.psd", kind: "image", change: "modified", staged: false, ticked: true, lock: { by: "you" }, size: "212 MB" },
  { path: "Art/Characters/hero_rig.blend", kind: "model", change: "modified", staged: false, ticked: true, lock: { by: "you" }, size: "88 MB" },
  { path: "Art/Env/forest_tile_03.png", kind: "image", change: "added", staged: false, ticked: true, lock: null, size: "14 MB" },
  { path: "Audio/footsteps_grass.wav", kind: "audio", change: "modified", staged: false, ticked: false, lock: { by: "you" }, size: "6 MB" },
  { path: "Docs/art-pipeline.md", kind: "text", change: "modified", staged: false, ticked: true, lock: null, size: "4 KB" },
]

export const PROJECT_TREE: FileEntry[] = [
  ...INITIAL_FILES,
  { path: "Art/Characters/villain.psd", kind: "image", change: null, staged: false, ticked: false, lock: { by: "Ana" }, size: "190 MB" },
  { path: "Art/Env/forest_tile_01.png", kind: "image", change: null, staged: false, ticked: false, lock: null, size: "13 MB" },
  { path: "Art/Env/forest_tile_02.png", kind: "image", change: null, staged: false, ticked: false, lock: null, size: "13 MB" },
  { path: "Levels/forest.umap", kind: "scene", change: null, staged: false, ticked: false, lock: { by: "Marco" }, size: "420 MB" },
  { path: "Audio/ambience_forest.wav", kind: "audio", change: null, staged: false, ticked: false, lock: null, size: "31 MB" },
  { path: "Art/Characters/hero_body.fbx", kind: "model", change: null, staged: false, ticked: false, lock: null, size: "54 MB" },
  { path: "Art/Env/rock_normal.tga", kind: "image", change: null, staged: false, ticked: false, lock: null, size: "22 MB" },
  { path: "Content/Characters/Hero.uasset", kind: "scene", change: null, staged: false, ticked: false, lock: { by: "Ana", branch: "art/character-pass-2" }, size: "18 MB" },
  { path: "Cinematics/intro.mp4", kind: "image", change: null, staged: false, ticked: false, lock: null, size: "640 MB" },
  { path: "Config/DefaultGame.ini", kind: "text", change: null, staged: false, ticked: false, lock: null, size: "3 KB" },
  { path: "Data/balance.csv", kind: "text", change: null, staged: false, ticked: false, lock: null, size: "41 KB" },
  { path: "Data/loot_tables.json", kind: "text", change: null, staged: false, ticked: false, lock: null, size: "12 KB" },
  { path: "Source/Game/PlayerController.cpp", kind: "text", change: null, staged: false, ticked: false, lock: null, size: "28 KB" },
  { path: "Tools/importer.ts", kind: "text", change: null, staged: false, ticked: false, lock: null, size: "9 KB" },
  { path: "UI/Fonts/Inter.ttf", kind: "text", change: null, staged: false, ticked: false, lock: null, size: "310 KB" },
  { path: "Builds/playtest_0912.zip", kind: "text", change: null, staged: false, ticked: false, lock: null, size: "2.1 GB" },
]

const INITIAL_HISTORY: Revision[] = [
  { id: "9f3c2a1e", message: "Forest lighting pass", author: "Marco", when: "2 hours ago", files: 12 },
  { id: "4b81d0c7", message: "Villain textures v3", author: "Ana", when: "yesterday", files: 4 },
  { id: "e02a77f5", message: "Hero sculpt blockout", author: "You", when: "yesterday", files: 2 },
  { id: "71cc9b20", message: "Import footstep library", author: "Sam", when: "3 days ago", files: 38 },
]

export const TEAM: Teammate[] = [
  { name: "Ana", initials: "AN", editing: ["Art/Characters/villain.psd"], online: true },
  { name: "Marco", initials: "MA", editing: ["Levels/forest.umap"], online: true },
  { name: "Sam", initials: "SA", editing: [], online: false },
]

export const LORE_LOG = [
  "[info] revision.sync: discovery complete, 0 files to update",
  "[info] lock.file_status: 3 held by you, 2 held by others",
  "[debug] notification.subscribe: connected to lore://studio.local:41337",
  "[info] repository.status: 5 dirty, 0 staged",
]

/** A revision on the server that this computer hasn't synced yet. It touches two files you have changed locally. */
export const INCOMING = { id: "5d0e8f21", message: "Forest tile colour fix, pipeline notes", description: DESCRIPTIONS["5d0e8f21"], author: "Marco", paths: ["Art/Env/forest_tile_03.png", "Docs/art-pipeline.md"], others: 9 }

/** Files a revision changed. Deterministic mock, shared by History, the diff viewer and the Revision menu. */
export function changedFilesFor(rev: Pick<Revision, "id" | "files">) {
  const seed = rev.id.charCodeAt(0) + rev.id.charCodeAt(1)
  return PROJECT_TREE.filter((_, i) => (i + seed) % 3 === 0).slice(0, Math.max(1, Math.min(rev.files, 4)))
}

const CHANGE_KINDS = ["modified", "modified", "added", "modified", "deleted"] as const
export type ChangedFile = FileEntry & { how: (typeof CHANGE_KINDS)[number] }
// Folders two levels deep, so Explorer keeps them collapsed until asked.
const SYNTH_DIRS: [string, FileEntry["kind"], string][] = [["Art/Env/Props", "image", "png"], ["Art/Characters/Textures", "image", "tga"], ["Content/Meshes/Props", "model", "fbx"], ["Audio/SFX/Foley", "audio", "wav"], ["Levels/Sublevels/Streaming", "scene", "umap"], ["Docs/Notes/Archive", "text", "md"]]
/** The rest of the project: bulk files that big commits (up to "Initial import") touched. Explorer lists them too. */
const SYNTH_FILES: FileEntry[] = Array.from({ length: 2048 }, (_, i) => {
  const [dir, kind, ext] = SYNTH_DIRS[i % SYNTH_DIRS.length]
  return { path: `${dir}/${dir.split("/").pop()!.toLowerCase()}_${String(i).padStart(4, "0")}.${ext}`, kind, change: null, staged: false, ticked: false, lock: null, size: `${1 + ((i * 7) % 40)} MB` }
})
/** Every file in the project: the hand-written ones and the bulk ones. */
export const PROJECT_FILES = [...PROJECT_TREE, ...SYNTH_FILES]
/** Every file a revision changed and how. Real project files come first (the same ones changedFilesFor picks); bulk files fill the rest. */
export function revisionFiles(rev: Pick<Revision, "id" | "files">): ChangedFile[] {
  const seed = rev.id.charCodeAt(0) + rev.id.charCodeAt(1)
  const real = PROJECT_TREE.filter((_, i) => (i + seed) % 3 === 0).slice(0, Math.max(1, Math.min(rev.files, 4)))
  // Hand-written files still exist, so they're never "deleted".
  const out: ChangedFile[] = real.map((f, i) => ({ ...f, how: CHANGE_KINDS[(i + seed) % 4] }))
  const start = (seed * 37) % SYNTH_FILES.length
  for (let i = out.length; i < rev.files; i++) out.push({ ...SYNTH_FILES[(start + i) % SYNTH_FILES.length], how: CHANGE_KINDS[(i + seed) % CHANGE_KINDS.length] })
  return out
}

/** Diff for one revision: the files it changed, compared with its parent. `path` is shown first. */
export const revisionDiff = (rev: Pick<Revision, "id" | "message" | "files">, path?: string): Extract<Flow, { kind: "diff" }> => {
  const paths = changedFilesFor(rev).map((f) => f.path)
  return { kind: "diff", paths: path ? [path, ...paths.filter((x) => x !== path)] : paths, revision: { id: rev.id, message: rev.message, files: rev.files } }
}

/** The whole project with this session's edits applied on top. */
export const allFiles = (files: FileEntry[]) => [...PROJECT_FILES.map((t) => files.find((f) => f.path === t.path) ?? t), ...files.filter((f) => !PROJECT_FILES.some((t) => t.path === f.path))]

/** Dialogs any screen can open. Rendered once by <Flows /> in flows.tsx. */
export type Flow =
  | { kind: "diff"; paths: string[]; revision?: Pick<Revision, "id" | "message" | "files">; conflict?: boolean; back?: Flow }
  | { kind: "merge"; branch: string; into: boolean }
  | { kind: "sync"; target?: string; reset?: boolean; preview?: boolean }
  | { kind: "switch"; branch: string; revision?: string }
  | { kind: "sync-conflict"; paths: string[] }
  | { kind: "release-lock"; path: string }
  | { kind: "archive-branch"; branch: string }
  | { kind: "restore-branch"; id: string }
  | { kind: "reset-branch"; branch: string; revisions: { id: string; label: string }[]; target?: string }
  | { kind: "locks" }
  | { kind: "commit-info"; revision: Revision & { at?: number }; branch: string }

/** "Take me there": a link in an information panel asks the main window to open the right place with this selected. */
export type NavTarget = { kind: "revision"; id: string; branch?: string } | { kind: "branch"; id: string } | { kind: "file"; id: string }

export type Resolution = "mine" | "theirs" | "manual"
/** What sent the user to the conflict screen. "demo" = the prototype switcher. */
export type ConflictCtx = { origin: "sync" | "merge" | "demo"; source?: string; paths?: string[]; noCommit?: boolean; message?: CommitMsg; push?: { sent: string[]; commits: number }; merged?: boolean }

export type SyncOpts = { target?: string; reset?: boolean }
export type SwitchOpts = { revision?: string; reset?: boolean; local?: boolean; force?: boolean; copy?: boolean }
export type ClashChoice = "merge" | "reset" | "forward" | "branch"

type Proto = {
  mode: Mode; setMode: (m: Mode) => void
  screen: Screen; setScreen: (s: Screen) => void
  branch: string; setBranch: (b: string) => void
  files: FileEntry[]; setFiles: (f: FileEntry[]) => void
  history: Revision[]
  unpushed: number
  lockWarning: boolean; setLockWarning: (b: boolean) => void
  sessionExpired: boolean; setSessionExpired: (b: boolean) => void
  operation: { label: string; pct: number } | null
  toast: string | null; say: (t: string) => void
  flow: Flow | null; openFlow: (f: Flow) => void; closeFlow: () => void
  nav: (NavTarget & { seq: number }) | null; goTo: (t: NavTarget) => void; doneNav: () => void
  conflict: ConflictCtx; startConflict: (c: ConflictCtx) => void; finishConflict: (r: Record<string, Resolution>) => void; leaveConflict: (aborted: boolean) => void
  incoming: typeof INCOMING | null
  lastScan: number; autoScan: boolean; setAutoScan: (b: boolean) => void
  scan: (how: "scan" | "check-dirty" | "auto") => void
  sync: (opts?: SyncOpts) => void
  requestSwitch: (b: string) => void
  switchBranch: (b: string, opts?: SwitchOpts) => void
  switchCommitFirst: (b: string, message: CommitMsg) => void
  syncClash: (choice: ClashChoice, o: { paths: string[]; message: CommitMsg; copy: boolean; branchName: string }) => void
  merge: (branch: string, into: boolean, opts: { message: CommitMsg; noCommit: boolean; conflicts: string[] }) => void
  commit: (msg: CommitMsg) => void
  commitAndPush: (msg: CommitMsg) => void
  push: () => void
  branches: string[]; addBranch: (name: string) => void
  archived: ArchivedBranch[]
  archiveBranch: (name: string) => void
  restoreBranch: (id: string, name: string) => void
  protectedBranches: string[]; setProtected: (name: string, on: boolean) => void
  branchMeta: Record<string, [string, string][]>; setBranchMeta: (name: string, entries: [string, string][]) => void
  resetBranch: (name: string, revision: string) => void
  toggleTick: (path: string) => void
  toggleStage: (path: string) => void
  toggleLock: (path: string) => void
  releaseLock: (path: string) => void
  releaseAllMine: () => void
  reset: (path: string) => void
}

const Ctx = createContext<Proto | null>(null)
export const useProto = () => useContext(Ctx)!

let seq = 0
const newId = () => ((0x5e1f0000 + (Date.now() % 0xffff) * 977 + ++seq * 2654435761) >>> 0).toString(16).padStart(8, "0")
const localRev = (m: CommitMsg, paths: string[], count = paths.length): Revision => ({ id: newId(), message: m.summary.trim(), description: m.description.trim(), author: "You", when: "just now", files: Math.max(1, count), local: true, paths })
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

function readParam<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  const v = new URLSearchParams(location.search).get(key) as T | null
  return v && allowed.includes(v) ? v : fallback
}

function writeParam(key: string, value: string) {
  const p = new URLSearchParams(location.search)
  p.set(key, value)
  // A sandboxed host (the shared Artifact) may refuse URL changes; the mode still switches in memory.
  try { history.replaceState(null, "", `?${p.toString()}`) } catch { /* ignore */ }
}

export function ProtoProvider({ children }: { children: ReactNode }) {
  const [mode, setModeS] = useState<Mode>(() => readParam("mode", ["artist", "developer"] as const, "artist"))
  const [screen, setScreenS] = useState<Screen>(() => readParam("screen", ["onboarding", "main", "conflict"] as const, "main"))
  const [branch, setBranch] = useState("main")
  const [files, setFiles] = useState(INITIAL_FILES)
  const [historyList, setHistory] = useState(INITIAL_HISTORY)
  const [branches, setBranches] = useState(BRANCHES)
  const [archived, setArchived] = useState(INITIAL_ARCHIVED)
  const [protectedBranches, setProtectedBranches] = useState(["main", "release/1.2", "release/1.1"])
  const [branchMeta, setBranchMetaS] = useState<Record<string, [string, string][]>>({ main: [["ci.required", "build,tests"]], "release/1.2": [["release.date", "2026-11-03"], ["owner", "Marco"]] })
  // Local Commits left behind on other branches, restored when switching back.
  const [parked, setParked] = useState<Record<string, Revision[]>>({})
  const [lockWarning, setLockWarning] = useState(false)
  const [sessionExpired, setSessionExpired] = useState(false)
  const [operation, setOperation] = useState<{ label: string; pct: number } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [flow, setFlow] = useState<Flow | null>(null)
  const [nav, setNav] = useState<(NavTarget & { seq: number }) | null>(null)
  const [conflict, setConflict] = useState<ConflictCtx>({ origin: "demo" })
  const [incoming, setIncoming] = useState<typeof INCOMING | null>(INCOMING)
  const [lastScan, setLastScan] = useState(() => Date.now() - 4 * 60_000)
  const [autoScan, setAutoScan] = useState(true)
  // Mock disk: the first scan finds an edit Lore wasn't told about; --check-dirty finds a stale flag.
  const [diskEdit, setDiskEdit] = useState(true)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(t)
  }, [toast])

  const run = (label: string, done: () => void) => {
    let pct = 0
    setOperation({ label, pct })
    const t = setInterval(() => {
      pct += 20
      if (pct >= 100) { clearInterval(t); setOperation(null); done() } else setOperation({ label, pct })
    }, 250)
  }

  /** Change one file, pulling it from the project tree if this session hasn't touched it yet. */
  const upsert = (list: FileEntry[], path: string, fn: (f: FileEntry) => FileEntry) => {
    if (list.some((f) => f.path === path)) return list.map((f) => (f.path === path ? fn(f) : f))
    const t = PROJECT_TREE.find((f) => f.path === path)
    return t ? [...list, fn(t)] : list
  }

  const locals = historyList.filter((r) => r.local)

  /** Commit & Push / Push: commit the ticked files (if any), sync, push every local Commit, release the pushed files' Locks. */
  const send = (picked: FileEntry[], msg: CommitMsg) => {
    const sent = [...new Set([...locals.flatMap((r) => r.paths ?? []), ...picked.map((f) => f.path)])]
    const commits = locals.length + (picked.length ? 1 : 0)
    const fresh = picked.length ? localRev(msg, picked.map((f) => f.path)) : null
    run(picked.length ? "Commit & Push" : "Push", () => {
      const fs = files.map((f) => (picked.includes(f) ? { ...f, change: null, staged: false, ticked: false } : f))
      if (fresh) setHistory((h) => [fresh, ...h])
      // The sync step: the server moved and touches files we're sending, so Lore merges locally first.
      const clash = incoming ? incoming.paths.filter((x) => sent.includes(x)) : []
      if (clash.length) { setFiles(fs); value.startConflict({ origin: "sync", paths: clash, push: { sent, commits } }); return }
      finishPush(fs, sent, commits)
    })
  }

  const finishPush = (start: FileEntry[], sent: string[], commits: number, resetPaths: string[] = []) => {
    let fs = start
    const released = allFiles(fs).filter((f) => sent.includes(f.path) && f.lock?.by === "you")
    for (const f of released) fs = upsert(fs, f.path, (g) => ({ ...g, lock: null }))
    setFiles(fs)
    if (incoming) applyIncoming(resetPaths, "")
    setHistory((h) => h.map((r) => (r.local ? { ...r, local: false } : r)))
    const cmd = mode === "developer" && released.length ? ` · lore lock release ${released.map((f) => fileName(f.path)).join(" ")}` : ""
    setToast(`Pushed ${plural(commits, "commit")} to ${branch}` + (released.length ? `. Released ${plural(released.length, "lock")}` : "") + cmd)
  }

  const applyIncoming = (resetPaths: string[], label: string) => {
    if (!incoming) return
    setHistory((h) => {
      const local = h.filter((r) => r.local || r.when === "just now")
      const rest = h.filter((r) => !(r.local || r.when === "just now"))
      return [...local, { id: incoming.id, message: incoming.message, description: incoming.description, author: incoming.author, when: "just now (synced)", files: incoming.paths.length + incoming.others }, ...rest]
    })
    setFiles((fs) => fs.map((f) => (resetPaths.includes(f.path) ? { ...f, change: null, staged: false, ticked: false } : f)))
    setIncoming(null)
    setToast(label)
  }

  const value: Proto = {
    mode, setMode: (m) => { setModeS(m); writeParam("mode", m) },
    screen, setScreen: (s) => { setScreenS(s); writeParam("screen", s) },
    branch, setBranch,
    files, setFiles,
    history: historyList,
    unpushed: locals.length,
    lockWarning, setLockWarning,
    sessionExpired, setSessionExpired,
    operation,
    toast, say: setToast,
    flow, openFlow: setFlow, closeFlow: () => setFlow(null),
    nav, goTo: (t) => { setFlow(null); setNav({ ...t, seq: Date.now() }) }, doneNav: () => setNav(null),
    conflict,
    startConflict: (c) => { setConflict(c); setFlow(null); setScreenS("conflict"); writeParam("screen", "conflict") },
    finishConflict: (r) => {
      const n = Object.keys(r).length
      setScreenS("main"); writeParam("screen", "main")
      if (conflict.origin === "sync") {
        const theirs = Object.entries(r).filter(([, v]) => v === "theirs").map(([k]) => k)
        if (conflict.push) finishPush(files, conflict.push.sent, conflict.push.commits, theirs)
        else {
          applyIncoming(theirs, `Sync finished. ${n} conflict${n === 1 ? "" : "s"} resolved`)
          if (conflict.merged) {
            setHistory((h) => [localRev({ summary: `Merge ${INCOMING.id} from the server`, description: `Merged ${INCOMING.author}'s “${INCOMING.message}” with your Commit. ${plural(n, "file")} decided by hand.` }, [], n), ...h])
            setToast(`Sync finished: ${plural(n, "file")} merged in a local Commit. Push to share it`)
          }
        }
      } else if (conflict.origin === "merge") {
        if (conflict.noCommit) setToast(`Merge resolved. Nothing is committed yet: review it in Staging, then commit`)
        else {
          setHistory((h) => [localRev(conflict.message ?? { summary: `Merge ${conflict.source} into ${branch}`, description: `${plural(n, "conflict")} resolved by hand.` }, [], n), ...h])
          setToast(`Merged ${conflict.source} into ${branch} (not pushed yet)`)
        }
      } else setToast(`Resolved ${n} conflicts`)
      setConflict({ origin: "demo" })
    },
    leaveConflict: (aborted) => {
      setScreenS("main"); writeParam("screen", "main")
      setToast(aborted ? "Merge aborted. Your files are back to how they were before it started" : conflict.push ? "Nothing was pushed. Your Commits are still local; Commit & Push again when you're ready" : "Left for later. Sync again when you're ready to decide")
      setConflict({ origin: "demo" })
    },
    incoming,
    lastScan, autoScan, setAutoScan,
    scan: (how) => {
      const finish = () => {
        setLastScan(Date.now())
        if (how === "check-dirty") {
          const stale = files.find((f) => f.path === "Audio/footsteps_grass.wav" && f.change)
          if (!stale) return setToast("Every changed file really is changed")
          setFiles(files.map((f) => (f === stale ? { ...f, change: null, ticked: false, staged: false } : f)))
          return setToast("footsteps_grass.wav matches its last commit again, so it's no longer listed")
        }
        if (diskEdit) {
          setDiskEdit(false)
          setFiles(upsert(files, "Art/Env/rock_normal.tga", (f) => ({ ...f, change: "modified", ticked: true })))
          return setToast("Found 1 new change: rock_normal.tga")
        }
        if (how !== "auto") setToast("No new changes on disk")
      }
      if (how === "auto") finish()
      else run(how === "scan" ? "Scanning for changes" : "Re-checking changed files", finish)
    },
    sync: (opts = {}) => {
      const target = opts.target && opts.target !== "latest" ? opts.target : null
      if (target) return run("Sync", () => setToast(`Synced to ${target}. You're on an older revision now; Sync again to get the latest`))
      if (!incoming) return run("Sync", () => setToast(`Up to date with ${branch}`))
      const clash = incoming.paths.filter((p) => files.some((f) => f.path === p && f.change))
      if (clash.length && !opts.reset) return run("Sync", () => setFlow({ kind: "sync-conflict", paths: clash }))
      run("Sync", () => applyIncoming(clash, clash.length ? `Synced. Your changes to ${clash.length} file${clash.length === 1 ? " were" : "s were"} overwritten` : `Synced 1 new revision from ${incoming.author}`))
    },
    requestSwitch: (b) => {
      if (b === branch) return
      if (files.some((f) => f.change)) return setFlow({ kind: "switch", branch: b })
      value.switchBranch(b)
    },
    switchBranch: (b, opts = {}) => {
      setFlow(null)
      run("Switch", () => {
        if (opts.reset) setFiles(files.map((f) => ({ ...f, change: null, staged: false, ticked: false })))
        const kept = opts.force ? files.filter((f) => f.change).length : 0
        const left = locals.length
        setParked((pk) => ({ ...pk, [branch]: locals }))
        setHistory((h) => [...(parked[b] ?? []), ...h.filter((r) => !r.local)])
        setBranch(b)
        const at = opts.revision && opts.revision !== "latest" ? ` at ${opts.revision}` : ""
        setToast(`Switched to ${b}${at}` + (left ? `. Your ${plural(left, "unpushed Commit")} ${left === 1 ? "stays" : "stay"} on ${branch}` : "") + (opts.reset ? `. Local changes discarded${opts.copy ? " (copies saved as .mine files)" : ""}` : "") + (kept ? `. Your ${plural(kept, "edited file")} stayed as local changes` : ""))
      })
    },
    switchCommitFirst: (b, message) => {
      setFlow(null)
      const changedNow = files.filter((f) => f.change)
      const rev = localRev(message, changedNow.map((f) => f.path))
      run("Commit and switch", () => {
        setParked((pk) => ({ ...pk, [branch]: [rev, ...locals] }))
        setHistory((h) => [...(parked[b] ?? []), ...h.filter((r) => !r.local)])
        setFiles(files.map((f) => (f.change ? { ...f, change: null, staged: false, ticked: false } : f)))
        setBranch(b)
        setToast(`Committed ${plural(changedNow.length, "file")} on ${branch}, then switched to ${b}`)
      })
    },
    syncClash: (choice, o) => {
      setFlow(null)
      const n = o.paths.length
      if (choice === "reset") return run("Sync", () => applyIncoming(o.paths, `Synced. ${plural(n, "file")} now match the server${o.copy ? "; your versions were saved as .mine copies" : ""}`))
      if (choice === "forward") return run("Sync", () => applyIncoming([], `Synced everything except ${plural(n, "file")} you kept. Pushing ${n === 1 ? "it" : "them"} later replaces the server's version`))
      const rev = localRev(o.message, o.paths)
      const clean = files.map((f) => (o.paths.includes(f.path) ? { ...f, change: null, staged: false, ticked: false } : f))
      if (choice === "branch") {
        return run("Move to branch", () => {
          setBranches((bs) => [...bs, o.branchName])
          setParked((pk) => ({ ...pk, [branch]: locals }))
          setHistory((h) => [rev, ...h.filter((r) => !r.local)])
          setFiles(clean)
          setBranch(o.branchName)
          setToast(`Your edits are committed on ${o.branchName}. Switch back to ${branch} and Sync when you're ready`)
        })
      }
      run("Commit", () => {
        setHistory((h) => [rev, ...h])
        setFiles(clean)
        run("Sync", () => value.startConflict({ origin: "sync", paths: o.paths, merged: true }))
      })
    },
    merge: (source, into, { message, noCommit, conflicts }) => {
      setFlow(null)
      if (into) return run("Merge", () => setToast(`Merged ${branch} into ${source}. You're still on ${branch}`))
      if (conflicts.length) return run("Merge", () => value.startConflict({ origin: "merge", source, paths: conflicts, noCommit, message }))
      run("Merge", () => {
        if (noCommit) return setToast(`Merged ${source} into your working copy. Review it in Staging, then commit`)
        setHistory((h) => [localRev(message, [], 6), ...h])
        setToast(`Merged ${source} into ${branch} with no conflicts (not pushed yet)`)
      })
    },
    commit: (msg) => {
      const picked = files.filter((f) => (mode === "developer" ? f.staged : f.ticked) && f.change)
      if (!picked.length) return setToast("Nothing selected to commit")
      if (!msgReady(msg)) return setToast("Write a summary and a description first")
      run("Commit", () => {
        setHistory((h) => [localRev(msg, picked.map((f) => f.path)), ...h])
        setFiles(files.map((f) => (picked.includes(f) ? { ...f, change: null, staged: false, ticked: false } : f)))
        setToast("Committed locally (not pushed yet)")
      })
    },
    commitAndPush: (msg) => {
      const picked = files.filter((f) => f.ticked && f.change)
      if (!picked.length && !locals.length) return setToast("Nothing to send")
      if (picked.length && !msgReady(msg)) return setToast("Write a summary and a description first")
      send(picked, msg)
    },
    push: () => {
      if (!locals.length) return setToast("Nothing to push. Commit something first")
      send([], EMPTY_MSG)
    },
    branches,
    addBranch: (name) => setBranches((bs) => [...bs, name]),
    archived,
    archiveBranch: (name) => {
      setBranches((bs) => bs.filter((b) => b !== name))
      setArchived((a) => [{ name, id: branchId(name), by: "You", when: "just now" }, ...a])
      setFlow(null)
      run("Archive", () => setToast(`Archived ${name}. Its history is kept; restore it from Archived branches`))
    },
    restoreBranch: (id, name) => {
      setArchived((a) => a.filter((x) => x.id !== id))
      setBranches((bs) => [...bs, name])
      setFlow(null)
      run("Restore", () => setToast(`Restored ${name}`))
    },
    protectedBranches,
    setProtected: (name, on) => {
      setProtectedBranches((ps) => (on ? [...ps, name] : ps.filter((b) => b !== name)))
      setToast(on ? `${name} is protected: direct pushes are refused` : `${name} is no longer protected`)
    },
    branchMeta,
    setBranchMeta: (name, entries) => setBranchMetaS((m) => ({ ...m, [name]: entries })),
    resetBranch: (name, revision) => {
      setFlow(null)
      run("Reset branch", () => {
        if (name === branch) {
          setHistory((h) => h.filter((r) => !r.local))
          setFiles(files.map((f) => ({ ...f, change: null, staged: false, ticked: false })))
        }
        setToast(`Local ${name} now points at ${revision}` + (name === branch ? ". Working files synced to it" : ""))
      })
    },
    toggleTick: (p) => setFiles((fs) => fs.map((f) => (f.path === p ? { ...f, ticked: !f.ticked } : f))),
    toggleStage: (p) => setFiles((fs) => fs.map((f) => (f.path === p ? { ...f, staged: !f.staged } : f))),
    toggleLock: (p) => setFiles(upsert(files, p, (f) => ({ ...f, lock: f.lock ? null : { by: "you", branch } }))),
    releaseLock: (p) => {
      const who = allFiles(files).find((f) => f.path === p)?.lock?.by
      setFiles(upsert(files, p, (f) => ({ ...f, lock: null })))
      setFlow(null)
      setToast(`Released ${who === "you" ? "your" : `${who}'s`} lock on ${fileName(p)}`)
    },
    releaseAllMine: () => {
      const mine = allFiles(files).filter((f) => f.lock?.by === "you")
      let next = files
      for (const f of mine) next = upsert(next, f.path, (g) => ({ ...g, lock: null }))
      setFiles(next)
      setToast(mine.length ? `Released ${mine.length} lock${mine.length === 1 ? "" : "s"}` : "You don't hold any locks")
    },
    reset: (p) => setFiles(files.map((f) => (f.path === p ? { ...f, change: null, ticked: false, staged: false } : f))),
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const fileName = (p: string) => p.split("/").pop()!
export const lockBranch = (l: LockState) => l?.branch ?? "main"
export const lockLabel = (l: LockState) => (!l ? null : l.by === "you" ? "Locked by you" : `Locked by ${l.by}`)
