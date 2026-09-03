import type { Metadata } from "next";
import type { ReactNode } from "react";
import { V2AuthDialog } from "@/components/v2/v2-auth-dialog";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: true,
  },
};

export default function V2Layout({ children }: { children: ReactNode }) {
  return (
    <div className="v2-app min-h-screen flex flex-col">
      {children}
      <V2AuthDialog />
    </div>
  );
}
