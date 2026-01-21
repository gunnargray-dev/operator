/**
 * ArtifactSelectorPanel - List of artifacts for a session
 *
 * Shows all artifacts created in the session, allowing selection
 * to display in the Canvas panel.
 */

import * as React from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  sessionArtifactsAtomFamily,
  activeArtifactIdAtomFamily,
  setActiveArtifactAtom,
  toggleCanvasAtom,
} from '@/atoms/artifacts'
import { PanelHeader } from '../app-shell/PanelHeader'
import type { AnyArtifact } from '../../../shared/types'
import { Code, FileText, Table, GitBranch, Globe, Trash2 } from 'lucide-react'
import { Button } from '../ui/button'
import { cn } from '@/lib/utils'

export interface ArtifactSelectorPanelProps {
  /** Session ID */
  sessionId?: string
  /** Actions element (e.g., close button) */
  actions?: React.ReactNode
}

/**
 * Get icon for artifact type
 */
function getArtifactIcon(type: AnyArtifact['type']) {
  switch (type) {
    case 'html':
      return <Globe className="h-4 w-4" />
    case 'document':
      return <FileText className="h-4 w-4" />
    case 'spreadsheet':
      return <Table className="h-4 w-4" />
    case 'code':
      return <Code className="h-4 w-4" />
    case 'diagram':
      return <GitBranch className="h-4 w-4" />
    default:
      return <FileText className="h-4 w-4" />
  }
}

/**
 * Format relative time for artifact
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

/**
 * Panel showing list of artifacts for selection
 */
export function ArtifactSelectorPanel({ sessionId, actions }: ArtifactSelectorPanelProps) {
  const artifacts = useAtomValue(sessionArtifactsAtomFamily(sessionId || ''))
  const activeArtifactId = useAtomValue(activeArtifactIdAtomFamily(sessionId || ''))
  const setActiveArtifact = useSetAtom(setActiveArtifactAtom)
  const toggleCanvas = useSetAtom(toggleCanvasAtom)

  // Handle artifact selection
  const handleSelect = (artifactId: string) => {
    if (!sessionId) return
    setActiveArtifact(sessionId, artifactId)
    toggleCanvas(sessionId) // Show canvas if not visible
  }

  if (!sessionId) {
    return (
      <div className="h-full flex flex-col">
        <PanelHeader title="Artifacts" actions={actions} />
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <p className="text-sm">No session selected</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <PanelHeader title="Artifacts" actions={actions} />

      <div className="flex-1 overflow-y-auto">
        {artifacts.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            <p className="text-sm">No artifacts yet</p>
            <p className="text-xs mt-1">
              Ask Claude to create an interactive app, document, or visualization
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {artifacts.map(artifact => (
              <button
                key={artifact.id}
                onClick={() => handleSelect(artifact.id)}
                className={cn(
                  'w-full flex items-start gap-3 p-2 rounded-md text-left transition-colors',
                  artifact.id === activeArtifactId
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-muted'
                )}
              >
                <div className="shrink-0 mt-0.5 text-muted-foreground">
                  {getArtifactIcon(artifact.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{artifact.title}</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="capitalize">{artifact.type}</span>
                    <span>v{artifact.version}</span>
                    <span>{formatRelativeTime(artifact.updatedAt)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
