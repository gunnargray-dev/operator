/**
 * CanvasPage - SVG node graph visualization of session topology
 *
 * Shows the selected session as a center agent node connected to its
 * MCP sources and tools via solid lines. Supports zoom (scroll) and
 * pan (click-drag). Activity feed sidebar on the right drives session selection.
 */

import * as React from 'react'
import { useMemo, useEffect, useRef, useCallback, useState } from 'react'
import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai'
import { motion } from 'motion/react'
import { formatDistanceToNow } from 'date-fns'
import {
  Wrench,
  AlertCircle,
  Bot,
  Globe,
  FileText,
  Terminal,
  Monitor,
  Database,
  Sparkles,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PanelHeader } from '@/components/app-shell/PanelHeader'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SourceAvatar } from '@/components/ui/source-avatar'
import {
  sessionMetaMapAtom,
  sessionIdsAtom,
  sessionAtomFamily,
  ensureSessionMessagesLoadedAtom,
} from '@/atoms/sessions'
import {
  activityFeedAtom,
  selectedCanvasSessionIdAtom,
  type ActivityFeedEvent,
} from '@/atoms/activity-feed'
import { sourcesAtom } from '@/atoms/sources'
import type { SessionMeta } from '@/atoms/sessions'
import type { LoadedSource } from '../../shared/types'

// =============================================================================
// Graph Types & Constants
// =============================================================================

/** World-space center */
const WCX = 1000
const WCY = 700

/** Agent (center) node */
const AGENT_W = 260
const AGENT_H = 180

/** Tool/source node */
const NODE_W = 200
const NODE_H = 96

/** Detail (leaf) node */
const DETAIL_W = 220
const DETAIL_H = 42

/** Model node (positioned above agent) */
const MODEL_W = 180
const MODEL_H = 72
const MODEL_OFFSET_Y = -280

const BASE_ORBIT = 480
const DETAIL_OFFSET = 180

/** Initial viewBox */
const INIT_VB = { x: -200, y: -100, w: 2400, h: 1600 }

interface NodePosition {
  x: number
  y: number
  angle: number
}

interface NodeDetail {
  text: string
  timestamp?: number
}

interface GraphNode {
  id: string
  label: string
  type: 'source' | 'tool'
  source?: LoadedSource
  isActive: boolean
  details: NodeDetail[]
  callCount: number
}

interface ViewBox {
  x: number
  y: number
  w: number
  h: number
}

// =============================================================================
// Helpers
// =============================================================================

function computeNodePositions(count: number, orbit: number): NodePosition[] {
  if (count === 0) return []
  const startAngle = -Math.PI / 2
  const step = (2 * Math.PI) / count
  return Array.from({ length: count }, (_, i) => {
    const angle = startAngle + i * step
    return {
      x: WCX + orbit * Math.cos(angle),
      y: WCY + orbit * Math.sin(angle),
      angle,
    }
  })
}

/** Find the point where a line from rect center to target exits the rect edge */
function getRectEdgePoint(
  cx: number,
  cy: number,
  w: number,
  h: number,
  tx: number,
  ty: number,
): { x: number; y: number } {
  const dx = tx - cx
  const dy = ty - cy
  const hw = w / 2
  const hh = h / 2

  if (dx === 0 && dy === 0) return { x: cx + hw, y: cy }

  const absDx = Math.abs(dx)
  const absDy = Math.abs(dy)

  let scale: number
  if (absDx * hh > absDy * hw) {
    scale = hw / absDx
  } else {
    scale = hh / absDy
  }

  return {
    x: cx + dx * scale,
    y: cy + dy * scale,
  }
}

function formatToolName(toolName: string): string {
  return toolName
    .replace(/^mcp__[^_]+__/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function getToolIconElement(toolName: string, size = 'h-5 w-5') {
  const lower = toolName.toLowerCase()
  if (lower.includes('search') || lower.includes('web'))
    return <Globe className={`${size} text-info`} />
  if (
    lower.includes('file') ||
    lower.includes('read') ||
    lower.includes('write')
  )
    return <FileText className={`${size} text-foreground/60`} />
  if (
    lower.includes('code') ||
    lower.includes('exec') ||
    lower.includes('bash')
  )
    return <Terminal className={`${size} text-success`} />
  if (lower.includes('browser') || lower.includes('screenshot'))
    return <Monitor className={`${size} text-info`} />
  if (
    lower.includes('database') ||
    lower.includes('sql') ||
    lower.includes('db')
  )
    return <Database className={`${size} text-info`} />
  return <Wrench className={`${size} text-foreground/50`} />
}

function formatModelName(model: string | undefined | null): string {
  if (!model) return 'Default Model'
  if (model.includes('opus')) return 'Opus 4.5'
  if (model.includes('sonnet')) return 'Sonnet 4.5'
  if (model.includes('haiku')) return 'Haiku 4.5'
  // Strip date suffix and clean up
  return model.replace(/-\d{8}$/, '').replace(/-/g, ' ')
}

// =============================================================================
// ModelNode — shows the LLM model, positioned above agent
// =============================================================================

function ModelNode({
  model,
  isProcessing,
}: {
  model: string | undefined | null
  isProcessing?: boolean
}) {
  const label = formatModelName(model)
  const cx = WCX
  const cy = WCY + MODEL_OFFSET_Y
  const rx = cx - MODEL_W / 2
  const ry = cy - MODEL_H / 2

  return (
    <motion.g
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 180, damping: 20, delay: 0.06 }}
    >
      <rect
        x={rx}
        y={ry}
        width={MODEL_W}
        height={MODEL_H}
        rx={12}
        className={cn(
          isProcessing
            ? 'fill-info/6 stroke-info/30'
            : 'fill-background stroke-foreground/12',
        )}
        strokeWidth={1.5}
      />
      <foreignObject x={rx} y={ry} width={MODEL_W} height={MODEL_H}>
        <div className="flex items-center gap-3 h-full px-3.5">
          <div className="shrink-0 h-9 w-9 rounded-lg bg-info/10 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-info" />
          </div>
          <div className="flex flex-col min-w-0 flex-1 gap-0.5">
            <span className="text-[13px] font-medium text-foreground truncate leading-tight">
              {label}
            </span>
            <span className="text-[10px] text-foreground/40 leading-tight">
              Model
            </span>
          </div>
        </div>
      </foreignObject>
    </motion.g>
  )
}

// =============================================================================
// ConnectionLine — edge-to-edge with per-line shimmer gradient
// =============================================================================

/** Unique counter for gradient IDs */
let lineIdCounter = 0

function ConnectionLine({
  fromCenter,
  fromSize,
  toCenter,
  toSize,
  isActive,
  isDetail,
  shimmerT,
}: {
  fromCenter: { x: number; y: number }
  fromSize: { w: number; h: number }
  toCenter: { x: number; y: number }
  toSize: { w: number; h: number }
  isActive: boolean
  isDetail?: boolean
  /** Shimmer progress 0→1 (driven by parent rAF loop) */
  shimmerT?: number
}) {
  const idRef = useRef(`cl-${++lineIdCounter}`)
  const gradId = idRef.current

  const fromEdge = getRectEdgePoint(
    fromCenter.x, fromCenter.y, fromSize.w, fromSize.h, toCenter.x, toCenter.y,
  )
  const toEdge = getRectEdgePoint(
    toCenter.x, toCenter.y, toSize.w, toSize.h, fromCenter.x, fromCenter.y,
  )

  const dotR = isDetail ? 3 : 5
  const d = `M ${fromEdge.x} ${fromEdge.y} L ${toEdge.x} ${toEdge.y}`

  // Compute shimmer gradient endpoints along the line direction
  // The bright band occupies ~20% of the line and sweeps from before → after
  const t = shimmerT ?? 0
  const lx = toEdge.x - fromEdge.x
  const ly = toEdge.y - fromEdge.y
  // Extend range so the band fully enters/exits: -0.3 to 1.3
  const st = -0.3 + t * 1.6
  const bandW = 0.2

  return (
    <g>
      {/* Per-line shimmer gradient (only when active) */}
      {isActive && !isDetail && (
        <defs>
          <linearGradient
            id={gradId}
            gradientUnits="userSpaceOnUse"
            x1={String(fromEdge.x)}
            y1={String(fromEdge.y)}
            x2={String(toEdge.x)}
            y2={String(toEdge.y)}
          >
            <stop offset={Math.max(0, st)} stopColor="white" stopOpacity="0" />
            <stop offset={Math.max(0, Math.min(1, st + bandW * 0.3))} stopColor="white" stopOpacity="0.5" />
            <stop offset={Math.max(0, Math.min(1, st + bandW * 0.5))} stopColor="white" stopOpacity="0.9" />
            <stop offset={Math.max(0, Math.min(1, st + bandW * 0.7))} stopColor="white" stopOpacity="0.5" />
            <stop offset={Math.min(1, st + bandW)} stopColor="white" stopOpacity="0" />
          </linearGradient>
        </defs>
      )}

      {/* Base line — always visible */}
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        className={
          isDetail
            ? 'text-foreground/10'
            : isActive
              ? 'text-accent/40'
              : 'text-foreground/15'
        }
        strokeWidth={isDetail ? 1.5 : 2.5}
        strokeDasharray={isActive ? undefined : '8 6'}
        strokeLinecap="round"
      />

      {/* Shimmer overlay — gradient follows line direction */}
      {isActive && !isDetail && (
        <path
          d={d}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={4}
          strokeLinecap="round"
          filter="url(#line-glow)"
        />
      )}

      {/* Endpoint dots */}
      {!isDetail && (
        <>
          <circle
            cx={fromEdge.x}
            cy={fromEdge.y}
            r={dotR}
            className={isActive ? 'fill-accent' : 'fill-foreground/20'}
          />
          <circle
            cx={toEdge.x}
            cy={toEdge.y}
            r={dotR}
            className={isActive ? 'fill-accent' : 'fill-foreground/20'}
          />
        </>
      )}
    </g>
  )
}

// =============================================================================
// AgentNode — large center node with double border
// =============================================================================

function AgentNode({
  session,
  isProcessing,
}: {
  session: SessionMeta | undefined
  isProcessing?: boolean
}) {
  const title = session?.name || session?.preview || 'Agent'
  const rx = WCX - AGENT_W / 2
  const ry = WCY - AGENT_H / 2
  const pad = 8

  return (
    <motion.g
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 180, damping: 20 }}
    >
      {/* Outer border */}
      <rect
        x={rx - pad}
        y={ry - pad}
        width={AGENT_W + pad * 2}
        height={AGENT_H + pad * 2}
        rx={16}
        fill="none"
        stroke="currentColor"
        className={isProcessing ? 'text-accent/50' : 'text-accent/25'}
        strokeWidth={2}
      />

      {/* Status dot top-right of outer border */}
      {isProcessing && (
        <circle
          cx={rx + AGENT_W + pad - 4}
          cy={ry - pad + 4}
          r={5}
          className="fill-success"
        >
          <animate
            attributeName="opacity"
            values="1;0.4;1"
            dur="2s"
            repeatCount="indefinite"
          />
        </circle>
      )}

      {/* Inner rect */}
      <rect
        x={rx}
        y={ry}
        width={AGENT_W}
        height={AGENT_H}
        rx={12}
        className="fill-accent/8 stroke-accent/20"
        strokeWidth={1.5}
      />

      {/* Content */}
      <foreignObject x={rx} y={ry} width={AGENT_W} height={AGENT_H}>
        <div className="flex flex-col items-center justify-center h-full gap-2 px-4">
          <div className="h-10 w-10 rounded-lg bg-accent/15 flex items-center justify-center">
            <Bot className="h-6 w-6 text-accent" />
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[14px] font-semibold text-foreground text-center leading-tight line-clamp-2">
              {title}
            </span>
            <span className="text-[11px] text-foreground/40">
              {isProcessing ? 'active' : 'idle'}
            </span>
          </div>
        </div>
      </foreignObject>
    </motion.g>
  )
}

// =============================================================================
// ToolNode — larger node with icon, name, call count, status dot
// =============================================================================

function ToolNode({
  node,
  position,
  index,
}: {
  node: GraphNode
  position: NodePosition
  index: number
}) {
  const rx = position.x - NODE_W / 2
  const ry = position.y - NODE_H / 2

  return (
    <motion.g
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{
        type: 'spring',
        stiffness: 180,
        damping: 20,
        delay: 0.04 * index,
      }}
    >
      {/* Node rect */}
      <rect
        x={rx}
        y={ry}
        width={NODE_W}
        height={NODE_H}
        rx={12}
        className={cn(
          node.isActive
            ? 'fill-accent/6 stroke-accent/40'
            : 'fill-background stroke-foreground/12',
        )}
        strokeWidth={1.5}
      />

      {/* Content */}
      <foreignObject x={rx} y={ry} width={NODE_W} height={NODE_H}>
        <div className="flex items-center gap-3 h-full px-3.5">
          <div className="shrink-0 h-10 w-10 rounded-lg bg-foreground/5 flex items-center justify-center">
            {node.source ? (
              <SourceAvatar source={node.source} size="xs" />
            ) : (
              getToolIconElement(node.id, 'h-5 w-5')
            )}
          </div>
          <div className="flex flex-col min-w-0 flex-1 gap-0.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-medium text-foreground truncate leading-tight">
                {node.label}
              </span>
              <span
                className={cn(
                  'h-2 w-2 rounded-full shrink-0',
                  node.isActive ? 'bg-success' : 'bg-foreground/20',
                )}
              />
            </div>
            <span className="text-[11px] text-foreground/40 leading-tight">
              {node.isActive
                ? 'Running...'
                : node.callCount > 0
                  ? `${node.callCount} call${node.callCount !== 1 ? 's' : ''}`
                  : node.type === 'source'
                    ? '0 calls'
                    : 'Tool'}
            </span>
          </div>
        </div>
      </foreignObject>
    </motion.g>
  )
}

// =============================================================================
// DetailNode — leaf node showing tool detail text
// =============================================================================

function DetailNode({
  detail,
  position,
  index,
}: {
  detail: NodeDetail
  position: { x: number; y: number }
  index: number
}) {
  const rx = position.x - DETAIL_W / 2
  const ry = position.y - DETAIL_H / 2

  return (
    <motion.g
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{
        type: 'spring',
        stiffness: 160,
        damping: 22,
        delay: 0.08 * index + 0.2,
      }}
    >
      <rect
        x={rx}
        y={ry}
        width={DETAIL_W}
        height={DETAIL_H}
        rx={8}
        className="fill-foreground/[0.03] stroke-foreground/8"
        strokeWidth={1}
      />
      <foreignObject x={rx} y={ry} width={DETAIL_W} height={DETAIL_H}>
        <div className="flex items-center h-full px-3">
          <span className="text-[11px] text-foreground/45 truncate leading-tight">
            {detail.text}
          </span>
        </div>
      </foreignObject>
    </motion.g>
  )
}

// =============================================================================
// NodeGraph — SVG canvas with zoom/pan
// =============================================================================

function NodeGraph({
  session,
  nodes,
  model,
}: {
  session: SessionMeta | undefined
  nodes: GraphNode[]
  model?: string | null
}) {
  const orbit = nodes.length > 8 ? 560 : BASE_ORBIT
  const positions = useMemo(
    () => computeNodePositions(nodes.length, orbit),
    [nodes.length, orbit],
  )

  // Zoom/pan state
  const svgRef = useRef<SVGSVGElement>(null)
  const [vb, setVb] = useState<ViewBox>(INIT_VB)
  const isPanning = useRef(false)
  const lastMouse = useRef({ x: 0, y: 0 })

  // Shimmer progress 0→1, driven by rAF for smooth animation
  const [shimmerT, setShimmerT] = useState(0)
  const shimmerStart = useRef(0)
  useEffect(() => {
    let frame: number
    const dur = 2000 // ms per sweep
    const tick = (now: number) => {
      if (!shimmerStart.current) shimmerStart.current = now
      const elapsed = (now - shimmerStart.current) % dur
      setShimmerT(elapsed / dur)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  // Reset view when session changes
  useEffect(() => {
    setVb(INIT_VB)
  }, [session?.id])

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    const svg = svgRef.current
    if (!svg) return

    const factor = e.deltaY > 0 ? 1.08 : 0.93
    const rect = svg.getBoundingClientRect()

    setVb((prev) => {
      // Mouse position in viewBox coordinates
      const mx = prev.x + ((e.clientX - rect.left) / rect.width) * prev.w
      const my = prev.y + ((e.clientY - rect.top) / rect.height) * prev.h

      const newW = Math.max(400, Math.min(8000, prev.w * factor))
      const newH = Math.max(280, Math.min(5600, prev.h * factor))

      return {
        x: mx - ((mx - prev.x) / prev.w) * newW,
        y: my - ((my - prev.y) / prev.h) * newH,
        w: newW,
        h: newH,
      }
    })
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    isPanning.current = true
    lastMouse.current = { x: e.clientX, y: e.clientY }
    ;(e.currentTarget as SVGSVGElement).style.cursor = 'grabbing'
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return
    const svg = svgRef.current
    if (!svg) return

    const rect = svg.getBoundingClientRect()
    const dx = e.clientX - lastMouse.current.x
    const dy = e.clientY - lastMouse.current.y
    lastMouse.current = { x: e.clientX, y: e.clientY }

    setVb((prev) => ({
      ...prev,
      x: prev.x - (dx / rect.width) * prev.w,
      y: prev.y - (dy / rect.height) * prev.h,
    }))
  }, [])

  const handleMouseUp = useCallback(() => {
    isPanning.current = false
    if (svgRef.current) {
      svgRef.current.style.cursor = 'grab'
    }
  }, [])

  // Attach wheel listener with passive: false to prevent scroll
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    svg.addEventListener('wheel', handleWheel, { passive: false })
    return () => svg.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  if (!session) {
    return (
      <div className="flex items-center justify-center h-full text-foreground/30">
        <div className="flex flex-col items-center gap-2">
          <Bot className="h-8 w-8" />
          <p className="text-sm">Select a session from the sidebar</p>
        </div>
      </div>
    )
  }

  // Compute detail node positions
  const detailPositions = positions.map((pos) => {
    const angle = pos.angle
    return {
      x: pos.x + DETAIL_OFFSET * Math.cos(angle),
      y: pos.y + DETAIL_OFFSET * Math.sin(angle),
    }
  })

  const agentCenter = { x: WCX, y: WCY }
  const agentSize = { w: AGENT_W + 16, h: AGENT_H + 16 } // include outer border
  const nodeSize = { w: NODE_W, h: NODE_H }
  const detailSize = { w: DETAIL_W, h: DETAIL_H }
  const modelCenter = { x: WCX, y: WCY + MODEL_OFFSET_Y }
  const modelSize = { w: MODEL_W, h: MODEL_H }
  const isProcessing = session.isProcessing

  return (
    <div className="w-full h-full">
      <svg
        ref={svgRef}
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        className="w-full h-full"
        style={{ cursor: 'grab' }}
        preserveAspectRatio="xMidYMid meet"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <defs>
          {/* Dotted grid pattern */}
          <pattern id="dot-grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="20" cy="20" r="1.5" fill="currentColor" className="text-foreground/8" />
          </pattern>

          <filter id="line-glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grid background — covers a large area for pan */}
        <rect x="-5000" y="-5000" width="12000" height="12000" fill="url(#dot-grid)" />

        {/* Connection line: model -> agent */}
        <ConnectionLine
          fromCenter={modelCenter}
          fromSize={modelSize}
          toCenter={agentCenter}
          toSize={agentSize}
          isActive={!!isProcessing}
          shimmerT={shimmerT}
        />

        {/* Connection lines: center -> tool nodes */}
        {nodes.map((node, i) => (
          <ConnectionLine
            key={`line-${node.id}`}
            fromCenter={agentCenter}
            fromSize={agentSize}
            toCenter={positions[i]}
            toSize={nodeSize}
            isActive={node.isActive || node.callCount > 0}
            shimmerT={shimmerT}
          />
        ))}

        {/* Connection lines: tool node -> detail node */}
        {nodes.map((node, i) => {
          if (node.details.length === 0) return null
          return (
            <ConnectionLine
              key={`detail-line-${node.id}`}
              fromCenter={positions[i]}
              fromSize={nodeSize}
              toCenter={detailPositions[i]}
              toSize={detailSize}
              isActive={false}
              isDetail
            />
          )
        })}

        {/* Detail leaf nodes */}
        {nodes.map((node, i) => {
          if (node.details.length === 0) return null
          return (
            <DetailNode
              key={`detail-${node.id}`}
              detail={node.details[0]}
              position={detailPositions[i]}
              index={i}
            />
          )
        })}

        {/* Tool/source nodes */}
        {nodes.map((node, i) => (
          <ToolNode
            key={node.id}
            node={node}
            position={positions[i]}
            index={i}
          />
        ))}

        {/* Model node */}
        <ModelNode model={model} isProcessing={isProcessing} />

        {/* Center agent node (on top) */}
        <AgentNode session={session} isProcessing={isProcessing} />
      </svg>
    </div>
  )
}

// =============================================================================
// Session Card — unified card for the sidebar
// =============================================================================

function SessionCard({
  meta,
  isSelected,
  recentEvents,
  onClick,
}: {
  meta: SessionMeta
  isSelected: boolean
  recentEvents: ActivityFeedEvent[]
  onClick: () => void
}) {
  const title = meta.name || meta.preview || 'Untitled'
  const timeAgo = meta.lastMessageAt
    ? formatDistanceToNow(new Date(meta.lastMessageAt), { addSuffix: false })
    : null
  const errorCount = recentEvents.filter(
    (e) => e.type === 'error' || e.type === 'typed_error',
  ).length
  const lastEvent = recentEvents[0]

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-lg border p-3 transition-colors',
        isSelected
          ? 'border-accent/30 bg-accent/5'
          : 'border-foreground/8 bg-foreground/[0.02] hover:border-foreground/15 hover:bg-foreground/[0.04]',
      )}
    >
      {/* Status + source badges */}
      <div className="flex items-center gap-1.5 mb-2">
        {meta.isProcessing ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-success bg-success/10 rounded px-1.5 py-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            ACTIVE
          </span>
        ) : (
          <span className="text-[10px] font-medium text-foreground/40 bg-foreground/5 rounded px-1.5 py-0.5">
            COMPLETED
          </span>
        )}
      </div>

      {/* Session name */}
      <p className="text-[13px] font-medium text-foreground leading-snug line-clamp-2 mb-2">
        {title}
      </p>

      {/* Last activity line */}
      {lastEvent && (
        <p className="text-[11px] text-foreground/40 truncate mb-2">
          {lastEvent.summary}
          {lastEvent.toolDetail && (
            <span className="text-foreground/30 italic">
              {' — '}
              {lastEvent.toolDetail}
            </span>
          )}
        </p>
      )}

      {/* Footer: time + errors */}
      <div className="flex items-center gap-3 pt-1.5 border-t border-foreground/5">
        {timeAgo && (
          <span className="inline-flex items-center gap-1 text-[10px] text-foreground/35">
            <Clock className="h-3 w-3" />
            {timeAgo}
          </span>
        )}
        {errorCount > 0 && (
          <span className="inline-flex items-center gap-1 text-[10px] text-destructive">
            <AlertCircle className="h-3 w-3" />
            {errorCount} error{errorCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </button>
  )
}

// =============================================================================
// Canvas Page
// =============================================================================

export default function CanvasPage() {
  const sessionMetaMap = useAtomValue(sessionMetaMapAtom)
  const sessionIds = useAtomValue(sessionIdsAtom)
  const activityFeed = useAtomValue(activityFeedAtom)
  const allSources = useAtomValue(sourcesAtom)
  const [selectedSessionId, setSelectedSessionId] = useAtom(
    selectedCanvasSessionIdAtom,
  )

  const selectedSession = selectedSessionId
    ? sessionMetaMap.get(selectedSessionId)
    : undefined

  const fullSession = useAtomValue(
    useMemo(
      () =>
        selectedSessionId
          ? sessionAtomFamily(selectedSessionId)
          : atom(null),
      [selectedSessionId],
    ),
  )

  const activeSessions = useMemo(
    () => Array.from(sessionMetaMap.values()).filter((s) => s.isProcessing),
    [sessionMetaMap],
  )

  // Auto-select on mount: prefer an active session
  const hasAutoSelected = useRef(false)
  useEffect(() => {
    if (hasAutoSelected.current) return
    if (sessionIds.length === 0) return

    hasAutoSelected.current = true
    const activeId = Array.from(sessionMetaMap.values()).find(
      (s) => s.isProcessing,
    )?.id
    setSelectedSessionId(activeId || sessionIds[0])
  }, [sessionIds, sessionMetaMap, setSelectedSessionId])

  // Trigger lazy-loading of messages for the selected session
  const ensureMessagesLoaded = useSetAtom(ensureSessionMessagesLoadedAtom)
  useEffect(() => {
    if (selectedSessionId) {
      ensureMessagesLoaded(selectedSessionId)
    }
  }, [selectedSessionId, ensureMessagesLoaded])

  // Build unified graph nodes from MCP sources + discovered tools + details
  const graphNodes = useMemo((): GraphNode[] => {
    if (!selectedSessionId) return []

    const enabledSlugs = selectedSession?.enabledSourceSlugs || []
    const sourcesBySlug = new Map<string, LoadedSource>()
    for (const s of allSources) {
      if (enabledSlugs.includes(s.config.slug)) {
        sourcesBySlug.set(s.config.slug, s)
      }
    }

    const toolData = new Map<
      string,
      { active: boolean; count: number; details: NodeDetail[] }
    >()
    const completedToolIds = new Set<string>()

    for (const event of activityFeed) {
      if (event.sessionId !== selectedSessionId) continue
      if (!event.toolName) continue

      const name = event.toolName
      if (!toolData.has(name)) {
        toolData.set(name, { active: false, count: 0, details: [] })
      }
      const data = toolData.get(name)!

      if (event.type === 'tool_result') {
        completedToolIds.add(event.toolUseId || name)
        data.count++
      } else if (event.type === 'tool_start') {
        if (!completedToolIds.has(event.toolUseId || name)) {
          data.active = true
        }
        data.count++
        if (event.toolDetail) {
          if (!data.details.some((d) => d.text === event.toolDetail)) {
            data.details.unshift({
              text: event.toolDetail,
              timestamp: event.timestamp,
            })
            if (data.details.length > 3) data.details.length = 3
          }
        }
      }
    }

    if (fullSession?.messages) {
      for (const msg of fullSession.messages) {
        if (msg.toolName && !toolData.has(msg.toolName)) {
          toolData.set(msg.toolName, { active: false, count: 1, details: [] })
        }
      }
    }

    const nodes: GraphNode[] = []
    const addedIds = new Set<string>()

    for (const slug of enabledSlugs) {
      const source = sourcesBySlug.get(slug)
      if (source) {
        addedIds.add(slug)
        let isActive = false
        let count = 0
        const details: NodeDetail[] = []
        for (const [toolName, data] of toolData) {
          if (toolName.includes(slug)) {
            if (data.active) isActive = true
            count += data.count
            details.push(...data.details)
          }
        }
        nodes.push({
          id: slug,
          label: source.config.name,
          type: 'source',
          source,
          isActive,
          callCount: count,
          details: details.slice(0, 3),
        })
      }
    }

    for (const [toolName, data] of toolData) {
      const matchesSource = enabledSlugs.some((slug) =>
        toolName.includes(slug),
      )
      if (matchesSource) continue
      if (addedIds.has(toolName)) continue
      addedIds.add(toolName)

      nodes.push({
        id: toolName,
        label: formatToolName(toolName),
        type: 'tool',
        isActive: data.active,
        callCount: data.count,
        details: data.details.slice(0, 3),
      })
    }

    return nodes
  }, [
    selectedSessionId,
    selectedSession?.enabledSourceSlugs,
    allSources,
    activityFeed,
    fullSession?.messages,
  ])

  return (
    <div className="flex flex-col h-full">
      <PanelHeader
        title="Canvas"
        badge={
          activeSessions.length > 0 ? (
            <span className="text-[11px] text-foreground/50">
              {activeSessions.length} active
            </span>
          ) : undefined
        }
      />

      <div className="flex flex-1 min-h-0">
        {/* Left: SVG Node Graph */}
        <div className="flex-1 min-w-0 bg-background">
          <NodeGraph session={selectedSession} nodes={graphNodes} model={fullSession?.model} />
        </div>

        {/* Right: Unified activity sidebar */}
        <div className="w-[320px] shrink-0 flex flex-col border-l border-foreground/5 bg-background">
          {/* Header */}
          <div className="px-4 py-3 border-b border-foreground/5">
            <div className="flex items-center gap-2">
              {activeSessions.length > 0 && (
                <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
              )}
              <span className="text-[14px] font-semibold">Activity</span>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="px-3 py-3 flex flex-col gap-4">
              {sessionIds.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-foreground/30 gap-2">
                  <AlertCircle className="h-5 w-5" />
                  <span className="text-[12px]">No sessions yet</span>
                </div>
              ) : (
                <>
                  {/* Active Sessions */}
                  {activeSessions.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2 px-1">
                        <span className="text-[11px] text-foreground/40 uppercase tracking-wider font-medium">
                          Active Sessions
                        </span>
                        <span className="text-[11px] text-foreground/30 bg-foreground/5 rounded-full px-2 py-0.5">
                          {activeSessions.length}
                        </span>
                      </div>
                      <div className="flex flex-col gap-2">
                        {activeSessions.map((meta) => (
                          <SessionCard
                            key={meta.id}
                            meta={meta}
                            isSelected={selectedSessionId === meta.id}
                            recentEvents={activityFeed
                              .filter((e) => e.sessionId === meta.id)
                              .slice(0, 5)}
                            onClick={() => setSelectedSessionId(meta.id)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent Sessions */}
                  {(() => {
                    const recentSessions = sessionIds
                      .map((id) => sessionMetaMap.get(id))
                      .filter(
                        (m): m is SessionMeta => !!m && !m.isProcessing,
                      )
                      .slice(0, 20)
                    if (recentSessions.length === 0) return null
                    return (
                      <div>
                        <div className="flex items-center justify-between mb-2 px-1">
                          <span className="text-[11px] text-foreground/40 uppercase tracking-wider font-medium">
                            Recent
                          </span>
                          <span className="text-[11px] text-foreground/30 bg-foreground/5 rounded-full px-2 py-0.5">
                            {recentSessions.length}
                          </span>
                        </div>
                        <div className="flex flex-col gap-2">
                          {recentSessions.map((meta) => (
                            <SessionCard
                              key={meta.id}
                              meta={meta}
                              isSelected={selectedSessionId === meta.id}
                              recentEvents={activityFeed
                                .filter((e) => e.sessionId === meta.id)
                                .slice(0, 5)}
                              onClick={() => setSelectedSessionId(meta.id)}
                            />
                          ))}
                        </div>
                      </div>
                    )
                  })()}
                </>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}
