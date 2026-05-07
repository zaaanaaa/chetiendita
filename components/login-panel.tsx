"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Mode = "login" | "register";

interface LoginPanelProps {
  open: boolean;
  onClose: () => void;
}

const MESSAGES: Record<string, string> = {
  invalid_credentials: "Las credenciales no coinciden.",
  invalid_input: "Usuario y contrasena deben tener al menos 4 caracteres.",
  username_exists: "Ese usuario ya existe.",
  network_error: "No se pudo conectar con el servidor.",
  register_success: "Usuario creado. Ya podes iniciar sesion.",
  default: "Ocurrio un error. Intenta otra vez.",
};

export function LoginPanel({ open, onClose }: LoginPanelProps) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  if (!open) {
    return null;
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const formData = new FormData(event.currentTarget);
    const payload = {
      username: String(formData.get("username") || ""),
      password: String(formData.get("password") || ""),
    };

    startTransition(async () => {
      try {
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
      <div className="modal-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="section-overline">Acceso</p>
            <h2>{mode === "login" ? "Ingresar a tu cuenta" : "Crear usuario"}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>
        <p className="helper-text">
          Usuarios demo: <code>admin/admin123</code> y <code>user/user123</code>.
        </p>
        <form className="stack-form" onSubmit={submitForm}>
          <input name="username" type="text" placeholder="Usuario" required minLength={4} />
          <input
            name="password"
            type="password"
            placeholder="Contrasena"
            required
            minLength={4}
          />
          <button className="primary-button" type="submit" disabled={isPending}>
            {isPending ? "Procesando..." : mode === "login" ? "Entrar" : "Crear cuenta"}
          </button>
        </form>
        <p className={`feedback ${message ? "visible" : ""}`}>{message}</p>
        <button
          className="text-button"
          type="button"
          onClick={() => {
            setMessage("");
            setMode(mode === "login" ? "register" : "login");
          }}
        >
          {mode === "login" ? "Necesitas una cuenta? Registrarme" : "Ya tengo cuenta. Ingresar"}
        </button>
      </div>
    </div>
  );
}
