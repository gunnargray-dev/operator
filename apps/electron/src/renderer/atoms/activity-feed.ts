import { atom } from 'jotai'

/**
 * Activity feed event - a session event enriched for display
 */
export interface ActivityFeedEvent {
  id: string
  sessionId: string
  type: string
  sessionName: string
  summary: string
  timestamp: number
  toolUseId?: string
  toolName?: string
  /** Key details extracted from tool input (e.g., search query, file path) */
  toolDetail?: string
}

/** Which session is currently displayed on the canvas graph */
export const selectedCanvasSessionIdAtom = atom<string | null>(null)

/** Maximum events stored in the feed */
const MAX_FEED_EVENTS = 200

/** Global activity feed atom - most recent first */
export const activityFeedAtom = atom<ActivityFeedEvent[]>([])

/**
 * Write-only atom to push a new event into the feed.
 * Keeps the list capped at MAX_FEED_EVENTS.
 */
export const pushActivityEventAtom = atom(
  null,
  (get, set, event: ActivityFeedEvent) => {
    const current = get(activityFeedAtom)
    const updated = [event, ...current].slice(0, MAX_FEED_EVENTS)
    set(activityFeedAtom, updated)
  }
)
