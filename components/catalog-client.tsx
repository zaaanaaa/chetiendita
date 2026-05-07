"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { HeaderShell } from "@/components/header-shell";
import { LoginPanel } from "@/components/login-panel";
import { Product, Tag, User } from "@/lib/types";

interface CatalogClientProps {
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

export function CatalogClient({ initialProducts, tags, user }: CatalogClientProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [loginOpen, setLoginOpen] = useState(false);
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
      />

      <main className="page-shell">
        <section className="catalog-section catalog-section-elevated" id="catalogo">
          <div className="catalog-toolbar">
            <div>
              <p className="section-overline">Catalogo</p>
              <h2>Encontrar algo lindo ahora es mas facil.</h2>
              <p className="catalog-intro">
                Un recorrido mas limpio, con mejor lectura y productos pensados para mirar con calma.
              </p>
            </div>
            <div className="filters-panel">
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nombre o descripcion"
              />
              <select value={selectedTag} onChange={(event) => setSelectedTag(event.target.value)}>
                <option value="">Todos los atributos</option>
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
            {isPending ? <span className="session-pill">Actualizando sesion...</span> : null}
          </div>

          {filteredProducts.length === 0 ? (
            <div className="empty-state">
              <h3>No encontramos productos con ese filtro.</h3>
              <p>Proba limpiando la busqueda o explorando otra categoria.</p>
            </div>
          ) : (
            <div className="catalog-grid">
              {filteredProducts.map((product) => (
                <article key={product.id} className="product-card">
                  <div className="product-media-wrap">
                    <div
                      className="product-media"
                      style={{ backgroundImage: `linear-gradient(rgba(29,20,14,.12), rgba(29,20,14,.12)), url(${product.image})` }}
                    />
                  </div>
                  <div className="product-body">
                    <div className="product-meta">
                      <h3>{product.name}</h3>
                      <strong>{formatCurrency(product.price)}</strong>
                    </div>
                    <p>{product.description}</p>
                    <div className="tag-row">
                      {product.tags.map((tag) => (
                        <span key={tag} className="tag-chip">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
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
                  <h3>Productos Únicos</h3>
                  <p>Selección cuidada de artículos exclusivos y de calidad</p>
                </div>
                <div className="feature-card">
                  <h3>Artesanía Local</h3>
                  <p>Apoyo directo a artesanos y diseñadores independientes</p>
                </div>
                <div className="feature-card">
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
              <div className="contact-message">
                <p>¿Tienes una pregunta? ¿Sugerencias? Nos encantaría escucharte.</p>
                <p>Envíanos un mensaje y nos pondremos en contacto lo antes posible.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <LoginPanel open={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
}
