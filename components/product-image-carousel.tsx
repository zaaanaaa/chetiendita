"use client";

import { useEffect, useRef } from "react";

export type ProductCarouselItem =
  | {
      type: "image";
      src: string;
      alt: string;
    }
  | {
      type: "video";
      src: string;
      alt: string;
      isYouTube: boolean;
      label?: string;
    };

interface ProductImageCarouselProps {
  items: ProductCarouselItem[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  productName: string;
}

function getItemAriaLabel(item: ProductCarouselItem, index: number, total: number) {
  const position = `${index + 1} de ${total}`;

  if (item.type === "video") {
    return item.label ? `Ver video ${position}: ${item.label}` : `Ver video ${position}`;
  }

  return `Ver imagen ${position}`;
}

export function ProductImageCarousel({
  items,
  activeIndex,
  onActiveIndexChange,
  productName,
}: ProductImageCarouselProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<Array<HTMLDivElement | null>>([]);
  const scrollTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    slideRefs.current = slideRefs.current.slice(0, items.length);
  }, [items.length]);

  useEffect(() => {
    const viewport = viewportRef.current;
    const activeSlide = slideRefs.current[activeIndex];

    if (!viewport || !activeSlide) {
      return;
    }

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const nextLeft = activeSlide.offsetLeft;

    if (Math.abs(viewport.scrollLeft - nextLeft) < 2) {
      return;
    }

    viewport.scrollTo({
      left: nextLeft,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  }, [activeIndex, items.length]);

  useEffect(() => {
    function handleResize() {
      const viewport = viewportRef.current;
      const activeSlide = slideRefs.current[activeIndex];

      if (!viewport || !activeSlide) {
        return;
      }

      viewport.scrollTo({ left: activeSlide.offsetLeft, behavior: "auto" });
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [activeIndex]);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current !== null) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  function goToIndex(index: number) {
    if (items.length === 0) {
      return;
    }

    const normalizedIndex = (index + items.length) % items.length;
    onActiveIndexChange(normalizedIndex);
  }

  function handleViewportScroll() {
    const viewport = viewportRef.current;

    if (!viewport || items.length <= 1) {
      return;
    }

    if (scrollTimeoutRef.current !== null) {
      window.clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = window.setTimeout(() => {
      const nextIndex = Math.round(viewport.scrollLeft / Math.max(viewport.clientWidth, 1));

      if (nextIndex !== activeIndex && nextIndex >= 0 && nextIndex < items.length) {
        onActiveIndexChange(nextIndex);
      }
    }, 60);
  }

  return (
    <div className="product-carousel">
      <div
        ref={viewportRef}
        className="product-carousel-viewport"
        onScroll={handleViewportScroll}
        aria-label={`Galería de ${productName}`}
      >
        <div className="product-carousel-track">
          {items.map((item, index) => (
            <div
              key={`${item.type}-${item.src}-${index}`}
              ref={(node) => {
                slideRefs.current[index] = node;
              }}
              className="product-carousel-slide"
              aria-hidden={activeIndex !== index}
            >
              <div className="product-carousel-slide-frame">
                {item.type === "video" ? (
                  item.isYouTube ? (
                    <iframe
                      src={item.src}
                      title={item.label || `${productName} video ${index + 1}`}
                      className="product-video-frame product-video-frame-main"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <video
                      src={item.src}
                      className="product-video-frame product-video-frame-main"
                      controls
                      playsInline
                    />
                  )
                ) : (
                  <img src={item.src} alt={item.alt} className="product-carousel-image" draggable={false} />
                )}
              </div>
            </div>
          ))}
        </div>

        {items.length > 1 ? (
          <div className="product-carousel-arrows">
            <button
              type="button"
              className="product-carousel-arrow"
              onClick={() => goToIndex(activeIndex - 1)}
              aria-label={`Ver media anterior de ${productName}`}
            >
              <span aria-hidden="true">‹</span>
            </button>
            <button
              type="button"
              className="product-carousel-arrow"
              onClick={() => goToIndex(activeIndex + 1)}
              aria-label={`Ver media siguiente de ${productName}`}
            >
              <span aria-hidden="true">›</span>
            </button>
          </div>
        ) : null}
      </div>

      {items.length > 1 ? (
        <div className="product-carousel-dots" aria-label={`Navegación de la galería de ${productName}`}>
          {items.map((item, index) => (
            <button
              key={`dot-${item.type}-${index}`}
              type="button"
              className={`product-carousel-dot ${activeIndex === index ? "active" : ""}`}
              onClick={() => goToIndex(index)}
              aria-label={getItemAriaLabel(item, index, items.length)}
              aria-current={activeIndex === index}
            />
          ))}
        </div>
      ) : null}

      {items.length > 1 ? (
        <div className="product-carousel-thumbs" aria-label={`Miniaturas de ${productName}`}>
          {items.map((item, index) => (
            <button
              key={`thumb-${item.type}-${item.src}-${index}`}
              type="button"
              className={`product-carousel-thumb ${activeIndex === index ? "active" : ""}`}
              onClick={() => goToIndex(index)}
              aria-label={getItemAriaLabel(item, index, items.length)}
            >
              {item.type === "video" ? (
                <span className="product-carousel-thumb-video">
                  <span className="product-carousel-thumb-play">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                  <span className="product-carousel-thumb-label">Video</span>
                </span>
              ) : (
                <img
                  src={item.src}
                  alt={item.alt}
                  className="product-carousel-thumb-image"
                  draggable={false}
                />
              )}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
