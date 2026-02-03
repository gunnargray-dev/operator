/**
 * TaskScheduler - Autonomous task scheduling service
 *
 * Manages recurring execution of scheduled sessions (tasks).
 * Lives in the main process as a singleton, survives window close.
 *
 * Lifecycle:
 * 1. Tasks (backlog) → timer fires → Active (todo) → agent runs
 * 2. Agent completes → Done → scheduler reschedules back to Tasks after interval
 * 3. Agent needs permission → Needs Input → user responds → Active
 * 4. Agent errors → increment errorCount → retry or disable
 */

import type { ScheduleConfig } from '@craft-agent/shared/sessions'

// Forward reference — SessionManager is passed in constructor
type SessionManager = {
  getSessions(): Array<{ id: string; todoState?: string; scheduleConfig?: ScheduleConfig }>
  setTodoState(sessionId: string, state: string): Promise<void>
  sendMessage(sessionId: string, message: string): Promise<void>
  getSession(sessionId: string): Promise<{ id: string; todoState?: string; scheduleConfig?: ScheduleConfig } | null>
  updateScheduleConfig(sessionId: string, config: ScheduleConfig): void
}

interface DeferredExecution {
  sessionId: string
  timer: ReturnType<typeof setTimeout>
}

const schedulerLog = {
  info: (...args: unknown[]) => console.log('[scheduler]', ...args),
  warn: (...args: unknown[]) => console.warn('[scheduler]', ...args),
  error: (...args: unknown[]) => console.error('[scheduler]', ...args),
}

export class TaskScheduler {
  /** Per-session recurring timers */
  private timers = new Map<string, ReturnType<typeof setInterval>>()
  /** Sessions currently executing */
  private activeExecutions = new Set<string>()
  /** Deferred executions waiting for a concurrency slot */
  private deferred = new Map<string, DeferredExecution>()
  /** Max concurrent scheduled task executions */
  private maxConcurrent = 2
  /** Reference to the session manager */
  private sessionManager: SessionManager

  constructor(sessionManager: SessionManager) {
    this.sessionManager = sessionManager
  }

  /**
   * Initialize scheduler on app startup.
   * Rebuilds timers from persisted scheduleConfig on all sessions.
   */
  initialize(): void {
    const sessions = this.sessionManager.getSessions()

    for (const session of sessions) {
      if (!session.scheduleConfig?.enabled) continue

      // Only schedule sessions that are in backlog (Tasks) state
      if (session.todoState === 'backlog') {
        this.scheduleSession(session.id, session.scheduleConfig)
      }

      // Stuck detection: if a session is in 'todo' (Active) with schedule
      // but no agent is running, return it to backlog
      if (session.todoState === 'todo') {
        schedulerLog.info(`Stuck scheduled task detected: ${session.id}, returning to backlog`)
        void this.sessionManager.setTodoState(session.id, 'backlog')
        this.scheduleSession(session.id, session.scheduleConfig)
      }
    }

    schedulerLog.info(`Initialized with ${this.timers.size} scheduled tasks`)
  }

  /**
   * Schedule a session for recurring execution.
   * Sets up a timer based on the interval and last execution time.
   */
  scheduleSession(sessionId: string, config: ScheduleConfig): void {
    // Clear any existing timer
    this.unscheduleSession(sessionId)

    if (!config.enabled) return

    // Calculate delay until next execution
    const now = Date.now()
    const lastRun = config.lastExecutedAt || 0
    const elapsed = now - lastRun
    const delay = Math.max(0, config.intervalMs - elapsed)

    schedulerLog.info(
      `Scheduling ${sessionId}: interval=${config.intervalMs}ms, ` +
      `next run in ${Math.round(delay / 1000)}s`
    )

    // First execution after delay, then recurring
    const firstTimer = setTimeout(() => {
      void this.executeScheduledTask(sessionId)

      // Set up recurring interval after first execution
      const interval = setInterval(() => {
        void this.executeScheduledTask(sessionId)
      }, config.intervalMs)

      this.timers.set(sessionId, interval)
    }, delay)

    // Store the initial timeout as the timer (will be replaced by interval)
    this.timers.set(sessionId, firstTimer as unknown as ReturnType<typeof setInterval>)
  }

  /**
   * Remove a session from the schedule.
   */
  unscheduleSession(sessionId: string): void {
    const timer = this.timers.get(sessionId)
    if (timer) {
      clearInterval(timer)
      clearTimeout(timer as unknown as ReturnType<typeof setTimeout>)
      this.timers.delete(sessionId)
    }

    // Also clear any deferred execution
    const deferred = this.deferred.get(sessionId)
    if (deferred) {
      clearTimeout(deferred.timer)
      this.deferred.delete(sessionId)
    }

    this.activeExecutions.delete(sessionId)
  }

  /**
   * Execute a scheduled task.
   * Checks concurrency, transitions state, and sends the prompt.
   */
  private async executeScheduledTask(sessionId: string): Promise<void> {
    // Don't double-execute
    if (this.activeExecutions.has(sessionId)) {
      schedulerLog.info(`Task ${sessionId} already executing, skipping`)
      return
    }

    // Check concurrency limit
    if (this.activeExecutions.size >= this.maxConcurrent) {
      schedulerLog.info(`Concurrency limit reached (${this.maxConcurrent}), deferring ${sessionId}`)
      this.deferExecution(sessionId)
      return
    }

    const session = await this.sessionManager.getSession(sessionId)
    if (!session?.scheduleConfig?.enabled) {
      schedulerLog.warn(`Task ${sessionId} no longer scheduled, skipping`)
      this.unscheduleSession(sessionId)
      return
    }

    const config = session.scheduleConfig

    schedulerLog.info(`Executing scheduled task: ${sessionId}`)
    this.activeExecutions.add(sessionId)

    try {
      // Transition backlog → active
      await this.sessionManager.setTodoState(sessionId, 'todo')

      // Send the scheduled prompt
      await this.sessionManager.sendMessage(sessionId, config.prompt)
    } catch (error) {
      schedulerLog.error(`Failed to execute task ${sessionId}:`, error)
      this.activeExecutions.delete(sessionId)

      // Handle error — increment count and potentially disable
      const newErrorCount = (config.errorCount || 0) + 1
      const maxErrors = config.maxErrors || 5

      const updatedConfig: ScheduleConfig = {
        ...config,
        errorCount: newErrorCount,
        lastExecutedAt: Date.now(),
      }

      if (newErrorCount >= maxErrors) {
        schedulerLog.warn(`Task ${sessionId} hit max errors (${maxErrors}), disabling`)
        updatedConfig.enabled = false
        this.unscheduleSession(sessionId)
        await this.sessionManager.setTodoState(sessionId, 'needs-review')
      } else {
        // Return to backlog for retry on next interval
        await this.sessionManager.setTodoState(sessionId, 'backlog')
      }

      this.sessionManager.updateScheduleConfig(sessionId, updatedConfig)
    }
  }

  /**
   * Defer an execution until a concurrency slot opens.
   * Re-checks every 10 seconds.
   */
  private deferExecution(sessionId: string): void {
    // Don't create duplicate deferred entries
    if (this.deferred.has(sessionId)) return

    const timer = setTimeout(() => {
      this.deferred.delete(sessionId)
      void this.executeScheduledTask(sessionId)
    }, 10_000)

    this.deferred.set(sessionId, { sessionId, timer })
  }

  /**
   * Called when a scheduled task completes successfully.
   * Updates config, transitions to done, and reschedules.
   */
  onTaskCompleted(sessionId: string): void {
    this.activeExecutions.delete(sessionId)
    this.checkDeferredExecutions()

    // The session is now in 'done' state (set by auto-transition logic in SessionManager)
    // After the interval, the scheduler will move it back to backlog

    // We don't need to reschedule here — the existing interval timer
    // will fire again and executeScheduledTask will handle the transition
    schedulerLog.info(`Task ${sessionId} completed`)
  }

  /**
   * Called when a scheduled task encounters an error.
   */
  onTaskError(sessionId: string): void {
    this.activeExecutions.delete(sessionId)
    this.checkDeferredExecutions()
    schedulerLog.info(`Task ${sessionId} errored`)
  }

  /**
   * Called when a scheduled task needs user input (permission/auth).
   * The agent is paused — we just mark it and wait.
   */
  onTaskNeedsInput(sessionId: string): void {
    // Keep in activeExecutions — the agent is still alive, just paused
    // The session has been transitioned to 'needs-review' by auto-transition logic
    schedulerLog.info(`Task ${sessionId} needs user input`)
  }

  /**
   * Called when user responds to a paused task and it resumes.
   */
  onTaskResumed(sessionId: string): void {
    schedulerLog.info(`Task ${sessionId} resumed by user`)
    // The agent picks up where it left off — no action needed from scheduler
  }

  /**
   * Check if any deferred executions can now run.
   */
  private checkDeferredExecutions(): void {
    if (this.activeExecutions.size >= this.maxConcurrent) return

    for (const [sessionId, deferred] of this.deferred) {
      clearTimeout(deferred.timer)
      this.deferred.delete(sessionId)
      void this.executeScheduledTask(sessionId)

      if (this.activeExecutions.size >= this.maxConcurrent) break
    }
  }

  /**
   * Get the number of currently active executions.
   */
  get activeCount(): number {
    return this.activeExecutions.size
  }

  /**
   * Get the number of scheduled sessions.
   */
  get scheduledCount(): number {
    return this.timers.size
  }

  /**
   * Check if a session is currently executing.
   */
  isExecuting(sessionId: string): boolean {
    return this.activeExecutions.has(sessionId)
  }

  /**
   * Shutdown — clear all timers.
   */
  shutdown(): void {
    schedulerLog.info('Shutting down scheduler')
    for (const [sessionId] of this.timers) {
      this.unscheduleSession(sessionId)
    }
    for (const [, deferred] of this.deferred) {
      clearTimeout(deferred.timer)
    }
    this.deferred.clear()
    this.activeExecutions.clear()
  }
}
