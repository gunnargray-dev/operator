/**
 * ScheduleConfigPanel - Dialog for configuring recurring task schedules
 *
 * Allows users to:
 * - Enable/disable scheduling
 * - Set interval (15m, 30m, 1h, 4h, 12h, daily)
 * - Write the prompt sent each cycle
 * - Choose permission policy (Explore/Ask/Auto)
 * - Set max errors before auto-disable
 */

import * as React from 'react'
import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ScheduleConfig } from '@craft-agent/shared/sessions'

const INTERVAL_OPTIONS = [
  { label: '15 minutes', value: '900000' },
  { label: '30 minutes', value: '1800000' },
  { label: '1 hour', value: '3600000' },
  { label: '4 hours', value: '14400000' },
  { label: '12 hours', value: '43200000' },
  { label: 'Daily', value: '86400000' },
]

const PERMISSION_OPTIONS = [
  { label: 'Explore', value: 'deny-all', description: 'Read-only, blocks writes' },
  { label: 'Ask', value: 'allow-safe', description: 'Prompts for risky commands' },
  { label: 'Auto', value: 'allow-all', description: 'Auto-approves all commands' },
] as const

interface ScheduleConfigPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionId: string
  sessionName: string
  currentConfig?: ScheduleConfig | null
  onSave: (config: ScheduleConfig | null) => void
}

export function ScheduleConfigPanel({
  open,
  onOpenChange,
  sessionName,
  currentConfig,
  onSave,
}: ScheduleConfigPanelProps) {
  const [enabled, setEnabled] = useState(currentConfig?.enabled ?? true)
  const [intervalMs, setIntervalMs] = useState(String(currentConfig?.intervalMs ?? 1800000))
  const [prompt, setPrompt] = useState(currentConfig?.prompt ?? '')
  const [permissionPolicy, setPermissionPolicy] = useState<ScheduleConfig['permissionPolicy']>(
    currentConfig?.permissionPolicy ?? 'allow-safe'
  )
  const [maxErrors, setMaxErrors] = useState(currentConfig?.maxErrors ?? 5)

  // Reset form when dialog opens with new config
  useEffect(() => {
    if (open) {
      setEnabled(currentConfig?.enabled ?? true)
      setIntervalMs(String(currentConfig?.intervalMs ?? 1800000))
      setPrompt(currentConfig?.prompt ?? '')
      setPermissionPolicy(currentConfig?.permissionPolicy ?? 'allow-safe')
      setMaxErrors(currentConfig?.maxErrors ?? 5)
    }
  }, [open, currentConfig])

  const handleSave = () => {
    if (!prompt.trim()) return

    const config: ScheduleConfig = {
      enabled,
      intervalMs: Number(intervalMs),
      prompt: prompt.trim(),
      permissionPolicy,
      maxErrors,
      lastExecutedAt: currentConfig?.lastExecutedAt,
      errorCount: currentConfig?.errorCount ?? 0,
    }
    onSave(config)
    onOpenChange(false)
  }

  const handleDisable = () => {
    onSave(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-sm font-medium">
            Configure Schedule
          </DialogTitle>
          <p className="text-xs text-muted-foreground truncate">
            {sessionName || 'Untitled'}
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Enable toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="schedule-enabled" className="text-xs">Enabled</Label>
            <Switch
              id="schedule-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>

          {/* Interval */}
          <div className="space-y-1.5">
            <Label className="text-xs">Interval</Label>
            <Select value={intervalMs} onValueChange={setIntervalMs}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTERVAL_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Prompt */}
          <div className="space-y-1.5">
            <Label className="text-xs">Prompt</Label>
            <Textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Message sent to the agent each cycle..."
              className="min-h-[80px] text-xs resize-none"
            />
          </div>

          {/* Permission policy */}
          <div className="space-y-1.5">
            <Label className="text-xs">Permission Policy</Label>
            <Select value={permissionPolicy} onValueChange={v => setPermissionPolicy(v as ScheduleConfig['permissionPolicy'])}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERMISSION_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    <span>{opt.label}</span>
                    <span className="ml-2 text-muted-foreground">{opt.description}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Max errors */}
          <div className="space-y-1.5">
            <Label className="text-xs">Max Errors Before Disable</Label>
            <Select value={String(maxErrors)} onValueChange={v => setMaxErrors(Number(v))}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[3, 5, 10, 20].map(n => (
                  <SelectItem key={n} value={String(n)} className="text-xs">
                    {n} errors
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2">
          {currentConfig && (
            <Button variant="ghost" size="sm" onClick={handleDisable} className="text-xs mr-auto text-destructive hover:text-destructive">
              Remove Schedule
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!prompt.trim()} className="text-xs">
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
