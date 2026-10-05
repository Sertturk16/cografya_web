import type * as React from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LinkHref = React.ComponentProps<typeof Link>["href"];

/** Literal class strings per tone, so Tailwind sees every one of them. */
const TONE = {
  primary: {
    frame: "border-primary/30 from-primary/5",
    icon: "bg-primary/10 text-primary",
  },
  destructive: {
    frame: "border-destructive/30 from-destructive/5",
    icon: "bg-destructive/10 text-destructive-strong",
  },
} as const;

export interface LinkCalloutProps {
  readonly tone: keyof typeof TONE;
  readonly icon: LucideIcon;
  /** A label, not a heading: the callout sits between a page's sections, not in its outline. */
  readonly title: string;
  readonly href: LinkHref;
  /** The button's words; name the action ("Fay Hatlarına Bak"), not "Daha fazla". */
  readonly action: string;
  /** One or two sentences under the title. */
  readonly children: React.ReactNode;
}

/**
 * A one-line banner that sends the reader to a related page: icon, title, a sentence, and an
 * outline button. Used where a section points sideways to another part of the site (`/deniz`
 * to the fault lines and the world wind map, a sea basin to the fault lines). Works in server
 * and client components.
 */
export function LinkCallout({ tone, icon: Icon, title, href, action, children }: LinkCalloutProps) {
  const t = TONE[tone];
  return (
    // Lays out by its own width, not the viewport's: a callout in a narrow column (a specimen
    // panel, a sidebar) stacks even on a wide screen.
    <div className="@container">
      <div
        className={cn(
          "flex flex-col justify-between gap-4 rounded-3xl border bg-gradient-to-r via-card to-card p-5 @lg:flex-row @lg:items-center",
          t.frame,
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn("flex size-10 shrink-0 items-center justify-center rounded-2xl", t.icon)}
          >
            <Icon className="size-5" aria-hidden />
          </div>
          <div>
            <span className="block font-heading text-base font-bold text-foreground">{title}</span>
            <p className="text-xs text-muted-foreground">{children}</p>
          </div>
        </div>
        <Link
          href={href}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "group shrink-0 gap-1.5 text-xs font-bold",
          )}
        >
          <span>{action}</span>
          <ArrowRight
            className="size-3.5 transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </Link>
      </div>
    </div>
  );
}
