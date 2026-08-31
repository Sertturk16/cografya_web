"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Compass,
} from "lucide-react";

export function V2MarineOceanographyGuide() {
  return (
    <section className="space-y-6" aria-labelledby="v2-marine-coastal-guide-heading">
      <div className="border-b border-border pb-4 space-y-1.5">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" size="sm" icon={<Compass className="size-3.5" />}>
            Jeomorfoloji &amp; Kıyı Coğrafyası
          </Badge>
          <span className="text-xs font-semibold text-muted-foreground">Kıyı Tipleri &amp; Dinamikler</span>
        </div>
        <h2 id="v2-marine-coastal-guide-heading" className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-primary-dark,#7e3a1e)]">
          Türkiye&apos;nin Kıyı Tipleri &amp; Denizel Jeomorfolojisi
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Dağların kıyıya uzanış doğrultusu ve dördüncü zaman deniz seviyesi değişimlerine (östatik hareketler) göre şekillenen 6 temel kıyı tipi.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* 1. BOYUNA KIYI TİPİ */}
        <Card className="border border-border bg-card/80 backdrop-blur-sm shadow-sm hover:border-primary/40 transition-all flex flex-col justify-between">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Badge variant="primary" size="sm">Boyuna Kıyı (Pasifik)</Badge>
              <span className="text-[10px] font-mono text-muted-foreground">Karadeniz &amp; Akdeniz</span>
            </div>
            <CardTitle className="text-base font-heading font-bold text-foreground">
              Boyuna Kıyı Tipi
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground pt-0">
            <p>
              Dağların kıyı çizgisine paralel uzandığı alanlarda görülür. Kıyı ile iç kesimler arasında ulaşım geçitlerle (Zigana, Kop, Çubuk, Sertavul, Gülek) sağlanır.
            </p>
            <div className="p-2.5 rounded-xl bg-muted/50 border border-border/60 text-[11px] space-y-1">
              <span className="font-bold text-foreground block">Önemli Morfolojik Unsurlar:</span>
              <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                <li>Falez (Yalıyar) oluşumu ve aşınım fazladır.</li>
                <li>Kıta sahanlığı (şelf) dardır; deniz aniden derinleşir.</li>
                <li>Doğal liman, koy ve körfez sayısı azdır.</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* 2. ENİNE KIYI TİPİ */}
        <Card className="border border-border bg-card/80 backdrop-blur-sm shadow-sm hover:border-primary/40 transition-all flex flex-col justify-between">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Badge variant="secondary" size="sm">Enine Kıyı</Badge>
              <span className="text-[10px] font-mono text-muted-foreground">Ege Bölgesi</span>
            </div>
            <CardTitle className="text-base font-heading font-bold text-foreground">
              Enine Kıyı Tipi
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground pt-0">
            <p>
              Dağların kıyı çizgisine dik uzandığı Ege kıyılarında görülür. Denizel ılıman iklim graben vadileri boyunca 150-200 km iç kesimlere sokulur.
            </p>
            <div className="p-2.5 rounded-xl bg-muted/50 border border-border/60 text-[11px] space-y-1">
              <span className="font-bold text-foreground block">Önemli Morfolojik Unsurlar:</span>
              <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                <li>Girinti-çıkıntı ve koy-körfez sayısı en fazladır.</li>
                <li>Kıta sahanlığı (şelf alanı) oldukça geniştir.</li>
                <li>Gerçek kıyı uzunluğu ile kuş uçuşu farkı en yüksektir.</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* 3. RİA KIYI TİPİ */}
        <Card className="border border-border bg-card/80 backdrop-blur-sm shadow-sm hover:border-primary/40 transition-all flex flex-col justify-between">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Badge variant="outline" size="sm">Ria Tipi</Badge>
              <span className="text-[10px] font-mono text-muted-foreground">Boğazlar &amp; Haliç</span>
            </div>
            <CardTitle className="text-base font-heading font-bold text-foreground">
              Ria Kıyı Tipi
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground pt-0">
            <p>
              Eski akarsu vadilerinin dördüncü zaman deniz seviyesi yükselmesi sonucunda sular altında kalmasıyla oluşan derin doğal su yollarıdır.
            </p>
            <div className="p-2.5 rounded-xl bg-muted/50 border border-border/60 text-[11px] space-y-1">
              <span className="font-bold text-foreground block">Türkiye Örnekleri:</span>
              <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                <li>İstanbul Boğazı &amp; Haliç</li>
                <li>Çanakkale Boğazı</li>
                <li>Muğla - Gökova kıyıları</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* 4. DALMAÇYA KIYI TİPİ */}
        <Card className="border border-border bg-card/80 backdrop-blur-sm shadow-sm hover:border-primary/40 transition-all flex flex-col justify-between">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Badge variant="primary" size="sm">Dalmaçya Tipi</Badge>
              <span className="text-[10px] font-mono text-muted-foreground">Antalya (Kaş - Finike)</span>
            </div>
            <CardTitle className="text-base font-heading font-bold text-foreground">
              Dalmaçya Kıyı Tipi
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground pt-0">
            <p>
              Kıyıya paralel uzanan sıradağ vadilerinin sular altında kalmasıyla, dağ tepe ve sırtlarının kıyıya paralel ada ve adacık zincirlerine dönüşmesidir.
            </p>
            <div className="p-2.5 rounded-xl bg-muted/50 border border-border/60 text-[11px] space-y-1">
              <span className="font-bold text-foreground block">Türkiye Örnekleri:</span>
              <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                <li>Antalya Kaş - Kalkan - Finike açıkları</li>
                <li>Kekova Batık Şehir ve adacıklar kümesi</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* 5. LİMANLI KIYI TİPİ */}
        <Card className="border border-border bg-card/80 backdrop-blur-sm shadow-sm hover:border-primary/40 transition-all flex flex-col justify-between">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Badge variant="secondary" size="sm">Limanlı (Lagün)</Badge>
              <span className="text-[10px] font-mono text-muted-foreground">Marmara &amp; Karadeniz</span>
            </div>
            <CardTitle className="text-base font-heading font-bold text-foreground">
              Limanlı &amp; Lagün Kıyı Tipi
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground pt-0">
            <p>
              Geniş tabanlı vadilerin ve koyların ağzında kıyı kordonlarının (kıyı oklarının) birikerek koy ağzını kapatmasıyla oluşan lagün (denizkulağı) kıyılarıdır.
            </p>
            <div className="p-2.5 rounded-xl bg-muted/50 border border-border/60 text-[11px] space-y-1">
              <span className="font-bold text-foreground block">Türkiye Örnekleri:</span>
              <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                <li>Büyükçekmece ve Küçükçekmece Gölleri</li>
                <li>Terkos (Durusu) Gölü</li>
                <li>Akyatan Lagünü (Adana)</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* 6. KALANKLI KIYI TİPİ */}
        <Card className="border border-border bg-card/80 backdrop-blur-sm shadow-sm hover:border-primary/40 transition-all flex flex-col justify-between">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Badge variant="outline" size="sm">Kalanklı Kıyı</Badge>
              <span className="text-[10px] font-mono text-muted-foreground">Mersin (Silifke)</span>
            </div>
            <CardTitle className="text-base font-heading font-bold text-foreground">
              Kalanklı Kıyı Tipi
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground pt-0">
            <p>
              Kalkerli (kireçtaşı / karstik) arazilerdeki derin kanyon vadilerin deniz suları altında kalmasıyla oluşan dar, derin ve dik yamaçlı koylardır.
            </p>
            <div className="p-2.5 rounded-xl bg-muted/50 border border-border/60 text-[11px] space-y-1">
              <span className="font-bold text-foreground block">Türkiye Örnekleri:</span>
              <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                <li>Mersin - Silifke kıyı kuşağı</li>
                <li>Narlıkuyu &amp; Cennet-Cehennem kıyı hattı</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
