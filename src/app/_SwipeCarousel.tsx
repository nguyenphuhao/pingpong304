"use client";

import { useRef, useState, useEffect, type ReactNode } from "react";

export function SwipeCarousel({
  children,
  dotColor = "bg-foreground",
}: {
  children: ReactNode[];
  dotColor?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const count = children.length;

  useEffect(() => {
    const track = trackRef.current;
    if (!track || count <= 1) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Array.from(track.children).indexOf(
              entry.target as HTMLElement,
            );
            if (idx >= 0) setActiveIndex(idx);
          }
        }
      },
      { root: track, threshold: 0.6 },
    );

    for (const child of track.children) {
      observer.observe(child);
    }
    return () => observer.disconnect();
  }, [count]);

  if (count === 0) return null;

  return (
    <div>
      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto scrollbar-none"
        style={{ scrollbarWidth: "none" }}
      >
        {children.map((child, i) => (
          <div key={i} className="w-full shrink-0 snap-start">
            {child}
          </div>
        ))}
      </div>
      {count > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {Array.from({ length: count }, (_, i) => (
            <span
              key={i}
              className={`size-1.5 rounded-full transition-colors ${
                i === activeIndex ? dotColor : "bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
