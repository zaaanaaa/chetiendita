"use client";

import { useState, useTransition } from "react";

import { useCart } from "@/components/cart-context";

interface CheckoutModalProps {
  open: boolean;
  onClose: () => void;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

const WHATSAPP_NUMBER = "5493515523846";

export function CheckoutModal({ open, onClose }: CheckoutModalProps) {
  const { items, totalPrice, clearCart } = useCart();
  const [step, setStep] = useState<"summary" | "success">("summary");
  const [createdOrderId, setCreatedOrderId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  if (!open) return null;

  function handleClose() {
    if (step === "success") {
      setStep("summary");
      setMessage("");
      setCreatedOrderId(null);
    }
    onClose();
  }

  function handleSubmit() {
    setMessage("");

    if (items.length === 0) {
      setMessage("Tu carrito está vacío.");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: items.map((item) => ({
              productId: item.productId,
              productName: item.productName,
              variant: item.variant,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              image: item.image,
            })),
          }),
        });

        if (!response.ok) {
          setMessage("No se pudo procesar tu pedido. Intentá de nuevo.");
          return;
        }

        const data = (await response.json().catch(() => null)) as { order?: { id: number } } | null;
        clearCart();
        setCreatedOrderId(data?.order?.id ?? null);
        setStep("success");
      } catch {
        setMessage("Error de conexión. Intentá de nuevo.");
      }
    });
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={handleClose}>
      <div
        className="modal-card modal-card-checkout"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close-btn" type="button" onClick={handleClose} aria-label="Cerrar">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>

        {step === "summary" ? (
          <>
            <div className="checkout-header">
              <p className="section-overline">Checkout</p>
              <h2>Finalizar compra</h2>
              <p className="checkout-helper-text">
                Revisá el resumen y confirmá el pedido. La coordinación sigue por WhatsApp.
              </p>
            </div>

            <div className="checkout-summary">
              <h3>Resumen del pedido</h3>
              <div className="checkout-items-list">
                {items.map((item) => (
                  <div key={`${item.productId}-${item.variant}`} className="checkout-item-row">
                    <span className="checkout-item-name">
                      {item.quantity}× {item.productName}
                      {item.variant ? ` (${item.variant})` : ""}
                    </span>
                    <span className="checkout-item-price">
                      {formatCurrency(item.unitPrice * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="checkout-total-row">
                <strong>Total</strong>
                <strong>{formatCurrency(totalPrice)}</strong>
              </div>
            </div>

            {message ? <p className="checkout-error">{message}</p> : null}

            <button className="checkout-submit-btn" type="button" disabled={isPending} onClick={handleSubmit}>
              {isPending ? "Procesando..." : "Finalizar pedido"}
            </button>
          </>
        ) : (
          <div className="checkout-success">
            <div className="checkout-success-icon">
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
            </div>
            <h2>¡Pedido confirmado!</h2>
            {createdOrderId ? <p className="checkout-order-reference">Referencia: pedido #{createdOrderId}</p> : null}
            <p>Tu pedido fue recibido. Para coordinar el pago y la entrega, comunicate por WhatsApp:</p>
            <a
              className="whatsapp-btn"
              href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Hola! Acabo de hacer un pedido en Che Tiendita y quiero coordinar el pago.")}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
              Coordinar por WhatsApp
            </a>
            <p className="whatsapp-number-text">
              O escribinos directamente al <strong>+54 9 3515523846</strong>
            </p>
            <button className="secondary-button" type="button" onClick={handleClose} style={{ marginTop: "0.75rem", width: "100%" }}>
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
