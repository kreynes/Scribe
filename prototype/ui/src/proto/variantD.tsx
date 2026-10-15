// PROTOTYPE: Variant D, the user's layout. Side panel (logo, project switcher, branches, account) and a tabbed centre: Staging, History, Explorer, Graph.
import { Archive, ArrowDown, ArrowDownToLine, ArrowUp, ArrowUpDown, ArrowUpFromLine, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronsDownUp, ChevronsLeft, ChevronsRight, ChevronsUpDown, CommandIcon, Copy, Eye, Feather, FileDiff, Folder, FolderGit2, FolderOpen, FolderTree, GitBranch, GitBranchPlus, GitCommitHorizontal, GitGraph, GitMerge, HistoryIcon, Info, Lock, LockOpen, LogOut, Monitor, Moon, Palette, Plus, RefreshCw, ScrollText, Search, Settings, Settings2, Shield, SlidersHorizontal, Star, Sun, TriangleAlert, Undo2, UserRound, UserRoundPlus, Users, X } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from "@/components/ui/command"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { ArchivedBranchMenu, BranchLink, setRevisionLookup, BranchMenu, ChangeBadge, CommitMessageFields, FileLink, FileMenu, LoreLog, OperationBar, RevLink, RevisionMenu, archiveBlocker } from "./shared"
import { BRANCHES, EMPTY_MSG, PROJECT_FILES, PROJECT_TREE, branchId, descriptionOf, fileName, lockBranch, msgReady, revisionDiff, revisionFiles, useProto, type CommitMsg, type FileEntry, type Mode } from "./state"
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
  const label = `${mine ? "Locked by you" : `Locked by ${file.lock.by}`} on ${lockBranch(file.lock)}`
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
  const branches = p.branches
  const [showArchived, setShowArchived] = useState(false)
  const [newFrom, setNewFrom] = useState<string | null>(null)
  const [infoFor, setInfoFor] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (searchOpen) inputRef.current?.focus() }, [searchOpen])
  const info = PROJECTS.find((pr) => pr.name === project)!
  // A branch link anywhere opens its Branch information; any other link closes it.
  useEffect(() => {
    if (!p.nav) return
    if (p.nav.kind === "branch") { setInfoFor(p.nav.id); p.doneNav() } else setInfoFor(null)
  }, [p.nav?.seq])
  useEffect(() => {
    const onCmd = (e: Event) => {
      const { type, value } = (e as CustomEvent<{ type: string; value?: string }>).detail
      if (type === "settings") setSettings((value as SettingsSection) ?? "general")
      if (type === "new-branch") setNewFrom(p.branch)
      if (type === "switch-branch" && value) switchTo(value)
      if (type === "open-project" && value) { setProject(value); p.say("Opened " + value) }
    }
    window.addEventListener("scribe:command", onCmd)
    return () => window.removeEventListener("scribe:command", onCmd)
  })

  const toggleFav = (b: string) => setFavorites((s) => {
    const n = new Set(s)
    if (n.has(b)) n.delete(b)
    else n.add(b)
    p.say(n.has(b) ? `${b} added to favorites` : `${b} removed from favorites`)
    return n
  })
  const switchTo = (b: string) => p.requestSwitch(b)
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
          <Popover>
            <PopoverTrigger asChild>
              <button aria-label="Project information" title="Project information" className="grid size-8 shrink-0 place-items-center rounded-md text-zinc-400 hover:bg-zinc-200/60 hover:text-zinc-900 data-[state=open]:bg-zinc-200/60 data-[state=open]:text-zinc-900"><Info className="size-4" /></button>
            </PopoverTrigger>
            <PopoverContent side="right" align="start" className="w-96 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><FolderGit2 className="size-4 text-zinc-500" />{info.name}</div>
              <dl className="grid grid-cols-[5.5rem_1fr] gap-x-2 gap-y-1 text-xs">
                <dt className="text-zinc-500">Server</dt><dd>{info.server}</dd>
                <dt className="text-zinc-500">Address</dt><dd className="break-all font-mono text-[11px]">{info.url}</dd>
                <dt className="text-zinc-500">Local folder</dt><dd className="break-all font-mono text-[11px]">{info.path}</dd>
                <dt className="text-zinc-500">Size on disk</dt><dd>{info.size}</dd>
                <dt className="text-zinc-500">Branches</dt><dd>{info.branches}</dd>
                <dt className="text-zinc-500">Members</dt><dd>{info.members}</dd>
                <dt className="text-zinc-500">Last synced</dt><dd>{info.lastSync}</dd>
                {dev && <><dt className="text-zinc-500">View filter</dt><dd className="font-mono text-[11px]">{info.viewFilter}</dd></>}
              </dl>
              <div className="mt-3 border-t pt-2"><Button size="sm" variant="outline" onClick={() => setSettings("projects")}>Manage projects…</Button></div>
            </PopoverContent>
          </Popover>
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
        <Button
          size="icon" variant="ghost" title={showArchived ? "Hide archived branches" : "Show archived branches"} aria-pressed={showArchived}
          className={cn("size-6", showArchived && "bg-zinc-200")}
          onClick={() => setShowArchived(!showArchived)}
        ><Archive className="size-3.5" /></Button>
        <Button size="icon" variant="ghost" title="New branch" className="size-6" onClick={() => setNewFrom(p.branch)}><Plus className="size-3.5" /></Button>
      </div>
      <NewBranchDialog
        base={newFrom}
        branches={branches}
        onClose={() => setNewFrom(null)}
        onCreate={(name, base, switchNow) => {
          p.addBranch(name)
          setNewFrom(null)
          if (switchNow) { p.setBranch(name); p.say(`Created ${name} from ${base} and switched to it`) }
          else p.say(`Created ${name} from ${base}. You're still on ${p.branch}`)
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
        {showArchived && (
          <>
            <li className="flex items-center gap-1 px-2 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-zinc-500"><Archive className="size-3" /> Archived ({p.archived.length})</li>
            {p.archived.filter((a) => !q || a.name.toLowerCase().includes(q)).map((a) => (
              <ArchivedBranchMenu key={a.id} branch={a}>
                <li
                  onDoubleClick={() => p.openFlow({ kind: "restore-branch", id: a.id })}
                  title={`Archived by ${a.by}, ${a.when}. Double-click to restore`}
                  className="flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-400 hover:bg-zinc-200/60"
                >
                  <GitBranch className="size-3.5 shrink-0" />
                  <span className="truncate line-through decoration-zinc-300">{a.name}</span>
                  <span className="ml-auto shrink-0 text-[10px]">{a.when}</span>
                </li>
              </ArchivedBranchMenu>
            ))}
            {!p.archived.length && <li className="px-2 py-1 text-xs text-zinc-400">Nothing archived.</li>}
            {dev && <li className="px-2 pt-1 text-[10px] text-zinc-400"><code>lore branch list --archived</code></li>}
          </>
        )}
      </ul>
      <div className="flex flex-col gap-0.5 border-t p-2">
        <AccountMenu account={account} onSwitch={switchAccount} onOpenAccounts={() => setSettings("account")} />
        <button className="flex items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm text-zinc-700 hover:bg-zinc-200/60" onClick={() => setSettings("general")}>
          <span className="grid size-6 shrink-0 place-items-center"><Settings className="size-4 text-zinc-500" /></span> Settings
        </button>
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
        <button className="flex w-full min-w-0 items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-zinc-200/60" title={`${account.email} on ${account.server}`}>
          <Avatar initials={account.initials} />
          <span className="min-w-0 flex-1 truncate text-sm text-zinc-700">{account.email}</span>
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

/** Mock `lore branch latest list`: where this computer's copy of the branch has pointed, newest first. */
function pointerHistory(b: string, p: ReturnType<typeof useProto>) {
  const { own, head } = branchFacts(b)
  const locals = b === p.branch ? p.history.filter((r) => r.local) : []
  const pushed = (own.length ? own : [head]).slice(0, 6)
  const top = 40 + pushed.length + locals.length
  return [
    ...locals.map((r, i) => ({ id: r.id, message: r.message, how: "Commit", when: "just now", n: top - i, local: true as boolean })),
    ...pushed.map((cm, i) => ({ id: cm.id, message: cm.message, how: ["Sync", "Push", "Commit"][i % 3], when: formatWhen(cm.at, false), n: top - locals.length - i, local: false })),
  ]
}

function MetadataTable({ branch }: { branch: string }) {
  const p = useProto()
  const rows = p.branchMeta[branch] ?? []
  const [k, setK] = useState("")
  const [v, setV] = useState("")
  const add = () => { if (!k.trim()) return; p.setBranchMeta(branch, [...rows.filter(([x]) => x !== k.trim()), [k.trim(), v]]); setK(""); setV("") }
  return (
    <div className="space-y-2 text-xs">
      <p className="text-zinc-500">Key/value notes stored on the branch and shared with everyone, e.g. a release date or which checks it needs.</p>
      <div className="rounded-md border">
        {rows.map(([key, val]) => (
          <div key={key} className="flex items-center gap-2 border-b px-2 py-1.5 last:border-b-0">
            <code className="w-36 min-w-0 shrink truncate" title={key}>{key}</code>
            <span className="min-w-0 flex-1 truncate" title={val}>{val}</span>
            <button aria-label={`Remove ${key}`} className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900" onClick={() => p.setBranchMeta(branch, rows.filter(([x]) => x !== key))}><X className="size-3.5" /></button>
          </div>
        ))}
        {!rows.length && <div className="px-2 py-2 text-zinc-400">No metadata on this branch.</div>}
      </div>
      <form className="flex min-w-0 gap-1.5" onSubmit={(e) => { e.preventDefault(); add() }}>
        <Input value={k} onChange={(e) => setK(e.target.value)} placeholder="key" className="h-7 w-36 min-w-0 shrink font-mono text-xs" />
        <Input value={v} onChange={(e) => setV(e.target.value)} placeholder="value" className="h-7 min-w-0 flex-1 text-xs" />
        <Button type="submit" size="sm" variant="outline" className="h-7 shrink-0 text-xs" disabled={!k.trim()}>Add</Button>
      </form>
      {p.mode === "developer" && <code className="block truncate text-[11px] text-zinc-400">$ lore branch metadata set {k.trim() || "<key>"} {v || "<value>"} --branch {branch}</code>}
    </div>
  )
}

/** Right-click a branch → Branch information… Facts come from the mock graph where the branch has commits there. */
function BranchInfoDialog({ name, favorite, onClose, onSwitch }: { name: string | null; favorite: boolean; onClose: () => void; onSwitch: (b: string) => void }) {
  const p = useProto()
  const dev = p.mode === "developer"
  const b = name ?? ""
  const [tab, setTab] = useState("overview")
  useEffect(() => { if (name) setTab("overview") }, [name])
  const { own, head, isMain, baseCommit, behind, mergedInto, contributors, createdBy, createdAt } = branchFacts(b)
  const isProtected = p.protectedBranches.includes(b)
  const blocker = archiveBlocker(p, b)
  const pointers = name ? pointerHistory(b, p) : []
  const revisions = pointers.map((r) => ({ id: r.id, label: `#${r.n} ${r.message}${r.local ? " (not pushed)" : ""}` }))
  const reset = (target?: string) => { onClose(); p.openFlow({ kind: "reset-branch", branch: b, revisions, target }) }
  const locks = b === p.branch ? p.files.concat(PROJECT_TREE).filter((f, i, a) => f.lock && a.findIndex((g) => g.path === f.path) === i).length : own.length ? (own.length * 3) % 5 : 0
  const Fact = ({ label, children }: { label: string; children: React.ReactNode }) => <><dt className="text-zinc-500">{label}</dt><dd className="min-w-0">{children}</dd></>
  return (
    <Dialog open={name !== null} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="grid-cols-[minmax(0,1fr)] sm:max-w-2xl">
        <DialogHeader className="min-w-0">
          <DialogTitle className="flex min-w-0 items-center gap-2 pr-6">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: branchColor(b) }} />
            <span className="truncate">{b}</span>
            {b === p.branch && <Badge variant="secondary" className="font-normal">current</Badge>}
            {isProtected && <Badge variant="outline" className="font-normal"><Shield className="size-3" /> protected</Badge>}
            {favorite && <Star className="size-4 fill-amber-400 text-amber-500" />}
          </DialogTitle>
          <DialogDescription>
            {isMain ? "The project's default branch." : <>Started from <BranchLink name={baseCommit?.branch ?? "main"} /> by {createdBy}, {formatWhen(createdAt, false)}.</>}
          </DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={setTab} className="min-w-0 gap-3">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="pointer"><HistoryIcon /> Pointer history</TabsTrigger>
            <TabsTrigger value="meta">Metadata</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="min-h-72 space-y-4 text-sm">
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
                <RevLink id={head.id} branch={own.length ? b : "main"} className="block max-w-full truncate">{head.message}</RevLink>
                <div className="text-zinc-500">{head.author} · {formatWhen(head.at, false)} · <RevLink id={head.id} branch={own.length ? b : "main"} /></div>
              </Fact>
              {!isMain && <Fact label="Started from"><BranchLink name={baseCommit?.branch ?? "main"} />{baseCommit && <> at <RevLink id={baseCommit.id} branch={baseCommit.branch} /></>}</Fact>}
              {!isMain && <Fact label="Created">{createdBy}, {new Date(createdAt).toISOString().slice(0, 16).replace("T", " ")}</Fact>}
              <Fact label="Merged">{isMain ? "–" : mergedInto ? <span className="text-emerald-700">Yes, into <BranchLink name={mergedInto} /></span> : "Not merged yet"}</Fact>
              <Fact label="Protected">
                <span className="flex items-start gap-2">
                  <button
                    role="switch" aria-checked={isProtected} aria-label="Protect from direct pushes"
                    onClick={() => p.setProtected(b, !isProtected)}
                    className={cn("relative mt-0.5 h-4 w-7 shrink-0 rounded-full transition-colors", isProtected ? "bg-zinc-900" : "bg-zinc-300")}
                  ><span className={cn("absolute top-0.5 size-3 rounded-full bg-white transition-all", isProtected ? "left-3.5" : "left-0.5")} /></button>
                  <span>{isProtected ? "Direct pushes are refused. Work lands by merging another branch into it." : "Anyone can push to it."}{dev && <code className="ml-1 text-zinc-400">lore branch {isProtected ? "unprotect" : "protect"} {b}</code>}</span>
                </span>
              </Fact>
              <Fact label="Contributors">
                <span className="flex flex-wrap items-center gap-1">
                  {contributors.map((a) => <span key={a} className="flex items-center gap-1 rounded-full border py-px pl-px pr-2"><Avatar initials={a.slice(0, 2).toUpperCase()} className="size-4 text-[8px]" style={{ background: branchColor(a) }} />{a}</span>)}
                </span>
              </Fact>
              {dev && <Fact label="Branch ID"><code>{branchId(b)}</code></Fact>}
            </dl>
          </TabsContent>
          <TabsContent value="pointer" className="min-h-72 space-y-2 text-xs">
            <p className="text-zinc-500">Where this computer's copy of {b} has pointed, newest first. Use it to undo a bad sync or merge by resetting to an earlier point.</p>
            <ol className="max-h-56 divide-y overflow-auto rounded-md border">
              {pointers.map((r, i) => (
                <li key={r.id + i} className="group flex items-center gap-2 px-2 py-1.5">
                  <span className="w-10 shrink-0 tabular-nums text-zinc-400">#{r.n}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-1"><RevLink id={r.id} branch={b} className="truncate">{r.message}</RevLink>{r.local && <Badge variant="outline" className="font-normal">not pushed</Badge>}</span>
                    <span className="text-zinc-500">{r.how} · {r.when} · <RevLink id={r.id} branch={b} /></span>
                  </span>
                  {i === 0 ? <span className="text-zinc-400">current</span> : <Button size="sm" variant="ghost" className="h-6 text-xs opacity-0 group-hover:opacity-100" onClick={() => reset(r.id)}>Reset here…</Button>}
                </li>
              ))}
            </ol>
            {dev && <code className="block text-[11px] text-zinc-400">$ lore branch latest list --branch {b}</code>}
          </TabsContent>
          <TabsContent value="meta" className="min-h-72"><MetadataTable branch={b} /></TabsContent>
        </Tabs>
        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          <div className="flex flex-wrap gap-1">
            <Button variant="ghost" onClick={() => p.say("Copied " + b)}><Copy className="size-4" /> Copy name</Button>
            <Button variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" disabled={!!blocker} title={blocker ? `Can't archive: ${blocker}` : undefined} onClick={() => { onClose(); p.openFlow({ kind: "archive-branch", branch: b }) }}><Archive className="size-4" /> Archive…</Button>
            <Button variant="ghost" onClick={() => reset()}><Undo2 className="size-4" /> Reset…</Button>
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={onClose}>Close</Button>
            <Button disabled={b === p.branch} onClick={() => onSwitch(b)}>Switch to this branch</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FileLine({ file, checked, onCheck, selected, onSelect }: { file: FileEntry; checked: boolean; onCheck: () => void; selected: boolean; onSelect: () => void }) {
  const p = useProto()
  const dev = p.mode === "developer"
  return (
    <FileMenu file={file}>
      <div onClick={onSelect} onDoubleClick={() => p.openFlow({ kind: "diff", paths: [file.path] })} title="Double-click to see what changed" className={cn("flex cursor-default items-center gap-3 px-3 py-1.5", selected ? "bg-sky-50 ring-1 ring-inset ring-sky-200" : "hover:bg-zinc-50")}>
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
              <dd className="flex flex-wrap items-center gap-x-1.5">{file.lock ? <><LockIcon file={file} /> {file.lock.by === "you" ? "Locked by you" : `Locked by ${file.lock.by}`} on <BranchLink name={lockBranch(file.lock)} /></> : "Not locked"}</dd>
              <dt className="text-zinc-500">Last revision</dt><dd>{fileMeta(file).rev ? <RevLink id={fileMeta(file).rev!} /> : <span className="text-amber-700">working copy</span>}</dd>
              <dt className="text-zinc-500">Modified</dt><dd>{formatWhen(fileMeta(file).at, dev)}</dd>
              {dev && <><dt className="text-zinc-500">Content hash</dt><dd><code>blake3 9a1f…c03e</code></dd></>}
            </dl>
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => p.openFlow({ kind: "diff", paths: [file.path] })}><FileDiff className="size-3.5" /> Show diff</Button>
              {(!file.lock || file.lock.by === "you")
                ? <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => p.toggleLock(file.path)}>{file.lock ? "Release lock" : "Lock"}</Button>
                : <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600 hover:text-red-700" onClick={() => p.openFlow({ kind: "release-lock", path: file.path })}>Release {file.lock.by}'s lock…</Button>}
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
                        <RevLink id={r.id} className="block max-w-full truncate">{r.message}</RevLink>
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
  const [msg, setMsg] = useState<CommitMsg>(EMPTY_MSG)
  const [selected, setSelected] = useState<string | null>(null)
  const changed = p.files.filter((f) => f.change)
  const staged = changed.filter((f) => f.staged)
  const unstaged = changed.filter((f) => !f.staged)
  const blocked = changed.some((f) => f.lock && f.lock.by !== "you")
  const ticked = changed.filter((f) => f.ticked).length
  const toCommit = dev ? staged.length : ticked
  const needMsg = !msgReady(msg)
  // Artist Mode with nothing ticked but local Commits waiting: the button becomes Push and the message box isn't used.
  const pushOnly = !dev && !ticked && p.unpushed > 0
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
        <ScanBar />
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
          <CommitMessageFields
            idPrefix="staging"
            value={msg}
            onChange={setMsg}
            disabled={pushOnly}
            compact
            summaryPlaceholder={pushOnly ? `Nothing ticked: Push sends your ${p.unpushed === 1 ? "Commit with its own summary" : `${p.unpushed} Commits with their own summaries`}` : dev ? "Short summary of the change" : "What did you change?"}
            descriptionPlaceholder={pushOnly ? "" : undefined}
          />
          <div className="flex items-center gap-2">
            {p.unpushed > 0 && <span className="text-xs text-zinc-500">{p.unpushed} local Commit{p.unpushed > 1 ? "s" : ""} not pushed · locks kept until you push</span>}
            <div className="ml-auto flex gap-2">
              <Button
                variant={dev ? "default" : "outline"}
                disabled={!toCommit || needMsg}
                title={!toCommit ? (dev ? "Stage files first" : "Tick files first") : needMsg ? "Write a summary and a description first" : "Record a Commit on this computer only"}
                onClick={() => { p.commit(msg); setMsg(EMPTY_MSG) }}
              >{dev ? `Commit (${staged.length})` : "Commit"}</Button>
              {!dev && (
                <Button
                  disabled={blocked || (ticked ? needMsg : !p.unpushed)}
                  title={blocked ? "Someone else holds a lock on one of these files" : ticked && needMsg ? "Write a summary and a description first" : undefined}
                  onClick={() => { p.commitAndPush(msg); setMsg(EMPTY_MSG) }}
                >{ticked ? `Commit & Push (${ticked} file${ticked === 1 ? "" : "s"})` : p.unpushed ? `Push (${p.unpushed} commit${p.unpushed === 1 ? "" : "s"})` : "Commit & Push"}</Button>
              )}
            </div>
          </div>
        </div>
      </div>
      <FileDetails file={selectedFile} onClose={() => setSelected(null)} />
    </div>
  )
}

/** Lore only looks at the disk when asked (`lore status --scan`), so the list can miss edits made outside Scribe. */
function ScanBar() {
  const p = useProto()
  const dev = p.mode === "developer"
  const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30_000); return () => clearInterval(t) }, [])
  const mins = Math.round((Date.now() - p.lastScan) / 60_000)
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
      <span>Checked the disk {mins < 1 ? "just now" : `${mins} min ago`}{p.autoScan && " · checks again when Scribe comes into focus"}</span>
      <span className="ml-auto flex items-center gap-1">
        {dev && <code className="mr-1 text-[11px] text-zinc-400">lore status --scan</code>}
        {dev && <Button size="sm" variant="ghost" className="h-7 text-xs" title="Re-check only files already marked changed (lore status --check-dirty)" onClick={() => p.scan("check-dirty")}>Re-check changed files</Button>}
        <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" title="Scan for changes (F5)" onClick={() => p.scan("scan")}><RefreshCw className="size-3.5" /> Scan for changes</Button>
      </span>
    </div>
  )
}

type HistoryEntry = { id: string; message: string; description?: string; author: string; when: string; files: number; local?: boolean; at: number; branch?: string; parents?: string[] }

/** A commit made or synced in this session (not in the mock graph). */
const isSession = (r: { local?: boolean; when: string }) => !!r.local || r.when.startsWith("just now")

/** Commits reachable from a branch's head in the mock graph, newest first. A branch with no commits of its own shows main's. */
function graphHistory(b: string): HistoryEntry[] {
  const head = GRAPH_COMMITS.find((cm) => cm.branch === b) ?? GRAPH_COMMITS.find((cm) => cm.branch === "main")!
  const keep = ancestors(GRAPH_COMMITS, head.id)
  return GRAPH_COMMITS.filter((cm) => keep.has(cm.id))
}

// A long-running branch, so History has enough commits to page through.
const LONG_BRANCH = "art/character-pass-2"
const PASS_PARTS = ["Hero face", "Hero hands", "Villain cape", "Villain armour", "Blacksmith NPC", "Merchant NPC", "Hair cards", "Eye shader", "Boots", "Belt pouches", "Cloak", "Teeth"]
const PASS_STEPS = ["retopology", "UV layout", "normal bake", "texture pass", "roughness tweak", "LOD 1", "LOD 2", "rig fixes", "weight painting", "material instance", "export to engine", "review notes"]
const PASS_AUTHORS = ["Ana", "You", "Marco", "Sam", "Ana", "You", "Lena"]
const LONG_HISTORY: HistoryEntry[] = Array.from({ length: 137 }, (_, i) => ({
  id: ((0x1a2b3c4d + i * 2654435761) >>> 0).toString(16).padStart(8, "0"),
  message: `${PASS_PARTS[i % PASS_PARTS.length]}: ${PASS_STEPS[(i * 5) % PASS_STEPS.length]}`,
  author: PASS_AUTHORS[(i * 3) % PASS_AUTHORS.length],
  when: "",
  files: 1 + ((i * 13) % 17),
  at: NOW - 3 * HOUR - i * 9 * HOUR,
}))

type HistorySortKey = "message" | "description" | "author" | "when" | "revision"
const PAGE_SIZES = [25, 50, 100]

/** Page numbers to show: all when few, otherwise first, last and a window around the current page. */
function pageList(count: number, cur: number): (number | "…")[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i)
  const out: (number | "…")[] = [0]
  const from = Math.max(1, cur - 1), to = Math.min(count - 2, cur + 1)
  if (from > 1) out.push("…")
  for (let i = from; i <= to; i++) out.push(i)
  if (to < count - 2) out.push("…")
  out.push(count - 1)
  return out
}

function HistoryTab() {
  const p = useProto()
  const dev = p.mode === "developer"
  const [viewBranch, setViewBranch] = useState(p.branch)
  useEffect(() => setViewBranch(p.branch), [p.branch])
  const [selected, setSelected] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [author, setAuthor] = useState("any")
  const [date, setDate] = useState<DateValue>({ kind: "preset", preset: "any" })
  const [sort, setSort] = useState<Sort<HistorySortKey>>({ key: "when", dir: "desc" })
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const isCurrent = viewBranch === p.branch
  // Commits made in this session belong to the current branch only.
  const historyFor = (b: string): HistoryEntry[] => [
    ...(b === p.branch ? p.history.filter(isSession).map((r, i) => ({ ...r, at: NOW - 60_000 * (i + 1), branch: b })) : []),
    ...(b === LONG_BRANCH ? LONG_HISTORY : graphHistory(b)),
  ]
  const entries = historyFor(viewBranch)
  const authors = [...new Set(entries.map((e) => e.author))].sort()
  const q = query.trim().toLowerCase()
  const dateActive = !(date.kind === "preset" && date.preset === "any")
  const filtering = !!q || author !== "any" || dateActive
  const sign = sort.dir === "asc" ? 1 : -1
  const cmp: Record<HistorySortKey, (a: HistoryEntry, b: HistoryEntry) => number> = {
    message: (a, b) => a.message.localeCompare(b.message),
    description: (a, b) => descriptionOf(a).localeCompare(descriptionOf(b)),
    author: (a, b) => a.author.localeCompare(b.author) || b.at - a.at,
    when: (a, b) => a.at - b.at,
    revision: (a, b) => a.id.localeCompare(b.id),
  }
  const shown = entries
    .filter((e) => (!q || e.message.toLowerCase().includes(q) || descriptionOf(e).toLowerCase().includes(q) || e.id.startsWith(q)) && (author === "any" || e.author === author) && matchesDate(date, e.at))
    .sort((a, b) => cmp[sort.key](a, b) * sign)
  const pageCount = Math.max(1, Math.ceil(shown.length / pageSize))
  const cur = Math.min(page, pageCount - 1)
  const pageRows = shown.slice(cur * pageSize, (cur + 1) * pageSize)
  useEffect(() => setPage(0), [viewBranch, query, author, date, sort, pageSize])
  // A revision link elsewhere: show its branch, clear filters, then (next effect) page to it and select it.
  const [jump, setJump] = useState<string | null>(null)
  useEffect(() => {
    const n = p.nav
    if (!n || n.kind !== "revision") return
    p.doneNav()
    const has = (b: string) => historyFor(b).some((e) => e.id === n.id)
    const home = [viewBranch, n.branch, p.branch, GRAPH_COMMITS.find((cm) => cm.id === n.id)?.branch, LONG_HISTORY.some((e) => e.id === n.id) ? LONG_BRANCH : undefined].find((b) => b && has(b))
    if (!home) return p.say(`Revision ${n.id} isn't in this project's history`)
    setViewBranch(home); setQuery(""); setAuthor("any"); setDate({ kind: "preset", preset: "any" }); setSort({ key: "when", dir: "desc" })
    setJump(n.id)
  }, [p.nav?.seq])
  useEffect(() => {
    if (!jump) return
    const i = shown.findIndex((e) => e.id === jump)
    setJump(null)
    if (i < 0) return
    setPage(Math.floor(i / pageSize))
    setSelected(shown[i].id + shown[i].at)
    requestAnimationFrame(() => document.querySelector(`[data-rev="${jump}"]`)?.scrollIntoView({ block: "center" }))
  }, [jump, shown])
  const listRef = useRef<HTMLDivElement>(null)
  const goTo = (n: number) => { setPage(n); listRef.current?.scrollTo({ top: 0 }) }
  const grid = dev ? "grid-cols-[minmax(8rem,1fr)_minmax(8rem,1.3fr)_5.5rem_8rem_5.5rem] gap-x-3" : "grid-cols-[minmax(8rem,1fr)_minmax(8rem,1.3fr)_5.5rem_7rem] gap-x-3"
  const selectedEntry = shown.find((e) => e.id + e.at === selected)
  const branchOptions = BRANCHES.includes(p.branch) ? BRANCHES : [...BRANCHES, p.branch]
  return (
    <div className="flex h-full">
    <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={viewBranch} onValueChange={setViewBranch}>
          <SelectTrigger size="sm" className="w-56"><GitBranch className="size-4 text-zinc-500" /><SelectValue /></SelectTrigger>
          <SelectContent>
            {branchOptions.map((b) => (
              <SelectItem key={b} value={b}>{b}{b === p.branch && <span className="text-xs text-zinc-400">(current)</span>}{b === LONG_BRANCH && <span className="text-xs text-zinc-400">· {LONG_HISTORY.length} commits</span>}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search summaries, descriptions or revision ID…" className="h-8 pl-8 pr-8" />
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
        {filtering ? `${shown.length} of ${entries.length}` : entries.length} commits on {viewBranch}{!isCurrent && " (not your current branch)"}
        {filtering && <button className="ml-2 underline" onClick={() => { setQuery(""); setAuthor("any"); setDate({ kind: "preset", preset: "any" }) }}>Clear filters</button>}
      </div>
      <div ref={listRef} className="min-h-0 flex-1 overflow-auto rounded-lg border">
        <div className={cn("sticky top-0 z-10 grid border-b bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-500", grid)}>
          <SortHeader label="Summary" k="message" sort={sort} onSort={setSort} />
          <SortHeader label="Description" k="description" sort={sort} onSort={setSort} />
          <SortHeader label="Author" k="author" sort={sort} onSort={setSort} />
          <SortHeader label="When" k="when" sort={sort} onSort={setSort} firstDir="desc" />
          {dev && <SortHeader label="Revision" k="revision" sort={sort} onSort={setSort} />}
        </div>
        {pageRows.map((r) => {
          const key = r.id + r.at
          const isSel = selected === key
          return (
            <RevisionMenu key={key} rev={r}>
              <button
                data-rev={r.id}
                onClick={() => setSelected(isSel ? null : key)}
                className={cn("grid w-full items-center border-b px-3 py-2 text-left text-sm last:border-b-0", isSel ? "bg-sky-50 ring-1 ring-inset ring-sky-200" : "hover:bg-zinc-50", grid)}
              >
                <span className="truncate">{r.message} {r.local && <Badge variant="outline" className="ml-1 font-normal">not pushed</Badge>}</span>
                <span className="truncate text-zinc-500" title={descriptionOf(r)}>{descriptionOf(r)}</span>
                <span className="truncate text-zinc-600">{r.author}</span>
                <span className="text-zinc-500">{formatWhen(r.at, dev)}</span>
                {dev && <code className="text-xs text-zinc-400">{r.id}</code>}
              </button>
            </RevisionMenu>
          )
        })}
        {!shown.length && <p className="px-3 py-4 text-sm text-zinc-400">No commits match these filters.</p>}
      </div>
      {shown.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
          <span>{cur * pageSize + 1}–{Math.min((cur + 1) * pageSize, shown.length)} of {shown.length}</span>
          <span className="flex items-center gap-1.5">
            Rows per page
            <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
              <SelectTrigger size="sm" className="h-7 w-[4.5rem] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{PAGE_SIZES.map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
            </Select>
          </span>
          <nav aria-label="Pages" className="ml-auto flex items-center gap-1">
            <Button size="icon" variant="ghost" className="size-7" disabled={cur === 0} onClick={() => goTo(0)} aria-label="First page"><ChevronsLeft className="size-4" /></Button>
            <Button size="icon" variant="ghost" className="size-7" disabled={cur === 0} onClick={() => goTo(cur - 1)} aria-label="Previous page"><ChevronLeft className="size-4" /></Button>
            {pageList(pageCount, cur).map((n, i) => n === "…"
              ? <span key={"gap" + i} className="px-1">…</span>
              : <Button key={n} size="sm" variant={n === cur ? "default" : "ghost"} className="h-7 min-w-7 px-2 text-xs" onClick={() => goTo(n)} aria-current={n === cur ? "page" : undefined}>{n + 1}</Button>)}
            <Button size="icon" variant="ghost" className="size-7" disabled={cur >= pageCount - 1} onClick={() => goTo(cur + 1)} aria-label="Next page"><ChevronRight className="size-4" /></Button>
            <Button size="icon" variant="ghost" className="size-7" disabled={cur >= pageCount - 1} onClick={() => goTo(pageCount - 1)} aria-label="Last page"><ChevronsRight className="size-4" /></Button>
          </nav>
        </div>
      )}
      </div>
      <CommitDetails entry={selectedEntry} branch={viewBranch} onClose={() => setSelected(null)} />
    </div>
  )
}

function CommitDetails({ entry, branch, onClose }: { entry: HistoryEntry | undefined; branch?: string; onClose: () => void }) {
  const p = useProto()
  const dev = p.mode === "developer"
  const files = entry ? revisionFiles(entry) : []
  const PANEL_FILES = 5
  const home = branch ?? entry?.branch ?? p.branch
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
              <dt className="text-zinc-500">Description</dt><dd className="whitespace-pre-wrap">{descriptionOf(entry)}</dd>
              <dt className="text-zinc-500">Branch</dt><dd><BranchLink name={home} /></dd>
              <dt className="text-zinc-500">Revision</dt><dd><RevLink id={entry.id} branch={home}><code>{dev ? `${entry.id}c41e09ab77f3d2e1` : entry.id}</code></RevLink></dd>
              {entry.parents?.length ? <><dt className="text-zinc-500">{entry.parents.length > 1 ? "Parents" : "Parent"}</dt><dd className="flex flex-wrap gap-x-2">{entry.parents.map((id) => <RevLink key={id} id={id} />)}</dd></> : null}
              {dev && <><dt className="text-zinc-500">Metadata</dt><dd><code>change-request: none</code></dd></>}
              {entry.local && <><dt className="text-zinc-500">Status</dt><dd className="text-amber-700">Not pushed yet</dd></>}
            </dl>
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => p.openFlow(revisionDiff(entry))}><FileDiff className="size-3.5" /> Show changes</Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" disabled={!!entry.local} onClick={() => p.openFlow({ kind: "sync", target: entry.id })}><ArrowDownToLine className="size-3.5" /> Sync to this…</Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => p.say("Restore: choose a file or all files")}>Restore…</Button>
            </div>
            <div>
              <div className="mb-1.5 font-medium uppercase text-zinc-500">Files changed ({entry.files})</div>
              <div className="rounded-md border bg-white">
                {files.slice(0, PANEL_FILES).map((f) => (
                  <FileMenu key={f.path} file={f}>
                    <div className="group flex items-center gap-1.5 border-b px-2 py-1.5 last:border-b-0 hover:bg-zinc-50">
                      <FileTypeIcon path={f.path} />
                      <FileLink path={f.path} onDeleted={f.how === "deleted" ? () => p.openFlow(revisionDiff(entry, f.path)) : undefined} className={cn("flex-1", dev ? "font-mono text-[11px]" : "text-xs")}>{dev ? f.path : fileName(f.path)}</FileLink>
                      <LockIcon file={f} />
                      <button className="shrink-0 rounded p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-900" title="Show what changed" aria-label={`Show what changed in ${fileName(f.path)}`} onClick={() => p.openFlow(revisionDiff(entry, f.path))}><FileDiff className="size-3.5" /></button>
                    </div>
                  </FileMenu>
                ))}
              </div>
              {files.length > PANEL_FILES && (
                <Button size="sm" variant="outline" className="mt-1.5 h-7 w-full text-xs" onClick={() => p.openFlow({ kind: "commit-info", revision: { ...entry, description: descriptionOf(entry) }, branch: home })}>
                  Show more ({files.length - PANEL_FILES} more file{files.length - PANEL_FILES === 1 ? "" : "s"})
                </Button>
              )}
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

type SortDir = "asc" | "desc"
type Sort<K extends string> = { key: K; dir: SortDir }

/** Clickable column header with an asc/desc arrow. Clicking the active column flips direction. */
function SortHeader<K extends string>({ label, k, sort, onSort, align = "left", firstDir = "asc" }: { label: string; k: K; sort: Sort<K>; onSort: (s: Sort<K>) => void; align?: "left" | "right"; firstDir?: SortDir }) {
  const active = sort.key === k
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown
  return (
    <button
      type="button"
      onClick={() => onSort(active ? { key: k, dir: sort.dir === "asc" ? "desc" : "asc" } : { key: k, dir: firstDir })}
      className={cn("group inline-flex items-center gap-1 uppercase hover:text-zinc-900", align === "right" && "justify-self-end", active && "text-zinc-900")}
      title={`Sort by ${label.toLowerCase()}`}
    >
      {label}
      <Icon className={cn("size-3", !active && "opacity-30 group-hover:opacity-100")} />
    </button>
  )
}

type ExplorerSortKey = "name" | "status" | "modified" | "revision" | "size"

function sizeBytes(s: string) {
  const m = /([\d.]+)\s*(KB|MB|GB)/.exec(s)
  if (!m) return 0
  return parseFloat(m[1]) * { KB: 1e3, MB: 1e6, GB: 1e9 }[m[2] as "KB" | "MB" | "GB"]
}
const STATUS_RANK = { modified: 0, added: 1, deleted: 2 } as const

function compareFiles(a: FileEntry, b: FileEntry, key: ExplorerSortKey) {
  switch (key) {
    case "name": return fileName(a.path).localeCompare(fileName(b.path))
    case "status": return (a.change ? STATUS_RANK[a.change] : 9) - (b.change ? STATUS_RANK[b.change] : 9)
    case "modified": return fileMeta(a).at - fileMeta(b).at
    case "revision": return (fileMeta(a).rev ?? "").localeCompare(fileMeta(b).rev ?? "")
    case "size": return sizeBytes(a.size) - sizeBytes(b.size)
  }
}

/** Folders stay above files; folders sort by name, files by the chosen column. */
function sortTree(node: Node, sort: Sort<ExplorerSortKey>): Node {
  const sign = sort.dir === "asc" ? 1 : -1
  const folders = node.children.filter((c) => !c.file).sort((a, b) => a.name.localeCompare(b.name) * (sort.key === "name" ? sign : 1))
  const files = node.children.filter((c) => c.file).sort((a, b) => compareFiles(a.file!, b.file!, sort.key) * sign || a.name.localeCompare(b.name))
  return { ...node, children: [...folders.map((f) => sortTree(f, sort)), ...files] }
}

type TreeProps = { node: Node; depth: number; open: Set<string>; toggle: (path: string) => void; forceOpen: boolean; selected: string | null; onSelect: (path: string) => void }

function TreeNode({ node, depth, open, toggle, forceOpen, selected, onSelect }: TreeProps) {
  const p = useProto()
  const dev = p.mode === "developer"
  // Like a file browser: double-click opens the file. Show diff is in the right-click menu and the details panel.
  const openFile = (path: string) => p.say(`Opened ${fileName(path)} in its default app`)
  if (node.file) {
    const f = node.file
    const meta = fileMeta(f)
    return (
      <FileMenu file={f}>
        <div data-path={f.path} onClick={() => onSelect(f.path)} onDoubleClick={() => openFile(f.path)} title="Double-click to open" className={cn("flex cursor-default items-center gap-2 py-1 pr-3", selected === f.path ? "bg-sky-50 ring-1 ring-inset ring-sky-200" : "hover:bg-zinc-50")} style={{ paddingLeft: depth * 16 + 12 }}>
          {/* Same width as a folder's chevron, so a file's icon lines up with sibling folders' icons. */}
          <span aria-hidden className="w-3.5 shrink-0" />
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
        <ChevronRight className={cn("size-3.5 shrink-0 text-zinc-400 transition", isOpen && "rotate-90")} />
        {isOpen ? <FolderOpen className="size-4 shrink-0 text-amber-500" /> : <Folder className="size-4 shrink-0 text-amber-500" />}
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

type LockMode = "all" | "me" | "others"
const LOCK_MODES: [LockMode, string, string][] = [["all", "Show locked", "All locked files"], ["me", "Locked by me", "Locked by me"], ["others", "Locked by others", "Locked by others"]]
const lockTest: Record<LockMode, (f: FileEntry) => boolean> = {
  all: (f) => !!f.lock,
  me: (f) => !!f.lock && f.lock.by === "you",
  others: (f) => !!f.lock && f.lock.by !== "you",
}

/** Split button: the left part toggles the filter, the arrow picks whose locks. */
function LockFilterButton({ on, mode, counts, onToggle, onMode }: { on: boolean; mode: LockMode; counts: Record<LockMode, number>; onToggle: () => void; onMode: (m: LockMode) => void }) {
  const p = useProto()
  const [open, setOpen] = useState(false)
  const label = LOCK_MODES.find(([k]) => k === mode)![1]
  return (
    <div className={cn("flex h-8 items-stretch overflow-hidden rounded-md border bg-white text-sm shadow-xs", on && "border-red-200 bg-red-50 text-red-700")}>
      <button aria-pressed={on} onClick={onToggle} className={cn("flex items-center gap-1.5 px-2.5 font-medium", on ? "hover:bg-red-100" : "hover:bg-zinc-100")}>
        <Lock className="size-4" /> {label}
        <span className={cn("rounded px-1 text-[10px]", on ? "bg-red-100" : "bg-zinc-100 text-zinc-500")}>{counts[mode]}</span>
      </button>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button aria-label="Choose whose locks to show" className={cn("border-l px-1.5", on ? "border-red-200 hover:bg-red-100" : "hover:bg-zinc-100")}><ChevronDown className="size-4" /></button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56 p-1">
          {LOCK_MODES.map(([k, , long]) => (
            <button key={k} onClick={() => { onMode(k); setOpen(false) }} className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-zinc-100">
              <Lock className={cn("size-4", k === "others" ? "text-red-600" : "text-zinc-400")} />
              <span className="flex-1">{long}</span>
              <span className="text-xs text-zinc-400">{counts[k]}</span>
              <Check className={cn("size-4", !(on && mode === k) && "invisible")} />
            </button>
          ))}
          <div className="-mx-1 my-1 border-t" />
          <button onClick={() => { setOpen(false); p.openFlow({ kind: "locks" }) }} className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-zinc-100"><Users className="size-4 text-zinc-500" /> Who's editing what…</button>
          <button disabled={!counts.me} onClick={() => { setOpen(false); p.releaseAllMine() }} className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-zinc-100 disabled:opacity-50"><LockOpen className="size-4 text-zinc-500" /> Release all my locks</button>
        </PopoverContent>
      </Popover>
    </div>
  )
}

function ExplorerTab() {
  const p = useProto()
  const [query, setQuery] = useState("")
  const all = useMemo(() => PROJECT_FILES.map((t) => p.files.find((f) => f.path === t.path) ?? t), [p.files])
  const fullTree = useMemo(() => buildTree(all), [all])
  const [open, setOpen] = useState(() => new Set(folderPaths(fullTree, 2)))
  const [dateFilter, setDateFilter] = useState<DateValue>({ kind: "preset", preset: "any" })
  const [revFilter, setRevFilter] = useState("any")
  const [lockOn, setLockOn] = useState(false)
  const [lockMode, setLockMode] = useState<LockMode>("all")
  const [sort, setSort] = useState<Sort<ExplorerSortKey>>({ key: "name", dir: "asc" })
  const q = query.trim().toLowerCase()
  const dateActive = !(dateFilter.kind === "preset" && dateFilter.preset === "any")
  const filtering = !!q || dateActive || revFilter !== "any" || lockOn
  const lockCounts = { all: all.filter(lockTest.all).length, me: all.filter(lockTest.me).length, others: all.filter(lockTest.others).length }
  const matches = all.filter((f) => {
    const meta = fileMeta(f)
    if (lockOn && !lockTest[lockMode](f)) return false
    if (q && !f.path.toLowerCase().includes(q)) return false
    if (!matchesDate(dateFilter, meta.at)) return false
    if (revFilter === "working") return meta.rev === null
    if (revFilter !== "any" && !(meta.rev ?? "").startsWith(revFilter)) return false
    return true
  })
  const revOptions = FILE_REVS.map((r) => ({ id: r.id, message: r.message, when: formatWhen(r.at, false) }))
  const tree = useMemo(() => sortTree(filtering ? buildTree(matches) : fullTree, sort), [filtering, matches, fullTree, sort])
  const toggle = (path: string) => setOpen((s) => { const n = new Set(s); if (n.has(path)) n.delete(path); else n.add(path); return n })
  const allFolders = folderPaths(fullTree)
  const allOpen = filtering || allFolders.every((f) => open.has(f))
  const [selected, setSelected] = useState<string | null>(null)
  const selectedFile = all.find((f) => f.path === selected)
  // A file link elsewhere: clear filters, open its folders, select it and scroll to it.
  useEffect(() => {
    const n = p.nav
    if (!n || n.kind !== "file") return
    p.doneNav()
    setQuery(""); setDateFilter({ kind: "preset", preset: "any" }); setRevFilter("any"); setLockOn(false)
    const parts = n.id.split("/")
    setOpen((s) => new Set([...s, ...parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join("/"))]))
    setSelected(n.id)
    requestAnimationFrame(() => requestAnimationFrame(() => document.querySelector(`[data-path="${CSS.escape(n.id)}"]`)?.scrollIntoView({ block: "center" })))
  }, [p.nav?.seq])
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
        <LockFilterButton on={lockOn} mode={lockMode} counts={lockCounts} onToggle={() => setLockOn(!lockOn)} onMode={(m) => { setLockMode(m); setLockOn(true) }} />
        <Button
          size="sm" variant="outline" className="h-8 w-32 justify-start gap-1.5" disabled={filtering}
          title={filtering ? "Folders are expanded while filtering" : undefined}
          onClick={() => setOpen(allOpen ? new Set() : new Set(allFolders))}
        >{allOpen ? <><ChevronsDownUp className="size-4" /> Collapse all</> : <><ChevronsUpDown className="size-4" /> Expand all</>}</Button>
      </div>
      <div className="text-xs text-zinc-500">
        {p.mode === "developer" ? `${p.branch} · view filter: Art/**, Audio/**, Content/**, Source/** … · ` : `Files on ${p.branch} · `}
        {matches.length} file{matches.length === 1 ? "" : "s"}{filtering && " matching"}
        {filtering && <button className="ml-2 underline" onClick={() => { setQuery(""); setDateFilter({ kind: "preset", preset: "any" }); setRevFilter("any"); setLockOn(false) }}>Clear filters</button>}
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
        <div className="flex items-center gap-2 border-b bg-zinc-50 py-1.5 pl-3 pr-3 text-[11px] font-medium uppercase text-zinc-500">
          <span className="flex-1"><SortHeader label="Name" k="name" sort={sort} onSort={setSort} /></span>
          <span className={COLS}>
            <SortHeader label="Status" k="status" sort={sort} onSort={setSort} align="right" />
            <SortHeader label="Modified" k="modified" sort={sort} onSort={setSort} align="right" firstDir="desc" />
            <SortHeader label="Revision" k="revision" sort={sort} onSort={setSort} align="right" />
            <SortHeader label="Size" k="size" sort={sort} onSort={setSort} align="right" firstDir="desc" />
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
  // `lore branch create` has no base option: it forks from the revision you're synced to and switches to the new
  // branch itself, without touching files. Starting from another branch means switching there first, which Lore
  // refuses when it would change a file you've edited, so Scribe asks for a clean working tree in that case.
  const away = from !== p.branch
  const blocked = changed > 0 && away
  const nm = trimmed || "<name>"
  const steps = [away && `lore branch switch ${from}`, `lore branch create ${nm}`, !switchNow && `lore branch switch ${p.branch}`].filter(Boolean)
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
            <p className="text-xs text-zinc-500">{away ? `Starts at the latest revision of ${from}. Scribe switches there first to create it${switchNow ? "" : ", then back to " + p.branch}.` : `Starts at the revision you're on now${switchNow ? "" : `. Scribe switches back to ${p.branch} afterwards`}.`}</p>
            {dev && <code className="block rounded bg-zinc-100 px-2 py-1 font-mono text-[11px] leading-4 text-zinc-600">{steps.map((c) => <span key={String(c)} className="block">$ {c}</span>)}</code>}
          </div>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={switchNow} onCheckedChange={(v) => setSwitchNow(v === true)} className="mt-0.5" />
            <span>
              Switch to it now
              {switchNow && changed > 0 && !blocked && <span className="block text-xs text-zinc-500">Your {changed} changed file{changed === 1 ? "" : "s"} come with you.</span>}
              {switchNow && p.unpushed > 0 && <span className="block text-xs text-zinc-500">Your {p.unpushed} unpushed commit{p.unpushed === 1 ? " is" : "s are"} included, since the branch starts from where you are.</span>}
            </span>
          </label>
          {blocked && <p className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900"><TriangleAlert className="size-4 shrink-0" /> To start from {from}, Scribe has to switch there first. Commit your {changed} changed file{changed === 1 ? "" : "s"}, or start from {p.branch}.</p>}
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
      <DialogContent className="flex h-[42.5rem] max-h-[calc(100vh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-[60rem]">
        <nav className="flex w-56 shrink-0 flex-col gap-0.5 border-r bg-zinc-50/80 p-3">
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
                <AutoLockPatterns className={block} />
                <section className={block}>
                  <div className="font-medium">Scan for changes</div>
                  <Label className="font-normal"><Checkbox checked={p.autoScan} onCheckedChange={(v) => p.setAutoScan(v === true)} /> Check the disk for changes whenever Scribe comes into focus</Label>
                  <p className="text-xs text-zinc-500">Lore only notices edits when asked to look. Turn this off on very large projects and use Scan for changes (F5) instead.</p>
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
                  <div className="grid grid-cols-4 gap-2">
                    {([["Size on disk", pr.size], ["Branches", pr.branches], ["Members", pr.members], ["Last synced", pr.lastSync]] as const).map(([l, v]) => (
                      <div key={l} className="rounded-md border bg-zinc-50 px-2.5 py-1.5"><div className="text-zinc-500">{l}</div><div className="text-sm font-medium">{v}</div></div>
                    ))}
                  </div>
                  <dl className="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-1.5">
                    <dt className="text-zinc-500">Server</dt><dd>{pr.server}</dd>
                    <dt className="text-zinc-500">Address</dt><dd className="break-all font-mono text-[11px]">{pr.url}</dd>
                    <dt className="text-zinc-500">Local folder</dt><dd className="break-all font-mono text-[11px]">{pr.path}</dd>
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

const SHARED_PATTERNS = ["*.psd", "*.blend", "*.umap", "*.uasset", "*.fbx", "Levels/**"]

function globRe(glob: string) {
  const esc = (x: string) => x.replace(/[.+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp("^" + glob.split("**").map((part) => part.split("*").map(esc).join("[^/]*")).join(".*") + "$", "i")
}
const matches = (glob: string, path: string) => globRe(glob).test(glob.includes("/") ? path : fileName(path))

/** Settings → General: files that lock themselves when you start editing them. */
function AutoLockPatterns({ className }: { className: string }) {
  const p = useProto()
  const [local, setLocal] = useState(["*.kra"])
  const [draft, setDraft] = useState("")
  const [test, setTest] = useState("Art/Characters/hero.psd")
  const add = () => { const v = draft.trim(); if (v && !local.includes(v) && !SHARED_PATTERNS.includes(v)) setLocal([...local, v]); setDraft("") }
  const hit = SHARED_PATTERNS.find((g) => matches(g, test)) ?? local.find((g) => matches(g, test))
  const chip = "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[11px]"
  return (
    <section className={className}>
      <div className="font-medium">Auto-lock patterns</div>
      <p className="text-xs text-zinc-500">Files matching these lock automatically the moment you start editing them.</p>
      <div className="space-y-1">
        <div className="text-xs text-zinc-500">Shared with the team, from this project's <code>.scribelock</code> (read-only here)</div>
        <div className="flex flex-wrap gap-1">{SHARED_PATTERNS.map((g) => <span key={g} className={cn(chip, "bg-zinc-50 text-zinc-600")}><Lock className="size-3" />{g}</span>)}</div>
      </div>
      <div className="space-y-1">
        <div className="text-xs text-zinc-500">Just for you, on this computer</div>
        <div className="flex flex-wrap gap-1">
          {local.map((g) => <span key={g} className={chip}>{g}<button aria-label={`Remove ${g}`} className="text-zinc-400 hover:text-zinc-900" onClick={() => setLocal(local.filter((x) => x !== g))}><X className="size-3" /></button></span>)}
          {!local.length && <span className="text-xs text-zinc-400">None yet.</span>}
        </div>
        <form className="flex gap-2 pt-1" onSubmit={(e) => { e.preventDefault(); add() }}>
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="e.g. *.kra or Cinematics/**" className="h-8 font-mono text-xs" />
          <Button type="submit" size="sm" variant="outline" disabled={!draft.trim()}>Add</Button>
        </form>
      </div>
      <div className="space-y-1">
        <div className="text-xs text-zinc-500">Try a path</div>
        <Input value={test} onChange={(e) => setTest(e.target.value)} className="h-8 font-mono text-xs" />
        <p className={cn("text-xs", hit ? "text-emerald-700" : "text-zinc-500")}>{!test.trim() ? " " : hit ? `Locks automatically (matches ${hit}, ${SHARED_PATTERNS.includes(hit) ? "shared" : "yours"})` : "Doesn't lock automatically"}</p>
      </div>
      {p.mode === "developer" && <p className="text-[11px] text-zinc-400">Scribe runs <code>lore lock acquire &lt;path&gt; --branch {p.branch}</code> when a matching file first turns dirty.</p>}
    </section>
  )
}

/** Sync split button: the left part syncs the latest, the arrow opens the options. */
function SyncButton() {
  const p = useProto()
  const [open, setOpen] = useState(false)
  const item = "flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-zinc-100 [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-zinc-500"
  const go = (f: Parameters<typeof p.openFlow>[0]) => { setOpen(false); p.openFlow(f) }
  return (
    <div className="flex h-8 items-stretch overflow-hidden rounded-md border bg-white text-sm shadow-xs">
      <button onClick={() => p.sync()} title={p.incoming ? "1 new revision on the server" : "Get the latest from the server"} className="flex items-center gap-1.5 px-2.5 font-medium hover:bg-zinc-100">
        <ArrowDownToLine className="size-4" /> Sync
        {p.incoming && <span className="rounded bg-sky-100 px-1 text-[10px] text-sky-700">1 new</span>}
      </button>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild><button aria-label="Sync options" className="border-l px-1.5 hover:bg-zinc-100"><ChevronDown className="size-4" /></button></PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-1">
          <button className={item} onClick={() => go({ kind: "sync", preview: true })}><Eye /> Preview what Sync would change</button>
          <button className={item} onClick={() => go({ kind: "sync", target: "" })}><HistoryIcon /> Sync to an earlier revision…</button>
          <button className={item} onClick={() => go({ kind: "sync", reset: true })}><TriangleAlert /> Sync and overwrite my changes…</button>
          <button className={item} onClick={() => go({ kind: "sync" })}><FolderTree /> Choose folders on this computer…</button>
          <div className="-mx-1 my-1 border-t" />
          <button className={item} onClick={() => go({ kind: "sync" })}><Settings2 /> All sync options…</button>
        </PopoverContent>
      </Popover>
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

// Revision links anywhere can name the commit they point at.
setRevisionLookup((id) => {
  const cm = GRAPH_COMMITS.find((x) => x.id === id) ?? LONG_HISTORY.find((x) => x.id === id)
  return cm && { message: cm.message, author: cm.author, when: formatWhen(cm.at, false) }
})

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

/** Mock facts about a branch, derived from the graph data. Shared by the Graph tooltip and Branch information. */
function branchFacts(b: string) {
  const own = GRAPH_COMMITS.filter((cm) => cm.branch === b)
  const mainHead = GRAPH_COMMITS.find((cm) => cm.branch === "main")!
  const head = own[0] ?? mainHead
  const oldest = own[own.length - 1]
  const isMain = b === "main"
  const baseCommit = isMain ? undefined : oldest ? GRAPH_COMMITS.find((cm) => cm.id === oldest.parents[0]) : mainHead
  return {
    own, head, isMain, baseCommit,
    behind: baseCommit ? GRAPH_COMMITS.filter((cm) => cm.branch === "main" && cm.at > baseCommit.at).length : 0,
    mergedInto: own.length ? GRAPH_COMMITS.find((cm) => cm.branch !== b && cm.parents.slice(1).includes(head.id))?.branch : undefined,
    contributors: [...new Set((own.length ? own : [head]).map((cm) => cm.author))],
    createdBy: oldest?.author ?? "You",
    createdAt: oldest?.at ?? NOW - 10 * 60_000,
  }
}

function BranchTooltip({ branch, current, x, y, maxY }: { branch: string; current: boolean; x: number; y: number; maxY: number }) {
  const f = branchFacts(branch)
  const col = branchColor(branch)
  const H = 190
  return (
    <div className="pointer-events-none absolute z-30 w-72 rounded-lg border bg-white p-3 text-xs shadow-lg" style={{ left: x + 14, top: Math.max(4, Math.min(y + 10, maxY - H)) }}>
      <div className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
        <span className="size-2.5 shrink-0 rounded-full" style={{ background: col }} />
        <span className="truncate">{branch}</span>
        {current && <span className="rounded bg-zinc-900 px-1.5 py-px text-[10px] font-medium text-white">current</span>}
        {useProto().protectedBranches.includes(branch) && <span className="rounded border px-1.5 py-px text-[10px] font-medium text-zinc-500">protected</span>}
      </div>
      <p className="mb-2 text-zinc-500">{f.isMain ? "The project's default branch." : `Started from ${f.baseCommit?.branch ?? "main"} by ${f.createdBy}, ${formatWhen(f.createdAt, false)}.`}</p>
      <dl className="grid grid-cols-[5.5rem_1fr] gap-x-2 gap-y-1">
        <dt className="text-zinc-500">Commits</dt><dd>{f.own.length}{!f.isMain && <span className="text-zinc-500"> · {f.behind} behind main</span>}</dd>
        <dt className="text-zinc-500">Latest</dt><dd className="truncate">{f.head.message}</dd>
        <dt className="text-zinc-500" />
        <dd className="-mt-1 text-zinc-500">{f.head.author} · {formatWhen(f.head.at, false)}</dd>
        <dt className="text-zinc-500">Merged</dt><dd>{f.isMain ? "–" : f.mergedInto ? <span className="text-emerald-700">Yes, into {f.mergedInto}</span> : "Not yet"}</dd>
        <dt className="text-zinc-500">People</dt><dd className="truncate">{f.contributors.join(", ")}</dd>
      </dl>
      <p className="mt-2 border-t pt-1.5 text-[11px] text-zinc-400">Right-click the branch in the side panel for more.</p>
    </div>
  )
}

function GraphTab({ onOpenStaging }: { onOpenStaging: () => void }) {
  const p = useProto()
  const dev = p.mode === "developer"
  const [scope, setScope] = useState<"all" | "current">("all")
  const [hover, setHover] = useState<{ branch: string; x: number; y: number } | null>(null)
  const [hoverCommit, setHoverCommit] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [hit, setHit] = useState(0)
  const canvasRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Heads: the newest commit on each branch. A branch made in this session (no commits yet) points at where main is.
  const base = GRAPH_COMMITS.map((cm) => ({ ...cm }))
  const heads = new Map<string, string>()
  for (const cm of base) if (!heads.has(cm.branch)) heads.set(cm.branch, cm.id)
  const branch = p.branch
  if (!heads.has(branch)) heads.set(branch, heads.get("main")!)
  // Commits made in this session sit on top of the current branch.
  const fresh = p.history.filter(isSession)
  const extra: GraphCommit[] = fresh.map((r, i) => ({ ...r, at: NOW - 60_000 * (i + 1), branch, parents: [] }))
  extra.forEach((cm, i) => { cm.parents = [extra[i + 1]?.id ?? heads.get(branch)!] })
  if (extra.length) heads.set(branch, extra[0].id)
  const changed = p.files.filter((f) => f.change).length
  const working: GraphCommit[] = changed ? [{ id: "working", branch, message: `Uncommitted changes (${changed})`, author: "You", at: NOW, when: "", files: changed, parents: [heads.get(branch)!], working: true }] : []
  let commits = [...working, ...extra, ...base]
  if (scope === "current") { const keep = ancestors(commits, working[0]?.id ?? heads.get(branch)!); commits = commits.filter((cm) => keep.has(cm.id)) }

  const { laneOf, edges, width } = layout(commits)
  const graphW = laneX(width - 1) + 14
  const height = commits.length * ROW_H
  const labels = new Map<string, string[]>()
  for (const [b, id] of heads) if (scope === "all" || b === branch) labels.set(id, [...(labels.get(id) ?? []), b])
  const selectedEntry = commits.find((cm) => cm.id === selected && !cm.working)
  const branchCount = new Set(commits.map((cm) => cm.branch)).size
  const pick = (cm: GraphCommit) => { if (cm.working) onOpenStaging(); else setSelected(selected === cm.id ? null : cm.id) }
  // Search doesn't filter the graph: it finds matching commits and takes you to them one at a time.
  const sq = search.trim().toLowerCase()
  const matches = sq ? commits.filter((cm) => !cm.working && (cm.message.toLowerCase().includes(sq) || descriptionOf(cm).toLowerCase().includes(sq) || cm.id.startsWith(sq) || cm.author.toLowerCase().includes(sq))) : []
  const matchIds = new Set(matches.map((cm) => cm.id))
  const goToHit = (n: number) => {
    if (!matches.length) return
    const k = ((n % matches.length) + matches.length) % matches.length
    setHit(k)
    const cm = matches[k]
    setSelected(cm.id)
    const box = scrollRef.current
    if (box) box.scrollTo({ top: Math.max(0, commits.indexOf(cm) * ROW_H - box.clientHeight / 2 + ROW_H), behavior: "smooth" })
  }
  useEffect(() => { if (sq) goToHit(0); else setHit(0) }, [sq, scope])
  const hoverAt = (b: string, el: Element) => {
    const r = el.getBoundingClientRect(), c = canvasRef.current!.getBoundingClientRect()
    setHover({ branch: b, x: r.right - c.left - 10, y: r.top - c.top + r.height / 2 })
  }

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
          <div className="relative ml-auto w-72">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "ArrowDown") { e.preventDefault(); goToHit(hit + (e.shiftKey ? -1 : 1)) }
                if (e.key === "ArrowUp") { e.preventDefault(); goToHit(hit - 1) }
                if (e.key === "Escape") setSearch("")
              }}
              placeholder="Find a commit: summary, ID, author…"
              aria-label="Find a commit"
              className={cn("h-8 pl-8", sq ? "pr-28" : "pr-2")}
            />
            {sq && (
              <span className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5 text-xs text-zinc-500">
                <span className={cn("px-1 tabular-nums", !matches.length && "text-red-600")}>{matches.length ? `${hit + 1} of ${matches.length}` : "No match"}</span>
                <button aria-label="Previous match" title="Previous match (Shift+Enter)" disabled={!matches.length} className="rounded p-0.5 hover:bg-zinc-100 disabled:opacity-40" onClick={() => goToHit(hit - 1)}><ArrowUp className="size-3.5" /></button>
                <button aria-label="Next match" title="Next match (Enter)" disabled={!matches.length} className="rounded p-0.5 hover:bg-zinc-100 disabled:opacity-40" onClick={() => goToHit(hit + 1)}><ArrowDown className="size-3.5" /></button>
                <button aria-label="Clear search" className="rounded p-0.5 hover:bg-zinc-100" onClick={() => setSearch("")}><X className="size-3.5" /></button>
              </span>
            )}
          </div>
        </div>
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto rounded-lg border">
          <div style={{ minWidth: graphW + 540 }}>
          <div className="sticky top-0 z-20 flex h-8 items-center gap-3 border-b bg-zinc-50 pr-3 text-[11px] font-medium uppercase text-zinc-500" style={{ paddingLeft: graphW + 4 }}>
            <span className="absolute left-3">Graph</span>
            <span className="min-w-48 flex-1">Summary</span>
            <span className="w-20 shrink-0">Revision</span>
            <span className="w-24 shrink-0">Author</span>
            <span className="w-24 shrink-0">When</span>
          </div>
          <div ref={canvasRef} className="relative" style={{ height }}>
            <svg className="pointer-events-none absolute left-0 top-0 z-10" width={graphW} height={height} onMouseLeave={() => setHover(null)}>
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
                      onMouseMove={(ev) => { const r = canvasRef.current!.getBoundingClientRect(); setHover({ branch: e.branch, x: ev.clientX - r.left, y: ev.clientY - r.top }) }}
                      onMouseLeave={() => setHover(null)}
                    />
                  </g>
                )
              })}
              {commits.map((cm, i) => {
                const x = laneX(laneOf.get(cm.id)!), y = rowY(i), col = branchColor(cm.branch)
                const dim = hover && hover.branch !== cm.branch
                const lit = selected === cm.id || hoverCommit === cm.id
                const hoverProps = {
                  style: { pointerEvents: "all" as const, cursor: "pointer" },
                  opacity: dim ? 0.25 : 1,
                  className: "transition-opacity",
                  onMouseEnter: () => { setHover({ branch: cm.branch, x, y }); setHoverCommit(cm.id) },
                  onMouseLeave: () => { setHover(null); setHoverCommit(null) },
                  onClick: () => pick(cm),
                }
                const isHead = labels.has(cm.id)
                const isMerge = cm.parents.length > 1
                return (
                  <g key={cm.id} {...hoverProps}>
                    {lit && <circle cx={x} cy={y} r={10} fill={col} opacity={0.22} />}
                    {lit && <circle cx={x} cy={y} r={10} fill="none" stroke={col} strokeWidth={1} opacity={0.6} />}
                    {cm.working
                      ? <circle cx={x} cy={y} r={5} fill="white" stroke={col} strokeWidth={2} strokeDasharray="2 2" />
                      : isMerge
                        ? <circle cx={x} cy={y} r={4.5} fill="white" stroke={col} strokeWidth={2.5} />
                        : <circle cx={x} cy={y} r={isHead ? 6 : 4.5} fill={col} stroke="white" strokeWidth={1.5} />}
                    <circle cx={x} cy={y} r={9} fill="transparent" />
                  </g>
                )
              })}
            </svg>
            {hover && <BranchTooltip branch={hover.branch} current={hover.branch === branch} x={hover.x} y={hover.y} maxY={height} />}
            {commits.map((cm, i) => {
              const isSel = selected === cm.id
              const refs = labels.get(cm.id) ?? []
              const rowEl = (
                <button
                  key={cm.id}
                  onClick={() => pick(cm)}
                  onMouseEnter={() => setHoverCommit(cm.id)}
                  onMouseLeave={() => setHoverCommit(null)}
                  data-rev={cm.id}
                  title={cm.working ? "Open in Staging" : undefined}
                  className={cn("group absolute left-0 right-0 flex items-center gap-3 border-b pr-3 text-left text-sm", isSel ? "bg-sky-50 ring-1 ring-inset ring-sky-300" : matchIds.has(cm.id) ? "bg-amber-50 hover:bg-amber-100/70" : "hover:bg-zinc-50")}
                  style={{ top: i * ROW_H, height: ROW_H, paddingLeft: graphW + 4 }}
                >
                  <span className="flex min-w-48 flex-1 items-center gap-1.5 overflow-hidden">
                    {refs.map((b) => {
                      const current = b === branch
                      return (
                        <span
                          key={b}
                          onMouseEnter={(e) => hoverAt(b, e.currentTarget)}
                          onMouseLeave={() => setHover(null)}
                          className={cn("flex max-w-40 shrink-0 items-center gap-1 rounded-full border px-1.5 py-px text-[11px] font-medium", current && "text-white")}
                          style={current ? { background: branchColor(b), borderColor: branchColor(b) } : { color: branchColor(b), borderColor: branchColor(b) + "66", background: branchColor(b) + "14" }}
                        ><GitBranch className="size-3 shrink-0" /><span className="truncate">{b}</span></span>
                      )
                    })}
                    <span className={cn("truncate", cm.working && "italic text-zinc-500", cm.parents.length > 1 && "text-zinc-500")}>{cm.message}</span>
                    {cm.working && <span className="shrink-0 text-xs text-sky-700 opacity-0 group-hover:opacity-100">Open in Staging →</span>}
                    {cm.local && <Badge variant="outline" className="shrink-0 font-normal">not pushed</Badge>}
                  </span>
                  {!cm.working && (
                    <>
                      <code className="w-20 shrink-0 text-xs text-zinc-500">{cm.id}</code>
                      <span className="flex w-24 shrink-0 items-center gap-1.5 text-zinc-600">
                        <span className="grid size-5 shrink-0 place-items-center rounded-full text-[9px] font-semibold text-white" style={{ background: branchColor(cm.author) }}>{cm.author.slice(0, 2).toUpperCase()}</span>
                        <span className="truncate text-xs">{cm.author}</span>
                      </span>
                      <span className="w-24 shrink-0 text-xs text-zinc-500">{formatWhen(cm.at, dev)}</span>
                    </>
                  )}
                </button>
              )
              return cm.working ? rowEl : <RevisionMenu key={cm.id} rev={cm}>{rowEl}</RevisionMenu>
            })}
          </div>
          </div>
        </div>
      </div>
      <CommitDetails entry={selectedEntry} branch={selectedEntry?.branch} onClose={() => setSelected(null)} />
    </div>
  )
}

type TabKey = "staging" | "history" | "explorer" | "graph" | "log"
const TAB_ORDER: TabKey[] = ["staging", "history", "explorer", "graph", "log"]
const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
const MOD = isMac ? "⌘" : "Ctrl"

/** Ask the side panel to do something it owns (settings, branches, projects). Prototype shortcut instead of lifting state. */
function runCommand(type: "settings" | "new-branch" | "switch-branch" | "open-project", value?: string) {
  window.dispatchEvent(new CustomEvent("scribe:command", { detail: { type, value } }))
}

function CommandPalette({ open, onOpenChange, onTab }: { open: boolean; onOpenChange: (o: boolean) => void; onTab: (t: TabKey) => void }) {
  const p = useProto()
  const dev = p.mode === "developer"
  const run = (fn: () => void) => { onOpenChange(false); fn() }
  const tabs: [TabKey, string, typeof Settings][] = [["staging", "Staging", FileDiff], ["history", "History", HistoryIcon], ["explorer", "Explorer", FolderTree], ["graph", "Graph", GitGraph], ...(dev ? [["log", "Lore log", ScrollText] as [TabKey, string, typeof Settings]] : [])]
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Commands" description="Run a command or jump somewhere">
      <CommandInput placeholder="Type a command or search…" />
      <CommandList className="max-h-[26rem]">
        <CommandEmpty>No matching commands.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => run(() => p.sync())}><ArrowDownToLine /> Sync<CommandShortcut>{MOD} Shift S</CommandShortcut></CommandItem>
          <CommandItem onSelect={() => run(() => p.openFlow({ kind: "sync" }))}><ArrowDownToLine /> Sync options…</CommandItem>
          <CommandItem onSelect={() => run(() => p.openFlow({ kind: "sync", preview: true }))}><Eye /> Preview Sync</CommandItem>
          <CommandItem onSelect={() => run(() => p.scan("scan"))}><RefreshCw /> Scan for changes<CommandShortcut>F5</CommandShortcut></CommandItem>
          <CommandItem onSelect={() => run(() => onTab("staging"))}><GitCommitHorizontal /> Commit…</CommandItem>
          {dev
            ? <CommandItem onSelect={() => run(p.push)}><ArrowUpFromLine /> Push</CommandItem>
            : <CommandItem onSelect={() => run(() => onTab("staging"))}><ArrowUpFromLine /> Commit &amp; Push…</CommandItem>}
          <CommandItem onSelect={() => run(() => runCommand("new-branch"))}><GitBranchPlus /> New branch…</CommandItem>
          <CommandItem onSelect={() => run(() => p.openFlow({ kind: "locks" }))}><Users /> Who's editing what…</CommandItem>
          <CommandItem onSelect={() => run(p.releaseAllMine)}><LockOpen /> Release all my locks</CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Go to">
          {tabs.map(([k, l, Icon], i) => (
            <CommandItem key={k} value={`go to ${l}`} onSelect={() => run(() => onTab(k))}><Icon /> {l}<CommandShortcut>{MOD} {i + 1}</CommandShortcut></CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Switch branch">
          {p.branches.map((b) => (
            <CommandItem key={b} value={`switch branch ${b}`} disabled={b === p.branch} onSelect={() => run(() => runCommand("switch-branch", b))}>
              <GitBranch /> {b}{b === p.branch && <span className="ml-auto text-xs text-zinc-400">current</span>}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading={`Merge into ${p.branch}`}>
          {p.branches.filter((b) => b !== p.branch).map((b) => (
            <CommandItem key={b} value={`merge ${b} into current`} onSelect={() => run(() => p.openFlow({ kind: "merge", branch: b, into: false }))}><GitMerge /> Merge {b}…</CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Projects">
          {PROJECTS.map((pr) => (
            <CommandItem key={pr.name} value={`open project ${pr.name}`} onSelect={() => run(() => runCommand("open-project", pr.name))}><FolderGit2 /> Open {pr.name}</CommandItem>
          ))}
          <CommandItem onSelect={() => run(() => runCommand("settings", "projects"))}><Settings2 /> Manage projects…</CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Settings">
          <CommandItem onSelect={() => run(() => runCommand("settings", "general"))}><Settings /> Open Settings<CommandShortcut>{MOD} ,</CommandShortcut></CommandItem>
          <CommandItem onSelect={() => run(() => runCommand("settings", "account"))}><UserRound /> Accounts…</CommandItem>
          <CommandItem onSelect={() => run(() => runCommand("settings", "theme"))}><Palette /> Theme…</CommandItem>
          <CommandItem onSelect={() => run(() => { p.setMode(dev ? "artist" : "developer"); p.say(`Switched to ${dev ? "Artist" : "Developer"} Mode`) })}><Monitor /> Switch to {dev ? "Artist" : "Developer"} Mode</CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}

export function VariantD() {
  const p = useProto()
  const dev = p.mode === "developer"
  const changed = p.files.filter((f) => f.change).length
  const [tab, setTab] = useState<TabKey>("staging")
  const [palette, setPalette] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F5") { e.preventDefault(); p.scan("scan"); return }
      if (!(e.ctrlKey || e.metaKey)) return
      const k = e.key.toLowerCase()
      if (k === "k") { e.preventDefault(); setPalette((o) => !o) }
      else if (k === ",") { e.preventDefault(); runCommand("settings", "general") }
      else if (k === "s" && e.shiftKey) { e.preventDefault(); p.sync() }
      else if (/^[1-5]$/.test(k)) {
        const t = TAB_ORDER[Number(k) - 1]
        if (t === "log" && !dev) return
        e.preventDefault(); setTab(t)
      }
    }
    const onFocus = () => { if (p.autoScan) p.scan("auto") }
    const onCmd = (e: Event) => { const d = (e as CustomEvent<{ type: string; value?: string }>).detail; if (d.type === "tab") setTab(d.value as TabKey) }
    if (p.nav?.kind === "revision" && tab !== "history") setTab("history")
    if (p.nav?.kind === "file" && tab !== "explorer") setTab("explorer")
    window.addEventListener("keydown", onKey)
    window.addEventListener("focus", onFocus)
    window.addEventListener("scribe:command", onCmd)
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("focus", onFocus); window.removeEventListener("scribe:command", onCmd) }
  })
  return (
    <div className="flex h-full">
      <SidePanel />
      <div className="flex min-w-0 flex-1 flex-col">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="flex min-h-0 flex-1 flex-col gap-0">
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
              <Button size="sm" variant="outline" className="gap-1.5 text-zinc-600" onClick={() => setPalette(true)} title={`Command palette (${MOD}+K)`}>
                <CommandIcon className="size-4" /> <span className="hidden xl:inline">Commands</span>
                <kbd className="rounded border bg-zinc-50 px-1 font-sans text-[10px] font-medium text-zinc-500">{MOD} K</kbd>
              </Button>
              <SyncButton />
              {dev && <Button size="sm" variant="outline" className="gap-1.5" title="Push your local Commits and release the Locks on the files they changed" onClick={p.push}><ArrowUpFromLine className="size-4" /> Push{p.unpushed ? ` ↑${p.unpushed}` : ""}</Button>}
            </div>
          </div>
          <TabsContent value="staging" className="min-h-0 flex-1"><StagingTab /></TabsContent>
          <TabsContent value="history" className="min-h-0 flex-1"><HistoryTab /></TabsContent>
          <TabsContent value="explorer" className="min-h-0 flex-1"><ExplorerTab /></TabsContent>
          <TabsContent value="graph" className="min-h-0 flex-1"><GraphTab onOpenStaging={() => setTab("staging")} /></TabsContent>
          {dev && <TabsContent value="log" className="min-h-0 flex-1"><LoreLog /></TabsContent>}
        </Tabs>
        <OperationBar />
      </div>
      <CommandPalette open={palette} onOpenChange={setPalette} onTab={setTab} />
    </div>
  )
}
