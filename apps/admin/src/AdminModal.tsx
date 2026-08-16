import React from 'react'
import { createPortal } from 'react-dom'

const modalStack: string[] = []
let bodyScrollLockCount = 0
let originalBodyOverflow = ''

function pushModal(id: string) {
  modalStack.push(id)
  if (typeof document !== 'undefined') {
    if (bodyScrollLockCount === 0) originalBodyOverflow = document.body.style.overflow
    bodyScrollLockCount += 1
    document.body.style.overflow = 'hidden'
  }
}

function removeModal(id: string) {
  const index = modalStack.lastIndexOf(id)
  if (index >= 0) modalStack.splice(index, 1)
  if (typeof document !== 'undefined' && bodyScrollLockCount > 0) {
    bodyScrollLockCount -= 1
    if (bodyScrollLockCount === 0) document.body.style.overflow = originalBodyOverflow
  }
}

function isTopModal(id: string) {
  return modalStack[modalStack.length - 1] === id
}

export function AdminModal({
  title,
  onClose,
  children,
  wide = false,
  width,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
  width?: string
}) {
  const reactId = React.useId()
  const modalId = `admin-modal-${reactId}`
  const titleId = `${modalId}-title`
  const panelRef = React.useRef<HTMLDivElement>(null)
  const onCloseRef = React.useRef(onClose)
  React.useEffect(() => { onCloseRef.current = onClose }, [onClose])

  React.useEffect(() => {
    if (typeof document === 'undefined') return
    const previousActive = document.activeElement instanceof HTMLElement ? document.activeElement : null
    pushModal(modalId)
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isTopModal(modalId)) return
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const panel = panelRef.current
      if (!panel) return
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')).filter((element) => !element.hasAttribute('hidden') && element.getClientRects().length > 0)
      if (!focusable.length) { event.preventDefault(); panel.focus(); return }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKeyDown)
    const frame = requestAnimationFrame(() => {
      if (!isTopModal(modalId)) return
      const panel = panelRef.current
      const focusTarget = panel?.querySelector<HTMLElement>('input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])')
      ;(focusTarget || panel)?.focus({ preventScroll: true })
    })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('keydown', onKeyDown)
      removeModal(modalId)
      if (previousActive?.isConnected) previousActive.focus({ preventScroll: true })
    }
  }, [modalId])

  const modal = (
    <div
      data-admin-modal-backdrop="true"
      data-admin-modal-id={modalId}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && isTopModal(modalId)) onCloseRef.current()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60000,
        display: 'grid',
        placeItems: 'center',
        padding: 'clamp(12px,3vw,28px)',
        overflow: 'hidden',
        background: 'rgba(0,0,0,.55)',
        backdropFilter: 'blur(12px) saturate(.78)',
        WebkitBackdropFilter: 'blur(12px) saturate(.78)',
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
        style={{
          width: width || (wide ? 'min(1500px,96vw)' : 'min(760px,94vw)'),
          maxWidth: '100%',
          maxHeight: 'min(92dvh,960px)',
          overflow: 'auto',
          overscrollBehavior: 'contain',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          color: 'var(--text)',
          boxShadow: '0 30px 90px rgba(0,0,0,.55)',
          outline: 'none',
        }}
      >
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 3,
            padding: '13px 16px',
            borderBottom: '1px solid var(--border)',
            background: 'color-mix(in srgb,var(--surface) 94%,transparent)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <strong id={titleId}>{title}</strong>
          <button
            type="button"
            aria-label="Close dialog"
            onClick={() => { if (isTopModal(modalId)) onCloseRef.current() }}
            style={{
              border: '1px solid var(--border)',
              background: 'var(--surface-alt)',
              color: 'var(--text)',
              borderRadius: 7,
              minWidth: 34,
              height: 34,
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: 'clamp(14px,2.2vw,22px)' }}>{children}</div>
      </div>
    </div>
  )

  return typeof document === 'undefined' ? modal : createPortal(modal, document.body)
}
