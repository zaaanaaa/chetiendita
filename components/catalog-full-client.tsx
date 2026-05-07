"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { CartDrawer } from "@/components/cart-drawer";
import { CheckoutModal } from "@/components/checkout-modal";
import { HeaderShell } from "@/components/header-shell";
import { LoginPanel } from "@/components/login-panel";
import { ProductModal } from "@/components/product-modal";
import { Product, Tag, User } from "@/lib/types";

interface CatalogFullClientProps {
  initialProducts: Product[];
  tags: Tag[];
  user: User | null;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

export function CatalogFullClient({ initialProducts, tags, user }: CatalogFullClientProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [loginOpen, setLoginOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return initialProducts.filter((product) => {
      const matchesQuery =
        !normalizedQuery ||
        product.name.toLowerCase().includes(normalizedQuery) ||
        product.description.toLowerCase().includes(normalizedQuery);
      const matchesTag = !selectedTag || product.tags.includes(selectedTag);
      return matchesQuery && matchesTag;
    });
  }, [initialProducts, query, selectedTag]);

  useEffect(() => {
    const anyOpen = loginOpen || cartOpen || checkoutOpen || !!selectedProduct;
    if (anyOpen) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }
    return () => { document.body.classList.remove("modal-open"); };
  }, [loginOpen, cartOpen, checkoutOpen, selectedProduct]);

  function handleLogout() {
    startTransition(async () => {
      await fetch("/api/auth/logout", { method: "POST" });
      router.refresh();
    });
  }

  return (
    <>
      <HeaderShell
        user={user}
        onLoginClick={() => setLoginOpen(true)}
        onLogoutClick={user ? handleLogout : undefined}
        onCartClick={() => setCartOpen(true)}
        hideHero
      />

      <main className="page-shell">
        <div className="catalog-page-header">
          <div>
            <p className="section-overline">Catálogo completo</p>
            <h1>Todos nuestros productos</h1>
            <p className="catalog-page-subtitle">
              Explorá nuestra colección completa. Usá los filtros para encontrar lo que buscás.
            </p>
          </div>
        </div>

        <section className="catalog-section">
          <div className="catalog-header">
            <div className="filters-panel filters-panel-wide">
              <div className="filter-input-wrap">
                <svg className="filter-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar productos..."
                  className="filter-input"
                />
              </div>
              <select value={selectedTag} onChange={(event) => setSelectedTag(event.target.value)} className="filter-select">
                <option value="">Todas las categorías</option>
                {tags.map((tag) => (
                  <option key={tag.id} value={tag.name}>
                    {tag.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="results-row">
            <p>{filteredProducts.length} producto(s)</p>
            {isPending ? <span className="session-pill">Actualizando...</span> : null}
          </div>

          {filteredProducts.length === 0 ? (
            <div className="empty-state">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.3"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <h3>No encontramos productos</h3>
              <p>Probá limpiando la búsqueda o explorando otra categoría.</p>
            </div>
          ) : (
            <div className="catalog-grid">
              {filteredProducts.map((product) => (
                <article
                  key={product.id}
                  className="product-card"
                  onClick={() => setSelectedProduct(product)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && setSelectedProduct(product)}
                >
                  <div className="product-img-wrap">
                    <div
                      className="product-img"
                      style={{ backgroundImage: `url(${product.image})` }}
                    />
                    {product.featured && <span className="featured-dot">Destacado</span>}
                  </div>
                  <div className="product-body">
                    <h3 className="product-name">{product.name}</h3>
                    <p className="product-price">{formatCurrency(product.price)}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      <LoginPanel open={loginOpen} onClose={() => setLoginOpen(false)} />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} onCheckout={() => setCheckoutOpen(true)} />
      <CheckoutModal open={checkoutOpen} onClose={() => setCheckoutOpen(false)} />
      {selectedProduct && (
        <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      )}
    </>
  );
}
