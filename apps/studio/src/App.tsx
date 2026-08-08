import React from 'react'
import { createBlankDocument, useEditorState } from '@platform/builder-core'
import { AppThemeProvider } from '@platform/ui'
import type { EditorDocument } from '@platform/contracts'
import { AuthGate } from './AuthGate'
import { apiFetch } from './api'
import { StudioEditor } from './StudioEditor'

export default function App() {
  return <AppThemeProvider defaultTheme="codex-black" storageKey="portfolio-studio-theme"><AuthGate><StudioApp /></AuthGate></AppThemeProvider>
}

function StudioApp() {
  const editor = useEditorState()
  const [layouts, setLayouts] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')
  const refreshLayouts = React.useCallback(async () => { try { const r=await apiFetch<any>('/api/studio/layouts');setLayouts(r.data||[]) } catch(e:any){setError(e.message)} finally{setLoading(false)} },[])
  React.useEffect(()=>{refreshLayouts()},[refreshLayouts])

  const createLayout = async (template:'blank'|'cosmic') => {
    setBusy(true);setError('')
    try { const r=await apiFetch<any>('/api/studio/layouts',{method:'POST',body:JSON.stringify({template,name:template==='cosmic'?'Cosmic Portfolio':'Untitled Layout'})});editor.loadDocument(r.data as EditorDocument);await refreshLayouts() }
    catch(e:any){setError(e.message)} finally{setBusy(false)}
  }
  const openLayout=async(id:string)=>{setBusy(true);setError('');try{const r=await apiFetch<any>(`/api/studio/layouts/${id}/editor`);editor.loadDocument(r.data);await refreshLayouts()}catch(e:any){setError(e.message)}finally{setBusy(false)}}
  const duplicateLayout=async(id:string)=>{setBusy(true);setError('');try{const r=await apiFetch<any>(`/api/studio/layouts/${id}/duplicate`,{method:'POST'});editor.loadDocument(r.data);await refreshLayouts()}catch(e:any){setError(e.message)}finally{setBusy(false)}}
  const archiveLayout=async(id:string)=>{if(!confirm('Archive this layout? Published releases remain immutable and available for rollback.'))return;setBusy(true);setError('');try{await apiFetch(`/api/studio/layouts/${id}/archive`,{method:'PATCH'});editor.loadDocument(createBlankDocument());await refreshLayouts()}catch(e:any){setError(e.message)}finally{setBusy(false)}}

  if(loading)return <div style={{height:'100vh',display:'grid',placeItems:'center',background:'var(--bg)',color:'var(--text)',fontFamily:'system-ui'}}>Loading Studio…</div>
  if(!editor.state.layoutId)return <div style={{minHeight:'100vh',background:'var(--bg)',color:'var(--text)',fontFamily:'system-ui',padding:40}}><div style={{maxWidth:1100,margin:'0 auto'}}><h1 style={{fontSize:40,marginBottom:8}}>UI/UX Studio</h1><p style={{color:'var(--text-muted)',marginTop:0}}>Design complete website layouts with sample content. Published versions become available in Admin.</p>{error&&<p style={{color:'var(--danger)'}}>{error}</p>}<div style={{display:'flex',gap:12,margin:'28px 0'}}><button disabled={busy} onClick={()=>createLayout('cosmic')} style={primary}>+ Cosmic Portfolio starter</button><button disabled={busy} onClick={()=>createLayout('blank')} style={secondary}>+ Blank layout</button></div><h2>Layouts</h2><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:14}}>{layouts.map(l=><button key={l.id} onClick={()=>openLayout(l.id)} style={{...secondary,textAlign:'left',padding:18}}><strong style={{display:'block',fontSize:17,color:'var(--text)'}}>{l.name}</strong><span style={{display:'block',color:'var(--text-muted)',marginTop:6}}>{l.versions?.length||0} versions · {l.versions?.[0]?.status||'new'}</span></button>)}</div></div></div>
  return <div style={{display:'flex',flexDirection:'column',height:'100vh',overflow:'hidden',background:'var(--bg)',fontFamily:'system-ui,sans-serif'}}><StudioEditor editor={editor} layouts={layouts} onOpenLayout={openLayout} onCreateLayout={createLayout} onDuplicateLayout={duplicateLayout} onArchiveLayout={archiveLayout} onRefreshLayouts={refreshLayouts}/>{busy&&<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.25)',zIndex:50000,pointerEvents:'none'}}/>}</div>
}
const primary:React.CSSProperties={padding:'11px 16px',border:0,borderRadius:8,background:'var(--primary)',color:'var(--primary-text)',fontWeight:700,cursor:'pointer'}
const secondary:React.CSSProperties={padding:'11px 16px',border:'1px solid var(--border)',borderRadius:8,background:'var(--surface)',color:'var(--text)',cursor:'pointer'}
