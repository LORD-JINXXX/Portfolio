import React from 'react'

export type StudioFeedbackTone = 'success' | 'error' | 'info'

export interface StudioFeedbackMessage {
  tone: StudioFeedbackTone
  title: string
  details?: string[]
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

export function validationIssueMessages(value: unknown): string[] {
  const root = asRecord(value)
  const data = asRecord(root?.data)
  const validation = asRecord(root?.validation) || asRecord(data?.validation)
  const candidates = Array.isArray(validation?.issues) ? validation.issues : Array.isArray(validation?.errors) ? validation.errors : []
  return [...new Set(candidates.map((entry) => asRecord(entry)?.message).filter((message): message is string => typeof message === 'string' && Boolean(message.trim())))]
}

export function useStudioFeedback(autoDismissMs = 4500) {
  const [feedback, setFeedback] = React.useState<StudioFeedbackMessage | null>(null)
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const dismiss = React.useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    setFeedback(null)
  }, [])

  const show = React.useCallback((message: StudioFeedbackMessage) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    setFeedback(message)
    if (message.tone === 'success') timerRef.current = setTimeout(() => setFeedback((current) => current === message ? null : current), autoDismissMs)
  }, [autoDismissMs])

  React.useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])
  return { feedback, show, dismiss }
}

export function ActionFeedback({ feedback, onDismiss }: { feedback: StudioFeedbackMessage | null; onDismiss: () => void }) {
  if (!feedback) return null
  const success = feedback.tone === 'success'
  const error = feedback.tone === 'error'
  const accent = success ? '#16a34a' : error ? 'var(--danger)' : 'var(--primary)'
  return <div role={error ? 'alert' : 'status'} aria-live={error ? 'assertive' : 'polite'} data-studio-action-feedback={feedback.tone} style={{position:'fixed',top:64,right:18,zIndex:50000,width:'min(420px,calc(100vw - 36px))',padding:'13px 42px 13px 14px',border:`1px solid ${accent}`,borderRadius:9,background:'var(--surface)',color:'var(--text)',boxShadow:'0 16px 44px var(--shadow)',fontFamily:'system-ui,sans-serif'}}>
    <strong style={{display:'block',fontSize:13,color:accent}}>{success?'✓ ':error?'! ':''}{feedback.title}</strong>
    {feedback.details?.length?<ul style={{margin:'8px 0 0',paddingLeft:18,maxHeight:150,overflow:'auto',fontSize:12,color:'var(--text-muted)'}}>{feedback.details.slice(0,8).map((detail,index)=><li key={`${detail}-${index}`} style={{marginTop:3}}>{detail}</li>)}{feedback.details.length>8&&<li>+{feedback.details.length-8} more issues</li>}</ul>:null}
    <button type="button" aria-label="Dismiss notification" onClick={onDismiss} style={{position:'absolute',top:7,right:8,border:0,background:'transparent',color:'var(--text-muted)',fontSize:18,cursor:'pointer'}}>×</button>
  </div>
}
