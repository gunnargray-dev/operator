/**
 * Browser State Management with Jotai
 *
 * Uses atomFamily to create isolated browser state per session.
 * Supports screenshot streaming and takeover/handback state machine.
 */

import { atom } from 'jotai'
import { atomFamily } from 'jotai-family'
import type { BrowserControlState } from '../../shared/types'

/**
 * Browser state for a session
 */
export interface BrowserState {
  /** Whether browser is active for this session */
  isActive: boolean
  /** Current URL */
  url: string
  /** Page title */
  title?: string
  /** Current control state (idle, agent, user) */
  controlState: BrowserControlState
  /** Latest screenshot (base64 PNG) */
  screenshot?: string
  /** Screenshot timestamp */
  screenshotAt?: number
  /** Error message if any */
  error?: string
  /** Viewport dimensions */
  viewport: { width: number; height: number }
}

/**
 * Default browser state
 */
const defaultBrowserState: BrowserState = {
  isActive: false,
  url: '',
  controlState: 'idle',
  viewport: { width: 1280, height: 720 },
}

/**
 * Atom family for browser state per session
 */
export const browserStateAtomFamily = atomFamily(
  (_sessionId: string) => atom<BrowserState>(defaultBrowserState),
  (a, b) => a === b
)

/**
 * Atom family for browser panel visibility per session
 */
export const browserPanelVisibleAtomFamily = atomFamily(
  (_sessionId: string) => atom<boolean>(false),
  (a, b) => a === b
)

/**
 * Action atom: update browser screenshot
 */
export const updateBrowserScreenshotAtom = atom(
  null,
  (get, set, sessionId: string, imageBase64: string, controlState: BrowserControlState) => {
    const stateAtom = browserStateAtomFamily(sessionId)
    const state = get(stateAtom)
    set(stateAtom, {
      ...state,
      screenshot: imageBase64,
      screenshotAt: Date.now(),
      controlState,
      isActive: true,
    })
    // Auto-show browser panel when screenshot arrives
    set(browserPanelVisibleAtomFamily(sessionId), true)
  }
)

/**
 * Action atom: update browser navigation
 */
export const updateBrowserNavigationAtom = atom(
  null,
  (get, set, sessionId: string, url: string, title?: string) => {
    const stateAtom = browserStateAtomFamily(sessionId)
    const state = get(stateAtom)
    set(stateAtom, {
      ...state,
      url,
      title,
      isActive: true,
    })
  }
)

/**
 * Action atom: update browser control state
 */
export const updateBrowserControlStateAtom = atom(
  null,
  (get, set, sessionId: string, controlState: BrowserControlState) => {
    const stateAtom = browserStateAtomFamily(sessionId)
    const state = get(stateAtom)
    set(stateAtom, {
      ...state,
      controlState,
    })
  }
)

/**
 * Action atom: close browser
 */
export const closeBrowserAtom = atom(
  null,
  (_get, set, sessionId: string) => {
    set(browserStateAtomFamily(sessionId), defaultBrowserState)
    set(browserPanelVisibleAtomFamily(sessionId), false)
  }
)

/**
 * Action atom: set browser error
 */
export const setBrowserErrorAtom = atom(
  null,
  (get, set, sessionId: string, error: string) => {
    const stateAtom = browserStateAtomFamily(sessionId)
    const state = get(stateAtom)
    set(stateAtom, {
      ...state,
      error,
    })
  }
)

/**
 * Action atom: toggle browser panel visibility
 */
export const toggleBrowserPanelAtom = atom(
  null,
  (get, set, sessionId: string) => {
    const visibleAtom = browserPanelVisibleAtomFamily(sessionId)
    const visible = get(visibleAtom)
    set(visibleAtom, !visible)
  }
)

/**
 * Action atom: clean up browser state when session is deleted
 */
export const cleanupSessionBrowserAtom = atom(
  null,
  (_get, _set, sessionId: string) => {
    browserStateAtomFamily.remove(sessionId)
    browserPanelVisibleAtomFamily.remove(sessionId)
  }
)

// HMR: Force full page refresh when this file changes.
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    import.meta.hot?.invalidate()
  })
}
