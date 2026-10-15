// PROTOTYPE: building blocks used by Variant D. Throwaway code.
import type { ReactNode } from "react"
import { ArrowDownToLine, FileDiff, GitBranchPlus, GitMerge, Info, Lock, LockOpen, Star, TriangleAlert, X } from "lucide-react"
import { typeOf } from "./fileTypes"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuLabel, ContextMenuSeparator, ContextMenuShortcut, ContextMenuTrigger } from "@/components/ui/context-menu"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { LORE_LOG, fileName, lockBranch, lockLabel, revisionDiff, useProto, type FileEntry, type Revision } from "./state"

const KIND_TINT = { image: "from-rose-200 to-amber-100", model: "from-sky-200 to-indigo-100", audio: "from-emerald-200 to-teal-100", scene: "from-lime-200 to-green-100", text: "from-zinc-200 to-zinc-100" }

export function Thumb({ file, size = "md" }: { file: FileEntry; size?: "sm" | "md" | "lg" }) {
  const Icon = typeOf(file.path).icon
  const box = size === "sm" ? "size-8" : size === "md" ? "size-12" : "h-28 w-full"
  return (
    <div className={cn("grid shrink-0 place-items-center rounded-md bg-gradient-to-br text-zinc-600", KIND_TINT[file.kind], box)}>
      <Icon className={size === "lg" ? "size-8" : "size-4"} />
    </div>
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
          <>
            <ContextMenuItem onClick={() => p.openFlow({ kind: "locks" })}><Lock className="text-red-600" /> {lockLabel(file.lock)} on {lockBranch(file.lock)}</ContextMenuItem>
            <ContextMenuItem variant="destructive" onClick={() => p.openFlow({ kind: "release-lock", path: file.path })}><LockOpen /> {p.mode === "developer" ? `Release ${file.lock.by}'s lock…` : <Advanced>Release {file.lock.by}'s lock…</Advanced>}</ContextMenuItem>
          </>
        ) : (
          <ContextMenuItem onClick={() => p.toggleLock(file.path)}>{mine ? <><LockOpen /> Release lock</> : <><Lock /> Lock{p.mode === "developer" && ` on ${p.branch}`}</>}</ContextMenuItem>
        )}
        <ContextMenuItem onClick={() => p.say("History for " + fileName(file.path))}>Show history</ContextMenuItem>
        <ContextMenuItem onClick={() => p.openFlow({ kind: "diff", paths: [file.path] })}><FileDiff /> Show diff</ContextMenuItem>
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
        <ContextMenuItem onClick={() => p.openFlow(revisionDiff(rev))}><FileDiff /> Show changes</ContextMenuItem>
        <ContextMenuItem disabled={!!rev.local} onClick={() => p.openFlow({ kind: "sync", target: rev.id })}><ArrowDownToLine /> Sync to this revision…</ContextMenuItem>
        <ContextMenuItem onClick={() => p.say("Restore: choose a file or all files")}>Restore this revision…</ContextMenuItem>
        <ContextMenuItem onClick={() => p.say("Copied " + rev.id)}>Copy revision ID</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => p.say("Revert (Advanced)")}><Advanced>Revert</Advanced></ContextMenuItem>
        <ContextMenuItem onClick={() => p.say("Cherry-pick (Advanced)")}><Advanced>Cherry-pick</Advanced></ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

export function BranchMenu({ name, children, favorite, onToggleFavorite, onCreateFrom, onInfo }: { name: string; children: ReactNode; favorite?: boolean; onToggleFavorite?: () => void; onCreateFrom?: () => void; onInfo?: () => void }) {
  const p = useProto()
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-60">
        <ContextMenuLabel>{name}</ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuItem disabled={name === p.branch} onClick={() => p.requestSwitch(name)}>Switch to this branch</ContextMenuItem>
        <ContextMenuItem disabled={name === p.branch} onClick={() => p.openFlow({ kind: "switch", branch: name })}>Switch with options…</ContextMenuItem>
        {onInfo && <ContextMenuItem onClick={onInfo}><Info /> Branch information…</ContextMenuItem>}
        {onToggleFavorite && (
          <ContextMenuItem onClick={onToggleFavorite}>
            <Star className={cn(favorite && "fill-amber-400 text-amber-500")} /> {favorite ? "Remove from favorites" : "Add to favorites"}
          </ContextMenuItem>
        )}
        {onCreateFrom && <ContextMenuItem onClick={onCreateFrom}><GitBranchPlus /> New branch from here…</ContextMenuItem>}
        <ContextMenuItem onClick={() => p.say("Copied " + name)}>Copy name</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem disabled={name === p.branch} onClick={() => p.openFlow({ kind: "merge", branch: name, into: false })}><GitMerge /> <Advanced>Merge into {p.branch}…</Advanced></ContextMenuItem>
        <ContextMenuItem disabled={name === p.branch} onClick={() => p.openFlow({ kind: "merge", branch: name, into: true })}><GitMerge /> <Advanced>Merge {p.branch} into this…</Advanced></ContextMenuItem>
        <ContextMenuItem variant="destructive" onClick={() => p.say("Delete (Advanced)")}><Advanced>Delete</Advanced></ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
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
