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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isLanding = pathname === "/";
  const isCatalog = pathname === "/catalogo";
  const isAdminPanel = pathname === "/admin";
  const isAdminUser = user?.role === "admin";

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (sidebarOpen) {
      document.body.classList.add("modal-open");
      return () => {
        document.body.classList.remove("modal-open");
      };
    }

    document.body.classList.remove("modal-open");
    return undefined;
  }, [sidebarOpen]);

  const closeSidebar = () => setSidebarOpen(false);

  const primaryNavigation = isAdminUser
    ? [
        { href: "/catalogo", label: "Catálogo", active: isCatalog },
        { href: "/admin", label: "Panel", active: isAdminPanel },
      ]
    : isLanding
      ? [
          { href: "/", label: "Inicio", active: pathname === "/" },
          { href: "/catalogo", label: "Catálogo", active: isCatalog },
          { href: "/#sobre-nosotros", label: "Nosotros", active: false },
          { href: "/#contacto", label: "Contacto", active: false },
        ]
      : [
          { href: "/", label: "Inicio", active: pathname === "/" },
          { href: "/catalogo", label: "Catálogo", active: isCatalog },
        ];

  return (
    <header className="header-container">
      <nav className="navbar">
        <div className="navbar-content navbar-content-sidebar">
          <div className="navbar-main">
            <Link href="/" className="navbar-logo">
              <span className="logo-mark">CT</span>
              <span className="logo-text">Che Tiendita</span>
            </Link>

            <div className="navbar-main-right">
              <div className="navbar-menu navbar-menu-inline">
                {primaryNavigation.map((item) => (
                  <Link key={item.href} href={item.href} className={`nav-link ${item.active ? "active" : ""}`}>
                    {item.label}
                  </Link>
                ))}
                {!isLanding && !isAdminUser ? (
                  user ? (
                    <Link href="/pedidos" className={`nav-link ${pathname === "/pedidos" ? "active" : ""}`}>
                      Mis pedidos
                    </Link>
                  ) : (
                    <button type="button" className="nav-link nav-link-button" onClick={onCartClick}>
                      Carrito
                    </button>
                  )
                ) : null}
              </div>

              {!user ? (
                <button type="button" className="nav-button login-button navbar-login-button" onClick={onLoginClick}>
                  Ingresar
                </button>
              ) : null}
            </div>
          </div>

          <button 
            className={`sidebar-toggle ${sidebarOpen ? "active" : ""}`} 
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

          <div
            className={`header-sidebar-backdrop ${sidebarOpen ? "open" : ""}`}
            role="presentation"
            onClick={closeSidebar}
          />

          <aside className={`header-sidebar ${sidebarOpen ? "open" : ""}`}>
            <div className="header-sidebar-section">
              <span className="header-sidebar-label">Cuenta</span>
            {user ? <span className="header-sidebar-user">{user.name || user.username}</span> : null}

            <div className="header-sidebar-actions">
              {user ? (
                <>
                  <button className="sidebar-cart" type="button" onClick={() => { closeSidebar(); onCartClick?.(); }} aria-label="Ver carrito">
                    <span>Carrito</span>
                    {totalItems > 0 ? <strong>{totalItems}</strong> : <strong>0</strong>}
                  </button>
                  <button className="sidebar-link" type="button" onClick={() => { closeSidebar(); onLogoutClick?.(); }}>
                    Salir
                  </button>
                </>
              ) : (
                <button className="sidebar-link sidebar-link-primary" type="button" onClick={() => { closeSidebar(); onLoginClick?.(); }}>
                  Ingresar
                </button>
              )}
            </div>
            </div>
          </aside>
        </div>
      </nav>
    </header>
  );
}
