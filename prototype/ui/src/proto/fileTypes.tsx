// PROTOTYPE: per-extension file icons, so common game/art/code file types are told apart at a glance.
import {
  Box, Boxes, Braces, Clapperboard, File, FileArchive, FileAudio, FileCode, FileImage, FileSpreadsheet, FileText,
  FileType, Film, Layers, Map as MapIcon, Package, Palette, Settings, Shapes, type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

type TypeInfo = { icon: LucideIcon; color: string; label: string }

const TYPES: Record<string, TypeInfo> = {
  psd: { icon: Layers, color: "text-sky-600", label: "Photoshop document" },
  kra: { icon: Palette, color: "text-pink-600", label: "Krita document" },
  png: { icon: FileImage, color: "text-emerald-600", label: "PNG image" },
  jpg: { icon: FileImage, color: "text-emerald-600", label: "JPEG image" },
  tga: { icon: FileImage, color: "text-teal-600", label: "Targa image" },
  exr: { icon: FileImage, color: "text-cyan-700", label: "OpenEXR image" },
  blend: { icon: Box, color: "text-orange-500", label: "Blender file" },
  fbx: { icon: Boxes, color: "text-indigo-500", label: "FBX model" },
  obj: { icon: Shapes, color: "text-indigo-400", label: "OBJ model" },
  uasset: { icon: Package, color: "text-zinc-700", label: "Unreal asset" },
  umap: { icon: MapIcon, color: "text-lime-700", label: "Unreal level" },
  wav: { icon: FileAudio, color: "text-violet-600", label: "WAV audio" },
  ogg: { icon: FileAudio, color: "text-violet-500", label: "Ogg audio" },
  mp4: { icon: Film, color: "text-rose-600", label: "MP4 video" },
  mov: { icon: Clapperboard, color: "text-rose-500", label: "QuickTime video" },
  ts: { icon: FileCode, color: "text-blue-600", label: "TypeScript" },
  rs: { icon: FileCode, color: "text-orange-700", label: "Rust" },
  cpp: { icon: FileCode, color: "text-blue-800", label: "C++" },
  json: { icon: Braces, color: "text-amber-600", label: "JSON" },
  ini: { icon: Settings, color: "text-zinc-500", label: "Config" },
  csv: { icon: FileSpreadsheet, color: "text-green-700", label: "CSV data" },
  ttf: { icon: FileType, color: "text-fuchsia-600", label: "Font" },
  zip: { icon: FileArchive, color: "text-yellow-700", label: "Archive" },
  md: { icon: FileText, color: "text-zinc-600", label: "Markdown" },
  txt: { icon: FileText, color: "text-zinc-500", label: "Text" },
}

export const typeOf = (path: string): TypeInfo => TYPES[path.split(".").pop()!.toLowerCase()] ?? { icon: File, color: "text-zinc-400", label: "File" }

export function FileTypeIcon({ path, className }: { path: string; className?: string }) {
  const t = typeOf(path)
  const Icon = t.icon
  return <Icon aria-label={t.label} className={cn("size-4 shrink-0", t.color, className)} />
}
