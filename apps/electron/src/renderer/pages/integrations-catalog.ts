/**
 * Hardcoded catalog of available integrations.
 * Used by IntegrationsPage to show what connectors are available.
 */

export type IntegrationCategory =
  | 'communication'
  | 'productivity'
  | 'development'
  | 'data'
  | 'design'
  | 'crm'

export interface IntegrationCatalogEntry {
  id: string
  name: string
  description: string
  category: IntegrationCategory
  icon: string
  type: 'source' | 'skill'
}

export const CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  communication: 'Communication',
  productivity: 'Productivity',
  development: 'Development',
  data: 'Data Hubs',
  design: 'Design',
  crm: 'CRM & Sales',
}

export const INTEGRATION_CATALOG: IntegrationCatalogEntry[] = [
  // Communication
  { id: 'slack', name: 'Slack', description: 'Send messages, read channels, and manage threads', category: 'communication', icon: '💬', type: 'source' },
  { id: 'gmail', name: 'Gmail', description: 'Read, send, and draft emails', category: 'communication', icon: '📧', type: 'source' },

  // Productivity
  { id: 'notion', name: 'Notion', description: 'Create pages, databases, manage content', category: 'productivity', icon: '📝', type: 'source' },
  { id: 'google-drive', name: 'Google Drive', description: 'Read and create docs, sheets, slides', category: 'productivity', icon: '📁', type: 'source' },
  { id: 'confluence', name: 'Confluence', description: 'Wiki pages, spaces, knowledge base', category: 'productivity', icon: '📚', type: 'source' },

  // Development
  { id: 'github', name: 'GitHub', description: 'Repos, issues, PRs, code search', category: 'development', icon: '🐙', type: 'source' },
  { id: 'jira', name: 'Jira', description: 'Issues, sprints, project tracking', category: 'development', icon: '🎯', type: 'source' },
  { id: 'linear', name: 'Linear', description: 'Modern issue tracking for teams', category: 'development', icon: '📐', type: 'source' },

  // Data & Analytics
  { id: 'snowflake', name: 'Snowflake', description: 'Query data warehouse tables and views', category: 'data', icon: '❄️', type: 'source' },
  { id: 'bigquery', name: 'BigQuery', description: 'Run analytics queries on GCP data', category: 'data', icon: '📊', type: 'source' },
  { id: 'tableau', name: 'Tableau', description: 'Dashboards, data visualizations', category: 'data', icon: '📈', type: 'source' },

  // Design
  { id: 'figma', name: 'Figma', description: 'Read designs, extract assets and specs', category: 'design', icon: '🎨', type: 'source' },

  // CRM & Sales
  { id: 'salesforce', name: 'Salesforce', description: 'CRM data, leads, accounts, reports', category: 'crm', icon: '☁️', type: 'source' },
  { id: 'hubspot', name: 'HubSpot', description: 'Marketing, contacts, deal pipeline', category: 'crm', icon: '🧲', type: 'source' },
]
