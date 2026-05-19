"use client";

import { useCart } from "@/components/cart-context";
import { VariantDisplay } from "@/components/variant-display";

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  onCheckout: () => void;
  checkoutLabel?: string;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

export function CartDrawer({
  open,
  onClose,
  onCheckout,
  checkoutLabel = "Finalizar compra",
}: CartDrawerProps) {
  const { items, totalItems, totalPrice, removeItem, updateQuantity, clearCart } = useCart();

  return (
    <>
      {open && (
        <div className="drawer-backdrop" role="presentation" onClick={onClose} />
      )}
      <aside className={`cart-drawer ${open ? "open" : ""}`} aria-label="Carrito de compras">
        <div className="drawer-header">
          <div>
            <div className="drawer-title-row">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
              <h2>Mi carrito</h2>
              <span className="drawer-count">{totalItems}</span>
            </div>
            <p className="drawer-subtitle">Revisá cantidades antes de confirmar tu pedido.</p>
          </div>
          <div className="drawer-header-actions">
            {items.length > 0 ? (
              <button className="text-button" type="button" onClick={clearCart}>
                Vaciar
              </button>
            ) : null}
            <button className="modal-close-btn" type="button" onClick={onClose} aria-label="Cerrar carrito">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="drawer-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.3"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
            <p>Tu carrito está vacío</p>
            <span>Explorá el catálogo y agregá productos</span>
            <button className="secondary-button" type="button" onClick={onClose}>
              Seguir mirando
            </button>
          </div>
        ) : (
          <>
            <div className="drawer-items">
              {items.map((item) => (
                <div key={`${item.productId}-${item.variant}`} className="drawer-item">
                  <div
                    className="drawer-item-img"
                    style={{ backgroundImage: `url(${item.image})` }}
                  />
                  <div className="drawer-item-info">
                    <h4>{item.productName}</h4>
                    {item.variant ? (
                      <span className="drawer-item-variant">
                        <VariantDisplay value={item.variant} />
                      </span>
                    ) : null}
                    <p className="drawer-item-price">{formatCurrency(item.unitPrice)}</p>
                    <div className="drawer-item-controls">
                      <div className="qty-control qty-control-sm">
                        <button
                          type="button"
                          className="qty-btn"
                          onClick={() => updateQuantity(item.productId, item.variant, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                        >
                          −
                        </button>
                        <span className="qty-value">{item.quantity}</span>
                        <button
                          type="button"
                          className="qty-btn"
                          onClick={() => updateQuantity(item.productId, item.variant, item.quantity + 1)}
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        className="drawer-item-remove"
                        onClick={() => removeItem(item.productId, item.variant)}
                        aria-label="Eliminar"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    </div>
                  </div>
                  <p className="drawer-item-total">{formatCurrency(item.unitPrice * item.quantity)}</p>
                </div>
              ))}
            </div>

            <div className="drawer-footer">
              <div className="drawer-trust-note">
                No cobramos online todavía: confirmás el pedido acá y coordinás el pago después.
              </div>
              <div className="drawer-total">
                <span>Total</span>
                <strong>{formatCurrency(totalPrice)}</strong>
              </div>
              <button
                className="checkout-btn"
                type="button"
                onClick={() => {
                  onClose();
                  onCheckout();
                }}
              >
                {checkoutLabel}
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
