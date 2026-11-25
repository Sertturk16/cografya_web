import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The brand mark or wordmark from `public/brand/`, as a light/dark pair: the `.dark` class picks
 * which one shows. Only the visible one loads, because the hidden `<img>` is `display: none` and
 * lazy. The mark is decorative wherever the name sits beside it, so its `alt` defaults to "";
 * a wordmark that IS the name passes the name as `alt`.
 */
const SOURCES = {
  mark: { light: "/brand/mark.svg", dark: "/brand/mark-dark.svg" },
  wordmark: { light: "/brand/wordmark.svg", dark: "/brand/wordmark-dark.svg" },
} as const;

export function BrandImage({
  kind,
  width,
  height,
  alt = "",
  preload = false,
  className,
}: {
  kind: keyof typeof SOURCES;
  width: number;
  height: number;
  alt?: string;
  /** Preloads the light image only: the dark one is the alternate. */
  preload?: boolean;
  className?: string;
}) {
  return (
    <>
      <Image
        src={SOURCES[kind].light}
        alt={alt}
        width={width}
        height={height}
        className={cn("object-contain dark:hidden", className)}
        preload={preload}
      />
      <Image
        src={SOURCES[kind].dark}
        alt={alt}
        width={width}
        height={height}
        className={cn("hidden object-contain dark:block", className)}
      />
    </>
  );
}
