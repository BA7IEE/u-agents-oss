import * as CollapsiblePrimitive from "@radix-ui/react-collapsible"

// Radix primitives
const Collapsible = CollapsiblePrimitive.Root
const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger
const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent

// Expand-in-place content (fade + 4px drop, no height animation) — shared with @u-agents/ui
export { AnimatedCollapsibleContent } from "@u-agents/ui"

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
