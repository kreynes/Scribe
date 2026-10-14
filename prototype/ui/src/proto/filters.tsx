// PROTOTYPE: Explorer filter controls. Revision: searchable list that also accepts any typed revision ID (for repos with thousands of revisions).
// Modified: presets, a range calendar, and From/To fields you can type into.
import { CalendarRange, Check, ChevronDown, GitCommitHorizontal, X } from "lucide-react"
import { useState } from "react"
import type { DateRange } from "react-day-picker"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export type RevOption = { id: string; message: string; when: string }

/** "any" | "working" | a full or partial revision ID (matched as a prefix). */
export function RevisionFilter({ value, onChange, revisions }: { value: string; onChange: (v: string) => void; revisions: RevOption[] }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const typed = search.trim()
  const looksLikeRev = /^[0-9a-f]{4,64}$/i.test(typed)
  const exact = revisions.some((r) => r.id === typed)
  const label = value === "any" ? "Any" : value === "working" ? "Working copy" : value
  const pick = (v: string) => { onChange(v); setOpen(false); setSearch("") }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 w-48 justify-between font-normal">
          <span className="truncate"><span className="text-zinc-500">Revision:</span> <span className={cn(value !== "any" && value !== "working" && "font-mono text-xs")}>{label}</span></span>
          <ChevronDown className="size-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandInput value={search} onValueChange={setSearch} placeholder="Search or type a revision ID…" />
          <CommandList>
            <CommandEmpty>{looksLikeRev ? "Not in the recent list. Use the option above." : "No matching revisions."}</CommandEmpty>
            {looksLikeRev && !exact && (
              <CommandGroup heading="Custom">
                <CommandItem value={`custom ${typed}`} onSelect={() => pick(typed.toLowerCase())}>
                  <GitCommitHorizontal /> Filter by revision <code className="font-mono text-xs">{typed.toLowerCase()}</code>
                  <span className="ml-auto text-[10px] text-zinc-400">prefix match</span>
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup>
              <CommandItem value="any" onSelect={() => pick("any")}>Any {value === "any" && <Check className="ml-auto" />}</CommandItem>
              <CommandItem value="working copy changed" onSelect={() => pick("working")}>Working copy (changed) {value === "working" && <Check className="ml-auto" />}</CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Recent revisions">
              {revisions.map((r) => (
                <CommandItem key={r.id} value={`${r.id} ${r.message}`} onSelect={() => pick(r.id)}>
                  <code className="font-mono text-xs">{r.id}</code>
                  <span className="truncate text-zinc-500">{r.message}</span>
                  <span className="ml-auto shrink-0 text-[10px] text-zinc-400">{r.when}</span>
                  {value === r.id && <Check />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export type DatePreset = "any" | "today" | "week" | "month" | "older"
export type DateValue = { kind: "preset"; preset: DatePreset } | { kind: "range"; from?: Date; to?: Date }

const PRESETS: [DatePreset, string][] = [["any", "Any time"], ["today", "Today"], ["week", "Last 7 days"], ["month", "Last 30 days"], ["older", "Older than 30 days"]]

const iso = (d?: Date) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : "")
const parse = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim())
  if (!m) return undefined
  const d = new Date(+m[1], +m[2] - 1, +m[3])
  return isNaN(d.getTime()) ? undefined : d
}

export function dateLabel(v: DateValue) {
  if (v.kind === "preset") return PRESETS.find(([k]) => k === v.preset)![1]
  if (v.from && v.to) return `${iso(v.from)} → ${iso(v.to)}`
  if (v.from) return `from ${iso(v.from)}`
  if (v.to) return `until ${iso(v.to)}`
  return "Any time"
}

export function DateRangeFilter({ value, onChange, today }: { value: DateValue; onChange: (v: DateValue) => void; today: Date }) {
  const [open, setOpen] = useState(false)
  const range: DateRange | undefined = value.kind === "range" ? { from: value.from, to: value.to } : undefined
  const [fromText, setFromText] = useState(iso(range?.from))
  const [toText, setToText] = useState(iso(range?.to))
  const setRange = (from?: Date, to?: Date) => { onChange({ kind: "range", from, to }); setFromText(iso(from)); setToText(iso(to)) }
  const active = !(value.kind === "preset" && value.preset === "any")
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="relative">
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 w-60 justify-between pr-8 font-normal">
            <span className="flex min-w-0 items-center gap-1.5">
              <CalendarRange className="size-4 shrink-0 text-zinc-500" />
              <span className="truncate"><span className="text-zinc-500">Modified:</span> {dateLabel(value)}</span>
            </span>
          </Button>
        </PopoverTrigger>
        {active ? (
          <button
            aria-label="Clear date filter"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
            onClick={() => { onChange({ kind: "preset", preset: "any" }); setFromText(""); setToText("") }}
          ><X className="size-3.5" /></button>
        ) : <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 opacity-50" />}
      </div>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex">
          <div className="flex w-40 flex-col gap-0.5 border-r p-2">
            {PRESETS.map(([k, l]) => (
              <button
                key={k}
                onClick={() => { onChange({ kind: "preset", preset: k }); setFromText(""); setToText(""); setOpen(false) }}
                className={cn("rounded px-2 py-1.5 text-left text-sm hover:bg-zinc-100", value.kind === "preset" && value.preset === k && "bg-zinc-100 font-medium")}
              >{l}</button>
            ))}
            <div className={cn("mt-1 rounded px-2 py-1.5 text-sm", value.kind === "range" && "bg-zinc-100 font-medium")}>Custom range</div>
          </div>
          <div className="p-3">
            <div className="mb-2 flex items-end gap-2">
              {([["From", fromText, setFromText, (d?: Date) => setRange(d, range?.to)], ["To", toText, setToText, (d?: Date) => setRange(range?.from, d)]] as const).map(([l, text, setText, apply]) => (
                <label key={l} className="flex-1 space-y-1">
                  <span className="text-xs text-zinc-500">{l}</span>
                  <Input
                    value={text}
                    placeholder="YYYY-MM-DD"
                    onChange={(e) => setText(e.target.value)}
                    onBlur={() => { if (!text) apply(undefined); else if (parse(text)) apply(parse(text)) }}
                    onKeyDown={(e) => { if (e.key === "Enter" && parse(text)) apply(parse(text)) }}
                    className={cn("h-8 font-mono text-xs", text && !parse(text) && "border-red-400 focus-visible:ring-red-200")}
                  />
                </label>
              ))}
            </div>
            <Calendar
              mode="range"
              numberOfMonths={2}
              defaultMonth={range?.from ?? new Date(today.getFullYear(), today.getMonth() - 1, 1)}
              selected={range}
              onSelect={(r) => setRange(r?.from, r?.to)}
              disabled={{ after: today }}
            />
            <div className="mt-2 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => { onChange({ kind: "preset", preset: "any" }); setFromText(""); setToText("") }}>Clear</Button>
              <Button size="sm" onClick={() => setOpen(false)}>Apply</Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
