// PROTOTYPE: Variant D, the user's layout. Side panel (project switcher + branches) and a tabbed centre: Staging, History, Explorer.
import { ArrowDownToLine, ArrowUpFromLine, ChevronRight, ChevronsDownUp, ChevronsUpDown, Folder, FolderOpen, GitBranch, GitCommitHorizontal, Lock, Search, Settings, Settings2, Star, X } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
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
import { BranchMenu, ChangeBadge, FileMenu, LoreLog, OperationBar, RevisionMenu } from "./shared"
import { BRANCHES, PROJECT_TREE, fileName, useProto, type FileEntry, type Mode, type Revision } from "./state"
import { FileTypeIcon, typeOf } from "./fileTypes"
import { DateRangeFilter, RevisionFilter, type DatePreset, type DateValue } from "./filters"

const PROJECTS = ["forest-game", "ui-kit", "cinematics"]

// Mock "now" for the prototype, so relative dates are stable.
const NOW = new Date("2026-10-14T16:00:00Z").getTime()
const HOUR = 3600_000
const DAY = 24 * HOUR

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
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [favOnly, setFavOnly] = useState(false)
  const [favorites, setFavorites] = useState(() => new Set(["release/1.2"]))
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (searchOpen) inputRef.current?.focus() }, [searchOpen])

  const toggleFav = (b: string) => setFavorites((s) => {
    const n = new Set(s)
    if (n.has(b)) n.delete(b)
    else n.add(b)
    p.say(n.has(b) ? `${b} added to favorites` : `${b} removed from favorites`)
    return n
  })
  const switchTo = (b: string) => {
    if (b === p.branch) return
    if (p.files.some((f) => f.change) || p.unpushed > 0) return p.say("Commit or Commit & Push your changes before switching")
    p.setBranch(b)
    p.say("Switched to " + b)
  }
  const q = searchOpen ? search.trim().toLowerCase() : ""
  const visible = BRANCHES.filter((b) => (!q || b.toLowerCase().includes(q)) && (!favOnly || favorites.has(b)))
  const favs = visible.filter((b) => favorites.has(b))
  const rest = visible.filter((b) => !favorites.has(b))

  const row = (b: string) => (
    <BranchMenu key={b} name={b} favorite={favorites.has(b)} onToggleFavorite={() => toggleFav(b)}>
      <li
        onDoubleClick={() => switchTo(b)}
        className={cn("flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm", b === p.branch ? "bg-zinc-900 text-white" : "hover:bg-zinc-200/60")}
        title={b === p.branch ? "Current branch" : "Double-click to switch"}
      >
        <GitBranch className="size-3.5 shrink-0" />
        <span className="truncate">{b}</span>
        <span className="ml-auto flex shrink-0 items-center gap-1">
          {favorites.has(b) && <Star className="size-3 fill-amber-400 text-amber-500" />}
          {b === p.branch && <span className="text-[10px] opacity-70">current</span>}
        </span>
      </li>
    </BranchMenu>
  )

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
      <div className="flex items-center gap-1 px-3 pb-1 pt-3">
        <span className="flex-1 text-xs font-medium uppercase tracking-wide text-zinc-500">Branches</span>
        <Button
          size="icon" variant="ghost" title="Search branches" aria-pressed={searchOpen}
          className={cn("size-6", searchOpen && "bg-zinc-200")}
          onClick={() => { setSearchOpen(!searchOpen); if (searchOpen) setSearch("") }}
        ><Search className="size-3.5" /></Button>
        <Button
          size="icon" variant="ghost" title={favOnly ? "Show all branches" : "Show favorite branches"} aria-pressed={favOnly}
          className={cn("size-6", favOnly && "bg-amber-100")}
          onClick={() => setFavOnly(!favOnly)}
        ><Star className={cn("size-3.5", favOnly && "fill-amber-400 text-amber-500")} /></Button>
      </div>
      <div className={cn("grid px-2 transition-[grid-template-rows,opacity] duration-200 ease-out", searchOpen ? "grid-rows-[1fr] opacity-100" : "pointer-events-none grid-rows-[0fr] opacity-0")}>
        <div className="min-h-0 overflow-hidden">
          <div className="relative py-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400" />
            <Input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") { setSearch(""); setSearchOpen(false) } }}
              placeholder="Find a branch…"
              className="h-7 bg-white pl-7 pr-7 text-xs"
              tabIndex={searchOpen ? 0 : -1}
            />
            {search && <button aria-label="Clear branch search" className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-900" onClick={() => setSearch("")}><X className="size-3.5" /></button>}
          </div>
        </div>
      </div>
      <ul className="flex-1 space-y-0.5 overflow-auto px-2 pt-1">
        {favs.map(row)}
        {favs.length > 0 && rest.length > 0 && <li aria-hidden className="mx-2 my-1.5 border-t" />}
        {rest.map(row)}
        {!visible.length && <li className="px-2 py-3 text-xs text-zinc-400">{favOnly && !favorites.size ? "No favorites yet. Right-click a branch → Add to favorites." : "No branches match."}</li>}
      </ul>
      <p className="px-3 pb-2 text-[11px] text-zinc-400">Double-click or right-click → Switch.</p>
      <div className="border-t p-2"><SettingsDialog /></div>
    </aside>
  )
}

function FileLine({ file, checked, onCheck, selected, onSelect }: { file: FileEntry; checked: boolean; onCheck: () => void; selected: boolean; onSelect: () => void }) {
  const dev = useProto().mode === "developer"
  return (
    <FileMenu file={file}>
      <div onClick={onSelect} className={cn("flex cursor-default items-center gap-3 px-3 py-1.5", selected ? "bg-sky-50 ring-1 ring-inset ring-sky-200" : "hover:bg-zinc-50")}>
        <Checkbox checked={checked} onCheckedChange={onCheck} onClick={(e) => e.stopPropagation()} />
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

function fileHistory(f: FileEntry) {
  let h = 0
  for (const c of f.path) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const start = h % FILE_REVS.length
  return FILE_REVS.slice(start).filter((_, i) => i % 2 === 0).concat(FILE_REVS[FILE_REVS.length - 1]).filter((r, i, a) => a.indexOf(r) === i)
}

/** Right-hand details panel that slides in when something is selected. */
function DetailsPanel({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("shrink-0 overflow-hidden border-l bg-zinc-50/40 transition-[width,opacity] duration-200 ease-out", open ? "w-80 opacity-100" : "w-0 border-l-0 opacity-0")}>
      {children}
    </div>
  )
}

function FileDetails({ file, onClose }: { file: FileEntry | undefined; onClose: () => void }) {
  const p = useProto()
  const dev = p.mode === "developer"
  return (
    <DetailsPanel open={!!file}>
      {file && (
        <div className="flex h-full w-80 flex-col">
          <div className="flex items-start gap-2 border-b p-3">
            <FileTypeIcon path={file.path} className="mt-0.5 size-5" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{fileName(file.path)}</div>
              <div className="truncate text-xs text-zinc-500">{file.path}</div>
            </div>
            <button aria-label="Close file details" className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900" onClick={onClose}><X className="size-4" /></button>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-auto p-3 text-xs">
            <dl className="grid grid-cols-[6rem_1fr] gap-y-1.5">
              <dt className="text-zinc-500">Type</dt><dd>{typeOf(file.path).label}</dd>
              <dt className="text-zinc-500">Size</dt><dd>{file.size}</dd>
              <dt className="text-zinc-500">Status</dt><dd>{file.change ? <ChangeBadge file={file} /> : "unchanged"}</dd>
              <dt className="text-zinc-500">Lock</dt>
              <dd className="flex items-center gap-1.5">{file.lock ? <><LockIcon file={file} /> {file.lock.by === "you" ? "Locked by you" : `Locked by ${file.lock.by}`}</> : "Not locked"}</dd>
              <dt className="text-zinc-500">Last revision</dt><dd>{fileMeta(file).rev ? <code>{fileMeta(file).rev}</code> : <span className="text-amber-700">working copy</span>}</dd>
              <dt className="text-zinc-500">Modified</dt><dd>{formatWhen(fileMeta(file).at, dev)}</dd>
              {dev && <><dt className="text-zinc-500">Content hash</dt><dd><code>blake3 9a1f…c03e</code></dd></>}
            </dl>
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => p.say("Diff for " + fileName(file.path))}>Show diff</Button>
              {(!file.lock || file.lock.by === "you") && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => p.toggleLock(file.path)}>{file.lock ? "Release lock" : "Lock"}</Button>}
              {file.change && <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => p.reset(file.path)}>Reset</Button>}
            </div>
            <div>
              <div className="mb-1.5 font-medium uppercase text-zinc-500">History</div>
              <ol className="space-y-0.5 border-l pl-3">
                {file.change && (
                  <li className="relative py-1">
                    <span className="absolute -left-[17px] top-2 size-2 rounded-full bg-amber-500" />
                    <div className="text-amber-700">Local changes (not committed)</div>
                  </li>
                )}
                {fileHistory(file).map((r) => {
                  const rev = { id: r.id, message: r.message, author: r.author, when: formatWhen(r.at, false), files: 1 }
                  return (
                    <RevisionMenu key={r.id} rev={rev}>
                      <li className="relative rounded py-1 hover:bg-zinc-100">
                        <span className="absolute -left-[17px] top-2 size-2 rounded-full bg-zinc-400" />
                        <div className="truncate text-zinc-900">{r.message}</div>
                        <div className="text-zinc-500">{r.author} · {formatWhen(r.at, dev)}{dev && <> · <code>{r.id}</code></>}</div>
                      </li>
                    </RevisionMenu>
                  )
                })}
              </ol>
            </div>
          </div>
        </div>
      )}
    </DetailsPanel>
  )
}

function StagingTab() {
  const p = useProto()
  const dev = p.mode === "developer"
  const [msg, setMsg] = useState("")
  const [selected, setSelected] = useState<string | null>(null)
  const changed = p.files.filter((f) => f.change)
  const staged = changed.filter((f) => f.staged)
  const unstaged = changed.filter((f) => !f.staged)
  const blocked = changed.some((f) => f.lock && f.lock.by !== "you")
  const selectedFile = p.files.find((f) => f.path === selected)
  const Section = ({ title, files, action }: { title: string; files: FileEntry[]; action?: React.ReactNode }) => (
    <section className="rounded-lg border">
      <header className="flex items-center justify-between border-b bg-zinc-50 px-3 py-1.5 text-xs font-medium uppercase text-zinc-500">
        <span>{title} ({files.length})</span>{action}
      </header>
      <div className="divide-y">
        {files.map((f) => (
          <FileLine
            key={f.path}
            file={f}
            checked={dev ? f.staged : f.ticked}
            onCheck={() => (dev ? p.toggleStage(f.path) : p.toggleTick(f.path))}
            selected={selected === f.path}
            onSelect={() => setSelected(selected === f.path ? null : f.path)}
          />
        ))}
      </div>
      {!files.length && <p className="px-3 py-3 text-sm text-zinc-400">Nothing here.</p>}
    </section>
  )
  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
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
      <FileDetails file={selectedFile} onClose={() => setSelected(null)} />
    </div>
  )
}

type HistoryEntry = Revision & { at: number }

const OLDER_HISTORY: HistoryEntry[] = [
  { id: "d1e4b6a0", message: "Footstep variations for gravel", author: "Sam", when: "", files: 9, at: NOW - 5 * DAY },
  { id: "8c72fe31", message: "Hero turnaround sheet", author: "Ana", when: "", files: 3, at: NOW - 9 * DAY },
  { id: "3a90f1b2", message: "Project setup for vertical slice", author: "Marco", when: "", files: 112, at: NOW - 16 * DAY },
  { id: "b07a9d52", message: "Placeholder UI icons", author: "You", when: "", files: 24, at: NOW - 33 * DAY },
  { id: "c55d0e7a", message: "Initial import", author: "Marco", when: "", files: 2048, at: NOW - 64 * DAY },
]

function changedFilesFor(rev: Revision) {
  const seed = rev.id.charCodeAt(0) + rev.id.charCodeAt(1)
  return PROJECT_TREE.filter((_, i) => (i + seed) % 3 === 0).slice(0, Math.max(1, Math.min(rev.files, 4)))
}

function HistoryTab() {
  const p = useProto()
  const dev = p.mode === "developer"
  const [selected, setSelected] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [author, setAuthor] = useState("any")
  const [date, setDate] = useState<DateValue>({ kind: "preset", preset: "any" })
  const entries: HistoryEntry[] = [
    ...p.history.map((r) => ({ ...r, at: r.local || r.when === "just now" ? NOW - 60_000 : FILE_REVS.find((f) => f.id === r.id)?.at ?? NOW })),
    ...OLDER_HISTORY,
  ]
  const authors = [...new Set(entries.map((e) => e.author))].sort()
  const q = query.trim().toLowerCase()
  const dateActive = !(date.kind === "preset" && date.preset === "any")
  const filtering = !!q || author !== "any" || dateActive
  const shown = entries.filter((e) =>
    (!q || e.message.toLowerCase().includes(q) || e.id.startsWith(q)) &&
    (author === "any" || e.author === author) &&
    matchesDate(date, e.at))
  const grid = dev ? "grid-cols-[minmax(8rem,1fr)_4.5rem_7.5rem_4.5rem] gap-x-2" : "grid-cols-[minmax(8rem,1fr)_5rem_6rem] gap-x-2"
  const selectedEntry = shown.find((e) => e.id + e.at === selected)
  return (
    <div className="flex h-full">
    <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search messages or revision ID…" className="h-8 pl-8 pr-8" />
          {query && <button aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-900" onClick={() => setQuery("")}><X className="size-3.5" /></button>}
        </div>
        <div className="relative">
          <Select value={author} onValueChange={setAuthor}>
            <SelectTrigger size="sm" className={cn("w-44", author !== "any" && "[&>svg:last-child]:invisible")}><span className="text-zinc-500">Author:</span><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Anyone</SelectItem>
              {authors.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          {author !== "any" && (
            <button type="button" aria-label="Clear author filter" title="Clear author filter" className="absolute right-1.5 top-1/2 z-10 -translate-y-1/2 rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900" onPointerDown={(e) => e.stopPropagation()} onClick={() => setAuthor("any")}><X className="size-3.5" /></button>
          )}
        </div>
        <DateRangeFilter value={date} onChange={setDate} today={new Date(NOW)} />
      </div>
      <div className="text-xs text-zinc-500">
        {shown.length} of {entries.length} commits on {p.branch}
        {filtering && <button className="ml-2 underline" onClick={() => { setQuery(""); setAuthor("any"); setDate({ kind: "preset", preset: "any" }) }}>Clear filters</button>}
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border">
        <div className={cn("sticky top-0 z-10 grid border-b bg-zinc-50 px-3 py-1.5 text-xs font-medium uppercase text-zinc-500", grid)}>
          <span>Message</span><span>Author</span><span>When</span>{dev && <span>Revision</span>}
        </div>
        {shown.map((r) => {
          const key = r.id + r.at
          const isSel = selected === key
          return (
            <RevisionMenu key={key} rev={r}>
              <button
                onClick={() => setSelected(isSel ? null : key)}
                className={cn("grid w-full items-center border-b px-3 py-2 text-left text-sm last:border-b-0", isSel ? "bg-sky-50 ring-1 ring-inset ring-sky-200" : "hover:bg-zinc-50", grid)}
              >
                <span className="truncate">{r.message} {r.local && <Badge variant="outline" className="ml-1 font-normal">not pushed</Badge>}</span>
                <span className="truncate text-zinc-600">{r.author}</span>
                <span className="text-zinc-500">{formatWhen(r.at, dev)}</span>
                {dev && <code className="text-xs text-zinc-400">{r.id}</code>}
              </button>
            </RevisionMenu>
          )
        })}
        {!shown.length && <p className="px-3 py-4 text-sm text-zinc-400">No commits match these filters.</p>}
      </div>
      </div>
      <CommitDetails entry={selectedEntry} onClose={() => setSelected(null)} />
    </div>
  )
}

function CommitDetails({ entry, onClose }: { entry: HistoryEntry | undefined; onClose: () => void }) {
  const p = useProto()
  const dev = p.mode === "developer"
  const files = entry ? changedFilesFor(entry) : []
  return (
    <DetailsPanel open={!!entry}>
      {entry && (
        <div className="flex h-full w-80 flex-col">
          <div className="flex items-start gap-2 border-b p-3">
            <GitCommitHorizontal className="mt-0.5 size-5 shrink-0 text-zinc-500" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{entry.message}</div>
              <div className="text-xs text-zinc-500">{entry.author} · {formatWhen(entry.at, false)}</div>
            </div>
            <button aria-label="Close commit details" className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900" onClick={onClose}><X className="size-4" /></button>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-auto p-3 text-xs">
            <dl className="grid grid-cols-[6rem_1fr] gap-y-1.5">
              <dt className="text-zinc-500">Author</dt><dd>{entry.author}{dev && ` <${entry.author.toLowerCase()}@studio.local>`}</dd>
              <dt className="text-zinc-500">Date</dt><dd>{new Date(entry.at).toISOString().slice(0, 16).replace("T", " ")}</dd>
              <dt className="text-zinc-500">Branch</dt><dd>{p.branch}</dd>
              <dt className="text-zinc-500">Revision</dt><dd><code>{dev ? `${entry.id}c41e09ab77f3d2e1` : entry.id}</code></dd>
              {dev && <><dt className="text-zinc-500">Parent</dt><dd><code>71cc9b20a8e4…</code></dd><dt className="text-zinc-500">Metadata</dt><dd><code>change-request: none</code></dd></>}
              {entry.local && <><dt className="text-zinc-500">Status</dt><dd className="text-amber-700">Not pushed yet</dd></>}
            </dl>
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => p.say("Restore: choose a file or all files")}>Restore this revision…</Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => p.say("Comparing with previous revision")}>Compare with previous</Button>
            </div>
            <div>
              <div className="mb-1.5 font-medium uppercase text-zinc-500">Files changed ({entry.files})</div>
              <div className="rounded-md border bg-white">
                {files.map((f) => (
                  <FileMenu key={f.path} file={f}>
                    <div className="flex items-center gap-1.5 border-b px-2 py-1.5 last:border-b-0">
                      <FileTypeIcon path={f.path} />
                      <span className={cn("min-w-0 flex-1 truncate", dev ? "font-mono text-[11px]" : "text-xs")}>{dev ? f.path : fileName(f.path)}</span>
                      <LockIcon file={f} />
                    </div>
                  </FileMenu>
                ))}
                {entry.files > files.length && <div className="px-2 py-1.5 text-zinc-400">+ {entry.files - files.length} more</div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </DetailsPanel>
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
const FILE_REVS = [
  { id: "9f3c2a1e", message: "Forest lighting pass", author: "Marco", at: NOW - 2 * HOUR },
  { id: "4b81d0c7", message: "Villain textures v3", author: "Ana", at: NOW - 1 * DAY - 3 * HOUR },
  { id: "e02a77f5", message: "Hero sculpt blockout", author: "You", at: NOW - 1 * DAY - 7 * HOUR },
  { id: "71cc9b20", message: "Import footstep library", author: "Sam", at: NOW - 3 * DAY },
  { id: "3a90f1b2", message: "Project setup for vertical slice", author: "Marco", at: NOW - 16 * DAY },
  { id: "c55d0e7a", message: "Initial import", author: "Marco", at: NOW - 64 * DAY },
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

const PRESET_TESTS: Record<DatePreset, (at: number) => boolean> = {
  any: () => true,
  today: (at) => NOW - at < DAY,
  week: (at) => NOW - at < 7 * DAY,
  month: (at) => NOW - at < 30 * DAY,
  older: (at) => NOW - at >= 30 * DAY,
}

function matchesDate(v: DateValue, at: number) {
  if (v.kind === "preset") return PRESET_TESTS[v.preset](at)
  if (v.from && at < v.from.getTime()) return false
  if (v.to && at >= v.to.getTime() + DAY) return false // "to" is inclusive of that whole day
  return true
}

const COLS = "grid grid-cols-[5.5rem_9rem_6rem_5rem] items-center gap-2 shrink-0"

type TreeProps = { node: Node; depth: number; open: Set<string>; toggle: (path: string) => void; forceOpen: boolean; selected: string | null; onSelect: (path: string) => void }

function TreeNode({ node, depth, open, toggle, forceOpen, selected, onSelect }: TreeProps) {
  const dev = useProto().mode === "developer"
  if (node.file) {
    const f = node.file
    const meta = fileMeta(f)
    return (
      <FileMenu file={f}>
        <div onClick={() => onSelect(f.path)} className={cn("flex cursor-default items-center gap-2 py-1 pr-3", selected === f.path ? "bg-sky-50 ring-1 ring-inset ring-sky-200" : "hover:bg-zinc-50")} style={{ paddingLeft: depth * 16 + 12 }}>
          <FileTypeIcon path={f.path} />
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
      {isOpen && node.children.map((c) => <TreeNode key={c.path} node={c} depth={depth + 1} open={open} toggle={toggle} forceOpen={forceOpen} selected={selected} onSelect={onSelect} />)}
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
  const [dateFilter, setDateFilter] = useState<DateValue>({ kind: "preset", preset: "any" })
  const [revFilter, setRevFilter] = useState("any")
  const q = query.trim().toLowerCase()
  const dateActive = !(dateFilter.kind === "preset" && dateFilter.preset === "any")
  const filtering = !!q || dateActive || revFilter !== "any"
  const matches = all.filter((f) => {
    const meta = fileMeta(f)
    if (q && !f.path.toLowerCase().includes(q)) return false
    if (!matchesDate(dateFilter, meta.at)) return false
    if (revFilter === "working") return meta.rev === null
    if (revFilter !== "any" && !(meta.rev ?? "").startsWith(revFilter)) return false
    return true
  })
  const revOptions = FILE_REVS.map((r) => ({ id: r.id, message: r.message, when: formatWhen(r.at, false) }))
  const tree = useMemo(() => (filtering ? buildTree(matches) : fullTree), [filtering, matches, fullTree])
  const toggle = (path: string) => setOpen((s) => { const n = new Set(s); if (n.has(path)) n.delete(path); else n.add(path); return n })
  const [selected, setSelected] = useState<string | null>(null)
  const selectedFile = all.find((f) => f.path === selected)
  return (
    <div className="flex h-full">
    <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search files…" className="h-8 pl-8" />
        </div>
        <DateRangeFilter value={dateFilter} onChange={setDateFilter} today={new Date(NOW)} />
        <RevisionFilter value={revFilter} onChange={setRevFilter} revisions={revOptions} />
        <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => setOpen(new Set(folderPaths(fullTree)))}><ChevronsUpDown className="size-4" /> Expand all</Button>
        <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => setOpen(new Set())}><ChevronsDownUp className="size-4" /> Collapse all</Button>
      </div>
      <div className="text-xs text-zinc-500">
        {p.mode === "developer" ? `${p.branch} · view filter: Art/**, Audio/**, Content/**, Source/** … · ` : `Files on ${p.branch} · `}
        {matches.length} file{matches.length === 1 ? "" : "s"}{filtering && " matching"}
        {filtering && <button className="ml-2 underline" onClick={() => { setQuery(""); setDateFilter({ kind: "preset", preset: "any" }); setRevFilter("any") }}>Clear filters</button>}
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
          {tree.children.map((c) => <TreeNode key={c.path} node={c} depth={0} open={open} toggle={toggle} forceOpen={filtering} selected={selected} onSelect={(path) => setSelected(selected === path ? null : path)} />)}
          {!tree.children.length && <p className="px-3 py-3 text-sm text-zinc-400">No files match these filters.</p>}
        </div>
      </div>
    </div>
      <FileDetails file={selectedFile} onClose={() => setSelected(null)} />
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
              <TabsTrigger value="staging">Staging {changed > 0 && <Badge className="ml-1 h-4 border-transparent bg-red-100 px-1.5 text-[10px] text-red-700">{changed}</Badge>}</TabsTrigger>
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
