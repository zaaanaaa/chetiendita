"use client";

import { FormEvent, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Mode = "login" | "register" | "recover" | "reset";

interface LoginPanelProps {
  open: boolean;
  onClose: () => void;
}

const MESSAGES: Record<string, string> = {
  invalid_credentials: "Las credenciales no coinciden.",
  invalid_input: "Usuario y contrasena deben tener al menos 4 caracteres.",
  invalid_email: "Ingresa un email valido.",
  invalid_gmail: "La cuenta debe registrarse con un Gmail valido.",
  invalid_code: "El codigo debe tener 6 numeros.",
  expired_code: "El codigo vencio. Pedi uno nuevo.",
  username_or_email_exists: "Ese usuario o email ya existe.",
  network_error: "No se pudo conectar con el servidor.",
  register_success: "Cuenta creada. Ya podes iniciar sesion.",
  recovery_sent: "Te enviamos un codigo de recuperacion a tu email.",
  reset_success: "Contrasena actualizada. Ya podes iniciar sesion.",
  default: "Ocurrio un error. Intenta otra vez.",
};

export function LoginPanel({ open, onClose }: LoginPanelProps) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [message, setMessage] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [previewCode, setPreviewCode] = useState("");
  const [isPending, startTransition] = useTransition();

  // ── SCROLL LOCK: prevent body scroll when modal is open ──
  useEffect(() => {
    if (open) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }
    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [open]);

  if (!open) {
    return null;
  }

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setMessage("");
    if (nextMode !== "reset") {
      setPreviewCode("");
    }
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      try {
        if (mode === "recover") {
          const email = String(formData.get("email") || "");
          const response = await fetch("/api/auth/forgot-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
          });

          const data = (await response.json().catch(() => ({}))) as {
            error?: string;
            previewCode?: string;
          };

          if (!response.ok) {
            setMessage(MESSAGES[data.error || "default"]);
            return;
          }

          setRecoveryEmail(email);
          setPreviewCode(data.previewCode || "");
          setMessage(
            data.previewCode
              ? `${MESSAGES.recovery_sent} Codigo de prueba: ${data.previewCode}`
              : MESSAGES.recovery_sent,
          );
          setMode("reset");
          event.currentTarget.reset();
          return;
        }

        if (mode === "reset") {
          const response = await fetch("/api/auth/reset-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              code: String(formData.get("code") || ""),
              password: String(formData.get("password") || ""),
            }),
          });

          const data = (await response.json().catch(() => ({}))) as { error?: string };
          if (!response.ok) {
            setMessage(MESSAGES[data.error || "default"]);
            return;
          }

          setMessage(MESSAGES.reset_success);
          setMode("login");
          setPreviewCode("");
          return;
        }

        const payload =
          mode === "login"
            ? {
                username: String(formData.get("username") || ""),
                password: String(formData.get("password") || ""),
              }
            : {
                username: String(formData.get("username") || ""),
                email: String(formData.get("email") || ""),
                password: String(formData.get("password") || ""),
              };

        const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = (await response.json().catch(() => ({}))) as { error?: string };

        if (!response.ok) {
          setMessage(MESSAGES[data.error || "default"]);
          return;
        }

        if (mode === "register") {
          setMessage(MESSAGES.register_success);
          setMode("login");
          event.currentTarget.reset();
          return;
        }

        router.refresh();
        onClose();
      } catch {
        setMessage(MESSAGES.network_error);
      }
    });
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal-card modal-card-wide" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="section-overline">Acceso</p>
            <h2>
              {mode === "login" && "Ingresar a tu cuenta"}
              {mode === "register" && "Crear cuenta"}
              {mode === "recover" && "Recuperar contrasena"}
              {mode === "reset" && "Definir nueva contrasena"}
            </h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        {(mode === "login" || mode === "register") ? (
          <div className="auth-switch">
            <button
              className={`auth-tab ${mode === "login" ? "active" : ""}`}
              type="button"
              onClick={() => switchMode("login")}
            >
              Ingresar
            </button>
            <button
              className={`auth-tab auth-tab-register ${mode === "register" ? "active" : ""}`}
              type="button"
              onClick={() => switchMode("register")}
            >
              Registrarme
            </button>
          </div>
        ) : null}

        <p className="helper-text" style={{ margin: "0.75rem 0 0.25rem", fontSize: "0.85rem" }}>
          Usuarios demo: <code style={{ background: "rgba(0,0,0,0.05)", padding: "0.15rem 0.4rem", borderRadius: "6px", fontSize: "0.82rem" }}>admin/admin123</code> y <code style={{ background: "rgba(0,0,0,0.05)", padding: "0.15rem 0.4rem", borderRadius: "6px", fontSize: "0.82rem" }}>user/user123</code>.
        </p>

        <form className="stack-form" onSubmit={submitForm}>
          {mode === "login" ? (
            <>
              <input name="username" type="text" placeholder="Usuario o email" required minLength={4} />
              <input
                name="password"
                type="password"
                placeholder="Contrasena"
                required
                minLength={4}
              />
            </>
          ) : null}

          {mode === "register" ? (
            <>
              <input name="username" type="text" placeholder="Usuario" required minLength={4} />
              <input name="email" type="email" placeholder="tuusuario@gmail.com" required />
              <input
                name="password"
                type="password"
                placeholder="Contrasena"
                required
                minLength={4}
              />
            </>
          ) : null}

          {mode === "recover" ? (
            <input
              name="email"
              type="email"
              placeholder="Tu email"
              defaultValue={recoveryEmail}
              required
            />
          ) : null}

          {mode === "reset" ? (
            <>
              <input
                name="code"
                type="text"
                inputMode="numeric"
                placeholder="Codigo de 6 digitos"
                defaultValue={previewCode}
                required
              />
              <input
                name="password"
                type="password"
                placeholder="Nueva contrasena"
                required
                minLength={4}
              />
            </>
          ) : null}

          <button className="primary-button" type="submit" disabled={isPending} style={{ width: "100%", marginTop: "0.25rem" }}>
            {isPending
              ? "Procesando..."
              : mode === "login"
                ? "Entrar"
                : mode === "register"
                  ? "Crear cuenta"
                  : mode === "recover"
                    ? "Enviar codigo"
                    : "Guardar nueva contrasena"}
          </button>
        </form>

        <p className={`feedback ${message ? "visible" : ""}`}>{message}</p>

        {mode === "login" ? (
          <div className="auth-footer">
            <button className="text-button" type="button" onClick={() => switchMode("recover")}>
              Olvido su contrasena?
            </button>
            <button className="text-button text-button-strong" type="button" onClick={() => switchMode("register")}>
              Necesitas una cuenta? Registrarme
            </button>
          </div>
        ) : null}

        {mode === "register" ? (
          <button className="text-button" type="button" onClick={() => switchMode("login")}>
            Ya tengo cuenta. Ingresar
          </button>
        ) : null}

        {(mode === "recover" || mode === "reset") ? (
          <div className="auth-footer">
            <button className="text-button" type="button" onClick={() => switchMode("login")}>
              Volver al login
            </button>
            {mode === "reset" ? (
              <button className="text-button" type="button" onClick={() => switchMode("recover")}>
                Pedir otro codigo
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
