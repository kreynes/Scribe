// PROTOTYPE: building blocks shared by all three layout variants. Throwaway code.
import { useState, type ReactNode } from "react"
import { AudioLines, Box, FileText, GitBranch, Image, Lock, LockOpen, Map, Pin, PinOff, TriangleAlert, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuLabel, ContextMenuSeparator, ContextMenuShortcut, ContextMenuTrigger } from "@/components/ui/context-menu"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { BRANCHES, LORE_LOG, fileName, lockLabel, useProto, type FileEntry, type Revision } from "./state"

const KIND_ICON = { image: Image, model: Box, audio: AudioLines, scene: Map, text: FileText }
const KIND_TINT = { image: "from-rose-200 to-amber-100", model: "from-sky-200 to-indigo-100", audio: "from-emerald-200 to-teal-100", scene: "from-lime-200 to-green-100", text: "from-zinc-200 to-zinc-100" }

export function Thumb({ file, size = "md" }: { file: FileEntry; size?: "sm" | "md" | "lg" }) {
  const Icon = KIND_ICON[file.kind]
  const box = size === "sm" ? "size-8" : size === "md" ? "size-12" : "h-28 w-full"
  return (
    <div className={cn("grid shrink-0 place-items-center rounded-md bg-gradient-to-br text-zinc-600", KIND_TINT[file.kind], box)}>
      <Icon className={size === "lg" ? "size-8" : "size-4"} />
    </div>
  )
}

export function LockBadge({ file }: { file: FileEntry }) {
  const label = lockLabel(file.lock)
  if (!label) return null
  const mine = file.lock?.by === "you"
  return (
    <Badge variant={mine ? "secondary" : "destructive"} className="gap-1 font-normal">
      <Lock className="size-3" /> {label}
    </Badge>
  )
}

export function ChangeBadge({ file }: { file: FileEntry }) {
  if (!file.change) return null
  const tone = { modified: "text-amber-700 border-amber-300", added: "text-emerald-700 border-emerald-300", deleted: "text-red-700 border-red-300" }[file.change]
  return <Badge variant="outline" className={cn("font-normal", tone)}>{file.change}</Badge>
}

function Advanced({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <ContextMenuShortcut className="rounded border px-1 text-[10px] tracking-normal">Advanced</ContextMenuShortcut>
    </>
  )
}

export function FileMenu({ file, children }: { file: FileEntry; children: ReactNode }) {
  const p = useProto()
  const mine = file.lock?.by === "you"
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-60">
        <ContextMenuLabel className="truncate">{fileName(file.path)}</ContextMenuLabel>
        <ContextMenuSeparator />
        {file.lock && !mine ? (
          <ContextMenuItem onClick={() => p.say(`${file.lock!.by} holds this lock`)}><Lock /> {lockLabel(file.lock)}</ContextMenuItem>
        ) : (
          <ContextMenuItem onClick={() => p.toggleLock(file.path)}>{mine ? <><LockOpen /> Release lock</> : <><Lock /> Lock</>}</ContextMenuItem>
        )}
        <ContextMenuItem onClick={() => p.say("History for " + fileName(file.path))}>Show history</ContextMenuItem>
        <ContextMenuItem onClick={() => p.say("Diff for " + fileName(file.path))}>Show diff</ContextMenuItem>
        <ContextMenuItem disabled={!file.change} onClick={() => p.reset(file.path)}>Reset (discard my changes)</ContextMenuItem>
        <ContextMenuItem onClick={() => p.say("Opened file location")}>Open file location</ContextMenuItem>
        {p.mode === "developer" && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem disabled={!file.change} onClick={() => p.toggleStage(file.path)}>{file.staged ? "Unstage" : "Stage"}</ContextMenuItem>
            <ContextMenuItem onClick={() => p.say("Copied lore file history command")}>Copy CLI command</ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}

export function RevisionMenu({ rev, children }: { rev: Revision; children: ReactNode }) {
  const p = useProto()
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-64">
        <ContextMenuLabel className="truncate">{rev.message}</ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => p.say("Restore: choose a file or all files")}>Restore this revision…</ContextMenuItem>
        <ContextMenuItem onClick={() => p.say(`${rev.files} changed files`)}>Show changed files</ContextMenuItem>
        <ContextMenuItem onClick={() => p.say("Copied " + rev.id)}>Copy revision ID</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => p.say("Revert (Advanced)")}><Advanced>Revert</Advanced></ContextMenuItem>
        <ContextMenuItem onClick={() => p.say("Cherry-pick (Advanced)")}><Advanced>Cherry-pick</Advanced></ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

export function BranchMenu({ name, children }: { name: string; children: ReactNode }) {
  const p = useProto()
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-60">
        <ContextMenuLabel>{name}</ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuItem disabled={name === p.branch} onClick={() => switchBranch(p, name)}>Switch to this branch</ContextMenuItem>
        <ContextMenuItem onClick={() => p.say("Copied " + name)}>Copy name</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => p.say("Merge into current (Advanced)")}><Advanced>Merge into current</Advanced></ContextMenuItem>
        <ContextMenuItem onClick={() => p.say("Create branch from here (Advanced)")}><Advanced>Create branch from here</Advanced></ContextMenuItem>
        <ContextMenuItem variant="destructive" onClick={() => p.say("Delete (Advanced)")}><Advanced>Delete</Advanced></ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

function switchBranch(p: ReturnType<typeof useProto>, name: string) {
  const dirty = p.files.some((f) => f.change) || p.unpushed > 0
  if (dirty) return p.say("Commit or Commit & Push your changes before switching")
  p.setBranch(name)
  p.say("Switched to " + name)
}

export function BranchList({ compact = false }: { compact?: boolean }) {
  const p = useProto()
  return (
    <ul className="space-y-0.5">
      {BRANCHES.map((b) => (
        <BranchMenu key={b} name={b}>
          <li
            onClick={() => switchBranch(p, b)}
            className={cn("flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-zinc-100", b === p.branch && "bg-zinc-900 text-white hover:bg-zinc-800")}
          >
            <GitBranch className="size-3.5 shrink-0" />
            <span className="truncate">{b}</span>
            {!compact && b === p.branch && <span className="ml-auto text-[10px] opacity-70">current</span>}
          </li>
        </BranchMenu>
      ))}
    </ul>
  )
}

/** Hidden by default; a thin edge reveals it on hover; the pin keeps it open. */
export function BranchPane({ side = "left" }: { side?: "left" | "right" }) {
  const p = useProto()
  const [hover, setHover] = useState(false)
  const open = p.branchPanePinned || hover
  return (
    <div
      className={cn("relative z-20 flex h-full shrink-0 transition-[width] duration-150", open ? "w-56" : "w-3")}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className={cn("flex h-full w-full flex-col border-zinc-200 bg-white", side === "left" ? "border-r" : "border-l", !p.branchPanePinned && open && "shadow-xl")}>
        {open ? (
          <>
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Branches</span>
              <Button size="icon" variant="ghost" className="size-6" onClick={() => p.setBranchPanePinned(!p.branchPanePinned)} title={p.branchPanePinned ? "Unpin" : "Pin open"}>
                {p.branchPanePinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
              </Button>
            </div>
            <div className="px-2"><BranchList /></div>
            <p className="mt-auto p-3 text-[11px] text-zinc-400">Right-click a branch for more.</p>
          </>
        ) : (
          <div className="grid h-full place-items-center"><GitBranch className="size-3 text-zinc-300" /></div>
        )}
      </div>
    </div>
  )
}

export function ExpiredBanner() {
  const p = useProto()
  if (!p.sessionExpired) return null
  return (
    <div className="flex items-center gap-3 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
      <TriangleAlert className="size-4" />
      <span>Your sign-in to <b>studio.local</b> expired.</span>
      {p.mode === "developer" && <code className="text-xs opacity-70">NotAuthenticated (lore status 12): retrying "Sync" after sign-in</code>}
      <Button size="sm" className="ml-auto h-7" onClick={() => { p.setSessionExpired(false); p.say("Signed in again. Retrying Sync…"); p.sync() }}>Sign in again</Button>
      <button onClick={() => p.setSessionExpired(false)}><X className="size-4" /></button>
    </div>
  )
}

export function LockWarningDialog() {
  const p = useProto()
  return (
    <Dialog open={p.lockWarning} onOpenChange={p.setLockWarning}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Lock className="size-4 text-red-600" /> villain.psd is locked by Ana</DialogTitle>
          <DialogDescription>
            You just edited <b>Art/Characters/villain.psd</b>, but Ana is editing it right now. Your changes may clash with hers.
            {p.mode === "developer" && <span className="mt-2 block font-mono text-xs">lock.file_status → held by ana@studio since 09:12 · branch main · advisory lock</span>}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => { p.setLockWarning(false); p.say("Your changes to villain.psd were reset") }}>Reset my changes</Button>
          <Button onClick={() => { p.setLockWarning(false); p.say("Kept. villain.psd is flagged; Commit & Push is blocked until Ana releases it") }}>Keep my changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function OperationBar() {
  const p = useProto()
  if (!p.operation) return null
  return (
    <div className="flex items-center gap-3 border-t bg-zinc-50 px-4 py-2 text-xs">
      <span className="w-28 font-medium">{p.operation.label}…</span>
      <Progress value={p.operation.pct} className="h-1.5 flex-1" />
      <span className="w-10 text-right tabular-nums">{p.operation.pct}%</span>
      <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => p.say("Hidden: the operation keeps running")}>Hide</Button>
    </div>
  )
}

export function LoreLog() {
  return (
    <div className="h-full overflow-auto bg-zinc-950 p-3 font-mono text-[11px] leading-5 text-zinc-300">
      {LORE_LOG.map((l, i) => <div key={i}>{l}</div>)}
    </div>
  )
}

export function Toast() {
  const p = useProto()
  if (!p.toast) return null
  return <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-md bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg">{p.toast}</div>
}

/** Artist: tick files, write a message, Commit or Commit & Push. Developer: explicit staging, Commit and Push separate. */
export function CommitBox({ className }: { className?: string }) {
  const p = useProto()
  const [msg, setMsg] = useState("")
  const changed = p.files.filter((f) => f.change)
  const blocked = p.files.some((f) => f.change && f.lock && f.lock.by !== "you")
  if (p.mode === "artist") {
    const ticked = changed.filter((f) => f.ticked).length
    return (
      <div className={cn("space-y-2", className)}>
        <Textarea placeholder="What did you change?" value={msg} onChange={(e) => setMsg(e.target.value)} className="min-h-16 resize-none" />
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => { p.commit(msg); setMsg("") }}>Commit</Button>
          <Button className="flex-[2]" disabled={blocked} onClick={() => { p.commitAndPush(msg); setMsg("") }}>Commit &amp; Push {ticked ? `(${ticked})` : ""}</Button>
        </div>
        {p.unpushed > 0 && <p className="text-xs text-zinc-500">{p.unpushed} local commit{p.unpushed > 1 ? "s" : ""} will be included in your next push.</p>}
      </div>
    )
  }
  const staged = changed.filter((f) => f.staged).length
  return (
    <div className={cn("space-y-2", className)}>
      <Textarea placeholder="Commit message" value={msg} onChange={(e) => setMsg(e.target.value)} className="min-h-16 resize-none font-mono text-xs" />
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={() => p.setFiles(p.files.map((f) => (f.change ? { ...f, staged: true } : f)))}>Stage all</Button>
        <Button className="flex-1" onClick={() => { p.commit(msg); setMsg("") }}>Commit ({staged} staged)</Button>
        <Button variant="secondary" className="flex-1" onClick={() => { p.commitAndPush(msg); setMsg("") }}>Push{p.unpushed ? ` ↑${p.unpushed}` : ""}</Button>
      </div>
      <p className="font-mono text-[11px] text-zinc-500">lore file stage · lore revision commit · lore branch push</p>
    </div>
  )
}

export function ChangeRow({ file, dense = false }: { file: FileEntry; dense?: boolean }) {
  const p = useProto()
  const dev = p.mode === "developer"
  return (
    <FileMenu file={file}>
      <div className={cn("flex items-center gap-3 rounded-md px-2 hover:bg-zinc-50", dense ? "py-1" : "py-2")}>
        <Checkbox
          checked={dev ? file.staged : file.ticked}
          onCheckedChange={() => (dev ? p.toggleStage(file.path) : p.toggleTick(file.path))}
        />
        {!dev && <Thumb file={file} size="sm" />}
        <div className="min-w-0 flex-1">
          <div className={cn("truncate", dev ? "font-mono text-xs" : "text-sm font-medium")}>{dev ? file.path : fileName(file.path)}</div>
          {!dev && <div className="truncate text-xs text-zinc-500">{file.path.split("/").slice(0, -1).join(" / ")}</div>}
        </div>
        {dev && <span className="text-[11px] text-zinc-400 tabular-nums">{file.size}</span>}
        <ChangeBadge file={file} />
        <LockBadge file={file} />
      </div>
    </FileMenu>
  )
}

export function HistoryRow({ rev }: { rev: Revision }) {
  const p = useProto()
  const dev = p.mode === "developer"
  return (
    <RevisionMenu rev={rev}>
      <div className="flex items-start gap-3 rounded-md px-2 py-2 hover:bg-zinc-50">
        <div className={cn("mt-1 size-2 shrink-0 rounded-full", rev.local ? "bg-amber-500" : "bg-zinc-400")} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm">{rev.message} {rev.local && <Badge variant="outline" className="ml-1 font-normal">not pushed</Badge>}</div>
          <div className="text-xs text-zinc-500">{rev.author} · {rev.when} · {rev.files} file{rev.files > 1 ? "s" : ""}</div>
        </div>
        {dev && <code className="text-[11px] text-zinc-400">{rev.id}</code>}
      </div>
    </RevisionMenu>
  )
}
