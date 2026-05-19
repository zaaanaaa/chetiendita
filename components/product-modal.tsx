"use client";

import { useEffect, useRef, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useCart } from "@/components/cart-context";
import { ProductCarouselItem, ProductImageCarousel } from "@/components/product-image-carousel";
import { isColorVariantGroup, isHexColor } from "@/lib/color-variants";
import { Product } from "@/lib/types";

interface ProductModalProps {
  product: Product;
  onClose: () => void;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

function getEffectivePrice(product: Product) {
  return product.discountPrice ?? product.price;
}

function getDiscountPercentage(product: Product) {
  if (!product.discountPrice || product.discountPrice >= product.price) {
    return null;
  }

  return Math.round(((product.price - product.discountPrice) / product.price) * 100);
}

function getEmbeddedVideoUrl(value: string | null) {
  if (!value) {
    return null;
  }

  if (value.startsWith("data:video/")) {
    return value;
  }

  try {
    const url = new URL(value);
    const hostname = url.hostname.replace(/^www\./, "");

    if (hostname === "youtube.com" || hostname === "m.youtube.com") {
      const videoId = url.searchParams.get("v");
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    }

    if (hostname === "youtu.be") {
      const videoId = url.pathname.split("/").filter(Boolean)[0];
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    }

    return value;
  } catch {
    return null;
  }
}

export function ProductModal({ product, onClose }: ProductModalProps) {
  const { addItem } = useCart();
  const router = useRouter();
  const lockedScrollYRef = useRef(0);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const effectivePrice = getEffectivePrice(product);
  const discountPercentage = getDiscountPercentage(product);
  const mediaItems = useMemo<ProductCarouselItem[]>(() => {
    const imageSources = product.images.length > 0 ? product.images : [product.image];
    const items: ProductCarouselItem[] = imageSources.map((image, index) => ({
      type: "image",
      src: image,
      alt: `${product.name} - imagen ${index + 1}`,
    }));
    const productVideos =
      product.videos?.length > 0
        ? product.videos
        : product.video
          ? [{ url: product.video, label: "Video" }]
          : [];

    for (const video of productVideos) {
      const embeddedVideoUrl = getEmbeddedVideoUrl(video.url);
      if (embeddedVideoUrl) {
        items.push({
          type: "video",
          src: embeddedVideoUrl,
          alt: `${product.name} - video`,
          isYouTube: embeddedVideoUrl.includes("youtube.com/embed/"),
          label: video.label,
        });
      }
    }
    return items;
  }, [product.image, product.images, product.name, product.video, product.videos]);
  const selectedMedia = mediaItems[selectedImageIndex] || mediaItems[0];

  useEffect(() => {
    const bodyStyle = document.body.style;
    const htmlStyle = document.documentElement.style;
    const previousBodyPosition = bodyStyle.position;
    const previousBodyTop = bodyStyle.top;
    const previousBodyLeft = bodyStyle.left;
    const previousBodyRight = bodyStyle.right;
    const previousBodyWidth = bodyStyle.width;
    const previousBodyOverflow = bodyStyle.overflow;
    const previousHtmlOverflow = htmlStyle.overflow;
    const previousHtmlOverscroll = htmlStyle.overscrollBehavior;

    lockedScrollYRef.current = window.scrollY;
    bodyStyle.position = "fixed";
    bodyStyle.top = `-${lockedScrollYRef.current}px`;
    bodyStyle.left = "0";
    bodyStyle.right = "0";
    bodyStyle.width = "100%";
    bodyStyle.overflow = "hidden";
    htmlStyle.overflow = "hidden";
    htmlStyle.overscrollBehavior = "none";

    return () => {
      bodyStyle.position = previousBodyPosition;
      bodyStyle.top = previousBodyTop;
      bodyStyle.left = previousBodyLeft;
      bodyStyle.right = previousBodyRight;
      bodyStyle.width = previousBodyWidth;
      bodyStyle.overflow = previousBodyOverflow;
      htmlStyle.overflow = previousHtmlOverflow;
      htmlStyle.overscrollBehavior = previousHtmlOverscroll;
      window.scrollTo(0, lockedScrollYRef.current);
    };
  }, []);

  useEffect(() => {
    const defaults = Object.fromEntries(
      product.variantGroups
        .filter((group) => group.options.length > 0)
        .map((group) => [group.name, group.options[0]]),
    );
    setQuantity(1);
    setSelectedOptions(defaults);
    setSelectedImageIndex(0);
    setAdded(false);
  }, [product]);

  const variantLabel = useMemo(() => {
    const entries = product.variantGroups
      .map((group) => {
        const option = selectedOptions[group.name];
        return option ? `${group.name}: ${option}` : null;
      })
      .filter(Boolean);

    return entries.join(" · ");
  }, [product.variantGroups, selectedOptions]);

  function handleAdd() {
    addItem({
      productId: product.id,
      productName: product.name,
      variant: variantLabel,
      unitPrice: effectivePrice,
      image: selectedMedia?.type === "image" ? selectedMedia.src : product.images[0] || product.image,
      quantity,
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1600);
  }

  function handleTagClick(tag: string) {
    onClose();
    router.push(`/catalogo?tag=${encodeURIComponent(tag)}`);
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-card modal-card-product"
        role="dialog"
        aria-modal="true"
        aria-label={product.name}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close-btn" type="button" onClick={onClose} aria-label="Cerrar">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>

        <div className="product-modal-layout">
          <div className="product-modal-image">
            <ProductImageCarousel
              items={mediaItems}
              activeIndex={selectedImageIndex}
              onActiveIndexChange={setSelectedImageIndex}
              productName={product.name}
            />
          </div>

          <div className="product-modal-info">
            <div className="product-modal-header">
              {product.tags.length > 0 ? (
                <div className="tag-row">
                  {product.tags.map((tag) => (
                    <button key={tag} type="button" className="tag-chip tag-chip-action" onClick={() => handleTagClick(tag)}>
                      #{tag}
                    </button>
                  ))}
                </div>
              ) : null}
              <h2>{product.name}</h2>
              <div className="product-price-stack product-price-stack-modal">
                {product.discountPrice ? (
                  <span className="product-price-original">{formatCurrency(product.price)}</span>
                ) : null}
                <p className="product-modal-price">{formatCurrency(effectivePrice)}</p>
                {discountPercentage ? <span className="product-discount-badge">-{discountPercentage}%</span> : null}
              </div>
            </div>

            <p className="product-modal-description">{product.description}</p>

            {product.variantGroups.length > 0 ? (
              <div className="product-modal-variants">
                {product.variantGroups.map((group) => (
                  <div key={group.name} className="product-variant-group">
                    <label className="product-modal-label">{group.name}</label>
                    <div className="variant-chips">
                      {group.options.map((option) => {
                        const isColorOption = isColorVariantGroup(group.name) && isHexColor(option);

                        return (
                          <button
                            key={option}
                            type="button"
                            className={`variant-chip ${isColorOption ? "variant-chip-color" : ""} ${selectedOptions[group.name] === option ? "active" : ""}`}
                            onClick={() =>
                              setSelectedOptions((current) => ({ ...current, [group.name]: option }))
                            }
                            aria-label={isColorOption ? `Elegir color ${option}` : undefined}
                            title={isColorOption ? option : undefined}
                          >
                            {isColorOption ? (
                              <span className="color-swatch" style={{ backgroundColor: option }} aria-hidden="true" />
                            ) : (
                              option
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="product-modal-quantity">
              <label className="product-modal-label">Cantidad</label>
              <div className="qty-control">
                <button
                  type="button"
                  className="qty-btn"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                >
                  −
                </button>
                <span className="qty-value">{quantity}</span>
                <button
                  type="button"
                  className="qty-btn"
                  onClick={() => setQuantity((q) => q + 1)}
                >
                  +
                </button>
              </div>
            </div>

            <div className="product-modal-footer">
              <p className="product-modal-subtotal">
                Subtotal: <strong>{formatCurrency(effectivePrice * quantity)}</strong>
              </p>
              <button
                className={`add-to-cart-btn ${added ? "added" : ""}`}
                type="button"
                onClick={handleAdd}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></svg>
                {added ? "¡Agregado!" : "Agregar al carrito"}
              </button>
              {added ? <p className="product-modal-feedback">Se guardó en tu carrito y podés seguir explorando.</p> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
