"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { CartDrawer } from "@/components/cart-drawer";
import { CheckoutModal } from "@/components/checkout-modal";
import { HeaderShell } from "@/components/header-shell";
import { LoginPanel } from "@/components/login-panel";
import { ProductModal } from "@/components/product-modal";
import { VariantDisplay } from "@/components/variant-display";
import { Order, Product, User } from "@/lib/types";

interface UserOrdersClientProps {
  user: User;
  orders: Order[];
}

const STATUS_LABELS = {
  pending: "Pendiente",
  accepted: "Aceptado",
  modified: "Modificado",
  rejected: "Rechazado",
} as const;

const STATUS_COLORS = {
  pending: "badge-pending",
  accepted: "badge-accepted",
  modified: "badge-modified",
  rejected: "badge-rejected",
} as const;

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

function getOrderUnitCount(order: Order) {
  return order.items.reduce((total, item) => total + item.quantity, 0);
}

export function UserOrdersClient({ user, orders }: UserOrdersClientProps) {
  const router = useRouter();
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "resolved">("pending");
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(orders[0]?.id ?? null);
  const [, startTransition] = useTransition();

  const pendingOrders = useMemo(
    () => orders.filter((order) => order.status === "pending"),
    [orders],
  );
  const resolvedOrders = useMemo(
    () => orders.filter((order) => order.status !== "pending"),
    [orders],
  );

  useEffect(() => {
    const anyOpen = cartOpen || checkoutOpen || loginOpen || !!selectedProduct;
    if (anyOpen) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }

    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [cartOpen, checkoutOpen, loginOpen, selectedProduct]);

  function handleLogout() {
    startTransition(async () => {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    });
  }

  function toggleOrder(orderId: number) {
    setExpandedOrderId((current) => (current === orderId ? null : orderId));
  }

  function cancelOrder(orderId: number) {
    startTransition(async () => {
      const response = await fetch(`/api/orders/${orderId}`, { method: "DELETE" });
      if (!response.ok) {
        return;
      }

      router.refresh();
    });
  }

  return (
    <>
      <HeaderShell
        user={user}
        onLoginClick={() => setLoginOpen(true)}
        onLogoutClick={handleLogout}
        onCartClick={() => setCartOpen(true)}
      />

      <main className="page-shell storefront-shell">
        <section className="catalog-page-header">
          <div>
            <p className="section-overline">Mi cuenta</p>
            <h1>Mis pedidos</h1>
            <p className="catalog-page-subtitle">
              Seguís el estado de cada pedido, ves el detalle cargado y consultás el total confirmado desde un solo lugar.
            </p>
          </div>
        </section>

        <section className="user-orders-layout">
          <div className="orders-tabs">
            <button 
              className={`orders-tab ${activeTab === "pending" ? "active" : ""}`}
              type="button"
              onClick={() => setActiveTab("pending")}
            >
              <span className="orders-tab-label">Pendientes de confirmar</span>
              <span className="orders-tab-count">{pendingOrders.length}</span>
            </button>
            <button 
              className={`orders-tab ${activeTab === "resolved" ? "active" : ""}`}
              type="button"
              onClick={() => setActiveTab("resolved")}
            >
              <span className="orders-tab-label">Historial de pedidos</span>
              <span className="orders-tab-count">{resolvedOrders.length}</span>
            </button>
          </div>

          {activeTab === "pending" && (
            <section className="admin-panel">
              <div className="panel-heading">
                <div>
                  <p className="section-overline">Pendientes</p>
                  <h2>Pendientes de confirmar</h2>
                </div>
              </div>

              {pendingOrders.length === 0 ? (
                <div className="empty-state">
                  <h3>No tenés pedidos pendientes</h3>
                  <p>Cuando generes un pedido nuevo, va a aparecer acá con su estado.</p>
                </div>
              ) : (
                <div className="orders-list">
                  {pendingOrders.map((order) => (
                    <article key={order.id} className="order-card order-card-static order-card-history order-card-collapsible">
                      <div className="order-card-main">
                        <div className="order-card-header">
                          <h3>Pedido #{order.id}</h3>
                          <span className={`order-badge ${STATUS_COLORS[order.status]}`}>
                            {STATUS_LABELS[order.status]}
                          </span>
                        </div>
                        <p className="order-date">
                          {new Date(order.createdAt).toLocaleDateString("es-AR", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                        {order.notes ? <p className="order-customer">Notas: {order.notes}</p> : null}
                      </div>
                      <div className="order-card-total">
                        <span>{getOrderUnitCount(order)} item(s)</span>
                        <strong>{formatCurrency(order.total)}</strong>
                      </div>
                      <div className="order-card-actions-compact">
                        <button className="secondary-button secondary-button-sm" type="button" onClick={() => toggleOrder(order.id)}>
                          {expandedOrderId === order.id ? "Ocultar detalle" : "Ver detalle"}
                        </button>
                        <button className="danger-button danger-button-sm" type="button" onClick={() => cancelOrder(order.id)}>
                          Cancelar pedido
                        </button>
                      </div>
                      {expandedOrderId === order.id ? (
                        <div className="order-history-items">
                          {order.items.map((item) => (
                            <div key={item.id} className="order-history-item">
                              <div className="order-item-img" style={{ backgroundImage: `url(${item.image})` }} />
                              <div>
                                <h4>{item.productName}</h4>
                                {item.variant ? <p><VariantDisplay value={item.variant} /></p> : null}
                                <p className="order-history-item-price">{formatCurrency(item.unitPrice)} c/u</p>
                              </div>
                              <div className="order-history-item-meta">
                                <span>{item.quantity}x</span>
                                <strong>{formatCurrency(item.unitPrice * item.quantity)}</strong>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {activeTab === "resolved" && (
            <section className="admin-panel">
              <div className="panel-heading">
                <div>
                  <p className="section-overline">Listos</p>
                  <h2>Historial de pedidos</h2>
                </div>
              </div>

              {resolvedOrders.length === 0 ? (
                <div className="empty-state">
                  <h3>Todavía no hay pedidos listos</h3>
                  <p>Los pedidos aceptados o rechazados van a aparecer en este módulo.</p>
                </div>
              ) : (
                <div className="orders-list">
                  {resolvedOrders.map((order) => (
                    <article key={order.id} className="order-card order-card-static order-card-history order-card-collapsible">
                      <div className="order-card-main">
                        <div className="order-card-header">
                          <h3>Pedido #{order.id}</h3>
                          <span className={`order-badge ${STATUS_COLORS[order.status]}`}>
                            {STATUS_LABELS[order.status]}
                          </span>
                        </div>
                        <p className="order-date">
                          {new Date(order.createdAt).toLocaleDateString("es-AR", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <div className="order-card-total">
                        <span>{getOrderUnitCount(order)} item(s)</span>
                        <strong>{formatCurrency(order.total)}</strong>
                      </div>
                      <button className="secondary-button secondary-button-sm" type="button" onClick={() => toggleOrder(order.id)}>
                        {expandedOrderId === order.id ? "Ocultar detalle" : "Ver detalle"}
                      </button>
                      {expandedOrderId === order.id ? (
                        <div className="order-history-items">
                          {order.items.map((item) => (
                            <div key={item.id} className="order-history-item">
                              <div className="order-item-img" style={{ backgroundImage: `url(${item.image})` }} />
                              <div>
                                <h4>{item.productName}</h4>
                                {item.variant ? <p><VariantDisplay value={item.variant} /></p> : null}
                                <p className="order-history-item-price">{formatCurrency(item.unitPrice)} c/u</p>
                              </div>
                              <div className="order-history-item-meta">
                                <span>{item.quantity}x</span>
                                <strong>{formatCurrency(item.unitPrice * item.quantity)}</strong>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
        </section>
      </main>

      <LoginPanel open={loginOpen} onClose={() => setLoginOpen(false)} />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} onCheckout={() => setCheckoutOpen(true)} />
      <CheckoutModal open={checkoutOpen} onClose={() => setCheckoutOpen(false)} />
      {selectedProduct ? <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} /> : null}
    </>
  );
}
