import React, { useRef, useEffect, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText as GSAPSplitText } from 'gsap/SplitText';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger, useGSAP, GSAPSplitText);

export interface SplitTextProps {
  text: string;
  className?: string;
  delay?: number;       // ms entre letras/palabras
  duration?: number;    // s
  ease?: string | ((t: number) => number);
  splitType?: 'chars' | 'words' | 'lines' | 'words, chars';
  from?: gsap.TweenVars;
  to?: gsap.TweenVars;
  threshold?: number;   // 0..1
  rootMargin?: string;  // ej. "-100px"
  tag?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span';
  textAlign?: React.CSSProperties['textAlign'];
  onLetterAnimationComplete?: () => void;
}

const SplitText: React.FC<SplitTextProps> = ({
  text,
  className = '',
  delay = 100,
  duration = 0.6,
  ease = 'power3.out',
  splitType = 'chars',
  from = { opacity: 0, y: 40 },
  to = { opacity: 1, y: 0 },
  threshold = 0.1,
  rootMargin = '-100px',
  tag = 'p',
  textAlign = 'center',
  onLetterAnimationComplete,
}) => {
  const ref = useRef<HTMLElement>(null);
  const [fontsLoaded, setFontsLoaded] = useState<boolean>(false);

  useEffect(() => {
    if ('fonts' in document && (document as any).fonts?.status === 'loaded') {
      setFontsLoaded(true);
    } else if ('fonts' in document && (document as any).fonts?.ready) {
      (document as any).fonts.ready.then(() => setFontsLoaded(true));
    } else {
      // fallback si no existe document.fonts
      setFontsLoaded(true);
    }
  }, []);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || !text || !fontsLoaded) return;

      const startPct = (1 - threshold) * 100;
      const marginMatch = /^(-?\d+(?:\.\d+)?)(px|em|rem|%)?$/.exec(rootMargin);
      const marginValue = marginMatch ? parseFloat(marginMatch[1]) : 0;
      const marginUnit = marginMatch ? marginMatch[2] || 'px' : 'px';
      const sign =
        marginValue === 0
          ? ''
          : marginValue < 0
          ? `-=${Math.abs(marginValue)}${marginUnit}`
          : `+=${marginValue}${marginUnit}`;
      const start = `top ${startPct}%${sign}`;

      let targets: Element[] = [];

      const splitInstance = new GSAPSplitText(el, {
        type: splitType,
        smartWrap: true,
        autoSplit: splitType === 'lines',
        linesClass: 'split-line',
        wordsClass: 'split-word',
        charsClass: 'split-char',
        reduceWhiteSpace: false,
        onSplit: (self: GSAPSplitText) => {
          // prioridad chars -> words -> lines
          targets = (self.chars?.length && self.chars) ||
                    (self.words?.length && self.words) ||
                    (self.lines?.length && self.lines) ||
                    [];
          gsap.fromTo(
            targets,
            { ...from },
            {
              ...to,
              duration,
              ease,
              stagger: delay / 1000,
              scrollTrigger: {
                trigger: el,
                start,
                once: true,
                fastScrollEnd: true,
                anticipatePin: 0.4,
              },
              onComplete: onLetterAnimationComplete,
              willChange: 'transform, opacity',
              force3D: true,
            }
          );
        },
      });

      return () => {
        ScrollTrigger.getAll().forEach((st) => {
          if (st.trigger === el) st.kill();
        });
        try {
          splitInstance.revert();
        } catch {
          /* ignore */
        }
      };
    },
    {
      dependencies: [
        text,
        className,
        delay,
        duration,
        String(ease),
        splitType,
        JSON.stringify(from),
        JSON.stringify(to),
        threshold,
        rootMargin,
        fontsLoaded,
      ],
      scope: ref,
    }
  );

  const style: React.CSSProperties = {
    textAlign,
    wordWrap: 'break-word',
    willChange: 'transform, opacity',
  };
  const classes = `split-parent overflow-hidden inline-block whitespace-normal ${className}`;

  switch (tag) {
    case 'h1':
      return <h1 ref={ref as any} style={style} className={classes}>{text}</h1>;
    case 'h2':
      return <h2 ref={ref as any} style={style} className={classes}>{text}</h2>;
    case 'h3':
      return <h3 ref={ref as any} style={style} className={classes}>{text}</h3>;
    case 'h4':
      return <h4 ref={ref as any} style={style} className={classes}>{text}</h4>;
    case 'h5':
      return <h5 ref={ref as any} style={style} className={classes}>{text}</h5>;
    case 'h6':
      return <h6 ref={ref as any} style={style} className={classes}>{text}</h6>;
    case 'span':
      return <span ref={ref as any} style={style} className={classes}>{text}</span>;
    default:
      return <p ref={ref as any} style={style} className={classes}>{text}</p>;
  }
};

export default SplitText;
