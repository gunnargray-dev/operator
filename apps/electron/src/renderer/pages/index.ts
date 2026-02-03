/**
 * Pages Index
 *
 * Export all page components for use in MainContentPanel.
 */

export { default as ChatPage } from './ChatPage'
export { default as CanvasPage } from './CanvasPage'
export { default as BoardPage } from './BoardPage'
export { default as IntegrationsPage } from './IntegrationsPage'
export { default as FilesPage } from './FilesPage'
export { default as PulsePage } from './PulsePage'
export { default as SourceInfoPage } from './SourceInfoPage'

// Settings pages
export {
  SettingsNavigator,
  AppSettingsPage,
  WorkspaceSettingsPage,
  PermissionsSettingsPage,
  ShortcutsPage,
  PreferencesPage,
} from './settings'
