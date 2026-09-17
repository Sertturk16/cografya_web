import * as React from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

/**
 * Written here rather than generated.
 *
 * `shadcn add pagination` pulls in its own `button.tsx` and asked to overwrite ours, which
 * carries Terra's variants and the T-034 token rebinding. Composing `buttonVariants` instead
 * means the links look like every other button on the site and follow the palette for free.
 *
 * Real `<a>` elements, not buttons: a page link is a location, so middle-click,
 * open-in-new-tab and copy-link all have to work. The caller supplies the `href`.
 */

function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      // Named, because a page can carry more than one navigation landmark and "navigation"
      // alone tells a screen-reader user nothing about which this is.
      aria-label="Sayfalama"
      className={cn("mx-auto flex w-full justify-center", className)}
      {...props}
    />
  );
}

function PaginationContent({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    // `role="list"` is explicit: Safari and VoiceOver drop list semantics from a list whose
    // markers are removed, taking the "list, 7 items" announcement with them. The same note
    // is written against `.province-grid` in app/globals.css.
    <ul role="list" className={cn("flex flex-row items-center gap-1", className)} {...props} />
  );
}

function PaginationItem({ ...props }: React.ComponentProps<"li">) {
  return <li {...props} />;
}

interface PaginationLinkProps extends React.ComponentProps<"a"> {
  readonly isActive?: boolean;
  readonly size?: "sm" | "icon" | "default";
}

function PaginationLink({
  className,
  isActive = false,
  size = "icon",
  ...props
}: PaginationLinkProps) {
  return (
    <a
      // `aria-current="page"` is what tells assistive technology which page you are on.
      // Styling alone would leave that information in the colour only.
      aria-current={isActive ? "page" : undefined}
      className={cn(
        buttonVariants({ variant: isActive ? "primary" : "ghost", size }),
        "no-underline",
        className,
      )}
      {...props}
    />
  );
}

function PaginationPrevious({ className, ...props }: React.ComponentProps<"a">) {
  return (
    <PaginationLink
      size="default"
      className={cn("gap-1 px-2.5", className)}
      aria-label="Önceki sayfa"
      {...props}
    >
      <ChevronLeft className="size-4" aria-hidden="true" />
      <span className="hidden sm:inline">Önceki</span>
    </PaginationLink>
  );
}

function PaginationNext({ className, ...props }: React.ComponentProps<"a">) {
  return (
    <PaginationLink
      size="default"
      className={cn("gap-1 px-2.5", className)}
      aria-label="Sonraki sayfa"
      {...props}
    >
      <span className="hidden sm:inline">Sonraki</span>
      <ChevronRight className="size-4" aria-hidden="true" />
    </PaginationLink>
  );
}

function PaginationEllipsis({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      className={cn("flex size-9 items-center justify-center text-muted-foreground", className)}
      {...props}
    >
      <MoreHorizontal className="size-4" />
      <span className="sr-only">Atlanan sayfalar</span>
    </span>
  );
}

export {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
};
