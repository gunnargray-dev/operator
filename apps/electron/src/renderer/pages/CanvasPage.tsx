/**
 * CanvasPage - Activity feed and Board views
 *
 * Two view modes toggled via header button:
 * - Activity: Chronological session cards showing recent and active sessions
 * - Board: Kanban-style grid organized by todo state
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
  LayoutGrid,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PanelHeader } from '@/components/app-shell/PanelHeader'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SourceAvatar } from '@/components/ui/source-avatar'
import { Button } from '@/components/ui/button'
import { BoardCard } from '@/components/board/BoardCard'
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
import { useAppShellContext } from '@/context/AppShellContext'
import { navigate, routes } from '@/lib/navigate'
import type { SessionMeta } from '@/atoms/sessions'
import type { LoadedSource } from '../../shared/types'

type ViewMode = 'canvas' | 'board'

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
const DETAIL_OFFSET = 260

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
  // Start from left side to avoid model node above agent
  const startAngle = Math.PI
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

function ConnectionLine({
  fromCenter,
  fromSize,
  toCenter,
  toSize,
  isActive,
  isDetail,
}: {
  fromCenter: { x: number; y: number }
  fromSize: { w: number; h: number }
  toCenter: { x: number; y: number }
  toSize: { w: number; h: number }
  isActive: boolean
  isDetail?: boolean
}) {
  // Add padding so lines stop before the rounded corners of nodes
  const pad = isDetail ? 8 : 14
  const fromEdge = getRectEdgePoint(
    fromCenter.x, fromCenter.y, fromSize.w + pad, fromSize.h + pad, toCenter.x, toCenter.y,
  )
  const toEdge = getRectEdgePoint(
    toCenter.x, toCenter.y, toSize.w + pad, toSize.h + pad, fromCenter.x, fromCenter.y,
  )

  const dotR = isDetail ? 3 : 5
  const d = `M ${fromEdge.x} ${fromEdge.y} L ${toEdge.x} ${toEdge.y}`


  return (
    <g>
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

      {/* Shimmer: wide soft glow */}
      {isActive && (
        <path
          className="shimmer-line"
          d={d}
          fill="none"
          stroke="white"
          strokeOpacity={isDetail ? 0.06 : 0.08}
          strokeWidth={isDetail ? 10 : 16}
          strokeLinecap="round"
          strokeDasharray="50 200"
          filter="url(#line-glow)"
        />
      )}
      {/* Shimmer: bright core */}
      {isActive && (
        <path
          className="shimmer-line"
          d={d}
          fill="none"
          stroke="white"
          strokeOpacity={isDetail ? 0.25 : 0.35}
          strokeWidth={isDetail ? 1.5 : 2}
          strokeLinecap="round"
          strokeDasharray="50 200"
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
        style={{ cursor: 'grab', touchAction: 'none' }}
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

        {/* CSS keyframes for shimmer dash animation */}
        <style>{`
          @keyframes shimmer-dash {
            from { stroke-dashoffset: 240; }
            to   { stroke-dashoffset: -240; }
          }
          .shimmer-line {
            animation: shimmer-dash 2s linear infinite;
          }
        `}</style>

        {/* Grid background — covers a large area for pan */}
        <rect x="-5000" y="-5000" width="12000" height="12000" fill="url(#dot-grid)" />

        {/* Connection line: model -> agent */}
        <ConnectionLine
          fromCenter={modelCenter}
          fromSize={modelSize}
          toCenter={agentCenter}
          toSize={agentSize}
          isActive={true}

        />

        {/* Connection lines: center -> tool nodes */}
        {nodes.map((node, i) => (
          <ConnectionLine
            key={`line-${node.id}`}
            fromCenter={agentCenter}
            fromSize={agentSize}
            toCenter={positions[i]}
            toSize={nodeSize}
            isActive={true}
  
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
              isActive={true}
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

      {/* Footer: time + tokens + errors */}
      <div className="flex items-center gap-3 pt-1.5 border-t border-foreground/5">
        {timeAgo && (
          <span className="inline-flex items-center gap-1 text-[10px] text-foreground/35">
            <Clock className="h-3 w-3" />
            {timeAgo}
          </span>
        )}
        {meta.tokenUsage && meta.tokenUsage.totalTokens > 0 && (
          <span className="text-[10px] text-foreground/35 font-mono">
            {meta.tokenUsage.totalTokens >= 1000
              ? `${(meta.tokenUsage.totalTokens / 1000).toFixed(1)}K`
              : meta.tokenUsage.totalTokens}
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
// Board View — Kanban columns by session status
// =============================================================================

// Fixed board columns based on session runtime status
const BOARD_COLUMNS = [
  { id: 'scheduled', label: 'Scheduled', color: '#6366f1' },
  { id: 'running', label: 'Running', color: '#22c55e' },
  { id: 'complete', label: 'Complete', color: '#64748b' },
] as const

type BoardColumnId = typeof BOARD_COLUMNS[number]['id']

function getSessionColumn(session: SessionMeta): BoardColumnId {
  // Running: actively processing (takes priority)
  if (session.isProcessing) {
    return 'running'
  }

  // Scheduled: has a schedule config (recurring task) OR no activity yet
  if (session.scheduleConfig || !session.lastMessageAt) {
    return 'scheduled'
  }

  // Complete: not processing, has activity, no schedule
  return 'complete'
}

function BoardView({
  sessionMetaMap,
  allSources,
}: {
  sessionMetaMap: Map<string, SessionMeta>
  allSources: LoadedSource[]
}) {
  const { activeWorkspaceId } = useAppShellContext()

  // Filter sessions by workspace
  const workspaceSessions = useMemo(() => {
    return Array.from(sessionMetaMap.values())
      .filter(s => s.workspaceId === activeWorkspaceId)
  }, [sessionMetaMap, activeWorkspaceId])

  // Group sessions by computed column
  const columnData = useMemo(() => {
    const groups = new Map<BoardColumnId, SessionMeta[]>()
    for (const col of BOARD_COLUMNS) {
      groups.set(col.id, [])
    }

    // Debug: log sessions with isProcessing=true
    const processingSessions = workspaceSessions.filter(s => s.isProcessing)
    if (processingSessions.length > 0) {
      console.log('[BoardView] Processing sessions:', processingSessions.map(s => ({ id: s.id, name: s.name, isProcessing: s.isProcessing })))
    }

    for (const session of workspaceSessions) {
      const columnId = getSessionColumn(session)
      groups.get(columnId)!.push(session)
    }

    // Sort each group by lastMessageAt descending
    for (const [, sessions] of groups) {
      sessions.sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0))
    }
    return groups
  }, [workspaceSessions])

  const handleCardClick = useCallback((sessionId: string) => {
    navigate(routes.view.allChats(sessionId))
  }, [])

  return (
    <div className="flex-1 min-h-0 flex gap-3 px-4 pb-4 pt-2 overflow-x-auto">
      {BOARD_COLUMNS.map(column => (
        <div
          key={column.id}
          className="flex-shrink-0 w-72 h-full flex flex-col bg-foreground/[0.02] rounded-lg border border-foreground/8"
        >
          {/* Column header */}
          <div className="flex-shrink-0 flex items-center justify-between px-3 py-2.5 border-b border-foreground/8">
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: column.color }}
              />
              <span className="text-sm font-medium text-foreground">
                {column.label}
              </span>
            </div>
            <span className="text-xs text-foreground/40 bg-foreground/5 rounded-full px-2 py-0.5">
              {columnData.get(column.id)?.length || 0}
            </span>
          </div>

          {/* Column content - scrollable */}
          <div className="flex-1 min-h-0 overflow-y-auto p-2 flex flex-col gap-2">
            {(columnData.get(column.id) || []).map(session => (
              <BoardCard
                key={session.id}
                session={session}
                allSources={allSources}
                onClick={() => handleCardClick(session.id)}
              />
            ))}
            {(columnData.get(column.id)?.length || 0) === 0 && (
              <div className="flex items-center justify-center py-8 text-foreground/30 text-xs">
                No tasks
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// =============================================================================
// Canvas View — Node graph visualization
// =============================================================================

function CanvasView({
  selectedSessionId,
  setSelectedSessionId,
  sessionMetaMap,
  activityFeed,
  allSources,
}: {
  selectedSessionId: string | null
  setSelectedSessionId: (id: string | null) => void
  sessionMetaMap: Map<string, SessionMeta>
  activityFeed: ActivityFeedEvent[]
  allSources: LoadedSource[]
}) {
  const selectedSession = selectedSessionId
    ? sessionMetaMap.get(selectedSessionId)
    : undefined
  const ensureMessagesLoaded = useSetAtom(ensureSessionMessagesLoadedAtom)
  const sessionAtom = selectedSessionId
    ? sessionAtomFamily(selectedSessionId)
    : null
  const fullSession = useAtomValue(sessionAtom ?? atom(null))

  // Load messages when session is selected
  useEffect(() => {
    if (selectedSessionId) {
      ensureMessagesLoaded(selectedSessionId)
    }
  }, [selectedSessionId, ensureMessagesLoaded])

  // Build graph nodes from activity feed for selected session
  const graphNodes = useMemo(() => {
    if (!selectedSessionId) return []

    const sessionEvents = activityFeed.filter(
      (e) => e.sessionId === selectedSessionId,
    )

    // Group by tool name
    const toolMap = new Map<
      string,
      { calls: number; isActive: boolean; lastDetail?: string; source?: LoadedSource }
    >()

    for (const event of sessionEvents) {
      if (event.type === 'tool_use' || event.type === 'tool_result') {
        const toolName = event.toolName || 'unknown'
        const existing = toolMap.get(toolName) || {
          calls: 0,
          isActive: false,
          source: undefined,
        }
        existing.calls++
        if (event.type === 'tool_use') {
          existing.isActive = true
          existing.lastDetail = event.toolDetail
        }
        // Check if this is an MCP tool
        if (toolName.startsWith('mcp__')) {
          const serverName = toolName.split('__')[1]
          existing.source = allSources.find((s) => s.slug === serverName)
        }
        toolMap.set(toolName, existing)
      }
    }

    // Also add connected sources that haven't been called yet
    for (const source of allSources) {
      const matchingTool = Array.from(toolMap.keys()).find((k) =>
        k.includes(source.slug),
      )
      if (!matchingTool) {
        toolMap.set(`source:${source.slug}`, {
          calls: 0,
          isActive: false,
          source,
        })
      }
    }

    return Array.from(toolMap.entries()).map(([name, data]) => ({
      id: name,
      label: data.source?.name || formatToolName(name),
      type: data.source ? ('source' as const) : ('tool' as const),
      source: data.source,
      isActive: data.isActive,
      details: data.lastDetail ? [{ text: data.lastDetail }] : [],
      callCount: data.calls,
    }))
  }, [selectedSessionId, activityFeed, allSources])

  return (
    <NodeGraph
      session={selectedSession}
      nodes={graphNodes}
      model={fullSession?.model}
    />
  )
}

// =============================================================================
// Canvas Page — Canvas/Board toggle with persistent Activity feed on right
// =============================================================================

// Format token count with K/M suffix
function formatTokenCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K`
  }
  return count.toString()
}

// Format cost with $ prefix
function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`
  }
  return `$${cost.toFixed(2)}`
}

export default function CanvasPage() {
  const sessionMetaMap = useAtomValue(sessionMetaMapAtom)
  const sessionIds = useAtomValue(sessionIdsAtom)
  const activityFeed = useAtomValue(activityFeedAtom)
  const allSources = useAtomValue(sourcesAtom)
  const [selectedSessionId, setSelectedSessionId] = useAtom(selectedCanvasSessionIdAtom)

  const [viewMode, setViewMode] = useState<ViewMode>('canvas')

  const activeSessions = useMemo(
    () => Array.from(sessionMetaMap.values()).filter((s) => s.isProcessing),
    [sessionMetaMap],
  )

  // Aggregate token usage across all sessions
  const totalTokenUsage = useMemo(() => {
    let inputTokens = 0
    let outputTokens = 0
    let totalTokens = 0
    let costUsd = 0

    for (const session of sessionMetaMap.values()) {
      if (session.tokenUsage) {
        inputTokens += session.tokenUsage.inputTokens
        outputTokens += session.tokenUsage.outputTokens
        totalTokens += session.tokenUsage.totalTokens
        costUsd += session.tokenUsage.costUsd
      }
    }

    return { inputTokens, outputTokens, totalTokens, costUsd }
  }, [sessionMetaMap])

  // Auto-select first active session if none selected
  useEffect(() => {
    if (!selectedSessionId && activeSessions.length > 0) {
      setSelectedSessionId(activeSessions[0].id)
    }
  }, [selectedSessionId, activeSessions, setSelectedSessionId])

  const handleActivityCardClick = useCallback((sessionId: string) => {
    setSelectedSessionId(sessionId)
  }, [setSelectedSessionId])

  return (
    <div className="flex flex-col h-full">
      <PanelHeader
        title="Activity"
        badge={
          activeSessions.length > 0 ? (
            <span className="text-[11px] text-foreground/50">
              {activeSessions.length} active
            </span>
          ) : undefined
        }
        actions={
          <div className="flex items-center gap-1 bg-foreground/5 rounded-md p-0.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('canvas')}
              className={cn(
                'h-7 px-2.5 text-xs gap-1.5',
                viewMode === 'canvas'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-foreground/50 hover:text-foreground hover:bg-transparent'
              )}
            >
              <Bot className="h-3.5 w-3.5" />
              Canvas
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('board')}
              className={cn(
                'h-7 px-2.5 text-xs gap-1.5',
                viewMode === 'board'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-foreground/50 hover:text-foreground hover:bg-transparent'
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Board
            </Button>
          </div>
        }
      />

      <div className="flex-1 flex min-h-0">
        {/* Left: Canvas or Board */}
        <div className="flex-1 min-w-0">
          {viewMode === 'canvas' ? (
            <CanvasView
              selectedSessionId={selectedSessionId}
              setSelectedSessionId={setSelectedSessionId}
              sessionMetaMap={sessionMetaMap}
              activityFeed={activityFeed}
              allSources={allSources}
            />
          ) : (
            <BoardView
              sessionMetaMap={sessionMetaMap}
              allSources={allSources}
            />
          )}
        </div>

        {/* Right: Activity Feed (persistent) */}
        <div className="w-80 border-l border-foreground/8 flex flex-col">
          <div className="px-3 py-2.5 border-b border-foreground/8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-foreground/50 font-medium uppercase tracking-wider">
                Activity Feed
              </span>
            </div>
            {totalTokenUsage.totalTokens > 0 && (
              <div className="flex items-center justify-between text-foreground/60">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium font-mono">
                    {formatTokenCount(totalTokenUsage.totalTokens)}
                  </span>
                  <span className="text-xs text-foreground/40">tokens</span>
                </div>
                <span className="text-sm font-medium font-mono text-foreground/50">
                  {formatCost(totalTokenUsage.costUsd)}
                </span>
              </div>
            )}
          </div>
          <ScrollArea className="flex-1">
            <div className="p-3 flex flex-col gap-2">
              {sessionIds.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-foreground/30 gap-2">
                  <Clock className="h-5 w-5" />
                  <span className="text-xs">No activity yet</span>
                </div>
              ) : (
                <>
                  {/* Active Sessions */}
                  {activeSessions.length > 0 && (
                    <div className="mb-2">
                      <span className="text-[10px] text-foreground/40 uppercase tracking-wider font-medium px-1">
                        Active
                      </span>
                      <div className="flex flex-col gap-1.5 mt-1.5">
                        {activeSessions.map((meta) => (
                          <SessionCard
                            key={meta.id}
                            meta={meta}
                            isSelected={meta.id === selectedSessionId}
                            recentEvents={activityFeed
                              .filter((e) => e.sessionId === meta.id)
                              .slice(0, 3)}
                            onClick={() => handleActivityCardClick(meta.id)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent Sessions */}
                  {(() => {
                    const recentSessions = sessionIds
                      .map((id) => sessionMetaMap.get(id))
                      .filter((m): m is SessionMeta => !!m && !m.isProcessing)
                      .slice(0, 20)
                    if (recentSessions.length === 0) return null
                    return (
                      <div>
                        <span className="text-[10px] text-foreground/40 uppercase tracking-wider font-medium px-1">
                          Recent
                        </span>
                        <div className="flex flex-col gap-1.5 mt-1.5">
                          {recentSessions.map((meta) => (
                            <SessionCard
                              key={meta.id}
                              meta={meta}
                              isSelected={meta.id === selectedSessionId}
                              recentEvents={activityFeed
                                .filter((e) => e.sessionId === meta.id)
                                .slice(0, 3)}
                              onClick={() => handleActivityCardClick(meta.id)}
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
