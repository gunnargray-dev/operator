/**
 * SessionMenu - Shared menu content for session actions
 *
 * Used by:
 * - SessionList (dropdown via "..." button, context menu via right-click)
 * - ChatPage (title dropdown menu)
 *
 * Uses MenuComponents context to render with either DropdownMenu or ContextMenu
 * primitives, allowing the same component to work in both scenarios.
 *
 * Provides consistent session actions:
 * - Share / Shared submenu
 * - Status submenu
 * - Mark as Unread
 * - Rename
 * - Open in New Window
 * - View in Finder
 * - Delete
 */

import * as React from 'react'
import {
  Trash2,
  Pencil,
  MailOpen,
  FolderOpen,
  Copy,
  Link2Off,
  AppWindow,
  CloudUpload,
  Globe,
  RefreshCw,
  Timer,
  Star,
  LayoutGrid,
  FolderKanban,
  Plus,
  Check,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn, isHexColor } from '@/lib/utils'
import { useMenuComponents } from '@/components/ui/menu-context'
import { getStateColor, getStateIcon, type TodoStateId } from '@/config/todo-states'
import type { TodoState } from '@/config/todo-states'

export interface SessionMenuProps {
  /** Session ID */
  sessionId: string
  /** Session name for rename dialog */
  sessionName: string
  /** Shared URL if session is shared */
  sharedUrl?: string | null
  /** Whether session has messages */
  hasMessages: boolean
  /** Whether session has unread messages */
  hasUnreadMessages: boolean
  /** Current todo state */
  currentTodoState: TodoStateId
  /** Available todo states */
  todoStates: TodoState[]
  /** Whether session has an active schedule */
  hasSchedule?: boolean
  /** Whether session is favorited */
  isFavorited?: boolean
  /** Current project folder ID */
  projectId?: string
  /** Available project folders */
  projectFolders?: { id: string; name: string; color?: string }[]
  /** Callbacks */
  onRename: () => void
  onMarkUnread: () => void
  onToggleFavorite?: () => void
  onTodoStateChange: (state: TodoStateId) => void
  onOpenInNewWindow: () => void
  onConfigureSchedule?: () => void
  onOpenInCanvas?: () => void
  onMoveToProject?: (projectId: string | null) => void
  onCreateProject?: () => void
  onDelete: () => void
}

/**
 * SessionMenu - Renders the menu items for session actions
 * This is the content only, not wrapped in a DropdownMenu
 */
export function SessionMenu({
  sessionId,
  sessionName,
  sharedUrl,
  hasMessages,
  hasUnreadMessages,
  currentTodoState,
  todoStates,
  onRename,
  onMarkUnread,
  onToggleFavorite,
  onTodoStateChange,
  hasSchedule,
  isFavorited,
  projectId,
  projectFolders,
  onOpenInNewWindow,
  onConfigureSchedule,
  onOpenInCanvas,
  onMoveToProject,
  onCreateProject,
  onDelete,
}: SessionMenuProps) {
  // Share handlers
  const handleShare = async () => {
    const result = await window.electronAPI.sessionCommand(sessionId, { type: 'shareToViewer' }) as { success: boolean; url?: string; error?: string } | undefined
    if (result?.success && result.url) {
      await navigator.clipboard.writeText(result.url)
      toast.success('Link copied to clipboard', {
        description: result.url,
        action: {
          label: 'Open',
          onClick: () => window.electronAPI.openUrl(result.url!),
        },
      })
    } else {
      toast.error('Failed to share', { description: result?.error || 'Unknown error' })
    }
  }

  const handleOpenInBrowser = () => {
    if (sharedUrl) window.electronAPI.openUrl(sharedUrl)
  }

  const handleCopyLink = async () => {
    if (sharedUrl) {
      await navigator.clipboard.writeText(sharedUrl)
      toast.success('Link copied to clipboard')
    }
  }

  const handleUpdateShare = async () => {
    const result = await window.electronAPI.sessionCommand(sessionId, { type: 'updateShare' })
    if (result?.success) {
      toast.success('Share updated')
    } else {
      toast.error('Failed to update share', { description: result?.error })
    }
  }

  const handleRevokeShare = async () => {
    const result = await window.electronAPI.sessionCommand(sessionId, { type: 'revokeShare' })
    if (result?.success) {
      toast.success('Sharing stopped')
    } else {
      toast.error('Failed to stop sharing', { description: result?.error })
    }
  }

  const handleShowInFinder = () => {
    window.electronAPI.sessionCommand(sessionId, { type: 'showInFinder' })
  }

  const handleCopyPath = async () => {
    const result = await window.electronAPI.sessionCommand(sessionId, { type: 'copyPath' }) as { success: boolean; path?: string } | undefined
    if (result?.success && result.path) {
      await navigator.clipboard.writeText(result.path)
      toast.success('Path copied to clipboard')
    }
  }

  const handleRefreshTitle = async () => {
    const result = await window.electronAPI.sessionCommand(sessionId, { type: 'refreshTitle' }) as { success: boolean; title?: string; error?: string } | undefined
    if (result?.success) {
      toast.success('Title refreshed', { description: result.title })
    } else {
      toast.error('Failed to refresh title', { description: result?.error || 'Unknown error' })
    }
  }

  // Get menu components from context (works with both DropdownMenu and ContextMenu)
  const { MenuItem, Separator, Sub, SubTrigger, SubContent } = useMenuComponents()

  return (
    <>
      {/* Share/Shared based on shared state */}
      {!sharedUrl ? (
        <MenuItem onClick={handleShare}>
          <CloudUpload className="h-3.5 w-3.5" />
          <span className="flex-1">Share</span>
        </MenuItem>
      ) : (
        <Sub>
          <SubTrigger>
            <CloudUpload className="h-3.5 w-3.5" />
            <span className="flex-1">Shared</span>
          </SubTrigger>
          <SubContent>
            <MenuItem onClick={handleOpenInBrowser}>
              <Globe className="h-3.5 w-3.5" />
              <span className="flex-1">Open in Browser</span>
            </MenuItem>
            <MenuItem onClick={handleCopyLink}>
              <Copy className="h-3.5 w-3.5" />
              <span className="flex-1">Copy Link</span>
            </MenuItem>
            <MenuItem onClick={handleUpdateShare}>
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="flex-1">Update Share</span>
            </MenuItem>
            <MenuItem onClick={handleRevokeShare} variant="destructive">
              <Link2Off className="h-3.5 w-3.5" />
              <span className="flex-1">Stop Sharing</span>
            </MenuItem>
          </SubContent>
        </Sub>
      )}
      <Separator />

      {/* Status submenu */}
      <Sub>
        <SubTrigger>
          <span
            className={cn(
              'shrink-0 flex items-center justify-center -mt-px h-3.5 w-3.5',
              '[&>svg]:w-full [&>svg]:h-full [&>div>svg]:w-full [&>div>svg]:h-full [&>img]:w-full [&>img]:h-full',
              !isHexColor(getStateColor(currentTodoState, todoStates)) &&
                (getStateColor(currentTodoState, todoStates) || 'text-muted-foreground')
            )}
            style={
              isHexColor(getStateColor(currentTodoState, todoStates))
                ? { color: getStateColor(currentTodoState, todoStates) }
                : undefined
            }
          >
            {getStateIcon(currentTodoState, todoStates)}
          </span>
          <span className="flex-1">Status</span>
        </SubTrigger>
        <SubContent>
          {todoStates.filter(state => state.id !== 'cancelled').map((state) => {
            // Only apply color if icon is colorable (uses currentColor)
            const applyColor = state.iconColorable
            return (
              <MenuItem
                key={state.id}
                onClick={() => onTodoStateChange(state.id)}
                className={currentTodoState === state.id ? 'bg-foreground/5' : ''}
              >
                <span
                  className={cn(
                    'shrink-0 flex items-center justify-center -mt-px h-3.5 w-3.5',
                    '[&>svg]:w-full [&>svg]:h-full [&>div>svg]:w-full [&>div>svg]:h-full [&>img]:w-full [&>img]:h-full',
                    applyColor && !isHexColor(state.color) && state.color
                  )}
                  style={applyColor && isHexColor(state.color) ? { color: state.color } : undefined}
                >
                  {state.icon}
                </span>
                <span className="flex-1">{state.label}</span>
              </MenuItem>
            )
          })}
        </SubContent>
      </Sub>

      {/* Mark as Unread - only show if session has been read */}
      {!hasUnreadMessages && hasMessages && (
        <MenuItem onClick={onMarkUnread}>
          <MailOpen className="h-3.5 w-3.5" />
          <span className="flex-1">Mark as Unread</span>
        </MenuItem>
      )}

      {/* Toggle Favorite */}
      {onToggleFavorite && (
        <MenuItem onClick={onToggleFavorite}>
          <Star className={cn("h-3.5 w-3.5", isFavorited && "fill-current")} />
          <span className="flex-1">{isFavorited ? 'Remove from Favorites' : 'Add to Favorites'}</span>
        </MenuItem>
      )}

      {/* Move to Project */}
      {onMoveToProject && (
        <Sub>
          <SubTrigger>
            <FolderKanban className="h-3.5 w-3.5" />
            <span className="flex-1">Move to Project</span>
          </SubTrigger>
          <SubContent>
            {/* No project (remove from project) */}
            <MenuItem onClick={() => onMoveToProject(null)} className={!projectId ? 'bg-foreground/5' : ''}>
              <span className="h-3.5 w-3.5 flex items-center justify-center">
                {!projectId && <Check className="h-3 w-3" />}
              </span>
              <span className="flex-1 text-muted-foreground">None</span>
            </MenuItem>
            {(projectFolders ?? []).map(folder => (
              <MenuItem
                key={folder.id}
                onClick={() => onMoveToProject(folder.id)}
                className={projectId === folder.id ? 'bg-foreground/5' : ''}
              >
                <span className="h-3.5 w-3.5 flex items-center justify-center">
                  {projectId === folder.id && <Check className="h-3 w-3" />}
                </span>
                <span className="flex-1">{folder.name}</span>
              </MenuItem>
            ))}
            {onCreateProject && (
              <>
                <Separator />
                <MenuItem onClick={onCreateProject}>
                  <Plus className="h-3.5 w-3.5" />
                  <span className="flex-1">New Project...</span>
                </MenuItem>
              </>
            )}
          </SubContent>
        </Sub>
      )}

      <Separator />

      {/* Rename */}
      <MenuItem onClick={onRename}>
        <Pencil className="h-3.5 w-3.5" />
        <span className="flex-1">Rename</span>
      </MenuItem>

      {/* Regenerate Title - AI-generate based on recent messages */}
      <MenuItem onClick={handleRefreshTitle}>
        <RefreshCw className="h-3.5 w-3.5" />
        <span className="flex-1">Regenerate Title</span>
      </MenuItem>

      {/* Configure Schedule */}
      {onConfigureSchedule && (
        <MenuItem onClick={onConfigureSchedule}>
          <Timer className="h-3.5 w-3.5" />
          <span className="flex-1">{hasSchedule ? 'Edit Schedule' : 'Configure Schedule'}</span>
        </MenuItem>
      )}

      <Separator />

      {/* Open in New Window */}
      <MenuItem onClick={onOpenInNewWindow}>
        <AppWindow className="h-3.5 w-3.5" />
        <span className="flex-1">Open in New Window</span>
      </MenuItem>

      {/* Open in Canvas */}
      {onOpenInCanvas && (
        <MenuItem onClick={onOpenInCanvas}>
          <LayoutGrid className="h-3.5 w-3.5" />
          <span className="flex-1">Open in Canvas</span>
        </MenuItem>
      )}

      {/* View in Finder */}
      <MenuItem onClick={handleShowInFinder}>
        <FolderOpen className="h-3.5 w-3.5" />
        <span className="flex-1">View in Finder</span>
      </MenuItem>

      {/* Copy Path */}
      <MenuItem onClick={handleCopyPath}>
        <Copy className="h-3.5 w-3.5" />
        <span className="flex-1">Copy Path</span>
      </MenuItem>

      <Separator />

      {/* Delete */}
      <MenuItem onClick={onDelete} variant="destructive">
        <Trash2 className="h-3.5 w-3.5" />
        <span className="flex-1">Delete</span>
      </MenuItem>
    </>
  )
}
