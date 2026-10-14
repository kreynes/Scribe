// PROTOTYPE: in-memory mock state for the Scribe Mode mockups. Nothing here talks to Lore.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

export type Mode = "artist" | "developer"
export type Variant = "A" | "B" | "C"
export type Screen = "onboarding" | "main" | "conflict"

export type LockState = { by: "you" } | { by: string } | null

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
  local?: boolean
}

export type Teammate = { name: string; initials: string; editing: string[]; online: boolean }

export const BRANCHES = ["main", "release/1.2", "feature/new-hero", "art/env-pass"]

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

type Proto = {
  mode: Mode; setMode: (m: Mode) => void
  variant: Variant; setVariant: (v: Variant) => void
  screen: Screen; setScreen: (s: Screen) => void
  branch: string; setBranch: (b: string) => void
  branchPanePinned: boolean; setBranchPanePinned: (p: boolean) => void
  files: FileEntry[]; setFiles: (f: FileEntry[]) => void
  history: Revision[]
  unpushed: number
  lockWarning: boolean; setLockWarning: (b: boolean) => void
  sessionExpired: boolean; setSessionExpired: (b: boolean) => void
  operation: { label: string; pct: number } | null
  toast: string | null; say: (t: string) => void
  sync: () => void
  commit: (msg: string) => void
  commitAndPush: (msg: string) => void
  toggleTick: (path: string) => void
  toggleStage: (path: string) => void
  toggleLock: (path: string) => void
  reset: (path: string) => void
}

const Ctx = createContext<Proto | null>(null)
export const useProto = () => useContext(Ctx)!

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
  const [variant, setVariantS] = useState<Variant>(() => readParam("variant", ["A", "B", "C"] as const, "A"))
  const [screen, setScreenS] = useState<Screen>(() => readParam("screen", ["onboarding", "main", "conflict"] as const, "main"))
  const [branch, setBranch] = useState("main")
  const [branchPanePinned, setBranchPanePinned] = useState(false)
  const [files, setFiles] = useState(INITIAL_FILES)
  const [historyList, setHistory] = useState(INITIAL_HISTORY)
  const [unpushed, setUnpushed] = useState(0)
  const [lockWarning, setLockWarning] = useState(false)
  const [sessionExpired, setSessionExpired] = useState(false)
  const [operation, setOperation] = useState<{ label: string; pct: number } | null>(null)
  const [toast, setToast] = useState<string | null>(null)

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

  const value: Proto = {
    mode, setMode: (m) => { setModeS(m); writeParam("mode", m) },
    variant, setVariant: (v) => { setVariantS(v); writeParam("variant", v) },
    screen, setScreen: (s) => { setScreenS(s); writeParam("screen", s) },
    branch, setBranch,
    branchPanePinned, setBranchPanePinned,
    files, setFiles,
    history: historyList,
    unpushed,
    lockWarning, setLockWarning,
    sessionExpired, setSessionExpired,
    operation,
    toast, say: setToast,
    sync: () => run("Sync", () => setToast("Up to date with main")),
    commit: (msg) => {
      const picked = files.filter((f) => (mode === "developer" ? f.staged : f.ticked) && f.change)
      if (!picked.length) return setToast("Nothing selected to commit")
      run("Commit", () => {
        setUnpushed((n) => n + 1)
        setHistory((h) => [{ id: "local", message: msg || "Work in progress", author: "You", when: "just now", files: picked.length, local: true }, ...h.filter((r) => !r.local)])
        setFiles(files.map((f) => (picked.includes(f) ? { ...f, change: null, staged: false, ticked: false } : f)))
        setToast("Committed locally (not pushed yet)")
      })
    },
    commitAndPush: (msg) => {
      const picked = files.filter((f) => f.ticked && f.change)
      if (!picked.length && !unpushed) return setToast("Nothing to push")
      run("Commit & Push", () => {
        setHistory((h) => [{ id: "a7d41e93", message: msg || "Update", author: "You", when: "just now", files: picked.length || 1 }, ...h.filter((r) => !r.local)])
        setFiles(files.map((f) => (picked.includes(f) ? { ...f, change: null, ticked: false, staged: false, lock: f.lock && "by" in f.lock && f.lock.by === "you" ? null : f.lock } : f)))
        setUnpushed(0)
        setToast("Pushed. Locks on pushed files were released")
      })
    },
    toggleTick: (p) => setFiles(files.map((f) => (f.path === p ? { ...f, ticked: !f.ticked } : f))),
    toggleStage: (p) => setFiles(files.map((f) => (f.path === p ? { ...f, staged: !f.staged } : f))),
    toggleLock: (p) => setFiles(files.map((f) => (f.path === p ? { ...f, lock: f.lock ? null : { by: "you" } } : f))),
    reset: (p) => setFiles(files.map((f) => (f.path === p ? { ...f, change: null, ticked: false, staged: false } : f))),
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const fileName = (p: string) => p.split("/").pop()!
export const lockLabel = (l: LockState) => (!l ? null : l.by === "you" ? "Locked by you" : `Locked by ${l.by}`)
