"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Inbox } from "lucide-react";

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto rounded-lg border border-border bg-card shadow-2xs"
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm border-collapse", className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("bg-muted/60 border-b border-border", className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0 divide-y divide-border", className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t border-border bg-muted/60 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "transition-colors hover:bg-muted/40 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-11 px-4 text-left align-middle font-semibold text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap",
        className
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-4 py-3 align-middle text-foreground whitespace-nowrap [font-variant-numeric:tabular-nums]",
        className
      )}
      {...props}
    />
  );
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

function TableEmpty({
  colSpan,
  icon = <Inbox className="size-8 text-muted-foreground" />,
  title = "Kayıt Bulunamadı",
  description = "Arama veya filtre kriterlerinize uygun veri bulunmuyor.",
  action,
}: {
  colSpan: number;
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="p-8 text-center">
        <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
          {icon}
          <h4 className="font-heading font-semibold text-foreground mt-1">{title}</h4>
          <p className="text-xs text-muted-foreground">{description}</p>
          {action && <div className="mt-2">{action}</div>}
        </div>
      </td>
    </tr>
  );
}

function TableSkeleton({
  colSpan,
  rowCount = 4,
}: {
  colSpan: number;
  rowCount?: number;
}) {
  return (
    <>
      {Array.from({ length: rowCount }).map((_, i) => (
        <tr key={i} className="border-b border-border">
          <td colSpan={colSpan} className="px-4 py-3">
            <div className="flex items-center gap-4">
              <Skeleton className="h-5 w-16 rounded" />
              <Skeleton className="h-5 w-36 rounded" />
              <Skeleton className="h-5 flex-1 rounded" />
              <Skeleton className="h-5 w-20 rounded" />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  TableEmpty,
  TableSkeleton,
};
