/**
 * PulsePage - Focused feed of task outputs (Linear-style)
 *
 * Clean inline feed showing task responses and files generated.
 * No cards - just content with date dividers.
 */

import * as React from 'react'
import { useMemo, useEffect, useCallback } from 'react'
import { useAtomValue } from 'jotai'
import { formatDistanceToNow, isToday, isYesterday, isThisWeek, format } from 'date-fns'
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  FileCode,
  MoreHorizontal,
  MessageSquare,
  Activity,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { sessionMetaMapAtom, type SessionMeta } from '@/atoms/sessions'
import { useAppShellContext } from '@/context/AppShellContext'
import { navigate, routes } from '@/lib/navigate'
import * as storage from '@/lib/local-storage'

// =============================================================================
// Types
// =============================================================================

interface PulseItem {
  id: string
  sessionId: string
  title: string
  response: string
  timestamp: number
  status: 'completed' | 'running' | 'waiting'
  isNew: boolean
  filesChanged?: number
  meta: SessionMeta
}

type DateGroup = 'new' | 'today' | 'yesterday' | 'thisWeek' | 'older'

// =============================================================================
// Helper Functions
// =============================================================================

function getDateGroup(timestamp: number, lastViewedAt: number): DateGroup {
  if (timestamp > lastViewedAt) {
    return 'new'
  }
  const date = new Date(timestamp)
  if (isToday(date)) return 'today'
  if (isYesterday(date)) return 'yesterday'
  if (isThisWeek(date)) return 'thisWeek'
  return 'older'
}

function getDateGroupLabel(group: DateGroup): string {
  switch (group) {
    case 'new': return 'New'
    case 'today': return 'Today'
    case 'yesterday': return 'Yesterday'
    case 'thisWeek': return 'This week'
    case 'older': return 'Older'
  }
}

// =============================================================================
// StatusBadge - Inline status indicator
// =============================================================================

function StatusBadge({ status }: { status: PulseItem['status'] }) {
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 text-[12px] text-success">
        <CheckCircle2 className="h-3.5 w-3.5" />
        <span>Completed</span>
      </span>
    )
  }
  if (status === 'running') {
    return (
      <span className="inline-flex items-center gap-1 text-[12px] text-info">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>Running</span>
      </span>
    )
  }
  if (status === 'waiting') {
    return (
      <span className="inline-flex items-center gap-1 text-[12px] text-warning">
        <AlertCircle className="h-3.5 w-3.5" />
        <span>Needs input</span>
      </span>
    )
  }
  return null
}

// =============================================================================
// PulseEntry - Single feed entry (Linear-style)
// =============================================================================

function PulseEntry({
  item,
  onClick,
}: {
  item: PulseItem
  onClick: () => void
}) {
  const timeAgo = formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })

  return (
    <article
      className={cn(
        "group py-6 cursor-pointer transition-colors",
        "hover:bg-foreground/[0.02]",
        item.isNew && "relative"
      )}
      onClick={onClick}
    >
      {/* New indicator dot */}
      {item.isNew && (
        <div className="absolute left-0 top-8 w-2 h-2 rounded-full bg-accent" />
      )}

      <div className={cn("px-6", item.isNew && "pl-8")}>
        {/* Header: Title + More button */}
        <div className="flex items-start justify-between gap-4 mb-2">
          <h3 className="text-[15px] font-semibold text-foreground leading-snug">
            {item.title}
          </h3>
          <button
            onClick={(e) => {
              e.stopPropagation()
              // TODO: Add dropdown menu
            }}
            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-foreground/10 transition-opacity"
          >
            <MoreHorizontal className="h-4 w-4 text-foreground/50" />
          </button>
        </div>

        {/* Metadata row: Status + Time */}
        <div className="flex items-center gap-3 mb-4">
          <StatusBadge status={item.status} />
          <span className="text-[12px] text-foreground/40">{timeAgo}</span>
        </div>

        {/* Response content */}
        {item.response && (
          <div className="text-[14px] text-foreground/80 leading-relaxed whitespace-pre-wrap">
            {item.response}
          </div>
        )}

        {/* Files changed indicator */}
        {item.filesChanged && item.filesChanged > 0 && (
          <div className="mt-4 flex items-center gap-2 text-[12px] text-foreground/50">
            <FileCode className="h-3.5 w-3.5" />
            <span>{item.filesChanged} file{item.filesChanged !== 1 ? 's' : ''} changed</span>
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onClick()
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] text-foreground/60 hover:text-foreground hover:bg-foreground/5 transition-colors"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            View
          </button>
        </div>
      </div>
    </article>
  )
}

// =============================================================================
// DateDivider - Visual separator for date groups (Linear-style)
// =============================================================================

function DateDivider({ group }: { group: DateGroup }) {
  const label = getDateGroupLabel(group)
  const isNewDivider = group === 'new'

  return (
    <div className="flex items-center gap-4 px-6 py-3">
      <span
        className={cn(
          "text-[12px] font-medium",
          isNewDivider ? "text-accent" : "text-foreground/40"
        )}
      >
        {label}
      </span>
      <div
        className={cn(
          "flex-1 h-px",
          isNewDivider
            ? "bg-gradient-to-r from-accent/40 to-transparent"
            : "bg-gradient-to-r from-foreground/10 to-transparent"
        )}
      />
    </div>
  )
}

// =============================================================================
// PulsePage - Main Component
// =============================================================================

export default function PulsePage() {
  const sessionMetaMap = useAtomValue(sessionMetaMapAtom)
  const { activeWorkspaceId } = useAppShellContext()

  // Track last viewed timestamp
  const lastViewedAt = useMemo(() => {
    return storage.get<number>(storage.KEYS.lastPulseViewedAt, 0)
  }, [])

  // Update last viewed timestamp when page is viewed
  useEffect(() => {
    storage.set(storage.KEYS.lastPulseViewedAt, Date.now())
  }, [])

  // Build pulse items from sessions
  const pulseItems = useMemo((): PulseItem[] => {
    const items: PulseItem[] = []

    for (const meta of sessionMetaMap.values()) {
      if (meta.workspaceId !== activeWorkspaceId) continue
      if (!meta.lastMessageAt) continue

      let status: PulseItem['status'] = 'completed'
      if (meta.isProcessing) {
        status = 'running'
      } else if (meta.lastMessageRole === 'plan') {
        status = 'waiting'
      }

      // Get the response preview
      const response = meta.lastAssistantPreview || ''

      items.push({
        id: meta.id,
        sessionId: meta.id,
        title: meta.name || meta.preview || 'Untitled Task',
        response,
        timestamp: meta.lastMessageAt,
        status,
        isNew: meta.lastMessageAt > lastViewedAt,
        filesChanged: meta.filesChanged,
        meta,
      })
    }

    // Sort by timestamp descending
    items.sort((a, b) => b.timestamp - a.timestamp)

    return items
  }, [sessionMetaMap, activeWorkspaceId, lastViewedAt])

  // Group items by date
  const groupedItems = useMemo(() => {
    const groups = new Map<DateGroup, PulseItem[]>()
    const order: DateGroup[] = ['new', 'today', 'yesterday', 'thisWeek', 'older']

    for (const group of order) {
      groups.set(group, [])
    }

    for (const item of pulseItems) {
      const group = getDateGroup(item.timestamp, lastViewedAt)
      groups.get(group)!.push(item)
    }

    return groups
  }, [pulseItems, lastViewedAt])

  // Handle entry click
  const handleEntryClick = useCallback((sessionId: string) => {
    navigate(routes.view.allChats(sessionId))
  }, [])

  // Count of new items
  const newCount = groupedItems.get('new')?.length || 0

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-6 pt-[52px] pb-4 border-b border-foreground/5">
        <div className="flex items-center gap-3">
          <h1 className="text-[18px] font-semibold text-foreground">Pulse</h1>
          {newCount > 0 && (
            <span className="text-[12px] font-medium text-accent bg-accent/10 rounded-full px-2 py-0.5">
              {newCount} new
            </span>
          )}
        </div>
        <p className="text-[13px] text-foreground/50 mt-1">
          Recent task activity and responses
        </p>
      </div>

      {/* Feed */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="h-full">
          {pulseItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-foreground/40">
              <Activity className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-[14px] font-medium">No activity yet</p>
              <p className="text-[13px] opacity-60 mt-1">
                Complete tasks to see them here
              </p>
            </div>
          ) : (
            <div className="pb-8">
              {(['new', 'today', 'yesterday', 'thisWeek', 'older'] as DateGroup[]).map(group => {
                const items = groupedItems.get(group) || []
                if (items.length === 0) return null

                return (
                  <React.Fragment key={group}>
                    <DateDivider group={group} />
                    <div className="divide-y divide-foreground/5">
                      {items.map(item => (
                        <PulseEntry
                          key={item.id}
                          item={item}
                          onClick={() => handleEntryClick(item.sessionId)}
                        />
                      ))}
                    </div>
                  </React.Fragment>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  )
}
