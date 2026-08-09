import React from 'react'

export type ActionFeedbackTone = 'success' | 'error' | 'info'

export interface ActionFeedbackMessage {
  tone: ActionFeedbackTone
  title: string
  details?: string[]
}

export function feedbackAutoDismissDelay(message: ActionFeedbackMessage, autoDismissMs: number): number | null {
  return message.tone === 'success' ? autoDismissMs : null
}

type FeedbackTimer = ReturnType<typeof setTimeout>

export function scheduleFeedbackAutoDismiss(
  message: ActionFeedbackMessage,
  autoDismissMs: number,
  dismiss: () => void,
  schedule: (callback: () => void, delay: number) => FeedbackTimer = setTimeout,
): FeedbackTimer | null {
  const dismissDelay = feedbackAutoDismissDelay(message, autoDismissMs)
  return dismissDelay === null ? null : schedule(dismiss, dismissDelay)
}

export function useActionFeedback(autoDismissMs = 3000) {
  const [feedback, setFeedback] = React.useState<ActionFeedbackMessage | null>(null)
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const dismiss = React.useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    setFeedback(null)
  }, [])

  const show = React.useCallback((message: ActionFeedbackMessage) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    setFeedback(message)
    timerRef.current = scheduleFeedbackAutoDismiss(message, autoDismissMs, () => {
      timerRef.current = null
      setFeedback((current) => current === message ? null : current)
    })
  }, [autoDismissMs])

  React.useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
  }, [])
  return { feedback, show, dismiss }
}

export class MutationActionGate {
  private readonly active = new Set<string>()

  begin(key: string) {
    if (this.active.has(key)) return false
    this.active.add(key)
    return true
  }

  end(key: string) {
    this.active.delete(key)
  }

  isPending(key: string) {
    return this.active.has(key)
  }
}

export interface MutationActionOptions<T> {
  key: string
  conflictKey?: string
  pending: string
  success: string | ((value: T) => string)
  action: () => Promise<T>
  onSuccess?: (value: T) => void | Promise<void>
  error?: string | ((error: unknown) => string)
}

export interface MutationActionRuntime {
  gate: MutationActionGate
  isMounted: () => boolean
  setPending: (key: string, pending: boolean) => void
  show: (message: ActionFeedbackMessage) => void
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The action could not be completed.'
}

export async function runMutationAction<T>(
  options: MutationActionOptions<T>,
  runtime: MutationActionRuntime,
): Promise<T | undefined> {
  const gateKey = options.conflictKey || options.key
  if (!runtime.gate.begin(gateKey)) return undefined
  try {
    runtime.setPending(options.key, true)
    runtime.show({ tone: 'info', title: options.pending })
    const value = await options.action()
    if (options.onSuccess) await options.onSuccess(value)
    if (runtime.isMounted()) runtime.show({ tone: 'success', title: typeof options.success === 'function' ? options.success(value) : options.success })
    return value
  } catch (error) {
    if (runtime.isMounted()) runtime.show({ tone: 'error', title: typeof options.error === 'function' ? options.error(error) : options.error || errorMessage(error) })
    return undefined
  } finally {
    try {
      runtime.setPending(options.key, false)
    } finally {
      runtime.gate.end(gateKey)
    }
  }
}

export function useMutationActions(autoDismissMs = 3000) {
  const gateRef = React.useRef(new MutationActionGate())
  const mountedRef = React.useRef(false)
  const [pendingKeys, setPendingKeys] = React.useState<Set<string>>(() => new Set())
  const { feedback, show, dismiss } = useActionFeedback(autoDismissMs)

  React.useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const setPending = React.useCallback((key: string, pending: boolean) => {
    setPendingKeys((current) => {
      const next = new Set(current)
      if (pending) next.add(key)
      else next.delete(key)
      return next
    })
  }, [])

  const run = React.useCallback(async <T,>(options: MutationActionOptions<T>): Promise<T | undefined> => {
    return runMutationAction(options, {
      gate: gateRef.current,
      isMounted: () => mountedRef.current,
      setPending,
      show,
    })
  }, [setPending, show])

  const isPending = React.useCallback((key: string) => pendingKeys.has(key), [pendingKeys])
  const isConflictPending = React.useCallback((key: string) => gateRef.current.isPending(key), [])
  return { run, isPending, isConflictPending, feedback, dismiss }
}

export function ActionFeedback({ feedback, onDismiss }: { feedback: ActionFeedbackMessage | null; onDismiss: () => void }) {
  if (!feedback) return null
  const success = feedback.tone === 'success'
  const error = feedback.tone === 'error'
  const accent = success ? '#16a34a' : error ? 'var(--danger)' : 'var(--primary)'
  return <div role={error ? 'alert' : 'status'} aria-live={error ? 'assertive' : 'polite'} data-action-feedback={feedback.tone} style={{position:'fixed',top:64,right:18,zIndex:50000,width:'min(420px,calc(100vw - 36px))',padding:'13px 42px 13px 14px',border:`1px solid ${accent}`,borderRadius:9,background:'var(--surface)',color:'var(--text)',boxShadow:'0 16px 44px var(--shadow)',fontFamily:'system-ui,sans-serif'}}>
    <strong style={{display:'block',fontSize:13,color:accent}}>{success?'✓ ':error?'! ':''}{feedback.title}</strong>
    {feedback.details?.length?<ul style={{margin:'8px 0 0',paddingLeft:18,maxHeight:150,overflow:'auto',fontSize:12,color:'var(--text-muted)'}}>{feedback.details.slice(0,8).map((detail,index)=><li key={`${detail}-${index}`} style={{marginTop:3}}>{detail}</li>)}{feedback.details.length>8&&<li>+{feedback.details.length-8} more issues</li>}</ul>:null}
    <button type="button" aria-label="Dismiss notification" onClick={onDismiss} style={{position:'absolute',top:7,right:8,border:0,background:'transparent',color:'var(--text-muted)',fontSize:18,cursor:'pointer'}}>×</button>
  </div>
}
