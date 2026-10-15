// PROTOTYPE: dialogs for the core Lore flows (diff, merge, sync, switch, locks). Opened from anywhere via p.openFlow().
// Every option maps to a real `lore` flag (docs/reference/lore-cli-commands.md); Developer Mode shows the equivalent command.
import { Archive, ArchiveRestore, ArrowDownToLine, ArrowRight, CircleAlert, Columns2, Eye, GitBranch, GitMerge, Lock, LockOpen, Rows3, SplitSquareHorizontal, TriangleAlert, Undo2 } from "lucide-react"
import { Fragment, useMemo, useState, type ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { FileTypeIcon } from "./fileTypes"
import { ChangeBadge, Thumb, archiveBlocker } from "./shared"
import { BRANCHES, INCOMING, allFiles, fileName, lockBranch, useProto, type FileEntry, type Flow } from "./state"

/** The equivalent Lore command, shown in Developer Mode only. */
export function Cli({ children, className }: { children: ReactNode; className?: string }) {
  const dev = useProto().mode === "developer"
  if (!dev) return null
  return <code className={cn("block truncate rounded bg-zinc-100 px-2 py-1 font-mono text-[11px] text-zinc-600", className)} title={String(children)}>$ {children}</code>
}

const q = (s: string) => (/\s/.test(s) ? `"${s}"` : s)
const hash = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h }
const REVS = [
  { id: "e02a77f5", label: "Hero sculpt blockout", who: "You", when: "yesterday" },
  { id: "4b81d0c7", label: "Villain textures v3", who: "Ana", when: "yesterday" },
  { id: "9f3c2a1e", label: "Forest lighting pass", who: "Marco", when: "2 hours ago" },
  { id: "71cc9b20", label: "Import footstep library", who: "Sam", when: "3 days ago" },
  { id: "3a90f1b2", label: "Project setup for vertical slice", who: "Marco", when: "16 days ago" },
]

// ---------------------------------------------------------------- Diff viewer

type DLine = { t: " " | "+" | "-"; a?: number; b?: number; s: string }

/** Line diff by longest common subsequence. `norm` lets whitespace options treat lines as equal. */
function diffLines(oldL: string[], newL: string[], norm: (s: string) => string): DLine[] {
  const A = oldL.map(norm), B = newL.map(norm), n = A.length, m = B.length
  const L = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1])
  const out: DLine[] = []
  let i = 0, j = 0
  while (i < n && j < m) {
    if (A[i] === B[j]) { out.push({ t: " ", a: i + 1, b: j + 1, s: newL[j] }); i++; j++ }
    else if (L[i + 1][j] >= L[i][j + 1]) { out.push({ t: "-", a: i + 1, s: oldL[i] }); i++ }
    else { out.push({ t: "+", b: j + 1, s: newL[j] }); j++ }
  }
  while (i < n) { out.push({ t: "-", a: i + 1, s: oldL[i] }); i++ }
  while (j < m) { out.push({ t: "+", b: j + 1, s: newL[j] }); j++ }
  return out
}

/** Group into hunks with `ctx` unchanged lines around each change (`lore file diff -U`). */
function hunks(lines: DLine[], ctx: number) {
  const keep = lines.map(() => false)
  lines.forEach((l, i) => { if (l.t !== " ") for (let k = Math.max(0, i - ctx); k <= Math.min(lines.length - 1, i + ctx); k++) keep[k] = true })
  const out: { header: string; lines: DLine[] }[] = []
  let cur: DLine[] | null = null
  lines.forEach((l, i) => { if (keep[i]) { if (!cur) { cur = []; out.push({ header: "", lines: cur }) } cur.push(l) } else cur = null })
  for (const h of out) {
    const a = h.lines.find((l) => l.a)?.a ?? 0, b = h.lines.find((l) => l.b)?.b ?? 0
    h.header = `@@ -${a},${h.lines.filter((l) => l.t !== "+").length} +${b},${h.lines.filter((l) => l.t !== "-").length} @@`
  }
  return out
}

function pairRows(lines: DLine[]) {
  const rows: [DLine | null, DLine | null][] = []
  let k = 0
  while (k < lines.length) {
    if (lines[k].t === " ") { rows.push([lines[k], lines[k]]); k++; continue }
    const del: DLine[] = [], add: DLine[] = []
    while (k < lines.length && lines[k].t === "-") del.push(lines[k++])
    while (k < lines.length && lines[k].t === "+") add.push(lines[k++])
    for (let r = 0; r < Math.max(del.length, add.length); r++) rows.push([del[r] ?? null, add[r] ?? null])
  }
  return rows
}

type Edit = { start: number; end: number; lines: string[] }
function edits(base: string[], x: string[]): Edit[] {
  const out: Edit[] = []
  let bi = 0, cur: Edit | null = null
  for (const l of diffLines(base, x, (s) => s)) {
    if (l.t === " ") { if (cur) { out.push(cur); cur = null } bi++; continue }
    if (!cur) cur = { start: bi, end: bi, lines: [] }
    if (l.t === "-") { cur.end++; bi++ } else cur.lines.push(l.s)
  }
  if (cur) out.push(cur)
  return out
}

type M3 = { kind: "ctx"; s: string } | { kind: "mine" | "theirs"; lines: string[] } | { kind: "conflict"; mine: string[]; theirs: string[] }
/** Three-way merge against the common base (`--diff3`): one-sided edits merge cleanly, overlapping ones get markers. */
function merge3(base: string[], mine: string[], theirs: string[]): M3[] {
  const em = edits(base, mine), et = edits(base, theirs), out: M3[] = []
  let i = 0
  for (;;) {
    const mi = em.findIndex((e) => e.start === i), ti = et.findIndex((e) => e.start === i)
    if (mi < 0 && ti < 0) { if (i >= base.length) break; out.push({ kind: "ctx", s: base[i] }); i++; continue }
    const m = mi >= 0 ? em.splice(mi, 1)[0] : null, t = ti >= 0 ? et.splice(ti, 1)[0] : null
    if (m && t) { out.push({ kind: "conflict", mine: m.lines, theirs: t.lines }); i = Math.max(m.end, t.end) }
    else { const e = (m ?? t)!; out.push({ kind: m ? "mine" : "theirs", lines: e.lines }); i = e.end }
  }
  return out
}

const PIPELINE_BASE = `# Art pipeline

Owner: Ana · Last review: September

## Export settings
- Textures: PNG, 4096 max, sRGB
- Normal maps: TGA, linear
- Meshes: FBX, Y-up, cm units
- Rigs: Blender 4.2, Rigify

## Naming
- Prefix by type: T_ textures, SM_ meshes, SK_ skeletal
- Use lower_snake_case after the prefix
- No version numbers in file names, Lore keeps history

## Locks
- Lock .psd, .blend and .umap before you open them
- Release locks when you push

## Review
- Post a screenshot in #art-review
- Lead signs off within a day`

const PIPELINE_MINE = `# Art pipeline

Owner: Ana · Last review: October

## Export settings
- Textures: PNG or TGA, 4096 max, sRGB
- Normal maps: TGA, linear
- Hair cards: TGA with alpha, 2048 max
- Meshes: FBX, Y-up, cm units
- Rigs: Blender 4.2, Rigify${"  "}

## Naming
- Prefix by type: T_ textures, SM_ meshes, SK_ skeletal
- Use  lower_snake_case  after the prefix
- No version numbers in file names, Lore keeps history

## Locks
- Scribe locks .psd, .blend and .umap for you (see .scribelock)
- Release locks when you push

## Review
- Post a screenshot in #art-review
- Lead signs off within a day
- Big changes: book a 15-minute review`

const PIPELINE_THEIRS = `# Art pipeline

Owner: Ana · Last review: October 2

## Export settings
- Textures: PNG, 4096 max, sRGB
- Normal maps: TGA, linear, BC5 in engine
- Meshes: FBX, Y-up, cm units
- Rigs: Blender 4.2, Rigify

## Naming
- Prefix by type: T_ textures, SM_ meshes, SK_ skeletal
- Use lower_snake_case after the prefix
- No version numbers in file names, Lore keeps history

## Locks
- Lock .psd, .blend and .umap before you open them
- Release locks when you push

## Review
- Post a screenshot in #art-review-forest
- Lead signs off within a day`

/** Old/new (and the other side, for conflicts) text of a file. Generated for files without a hand-written sample. */
function textVersions(path: string): [string[], string[], string[]] {
  if (path.endsWith("art-pipeline.md")) return [PIPELINE_BASE.split("\n"), PIPELINE_MINE.split("\n"), PIPELINE_THEIRS.split("\n")]
  const h = hash(path), name = fileName(path).replace(/\..+$/, "")
  const base = Array.from({ length: 18 }, (_, i) => path.endsWith(".csv") ? `${name}_${i},${(h >> i) % 90 + 10},${(i * 7) % 13}` : path.endsWith(".json") ? `  "${name}_${i}": ${(h >> i) % 90 + 10},` : path.endsWith(".ini") ? `${name}.Setting${i}=${(h >> i) % 2 ? "True" : "False"}` : `  // ${name}: step ${i}` )
  const mine = [...base]
  mine[4] = mine[4].replace(/\d+/, (d) => String(Number(d) + 5))
  mine.splice(11, 0, path.endsWith(".csv") ? `${name}_new,42,1` : `  // ${name}: added by you`)
  mine[15] = mine[15] + " "
  const theirs = [...base]
  theirs[4] = theirs[4].replace(/\d+/, (d) => String(Number(d) - 3))
  return [base, mine, theirs]
}

function binaryFacts(f: FileEntry): [string, string, string][] {
  const mb = parseFloat(f.size), unit = f.size.replace(/[\d.\s]/g, "")
  const size: [string, string, string] = ["Size", `${(mb * 0.97).toFixed(1)} ${unit}`, `${mb.toFixed(1)} ${unit}`]
  if (f.kind === "image") return [size, ["Dimensions", "4096 × 4096", "4096 × 4096"], ["Colour", "RGB, 8-bit", "RGBA, 8-bit"], ["Layers", "14", "17"]]
  if (f.kind === "model") return [size, ["Vertices", "182,340", "184,902"], ["Materials", "6", "7"], ["Bones", "68", "68"]]
  if (f.kind === "audio") return [size, ["Duration", "0:03.9", "0:04.2"], ["Peak", "−3.1 dB", "−1.8 dB"], ["Format", "48 kHz, 24-bit", "48 kHz, 24-bit"]]
  return [size, ["Actors", "1,291", "1,284"], ["Engine", "UE 5.5", "UE 5.5"]]
}

function TextDiff({ path, ctx, ws, split, diff3 }: { path: string; ctx: number; ws: { eol: boolean; change: boolean }; split: boolean; diff3: boolean }) {
  const [base, mine, theirs] = textVersions(path)
  const norm = (s: string) => { let v = s; if (ws.eol) v = v.replace(/\s+$/, ""); if (ws.change) v = v.replace(/\s+/g, " "); return v }
  const lines = diffLines(base, mine, norm)
  const hs = hunks(lines, ctx)
  const num = "w-9 shrink-0 select-none pr-2 text-right text-zinc-400"
  const tone = (t: DLine["t"] | undefined) => (t === "+" ? "bg-emerald-50 text-emerald-900" : t === "-" ? "bg-red-50 text-red-900" : "")
  if (diff3) {
    const merged = merge3(base, mine, theirs)
    const conflicts = merged.filter((m) => m.kind === "conflict").length
    return (
      <div className="font-mono text-[11px] leading-5">
        <div className="sticky top-0 border-b bg-zinc-50 px-3 py-1 text-zinc-500">{conflicts} conflicting block{conflicts === 1 ? "" : "s"}; other edits from both sides merge cleanly</div>
        {merged.map((m, i) => m.kind === "ctx" ? <div key={i} className="whitespace-pre px-3 text-zinc-600">{m.s || " "}</div>
          : m.kind !== "conflict" ? m.lines.map((s, k) => <div key={i + "-" + k} className={cn("whitespace-pre px-3", m.kind === "mine" ? "bg-emerald-50" : "bg-sky-50")} title={m.kind === "mine" ? "Only you changed this" : "Only they changed this"}>{s || " "}</div>)
            : (
              <div key={i} className="my-0.5 border-y border-amber-300">
                <div className="bg-amber-100 px-3 text-amber-800">{"<<<<<<< yours (working copy)"}</div>
                {m.mine.map((s, k) => <div key={k} className="whitespace-pre bg-emerald-50 px-3">{s || " "}</div>)}
                <div className="bg-amber-100 px-3 text-amber-800">=======</div>
                {m.theirs.map((s, k) => <div key={k} className="whitespace-pre bg-sky-50 px-3">{s || " "}</div>)}
                <div className="bg-amber-100 px-3 text-amber-800">{">>>>>>> theirs"}</div>
              </div>
            ))}
      </div>
    )
  }
  if (!hs.length) return <p className="p-4 text-sm text-zinc-500">No differences{ws.eol || ws.change ? " once whitespace is ignored" : ""}.</p>
  return (
    <div className="font-mono text-[11px] leading-5">
      {hs.map((h, hi) => (
        <div key={hi}>
          <div className="sticky top-0 border-y bg-sky-50/80 px-3 text-sky-700 backdrop-blur">{h.header}</div>
          {split
            ? pairRows(h.lines).map(([l, r], i) => (
              <div key={i} className="grid grid-cols-2">
                <div className={cn("flex border-r", l && l.t !== " " && tone("-"))}><span className={num}>{l?.a}</span><span className="whitespace-pre">{l?.s ?? ""}</span></div>
                <div className={cn("flex", r && r.t !== " " && tone("+"))}><span className={num}>{r?.b}</span><span className="whitespace-pre">{r?.s ?? ""}</span></div>
              </div>
            ))
            : h.lines.map((l, i) => (
              <div key={i} className={cn("flex", tone(l.t))}>
                <span className={num}>{l.a}</span><span className={num}>{l.b}</span>
                <span className="w-4 shrink-0 select-none text-zinc-400">{l.t === " " ? "" : l.t}</span>
                <span className="whitespace-pre">{l.s.replace(/ +$/, (m) => "·".repeat(m.length))}</span>
              </div>
            ))}
        </div>
      ))}
    </div>
  )
}

function BinaryDiff({ file, before, after }: { file: FileEntry; before: string; after: string }) {
  const [view, setView] = useState<"side" | "swipe">("side")
  const [x, setX] = useState(50)
  const facts = binaryFacts(file)
  const old = "grayscale-[60%] hue-rotate-30"
  return (
    <div className="space-y-4 p-4">
      {file.kind === "image" && (
        <div className="inline-flex rounded-md border p-0.5 text-xs">
          {([["side", "Side by side", Columns2], ["swipe", "Swipe", SplitSquareHorizontal]] as const).map(([k, l, Icon]) => (
            <button key={k} onClick={() => setView(k)} className={cn("flex items-center gap-1 rounded px-2 py-1", view === k ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100")}><Icon className="size-3.5" /> {l}</button>
          ))}
        </div>
      )}
      {view === "swipe" && file.kind === "image" ? (
        <div className="space-y-2">
          <div className="relative h-56 overflow-hidden rounded-lg border">
            <div className={cn("absolute inset-0 [&>div]:h-full!", old)}><Thumb file={file} size="lg" /></div>
            <div className="absolute inset-0 [&>div]:h-full!" style={{ clipPath: `inset(0 0 0 ${x}%)` }}><Thumb file={file} size="lg" /></div>
            <div className="absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${x}%` }} />
            <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 text-[11px] text-white">{before}</span>
            <span className="absolute right-2 top-2 rounded bg-black/60 px-1.5 text-[11px] text-white">{after}</span>
          </div>
          <input type="range" min={0} max={100} value={x} onChange={(e) => setX(Number(e.target.value))} className="w-full" aria-label="Swipe between versions" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {[[before, true], [after, false]].map(([label, isOld]) => (
            <div key={String(label)} className="space-y-1.5">
              <div className="text-xs font-medium text-zinc-500">{label}</div>
              <div className={cn("rounded-lg border p-2 [&>div]:h-40!", isOld && old)}><Thumb file={file} size="lg" /></div>
            </div>
          ))}
        </div>
      )}
      <table className="w-full text-xs">
        <thead><tr className="text-left text-zinc-500"><th className="py-1 font-medium">Property</th><th className="font-medium">{before}</th><th className="font-medium">{after}</th></tr></thead>
        <tbody>
          {facts.map(([k, a, b]) => (
            <tr key={k} className={cn("border-t", a !== b && "bg-amber-50/70")}>
              <td className="py-1 text-zinc-500">{k}</td><td>{a}</td><td className={cn(a !== b && "font-medium text-amber-800")}>{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DiffDialog({ flow }: { flow: Extract<Flow, { kind: "diff" }> }) {
  const p = useProto()
  const dev = p.mode === "developer"
  const all = allFiles(p.files)
  const files = flow.paths.map((path) => all.find((f) => f.path === path) ?? { ...all[0], path })
  const [active, setActive] = useState(flow.paths[0])
  const rev = flow.revision
  const [source, setSource] = useState(rev ? "parent" : "current")
  const [target, setTarget] = useState(rev ? rev.id : "working")
  const [ctx, setCtx] = useState(3)
  const [ws, setWs] = useState({ eol: false, change: false })
  const [split, setSplit] = useState(!dev)
  const [diff3, setDiff3] = useState(!!flow.conflict)
  const file = files.find((f) => f.path === active) ?? files[0]
  const isText = file.kind === "text"
  const label = (v: string) => v === "working" ? "Your working copy" : v === "current" ? "Last synced revision" : v === "parent" ? `Before ${rev?.id}` : v === "theirs" ? "Their version" : REVS.find((r) => r.id === v)?.label ?? v
  const same = source === target
  const flags = [source !== "current" && `--source ${source === "parent" ? `${rev?.id}~1` : source}`, target !== "working" && `--target ${target}`, ctx !== 3 && `-U ${ctx}`, ws.eol && "--ignore-space-at-eol", ws.change && "--ignore-space-change", diff3 && "--diff3"].filter(Boolean).join(" ")
  const opt = "flex items-center gap-1.5 text-xs font-normal"
  return (
    <Dialog open onOpenChange={(o) => { if (!o) p.closeFlow() }}>
      <DialogContent className="flex h-[85vh] max-h-[48rem] flex-col gap-0 overflow-hidden p-0 sm:max-w-[72rem]">
        <DialogHeader className="border-b px-5 py-3 text-left">
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileTypeIcon path={file.path} className="size-5" />
            {rev ? <>Changes in “{rev.message}”</> : flow.conflict ? <>Your version vs theirs: {fileName(file.path)}</> : <>What changed in {fileName(file.path)}</>}
          </DialogTitle>
          <DialogDescription className="sr-only">Compare two versions of a file</DialogDescription>
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            {flow.conflict ? <span className="text-zinc-500">Your working copy ↔ the incoming version, against the last revision you both had</span> : (
              <>
                <Select value={source} onValueChange={setSource}>
                  <SelectTrigger size="sm" className="h-7 w-56 text-xs"><span className="text-zinc-500">From</span><SelectValue>{label(source)}</SelectValue></SelectTrigger>
                  <SelectContent>
                    {rev && <SelectItem value="parent">Before {rev.id} (its parent)</SelectItem>}
                    <SelectItem value="current">Last synced revision</SelectItem>
                    {REVS.map((r) => <SelectItem key={r.id} value={r.id}>{r.label} · {dev ? r.id : r.when}</SelectItem>)}
                  </SelectContent>
                </Select>
                <ArrowRight className="size-3.5 text-zinc-400" />
                <Select value={target} onValueChange={setTarget}>
                  <SelectTrigger size="sm" className="h-7 w-56 text-xs"><span className="text-zinc-500">To</span><SelectValue>{label(target)}</SelectValue></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="working">Your working copy</SelectItem>
                    {rev && !REVS.some((r) => r.id === rev.id) && <SelectItem value={rev.id}>{rev.message} · {rev.id}</SelectItem>}
                    {REVS.map((r) => <SelectItem key={r.id} value={r.id}>{r.label} · {dev ? r.id : r.when}</SelectItem>)}
                  </SelectContent>
                </Select>
              </>
            )}
            {isText && (
              <span className="ml-auto flex flex-wrap items-center gap-3">
                {!diff3 && (
                  <span className="inline-flex rounded-md border p-0.5">
                    {([[false, "Unified", Rows3], [true, "Side by side", Columns2]] as const).map(([v, l, Icon]) => (
                      <button key={l} onClick={() => setSplit(v)} className={cn("flex items-center gap-1 rounded px-2 py-0.5", split === v ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100")}><Icon className="size-3.5" /> {l}</button>
                    ))}
                  </span>
                )}
                {dev ? (
                  <>
                    <Label className={opt}>Context
                      <Select value={String(ctx)} onValueChange={(v) => setCtx(Number(v))}>
                        <SelectTrigger size="sm" className="h-7 w-16 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{[0, 3, 10, 999].map((n) => <SelectItem key={n} value={String(n)}>{n === 999 ? "All" : n}</SelectItem>)}</SelectContent>
                      </Select>
                    </Label>
                    <Label className={opt}><Checkbox checked={ws.eol} onCheckedChange={(v) => setWs({ ...ws, eol: v === true })} /> Ignore trailing spaces</Label>
                    <Label className={opt}><Checkbox checked={ws.change} onCheckedChange={(v) => setWs({ ...ws, change: v === true })} /> Ignore space changes</Label>
                    {flow.conflict && <Label className={opt}><Checkbox checked={diff3} onCheckedChange={(v) => setDiff3(v === true)} /> Three-way</Label>}
                  </>
                ) : (
                  <Label className={opt}><Checkbox checked={ctx === 999} onCheckedChange={(v) => setCtx(v === true ? 999 : 3)} /> Show the whole file</Label>
                )}
              </span>
            )}
          </div>
        </DialogHeader>
        <div className="flex min-h-0 flex-1">
          {files.length > 1 && (
            <ul className="w-60 shrink-0 space-y-0.5 overflow-auto border-r bg-zinc-50/60 p-2">
              <li className="px-2 pb-1 text-[11px] font-medium uppercase text-zinc-500">{files.length} files</li>
              {files.map((f) => (
                <li key={f.path}>
                  <button onClick={() => setActive(f.path)} className={cn("flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs", f.path === file.path ? "bg-zinc-900 text-white" : "hover:bg-zinc-200/60")}>
                    <FileTypeIcon path={f.path} /><span className={cn("min-w-0 flex-1 truncate", dev && "font-mono")}>{dev ? f.path : fileName(f.path)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="min-w-0 flex-1 overflow-auto">
            {same ? <p className="p-4 text-sm text-zinc-500">Both sides are the same revision, so there's nothing to compare.</p>
              : isText ? <TextDiff path={file.path} ctx={ctx} ws={ws} split={split && !diff3} diff3={diff3} />
                : <BinaryDiff file={file} before={flow.conflict ? "Theirs" : label(source)} after={flow.conflict ? "Yours" : label(target)} />}
          </div>
        </div>
        <DialogFooter className="items-center gap-2 border-t px-5 py-2.5 sm:justify-between">
          <Cli className="min-w-0 flex-1">{rev && files.length > 1 && file === files[0] ? `lore revision diff ${rev.id}~1 --target ${rev.id}` : `lore file diff ${q(file.path)}${flags ? " " + flags : ""}`}</Cli>
          <div className="ml-auto flex items-center gap-2">
            {file.change && <ChangeBadge file={file} />}
            <Button variant="outline" size="sm" onClick={() => p.say(`Opened ${fileName(file.path)} in its default app`)}>Open file</Button>
            <Button size="sm" onClick={p.closeFlow}>Close</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------- Merge

const MERGE_CONFLICTS = ["Art/Env/forest_tile_03.png", "Levels/forest.umap", "Audio/footsteps_grass.wav", "Docs/art-pipeline.md"]

/** Mock `lore branch diff`: how much changed on the source branch and which files both sides touched. */
function branchDiff(source: string, target: string) {
  const h = hash(source + ">" + target)
  const conflicts = h % 3 === 0 ? [] : h % 3 === 1 ? [MERGE_CONFLICTS[0], MERGE_CONFLICTS[3]] : MERGE_CONFLICTS
  return { changed: 4 + (h % 19), commits: 2 + (h % 11), conflicts }
}

function MergeDialog({ flow }: { flow: Extract<Flow, { kind: "merge" }> }) {
  const p = useProto()
  const dev = p.mode === "developer"
  const [source, target] = flow.into ? [p.branch, flow.branch] : [flow.branch, p.branch]
  const [message, setMessage] = useState(`Merge ${source} into ${target}`)
  const [auto, setAuto] = useState(true)
  const [noCommit, setNoCommit] = useState(false)
  const [meta, setMeta] = useState("")
  const [links, setLinks] = useState("all")
  const [preview, setPreview] = useState(false)
  const d = branchDiff(source, target)
  const conflicts = auto ? d.conflicts.filter((c) => !c.endsWith(".md")) : d.conflicts
  const autoFixed = d.conflicts.length - conflicts.length
  const dirty = p.files.filter((f) => f.change).length
  const flags = [!flow.into && `--message ${q(message)}`, !flow.into && noCommit && "--no-commit", meta && meta.split(/[,\s]+/).filter(Boolean).map((k) => `--inherit-metadata ${k}`).join(" "), links === "main" && "--ignore-links"].filter(Boolean).join(" ")
  return (
    <Dialog open onOpenChange={(o) => { if (!o) p.closeFlow() }}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><GitMerge className="size-5" /> Merge</DialogTitle>
          <DialogDescription>
            {flow.into ? <>Bring the work on <b>{source}</b> (your current branch) into <b>{target}</b>. You stay on {source}.</> : <>Bring the work on <b>{source}</b> into <b>{target}</b>, the branch you're on.</>}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="flex items-center gap-2 rounded-lg border bg-zinc-50 px-3 py-2 text-xs">
            <span className="flex items-center gap-1 rounded-full border bg-white px-2 py-0.5"><GitBranch className="size-3" />{source}</span>
            <ArrowRight className="size-3.5 text-zinc-400" />
            <span className="flex items-center gap-1 rounded-full border bg-white px-2 py-0.5"><GitBranch className="size-3" />{target}</span>
            <span className="ml-auto text-zinc-500">{d.commits} commits · {d.changed} files changed</span>
          </div>
          <div className={cn("rounded-lg border p-3", conflicts.length ? "border-amber-200 bg-amber-50/60" : "border-emerald-200 bg-emerald-50/60")}>
            <div className="flex items-center gap-1.5 font-medium">
              {conflicts.length ? <><CircleAlert className="size-4 text-amber-600" /> {conflicts.length} file{conflicts.length === 1 ? " needs" : "s need"} a decision</> : <>No conflicts expected</>}
            </div>
            {conflicts.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs">
                {conflicts.map((c) => <li key={c} className="flex items-center gap-1.5"><FileTypeIcon path={c} /><span className={cn(dev && "font-mono")}>{dev ? c : fileName(c)}</span><span className="text-zinc-500">changed on both branches</span></li>)}
              </ul>
            )}
            <Label className="mt-2 flex items-center gap-2 text-xs font-normal"><Checkbox checked={auto} onCheckedChange={(v) => setAuto(v === true)} /> Combine text files automatically when the changes don't overlap{autoFixed > 0 && <span className="text-emerald-700">({autoFixed} handled)</span>}</Label>
            <Cli className="mt-2">lore branch diff {target} --source {source}{auto ? " --auto-resolve" : ""}</Cli>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="merge-msg">{flow.into ? "Commit message" : "Commit message (used when there are no conflicts)"}</Label>
            <Input id="merge-msg" value={message} onChange={(e) => setMessage(e.target.value)} className={cn(dev && "font-mono text-xs")} />
          </div>
          {dev && (
            <div className="grid grid-cols-[9rem_1fr] items-center gap-x-3 gap-y-2 text-xs">
              {!flow.into && <><span className="text-zinc-500">Commit</span><Label className="text-xs font-normal"><Checkbox checked={noCommit} onCheckedChange={(v) => setNoCommit(v === true)} /> Don't commit automatically (review in Staging first)</Label></>}
              <span className="text-zinc-500">Carry over metadata</span>
              <Input value={meta} onChange={(e) => setMeta(e.target.value)} placeholder="keys, comma separated, or *" className="h-7 font-mono text-xs" />
              <span className="text-zinc-500">Linked repositories</span>
              <Select value={links} onValueChange={setLinks}>
                <SelectTrigger size="sm" className="h-7 w-full text-xs"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">Merge this repository and its links</SelectItem><SelectItem value="main">Only this repository</SelectItem></SelectContent>
              </Select>
            </div>
          )}
          {dirty > 0 && !flow.into && (
            <p className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
              <TriangleAlert className="size-4 shrink-0" />
              <span>You have {dirty} uncommitted change{dirty === 1 ? "" : "s"}. Commit them first so the merge stays separate from your own work.{dev && " (Guess: Lore may refuse to start a merge over local changes.)"}</span>
            </p>
          )}
          {preview && (
            <div className="rounded-md border bg-zinc-50 p-2 text-xs">
              <div className="mb-1 flex items-center gap-1.5 font-medium"><Eye className="size-3.5" /> Preview: nothing has changed yet</div>
              {d.changed - conflicts.length} files would update cleanly{autoFixed ? `, ${autoFixed} combined automatically` : ""}, {conflicts.length} would need a decision. {flow.into ? `A merge commit would land on ${target}.` : noCommit ? "Nothing would be committed." : "A merge commit would be made locally (not pushed)."}
            </div>
          )}
          <Cli>{flow.into ? `lore branch merge into ${target} ${q(message)}${flags ? " " + flags : ""}` : `lore branch merge start ${source} ${flags}${preview ? " --dry-run" : ""}`}</Cli>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => setPreview(true)}><Eye className="size-4" /> Preview</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={p.closeFlow}>Cancel</Button>
            <Button disabled={!message.trim()} onClick={() => p.merge(flow.branch, flow.into, { message, noCommit, conflicts })}>{conflicts.length && !flow.into ? "Merge and resolve…" : "Merge"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------- Sync

const FOLDERS: [string, string, boolean][] = [["Art", "18.4 GB", true], ["Audio", "2.1 GB", true], ["Content", "9.7 GB", true], ["Source", "0.4 GB", true], ["Levels", "12.4 GB", false], ["Cinematics", "6.0 GB", false], ["Config", "3 KB", false], ["Data", "53 KB", false], ["Tools", "9 KB", false], ["UI", "310 KB", false], ["Builds", "2.1 GB", false]]

function SyncDialog({ flow }: { flow: Extract<Flow, { kind: "sync" }> }) {
  const p = useProto()
  const dev = p.mode === "developer"
  const [targetMode, setTargetMode] = useState(flow.target ? "revision" : "latest")
  const [revision, setRevision] = useState(flow.target ?? "")
  const [local, setLocal] = useState(flow.reset ? "reset" : "keep")
  const [folders, setFolders] = useState(() => Object.fromEntries(FOLDERS.map(([f, , on]) => [f, on])))
  const [deps, setDeps] = useState({ root: "", tag: "", recursive: true, depth: "0" })
  const [preview, setPreview] = useState(!!flow.preview)
  const target = targetMode === "latest" ? "latest" : revision.trim()
  const viewChanged = FOLDERS.some(([f, , on]) => folders[f] !== on)
  const changed = p.files.filter((f) => f.change)
  const clash = p.incoming && target === "latest" ? p.incoming.paths.filter((x) => changed.some((f) => f.path === x)) : []
  const added = FOLDERS.filter(([f, , on]) => folders[f] && !on), removed = FOLDERS.filter(([f, , on]) => !folders[f] && on)
  const flags = [target !== "latest" && q(target), local === "reset" && "--reset", local === "forward" && "--forward-changes", viewChanged && "--view scribe-view.txt", deps.root && `--root-file ${q(deps.root)}`, deps.root && deps.tag && `--dependency-tag ${deps.tag}`, deps.root && deps.recursive && "--dependency-recursive", deps.root && deps.depth !== "0" && `--dependency-depth-limit ${deps.depth}`].filter(Boolean).join(" ")
  const go = () => { p.closeFlow(); p.sync({ target, reset: local === "reset" }); if (viewChanged) p.say("Folders on this computer updated") }
  const radio = "flex items-start gap-2 font-normal"
  return (
    <Dialog open onOpenChange={(o) => { if (!o) p.closeFlow() }}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ArrowDownToLine className="size-5" /> Sync options</DialogTitle>
          <DialogDescription>Get files from the server for <b>{p.branch}</b>, or move to an earlier revision.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 text-sm">
          <section className="space-y-2">
            <div className="font-medium">Sync to</div>
            <RadioGroup value={targetMode} onValueChange={setTargetMode} className="space-y-1.5">
              <Label className={radio}><RadioGroupItem value="latest" className="mt-0.5" /> <span>The latest on {p.branch}{p.incoming ? <span className="block text-xs text-zinc-500">1 new revision from {p.incoming.author} is waiting</span> : <span className="block text-xs text-zinc-500">You're up to date</span>}</span></Label>
              <Label className={radio}><RadioGroupItem value="revision" className="mt-0.5" /> <span>{dev ? "A specific revision or branch" : "An earlier version"}</span></Label>
            </RadioGroup>
            {targetMode === "revision" && (dev ? (
              <div className="space-y-1 pl-6">
                <Input autoFocus value={revision} onChange={(e) => setRevision(e.target.value)} placeholder="e02a77f5, main@128, release/1.2@LATEST" className="font-mono text-xs" />
                <p className="text-[11px] text-zinc-500">A hash, <code>[branch]@&lt;number&gt;</code>, <code>[branch]@LATEST</code> or <code>&lt;branch&gt;@&lt;hash&gt;</code>. A revision on another branch moves you onto that branch.</p>
              </div>
            ) : (
              <div className="pl-6">
                <Select value={revision} onValueChange={setRevision}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Pick a commit…" /></SelectTrigger>
                  <SelectContent>{REVS.map((r) => <SelectItem key={r.id} value={r.id}>{r.label} · {r.who}, {r.when}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ))}
          </section>
          <section className="space-y-2">
            <div className="font-medium">Your local changes{changed.length > 0 && <span className="font-normal text-zinc-500"> ({changed.length} files)</span>}</div>
            <RadioGroup value={local} onValueChange={setLocal} className="space-y-1.5">
              <Label className={radio}><RadioGroupItem value="keep" className="mt-0.5" /> <span>Keep them<span className="block text-xs text-zinc-500">If a file you changed also changed on the server, you'll decide which to keep</span></span></Label>
              <Label className={radio}><RadioGroupItem value="reset" className="mt-0.5" /> <span>Overwrite them to match the server<span className="block text-xs text-red-600">Your uncommitted changes to those files are lost</span></span></Label>
              {dev && <Label className={radio}><RadioGroupItem value="forward" className="mt-0.5" /> <span>Carry them forward<span className="block text-xs text-zinc-500">Only when syncing to a local revision (<code>--forward-changes</code>)</span></span></Label>}
            </RadioGroup>
          </section>
          <section className="space-y-2">
            <div className="font-medium">Folders on this computer</div>
            <div className="grid grid-cols-3 gap-1.5">
              {FOLDERS.map(([f, size]) => (
                <Label key={f} className={cn("flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs font-normal", folders[f] && "border-zinc-400 bg-zinc-50")}>
                  <Checkbox checked={folders[f]} onCheckedChange={() => setFolders({ ...folders, [f]: !folders[f] })} /><span className="flex-1">{f}</span><span className="text-zinc-400">{size}</span>
                </Label>
              ))}
            </div>
          </section>
          {dev && (
            <details className="rounded-md border px-3 py-2 text-xs">
              <summary className="cursor-pointer font-medium">Only some files and what they depend on</summary>
              <div className="mt-2 grid grid-cols-[7rem_1fr] items-center gap-x-3 gap-y-2">
                <span className="text-zinc-500">Root files</span><Input value={deps.root} onChange={(e) => setDeps({ ...deps, root: e.target.value })} placeholder="Levels/forest.umap" className="h-7 font-mono text-xs" />
                <span className="text-zinc-500">Dependency tag</span><Input value={deps.tag} onChange={(e) => setDeps({ ...deps, tag: e.target.value })} placeholder="any" className="h-7 font-mono text-xs" />
                <span className="text-zinc-500">Depth</span>
                <span className="flex items-center gap-3">
                  <Input type="number" min={0} value={deps.depth} onChange={(e) => setDeps({ ...deps, depth: e.target.value })} className="h-7 w-20 text-xs" />
                  <Label className="text-xs font-normal"><Checkbox checked={deps.recursive} onCheckedChange={(v) => setDeps({ ...deps, recursive: v === true })} /> Follow dependencies of dependencies</Label>
                </span>
              </div>
            </details>
          )}
          {preview && (
            <div className="space-y-1 rounded-md border bg-zinc-50 p-2 text-xs">
              <div className="flex items-center gap-1.5 font-medium"><Eye className="size-3.5" /> Preview: nothing has changed yet</div>
              {target === "latest"
                ? p.incoming ? <div>1 revision from {p.incoming.author} (“{p.incoming.message}”): {p.incoming.paths.length + p.incoming.others} files would update.</div> : <div>Already up to date.</div>
                : target ? <div>You'd move to <code>{target}</code>: about 14 files would change on disk.</div> : <div className="text-zinc-500">Pick a revision first.</div>}
              {clash.length > 0 && <div className={local === "reset" ? "text-red-700" : "text-amber-800"}>{clash.length} of them you changed too ({clash.map(fileName).join(", ")}): {local === "reset" ? "your changes would be overwritten" : "you'd decide which version to keep"}.</div>}
              {added.length > 0 && <div>Would download {added.map(([f, s]) => `${f}/ (${s})`).join(", ")}.</div>}
              {removed.length > 0 && <div>Would remove {removed.map(([f]) => `${f}/`).join(", ")} from this computer. It stays on the server.</div>}
            </div>
          )}
          <Cli>lore revision sync{flags ? " " + flags : ""}{preview ? " --dry-run" : ""}</Cli>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => setPreview(true)}><Eye className="size-4" /> Preview</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={p.closeFlow}>Cancel</Button>
            <Button disabled={!target} variant={local === "reset" ? "destructive" : "default"} onClick={go}>{local === "reset" ? "Overwrite and sync" : "Sync"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SyncConflictDialog({ flow }: { flow: Extract<Flow, { kind: "sync-conflict" }> }) {
  const p = useProto()
  const dev = p.mode === "developer"
  const n = flow.paths.length
  return (
    <Dialog open onOpenChange={(o) => { if (!o) p.closeFlow() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CircleAlert className="size-5 text-amber-600" /> {n} file{n === 1 ? "" : "s"} changed on both sides</DialogTitle>
          <DialogDescription>{INCOMING.author} pushed “{INCOMING.message}”, which changes {n === 1 ? "a file" : "files"} you're also working on. The rest of the sync is ready.</DialogDescription>
        </DialogHeader>
        <ul className="space-y-1 rounded-md border p-2 text-sm">
          {flow.paths.map((x) => <li key={x} className="flex items-center gap-2"><FileTypeIcon path={x} />{dev ? <code className="text-xs">{x}</code> : fileName(x)}</li>)}
        </ul>
        {dev && <p className="text-[11px] text-zinc-500">Guess: Lore reports these as sync conflicts and resolves them with the same mine/theirs machinery as a merge.</p>}
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => { p.closeFlow(); p.say("Left for later. Sync again when you're ready") }}>Later</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { p.closeFlow(); p.sync({ reset: true }) }}>Overwrite mine</Button>
            <Button onClick={() => p.startConflict({ origin: "sync", paths: flow.paths })}>Decide file by file</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------- Switch

function SwitchDialog({ flow }: { flow: Extract<Flow, { kind: "switch" }> }) {
  const p = useProto()
  const dev = p.mode === "developer"
  const [revMode, setRevMode] = useState(flow.revision ? "revision" : "latest")
  const [revision, setRevision] = useState(flow.revision ?? "")
  const [changes, setChanges] = useState("keep")
  const [local, setLocal] = useState(false)
  const [preview, setPreview] = useState(false)
  const changed = p.files.filter((f) => f.change).length
  const rev = revMode === "latest" ? "latest" : revision.trim()
  const flags = [rev !== "latest" && q(rev), changes === "reset" && "--reset", local && "--local"].filter(Boolean).join(" ")
  const radio = "flex items-start gap-2 font-normal"
  return (
    <Dialog open onOpenChange={(o) => { if (!o) p.closeFlow() }}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><GitBranch className="size-5" /> Switch to {flow.branch}</DialogTitle>
          <DialogDescription>{changed ? `You have ${changed} changed file${changed === 1 ? "" : "s"} on ${p.branch}.` : `From ${p.branch}.`}{p.unpushed > 0 && ` Your ${p.unpushed} unpushed commit${p.unpushed === 1 ? " stays" : "s stay"} on ${p.branch}.`}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          {changed > 0 && (
            <section className="space-y-1.5">
              <div className="font-medium">Your changes</div>
              <RadioGroup value={changes} onValueChange={setChanges} className="space-y-1.5">
                <Label className={radio}><RadioGroupItem value="keep" className="mt-0.5" /> <span>Keep them<span className="block text-xs text-zinc-500">Works only if {flow.branch} doesn't change those files. Otherwise Lore stops and nothing changes.</span></span></Label>
                <Label className={radio}><RadioGroupItem value="reset" className="mt-0.5" /> <span>Discard them<span className="block text-xs text-red-600">Files go back to how they are on {flow.branch}</span></span></Label>
              </RadioGroup>
              <button className="text-xs text-zinc-500 underline" onClick={() => { p.closeFlow(); window.dispatchEvent(new CustomEvent("scribe:command", { detail: { type: "tab", value: "staging" } })) }}>Commit them first instead</button>
              {dev && <p className="text-[11px] text-zinc-500">Without <code>--reset</code>, Lore refuses the whole switch with <code>LocalModifications</code> if the target changes an edited file, or if anything is staged. How Scribe shows that is still open.</p>}
            </section>
          )}
          <section className="space-y-1.5">
            <div className="font-medium">Where on {flow.branch}</div>
            <RadioGroup value={revMode} onValueChange={setRevMode} className="space-y-1.5">
              <Label className={radio}><RadioGroupItem value="latest" className="mt-0.5" /> The latest</Label>
              <Label className={radio}><RadioGroupItem value="revision" className="mt-0.5" /> {dev ? "A specific revision" : "An earlier version"}</Label>
            </RadioGroup>
            {revMode === "revision" && (dev
              ? <Input autoFocus value={revision} onChange={(e) => setRevision(e.target.value)} placeholder="e02a77f5 or @128" className="ml-6 w-[calc(100%-1.5rem)] font-mono text-xs" />
              : (
                <div className="pl-6">
                  <Select value={revision} onValueChange={setRevision}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Pick a commit…" /></SelectTrigger>
                    <SelectContent>{REVS.map((r) => <SelectItem key={r.id} value={r.id}>{r.label} · {r.when}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              ))}
          </section>
          {dev && <Label className="text-xs font-normal"><Checkbox checked={local} onCheckedChange={(v) => setLocal(v === true)} /> Don't check the server for newer revisions</Label>}
          {preview && (
            <div className="rounded-md border bg-zinc-50 p-2 text-xs">
              <div className="mb-1 flex items-center gap-1.5 font-medium"><Eye className="size-3.5" /> Preview: nothing has changed yet</div>
              About 23 files would change on disk.{changed > 0 && (changes === "reset" ? ` Your ${changed} changed files would be discarded.` : ` Your ${changed} changed files would come along.`)}
            </div>
          )}
          <Cli>lore branch switch {flow.branch}{flags ? " " + flags : ""}{preview ? " --dry-run" : ""}</Cli>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => setPreview(true)}><Eye className="size-4" /> Preview</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={p.closeFlow}>Cancel</Button>
            <Button disabled={!rev} variant={changes === "reset" && changed ? "destructive" : "default"} onClick={() => p.switchBranch(flow.branch, { revision: rev, reset: changes === "reset", local })}>{changes === "reset" && changed ? "Discard and switch" : "Switch"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------- Locks

function ReleaseLockDialog({ flow }: { flow: Extract<Flow, { kind: "release-lock" }> }) {
  const p = useProto()
  const f = allFiles(p.files).find((x) => x.path === flow.path)
  const who = f?.lock?.by ?? "someone"
  return (
    <Dialog open onOpenChange={(o) => { if (!o) p.closeFlow() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><LockOpen className="size-5" /> Release {who}'s lock?</DialogTitle>
          <DialogDescription>
            {fileName(flow.path)} is locked by {who} on {lockBranch(f?.lock ?? null)}. As a project admin you can release it, for example when {who} is away. If {who} is still editing, their work may clash with the next person's. Let them know.
          </DialogDescription>
        </DialogHeader>
        <Cli>lore lock release {q(flow.path)} --branch {lockBranch(f?.lock ?? null)} --owner {who.toLowerCase()}</Cli>
        <DialogFooter>
          <Button variant="outline" onClick={p.closeFlow}>Cancel</Button>
          <Button variant="destructive" onClick={() => p.releaseLock(flow.path)}>Release lock</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** "Who's editing what": every lock in the project, grouped by person (`lore lock query`). */
function LocksDialog() {
  const p = useProto()
  const dev = p.mode === "developer"
  const [branch, setBranch] = useState("all")
  const locked = allFiles(p.files).filter((f) => f.lock && (branch === "all" || lockBranch(f.lock) === branch))
  const people = useMemo(() => [...new Set(locked.map((f) => f.lock!.by))].sort((a, b) => (a === "you" ? -1 : b === "you" ? 1 : a.localeCompare(b))), [locked])
  const branches = [...new Set(allFiles(p.files).filter((f) => f.lock).map((f) => lockBranch(f.lock)))]
  const mine = locked.filter((f) => f.lock!.by === "you").length
  return (
    <Dialog open onOpenChange={(o) => { if (!o) p.closeFlow() }}>
      <DialogContent className="flex max-h-[80vh] flex-col sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Lock className="size-5" /> Who's editing what</DialogTitle>
          <DialogDescription>Every locked file in this project, by person.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 text-xs">
          <Select value={branch} onValueChange={setBranch}>
            <SelectTrigger size="sm" className="h-7 w-56 text-xs"><GitBranch className="size-3.5 text-zinc-500" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All branches</SelectItem>
              {BRANCHES.filter((b) => branches.includes(b)).map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-zinc-500">{locked.length} locked file{locked.length === 1 ? "" : "s"} · {people.length} {people.length === 1 ? "person" : "people"}</span>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-auto">
          {people.map((who) => {
            const theirs = locked.filter((f) => f.lock!.by === who)
            return (
              <section key={who} className="rounded-lg border">
                <header className="flex items-center gap-2 border-b bg-zinc-50 px-3 py-1.5 text-sm">
                  <span className="grid size-6 place-items-center rounded-full bg-zinc-900 text-[10px] font-semibold text-white">{who === "you" ? "YO" : who.slice(0, 2).toUpperCase()}</span>
                  <span className="font-medium">{who === "you" ? "You" : who}</span>
                  <span className="text-xs text-zinc-500">{theirs.length} file{theirs.length === 1 ? "" : "s"}</span>
                </header>
                <ul className="divide-y">
                  {theirs.map((f) => (
                    <li key={f.path} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                      <FileTypeIcon path={f.path} />
                      <span className={cn("min-w-0 flex-1 truncate", dev && "font-mono text-xs")}>{dev ? f.path : fileName(f.path)}</span>
                      <Badge variant="outline" className="font-normal"><GitBranch className="size-3" />{lockBranch(f.lock)}</Badge>
                      {f.change && <ChangeBadge file={f} />}
                      {who === "you"
                        ? <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => p.toggleLock(f.path)}>Release</Button>
                        : <Button size="sm" variant="ghost" className="h-6 text-xs text-red-600 hover:text-red-700" onClick={() => p.openFlow({ kind: "release-lock", path: f.path })}>Release (admin)…</Button>}
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
          {!people.length && <p className="py-6 text-center text-sm text-zinc-400">No locks{branch !== "all" && ` on ${branch}`}.</p>}
        </div>
        <Cli>lore lock query{branch !== "all" ? ` --branch ${branch}` : ""}</Cli>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" disabled={!mine} onClick={p.releaseAllMine}><LockOpen className="size-4" /> Release all my locks{mine ? ` (${mine})` : ""}</Button>
          <Button onClick={p.closeFlow}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------- Branch management

function ArchiveBranchDialog({ flow }: { flow: Extract<Flow, { kind: "archive-branch" }> }) {
  const p = useProto()
  const dev = p.mode === "developer"
  const [layers, setLayers] = useState(false)
  const [links, setLinks] = useState(false)
  const b = flow.branch
  const why = archiveBlocker(p, b)
  return (
    <Dialog open onOpenChange={(o) => { if (!o) p.closeFlow() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Archive className="size-5" /> Archive {b}?</DialogTitle>
          <DialogDescription>
            It disappears from the branch list, for everyone: here and on the Lore Server. Its commits and history are kept, and the name is free to reuse. You can restore it later from <b>Archived branches</b>.
          </DialogDescription>
        </DialogHeader>
        {dev && (
          <div className="space-y-1.5 text-xs">
            <Label className="font-normal text-zinc-400"><Checkbox disabled checked={layers} onCheckedChange={(v) => setLayers(v === true)} /> Also archive it in layers (this project has none)</Label>
            <Label className="font-normal text-zinc-400"><Checkbox disabled checked={links} onCheckedChange={(v) => setLinks(v === true)} /> Also archive it in linked repositories (this project has none)</Label>
          </div>
        )}
        <Cli>lore branch archive {b}{layers ? " --include-layers" : ""}{links ? " --include-links" : ""}</Cli>
        <DialogFooter>
          <Button variant="outline" onClick={p.closeFlow}>Cancel</Button>
          <Button variant="destructive" disabled={!!why} title={why ? `Lore refuses: ${why}` : undefined} onClick={() => p.archiveBranch(b)}><Archive className="size-4" /> Archive branch</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RestoreBranchDialog({ flow }: { flow: Extract<Flow, { kind: "restore-branch" }> }) {
  const p = useProto()
  const dev = p.mode === "developer"
  const a = p.archived.find((x) => x.id === flow.id)
  const [name, setName] = useState(a?.name ?? "")
  if (!a) return null
  const taken = p.branches.includes(name.trim())
  return (
    <Dialog open onOpenChange={(o) => { if (!o) p.closeFlow() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ArchiveRestore className="size-5" /> Restore {a.name}</DialogTitle>
          <DialogDescription>Archived by {a.by}, {a.when}. It comes back with all its commits.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="restore-name">Name</Label>
          <Input id="restore-name" value={name} onChange={(e) => setName(e.target.value)} className={cn("font-mono text-sm", taken && "border-red-400")} />
          {taken ? <p className="text-xs text-red-600">A branch with this name exists now. Pick another name.</p> : <p className="text-xs text-zinc-500">Someone may have reused the name since; you can restore it under a new one.</p>}
        </div>
        {dev && <p className="text-[11px] text-zinc-500">There's no unarchive command: Lore re-attaches the old branch id to a name. Guess: works against the server's copy too (only the local path was read).</p>}
        <Cli>lore branch create {name.trim() || "<name>"} --id {a.id}</Cli>
        <DialogFooter>
          <Button variant="outline" onClick={p.closeFlow}>Cancel</Button>
          <Button disabled={!name.trim() || taken} onClick={() => p.restoreBranch(a.id, name.trim())}>Restore branch</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ResetBranchDialog({ flow }: { flow: Extract<Flow, { kind: "reset-branch" }> }) {
  const p = useProto()
  const b = flow.branch
  const [target, setTarget] = useState(flow.target ?? flow.revisions[1]?.id ?? flow.revisions[0]?.id ?? "")
  const [typed, setTyped] = useState("")
  const current = b === p.branch
  const changed = p.files.filter((f) => f.change).length
  return (
    <Dialog open onOpenChange={(o) => { if (!o) p.closeFlow() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Undo2 className="size-5" /> Reset local {b}</DialogTitle>
          <DialogDescription>Move this computer's copy of {b} back to an earlier revision. The Lore Server isn't changed.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="space-y-1.5">
            <Label>Move it to</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{flow.revisions.map((r) => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <ul className="list-disc space-y-1 rounded-md border border-amber-200 bg-amber-50 py-2 pl-7 pr-3 text-xs text-amber-900">
            <li>Local Commits after that revision are no longer on the branch. Pointer history still lists them.</li>
            {current && <li>Your working files are synced to that revision{changed ? `, so your ${changed} uncommitted change${changed === 1 ? " is" : "s are"} discarded` : ""}. (Guess, not yet verified against a live server.)</li>}
          </ul>
          <div className="space-y-1.5">
            <Label htmlFor="reset-confirm">Type <code className="rounded bg-zinc-100 px-1">{b}</code> to confirm</Label>
            <Input id="reset-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} className="font-mono text-sm" autoComplete="off" />
          </div>
          <Cli>lore branch reset {target} --branch {b}</Cli>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={p.closeFlow}>Cancel</Button>
          <Button variant="destructive" disabled={typed !== b || !target} onClick={() => p.resetBranch(b, target)}>Reset branch</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Renders whichever flow dialog is open. Keyed by the flow so a new one starts with fresh state. */
export function Flows() {
  const f = useProto().flow
  if (!f) return null
  return (
    <Fragment key={JSON.stringify(f)}>
      {f.kind === "diff" && <DiffDialog flow={f} />}
      {f.kind === "merge" && <MergeDialog flow={f} />}
      {f.kind === "sync" && <SyncDialog flow={f} />}
      {f.kind === "sync-conflict" && <SyncConflictDialog flow={f} />}
      {f.kind === "switch" && <SwitchDialog flow={f} />}
      {f.kind === "release-lock" && <ReleaseLockDialog flow={f} />}
      {f.kind === "locks" && <LocksDialog />}
      {f.kind === "archive-branch" && <ArchiveBranchDialog flow={f} />}
      {f.kind === "restore-branch" && <RestoreBranchDialog flow={f} />}
      {f.kind === "reset-branch" && <ResetBranchDialog flow={f} />}
    </Fragment>
  )
}

