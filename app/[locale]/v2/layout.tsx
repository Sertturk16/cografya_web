import type { ReactNode } from "react";
import { V2AuthDialog } from "@/components/v2/v2-auth-dialog";

export default function V2Layout({ children }: { children: ReactNode }) {
  return (
    <div className="v2-app min-h-screen flex flex-col">
      {children}
      <V2AuthDialog />
    </div>
  );
}
