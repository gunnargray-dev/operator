/**
 * PulsePage - Focused feed of task outputs (Linear-style)
 *
 * Clean centered feed showing task summaries, artifacts, and scheduled task status.
 */

import * as React from 'react'
import { useMemo, useEffect, useCallback } from 'react'
import { useAtomValue } from 'jotai'
import { formatDistanceToNow, isToday, isYesterday, isThisWeek, format, formatDistance } from 'date-fns'
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  FileCode,
  MoreHorizontal,
  MessageSquare,
  Activity,
  FileText,
  Globe,
  Table2,
  GitBranch,
  ExternalLink,
  Radio,
  Timer,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { sessionMetaMapAtom, type SessionMeta } from '@/atoms/sessions'
import { sessionArtifactsAtomFamily, setActiveArtifactAtom } from '@/atoms/artifacts'
import { useAppShellContext } from '@/context/AppShellContext'
import { navigate, routes } from '@/lib/navigate'
import * as storage from '@/lib/local-storage'
import type { AnyArtifact, ArtifactType } from '../../shared/artifact-types'
import { useSetAtom } from 'jotai'
import { atom } from 'jotai'

// =============================================================================
// Types
// =============================================================================

interface PulseItem {
  id: string
  sessionId: string
  title: string
  response: string
  timestamp: number
  status: 'completed' | 'running' | 'waiting' | 'scheduled'
  isNew: boolean
  filesChanged?: number
  meta: SessionMeta
  artifacts: AnyArtifact[]
  scheduledNextRun?: number
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

function getArtifactIcon(type: ArtifactType) {
  switch (type) {
    case 'html':
      return <Globe className="h-4 w-4" />
    case 'document':
      return <FileText className="h-4 w-4" />
    case 'spreadsheet':
      return <Table2 className="h-4 w-4" />
    case 'code':
      return <FileCode className="h-4 w-4" />
    case 'diagram':
      return <GitBranch className="h-4 w-4" />
    default:
      return <FileText className="h-4 w-4" />
  }
}

// =============================================================================
// StatusBadge - Inline status indicator
// =============================================================================

function StatusBadge({ status, nextRun }: { status: PulseItem['status']; nextRun?: number }) {
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] text-success font-medium">
        <CheckCircle2 className="h-3.5 w-3.5" />
        <span>Completed</span>
      </span>
    )
  }
  if (status === 'running') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] text-info font-medium">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>Running</span>
      </span>
    )
  }
  if (status === 'waiting') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] text-warning font-medium">
        <AlertCircle className="h-3.5 w-3.5" />
        <span>Needs input</span>
      </span>
    )
  }
  if (status === 'scheduled') {
    const nextRunText = nextRun
      ? `Next run in ${formatDistance(nextRun, Date.now())}`
      : 'Monitoring'
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] text-foreground/50 font-medium">
        <Timer className="h-3.5 w-3.5" />
        <span>{nextRunText}</span>
      </span>
    )
  }
  return null
}

// =============================================================================
// ArtifactCard - Clickable artifact preview
// =============================================================================

function ArtifactCard({
  artifact,
  onClick,
}: {
  artifact: AnyArtifact
  onClick: () => void
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className="group flex items-start gap-3 p-3 rounded-lg border border-foreground/10 bg-foreground/[0.02] hover:bg-foreground/[0.04] hover:border-foreground/15 transition-colors text-left w-full"
    >
      <div className="shrink-0 w-8 h-8 rounded-md bg-accent/10 flex items-center justify-center text-accent">
        {getArtifactIcon(artifact.type)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-accent/70 uppercase tracking-wider">
            {artifact.type}
          </span>
        </div>
        <p className="text-[13px] font-medium text-foreground truncate mt-0.5">
          {artifact.title}
        </p>
      </div>
      <ExternalLink className="h-3.5 w-3.5 text-foreground/30 group-hover:text-foreground/50 transition-colors shrink-0 mt-1" />
    </button>
  )
}

// =============================================================================
// PulseEntry - Single feed entry (Linear-style)
// =============================================================================

function PulseEntry({
  item,
  onClick,
  onArtifactClick,
}: {
  item: PulseItem
  onClick: () => void
  onArtifactClick: (artifact: AnyArtifact) => void
}) {
  const timeAgo = formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })

  return (
    <article
      className={cn(
        "group py-5 cursor-pointer transition-colors border-b border-foreground/[0.06]",
        "hover:bg-foreground/[0.015]",
        item.isNew && "relative"
      )}
      onClick={onClick}
    >
      {/* New indicator dot */}
      {item.isNew && (
        <div className="absolute left-0 top-7 w-1.5 h-1.5 rounded-full bg-accent" />
      )}

      <div className={cn("px-0", item.isNew && "pl-4")}>
        {/* Header: Title + More button */}
        <div className="flex items-start justify-between gap-4 mb-1.5">
          <h3 className="text-[15px] font-semibold text-foreground leading-snug">
            {item.title}
          </h3>
          <button
            onClick={(e) => {
              e.stopPropagation()
              // TODO: Add dropdown menu
            }}
            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-foreground/10 transition-opacity shrink-0"
          >
            <MoreHorizontal className="h-4 w-4 text-foreground/40" />
          </button>
        </div>

        {/* Metadata row: Status + Time */}
        <div className="flex items-center gap-3 mb-3">
          <StatusBadge status={item.status} nextRun={item.scheduledNextRun} />
          <span className="text-[11px] text-foreground/35">{timeAgo}</span>
        </div>

        {/* Artifacts */}
        {item.artifacts.length > 0 && (
          <div className="space-y-2 mb-4">
            {item.artifacts.map(artifact => (
              <ArtifactCard
                key={artifact.id}
                artifact={artifact}
                onClick={() => onArtifactClick(artifact)}
              />
            ))}
          </div>
        )}

        {/* Response content - truncated summary */}
        {item.response && item.artifacts.length === 0 && (
          <div className="text-[13px] text-foreground/60 leading-relaxed line-clamp-4">
            {item.response}
          </div>
        )}

        {/* Files changed indicator */}
        {item.filesChanged && item.filesChanged > 0 && (
          <div className="mt-3 flex items-center gap-2 text-[11px] text-foreground/40">
            <FileCode className="h-3.5 w-3.5" />
            <span>{item.filesChanged} file{item.filesChanged !== 1 ? 's' : ''} changed</span>
          </div>
        )}
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
    <div className="flex items-center gap-4 py-4">
      <span
        className={cn(
          "text-[11px] font-medium uppercase tracking-wider",
          isNewDivider ? "text-accent" : "text-foreground/30"
        )}
      >
        {label}
      </span>
      <div
        className={cn(
          "flex-1 h-px",
          isNewDivider
            ? "bg-gradient-to-r from-accent/30 to-transparent"
            : "bg-gradient-to-r from-foreground/8 to-transparent"
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
  const setActiveArtifact = useSetAtom(setActiveArtifactAtom)

  // Track last viewed timestamp
  const lastViewedAt = useMemo(() => {
    return storage.get<number>(storage.KEYS.lastPulseViewedAt, 0)
  }, [])

  // Update last viewed timestamp when page is viewed
  useEffect(() => {
    storage.set(storage.KEYS.lastPulseViewedAt, Date.now())
  }, [])

  // Get all session IDs for artifact lookup
  const sessionIds = useMemo(() => {
    return Array.from(sessionMetaMap.values())
      .filter(meta => meta.workspaceId === activeWorkspaceId)
      .map(meta => meta.id)
  }, [sessionMetaMap, activeWorkspaceId])

  // Build pulse items from sessions
  const pulseItems = useMemo((): PulseItem[] => {
    const items: PulseItem[] = []

    for (const meta of sessionMetaMap.values()) {
      if (meta.workspaceId !== activeWorkspaceId) continue
      if (!meta.lastMessageAt) continue

      let status: PulseItem['status'] = 'completed'
      let scheduledNextRun: number | undefined

      if (meta.isProcessing) {
        status = 'running'
      } else if (meta.lastMessageRole === 'plan') {
        status = 'waiting'
      } else if (meta.isScheduled || meta.scheduledAt) {
        status = 'scheduled'
        // Calculate next run time (mock for now - could be from meta.nextScheduledRun)
        if (meta.scheduledAt) {
          // If there's a scheduled time in the future, use it
          const now = Date.now()
          if (meta.scheduledAt > now) {
            scheduledNextRun = meta.scheduledAt
          } else {
            // Otherwise estimate next run (e.g., 2 hours from last run)
            scheduledNextRun = meta.lastMessageAt + (2 * 60 * 60 * 1000)
          }
        }
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
        artifacts: [], // Will be populated by component
        scheduledNextRun,
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

  // Handle artifact click
  const handleArtifactClick = useCallback((sessionId: string, artifact: AnyArtifact) => {
    setActiveArtifact(sessionId, artifact.id)
    navigate(routes.view.allChats(sessionId))
  }, [setActiveArtifact])

  // Count of new items
  const newCount = groupedItems.get('new')?.length || 0

  return (
    <div className="flex flex-col h-full">
      {/* Header - centered with max width */}
      <div className="shrink-0 pt-[52px] pb-6 border-b border-foreground/[0.06]">
        <div className="max-w-[680px] mx-auto px-6">
          <div className="flex items-center gap-3">
            <h1 className="text-[22px] font-semibold text-foreground">Pulse</h1>
            {newCount > 0 && (
              <span className="text-[11px] font-medium text-accent bg-accent/10 rounded-full px-2.5 py-1">
                {newCount} new
              </span>
            )}
          </div>
          <p className="text-[13px] text-foreground/40 mt-1">
            Recent task activity and outputs
          </p>
        </div>
      </div>

      {/* Feed - centered with max width */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="max-w-[680px] mx-auto px-6">
            {pulseItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-foreground/40">
                <Activity className="w-12 h-12 mb-4 opacity-20" />
                <p className="text-[15px] font-medium">No activity yet</p>
                <p className="text-[13px] opacity-50 mt-1">
                  Complete tasks to see them here
                </p>
              </div>
            ) : (
              <div className="pb-12">
                {(['new', 'today', 'yesterday', 'thisWeek', 'older'] as DateGroup[]).map(group => {
                  const items = groupedItems.get(group) || []
                  if (items.length === 0) return null

                  return (
                    <React.Fragment key={group}>
                      <DateDivider group={group} />
                      <div>
                        {items.map(item => (
                          <PulseEntryWithArtifacts
                            key={item.id}
                            item={item}
                            onClick={() => handleEntryClick(item.sessionId)}
                            onArtifactClick={(artifact) => handleArtifactClick(item.sessionId, artifact)}
                          />
                        ))}
                      </div>
                    </React.Fragment>
                  )
                })}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}

// =============================================================================
// PulseEntryWithArtifacts - Wrapper to load artifacts for each entry
// =============================================================================

function PulseEntryWithArtifacts({
  item,
  onClick,
  onArtifactClick,
}: {
  item: PulseItem
  onClick: () => void
  onArtifactClick: (artifact: AnyArtifact) => void
}) {
  // Get artifacts for this session
  const artifactsAtom = sessionArtifactsAtomFamily(item.sessionId)
  const artifacts = useAtomValue(artifactsAtom)

  // Merge artifacts into item
  const itemWithArtifacts = useMemo(() => ({
    ...item,
    artifacts,
  }), [item, artifacts])

  return (
    <PulseEntry
      item={itemWithArtifacts}
      onClick={onClick}
      onArtifactClick={onArtifactClick}
    />
  )
}
