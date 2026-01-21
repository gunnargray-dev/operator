/**
 * CanvasSplitView - Resizable split view for chat and canvas
 *
 * Uses react-resizable-panels for a smooth resizing experience.
 * Shows the canvas panel when artifacts are available.
 */

import * as React from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { Panel, PanelGroup } from 'react-resizable-panels'
import { canvasVisibleAtomFamily, canvasWidthAtomFamily, setCanvasWidthAtom, sessionArtifactsAtomFamily } from '@/atoms/artifacts'
import { GradientResizeHandle } from '../ui/gradient-resize-handle'
import { CanvasPanel } from './CanvasPanel'
import { cn } from '@/lib/utils'

export interface CanvasSplitViewProps {
  /** Session ID */
  sessionId: string
  /** Chat content to render in the left panel */
  children: React.ReactNode
  /** Optional class name for the container */
  className?: string
  /** Header height for resize handle connector */
  headerHeight?: number
}

/**
 * Split view with resizable chat and canvas panels
 */
export function CanvasSplitView({
  sessionId,
  children,
  className = '',
  headerHeight = 50,
}: CanvasSplitViewProps) {
  const canvasVisible = useAtomValue(canvasVisibleAtomFamily(sessionId))
  const canvasWidth = useAtomValue(canvasWidthAtomFamily(sessionId))
  const setCanvasWidth = useSetAtom(setCanvasWidthAtom)
  const artifacts = useAtomValue(sessionArtifactsAtomFamily(sessionId))

  // Don't show canvas if no artifacts or not visible
  const showCanvas = canvasVisible && artifacts.length > 0

  // Handle panel resize
  const handleResize = (sizes: number[]) => {
    if (sizes.length === 2) {
      // sizes[1] is the canvas panel width percentage
      setCanvasWidth(sessionId, sizes[1])
    }
  }

  if (!showCanvas) {
    // No canvas - just render children directly
    return <div className={cn('h-full', className)}>{children}</div>
  }

  return (
    <PanelGroup
      direction="horizontal"
      onLayout={handleResize}
      className={cn('h-full', className)}
    >
      {/* Chat panel */}
      <Panel
        defaultSize={100 - canvasWidth}
        minSize={30}
        className="h-full"
      >
        {children}
      </Panel>

      {/* Resize handle */}
      <GradientResizeHandle headerHeight={headerHeight} />

      {/* Canvas panel */}
      <Panel
        defaultSize={canvasWidth}
        minSize={20}
        maxSize={70}
        className="h-full"
      >
        <CanvasPanel sessionId={sessionId} />
      </Panel>
    </PanelGroup>
  )
}
