import Link from "next/link";

import { User } from "@/lib/types";

interface HeaderShellProps {
  user: User | null;
  onLoginClick?: () => void;
  onLogoutClick?: () => void;
}

export function HeaderShell({ user, onLoginClick, onLogoutClick }: HeaderShellProps) {
  return (
    <header className="header-container">
      {/* Navigation Bar */}
      <nav className="navbar">
        <div className="navbar-content">
          <Link href="/" className="navbar-logo">
            <span className="logo-text">Che Tiendita</span>
          </Link>

          <div className="navbar-menu">
            <a href="#catalogo" className="nav-link active">
              Catálogo
            </a>
            <a href="#sobre-nosotros" className="nav-link">
              Sobre Nosotros
            </a>
            <a href="#contacto" className="nav-link">
              Contacto
            </a>
          </div>

          <div className="navbar-actions">
            {user?.role === "admin" && (
              <Link href="/admin" className="nav-button admin-button">
                Panel de Admin
              </Link>
            )}
            {user ? (
              <>
                <span className="user-info">{user.username}</span>
                <button
                  className="nav-button logout-button"
                  type="button"
                  onClick={onLogoutClick}
                >
                  Salir
                </button>
              </>
            ) : (
              <button className="nav-button login-button" type="button" onClick={onLoginClick}>
                Iniciar Sesión
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="hero-surface">
        <div className="hero-content">
          <div className="hero-copy">
            <p className="hero-kicker">Bienvenido a Che Tiendita</p>
            <h1 className="hero-title">Objetos lindos para regalar y ordenar</h1>
            <p className="hero-description">
              Descubre nuestra exclusiva colección de productos artesanales, perfectos para
              decorar tu hogar, regalar en ocasiones especiales o simplemente organizar tu espacio
              con estilo.
            </p>
            <button className="cta-button" type="button">
              Explorar Catálogo
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
