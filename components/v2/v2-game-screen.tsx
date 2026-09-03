"use client";

import * as React from "react";
import { Link } from "@/i18n/navigation";
import type { GeographicRegion } from "@/lib/api/types";
import type { GameModeId } from "@/lib/game/config";
import type { GameShapeEntry, GameShapeTargetEntry } from "@/lib/game/map-shapes";
import {
  buildProvinceTargetSet,
  buildRegionTargetSet,
  type GameTarget,
  type RegionLabels,
} from "@/lib/game/target";
import { SLUG_PLACEHOLDER } from "@/lib/game/province-url";
import { MAP_VIEWBOX } from "@/lib/map/tr-provinces.generated";
import { CONTEXT_SHAPES } from "@/lib/map/tr-context.generated";
import { INLAND_WATER_SHAPES } from "@/lib/map/tr-inland-water.generated";
import { submitGameRound } from "@/lib/game-rounds/client";
import { useAuthSession } from "@/lib/auth/use-session.client";
import { requestAuth, useAuthModalState, consumeResolved } from "@/lib/auth/auth-modal.client";
import {
  playSuccessSound,
  playWrongSound,
  playHintSound,
  playVictorySound,
} from "@/lib/game/game-sound";
import { V2Header } from "@/components/v2/v2-header";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Gamepad2,
  Trophy,
  Flame,
  Clock,
  Sparkles,
  RotateCcw,
  Volume2,
  VolumeX,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Award,
  ArrowRight,
  Target,
  Zap,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Eye,
  Flag,
  Home,
  ChevronRight,
  BookOpen,
  Lock,
  Loader2,
  ShieldCheck,
  Star,
} from "lucide-react";

export type V2Difficulty = "klasik" | "zamana-karsi" | "alistirma";

export interface V2GameScreenProps {
  readonly mode: GameModeId;
  readonly modeName: string;
  readonly shapes: readonly GameShapeEntry[];
  readonly targetEntries: readonly GameShapeTargetEntry[];
  readonly regionLabels: RegionLabels;
  readonly allowEarlyFinish: boolean;
  readonly provinceUrlTemplate: string;
  readonly submitModeTag: string;
  readonly region?: GeographicRegion | null;
  readonly viewBox?: string;
}

const REGION_COLOR_CLASSES: Record<GeographicRegion, { fill: string; border: string }> = {
  MARMARA: { fill: "fill-amber-500/80 hover:fill-amber-400", border: "border-amber-500" },
  EGE: { fill: "fill-teal-500/80 hover:fill-teal-400", border: "border-teal-500" },
  AKDENIZ: { fill: "fill-emerald-500/80 hover:fill-emerald-400", border: "border-emerald-500" },
  IC_ANADOLU: { fill: "fill-yellow-500/80 hover:fill-yellow-400", border: "border-yellow-500" },
  KARADENIZ: { fill: "fill-cyan-600/80 hover:fill-cyan-500", border: "border-cyan-500" },
  DOGU_ANADOLU: { fill: "fill-stone-500/80 hover:fill-stone-400", border: "border-stone-500" },
  GUNEYDOGU_ANADOLU: {
    fill: "fill-orange-600/80 hover:fill-orange-500",
    border: "border-orange-500",
  },
};

export function V2GameScreen({
  mode,
  modeName,
  shapes,
  targetEntries,
  regionLabels,
  allowEarlyFinish,
  provinceUrlTemplate,
  submitModeTag,
  region = null,
  viewBox = MAP_VIEWBOX,
}: V2GameScreenProps) {
  const [authState] = useAuthSession();
  const modal = useAuthModalState();
  const authRequestId = React.useRef<string | null>(null);

  // Settings
  const [difficulty, setDifficulty] = React.useState<V2Difficulty>("klasik");
  const [soundEnabled, setSoundEnabled] = React.useState<boolean>(true);

  // Map Zoom & Pan State
  const [zoom, setZoom] = React.useState<number>(1);
  const [pan, setPan] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Game Engine State
  const [isPlaying, setIsPlaying] = React.useState<boolean>(false);
  const [isFinished, setIsFinished] = React.useState<boolean>(false);
  const [endedEarly, setEndedEarly] = React.useState<boolean>(false);
  const [questions, setQuestions] = React.useState<readonly GameTarget[]>([]);
  const [currentIndex, setCurrentIndex] = React.useState<number>(0);
  const [score, setScore] = React.useState<number>(0); // Total XP score
  const [questionScores, setQuestionScores] = React.useState<number[]>([]); // Per-question score (0-100)
  const [streak, setStreak] = React.useState<number>(0);
  const [bestStreak, setBestStreak] = React.useState<number>(0);
  const [wrongCount, setWrongCount] = React.useState<number>(0);
  const [timer, setTimer] = React.useState<number>(60);
  const [clientRoundId, setClientRoundId] = React.useState<string>("");

  // Target binding
  const targetSet = React.useMemo(() => {
    return mode === "regions"
      ? buildRegionTargetSet(targetEntries, regionLabels)
      : buildProvinceTargetSet(targetEntries);
  }, [mode, targetEntries, regionLabels]);

  // Visual highlights
  const [correctPlates, setCorrectPlates] = React.useState<Set<string>>(new Set());
  const [correctRegions, setCorrectRegions] = React.useState<Set<string>>(new Set());
  const [flashingWrongPlate, setFlashingWrongPlate] = React.useState<string | null>(null);
  const [revealedPlate, setRevealedPlate] = React.useState<string | null>(null);
  const [missedItems, setMissedItems] = React.useState<
    Array<{ name: string; slug: string | null }>
  >([]);
  const [lastFeedback, setLastFeedback] = React.useState<{
    type: "correct" | "wrong" | "revealed";
    message: string;
  } | null>(null);
  const [showHint, setShowHint] = React.useState<boolean>(false);
  const [questionWrongs, setQuestionWrongs] = React.useState<number>(0);

  // Save Round State
  const [saveStatus, setSaveStatus] = React.useState<"idle" | "pending" | "saved" | "failed">(
    "idle",
  );

  // Finish round handler
  const handleFinishRound = React.useCallback(
    (early: boolean = false) => {
      setIsFinished(true);
      setEndedEarly(early);
      if (soundEnabled) playVictorySound(true);
    },
    [soundEnabled],
  );

  // Neighbor lands outline
  const trCasing = React.useMemo(() => CONTEXT_SHAPES.find((c) => c.iso === "TR"), []);

  // Timer Effect
  React.useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isPlaying && !isFinished && difficulty === "zamana-karsi") {
      interval = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            handleFinishRound(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, isFinished, difficulty, handleFinishRound]);

  // Start new round
  const startRound = React.useCallback(() => {
    const pool = targetSet.targets.slice().sort(() => Math.random() - 0.5);

    setQuestions(pool);
    setCurrentIndex(0);
    setScore(0);
    setQuestionScores([]);
    setStreak(0);
    setBestStreak(0);
    setWrongCount(0);
    setQuestionWrongs(0);
    setTimer(difficulty === "zamana-karsi" ? 60 : 0);
    setCorrectPlates(new Set());
    setCorrectRegions(new Set());
    setFlashingWrongPlate(null);
    setRevealedPlate(null);
    setMissedItems([]);
    setLastFeedback(null);
    setShowHint(false);
    setIsPlaying(true);
    setIsFinished(false);
    setEndedEarly(false);
    setSaveStatus("idle");
    setClientRoundId(crypto.randomUUID());
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [targetSet, difficulty]);

  const currentTarget = questions[currentIndex] || null;

  // Handle Answer / Province Click
  const handleProvinceClick = (plate: string) => {
    if (!isPlaying || isFinished || !currentTarget) return;

    const shapeEntry = targetEntries.find((s) => s.plateCode === plate);
    if (!shapeEntry || !shapeEntry.target) return;

    const clickedTargetId = targetSet.plateToTarget[plate];
    const isCorrect = clickedTargetId === currentTarget.id;

    if (mode === "provinces") {
      if (isCorrect) {
        // Correct Click!
        playSuccessSound(soundEnabled);

        // Halving score calculation (100 -> 50 -> 25 -> 12 -> 6 -> 3 -> 1)
        const baseQuestionPoints = Math.max(1, Math.round(100 / Math.pow(2, questionWrongs)));
        const finalQuestionPoints = showHint
          ? Math.round(baseQuestionPoints * 0.5)
          : baseQuestionPoints;

        // XP bonus with streak multiplier
        const earnedXP = finalQuestionPoints + streak * 20;
        const newScore = score + earnedXP;
        const newStreak = streak + 1;

        setScore(newScore);
        setQuestionScores((prev) => [...prev, finalQuestionPoints]);
        setStreak(newStreak);
        if (newStreak > bestStreak) setBestStreak(newStreak);
        setCorrectPlates((prev) => new Set(prev).add(plate));
        setRevealedPlate(null);
        setLastFeedback({
          type: "correct",
          message: `Harika! ${currentTarget.label} doğru bulundu. (+${earnedXP} XP)`,
        });
        setShowHint(false);
        setQuestionWrongs(0);

        // Advance or Finish
        if (currentIndex + 1 >= questions.length) {
          handleFinishRound(false);
        } else {
          setCurrentIndex((prev) => prev + 1);
        }
      } else {
        // Wrong Click
        playWrongSound(soundEnabled);
        setStreak(0);
        setWrongCount((prev) => prev + 1);
        setQuestionWrongs((prev) => prev + 1);

        // Flash wrong plate for 900ms then reset (no permanent red mess)
        setFlashingWrongPlate(plate);
        setTimeout(() => setFlashingWrongPlate(null), 900);

        // Record missed item for review
        if (!missedItems.some((m) => m.name === currentTarget.label)) {
          setMissedItems((prev) => [
            ...prev,
            { name: currentTarget.label, slug: currentTarget.slug },
          ]);
        }

        setLastFeedback({
          type: "wrong",
          message: `Yanlış! Burası ${shapeEntry.target.name}. Aranan: ${currentTarget.label}.`,
        });

        // Classic 3-strikes limit check
        if (difficulty === "klasik" && wrongCount + 1 >= 3) {
          handleFinishRound(false);
        }
      }
    } else if (mode === "regions") {
      if (isCorrect) {
        // Correct Region Click!
        playSuccessSound(soundEnabled);
        const earnedXP = 150 + streak * 30;
        setScore((prev) => prev + earnedXP);
        setQuestionScores((prev) => [...prev, 100]);
        const newStreak = streak + 1;
        setStreak(newStreak);
        if (newStreak > bestStreak) setBestStreak(newStreak);
        setCorrectRegions((prev) => new Set(prev).add(currentTarget.id));
        setLastFeedback({
          type: "correct",
          message: `Tebrikler! ${currentTarget.label} doğru tespit edildi.`,
        });
        setShowHint(false);
        setQuestionWrongs(0);

        if (currentIndex + 1 >= questions.length) {
          handleFinishRound(false);
        } else {
          setCurrentIndex((prev) => prev + 1);
        }
      } else {
        // Wrong Region Click
        playWrongSound(soundEnabled);
        setStreak(0);
        setWrongCount((prev) => prev + 1);
        setFlashingWrongPlate(plate);
        setTimeout(() => setFlashingWrongPlate(null), 900);

        const regionName = regionLabels[shapeEntry.target.region];
        setLastFeedback({
          type: "wrong",
          message: `Yanlış! ${shapeEntry.target.name}, ${regionName} bölgesindedir. Aranan: ${currentTarget.label}.`,
        });

        if (difficulty === "klasik" && wrongCount + 1 >= 3) {
          handleFinishRound(false);
        }
      }
    }
  };

  // Reveal (Cevabı Göster) handler
  const handleReveal = () => {
    if (!currentTarget) return;
    setRevealedPlate(currentTarget.id);
    setQuestionScores((prev) => [...prev, 0]); // 0 points for revealed question
    setStreak(0);

    // Add to missed list for review
    if (!missedItems.some((m) => m.name === currentTarget.label)) {
      setMissedItems((prev) => [...prev, { name: currentTarget.label, slug: currentTarget.slug }]);
    }

    setLastFeedback({
      type: "revealed",
      message: `Cevap: ${currentTarget.label} (0 Puan). Haritada sarı ile işaretlendi.`,
    });
  };

  // Advance to next question after reveal
  const handleAdvanceNext = () => {
    setRevealedPlate(null);
    setShowHint(false);
    setQuestionWrongs(0);
    if (currentIndex + 1 >= questions.length) {
      handleFinishRound(false);
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  // Hint generator (Smart geographical hint derived from target data)
  const getSmartHint = () => {
    if (!currentTarget) return "";
    if (mode === "regions") {
      return `İpucu: Bu coğrafi bölgenin doğru sınırlarını bulmak için kıyı şeritleri ve komşu havzaları referans alın.`;
    }

    const shapeEntry = targetEntries.find((s) => s.plateCode === currentTarget.id);
    const regionName = shapeEntry?.target?.region ? regionLabels[shapeEntry.target.region] : "";
    return `İpucu: Bu il ${regionName} bölgesindedir. Plaka Kodu: ${currentTarget.id}`;
  };

  // Submit round to API
  const handleSaveRound = React.useCallback(async () => {
    if (authState === "checking" || saveStatus === "pending" || saveStatus === "saved") return;

    if (authState !== "authenticated") {
      authRequestId.current = requestAuth("gameRound");
      return;
    }

    setSaveStatus("pending");
    const normalizedScore =
      questionScores.length > 0
        ? Math.round(questionScores.reduce((a, b) => a + b, 0) / questionScores.length)
        : 0;

    const res = await submitGameRound({
      mode: submitModeTag,
      clientRoundId,
      score: normalizedScore,
      found: correctPlates.size + correctRegions.size,
      firstTry: questionScores.filter((s) => s === 100).length,
      total: questions.length,
      poolTotal: questions.length,
      totalWrongs: wrongCount,
      endedEarly,
    });

    setSaveStatus(res.ok ? "saved" : "failed");
  }, [
    authState,
    saveStatus,
    questionScores,
    submitModeTag,
    clientRoundId,
    correctPlates.size,
    correctRegions.size,
    questions.length,
    wrongCount,
    endedEarly,
  ]);

  // Resume after authentication
  React.useEffect(() => {
    const id = authRequestId.current;
    if (id === null || modal.resolvedRequestId !== id) return;
    if (!consumeResolved(id)) return;
    authRequestId.current = null;
    void handleSaveRound();
  }, [modal.resolvedRequestId, handleSaveRound]);

  // Normalized academic score (0-100%)
  const normalizedAcademicScore = React.useMemo(() => {
    if (questionScores.length === 0) return 0;
    const sum = questionScores.reduce((a, b) => a + b, 0);
    return Math.round(sum / questionScores.length);
  }, [questionScores]);

  // Calculate Stars (1-3 stars)
  const starCount =
    normalizedAcademicScore >= 85
      ? 3
      : normalizedAcademicScore >= 60
        ? 2
        : normalizedAcademicScore >= 40
          ? 1
          : 0;

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      {/* V2 Header */}
      <V2Header />

      {/* Live Telemetry Ticker */}
      <V2LiveTicker />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-6">
        {/* Top Navigation & Breadcrumbs */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-2 text-xs text-muted-foreground"
          >
            <Link
              href="/v2"
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <Home className="size-3.5" />
              <span>Ana Sayfa</span>
            </Link>
            <ChevronRight className="size-3.5" />
            <Link href="/v2/oyun" className="hover:text-foreground transition-colors">
              Harita Oyunları v2
            </Link>
            <ChevronRight className="size-3.5" />
            <span className="text-foreground font-semibold">{modeName}</span>
          </nav>

          <div className="flex items-center gap-2">
            <Link href={region ? "/v2/oyun/bolge-bolge-il" : "/v2/oyun"}>
              <Button variant="outline" size="sm" leftIcon={<RotateCcw className="size-3.5" />}>
                Oyun Hub&apos;ına Dön
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSoundEnabled(!soundEnabled)}
              leftIcon={
                soundEnabled ? (
                  <Volume2 className="size-3.5 text-primary" />
                ) : (
                  <VolumeX className="size-3.5 text-muted-foreground" />
                )
              }
            >
              {soundEnabled ? "Ses Açık" : "Sessiz"}
            </Button>
          </div>
        </div>

        {/* 1. GAME CONTROL & SETTINGS BAR */}
        <div className="rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/20 p-5 sm:p-6 shadow-md space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="primary" size="sm" icon={<Gamepad2 className="size-3.5" />}>
                  {modeName}
                </Badge>
                <span className="text-xs text-muted-foreground font-medium">
                  {mode === "provinces" && !region
                    ? "81 İl Sınavı"
                    : mode === "regions"
                      ? "7 Coğrafi Bölge"
                      : `${modeName} İlleri`}
                </span>
              </div>
            </div>

            {/* Difficulty Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Zorluk:</span>
              {(["klasik", "zamana-karsi", "alistirma"] as V2Difficulty[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setDifficulty(d);
                    if (isPlaying) startRound();
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    difficulty === d
                      ? "bg-primary text-white shadow-xs font-bold"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {d === "klasik" && "Klasik (3 Hak)"}
                  {d === "zamana-karsi" && "Zamana Karşı (60s)"}
                  {d === "alistirma" && "Alıştırma (Sınırsız)"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 2. ACTIVE GAME ARENA & SVG VECTOR CANVAS */}
        <div className="rounded-3xl border border-primary/40 bg-card p-4 sm:p-6 shadow-xl space-y-5 relative overflow-hidden">
          {/* Active HUD Telemetry */}
          {isPlaying && !isFinished && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 rounded-2xl bg-muted/40 border border-border">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
                  <Trophy className="size-4" />
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                    Kâşif XP
                  </span>
                  <span className="font-heading text-lg font-bold text-primary font-mono">
                    {score}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl bg-secondary/15 text-secondary flex items-center justify-center">
                  <Target className="size-4" />
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                    İlerleme
                  </span>
                  <span className="font-heading text-lg font-bold text-foreground font-mono">
                    {currentIndex + 1} / {questions.length}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl bg-orange-500/15 text-orange-600 flex items-center justify-center">
                  <Flame className="size-4" />
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                    Seri (Streak)
                  </span>
                  <span className="font-heading text-lg font-bold text-orange-600 font-mono">
                    {streak} 🔥
                  </span>
                </div>
              </div>

              {difficulty === "zamana-karsi" ? (
                <div className="flex items-center gap-2.5">
                  <div className="size-9 rounded-xl bg-destructive/15 text-destructive flex items-center justify-center animate-pulse">
                    <Clock className="size-4" />
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                      Kalan Süre
                    </span>
                    <span className="font-heading text-lg font-bold text-destructive font-mono">
                      {timer}s
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2.5">
                  <div className="size-9 rounded-xl bg-destructive/15 text-destructive flex items-center justify-center">
                    <XCircle className="size-4" />
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                      Hata
                    </span>
                    <span className="font-heading text-lg font-bold text-destructive font-mono">
                      {wrongCount} {difficulty === "klasik" ? "/ 3" : ""}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end col-span-2 sm:col-span-1 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowHint(true);
                    playHintSound(soundEnabled);
                  }}
                  disabled={showHint}
                  leftIcon={<HelpCircle className="size-3.5 text-amber-500" />}
                >
                  {showHint ? "İpucu Açık" : "İpucu"}
                </Button>
                {allowEarlyFinish && questionScores.length >= 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleFinishRound(true)}
                    leftIcon={<Flag className="size-3.5" />}
                  >
                    Turu Bitir
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Question Banner */}
          {isPlaying && !isFinished && currentTarget && (
            <div className="p-4 sm:p-5 rounded-2xl border border-primary/40 bg-gradient-to-r from-primary/10 via-primary/5 to-card flex flex-wrap items-center justify-between gap-4 animate-in fade-in duration-300">
              <div className="flex items-center gap-3.5">
                <div className="size-11 rounded-2xl bg-primary text-white flex items-center justify-center font-heading font-bold text-lg shadow-md">
                  ?
                </div>
                <div>
                  <span className="text-xs font-semibold text-primary block">
                    {mode === "regions" ? "Haritada Bu Bölgeyi Bul:" : "Haritada Bu İli Bul:"}
                  </span>
                  <span className="font-heading text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                    {currentTarget.label.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!revealedPlate ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReveal}
                    leftIcon={<Eye className="size-3.5" />}
                  >
                    Cevabı Göster (0 Puan)
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleAdvanceNext}
                    rightIcon={<ArrowRight className="size-3.5" />}
                  >
                    Sıradaki Soruya Geç
                  </Button>
                )}
              </div>

              {showHint && (
                <div className="w-full p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2 animate-in fade-in duration-200">
                  <Sparkles className="size-4 text-amber-600 shrink-0" />
                  <span>
                    {getSmartHint()}{" "}
                    <em className="opacity-80">
                      (İpucu kullanıldığı için bu sorunun maksimum puanı %50&apos;ye düşürüldü)
                    </em>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Feedback Alert Bar */}
          {lastFeedback && !isFinished && (
            <div
              className={`p-3 rounded-xl border text-xs font-medium flex items-center gap-2 transition-all animate-in fade-in-50 duration-200 ${
                lastFeedback.type === "correct"
                  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                  : lastFeedback.type === "revealed"
                    ? "bg-amber-500/15 border-amber-500/30 text-amber-800 dark:text-amber-300"
                    : "bg-destructive/15 border-destructive/30 text-destructive"
              }`}
            >
              {lastFeedback.type === "correct" ? (
                <CheckCircle2 className="size-4 shrink-0" />
              ) : lastFeedback.type === "revealed" ? (
                <Eye className="size-4 shrink-0" />
              ) : (
                <XCircle className="size-4 shrink-0" />
              )}
              <span>{lastFeedback.message}</span>
            </div>
          )}

          {/* 3. SVG INTERACTIVE MAP VIEWPORT */}
          <div className="relative w-full aspect-[2.33/1] min-h-[380px] sm:min-h-[480px] bg-[#dbe8ee] dark:bg-[#15232d] rounded-2xl border border-border/80 overflow-hidden shadow-inner flex items-center justify-center">
            {/* Zoom / Pan Floating Toolbar */}
            <div className="absolute top-3 right-3 z-20 flex items-center gap-1 p-1 bg-card/90 backdrop-blur-md rounded-xl border border-border/80 shadow-md">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(z + 0.3, 2.5))}
                className="size-7 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                title="Yakınlaştır"
                aria-label="Yakınlaştır"
              >
                <ZoomIn className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(z - 0.3, 0.8))}
                className="size-7 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                title="Uzaklaştır"
                aria-label="Uzaklaştır"
              >
                <ZoomOut className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
                className="size-7 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                title="Sıfırla"
                aria-label="Görünümü Sıfırla"
              >
                <Maximize2 className="size-3.5" />
              </button>
            </div>

            {/* SVG Map */}
            <svg
              viewBox={viewBox}
              className="w-full h-full object-contain cursor-crosshair transition-transform select-none"
              style={{
                transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
                transformOrigin: "center center",
              }}
              aria-label="Türkiye İnteraktif Oyun Haritası"
            >
              {/* Background Neighbor Countries (Rendered when full country is shown) */}
              {!region &&
                CONTEXT_SHAPES.map((country) => (
                  <path
                    key={country.iso}
                    d={country.d}
                    className="fill-[#e8edea] dark:fill-[#202b33] stroke-[#c0cec5] dark:stroke-[#2e3c46] stroke-[0.8]"
                  />
                ))}

              {/* Inland Lakes & Water Bodies */}
              {INLAND_WATER_SHAPES.map((water) => (
                <path
                  key={water.id}
                  d={water.d}
                  className="fill-[#a9ccdf] dark:fill-[#122b3d] stroke-[#8bb7cf] dark:stroke-[#0e2230] stroke-[0.5]"
                />
              ))}

              {/* Turkey Context Casing Outline */}
              {!region && trCasing && (
                <path
                  d={trCasing.d}
                  className="fill-none stroke-border/70 stroke-[2] pointer-events-none"
                />
              )}

              {/* Interactive Provinces / Regions */}
              {shapes.map((prov) => {
                const isCorrectProvince = correctPlates.has(prov.plateCode);
                const isCorrectRegion = prov.target && correctRegions.has(prov.target.region);
                const isFlashingWrong = flashingWrongPlate === prov.plateCode;
                const isRevealed = revealedPlate === prov.plateCode;

                // Base styling
                let fillClass = "fill-card hover:fill-primary/30";
                let strokeClass = "stroke-border/70 hover:stroke-primary stroke-[0.7]";

                if (mode === "regions") {
                  // In region finding mode, show beautiful regional colors
                  const regColor = prov.target?.region
                    ? REGION_COLOR_CLASSES[prov.target.region]
                    : null;
                  if (isCorrectRegion) {
                    fillClass = "fill-emerald-500/80 animate-in fade-in";
                    strokeClass = "stroke-emerald-700 stroke-[1.5]";
                  } else {
                    fillClass = regColor ? regColor.fill : "fill-card";
                    strokeClass = "stroke-border/60 stroke-[0.6]";
                  }
                } else {
                  if (isCorrectProvince) {
                    fillClass = "fill-emerald-500/80 animate-in fade-in";
                    strokeClass = "stroke-emerald-700 stroke-[1.5]";
                  } else if (isRevealed) {
                    fillClass = "fill-amber-400/80 animate-pulse";
                    strokeClass = "stroke-amber-700 stroke-[2]";
                  }
                }

                if (isFlashingWrong) {
                  fillClass = "fill-destructive/80 animate-pulse";
                  strokeClass = "stroke-destructive stroke-[2]";
                }

                const displayName = prov.target ? prov.target.name : prov.plateCode;

                return (
                  <path
                    key={prov.plateCode}
                    d={prov.d}
                    id={`game-prov-${prov.plateCode}`}
                    role="button"
                    tabIndex={isPlaying && !isFinished ? 0 : -1}
                    aria-label={displayName}
                    className={`${fillClass} ${strokeClass} transition-colors duration-200 cursor-pointer outline-none focus-visible:stroke-primary focus-visible:stroke-[2]`}
                    onClick={() => handleProvinceClick(prov.plateCode)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleProvinceClick(prov.plateCode);
                      }
                    }}
                  >
                    <title>{displayName}</title>
                  </path>
                );
              })}
            </svg>

            {/* Not Playing Overlay */}
            {!isPlaying && !isFinished && (
              <div className="absolute inset-0 bg-background/75 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center space-y-4">
                <div className="size-16 rounded-3xl bg-primary/15 text-primary flex items-center justify-center shadow-lg">
                  <Gamepad2 className="size-8" />
                </div>
                <div className="max-w-md space-y-1">
                  <h3 className="font-heading text-2xl font-bold text-foreground">
                    {modeName} Başlamaya Hazır
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    Seçtiğiniz zorluk seviyesine göre harita üzerinde doğru konumları en yüksek
                    başarı yüzdesiyle işaretleyin.
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="lg"
                  onClick={startRound}
                  leftIcon={<Zap className="size-4" />}
                >
                  Sınavı Başlat
                </Button>
              </div>
            )}

            {/* 4. GAME OVER / RESULT MODAL OVERLAY */}
            {isFinished && (
              <div className="absolute inset-0 bg-background/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center space-y-5 animate-in zoom-in-95 duration-300 overflow-y-auto max-h-full">
                <div className="size-16 sm:size-20 rounded-full bg-primary/20 text-primary flex items-center justify-center shadow-xl shrink-0">
                  {endedEarly ? (
                    <Flag className="size-8 sm:size-10 text-primary" />
                  ) : wrongCount >= 3 && difficulty === "klasik" ? (
                    <ShieldCheck className="size-8 sm:size-10 text-destructive" />
                  ) : (
                    <Award className="size-8 sm:size-10 text-primary" />
                  )}
                </div>

                <div className="space-y-1 max-w-md">
                  <Badge
                    variant={
                      endedEarly
                        ? "secondary"
                        : wrongCount >= 3 && difficulty === "klasik"
                          ? "destructive"
                          : "primary"
                    }
                    size="sm"
                  >
                    {endedEarly
                      ? "Yarım Tur Tamamlandı"
                      : wrongCount >= 3 && difficulty === "klasik"
                        ? "3 Hata Limiti Doldu"
                        : "Tur Tamamlandı"}
                  </Badge>
                  <h3 className="font-heading text-2xl sm:text-3xl font-bold text-foreground mt-2">
                    {endedEarly
                      ? "Yarım Tur Sonuçları"
                      : wrongCount >= 3 && difficulty === "klasik"
                        ? "Tur Tamamlanamadı — Tekrar Dene!"
                        : "Tebrikler, Harita Turunu Tamamladın!"}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {endedEarly
                      ? `${questions.length} sorunun ${questionScores.length} tanesini oynadın.`
                      : "Mekânsal hafıza sınavını bitirdin. İşte performans raporun:"}
                  </p>
                </div>

                {/* Score & Metric Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-lg w-full">
                  <div className="p-3 rounded-2xl bg-card border border-border">
                    <span className="text-[10px] text-muted-foreground block font-bold">
                      Başarı Skoru
                    </span>
                    <span className="font-heading text-2xl font-bold text-primary font-mono">
                      %{normalizedAcademicScore}
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-card border border-border">
                    <span className="text-[10px] text-muted-foreground block font-bold">
                      Toplam XP
                    </span>
                    <span className="font-heading text-2xl font-bold text-foreground font-mono">
                      {score}
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-card border border-border">
                    <span className="text-[10px] text-muted-foreground block font-bold">
                      En İyi Seri
                    </span>
                    <span className="font-heading text-2xl font-bold text-orange-600 font-mono">
                      {bestStreak} 🔥
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-card border border-border">
                    <span className="text-[10px] text-muted-foreground block font-bold">
                      Derece
                    </span>
                    <div className="flex items-center justify-center gap-0.5 mt-1">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`size-4 ${i < starCount ? "text-amber-500 fill-amber-500" : "text-muted/40"}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Review Missed Provinces Section */}
                {missedItems.length > 0 && (
                  <div className="max-w-md w-full p-3 rounded-2xl bg-card/90 border border-border text-left space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                      <BookOpen className="size-3.5 text-primary" />
                      <span>Bilemediklerini Tekrar Et:</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {missedItems.map((item) => (
                        <a
                          key={item.name}
                          href={
                            item.slug
                              ? provinceUrlTemplate.replace(SLUG_PLACEHOLDER, item.slug)
                              : "/v2/oyun"
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 rounded-lg bg-muted text-[11px] font-semibold text-foreground hover:bg-primary/10 hover:text-primary transition-colors inline-flex items-center gap-1"
                        >
                          <span>{item.name}</span>
                          <ArrowRight className="size-2.5 opacity-60" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Save Round to Profile Button */}
                <div className="pt-1">
                  <Button
                    variant={saveStatus === "saved" ? "outline" : "primary"}
                    size="default"
                    onClick={handleSaveRound}
                    disabled={saveStatus === "pending" || saveStatus === "saved"}
                    leftIcon={
                      saveStatus === "pending" ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : saveStatus === "saved" ? (
                        <CheckCircle2 className="size-4 text-emerald-600" />
                      ) : authState !== "authenticated" ? (
                        <Lock className="size-4" />
                      ) : (
                        <Trophy className="size-4" />
                      )
                    }
                  >
                    {saveStatus === "saved"
                      ? "Skor Profilinize Kaydedildi"
                      : saveStatus === "pending"
                        ? "Kaydediliyor..."
                        : authState !== "authenticated"
                          ? "Skoru Kaydet (Giriş Yap)"
                          : "Skoru Profilime Kaydet"}
                  </Button>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 pt-2">
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={startRound}
                    leftIcon={<RotateCcw className="size-4" />}
                  >
                    Tekrar Oyna
                  </Button>
                  <Link href={region ? "/v2/oyun/bolge-bolge-il" : "/v2/oyun"}>
                    <Button variant="outline" size="lg">
                      Mod Seçimine Dön
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
