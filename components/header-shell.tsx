"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useCart } from "@/components/cart-context";
import { User } from "@/lib/types";

interface HeaderShellProps {
  user: User | null;
  onLoginClick?: () => void;
  onLogoutClick?: () => void;
  onCartClick?: () => void;
}

export function HeaderShell({ user, onLoginClick, onLogoutClick, onCartClick }: HeaderShellProps) {
  const { totalItems } = useCart();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function getNavLinkClass(target: string) {
    return `nav-link ${pathname === target ? "active" : ""}`;
  }

  return (
    <header className="header-container">
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
              <Link href="/catalogo" className={getNavLinkClass("/catalogo")}>
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
              {user && (
                <Link href="/pedidos" className={`nav-btn nav-btn-ghost ${pathname === "/pedidos" ? "nav-btn-active" : ""}`}>
                  Mis pedidos
                </Link>
              )}
              {user?.role === "admin" && (
                <Link href="/admin" className={`nav-btn nav-btn-ghost ${pathname === "/admin" ? "nav-btn-active" : ""}`}>
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
    </header>
  );
}
