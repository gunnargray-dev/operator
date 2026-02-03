import * as React from 'react'
import { useDroppable } from '@dnd-kit/core'
import { cn, isHexColor } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { BoardCard } from './BoardCard'
import type { SessionMeta } from '@/atoms/sessions'
import type { LoadedSource } from '../../../shared/types'
import type { TodoState } from '@/config/todo-states'

interface BoardColumnProps {
  state: TodoState
  sessions: SessionMeta[]
  allSources: LoadedSource[]
  onCardClick: (sessionId: string) => void
}

export function BoardColumn({ state, sessions, allSources, onCardClick }: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${state.id}`,
    data: { columnId: state.id },
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col w-[280px] min-w-[280px] rounded-[10px] border transition-colors',
        isOver
          ? 'border-accent/30 bg-accent/[0.03]'
          : 'border-foreground/8 bg-foreground/[0.02]',
      )}
    >
      {/* Column Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-foreground/5 shrink-0">
        <span
          className={cn(
            'h-3.5 w-3.5 flex items-center justify-center shrink-0 [&>svg]:w-full [&>svg]:h-full [&>div>svg]:w-full [&>div>svg]:h-full [&>img]:w-full [&>img]:h-full',
            state.iconColorable && !isHexColor(state.color) && state.color
          )}
          style={state.iconColorable && isHexColor(state.color) ? { color: state.color } : undefined}
        >
          {state.icon}
        </span>
        <span className="text-[12px] font-medium text-foreground truncate flex-1">
          {state.label}
        </span>
        <span className="text-[11px] text-foreground/30 bg-foreground/5 rounded-full px-1.5 py-0.5 tabular-nums">
          {sessions.length}
        </span>
      </div>

      {/* Card List - scrollable */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2 flex flex-col gap-2">
          {sessions.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-foreground/25">
              <span className="text-[11px]">No tasks</span>
            </div>
          ) : (
            sessions.map(session => (
              <BoardCard
                key={session.id}
                session={session}
                allSources={allSources}
                statusColor={state.color}
                onClick={() => onCardClick(session.id)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
