/**
 * TaskInputOverlay - Quick task input modal
 *
 * Raycast-style overlay for quickly firing off tasks.
 * Opens with the New Task button, submits to activity view.
 */

import * as React from 'react'
import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  ArrowRight,
  Sparkles,
  Zap,
  Command,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// =============================================================================
// Types
// =============================================================================

interface TaskInputOverlayProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (prompt: string) => Promise<void>
  isSubmitting?: boolean
}

// =============================================================================
// Component
// =============================================================================

export function TaskInputOverlay({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
}: TaskInputOverlayProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setValue('')
      // Small delay to ensure the animation has started
      setTimeout(() => {
        textareaRef.current?.focus()
      }, 50)
    }
  }, [open])

  // Handle submit
  const handleSubmit = useCallback(async () => {
    const trimmed = value.trim()
    if (!trimmed || isSubmitting) return

    await onSubmit(trimmed)
    setValue('')
    onOpenChange(false)
  }, [value, isSubmitting, onSubmit, onOpenChange])

  // Handle keyboard
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onOpenChange(false)
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }, [onOpenChange, handleSubmit])

  // Handle backdrop click
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onOpenChange(false)
    }
  }, [onOpenChange])

  // Auto-resize textarea
  const handleInput = useCallback(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    }
  }, [])

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-modal bg-black/60 backdrop-blur-sm"
            onClick={handleBackdropClick}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            className="fixed top-[20%] left-1/2 -translate-x-1/2 z-modal w-full max-w-[600px] px-4"
          >
            <div className="popover-styled overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-foreground/[0.06]">
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Zap className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <h2 className="text-[14px] font-semibold text-foreground">New Task</h2>
                  <p className="text-[11px] text-foreground/40">Describe what you want to accomplish</p>
                </div>
              </div>

              {/* Input area */}
              <div className="p-4">
                <textarea
                  ref={textareaRef}
                  value={value}
                  onChange={(e) => {
                    setValue(e.target.value)
                    handleInput()
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g., Search for the latest AI news and summarize..."
                  className={cn(
                    "w-full min-h-[80px] max-h-[200px] px-4 py-3 rounded-lg resize-none",
                    "bg-foreground/[0.03] border border-foreground/10",
                    "text-[15px] text-foreground placeholder:text-foreground/30",
                    "focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20",
                    "transition-colors"
                  )}
                  disabled={isSubmitting}
                />
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-5 py-3 border-t border-foreground/[0.06] bg-foreground/[0.02]">
                {/* Hints */}
                <div className="flex items-center gap-4 text-[11px] text-foreground/35">
                  <span className="flex items-center gap-1.5">
                    <kbd className="px-1.5 py-0.5 rounded bg-foreground/10 font-mono text-[10px]">↵</kbd>
                    Submit
                  </span>
                  <span className="flex items-center gap-1.5">
                    <kbd className="px-1.5 py-0.5 rounded bg-foreground/10 font-mono text-[10px]">Esc</kbd>
                    Cancel
                  </span>
                  <span className="flex items-center gap-1.5">
                    <kbd className="px-1.5 py-0.5 rounded bg-foreground/10 font-mono text-[10px]">⇧↵</kbd>
                    New line
                  </span>
                </div>

                {/* Submit button */}
                <button
                  onClick={handleSubmit}
                  disabled={!value.trim() || isSubmitting}
                  className={cn(
                    "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium",
                    "transition-all duration-150",
                    value.trim() && !isSubmitting
                      ? "bg-accent text-white hover:bg-accent/90 shadow-sm"
                      : "bg-foreground/10 text-foreground/30 cursor-not-allowed"
                  )}
                >
                  {isSubmitting ? (
                    <>
                      <Sparkles className="h-4 w-4 animate-pulse" />
                      Starting...
                    </>
                  ) : (
                    <>
                      Run Task
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
