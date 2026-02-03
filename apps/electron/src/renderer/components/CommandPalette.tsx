/**
 * CommandPalette - Cmd+K quick actions menu
 *
 * Raycast-style command palette for quick navigation and actions.
 * Supports: New task, session search, navigation commands.
 */

import * as React from 'react'
import { useMemo } from 'react'
import {
  Plus,
  MessageSquare,
  Settings,
  LayoutGrid,
  FolderOpen,
  Layers,
  Plug,
} from 'lucide-react'
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from '@/components/ui/command'
import { getSessionTitle } from '@/utils/session'
import { routes, type Route } from '../../shared/routes'
import type { SessionMeta } from '@/atoms/sessions'

// =============================================================================
// Types
// =============================================================================

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessions: Map<string, SessionMeta>
  onCreateSession: () => Promise<void>
  onSelectSession: (sessionId: string) => void
  onNavigate: (route: Route) => void
}

// =============================================================================
// Component
// =============================================================================

export function CommandPalette({
  open,
  onOpenChange,
  sessions,
  onCreateSession,
  onSelectSession,
  onNavigate,
}: CommandPaletteProps) {
  // Sort sessions by most recent activity
  const sortedSessions = useMemo(() => {
    return Array.from(sessions.values())
      .sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0))
      .slice(0, 10) // Show top 10 recent sessions
  }, [sessions])

  const handleCreateSession = async () => {
    onOpenChange(false)
    await onCreateSession()
  }

  const handleSelectSession = (sessionId: string) => {
    onOpenChange(false)
    onSelectSession(sessionId)
  }

  const handleNavigate = (route: Route) => {
    onOpenChange(false)
    onNavigate(route)
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Actions */}
        <CommandGroup heading="Actions">
          <CommandItem onSelect={handleCreateSession}>
            <Plus className="mr-2 h-4 w-4" />
            <span>New Task</span>
            <CommandShortcut>⌘N</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        {/* Navigation */}
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => handleNavigate(routes.view.canvas())}>
            <LayoutGrid className="mr-2 h-4 w-4" />
            <span>Canvas</span>
          </CommandItem>
          <CommandItem onSelect={() => handleNavigate(routes.view.board())}>
            <Layers className="mr-2 h-4 w-4" />
            <span>Activity Board</span>
          </CommandItem>
          <CommandItem onSelect={() => handleNavigate(routes.view.files())}>
            <FolderOpen className="mr-2 h-4 w-4" />
            <span>Files</span>
          </CommandItem>
          <CommandItem onSelect={() => handleNavigate(routes.view.integrations())}>
            <Plug className="mr-2 h-4 w-4" />
            <span>Integrations</span>
          </CommandItem>
          <CommandItem onSelect={() => handleNavigate(routes.view.settings())}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
            <CommandShortcut>⌘,</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        {/* Recent Sessions */}
        {sortedSessions.length > 0 && (
          <CommandGroup heading="Recent Tasks">
            {sortedSessions.map((session) => (
              <CommandItem
                key={session.id}
                value={getSessionTitle(session)}
                onSelect={() => handleSelectSession(session.id)}
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                <span className="truncate">{getSessionTitle(session)}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}
