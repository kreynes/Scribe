// PROTOTYPE: Variant D, the user's layout. Side panel (project switcher + branches) and a tabbed centre: Staging, History, Explorer.
import { ArrowDownToLine, ArrowUpFromLine, ChevronRight, ChevronsDownUp, ChevronsUpDown, Folder, FolderOpen, GitBranch, Lock, Search, Settings, Settings2 } from "lucide-react"
import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { BranchMenu, ChangeBadge, FileMenu, LoreLog, OperationBar, RevisionMenu, Thumb } from "./shared"
import { BRANCHES, PROJECT_TREE, fileName, useProto, type FileEntry, type Mode, type Revision } from "./state"
import { FileTypeIcon } from "./fileTypes"

const PROJECTS = ["forest-game", "ui-kit", "cinematics"]

/** Icon-only lock marker next to a filename: gray if mine, red if someone else's, tooltip says who. */
function LockIcon({ file }: { file: FileEntry }) {
  if (!file.lock) return null
  const mine = file.lock.by === "you"
  const label = mine ? "Locked by you" : `Locked by ${file.lock.by}`
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span aria-label={label} className="inline-flex shrink-0 cursor-default">
            <Lock className={cn("size-3.5", mine ? "text-zinc-400" : "text-red-600")} />
          </span>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function SidePanel() {
  const p = useProto()
  const [project, setProject] = useState(PROJECTS[0])
  const switchTo = (b: string) => {
    if (b === p.branch) return
    if (p.files.some((f) => f.change) || p.unpushed > 0) return p.say("Commit or Commit & Push your changes before switching")
    p.setBranch(b)
    p.say("Switched to " + b)
  }
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r bg-zinc-50/60">
      <div className="border-b p-3">
        <Select value={project} onValueChange={setProject}>
          <SelectTrigger className="w-full bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PROJECTS.map((pr) => <SelectItem key={pr} value={pr}>{pr}</SelectItem>)}
            <div className="border-t px-2 py-1.5 text-xs text-zinc-500">+ Clone or open a project…</div>
          </SelectContent>
        </Select>
        {p.mode === "developer" && <code className="mt-1.5 block truncate text-[10px] text-zinc-400">lore://studio.local:41337/{project}</code>}
      </div>
      <div className="px-3 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-zinc-500">Branches</div>
      <ul className="flex-1 space-y-0.5 overflow-auto px-2">
        {BRANCHES.map((b) => (
          <BranchMenu key={b} name={b}>
            <li
              onDoubleClick={() => switchTo(b)}
              className={cn("flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm", b === p.branch ? "bg-zinc-900 text-white" : "hover:bg-zinc-200/60")}
              title={b === p.branch ? "Current branch" : "Double-click to switch"}
            >
              <GitBranch className="size-3.5 shrink-0" />
              <span className="truncate">{b}</span>
              {b === p.branch && <span className="ml-auto text-[10px] opacity-70">current</span>}
            </li>
          </BranchMenu>
        ))}
      </ul>
      <p className="px-3 pb-2 text-[11px] text-zinc-400">Double-click or right-click → Switch.</p>
      <div className="border-t p-2"><SettingsDialog /></div>
    </aside>
  )
}

function FileLine({ file, checked, onCheck }: { file: FileEntry; checked: boolean; onCheck: () => void }) {
  const dev = useProto().mode === "developer"
  return (
    <FileMenu file={file}>
      <div className="flex items-center gap-3 px-3 py-1.5 hover:bg-zinc-50">
        <Checkbox checked={checked} onCheckedChange={onCheck} />
        {!dev && <Thumb file={file} size="sm" />}
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <FileTypeIcon path={file.path} />
          <span className={cn("truncate", dev ? "font-mono text-xs" : "text-sm")}>{dev ? file.path : fileName(file.path)}</span>
          <LockIcon file={file} />
        </span>
        {!dev && <span className="hidden truncate text-xs text-zinc-400 lg:block">{file.path.split("/").slice(0, -1).join(" / ")}</span>}
        <ChangeBadge file={file} />
      </div>
    </FileMenu>
  )
}

function StagingTab() {
  const p = useProto()
  const dev = p.mode === "developer"
  const [msg, setMsg] = useState("")
  const changed = p.files.filter((f) => f.change)
  const staged = changed.filter((f) => f.staged)
  const unstaged = changed.filter((f) => !f.staged)
  const blocked = changed.some((f) => f.lock && f.lock.by !== "you")
  const Section = ({ title, files, action }: { title: string; files: FileEntry[]; action?: React.ReactNode }) => (
    <section className="rounded-lg border">
      <header className="flex items-center justify-between border-b bg-zinc-50 px-3 py-1.5 text-xs font-medium uppercase text-zinc-500">
        <span>{title} ({files.length})</span>{action}
      </header>
      <div className="divide-y">{files.map((f) => <FileLine key={f.path} file={f} checked={dev ? f.staged : f.ticked} onCheck={() => (dev ? p.toggleStage(f.path) : p.toggleTick(f.path))} />)}</div>
      {!files.length && <p className="px-3 py-3 text-sm text-zinc-400">Nothing here.</p>}
    </section>
  )
  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="min-h-0 flex-1 space-y-3 overflow-auto">
        {dev ? (
          <>
            <Section title="Staged" files={staged} action={<button className="normal-case text-zinc-500 hover:text-zinc-900" onClick={() => p.setFiles(p.files.map((f) => ({ ...f, staged: false })))}>Unstage all</button>} />
            <Section title="Changes" files={unstaged} action={<button className="normal-case text-zinc-500 hover:text-zinc-900" onClick={() => p.setFiles(p.files.map((f) => (f.change ? { ...f, staged: true } : f)))}>Stage all</button>} />
          </>
        ) : (
          <Section title="Your changes" files={changed} />
        )}
      </div>
      <div className="space-y-2 border-t pt-3">
        <Textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={dev ? "Commit message" : "What did you change?"} className={cn("min-h-16 resize-none", dev && "font-mono text-xs")} />
        <div className="flex items-center gap-2">
          {p.unpushed > 0 && <span className="text-xs text-zinc-500">{p.unpushed} local commit{p.unpushed > 1 ? "s" : ""} not pushed</span>}
          <div className="ml-auto flex gap-2">
            <Button variant={dev ? "default" : "outline"} onClick={() => { p.commit(msg); setMsg("") }}>{dev ? `Commit (${staged.length})` : "Commit"}</Button>
            {!dev && <Button disabled={blocked} onClick={() => { p.commitAndPush(msg); setMsg("") }}>Commit &amp; Push ({changed.filter((f) => f.ticked).length})</Button>}
          </div>
        </div>
      </div>
    </div>
  )
}

function changedFilesFor(rev: Revision) {
  const seed = rev.id.charCodeAt(0) + rev.id.charCodeAt(1)
  return PROJECT_TREE.filter((_, i) => (i + seed) % 3 === 0).slice(0, Math.max(1, Math.min(rev.files, 4)))
}

function HistoryTab() {
  const p = useProto()
  const dev = p.mode === "developer"
  const [open, setOpen] = useState<string | null>(null)
  return (
    <div className="h-full overflow-auto p-4">
      <div className="overflow-hidden rounded-lg border">
        <div className={cn("grid border-b bg-zinc-50 px-3 py-1.5 text-xs font-medium uppercase text-zinc-500", dev ? "grid-cols-[1.5rem_1fr_7rem_7rem_6rem]" : "grid-cols-[1.5rem_1fr_7rem_7rem]")}>
          <span /><span>Message</span><span>Author</span><span>When</span>{dev && <span>Revision</span>}
        </div>
        {p.history.map((r) => {
          const key = r.id + r.when
          const isOpen = open === key
          const files = changedFilesFor(r)
          return (
            <div key={key} className="border-b last:border-b-0">
              <RevisionMenu rev={r}>
                <button
                  onClick={() => setOpen(isOpen ? null : key)}
                  className={cn("grid w-full items-center px-3 py-2 text-left text-sm hover:bg-zinc-50", isOpen && "bg-zinc-100", dev ? "grid-cols-[1.5rem_1fr_7rem_7rem_6rem]" : "grid-cols-[1.5rem_1fr_7rem_7rem]")}
                >
                  <ChevronRight className={cn("size-3.5 text-zinc-400 transition", isOpen && "rotate-90")} />
                  <span className="truncate">{r.message} {r.local && <Badge variant="outline" className="ml-1 font-normal">not pushed</Badge>}</span>
                  <span className="truncate text-zinc-600">{r.author}</span>
                  <span className="text-zinc-500">{r.when}</span>
                  {dev && <code className="text-xs text-zinc-400">{r.id}</code>}
                </button>
              </RevisionMenu>
              {isOpen && (
                <div className="space-y-3 bg-zinc-50/60 px-10 py-3 text-sm">
                  <div className="grid grid-cols-[7rem_1fr] gap-y-1 text-xs">
                    <span className="text-zinc-500">Author</span><span>{r.author}{dev && ` <${r.author.toLowerCase()}@studio.local>`}</span>
                    <span className="text-zinc-500">Date</span><span>{r.when} {dev && "· 2026-10-14T13:02:41Z"}</span>
                    <span className="text-zinc-500">Branch</span><span>{p.branch}</span>
                    {dev && <><span className="text-zinc-500">Revision</span><code>{r.id}c41e09ab77f3d2e1</code><span className="text-zinc-500">Parent</span><code>71cc9b20a8e4…</code><span className="text-zinc-500">Metadata</span><code>change-request: none</code></>}
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-medium uppercase text-zinc-500">Files changed ({r.files})</div>
                    <div className="rounded-md border bg-white">
                      {files.map((f) => (
                        <FileMenu key={f.path} file={f}>
                          <div className="flex items-center gap-2 border-b px-3 py-1.5 last:border-b-0">
                            {!dev && <Thumb file={f} size="sm" />}
                            <span className="flex min-w-0 flex-1 items-center gap-1.5">
                              <FileTypeIcon path={f.path} />
                              <span className={cn("truncate", dev ? "font-mono text-xs" : "text-sm")}>{dev ? f.path : fileName(f.path)}</span>
                              <LockIcon file={f} />
                            </span>
                            <Badge variant="outline" className="font-normal">modified</Badge>
                          </div>
                        </FileMenu>
                      ))}
                      {r.files > files.length && <div className="px-3 py-1.5 text-xs text-zinc-400">+ {r.files - files.length} more</div>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => p.say("Restore: choose a file or all files")}>Restore this revision…</Button>
                    <Button size="sm" variant="ghost" onClick={() => p.say("Comparing with previous revision")}>Compare with previous</Button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

type Node = { name: string; path: string; children: Node[]; file?: FileEntry }

function buildTree(files: FileEntry[]): Node {
  const root: Node = { name: "", path: "", children: [] }
  for (const f of files) {
    let cur = root
    const parts = f.path.split("/")
    parts.forEach((part, i) => {
      const path = parts.slice(0, i + 1).join("/")
      let next = cur.children.find((c) => c.name === part)
      if (!next) { next = { name: part, path, children: [], file: i === parts.length - 1 ? f : undefined }; cur.children.push(next) }
      cur = next
    })
  }
  return root
}

// Mock per-file "last modified" metadata: the revision that last touched the file, and when.
const NOW = new Date("2026-10-14T16:00:00Z").getTime()
const HOUR = 3600_000
const DAY = 24 * HOUR
const FILE_REVS = [
  { id: "9f3c2a1e", message: "Forest lighting pass", at: NOW - 2 * HOUR },
  { id: "4b81d0c7", message: "Villain textures v3", at: NOW - 1 * DAY - 3 * HOUR },
  { id: "e02a77f5", message: "Hero sculpt blockout", at: NOW - 1 * DAY - 7 * HOUR },
  { id: "71cc9b20", message: "Import footstep library", at: NOW - 3 * DAY },
  { id: "3a90f1b2", message: "Project setup for vertical slice", at: NOW - 16 * DAY },
  { id: "c55d0e7a", message: "Initial import", at: NOW - 64 * DAY },
]

function fileMeta(f: FileEntry) {
  if (f.change) return { rev: null, at: NOW - 10 * 60_000 }
  let h = 0
  for (const c of f.path) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const r = FILE_REVS[h % FILE_REVS.length]
  return { rev: r.id, at: r.at }
}

function formatWhen(at: number, dev: boolean) {
  if (dev) return new Date(at).toISOString().slice(0, 16).replace("T", " ")
  const d = NOW - at
  if (d < HOUR) return `${Math.max(1, Math.round(d / 60_000))} min ago`
  if (d < DAY) return `${Math.round(d / HOUR)} hours ago`
  if (d < 2 * DAY) return "yesterday"
  if (d < 30 * DAY) return `${Math.round(d / DAY)} days ago`
  return new Date(at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

const DATE_FILTERS = {
  any: { label: "Any time", test: () => true },
  today: { label: "Today", test: (at: number) => NOW - at < DAY },
  week: { label: "Last 7 days", test: (at: number) => NOW - at < 7 * DAY },
  month: { label: "Last 30 days", test: (at: number) => NOW - at < 30 * DAY },
  older: { label: "Older than 30 days", test: (at: number) => NOW - at >= 30 * DAY },
} as const
type DateFilter = keyof typeof DATE_FILTERS

const COLS = "grid grid-cols-[5.5rem_9rem_6rem_5rem] items-center gap-2 shrink-0"

type TreeProps = { node: Node; depth: number; open: Set<string>; toggle: (path: string) => void; forceOpen: boolean }

function TreeNode({ node, depth, open, toggle, forceOpen }: TreeProps) {
  const dev = useProto().mode === "developer"
  if (node.file) {
    const f = node.file
    const meta = fileMeta(f)
    return (
      <FileMenu file={f}>
        <div className="flex items-center gap-2 py-1 pr-3 hover:bg-zinc-50" style={{ paddingLeft: depth * 16 + 12 }}>
          {dev ? <FileTypeIcon path={f.path} /> : <Thumb file={f} size="sm" />}
          <span className="flex min-w-0 flex-1 items-center gap-1.5">
            <span className={cn("truncate", dev ? "font-mono text-xs" : "text-sm")}>{node.name}</span>
            <LockIcon file={f} />
          </span>
          <span className={cn(COLS, "text-[11px] tabular-nums text-zinc-500")}>
            <span className="flex justify-end"><ChangeBadge file={f} /></span>
            <span className="text-right">{formatWhen(meta.at, dev)}</span>
            <span className="text-right">{meta.rev ? <code className="text-zinc-500">{meta.rev}</code> : <span className="text-amber-700">working copy</span>}</span>
            <span className="text-right text-zinc-400">{f.size}</span>
          </span>
        </div>
      </FileMenu>
    )
  }
  const isOpen = forceOpen || open.has(node.path)
  return (
    <div>
      <button onClick={() => toggle(node.path)} className="flex w-full items-center gap-2 py-1 pr-3 text-left hover:bg-zinc-50" style={{ paddingLeft: depth * 16 + 12 }}>
        <ChevronRight className={cn("size-3.5 text-zinc-400 transition", isOpen && "rotate-90")} />
        {isOpen ? <FolderOpen className="size-4 text-amber-500" /> : <Folder className="size-4 text-amber-500" />}
        <span className="text-sm">{node.name}</span>
      </button>
      {isOpen && node.children.map((c) => <TreeNode key={c.path} node={c} depth={depth + 1} open={open} toggle={toggle} forceOpen={forceOpen} />)}
    </div>
  )
}

function folderPaths(node: Node, maxDepth = Infinity, depth = 0, acc: string[] = []) {
  for (const c of node.children) {
    if (c.file) continue
    if (depth < maxDepth) acc.push(c.path)
    folderPaths(c, maxDepth, depth + 1, acc)
  }
  return acc
}

function ExplorerTab() {
  const p = useProto()
  const [query, setQuery] = useState("")
  const all = useMemo(() => PROJECT_TREE.map((t) => p.files.find((f) => f.path === t.path) ?? t), [p.files])
  const fullTree = useMemo(() => buildTree(all), [all])
  const [open, setOpen] = useState(() => new Set(folderPaths(fullTree, 2)))
  const [dateFilter, setDateFilter] = useState<DateFilter>("any")
  const [revFilter, setRevFilter] = useState("any")
  const q = query.trim().toLowerCase()
  const filtering = !!q || dateFilter !== "any" || revFilter !== "any"
  const matches = all.filter((f) => {
    const meta = fileMeta(f)
    if (q && !f.path.toLowerCase().includes(q)) return false
    if (!DATE_FILTERS[dateFilter].test(meta.at)) return false
    if (revFilter === "working" ? meta.rev !== null : revFilter !== "any" && meta.rev !== revFilter) return false
    return true
  })
  const tree = useMemo(() => (filtering ? buildTree(matches) : fullTree), [filtering, matches, fullTree])
  const toggle = (path: string) => setOpen((s) => { const n = new Set(s); if (n.has(path)) n.delete(path); else n.add(path); return n })
  return (
    <div className="flex h-full flex-col gap-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search files…" className="h-8 pl-8" />
        </div>
        <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
          <SelectTrigger size="sm" className="w-52"><span className="text-zinc-500">Modified:</span><SelectValue /></SelectTrigger>
          <SelectContent>{(Object.keys(DATE_FILTERS) as DateFilter[]).map((k) => <SelectItem key={k} value={k}>{DATE_FILTERS[k].label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={revFilter} onValueChange={setRevFilter}>
          <SelectTrigger size="sm" className="w-44"><span className="text-zinc-500">Revision:</span><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any</SelectItem>
            <SelectItem value="working">Working copy (changed)</SelectItem>
            {FILE_REVS.map((r) => <SelectItem key={r.id} value={r.id}><code>{r.id}</code> <span className="text-zinc-500">{r.message}</span></SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => setOpen(new Set(folderPaths(fullTree)))}><ChevronsUpDown className="size-4" /> Expand all</Button>
        <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => setOpen(new Set())}><ChevronsDownUp className="size-4" /> Collapse all</Button>
      </div>
      <div className="text-xs text-zinc-500">
        {p.mode === "developer" ? `${p.branch} · view filter: Art/**, Audio/**, Content/**, Source/** … · ` : `Files on ${p.branch} · `}
        {matches.length} file{matches.length === 1 ? "" : "s"}{filtering && " matching"}
        {filtering && <button className="ml-2 underline" onClick={() => { setQuery(""); setDateFilter("any"); setRevFilter("any") }}>Clear filters</button>}
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
        <div className="flex items-center gap-2 border-b bg-zinc-50 py-1.5 pl-3 pr-3 text-[11px] font-medium uppercase text-zinc-500">
          <span className="flex-1">Name</span>
          <span className={COLS}>
            <span className="text-right">Status</span>
            <span className="text-right">Modified</span>
            <span className="text-right">Revision</span>
            <span className="text-right">Size</span>
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto py-1">
          {tree.children.map((c) => <TreeNode key={c.path} node={c} depth={0} open={open} toggle={toggle} forceOpen={filtering} />)}
          {!tree.children.length && <p className="px-3 py-3 text-sm text-zinc-400">No files match these filters.</p>}
        </div>
      </div>
    </div>
  )
}

function SettingsDialog() {
  const p = useProto()
  const [strategy, setStrategy] = useState("file")
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-zinc-600"><Settings className="size-4" /> Settings</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Signed in to studio.local as you@studio.local.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 text-sm">
          <section className="space-y-2">
            <div className="font-medium">Mode</div>
            <RadioGroup value={p.mode} onValueChange={(v) => p.setMode(v as Mode)} className="flex gap-4">
              <Label className="font-normal"><RadioGroupItem value="artist" /> Artist</Label>
              <Label className="font-normal"><RadioGroupItem value="developer" /> Developer</Label>
            </RadioGroup>
          </section>
          <section className="space-y-2">
            <div className="font-medium">Conflict resolution strategy</div>
            <RadioGroup value={strategy} onValueChange={setStrategy} className="space-y-1">
              <Label className="font-normal"><RadioGroupItem value="file" /> Decide file by file (Keep mine / Use theirs)</Label>
              <Label className="font-normal"><RadioGroupItem value="branch" /> Move my work to a branch first</Label>
            </RadioGroup>
          </section>
          <section className="space-y-2">
            <div className="font-medium">Auto-lock patterns</div>
            <p className="text-xs text-zinc-500">Shared patterns come from this project's <code>.scribelock</code>. Add your own local ones here.</p>
            <Input placeholder="e.g. *.kra" className="font-mono text-xs" />
          </section>
          <section className="space-y-2">
            <div className="font-medium">Lore profile</div>
            <Label className="font-normal"><Checkbox /> Use a separate Lore profile (keep my sign-in apart from the Lore CLI)</Label>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function AdvancedSheet() {
  return (
    <Sheet>
      <SheetTrigger asChild><Button variant="ghost" size="sm" className="gap-1.5 text-zinc-500"><Settings2 className="size-4" /> Advanced</Button></SheetTrigger>
      <SheetContent>
        <SheetHeader><SheetTitle>Advanced</SheetTitle><SheetDescription>Everything else Lore can do, shown the way Developer Mode shows it.</SheetDescription></SheetHeader>
        <ul className="space-y-1 px-4 text-sm">{["Amend / Revert / Cherry-pick", "Create, merge, delete, protect branches", "Revision metadata", "Links and layers (Preview)", "Shared stores and service", "Obliterate", "Edit view filter file"].map((a) => <li key={a} className="rounded px-2 py-2 hover:bg-zinc-100">{a}</li>)}</ul>
      </SheetContent>
    </Sheet>
  )
}

export function VariantD() {
  const p = useProto()
  const dev = p.mode === "developer"
  const changed = p.files.filter((f) => f.change).length
  return (
    <div className="flex h-full">
      <SidePanel />
      <div className="flex min-w-0 flex-1 flex-col">
        <Tabs defaultValue="staging" className="flex min-h-0 flex-1 flex-col gap-0">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <TabsList>
              <TabsTrigger value="staging">Staging {changed > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">{changed}</Badge>}</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="explorer">Explorer</TabsTrigger>
              {dev && <TabsTrigger value="log">Lore log</TabsTrigger>}
            </TabsList>
            <div className="ml-auto flex items-center gap-2">
              {!dev && <AdvancedSheet />}
              <Button size="sm" variant="outline" className="gap-1.5" onClick={p.sync}><ArrowDownToLine className="size-4" /> Sync</Button>
              {dev && <Button size="sm" variant="outline" className="gap-1.5" onClick={() => p.commitAndPush("")}><ArrowUpFromLine className="size-4" /> Push{p.unpushed ? ` ↑${p.unpushed}` : ""}</Button>}
            </div>
          </div>
          <TabsContent value="staging" className="min-h-0 flex-1"><StagingTab /></TabsContent>
          <TabsContent value="history" className="min-h-0 flex-1"><HistoryTab /></TabsContent>
          <TabsContent value="explorer" className="min-h-0 flex-1"><ExplorerTab /></TabsContent>
          {dev && <TabsContent value="log" className="min-h-0 flex-1"><LoreLog /></TabsContent>}
        </Tabs>
        <OperationBar />
      </div>
    </div>
  )
}
