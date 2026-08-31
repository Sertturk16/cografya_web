import * as React from "react";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Award,
  Star,
  BookCheck,
  ShieldCheck,
  CheckCircle,
  GraduationCap,
} from "lucide-react";

export function V2SocialProof() {
  return (
    <section className="rounded-3xl border border-border bg-gradient-to-r from-card via-muted/30 to-card p-6 sm:p-8 shadow-sm">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-center divide-y lg:divide-y-0 lg:divide-x divide-border">
        <div className="space-y-1">
          <div className="flex items-center justify-center gap-1 text-amber-500 mb-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="size-4 fill-amber-500 text-amber-500" />
            ))}
          </div>
          <span className="font-heading text-2xl sm:text-3xl font-bold text-foreground block">
            4.9 / 5.0
          </span>
          <span className="text-xs text-muted-foreground font-medium block">
            2.400+ Öğrenci Değerlendirmesi
          </span>
        </div>

        <div className="space-y-1 pt-4 lg:pt-0">
          <div className="size-7 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-1">
            <Users className="size-4" />
          </div>
          <span className="font-heading text-2xl sm:text-3xl font-bold text-primary block">
            150.000+
          </span>
          <span className="text-xs text-muted-foreground font-medium block">
            Aktif Coğrafya Öğrenicisi
          </span>
        </div>

        <div className="space-y-1 pt-4 lg:pt-0">
          <div className="size-7 rounded-full bg-secondary/10 text-secondary flex items-center justify-center mx-auto mb-1">
            <BookCheck className="size-4" />
          </div>
          <span className="font-heading text-2xl sm:text-3xl font-bold text-secondary block">
            81 İl & 248 Ülke
          </span>
          <span className="text-xs text-muted-foreground font-medium block">
            Eksiksiz Tam Kapsamlı Müfredat
          </span>
        </div>

        <div className="space-y-1 pt-4 lg:pt-0">
          <div className="size-7 rounded-full bg-accent/10 text-accent flex items-center justify-center mx-auto mb-1">
            <ShieldCheck className="size-4" />
          </div>
          <span className="font-heading text-2xl sm:text-3xl font-bold text-accent block">
            %100 Bilimsel
          </span>
          <span className="text-xs text-muted-foreground font-medium block">
            Copernicus & ECMWF Lisanslı
          </span>
        </div>
      </div>
    </section>
  );
}
