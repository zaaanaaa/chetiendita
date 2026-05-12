import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="page-shell storefront-shell">
      <section className="catalog-page-header">
        <div>
          <p className="section-overline">404</p>
          <h1>No encontramos esa página</h1>
          <p className="catalog-page-subtitle">
            Podés volver a la tienda y seguir navegando desde el catálogo principal.
          </p>
          <div className="storefront-hero-actions">
            <Link href="/" className="primary-button">
              Ir al inicio
            </Link>
            <Link href="/catalogo" className="secondary-button">
              Ver catálogo
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
