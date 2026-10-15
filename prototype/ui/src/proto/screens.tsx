// PROTOTYPE: Onboarding, the conflict screen, and the floating prototype switcher.
import { CheckCircle2, CircleAlert, Copy, ExternalLink, FileDiff, FolderOpen, Lock, ServerCog, TimerOff, Undo2 } from "lucide-react"
import { Fragment, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"
import { FileTypeIcon } from "./fileTypes"
import { Thumb } from "./shared"
import { INCOMING, fileName, useProto, type FileEntry, type Mode, type Resolution, type Screen } from "./state"

const STEPS = ["Welcome", "Choose Mode", "Connect", "Sign in", "Get a project", "Done"]

export function Onboarding() {
  const p = useProto()
  const dev = p.mode === "developer"
  const [step, setStep] = useState(0)
  const [url, setUrl] = useState("lore://studio.local:41337")
  const [action, setAction] = useState("clone")
  const [folders, setFolders] = useState<Record<string, boolean>>({ Art: true, Audio: true, Levels: false, Source: false, Tools: false })
  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1))
  const skip = <Button variant="ghost" onClick={next}>Skip for now</Button>

  return (
    <div className="grid h-full place-items-center bg-zinc-50 p-6">
      <div className="w-full max-w-xl">
        <ol className="mb-6 flex gap-1">
          {STEPS.map((s, i) => <li key={s} className={cn("h-1 flex-1 rounded", i <= step ? "bg-zinc-900" : "bg-zinc-200")} title={s} />)}
        </ol>
        <Card>
          {step === 0 && (
            <>
              <CardHeader><CardTitle className="text-2xl">Welcome to Scribe</CardTitle><CardDescription>A desktop client for Lore. A few quick steps and you're in.</CardDescription></CardHeader>
              <CardContent><Button onClick={next}>Get started</Button></CardContent>
            </>
          )}
          {step === 1 && (
            <>
              <CardHeader><CardTitle>How do you want Scribe to look?</CardTitle><CardDescription>Both can do everything. You can switch any time in Settings.</CardDescription></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                {([["artist", "Artist", "Fewer steps, thumbnails and previews, the essentials up front."], ["developer", "Developer", "Every detail: staging, revision IDs, Lore's log, CLI equivalents."]] as [Mode, string, string][]).map(([m, title, desc]) => (
                  <button key={m} onClick={() => p.setMode(m)} className={cn("rounded-xl border p-4 text-left hover:border-zinc-400", p.mode === m && "border-zinc-900 ring-1 ring-zinc-900")}>
                    <div className={cn("mb-3 h-20 rounded-md", m === "artist" ? "bg-gradient-to-br from-rose-100 to-sky-100" : "bg-zinc-900 p-2 font-mono text-[9px] leading-3 text-zinc-400")}>
                      {m === "developer" && <>$ lore status<br />M Art/hero.psd<br />A Art/Env/tile_03.png</>}
                    </div>
                    <div className="font-medium">{title} Mode</div>
                    <div className="text-xs text-zinc-500">{desc}</div>
                  </button>
                ))}
                <Button className="col-span-2" onClick={next}>Continue</Button>
              </CardContent>
            </>
          )}
          {step === 2 && (
            <>
              <CardHeader>
                <CardTitle>Connect to a Lore Server</CardTitle>
                <CardDescription>{dev ? "Lore remote URL. Scribe probes it and detects the auth mode." : "Your team's server address. Ask your lead if you don't have it."}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input value={url} onChange={(e) => setUrl(e.target.value)} className={cn(dev && "font-mono")} />
                <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
                  Connected. This server asks you to sign in.
                  {dev && <div className="mt-1 font-mono text-[11px] text-emerald-700">lore 0.10.1 · auth: oidc (preferred) · issuer https://id.studio.local · QUIC 41337</div>}
                </div>
                <div className="rounded-md border border-dashed p-3 text-sm text-zinc-600">We found 2 Lore projects on this computer and an existing sign-in to <b>studio.local</b> from the Lore CLI.</div>
                <div className="flex justify-between">{skip}<Button onClick={next}>Continue</Button></div>
              </CardContent>
            </>
          )}
          {step === 3 && (
            <>
              <CardHeader><CardTitle>Sign in</CardTitle><CardDescription>{dev ? "OIDC device authorization (RFC 8628)." : "We'll open your browser. Enter this code there."}</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-center gap-3 rounded-lg bg-zinc-100 py-5">
                  <span className="font-mono text-3xl tracking-[0.3em]">QFRK-7MZD</span>
                  <Button size="icon" variant="ghost"><Copy className="size-4" /></Button>
                </div>
                <Button className="w-full gap-2" onClick={next}><ExternalLink className="size-4" /> Open browser</Button>
                {dev && <p className="text-xs text-zinc-500">Advanced: <u>Sign in with a token</u> · auth mode <u>auto</u> / grpc / oidc · <u>Use a separate Lore profile</u></p>}
                <div className="flex justify-start">{skip}</div>
              </CardContent>
            </>
          )}
          {step === 4 && (
            <>
              <CardHeader><CardTitle>Get a project</CardTitle><CardDescription>{dev ? "Clone, open an existing working tree, or create a repository." : "A project is your team's shared files."}</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <RadioGroup value={action} onValueChange={setAction} className="grid grid-cols-3 gap-2">
                  {[["clone", "Clone from server"], ["open", "Open on this computer"], ["create", "Create new"]].map(([v, l]) => (
                    <Label key={v} className={cn("flex cursor-pointer items-center gap-2 rounded-md border p-3 text-sm font-normal", action === v && "border-zinc-900")}>
                      <RadioGroupItem value={v} /> {l}
                    </Label>
                  ))}
                </RadioGroup>
                {action === "clone" && (
                  <>
                    <div className="space-y-1">
                      <Label className="text-xs text-zinc-500">Project</Label>
                      <div className="rounded-md border p-2 text-sm">forest-game <span className="text-zinc-400">· 1.8 TB</span></div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-zinc-500">{dev ? "View filter" : "Which folders do you need on this computer?"}</Label>
                      <div className={cn("grid gap-2", dev ? "grid-cols-1" : "grid-cols-2")}>
                        {Object.entries(folders).map(([f, on]) => (
                          <Label key={f} className={cn("flex items-center gap-2 rounded-md border font-normal", dev ? "px-2 py-1 font-mono text-xs" : "p-3 text-sm")}>
                            <Checkbox checked={on} onCheckedChange={() => setFolders({ ...folders, [f]: !on })} /> {dev ? `${f}/**` : <><FolderOpen className="size-4 text-zinc-400" /> {f}</>}
                          </Label>
                        ))}
                      </div>
                      {dev && <p className="pt-1 text-xs text-zinc-500">or <u>use a view filter file…</u> · <code>lore repository clone --view filter.txt</code></p>}
                    </div>
                  </>
                )}
                <div className="flex justify-between">{skip}<Button onClick={next}>{action === "clone" ? "Clone" : "Continue"}</Button></div>
              </CardContent>
            </>
          )}
          {step === 5 && (
            <>
              <CardHeader><CardTitle>You're all set</CardTitle><CardDescription>Scribe opens in {p.mode === "artist" ? "Artist" : "Developer"} Mode.</CardDescription></CardHeader>
              <CardContent><Button onClick={() => p.setScreen("main")}>Open forest-game</Button></CardContent>
            </>
          )}
        </Card>
        {step > 0 && <button className="mt-3 text-xs text-zinc-500" onClick={() => setStep(step - 1)}>← Back</button>}
      </div>
    </div>
  )
}

type Side = { who: string; when: string; at: string; size: string; detail: [string, string][]; message: string; revision: string; hash: string; lock: string }
type Conflict = { file: FileEntry; mine: Side; theirs: Side }

const conflictFile = (path: string, kind: FileEntry["kind"], size: string): FileEntry => ({ path, kind, change: "modified", staged: false, ticked: false, lock: null, size })

// Mock conflicts from one Sync: several files changed both locally and on the server.
const CONFLICTS: Conflict[] = [
  {
    file: conflictFile("Art/Env/forest_tile_03.png", "image", "14 MB"),
    mine: { who: "You", when: "just now", at: "2026-10-14 15:52", size: "14.2 MB", detail: [["Dimensions", "4096 × 4096"], ["Colour", "RGBA, 8-bit"]], message: "Not committed yet", revision: "working copy", hash: "77d2e0c1…a1b0", lock: "Not locked" },
    theirs: { who: "Marco", when: "2 hours ago", at: "2026-10-14 14:00", size: "13.8 MB", detail: [["Dimensions", "4096 × 4096"], ["Colour", "RGB, 8-bit"]], message: "Forest lighting pass", revision: "9f3c2a1e", hash: "3c09b4d2…ee41", lock: "Not locked" },
  },
  {
    file: conflictFile("Levels/forest.umap", "scene", "420 MB"),
    mine: { who: "You", when: "20 minutes ago", at: "2026-10-14 15:40", size: "421.6 MB", detail: [["Actors", "1,284"], ["Engine", "UE 5.5"]], message: "Not committed yet", revision: "working copy", hash: "a90c1e7f…07d3", lock: "Locked by Marco" },
    theirs: { who: "Marco", when: "2 hours ago", at: "2026-10-14 14:00", size: "420.1 MB", detail: [["Actors", "1,291"], ["Engine", "UE 5.5"]], message: "Forest lighting pass", revision: "9f3c2a1e", hash: "51ee09a3…c2f8", lock: "Locked by Marco" },
  },
  {
    file: conflictFile("Audio/footsteps_grass.wav", "audio", "6 MB"),
    mine: { who: "You", when: "1 hour ago", at: "2026-10-14 15:01", size: "6.3 MB", detail: [["Duration", "0:04.2"], ["Format", "48 kHz, 24-bit stereo"]], message: "Not committed yet", revision: "working copy", hash: "0b7d33e2…9a1c", lock: "Locked by you" },
    theirs: { who: "Sam", when: "3 days ago", at: "2026-10-11 16:00", size: "5.9 MB", detail: [["Duration", "0:03.9"], ["Format", "48 kHz, 24-bit stereo"]], message: "Import footstep library", revision: "71cc9b20", hash: "e4a1f6b0…3d77", lock: "Locked by you" },
  },
  {
    file: conflictFile("Docs/art-pipeline.md", "text", "4 KB"),
    mine: { who: "You", when: "5 minutes ago", at: "2026-10-14 15:55", size: "4.1 KB", detail: [["Lines", "212 (+18 −3)"]], message: "Not committed yet", revision: "working copy", hash: "c2d9a0e4…5b16", lock: "Not locked" },
    theirs: { who: "Ana", when: "yesterday", at: "2026-10-13 13:00", size: "3.9 KB", detail: [["Lines", "199 (+6 −1)"]], message: "Villain textures v3", revision: "4b81d0c7", hash: "98f0b1c3…af20", lock: "Not locked" },
  },
]

const RESOLVED_LABEL: Record<Resolution, string> = { mine: "Mine", theirs: "Theirs", manual: "By hand" }

export function ConflictScreen() {
  const p = useProto()
  const dev = p.mode === "developer"
  const ctx = p.conflict
  const list = ctx.paths ? CONFLICTS.filter((x) => ctx.paths!.includes(x.file.path)) : CONFLICTS
  const [current, setCurrent] = useState(0)
  const [resolved, setResolved] = useState<Record<string, Resolution>>({})
  const [copy, setCopy] = useState(true)
  const [aborting, setAborting] = useState(false)
  const [lastCmd, setLastCmd] = useState<string | null>(null)
  const raw = list[Math.min(current, list.length - 1)]
  // The other side comes from the incoming revision (sync) or the source branch (merge).
  const c = ctx.origin === "sync" ? { ...raw, theirs: { ...raw.theirs, who: INCOMING.author, when: "just now", message: INCOMING.message, revision: INCOMING.id } }
    : ctx.origin === "merge" ? { ...raw, theirs: { ...raw.theirs, message: `Latest on ${ctx.source}` } } : raw
  const name = fileName(c.file.path)
  const left = list.filter((x) => !resolved[x.file.path]).length
  const multiple = list.length > 1
  const merge = ctx.origin === "merge"
  // Lore's sub-commands for each action. Sync conflicts are assumed to use the merge machinery too (a guess).
  // In a merge started by Sync, Lore's `mine` is the remote tip (live check, #24), so Scribe's "Keep mine" runs `resolve theirs`.
  const swap = ctx.origin === "sync"
  const cmd = (verb: string) => `lore branch merge ${swap ? verb.replace(/\b(mine|theirs)\b/, (m) => (m === "mine" ? "theirs" : "mine")) : verb} ${c.file.path}`

  const resolve = (r: Resolution) => {
    const next = { ...resolved, [c.file.path]: r }
    setResolved(next)
    setLastCmd(cmd(r === "manual" ? "resolve" : `resolve ${r}`))
    p.say(r === "mine" ? `Kept your ${name}` : r === "manual" ? `Marked ${name} as merged by hand` : copy ? `Used theirs. Your copy saved as ${name.replace(/(\.[^.]+)$/, ".mine$1")}` : `Used their ${name}`)
    const nextIdx = list.findIndex((x, i) => i > current && !next[x.file.path])
    const wrap = list.findIndex((x) => !next[x.file.path])
    if (nextIdx !== -1) setCurrent(nextIdx)
    else if (wrap !== -1) setCurrent(wrap)
  }
  const reopen = (how: "unresolve" | "restart") => {
    const next = { ...resolved }
    delete next[c.file.path]
    setResolved(next)
    setLastCmd(cmd(how))
    p.say(how === "unresolve" ? `${name} needs a decision again` : `${name} is back to both incoming versions; any hand edits were dropped`)
  }

  const files = (n: number) => `${n} file${n === 1 ? "" : "s"}`
  const title = merge
    ? dev ? `Merge ${ctx.source} → ${p.branch}: ${files(list.length)} need${list.length === 1 ? "s" : ""} resolution` : `Merging ${ctx.source} into ${p.branch}: ${files(list.length)} changed on both`
    : ctx.origin === "sync"
      ? dev ? `Sync: ${files(list.length)} conflict${list.length === 1 ? "s" : ""} with ${INCOMING.id}` : `${files(list.length)} you changed ${list.length === 1 ? "was" : "were"} also changed on the server`
      : dev ? `Conflict: ${list.length} files need resolution` : `${list.length} files were changed by you and someone else`
  const sub = merge
    ? dev ? `lore branch merge start ${ctx.source}${ctx.noCommit ? " --no-commit" : ""} reported ${list.length} conflict${list.length === 1 ? "" : "s"} · resolve each, then the merge commits` : `Pick which version to keep for each file. The merge finishes when every file is decided.`
    : dev ? `lore sync merged ${INCOMING.id} into your local Commit and flagged ${list.length} conflict${list.length === 1 ? "" : "s"} · here Lore's "mine" is the server's side, so Keep mine runs resolve theirs` : "Pick which version to keep for each file. Nothing is lost: both versions stay in history."

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-start gap-4 border-b px-6 py-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold">
            {title}
            {left === 0 && <span className="ml-2 text-sm font-normal text-emerald-700">All resolved</span>}
          </h1>
          <p className="text-sm text-zinc-500">{sub}</p>
        </div>
        {merge ? (
          aborting ? (
            <span className="flex shrink-0 items-center gap-2 text-sm">
              <span className="text-zinc-600">Undo the whole merge?</span>
              <Button size="sm" variant="ghost" onClick={() => setAborting(false)}>Keep going</Button>
              <Button size="sm" variant="destructive" onClick={() => p.leaveConflict(true)}>Abort merge</Button>
            </span>
          ) : <Button size="sm" variant="outline" className="shrink-0" onClick={() => setAborting(true)}><Undo2 className="size-4" /> {dev ? "Abort merge" : "Cancel merge"}</Button>
        ) : <Button size="sm" variant="ghost" className="shrink-0" onClick={() => p.leaveConflict(false)}>Decide later</Button>}
      </header>
      <div className="flex min-h-0 flex-1">
        {multiple && (
          <aside className="flex w-64 shrink-0 flex-col border-r bg-zinc-50/60">
            <div className="flex items-center justify-between px-3 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
              <span>Conflicting files</span>
              <span className="normal-case tracking-normal">{list.length - left} of {list.length} done</span>
            </div>
            <ul className="flex-1 space-y-0.5 overflow-auto p-2">
              {list.map((x, i) => {
                const r = resolved[x.file.path]
                return (
                  <li key={x.file.path}>
                    <button
                      onClick={() => setCurrent(i)}
                      className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left", x === raw ? "bg-zinc-900 text-white" : "hover:bg-zinc-200/60")}
                    >
                      <FileTypeIcon path={x.file.path} />
                      <span className="min-w-0 flex-1">
                        <span className={cn("block truncate text-sm", dev && "font-mono text-xs")}>{dev ? x.file.path : fileName(x.file.path)}</span>
                        <span className={cn("block text-[11px]", x === raw ? "text-zinc-300" : "text-zinc-500")}>{merge ? `${ctx.source}` : ctx.origin === "sync" ? `${INCOMING.author} · just now` : `${x.theirs.who} · ${x.theirs.when}`}</span>
                      </span>
                      {r
                        ? <span className={cn("flex shrink-0 items-center gap-0.5 text-[11px]", x === raw ? "text-emerald-300" : "text-emerald-700")}><CheckCircle2 className="size-3.5" />{RESOLVED_LABEL[r]}</span>
                        : <CircleAlert className={cn("size-4 shrink-0", x === raw ? "text-amber-300" : "text-amber-500")} />}
                    </button>
                  </li>
                )
              })}
            </ul>
          </aside>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-2 px-6 pt-4 text-sm">
            <FileTypeIcon path={c.file.path} />
            <span className={cn("font-medium", dev && "font-mono text-xs")}>{dev ? c.file.path : name}</span>
            {resolved[c.file.path] && (
              <span className="flex items-center gap-2 text-xs text-emerald-700">
                Resolved: {resolved[c.file.path] === "manual" ? "merged by hand" : `kept ${resolved[c.file.path] === "mine" ? "your version" : "their version"}`}
                <button className="text-zinc-500 underline hover:text-zinc-900" onClick={() => reopen("unresolve")}>Undo my choice</button>
                {dev && <button className="text-zinc-500 underline hover:text-zinc-900" onClick={() => reopen("restart")}>Start this file over</button>}
              </span>
            )}
            <span className="ml-auto flex gap-1.5">
              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => p.openFlow({ kind: "diff", paths: [c.file.path], conflict: true })}><FileDiff className="size-3.5" /> Show differences</Button>
              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => p.say(`Opened ${name} in ${c.file.kind === "text" ? "your editor" : "its default app"}`)}><ExternalLink className="size-3.5" /> Open in editor</Button>
            </span>
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-6 overflow-auto p-6 pt-3">
            {([["Your version", c.mine, "mine"], [merge ? `Version on ${ctx.source}` : "Their version", c.theirs, "theirs"]] as const).map(([heading, s, side]) => (
              <div key={side} className={cn("flex min-h-0 flex-col gap-3 rounded-xl border p-3", resolved[c.file.path] === side && "border-emerald-300 ring-1 ring-emerald-200")}>
                <div className="flex items-baseline justify-between">
                  <div className="text-sm font-medium">{heading}</div>
                  <div className="text-xs text-zinc-500">{s.who} · {s.when}</div>
                </div>
                <div className="flex min-h-40 flex-1 items-center justify-center rounded-lg border bg-zinc-50"><Thumb file={c.file} size="lg" /></div>
                <dl className="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-1 text-xs">
                  <dt className="text-zinc-500">Changed by</dt><dd>{s.who}</dd>
                  <dt className="text-zinc-500">Saved</dt><dd>{s.at}</dd>
                  <dt className="text-zinc-500">Size</dt><dd>{s.size}</dd>
                  {s.detail.map(([k, v]) => <Fragment key={k}><dt className="text-zinc-500">{k}</dt><dd>{v}</dd></Fragment>)}
                  <dt className="text-zinc-500">Commit</dt><dd className={cn(side === "mine" && "text-amber-700")}>{s.message}</dd>
                  <dt className="text-zinc-500">Revision</dt><dd>{side === "mine" ? s.revision : <code>{s.revision}</code>}</dd>
                  <dt className="text-zinc-500">Lock</dt><dd className={cn(s.lock.startsWith("Locked by") && !s.lock.endsWith("you") && "text-red-600")}>{s.lock}</dd>
                  {dev && <><dt className="text-zinc-500">Content hash</dt><dd><code className="text-[11px]">{s.hash}</code></dd></>}
                </dl>
              </div>
            ))}
          </div>
          <footer className="flex items-center gap-3 border-t px-6 py-4">
            <Label className="flex items-center gap-2 text-sm font-normal"><Checkbox checked={copy} onCheckedChange={() => setCopy(!copy)} /> Save a copy of mine first</Label>
            {dev && lastCmd && <code className="min-w-0 truncate text-[11px] text-zinc-500">$ {lastCmd}</code>}
            <div className="ml-auto flex gap-2">
              {left === 0 ? (
                <Button onClick={() => p.finishConflict(resolved)}>{merge ? (ctx.noCommit ? "Finish merge" : "Finish and commit merge") : ctx.push ? "Finish and push" : ctx.origin === "sync" ? "Finish sync" : "Done"}</Button>
              ) : (
                <>
                  {!resolved[c.file.path] && <Button variant="ghost" onClick={() => resolve("manual")} title="You combined both versions yourself, in your editor">I merged it by hand</Button>}
                  <Button variant="outline" onClick={() => resolve("mine")}>Keep mine</Button>
                  <Button onClick={() => resolve("theirs")}>Use theirs</Button>
                </>
              )}
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}

const SCREENS: [Screen, string][] = [["onboarding", "Onboarding"], ["main", "Main"], ["conflict", "Conflict"]]

/** Prototype-only control bar: Mode and screen. */
export function PrototypeSwitcher() {
  const p = useProto()
  if (import.meta.env.PROD) return null
  const pill = "rounded-full px-3 py-1 text-xs"
  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-fuchsia-700 p-1.5 text-white shadow-2xl ring-2 ring-fuchsia-300">
      <span className="pl-2 text-[10px] font-bold uppercase tracking-wider opacity-70">Prototype</span>
      {(["artist", "developer"] as Mode[]).map((m) => (
        <button key={m} onClick={() => p.setMode(m)} className={cn(pill, p.mode === m ? "bg-white text-fuchsia-800" : "hover:bg-white/20")}>{m === "artist" ? "Artist" : "Developer"}</button>
      ))}
      <span className="h-5 w-px bg-white/30" />
      {SCREENS.map(([s, l]) => (
        <button key={s} onClick={() => (s === "conflict" ? p.startConflict({ origin: "demo" }) : p.setScreen(s))} className={cn(pill, p.screen === s ? "bg-white text-fuchsia-800" : "hover:bg-white/20")}>{l}</button>
      ))}
      <span className="h-5 w-px bg-white/30" />
      <button title="Trigger 'Locked by Ana' warning" onClick={() => { p.setScreen("main"); p.setLockWarning(true) }} className="rounded-full p-1.5 hover:bg-white/20"><Lock className="size-4" /></button>
      <button title="Trigger expired sign-in banner" onClick={() => { p.setScreen("main"); p.setSessionExpired(true) }} className="rounded-full p-1.5 hover:bg-white/20"><TimerOff className="size-4" /></button>
      <ServerCog className="mr-2 size-4 opacity-40" />
    </div>
  )
}
