// PROTOTYPE: Variant D, the user's layout. Side panel (logo, project switcher, branches, account) and a tabbed centre: Staging, History, Explorer, Graph.
import { ArrowDownToLine, ArrowUpFromLine, Check, ChevronRight, ChevronsDownUp, ChevronsUpDown, Copy, Feather, FileDiff, Folder, FolderGit2, FolderOpen, FolderTree, GitBranch, GitBranchPlus, GitCommitHorizontal, GitGraph, HistoryIcon, Info, Lock, LogOut, Monitor, Moon, Palette, Plus, ScrollText, Search, Settings, Settings2, SlidersHorizontal, Star, Sun, UserRound, UserRoundPlus, X } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { BranchMenu, ChangeBadge, FileMenu, LoreLog, OperationBar, RevisionMenu } from "./shared"
import { BRANCHES, PROJECT_TREE, fileName, useProto, type FileEntry, type Mode, type Revision } from "./state"
import { FileTypeIcon, typeOf } from "./fileTypes"
import { DateRangeFilter, RevisionFilter, type DatePreset, type DateValue } from "./filters"

type ProjectInfo = { name: string; server: string; url: string; path: string; size: string; branches: number; lastSync: string; defaultBranch: string; viewFilter: string; members: number }
const PROJECTS: ProjectInfo[] = [
  { name: "forest-game", server: "studio.local", url: "lore://studio.local:41337/forest-game", path: "C:\\Users\\you\\Scribe\\forest-game", size: "48.2 GB", branches: 12, lastSync: "2 minutes ago", defaultBranch: "main", viewFilter: "Art/**, Audio/**, Content/**, Source/**", members: 9 },
  { name: "ui-kit", server: "studio.local", url: "lore://studio.local:41337/ui-kit", path: "C:\\Users\\you\\Scribe\\ui-kit", size: "1.3 GB", branches: 4, lastSync: "yesterday", defaultBranch: "main", viewFilter: "everything", members: 3 },
  { name: "cinematics", server: "backup.studio.local", url: "lore://backup.studio.local:41337/cinematics", path: "D:\\Projects\\cinematics", size: "212 GB", branches: 7, lastSync: "5 days ago", defaultBranch: "main", viewFilter: "Shots/**, Edit/**", members: 5 },
]

type Account = { email: string; server: string; initials: string }
const ACCOUNTS: Account[] = [
  { email: "you@studio.local", server: "studio.local", initials: "YO" },
  { email: "you@backup.studio.local", server: "backup.studio.local", initials: "YB" },
  { email: "kim@freelance.games", server: "lore.freelance.games", initials: "KF" },
]

function Avatar({ initials, className, style }: { initials: string; className?: string; style?: React.CSSProperties }) {
  return <span className={cn("grid size-6 shrink-0 place-items-center rounded-full bg-zinc-900 text-[10px] font-semibold text-white", className)} style={style}>{initials}</span>
}

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
  const dev = p.mode === "developer"
  const [project, setProject] = useState(PROJECTS[0].name)
  const [account, setAccount] = useState(ACCOUNTS[0])
  const [settings, setSettings] = useState<SettingsSection | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [favOnly, setFavOnly] = useState(false)
  const [favorites, setFavorites] = useState(() => new Set(["release/1.2"]))
  const [branches, setBranches] = useState(BRANCHES)
  const [newFrom, setNewFrom] = useState<string | null>(null)
  const [infoFor, setInfoFor] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (searchOpen) inputRef.current?.focus() }, [searchOpen])
  const info = PROJECTS.find((pr) => pr.name === project)!

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
  const switchAccount = (a: Account) => { setAccount(a); p.say(`Switched to ${a.email}`) }
  const q = searchOpen ? search.trim().toLowerCase() : ""
  const visible = branches.filter((b) => (!q || b.toLowerCase().includes(q)) && (!favOnly || favorites.has(b)))
  const favs = visible.filter((b) => favorites.has(b))
  const rest = visible.filter((b) => !favorites.has(b))

  const row = (b: string) => (
    <BranchMenu key={b} name={b} favorite={favorites.has(b)} onToggleFavorite={() => toggleFav(b)} onCreateFrom={() => setNewFrom(b)} onInfo={() => setInfoFor(b)}>
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
      <div className="flex items-center gap-2 border-b px-3 py-3">
        <span className="grid size-7 place-items-center rounded-lg bg-zinc-900 text-white"><Feather className="size-4" /></span>
        <span className="text-base font-semibold tracking-tight">Scribe</span>
        <span className="ml-auto rounded border px-1.5 py-px text-[10px] text-zinc-400">for Lore</span>
      </div>
      <div className="border-b p-3">
        <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">Project</div>
        <div className="flex items-center gap-1">
          <Select
            value={project}
            onValueChange={(v) => {
              if (v === "__clone") return p.say("Clone or open a project…")
              if (v === "__manage") return setSettings("projects")
              setProject(v)
              p.say("Opened " + v)
            }}
          >
            <SelectTrigger className="min-w-0 flex-1 bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PROJECTS.map((pr) => <SelectItem key={pr.name} value={pr.name}>{pr.name}</SelectItem>)}
              <SelectSeparator />
              <SelectItem value="__clone"><Plus /> Clone or open a project…</SelectItem>
              <SelectItem value="__manage"><Settings /> Manage projects…</SelectItem>
            </SelectContent>
          </Select>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button aria-label="Project information" className="grid size-8 shrink-0 place-items-center rounded-md text-zinc-400 hover:bg-zinc-200/60 hover:text-zinc-900"><Info className="size-4" /></button>
              </TooltipTrigger>
              <TooltipContent side="right" align="start" className="w-96 max-w-none p-3">
                <div className="mb-2 text-sm font-semibold">{info.name}</div>
                <dl className="grid grid-cols-[5.5rem_1fr] gap-x-2 gap-y-1 text-xs">
                  <dt className="opacity-60">Server</dt><dd>{info.server}</dd>
                  <dt className="opacity-60">Address</dt><dd className="break-all font-mono text-[11px]">{info.url}</dd>
                  <dt className="opacity-60">Local folder</dt><dd className="break-all font-mono text-[11px]">{info.path}</dd>
                  <dt className="opacity-60">Size on disk</dt><dd>{info.size}</dd>
                  <dt className="opacity-60">Branches</dt><dd>{info.branches}</dd>
                  <dt className="opacity-60">Members</dt><dd>{info.members}</dd>
                  <dt className="opacity-60">Last synced</dt><dd>{info.lastSync}</dd>
                  {dev && <><dt className="opacity-60">View filter</dt><dd className="font-mono text-[11px]">{info.viewFilter}</dd></>}
                </dl>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
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
        <Button size="icon" variant="ghost" title="New branch" className="size-6" onClick={() => setNewFrom(p.branch)}><Plus className="size-3.5" /></Button>
      </div>
      <NewBranchDialog
        base={newFrom}
        branches={branches}
        onClose={() => setNewFrom(null)}
        onCreate={(name, base, switchNow) => {
          setBranches((bs) => [...bs, name])
          setNewFrom(null)
          if (switchNow) { p.setBranch(name); p.say(`Created ${name} from ${base} and switched to it`) }
          else p.say(`Created ${name} from ${base}`)
        }}
      />
      <BranchInfoDialog
        name={infoFor}
        favorite={!!infoFor && favorites.has(infoFor)}
        onClose={() => setInfoFor(null)}
        onSwitch={(b) => { setInfoFor(null); switchTo(b) }}
      />
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
      <div className="flex items-center gap-1 border-t p-2">
        <AccountMenu account={account} onSwitch={switchAccount} onOpenAccounts={() => setSettings("account")} />
        <Button variant="ghost" size="sm" className="shrink-0 gap-2 text-zinc-600" onClick={() => setSettings("general")}><Settings className="size-4" /> Settings</Button>
      </div>
      <SettingsDialog
        section={settings}
        onSection={setSettings}
        account={account}
        onSwitchAccount={switchAccount}
        project={project}
        onOpenProject={(name) => { setProject(name); setSettings(null); p.say("Opened " + name) }}
      />
    </aside>
  )
}

function AccountMenu({ account, onSwitch, onOpenAccounts }: { account: Account; onSwitch: (a: Account) => void; onOpenAccounts: () => void }) {
  const p = useProto()
  const [open, setOpen] = useState(false)
  const item = "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-zinc-100 [&_svg]:size-4 [&_svg]:text-zinc-500"
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-zinc-200/60" title={`${account.email} on ${account.server}`}>
          <Avatar initials={account.initials} />
          <span className="min-w-0 flex-1 truncate text-sm text-zinc-700">{account.email.split("@")[0]}</span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-zinc-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-72 p-1">
        <div className="px-2 pb-1 pt-1.5 text-xs font-medium text-zinc-500">Switch account</div>
        {ACCOUNTS.map((a) => (
          <button key={a.email} className={item} onClick={() => { setOpen(false); if (a.email !== account.email) onSwitch(a) }}>
            <Avatar initials={a.initials} className={cn(a.email !== account.email && "bg-zinc-400")} />
            <span className="min-w-0 flex-1">
              <span className="block truncate">{a.email}</span>
              <span className="block truncate text-xs text-zinc-500">{a.server}</span>
            </span>
            {a.email === account.email && <Check className="text-zinc-900!" />}
          </button>
        ))}
        <div className="-mx-1 my-1 border-t" />
        <button className={item} onClick={() => { setOpen(false); p.say("Opening sign-in in your browser…") }}><UserRoundPlus /> Add account…</button>
        <button className={item} onClick={() => { setOpen(false); onOpenAccounts() }}><UserRound /> Accounts…</button>
        <button className={item} onClick={() => { setOpen(false); p.say(`Signed out of ${account.server}`) }}><LogOut /> Sign out</button>
      </PopoverContent>
    </Popover>
  )
}

/** Right-click a branch → Branch information… Facts come from the mock graph where the branch has commits there. */
function BranchInfoDialog({ name, favorite, onClose, onSwitch }: { name: string | null; favorite: boolean; onClose: () => void; onSwitch: (b: string) => void }) {
  const p = useProto()
  const dev = p.mode === "developer"
  const b = name ?? ""
  const own = GRAPH_COMMITS.filter((cm) => cm.branch === b)
  const mainHead = GRAPH_COMMITS.find((cm) => cm.branch === "main")!
  const head = own[0] ?? mainHead
  const oldest = own[own.length - 1]
  const baseCommit = oldest ? GRAPH_COMMITS.find((cm) => cm.id === oldest.parents[0]) : mainHead
  const isMain = b === "main"
  const behind = baseCommit && !isMain ? GRAPH_COMMITS.filter((cm) => cm.branch === "main" && cm.at > baseCommit.at).length : 0
  const mergedInto = own.length ? GRAPH_COMMITS.find((cm) => cm.branch !== b && cm.parents.slice(1).includes(head.id))?.branch : undefined
  const contributors = [...new Set((own.length ? own : [head]).map((cm) => cm.author))]
  const createdBy = oldest?.author ?? "You"
  const createdAt = oldest?.at ?? NOW - 10 * 60_000
  const isProtected = isMain || b.startsWith("release/")
  const locks = b === p.branch ? p.files.concat(PROJECT_TREE).filter((f, i, a) => f.lock && a.findIndex((g) => g.path === f.path) === i).length : own.length ? (own.length * 3) % 5 : 0
  const Fact = ({ label, children }: { label: string; children: React.ReactNode }) => <><dt className="text-zinc-500">{label}</dt><dd className="min-w-0">{children}</dd></>
  return (
    <Dialog open={name !== null} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ background: branchColor(b) }} />
            <span className="truncate">{b}</span>
            {b === p.branch && <Badge variant="secondary" className="font-normal">current</Badge>}
            {favorite && <Star className="size-4 fill-amber-400 text-amber-500" />}
          </DialogTitle>
          <DialogDescription>
            {isMain ? "The project's default branch." : `Started from ${baseCommit?.branch ?? "main"} by ${createdBy}, ${formatWhen(createdAt, false)}.`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-3 gap-2">
            {[
              [own.length || 0, own.length === 1 ? "commit" : "commits"],
              [isMain ? "–" : behind, isMain ? "default branch" : `behind main`],
              [locks, locks === 1 ? "locked file" : "locked files"],
            ].map(([n, l]) => (
              <div key={l as string} className="rounded-lg border bg-zinc-50 px-3 py-2">
                <div className="text-lg font-semibold">{n}</div>
                <div className="text-xs text-zinc-500">{l}</div>
              </div>
            ))}
          </div>
          <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 text-xs">
            <Fact label="Latest commit">
              <div className="truncate">{head.message}</div>
              <div className="text-zinc-500">{head.author} · {formatWhen(head.at, false)}{dev && <> · <code>{head.id}</code></>}</div>
            </Fact>
            {!isMain && <Fact label="Started from">{baseCommit?.branch ?? "main"}{dev && baseCommit && <> at <code>{baseCommit.id}</code></>}</Fact>}
            {!isMain && <Fact label="Created">{createdBy}, {new Date(createdAt).toISOString().slice(0, 16).replace("T", " ")}</Fact>}
            <Fact label="Merged">{isMain ? "–" : mergedInto ? <span className="text-emerald-700">Yes, into {mergedInto}</span> : "Not merged yet"}</Fact>
            <Fact label="Protected">{isProtected ? "Yes: changes need a review before they land" : "No"}</Fact>
            <Fact label="Contributors">
              <span className="flex flex-wrap items-center gap-1">
                {contributors.map((a) => <span key={a} className="flex items-center gap-1 rounded-full border py-px pl-px pr-2"><Avatar initials={a.slice(0, 2).toUpperCase()} className="size-4 text-[8px]" style={{ background: branchColor(a) }} />{a}</span>)}
              </span>
            </Fact>
            {dev && <Fact label="Ref"><code>refs/branches/{b}</code></Fact>}
          </dl>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => p.say("Copied " + b)}><Copy className="size-4" /> Copy name</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Close</Button>
            <Button disabled={b === p.branch} onClick={() => onSwitch(b)}>Switch to this branch</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

function CommitDetails({ entry, branch, onClose }: { entry: HistoryEntry | undefined; branch?: string; onClose: () => void }) {
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
              <dt className="text-zinc-500">Branch</dt><dd>{branch ?? p.branch}</dd>
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
  const [lockedOnly, setLockedOnly] = useState(false)
  const q = query.trim().toLowerCase()
  const dateActive = !(dateFilter.kind === "preset" && dateFilter.preset === "any")
  const filtering = !!q || dateActive || revFilter !== "any" || lockedOnly
  const lockedCount = all.filter((f) => f.lock).length
  const matches = all.filter((f) => {
    const meta = fileMeta(f)
    if (lockedOnly && !f.lock) return false
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
        <Button
          size="sm" variant="outline" aria-pressed={lockedOnly}
          className={cn("h-8 gap-1.5", lockedOnly && "border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800")}
          onClick={() => setLockedOnly(!lockedOnly)}
        ><Lock className="size-4" /> Show locked <span className={cn("rounded px-1 text-[10px]", lockedOnly ? "bg-red-100" : "bg-zinc-100 text-zinc-500")}>{lockedCount}</span></Button>
        <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => setOpen(new Set(folderPaths(fullTree)))}><ChevronsUpDown className="size-4" /> Expand all</Button>
        <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => setOpen(new Set())}><ChevronsDownUp className="size-4" /> Collapse all</Button>
      </div>
      <div className="text-xs text-zinc-500">
        {p.mode === "developer" ? `${p.branch} · view filter: Art/**, Audio/**, Content/**, Source/** … · ` : `Files on ${p.branch} · `}
        {matches.length} file{matches.length === 1 ? "" : "s"}{filtering && " matching"}
        {filtering && <button className="ml-2 underline" onClick={() => { setQuery(""); setDateFilter({ kind: "preset", preset: "any" }); setRevFilter("any"); setLockedOnly(false) }}>Clear filters</button>}
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

const PREFIXES = ["feature/", "art/", "bugfix/", "experiment/"]

/** Branch-name rules here are a guess at sensible ones, not Lore's actual validation. */
function branchNameError(name: string, existing: string[]) {
  if (!name) return null
  if (/\s/.test(name)) return "No spaces. Use - or / instead."
  if (name.startsWith("/") || name.endsWith("/") || name.includes("//") || name.includes("..")) return "That isn't a valid branch name."
  if (existing.includes(name)) return "A branch with this name already exists."
  return null
}

/** Opened by the + in the side panel (base = current branch) or "New branch from here…" on a branch's context menu. */
function NewBranchDialog({ base, branches, onClose, onCreate }: { base: string | null; branches: string[]; onClose: () => void; onCreate: (name: string, base: string, switchNow: boolean) => void }) {
  const p = useProto()
  const dev = p.mode === "developer"
  const [name, setName] = useState("")
  const [from, setFrom] = useState(base ?? p.branch)
  const [switchNow, setSwitchNow] = useState(true)
  useEffect(() => { if (base) { setName(""); setFrom(base); setSwitchNow(true) } }, [base])

  const trimmed = name.trim()
  const error = branchNameError(trimmed, branches)
  const changed = p.files.filter((f) => f.change).length
  const dirty = changed > 0 || p.unpushed > 0
  // Changes come along only when branching from where you are; otherwise switching would leave them behind.
  const blocked = switchNow && dirty && from !== p.branch
  const canCreate = !!trimmed && !error && !blocked
  const submit = () => { if (canCreate) onCreate(trimmed, from, switchNow) }

  return (
    <Dialog open={base !== null} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><GitBranchPlus className="size-5" /> New branch</DialogTitle>
          <DialogDescription>Make a separate line of work. Nothing changes on {from} until you merge it back.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit() }}>
          <div className="space-y-1.5">
            <Label htmlFor="new-branch-name">Name</Label>
            <Input
              id="new-branch-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="feature/my-change"
              className={cn("font-mono text-sm", error && "border-red-400 focus-visible:ring-red-200")}
              aria-invalid={!!error}
            />
            {error
              ? <p className="text-xs text-red-600">{error}</p>
              : (
                <div className="flex flex-wrap gap-1">
                  {PREFIXES.map((pre) => (
                    <button
                      key={pre} type="button"
                      onClick={() => setName(pre + name.replace(/^[a-z]+\//, ""))}
                      className="rounded border bg-zinc-50 px-1.5 py-0.5 font-mono text-[11px] text-zinc-600 hover:bg-zinc-100"
                    >{pre}</button>
                  ))}
                </div>
              )}
          </div>
          <div className="space-y-1.5">
            <Label>Start from</Label>
            <Select value={from} onValueChange={setFrom}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b} value={b}>
                    <GitBranch className="size-3.5" /> {b}{b === p.branch && <span className="text-xs text-zinc-400">(current)</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {dev && <p className="font-mono text-[11px] text-zinc-400">at latest revision of {from} · lore branch create {trimmed || "<name>"} --from {from}</p>}
          </div>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={switchNow} onCheckedChange={(v) => setSwitchNow(v === true)} className="mt-0.5" />
            <span>
              Switch to it now
              {switchNow && dirty && !blocked && <span className="block text-xs text-zinc-500">Your {changed ? `${changed} changed file${changed === 1 ? "" : "s"}` : "unpushed commits"} come with you.</span>}
              {blocked && <span className="block text-xs text-amber-700">You have changes on {p.branch}. Commit them first, start from {p.branch}, or untick this to create the branch without switching.</span>}
            </span>
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!canCreate}>Create branch</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

type SettingsSection = "general" | "account" | "projects" | "theme"
const SETTINGS_NAV: [SettingsSection, string, typeof Settings][] = [["general", "General", SlidersHorizontal], ["account", "Account", UserRound], ["projects", "Projects", FolderGit2], ["theme", "Theme", Palette]]
const SETTINGS_BLURB: Record<SettingsSection, string> = {
  general: "How Scribe behaves in every project.",
  account: "Who you're signed in as, and where.",
  projects: "Every project on this computer. Open, configure or remove them.",
  theme: "How Scribe looks. Applies right away.",
}
const ACCENTS = ["#18181b", "#0284c7", "#7c3aed", "#059669", "#e11d48", "#d97706"]
const SERVERS = [...new Set(ACCOUNTS.map((a) => a.server))]

type SettingsProps = {
  section: SettingsSection | null
  onSection: (s: SettingsSection | null) => void
  account: Account
  onSwitchAccount: (a: Account) => void
  project: string
  onOpenProject: (name: string) => void
}

/** Opened from the side panel's Settings button, the Account menu (→ Account) or the project switcher (→ Projects). */
function SettingsDialog({ section, onSection, account, onSwitchAccount, project, onOpenProject }: SettingsProps) {
  const p = useProto()
  const [strategy, setStrategy] = useState("file")
  const [theme, setTheme] = useState<"system" | "light" | "dark">("system")
  const [accent, setAccent] = useState(ACCENTS[0])
  const [density, setDensity] = useState("comfortable")
  const [separateProfile, setSeparateProfile] = useState(false)
  // Keep showing the last page while the dialog animates closed.
  const last = useRef<SettingsSection>("general")
  if (section) last.current = section
  const current = last.current
  const title = SETTINGS_NAV.find(([k]) => k === current)![1]
  const block = "space-y-2 border-b pb-5 last:border-b-0"
  return (
    <Dialog open={section !== null} onOpenChange={(o) => { if (!o) onSection(null) }}>
      <DialogContent className="flex h-[34rem] gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <nav className="flex w-48 shrink-0 flex-col gap-0.5 border-r bg-zinc-50/80 p-3">
          <DialogTitle className="px-2 pb-3 pt-1 text-base">Settings</DialogTitle>
          {SETTINGS_NAV.map(([k, l, Icon]) => (
            <button
              key={k}
              onClick={() => onSection(k)}
              className={cn("flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm", current === k ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-200/60")}
            ><Icon className="size-4" /> {l}</button>
          ))}
        </nav>
        <div className="flex min-w-0 flex-1 flex-col">
          <DialogHeader className="border-b px-6 py-4 text-left">
            <div className="text-lg font-semibold">{title}</div>
            <DialogDescription>{SETTINGS_BLURB[current]}</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-5 overflow-auto px-6 py-5 text-sm">
            {current === "general" && (
              <>
                <section className={block}>
                  <div className="font-medium">Mode</div>
                  <RadioGroup value={p.mode} onValueChange={(v) => p.setMode(v as Mode)} className="flex gap-4">
                    <Label className="font-normal"><RadioGroupItem value="artist" /> Artist</Label>
                    <Label className="font-normal"><RadioGroupItem value="developer" /> Developer</Label>
                  </RadioGroup>
                </section>
                <section className={block}>
                  <div className="font-medium">Conflict resolution strategy</div>
                  <RadioGroup value={strategy} onValueChange={setStrategy} className="space-y-1">
                    <Label className="font-normal"><RadioGroupItem value="file" /> Decide file by file (Keep mine / Use theirs)</Label>
                    <Label className="font-normal"><RadioGroupItem value="branch" /> Move my work to a branch first</Label>
                  </RadioGroup>
                </section>
                <section className={block}>
                  <div className="font-medium">Auto-lock patterns</div>
                  <p className="text-xs text-zinc-500">Shared patterns come from this project's <code>.scribelock</code>. Add your own local ones here.</p>
                  <Input placeholder="e.g. *.kra" className="font-mono text-xs" />
                </section>
                <section className={block}>
                  <div className="font-medium">Projects folder</div>
                  <p className="text-xs text-zinc-500">Where new projects are cloned to.</p>
                  <div className="flex gap-2">
                    <Input readOnly value="C:\Users\you\Scribe" className="font-mono text-xs" />
                    <Button variant="outline" className="shrink-0" onClick={() => p.say("Folder picker")}>Change…</Button>
                  </div>
                </section>
              </>
            )}
            {current === "account" && (
              <>
                <section className={cn(block, "flex items-center gap-3 space-y-0")}>
                  <Avatar initials={account.initials} className="size-11 text-sm" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{account.email}</div>
                    <div className="text-xs text-zinc-500">Signed in to <b>{account.server}</b></div>
                  </div>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => p.say(`Signed out of ${account.server}`)}><LogOut className="size-4" /> Sign out</Button>
                </section>
                <section className={block}>
                  <div className="font-medium">Accounts on this computer</div>
                  <div className="rounded-md border">
                    {ACCOUNTS.map((a) => (
                      <div key={a.email} className="flex items-center gap-2 border-b px-3 py-2 last:border-b-0">
                        <Avatar initials={a.initials} className={cn(a.email !== account.email && "bg-zinc-400")} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{a.email}</span>
                          <span className="block text-xs text-zinc-500">{a.server}</span>
                        </span>
                        {a.email === account.email
                          ? <Badge variant="secondary" className="font-normal">In use</Badge>
                          : <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onSwitchAccount(a)}>Switch</Button>}
                      </div>
                    ))}
                  </div>
                  <Button size="sm" variant="ghost" className="gap-1.5 px-1 text-zinc-600" onClick={() => p.say("Opening sign-in in your browser…")}><UserRoundPlus className="size-4" /> Add account</Button>
                </section>
                <section className={block}>
                  <div className="font-medium">Lore Servers</div>
                  <div className="rounded-md border">
                    {SERVERS.map((host) => {
                      const signedIn = host !== "lore.freelance.games"
                      return (
                        <div key={host} className="flex items-center gap-2 border-b px-3 py-2 last:border-b-0">
                          <span className={cn("size-2 rounded-full", signedIn ? "bg-emerald-500" : "bg-zinc-300")} />
                          <span className="flex-1">{host}</span>
                          <span className="text-xs text-zinc-500">{signedIn ? "Signed in" : "Sign-in expired"}</span>
                          {!signedIn && <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => p.say("Opening sign-in in your browser…")}>Sign in</Button>}
                        </div>
                      )
                    })}
                  </div>
                  <Button size="sm" variant="ghost" className="gap-1.5 px-1 text-zinc-600" onClick={() => p.say("Add a Lore Server")}><Plus className="size-4" /> Add a server</Button>
                </section>
                <section className={block}>
                  <div className="font-medium">Lore profile</div>
                  <Label className="font-normal"><Checkbox checked={separateProfile} onCheckedChange={(v) => setSeparateProfile(v === true)} /> Use a separate Lore profile (keep my sign-in apart from the Lore CLI)</Label>
                  <p className="text-xs text-zinc-500">{separateProfile ? "Scribe keeps its own sign-in. Signing out here won't sign the CLI out." : "Scribe and the Lore CLI share one sign-in. Signing out here signs the CLI out too."}</p>
                </section>
              </>
            )}
            {current === "projects" && <ProjectsSettings project={project} onOpenProject={onOpenProject} />}
            {current === "theme" && (
              <>
                <section className={block}>
                  <div className="font-medium">Appearance</div>
                  <div className="grid grid-cols-3 gap-3">
                    {([["system", "System", Monitor], ["light", "Light", Sun], ["dark", "Dark", Moon]] as const).map(([k, l, Icon]) => (
                      <button key={k} onClick={() => setTheme(k)} className={cn("overflow-hidden rounded-lg border text-left", theme === k ? "ring-2 ring-zinc-900 ring-offset-1" : "hover:border-zinc-400")}>
                        <div className={cn("flex h-16 gap-1 p-2", k === "dark" ? "bg-zinc-900" : k === "light" ? "bg-white" : "bg-gradient-to-r from-white from-50% to-zinc-900 to-50%")}>
                          <div className={cn("w-1/3 rounded", k === "dark" ? "bg-zinc-700" : "bg-zinc-200")} />
                          <div className="flex flex-1 flex-col gap-1">
                            <div className={cn("h-2 rounded", k === "dark" ? "bg-zinc-600" : "bg-zinc-300")} />
                            <div className={cn("h-2 w-2/3 rounded", k === "light" ? "bg-zinc-200" : "bg-zinc-500")} />
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 border-t px-2 py-1.5 text-xs"><Icon className="size-3.5" /> {l}</div>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-zinc-400">Prototype: the choice is remembered, but the mockup stays light.</p>
                </section>
                <section className={block}>
                  <div className="font-medium">Accent colour</div>
                  <div className="flex gap-2">
                    {ACCENTS.map((a) => (
                      <button key={a} aria-label={`Accent ${a}`} onClick={() => setAccent(a)} className={cn("size-7 rounded-full", accent === a && "ring-2 ring-zinc-400 ring-offset-2")} style={{ background: a }} />
                    ))}
                  </div>
                </section>
                <section className={block}>
                  <div className="font-medium">Density</div>
                  <RadioGroup value={density} onValueChange={setDensity} className="flex gap-4">
                    <Label className="font-normal"><RadioGroupItem value="comfortable" /> Comfortable</Label>
                    <Label className="font-normal"><RadioGroupItem value="compact" /> Compact</Label>
                  </RadioGroup>
                </section>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Settings → Projects: one row per project; click a row to expand its info and settings. */
function ProjectsSettings({ project, onOpenProject }: { project: string; onOpenProject: (name: string) => void }) {
  const p = useProto()
  const dev = p.mode === "developer"
  const [expanded, setExpanded] = useState<string | null>(project)
  const [autoSync, setAutoSync] = useState<Record<string, boolean>>({ "forest-game": true })
  const [defaults, setDefaults] = useState<Record<string, string>>({})
  const [removing, setRemoving] = useState<string | null>(null)
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => p.say("Clone a project…")}><Plus className="size-4" /> Clone a project…</Button>
        <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => p.say("Open a folder…")}><FolderOpen className="size-4" /> Open a folder…</Button>
      </div>
      <div className="rounded-lg border">
        {PROJECTS.map((pr) => {
          const isOpen = expanded === pr.name
          const isCurrent = pr.name === project
          return (
            <div key={pr.name} className="border-b last:border-b-0">
              <button className={cn("flex w-full items-center gap-3 px-3 py-2.5 text-left", isOpen ? "bg-zinc-50" : "hover:bg-zinc-50")} onClick={() => setExpanded(isOpen ? null : pr.name)}>
                <ChevronRight className={cn("size-4 shrink-0 text-zinc-400 transition-transform", isOpen && "rotate-90")} />
                <FolderGit2 className="size-4 shrink-0 text-zinc-500" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 font-medium">{pr.name}{isCurrent && <Badge variant="secondary" className="font-normal">open</Badge>}</span>
                  <span className="block truncate text-xs text-zinc-500">{pr.server} · {pr.size} · synced {pr.lastSync}</span>
                </span>
              </button>
              {isOpen && (
                <div className="space-y-4 border-t bg-white px-4 py-3 pl-10 text-xs">
                  <dl className="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-1.5">
                    <dt className="text-zinc-500">Server</dt><dd>{pr.server}</dd>
                    <dt className="text-zinc-500">Address</dt><dd className="break-all font-mono text-[11px]">{pr.url}</dd>
                    <dt className="text-zinc-500">Local folder</dt><dd className="break-all font-mono text-[11px]">{pr.path}</dd>
                    <dt className="text-zinc-500">Size on disk</dt><dd>{pr.size}</dd>
                    <dt className="text-zinc-500">Branches</dt><dd>{pr.branches}</dd>
                    <dt className="text-zinc-500">Members</dt><dd>{pr.members}</dd>
                    <dt className="text-zinc-500">Last synced</dt><dd>{pr.lastSync}</dd>
                  </dl>
                  <div className="grid grid-cols-[6.5rem_1fr] items-center gap-x-3 gap-y-2">
                    <span className="text-zinc-500">Open on</span>
                    <Select value={defaults[pr.name] ?? pr.defaultBranch} onValueChange={(v) => setDefaults({ ...defaults, [pr.name]: v })}>
                      <SelectTrigger size="sm" className="w-48"><SelectValue /></SelectTrigger>
                      <SelectContent>{["main", "release/1.2", "Last used branch"].map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                    </Select>
                    <span className="text-zinc-500">Sync</span>
                    <Label className="text-xs font-normal"><Checkbox checked={!!autoSync[pr.name]} onCheckedChange={(v) => setAutoSync({ ...autoSync, [pr.name]: v === true })} /> Sync automatically when the project opens</Label>
                    <span className="text-zinc-500">View filter</span>
                    <span className="flex items-center gap-2">
                      <code className="truncate text-[11px]">{pr.viewFilter}</code>
                      {dev && <Button size="sm" variant="ghost" className="h-6 px-1.5 text-xs" onClick={() => p.say("Edit view filter file")}>Edit…</Button>}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                    <Button size="sm" disabled={isCurrent} onClick={() => onOpenProject(pr.name)}>{isCurrent ? "Open now" : "Open"}</Button>
                    <Button size="sm" variant="outline" onClick={() => p.say("Showing " + pr.path)}>Show in folder</Button>
                    <Button size="sm" variant="outline" onClick={() => p.say("Moving " + pr.name + "…")}>Move…</Button>
                    {removing === pr.name ? (
                      <span className="ml-auto flex items-center gap-2">
                        <span className="text-zinc-600">Remove from Scribe? Files stay on disk.</span>
                        <Button size="sm" variant="ghost" onClick={() => setRemoving(null)}>Cancel</Button>
                        <Button size="sm" variant="destructive" onClick={() => { setRemoving(null); p.say(`Removed ${pr.name} from Scribe`) }}>Remove</Button>
                      </span>
                    ) : (
                      <Button size="sm" variant="ghost" className="ml-auto text-red-600 hover:bg-red-50 hover:text-red-700" disabled={isCurrent} title={isCurrent ? "Switch to another project first" : undefined} onClick={() => setRemoving(pr.name)}>Remove from Scribe…</Button>
                    )}
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

// ---- Graph tab: every branch and commit as a lane graph. Mock DAG; the lane layout is the real algorithm in miniature.

type GraphCommit = HistoryEntry & { branch: string; parents: string[]; working?: boolean }

const BRANCH_COLORS: Record<string, string> = {
  main: "#0284c7", "release/1.2": "#7c3aed", "feature/new-hero": "#e11d48", "art/env-pass": "#059669", "bugfix/crash-on-load": "#d97706",
}
const EXTRA_COLORS = ["#0d9488", "#4f46e5", "#c026d3", "#65a30d", "#ea580c"]
function branchColor(b: string) {
  if (BRANCH_COLORS[b]) return BRANCH_COLORS[b]
  let h = 0
  for (const c of b) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return EXTRA_COLORS[h % EXTRA_COLORS.length]
}

const c = (id: string, branch: string, message: string, author: string, at: number, parents: string[], files = 3): GraphCommit =>
  ({ id, branch, message, author, at, parents, files, when: "" })

// Newest first. Ids that also appear in History reuse History's ids.
const GRAPH_COMMITS: GraphCommit[] = [
  c("9f3c2a1e", "main", "Forest lighting pass", "Marco", NOW - 2 * HOUR, ["5d0b8e44"], 12),
  c("a41f7c09", "feature/new-hero", "Hero rig: facial controls", "You", NOW - 5 * HOUR, ["e02a77f5"], 2),
  c("5d0b8e44", "main", "Merge art/env-pass into main", "Marco", NOW - 8 * HOUR, ["4b81d0c7", "f7e2a913"], 21),
  c("f7e2a913", "art/env-pass", "Rock and moss textures", "Ana", NOW - 20 * HOUR, ["2c6d1b70"], 8),
  c("4b81d0c7", "main", "Villain textures v3", "Ana", NOW - 1 * DAY - 3 * HOUR, ["71cc9b20"], 4),
  c("0be93d6f", "release/1.2", "Merge bugfix/crash-on-load into release/1.2", "Marco", NOW - 1 * DAY - 5 * HOUR, ["6a1e40d2", "93c7f05b"], 1),
  c("e02a77f5", "feature/new-hero", "Hero sculpt blockout", "You", NOW - 1 * DAY - 7 * HOUR, ["1f84c2ad"], 2),
  c("93c7f05b", "bugfix/crash-on-load", "Fix crash when forest.umap loads without textures", "Sam", NOW - 1 * DAY - 10 * HOUR, ["6a1e40d2"], 1),
  c("2c6d1b70", "art/env-pass", "Forest tile set 03", "Ana", NOW - 2 * DAY, ["e8b5a6c1"], 6),
  c("71cc9b20", "main", "Import footstep library", "Sam", NOW - 3 * DAY, ["d1e4b6a0"], 38),
  c("1f84c2ad", "feature/new-hero", "Start hero rework", "You", NOW - 4 * DAY, ["d1e4b6a0"], 3),
  c("6a1e40d2", "release/1.2", "Release 1.2 candidate", "Marco", NOW - 4 * DAY - 6 * HOUR, ["d1e4b6a0"], 2),
  c("d1e4b6a0", "main", "Footstep variations for gravel", "Sam", NOW - 5 * DAY, ["8c72fe31"], 9),
  c("e8b5a6c1", "art/env-pass", "Environment pass: blockout", "Ana", NOW - 7 * DAY, ["8c72fe31"], 14),
  c("8c72fe31", "main", "Hero turnaround sheet", "Ana", NOW - 9 * DAY, ["3a90f1b2"], 3),
  c("3a90f1b2", "main", "Project setup for vertical slice", "Marco", NOW - 16 * DAY, ["b07a9d52"], 112),
  c("b07a9d52", "main", "Placeholder UI icons", "You", NOW - 33 * DAY, ["c55d0e7a"], 24),
  c("c55d0e7a", "main", "Initial import", "Marco", NOW - 64 * DAY, [], 2048),
]

type Edge = { from: number; to: number; fromLane: number; via: number; toLane: number; branch: string }

/** Classic lane assignment: walk newest → oldest, each lane "expects" a commit id. A first parent keeps the child's lane
 *  (so a branch stays in its column until it forks off); extra parents (merges) get their own lane straight away. */
function layout(commits: GraphCommit[]) {
  const lanes: (string | null)[] = []
  const laneOf = new Map<string, number>()
  const row = new Map(commits.map((cm, i) => [cm.id, i]))
  const pending: { child: number; parent: string; via: number; branch: string }[] = []
  commits.forEach((cm, i) => {
    let lane = lanes.indexOf(cm.id)
    if (lane === -1) { lane = lanes.indexOf(null); if (lane === -1) lane = lanes.push(null) - 1 }
    lanes.forEach((v, j) => { if (v === cm.id) lanes[j] = null })
    laneOf.set(cm.id, lane)
    cm.parents.filter((pid) => row.has(pid)).forEach((pid, k) => {
      const parentBranch = commits[row.get(pid)!].branch
      if (k === 0) { lanes[lane] = pid; pending.push({ child: i, parent: pid, via: lane, branch: cm.branch }); return }
      let via = lanes.indexOf(pid)
      if (via === -1) { via = lanes.indexOf(null); if (via === -1) via = lanes.length; lanes[via] = pid }
      pending.push({ child: i, parent: pid, via, branch: parentBranch })
    })
  })
  const edges: Edge[] = pending.map((e) => ({ from: e.child, to: row.get(e.parent)!, fromLane: laneOf.get(commits[e.child].id)!, via: e.via, toLane: laneOf.get(e.parent)!, branch: e.branch }))
  return { laneOf, edges, width: Math.max(1, ...laneOf.values()) + 1 }
}

const ROW_H = 36
const LANE_W = 18
const laneX = (l: number) => 14 + l * LANE_W
const rowY = (r: number) => r * ROW_H + ROW_H / 2

/** Curve out of the child's lane in the first row if needed, run down the reserved lane, curve into the parent's lane in the last row. */
function edgePath(e: Edge) {
  const x1 = laneX(e.fromLane), xv = laneX(e.via), x2 = laneX(e.toLane)
  const y1 = rowY(e.from), y2 = rowY(e.to)
  const bend = (xa: number, ya: number, xb: number, yb: number) => `C ${xa} ${(ya + yb) / 2}, ${xb} ${(ya + yb) / 2}, ${xb} ${yb}`
  if (e.to - e.from === 1) return `M ${x1} ${y1} ${x1 === x2 ? `L ${x2} ${y2}` : bend(x1, y1, x2, y2)}`
  let d = `M ${x1} ${y1} `
  let y = y1
  if (xv !== x1) { d += bend(x1, y1, xv, y1 + ROW_H) + " "; y = y1 + ROW_H }
  const yEnd = xv !== x2 ? y2 - ROW_H : y2
  if (yEnd > y) d += `L ${xv} ${yEnd} `
  if (xv !== x2) d += bend(xv, yEnd, x2, y2)
  return d
}

function ancestors(commits: GraphCommit[], head: string) {
  const byId = new Map(commits.map((cm) => [cm.id, cm]))
  const seen = new Set<string>()
  const stack = [head]
  while (stack.length) {
    const id = stack.pop()!
    if (seen.has(id) || !byId.has(id)) continue
    seen.add(id)
    stack.push(...byId.get(id)!.parents)
  }
  return seen
}

function GraphTab() {
  const p = useProto()
  const dev = p.mode === "developer"
  const [scope, setScope] = useState<"all" | "current">("all")
  const [hover, setHover] = useState<{ branch: string; x: number; y: number } | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  // Heads: the newest commit on each branch. A branch made in this session (no commits yet) points at where main is.
  const base = GRAPH_COMMITS.map((cm) => ({ ...cm }))
  const heads = new Map<string, string>()
  for (const cm of base) if (!heads.has(cm.branch)) heads.set(cm.branch, cm.id)
  const branch = p.branch
  if (!heads.has(branch)) heads.set(branch, heads.get("main")!)
  // Commits made in this session sit on top of the current branch.
  const fresh = p.history.filter((r) => r.local || r.when === "just now")
  const extra: GraphCommit[] = fresh.map((r, i) => ({ ...r, at: NOW - 60_000 * (i + 1), branch, parents: [] }))
  extra.forEach((cm, i) => { cm.parents = [extra[i + 1]?.id ?? heads.get(branch)!] })
  if (extra.length) heads.set(branch, extra[0].id)
  const changed = p.files.filter((f) => f.change).length
  const working: GraphCommit[] = changed ? [{ id: "working", branch, message: `Uncommitted changes (${changed})`, author: "You", at: NOW, when: "", files: changed, parents: [heads.get(branch)!], working: true }] : []
  let commits = [...working, ...extra, ...base]
  if (scope === "current") { const keep = ancestors(commits, working[0]?.id ?? heads.get(branch)!); commits = commits.filter((cm) => keep.has(cm.id)) }

  const { laneOf, edges, width } = layout(commits)
  const graphW = laneX(width - 1) + 14
  const labels = new Map<string, string[]>()
  for (const [b, id] of heads) if (scope === "all" || b === branch) labels.set(id, [...(labels.get(id) ?? []), b])
  const selectedEntry = commits.find((cm) => cm.id === selected && !cm.working)
  const branchCount = new Set(commits.map((cm) => cm.branch)).size

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border p-0.5 text-sm">
            {([["all", "All branches"], ["current", "Current branch"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setScope(k)} className={cn("rounded px-2.5 py-1", scope === k ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100")}>{l}</button>
            ))}
          </div>
          <span className="text-xs text-zinc-500">{commits.length - working.length} commits · {branchCount} branch{branchCount === 1 ? "" : "es"}</span>
          <span className="ml-auto text-xs text-zinc-400">Hover a line or dot to see its branch</span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto rounded-lg border">
          <div className="relative" style={{ height: commits.length * ROW_H, minWidth: graphW + (dev ? 520 : 450) }}>
            <svg className="pointer-events-none absolute left-0 top-0 z-10" width={graphW} height={commits.length * ROW_H} onMouseLeave={() => setHover(null)}>
              {edges.map((e, i) => {
                const dim = hover && hover.branch !== e.branch
                const hot = hover?.branch === e.branch
                const d = edgePath(e)
                return (
                  <g key={i}>
                    <path d={d} fill="none" stroke={branchColor(e.branch)} strokeWidth={hot ? 3 : 2} strokeLinecap="round" strokeDasharray={commits[e.from].working ? "3 3" : undefined} opacity={dim ? 0.2 : 0.9} className="transition-opacity" />
                    {/* Wider invisible stroke so a 2px line is easy to hover. */}
                    <path
                      d={d} fill="none" stroke="transparent" strokeWidth={10} style={{ pointerEvents: "stroke" }}
                      onMouseMove={(ev) => { const r = (ev.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect(); setHover({ branch: e.branch, x: ev.clientX - r.left, y: ev.clientY - r.top }) }}
                      onMouseLeave={() => setHover(null)}
                    />
                  </g>
                )
              })}
              {commits.map((cm, i) => {
                const x = laneX(laneOf.get(cm.id)!), y = rowY(i), col = branchColor(cm.branch)
                const dim = hover && hover.branch !== cm.branch
                const hoverProps = {
                  style: { pointerEvents: "all" as const, cursor: cm.working ? "default" : "pointer" },
                  opacity: dim ? 0.25 : 1,
                  className: "transition-opacity",
                  onMouseEnter: () => setHover({ branch: cm.branch, x, y }),
                  onMouseLeave: () => setHover(null),
                  onClick: () => { if (!cm.working) setSelected(selected === cm.id ? null : cm.id) },
                }
                if (cm.working) return <circle key={cm.id} cx={x} cy={y} r={5} fill="white" stroke={col} strokeWidth={2} strokeDasharray="2 2" {...hoverProps} />
                const isHead = labels.has(cm.id)
                const isMerge = cm.parents.length > 1
                return (
                  <g key={cm.id} {...hoverProps}>
                    {selected === cm.id && <circle cx={x} cy={y} r={9} fill={col} opacity={0.2} />}
                    {isMerge
                      ? <circle cx={x} cy={y} r={4.5} fill="white" stroke={col} strokeWidth={2.5} />
                      : <circle cx={x} cy={y} r={isHead ? 6 : 4.5} fill={col} stroke="white" strokeWidth={1.5} />}
                    <circle cx={x} cy={y} r={9} fill="transparent" />
                  </g>
                )
              })}
            </svg>
            {hover && (
              <div
                className="pointer-events-none absolute z-20 flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium text-white shadow-md"
                style={{ left: hover.x + 12, top: hover.y - 12, background: branchColor(hover.branch) }}
              ><GitBranch className="size-3" />{hover.branch}{hover.branch === branch && <span className="opacity-75">(current)</span>}</div>
            )}
            {commits.map((cm, i) => {
              const isSel = selected === cm.id
              const refs = labels.get(cm.id) ?? []
              const rowEl = (
                <button
                  key={cm.id}
                  onClick={() => cm.working ? null : setSelected(isSel ? null : cm.id)}
                  className={cn("absolute left-0 right-0 flex items-center gap-3 border-b pr-3 text-left text-sm", isSel ? "bg-sky-50" : "hover:bg-zinc-50", cm.working && "cursor-default")}
                  style={{ top: i * ROW_H, height: ROW_H, paddingLeft: graphW + 4 }}
                >
                  <span className="flex min-w-48 flex-1 items-center gap-1.5 overflow-hidden">
                    {refs.map((b) => {
                      const current = b === branch
                      return (
                        <span
                          key={b}
                          className={cn("flex max-w-40 shrink-0 items-center gap-1 rounded-full border px-1.5 py-px text-[11px] font-medium", current && "text-white")}
                          style={current ? { background: branchColor(b), borderColor: branchColor(b) } : { color: branchColor(b), borderColor: branchColor(b) + "66", background: branchColor(b) + "14" }}
                          title={current ? "Current branch" : b}
                        ><GitBranch className="size-3 shrink-0" /><span className="truncate">{b}</span></span>
                      )
                    })}
                    <span className={cn("truncate", cm.working && "italic text-zinc-500", cm.parents.length > 1 && "text-zinc-500")}>{cm.message}</span>
                    {cm.local && <Badge variant="outline" className="shrink-0 font-normal">not pushed</Badge>}
                  </span>
                  {!cm.working && (
                    <>
                      <span className="flex w-24 shrink-0 items-center gap-1.5 text-zinc-600">
                        <span className="grid size-5 shrink-0 place-items-center rounded-full text-[9px] font-semibold text-white" style={{ background: branchColor(cm.author) }}>{cm.author.slice(0, 2).toUpperCase()}</span>
                        <span className="truncate text-xs">{cm.author}</span>
                      </span>
                      <span className="w-24 shrink-0 text-xs text-zinc-500">{formatWhen(cm.at, dev)}</span>
                      {dev && <code className="w-16 shrink-0 text-xs text-zinc-400">{cm.id}</code>}
                    </>
                  )}
                </button>
              )
              return cm.working ? rowEl : <RevisionMenu key={cm.id} rev={cm}>{rowEl}</RevisionMenu>
            })}
          </div>
        </div>
      </div>
      <CommitDetails entry={selectedEntry} branch={selectedEntry?.branch} onClose={() => setSelected(null)} />
    </div>
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
              <TabsTrigger value="staging"><FileDiff /> Staging {changed > 0 && <Badge className="ml-1 h-4 border-transparent bg-red-100 px-1.5 text-[10px] text-red-700">{changed}</Badge>}</TabsTrigger>
              <TabsTrigger value="history"><HistoryIcon /> History</TabsTrigger>
              <TabsTrigger value="explorer"><FolderTree /> Explorer</TabsTrigger>
              <TabsTrigger value="graph"><GitGraph /> Graph</TabsTrigger>
              {dev && <TabsTrigger value="log"><ScrollText /> Lore log</TabsTrigger>}
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
          <TabsContent value="graph" className="min-h-0 flex-1"><GraphTab /></TabsContent>
          {dev && <TabsContent value="log" className="min-h-0 flex-1"><LoreLog /></TabsContent>}
        </Tabs>
        <OperationBar />
      </div>
    </div>
  )
}
