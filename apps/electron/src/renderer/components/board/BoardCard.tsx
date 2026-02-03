import * as React from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { formatDistanceToNow } from 'date-fns'
import { Loader2, Timer, Play } from 'lucide-react'
import { cn, isHexColor } from '@/lib/utils'
import { SourceAvatar } from '@/components/ui/source-avatar'
import type { SessionMeta } from '@/atoms/sessions'
import type { LoadedSource } from '../../../shared/types'

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
  const preview = session.preview
    ? session.preview.slice(0, 80) + (session.preview.length > 80 ? '...' : '')
    : null
  const timeAgo = session.lastMessageAt
    ? formatDistanceToNow(new Date(session.lastMessageAt), { addSuffix: true })
    : null

  // Schedule badge text
  const scheduleBadge = React.useMemo(() => {
    const cfg = session.scheduleConfig
    if (!cfg?.enabled) return null
    const mins = cfg.intervalMs / 60000
    if (mins < 60) return `${mins}m`
    if (mins < 1440) return `${mins / 60}h`
    return `${mins / 1440}d`
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
        'rounded-[8px] border border-foreground/8 bg-background p-3 cursor-grab active:cursor-grabbing',
        'hover:border-foreground/15 hover:shadow-sm transition-all',
        'border-l-[3px]',
        borderColorClass,
        isDragging && 'opacity-40',
        isDragOverlay && 'shadow-lg rotate-[2deg] scale-[1.02]',
      )}
      style={{ ...(isDragOverlay ? {} : style), ...borderColorStyle }}
    >
      {/* Title */}
      <p className="text-[13px] font-medium text-foreground leading-snug line-clamp-2 mb-1">
        {title}
      </p>

      {/* Preview snippet */}
      {preview && session.name && (
        <p className="text-[11px] text-foreground/40 line-clamp-2 mb-2">
          {preview}
        </p>
      )}

      {/* Footer: time, processing, source badges */}
      <div className="flex items-center gap-2 mt-1">
        {timeAgo && (
          <span className="text-[10px] text-foreground/30">
            {timeAgo}
          </span>
        )}

        {session.isProcessing && (
          <Loader2 className="h-3 w-3 text-success animate-spin" />
        )}

        {scheduleBadge && (
          <span className="inline-flex items-center gap-0.5 text-[10px] text-foreground/40">
            <Timer className="h-2.5 w-2.5" />
            {scheduleBadge}
          </span>
        )}

        {/* Resume button for scheduled tasks in needs-review */}
        {session.scheduleConfig?.enabled && session.todoState === 'needs-review' && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              window.electronAPI.sessionCommand(session.id, { type: 'resumeScheduled' })
            }}
            className="inline-flex items-center gap-0.5 text-[10px] text-accent hover:text-accent/80 transition-colors"
          >
            <Play className="h-2.5 w-2.5" />
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
