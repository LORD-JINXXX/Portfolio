import React from 'react'
import { createBlankDocument, useEditorState } from '@platform/builder-core'
import { AppThemeProvider } from '@platform/ui'
import type { EditorDocument } from '@platform/contracts'
import { useLocation, useNavigate } from 'react-router-dom'
import { AuthGate, StudioAuthContext } from './AuthGate'
import { apiFetch } from './api'
import { parseStudioEditorRoute, selectedPageFromSearch, studioEditorPath, studioLayoutsPath } from './routing'
import { StudioEditor } from './StudioEditor'
import { StudioErrorBoundary } from './StudioErrorBoundary'
import { LayoutLibrary, type LayoutLibraryLayout } from './LayoutLibrary'

export default function App() {
  return <AppThemeProvider defaultTheme="codex-black" storageKey="portfolio-studio-theme"><AuthGate><StudioApp /></AuthGate></AppThemeProvider>
}

function StudioApp() {
  const auth = React.useContext(StudioAuthContext)
  const editor = useEditorState()
  const location = useLocation()
  const navigate = useNavigate()
  const editorRoute = parseStudioEditorRoute(location.pathname)
  const [layouts, setLayouts] = React.useState<LayoutLibraryLayout[]>([])
  const [loading, setLoading] = React.useState(true)
  const [hydrating, setHydrating] = React.useState(Boolean(editorRoute))
  const [error, setError] = React.useState('')
  const refreshLayouts = React.useCallback(async () => { try { const r=await apiFetch<any>('/api/studio/layouts');setLayouts(r.data||[]);return true } catch{setError('Studio could not refresh the Layout Library. Retry the action or reload Studio.');return false} finally{setLoading(false)} },[])
  React.useEffect(()=>{refreshLayouts()},[refreshLayouts])

  React.useEffect(() => {
    if (location.pathname === '/' || editorRoute) return
    setError('The requested Studio route does not exist. Returned to the Layout Library.')
    navigate('/', { replace: true })
  }, [editorRoute, location.pathname, navigate])

  React.useEffect(() => {
    if (!editorRoute) { setHydrating(false); return }
    let active = true
    setHydrating(true)
    setError('')
    const preferredPageId = selectedPageFromSearch(location.search) || undefined
    apiFetch<any>(`/api/studio/layouts/${editorRoute.layoutId}/versions/${editorRoute.versionId}/editor`)
      .then((response) => {
        if (!active) return
        const document = response.data as EditorDocument
        if (document.layoutId !== editorRoute.layoutId || document.versionId !== editorRoute.versionId) throw new Error('The persisted document does not match the requested editor route.')
        editor.loadDocument(document, preferredPageId)
      })
      .catch((caught: unknown) => {
        if (!active) return
        const message = caught instanceof Error ? caught.message : 'Layout version could not be loaded.'
        setError(`${message} Returned to the Layout Library.`)
        navigate('/', { replace: true })
      })
      .finally(() => { if (active) setHydrating(false) })
    return () => { active = false }
  }, [editorRoute?.layoutId, editorRoute?.versionId, editor.loadDocument, navigate])

  React.useEffect(() => {
    if (!editorRoute || hydrating || editor.state.layoutId !== editorRoute.layoutId || editor.state.versionId !== editorRoute.versionId || !editor.state.pageId) return
    if (selectedPageFromSearch(location.search) !== editor.state.pageId) navigate(studioEditorPath(editorRoute.layoutId, editorRoute.versionId, editor.state.pageId), { replace: true })
  }, [editor.state.layoutId, editor.state.pageId, editor.state.versionId, editorRoute, hydrating, location.search, navigate])

  const openDocument = React.useCallback((document: EditorDocument) => {
    if (!document.layoutId || !document.versionId) { setError('The saved document is missing its layout or version identity.'); return }
    navigate(studioEditorPath(document.layoutId, document.versionId))
  }, [navigate])
  const backToLayouts = React.useCallback(() => navigate(studioLayoutsPath()), [navigate])

  const createLayout = async (template:'blank'|'cosmic') => {
    setError('')
    const r=await apiFetch<any>('/api/studio/layouts',{method:'POST',body:JSON.stringify({template,name:template==='cosmic'?'Cosmic Portfolio':'Untitled Layout'})});openDocument(r.data as EditorDocument)
  }
  const openLayout=(id:string)=>{const layout=layouts.find(item=>item.id===id);const version=layout?.versions.find(item=>item.status==='draft')||layout?.versions[0];if(!version){setError('Layout has no versions to open.');return}setError('');navigate(studioEditorPath(id,version.id))}
  const duplicateLayout=async(id:string)=>{setError('');const r=await apiFetch<any>(`/api/studio/layouts/${id}/duplicate`,{method:'POST'});openDocument(r.data as EditorDocument)}
  const archiveLayout=async(id:string)=>{setError('');await apiFetch(`/api/studio/layouts/${id}/archive`,{method:'PATCH'});editor.loadDocument(createBlankDocument());navigate('/');await refreshLayouts()}

  if(loading||(editorRoute&&hydrating))return <div style={{height:'100vh',display:'grid',placeItems:'center',background:'var(--bg)',color:'var(--text)',fontFamily:'system-ui'}}>Loading Studio…</div>
  if(!editorRoute)return <><div style={{position:'fixed',top:16,right:20,zIndex:1000}}><button style={secondary} disabled={auth?.signingOut} aria-busy={auth?.signingOut} onClick={auth?.logout}>{auth?.signingOut?'Signing out...':'Logout'}</button></div><LayoutLibrary layouts={layouts} error={error} onCreate={createLayout} onOpen={openLayout} onDuplicate={duplicateLayout} onRefresh={refreshLayouts}/></>
  if(editor.state.layoutId!==editorRoute.layoutId||editor.state.versionId!==editorRoute.versionId)return <div style={{height:'100vh',display:'grid',placeItems:'center',background:'var(--bg)',color:'var(--text)',fontFamily:'system-ui'}}>Loading persisted document…</div>
  return <div style={{display:'flex',flexDirection:'column',height:'100vh',overflow:'hidden',background:'var(--bg)',fontFamily:'system-ui,sans-serif'}}><div style={{position:'fixed',top:8,right:12,zIndex:60000}}><button style={secondary} disabled={auth?.signingOut} aria-busy={auth?.signingOut} onClick={auth?.logout}>{auth?.signingOut?'Signing out...':'Logout'}</button></div><StudioErrorBoundary key={`${editorRoute.layoutId}:${editorRoute.versionId}`} onBackToLayouts={backToLayouts}><StudioEditor editor={editor} layouts={layouts} onBackToLayouts={backToLayouts} onOpenLayout={openLayout} onOpenDocument={openDocument} onCreateLayout={createLayout} onDuplicateLayout={duplicateLayout} onArchiveLayout={archiveLayout} onRefreshLayouts={refreshLayouts}/></StudioErrorBoundary></div>
}
const secondary:React.CSSProperties={padding:'9px 13px',border:'1px solid var(--border)',borderRadius:8,background:'var(--surface)',color:'var(--text)',cursor:'pointer'}
