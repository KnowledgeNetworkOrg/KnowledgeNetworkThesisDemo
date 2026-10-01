// Shared geometry for the model layer: a point in world/canvas coordinates.
//
// This file once held an entire card-layout engine (visibility, edge lifting,
// shelf packing, drill-down, downstream choices, ego rings), none of which any
// app module reached (#333). The dead engine and its test are gone; the one
// live export is the `XY` type, which the map, walk and label models import
// from here by that name.

export interface XY {
  x: number
  y: number
}
