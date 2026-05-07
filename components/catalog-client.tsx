"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { CartDrawer } from "@/components/cart-drawer";
import { CheckoutModal } from "@/components/checkout-modal";
import { HeaderShell } from "@/components/header-shell";
import { LoginPanel } from "@/components/login-panel";
import { ProductModal } from "@/components/product-modal";
import { Product, Tag, User } from "@/lib/types";

interface CatalogClientProps {
  initialProducts: Product[];
  tags: Tag[];
  user: User | null;
}

const LANDING_LIMIT = 9;

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

export function CatalogClient({ initialProducts, tags, user }: CatalogClientProps) {
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

  const displayProducts = filteredProducts.slice(0, LANDING_LIMIT);
  const hasMore = filteredProducts.length > LANDING_LIMIT;

  // scroll lock
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
      />

      <main className="page-shell">
        <section className="catalog-section" id="catalogo">
          <div className="catalog-header">
            <div>
              <p className="section-overline">Catálogo</p>
              <h2>Nuestros productos</h2>
            </div>
            <div className="filters-panel">
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

          {displayProducts.length === 0 ? (
            <div className="empty-state">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.3"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <h3>No encontramos productos</h3>
              <p>Probá limpiando la búsqueda o explorando otra categoría.</p>
            </div>
          ) : (
            <>
              <div className="catalog-grid">
                {displayProducts.map((product) => (
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

              {hasMore && (
                <div className="catalog-more">
                  <Link href="/catalogo" className="catalog-more-btn">
                    Ver catálogo completo
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                  </Link>
                </div>
              )}
            </>
          )}
        </section>

        {/* About Section */}
        <section className="info-section" id="sobre-nosotros">
          <div className="section-content">
            <div className="section-header">
              <p className="section-overline">Sobre Nosotros</p>
              <h2>Quiénes Somos</h2>
            </div>
            <div className="section-body">
              <p>
                En Che Tiendita, creemos que cada objeto cuenta una historia. Nos dedicamos a curar
                una colección exclusiva de productos artesanales y de diseño, seleccionados con cuidado
                para traer belleza y funcionalidad a tu hogar.
              </p>
              <p>
                Trabajamos directamente con artesanos locales y diseñadores independientes para ofrecer
                piezas únicas que no encontrarás en otro lado. Cada producto en nuestro catálogo es elegido
                porque creemos que merece un lugar especial en tu vida.
              </p>
              <div className="features-grid">
                <div className="feature-card">
                  <div className="feature-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  </div>
                  <h3>Productos Únicos</h3>
                  <p>Selección cuidada de artículos exclusivos y de calidad</p>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                  </div>
                  <h3>Artesanía Local</h3>
                  <p>Apoyo directo a artesanos y diseñadores independientes</p>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                  </div>
                  <h3>Diseño Pensado</h3>
                  <p>Cada pieza combina estética, funcionalidad y propósito</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section className="info-section" id="contacto">
          <div className="section-content">
            <div className="section-header">
              <p className="section-overline">Contacto</p>
              <h2>Ponte en Contacto</h2>
            </div>
            <div className="section-body">
              <div className="contact-grid">
                <div className="contact-card">
                  <h3>Email</h3>
                  <p><a href="mailto:info@chetiendita.com">info@chetiendita.com</a></p>
                </div>
                <div className="contact-card">
                  <h3>Redes Sociales</h3>
                  <p>Síguenos en Instagram y Facebook para novedades</p>
                </div>
                <div className="contact-card">
                  <h3>Ubicación</h3>
                  <p>Córdoba, Argentina</p>
                </div>
              </div>
            </div>
          </div>
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
