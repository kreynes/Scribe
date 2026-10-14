// PROTOTYPE: "How do Developer Mode and Artist Mode look side by side?" (kreynes/Scribe#10)
// Variant D of Scribe's main screen (A–C were rejected and removed), in ?mode=artist|developer,
// plus ?screen=onboarding|main|conflict. Throwaway: in-memory mock data, no Lore calls.
import { ConflictScreen, Onboarding, PrototypeSwitcher } from "./proto/screens"
import { ExpiredBanner, LockWarningDialog, Toast } from "./proto/shared"
import { ProtoProvider, useProto } from "./proto/state"
import { VariantD } from "./proto/variantD"

function Shell() {
  const p = useProto()
  return (
    <div className="flex h-screen flex-col bg-white text-zinc-900">
      <ExpiredBanner />
      <div className="min-h-0 flex-1 pb-14">
        {p.screen === "onboarding" && <Onboarding />}
        {p.screen === "conflict" && <ConflictScreen />}
        {p.screen === "main" && <VariantD />}
      </div>
      <LockWarningDialog />
      <Toast />
      <PrototypeSwitcher />
    </div>
  )
}

export default function App() {
  return <ProtoProvider><Shell /></ProtoProvider>
}
