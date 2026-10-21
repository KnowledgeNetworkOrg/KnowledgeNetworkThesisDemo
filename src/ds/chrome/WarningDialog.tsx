import { useEffect, useId, useRef } from 'react'
import type { CSSProperties, KeyboardEvent, MouseEvent, PointerEvent, ReactNode } from 'react'

import { PillButton } from './PillButton'
import { portalInto } from './portal'

/** width 400, pad 20, z 80 — all chosen, above every pane and popover. */
export const WARNING_DIALOG_METRICS = { width: 400, pad: 20, z: 80 }

export interface WarningAction {
  label: string
  /** `PillButton` tone. `'danger'` for an act that loses something; `'primary'` for the default */
  tone?: 'quiet' | 'primary' | 'walk' | 'danger' | 'ghost' | 'neutral'
  /** the act Enter takes — focus starts here */
  default?: boolean
  onSelect: () => void
}

export interface WarningDialogProps {
  /** default `true`; `false` renders nothing */
  open?: boolean
  /** states the problem: "Routing has unsaved changes" */
  title: ReactNode
  /** one line saying what the choices do */
  body?: ReactNode
  actions?: WarningAction[]
  /** Escape, the scrim, and the Cancel button. Omit and no Cancel is drawn — avoid it */
  onCancel?: () => void
  cancelLabel?: string
  /** focus and Enter start on Cancel, and no action is the default */
  cancelDefault?: boolean
  /** specimen only: draw in place, no scrim, no portal, no focus move */
  inline?: boolean
  style?: CSSProperties
}

/** A warning that stops an act until it is answered. A title stating the problem,
 *  one line saying what the choices do, then the choices. Modal by default: a scrim,
 *  Escape or a scrim click cancels, focus starts on the default action, Tab stays
 *  inside, and focus returns where it was. Its keys and pointer events stop here so
 *  it can sit inside another overlay. */
export function WarningDialog({ open = true, title, body, actions = [], onCancel, cancelLabel = 'Cancel', cancelDefault = false, inline = false, style }: WarningDialogProps) {
  const M = WARNING_DIALOG_METRICS
  const panelRef = useRef<HTMLDivElement | null>(null)
  const lastFocus = useRef<HTMLElement | null>(null)
  const pressedOnScrim = useRef(false)
  const uid = useId()
  const bodyId = uid + '-body'
  useEffect(() => {
    if (!open) return undefined
    lastFocus.current = typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null
    const p = panelRef.current
    const first = p && ((cancelDefault && p.querySelector<HTMLButtonElement>('[data-warning-cancel] button')) || p.querySelector<HTMLButtonElement>('[data-warning-default] button') || p.querySelector<HTMLButtonElement>('button'))
    if (first && !inline) first.focus()
    /* focus goes back where it came from, so a cancelled warning leaves the reader where they were */
    return () => {
      const f = lastFocus.current
      if (!inline && f && f.focus && f.isConnected) f.focus({ preventScroll: true })
    }
  }, [open, inline, cancelDefault])
  if (!open) return null
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!inline) e.stopPropagation()
    if (e.key === 'Escape') {
      e.preventDefault()
      if (onCancel) onCancel()
      return
    }
    if (e.key !== 'Tab') return
    const p = panelRef.current
    if (!p) return
    const bs = Array.from(p.querySelectorAll<HTMLButtonElement>('button'))
    if (!bs.length) return
    const i = bs.indexOf(document.activeElement as HTMLButtonElement)
    if (e.shiftKey && i <= 0) {
      e.preventDefault()
      bs[bs.length - 1].focus()
    } else if (!e.shiftKey && i === bs.length - 1) {
      e.preventDefault()
      bs[0].focus()
    }
  }
  const def = actions.findIndex((a) => a.default)
  const defAt = cancelDefault ? -1 : def >= 0 ? def : actions.length - 1
  const panel = (
    <div ref={panelRef} role="alertdialog" aria-modal={inline ? undefined : true} aria-label={typeof title === 'string' ? title : undefined} aria-describedby={body ? bodyId : undefined} onKeyDown={onKey}
      onClick={(e) => e.stopPropagation()}
      style={{ width: M.width, maxWidth: 'calc(100vw - 32px)', boxSizing: 'border-box', padding: M.pad, display: 'flex', flexDirection: 'column', gap: 8,
        background: 'var(--surface-paper)', border: '1px solid var(--border-frame)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--lift-3)', fontFamily: 'var(--font-ui)', ...style }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-title)', fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-display)', color: 'var(--text-1)', lineHeight: 'var(--lh-snug)', textWrap: 'pretty' }}>{title}</div>
      {body ? <div id={bodyId} style={{ fontSize: 'var(--fs-body)', color: 'var(--text-2)', lineHeight: 'var(--lh-normal)', textWrap: 'pretty' }}>{body}</div> : null}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        {onCancel ? <span data-warning-cancel="" style={{ display: 'contents' }}><PillButton size="md" tone="quiet" onClick={onCancel}>{cancelLabel}</PillButton></span> : null}
        <span style={{ flex: 1 }} />
        {actions.map((a, i) => (
          /* the default is marked on a wrapper: `PillButton` passes no extra attributes through */
          <span key={i} style={{ display: 'contents' }} {...(i === defAt ? { 'data-warning-default': '' } : {})}>
            <PillButton size="md" tone={a.tone || 'neutral'} onClick={a.onSelect}>{a.label}</PillButton>
          </span>
        ))}
      </div>
    </div>
  )
  if (inline) return panel
  const own = (e: MouseEvent<HTMLDivElement> | PointerEvent<HTMLDivElement>) => e.stopPropagation()
  const scrim = (
    <div onPointerDown={own} onDoubleClick={own} onContextMenu={own}
      onMouseDown={(e) => { e.stopPropagation(); pressedOnScrim.current = e.target === e.currentTarget }}
      onClick={(e) => { e.stopPropagation(); if (pressedOnScrim.current && e.target === e.currentTarget && onCancel) onCancel(); pressedOnScrim.current = false }}
      style={{ position: 'fixed', inset: 0, zIndex: M.z, background: 'var(--scrim)', display: 'grid', placeItems: 'center', padding: 16 }}>{panel}</div>
  )
  return typeof document !== 'undefined' ? portalInto(document.body, scrim) : scrim
}

export interface UnsavedWarningProps {
  open?: boolean
  what?: string
  next?: string
  verb?: string
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
  inline?: boolean
  style?: CSSProperties
}

/** The unsaved-changes warning, for every switch away from unsaved work: Cancel,
 *  "Load without saving" (danger), "Save and load" (primary, the default).
 *  `what` names what holds the changes, `next` what replaces it. */
export function UnsavedWarning({ open = true, what, next, onSave, onDiscard, onCancel, verb = 'load', inline, style }: UnsavedWarningProps) {
  const v = verb.charAt(0).toUpperCase() + verb.slice(1)
  return (
    <WarningDialog open={open} inline={inline} style={style} onCancel={onCancel}
      title={(what ? what : 'This walk') + ' has unsaved changes'}
      body={'Save them before you ' + verb + (next ? ' ' + next : '') + '? If you don’t, the changes are lost.'}
      actions={[
        { label: v + ' without saving', tone: 'danger', onSelect: onDiscard },
        { label: 'Save and ' + verb, tone: 'primary', default: true, onSelect: onSave },
      ]} />
  )
}
