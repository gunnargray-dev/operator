/**
 * CanvasPanel - Main Canvas container with artifact tabs
 *
 * Displays artifacts in a tabbed interface.
 * Supports multiple artifact types: HTML, documents, spreadsheets, code, diagrams.
 */

import * as React from 'react'
import { useAtomValue } from 'jotai'
import {
  sessionArtifactsAtomFamily,
  activeArtifactIdAtomFamily,
  setActiveArtifactAtom,
  toggleCanvasAtom,
} from '@/atoms/artifacts'
import { useSetAtom } from 'jotai'
import type { AnyArtifact } from '../../../shared/types'
import { isHtmlArtifact, isDocumentArtifact, isCodeArtifact, isDiagramArtifact, isSpreadsheetArtifact } from '../../../shared/artifact-types'
import { HtmlPreview } from './HtmlPreview'
import { DocumentEditor } from './DocumentEditor'
import { X, Code, FileText, Table, GitBranch, Globe } from 'lucide-react'
import { Button } from '../ui/button'
import { cn } from '@/lib/utils'

export interface CanvasPanelProps {
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
      return <Globe className="h-3 w-3" />
    case 'document':
      return <FileText className="h-3 w-3" />
    case 'spreadsheet':
      return <Table className="h-3 w-3" />
    case 'code':
      return <Code className="h-3 w-3" />
    case 'diagram':
      return <GitBranch className="h-3 w-3" />
    default:
      return <FileText className="h-3 w-3" />
  }
}

/**
 * Render artifact content based on type
 */
function ArtifactContent({ artifact, sessionId }: { artifact: AnyArtifact; sessionId: string }) {
  if (isHtmlArtifact(artifact)) {
    return <HtmlPreview artifact={artifact} className="h-full" />
  }

  if (isDocumentArtifact(artifact)) {
    return <DocumentEditor artifact={artifact} sessionId={sessionId} className="h-full" />
  }

  if (isCodeArtifact(artifact)) {
    return (
      <div className="h-full overflow-auto">
        <div className="p-2 border-b border-border bg-muted/30 text-xs text-muted-foreground">
          {artifact.filename || `code.${artifact.language}`}
        </div>
        <pre className="p-4 font-mono text-sm overflow-auto">
          <code>{artifact.code}</code>
        </pre>
      </div>
    )
  }

  if (isDiagramArtifact(artifact)) {
    if (artifact.format === 'svg') {
      return (
        <div
          className="h-full flex items-center justify-center p-4"
          dangerouslySetInnerHTML={{ __html: artifact.source }}
        />
      )
    }
    return (
      <div className="h-full flex items-center justify-center p-4">
        <pre className="font-mono text-sm">{artifact.source}</pre>
      </div>
    )
  }

  // Spreadsheet - basic table view
  if (isSpreadsheetArtifact(artifact)) {
    return (
      <div className="h-full overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-muted">
            <tr>
              {artifact.columns.map(col => (
                <th key={col.id} className="border border-border px-2 py-1 text-left font-medium">
                  {col.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {artifact.rows.map((row, i) => (
              <tr key={i}>
                {artifact.columns.map(col => (
                  <td key={col.id} className="border border-border px-2 py-1">
                    {String(row[col.id] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // Exhaustive check - should never reach here if all artifact types are handled
  const _exhaustiveCheck: never = artifact
  return (
    <div className="h-full flex items-center justify-center text-muted-foreground">
      <p className="text-sm">Unsupported artifact type</p>
    </div>
  )
}

/**
 * Canvas panel with artifact tabs
 */
export function CanvasPanel({ sessionId, className = '' }: CanvasPanelProps) {
  const artifacts = useAtomValue(sessionArtifactsAtomFamily(sessionId))
  const activeArtifactId = useAtomValue(activeArtifactIdAtomFamily(sessionId))
  const setActiveArtifact = useSetAtom(setActiveArtifactAtom)
  const toggleCanvas = useSetAtom(toggleCanvasAtom)

  const activeArtifact = artifacts.find(a => a.id === activeArtifactId)

  // Handle close canvas
  const handleClose = () => {
    toggleCanvas(sessionId)
  }

  // Handle tab click
  const handleTabClick = (artifactId: string) => {
    setActiveArtifact(sessionId, artifactId)
  }

  if (artifacts.length === 0) {
    return (
      <div className={cn('flex flex-col h-full bg-background border-l border-border', className)}>
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-sm font-medium">Canvas</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center p-4">
            <p className="text-sm">No artifacts yet</p>
            <p className="text-xs mt-1">Ask Claude to create an interactive app, document, or visualization</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col h-full bg-background border-l border-border', className)}>
      {/* Header with tabs */}
      <div className="flex items-center border-b border-border">
        {/* Tabs */}
        <div className="flex-1 flex items-center overflow-x-auto">
          {artifacts.map(artifact => (
            <button
              key={artifact.id}
              onClick={() => handleTabClick(artifact.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-sm border-r border-border shrink-0 max-w-[150px]',
                artifact.id === activeArtifactId
                  ? 'bg-background text-foreground'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              )}
            >
              {getArtifactIcon(artifact.type)}
              <span className="truncate">{artifact.title}</span>
            </button>
          ))}
        </div>

        {/* Close button */}
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeArtifact ? (
          <ArtifactContent artifact={activeArtifact} sessionId={sessionId} />
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <p className="text-sm">Select an artifact</p>
          </div>
        )}
      </div>
    </div>
  )
}
