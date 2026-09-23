"use client";

import * as React from "react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { ArrowRight, CheckCircle2, PlayCircle } from "lucide-react";

export function V2LearningPaths() {
  const publications = [
    {
      id: "ayt-deneme",
      title: "AYT Coğrafya Konu Özetli Branş Denemeleri",
      description:
        "40 branş denemesi, hepsi yalnız coğrafya sorusu. Denemelerin çözüm videolarını burada izlersin.",
      features: [
        "Videoda istediğin sorunun çözümüne atla",
        "Kaldığın yerden devam et",
        "İzlediğin denemeleri işaretle",
      ],
      href: "/kitaplar/ayt-cografya-konu-ozetli-brans-denemeleri",
      cta: "Kitabı İncele",
    },
    {
      id: "dilsiz-harita",
      title: "Dilsiz Harita Oyunu",
      badge: "Oynamak için giriş yap",
      badgeVariant: "secondary" as const,
      description:
        "Haritada il ve bölge adları yazmaz. Sorulanı hatırlayıp doğru yere tıklaman gerekir.",
      features: [
        "7 bölgeyi ya da 81 ili bul",
        "Bir bölge seçip yalnız onun illeriyle çalış",
        "İstersen 60 saniyeyle yarış",
      ],
      href: "/oyun",
      cta: "Oyna",
    },
    {
      id: "cbs-araclar",
      title: "Harita Araçları",
      badge: "Sonucu resim olarak indir",
      badgeVariant: "outline" as const,
      description:
        "Türkiye haritası üzerinde üç araç: mesafe ölçme, koordinat bulma ve alan hesaplama.",
      features: [
        "Duraklı bir güzergâhı baştan sona ölç",
        "Enlem ve boylamı iki ayrı gösterimde oku",
        "Alanın yanında çevre uzunluğunu da gör",
      ],
      href: "/araclar",
      cta: "Araçları Aç",
    },
  ];

  return (
    <section className="space-y-6">
      <div className="border-b border-border pb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-primary">
            Deneme Çöz, Oyna, Ölç
          </h2>
        </div>
        <Link href="/kitaplar">
          <Button variant="ghost" size="sm" rightIcon={<ArrowRight className="size-4" />}>
            Tüm Kitaplar
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {publications.map((item) => (
          <Card
            key={item.id}
            className="flex flex-col justify-between hover:border-primary/60 transition-all duration-300 hover:shadow-xl hover:-translate-y-1.5 bg-card overflow-hidden group"
          >
            {/* Header Banner */}
            <div className="h-36 bg-gradient-to-br from-primary to-primary-strong p-4 text-primary-foreground relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-center justify-between relative z-10">
                {item.badge ? (
                  <Badge className="bg-primary-foreground text-primary border-transparent text-[10px]">
                    {item.badge}
                  </Badge>
                ) : (
                  <span />
                )}
                <div className="size-8 rounded-full bg-primary-foreground/20 flex items-center justify-center backdrop-blur-xs group-hover:scale-110 transition-transform">
                  <PlayCircle className="size-5" />
                </div>
              </div>

              {/* Decorative Glow */}
              <div className="absolute right-0 bottom-0 -mr-6 -mb-6 size-24 rounded-full bg-primary-foreground/10 blur-xl pointer-events-none" />

              <div className="relative z-10">
                <h3 className="font-heading font-bold text-lg text-primary-foreground leading-tight">
                  {item.title}
                </h3>
              </div>
            </div>

            <CardHeader className="space-y-2 pb-2 pt-4">
              <CardDescription className="text-xs leading-relaxed">
                {item.description}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-2 py-1">
              <div className="space-y-1.5">
                {item.features.map((feat, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="size-3.5 text-success-strong shrink-0" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </CardContent>

            <CardFooter className="pt-4 border-t border-border bg-muted/10">
              <Link
                href={item.href as React.ComponentProps<typeof Link>["href"]}
                className="w-full"
              >
                <Button
                  variant="primary"
                  className="w-full text-xs font-semibold shadow-xs"
                  rightIcon={<ArrowRight className="size-3.5" />}
                >
                  {item.cta}
                </Button>
              </Link>
            </CardFooter>
          </Card>
        ))}
      </div>
    </section>
  );
}
