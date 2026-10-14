// PROTOTYPE: Variant D, the user's layout. Side panel (project switcher + branches) and a tabbed centre: Staging, History, Explorer.
import { ArrowDownToLine, ArrowUpFromLine, ChevronRight, File, Folder, FolderOpen, GitBranch, Lock, Settings2 } from "lucide-react"
import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { BranchMenu, ChangeBadge, FileMenu, LockBadge, LoreLog, OperationBar, RevisionMenu, Thumb } from "./shared"
import { BRANCHES, PROJECT_TREE, fileName, useProto, type FileEntry, type Revision } from "./state"

const PROJECTS = ["forest-game", "ui-kit", "cinematics"]

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
      <p className="p-3 text-[11px] text-zinc-400">Double-click or right-click → Switch.</p>
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
        <span className={cn("min-w-0 flex-1 truncate", dev ? "font-mono text-xs" : "text-sm")}>{dev ? file.path : fileName(file.path)}</span>
        {!dev && <span className="hidden truncate text-xs text-zinc-400 lg:block">{file.path.split("/").slice(0, -1).join(" / ")}</span>}
        <ChangeBadge file={file} />
        <LockBadge file={file} />
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
            <Section title="Changed, not staged" files={unstaged} action={<button className="normal-case text-zinc-500 hover:text-zinc-900" onClick={() => p.setFiles(p.files.map((f) => (f.change ? { ...f, staged: true } : f)))}>Stage all</button>} />
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
                            <span className={cn("flex-1 truncate", dev ? "font-mono text-xs" : "text-sm")}>{dev ? f.path : fileName(f.path)}</span>
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

function TreeNode({ node, depth }: { node: Node; depth: number }) {
  const dev = useProto().mode === "developer"
  const [open, setOpen] = useState(depth < 2)
  if (node.file) {
    const f = node.file
    return (
      <FileMenu file={f}>
        <div className="flex items-center gap-2 py-1 pr-3 hover:bg-zinc-50" style={{ paddingLeft: depth * 16 + 12 }}>
          {dev ? <File className="size-3.5 text-zinc-400" /> : <Thumb file={f} size="sm" />}
          <span className={cn("flex-1 truncate", dev ? "font-mono text-xs" : "text-sm")}>{node.name}</span>
          {dev && <span className="w-16 text-right text-[11px] text-zinc-400">{f.size}</span>}
          <ChangeBadge file={f} />
          {f.lock && (dev ? <LockBadge file={f} /> : <span className={cn("rounded-full p-1 text-white", f.lock.by === "you" ? "bg-zinc-900" : "bg-red-600")} title={f.lock.by === "you" ? "Locked by you" : `Locked by ${f.lock.by}`}><Lock className="size-3" /></span>)}
        </div>
      </FileMenu>
    )
  }
  return (
    <div>
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 py-1 pr-3 text-left hover:bg-zinc-50" style={{ paddingLeft: depth * 16 + 12 }}>
        <ChevronRight className={cn("size-3.5 text-zinc-400 transition", open && "rotate-90")} />
        {open ? <FolderOpen className="size-4 text-amber-500" /> : <Folder className="size-4 text-amber-500" />}
        <span className="text-sm">{node.name}</span>
      </button>
      {open && node.children.map((c) => <TreeNode key={c.path} node={c} depth={depth + 1} />)}
    </div>
  )
}

function ExplorerTab() {
  const p = useProto()
  const tree = useMemo(() => buildTree(PROJECT_TREE.map((t) => p.files.find((f) => f.path === t.path) ?? t)), [p.files])
  return (
    <div className="h-full overflow-auto p-4">
      <div className="mb-2 text-xs text-zinc-500">{p.mode === "developer" ? `${p.branch} · view filter: Art/**, Audio/**, Levels/forest.umap` : `Files on ${p.branch}`}</div>
      <div className="rounded-lg border py-1">{tree.children.map((c) => <TreeNode key={c.path} node={c} depth={0} />)}</div>
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
