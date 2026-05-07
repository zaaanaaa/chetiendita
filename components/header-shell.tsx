"use client";

import { useState } from "react";
import Link from "next/link";

import { useCart } from "@/components/cart-context";
import { User } from "@/lib/types";

interface HeaderShellProps {
  user: User | null;
  onLoginClick?: () => void;
  onLogoutClick?: () => void;
  onCartClick?: () => void;
  hideHero?: boolean;
}

export function HeaderShell({ user, onLoginClick, onLogoutClick, onCartClick, hideHero }: HeaderShellProps) {
  const { totalItems } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="header-container">
      {/* Navigation Bar */}
      <nav className="navbar">
        <div className="navbar-content">
          <Link href="/" className="navbar-logo">
            <span className="logo-mark">CT</span>
            <span className="logo-text">Che Tiendita</span>
          </Link>

          <button
            className="mobile-menu-btn"
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menú"
          >
            <span className={`hamburger ${mobileOpen ? "open" : ""}`}>
              <span /><span /><span />
            </span>
          </button>

          <div className={`navbar-center ${mobileOpen ? "mobile-open" : ""}`}>
            <div className="navbar-menu">
              <Link href="/catalogo" className="nav-link">
                Catálogo
              </Link>
              <a href="/#sobre-nosotros" className="nav-link">
                Nosotros
              </a>
              <a href="/#contacto" className="nav-link">
                Contacto
              </a>
            </div>

            <div className="navbar-actions">
              {user?.role === "admin" && (
                <Link href="/admin" className="nav-btn nav-btn-ghost">
                  Admin
                </Link>
              )}
              {user ? (
                <>
                  <span className="nav-user-badge">{user.username}</span>
                  <button className="nav-btn nav-btn-ghost" type="button" onClick={onLogoutClick}>
                    Salir
                  </button>
                </>
              ) : (
                <button className="nav-btn nav-btn-outline" type="button" onClick={onLoginClick}>
                  Ingresar
                </button>
              )}
              <button
                className="cart-icon-btn"
                type="button"
                onClick={onCartClick}
                aria-label="Ver carrito"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                {totalItems > 0 && <span className="cart-badge">{totalItems}</span>}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Compact Hero */}
      {!hideHero && (
        <div className="hero-surface">
          <div className="hero-copy">
            <p className="hero-kicker">Bienvenido a Che Tiendita</p>
            <h1 className="hero-title">Encontrá productos únicos, hechos con dedicación.</h1>
            <Link href="/catalogo" className="cta-button">
              Ver catálogo completo
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
