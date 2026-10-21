import React from 'react'
import { PillButton } from './PillButton.jsx'
import { portalInto } from './portal.js'

/** The dialog's numbers, all CHOSEN. `width` 400 holds a two-line question at body size and three
 *  buttons on one row; `pad` 20 is the card's inner margin; `z` 80 sits above every pane, popover
 *  (`StopFinder` 60) and the start card, because a warning interrupts whatever is open. */
export const WARNING_DIALOG_METRICS = { width: 400, pad: 20, z: 80 }

/**
 * A WARNING THAT STOPS AN ACT UNTIL IT IS ANSWERED — generic (owner, 2026-10-01: "we might have
 * other warnings as well"). A title that states the problem, one line saying what the choices do,
 * then the choices. Modal: a scrim covers the app, Escape or a click on the scrim cancels, focus
 * starts on the `default` action so Enter takes it, and Tab stays inside.
 *
 * The buttons sit on one row, CANCEL FIRST AND ON ITS OWN at the left (it changes nothing), then
 * the acts in `actions` order at the right, the default last. Cancel is always present: a warning
 * with no way back is not a warning.
 *
 * `cancelDefault` (2026-10-15, for Knowledge Network Code's run warnings) puts focus, and so Enter,
 * on Cancel: for a warning whose ONLY act cannot be undone (cancel a run, discard it, merge), where
 * there is no safe act to make the default.
 *
 * ITS KEYS AND CLICKS ARE ITS OWN (2026-10-15): a warning opened from inside another overlay (the
 * card popup) is portaled to the body but still sits in that overlay's React tree, so its events
 * bubble there. Every key pressed in it, and every pointer press, click and double-click on it,
 * stops here, so an Escape, a Tab, a click or a drag never reaches the popup or board underneath.
 * The scrim cancels only on a press that BEGAN on the scrim: a text selection started in the panel
 * and let go over the dimmed margin is not a click on it.
 */
export function WarningDialog({ open = true, title, body, actions = [], onCancel, cancelLabel = 'Cancel', cancelDefault = false, inline = false, style }) {
  const M = WARNING_DIALOG_METRICS
  const panelRef = React.useRef(null)
  const lastFocus = React.useRef(null)
  const pressedOnScrim = React.useRef(false)
  const bodyId = (React.useId ? React.useId() : 'warning') + '-body'
  React.useEffect(() => {
    if (!open) return undefined
    lastFocus.current = typeof document !== 'undefined' ? document.activeElement : null
    const p = panelRef.current
    const first = p && ((cancelDefault && p.querySelector('[data-warning-cancel] button')) || p.querySelector('[data-warning-default] button') || p.querySelector('button'))
    if (first && !inline) first.focus()
    /* focus goes back where it came from, so a cancelled warning leaves the professor where they were */
    return () => { const f = lastFocus.current; if (!inline && f && f.focus && f.isConnected) f.focus({ preventScroll: true }) }
  }, [open])
  if (!open) return null
  const onKey = (e) => {
    if (!inline) e.stopPropagation()
    if (e.key === 'Escape') { e.preventDefault(); onCancel && onCancel(); return }
    if (e.key !== 'Tab') return
    const bs = Array.from(panelRef.current.querySelectorAll('button'))
    if (!bs.length) return
    const i = bs.indexOf(document.activeElement)
    if (e.shiftKey && i <= 0) { e.preventDefault(); bs[bs.length - 1].focus() }
    else if (!e.shiftKey && i === bs.length - 1) { e.preventDefault(); bs[0].focus() }
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
  const own = (e) => e.stopPropagation()
  const scrim = (
    <div onPointerDown={own} onDoubleClick={own} onContextMenu={own}
      onMouseDown={(e) => { e.stopPropagation(); pressedOnScrim.current = e.target === e.currentTarget }}
      onClick={(e) => { e.stopPropagation(); if (pressedOnScrim.current && e.target === e.currentTarget) onCancel && onCancel(); pressedOnScrim.current = false }}
      style={{ position: 'fixed', inset: 0, zIndex: M.z, background: 'var(--scrim)', display: 'grid', placeItems: 'center', padding: 16 }}>{panel}</div>
  )
  return typeof document !== 'undefined' ? portalInto(document.body, scrim) : scrim
}

/**
 * THE UNSAVED-CHANGES WARNING, as an element — the first warning built on `WarningDialog`
 * (owner, 2026-10-01). Three choices, owner's pick: save then switch, switch and lose the changes,
 * or stay. "Save and load" is the default, so Enter never loses work.
 * `what` names what has the changes ("Routing"); `next` names what is about to replace it
 * ("Forwarding"). Wordings are props, defaults the owner's placeholders.
 */
export function UnsavedWarning({ open = true, what, next, onSave, onDiscard, onCancel, verb = 'load', inline, style }) {
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
