// app/components/animation/SplitText.tsx
import React, { useEffect, useMemo, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

type SplitMode = "chars" | "words";

export interface SplitTextProps {
  text: string;
  className?: string;
  delay?: number;             // ms entre elementos
  duration?: number;          // duración de cada tween
  ease?: gsap.TweenVars["ease"]; // string ("power3.out") o función
  splitType?: SplitMode;      // "chars" | "words"
  from?: gsap.TweenVars;
  to?: gsap.TweenVars;
  threshold?: number;         // 0..1 => se traduce a start
  rootMargin?: string;        // offset adicional tipo CSS
  tag?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "span" | "div";
  textAlign?: React.CSSProperties["textAlign"];
  onLetterAnimationComplete?: () => void;
}

const SplitText: React.FC<SplitTextProps> = ({
  text,
  className = "",
  delay = 100,
  duration = 0.6,
  ease = "power3.out",
  splitType = "chars",
  from = { opacity: 0, y: 40 },
  to = { opacity: 1, y: 0 },
  threshold = 0.1,
  rootMargin = "-100px",
  tag = "p",
  textAlign = "center",
  onLetterAnimationComplete,
}) => {
  const containerRef = useRef<HTMLElement>(null);

  // Registra ScrollTrigger solo en cliente
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      gsap.registerPlugin(ScrollTrigger);
    } catch {
      /* idempotente */
    }
  }, []);

  // Partimos el texto en segmentos
  const parts = useMemo(() => {
    if (splitType === "words") {
      const words = text.split(" ");
      const arr: Array<{ key: string; content: string; isSpace?: boolean }> = [];
      words.forEach((w, idx) => {
        arr.push({ key: `w-${idx}`, content: w });
        if (idx < words.length - 1) arr.push({ key: `space-${idx}`, content: "\u00A0", isSpace: true });
      });
      return arr;
    }
    // chars
    return Array.from(text).map((c, i) => ({
      key: `c-${i}`,
      content: c === " " ? "\u00A0" : c,
      isSpace: c === " ",
    }));
  }, [text, splitType]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const targets = Array.from(el.querySelectorAll<HTMLElement>("span[data-split]"));

    // Construir "start" tipo ScrollTrigger
    const startPct = (1 - Math.min(Math.max(threshold, 0), 1)) * 100;
    const mm = /^(-?\d+(?:\.\d+)?)(px|em|rem|%)?$/.exec(rootMargin);
    const mv = mm ? parseFloat(mm[1]) : 0;
    const mu = mm ? mm[2] || "px" : "px";
    const sign = mv === 0 ? "" : mv < 0 ? `-=${Math.abs(mv)}${mu}` : `+=${mv}${mu}`;
    const start = `top ${startPct}%${sign}`;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        targets,
        { ...from },
        {
          ...to,
          ease,
          duration,
          stagger: delay / 1000,
          ...(typeof window !== "undefined"
            ? {
                scrollTrigger: {
                  trigger: el,
                  start,
                  once: true,
                  fastScrollEnd: true,
                  anticipatePin: 0.4,
                },
              }
            : {}),
          onComplete: onLetterAnimationComplete,
          force3D: true,
          // setea CSS 'will-change' en los items
          onStart: () => targets.forEach(t => (t.style.willChange = "transform, opacity")),
          onCompleteParams: [],
        }
      );
    }, el);

    return () => ctx.revert();
  }, [delay, duration, ease, from, to, rootMargin, threshold, onLetterAnimationComplete]);

  const style: React.CSSProperties = {
    textAlign,
    display: "inline-block",
    wordWrap: "break-word",
  };
  const classes = `split-parent overflow-hidden whitespace-normal ${className}`;
  const Tag = tag as any;

  return (
    <Tag ref={containerRef} style={style} className={classes}>
      {parts.map((p) => (
        <span
          key={p.key}
          data-split
          className={p.isSpace ? "split-space inline-block" : "split-part inline-block"}
        >
          {p.content}
        </span>
      ))}
    </Tag>
  );
};

export default SplitText;
