"use client";

import * as React from "react";
import { usePathname } from "@/i18n/navigation";

export function SiteHeaderWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const pathStr = (pathname as string) || "";

  // On V2 pages, suppress the legacy V1 header completely to avoid double headers
  if (pathStr.startsWith("/v2") || pathStr.includes("/v2")) {
    return null;
  }

  return <>{children}</>;
}

export function SiteFooterWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const pathStr = (pathname as string) || "";

  // On V2 pages, suppress legacy V1 footer so V2 has a unified footer experience
  if (pathStr.startsWith("/v2") || pathStr.includes("/v2")) {
    return null;
  }

  return <>{children}</>;
}
