"use client";

import * as React from "react";
import { Link } from "@/i18n/navigation";
import type { GeographicRegion } from "@/lib/api/types";
import { regionIdentityOf } from "@/lib/theme/region-identity";
import { BreadcrumbsNav, type BreadcrumbTrailItem } from "@/components/patterns/breadcrumbs-nav";
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
import { Spinner } from "@/components/ui/spinner";
import { V2LeaderboardButton } from "./v2-leaderboard-modal";
import { useLandscapeMode } from "@/lib/map/use-landscape-mode.client";
import {
  CLICK_MOVE_THRESHOLD_PX,
  moveDistance,
  parseViewBox,
  zoomFromPinch,
} from "@/lib/map/zoom-pan";
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
  Minimize2,
  Eye,
  Flag,
  Home,
  BookOpen,
  ShieldCheck,
  Star,
} from "lucide-react";
import { MapAttribution } from "@/components/patterns/map-attribution";
import { GAME_CONFIG, STAR_THRESHOLDS } from "@/lib/game/config";

/** Same bounds the existing +/− buttons already clamp `zoom` to (see the toolbar below). */
const MIN_ZOOM = 0.8;
const MAX_ZOOM = 2.5;

/**
 * The landscape/fullscreen overrides for the map box and its caption wrapper, as INLINE STYLE
 * rather than conditional Tailwind classes. Two reasons, and neither is taste.
 *
 * **They have to win.** `aspect-auto` beating `aspect-[2.33/1]`, or `min-h-0` beating
 * `sm:min-h-[480px]`, is a question about the order Tailwind emits two utilities of equal
 * specificity into the stylesheet — not something this file can state. An inline style beats
 * both without depending on that.
 *
 * **A conditional className is unreadable to the composition scanner.** `lib/test-support/
 * composition-scan.ts` reduces a template hole to `${…}`, and `page-composition-cards.test.ts`
 * counts "card-shaped map viewports" by the `aspect-[…]` it can READ in a className. Moving the
 * plate's geometry into a `${cond ? … : …}` dropped this surface out of that recorded population
 * silently — the test caught it, which is the whole reason that pin is a recorded list. Keeping
 * the base classes literal keeps the surface counted.
 *
 * Why the overrides are needed at all: in landscape the arena is EXACTLY viewport-tall with
 * `overflow-hidden`, so a plate asserting a 480px floor on a 390px-tall screen pushed its own
 * bottom, and everything after it, outside the box. Measured at 844x390 before this: arena
 * 0→390, plate 25→505, credit 525→563 — the credit was not on screen at all.
 */
const LANDSCAPE_FILL: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  flex: "1 1 0%",
  minHeight: 0,
};
const LANDSCAPE_PLATE: React.CSSProperties = {
  flex: "1 1 0%",
  minHeight: 0,
  aspectRatio: "auto",
};

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
  /**
   * Root-relative path of THIS screen, for the breadcrumb trail's last item's `path` (the
   * primitive's React `key`, and the datum a future JSON-LD emitter would need). No `locale`
   * or `surface` prop alongside it any more: this component renders `BreadcrumbsNav`, the
   * client-safe half of `components/patterns/breadcrumbs.tsx`'s split, which draws the trail
   * only and has no JSON-LD to gate — every `(play)/oyun/*` route is `surface: "noindex"` in
   * `lib/seo/indexing.ts` regardless, so the full `Breadcrumbs` server component emitted
   * nothing extra here even before the split forced this component off it.
   */
  readonly currentPath: string;
}

/**
 * The three answer states the map paints, from the `--game-*` set in `app/globals.css`.
 *
 * They are UI STATE, not a data encoding, and they are the set that already carries a distinct
 * stroke treatment per state so right / wrong / revealed stay tellable apart with no colour
 * perception at all. They were raw Tailwind hues here (emerald / amber) and `fill-destructive/80`
 * for the wrong state — a bridge token doing a data job, which `docs/design.md` rule 1 forbids in
 * the other direction too. The reveal marker is deliberately the one dark, low-hue value: it has
 * to read as "look here" over all seven region tints at once.
 */
const CORRECT_FILL = "fill-[var(--game-correct)]/80 animate-in fade-in";
const CORRECT_STROKE = "stroke-[var(--game-correct-edge)] stroke-[1.5]";

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
  currentPath,
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
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const mapArenaRef = React.useRef<HTMLDivElement | null>(null);
  /** The `<svg>`'s own direct, untransformed parent — `offsetWidth`/`Height` here is the
   *  "meet"-fit layout box the smart-focus math below needs; the same properties are not
   *  part of `SVGSVGElement`'s TS surface, and reading them off this plain div sidesteps that
   *  without touching the CSS `transform` that only ever targets the `<svg>` itself. */
  const mapViewportRef = React.useRef<HTMLDivElement | null>(null);

  // "Tam Ekran / Yatay Mod" (T-015) — fullscreen + best-effort landscape lock for the whole
  // game arena (map + HUD + question banner), so none of it is left behind on rotation.
  const landscape = useLandscapeMode(mapArenaRef);

  // Touch pinch-zoom + one-finger pan (T-015). This map had NO pan interaction of any kind
  // before this — `pan` existed only as state the reset button zeroed — and no touch gesture
  // beyond whatever a `<path>`'s native tap-to-click already gave it. Refs, not state: a
  // gesture fires many times a frame and only `zoom`/`pan` themselves need to re-render.
  const touchPointsRef = React.useRef<Map<number, { x: number; y: number }>>(new Map());
  const touchPinchStartRef = React.useRef<{ dist: number; zoom: number } | null>(null);
  const touchPanLastRef = React.useRef<{ x: number; y: number } | null>(null);
  const touchStartPosRef = React.useRef<{ x: number; y: number } | null>(null);
  const touchMaxMoveRef = React.useRef(0);

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

  const resultHeadingRef = React.useRef<HTMLHeadingElement>(null);
  React.useEffect(() => {
    if (isFinished) {
      resultHeadingRef.current?.focus();
    }
  }, [isFinished]);

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

  // --- Touch pinch-zoom + one-finger pan (T-015) ----------------------------------------
  // Filtered to `pointerType === "touch"` throughout, so a mouse click (which also fires a
  // `pointerdown`) never double-runs against the existing per-`<path>` `onClick` handlers.
  const handleTouchPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.pointerType !== "touch") return;
    touchPointsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    touchMaxMoveRef.current = 0;
    touchStartPosRef.current = { x: e.clientX, y: e.clientY };

    if (touchPointsRef.current.size === 1) {
      touchPanLastRef.current = { x: e.clientX, y: e.clientY };
      touchPinchStartRef.current = null;
    } else if (touchPointsRef.current.size === 2) {
      const [a, b] = [...touchPointsRef.current.values()];
      if (a && b) {
        touchPinchStartRef.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom };
        touchPanLastRef.current = null; // suspend one-finger pan while pinching
      }
    }
  };

  const handleTouchPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.pointerType !== "touch") return;
    if (!touchPointsRef.current.has(e.pointerId)) return;
    touchPointsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const start = touchStartPosRef.current;
    if (start) {
      touchMaxMoveRef.current = Math.max(
        touchMaxMoveRef.current,
        moveDistance(e.clientX - start.x, e.clientY - start.y),
      );
    }

    const pinch = touchPinchStartRef.current;
    if (pinch && touchPointsRef.current.size >= 2) {
      const [a, b] = [...touchPointsRef.current.values()];
      if (!a || !b) return;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.dist > 0) {
        setZoom(
          Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomFromPinch(pinch.zoom, pinch.dist, dist))),
        );
      }
      return;
    }

    // One finger: pan, gated to zoomed-in — at 1× (the resting scale) there is nothing to
    // pan to, and a single stationary-ish touch is a candidate tap-to-answer instead.
    const last = touchPanLastRef.current;
    if (!last || zoom <= 1) return;
    if (touchMaxMoveRef.current < CLICK_MOVE_THRESHOLD_PX) return; // still a candidate tap
    const dxClient = e.clientX - last.x;
    const dyClient = e.clientY - last.y;
    // `pan` is applied INSIDE the CSS `scale(zoom)` (see the `<svg>` transform below: the
    // transform list is `scale(zoom) translate(pan.x, pan.y)`, so `translate` runs in the
    // element's own pre-scale pixel space) — a screen-pixel drag delta is therefore this
    // element's own delta divided by the current zoom, not the raw client delta.
    setPan((prev) => ({ x: prev.x + dxClient / zoom, y: prev.y + dyClient / zoom }));
    touchPanLastRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleTouchPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.pointerType !== "touch") return;
    touchPointsRef.current.delete(e.pointerId);
    if (touchPointsRef.current.size < 2) touchPinchStartRef.current = null;
    if (touchPointsRef.current.size === 1) {
      const remaining = [...touchPointsRef.current.values()][0];
      touchPanLastRef.current = remaining ?? null;
      return;
    }
    if (touchPointsRef.current.size === 0) {
      touchPanLastRef.current = null;
      touchStartPosRef.current = null;
      // A real tap (never crossed the movement threshold) is left alone: the browser still
      // delivers the native `click` the per-`<path>` `onClick` below already listens for.
    }
  };

  /**
   * "Smart region focus" (T-015) — pan (never zoom) so the just-revealed answer sits centred
   * once the player has given up on a question, mirroring the V1 game map's own reveal-only
   * camera move: showing the answer honestly, without the auto-zoom-toward-the-target that
   * would answer an OPEN question for the player. Every plate named in `plateCodes` is
   * unioned first, so a "bölge" reveal (many provinces sharing one target id) frames the
   * whole answer rather than whichever province happened to be scanned first.
   *
   * Deliberately ALWAYS recentres rather than only-if-clipped: `pan`/`zoom` here are a CSS
   * transform over a `viewBox` that never itself changes, so "is it currently visible" would
   * need the same box-vs-window arithmetic this function already does to answer "where is
   * it" — recentring unconditionally is simpler and, for an action that fires once per
   * question, not a worse experience.
   */
  const panToRevealedPlates = React.useCallback(
    (plateCodes: readonly string[]) => {
      const svg = svgRef.current;
      if (!svg || plateCodes.length === 0) return;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const plate of plateCodes) {
        const el = document.getElementById(`game-prov-${plate}`);
        if (!(el instanceof SVGGraphicsElement)) continue;
        const box = el.getBBox();
        if (box.width <= 0 || box.height <= 0) continue;
        minX = Math.min(minX, box.x);
        minY = Math.min(minY, box.y);
        maxX = Math.max(maxX, box.x + box.width);
        maxY = Math.max(maxY, box.y + box.height);
      }
      if (!Number.isFinite(minX) || !Number.isFinite(minY)) return; // nothing found — no-op
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;

      const world = parseViewBox(viewBox);
      // `offsetWidth`/`Height` are the LAYOUT box (unaffected by the CSS transform below),
      // matching the "meet" fit the `<svg viewBox>` painted before any transform is applied.
      const viewport = mapViewportRef.current;
      const boxW = viewport?.offsetWidth ?? 0;
      const boxH = viewport?.offsetHeight ?? 0;
      if (boxW <= 0 || boxH <= 0) return;
      const scale = Math.min(boxW / world.w, boxH / world.h);
      const letterboxX = (boxW - world.w * scale) / 2;
      const letterboxY = (boxH - world.h * scale) / 2;
      const localX = letterboxX + (cx - world.x) * scale;
      const localY = letterboxY + (cy - world.y) * scale;

      // Centre `(localX, localY)` under the transform's own origin (`transform-origin:
      // center center`): solving `O + zoom * ((local - O) + pan) = O` for `pan`.
      setPan({ x: boxW / 2 - localX, y: boxH / 2 - localY });
    },
    [viewBox],
  );

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

  // Start new round or request authentication if guest
  const handleStartGameClick = React.useCallback(() => {
    if (authState !== "authenticated") {
      authRequestId.current = requestAuth("gameRound");
      return;
    }
    startRound();
  }, [authState, startRound]);

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

        // Halving score ladder (100 -> 50 -> 25 -> 13 -> 6 -> 3 -> 2 -> 1), from GAME_CONFIG.
        // The three numbers were written out here as `Math.max(1, …100 / 2 ** wrongs)`; they
        // happened to match, but `lib/game/config.ts` is where the ladder is DECIDED and the end
        // screen's own explanation is built from the same constants. Two copies of a tunable
        // product rule is how the explanation ends up describing the old ladder.
        const baseQuestionPoints = Math.max(
          GAME_CONFIG.minQuestionPoints,
          Math.round(GAME_CONFIG.fullQuestionPoints / GAME_CONFIG.halvingBase ** questionWrongs),
        );
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

    // Smart region focus (T-015): province mode reveals one plate; region mode's target id
    // IS a region key, shared by every province in it, so this frames the whole answer.
    const revealedPlates =
      mode === "regions"
        ? targetEntries.filter((s) => s.target?.region === currentTarget.id).map((s) => s.plateCode)
        : [currentTarget.id];
    panToRevealedPlates(revealedPlates);
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
    if (saveStatus === "pending" || saveStatus === "saved") return;

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

  // Resume after authentication — start game automatically
  React.useEffect(() => {
    const id = authRequestId.current;
    if (id === null || modal.resolvedRequestId !== id) return;
    if (!consumeResolved(id)) return;
    authRequestId.current = null;
    startRound();
  }, [modal.resolvedRequestId, startRound]);

  // Auto-save round to API once finished
  React.useEffect(() => {
    if (isFinished && saveStatus === "idle") {
      const timer = setTimeout(() => {
        void handleSaveRound();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isFinished, saveStatus, handleSaveRound]);

  // Normalized academic score (0-100%)
  const normalizedAcademicScore = React.useMemo(() => {
    if (questionScores.length === 0) return 0;
    const sum = questionScores.reduce((a, b) => a + b, 0);
    return Math.round(sum / questionScores.length);
  }, [questionScores]);

  // Calculate Stars (1-3 stars)
  // From the published ladder, never a second copy of it: `STAR_THRESHOLDS` is what the end
  // screen's own "3 yıldız: 85+ puan · …" sentence is built from, so a tuned threshold cannot
  // leave the explanation describing the old one.
  const starCount = STAR_THRESHOLDS.filter(
    (threshold) => normalizedAcademicScore >= threshold,
  ).length;

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      {/* V2 Header */}
      <V2Header />

      {/* Live Telemetry Ticker */}
      <V2LiveTicker />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-6">
        {/*
          THE PLAY SURFACE'S `<h1>`, VISUALLY HIDDEN ON PURPOSE — one element serving all three
          `(play)/oyun/*` screens, which had no heading at ANY level above `<h3>` before this.

          WHY HIDDEN RATHER THAN VISIBLE. All three are `surface: "noindex"` in both locales
          (`buildMetadata` in each page; DEC 2026-07-30p: "application screens, not documents"),
          so the SEO half of the usual argument is absent — there is no crawler to give a title
          to. What remains is the accessibility half, and it is real: a screen-reader user landed
          on a document whose outline began at level 3 and whose "heading 1" key found nothing.
          A heading answers that; a VISIBLE heading would additionally take a band of vertical
          space above the map on a screen whose whole point is the map, at 320px most of all.

          `sr-only` is Tailwind's visually-hidden utility, and what THIS project's Tailwind v4
          emits is worth quoting exactly, because the point of this note is that someone can go
          and check it. Computed on `/oyun/81-il` in the browser:

            position: absolute;  width: 1px;  height: 1px;  padding: 0px;  margin: -1px;
            overflow: hidden;  clip-path: inset(50%);  clip: auto;  white-space: nowrap;
            border-width: 0px;  display: block;  visibility: visible

          `clip-path: inset(50%)`, NOT the older `clip: rect(0,0,0,0)` — `clip` stays `auto` here.
          What matters is the last two: `display: block` and `visibility: visible`, with no
          `aria-hidden` and no `hidden` attribute, so the heading is in the accessibility tree and
          reachable by heading navigation. That is the whole requirement; `display: none` would
          have failed it.

          `modeName` is the same string each page already passes to the breadcrumb trail and to
          its own `<title>`, so the heading cannot drift from either.

          The two overlay panels below (ready-to-start and round result) are this heading's
          `<h2>`s, so the outline steps h1 -> h2 with no skipped level; their classes set size,
          weight and colour, so the level carries no visual change. The "(play) outline steps one
          level at a time" block in `components/v2/page-composition-headings.test.ts` holds it.
        */}
        <h1 className="sr-only">{modeName}</h1>

        {/* Top Navigation & Breadcrumbs */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <BreadcrumbsNav
            items={
              [
                {
                  label: "Ana Sayfa",
                  href: "/",
                  path: "/",
                  icon: <Home className="size-3.5" />,
                },
                { label: "Harita Oyunları", href: "/oyun", path: "/oyun" },
                { label: modeName, path: currentPath },
              ] satisfies BreadcrumbTrailItem[]
            }
          />

          <div className="flex items-center gap-2">
            <Link href={region ? "/oyun/bolge-bolge-il" : "/oyun"}>
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
                      : // The remaining case is the region-scoped province quiz
                        // (`/oyun/bolge-bolge-il/[bolge]`), whose `modeName` prop already IS
                        // "{region} İlleri" — appending " İlleri" again produced "Ege İlleri
                        // İlleri" (T-017).
                        modeName}
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
        <div
          ref={mapArenaRef}
          className={`border border-primary/40 bg-card p-4 sm:p-6 shadow-xl space-y-5 relative overflow-hidden ${
            // The CSS-only fallback layout (no Fullscreen API, e.g. iOS Safari) is a
            // fixed-position box the hook sizes to the viewport — a fixed radius would clip
            // the arena's own corners against straight screen edges (T-015).
            //
            // `flex flex-col` in landscape because the arena is then EXACTLY viewport-tall with
            // `overflow-hidden`, and its children have to be told to fit inside it. In normal
            // flow the plate's `min-h-[480px]` is a floor; in a 390px-tall landscape viewport it
            // is 90px taller than the whole box, so the plate's own bottom AND everything after
            // it fell outside. Measured at 844x390: plate 25→505, credit 525→563, arena 0→390.
            landscape.active ? "flex flex-col" : "rounded-3xl"
          }`}
        >
          {/* Fullscreen / landscape toggle (T-015) — ONE control for both directions. Placed
              here, inside the fullscreened element itself, because once the real Fullscreen
              API engages only this subtree stays on screen: a toggle living in the
              breadcrumb row above would become unreachable the moment it is needed to exit. */}
          <div className="absolute top-3 left-3 z-30 flex flex-col gap-1.5 bg-card/90 backdrop-blur-md p-1.5 rounded-2xl border border-border shadow-lg">
            <button
              type="button"
              onClick={landscape.toggle}
              aria-pressed={landscape.active}
              aria-label={landscape.active ? "Tam ekrandan çık" : "Tam ekran / yatay modda oyna"}
              className="p-2 rounded-xl hover:bg-muted text-foreground transition-colors cursor-pointer"
            >
              {landscape.active ? (
                <Minimize2 className="size-4" />
              ) : (
                <Maximize2 className="size-4" />
              )}
            </button>
          </div>

          {/* "Rotate your phone" (T-015) — only once landscape mode is on, the device is
              STILL portrait (no orientation-lock support, e.g. iOS Safari), and the pointer
              is coarse. Lives inside the same arena for the same reason as the toggle above:
              it must stay visible under a real Fullscreen session. */}
          {landscape.showRotateHint && (
            <div
              role="status"
              aria-live="polite"
              className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 max-w-[92%] flex items-center gap-2.5 bg-ink-dark/95 text-white px-3.5 py-2 rounded-2xl shadow-2xl text-xs"
            >
              <RotateCcw className="size-4 shrink-0" aria-hidden="true" />
              <span>Daha geniş bir görünüm için telefonunu yatay çevir.</span>
              <button
                type="button"
                onClick={landscape.exit}
                className="shrink-0 px-2 py-1 rounded-lg border border-white/40 hover:bg-white/10 transition-colors cursor-pointer"
              >
                Anladım
              </button>
            </div>
          )}

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
                <div className="size-9 rounded-xl bg-muted text-muted-foreground flex items-center justify-center">
                  <Flame className="size-4" />
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                    Seri (Streak)
                  </span>
                  <span className="font-heading text-lg font-bold text-foreground font-mono">
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
                  leftIcon={<HelpCircle className="size-3.5" />}
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

              {/* The hint costs half the question's maximum score, which the sentence itself
                  says — a caution, not neutral information, so the warning family rather than
                  `info`. BACKDROP NAMED: this panel is inside the question banner, whose own
                  `bg-gradient-to-r from-primary/10 via-primary/5 to-card` sits on the play
                  card. `--warning-strong` on `--warning/15` over the gradient's WORST end
                  (`--primary/10` over `--card`, the left end the panel starts at) measures
                  5.19:1 light and 6.52:1 dark; over the `to-card` end 5.87 / 7.36. Confirmed
                  from painted pixels: the panel's dominant painted tone gives 5.27:1 light at
                  320px and 5.64:1 at 1280 — 320 is the binding width, because the panel spans
                  proportionally more of the gradient's tinted end there — and 7.34:1 dark at
                  both. The 5.19 analytic end is the figure recorded, being the lowest of them.
                  Floored, never rounded toward the flattering direction. */}
              {showHint && (
                <div className="w-full p-3 rounded-xl bg-warning/15 border border-warning/30 text-warning-strong text-xs flex items-center gap-2 animate-in fade-in duration-200">
                  <Sparkles className="size-4 text-warning-strong shrink-0" />
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

          {/* Feedback Alert Bar. Its third branch was already on `destructive`, so the other
              two are finishing a conversion rather than starting one. BACKDROP: the play card
              (`bg-card`) — this bar is a direct child of it, not of the question banner above.
              `--success-strong` on `--success/15` over `--card` measures 6.08:1 light and
              7.05:1 dark — analytic, and CONSERVATIVE against the paint, which reads 6.126 /
              7.052. `--warning-strong` on `--warning/15` over the same, 5.87 / 7.36 analytic
              against a painted 5.87 / 7.46. Model and paint sit within ±1 byte per channel of
              each other here as everywhere (8-bit alpha quantisation), in neither direction
              systematically, so the lower of the pair is the one written down. */}
          {lastFeedback && !isFinished && (
            <div
              role="status"
              aria-live="polite"
              className={`p-3 rounded-xl border text-xs font-medium flex items-center gap-2 transition-all animate-in fade-in-50 duration-200 ${
                lastFeedback.type === "correct"
                  ? "bg-success/15 border-success/30 text-success-strong"
                  : lastFeedback.type === "revealed"
                    ? "bg-warning/15 border-warning/30 text-warning-strong"
                    : "bg-destructive/15 border-destructive/30 text-destructive-strong"
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

          {/* 3. SVG INTERACTIVE MAP VIEWPORT, and its caption.
              ONE BOX holds the plate and the credit, so the 8px between them says "this line
              describes the map above it" and is not whatever `space-y-*` the surrounding
              container happens to run. Read off the inherited rhythm instead, the same caption
              sat 20px under its map here, 16px on the tool pages and `/deprem`, and 24px on
              `/turkiye` — three gaps for one relationship. */}
          {/* A map and the line that credits it are a FIGURE and its CAPTION — the relationship
              `v2-province-locator-map.tsx` has always expressed and the other six did not, so a
              screen reader heard a figure caption on a province page and a loose paragraph here.
              `m-0` because a `<figure>` carries a UA margin a `<div>` does not. */}
          <figure className="m-0 space-y-2" style={landscape.active ? LANDSCAPE_FILL : undefined}>
            <div
              ref={mapViewportRef}
              className="relative w-full aspect-[2.33/1] min-h-[380px] sm:min-h-[480px] bg-[var(--map-plate)] rounded-2xl border border-border/80 overflow-hidden shadow-inner flex items-center justify-center"
              style={landscape.active ? LANDSCAPE_PLATE : undefined}
            >
              {/* Zoom / Pan Floating Toolbar */}
              <div className="absolute top-3 right-3 z-20 flex items-center gap-1 p-1 bg-card/90 backdrop-blur-md rounded-xl border border-border/80 shadow-md">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(z + 0.3, 2.5))}
                  className="size-7 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="Yakınlaştır"
                >
                  <ZoomIn className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(z - 0.3, 0.8))}
                  className="size-7 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
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
                  aria-label="Görünümü Sıfırla"
                >
                  <Maximize2 className="size-3.5" />
                </button>
              </div>

              {/* SVG Map */}
              <svg
                ref={svgRef}
                viewBox={viewBox}
                className={`w-full h-full cursor-crosshair transition-transform select-none ${
                  // Zoomed in, this element owns one-finger dragging (pan); at rest a vertical
                  // swipe over the map should still scroll the PAGE. `pan-y` also leaves the
                  // browser's own pinch-zoom suppressed either way (T-015) — our handler above
                  // replaces it.
                  zoom > 1 ? "touch-none" : "touch-pan-y"
                }`}
                style={{
                  transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
                  transformOrigin: "center center",
                }}
                onPointerDown={handleTouchPointerDown}
                onPointerMove={handleTouchPointerMove}
                onPointerUp={handleTouchPointerUp}
                onPointerCancel={handleTouchPointerUp}
                aria-label="Türkiye İnteraktif Oyun Haritası"
              >
                {/* Background Neighbor Countries. `--map-context-land`, NOT `--map-land`: the
                  country fill on this board is `fill-card`, and `--map-land` against `--card`
                  measures 1.00:1 light / 1.01:1 dark -- Türkiye and its neighbours were ONE
                  tone here while the other five Türkiye maps kept the warm/white split this
                  token exists for. Bound to it, the step is 1.18:1 light / 1.17:1 dark, and
                  the line moves with the fill: `--map-context-line` is the hairline measured
                  against that neighbour land (3.28:1 light / 3.18:1 dark) and against the
                  `--map-plate` it also borders (3.05:1 / 3.54:1), where `--province-stroke`
                  is the token for Türkiye's OWN coast. */}
                {!region &&
                  CONTEXT_SHAPES.map((country) => (
                    <path
                      key={country.iso}
                      d={country.d}
                      className="fill-[var(--map-context-land)] stroke-[var(--map-context-line)] stroke-[0.8]"
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
                    // In the region round the map is painted BY region, which is the same
                    // identity `/turkiye` and `/turkiye/bolge/[slug]` paint — one module spells
                    // it (`lib/theme/region-identity.ts`), so this screen cannot drift from
                    // them again. It used to keep its own table of raw Tailwind hues and paint
                    // Marmara amber against those pages' blue.
                    const regionFill = prov.target?.region
                      ? regionIdentityOf(prov.target.region).fill
                      : null;
                    if (isCorrectRegion) {
                      fillClass = CORRECT_FILL;
                      strokeClass = CORRECT_STROKE;
                    } else {
                      fillClass = regionFill ?? "fill-card";
                      strokeClass = "stroke-border/60 stroke-[0.6]";
                    }
                  } else {
                    if (isCorrectProvince) {
                      fillClass = CORRECT_FILL;
                      strokeClass = CORRECT_STROKE;
                    } else if (isRevealed) {
                      fillClass = "fill-[var(--game-reveal)]/80 animate-pulse";
                      strokeClass = "stroke-[var(--game-reveal-edge)] stroke-[2]";
                    }
                  }

                  if (isFlashingWrong) {
                    fillClass = "fill-[var(--game-wrong)]/80 animate-pulse";
                    strokeClass = "stroke-[var(--game-wrong-edge)] stroke-[2]";
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

                {/* Inland Lakes & Water Bodies. Painted AFTER the province layer above (not
                  before, as it was originally) because SVG paints in document order and the
                  province layer's fill is opaque or near-opaque in every state (fill-card,
                  the region fills, the correct/reveal/wrong fills): with the lakes underneath,
                  that fill covered them almost entirely in both themes, independent of colour
                  -- the same inversion `v2-earthquake-explorer.tsx` carried until Task 7.

                  `pointer-events-none` IS LOAD-BEARING, not tidiness. SVG hit-testing takes the
                  LAST-PAINTED element under the pointer, and the province layer above is the one
                  that carries `onClick`/`onKeyDown` (per PATH, not on the <svg>). Without this
                  attribute a tap on Van, Tuz, Beysehir or Egirdir landed on a lake path with no
                  handler and the answer was silently lost, in both rounds and on both input
                  types. `components/v2/inland-water-hit-testing.test.ts` holds the attribute on
                  every render site in the tree. */}
                {INLAND_WATER_SHAPES.map((water) => (
                  <path
                    key={water.id}
                    d={water.d}
                    className="fill-[var(--map-sea)] stroke-[var(--map-water-line)] stroke-[0.5] pointer-events-none"
                  />
                ))}
              </svg>

              {/* Not Playing Overlay */}
              {!isPlaying && !isFinished && (
                <div className="absolute inset-0 bg-background/75 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center space-y-4">
                  <div className="size-16 rounded-3xl bg-primary/15 text-primary flex items-center justify-center shadow-lg">
                    <Gamepad2 className="size-8" />
                  </div>
                  <div className="max-w-md space-y-1">
                    <h2 className="font-heading text-2xl font-bold text-foreground">
                      {modeName} Başlamaya Hazır
                    </h2>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      Seçtiğiniz zorluk seviyesine göre harita üzerinde doğru konumları en yüksek
                      başarı yüzdesiyle işaretleyin.
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={handleStartGameClick}
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
                        correctPlates.size + correctRegions.size === 0 ||
                        normalizedAcademicScore === 0
                          ? "destructive"
                          : endedEarly
                            ? "warning"
                            : wrongCount >= 3 && difficulty === "klasik"
                              ? "destructive"
                              : "primary"
                      }
                      size="sm"
                    >
                      {correctPlates.size + correctRegions.size === 0 ||
                      normalizedAcademicScore === 0
                        ? "Puan Alınamadı"
                        : endedEarly
                          ? "Yarım Tur Tamamlandı"
                          : wrongCount >= 3 && difficulty === "klasik"
                            ? "3 Hata Limiti Doldu"
                            : "Tur Tamamlandı"}
                    </Badge>
                    <h2
                      ref={resultHeadingRef}
                      tabIndex={-1}
                      className="font-heading text-2xl sm:text-3xl font-bold text-foreground mt-2 outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
                    >
                      {correctPlates.size + correctRegions.size === 0 ||
                      normalizedAcademicScore === 0
                        ? "Tur Sona Erdi (Puan Alınamadı) — Tekrar Dene!"
                        : endedEarly
                          ? "Yarım Tur Sonuçları"
                          : wrongCount >= 3 && difficulty === "klasik"
                            ? "Tur Tamamlanamadı — Tekrar Dene!"
                            : "Tebrikler, Harita Turunu Tamamladın!"}
                    </h2>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {correctPlates.size + correctRegions.size === 0 ||
                      normalizedAcademicScore === 0
                        ? "Bu turda hiç puan kazanamadın. İpuçlarından yararlanarak tekrar dene!"
                        : endedEarly
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
                      <span className="font-heading text-2xl font-bold text-foreground font-mono">
                        {bestStreak} 🔥
                      </span>
                    </div>
                    <div className="p-3 rounded-2xl bg-card border border-border">
                      <span className="text-[10px] text-muted-foreground block font-bold">
                        Derece
                      </span>
                      <div className="flex items-center justify-center gap-0.5 mt-1">
                        {/* The COUNT of filled stars is the value; the gold is brand accent on an
                          earned mark, so `--primary` rather than a data token. A solid glyph,
                          so the 3:1 graphical floor applies. BACKDROP: this tile's own opaque
                          `bg-card`, NOT the overlay behind it — confirmed from painted pixels
                          as #ffffff light and #121e21 dark. `--primary` against it measures
                          5.13:1 light and 4.98:1 dark. */}
                        {Array.from({ length: 3 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`size-4 ${i < starCount ? "text-primary fill-primary" : "text-muted/40"}`}
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
                                : "/oyun"
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

                  {/* Auto-Save Status Strip */}
                  <div className="pt-1 flex items-center justify-center">
                    {saveStatus === "pending" && (
                      <div
                        role="status"
                        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-muted text-muted-foreground text-xs font-medium"
                      >
                        <Spinner size="sm" decorative className="text-primary" />
                        <span>Skorunuz profilinize kaydediliyor...</span>
                      </div>
                    )}
                    {/* BACKDROP: the finish overlay, `bg-background/95 backdrop-blur-md` over the
                      play card. Its painted surface is #fbf8f4 light and #0b1417 dark, READ OFF
                      THE RENDERED OVERLAY at 320 and 1280 rather than modelled, because
                      `backdrop-blur-md` is not a blend any analytic model expresses. The model
                      said #0b1517 in dark, one byte out in green — the same ±1 byte the 8-bit
                      alpha step costs everywhere, so at 95% opacity the blur itself is not
                      measurably moving this surface; the read is what establishes that rather
                      than an assumption either way. `--success-strong` on `--success/15` over
                      the PAINTED surface measures 5.76:1 light and 7.81:1 dark. Its `failed`
                      sibling below is already on `destructive`. */}
                    {saveStatus === "saved" && (
                      <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-success/15 border border-success/30 text-success-strong text-xs font-semibold">
                        <CheckCircle2 className="size-3.5" />
                        <span>Skor profilinize kaydedildi</span>
                      </div>
                    )}
                    {saveStatus === "failed" && (
                      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-destructive/15 border border-destructive/30 text-destructive-strong text-xs font-semibold">
                        <XCircle className="size-3.5" />
                        <span>Skor kaydedilemedi</span>
                        <button
                          type="button"
                          onClick={() => {
                            setSaveStatus("idle");
                            void handleSaveRound();
                          }}
                          className="underline hover:opacity-80 ml-1 cursor-pointer font-bold"
                        >
                          Tekrar Dene
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    <Button
                      variant="primary"
                      size="lg"
                      onClick={handleStartGameClick}
                      leftIcon={<RotateCcw className="size-4" />}
                    >
                      Tekrar Oyna
                    </Button>
                    <V2LeaderboardButton mode={submitModeTag} size="lg" />
                    <Link href={region ? "/oyun/bolge-bolge-il" : "/oyun"}>
                      <Button variant="outline" size="lg">
                        Mod Seçimine Dön
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* UNDER the plate, not in it. The plate above lays its children out in a row
                (`flex items-center justify-center`), so a credit inside it is not a caption — it
                is a sibling competing with the map for width, and it won 517px of 1166 while the
                map drew at 647. `v2-map-credit-placement.test.ts` reads the JSX tree for this
                now; the source-order check it used to make was satisfied by the broken shape. */}
            <figcaption>
              <MapAttribution inlandWater context />
            </figcaption>
          </figure>
        </div>
      </main>
    </div>
  );
}
