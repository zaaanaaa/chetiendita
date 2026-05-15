"use client";

import { useState } from "react";
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isLanding = pathname === "/";
  const isCatalog = pathname === "/catalogo";

  return (
    <header className="header-container">
      <nav className="navbar">
        <div className="navbar-content navbar-content-sidebar">
          <div className="navbar-main">
            <Link href="/" className="navbar-logo">
              <span className="logo-mark">CT</span>
              <span className="logo-text">Che Tiendita</span>
            </Link>

            <div className="navbar-menu navbar-menu-inline">
              {!isCatalog ? (
                <Link href="/catalogo" className={`nav-link ${pathname === "/catalogo" ? "active" : ""}`}>
                  Catálogo
                </Link>
              ) : null}
              {isLanding ? (
                <>
                  <a href="/#sobre-nosotros" className="nav-link">
                    Nosotros
                  </a>
                  <a href="/#contacto" className="nav-link">
                    Contacto
                  </a>
                </>
              ) : (
                <>
                  <Link href="/" className={`nav-link ${pathname === "/" ? "active" : ""}`}>
                    Inicio
                  </Link>
                  {user ? (
                    <Link href="/pedidos" className={`nav-link ${pathname === "/pedidos" ? "active" : ""}`}>
                      Mis pedidos
                    </Link>
                  ) : (
                    <button type="button" className="nav-link nav-link-button" onClick={onCartClick}>
                      Carrito
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          <button 
            className="sidebar-toggle" 
            type="button" 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Menú"
            aria-expanded={sidebarOpen}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>

          <aside className={`header-sidebar ${sidebarOpen ? "open" : ""}`}>
            {user ? <span className="header-sidebar-user">{user.name || user.username}</span> : null}

            <div className="header-sidebar-actions">
              {user ? (
                <>
                  <Link href="/pedidos" className={`sidebar-link ${pathname === "/pedidos" ? "active" : ""}`} onClick={() => setSidebarOpen(false)}>
                    Mis pedidos
                  </Link>
                  {user.role === "admin" ? (
                    <Link href="/admin" className={`sidebar-link ${pathname === "/admin" ? "active" : ""}`} onClick={() => setSidebarOpen(false)}>
                      Panel
                    </Link>
                  ) : null}
                  <button className="sidebar-link" type="button" onClick={() => { setSidebarOpen(false); onLogoutClick?.(); }}>
                    Salir
                  </button>
                </>
              ) : (
                <button className="sidebar-link sidebar-link-primary" type="button" onClick={() => { setSidebarOpen(false); onLoginClick?.(); }}>
                  Ingresar
                </button>
              )}

              <button className="sidebar-cart" type="button" onClick={() => { setSidebarOpen(false); onCartClick?.(); }} aria-label="Ver carrito">
                <span>Carrito</span>
                {totalItems > 0 ? <strong>{totalItems}</strong> : <strong>0</strong>}
              </button>
            </div>
          </aside>
        </div>
      </nav>
    </header>
  );
}
