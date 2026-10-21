/** RENDER INTO ANOTHER NODE, if the runtime can. The DS runtime carries `ReactDOM` as a global; a
 *  port replaces the body with a real `import { createPortal } from 'react-dom'`. With no portal
 *  available the element renders in place, which is the honest fallback for a menu that would
 *  otherwise not render at all. Shared by `VersionedGroup` (its menu and refusal panel) and
 *  `NodePicker` (its option list) since 2026-09-02; each had its own copy before. */
export function portalInto(node, element) {
  const RD = (typeof ReactDOM !== 'undefined' && ReactDOM) || (typeof window !== 'undefined' && window.ReactDOM) || null
  return RD && RD.createPortal ? RD.createPortal(element, node) : element
}
