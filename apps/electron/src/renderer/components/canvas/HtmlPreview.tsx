/**
 * HtmlPreview - Sandboxed iframe for HTML artifact preview
 *
 * Renders HTML artifacts in a sandboxed iframe for security.
 * Supports HTML, CSS, JS, and external CDN dependencies.
 */

import * as React from 'react'
import { useRef, useEffect, useState, useCallback } from 'react'
import type { HtmlArtifact } from '../../../shared/types'
import { RefreshCw, ExternalLink, Maximize2 } from 'lucide-react'
import { Button } from '../ui/button'

export interface HtmlPreviewProps {
  /** HTML artifact to render */
  artifact: HtmlArtifact
  /** Optional class name */
  className?: string
}

/**
 * Build the complete HTML document for the iframe
 */
function buildHtmlDocument(artifact: HtmlArtifact): string {
  const { html, css, js, dependencies = [] } = artifact

  // Build dependency script tags
  const depScripts = dependencies
    .map((url: string) => `<script src="${escapeHtml(url)}"></script>`)
    .join('\n    ')

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' 'unsafe-eval' https: data: blob:;">
  <title>${escapeHtml(artifact.title)}</title>
  ${depScripts ? `\n    ${depScripts}` : ''}
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 16px; font-family: system-ui, -apple-system, sans-serif; }
    ${css || ''}
  </style>
</head>
<body>
  ${html}
  ${js ? `<script>${js}</script>` : ''}
</body>
</html>`
}

/**
 * Escape HTML entities
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Sandboxed iframe for HTML artifact preview
 */
export function HtmlPreview({ artifact, className = '' }: HtmlPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [key, setKey] = useState(0) // For forcing iframe refresh

  // Update iframe content when artifact changes
  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    setIsLoading(true)
    setError(null)

    try {
      const doc = buildHtmlDocument(artifact)

      // Use srcdoc for sandboxed content
      iframe.srcdoc = doc
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to render HTML')
      setIsLoading(false)
    }
  }, [artifact, key])

  // Handle iframe load
  const handleLoad = useCallback(() => {
    setIsLoading(false)
  }, [])

  // Handle iframe error
  const handleError = useCallback(() => {
    setError('Failed to load content')
    setIsLoading(false)
  }, [])

  // Refresh the iframe
  const handleRefresh = useCallback(() => {
    setKey(k => k + 1)
  }, [])

  // Open in new window
  const handleOpenExternal = useCallback(() => {
    const doc = buildHtmlDocument(artifact)
    const blob = new Blob([doc], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    // Clean up after a delay
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [artifact])

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-border bg-muted/30">
        <span className="text-xs text-muted-foreground truncate">
          {artifact.title}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleRefresh}
            title="Refresh"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleOpenExternal}
            title="Open in new window"
          >
            <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 relative overflow-hidden bg-white">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <div className="text-sm text-muted-foreground">Loading...</div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-destructive/10 z-10">
            <div className="text-sm text-destructive">{error}</div>
          </div>
        )}

        <iframe
          ref={iframeRef}
          key={key}
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
          onLoad={handleLoad}
          onError={handleError}
          title={artifact.title}
        />
      </div>
    </div>
  )
}
