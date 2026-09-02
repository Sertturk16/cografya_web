"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

interface AccordionContextType {
  openValues: Set<string>;
  toggleItem: (value: string) => void;
}

const AccordionContext = React.createContext<AccordionContextType | null>(null);

function useAccordion() {
  const context = React.useContext(AccordionContext);
  if (!context) {
    throw new Error("Accordion components must be used within an Accordion provider");
  }
  return context;
}

export interface AccordionProps extends React.HTMLAttributes<HTMLDivElement> {
  type?: "single" | "multiple";
  defaultValue?: string | string[];
  collapsible?: boolean;
}

export function Accordion({
  type = "single",
  defaultValue,
  collapsible = true,
  className = "",
  children,
  ...props
}: AccordionProps) {
  const [openValues, setOpenValues] = React.useState<Set<string>>(() => {
    if (!defaultValue) return new Set();
    if (Array.isArray(defaultValue)) return new Set(defaultValue);
    return new Set([defaultValue]);
  });

  const toggleItem = React.useCallback(
    (value: string) => {
      setOpenValues((prev) => {
        const next = new Set(prev);
        if (next.has(value)) {
          if (type === "single" && !collapsible && next.size === 1) {
            return prev;
          }
          next.delete(value);
        } else {
          if (type === "single") {
            next.clear();
          }
          next.add(value);
        }
        return next;
      });
    },
    [type, collapsible]
  );

  return (
    <AccordionContext.Provider value={{ openValues, toggleItem }}>
      <div className={`space-y-3 ${className}`} {...props}>
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

interface AccordionItemContextType {
  value: string;
  isOpen: boolean;
}

const AccordionItemContext = React.createContext<AccordionItemContextType | null>(null);

export interface AccordionItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

export function AccordionItem({ value, className = "", children, ...props }: AccordionItemProps) {
  const { openValues } = useAccordion();
  const isOpen = openValues.has(value);

  return (
    <AccordionItemContext.Provider value={{ value, isOpen }}>
      <div
        data-state={isOpen ? "open" : "closed"}
        className={`rounded-2xl border border-border bg-card transition-all duration-200 overflow-hidden ${
          isOpen ? "shadow-md border-primary/40" : "hover:border-border/80"
        } ${className}`}
        {...props}
      >
        {children}
      </div>
    </AccordionItemContext.Provider>
  );
}

export interface AccordionTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export function AccordionTrigger({ className = "", children, ...props }: AccordionTriggerProps) {
  const { toggleItem } = useAccordion();
  const itemContext = React.useContext(AccordionItemContext);
  if (!itemContext) {
    throw new Error("AccordionTrigger must be used within an AccordionItem");
  }

  const { value, isOpen } = itemContext;

  return (
    <button
      type="button"
      aria-expanded={isOpen}
      onClick={() => toggleItem(value)}
      className={`w-full flex items-center justify-between p-4 sm:p-5 text-left font-heading font-bold text-foreground text-sm sm:text-base hover:text-primary transition-colors cursor-pointer select-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary ${className}`}
      {...props}
    >
      <span className="pr-4">{children}</span>
      <ChevronDown
        className={`size-4 text-muted-foreground shrink-0 transition-transform duration-200 ${
          isOpen ? "rotate-180 text-primary" : ""
        }`}
      />
    </button>
  );
}

export interface AccordionContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function AccordionContent({ className = "", children, ...props }: AccordionContentProps) {
  const itemContext = React.useContext(AccordionItemContext);
  if (!itemContext) {
    throw new Error("AccordionContent must be used within an AccordionItem");
  }

  const { isOpen } = itemContext;

  if (!isOpen) return null;

  return (
    <div
      className={`px-4 pb-4 sm:px-5 sm:pb-5 text-xs sm:text-sm text-muted-foreground leading-relaxed animate-in fade-in-50 duration-200 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
