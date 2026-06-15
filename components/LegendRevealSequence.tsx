"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import MagicalRitualBackground from "@/components/MagicalRitualBackground";
import { getRegionSealClass } from "@/lib/ritual";
import { cn } from "@/lib/utils";

export type LegendRevealStage =
  | "introMessage"
  | "name"
  | "title"
  | "region"
  | "image"
  | "hold"
  | "done";

type LegendRevealSequenceProps = {
  isVisible: boolean;
  name: string;
  legendaryTitle?: string | null;
  region?: string | null;
  imageUrl?: string | null;
  onComplete: () => void;
};

const textReveal = {
  initial: { opacity: 0, y: 12, filter: "blur(6px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  transition: { duration: 0.9, ease: "easeOut" as const },
};

const imageReveal = {
  initial: { opacity: 0, scale: 0.96, y: 10, filter: "blur(10px)" },
  animate: { opacity: 1, scale: 1, y: 0, filter: "blur(0px)" },
  transition: { duration: 1, ease: "easeOut" as const },
};

function extractLegendarySubtitle(name: string, legendaryTitle?: string | null) {
  if (!legendaryTitle?.trim()) {
    return null;
  }

  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const withoutName = legendaryTitle.replace(new RegExp(`^${escaped}[,\\s—–-]+`, "i"), "").trim();
  return withoutName || legendaryTitle;
}

export default function LegendRevealSequence({
  isVisible,
  name,
  legendaryTitle,
  region,
  imageUrl,
  onComplete,
}: LegendRevealSequenceProps) {
  const [stage, setStage] = useState<LegendRevealStage>("introMessage");
  const completedRef = useRef(false);
  const subtitle = useMemo(() => extractLegendarySubtitle(name, legendaryTitle), [legendaryTitle, name]);
  const regionLabel = region && region !== "Auto" ? region : null;
  const sealClass = regionLabel ? getRegionSealClass(regionLabel) : "ritual-seal-default";

  useEffect(() => {
    if (!isVisible) {
      setStage("introMessage");
      completedRef.current = false;
      return;
    }
    setStage("introMessage");
    completedRef.current = false;
  }, [isVisible, name]);

  useEffect(() => {
    if (!isVisible || completedRef.current) {
      return;
    }

    let timer: number | undefined;

    switch (stage) {
      case "introMessage":
        timer = window.setTimeout(() => setStage("name"), 1400);
        break;
      case "name":
        timer = window.setTimeout(() => setStage(subtitle ? "title" : regionLabel ? "region" : "image"), 900);
        break;
      case "title":
        timer = window.setTimeout(() => setStage(regionLabel ? "region" : "image"), 800);
        break;
      case "region":
        timer = window.setTimeout(() => setStage("image"), 1000);
        break;
      case "image":
        timer = window.setTimeout(() => setStage("hold"), 1600);
        break;
      case "hold":
        timer = window.setTimeout(() => {
          if (!completedRef.current) {
            completedRef.current = true;
            setStage("done");
            onComplete();
          }
        }, 2000);
        break;
      default:
        break;
    }

    return () => {
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [isVisible, onComplete, regionLabel, stage, subtitle]);

  if (!isVisible || stage === "done") {
    return null;
  }

  const showIntro = stage === "introMessage";
  const showName = ["name", "title", "region", "image", "hold"].includes(stage);
  const showTitle = Boolean(subtitle) && ["title", "region", "image", "hold"].includes(stage);
  const showRegion = Boolean(regionLabel) && ["region", "image", "hold"].includes(stage);
  const showImage = ["image", "hold"].includes(stage);

  return (
    <motion.div
      className="legend-reveal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: "blur(12px)" }}
      transition={{ duration: 0.7, ease: "easeOut" }}
      role="dialog"
      aria-label="Legend reveal"
      aria-live="polite"
    >
      <MagicalRitualBackground phase="character" />
      <div className="legend-reveal-vignette" aria-hidden="true" />

      <div className="legend-reveal-content">
        <AnimatePresence mode="wait">
          {showIntro ? (
            <motion.p
              key="intro"
              className="legend-reveal-incantation font-cover-title"
              {...textReveal}
            >
              A new legend awakens
            </motion.p>
          ) : null}
        </AnimatePresence>

        {!showIntro ? (
          <div className="legend-reveal-identity">
            {showName ? (
              <motion.h1 key="name" className="legend-reveal-name font-cover-title" {...textReveal}>
                {name}
              </motion.h1>
            ) : null}

            {showTitle && subtitle ? (
              <motion.p
                key="title"
                className="legend-reveal-subtitle font-cover-title"
                initial={textReveal.initial}
                animate={textReveal.animate}
                transition={{ ...textReveal.transition, delay: 0.08 }}
              >
                {subtitle}
              </motion.p>
            ) : null}

            {showRegion && regionLabel ? (
              <motion.div
                key="region"
                className="legend-reveal-region"
                initial={textReveal.initial}
                animate={textReveal.animate}
                transition={{ ...textReveal.transition, delay: 0.06 }}
              >
                <span className={cn("legend-reveal-region-seal", sealClass)} aria-hidden="true" />
                <p className="font-title text-[0.65rem] uppercase tracking-[0.32em] text-[#9eb8d8]/80">
                  From {regionLabel}
                </p>
              </motion.div>
            ) : null}

            {showImage ? (
              <motion.div
                key={imageUrl || "placeholder"}
                className="legend-reveal-frame"
                initial={imageReveal.initial}
                animate={imageReveal.animate}
                transition={imageReveal.transition}
              >
                <motion.div
                  className="legend-reveal-frame-inner"
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
                >
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imageUrl} alt={`${name} — first legend vision`} className="legend-reveal-image" />
                  ) : (
                    <div className="legend-reveal-image-placeholder">
                      <div className="legend-reveal-shimmer" aria-hidden="true" />
                      <p className="font-title text-[0.58rem] uppercase tracking-[0.28em] text-[#8aafd8]/70">
                        The first vision is forming…
                      </p>
                    </div>
                  )}
                  <div className="legend-reveal-frame-glow" aria-hidden="true" />
                </motion.div>
              </motion.div>
            ) : null}

            {stage === "hold" ? (
              <motion.p
                key="hold-message"
                className="legend-reveal-followup font-cover-title"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              >
                The rest of the legend is still unfolding…
              </motion.p>
            ) : null}
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
