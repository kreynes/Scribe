// PROTOTYPE: Onboarding, the conflict screen, and the floating prototype switcher.
import { ChevronLeft, ChevronRight, Copy, ExternalLink, FolderOpen, Lock, ServerCog, TimerOff } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"
import { Thumb } from "./shared"
import { useProto, type Mode, type Screen, type Variant } from "./state"

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

export function ConflictScreen() {
  const p = useProto()
  const dev = p.mode === "developer"
  const file = { path: "Art/Env/forest_tile_03.png", kind: "image" as const, change: "modified" as const, staged: false, ticked: false, lock: null, size: "14 MB" }
  const [copy, setCopy] = useState(true)
  return (
    <div className="flex h-full flex-col">
      <header className="border-b px-6 py-4">
        <h1 className="text-lg font-semibold">{dev ? "Conflict: 1 file needs resolution" : "Changed by both of you"}</h1>
        <p className="text-sm text-zinc-500">
          {dev ? "revision.sync reported file_conflict=1 · strategy: resolve file by file (Settings → Conflict resolution strategy)" : "Marco changed forest_tile_03.png while you were working on it. Pick which version to keep. Nothing is lost: both stay in history."}
        </p>
      </header>
      <div className="grid flex-1 grid-cols-2 gap-6 p-6">
        {[["Your version", "You · just now"], ["Their version", "Marco · 2 hours ago"]].map(([t, who]) => (
          <div key={t} className="flex flex-col gap-2">
            <div className="text-sm font-medium">{t} <span className="font-normal text-zinc-500">· {who}</span></div>
            <div className="flex flex-1 items-center justify-center rounded-xl border bg-zinc-50"><Thumb file={file} size="lg" /></div>
            {dev && <code className="text-[11px] text-zinc-400">{t === "Your version" ? "working tree · 77d2…a1b0" : "9f3c2a1e · 3c09…ee41"}</code>}
          </div>
        ))}
      </div>
      <footer className="flex items-center gap-3 border-t px-6 py-4">
        <Label className="flex items-center gap-2 text-sm font-normal"><Checkbox checked={copy} onCheckedChange={() => setCopy(!copy)} /> Save a copy of mine first</Label>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={() => { p.setScreen("main"); p.say("Kept your version") }}>Keep mine</Button>
          <Button onClick={() => { p.setScreen("main"); p.say(copy ? "Used theirs. Your copy saved as forest_tile_03.mine.png" : "Used theirs") }}>Use theirs</Button>
        </div>
      </footer>
    </div>
  )
}

const VARIANTS: [Variant, string][] = [["A", "Three-pane desktop"], ["B", "Status-first column"], ["C", "File browser + team board"]]
const SCREENS: [Screen, string][] = [["onboarding", "Onboarding"], ["main", "Main"], ["conflict", "Conflict"]]

/** Prototype-only control bar. Arrow keys cycle variants. */
export function PrototypeSwitcher() {
  const p = useProto()
  const i = VARIANTS.findIndex(([v]) => v === p.variant)
  const cycle = (d: number) => p.setVariant(VARIANTS[(i + d + VARIANTS.length) % VARIANTS.length][0])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest("input, textarea, [contenteditable]")) return
      if (e.key === "ArrowLeft") cycle(-1)
      if (e.key === "ArrowRight") cycle(1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })
  if (import.meta.env.PROD) return null
  const pill = "rounded-full px-3 py-1 text-xs"
  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-fuchsia-700 p-1.5 text-white shadow-2xl ring-2 ring-fuchsia-300">
      <span className="pl-2 text-[10px] font-bold uppercase tracking-wider opacity-70">Prototype</span>
      <button onClick={() => cycle(-1)} className="rounded-full p-1 hover:bg-white/20"><ChevronLeft className="size-4" /></button>
      <span className="w-48 text-center text-xs font-medium">{p.variant} ({VARIANTS[i][1]})</span>
      <button onClick={() => cycle(1)} className="rounded-full p-1 hover:bg-white/20"><ChevronRight className="size-4" /></button>
      <span className="h-5 w-px bg-white/30" />
      {(["artist", "developer"] as Mode[]).map((m) => (
        <button key={m} onClick={() => p.setMode(m)} className={cn(pill, p.mode === m ? "bg-white text-fuchsia-800" : "hover:bg-white/20")}>{m === "artist" ? "Artist" : "Developer"}</button>
      ))}
      <span className="h-5 w-px bg-white/30" />
      {SCREENS.map(([s, l]) => (
        <button key={s} onClick={() => p.setScreen(s)} className={cn(pill, p.screen === s ? "bg-white text-fuchsia-800" : "hover:bg-white/20")}>{l}</button>
      ))}
      <span className="h-5 w-px bg-white/30" />
      <button title="Trigger 'Locked by Ana' warning" onClick={() => { p.setScreen("main"); p.setLockWarning(true) }} className="rounded-full p-1.5 hover:bg-white/20"><Lock className="size-4" /></button>
      <button title="Trigger expired sign-in banner" onClick={() => { p.setScreen("main"); p.setSessionExpired(true) }} className="rounded-full p-1.5 hover:bg-white/20"><TimerOff className="size-4" /></button>
      <ServerCog className="mr-2 size-4 opacity-40" />
    </div>
  )
}
