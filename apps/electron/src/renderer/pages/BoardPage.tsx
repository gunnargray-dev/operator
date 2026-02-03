import * as React from 'react'
import { useMemo, useCallback } from 'react'
import { useAtomValue } from 'jotai'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { PanelHeader } from '@/components/app-shell/PanelHeader'
import { sessionMetaMapAtom, type SessionMeta } from '@/atoms/sessions'
import { sourcesAtom } from '@/atoms/sources'
import { useAppShellContext } from '@/context/AppShellContext'
import { navigate, routes } from '@/lib/navigate'
import { BoardColumn } from '@/components/board/BoardColumn'
import { BoardCard } from '@/components/board/BoardCard'

export default function BoardPage() {
  const sessionMetaMap = useAtomValue(sessionMetaMapAtom)
  const allSources = useAtomValue(sourcesAtom)
  const { todoStates, onTodoStateChange, activeWorkspaceId } = useAppShellContext()

  // Filter sessions by workspace
  const workspaceSessions = useMemo(() => {
    return Array.from(sessionMetaMap.values())
      .filter(s => s.workspaceId === activeWorkspaceId)
  }, [sessionMetaMap, activeWorkspaceId])

  // Hide these columns from the board
  const HIDDEN_COLUMNS = new Set(['cancelled'])

  // Filter visible states
  const visibleStates = useMemo(() => {
    return (todoStates || []).filter(s => !HIDDEN_COLUMNS.has(s.id))
  }, [todoStates])

  // Group sessions by todoState
  const columnData = useMemo(() => {
    const groups = new Map<string, SessionMeta[]>()
    for (const state of visibleStates) {
      groups.set(state.id, [])
    }
    const firstKey = groups.keys().next().value
    for (const session of workspaceSessions) {
      const stateId = session.todoState || 'todo'
      const group = groups.get(stateId)
      if (group) {
        group.push(session)
      } else if (firstKey) {
        // Session has a hidden/unknown state — add to first visible column
        groups.get(firstKey)!.push(session)
      }
    }
    // Sort each group by lastMessageAt descending
    for (const [, sessions] of groups) {
      sessions.sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0))
    }
    return groups
  }, [workspaceSessions, visibleStates])

  // DnD state
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const activeSession = activeId ? sessionMetaMap.get(activeId) : undefined

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const sessionId = active.id as string
    const targetColumnId = over.data.current?.columnId as string | undefined
    if (!targetColumnId) return

    const session = sessionMetaMap.get(sessionId)
    const currentState = session?.todoState || 'todo'
    if (currentState === targetColumnId) return

    // Change status
    onTodoStateChange(sessionId, targetColumnId)
  }, [sessionMetaMap, onTodoStateChange])

  const handleCardClick = useCallback((sessionId: string) => {
    navigate(routes.view.allChats(sessionId))
  }, [])

  return (
    <div className="flex flex-col h-full">
      <PanelHeader title="Board" />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 min-h-0 flex gap-3 px-4 pb-4 pt-2 overflow-x-auto">
          {visibleStates.map(state => (
            <BoardColumn
              key={state.id}
              state={state}
              sessions={columnData.get(state.id) || []}
              allSources={allSources}
              onCardClick={handleCardClick}
            />
          ))}
        </div>

        {/* Drag overlay - renders the card being dragged above everything */}
        <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
          {activeSession ? (
            <BoardCard
              session={activeSession}
              allSources={allSources}
              isDragOverlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
