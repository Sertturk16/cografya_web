import * as React from "react";
import { ThemePair } from "@/components/patterns/theme-pair";

interface SpecimenProps {
  readonly name: string;
  readonly description?: string;
  /** Pass through to ThemePair for components that render via a portal. */
  readonly portals?: boolean;
  readonly children: React.ReactNode;
}

/** One labelled entry in the showcase: a heading, a note, and the specimen in both themes. */
export function Specimen({ name, description, portals, children }: SpecimenProps) {
  const id = name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/(^-|-$)/g, "");

  return (
    <section className="scroll-mt-24 space-y-3" id={id}>
      <div className="space-y-1">
        <h3 className="font-heading text-lg font-bold text-foreground">{name}</h3>
        {description !== undefined ? (
          <p className="max-w-prose text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <ThemePair portals={portals}>{children}</ThemePair>
    </section>
  );
}

/** A row of specimens that belong together — variants of one component, say. */
export function SpecimenRow({ children }: { readonly children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}
