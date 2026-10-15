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
  message: string
  author: string
  when: string
  files: number
  /** Not pushed yet: a local Commit. */
  local?: boolean
  /** Files a local Commit changed, so pushing it can release their Locks. */
  paths?: string[]
}

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
export const INCOMING = { id: "5d0e8f21", message: "Forest tile colour fix, pipeline notes", author: "Marco", paths: ["Art/Env/forest_tile_03.png", "Docs/art-pipeline.md"], others: 9 }

/** Files a revision changed. Deterministic mock, shared by History, the diff viewer and the Revision menu. */
export function changedFilesFor(rev: Pick<Revision, "id" | "files">) {
  const seed = rev.id.charCodeAt(0) + rev.id.charCodeAt(1)
  return PROJECT_TREE.filter((_, i) => (i + seed) % 3 === 0).slice(0, Math.max(1, Math.min(rev.files, 4)))
}

/** Diff for one revision: the files it changed, compared with its parent. `path` is shown first. */
export const revisionDiff = (rev: Pick<Revision, "id" | "message" | "files">, path?: string): Flow => {
  const paths = changedFilesFor(rev).map((f) => f.path)
  return { kind: "diff", paths: path ? [path, ...paths.filter((x) => x !== path)] : paths, revision: { id: rev.id, message: rev.message, files: rev.files } }
}

/** The whole project with this session's edits applied on top. */
export const allFiles = (files: FileEntry[]) => [...PROJECT_TREE.map((t) => files.find((f) => f.path === t.path) ?? t), ...files.filter((f) => !PROJECT_TREE.some((t) => t.path === f.path))]

/** Dialogs any screen can open. Rendered once by <Flows /> in flows.tsx. */
export type Flow =
  | { kind: "diff"; paths: string[]; revision?: Pick<Revision, "id" | "message" | "files">; conflict?: boolean }
  | { kind: "merge"; branch: string; into: boolean }
  | { kind: "sync"; target?: string; reset?: boolean; preview?: boolean }
  | { kind: "switch"; branch: string; revision?: string }
  | { kind: "sync-conflict"; paths: string[] }
  | { kind: "release-lock"; path: string }
  | { kind: "archive-branch"; branch: string }
  | { kind: "restore-branch"; id: string }
  | { kind: "reset-branch"; branch: string; revisions: { id: string; label: string }[]; target?: string }
  | { kind: "locks" }

export type Resolution = "mine" | "theirs" | "manual"
/** What sent the user to the conflict screen. "demo" = the prototype switcher. */
export type ConflictCtx = { origin: "sync" | "merge" | "demo"; source?: string; paths?: string[]; noCommit?: boolean; message?: string; push?: { sent: string[]; commits: number } }

export type SyncOpts = { target?: string; reset?: boolean }
export type SwitchOpts = { revision?: string; reset?: boolean; local?: boolean }

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
  conflict: ConflictCtx; startConflict: (c: ConflictCtx) => void; finishConflict: (r: Record<string, Resolution>) => void; leaveConflict: (aborted: boolean) => void
  incoming: typeof INCOMING | null
  lastScan: number; autoScan: boolean; setAutoScan: (b: boolean) => void
  scan: (how: "scan" | "check-dirty" | "auto") => void
  sync: (opts?: SyncOpts) => void
  requestSwitch: (b: string) => void
  switchBranch: (b: string, opts?: SwitchOpts) => void
  merge: (branch: string, into: boolean, opts: { message: string; noCommit: boolean; conflicts: string[] }) => void
  commit: (msg: string) => void
  commitAndPush: (msg: string) => void
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
const localRev = (message: string, paths: string[], count = paths.length): Revision => ({ id: newId(), message, author: "You", when: "just now", files: Math.max(1, count), local: true, paths })
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

function readParam<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  const v = new URLSearchParams(location.search).get(key) as T | null
  return v && allowed.includes(v) ? v : fallback
}

function writeParam(key: string, value: string) {
  const p = new URLSearchParams(location.search)
  p.set(key, value)
  history.replaceState(null, "", `?${p.toString()}`)
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
  const send = (picked: FileEntry[], msg: string) => {
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
      return [...local, { id: incoming.id, message: incoming.message, author: incoming.author, when: "just now (synced)", files: incoming.paths.length + incoming.others }, ...rest]
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
    conflict,
    startConflict: (c) => { setConflict(c); setFlow(null); setScreenS("conflict"); writeParam("screen", "conflict") },
    finishConflict: (r) => {
      const n = Object.keys(r).length
      setScreenS("main"); writeParam("screen", "main")
      if (conflict.origin === "sync") {
        const theirs = Object.entries(r).filter(([, v]) => v === "theirs").map(([k]) => k)
        if (conflict.push) finishPush(files, conflict.push.sent, conflict.push.commits, theirs)
        else applyIncoming(theirs, `Sync finished. ${n} conflict${n === 1 ? "" : "s"} resolved`)
      } else if (conflict.origin === "merge") {
        if (conflict.noCommit) setToast(`Merge resolved. Nothing is committed yet: review it in Staging, then commit`)
        else {
          setHistory((h) => [localRev(conflict.message || `Merge ${conflict.source} into ${branch}`, [], n), ...h])
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
        const left = locals.length
        setParked((pk) => ({ ...pk, [branch]: locals }))
        setHistory((h) => [...(parked[b] ?? []), ...h.filter((r) => !r.local)])
        setBranch(b)
        const at = opts.revision && opts.revision !== "latest" ? ` at ${opts.revision}` : ""
        setToast(`Switched to ${b}${at}` + (left ? `. Your ${plural(left, "unpushed Commit")} ${left === 1 ? "stays" : "stay"} on ${branch}` : "") + (opts.reset ? ". Local changes discarded" : ""))
      })
    },
    merge: (source, into, { message, noCommit, conflicts }) => {
      setFlow(null)
      if (into) return run("Merge", () => setToast(`Merged ${branch} into ${source}. You're still on ${branch}`))
      if (conflicts.length) return run("Merge", () => value.startConflict({ origin: "merge", source, paths: conflicts, noCommit, message }))
      run("Merge", () => {
        if (noCommit) return setToast(`Merged ${source} into your working copy. Review it in Staging, then commit`)
        setHistory((h) => [localRev(message || `Merge ${source} into ${branch}`, [], 6), ...h])
        setToast(`Merged ${source} into ${branch} with no conflicts (not pushed yet)`)
      })
    },
    commit: (msg) => {
      const picked = files.filter((f) => (mode === "developer" ? f.staged : f.ticked) && f.change)
      if (!picked.length) return setToast("Nothing selected to commit")
      if (!msg.trim()) return setToast("Write a commit message first")
      run("Commit", () => {
        setHistory((h) => [localRev(msg.trim(), picked.map((f) => f.path)), ...h])
        setFiles(files.map((f) => (picked.includes(f) ? { ...f, change: null, staged: false, ticked: false } : f)))
        setToast("Committed locally (not pushed yet)")
      })
    },
    commitAndPush: (msg) => {
      const picked = files.filter((f) => f.ticked && f.change)
      if (!picked.length && !locals.length) return setToast("Nothing to send")
      if (picked.length && !msg.trim()) return setToast("Write a commit message first")
      send(picked, msg.trim())
    },
    push: () => {
      if (!locals.length) return setToast("Nothing to push. Commit something first")
      send([], "")
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
