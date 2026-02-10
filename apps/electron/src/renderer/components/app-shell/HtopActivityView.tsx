/**
 * HtopActivityView - HTOP-style real-time process table for tasks
 *
 * Features:
 * - System stats bars at top (running tasks, tokens/min, queue)
 * - Sortable table of all tasks with live updates
 * - Color-coded status indicators
 * - Keyboard shortcuts for navigation and actions
 * - Compact, information-dense layout
 */

import * as React from 'react'
import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useAtomValue } from 'jotai'
import {
  Play,
  Pause,
  Square,
  Eye,
  ChevronUp,
  ChevronDown,
  Clock,
  Zap,
  Layers,
  ArrowUpDown,
  LayoutGrid,
  List,
  AlertCircle,
  CheckCircle2,
  Send,
  ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Spinner } from '@craft-agent/ui'
import { sessionMetaMapAtom, type SessionMeta } from '@/atoms/sessions'
import { useAppShellContext } from '@/context/AppShellContext'
import { navigate, routes } from '@/lib/navigate'
import { getSessionTitle } from '@/utils/session'

// =============================================================================
// Types
// =============================================================================

type TaskStatus = 'running' | 'waiting' | 'scheduled' | 'queued' | 'done'
type SortField = 'status' | 'name' | 'time' | 'tokens' | 'step'
type SortDirection = 'asc' | 'desc'
type ViewDensity = 'compact' | 'cards'

interface TaskRow {
  id: string
  status: TaskStatus
  name: string
  duration: number | null // ms since started, null if not running
  tokens: number
  currentStep: string
  scheduledInterval: string | null
  meta: SessionMeta
}

// =============================================================================
// Constants
// =============================================================================

const STATUS_ORDER: Record<TaskStatus, number> = {
  running: 0,
  waiting: 1,
  scheduled: 2,
  queued: 3,
  done: 4,
}

const STATUS_COLORS: Record<TaskStatus, string> = {
  running: 'text-success',
  waiting: 'text-warning',
  scheduled: 'text-info',
  queued: 'text-foreground/50',
  done: 'text-foreground/30',
}

const STATUS_SYMBOLS: Record<TaskStatus, string> = {
  running: '●',
  waiting: '◐',
  scheduled: '◷',
  queued: '○',
  done: '✓',
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  running: 'RUN',
  waiting: 'WAIT',
  scheduled: 'SCHED',
  queued: 'QUEUE',
  done: 'DONE',
}

// =============================================================================
// Helper Functions
// =============================================================================

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`
  }
  return String(tokens)
}

function formatIntervalMs(ms: number): string {
  const minutes = Math.floor(ms / 60000)
  if (minutes < 60) return `every ${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `every ${hours}h`
  const days = Math.floor(hours / 24)
  return `every ${days}d`
}

/**
 * Format time ago in short abbreviated format (e.g., "5m", "2h", "3d")
 */
function formatTimeAgoShort(timestamp: number): string {
  const now = Date.now()
  const diffMs = now - timestamp
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMinutes < 1) return '<1m'
  if (diffMinutes < 60) return `${diffMinutes}m`
  if (diffHours < 24) return `${diffHours}h`
  return `${diffDays}d`
}

/**
 * Generate pseudo-random activity data based on session properties
 * This creates a deterministic "fingerprint" for each task
 */
function generateActivityData(id: string, tokens: number, stepCount: number, isProcessing: boolean): number[] {
  // Use string hash for deterministic randomness
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i)
    hash = hash & hash
  }

  const points: number[] = []
  const baseActivity = Math.min(tokens / 1000, 10) // Normalize tokens to 0-10 scale
  const stepActivity = Math.min(stepCount, 10) // Cap at 10

  for (let i = 0; i < 12; i++) {
    // Generate value based on hash and position
    const variance = ((hash + i * 17) % 100) / 100
    let value = (baseActivity + stepActivity * variance) / 2

    // Running tasks have a spike at the end
    if (isProcessing && i >= 9) {
      value = Math.max(value, 6 + (i - 9) * 2)
    }

    points.push(Math.max(0, Math.min(10, value)))
  }

  return points
}

// =============================================================================
// Sparkline - Mini activity graph
// =============================================================================

function Sparkline({
  data,
  width = 48,
  height = 16,
  color = 'currentColor',
  isActive = false,
}: {
  data: number[]
  width?: number
  height?: number
  color?: string
  isActive?: boolean
}) {
  if (data.length === 0) return null

  const max = Math.max(...data, 1)
  const min = 0

  // Generate SVG path
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width
    const y = height - ((value - min) / (max - min)) * height
    return `${x},${y}`
  })

  const pathD = `M ${points.join(' L ')}`

  // Area fill path (closed shape)
  const areaD = `M 0,${height} L ${points.join(' L ')} L ${width},${height} Z`

  return (
    <svg
      width={width}
      height={height}
      className={cn("shrink-0", isActive && "animate-pulse")}
      viewBox={`0 0 ${width} ${height}`}
    >
      {/* Area fill */}
      <path
        d={areaD}
        fill={color}
        fillOpacity={0.15}
      />
      {/* Line */}
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End dot for active tasks */}
      {isActive && (
        <circle
          cx={width}
          cy={height - ((data[data.length - 1] - min) / (max - min)) * height}
          r={2}
          fill={color}
        />
      )}
    </svg>
  )
}

// =============================================================================
// StatsBar - Progress bar for system stats
// =============================================================================

function StatsBar({
  label,
  value,
  max,
  color = 'bg-foreground/60',
  suffix,
}: {
  label: string
  value: number
  max: number
  color?: string
  suffix?: string
}) {
  const percentage = Math.min((value / max) * 100, 100)

  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] font-medium text-foreground/50 w-24 shrink-0">
        {label}
      </span>
      <div className="flex-1 h-2 bg-foreground/10 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-300", color)}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-[11px] font-mono text-foreground/60 w-16 text-right">
        {value}{suffix ? ` ${suffix}` : `/${max}`}
      </span>
    </div>
  )
}

// =============================================================================
// TableHeader - Sortable column header
// =============================================================================

function TableHeader({
  label,
  field,
  sortField,
  sortDirection,
  onSort,
  align = 'left',
  className,
}: {
  label: string
  field: SortField
  sortField: SortField
  sortDirection: SortDirection
  onSort: (field: SortField) => void
  align?: 'left' | 'right' | 'center'
  className?: string
}) {
  const isActive = sortField === field

  return (
    <button
      onClick={() => onSort(field)}
      className={cn(
        "flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider transition-colors",
        "hover:text-foreground",
        isActive ? "text-foreground" : "text-foreground/40",
        align === 'right' && "justify-end",
        align === 'center' && "justify-center",
        className
      )}
    >
      {label}
      {isActive && (
        sortDirection === 'asc' ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )
      )}
    </button>
  )
}

// =============================================================================
// TaskTableRow - Single row in the task table with expansion support
// =============================================================================

function TaskTableRow({
  task,
  isSelected,
  isExpanded,
  onSelect,
  onToggleExpand,
  onView,
  onStop,
}: {
  task: TaskRow
  isSelected: boolean
  isExpanded: boolean
  onSelect: () => void
  onToggleExpand: () => void
  onView: () => void
  onStop: () => void
}) {
  const [duration, setDuration] = useState(task.duration)

  // Update duration display from task
  useEffect(() => {
    setDuration(task.duration)
  }, [task.duration])

  // Generate sparkline data based on task properties
  const sparklineData = useMemo(() => {
    return generateActivityData(
      task.id,
      task.tokens,
      task.meta.stepCount || 0,
      task.status === 'running'
    )
  }, [task.id, task.tokens, task.meta.stepCount, task.status])

  // Get sparkline color based on status (using actual color values for SVG)
  const sparklineColor = task.status === 'running'
    ? '#22c55e' // green-500
    : task.status === 'waiting'
    ? '#eab308' // yellow-500
    : task.status === 'scheduled'
    ? '#3b82f6' // blue-500
    : '#6b7280' // gray-500

  // Get preview text for expansion
  const previewText = task.meta.lastAssistantPreview || task.currentStep || 'No output yet'

  return (
    <div className="group">
      {/* Main row */}
      <div
        onClick={onSelect}
        onDoubleClick={onView}
        className={cn(
          "flex items-center gap-6 px-4 py-2 font-mono text-[12px] cursor-pointer transition-colors relative",
          "hover:bg-foreground/[0.04]",
          isSelected && "bg-accent/[0.08]",
          isExpanded && "bg-foreground/[0.03]",
          task.status === 'running' && !isSelected && !isExpanded && "bg-success/[0.02]"
        )}
      >
        {/* Selected indicator bar */}
        {isSelected && (
          <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-accent rounded-full" />
        )}

        {/* Status */}
        <div className={cn("w-16 flex items-center gap-1.5", STATUS_COLORS[task.status])}>
          {task.status === 'running' ? (
            <Spinner className="text-[10px]" />
          ) : (
            <span className="text-[14px]">{STATUS_SYMBOLS[task.status]}</span>
          )}
          <span className="text-[10px] font-semibold">{STATUS_LABELS[task.status]}</span>
        </div>

        {/* Sparkline */}
        <div className="w-14 flex items-center justify-center">
          <Sparkline
            data={sparklineData}
            color={sparklineColor}
            isActive={task.status === 'running'}
          />
        </div>

        {/* Name */}
        <div className="flex-1 truncate text-foreground/90">
          {task.name}
        </div>

        {/* Current Step */}
        <div className="w-40 truncate text-foreground/40">
          {task.currentStep || '—'}
        </div>

        {/* Tokens */}
        <div className="w-14 text-right text-foreground/50 tabular-nums">
          {task.tokens > 0 ? formatTokens(task.tokens) : '—'}
        </div>

        {/* Time - shows relative time from last activity */}
        <div className="w-12 text-right text-foreground/50 tabular-nums">
          {task.status === 'scheduled' && task.scheduledInterval ? (
            <span className="text-info">{task.scheduledInterval}</span>
          ) : task.meta.lastMessageAt ? (
            formatTimeAgoShort(task.meta.lastMessageAt)
          ) : (
            '—'
          )}
        </div>

        {/* Actions */}
        <div className="w-20 flex items-center justify-end gap-1">
          {/* Expand indicator */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleExpand()
            }}
            className={cn(
              "p-1 rounded text-foreground/30 hover:text-foreground/60 hover:bg-foreground/10 transition-colors",
              isExpanded && "text-accent"
            )}
            title="Toggle preview (Space)"
          >
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isExpanded && "rotate-180")} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onView()
            }}
            className="p-1 rounded hover:bg-foreground/10 text-foreground/50 hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          {task.status === 'running' && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onStop()
              }}
              className="p-1 rounded hover:bg-destructive/20 text-foreground/50 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Square className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Expanded preview section */}
      {isExpanded && (
        <div className="px-3 py-3 bg-foreground/[0.02] border-t border-foreground/5">
          <div className="ml-[calc(4rem+3.5rem+0.5rem)] pr-20">
            <div className="text-[11px] font-medium text-foreground/50 mb-1.5 uppercase tracking-wider">
              Last Output
            </div>
            <div className="text-[12px] text-foreground/70 leading-relaxed whitespace-pre-wrap line-clamp-4 font-sans">
              {previewText}
            </div>
            {task.meta.stepCount && task.meta.stepCount > 0 && (
              <div className="mt-2 flex items-center gap-3 text-[10px] text-foreground/40">
                <span>{task.meta.stepCount} steps completed</span>
                {task.meta.tokenUsage && (
                  <span>•</span>
                )}
                {task.meta.tokenUsage && (
                  <span>${task.meta.tokenUsage.costUsd?.toFixed(4) || '0.00'} cost</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// TaskCard - Card view for expanded density
// =============================================================================

function TaskCard({
  task,
  isSelected,
  onSelect,
  onView,
  onStop,
}: {
  task: TaskRow
  isSelected: boolean
  onSelect: () => void
  onView: () => void
  onStop: () => void
}) {
  const timeAgo = task.meta.lastMessageAt
    ? formatTimeAgoShort(task.meta.lastMessageAt)
    : null

  return (
    <button
      onClick={onSelect}
      onDoubleClick={onView}
      className={cn(
        "w-full text-left rounded-lg border p-3 transition-all",
        task.status === 'running'
          ? "border-success/20 bg-success/[0.02] animate-card-shimmer"
          : "border-foreground/8 bg-foreground/[0.02] hover:border-foreground/15 hover:bg-foreground/[0.04]",
        isSelected && "ring-2 ring-accent/50 border-accent/30 bg-accent/5"
      )}
    >
      {/* Status badge row */}
      <div className="flex items-center gap-2 mb-2">
        {task.status === 'running' && (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-success bg-success/10 rounded px-1.5 py-0.5">
            <Spinner className="text-[8px]" />
            RUNNING
          </span>
        )}
        {task.status === 'waiting' && (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-warning bg-warning/10 rounded px-1.5 py-0.5">
            <AlertCircle className="h-3 w-3" />
            NEEDS INPUT
          </span>
        )}
        {task.status === 'scheduled' && (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-info bg-info/10 rounded px-1.5 py-0.5">
            <Clock className="h-3 w-3" />
            SCHEDULED
          </span>
        )}
        {task.status === 'done' && (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-foreground/50 bg-foreground/5 rounded px-1.5 py-0.5">
            <CheckCircle2 className="h-3 w-3" />
            DONE
          </span>
        )}

        {/* Tokens */}
        {task.tokens > 0 && (
          <span className="text-[10px] text-foreground/40 tabular-nums ml-auto">
            {formatTokens(task.tokens)} tokens
          </span>
        )}
      </div>

      {/* Task name */}
      <div className="mb-2">
        <p className="text-[13px] font-medium text-foreground leading-snug line-clamp-2">
          {task.name}
        </p>
        {/* Current step / activity */}
        {task.currentStep && (
          <p className="text-[11px] text-foreground/40 truncate mt-0.5">
            {task.currentStep}
          </p>
        )}
      </div>

      {/* Status-specific messages */}
      {task.status === 'running' && !task.currentStep && (
        <p className="text-[11px] text-foreground/40 mb-2">
          Processing...
        </p>
      )}
      {task.status === 'waiting' && (
        <p className="text-[11px] text-foreground/40 mb-2">
          Waiting for your response...
        </p>
      )}
      {task.status === 'scheduled' && task.scheduledInterval && (
        <p className="text-[11px] text-foreground/40 mb-2">
          Runs {task.scheduledInterval}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center gap-3 pt-2 border-t border-foreground/5">
        {timeAgo && (
          <span className="inline-flex items-center gap-1 text-[10px] text-foreground/35">
            <Clock className="h-3 w-3" />
            {timeAgo}
          </span>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Quick actions */}
        {task.status === 'running' && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onStop()
            }}
            className="inline-flex items-center gap-1 text-[10px] text-destructive/70 hover:text-destructive transition-colors"
          >
            <Square className="h-3 w-3" />
            Stop
          </button>
        )}
        {task.status === 'waiting' && (
          <span className="inline-flex items-center gap-1 text-[10px] text-warning/70">
            <Zap className="h-3 w-3" />
            Respond
          </span>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onView()
          }}
          className="inline-flex items-center gap-1 text-[10px] text-foreground/50 hover:text-foreground transition-colors"
        >
          <Eye className="h-3 w-3" />
          View
        </button>
      </div>
    </button>
  )
}

// =============================================================================
// HtopActivityView - Main Component
// =============================================================================

interface HtopActivityViewProps {
  /** Callback when user submits a new task */
  onCreateTask?: (message: string) => Promise<void>
}

export function HtopActivityView({ onCreateTask }: HtopActivityViewProps) {
  const sessionMetaMap = useAtomValue(sessionMetaMapAtom)
  const { activeWorkspaceId, openRightSidebar } = useAppShellContext()

  // Input state for new task
  const [inputValue, setInputValue] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // View density state
  const [density, setDensity] = useState<ViewDensity>('compact')

  // Sort state
  const [sortField, setSortField] = useState<SortField>('status')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  // Selection state
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Expansion state for inline preview
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Container ref for keyboard navigation
  const containerRef = useRef<HTMLDivElement>(null)

  // Build task rows from session metadata
  const tasks = useMemo((): TaskRow[] => {
    const rows: TaskRow[] = []

    for (const meta of sessionMetaMap.values()) {
      if (meta.workspaceId !== activeWorkspaceId) continue

      let status: TaskStatus = 'done'
      if (meta.isProcessing) {
        status = 'running'
      } else if (meta.lastMessageRole === 'plan') {
        status = 'waiting'
      } else if (meta.scheduleConfig?.enabled) {
        status = 'scheduled'
      }

      rows.push({
        id: meta.id,
        status,
        name: getSessionTitle(meta),
        duration: null, // Duration tracking not available in meta
        tokens: meta.tokenUsage?.totalTokens || 0,
        currentStep: meta.currentStep || '',
        scheduledInterval: meta.scheduleConfig?.intervalMs
          ? formatIntervalMs(meta.scheduleConfig.intervalMs)
          : null,
        meta,
      })
    }

    return rows
  }, [sessionMetaMap, activeWorkspaceId])

  // Sort tasks
  const sortedTasks = useMemo(() => {
    const sorted = [...tasks]

    sorted.sort((a, b) => {
      let comparison = 0

      switch (sortField) {
        case 'status':
          comparison = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
          break
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'time':
          comparison = (a.duration || 0) - (b.duration || 0)
          break
        case 'tokens':
          comparison = a.tokens - b.tokens
          break
        case 'step':
          comparison = a.currentStep.localeCompare(b.currentStep)
          break
      }

      return sortDirection === 'asc' ? comparison : -comparison
    })

    return sorted
  }, [tasks, sortField, sortDirection])

  // Stats
  const stats = useMemo(() => {
    const running = tasks.filter(t => t.status === 'running').length
    const waiting = tasks.filter(t => t.status === 'waiting').length
    const scheduled = tasks.filter(t => t.status === 'scheduled').length
    const totalTokens = tasks.reduce((sum, t) => sum + t.tokens, 0)

    return {
      running,
      waiting,
      scheduled,
      queued: waiting,
      total: tasks.length,
      totalTokens,
    }
  }, [tasks])

  // Handle sort
  const handleSort = useCallback((field: SortField) => {
    if (field === sortField) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }, [sortField])

  // Handle select task (opens sidebar)
  const handleSelect = useCallback((taskId: string) => {
    setSelectedId(taskId)
    openRightSidebar?.(taskId)
  }, [openRightSidebar])

  // Handle view task (navigates to full view)
  const handleView = useCallback((taskId: string) => {
    navigate(routes.view.allChats(taskId))
  }, [])

  // Handle stop task
  const handleStop = useCallback((taskId: string) => {
    window.electronAPI.cancelProcessing(taskId, false).catch(console.error)
  }, [])

  // Handle new task submission
  const handleSubmitTask = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() || isSubmitting || !onCreateTask) return

    setIsSubmitting(true)
    try {
      await onCreateTask(inputValue.trim())
      setInputValue('')
    } finally {
      setIsSubmitting(false)
    }
  }, [inputValue, isSubmitting, onCreateTask])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip keyboard shortcuts when input is focused
      if (inputRef.current === document.activeElement) {
        return
      }

      if (!containerRef.current?.contains(document.activeElement) &&
          document.activeElement !== containerRef.current) {
        return
      }

      const currentIndex = sortedTasks.findIndex(t => t.id === selectedId)

      switch (e.key) {
        case 'ArrowDown':
        case 'j':
          e.preventDefault()
          if (currentIndex < sortedTasks.length - 1) {
            handleSelect(sortedTasks[currentIndex + 1].id)
          } else if (sortedTasks.length > 0) {
            handleSelect(sortedTasks[0].id)
          }
          break
        case 'ArrowUp':
        case 'k':
          e.preventDefault()
          if (currentIndex > 0) {
            handleSelect(sortedTasks[currentIndex - 1].id)
          } else if (sortedTasks.length > 0) {
            handleSelect(sortedTasks[sortedTasks.length - 1].id)
          }
          break
        case 'Enter':
        case 'v':
          e.preventDefault()
          if (selectedId) {
            handleView(selectedId)
          }
          break
        case 'x':
        case 'Delete':
          e.preventDefault()
          if (selectedId) {
            const task = sortedTasks.find(t => t.id === selectedId)
            if (task?.status === 'running') {
              handleStop(selectedId)
            }
          }
          break
        case 's':
          e.preventDefault()
          // Cycle through sort fields
          const fields: SortField[] = ['status', 'name', 'time', 'tokens', 'step']
          const currentFieldIndex = fields.indexOf(sortField)
          const nextField = fields[(currentFieldIndex + 1) % fields.length]
          handleSort(nextField)
          break
        case 'd':
          e.preventDefault()
          // Toggle density
          setDensity(d => d === 'compact' ? 'cards' : 'compact')
          break
        case ' ':
          e.preventDefault()
          // Toggle expansion for selected task
          if (selectedId) {
            setExpandedId(prev => prev === selectedId ? null : selectedId)
          }
          break
        case 'Escape':
          e.preventDefault()
          // Collapse expanded row
          setExpandedId(null)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [sortedTasks, selectedId, sortField, handleSort, handleSelect, handleView, handleStop])

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="flex flex-col h-full bg-background outline-none"
    >
      {/* Header with stats */}
      <div className="shrink-0 px-4 pt-[52px] pb-4 border-b border-foreground/10 space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <Layers className="h-4 w-4 text-foreground/50" />
          <h1 className="text-[14px] font-semibold text-foreground">Activity Monitor</h1>
          <span className="text-[11px] text-foreground/40 font-mono">
            {stats.total} tasks
          </span>

          {/* Density toggle */}
          <div className="ml-auto flex items-center gap-1 bg-foreground/5 rounded-md p-0.5">
            <button
              onClick={() => setDensity('compact')}
              className={cn(
                "p-1.5 rounded transition-colors",
                density === 'compact'
                  ? "bg-foreground/10 text-foreground"
                  : "text-foreground/40 hover:text-foreground/60"
              )}
              title="Compact view"
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setDensity('cards')}
              className={cn(
                "p-1.5 rounded transition-colors",
                density === 'cards'
                  ? "bg-foreground/10 text-foreground"
                  : "text-foreground/40 hover:text-foreground/60"
              )}
              title="Card view"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <StatsBar
          label="Running"
          value={stats.running}
          max={Math.max(10, stats.total)}
          color="bg-success"
        />
        <StatsBar
          label="Waiting"
          value={stats.waiting}
          max={Math.max(10, stats.total)}
          color="bg-warning"
        />
        <StatsBar
          label="Scheduled"
          value={stats.scheduled}
          max={Math.max(10, stats.total)}
          color="bg-info"
        />
      </div>

      {/* Table header - compact view only */}
      {density === 'compact' && (
        <div className="shrink-0 flex items-center gap-6 px-4 py-2 border-b border-foreground/10 bg-foreground/[0.02]">
          <TableHeader
            label="Status"
            field="status"
            className="w-16"
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={handleSort}
          />
          {/* Activity sparkline column */}
          <div className="w-14 text-[10px] font-medium text-foreground/40 text-center">
            Activity
          </div>
          <TableHeader
            label="Task"
            field="name"
            className="flex-1"
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={handleSort}
          />
          <TableHeader
            label="Current Step"
            field="step"
            className="w-40"
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={handleSort}
          />
          <TableHeader
            label="Tokens"
            field="tokens"
            className="w-14"
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={handleSort}
            align="right"
          />
          <TableHeader
            label="Time"
            field="time"
            className="w-12"
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={handleSort}
            align="right"
          />
          <div className="w-20" /> {/* Actions spacer */}
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        {sortedTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-foreground/40">
            <Zap className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-[13px]">No tasks yet</p>
          </div>
        ) : density === 'compact' ? (
          /* Compact table view */
          <div>
            {sortedTasks.map(task => (
              <TaskTableRow
                key={task.id}
                task={task}
                isSelected={task.id === selectedId}
                isExpanded={task.id === expandedId}
                onSelect={() => handleSelect(task.id)}
                onToggleExpand={() => setExpandedId(prev => prev === task.id ? null : task.id)}
                onView={() => handleView(task.id)}
                onStop={() => handleStop(task.id)}
              />
            ))}
          </div>
        ) : (
          /* Cards view - sectioned by status, most recent first */
          <div className="p-4 space-y-6">
            {/* Running Section */}
            {(() => {
              const running = sortedTasks
                .filter(t => t.status === 'running')
                .sort((a, b) => (b.meta.lastMessageAt || 0) - (a.meta.lastMessageAt || 0))
              if (running.length === 0) return null
              return (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                    <span className="text-[11px] font-semibold text-foreground/60 uppercase tracking-wider">
                      Running
                    </span>
                    <span className="text-[11px] text-foreground/40">{running.length}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {running.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        isSelected={task.id === selectedId}
                        onSelect={() => handleSelect(task.id)}
                        onView={() => handleView(task.id)}
                        onStop={() => handleStop(task.id)}
                      />
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Waiting/Needs Input Section */}
            {(() => {
              const waiting = sortedTasks
                .filter(t => t.status === 'waiting')
                .sort((a, b) => (b.meta.lastMessageAt || 0) - (a.meta.lastMessageAt || 0))
              if (waiting.length === 0) return null
              return (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2 h-2 rounded-full bg-warning" />
                    <span className="text-[11px] font-semibold text-foreground/60 uppercase tracking-wider">
                      Needs Input
                    </span>
                    <span className="text-[11px] text-foreground/40">{waiting.length}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {waiting.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        isSelected={task.id === selectedId}
                        onSelect={() => handleSelect(task.id)}
                        onView={() => handleView(task.id)}
                        onStop={() => handleStop(task.id)}
                      />
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Scheduled Section */}
            {(() => {
              const scheduled = sortedTasks
                .filter(t => t.status === 'scheduled')
                .sort((a, b) => (b.meta.lastMessageAt || 0) - (a.meta.lastMessageAt || 0))
              if (scheduled.length === 0) return null
              return (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2 h-2 rounded-full bg-info" />
                    <span className="text-[11px] font-semibold text-foreground/60 uppercase tracking-wider">
                      Scheduled
                    </span>
                    <span className="text-[11px] text-foreground/40">{scheduled.length}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {scheduled.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        isSelected={task.id === selectedId}
                        onSelect={() => handleSelect(task.id)}
                        onView={() => handleView(task.id)}
                        onStop={() => handleStop(task.id)}
                      />
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Completed Section */}
            {(() => {
              const completed = sortedTasks
                .filter(t => t.status === 'done' || t.status === 'queued')
                .sort((a, b) => (b.meta.lastMessageAt || 0) - (a.meta.lastMessageAt || 0))
              if (completed.length === 0) return null
              return (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2 h-2 rounded-full bg-foreground/30" />
                    <span className="text-[11px] font-semibold text-foreground/60 uppercase tracking-wider">
                      Completed
                    </span>
                    <span className="text-[11px] text-foreground/40">{completed.length}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {completed.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        isSelected={task.id === selectedId}
                        onSelect={() => handleSelect(task.id)}
                        onView={() => handleView(task.id)}
                        onStop={() => handleStop(task.id)}
                      />
                    ))}
                  </div>
                </div>
              )
            })()}
          </div>
        )}
      </div>

      {/* Footer with input and shortcuts - only show when onCreateTask is provided */}
      {onCreateTask && (
        <div className="shrink-0 border-t border-foreground/10 bg-foreground/[0.02]">
          {/* Task input */}
          <form onSubmit={handleSubmitTask} className="flex items-center gap-3 px-4 py-3 border-b border-foreground/5">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Start a new task..."
              disabled={isSubmitting}
              className={cn(
                "flex-1 bg-transparent text-[13px] text-foreground",
                "placeholder:text-foreground/30",
                "focus:outline-none",
                "disabled:opacity-50"
              )}
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isSubmitting}
              className={cn(
                "shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium",
                "bg-accent/10 text-accent",
                "hover:bg-accent/20",
                "disabled:opacity-30 disabled:hover:bg-accent/10",
                "transition-colors"
              )}
            >
              {isSubmitting ? (
                <Spinner className="text-[10px]" />
              ) : (
                <>
                  Run
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Keyboard shortcuts */}
          <div className="flex items-center gap-3 px-4 py-2">
            <span className="text-[10px] text-foreground/40">
              <kbd className="px-1 py-0.5 rounded bg-foreground/10 font-mono">↑↓</kbd> Navigate
            </span>
            <span className="text-[10px] text-foreground/40">
              <kbd className="px-1 py-0.5 rounded bg-foreground/10 font-mono">Space</kbd> Expand
            </span>
            <span className="text-[10px] text-foreground/40">
              <kbd className="px-1 py-0.5 rounded bg-foreground/10 font-mono">Enter</kbd> Open
            </span>
            <span className="text-[10px] text-foreground/40">
              <kbd className="px-1 py-0.5 rounded bg-foreground/10 font-mono">x</kbd> Stop
            </span>
            <span className="text-[10px] text-foreground/40">
              <kbd className="px-1 py-0.5 rounded bg-foreground/10 font-mono">s</kbd> Sort
            </span>
            <span className="text-[10px] text-foreground/40">
              <kbd className="px-1 py-0.5 rounded bg-foreground/10 font-mono">d</kbd> Density
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
