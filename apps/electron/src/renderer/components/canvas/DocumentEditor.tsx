/**
 * DocumentEditor - Rich text document editor for Canvas
 *
 * Renders document artifacts with support for markdown, HTML, and plain text.
 * Provides basic editing capabilities with auto-save.
 */

import * as React from 'react'
import { useState, useCallback, useEffect, useRef } from 'react'
import type { DocumentArtifact } from '../../../shared/types'
import { useSetAtom } from 'jotai'
import { updateArtifactAtom } from '@/atoms/artifacts'
import { Markdown } from '@/components/markdown'
import { Edit2, Eye, Copy, Check } from 'lucide-react'
import { Button } from '../ui/button'
import { cn } from '@/lib/utils'

export interface DocumentEditorProps {
  /** Document artifact to display/edit */
  artifact: DocumentArtifact
  /** Session ID for updates */
  sessionId: string
  /** Optional class name */
  className?: string
}

/**
 * Document editor with preview and edit modes
 */
export function DocumentEditor({ artifact, sessionId, className = '' }: DocumentEditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(artifact.content)
  const [copied, setCopied] = useState(false)
  const updateArtifact = useSetAtom(updateArtifactAtom)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Sync edit content when artifact changes externally
  useEffect(() => {
    if (!isEditing) {
      setEditContent(artifact.content)
    }
  }, [artifact.content, isEditing])

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.setSelectionRange(
        textareaRef.current.value.length,
        textareaRef.current.value.length
      )
    }
  }, [isEditing])

  // Toggle edit mode
  const handleToggleEdit = useCallback(() => {
    if (isEditing && editContent !== artifact.content) {
      // Save changes when exiting edit mode
      updateArtifact(sessionId, artifact.id, { content: editContent })
    }
    setIsEditing(!isEditing)
  }, [isEditing, editContent, artifact.content, artifact.id, sessionId, updateArtifact])

  // Handle content change
  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditContent(e.target.value)
  }, [])

  // Copy content to clipboard
  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(artifact.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [artifact.content])

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Escape to exit edit mode
    if (e.key === 'Escape' && isEditing) {
      setEditContent(artifact.content) // Discard changes
      setIsEditing(false)
    }
    // Cmd/Ctrl+S to save
    if ((e.metaKey || e.ctrlKey) && e.key === 's' && isEditing) {
      e.preventDefault()
      if (editContent !== artifact.content) {
        updateArtifact(sessionId, artifact.id, { content: editContent })
      }
    }
  }, [isEditing, editContent, artifact.content, artifact.id, sessionId, updateArtifact])

  return (
    <div className={cn('flex flex-col h-full', className)} onKeyDown={handleKeyDown}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{artifact.title}</span>
          <span className="text-xs text-muted-foreground capitalize">
            ({artifact.format})
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleCopy}
            title="Copy content"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant={isEditing ? 'secondary' : 'ghost'}
            size="icon"
            className="h-7 w-7"
            onClick={handleToggleEdit}
            title={isEditing ? 'Preview' : 'Edit'}
          >
            {isEditing ? <Eye className="h-3.5 w-3.5" /> : <Edit2 className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={editContent}
            onChange={handleContentChange}
            className={cn(
              'w-full h-full p-4 resize-none',
              'bg-background text-foreground',
              'font-mono text-sm',
              'border-0 focus:outline-none focus:ring-0'
            )}
            placeholder="Enter document content..."
          />
        ) : (
          <div className="p-4">
            {artifact.format === 'markdown' ? (
              <Markdown>{artifact.content}</Markdown>
            ) : artifact.format === 'html' ? (
              <div
                className="prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: artifact.content }}
              />
            ) : (
              <pre className="whitespace-pre-wrap font-mono text-sm">
                {artifact.content}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* Edit mode indicator */}
      {isEditing && (
        <div className="px-3 py-1.5 border-t border-border bg-muted/30 text-xs text-muted-foreground">
          Press <kbd className="px-1 py-0.5 rounded bg-muted">Esc</kbd> to cancel,{' '}
          <kbd className="px-1 py-0.5 rounded bg-muted">⌘S</kbd> to save
        </div>
      )}
    </div>
  )
}
