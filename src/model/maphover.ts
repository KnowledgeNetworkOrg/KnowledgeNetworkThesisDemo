// WHICH HOVER THE MAP DRAWS, AND HOW — the map has two hover sources, and they
// do not get the same treatment.
//
// One is the pointer physically over this pane. The other arrives on the bus: a
// row the user is pointing at in the tree, or in the connections pane, republished
// here as "the thing your cursor is on over there lives HERE". Both light a
// territory. Only the first one gets a card.
//
// OB-127 (#251) is the ruling that made that asymmetry a rule rather than an
// accident. We had asked the Design System whether `MapTooltip` anchors to the
// cursor or to the hovered element, and offered both. The answer was neither: the
// card is FOR a cursor hover, so the question dissolves. On a published hover the
// pointer is over the OTHER pane, which is already drawing its own treatment for a
// name the user is reading there; what they want from the map is where the thing
// is, and the lit territory answers that completely. A card would repeat a name
// they are already looking at, on a surface they are not looking at.
//
// It lives in its own file, out of the component, for the reason `walkpins.ts`
// does: this is a rule that keeps being re-decided. Three obligations have moved
// it already — OB-095 deleted the fixed top-left hover chip, OB-096 replaced it
// with the cursor-anchored card, OB-127 now takes that card away from half its
// inputs — and a fourth is queued: OB-131 (#246) mounts `WalkDock` on this same
// pane and adds a precedence rule between this card and the walk's preview. A rule
// that is a named function can be asserted; the same condition inline in a
// 1300-line render can only be argued from a screenshot.

/** What the map puts in a card, when it puts up a card at all. */
export type HoverCard =
  | { kind: 'relation' }
  | { kind: 'node'; id: string }

export type HoverMarks = {
  /** The cell drawn with the solid spotlight: lit, and never carrying a card. */
  spotlightId: string | null
  /** What `MapTooltip` reports, or null for no card at all. */
  card: HoverCard | null
}

export type HoverSources = {
  /** The cell this pane's own pointer is over. The only input that earns a card. */
  cursorCell: string | null
  /** The selected cell. It has its own treatment, so it is never also spotlit. */
  selectedCell: string | null
  /** The cell another pane's pointer is on, republished onto the bus. */
  publishedCell: string | null
  /** The last cell clicked in another pane, which stays lit after that pointer leaves. */
  lookedAtCell: string | null
  /** THE CELL THE WALK IS STANDING ON while a walk is on the map, and null otherwise
   *  (DS OB-173). Playing a walk writes the focus, and a focus draws the SELECTION
   *  treatment — an outline plus every relation the stop has, laid across the map. The
   *  owner, watching the dock play: "is it possible instead of focusing on the walk's node
   *  to make it like a highlight instead of focuses (like same effect as when mouse hovers
   *  over that node)?" So the walk's stop comes in HERE, as a third light, and the map
   *  draws no selection for it. The walk laid across the map is the thing being watched;
   *  playback may not be what removes it. */
  walkStopCell: string | null
  /** The pointer is on one of the selection's relation lines rather than on territory. */
  onRelation: boolean
  /** THE POINTER IS ON A WALK PIN, whose own preview card is up (DS OB-184 clause 4). ONE CARD
   *  PER POINTER: while the pin's `WalkPreview` is up, the cell's `MapTooltip` stays down. The
   *  code did this by accident before — entering a pin leaves the cell under it, so the cell's
   *  card went as the pin's came — and it is now the stated precedence rule rather than a
   *  consequence. The spotlight is untouched: a pin hover is the weakest channel on the pane,
   *  transient, undone on leave, and never what the app reads as the current node. */
  walkPinHovered?: boolean
}

/**
 * Resolve the map's hover state into the two things it draws: a spotlit cell and
 * a card. They take different inputs on purpose — see the note at the top.
 */
export function hoverMarks(from: HoverSources): HoverMarks {
  const { cursorCell, selectedCell, publishedCell, lookedAtCell, walkStopCell, onRelation, walkPinHovered } = from

  // A published hover that is only our own cell echoing back is dropped: that cell
  // already carries the dashed preselect, and two outlines on one cell read as a
  // bug. The look is the fallback, and it stands aside for the selection for the
  // same reason.
  //
  // THE WALK'S STOP SITS BELOW BOTH POINTERS AND ABOVE THE LOOK. Below the pointers because
  // a hover is a live gesture and the walk is ambient — a person pointing at something is
  // asking about THAT, and a walk that overrode them would make the map argue with the hand
  // on it. Above the look because the look is the older of the two: it is where a click in
  // another pane left the light, and a walk stepping through the map now is the more recent
  // answer to "where are we".
  const spotlightId =
    publishedCell && publishedCell !== cursorCell
      ? publishedCell
      : walkStopCell && walkStopCell !== cursorCell
        ? walkStopCell
        : lookedAtCell && lookedAtCell !== selectedCell
          ? lookedAtCell
          : null

  // THE RULE. `publishedCell` and `lookedAtCell` are deliberately absent from this
  // expression: they light the map, and they stop there. A relation hover wins over
  // territory beneath it, since the two can only coexist when the pointer sits
  // exactly on the boundary between a relation's stroke and the cell under it.
  // A WALK PIN'S PREVIEW WINS THE POINTER (OB-184): one card per pointer, and the pin's is
  // the one the pointer is on. The cell's card comes back the moment the pointer leaves the pin.
  const card: HoverCard | null = walkPinHovered
    ? null
    : onRelation
      ? { kind: 'relation' }
      : cursorCell
        ? { kind: 'node', id: cursorCell }
        : null

  return { spotlightId, card }
}
