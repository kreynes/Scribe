// PROTOTYPE: three structurally different main screens. Each renders in both Modes.
import { ArrowDownToLine, ChevronDown, FolderTree, History, LayoutGrid, List, Lock, Settings2, SquareTerminal, Users } from "lucide-react"
import { useState } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { BranchPane, ChangeBadge, ChangeRow, CommitBox, FileMenu, HistoryRow, LockBadge, LoreLog, OperationBar, Thumb } from "./shared"
import { PROJECT_TREE, TEAM, fileName, useProto } from "./state"

const ADVANCED = [
  "Stage individual files", "Amend / Revert / Cherry-pick", "Create, merge, delete, protect branches",
  "Revision IDs and metadata", "Links and layers (Preview)", "Shared stores and service", "Obliterate", "Edit view filter file",
]

function AdvancedButton() {
  const p = useProto()
  if (p.mode === "developer") return null
  return (
    <Sheet>
      <SheetTrigger asChild><Button variant="ghost" size="sm" className="gap-1.5 text-zinc-500"><Settings2 className="size-4" /> Advanced</Button></SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Advanced</SheetTitle>
          <SheetDescription>Everything else Lore can do, shown the way Developer Mode shows it.</SheetDescription>
        </SheetHeader>
        <ul className="space-y-1 px-4">
          {ADVANCED.map((a) => <li key={a} className="rounded px-2 py-2 text-sm hover:bg-zinc-100">{a}</li>)}
        </ul>
      </SheetContent>
    </Sheet>
  )
}

function SyncButton({ big = false }: { big?: boolean }) {
  const p = useProto()
  return (
    <Button variant="outline" size={big ? "lg" : "sm"} className="gap-1.5" onClick={p.sync}>
      <ArrowDownToLine className="size-4" /> Sync
    </Button>
  )
}

function ProjectTitle() {
  const p = useProto()
  return (
    <div className="flex items-center gap-2">
      <span className="font-semibold">forest-game</span>
      {p.mode === "developer" && <code className="text-xs text-zinc-400">lore://studio.local:41337/forest-game</code>}
      <Badge variant="outline" className="gap-1 font-normal">{p.branch}</Badge>
    </div>
  )
}

// ---------------------------------------------------------------- A: three-pane desktop
export function VariantA() {
  const p = useProto()
  const dev = p.mode === "developer"
  const changed = p.files.filter((f) => f.change)
  const staged = changed.filter((f) => f.staged)
  const unstaged = changed.filter((f) => !f.staged)
  const [selected, setSelected] = useState(changed[0]?.path)
  const sel = p.files.find((f) => f.path === selected) ?? changed[0]
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b px-4 py-2">
        <ProjectTitle />
        <div className="ml-auto flex items-center gap-2"><AdvancedButton /><SyncButton /></div>
      </header>
      <div className="flex min-h-0 flex-1">
        <BranchPane />
        <section className="flex w-[380px] shrink-0 flex-col border-r">
          <div className="flex-1 overflow-auto p-2">
            {dev ? (
              <>
                <h3 className="px-2 pb-1 pt-2 text-xs font-medium uppercase text-zinc-500">Staged ({staged.length})</h3>
                {staged.map((f) => <div key={f.path} onClick={() => setSelected(f.path)}><ChangeRow file={f} dense /></div>)}
                <h3 className="px-2 pb-1 pt-4 text-xs font-medium uppercase text-zinc-500">Changes ({unstaged.length})</h3>
                {unstaged.map((f) => <div key={f.path} onClick={() => setSelected(f.path)}><ChangeRow file={f} dense /></div>)}
              </>
            ) : (
              <>
                <h3 className="px-2 pb-1 pt-2 text-sm font-medium">Your changes</h3>
                {changed.map((f) => <div key={f.path} onClick={() => setSelected(f.path)}><ChangeRow file={f} /></div>)}
                {!changed.length && <p className="p-4 text-sm text-zinc-500">No changes. You're all set.</p>}
              </>
            )}
          </div>
          <CommitBox className="border-t p-3" />
        </section>
        <section className="flex min-w-0 flex-1 flex-col">
          <Tabs defaultValue="diff" className="flex min-h-0 flex-1 flex-col">
            <TabsList className="m-2">
              <TabsTrigger value="diff">{dev ? "Diff" : "Compare"}</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              {dev && <TabsTrigger value="log">Lore log</TabsTrigger>}
            </TabsList>
            <TabsContent value="diff" className="min-h-0 flex-1 p-4">
              {sel ? (
                <div className="grid h-full grid-cols-2 gap-4">
                  {["Before", "Now"].map((l) => (
                    <div key={l} className="flex flex-col gap-2">
                      <span className="text-xs text-zinc-500">{l}</span>
                      <div className="flex flex-1 items-center justify-center rounded-lg border bg-zinc-50"><Thumb file={sel} size="lg" /></div>
                    </div>
                  ))}
                  {dev && <p className="col-span-2 font-mono text-[11px] text-zinc-500">{sel.path} · {sel.size} · blake3 9a1f…c03e → 77d2…a1b0</p>}
                </div>
              ) : <p className="text-sm text-zinc-500">Select a file.</p>}
            </TabsContent>
            <TabsContent value="history" className="overflow-auto p-2">{p.history.map((r) => <HistoryRow key={r.id + r.when} rev={r} />)}</TabsContent>
            {dev && <TabsContent value="log" className="min-h-0 flex-1"><LoreLog /></TabsContent>}
          </Tabs>
        </section>
      </div>
      <OperationBar />
    </div>
  )
}

// ---------------------------------------------------------------- B: status-first single column
export function VariantB() {
  const p = useProto()
  const dev = p.mode === "developer"
  const changed = p.files.filter((f) => f.change)
  const mine = p.files.filter((f) => f.lock?.by === "you").length
  return (
    <div className="flex h-full">
      <BranchPane />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex-1 overflow-auto">
          <div className="mx-auto max-w-3xl space-y-8 px-6 py-8">
            <div className="flex items-center justify-between"><ProjectTitle /><AdvancedButton /></div>
            <section className="rounded-2xl border bg-gradient-to-br from-zinc-50 to-white p-6">
              <div className="text-2xl font-semibold">
                {changed.length ? `${changed.length} changed file${changed.length > 1 ? "s" : ""}` : "Everything is pushed"}
              </div>
              <div className="mt-1 text-sm text-zinc-500">
                {mine} locked by you · {p.unpushed} local commit{p.unpushed === 1 ? "" : "s"} not pushed · up to date with {p.branch}
              </div>
              {dev && <code className="mt-2 block text-[11px] text-zinc-400">head 9f3c2a1e · remote 9f3c2a1e · 0 behind</code>}
              <div className="mt-5 flex gap-3"><SyncButton big /></div>
            </section>
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-zinc-500">{dev ? "Working tree" : "Your changes"}</h2>
              <div className={cn(dev ? "divide-y rounded-lg border" : "grid grid-cols-1 gap-2 sm:grid-cols-2")}>
                {changed.map((f) => dev ? <ChangeRow key={f.path} file={f} dense /> : (
                  <FileMenu key={f.path} file={f}>
                    <label className={cn("flex cursor-pointer gap-3 rounded-xl border p-3 hover:border-zinc-400", f.ticked && "border-zinc-900 ring-1 ring-zinc-900")}>
                      <input type="checkbox" className="mt-1" checked={f.ticked} onChange={() => p.toggleTick(f.path)} />
                      <Thumb file={f} />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="truncate text-sm font-medium">{fileName(f.path)}</div>
                        <div className="flex flex-wrap gap-1"><ChangeBadge file={f} /><LockBadge file={f} /></div>
                      </div>
                    </label>
                  </FileMenu>
                ))}
              </div>
              <CommitBox />
            </section>
            <section className="space-y-2">
              <h2 className="text-sm font-medium text-zinc-500">History</h2>
              <div className="border-l pl-3">{p.history.map((r) => <HistoryRow key={r.id + r.when} rev={r} />)}</div>
            </section>
            {dev && <section className="h-40 overflow-hidden rounded-lg"><LoreLog /></section>}
          </div>
        </div>
        <OperationBar />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- C: file browser + team board
export function VariantC() {
  const p = useProto()
  const dev = p.mode === "developer"
  const [view, setView] = useState<"grid" | "list">(dev ? "list" : "grid")
  const [drawer, setDrawer] = useState(true)
  const tree = PROJECT_TREE.map((t) => p.files.find((f) => f.path === t.path) ?? t)
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b px-4 py-2">
        <ProjectTitle />
        <div className="ml-4 flex rounded-md border p-0.5">
          <Button size="icon" variant={view === "grid" ? "secondary" : "ghost"} className="size-7" onClick={() => setView("grid")}><LayoutGrid className="size-4" /></Button>
          <Button size="icon" variant={view === "list" ? "secondary" : "ghost"} className="size-7" onClick={() => setView("list")}><List className="size-4" /></Button>
        </div>
        <div className="ml-auto flex items-center gap-2"><AdvancedButton /><SyncButton /></div>
      </header>
      <div className="flex min-h-0 flex-1">
        <BranchPane />
        <main className="min-w-0 flex-1 overflow-auto p-4">
          <div className="mb-3 flex items-center gap-2 text-sm text-zinc-500"><FolderTree className="size-4" /> {dev ? "/ (view filter: Art/**, Audio/**, Levels/forest.umap)" : "Folders on this computer: Art, Audio, Levels"}</div>
          {view === "grid" ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
              {tree.map((f) => (
                <FileMenu key={f.path} file={f}>
                  <div className={cn("relative rounded-xl border p-2 hover:border-zinc-400", f.change && "border-amber-400")}>
                    <Thumb file={f} size="lg" />
                    {f.lock && <div className={cn("absolute right-3 top-3 rounded-full p-1 text-white", f.lock.by === "you" ? "bg-zinc-900" : "bg-red-600")}><Lock className="size-3" /></div>}
                    <div className="mt-2 truncate text-xs font-medium">{fileName(f.path)}</div>
                    <div className="truncate text-[11px] text-zinc-500">{f.lock ? (f.lock.by === "you" ? "Locked by you" : `Locked by ${f.lock.by}`) : f.change ?? "unchanged"}</div>
                  </div>
                </FileMenu>
              ))}
            </div>
          ) : (
            <div className="divide-y rounded-lg border">
              {tree.map((f) => (
                <FileMenu key={f.path} file={f}>
                  <div className="flex items-center gap-3 px-3 py-1.5 text-xs hover:bg-zinc-50">
                    <span className="flex-1 truncate font-mono">{f.path}</span>
                    <span className="w-16 text-right text-zinc-400">{f.size}</span>
                    <span className="w-20"><ChangeBadge file={f} /></span>
                    <span className="w-36"><LockBadge file={f} /></span>
                  </div>
                </FileMenu>
              ))}
            </div>
          )}
        </main>
        <aside className="flex w-72 shrink-0 flex-col border-l">
          <div className="flex items-center gap-2 px-4 py-3 text-sm font-medium"><Users className="size-4" /> Who's editing what</div>
          <div className="space-y-3 px-4">
            {[{ name: "You", initials: "ME", editing: p.files.filter((f) => f.lock?.by === "you").map((f) => f.path), online: true }, ...TEAM].map((t) => (
              <div key={t.name} className="flex gap-3">
                <Avatar className="size-8"><AvatarFallback className="text-[10px]">{t.initials}</AvatarFallback></Avatar>
                <div className="min-w-0 flex-1">
                  <div className="text-sm">{t.name} <span className={cn("ml-1 inline-block size-1.5 rounded-full", t.online ? "bg-emerald-500" : "bg-zinc-300")} /></div>
                  {t.editing.length ? t.editing.map((e) => <div key={e} className="truncate text-xs text-zinc-500">{dev ? e : fileName(e)}</div>) : <div className="text-xs text-zinc-400">Not editing anything</div>}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-auto border-t p-3">
            <div className="mb-2 text-sm font-medium">Changes to send ({p.files.filter((f) => f.change).length})</div>
            <div className="max-h-40 overflow-auto">{p.files.filter((f) => f.change).map((f) => <ChangeRow key={f.path} file={f} dense />)}</div>
            <CommitBox className="mt-2" />
          </div>
        </aside>
      </div>
      <div className="border-t">
        <button className="flex w-full items-center gap-2 px-4 py-1.5 text-xs text-zinc-500 hover:bg-zinc-50" onClick={() => setDrawer(!drawer)}>
          <History className="size-3.5" /> Activity {dev && <><SquareTerminal className="ml-2 size-3.5" /> Lore log</>}
          <ChevronDown className={cn("ml-auto size-3.5 transition", !drawer && "rotate-180")} />
        </button>
        {drawer && (
          <div className={cn("grid h-36", dev ? "grid-cols-2" : "grid-cols-1")}>
            <div className="overflow-auto px-2">{p.history.map((r) => <HistoryRow key={r.id + r.when} rev={r} />)}</div>
            {dev && <LoreLog />}
          </div>
        )}
        <OperationBar />
      </div>
    </div>
  )
}
