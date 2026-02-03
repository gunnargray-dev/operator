/**
 * ArtifactInlineCard - Inline preview card for artifacts in chat
 *
 * Shows a visual preview of an artifact that when clicked, reveals the canvas panel.
 * Displayed inline in the chat message stream when an artifact is created.
 */

import * as React from 'react'
import { useSetAtom, useAtomValue } from 'jotai'
import { Globe, FileText, Code, Table, GitBranch, ExternalLink, PanelRightOpen } from 'lucide-react'
import { motion } from 'motion/react'
import { setActiveArtifactAtom, canvasVisibleAtomFamily } from '@/atoms/artifacts'
import { cn } from '@/lib/utils'
import type { AnyArtifact } from '../../../shared/types'
import { isHtmlArtifact } from '../../../shared/artifact-types'

export interface ArtifactInlineCardProps {
  /** The artifact to preview */
  artifact: AnyArtifact
  /** Session ID */
  sessionId: string
  /** Optional class name */
  className?: string
}

/**
 * Get icon for artifact type
 */
function getArtifactIcon(type: AnyArtifact['type']) {
  switch (type) {
    case 'html':
      return <Globe className="h-5 w-5" />
    case 'document':
      return <FileText className="h-5 w-5" />
    case 'spreadsheet':
      return <Table className="h-5 w-5" />
    case 'code':
      return <Code className="h-5 w-5" />
    case 'diagram':
      return <GitBranch className="h-5 w-5" />
    default:
      return <FileText className="h-5 w-5" />
  }
}

/**
 * Get label for artifact type
 */
function getArtifactTypeLabel(type: AnyArtifact['type']) {
  switch (type) {
    case 'html':
      return 'Interactive App'
    case 'document':
      return 'Document'
    case 'spreadsheet':
      return 'Spreadsheet'
    case 'code':
      return 'Code'
    case 'diagram':
      return 'Diagram'
    default:
      return 'Artifact'
  }
}

/**
 * Inline card preview for an artifact
 */
export function ArtifactInlineCard({ artifact, sessionId, className }: ArtifactInlineCardProps) {
  const setActiveArtifact = useSetAtom(setActiveArtifactAtom)
  const canvasVisible = useAtomValue(canvasVisibleAtomFamily(sessionId))
  const iframeRef = React.useRef<HTMLIFrameElement>(null)

  // Handle click to open canvas - setActiveArtifact automatically opens canvas
  const handleClick = React.useCallback(() => {
    setActiveArtifact(sessionId, artifact.id)
  }, [sessionId, artifact.id, setActiveArtifact])

  // Get preview content for HTML artifacts
  const htmlContent = isHtmlArtifact(artifact) ? artifact.html : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'group relative rounded-xl border border-border/60 bg-card overflow-hidden cursor-pointer',
        'hover:border-accent/50 hover:shadow-lg transition-all duration-200',
        'max-w-md',
        className
      )}
      onClick={handleClick}
    >
      {/* Preview area - pointer-events-none to ensure clicks reach the card */}
      {htmlContent ? (
        <div className="relative h-40 bg-white overflow-hidden pointer-events-none">
          {/* Scaled-down iframe preview */}
          <div className="absolute inset-0 origin-top-left scale-[0.25] w-[400%] h-[400%]">
            <iframe
              ref={iframeRef}
              srcDoc={htmlContent}
              className="w-full h-full border-0"
              sandbox=""
              title={artifact.title}
            />
          </div>
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
        </div>
      ) : (
        <div className="h-32 bg-muted/30 flex items-center justify-center pointer-events-none">
          <div className="text-muted-foreground/50">
            {getArtifactIcon(artifact.type)}
          </div>
        </div>
      )}

      {/* Info bar */}
      <div className="p-3 flex items-center gap-3">
        <div className={cn(
          'shrink-0 h-10 w-10 rounded-lg flex items-center justify-center',
          artifact.type === 'html' ? 'bg-info/10 text-info' : 'bg-muted text-muted-foreground'
        )}>
          {getArtifactIcon(artifact.type)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-foreground truncate">
            {artifact.title}
          </p>
          <p className="text-xs text-muted-foreground">
            {getArtifactTypeLabel(artifact.type)}
          </p>
        </div>
        <div className={cn(
          'shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium',
          'bg-accent/10 text-accent',
          'group-hover:bg-accent group-hover:text-accent-foreground transition-colors'
        )}>
          <PanelRightOpen className="h-3.5 w-3.5" />
          <span>{canvasVisible ? 'View' : 'Open'}</span>
        </div>
      </div>
    </motion.div>
  )
}
