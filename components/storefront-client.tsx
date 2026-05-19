"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState, useTransition } from "react";
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
  heroImages: string[];
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

function isDiscountedProduct(product: Product) {
  return product.discountPrice !== null && product.discountPrice < product.price;
}

function getProductSnippet(description: string) {
  const clean = description.trim();
  if (clean.length <= 108) {
    return clean;
  }

  return `${clean.slice(0, 105).trimEnd()}...`;
}

function ProductCard({
  product,
  onOpen,
  onTagFilter,
}: {
  product: Product;
  onOpen: () => void;
  onTagFilter: (tag: string) => void;
}) {
  const [imageIndex, setImageIndex] = useState(0);

  useEffect(() => {
    setImageIndex(0);
  }, [product.id]);

  useEffect(() => {
    if (product.images.length < 2) {
      return;
    }

    const timer = window.setInterval(() => {
      setImageIndex((current) => (current + 1) % product.images.length);
    }, 4000);

    return () => window.clearInterval(timer);
  }, [product.images]);

  const effectivePrice = getEffectivePrice(product);
  const discountPercentage = getDiscountPercentage(product);

  return (
    <article
      className="product-card"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="product-img-wrap">
        <div className="product-img-frame">
          <img
            src={product.images[imageIndex] || product.image}
            alt={product.name}
            className="product-img-tag"
          />
        </div>
        {product.featured ? <span className="featured-dot">Destacado</span> : null}
        {discountPercentage ? <span className="discount-dot">-{discountPercentage}%</span> : null}
      </div>

      <div className="product-body product-body-stretch">
        <div className="product-card-copy">
          <div className="product-card-heading">
            <h3 className="product-name">{product.name}</h3>
            <div className="product-price-stack">
              {product.discountPrice ? (
                <span className="product-price-original">{formatCurrency(product.price)}</span>
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
                  onTagFilter(tag);
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
}

export function StorefrontClient({ initialProducts, tags, user, mode, heroImages }: StorefrontClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [selectedTag, setSelectedTag] = useState(searchParams.get("tag") || "");
  const [loginOpen, setLoginOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [heroEditorOpen, setHeroEditorOpen] = useState(false);
  const [heroDraftImages, setHeroDraftImages] = useState(heroImages);
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroPreviousIndex, setHeroPreviousIndex] = useState<number | null>(null);
  const [heroAnimating, setHeroAnimating] = useState(false);
  const [heroMessage, setHeroMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const canEditHero = user?.role === "admin";
  const filterMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setQuery(searchParams.get("q") || "");
    setSelectedTag(searchParams.get("tag") || "");
  }, [searchParams]);

  useEffect(() => {
    setFilterMenuOpen(false);
  }, [selectedTag, pathname, searchParams]);

  useEffect(() => {
    if (!filterMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!filterMenuRef.current?.contains(event.target as Node)) {
        setFilterMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setFilterMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [filterMenuOpen]);

  useEffect(() => {
    setHeroDraftImages(heroImages);
  }, [heroImages]);

  useEffect(() => {
    setHeroIndex(0);
    setHeroPreviousIndex(null);
    setHeroAnimating(false);
  }, [heroDraftImages.length]);

  useEffect(() => {
    if (heroImages.length < 2) {
      return;
    }

    const timer = window.setInterval(() => {
      setHeroIndex((current) => {
        setHeroPreviousIndex(current);
        setHeroAnimating(true);
        return (current + 1) % heroImages.length;
      });
    }, 4500);

    return () => window.clearInterval(timer);
  }, [heroImages]);

  useEffect(() => {
    if (!heroAnimating) {
      return;
    }

    const timer = window.setTimeout(() => {
      setHeroAnimating(false);
      setHeroPreviousIndex(null);
    }, 850);

    return () => window.clearTimeout(timer);
  }, [heroAnimating]);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return initialProducts.filter((product) => {
      const matchesQuery =
        !normalizedQuery ||
        product.name.toLowerCase().includes(normalizedQuery) ||
        product.description.toLowerCase().includes(normalizedQuery);
      const matchesTag =
        !selectedTag ||
        (selectedTag === "descuento" ? isDiscountedProduct(product) : product.tags.includes(selectedTag));
      return matchesQuery && matchesTag;
    });
  }, [initialProducts, query, selectedTag]);

  const displayProducts = mode === "home" ? filteredProducts.slice(0, LANDING_LIMIT) : filteredProducts;
  const hasMore = mode === "home" && filteredProducts.length > LANDING_LIMIT;
  const activeFilters = Number(query.trim().length > 0) + Number(Boolean(selectedTag));
  const selectedTagLabel = selectedTag || "Filtros";
  const highlightedTags = useMemo(() => {
    const discountTag = tags.find((tag) => tag.name === "descuento");
    const remainingTags = tags.filter((tag) => tag.name !== "descuento");
    return discountTag ? [discountTag, ...remainingTags].slice(0, 8) : tags.slice(0, 8);
  }, [tags]);

  useEffect(() => {
    const anyOpen = loginOpen || cartOpen || checkoutOpen || !!selectedProduct || heroEditorOpen;
    if (anyOpen) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }

    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [loginOpen, cartOpen, checkoutOpen, selectedProduct, heroEditorOpen]);

  function handleHeroUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) {
      return;
    }

    Promise.all(
      files.map(
        (file) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
            reader.readAsDataURL(file);
          }),
      ),
    ).then((encodedImages) => {
      setHeroDraftImages((current) =>
        Array.from(new Set([...current, ...encodedImages.filter(Boolean)])),
      );
    });
  }

  function removeHeroImage(index: number) {
    setHeroDraftImages((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  function saveHeroImages() {
    setHeroMessage("");
    startTransition(async () => {
      const response = await fetch("/api/hero", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: heroDraftImages }),
      });

      if (!response.ok) {
        setHeroMessage("No se pudieron guardar las imágenes del hero.");
        return;
      }

      setHeroEditorOpen(false);
      router.refresh();
    });
  }

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

  function applyTagFilter(tag: string) {
    setFilterMenuOpen(false);
    if (mode === "home") {
      if (!tag) {
        router.push("/catalogo");
        return;
      }

      router.push(`/catalogo?tag=${encodeURIComponent(tag)}`);
      return;
    }

    setSelectedTag(tag);
    updateFilters({ tag });
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
            <div
              className={`storefront-hero-copy storefront-hero-copy-full ${heroImages.length > 0 ? "storefront-hero-carousel" : ""}`}
            >
              {heroImages.length > 0 ? (
                <div className="hero-carousel-media" aria-hidden="true">
                  {heroPreviousIndex !== null ? (
                    <img
                      src={heroImages[heroPreviousIndex]}
                      alt=""
                      className={`hero-carousel-image hero-carousel-image-previous ${
                        heroAnimating ? "is-animating" : ""
                      }`}
                    />
                  ) : null}
                  <img
                    src={heroImages[heroIndex]}
                    alt=""
                    className={`hero-carousel-image hero-carousel-image-current ${
                      heroAnimating ? "is-animating" : ""
                    }`}
                  />
                </div>
              ) : null}
              {canEditHero ? (
                <button
                  type="button"
                  className="secondary-button hero-edit-btn"
                  onClick={() => setHeroEditorOpen(true)}
                >
                  editar
                </button>
              ) : null}
              {heroImages.length === 0 ? (
                <>
                  <h1 className="storefront-hero-title">
                    Todo lo que buscas.
                    <br />
                    Y lo que no sabías que querías!
                  </h1>
                  <div className="storefront-hero-actions">
                    <a href="#catalogo" className="primary-button">
                      Explorar productos
                    </a>
                    <Link href="/catalogo" className="secondary-button">
                      Ver catálogo completo
                    </Link>
                  </div>
                </>
              ) : null}
              {heroImages.length > 1 ? (
                <div className="hero-carousel-dots">
                  {heroImages.map((image, index) => (
                    <button
                      key={`${image}-${index}`}
                      type="button"
                      className={`hero-carousel-dot ${heroIndex === index ? "active" : ""}`}
                      onClick={() => {
                        if (index === heroIndex) {
                          return;
                        }

                        setHeroPreviousIndex(heroIndex);
                        setHeroAnimating(true);
                        setHeroIndex(index);
                      }}
                      aria-label={`Ver imagen ${index + 1}`}
                    />
                  ))}
                </div>
              ) : null}
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

        <section className="catalog-section catalog-section-elevated" id="catalogo">
          <div className="catalog-toolbar storefront-toolbar">
            <div>
              <p className="section-overline">{mode === "home" ? "Catálogo" : "Explorar"}</p>
              <h2>{mode === "home" ? "Productos para mirar con ganas" : "Encontrá el producto indicado"}</h2>
              <p className="catalog-intro">
                {mode === "home"
                  ? "La portada muestra una selección corta y útil, pero las etiquetas ya te llevan al catálogo filtrado completo."
                  : "Cada tarjeta deja filtrar por etiqueta, comparar precios y entrar al detalle sin que el layout se desarme."}
              </p>
            </div>

            <div className="filters-panel">
              <label className="filter-input-wrap">
                <svg className="filter-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => handleSearchChange(event.target.value)}
                  placeholder="Buscar por nombre o descripción"
                  className="filter-input"
                  aria-label="Buscar productos"
                />
              </label>

              <div className="filter-select-shell" ref={filterMenuRef}>
                <button
                  type="button"
                  className={`filter-select ${filterMenuOpen ? "open" : ""} ${selectedTag ? "has-value" : ""}`}
                  aria-label="Filtros"
                  aria-haspopup="listbox"
                  aria-expanded={filterMenuOpen}
                  onClick={() => setFilterMenuOpen((current) => !current)}
                >
                  <span>{selectedTagLabel}</span>
                </button>

                {filterMenuOpen ? (
                  <div className="filter-select-menu" role="listbox" aria-label="Opciones de filtros">
                    {selectedTag ? (
                      <button
                        type="button"
                        className="filter-select-option filter-select-option-clear"
                        onClick={() => applyTagFilter("")}
                      >
                        Todas las categorías
                      </button>
                    ) : null}
                    {tags.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        className={`filter-select-option ${selectedTag === tag.name ? "active" : ""}`}
                        onClick={() => applyTagFilter(tag.name)}
                      >
                        {tag.name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
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
                {displayProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onOpen={() => setSelectedProduct(product)}
                    onTagFilter={handleTagFilter}
                  />
                ))}
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
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        onCheckout={() => {
          if (!user) {
            setLoginOpen(true);
            return;
          }
          setCheckoutOpen(true);
        }}
        checkoutLabel={user ? "Finalizar compra" : "Ingresar para comprar"}
      />
      <CheckoutModal open={checkoutOpen} onClose={() => setCheckoutOpen(false)} />
      {selectedProduct ? <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} /> : null}
      {heroEditorOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setHeroEditorOpen(false)}>
          <div className="modal-card modal-card-editor modal-card-editor-wide" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="section-overline">Landing</p>
                <h2>Editar carrusel del hero</h2>
              </div>
              <button className="icon-button" type="button" onClick={() => setHeroEditorOpen(false)} aria-label="Cerrar">
                ×
              </button>
            </div>

            <div className="stack-form">
              <label className="file-upload-field file-upload-field-multi">
                <span>Subir imágenes desde tu dispositivo</span>
                <input type="file" accept="image/*" multiple onChange={handleHeroUpload} />
                <strong>Seleccionar archivos</strong>
              </label>

              {heroDraftImages.length > 0 ? (
                <div className="editor-gallery-grid">
                  {heroDraftImages.map((image, index) => (
                    <div key={`${image}-${index}`} className="editor-gallery-card">
                      <div className="editor-image-preview-media hero-editor-preview" style={{ backgroundImage: `url(${image})` }} />
                      <button className="danger-button" type="button" onClick={() => removeHeroImage(index)}>
                        Eliminar
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <h3>Sin imágenes cargadas</h3>
                  <p>Si dejás este listado vacío, se volverá a mostrar el hero actual.</p>
                </div>
              )}

              <div className="inline-actions">
                <button className="primary-button" type="button" onClick={saveHeroImages} disabled={isPending}>
                  Guardar hero
                </button>
                <button className="secondary-button" type="button" onClick={() => setHeroEditorOpen(false)}>
                  Cancelar
                </button>
              </div>
              <p className={`feedback ${heroMessage ? "visible" : ""}`}>{heroMessage}</p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
