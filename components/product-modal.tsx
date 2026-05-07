"use client";

import { useState } from "react";

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

export function ProductModal({ product, onClose }: ProductModalProps) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState(
    product.variants.length > 0 ? product.variants[0] : "",
  );
  const [added, setAdded] = useState(false);

  function handleAdd() {
    addItem({
      productId: product.id,
      productName: product.name,
      variant: selectedVariant,
      unitPrice: product.price,
      image: product.image,
      quantity,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
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
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>

        <div className="product-modal-layout">
          <div className="product-modal-image">
            <div
              className="product-modal-media"
              style={{ backgroundImage: `url(${product.image})` }}
            />
          </div>

          <div className="product-modal-info">
            <div className="product-modal-header">
              {product.tags.length > 0 && (
                <div className="tag-row">
                  {product.tags.map((tag) => (
                    <span key={tag} className="tag-chip">{tag}</span>
                  ))}
                </div>
              )}
              <h2>{product.name}</h2>
              <p className="product-modal-price">{formatCurrency(product.price)}</p>
            </div>

            <p className="product-modal-description">{product.description}</p>

            {product.variants.length > 0 && (
              <div className="product-modal-variants">
                <label className="product-modal-label">Modelo</label>
                <div className="variant-chips">
                  {product.variants.map((v) => (
                    <button
                      key={v}
                      type="button"
                      className={`variant-chip ${selectedVariant === v ? "active" : ""}`}
                      onClick={() => setSelectedVariant(v)}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            )}

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
                Subtotal: <strong>{formatCurrency(product.price * quantity)}</strong>
              </p>
              <button
                className={`add-to-cart-btn ${added ? "added" : ""}`}
                type="button"
                onClick={handleAdd}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                {added ? "¡Agregado!" : "Agregar al carrito"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
