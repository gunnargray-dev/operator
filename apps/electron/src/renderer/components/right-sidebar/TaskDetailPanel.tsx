/**
 * TaskDetailPanel - Full task detail view in sidebar
 *
 * Shows the complete task conversation using the same components
 * as the main chat view (TurnCard, UserMessageBubble).
 */

import * as React from 'react'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { ExternalLink, ListTodo, Files } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PanelHeader } from '../app-shell/PanelHeader'
import { ScrollArea } from '../ui/scroll-area'
import { Button } from '../ui/button'
import { SessionFilesSection } from './SessionFilesSection'
import { useAppShellContext } from '@/context/AppShellContext'
import { sessionAtomFamily, ensureSessionMessagesLoadedAtom, sessionMetaMapAtom } from '@/atoms/sessions'
import { navigate, routes } from '@/lib/navigate'
import { TurnCard, UserMessageBubble, groupMessagesByTurn, type AssistantTurn, type UserTurn } from '@craft-agent/ui'
import { CHAT_LAYOUT } from '@/config/layout'
import type { Message } from '../../../shared/types'

export interface TaskDetailPanelProps {
  sessionId?: string
  closeButton?: React.ReactNode
}

/**
 * Wrapper to render a Message using UserMessageBubble
 * Adapts Message props to UserMessageBubble props
 */
function MessageBubble({
  message,
  onOpenFile,
  onOpenUrl,
}: {
  message: Message
  onOpenFile?: (path: string) => void
  onOpenUrl?: (url: string) => void
}) {
  // Extract content as string (content can be string or ContentBlock[])
  let content = ''
  if (typeof message.content === 'string') {
    content = message.content
  } else if (Array.isArray(message.content)) {
    content = (message.content as Array<{ type: string; text?: string }>)
      .filter(c => c.type === 'text' && typeof c.text === 'string')
      .map(c => c.text as string)
      .join('\n')
  }

  if (message.role === 'user') {
    return (
      <UserMessageBubble
        content={content}
        attachments={message.attachments}
        badges={message.badges}
        isPending={message.isPending}
        isQueued={message.isQueued}
        ultrathink={message.ultrathink}
        onUrlClick={onOpenUrl}
        onFileClick={onOpenFile}
      />
    )
  }

  // For system messages, use a simpler display
  return (
    <div className="text-sm text-foreground/60 py-2">
      {content}
    </div>
  )
}


type DetailTab = 'task' | 'files'

/**
 * Panel displaying task detail with messages and files
 */
export function TaskDetailPanel({ sessionId, closeButton }: TaskDetailPanelProps) {
  const { onOpenFile, onOpenUrl, closeRightSidebar } = useAppShellContext()
  const sessionMetaMap = useAtomValue(sessionMetaMapAtom)
  const meta = sessionId ? sessionMetaMap.get(sessionId) : null

  // Tab state
  const [activeTab, setActiveTab] = useState<DetailTab>('task')

  // Load full session with messages
  const ensureMessagesLoaded = useSetAtom(ensureSessionMessagesLoadedAtom)
  const fullSession = useAtomValue(sessionAtomFamily(sessionId || ''))

  // Load messages when panel mounts
  useEffect(() => {
    if (sessionId) {
      ensureMessagesLoaded(sessionId)
    }
  }, [sessionId, ensureMessagesLoaded])

  // Group messages into turns
  const turns = useMemo(() => {
    if (!fullSession?.messages?.length) return []
    return groupMessagesByTurn(fullSession.messages)
  }, [fullSession?.messages])

  // Actions
  const handleViewFull = useCallback(() => {
    if (sessionId) {
      closeRightSidebar?.()
      navigate(routes.view.allChats(sessionId))
    }
  }, [sessionId, closeRightSidebar])

  // Early return if no sessionId
  if (!sessionId) {
    return (
      <div className="h-full flex flex-col">
        <PanelHeader title="Task Details" actions={closeButton} />
        <div className="flex-1 flex items-center justify-center text-muted-foreground p-4">
          <p className="text-sm text-center">No task selected</p>
        </div>
      </div>
    )
  }

  const title = meta?.name || meta?.preview || 'Untitled Task'

  return (
    <div className="h-full flex flex-col">
      {/* Header with task name */}
      <PanelHeader
        title={title}
        actions={closeButton}
      />

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-foreground/8">
        <button
          onClick={() => setActiveTab('task')}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors",
            activeTab === 'task'
              ? "bg-foreground/[0.08] text-foreground"
              : "text-foreground/50 hover:text-foreground/70 hover:bg-foreground/[0.04]"
          )}
        >
          <ListTodo className="h-3.5 w-3.5" />
          Task
        </button>
        <button
          onClick={() => setActiveTab('files')}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors",
            activeTab === 'files'
              ? "bg-foreground/[0.08] text-foreground"
              : "text-foreground/50 hover:text-foreground/70 hover:bg-foreground/[0.04]"
          )}
        >
          <Files className="h-3.5 w-3.5" />
          Files
        </button>
      </div>

      {/* Task Tab Content */}
      {activeTab === 'task' && (
        <>
          {/* Messages section - uses same components as main chat */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="px-3 py-2">
                {turns.length === 0 ? (
                  <div className="p-4 text-center text-foreground/40 text-sm">
                    No messages yet
                  </div>
                ) : (
                  turns.map((turn, index) => {
                    // User turns - render with MessageBubble wrapper
                    if (turn.type === 'user') {
                      const userTurn = turn as UserTurn
                      return (
                        <div key={`user-${userTurn.message.id}`} className={CHAT_LAYOUT.userMessagePadding}>
                          <MessageBubble
                            message={userTurn.message}
                            onOpenFile={onOpenFile}
                            onOpenUrl={onOpenUrl}
                          />
                        </div>
                      )
                    }

                    // System turns
                    if (turn.type === 'system') {
                      return (
                        <MessageBubble
                          key={`system-${turn.message.id}`}
                          message={turn.message}
                          onOpenFile={onOpenFile}
                          onOpenUrl={onOpenUrl}
                        />
                      )
                    }

                    // Assistant turns - render with TurnCard
                    if (turn.type === 'assistant') {
                      const assistantTurn = turn as AssistantTurn
                      const isLastResponse = index === turns.length - 1 || !turns.slice(index + 1).some(t => t.type === 'user')

                      return (
                        <TurnCard
                          key={`turn-${assistantTurn.turnId}`}
                          sessionId={sessionId}
                          turnId={assistantTurn.turnId}
                          activities={assistantTurn.activities}
                          response={assistantTurn.response}
                          intent={assistantTurn.intent}
                          isStreaming={assistantTurn.isStreaming}
                          isComplete={assistantTurn.isComplete}
                          todos={assistantTurn.todos}
                          onOpenFile={onOpenFile}
                          onOpenUrl={onOpenUrl}
                          isLastResponse={isLastResponse}
                        />
                      )
                    }

                    return null
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        </>
      )}

      {/* Files Tab Content */}
      {activeTab === 'files' && (
        <div className="flex-1 min-h-0 overflow-hidden">
          <SessionFilesSection sessionId={sessionId} />
        </div>
      )}

      {/* Footer action */}
      <div className="px-3 py-2 border-t border-foreground/8">
        <Button
          variant="outline"
          size="sm"
          onClick={handleViewFull}
          className="w-full h-8 text-xs"
        >
          <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
          Open Full
        </Button>
      </div>
    </div>
  )
}
