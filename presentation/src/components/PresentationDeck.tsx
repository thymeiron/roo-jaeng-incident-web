"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { slides } from "@/data/slides";
import { Icon } from "./Icons";
import AllScreensModal from "./AllScreensModal";
import ProgressBar from "./ProgressBar";
import SlideNavigation from "./SlideNavigation";
import { SlideContent } from "./SlideContent";

const TRANSITION_MS = 420;
const SWIPE_DISTANCE = 55;

const parseHash = () => {
  if (typeof window === "undefined") return 0;
  const value = Number(window.location.hash.match(/^#slide-(\d+)$/)?.[1]);
  return Number.isInteger(value) && value >= 1 && value <= slides.length ? value - 1 : 0;
};

type Gesture = { x: number; y: number };
type WebkitDocument = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> | void };
type WebkitElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

export default function PresentationDeck() {
  const [current, setCurrent] = useState(0);
  const [previous, setPrevious] = useState<number | null>(null);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [overview, setOverview] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const currentRef = useRef(0);
  const transitionTimerRef = useRef<number | null>(null);
  const touchRef = useRef<Gesture | null>(null);
  const pointerRef = useRef<Gesture | null>(null);

  const navigate = useCallback((target: number, historyMode: "push" | "replace" | "none" = "push") => {
    const next = Math.max(0, Math.min(slides.length - 1, target));
    const active = currentRef.current;
    if (next === active) return;

    if (transitionTimerRef.current !== null) window.clearTimeout(transitionTimerRef.current);
    setDirection(next > active ? "forward" : "backward");
    setPrevious(active);
    currentRef.current = next;
    setCurrent(next);
    if (historyMode !== "none") {
      window.history[historyMode === "push" ? "pushState" : "replaceState"]({ slide: next }, "", `#slide-${next + 1}`);
    }
    transitionTimerRef.current = window.setTimeout(() => {
      setPrevious(null);
      transitionTimerRef.current = null;
    }, TRANSITION_MS);
  }, []);

  const finishSwipe = useCallback((start: Gesture | null, endX: number, endY: number) => {
    if (!start || overview) return;
    const dx = endX - start.x;
    const dy = endY - start.y;
    if (Math.abs(dx) >= SWIPE_DISTANCE && Math.abs(dx) > Math.abs(dy) * 1.25) {
      navigate(currentRef.current + (dx < 0 ? 1 : -1));
    }
  }, [navigate, overview]);

  useEffect(() => {
    const initial = parseHash();
    currentRef.current = initial;
    setCurrent(initial);
    window.history.replaceState({ slide: initial }, "", `#slide-${initial + 1}`);
    const syncFromUrl = () => navigate(parseHash(), "none");
    window.addEventListener("popstate", syncFromUrl);
    window.addEventListener("hashchange", syncFromUrl);
    return () => {
      window.removeEventListener("popstate", syncFromUrl);
      window.removeEventListener("hashchange", syncFromUrl);
      if (transitionTimerRef.current !== null) window.clearTimeout(transitionTimerRef.current);
    };
  }, [navigate]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const element = event.target as HTMLElement | null;
      if (element?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(element?.tagName ?? "")) return;
      if (overview) {
        if (event.key === "Escape") setOverview(false);
        return;
      }
      if (["ArrowRight", "PageDown", " ", "Spacebar"].includes(event.key)) {
        event.preventDefault();
        navigate(currentRef.current + 1);
      } else if (["ArrowLeft", "PageUp"].includes(event.key)) {
        event.preventDefault();
        navigate(currentRef.current - 1);
      } else if (event.key === "Home") {
        event.preventDefault();
        navigate(0);
      } else if (event.key === "End") {
        event.preventDefault();
        navigate(slides.length - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, overview]);

  useEffect(() => {
    const webkitDocument = document as WebkitDocument;
    const onFullscreenChange = () => setFullscreen(Boolean(document.fullscreenElement ?? webkitDocument.webkitFullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    const webkitDocument = document as WebkitDocument;
    const root = document.documentElement as WebkitElement;
    try {
      if (document.fullscreenElement ?? webkitDocument.webkitFullscreenElement) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else await webkitDocument.webkitExitFullscreen?.();
      } else if (root.requestFullscreen) await root.requestFullscreen();
      else await root.webkitRequestFullscreen?.();
    } catch {
      // Fullscreen can be denied by browser or device policy.
    }
  };

  const selectSlide = (index: number) => {
    setOverview(false);
    navigate(index);
  };

  return <main className="presentation-deck"
    onTouchStart={(event) => {
      if ((event.target as Element).closest("button, input, textarea, select, a")) return;
      const touch = event.changedTouches[0];
      touchRef.current = { x: touch.clientX, y: touch.clientY };
    }}
    onTouchCancel={() => { touchRef.current = null; }}
    onTouchEnd={(event) => {
      const start = touchRef.current;
      touchRef.current = null;
      const touch = event.changedTouches[0];
      finishSwipe(start, touch.clientX, touch.clientY);
    }}
    onPointerDown={(event) => {
      if (event.pointerType === "touch" || (event.target as Element).closest("button, input, textarea, select, a")) return;
      pointerRef.current = { x: event.clientX, y: event.clientY };
    }}
    onPointerCancel={() => { pointerRef.current = null; }}
    onPointerUp={(event) => {
      if (event.pointerType === "touch") return;
      const start = pointerRef.current;
      pointerRef.current = null;
      finishSwipe(start, event.clientX, event.clientY);
    }}>
    <ProgressBar current={current} total={slides.length} />
    <header className="deck-topbar"><button type="button" className="deck-brand" onClick={() => navigate(0)} aria-label="กลับสไลด์แรก"><span>RJ</span><div><b>Roo-Jaeng</b><small>Incident Management</small></div></button><div className="deck-actions"><button type="button" onClick={() => setOverview(true)}><Icon name="grid" /><span>All Screens</span></button><button type="button" onClick={toggleFullscreen} aria-label={fullscreen ? "ออกจากโหมดเต็มหน้าจอ" : "เปิดโหมดเต็มหน้าจอ"}><Icon name="expand" /><span>{fullscreen ? "Exit" : "Fullscreen"}</span></button></div></header>
    <div className="slides-viewport" aria-live="polite">{previous !== null && <div className={`slide-frame slide-exit slide-exit--${direction}`} aria-hidden="true"><SlideContent id={previous + 1} /></div>}<div className={`slide-frame ${previous !== null ? `slide-enter slide-enter--${direction}` : ""}`}><SlideContent id={current + 1} /></div></div>
    <SlideNavigation current={current} total={slides.length} onPrevious={() => navigate(currentRef.current - 1)} onNext={() => navigate(currentRef.current + 1)} />
    {overview && <AllScreensModal current={current} onSelect={selectSlide} onClose={() => setOverview(false)} />}
    <div className="keyboard-hint" aria-hidden="true">← → เพื่อเปลี่ยนสไลด์</div>
  </main>;
}
