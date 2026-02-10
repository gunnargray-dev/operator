import * as React from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Timer, Play, Clock, AlertCircle, CheckCircle2, Square, Eye, FileText, Code, Footprints } from 'lucide-react'
import { cn, isHexColor } from '@/lib/utils'
import { Spinner } from '@craft-agent/ui'
import { SourceAvatar } from '@/components/ui/source-avatar'
import type { SessionMeta } from '@/atoms/sessions'
import type { LoadedSource } from '../../../shared/types'

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

function formatTokens(tokens: number): string {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`
  }
  return String(tokens)
}

interface BoardCardProps {
  session: SessionMeta
  allSources: LoadedSource[]
  statusColor?: string
  onClick?: () => void
  isDragOverlay?: boolean
}

export const BoardCard = React.memo(function BoardCard({
  session,
  allSources,
  statusColor,
  onClick,
  isDragOverlay,
}: BoardCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: session.id,
    data: { columnId: session.todoState || 'todo' },
  })

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined

  const title = session.name || session.preview || 'Untitled'
  const timeAgo = session.lastMessageAt
    ? formatTimeAgoShort(session.lastMessageAt)
    : null

  const tokens = session.tokenUsage?.totalTokens || 0
  const currentStep = session.currentStep || ''
  const isProcessing = session.isProcessing
  const isWaiting = session.lastMessageRole === 'plan'
  const isComplete = !isProcessing && !isWaiting && !session.scheduleConfig?.enabled
  const stepCount = session.stepCount || 0
  const lastAssistantPreview = session.lastAssistantPreview

  // Schedule info
  const scheduledInterval = React.useMemo(() => {
    const cfg = session.scheduleConfig
    if (!cfg?.enabled) return null
    const mins = cfg.intervalMs / 60000
    if (mins < 60) return `every ${mins}m`
    if (mins < 1440) return `every ${mins / 60}h`
    return `every ${mins / 1440}d`
  }, [session.scheduleConfig])

  // Resolve source objects for badges
  const sourceBadges = React.useMemo(() => {
    if (!session.enabledSourceSlugs?.length) return []
    return session.enabledSourceSlugs
      .map(slug => allSources.find(s => s.config.slug === slug))
      .filter(Boolean) as LoadedSource[]
  }, [session.enabledSourceSlugs, allSources])

  // Status accent (left border)
  const borderColorStyle = statusColor && isHexColor(statusColor)
    ? { borderLeftColor: statusColor }
    : undefined
  const borderColorClass = statusColor && !isHexColor(statusColor)
    ? statusColor.replace('text-', 'border-l-')
    : undefined

  return (
    <div
      ref={isDragOverlay ? undefined : setNodeRef}
      {...(isDragOverlay ? {} : { ...attributes, ...listeners })}
      onClick={isDragging ? undefined : onClick}
      className={cn(
        'rounded-[8px] border bg-background p-3 cursor-grab active:cursor-grabbing',
        'hover:border-foreground/15 hover:shadow-sm transition-all',
        'border-l-[3px]',
        borderColorClass,
        isProcessing
          ? 'border-success/20 bg-success/[0.02]'
          : 'border-foreground/8',
        isDragging && 'opacity-40',
        isDragOverlay && 'shadow-lg rotate-[2deg] scale-[1.02]',
      )}
      style={{ ...(isDragOverlay ? {} : style), ...borderColorStyle }}
    >
      {/* Status badge row */}
      <div className="flex items-center gap-2 mb-2">
        {isProcessing && (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-success bg-success/10 rounded px-1.5 py-0.5">
            <Spinner className="text-[8px]" />
            RUNNING
          </span>
        )}
        {isWaiting && !isProcessing && (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-warning bg-warning/10 rounded px-1.5 py-0.5">
            <AlertCircle className="h-3 w-3" />
            NEEDS INPUT
          </span>
        )}
        {session.scheduleConfig?.enabled && !isProcessing && !isWaiting && (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-info bg-info/10 rounded px-1.5 py-0.5">
            <Clock className="h-3 w-3" />
            SCHEDULED
          </span>
        )}

        {/* Tokens */}
        {tokens > 0 && (
          <span className="text-[10px] text-foreground/40 tabular-nums ml-auto">
            {formatTokens(tokens)} tokens
          </span>
        )}
      </div>

      {/* Task name */}
      <div className="mb-2">
        <p className="text-[13px] font-medium text-foreground leading-snug line-clamp-2">
          {title}
        </p>
        {/* Current step / activity */}
        {currentStep && (
          <p className="text-[11px] text-foreground/40 truncate mt-0.5">
            {currentStep}
          </p>
        )}
      </div>

      {/* Status-specific messages */}
      {isProcessing && !currentStep && (
        <p className="text-[11px] text-foreground/40 mb-2">
          Processing...
        </p>
      )}
      {isWaiting && !isProcessing && (
        <p className="text-[11px] text-foreground/40 mb-2">
          Waiting for your response...
        </p>
      )}
      {scheduledInterval && !isProcessing && !isWaiting && (
        <p className="text-[11px] text-foreground/40 mb-2">
          Runs {scheduledInterval}
        </p>
      )}

      {/* Preview text for completed tasks */}
      {isComplete && lastAssistantPreview && (
        <div className="mb-2 pt-2 border-t border-foreground/5">
          <p className="text-[11px] text-foreground/50 line-clamp-3 leading-relaxed">
            {lastAssistantPreview}
          </p>
        </div>
      )}

      {/* Step count for completed tasks */}
      {isComplete && stepCount > 0 && (
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-1 text-[10px] text-foreground/40">
            <Footprints className="h-3 w-3" />
            {stepCount} steps
          </span>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center gap-3 pt-2 border-t border-foreground/5">
        {timeAgo && (
          <span className="inline-flex items-center gap-1 text-[10px] text-foreground/35">
            <Clock className="h-3 w-3" />
            {timeAgo}
          </span>
        )}

        {/* Resume button for scheduled tasks in needs-review */}
        {session.scheduleConfig?.enabled && session.todoState === 'needs-review' && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              window.electronAPI.sessionCommand(session.id, { type: 'resumeScheduled' })
            }}
            className="inline-flex items-center gap-1 text-[10px] text-accent hover:text-accent/80 transition-colors"
          >
            <Play className="h-3 w-3" />
            Resume
          </button>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Source badges */}
        {sourceBadges.length > 0 && (
          <div className="flex -space-x-1">
            {sourceBadges.slice(0, 3).map(source => (
              <SourceAvatar
                key={source.config.slug}
                source={source}
                size="xs"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
})
