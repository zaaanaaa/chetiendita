import Link from "next/link";

import { User } from "@/lib/types";

interface HeaderShellProps {
  user: User | null;
  onLoginClick?: () => void;
  onLogoutClick?: () => void;
}

export function HeaderShell({ user, onLoginClick, onLogoutClick }: HeaderShellProps) {
  return (
    <header className="hero-shell">
      <div className="hero-surface">
        <div className="topbar">
          <div className="eyebrow">Curaduria cotidiana</div>
          <div className="session-cluster">
            <span className="session-pill">
              {user ? `${user.username} · ${user.role}` : "Explorando como invitado"}
            </span>
            {user?.role === "admin" ? (
              <Link href="/admin" className="secondary-button">
                Ir al panel
              </Link>
            ) : null}
            {user ? (
              <button className="secondary-button" type="button" onClick={onLogoutClick}>
                Cerrar sesion
              </button>
            ) : (
              <button className="secondary-button" type="button" onClick={onLoginClick}>
                Acceso
              </button>
            )}
          </div>
        </div>
        <div className="hero-copy">
          <p className="hero-kicker">Che Tiendita</p>
          <h1>Objetos con alma para regalar, ordenar y hacer mas lindo el dia.</h1>
          <p className="hero-description">
            Una vitrina digital mas cuidada, con seleccion boutique, filtros simples y un
            panel de gestion listo para crecer con tu catalogo.
          </p>
        </div>
      </div>
    </header>
  );
}
