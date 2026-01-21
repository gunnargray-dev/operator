/**
 * Artifact Types for Canvas Capabilities
 *
 * Artifacts are rich content objects created by the agent during a session.
 * They are displayed in the Canvas panel alongside the chat.
 */

/**
 * Supported artifact types
 */
export type ArtifactType = 'html' | 'document' | 'spreadsheet' | 'code' | 'diagram'

/**
 * Cell value types for spreadsheets
 */
export type CellValue = string | number | boolean | null

/**
 * Base artifact interface - common fields for all artifact types
 */
export interface BaseArtifact {
  id: string
  type: ArtifactType
  title: string
  sessionId: string
  createdAt: number
  updatedAt: number
  version: number
}

/**
 * HTML artifact - interactive web applications
 * Rendered in a sandboxed iframe
 */
export interface HtmlArtifact extends BaseArtifact {
  type: 'html'
  html: string
  css?: string
  js?: string
  /** CDN URLs for external dependencies (e.g., React, D3) */
  dependencies?: string[]
}

/**
 * Document artifact - rich text content
 * Rendered with TipTap/ProseMirror editor
 */
export interface DocumentArtifact extends BaseArtifact {
  type: 'document'
  content: string
  format: 'markdown' | 'html' | 'plain'
}

/**
 * Spreadsheet column definition
 */
export interface SpreadsheetColumn {
  id: string
  title: string
  type: 'text' | 'number' | 'formula'
  width?: number
}

/**
 * Spreadsheet artifact - tabular data with formulas
 */
export interface SpreadsheetArtifact extends BaseArtifact {
  type: 'spreadsheet'
  columns: SpreadsheetColumn[]
  rows: Array<Record<string, CellValue>>
}

/**
 * Code artifact - syntax-highlighted code blocks
 */
export interface CodeArtifact extends BaseArtifact {
  type: 'code'
  code: string
  language: string
  filename?: string
}

/**
 * Diagram artifact - visual diagrams (Mermaid, etc.)
 */
export interface DiagramArtifact extends BaseArtifact {
  type: 'diagram'
  source: string
  format: 'mermaid' | 'svg' | 'dot'
}

/**
 * Union type for all artifact types
 */
export type AnyArtifact =
  | HtmlArtifact
  | DocumentArtifact
  | SpreadsheetArtifact
  | CodeArtifact
  | DiagramArtifact

/**
 * Type guard for HTML artifacts
 */
export function isHtmlArtifact(artifact: AnyArtifact): artifact is HtmlArtifact {
  return artifact.type === 'html'
}

/**
 * Type guard for document artifacts
 */
export function isDocumentArtifact(artifact: AnyArtifact): artifact is DocumentArtifact {
  return artifact.type === 'document'
}

/**
 * Type guard for spreadsheet artifacts
 */
export function isSpreadsheetArtifact(artifact: AnyArtifact): artifact is SpreadsheetArtifact {
  return artifact.type === 'spreadsheet'
}

/**
 * Type guard for code artifacts
 */
export function isCodeArtifact(artifact: AnyArtifact): artifact is CodeArtifact {
  return artifact.type === 'code'
}

/**
 * Type guard for diagram artifacts
 */
export function isDiagramArtifact(artifact: AnyArtifact): artifact is DiagramArtifact {
  return artifact.type === 'diagram'
}

/**
 * Artifact metadata for list display (lightweight, excludes content)
 */
export interface ArtifactMeta {
  id: string
  type: ArtifactType
  title: string
  sessionId: string
  createdAt: number
  updatedAt: number
  version: number
}

/**
 * Extract metadata from a full artifact object
 */
export function extractArtifactMeta(artifact: AnyArtifact): ArtifactMeta {
  return {
    id: artifact.id,
    type: artifact.type,
    title: artifact.title,
    sessionId: artifact.sessionId,
    createdAt: artifact.createdAt,
    updatedAt: artifact.updatedAt,
    version: artifact.version,
  }
}

/**
 * Content input for creating/updating HTML artifacts
 */
export interface HtmlArtifactContent {
  html: string
  css?: string
  js?: string
  dependencies?: string[]
}

/**
 * Content input for creating/updating document artifacts
 */
export interface DocumentArtifactContent {
  content: string
  format: 'markdown' | 'html' | 'plain'
}

/**
 * Content input for creating/updating spreadsheet artifacts
 */
export interface SpreadsheetArtifactContent {
  columns: SpreadsheetColumn[]
  rows: Array<Record<string, CellValue>>
}

/**
 * Content input for creating/updating code artifacts
 */
export interface CodeArtifactContent {
  code: string
  language: string
  filename?: string
}

/**
 * Content input for creating/updating diagram artifacts
 */
export interface DiagramArtifactContent {
  source: string
  format: 'mermaid' | 'svg' | 'dot'
}

/**
 * Union type for artifact content by type
 */
export type ArtifactContent =
  | { type: 'html' } & HtmlArtifactContent
  | { type: 'document' } & DocumentArtifactContent
  | { type: 'spreadsheet' } & SpreadsheetArtifactContent
  | { type: 'code' } & CodeArtifactContent
  | { type: 'diagram' } & DiagramArtifactContent

/**
 * Create artifact tool input
 */
export interface CreateArtifactInput {
  type: ArtifactType
  title: string
  content: ArtifactContent
}

/**
 * Update artifact tool input
 */
export interface UpdateArtifactInput {
  artifactId: string
  title?: string
  content?: Partial<ArtifactContent>
}
