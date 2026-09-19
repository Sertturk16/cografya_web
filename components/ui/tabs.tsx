"use client";

import * as React from "react";
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cn } from "@/lib/utils";

/**
 * T-034: `Tabs` shipped with no `cva` and one hard-coded look. Two are needed — a pill group
 * reads as a control, an underline reads as navigation within a page — so the variant is
 * carried on context rather than repeated on every `TabsList` and `TabsTrigger`, which is
 * how the two halves drift apart.
 */
type TabsVariant = "pills" | "line";
const TabsVariantContext = React.createContext<TabsVariant>("pills");

const listVariants = {
  pills:
    "inline-flex h-11 items-center justify-center gap-1 rounded-xl border border-border bg-muted p-1 text-muted-foreground select-none",
  line: "inline-flex h-11 items-center justify-start gap-4 border-b border-border text-muted-foreground select-none",
} as const;

const triggerVariants = {
  pills:
    "rounded-lg px-3.5 py-1.5 aria-selected:bg-card aria-selected:text-primary aria-selected:font-bold aria-selected:shadow-xs",
  /* The underline is an inset box-shadow rather than a border, so the tab does not shift by a
     pixel when it becomes selected. */
  /* `-strong`, because this variant has no card under it: the selected label sits directly on
     `--muted`, where the base member measures 4.26:1 light and 4.29:1 dark. The `pills`
     variant sets `aria-selected:bg-card` first and so clears the floor on the base member. */
  line: "px-1 py-2.5 aria-selected:text-primary-strong aria-selected:font-bold aria-selected:shadow-[inset_0_-2px_0_0_currentColor]",
} as const;

function Tabs({
  variant = "pills",
  ...props
}: TabsPrimitive.Root.Props & { variant?: TabsVariant }) {
  return (
    <TabsVariantContext.Provider value={variant}>
      <TabsPrimitive.Root data-slot="tabs" data-variant={variant} {...props} />
    </TabsVariantContext.Provider>
  );
}

function TabsList({ className, activateOnFocus = true, ...props }: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      // Automatic activation, not Base UI's `false` default: every consumer here (T-031d Task
      // 15) is a cheap view switch — a login/register form pair or a re-rendered catalogue —
      // where moving focus without moving the selection just means Left/Right does nothing
      // visible until a separate Enter/Space, which is exactly what a keyboard user hit before
      // this prop was added. A future consumer whose panel is expensive to render can still opt
      // back into manual activation with `activateOnFocus={false}`.
      activateOnFocus={activateOnFocus}
      className={cn(listVariants[React.useContext(TabsVariantContext)], className)}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all duration-150 outline-none cursor-pointer hover:text-foreground disabled:pointer-events-none disabled:opacity-50",
        triggerVariants[React.useContext(TabsVariantContext)],
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn(
        "mt-3 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20 rounded-xl",
        className,
      )}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
