'use client'

import { useEffect, useRef, useState } from 'react'
import {
  buildBrainGraph,
  computeLayout,
  NODE_COLORS,
  DOMAIN_IDS,
  HUB_ID,
  type PositionedNode,
  type BrainGraphEdge,
  type BrainGraphNode,
} from '@/lib/brain-graph'

const W = 640
const H = 460

// ─── Legend entries ───────────────────────────────────────────────────────────

const LEGEND = [
  { type: 'xodus',     label: 'XODUS'     },
  { type: 'project',   label: 'Projects'  },
  { type: 'fitness',   label: 'Fitness'   },
  { type: 'nutrition', label: 'Nutrition' },
  { type: 'daily',     label: 'Daily'     },
  { type: 'task',      label: 'Goals'     },
  { type: 'note',      label: 'Notes'     },
  { type: 'obsidian',  label: 'Vault'     },
  { type: 'system',    label: 'System'    },
] as const

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3 text-center">
      <div className="text-[18px] font-mono font-semibold text-white leading-none">{value}</div>
      <div className="text-[9px] font-mono uppercase tracking-[0.14em] text-zinc-600 mt-1">{label}</div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BrainGraph() {
  const [nodes, setNodes]         = useState<PositionedNode[]>([])
  const [edges, setEdges]         = useState<BrainGraphEdge[]>([])
  const [selected, setSelected]   = useState<BrainGraphNode | null>(null)
  const [hovered, setHovered]     = useState<string | null>(null)
  const [mounted, setMounted]     = useState(false)
  const svgRef                    = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const data = buildBrainGraph()
    const positioned = computeLayout(data, W, H)
    setNodes(positioned)
    setEdges(data.edges)
    setMounted(true)
  }, [])

  // Build node position lookup for edge drawing
  const posMap = new Map(nodes.map(n => [n.id, n]))

  const domainCount  = nodes.filter(n => DOMAIN_IDS.has(n.id)).length
  const sourceCount  = new Set(nodes.map(n => n.source).filter(Boolean)).size

  function handleNodeClick(node: PositionedNode) {
    setSelected(prev => prev?.id === node.id ? null : node)
  }

  function isHub(n: PositionedNode)    { return n.id === HUB_ID }
  function isDomain(n: PositionedNode) { return DOMAIN_IDS.has(n.id) }

  function nodeRadius(n: PositionedNode): number {
    return n.size ?? (isHub(n) ? 22 : isDomain(n) ? 14 : 9)
  }

  function showLabel(n: PositionedNode): boolean {
    return isHub(n) || isDomain(n) || n.id === selected?.id || n.id === hovered
  }

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Nodes"   value={nodes.length} />
        <StatCard label="Links"   value={edges.length} />
        <StatCard label="Domains" value={domainCount}  />
        <StatCard label="Sources" value={sourceCount}  />
      </div>

      {/* Graph + sidebar */}
      <div className="flex gap-4 items-start">
        {/* SVG graph */}
        <div className="flex-1 min-w-0 rounded-2xl bg-[#080810] border border-white/[0.06] overflow-hidden">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-auto block"
            style={{ maxHeight: 520 }}
            onClick={e => { if (e.target === svgRef.current) setSelected(null) }}
          >
            {/* Edges */}
            {mounted && edges.map((edge, i) => {
              const src = posMap.get(edge.source)
              const tgt = posMap.get(edge.target)
              if (!src || !tgt) return null
              const srcColor = NODE_COLORS[src.type] ?? '#444'
              const opacity  = edge.type === 'core' ? 0.35 : edge.type === 'data' ? 0.22 : 0.14
              return (
                <line
                  key={i}
                  x1={src.x} y1={src.y}
                  x2={tgt.x} y2={tgt.y}
                  stroke={srcColor}
                  strokeOpacity={opacity}
                  strokeWidth={edge.type === 'core' ? 1.5 : 1}
                />
              )
            })}

            {/* Nodes */}
            {mounted && nodes.map(node => {
              const r         = nodeRadius(node)
              const color     = node.color ?? NODE_COLORS[node.type] ?? '#666'
              const isSelected = node.id === selected?.id
              const isHovered  = node.id === hovered
              const label      = showLabel(node)
              const hub        = isHub(node)
              const domain     = isDomain(node)

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x},${node.y})`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleNodeClick(node)}
                  onMouseEnter={() => setHovered(node.id)}
                  onMouseLeave={() => setHovered(null)}
                >
                  {/* Glow ring on selected */}
                  {isSelected && (
                    <circle r={r + 8} fill={color} fillOpacity={0.12} />
                  )}
                  {/* Hover ring */}
                  {isHovered && !isSelected && (
                    <circle r={r + 5} fill={color} fillOpacity={0.08} />
                  )}
                  {/* Main circle */}
                  <circle
                    r={r}
                    fill={color}
                    fillOpacity={hub ? 0.25 : domain ? 0.2 : 0.18}
                    stroke={color}
                    strokeWidth={isSelected ? 2 : hub ? 1.5 : 1}
                    strokeOpacity={isSelected ? 0.9 : hub ? 0.7 : 0.5}
                  />
                  {/* Hub inner dot */}
                  {hub && (
                    <circle r={4} fill="white" fillOpacity={0.7} />
                  )}
                  {/* Label */}
                  {label && (
                    <text
                      y={r + 13}
                      textAnchor="middle"
                      fill={hub ? 'white' : color}
                      fillOpacity={hub ? 0.9 : 0.8}
                      fontSize={hub ? 10 : domain ? 9 : 8}
                      fontFamily="'Geist Mono', monospace"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {node.label.length > 18 ? node.label.slice(0, 18) + '…' : node.label}
                    </text>
                  )}
                </g>
              )
            })}

            {!mounted && (
              <text x={W / 2} y={H / 2} textAnchor="middle" fill="#3f3f46" fontSize={11} fontFamily="monospace">
                Loading neural graph…
              </text>
            )}
          </svg>
        </div>

        {/* Right panel: legend + node detail */}
        <div className="w-44 flex-shrink-0 space-y-3">
          {/* Legend */}
          <div className="rounded-xl bg-[#0c0c14] border border-white/[0.06] p-3">
            <div className="text-[9px] font-mono uppercase tracking-[0.16em] text-zinc-600 mb-2">Legend</div>
            <div className="space-y-1.5">
              {LEGEND.map(({ type, label }) => (
                <div key={type} className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: NODE_COLORS[type as keyof typeof NODE_COLORS] }}
                  />
                  <span className="text-[10px] font-mono text-zinc-500">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Selected node detail */}
          {selected ? (
            <div className="rounded-xl bg-[#0c0c14] border border-white/[0.06] p-3 space-y-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className="text-[8px] font-mono uppercase tracking-[0.12em] px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: (NODE_COLORS[selected.type] ?? '#666') + '22',
                    color: NODE_COLORS[selected.type] ?? '#aaa',
                  }}
                >
                  {selected.type}
                </span>
                {selected.source && (
                  <span className="text-[8px] font-mono text-zinc-700">{selected.source}</span>
                )}
              </div>
              <div className="text-[11px] font-mono text-white leading-snug">{selected.label}</div>
              {selected.summary && (
                <div className="text-[10px] font-mono text-zinc-500 leading-snug">{selected.summary}</div>
              )}
              {selected.date && (
                <div className="text-[9px] font-mono text-zinc-700">{selected.date}</div>
              )}
              <button
                onClick={() => setSelected(null)}
                className="text-[9px] font-mono text-zinc-700 hover:text-zinc-400 transition-colors mt-1"
              >
                dismiss ×
              </button>
            </div>
          ) : (
            <div className="rounded-xl bg-[#0c0c14] border border-white/[0.06] p-3">
              <div className="text-[10px] font-mono text-zinc-700">Tap a node to inspect</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
