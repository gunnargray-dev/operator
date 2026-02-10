/**
 * TaskDetailPanel - Full task detail view in sidebar
 *
 * Shows the complete task conversation using the same components
 * as the main chat view (TurnCard, UserMessageBubble).
 */

import * as React from 'react'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { ExternalLink, ListTodo, Files, Radio, Loader2, Send, ArrowRight } from 'lucide-react'
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


type DetailTab = 'live' | 'task' | 'files'

// =============================================================================
// LiveOutputSection - Terminal-like streaming output view
// =============================================================================

function LiveOutputSection({
  messages,
  isProcessing,
  currentStep,
}: {
  messages: Message[]
  isProcessing?: boolean
  currentStep?: string
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  // Extract streaming text from the most recent assistant messages
  const streamingContent = useMemo(() => {
    const lines: { id: string; text: string; type: 'output' | 'tool' | 'thinking' }[] = []

    // Get last 20 messages for recent context
    const recentMessages = messages.slice(-20)

    for (const msg of recentMessages) {
      if (msg.role !== 'assistant') continue

      // Extract text content
      const content = msg.content
      if (typeof content === 'string') {
        if (content.trim()) {
          lines.push({ id: msg.id, text: content, type: 'output' })
        }
      } else if (Array.isArray(content)) {
        for (const block of content as Array<{ type: string; text?: string; name?: string; thinking?: string }>) {
          if (block.type === 'text' && block.text) {
            lines.push({ id: `${msg.id}-text`, text: block.text, type: 'output' })
          } else if (block.type === 'tool_use') {
            const toolName = block.name || 'tool'
            lines.push({ id: `${msg.id}-tool-${toolName}`, text: `▸ ${toolName}`, type: 'tool' })
          } else if (block.type === 'thinking' && block.thinking) {
            // Show just the first line of thinking
            const firstLine = block.thinking.split('\n')[0]
            if (firstLine.trim()) {
              lines.push({ id: `${msg.id}-think`, text: `💭 ${firstLine.slice(0, 100)}...`, type: 'thinking' })
            }
          }
        }
      }
    }

    return lines
  }, [messages])

  // Auto-scroll to bottom when content changes
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [streamingContent, autoScroll])

  // Detect manual scrolling
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50
    setAutoScroll(isAtBottom)
  }, [])

  return (
    <div className="flex flex-col h-full">
      {/* Status bar */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-foreground/8 bg-foreground/[0.02]">
        {isProcessing ? (
          <>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
            </span>
            <span className="text-[11px] text-success font-medium">Live</span>
            {currentStep && (
              <span className="text-[11px] text-foreground/50 truncate">
                — {currentStep}
              </span>
            )}
          </>
        ) : (
          <>
            <span className="h-2 w-2 rounded-full bg-foreground/30" />
            <span className="text-[11px] text-foreground/50">Idle</span>
          </>
        )}
      </div>

      {/* Output stream */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto font-mono text-[11px] leading-relaxed p-3 bg-[#0d0d0d]"
      >
        {streamingContent.length === 0 ? (
          <div className="text-foreground/30 italic">
            Waiting for output...
          </div>
        ) : (
          <div className="space-y-1">
            {streamingContent.map((line) => (
              <div
                key={line.id}
                className={cn(
                  "whitespace-pre-wrap break-words",
                  line.type === 'output' && "text-foreground/80",
                  line.type === 'tool' && "text-info/70",
                  line.type === 'thinking' && "text-foreground/40 italic"
                )}
              >
                {line.text}
              </div>
            ))}
            {isProcessing && (
              <div className="flex items-center gap-1.5 text-success/70 mt-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Processing...</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Auto-scroll indicator */}
      {!autoScroll && (
        <button
          onClick={() => {
            setAutoScroll(true)
            if (scrollRef.current) {
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight
            }
          }}
          className="absolute bottom-16 right-4 px-2 py-1 rounded bg-foreground/10 text-[10px] text-foreground/60 hover:bg-foreground/20"
        >
          ↓ Scroll to bottom
        </button>
      )}
    </div>
  )
}

/**
 * Panel displaying task detail with messages and files
 */
export function TaskDetailPanel({ sessionId, closeButton }: TaskDetailPanelProps) {
  const { onOpenFile, onOpenUrl, closeRightSidebar, onSendMessage } = useAppShellContext()
  const sessionMetaMap = useAtomValue(sessionMetaMapAtom)
  const meta = sessionId ? sessionMetaMap.get(sessionId) : null

  // Tab state - default to 'live' if task is processing
  const [activeTab, setActiveTab] = useState<DetailTab>(() =>
    meta?.isProcessing ? 'live' : 'task'
  )

  // Auto-switch to live tab when processing starts
  useEffect(() => {
    if (meta?.isProcessing) {
      setActiveTab('live')
    }
  }, [meta?.isProcessing])

  // Chat input state
  const [inputValue, setInputValue] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || !sessionId || isSubmitting) return

    setIsSubmitting(true)
    try {
      onSendMessage(sessionId, inputValue.trim())
      setInputValue('')
    } finally {
      setIsSubmitting(false)
    }
  }, [inputValue, sessionId, isSubmitting, onSendMessage])

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
          onClick={() => setActiveTab('live')}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors",
            activeTab === 'live'
              ? "bg-foreground/[0.08] text-foreground"
              : "text-foreground/50 hover:text-foreground/70 hover:bg-foreground/[0.04]"
          )}
        >
          <Radio className={cn("h-3.5 w-3.5", meta?.isProcessing && "text-success")} />
          Live
          {meta?.isProcessing && (
            <span className="relative flex h-1.5 w-1.5 ml-0.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
            </span>
          )}
        </button>
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

      {/* Live Tab Content */}
      {activeTab === 'live' && (
        <div className="flex-1 min-h-0 overflow-hidden relative">
          <LiveOutputSection
            messages={fullSession?.messages || []}
            isProcessing={meta?.isProcessing}
            currentStep={meta?.currentStep}
          />
        </div>
      )}

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
                          onAcceptPlan={() => {
                            if (sessionId) {
                              // Send message directly to execute the plan
                              onSendMessage(sessionId, 'Plan approved, please execute.')
                            }
                          }}
                          onAcceptPlanWithCompact={() => {
                            if (sessionId) {
                              // For compact, we still need the event since it requires FreeFormInput's compaction flow
                              // But as a fallback, just execute without compacting
                              const planMessage = fullSession?.messages?.findLast(m => m.role === 'plan')
                              const planPath = planMessage?.planPath
                              if (planPath) {
                                onSendMessage(sessionId, `Please read the plan at ${planPath} and execute it.`)
                              } else {
                                onSendMessage(sessionId, 'Plan approved, please execute.')
                              }
                            }
                          }}
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

      {/* Chat Input */}
      <div className="px-3 py-2 border-t border-foreground/8">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSendMessage()
          }}
          className="flex items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Send a message..."
            disabled={isSubmitting || meta?.isProcessing}
            className={cn(
              "flex-1 h-8 px-3 text-[13px] bg-foreground/5 border border-foreground/10 rounded-lg",
              "placeholder:text-foreground/30",
              "focus:outline-none focus:border-foreground/20",
              "disabled:opacity-50"
            )}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isSubmitting || meta?.isProcessing}
            className={cn(
              "shrink-0 h-8 px-3 rounded-lg text-[13px] font-medium",
              "flex items-center gap-1.5",
              "text-accent hover:bg-accent/10",
              "disabled:opacity-30 disabled:hover:bg-transparent",
              "transition-colors"
            )}
          >
            {isSubmitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                Send
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </form>
      </div>

      {/* Footer action */}
      <div className="px-3 py-2 border-t border-foreground/5">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleViewFull}
          className="w-full h-8 text-xs text-foreground/50 hover:text-foreground"
        >
          <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
          Open Full
        </Button>
      </div>
    </div>
  )
}
