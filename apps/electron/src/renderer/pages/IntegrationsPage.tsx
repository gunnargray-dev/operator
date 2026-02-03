import * as React from 'react'
import { useMemo } from 'react'
import { useAtomValue } from 'jotai'
import { PanelHeader } from '@/components/app-shell/PanelHeader'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SourceAvatar } from '@/components/ui/source-avatar'
import { SkillAvatar } from '@/components/ui/skill-avatar'
import { sourcesAtom } from '@/atoms/sources'
import { skillsAtom } from '@/atoms/skills'
import { deriveConnectionStatus } from '@/components/ui/source-status-indicator'
import { navigate, routes } from '@/lib/navigate'
import { cn } from '@/lib/utils'
import {
  INTEGRATION_CATALOG,
  CATEGORY_LABELS,
  type IntegrationCatalogEntry,
  type IntegrationCategory,
} from './integrations-catalog'

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-3 mt-6 first:mt-0">
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-foreground/40">
        {title}
      </h2>
      {count !== undefined && (
        <span className="text-[10px] text-foreground/30 bg-foreground/5 rounded-full px-1.5 py-0.5 tabular-nums">
          {count}
        </span>
      )}
    </div>
  )
}

function IntegrationRow({
  icon,
  name,
  description,
  action,
  onClick,
}: {
  icon: React.ReactNode
  name: string
  description: string
  action: React.ReactNode
  onClick?: () => void
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
        onClick && 'cursor-pointer hover:bg-foreground/[0.03]',
      )}
      onClick={onClick}
    >
      <div className="h-10 w-10 rounded-[10px] bg-foreground/[0.05] flex items-center justify-center shrink-0 text-lg">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-foreground truncate">{name}</p>
        <p className="text-[11px] text-foreground/40 truncate">{description}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  )
}

function StatusBadge({ label, variant }: { label: string; variant: 'connected' | 'active' | 'available' }) {
  return (
    <span
      className={cn(
        'text-[11px] font-medium px-2 py-0.5 rounded-full',
        variant === 'connected' && 'text-success bg-success/10',
        variant === 'active' && 'text-accent bg-accent/10',
        variant === 'available' && 'text-foreground/40 bg-foreground/5',
      )}
    >
      {label}
    </span>
  )
}

function ConnectButton() {
  return (
    <button
      className="text-[11px] font-medium px-3 py-1 rounded-md border border-foreground/10 text-foreground/50 hover:text-foreground/70 hover:border-foreground/20 hover:bg-foreground/[0.03] transition-colors"
      onClick={(e) => {
        e.stopPropagation()
        // Placeholder — no action yet
      }}
    >
      Connect
    </button>
  )
}

export default function IntegrationsPage() {
  const sources = useAtomValue(sourcesAtom)
  const skills = useAtomValue(skillsAtom)

  // Split sources by connection status
  const { connectedSources, otherSources } = useMemo(() => {
    const connected: typeof sources = []
    const other: typeof sources = []
    for (const source of sources) {
      const status = deriveConnectionStatus(source)
      if (status === 'connected') {
        connected.push(source)
      } else {
        other.push(source)
      }
    }
    return { connectedSources: connected, otherSources: other }
  }, [sources])

  // Build set of connected source slugs/providers for matching against catalog
  const connectedIds = useMemo(() => {
    const ids = new Set<string>()
    for (const source of sources) {
      ids.add(source.config.slug)
      if (source.config.provider) ids.add(source.config.provider)
    }
    return ids
  }, [sources])

  // Group catalog entries by category, excluding connected ones
  const catalogByCategory = useMemo(() => {
    const groups = new Map<IntegrationCategory, IntegrationCatalogEntry[]>()
    for (const entry of INTEGRATION_CATALOG) {
      if (connectedIds.has(entry.id)) continue
      const list = groups.get(entry.category) || []
      list.push(entry)
      groups.set(entry.category, list)
    }
    return groups
  }, [connectedIds])

  const hasConnected = connectedSources.length > 0 || skills.length > 0 || otherSources.length > 0

  return (
    <div className="flex flex-col h-full">
      <PanelHeader title="Integrations" />

      <ScrollArea className="flex-1 min-h-0">
        <div className="px-4 pb-6 pt-2">
          {/* Connected section */}
          {hasConnected && (
            <>
              <SectionHeader
                title="Connected"
                count={connectedSources.length + skills.length + otherSources.length}
              />
              <div className="flex flex-col gap-0.5">
                {connectedSources.map((source) => (
                  <IntegrationRow
                    key={`source-${source.config.slug}`}
                    icon={<SourceAvatar source={source} size="sm" />}
                    name={source.config.name}
                    description={source.config.tagline || source.config.type.toUpperCase()}
                    action={<StatusBadge label="Connected" variant="connected" />}
                    onClick={() => navigate(routes.view.sources({ sourceSlug: source.config.slug }))}
                  />
                ))}
                {otherSources.map((source) => {
                  const status = deriveConnectionStatus(source)
                  const label =
                    status === 'needs_auth' ? 'Needs Auth' :
                    status === 'failed' ? 'Failed' :
                    status === 'local_disabled' ? 'Disabled' : 'Not Tested'
                  return (
                    <IntegrationRow
                      key={`source-${source.config.slug}`}
                      icon={<SourceAvatar source={source} size="sm" />}
                      name={source.config.name}
                      description={source.config.tagline || source.config.type.toUpperCase()}
                      action={<StatusBadge label={label} variant="available" />}
                      onClick={() => navigate(routes.view.sources({ sourceSlug: source.config.slug }))}
                    />
                  )
                })}
                {skills.map((skill) => (
                  <IntegrationRow
                    key={`skill-${skill.slug}`}
                    icon={<SkillAvatar skill={skill} size="sm" />}
                    name={skill.metadata.name}
                    description={skill.metadata.description || 'Skill'}
                    action={<StatusBadge label="Active" variant="active" />}
                    onClick={() => navigate(routes.view.skills(skill.slug))}
                  />
                ))}
              </div>
            </>
          )}

          {/* Available catalog entries grouped by category */}
          {Array.from(catalogByCategory.entries()).map(([category, entries]) => (
            <React.Fragment key={category}>
              <SectionHeader title={CATEGORY_LABELS[category]} />
              <div className="flex flex-col gap-0.5">
                {entries.map((entry) => (
                  <IntegrationRow
                    key={entry.id}
                    icon={<span>{entry.icon}</span>}
                    name={entry.name}
                    description={entry.description}
                    action={<ConnectButton />}
                  />
                ))}
              </div>
            </React.Fragment>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
