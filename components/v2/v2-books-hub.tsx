"use client";

import * as React from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  Play,
  CheckCircle2,
  Bookmark,
  Sparkles,
  Award,
  Video,
  Clock,
  HelpCircle,
  FileText,
  GraduationCap,
  ChevronRight,
  Share2,
  Star,
  Layers,
  Check,
} from "lucide-react";

interface QuestionData {
  number: number;
  topic: string;
  duration: string;
  youtubeId: string;
  solved: boolean;
  notes?: string;
}

interface DenemeData {
  id: number;
  title: string;
  questionCount: number;
  totalDuration: string;
  questions: QuestionData[];
}

const SAMPLE_DENEMELER: DenemeData[] = Array.from({ length: 20 }, (_, i) => {
  const dNum = i + 1;
  return {
    id: dNum,
    title: `${dNum}. AYT Branş Denemesi`,
    questionCount: 6,
    totalDuration: "14 dk 30 sn",
    questions: [
      { number: 1, topic: "Doğal Sistemler & İklim Tipleri", duration: "2:15", youtubeId: "dQw4w9WgXcQ", solved: i === 0 },
      { number: 2, topic: "Türkiye'nin Yerşekilleri ve Jeomorfoloji", duration: "2:40", youtubeId: "dQw4w9WgXcQ", solved: i === 0 },
      { number: 3, topic: "Beşeri Sistemler: Nüfus & Göç Politikaları", duration: "1:55", youtubeId: "dQw4w9WgXcQ", solved: false },
      { number: 4, topic: "Ekonomik Faaliyetler & Türkiye'de Tarım", duration: "2:30", youtubeId: "dQw4w9WgXcQ", solved: false },
      { number: 5, topic: "Bölgeler ve Ülkeler: Küresel Ticaret Ağları", duration: "2:50", youtubeId: "dQw4w9WgXcQ", solved: false },
      { number: 6, topic: "Çevre ve Toplum: Doğal Afetler & Sürdürülebilirlik", duration: "2:20", youtubeId: "dQw4w9WgXcQ", solved: false },
    ],
  };
});

export function V2BooksHub() {
  const [selectedDenemeId, setSelectedDenemeId] = React.useState<number>(1);
  const [selectedQuestionNumber, setSelectedQuestionNumber] = React.useState<number>(1);
  const [bookmarkedQuestions, setBookmarkedQuestions] = React.useState<Set<string>>(new Set());
  const [solvedQuestions, setSolvedQuestions] = React.useState<Set<string>>(new Set(["1-1", "1-2"]));
  const [showNoteInput, setShowNoteInput] = React.useState<boolean>(false);
  const [userNote, setUserNote] = React.useState<string>("");

  const currentDeneme = SAMPLE_DENEMELER.find((d) => d.id === selectedDenemeId) || SAMPLE_DENEMELER[0];
  const currentQuestion =
    currentDeneme?.questions.find((q) => q.number === selectedQuestionNumber) || currentDeneme?.questions[0];

  const qKey = `${selectedDenemeId}-${selectedQuestionNumber}`;
  const isBookmarked = bookmarkedQuestions.has(qKey);
  const isSolved = solvedQuestions.has(qKey);

  const toggleSolved = () => {
    setSolvedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(qKey)) next.delete(qKey);
      else next.add(qKey);
      return next;
    });
  };

  const toggleBookmark = () => {
    setBookmarkedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(qKey)) next.delete(qKey);
      else next.add(qKey);
      return next;
    });
  };

  return (
    <div className="space-y-8">
      {/* 1. FEATURED BOOK HERO SHOWCASE */}
      <div className="rounded-3xl border border-primary/30 bg-gradient-to-b from-card via-card to-muted/40 p-6 sm:p-10 shadow-xl space-y-8">
        <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
          {/* 3D Book Cover Visual */}
          <div className="shrink-0 relative group">
            <div className="w-52 sm:w-64 aspect-[3/4] rounded-2xl overflow-hidden border border-border/80 shadow-2xl bg-gradient-to-br from-[#1e293b] via-[#0f172a] to-[#1e1b4b] p-6 flex flex-col justify-between text-white relative transition-transform duration-300 group-hover:scale-105 group-hover:shadow-primary/20">
              <div className="space-y-1">
                <Badge variant="primary" size="sm" className="bg-primary/90 text-white font-mono text-[10px]">
                  ÖSYM / YKS 2026
                </Badge>
                <h3 className="font-heading font-extrabold text-2xl tracking-tight text-white mt-2">
                  AYT Coğrafya
                </h3>
                <p className="text-xs text-slate-300 font-medium">Konu Özetli Branş Denemeleri</p>
              </div>

              <div className="space-y-3">
                <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur-xs border border-white/10 text-[11px] space-y-1">
                  <span className="text-amber-300 font-bold block">20 Branş Denemesi</span>
                  <span className="text-slate-200">120 Video Çözümlü Soru</span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  Yazar: Murat Şenocak
                </div>
              </div>
            </div>
          </div>

          {/* Book Information & Metadata */}
          <div className="space-y-5 max-w-2xl text-center lg:text-left">
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2">
              <Badge variant="primary" size="sm" icon={<BookOpen className="size-3.5" />}>
                Resmi Yayın &amp; Video Çözüm
              </Badge>
              <Badge variant="secondary" size="sm">
                MEB Coğrafya 9-12 Müfredatı
              </Badge>
              <Badge variant="outline" size="sm" className="font-mono text-xs">
                ISBN 978-605-0000-00
              </Badge>
            </div>

            <div>
              <h2 className="font-heading text-3xl sm:text-4xl font-extrabold text-[var(--color-primary-dark,#7e3a1e)] tracking-tight">
                AYT Coğrafya Konu Özetli Branş Denemeleri
              </h2>
              <p className="text-muted-foreground text-sm sm:text-base leading-relaxed mt-2">
                Her denemede ÖSYM soru kalıplarına tam uyumlu 6 soru ve her sorunun alanında uzman yazar tarafından yapılmış ayrıntılı video analizi.
              </p>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3 rounded-2xl bg-card border border-border">
                <span className="font-heading text-xl font-bold text-primary block">20</span>
                <span className="text-[11px] text-muted-foreground font-medium">Toplam Deneme</span>
              </div>
              <div className="p-3 rounded-2xl bg-card border border-border">
                <span className="font-heading text-xl font-bold text-secondary block">120</span>
                <span className="text-[11px] text-muted-foreground font-medium">Özgün Soru</span>
              </div>
              <div className="p-3 rounded-2xl bg-card border border-border">
                <span className="font-heading text-xl font-bold text-accent block">5+ Saat</span>
                <span className="text-[11px] text-muted-foreground font-medium">Video Anlatım</span>
              </div>
              <div className="p-3 rounded-2xl bg-card border border-border">
                <span className="font-heading text-xl font-bold text-purple-600 block">%100</span>
                <span className="text-[11px] text-muted-foreground font-medium">Video Çözümlü</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. INTERACTIVE VIDEO SOLUTION BENCH & PLAYER */}
      <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="primary" size="sm" icon={<Video className="size-3.5" />}>
                Video Çözüm Tezgahı v2
              </Badge>
              <span className="text-xs text-muted-foreground">Soru Bazlı İnteraktif Oynatıcı</span>
            </div>
            <h3 className="font-heading text-2xl font-bold text-foreground mt-1">
              {currentDeneme?.title} &bull; {selectedQuestionNumber}. Soru Çözümü
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={isSolved ? "secondary" : "outline"}
              size="sm"
              onClick={toggleSolved}
              leftIcon={<CheckCircle2 className={`size-3.5 ${isSolved ? "text-emerald-600" : ""}`} />}
            >
              {isSolved ? "Çözüldü Olarak İşaretlendi" : "Çözüldü İşaretle"}
            </Button>
            <Button
              variant={isBookmarked ? "primary" : "outline"}
              size="sm"
              onClick={toggleBookmark}
              leftIcon={<Bookmark className={`size-3.5 ${isBookmarked ? "fill-current" : ""}`} />}
            >
              {isBookmarked ? "Favorilerde" : "Favoriye Ekle"}
            </Button>
          </div>
        </div>

        {/* Deneme Selector Strip */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-muted-foreground block">Deneme Seçimi (1 - 20):</span>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
            {SAMPLE_DENEMELER.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  setSelectedDenemeId(d.id);
                  setSelectedQuestionNumber(1);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  selectedDenemeId === d.id
                    ? "bg-primary text-white shadow-md shadow-primary/20 ring-1 ring-primary/40 scale-105"
                    : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {d.id}. Deneme
              </button>
            ))}
          </div>
        </div>

        {/* Video Player + Questions List Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
          {/* Video Player Frame */}
          <div className="lg:col-span-2 space-y-4">
            <div className="w-full aspect-video rounded-2xl overflow-hidden border border-border bg-black shadow-lg relative flex items-center justify-center">
              {/* Responsive Video Placeholder / Embed Interface */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col justify-between p-6 text-white">
                <div className="flex items-center justify-between">
                  <Badge variant="primary" size="sm" className="bg-red-600 text-white font-mono text-[10px]">
                    YouTube HD
                  </Badge>
                  <span className="text-xs font-mono bg-black/60 px-2.5 py-1 rounded-lg">
                    Süre: {currentQuestion?.duration}
                  </span>
                </div>

                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="size-16 rounded-full bg-red-600/90 text-white flex items-center justify-center shadow-2xl hover:scale-110 hover:bg-red-600 transition-all cursor-pointer">
                    <Play className="size-8 fill-current ml-1" />
                  </div>
                  <span className="text-xs font-medium text-slate-200">Video Çözümü Başlat</span>
                </div>

                <div className="space-y-1">
                  <span className="text-xs text-red-400 font-semibold uppercase tracking-wider block">
                    {currentQuestion?.topic}
                  </span>
                  <h4 className="font-heading font-bold text-lg text-white">
                    {currentDeneme?.title} - {selectedQuestionNumber}. Soru Ayrıntılı Çözümü
                  </h4>
                </div>
              </div>
            </div>

            {/* Question Topic & Acquisition Badge */}
            <div className="p-4 rounded-2xl border border-border bg-card flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" size="sm">
                  Kazanım Konusu
                </Badge>
                <span className="font-semibold text-foreground">{currentQuestion?.topic}</span>
              </div>
              <span className="text-muted-foreground font-mono">ÖSYM Çıkmış Soru Paraleli</span>
            </div>
          </div>

          {/* Question List in Selected Deneme */}
          <div className="space-y-3">
            <h4 className="font-heading font-bold text-sm text-foreground flex items-center justify-between">
              <span>Deneme Soruları (6 Soru)</span>
              <span className="text-xs text-muted-foreground font-normal">Tıkla &amp; İzle</span>
            </h4>

            <div className="space-y-2">
              {currentDeneme?.questions.map((q) => {
                const isActive = q.number === selectedQuestionNumber;
                const itemKey = `${selectedDenemeId}-${q.number}`;
                const itemSolved = solvedQuestions.has(itemKey);

                return (
                  <button
                    key={q.number}
                    type="button"
                    onClick={() => setSelectedQuestionNumber(q.number)}
                    className={`w-full p-3 rounded-2xl border text-left transition-all duration-200 flex items-center justify-between ${
                      isActive
                        ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/40"
                        : "border-border/80 bg-card/60 hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`size-8 rounded-xl flex items-center justify-center font-heading font-bold text-xs ${
                          isActive
                            ? "bg-primary text-white"
                            : itemSolved
                            ? "bg-emerald-500/20 text-emerald-600"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {itemSolved ? <Check className="size-4" /> : q.number}
                      </span>
                      <div className="truncate max-w-[170px] sm:max-w-[200px]">
                        <span className="font-semibold text-xs text-foreground block truncate">
                          {q.number}. Soru: {q.topic}
                        </span>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="size-3" /> {q.duration}
                        </span>
                      </div>
                    </div>

                    <ChevronRight className={`size-4 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
