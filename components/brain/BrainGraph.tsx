'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide,
  type Simulation, type SimulationNodeDatum, type SimulationLinkDatum,
} from 'd3-force'
import { Maximize2, X } from 'lucide-react'
import {
  buildBrainGraph, NODE_COLORS, DOMAIN_IDS, HUB_ID,
  type BrainGraphNode, type BrainGraphEdge,
} from '@/lib/brain-graph'

type SimNode = BrainGraphNode & SimulationNodeDatum
type SimLink = SimulationLinkDatum<SimNode> & Omit<BrainGraphEdge, 'source' | 'target'>

const LEGEND = [
  { type: 'xodus',     label: 'XODUS'     },
  { type: 'project',   label: 'Projects'  },
  { type: 'fitness',   label: 'Fitness'   },
  { type: 'nutrition', label: 'Nutrition' },
  { type: 'daily',     label: 'Daily'     },
  { type: 'task',      label: 'Goals'     },
  { type: 'note',      label: 'Notes'     },
  { type: 'memory',    label: 'Memory'    },
  { type: 'obsidian',  label: 'Vault'     },
  { type: 'system',    label: 'System'    },
] as const

const PROXIMITY_FULL  = 38   // within this distance, node is "the" proximity focus
const PROXIMITY_FALL  = 130  // outside this, no proximity highlight at all

function baseNodeRadius(n: BrainGraphNode): number {
  if (n.id === HUB_ID)       return 18
  if (DOMAIN_IDS.has(n.id))  return 11
  return n.size ?? 6
}

function baseEdgeOpacity(type?: string): number {
  if (type === 'core')     return 0.40
  if (type === 'member')   return 0.28
  if (type === 'data')     return 0.24
  if (type === 'semantic') return 0.16
  return 0.18
}

export default function BrainGraph() {
  const [nodes, setNodes] = useState<SimNode[]>([])
  const [edges, setEdges] = useState<SimLink[]>([])
  const [, setFrame]      = useState(0)
  const [hovered, setHovered]   = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [filter, setFilter]     = useState<string | null>(null)
  const [view, setView]         = useState({ tx: 0, ty: 0, k: 1 })
  const [size, setSize]         = useState({ w: 1200, h: 800 })
  const [cursor, setCursor]     = useState<{ x: number; y: number } | null>(null)
  const [cursorScreen, setCursorScreen] = useState<{ x: number; y: number } | null>(null)
  const [reheatTick, setReheatTick]     = useState(0)

  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef       = useRef<SVGSVGElement>(null)
  const simRef       = useRef<Simulation<SimNode, SimLink> | null>(null)
  const panRef       = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)
  const dragNodeRef  = useRef<SimNode | null>(null)

  // ── Resize observer ───────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => {
      const r = el.getBoundingClientRect()
      setSize({ w: Math.max(420, r.width), h: Math.max(360, r.height) })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ── Build sim ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const data = buildBrainGraph()
    const cx = size.w / 2
    const cy = size.h / 2
    const ns: SimNode[] = data.nodes.map((n) => ({
      ...n,
      x: cx + (Math.random() - 0.5) * 120,
      y: cy + (Math.random() - 0.5) * 120,
    }))
    const byId = new Map(ns.map((n) => [n.id, n]))
    const ls: SimLink[] = []
    for (const e of data.edges) {
      const s = byId.get(e.source)
      const t = byId.get(e.target)
      if (!s || !t) continue
      ls.push({ source: s, target: t, type: e.type, strength: e.strength })
    }

    const sim = forceSimulation<SimNode, SimLink>(ns)
      .force(
        'link',
        forceLink<SimNode, SimLink>(ls)
          .id((d) => d.id)
          .distance((l) => (l.type === 'core' ? 130 : DOMAIN_IDS.has((l.source as SimNode).id) ? 85 : 58))
          .strength((l) => (l.strength ?? 0.5) * 0.7),
      )
      .force(
        'charge',
        forceManyBody<SimNode>().strength((d) =>
          d.id === HUB_ID ? -1600 : DOMAIN_IDS.has(d.id) ? -560 : -170,
        ),
      )
      .force('center', forceCenter<SimNode>(cx, cy).strength(0.04))
      .force('collide', forceCollide<SimNode>().radius((d) => baseNodeRadius(d) + 6).strength(0.9))
      .alpha(1)
      .alphaDecay(0.025)
      .on('tick', () => setFrame((f) => (f + 1) % 1_000_000))

    simRef.current = sim
    setNodes(ns)
    setEdges(ls)

    return () => { sim.stop() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update center force when size changes
  useEffect(() => {
    const sim = simRef.current
    if (!sim) return
    sim.force('center', forceCenter<SimNode>(size.w / 2, size.h / 2).strength(0.04))
    sim.alpha(0.25).restart()
  }, [size])

  // Reheat
  useEffect(() => {
    if (reheatTick === 0) return
    const sim = simRef.current
    if (!sim) return
    for (const n of nodes) { n.fx = null; n.fy = null }
    sim.alpha(0.9).restart()
  }, [reheatTick, nodes])

  // ── Adjacency ─────────────────────────────────────────────────────────────
  const adjacency = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const e of edges) {
      const s = (e.source as SimNode).id
      const t = (e.target as SimNode).id
      if (!m.has(s)) m.set(s, new Set())
      if (!m.has(t)) m.set(t, new Set())
      m.get(s)!.add(t)
      m.get(t)!.add(s)
    }
    return m
  }, [edges])

  // ── Proximity focus (re-computed each render — sim ticks force re-renders) ─
  let proximityNode: SimNode | null = null
  let proximityDist = Infinity
  if (cursor && !dragNodeRef.current && !panRef.current) {
    for (const n of nodes) {
      if (n.x == null || n.y == null) continue
      const dx = n.x - cursor.x
      const dy = n.y - cursor.y
      const d = Math.hypot(dx, dy)
      if (d < PROXIMITY_FALL && d < proximityDist) {
        proximityNode = n
        proximityDist = d
      }
    }
  }

  function proximityFactor(n: SimNode): number {
    if (!cursor || n.x == null || n.y == null) return 0
    const d = Math.hypot(n.x - cursor.x, n.y - cursor.y)
    if (d >= PROXIMITY_FALL) return 0
    if (d <= PROXIMITY_FULL) return 1
    return 1 - (d - PROXIMITY_FULL) / (PROXIMITY_FALL - PROXIMITY_FULL)
  }

  const focusId = selected ?? hovered ?? proximityNode?.id ?? null
  const neighbors = focusId ? adjacency.get(focusId) ?? new Set() : null
  const primaryPf = proximityNode ? proximityFactor(proximityNode) : 0

  // Magnetic offset: nearby nodes drift toward cursor like a soft magnetic pull.
  // Visual only — never mutates simulation x/y. Skipped when dragging the node.
  function magneticOffset(n: SimNode, pf: number): { dx: number; dy: number } {
    if (!cursor || n.x == null || n.y == null) return { dx: 0, dy: 0 }
    if (dragNodeRef.current?.id === n.id) return { dx: 0, dy: 0 }
    const isPrimary  = proximityNode?.id === n.id
    const isNeighbor = focusId != null && neighbors?.has(n.id) && !isPrimary
    let pull = 0
    if (isPrimary)            pull = 7 * pf
    else if (isNeighbor)      pull = 3 * primaryPf
    else if (pf > 0.1)        pull = 1.5 * pf
    if (pull < 0.15) return { dx: 0, dy: 0 }
    const vx = cursor.x - n.x
    const vy = cursor.y - n.y
    const d  = Math.hypot(vx, vy)
    if (d < 0.001) return { dx: 0, dy: 0 }
    return { dx: (vx / d) * pull, dy: (vy / d) * pull }
  }

  function isFilterVisible(n: SimNode): boolean {
    if (!filter) return true
    if (n.id === HUB_ID || n.id === filter) return true
    return adjacency.get(filter)?.has(n.id) ?? false
  }

  function nodeOpacity(n: SimNode): number {
    if (!isFilterVisible(n)) return 0.06
    // Memory nodes that aren't current get dimmed so they read as inactive.
    const dim =
      n.memoryStatus === 'paused' || n.memoryStatus === 'outdated' || n.memoryStatus === 'historical' ? 0.45
      : n.memoryStatus === 'needs_review' || n.memoryStatus === 'needs_confirmation' ? 0.7
      : 1
    if (!focusId) return dim
    if (n.id === focusId) return 1
    if (neighbors?.has(n.id)) return 0.95 * dim
    const pf = proximityFactor(n)
    if (pf > 0.15) return (0.4 + pf * 0.4) * dim
    return 0.18 * dim
  }

  function edgeOpacity(e: SimLink): number {
    const s = (e.source as SimNode).id
    const t = (e.target as SimNode).id
    const base = baseEdgeOpacity(e.type)
    if (filter) {
      const fNeighbors = adjacency.get(filter)
      const inFilter = s === filter || t === filter || s === HUB_ID || t === HUB_ID
        || fNeighbors?.has(s) || fNeighbors?.has(t)
      if (!inFilter) return 0.02
    }
    if (!focusId) return base
    if (s === focusId || t === focusId) return Math.min(0.95, base * 2.4)
    return 0.05
  }

  // ── Coord helpers ─────────────────────────────────────────────────────────
  function screenToSvg(e: { clientX: number; clientY: number }): { x: number; y: number } {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const rect = svg.getBoundingClientRect()
    const sx = ((e.clientX - rect.left) / rect.width) * size.w
    const sy = ((e.clientY - rect.top) / rect.height) * size.h
    return { x: (sx - view.tx) / view.k, y: (sy - view.ty) / view.k }
  }

  // ── Pointer handlers ──────────────────────────────────────────────────────
  function onBgPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    const tag = (e.target as Element).tagName
    if (tag !== 'svg' && tag !== 'rect') return
    panRef.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty }
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const p = screenToSvg(e)
    setCursor(p)
    setCursorScreen({ x: e.clientX, y: e.clientY })

    if (dragNodeRef.current) {
      const n = dragNodeRef.current
      n.fx = p.x
      n.fy = p.y
      simRef.current?.alphaTarget(0.25).restart()
      return
    }
    if (panRef.current) {
      const dx = e.clientX - panRef.current.x
      const dy = e.clientY - panRef.current.y
      const svg = svgRef.current
      const scale = svg ? size.w / svg.getBoundingClientRect().width : 1
      setView({ tx: panRef.current.tx + dx * scale, ty: panRef.current.ty + dy * scale, k: view.k })
    }
  }

  function onPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    if (dragNodeRef.current) {
      dragNodeRef.current.fx = null
      dragNodeRef.current.fy = null
      dragNodeRef.current = null
      simRef.current?.alphaTarget(0)
    }
    panRef.current = null
    try { (e.currentTarget as Element).releasePointerCapture(e.pointerId) } catch { /* noop */ }
  }

  function onPointerLeave() {
    setCursor(null)
    setCursorScreen(null)
  }

  function onWheel(e: React.WheelEvent<SVGSVGElement>) {
    e.preventDefault()
    const delta = -e.deltaY * 0.0015
    const k = Math.max(0.4, Math.min(3, view.k * (1 + delta)))
    const svg = svgRef.current
    if (!svg) { setView({ ...view, k }); return }
    const rect = svg.getBoundingClientRect()
    const sx = ((e.clientX - rect.left) / rect.width) * size.w
    const sy = ((e.clientY - rect.top) / rect.height) * size.h
    const tx = sx - ((sx - view.tx) * k) / view.k
    const ty = sy - ((sy - view.ty) * k) / view.k
    setView({ tx, ty, k })
  }

  function onNodePointerDown(e: React.PointerEvent<SVGGElement>, n: SimNode) {
    e.stopPropagation()
    dragNodeRef.current = n
    const p = screenToSvg(e)
    n.fx = p.x
    n.fy = p.y
    simRef.current?.alphaTarget(0.3).restart()
    ;(svgRef.current as Element | null)?.setPointerCapture(e.pointerId)
  }

  function onNodeClick(_e: React.MouseEvent, n: SimNode) {
    if (dragNodeRef.current) return
    setSelected((prev) => (prev === n.id ? null : n.id))
  }

  function resetView() {
    setView({ tx: 0, ty: 0, k: 1 })
    setReheatTick((t) => t + 1)
    setSelected(null)
    setHovered(null)
  }

  // ── Derived: preview + selected ──────────────────────────────────────────
  const previewId = selected ? null : focusId
  const previewNode = previewId ? nodes.find((n) => n.id === previewId) ?? null : null
  const selectedNode = selected ? nodes.find((n) => n.id === selected) ?? null : null
  const connectedNodes = selectedNode
    ? Array.from(adjacency.get(selectedNode.id) ?? [])
        .map((id) => nodes.find((n) => n.id === id))
        .filter((n): n is SimNode => !!n)
    : []

  // Connection count for preview
  const previewConnCount = previewNode ? adjacency.get(previewNode.id)?.size ?? 0 : 0

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-[#050509]">
      {/* Radial vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(34,211,238,0.045) 0%, rgba(236,72,153,0.018) 35%, rgba(0,0,0,0) 70%)',
        }}
      />

      {/* SVG canvas — fills container */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${size.w} ${size.h}`}
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 w-full h-full block touch-none select-none"
        style={{ cursor: panRef.current ? 'grabbing' : 'grab' }}
        onPointerDown={onBgPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerLeave}
        onWheel={onWheel}
        onClick={(e) => { if (e.target === e.currentTarget) setSelected(null) }}
      >
        <rect x={0} y={0} width={size.w} height={size.h} fill="transparent" />

        <g transform={`translate(${view.tx},${view.ty}) scale(${view.k})`}>
          {/* Edges */}
          {edges.map((e, i) => {
            const s = e.source as SimNode
            const t = e.target as SimNode
            if (s.x == null || t.x == null || s.y == null || t.y == null) return null
            const sColor = NODE_COLORS[s.type] ?? '#666'
            const op = edgeOpacity(e)
            const isFocusEdge = !!focusId && (s.id === focusId || t.id === focusId)
            const sw = e.type === 'core' ? 1.3 : isFocusEdge ? 1.2 : 0.7
            return (
              <line
                key={i}
                x1={s.x}
                y1={s.y}
                x2={t.x}
                y2={t.y}
                stroke={sColor}
                strokeOpacity={op}
                strokeWidth={sw}
                className={isFocusEdge ? 'brain-edge-flow' : undefined}
                style={{ transition: 'stroke-opacity 220ms ease, stroke-width 220ms ease' }}
              />
            )
          })}

          {/* Nodes */}
          {nodes.map((n) => {
            if (n.x == null || n.y == null) return null
            const baseR     = baseNodeRadius(n)
            const color     = NODE_COLORS[n.type] ?? '#666'
            const isHub     = n.id === HUB_ID
            const isDomain  = DOMAIN_IDS.has(n.id)
            const isFocus   = n.id === focusId
            const isSelect  = n.id === selected
            const isPrimary = proximityNode?.id === n.id
            const isNeigh   = !!focusId && !isFocus && (neighbors?.has(n.id) ?? false)
            const pf        = proximityFactor(n)
            const neighborLift = isNeigh ? primaryPf * 1.6 : 0
            const focusLift    = isFocus && !isHub && !isDomain ? 1.5 : 0
            const r         = baseR + pf * 3.5 + neighborLift + focusLift
            const op        = nodeOpacity(n)
            const showLabel = isHub || isDomain || isFocus || isSelect || pf > 0.55
            const offset    = magneticOffset(n, pf)
            const wantsLiftShadow = isPrimary && pf > 0.3 && !isHub
            const circleTransition =
              'r 180ms ease-out, stroke-width 200ms ease-out, fill-opacity 200ms ease-out, stroke-opacity 200ms ease-out'

            return (
              <g
                key={n.id}
                transform={`translate(${n.x},${n.y})`}
                style={{
                  cursor: dragNodeRef.current?.id === n.id ? 'grabbing' : 'pointer',
                  opacity: op,
                  transition: 'opacity 220ms ease',
                }}
                onPointerDown={(e) => onNodePointerDown(e, n)}
                onClick={(e) => onNodeClick(e, n)}
                onPointerEnter={() => setHovered(n.id)}
                onPointerLeave={() => setHovered((prev) => (prev === n.id ? null : prev))}
              >
                {/* Inner group carries magnetic offset + depth-lift drop-shadow */}
                <g
                  style={{
                    transform: `translate(${offset.dx}px, ${offset.dy}px)`,
                    transition: 'transform 160ms cubic-bezier(.2,.7,.3,1), filter 200ms ease',
                    filter: wantsLiftShadow ? `drop-shadow(0 0 ${10 + pf * 6}px ${color}cc)` : undefined,
                    willChange: pf > 0.1 ? 'transform' : undefined,
                  }}
                >
                  {/* Outer glow on focus or strong proximity */}
                  {(isFocus || pf > 0.4) && (
                    <circle
                      r={r + 9 + pf * 4}
                      fill={color}
                      fillOpacity={0.12 + pf * 0.16}
                      style={{ transition: 'r 200ms ease-out, fill-opacity 200ms ease-out' }}
                    />
                  )}
                  {/* Hub breathing ring */}
                  {isHub && (
                    <circle
                      r={baseR + 7}
                      fill="none"
                      stroke={color}
                      strokeOpacity={0.35}
                      strokeWidth={1}
                      className="brain-pulse"
                    />
                  )}
                  {/* Domain subtle ring */}
                  {isDomain && !isFocus && (
                    <circle r={baseR + 3} fill={color} fillOpacity={0.08 + pf * 0.1} />
                  )}
                  {/* Main body — animates radius / stroke / fill on proximity */}
                  <circle
                    r={r}
                    fill={color}
                    fillOpacity={isHub ? 0.35 : isDomain ? 0.28 : 0.22 + pf * 0.12}
                    stroke={color}
                    strokeOpacity={isSelect ? 1 : isFocus ? 0.95 : isHub ? 0.8 : 0.55 + pf * 0.35}
                    strokeWidth={isSelect ? 2.2 : isHub ? 1.4 : 1 + pf * 0.9 + (isNeigh ? 0.4 : 0)}
                    style={{ transition: circleTransition }}
                  />
                  {isHub && <circle r={4} fill="white" fillOpacity={0.85} />}
                  {showLabel && (
                    <text
                      y={r + 12}
                      textAnchor="middle"
                      fill={isHub ? 'white' : color}
                      fillOpacity={isFocus ? 1 : isHub ? 0.95 : 0.85}
                      fontSize={isHub ? 11 : isDomain ? 10 : 9}
                      fontFamily="'Geist Mono', monospace"
                      style={{
                        pointerEvents: 'none',
                        userSelect: 'none',
                        transition: 'fill-opacity 200ms ease',
                      }}
                    >
                      {n.label.length > 22 ? n.label.slice(0, 22) + '…' : n.label}
                    </text>
                  )}
                </g>
              </g>
            )
          })}
        </g>
      </svg>

      {/* ── Top-left: title chip ──────────────────────────────────────────── */}
      <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/[0.06] pointer-events-none">
        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.7)] animate-pulse" />
        <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-300">
          Neural Link
        </span>
        <span className="text-zinc-700 text-[10px]">·</span>
        <span className="text-[9px] font-mono text-zinc-500">
          {nodes.length}n · {edges.length}l
        </span>
      </div>

      {/* ── Top-right: floating filter chips + reset ─────────────────────── */}
      <div className="absolute top-4 right-4 flex flex-col items-end gap-2 max-w-[260px]">
        <button
          onClick={resetView}
          className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-[0.14em] px-2.5 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/[0.06] text-zinc-300 hover:text-white hover:bg-black/60 transition-colors"
          title="Reset view & reheat simulation"
        >
          <Maximize2 size={10} />
          Reset
        </button>
        <div className="flex flex-wrap items-center justify-end gap-1 px-1.5 py-1.5 rounded-2xl bg-black/30 backdrop-blur-md border border-white/[0.05]">
          {Array.from(DOMAIN_IDS).map((d) => {
            const node = nodes.find((n) => n.id === d)
            if (!node) return null
            const color = NODE_COLORS[node.type] ?? '#666'
            const active = filter === d
            return (
              <button
                key={d}
                onClick={() => setFilter(active ? null : d)}
                className={`text-[9px] font-mono uppercase tracking-[0.1em] px-2 py-0.5 rounded-full border transition-colors ${
                  active
                    ? 'bg-white/10 text-white'
                    : 'border-transparent text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04]'
                }`}
                style={{ borderColor: active ? color : undefined, color: active ? color : undefined }}
              >
                {node.label}
              </button>
            )
          })}
          {filter && (
            <button
              onClick={() => setFilter(null)}
              className="text-[9px] font-mono uppercase tracking-[0.1em] px-2 py-0.5 rounded-full text-zinc-600 hover:text-zinc-300"
            >
              clear
            </button>
          )}
        </div>
      </div>

      {/* ── Hover preview tooltip (follows cursor) ───────────────────────── */}
      {previewNode && cursorScreen && !panRef.current && !dragNodeRef.current && (
        <div
          className="fixed z-30 pointer-events-none animate-in fade-in duration-150"
          style={{
            left: cursorScreen.x + 14,
            top:  cursorScreen.y + 14,
            maxWidth: 260,
          }}
        >
          <div className="rounded-xl bg-black/75 backdrop-blur-md border border-white/[0.08] px-3 py-2.5 shadow-2xl">
            <div className="flex items-center gap-1.5 mb-1">
              <div
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: NODE_COLORS[previewNode.type] }}
              />
              <span
                className="text-[8px] font-mono uppercase tracking-[0.16em]"
                style={{ color: NODE_COLORS[previewNode.type] }}
              >
                {previewNode.type}
              </span>
              {previewNode.date && (
                <span className="text-[8px] font-mono text-zinc-600">· {previewNode.date}</span>
              )}
            </div>
            <div className="text-[12px] font-semibold text-white leading-snug mb-0.5">
              {previewNode.label}
            </div>
            {previewNode.summary && (
              <p className="text-[10px] text-zinc-400 leading-snug line-clamp-2">
                {previewNode.summary}
              </p>
            )}
            <div className="flex items-center gap-3 mt-1.5 text-[9px] font-mono text-zinc-600">
              <span>
                <span className="text-zinc-300">{previewConnCount}</span> connections
              </span>
              {previewNode.source && <span>· {previewNode.source}</span>}
              {previewNode.memoryStatus && (
                <span className={
                  previewNode.memoryStatus === 'current' ? 'text-emerald-500'
                  : previewNode.memoryStatus === 'historical' || previewNode.memoryStatus === 'paused' ? 'text-zinc-600'
                  : previewNode.memoryStatus === 'outdated' ? 'text-red-400/70'
                  : 'text-amber-500'
                }>
                  · {previewNode.memoryStatus.replace(/_/g, ' ')}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Floating side panel (overlays graph, doesn't shrink it) ──────── */}
      {selectedNode && (
        <aside
          key={selectedNode.id}
          className="absolute top-16 right-4 bottom-4 w-[300px] max-w-[calc(100vw-2rem)] lg:bottom-auto lg:max-h-[calc(100%-5rem)] rounded-2xl bg-black/65 backdrop-blur-xl border border-white/[0.08] shadow-2xl overflow-hidden flex flex-col animate-in fade-in slide-in-from-right-2 duration-200"
        >
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/[0.05]">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: NODE_COLORS[selectedNode.type] }}
              />
              <span
                className="text-[8px] font-mono uppercase tracking-[0.16em]"
                style={{ color: NODE_COLORS[selectedNode.type] }}
              >
                {selectedNode.type}
              </span>
              {selectedNode.source && (
                <span className="text-[8px] font-mono text-zinc-700">· {selectedNode.source}</span>
              )}
            </div>
            <button
              onClick={() => setSelected(null)}
              className="text-zinc-500 hover:text-white transition-colors flex-shrink-0"
            >
              <X size={13} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            <div className="text-[14px] font-semibold text-white leading-snug">
              {selectedNode.label}
            </div>

            {selectedNode.summary && (
              <p className="text-[11px] text-zinc-400 leading-relaxed">{selectedNode.summary}</p>
            )}

            {selectedNode.date && (
              <p className="text-[9px] font-mono text-zinc-600">{selectedNode.date}</p>
            )}

            {/* Memory node metadata */}
            {selectedNode.type === 'memory' && (
              <div className="pt-2 border-t border-white/[0.05] space-y-1.5">
                <p className="text-[8px] font-mono uppercase tracking-[0.16em] text-zinc-700 mb-2">
                  Memory Record
                </p>
                {selectedNode.memoryCategory && (
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono text-zinc-600">Category</span>
                    <span className="text-[9px] font-mono text-indigo-300 bg-indigo-400/10 px-1.5 py-0.5 rounded">
                      {selectedNode.memoryCategory.replace(/_/g, ' ')}
                    </span>
                  </div>
                )}
                {selectedNode.memoryStatus && (
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono text-zinc-600">Status</span>
                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                      selectedNode.memoryStatus === 'current'
                        ? 'text-emerald-400 bg-emerald-400/10'
                        : selectedNode.memoryStatus === 'historical' || selectedNode.memoryStatus === 'paused'
                        ? 'text-zinc-500 bg-white/[0.04]'
                        : selectedNode.memoryStatus === 'outdated'
                        ? 'text-red-400/80 bg-red-400/10'
                        : 'text-amber-400 bg-amber-400/10'
                    }`}>
                      {selectedNode.memoryStatus.replace(/_/g, ' ')}
                    </span>
                  </div>
                )}
                {selectedNode.memoryConfidence && (
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono text-zinc-600">Confidence</span>
                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                      selectedNode.memoryConfidence === 'high'
                        ? 'text-cyan-400 bg-cyan-400/10'
                        : selectedNode.memoryConfidence === 'medium'
                        ? 'text-amber-400 bg-amber-400/10'
                        : 'text-zinc-500 bg-white/[0.04]'
                    }`}>
                      {selectedNode.memoryConfidence}
                    </span>
                  </div>
                )}
                {selectedNode.memoryFilePath && (
                  <div className="pt-1">
                    <span className="text-[8px] font-mono text-zinc-700 break-all">
                      {selectedNode.memoryFilePath}
                    </span>
                  </div>
                )}
              </div>
            )}

            {connectedNodes.length > 0 && (
              <div className="pt-2 border-t border-white/[0.05] space-y-1.5">
                <p className="text-[8px] font-mono uppercase tracking-[0.16em] text-zinc-700">
                  Connections ({connectedNodes.length})
                </p>
                <ul className="space-y-0.5">
                  {connectedNodes.map((c) => (
                    <li key={c.id}>
                      <button
                        onClick={() => setSelected(c.id)}
                        onPointerEnter={() => setHovered(c.id)}
                        onPointerLeave={() => setHovered((prev) => (prev === c.id ? null : prev))}
                        className="flex items-center gap-2 w-full text-left text-[10px] font-mono text-zinc-500 hover:text-white hover:bg-white/[0.04] rounded px-1.5 py-1 transition-colors"
                      >
                        <div
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: NODE_COLORS[c.type] }}
                        />
                        <span className="truncate">{c.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* ── Bottom-left: minimal legend (only when no panel open) ────────── */}
      {!selectedNode && (
        <div className="absolute bottom-4 left-4 px-3 py-2 rounded-xl bg-black/30 backdrop-blur-md border border-white/[0.05] pointer-events-none hidden md:block">
          <div className="grid grid-cols-3 gap-x-3 gap-y-1">
            {LEGEND.map(({ type, label }) => (
              <div key={type} className="flex items-center gap-1.5">
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: NODE_COLORS[type as keyof typeof NODE_COLORS] }}
                />
                <span className="text-[9px] font-mono text-zinc-500">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
