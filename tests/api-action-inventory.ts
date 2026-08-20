export type AuditedApp = 'Admin' | 'Studio'
export type ActionCategory = 'MUTATION' | 'READ_NETWORK' | 'LOCAL' | 'BACKGROUND'

interface AuditBase {
  id: string
  app: AuditedApp
  screen: string
  control: string
  category: ActionCategory
  evidence: string
  compliance: 'COMPLIANT'
}

export interface MutationAuditEntry extends AuditBase {
  category: 'MUTATION'
  request: string
  pendingLabel: string
  actionKey: string
  conflictKey: string
}

export interface ReadNetworkAuditEntry extends AuditBase {
  category: 'READ_NETWORK'
  request: string
  pendingLabel: string
  actionKey: string | null
  conflictKey: string | null
}

export interface NonActionAuditEntry extends AuditBase {
  category: 'LOCAL' | 'BACKGROUND'
  request: string | null
  pendingLabel: null
  actionKey: null
  conflictKey: null
}

export type ApiActionAuditEntry = MutationAuditEntry | ReadNetworkAuditEntry | NonActionAuditEntry

const mutation = (id: string, app: AuditedApp, screen: string, control: string, request: string, pendingLabel: string, actionKey: string, conflictKey: string, evidence: string): MutationAuditEntry => ({ id, app, screen, control, category: 'MUTATION', request, pendingLabel, actionKey, conflictKey, evidence, compliance: 'COMPLIANT' })
const readNetwork = (id: string, app: AuditedApp, screen: string, control: string, request: string, pendingLabel: string, actionKey: string | null, conflictKey: string | null, evidence: string): ReadNetworkAuditEntry => ({ id, app, screen, control, category: 'READ_NETWORK', request, pendingLabel, actionKey, conflictKey, evidence, compliance: 'COMPLIANT' })
const local = (id: string, app: AuditedApp, screen: string, control: string, evidence: string): NonActionAuditEntry => ({ id, app, screen, control, category: 'LOCAL', request: null, pendingLabel: null, actionKey: null, conflictKey: null, evidence, compliance: 'COMPLIANT' })
const background = (id: string, app: AuditedApp, screen: string, control: string, request: string, evidence: string): NonActionAuditEntry => ({ id, app, screen, control, category: 'BACKGROUND', request, pendingLabel: null, actionKey: null, conflictKey: null, evidence, compliance: 'COMPLIANT' })

const structuredManagers = [
  ['projects', 'Projects', 'Project'],
  ['notes', 'Notes', 'Note'],
  ['experience', 'Experience', 'Experience'],
  ['apps', 'AI Apps', 'AI App'],
] as const

const structuredEntries = structuredManagers.flatMap(([resource, screen, singular]) => [
  background(`admin.${resource}.load`, 'Admin', screen, 'Initial list load', `GET /api/admin/${resource}`, 'apps/admin/src/App.tsx#Crud.load'),
  mutation(`admin.${resource}.create`, 'Admin', screen, `Create ${singular} button or Enter`, `POST /api/admin/${resource}`, 'Creating...', `create-${resource}`, `${resource}-record-new`, 'apps/admin/src/App.tsx#Crud.save'),
  mutation(`admin.${resource}.update`, 'Admin', screen, `Update ${singular} button or Enter`, `PATCH /api/admin/${resource}/:id`, 'Saving...', `save-${resource}-:id`, `${resource}-record-:id`, 'apps/admin/src/App.tsx#Crud.save'),
  mutation(`admin.${resource}.delete`, 'Admin', screen, `Delete ${singular}`, `DELETE /api/admin/${resource}/:id`, 'Deleting...', `delete-${resource}-:id`, `${resource}-record-:id`, 'apps/admin/src/App.tsx#Crud.remove'),
  local(`admin.${resource}.local-editor`, 'Admin', screen, 'New, Edit, Cancel, and form field changes', 'apps/admin/src/App.tsx#Crud'),
])

export const API_ACTION_INVENTORY: readonly ApiActionAuditEntry[] = [
  mutation('admin.auth.sign-in', 'Admin', 'Auth', 'Sign In button or Enter', 'Supabase signInWithPassword then GET /api/admin/me', 'Signing in...', 'admin-login', 'admin-auth', 'apps/admin/src/AuthGate.tsx#login'),
  mutation('admin.auth.logout', 'Admin', 'Auth', 'Logout', 'Supabase signOut', 'Signing out...', 'admin-logout', 'admin-auth', 'apps/admin/src/AuthGate.tsx#logout'),
  background('admin.auth.bootstrap', 'Admin', 'Auth', 'Session/access check', 'Supabase getSession then GET /api/admin/me', 'apps/admin/src/AuthGate.tsx#check'),
  local('admin.shell.navigation', 'Admin', 'Shell', 'Screen navigation', 'apps/admin/src/App.tsx#AdminApp'),
  local('admin.shell.theme', 'Admin', 'Shell', 'Application theme selector', 'packages/ui/src/theme.tsx#AppThemeSelector'),
  background('admin.dashboard.load', 'Admin', 'Dashboard', 'Dashboard mount load', 'GET /api/admin/dashboard', 'apps/admin/src/App.tsx#Dashboard'),

  background('admin.content.load', 'Admin', 'Site Content', 'Initial draft/context load', 'POST /api/admin/content-revisions/draft then GET /api/admin/content/editor-context', 'apps/admin/src/App.tsx#VisualContent.effect'),
  mutation('admin.content.save', 'Admin', 'Site Content', 'Save Draft', 'PUT /api/admin/content-revisions/:id/values', 'Saving...', 'save-content-:key', 'content-revision-action', 'apps/admin/src/App.tsx#VisualContent.saveValue'),
  mutation('admin.content.quick-edit', 'Admin', 'Site Content', 'Inline double-click quick edit', 'PUT /api/admin/content-revisions/:id/values', 'Saving draft...', 'save-content-:key', 'content-revision-action', 'apps/admin/src/App.tsx#quickEdit'),
  mutation('admin.content.publish', 'Admin', 'Site Content', 'Publish Content', 'POST /api/admin/content-revisions/:id/publish then next draft/context load', 'Publishing...', 'publish-content', 'content-revision-action', 'apps/admin/src/App.tsx#publishContent'),
  mutation('admin.content.reload', 'Admin', 'Site Content', 'Reload Editor recovery', 'POST /api/admin/content-revisions/draft then GET /api/admin/content/editor-context', 'Reloading...', 'refresh-content-editor', 'content-revision-action', 'apps/admin/src/App.tsx#reloadEditorContext'),
  local('admin.content.preview', 'Admin', 'Site Content', 'Preview/Edit mode, route tabs, sections, and preview navigation', 'apps/admin/src/App.tsx#VisualContent'),
  local('admin.content.inspector', 'Admin', 'Site Content', 'Inspector selection, close, field changes, and media selection', 'apps/admin/src/App.tsx#ContentInspector'),
  background('admin.content.media-load', 'Admin', 'Site Content', 'Inspector media choices load', 'GET /api/admin/media', 'apps/admin/src/App.tsx#MediaPicker'),

  ...structuredEntries,

  background('admin.media.load', 'Admin', 'Media', 'Initial media list load', 'GET /api/admin/media', 'apps/admin/src/App.tsx#MediaManager.load'),
  mutation('admin.media.upload', 'Admin', 'Media', 'Select file for Upload Media', 'POST /api/admin/media/uploads/prepare → signed TUS upload → POST /api/admin/media/uploads/finalize', 'Uploading...', 'media-upload', 'media-upload', 'apps/admin/src/App.tsx#MediaManager.upload'),
  mutation('admin.media.delete', 'Admin', 'Media', 'Delete media confirmation', 'DELETE /api/admin/media/:id', 'Deleting...', 'delete-media-:id', 'media-record-:id', 'apps/admin/src/App.tsx#MediaManager.removeMedia'),

  background('admin.layouts.load', 'Admin', 'Layouts', 'Initial gallery load', 'GET /api/admin/layouts', 'apps/admin/src/App.tsx#Layouts.load'),
  background('admin.layouts.thumbnail', 'Admin', 'Layouts', 'Card thumbnail load', 'GET /api/admin/layouts/versions/:id/preview', 'apps/admin/src/App.tsx#Mini'),
  readNetwork('admin.layouts.preview', 'Admin', 'Layouts', 'Preview', 'GET /api/admin/layouts/versions/:id/preview', 'Loading Preview...', 'preview-layout-:id', null, 'apps/admin/src/App.tsx#Layouts.open'),
  mutation('admin.layouts.configure', 'Admin', 'Layouts', 'Configure Content', 'POST /api/admin/layouts/:id/configure', 'Configuring...', 'configure-layout-:id', 'layout-configuration', 'apps/admin/src/App.tsx#Layouts.configure'),
  local('admin.layouts.preview-controls', 'Admin', 'Layouts', 'Preview close, route, and device controls', 'apps/admin/src/App.tsx#FullPreview'),

  background('admin.settings.load', 'Admin', 'Settings', 'Initial settings draft/context load', 'POST /api/admin/settings-revisions/draft then GET /api/admin/settings', 'apps/admin/src/App.tsx#Settings.load'),
  mutation('admin.settings.save', 'Admin', 'Settings', 'Save Draft button or Enter', 'PUT /api/admin/settings-revisions/:id/values', 'Saving setting draft...', 'save-setting-:key', 'settings-revision-action', 'apps/admin/src/App.tsx#Settings.saveSetting'),
  mutation('admin.settings.publish', 'Admin', 'Settings', 'Publish Settings', 'POST /api/admin/settings-revisions/:id/publish', 'Publishing settings revision...', 'publish-settings', 'settings-revision-action', 'apps/admin/src/App.tsx#Settings.publishSettings'),
  local('admin.settings.edit', 'Admin', 'Settings', 'Edit existing setting into form', 'apps/admin/src/App.tsx#Settings'),

  background('admin.releases.load', 'Admin', 'Releases', 'Initial releases/options load', 'GET /api/admin/releases and /options', 'apps/admin/src/ReleaseManager.tsx#load'),
  mutation('admin.releases.create', 'Admin', 'Releases', 'Create Candidate', 'POST /api/admin/releases', 'Creating...', 'create', 'release-mutation', 'apps/admin/src/ReleaseManager.tsx#createCandidate'),
  readNetwork('admin.releases.preview', 'Admin', 'Releases', 'Preview', 'POST /api/admin/releases/:id/preview', 'Loading Preview...', 'preview-:id', null, 'apps/admin/src/ReleaseManager.tsx#openPreview'),
  mutation('admin.releases.validate', 'Admin', 'Releases', 'Validate', 'POST /api/admin/releases/:id/validate', 'Validating...', 'validate-:id', 'release-mutation', 'apps/admin/src/ReleaseManager.tsx#validate'),
  mutation('admin.releases.activate', 'Admin', 'Releases', 'Activate', 'POST /api/admin/releases/:id/activate', 'Activating...', 'activate-:id', 'release-mutation', 'apps/admin/src/ReleaseManager.tsx#activate'),
  mutation('admin.releases.rollback', 'Admin', 'Releases', 'Rollback', 'POST /api/admin/releases/:id/rollback', 'Rolling back...', 'rollback-:id', 'release-mutation', 'apps/admin/src/ReleaseManager.tsx#rollback'),
  local('admin.releases.controls', 'Admin', 'Releases', 'Snapshot selectors and preview close/route/device controls', 'apps/admin/src/ReleaseManager.tsx'),

  mutation('studio.auth.sign-in', 'Studio', 'Auth', 'Sign In button or Enter', 'Supabase signInWithPassword then GET /api/studio/me', 'Signing in...', 'studio-login', 'studio-auth', 'apps/studio/src/AuthGate.tsx#signIn'),
  mutation('studio.auth.logout', 'Studio', 'Auth', 'Logout', 'Supabase signOut', 'Signing out...', 'studio-logout', 'studio-auth', 'apps/studio/src/AuthGate.tsx#logout'),
  background('studio.auth.bootstrap', 'Studio', 'Auth', 'Session/access check and token refresh', 'Supabase getSession/refreshSession then GET /api/studio/me', 'apps/studio/src/AuthGate.tsx#check'),
  background('studio.auth.expiry', 'Studio', 'Auth', 'Expired-session local sign-out', 'Supabase local signOut', 'apps/studio/src/auth.ts#expireStudioSession'),

  background('studio.library.load', 'Studio', 'Layout Library', 'Initial/after-action library load', 'GET /api/studio/layouts', 'apps/studio/src/App.tsx#refreshLayouts'),
  mutation('studio.library.create-blank', 'Studio', 'Layout Library', 'Create Blank Layout', 'POST /api/studio/layouts', 'Creating...', 'create-blank', 'layout-creation', 'apps/studio/src/LayoutLibrary.tsx#create'),
  mutation('studio.library.create-cosmic', 'Studio', 'Layout Library', 'Create Cosmic Portfolio', 'POST /api/studio/layouts', 'Creating...', 'create-cosmic', 'layout-creation', 'apps/studio/src/LayoutLibrary.tsx#create'),
  mutation('studio.library.create-ai-age', 'Studio', 'Layout Library', 'Create AI Age Portfolio', 'POST /api/studio/layouts', 'Creating...', 'create-ai-age', 'layout-creation', 'apps/studio/src/LayoutLibrary.tsx#create'),
  mutation('studio.library.create-cinematic', 'Studio', 'Layout Library', 'Create Cinematic Transition Portfolio', 'POST /api/studio/layouts', 'Creating...', 'create-cinematic', 'layout-creation', 'apps/studio/src/LayoutLibrary.tsx#create'),
  readNetwork('studio.library.open', 'Studio', 'Layout Library', 'Card or menu Open', 'Navigate then GET exact editor document', 'Loading Studio...', null, null, 'apps/studio/src/App.tsx#openLayout'),
  mutation('studio.library.rename', 'Studio', 'Layout Library', 'Rename button or Enter', 'PATCH /api/studio/layouts/:id/rename', 'Saving...', 'rename-:id', 'layout-:id', 'apps/studio/src/LayoutLibrary.tsx#submitRename'),
  mutation('studio.library.duplicate', 'Studio', 'Layout Library', 'Duplicate', 'POST /api/studio/layouts/:id/duplicate', 'Duplicating...', 'duplicate-:id', 'layout-:id', 'apps/studio/src/LayoutLibrary.tsx#duplicate'),
  mutation('studio.library.archive', 'Studio', 'Layout Library', 'Archive', 'PATCH /api/studio/layouts/:id/archive', 'Archiving...', 'archive-:id', 'layout-:id', 'apps/studio/src/LayoutLibrary.tsx#archive'),
  mutation('studio.library.delete', 'Studio', 'Layout Library', 'Delete permanently confirmation', 'DELETE /api/studio/layouts/:id', 'Deleting...', 'delete-:id', 'layout-:id', 'apps/studio/src/LayoutLibrary.tsx#confirmDestructiveAction'),
  mutation('studio.library.discard', 'Studio', 'Layout Library', 'Discard Draft confirmation', 'DELETE /api/studio/layouts/:id/versions/:versionId', 'Discarding...', 'discard-:versionId', 'layout-:id', 'apps/studio/src/LayoutLibrary.tsx#confirmDestructiveAction'),
  local('studio.library.controls', 'Studio', 'Layout Library', 'Kebab, Rename/Delete/Discard modal open-close, Cancel, and Escape', 'apps/studio/src/LayoutLibrary.tsx'),

  background('studio.editor.hydration', 'Studio', 'Editor', 'Direct-route exact-version hydration', 'GET /api/studio/layouts/:id/versions/:versionId/editor', 'apps/studio/src/App.tsx#editorRouteEffect'),
  readNetwork('studio.editor.open-layout', 'Studio', 'Editor', 'Open layout from layout menu', 'Navigate then GET exact editor document', 'Loading Studio...', null, null, 'apps/studio/src/StudioEditor.tsx#onOpenLayout'),
  mutation('studio.editor.save-button', 'Studio', 'Editor', 'Save', 'PUT /api/studio/versions/:id/document then library refresh', 'Saving...', 'editor-save', 'studio-editor-api-action', 'apps/studio/src/StudioEditor.tsx#save'),
  mutation('studio.editor.save-shortcut', 'Studio', 'Editor', 'Ctrl/Cmd+S', 'PUT /api/studio/versions/:id/document then library refresh', 'Saving...', 'editor-save', 'studio-editor-api-action', 'apps/studio/src/StudioEditor.tsx#keyboardEffect'),
  mutation('studio.editor.validate', 'Studio', 'Editor', 'Validate', 'POST /api/studio/versions/:id/validate', 'Validating...', 'editor-validate', 'studio-editor-api-action', 'apps/studio/src/StudioEditor.tsx#validate'),
  mutation('studio.editor.publish', 'Studio', 'Editor', 'Publish', 'Atomic Save then POST /api/studio/versions/:id/publish then refresh', 'Publishing...', 'editor-publish', 'studio-editor-api-action', 'apps/studio/src/StudioEditor.tsx#publish'),
  mutation('studio.editor.create-draft', 'Studio', 'Editor', 'Create Draft', 'POST /api/studio/layouts/:id/drafts then refresh/open', 'Creating draft...', 'editor-create-draft', 'studio-editor-api-action', 'apps/studio/src/StudioEditor.tsx#createDraft'),
  mutation('studio.editor.create-blank', 'Studio', 'Editor', 'Create Blank from layout menu', 'POST /api/studio/layouts', 'Creating...', 'editor-create-blank', 'studio-editor-api-action', 'apps/studio/src/StudioEditor.tsx#createLayout'),
  mutation('studio.editor.create-cosmic', 'Studio', 'Editor', 'Create Cosmic from layout menu', 'POST /api/studio/layouts', 'Creating...', 'editor-create-cosmic', 'studio-editor-api-action', 'apps/studio/src/StudioEditor.tsx#createLayout'),
  mutation('studio.editor.create-ai-age', 'Studio', 'Editor', 'Create AI Age from layout menu', 'POST /api/studio/layouts', 'Creating...', 'editor-create-ai-age', 'studio-editor-api-action', 'apps/studio/src/StudioEditor.tsx#createLayout'),
  mutation('studio.editor.create-cinematic', 'Studio', 'Editor', 'Create Cinematic Transition from layout menu', 'POST /api/studio/layouts', 'Creating...', 'editor-create-cinematic', 'studio-editor-api-action', 'apps/studio/src/StudioEditor.tsx#createLayout'),
  mutation('studio.editor.duplicate', 'Studio', 'Editor', 'Duplicate Layout', 'POST /api/studio/layouts/:id/duplicate then refresh/open', 'Duplicating...', 'editor-duplicate-layout', 'studio-editor-api-action', 'apps/studio/src/StudioEditor.tsx#duplicateLayout'),
  mutation('studio.editor.archive', 'Studio', 'Editor', 'Archive confirmation', 'PATCH /api/studio/layouts/:id/archive then refresh', 'Archiving...', 'editor-archive-layout', 'studio-editor-api-action', 'apps/studio/src/StudioEditor.tsx#archiveLayout'),
  local('studio.editor.preview', 'Studio', 'Editor', 'Runtime Preview open/close and route controls', 'apps/studio/src/StudioEditor.tsx#preview'),
  local('studio.editor.builder', 'Studio', 'Editor', 'Node selection, drag/drop, Inspector edits, element and token changes', 'apps/studio/src/StudioEditor.tsx#workspace'),
  local('studio.editor.pages', 'Studio', 'Editor', 'Page select/add/reorder/duplicate/delete', 'apps/studio/src/StudioEditor.tsx#secondaryTools'),
  local('studio.editor.chrome', 'Studio', 'Editor', 'Undo/redo, zoom, responsive mode, panels, menus, and application theme', 'apps/studio/src/StudioEditor.tsx#toolbar'),
  local('studio.editor.navigation', 'Studio', 'Editor', 'Back to Layouts and unsaved-changes confirmation', 'apps/studio/src/StudioEditor.tsx#requestBackToLayouts'),
  local('studio.editor.retry', 'Studio', 'Editor Error Boundary', 'Retry and Back to Layouts', 'apps/studio/src/StudioErrorBoundary.tsx'),
]
