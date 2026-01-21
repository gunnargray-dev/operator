/**
 * BrowserPanel - Live browser preview with takeover/handback
 *
 * Displays screenshots from the agent-controlled browser.
 * Supports user takeover for manual interaction.
 */

import * as React from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  browserStateAtomFamily,
  browserPanelVisibleAtomFamily,
  toggleBrowserPanelAtom,
} from '@/atoms/browser'
import { PanelHeader } from '../app-shell/PanelHeader'
import type { BrowserControlState, BrowserCommand } from '../../../shared/types'
import { Globe, Hand, Bot, RefreshCw, X, ExternalLink, Maximize2 } from 'lucide-react'
import { Button } from '../ui/button'
import { cn } from '@/lib/utils'

export interface BrowserPanelProps {
  /** Session ID */
  sessionId?: string
  /** Actions element (e.g., close button) */
  actions?: React.ReactNode
}

/**
 * Control state display
 */
function ControlStateIndicator({ state }: { state: BrowserControlState }) {
  const config = {
    idle: { icon: Globe, label: 'Idle', className: 'text-muted-foreground' },
    agent: { icon: Bot, label: 'Agent Control', className: 'text-blue-500' },
    user: { icon: Hand, label: 'Your Control', className: 'text-green-500' },
  }[state]

  const Icon = config.icon

  return (
    <div className={cn('flex items-center gap-1.5 text-xs', config.className)}>
      <Icon className="h-3 w-3" />
      <span>{config.label}</span>
    </div>
  )
}

/**
 * Browser panel with live screenshot and controls
 */
export function BrowserPanel({ sessionId, actions }: BrowserPanelProps) {
  const browserState = useAtomValue(browserStateAtomFamily(sessionId || ''))
  const togglePanel = useSetAtom(toggleBrowserPanelAtom)
  const imageRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  // Calculate scale to fit screenshot in container
  useEffect(() => {
    if (!containerRef.current || !browserState.screenshot) return

    const updateScale = () => {
      const container = containerRef.current
      if (!container) return

      const containerWidth = container.clientWidth
      const containerHeight = container.clientHeight
      const imageWidth = browserState.viewport.width
      const imageHeight = browserState.viewport.height

      const scaleX = containerWidth / imageWidth
      const scaleY = containerHeight / imageHeight
      setScale(Math.min(scaleX, scaleY, 1))
    }

    updateScale()
    const resizeObserver = new ResizeObserver(updateScale)
    resizeObserver.observe(containerRef.current)

    return () => resizeObserver.disconnect()
  }, [browserState.screenshot, browserState.viewport])

  // Handle click on screenshot (when in user control mode)
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLImageElement>) => {
      if (!sessionId || browserState.controlState !== 'user') return

      const rect = e.currentTarget.getBoundingClientRect()
      const x = Math.round((e.clientX - rect.left) / scale)
      const y = Math.round((e.clientY - rect.top) / scale)

      const command: BrowserCommand = { type: 'click', x, y }
      window.electronAPI?.browserCommand?.(sessionId, command)
    },
    [sessionId, browserState.controlState, scale]
  )

  // Handle keyboard input (when in user control mode)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!sessionId || browserState.controlState !== 'user') return

      // Prevent default for most keys when in user control
      if (!e.metaKey && !e.ctrlKey) {
        e.preventDefault()
      }

      const command: BrowserCommand = {
        type: 'keypress',
        key: e.key,
        modifiers: [
          e.shiftKey && 'Shift',
          e.ctrlKey && 'Control',
          e.altKey && 'Alt',
          e.metaKey && 'Meta',
        ].filter(Boolean) as string[],
      }
      window.electronAPI?.browserCommand?.(sessionId, command)
    },
    [sessionId, browserState.controlState]
  )

  // Handle takeover
  const handleTakeover = useCallback(() => {
    if (!sessionId) return
    const command: BrowserCommand = { type: 'takeover' }
    window.electronAPI?.browserCommand?.(sessionId, command)
  }, [sessionId])

  // Handle handback
  const handleHandback = useCallback(() => {
    if (!sessionId) return
    const command: BrowserCommand = { type: 'handback' }
    window.electronAPI?.browserCommand?.(sessionId, command)
  }, [sessionId])

  // Handle close
  const handleClose = useCallback(() => {
    if (!sessionId) return
    const command: BrowserCommand = { type: 'close' }
    window.electronAPI?.browserCommand?.(sessionId, command)
  }, [sessionId])

  if (!sessionId) {
    return (
      <div className="h-full flex flex-col">
        <PanelHeader title="Browser" actions={actions} />
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <p className="text-sm">No session selected</p>
        </div>
      </div>
    )
  }

  if (!browserState.isActive) {
    return (
      <div className="h-full flex flex-col">
        <PanelHeader title="Browser" actions={actions} />
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center p-4">
            <Globe className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No browser active</p>
            <p className="text-xs mt-1">
              Ask Claude to browse the web or navigate to a URL
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <PanelHeader title="Browser" actions={actions} />

      {/* URL bar and controls */}
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border bg-muted/30">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 px-2 py-1 rounded bg-background text-xs">
            <Globe className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="truncate" title={browserState.url}>
              {browserState.url || 'about:blank'}
            </span>
          </div>
        </div>

        <ControlStateIndicator state={browserState.controlState} />

        {browserState.controlState === 'agent' ? (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={handleTakeover}
          >
            <Hand className="h-3 w-3 mr-1" />
            Take Control
          </Button>
        ) : browserState.controlState === 'user' ? (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={handleHandback}
          >
            <Bot className="h-3 w-3 mr-1" />
            Hand Back
          </Button>
        ) : null}

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleClose}
          title="Close browser"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Screenshot display */}
      <div
        ref={containerRef}
        className={cn(
          'flex-1 overflow-hidden bg-black flex items-center justify-center',
          browserState.controlState === 'user' && 'cursor-crosshair'
        )}
        tabIndex={browserState.controlState === 'user' ? 0 : -1}
        onKeyDown={handleKeyDown}
      >
        {browserState.screenshot ? (
          <img
            ref={imageRef}
            src={`data:image/png;base64,${browserState.screenshot}`}
            alt="Browser screenshot"
            className="max-w-full max-h-full"
            style={{
              width: browserState.viewport.width * scale,
              height: browserState.viewport.height * scale,
            }}
            onClick={handleClick}
            draggable={false}
          />
        ) : (
          <div className="text-muted-foreground text-sm">
            Loading...
          </div>
        )}

        {/* User control overlay indicator */}
        {browserState.controlState === 'user' && (
          <div className="absolute top-2 right-2 px-2 py-1 rounded bg-green-500/90 text-white text-xs font-medium">
            Click and type to interact
          </div>
        )}
      </div>

      {/* Error display */}
      {browserState.error && (
        <div className="px-3 py-2 border-t border-destructive/50 bg-destructive/10 text-destructive text-xs">
          {browserState.error}
        </div>
      )}
    </div>
  )
}
