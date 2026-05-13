"use client";

import { useEffect, useMemo, useState } from "react";

import { useCart } from "@/components/cart-context";
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

export function ProductModal({ product, onClose }: ProductModalProps) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const effectivePrice = getEffectivePrice(product);
  const discountPercentage = getDiscountPercentage(product);

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
      image: product.images[selectedImageIndex] || product.image,
      quantity,
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1600);
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
            <div className="product-modal-media-frame">
              <img
                src={product.images[selectedImageIndex] || product.image}
                alt={product.name}
                className="product-modal-media-tag"
              />
            </div>

            {product.images.length > 1 ? (
              <>
                <div className="product-gallery-controls">
                  <button
                    type="button"
                    className="gallery-nav-btn"
                    onClick={() =>
                      setSelectedImageIndex((current) =>
                        current === 0 ? product.images.length - 1 : current - 1,
                      )
                    }
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="gallery-nav-btn"
                    onClick={() =>
                      setSelectedImageIndex((current) => (current + 1) % product.images.length)
                    }
                  >
                    ›
                  </button>
                </div>

                <div className="product-gallery-strip">
                  {product.images.map((image, index) => (
                    <button
                      key={`${image}-${index}`}
                      type="button"
                      className={`gallery-thumb ${selectedImageIndex === index ? "active" : ""}`}
                      onClick={() => setSelectedImageIndex(index)}
                    >
                      <img src={image} alt={`${product.name} ${index + 1}`} className="gallery-thumb-tag" />
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>

          <div className="product-modal-info">
            <div className="product-modal-header">
              {product.tags.length > 0 ? (
                <div className="tag-row">
                  {product.tags.map((tag) => (
                    <span key={tag} className="tag-chip">{tag}</span>
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
                      {group.options.map((option) => (
                        <button
                          key={option}
                          type="button"
                          className={`variant-chip ${selectedOptions[group.name] === option ? "active" : ""}`}
                          onClick={() =>
                            setSelectedOptions((current) => ({ ...current, [group.name]: option }))
                          }
                        >
                          {option}
                        </button>
                      ))}
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
