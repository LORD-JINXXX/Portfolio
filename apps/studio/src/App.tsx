import React from 'react'
import { createBlankDocument, useEditorState } from '@platform/builder-core'
import { AppThemeProvider } from '@platform/ui'
import type { EditorDocument } from '@platform/contracts'
import { useLocation, useNavigate } from 'react-router-dom'
import { AuthGate } from './AuthGate'
import { apiFetch } from './api'
import { parseStudioEditorRoute, selectedPageFromSearch, studioEditorPath, studioLayoutsPath } from './routing'
import { StudioEditor } from './StudioEditor'

export default function App() {
  return <AppThemeProvider defaultTheme="codex-black" storageKey="portfolio-studio-theme"><AuthGate><StudioApp /></AuthGate></AppThemeProvider>
}

function StudioApp() {
  const editor = useEditorState()
  const location = useLocation()
  const navigate = useNavigate()
  const editorRoute = parseStudioEditorRoute(location.pathname)
  const [layouts, setLayouts] = React.useState<Array<{id:string;name:string;versions:Array<{id:string;status:string}>}>>([])
  const [loading, setLoading] = React.useState(true)
  const [hydrating, setHydrating] = React.useState(Boolean(editorRoute))
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')
  const refreshLayouts = React.useCallback(async () => { try { const r=await apiFetch<any>('/api/studio/layouts');setLayouts(r.data||[]) } catch(e:any){setError(e.message)} finally{setLoading(false)} },[])
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
    setBusy(true);setError('')
    try { const r=await apiFetch<any>('/api/studio/layouts',{method:'POST',body:JSON.stringify({template,name:template==='cosmic'?'Cosmic Portfolio':'Untitled Layout'})});openDocument(r.data as EditorDocument);await refreshLayouts() }
    catch(e:any){setError(e.message)} finally{setBusy(false)}
  }
  const openLayout=(id:string)=>{const layout=layouts.find(item=>item.id===id);const version=layout?.versions.find(item=>item.status==='draft')||layout?.versions[0];if(!version){setError('Layout has no versions to open.');return}setError('');navigate(studioEditorPath(id,version.id))}
  const duplicateLayout=async(id:string)=>{setBusy(true);setError('');try{const r=await apiFetch<any>(`/api/studio/layouts/${id}/duplicate`,{method:'POST'});openDocument(r.data as EditorDocument);await refreshLayouts()}catch(e:any){setError(e.message)}finally{setBusy(false)}}
  const archiveLayout=async(id:string)=>{if(!confirm('Archive this layout? Published releases remain immutable and available for rollback.'))return;setBusy(true);setError('');try{await apiFetch(`/api/studio/layouts/${id}/archive`,{method:'PATCH'});editor.loadDocument(createBlankDocument());navigate('/');await refreshLayouts()}catch(e:any){setError(e.message)}finally{setBusy(false)}}

  if(loading||(editorRoute&&hydrating))return <div style={{height:'100vh',display:'grid',placeItems:'center',background:'var(--bg)',color:'var(--text)',fontFamily:'system-ui'}}>Loading Studio…</div>
  if(!editorRoute)return <div style={{minHeight:'100vh',background:'var(--bg)',color:'var(--text)',fontFamily:'system-ui',padding:40}}><div style={{maxWidth:1100,margin:'0 auto'}}><h1 style={{fontSize:40,marginBottom:8}}>UI/UX Studio</h1><p style={{color:'var(--text-muted)',marginTop:0}}>Design complete website layouts with sample content. Published versions become available in Admin.</p>{error&&<p style={{color:'var(--danger)'}}>{error}</p>}<div style={{display:'flex',gap:12,margin:'28px 0'}}><button disabled={busy} onClick={()=>createLayout('cosmic')} style={primary}>+ Cosmic Portfolio starter</button><button disabled={busy} onClick={()=>createLayout('blank')} style={secondary}>+ Blank layout</button></div><h2>Layouts</h2><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:14}}>{layouts.map(l=><button key={l.id} onClick={()=>openLayout(l.id)} style={{...secondary,textAlign:'left',padding:18}}><strong style={{display:'block',fontSize:17,color:'var(--text)'}}>{l.name}</strong><span style={{display:'block',color:'var(--text-muted)',marginTop:6}}>{l.versions?.length||0} versions · {l.versions?.[0]?.status||'new'}</span></button>)}</div></div></div>
  if(editor.state.layoutId!==editorRoute.layoutId||editor.state.versionId!==editorRoute.versionId)return <div style={{height:'100vh',display:'grid',placeItems:'center',background:'var(--bg)',color:'var(--text)',fontFamily:'system-ui'}}>Loading persisted document…</div>
  return <div style={{display:'flex',flexDirection:'column',height:'100vh',overflow:'hidden',background:'var(--bg)',fontFamily:'system-ui,sans-serif'}}><StudioEditor editor={editor} layouts={layouts} onBackToLayouts={backToLayouts} onOpenLayout={openLayout} onOpenDocument={openDocument} onCreateLayout={createLayout} onDuplicateLayout={duplicateLayout} onArchiveLayout={archiveLayout} onRefreshLayouts={refreshLayouts}/>{busy&&<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.25)',zIndex:50000,pointerEvents:'none'}}/>}</div>
}
const primary:React.CSSProperties={padding:'11px 16px',border:0,borderRadius:8,background:'var(--primary)',color:'var(--primary-text)',fontWeight:700,cursor:'pointer'}
const secondary:React.CSSProperties={padding:'11px 16px',border:'1px solid var(--border)',borderRadius:8,background:'var(--surface)',color:'var(--text)',cursor:'pointer'}
