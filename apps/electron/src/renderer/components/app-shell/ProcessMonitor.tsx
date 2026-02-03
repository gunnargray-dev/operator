/**
 * ProcessMonitor - Card-based view of all active processes
 *
 * Shows stacked cards for all active processes across all sessions:
 * - Running agents with current step
 * - Scheduled tasks with next run time
 * - Tasks waiting for user input
 *
 * Provides quick actions: Stop, View, Run Now
 */

import { useMemo } from "react"
import { formatDistanceToNow } from "date-fns"
import {
  Square,
  Play,
  Loader2,
  Clock,
  AlertCircle,
  Activity,
  Zap,
  CheckCircle2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { getSessionTitle } from "@/utils/session"
import type { SessionMeta } from "@/atoms/sessions"

interface ProcessMonitorProps {
  /** All sessions to monitor */
  sessions: SessionMeta[]
  /** Called when user wants to view a session */
  onViewSession?: (sessionId: string) => void
  /** Called when user wants to stop a session */
  onStopSession?: (sessionId: string) => void
  /** Called when user wants to run a scheduled session now */
  onRunNow?: (sessionId: string) => void
}

type ProcessStatus = 'running' | 'scheduled' | 'waiting' | 'completed'

interface ProcessInfo {
  id: string
  name: string
  status: ProcessStatus
  currentStep?: string
  startedAt?: number
  scheduledTime?: string
  sessionMeta: SessionMeta
}

/**
 * Format duration in human readable format
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}


/**
 * ProcessCard - Single card for a process (matches SessionCard styling)
 */
function ProcessCard({
  process,
  onView,
  onStop,
  onRunNow
}: {
  process: ProcessInfo
  onView?: () => void
  onStop?: () => void
  onRunNow?: () => void
}) {
  const timeAgo = process.sessionMeta.lastMessageAt
    ? formatDistanceToNow(new Date(process.sessionMeta.lastMessageAt), { addSuffix: false })
    : null

  return (
    <button
      onClick={onView}
      className={cn(
        "w-full text-left rounded-lg border p-3 transition-colors",
        process.status === 'running'
          ? "border-success/20 bg-success/[0.02] animate-card-shimmer"
          : "border-foreground/8 bg-foreground/[0.02] hover:border-foreground/15 hover:bg-foreground/[0.04]"
      )}
    >
      {/* Status badge row */}
      <div className="flex items-center gap-2 mb-2">
        {process.status === 'running' && (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-success bg-success/10 rounded px-1.5 py-0.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            RUNNING
          </span>
        )}
        {process.status === 'waiting' && (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-warning bg-warning/10 rounded px-1.5 py-0.5">
            <AlertCircle className="h-3 w-3" />
            NEEDS INPUT
          </span>
        )}
        {process.status === 'scheduled' && (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-info bg-info/10 rounded px-1.5 py-0.5">
            <Clock className="h-3 w-3" />
            SCHEDULED
          </span>
        )}
        {process.status === 'completed' && (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-foreground/50 bg-foreground/5 rounded px-1.5 py-0.5">
            <CheckCircle2 className="h-3 w-3" />
            DONE
          </span>
        )}

        {/* Duration for running tasks */}
        {process.status === 'running' && process.startedAt && (
          <span className="text-[10px] text-foreground/40 tabular-nums ml-auto">
            {formatDuration(Date.now() - process.startedAt)}
          </span>
        )}
      </div>

      {/* Task name */}
      <div className="mb-2">
        <p className="text-[13px] font-medium text-foreground leading-snug line-clamp-2">
          {process.name}
        </p>
        {/* Current step / activity */}
        {process.currentStep && (
          <p className="text-[11px] text-foreground/40 truncate mt-0.5">
            {process.currentStep}
          </p>
        )}
      </div>

      {/* Status-specific messages */}
      {process.status === 'running' && !process.currentStep && (
        <p className="text-[11px] text-foreground/40 mb-2">
          Processing...
        </p>
      )}
      {process.status === 'waiting' && (
        <p className="text-[11px] text-foreground/40 mb-2">
          Waiting for your response...
        </p>
      )}
      {process.status === 'scheduled' && process.scheduledTime && (
        <p className="text-[11px] text-foreground/40 mb-2">
          Next run at {process.scheduledTime}
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
        {process.status === 'running' && onStop && (
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
        {process.status === 'scheduled' && onRunNow && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRunNow()
            }}
            className="inline-flex items-center gap-1 text-[10px] text-success/70 hover:text-success transition-colors"
          >
            <Play className="h-3 w-3" />
            Run Now
          </button>
        )}
        {process.status === 'waiting' && (
          <span className="inline-flex items-center gap-1 text-[10px] text-warning/70">
            <Zap className="h-3 w-3" />
            Respond
          </span>
        )}
      </div>
    </button>
  )
}

/**
 * ProcessMonitor - Card-based view of all active processes
 */
export function ProcessMonitor({
  sessions,
  onViewSession,
  onStopSession,
  onRunNow,
}: ProcessMonitorProps) {
  // Collect all active processes from sessions
  const { running, waiting, scheduled, completed } = useMemo(() => {
    const running: ProcessInfo[] = []
    const waiting: ProcessInfo[] = []
    const scheduled: ProcessInfo[] = []
    const completed: ProcessInfo[] = []

    // Time threshold for "recently completed" - last 10 minutes
    const recentThreshold = Date.now() - 10 * 60 * 1000

    for (const session of sessions) {
      // Running sessions
      if (session.isProcessing) {
        running.push({
          id: session.id,
          name: getSessionTitle(session),
          status: 'running',
          currentStep: session.currentStep,
          startedAt: session.processingStartedAt,
          sessionMeta: session,
        })
      }
      // Scheduled sessions
      else if (session.scheduleConfig?.enabled) {
        scheduled.push({
          id: session.id,
          name: getSessionTitle(session),
          status: 'scheduled',
          scheduledTime: session.scheduleConfig.time,
          sessionMeta: session,
        })
      }
      // Waiting for input (plan)
      else if (session.lastMessageRole === 'plan') {
        waiting.push({
          id: session.id,
          name: getSessionTitle(session),
          status: 'waiting',
          sessionMeta: session,
        })
      }
      // Recently completed sessions (has activity in last 10 min)
      else if (session.lastMessageAt && session.lastMessageAt > recentThreshold) {
        completed.push({
          id: session.id,
          name: getSessionTitle(session),
          status: 'completed',
          sessionMeta: session,
        })
      }
    }

    // Sort completed by most recent first, limit to 5
    completed.sort((a, b) => (b.sessionMeta.lastMessageAt ?? 0) - (a.sessionMeta.lastMessageAt ?? 0))
    completed.splice(5)

    return { running, waiting, scheduled, completed }
  }, [sessions])

  const totalCount = running.length + waiting.length + scheduled.length + completed.length

  if (totalCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <Activity className="w-12 h-12 mb-3 opacity-20" />
        <p className="text-sm font-medium">No active processes</p>
        <p className="text-xs opacity-60 mt-1">Start a task using the input below</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex-1 p-4 space-y-4">
        {/* Running Section */}
        {running.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <span className="text-[10px] font-medium text-foreground/50 uppercase tracking-wider">
                Running
              </span>
              <span className="text-[10px] text-foreground/30">
                {running.length}
              </span>
            </div>
            <div className="space-y-2">
              {running.map(process => (
                <ProcessCard
                  key={process.id}
                  process={process}
                  onView={onViewSession ? () => onViewSession(process.id) : undefined}
                  onStop={onStopSession ? () => onStopSession(process.id) : undefined}
                />
              ))}
            </div>
          </div>
        )}

        {/* Waiting Section */}
        {waiting.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="w-1.5 h-1.5 rounded-full bg-warning" />
              <span className="text-[10px] font-medium text-foreground/50 uppercase tracking-wider">
                Needs Input
              </span>
              <span className="text-[10px] text-foreground/30">
                {waiting.length}
              </span>
            </div>
            <div className="space-y-2">
              {waiting.map(process => (
                <ProcessCard
                  key={process.id}
                  process={process}
                  onView={onViewSession ? () => onViewSession(process.id) : undefined}
                />
              ))}
            </div>
          </div>
        )}

        {/* Scheduled Section */}
        {scheduled.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="w-1.5 h-1.5 rounded-full bg-info" />
              <span className="text-[10px] font-medium text-foreground/50 uppercase tracking-wider">
                Scheduled
              </span>
              <span className="text-[10px] text-foreground/30">
                {scheduled.length}
              </span>
            </div>
            <div className="space-y-2">
              {scheduled.map(process => (
                <ProcessCard
                  key={process.id}
                  process={process}
                  onView={onViewSession ? () => onViewSession(process.id) : undefined}
                  onRunNow={onRunNow ? () => onRunNow(process.id) : undefined}
                />
              ))}
            </div>
          </div>
        )}

        {/* Recently Completed Section */}
        {completed.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="w-1.5 h-1.5 rounded-full bg-foreground/30" />
              <span className="text-[10px] font-medium text-foreground/50 uppercase tracking-wider">
                Recently Done
              </span>
              <span className="text-[10px] text-foreground/30">
                {completed.length}
              </span>
            </div>
            <div className="space-y-2">
              {completed.map(process => (
                <ProcessCard
                  key={process.id}
                  process={process}
                  onView={onViewSession ? () => onViewSession(process.id) : undefined}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
