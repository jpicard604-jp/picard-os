import BrainGraphLoader from '@/components/brain/BrainGraphLoader'

export const metadata = {
  title: 'Neural Link — Picard OS',
  description: 'Obsidian-style knowledge graph of your personal operating system',
}

export default function BrainPage() {
  return (
    <div className="min-h-screen bg-[#07070a] px-4 pt-6 pb-24 lg:pl-64 lg:pr-8 lg:pt-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-[22px] font-mono font-semibold text-white tracking-tight">
            Obsidian Neural Link
          </h1>
          <p className="text-[11px] font-mono text-zinc-600 mt-1">
            Knowledge graph · Picard OS data layer
          </p>
        </div>

        <BrainGraphLoader />
      </div>
    </div>
  )
}
