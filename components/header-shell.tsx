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
          <div className="eyebrow" style={{ color: "rgba(255,255,255,0.4)" }}>
            ✦ Curaduria cotidiana
          </div>
          <div className="session-cluster">
            <span className="session-pill">
              {user ? `${user.username} · ${user.role}` : "✧ Explorando como invitado"}
            </span>
            {user?.role === "admin" ? (
              <Link
                href="/admin"
                className="secondary-button"
                style={{
                  background: "rgba(255,255,255,0.12)",
                  borderColor: "rgba(255,255,255,0.18)",
                  color: "#fff",
                }}
              >
                Ir al panel
              </Link>
            ) : null}
            {user ? (
              <button
                className="secondary-button"
                type="button"
                onClick={onLogoutClick}
                style={{
                  background: "rgba(255,255,255,0.12)",
                  borderColor: "rgba(255,255,255,0.18)",
                  color: "#fff",
                }}
              >
                Cerrar sesion
              </button>
            ) : (
              <button
                className="primary-button"
                type="button"
                onClick={onLoginClick}
              >
                Acceso
              </button>
            )}
          </div>
        </div>
        <div className="hero-copy">
          <p className="hero-kicker">Che Tiendita</p>
          <h1 className="hero-title">
            Objetos con alma para regalar y hacer mas lindo el dia.
          </h1>
          <p className="hero-description">
            Una vitrina digital cuidada, con seleccion boutique, filtros simples y un catalogo
            pensado para mirar con calma.
          </p>
        </div>
      </div>
    </header>
  );
}
