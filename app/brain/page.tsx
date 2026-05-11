import BrainGraphLoader from '@/components/brain/BrainGraphLoader'

export const metadata = {
  title: 'Neural Link — Picard OS',
  description: 'Obsidian-style knowledge graph of your personal operating system',
}

export default function BrainPage() {
  return (
    <div className="h-full w-full flex flex-col bg-[#050509]">
      <div className="flex-1 min-h-0 pb-16 lg:pb-0">
        <BrainGraphLoader />
      </div>
    </div>
  )
}
