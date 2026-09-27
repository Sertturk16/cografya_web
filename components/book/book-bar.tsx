import Image from "next/image";
import { ExternalLink, Info, ShoppingBag } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The book bar (T-128 spec §4.1): the old one-screen hero reduced to one row — small cover,
 * title as the page `h1`, a summary line, "Kitap Bilgisi" and the purchase link. It holds no
 * hooks; the bench island renders it so the watched count can be live, and on a phone it is
 * shown on the pick step only.
 */

/** The page `h1`, in the workbench-bar spelling named in `page-composition-headings.test.ts`. */
export const BOOK_BAR_H1 =
  "m-0 font-heading text-lg font-bold leading-tight text-foreground lg:text-xl";

export interface BookBarProps {
  title: string;
  coverImagePath: string | null;
  coverAlt: string;
  examTrack: string;
  summary: string;
  watchedText: string | null;
  infoLabel: string;
  purchaseUrl: string | null;
  purchaseLabel: string;
  purchaseAria: string;
}

export function BookBar(props: BookBarProps) {
  return (
    <div className="flex items-center gap-3">
      {props.coverImagePath !== null && (
        <Image
          src={props.coverImagePath}
          alt={props.coverAlt}
          width={40}
          height={53}
          sizes="40px"
          className="h-[53px] w-10 shrink-0 rounded-md border border-border object-cover"
          priority
        />
      )}
      <div className="min-w-0 flex-1">
        <h1 className={BOOK_BAR_H1}>{props.title}</h1>
        <p className="m-0 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
          <span className="font-semibold text-primary-strong">{props.examTrack}</span>
          <span>{props.summary}</span>
          {props.watchedText !== null && <span className="tabular-nums">{props.watchedText}</span>}
        </p>
      </div>
      <a
        href="#kitap-bilgisi"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "hidden min-h-11 sm:inline-flex",
        )}
      >
        <Info className="size-4" aria-hidden="true" />
        {props.infoLabel}
      </a>
      {props.purchaseUrl !== null && (
        <a
          href={props.purchaseUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={props.purchaseAria}
          className={cn(buttonVariants({ variant: "primary", size: "sm" }), "min-h-11 min-w-11")}
        >
          <ShoppingBag className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">{props.purchaseLabel}</span>
          <ExternalLink className="hidden size-3.5 opacity-70 sm:inline" aria-hidden="true" />
        </a>
      )}
    </div>
  );
}
