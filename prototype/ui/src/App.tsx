// PROTOTYPE: "How do Developer Mode and Artist Mode look side by side?" (kreynes/Scribe#10)
// Three variants of Scribe's main screen, switchable via ?variant=A|B|C, each in ?mode=artist|developer,
// plus ?screen=onboarding|main|conflict. Throwaway: in-memory mock data, no Lore calls.
import { ConflictScreen, Onboarding, PrototypeSwitcher } from "./proto/screens"
import { ExpiredBanner, LockWarningDialog, Toast } from "./proto/shared"
import { ProtoProvider, useProto } from "./proto/state"
import { VariantA, VariantB, VariantC } from "./proto/variants"
import { VariantD } from "./proto/variantD"

function Shell() {
  const p = useProto()
  return (
    <div className="flex h-screen flex-col bg-white text-zinc-900">
      <ExpiredBanner />
      <div className="min-h-0 flex-1 pb-14">
        {p.screen === "onboarding" && <Onboarding />}
        {p.screen === "conflict" && <ConflictScreen />}
        {p.screen === "main" && (p.variant === "A" ? <VariantA /> : p.variant === "B" ? <VariantB /> : p.variant === "C" ? <VariantC /> : <VariantD />)}
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
