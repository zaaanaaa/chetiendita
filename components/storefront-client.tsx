"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { CartDrawer } from "@/components/cart-drawer";
import { CheckoutModal } from "@/components/checkout-modal";
import { HeaderShell } from "@/components/header-shell";
import { LoginPanel } from "@/components/login-panel";
import { ProductModal } from "@/components/product-modal";
import { Product, Tag, User } from "@/lib/types";

interface StorefrontClientProps {
  initialProducts: Product[];
  tags: Tag[];
  user: User | null;
  mode: "home" | "catalog";
}

const LANDING_LIMIT = 9;

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

function getProductSnippet(description: string) {
  const clean = description.trim();
  if (clean.length <= 108) {
    return clean;
  }

  return `${clean.slice(0, 105).trimEnd()}...`;
}

export function StorefrontClient({ initialProducts, tags, user, mode }: StorefrontClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [selectedTag, setSelectedTag] = useState(searchParams.get("tag") || "");
  const [loginOpen, setLoginOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setQuery(searchParams.get("q") || "");
    setSelectedTag(searchParams.get("tag") || "");
  }, [searchParams]);

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

  const displayProducts =
    mode === "home" ? filteredProducts.slice(0, LANDING_LIMIT) : filteredProducts;
  const hasMore = mode === "home" && filteredProducts.length > LANDING_LIMIT;
  const activeFilters = Number(query.trim().length > 0) + Number(Boolean(selectedTag));
  const highlightedTags = tags.slice(0, 8);

  useEffect(() => {
    const anyOpen = loginOpen || cartOpen || checkoutOpen || !!selectedProduct;
    if (anyOpen) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }

    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [loginOpen, cartOpen, checkoutOpen, selectedProduct]);

  function updateFilters(next: { q?: string; tag?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    const nextQuery = next.q ?? query;
    const nextTag = next.tag ?? selectedTag;

    if (nextQuery.trim()) {
      params.set("q", nextQuery.trim());
    } else {
      params.delete("q");
    }

    if (nextTag.trim()) {
      params.set("tag", nextTag.trim());
    } else {
      params.delete("tag");
    }

    const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }

  function clearFilters() {
    setQuery("");
    setSelectedTag("");
    updateFilters({ q: "", tag: "" });
  }

  function handleSearchChange(value: string) {
    setQuery(value);
    updateFilters({ q: value });
  }

  function handleTagFilter(tag: string) {
    if (mode === "home") {
      router.push(`/catalogo?tag=${encodeURIComponent(tag)}`);
      return;
    }

    const nextTag = selectedTag === tag ? "" : tag;
    setSelectedTag(nextTag);
    updateFilters({ tag: nextTag });
  }

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

      <main className="page-shell storefront-shell">
        {mode === "home" ? (
          <section className="storefront-hero storefront-hero-full">
            <div className="storefront-hero-copy storefront-hero-copy-full">
              <p className="hero-kicker">Objetos con oficio, color y carácter</p>
              <h1 className="storefront-hero-title">
                Una tienda pequeña con una experiencia mucho más clara y cálida.
              </h1>
              <p className="storefront-hero-description">
                Descubrí productos artesanales y de diseño con una navegación simple, filtros útiles y un checkout directo para cerrar tu pedido sin fricción.
              </p>
              <div className="storefront-hero-actions">
                <a href="#catalogo" className="primary-button">
                  Explorar productos
                </a>
                <Link href="/catalogo" className="secondary-button">
                  Ver catálogo completo
                </Link>
              </div>
            </div>
          </section>
        ) : (
          <section className="catalog-page-header">
            <div>
              <p className="section-overline">Catálogo completo</p>
              <h1>Todos nuestros productos en un solo lugar</h1>
              <p className="catalog-page-subtitle">
                Buscá por nombre, filtrá por categoría o tocá una etiqueta desde cualquier producto para ver todos los relacionados.
              </p>
            </div>
          </section>
        )}

        <section className="trust-strip" aria-label="Beneficios de compra">
          <div className="trust-pill">Selección curada</div>
          <div className="trust-pill">Carrito persistente</div>
          <div className="trust-pill">Pedido confirmado por WhatsApp</div>
        </section>

        <section className="catalog-section catalog-section-elevated" id="catalogo">
          <div className="catalog-toolbar storefront-toolbar">
            <div>
              <p className="section-overline">{mode === "home" ? "Catálogo" : "Explorar"}</p>
              <h2>
                {mode === "home" ? "Productos para mirar con ganas" : "Encontrá el producto indicado"}
              </h2>
              <p className="catalog-intro">
                {mode === "home"
                  ? "La portada muestra una selección corta y útil, pero las etiquetas ya te llevan al catálogo filtrado completo."
                  : "Cada tarjeta deja filtrar por etiqueta, comparar precios y entrar al detalle sin que el layout se desarme."}
              </p>
            </div>

            <div className="filters-panel">
              <label className="filter-input-wrap">
                <svg
                  className="filter-icon"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => handleSearchChange(event.target.value)}
                  placeholder="Buscar por nombre o descripción"
                  className="filter-input"
                  aria-label="Buscar productos"
                />
              </label>

              <select
                value={selectedTag}
                onChange={(event) => {
                  setSelectedTag(event.target.value);
                  updateFilters({ tag: event.target.value });
                }}
                className="filter-select"
                aria-label="Filtrar por categoría"
              >
                <option value="">Todas las categorías</option>
                {tags.map((tag) => (
                  <option key={tag.id} value={tag.name}>
                    {tag.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {highlightedTags.length > 0 ? (
            <div className="quick-filter-row" aria-label="Atajos por categoría">
              {highlightedTags.map((tag) => {
                const active = selectedTag === tag.name;

                return (
                  <button
                    key={tag.id}
                    type="button"
                    className={`quick-filter-chip ${active ? "active" : ""}`}
                    onClick={() => handleTagFilter(tag.name)}
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
          ) : null}

          <div className="results-row storefront-results-row">
            <p>
              {filteredProducts.length} resultado(s)
              {activeFilters > 0 ? ` · ${activeFilters} filtro(s) activo(s)` : ""}
            </p>

            <div className="results-actions">
              {activeFilters > 0 ? (
                <button type="button" className="text-button" onClick={clearFilters}>
                  Limpiar filtros
                </button>
              ) : null}
              {isPending ? <span className="catalog-status-pill">Actualizando...</span> : null}
            </div>
          </div>

          {displayProducts.length === 0 ? (
            <div className="empty-state storefront-empty-state">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.3"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <h3>No encontramos coincidencias</h3>
              <p>Probá con otra búsqueda o limpiá los filtros para volver a ver toda la colección.</p>
              <button type="button" className="secondary-button" onClick={clearFilters}>
                Limpiar y volver a empezar
              </button>
            </div>
          ) : (
            <>
              <div className="catalog-grid storefront-grid">
                {displayProducts.map((product) => {
                  const effectivePrice = getEffectivePrice(product);
                  const discountPercentage = getDiscountPercentage(product);

                  return (
                    <article
                      key={product.id}
                      className="product-card"
                      onClick={() => setSelectedProduct(product)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedProduct(product);
                        }
                      }}
                    >
                      <div className="product-img-wrap">
                        <div
                          className="product-img"
                          style={{ backgroundImage: `url(${product.image})` }}
                        />
                        {product.featured ? <span className="featured-dot">Destacado</span> : null}
                        {discountPercentage ? (
                          <span className="discount-dot">-{discountPercentage}%</span>
                        ) : null}
                      </div>

                      <div className="product-body product-body-stretch">
                        <div className="product-card-copy">
                          <div className="product-card-heading">
                            <h3 className="product-name">{product.name}</h3>
                            <div className="product-price-stack">
                              {product.discountPrice ? (
                                <span className="product-price-original">
                                  {formatCurrency(product.price)}
                                </span>
                              ) : null}
                              <p className="product-price">{formatCurrency(effectivePrice)}</p>
                            </div>
                          </div>
                          <p className="product-snippet">{getProductSnippet(product.description)}</p>
                        </div>

                        <div className="product-card-meta">
                          <div className="tag-row">
                            {product.tags.slice(0, 3).map((tag) => (
                              <button
                                key={tag}
                                type="button"
                                className="tag-chip tag-chip-action"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleTagFilter(tag);
                                }}
                              >
                                #{tag}
                              </button>
                            ))}
                          </div>
                          <span className="product-detail-hint">
                            {product.variantGroups.length > 0
                              ? `${product.variantGroups.length} categoría(s)`
                              : "Ver detalle"}
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {hasMore ? (
                <div className="catalog-more">
                  <Link href="/catalogo" className="catalog-more-btn">
                    Ver el catálogo completo
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                  </Link>
                </div>
              ) : null}
            </>
          )}
        </section>

        {mode === "home" ? (
          <>
            <section className="info-section" id="sobre-nosotros">
              <div className="section-content">
                <div className="section-header">
                  <p className="section-overline">Sobre nosotros</p>
                  <h2>Una tienda chica, una curaduría muy intencional</h2>
                </div>
                <div className="section-body">
                  <p>
                    Che Tiendita trabaja con productos artesanales y de diseño que necesitan una experiencia simple: ver bien, entender rápido y comprar sin ruido.
                  </p>
                  <div className="features-grid">
                    <article className="feature-card">
                      <div className="feature-icon">01</div>
                      <h3>Selección con criterio</h3>
                      <p>Menos ruido visual y más contexto para que cada producto tenga espacio para lucirse.</p>
                    </article>
                    <article className="feature-card">
                      <div className="feature-icon">02</div>
                      <h3>Navegación más clara</h3>
                      <p>Filtros visibles, tarjetas más informativas y una jerarquía que guía mejor cada paso.</p>
                    </article>
                    <article className="feature-card">
                      <div className="feature-icon">03</div>
                      <h3>Compra más directa</h3>
                      <p>El carrito y el checkout ahora explican mejor qué pasa antes y después del pedido.</p>
                    </article>
                  </div>
                </div>
              </div>
            </section>

            <section className="info-section" id="contacto">
              <div className="section-content">
                <div className="section-header">
                  <p className="section-overline">Contacto</p>
                  <h2>Seguimos la conversación donde te quede más cómodo</h2>
                </div>
                <div className="contact-grid">
                  <article className="contact-card">
                    <h3>Email</h3>
                    <p><a href="mailto:info@chetiendita.com">info@chetiendita.com</a></p>
                  </article>
                  <article className="contact-card">
                    <h3>WhatsApp</h3>
                    <p>Confirmación y coordinación directa del pedido después del checkout.</p>
                  </article>
                  <article className="contact-card">
                    <h3>Base local</h3>
                    <p>Córdoba, Argentina</p>
                  </article>
                </div>
              </div>
            </section>
          </>
        ) : null}
      </main>

      <LoginPanel open={loginOpen} onClose={() => setLoginOpen(false)} />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} onCheckout={() => setCheckoutOpen(true)} />
      <CheckoutModal open={checkoutOpen} onClose={() => setCheckoutOpen(false)} />
      {selectedProduct ? (
        <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      ) : null}
    </>
  );
}
