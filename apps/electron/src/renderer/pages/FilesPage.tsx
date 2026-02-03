/**
 * FilesPage - Workspace file browser
 *
 * Full-page file tree view for browsing the workspace root directory.
 * Reuses the tree rendering pattern from SessionFilesSection.
 */

import * as React from 'react'
import { useState, useEffect, useCallback, useRef } from 'react'
import { AnimatePresence, motion, type Variants } from 'motion/react'
import { File, Folder, FolderOpen, FileText, Image, FileCode, ChevronRight, RefreshCw } from 'lucide-react'
import type { SessionFile } from '../../shared/types'
import { cn } from '@/lib/utils'
import { useActiveWorkspace } from '@/context/AppShellContext'
import { PanelHeader } from '@/components/app-shell/PanelHeader'
import { HeaderIconButton } from '@/components/ui/HeaderIconButton'

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.025, delayChildren: 0.01 },
  },
  exit: {
    opacity: 0,
    transition: { staggerChildren: 0.015, staggerDirection: -1 },
  },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, x: -8 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.15, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    x: -8,
    transition: { duration: 0.1, ease: 'easeIn' },
  },
}

function formatFileSize(bytes?: number): string {
  if (bytes === undefined) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileIcon(file: SessionFile, isExpanded?: boolean) {
  const iconClass = "h-3.5 w-3.5 text-muted-foreground"
  if (file.type === 'directory') {
    return isExpanded ? <FolderOpen className={iconClass} /> : <Folder className={iconClass} />
  }
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'md' || ext === 'markdown') return <FileText className={iconClass} />
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico'].includes(ext || '')) return <Image className={iconClass} />
  if (['ts', 'tsx', 'js', 'jsx', 'json', 'yaml', 'yml', 'py', 'rb', 'go', 'rs'].includes(ext || '')) return <FileCode className={iconClass} />
  return <File className={iconClass} />
}

interface FileTreeItemProps {
  file: SessionFile
  depth: number
  expandedPaths: Set<string>
  onToggleExpand: (path: string) => void
  onFileClick: (file: SessionFile) => void
  onFileDoubleClick: (file: SessionFile) => void
}

function FileTreeItem({
  file, depth, expandedPaths, onToggleExpand, onFileClick, onFileDoubleClick,
}: FileTreeItemProps) {
  const isDirectory = file.type === 'directory'
  const isExpanded = expandedPaths.has(file.path)
  const hasChildren = isDirectory && file.children && file.children.length > 0

  const handleClick = () => {
    if (isDirectory && hasChildren) onToggleExpand(file.path)
    else onFileClick(file)
  }

  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (hasChildren) onToggleExpand(file.path)
  }

  return (
    <div className="group/section min-w-0">
      <button
        onClick={handleClick}
        onDoubleClick={() => onFileDoubleClick(file)}
        className={cn(
          "group flex w-full min-w-0 overflow-hidden items-center gap-2 rounded-[6px] py-[5px] text-[13px] select-none outline-none text-left",
          "focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring",
          "hover:bg-foreground/5 transition-colors px-2"
        )}
        title={`${file.path}\n${file.type === 'file' ? formatFileSize(file.size) : 'Directory'}`}
      >
        <span className="relative h-3.5 w-3.5 shrink-0 flex items-center justify-center">
          {hasChildren ? (
            <>
              <span className="absolute inset-0 flex items-center justify-center group-hover:opacity-0 transition-opacity duration-150">
                {getFileIcon(file, isExpanded)}
              </span>
              <span
                className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 cursor-pointer"
                onClick={handleChevronClick}
              >
                <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform duration-200", isExpanded && "rotate-90")} />
              </span>
            </>
          ) : (
            getFileIcon(file, isExpanded)
          )}
        </span>
        <span className="flex-1 min-w-0 truncate">{file.name}</span>
        {file.type === 'file' && file.size !== undefined && (
          <span className="text-[11px] text-muted-foreground/50 shrink-0">{formatFileSize(file.size)}</span>
        )}
      </button>

      {hasChildren && (
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0, marginTop: 0, marginBottom: 0 }}
              animate={{ height: 'auto', opacity: 1, marginTop: 2, marginBottom: 8 }}
              exit={{ height: 0, opacity: 0, marginTop: 0, marginBottom: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="flex flex-col select-none min-w-0">
                <motion.nav
                  className="grid gap-0.5 pl-5 pr-0 relative"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <div className="absolute left-[13px] top-1 bottom-1 w-px bg-foreground/10" aria-hidden="true" />
                  {file.children!.map((child) => (
                    <motion.div key={child.path} variants={itemVariants} className="min-w-0">
                      <FileTreeItem
                        file={child}
                        depth={depth + 1}
                        expandedPaths={expandedPaths}
                        onToggleExpand={onToggleExpand}
                        onFileClick={onFileClick}
                        onFileDoubleClick={onFileDoubleClick}
                      />
                    </motion.div>
                  ))}
                </motion.nav>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  )
}

export default function FilesPage() {
  const workspace = useActiveWorkspace()
  const [files, setFiles] = useState<SessionFile[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const mountedRef = useRef(true)

  const loadFiles = useCallback(async () => {
    if (!workspace?.rootPath) {
      setFiles([])
      return
    }
    setIsLoading(true)
    try {
      const result = await window.electronAPI.scanDirectory(workspace.rootPath)
      if (mountedRef.current) setFiles(result)
    } catch (error) {
      console.error('Failed to scan workspace directory:', error)
      if (mountedRef.current) setFiles([])
    } finally {
      if (mountedRef.current) setIsLoading(false)
    }
  }, [workspace?.rootPath])

  useEffect(() => {
    mountedRef.current = true
    loadFiles()
    return () => { mountedRef.current = false }
  }, [loadFiles])

  const handleFileClick = useCallback((file: SessionFile) => {
    if (file.type === 'directory') {
      window.electronAPI.openFile(file.path)
    } else {
      window.electronAPI.showInFolder(file.path)
    }
  }, [])

  const handleFileDoubleClick = useCallback((file: SessionFile) => {
    window.electronAPI.openFile(file.path)
  }, [])

  const handleToggleExpand = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const dirName = workspace?.rootPath?.split('/').pop() || 'Workspace'

  return (
    <div className="flex flex-col h-full">
      <PanelHeader
        title="Files"
        actions={
          <HeaderIconButton
            icon={RefreshCw}
            tooltip="Refresh"
            onClick={loadFiles}
          />
        }
      />
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
        {/* Workspace root breadcrumb */}
        <div className="px-4 py-2 border-b border-border/30">
          <button
            onClick={() => workspace?.rootPath && window.electronAPI.openFile(workspace.rootPath)}
            className="text-[12px] text-muted-foreground hover:text-foreground transition-colors truncate max-w-full"
            title={workspace?.rootPath}
          >
            {dirName}
          </button>
        </div>

        {files.length === 0 ? (
          <div className="px-4 py-8 text-center text-muted-foreground select-none">
            <p className="text-sm">
              {isLoading ? 'Scanning files...' : 'No files found in workspace directory.'}
            </p>
          </div>
        ) : (
          <nav className="grid gap-0.5 px-2 py-1">
            {files.map((file) => (
              <FileTreeItem
                key={file.path}
                file={file}
                depth={0}
                expandedPaths={expandedPaths}
                onToggleExpand={handleToggleExpand}
                onFileClick={handleFileClick}
                onFileDoubleClick={handleFileDoubleClick}
              />
            ))}
          </nav>
        )}
      </div>
    </div>
  )
}
