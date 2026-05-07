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
        <section className="catalog-section catalog-section-elevated">
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
      </main>

      <LoginPanel open={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
}
