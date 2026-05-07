import { ProductInput } from "@/lib/types";

export function normalizeTagName(value: string) {
  return value.trim().toLowerCase();
}

export function validateCredentials(username: string, password: string) {
  const cleanUsername = username.trim();
  const cleanPassword = password.trim();

  if (cleanUsername.length < 4 || cleanPassword.length < 4) {
    return { ok: false as const, error: "invalid_input" };
  }

  return {
    ok: true as const,
    username: cleanUsername,
    password: cleanPassword,
  };
}

export function validateRegistrationInput(username: string, email: string, password: string) {
  const cleanUsername = username.trim();
  const cleanEmail = email.trim().toLowerCase();
  const cleanPassword = password.trim();

  if (cleanUsername.length < 4 || cleanPassword.length < 4) {
    return { ok: false as const, error: "invalid_input" };
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(cleanEmail)) {
    return { ok: false as const, error: "invalid_email" };
  }

  if (!cleanEmail.endsWith("@gmail.com")) {
    return { ok: false as const, error: "invalid_gmail" };
  }

  return {
    ok: true as const,
    username: cleanUsername,
    email: cleanEmail,
    password: cleanPassword,
  };
}

export function validateRecoveryEmail(email: string) {
  const cleanEmail = email.trim().toLowerCase();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(cleanEmail)) {
    return { ok: false as const, error: "invalid_email" };
  }

  return { ok: true as const, email: cleanEmail };
}

export function validateRecoveryResetInput(code: string, password: string) {
  const cleanCode = code.trim();
  const cleanPassword = password.trim();

  if (!/^\d{6}$/.test(cleanCode)) {
    return { ok: false as const, error: "invalid_code" };
  }

  if (cleanPassword.length < 4) {
    return { ok: false as const, error: "invalid_input" };
  }

  return {
    ok: true as const,
    code: cleanCode,
    password: cleanPassword,
  };
}

export function validateTagName(name: string) {
  const normalized = normalizeTagName(name);
  if (!normalized) {
    return { ok: false as const, error: "name_required" };
  }
  return { ok: true as const, name: normalized };
}

export function validateProductInput(input: ProductInput) {
  const payload: ProductInput = {
    name: input.name.trim(),
    description: input.description.trim(),
    price: Number(input.price),
    image: input.image.trim(),
    featured: Boolean(input.featured),
    tags: Array.from(new Set(input.tags.map(normalizeTagName).filter(Boolean))),
  };

  if (!payload.name || !payload.description || !payload.image) {
    return { ok: false as const, error: "missing_fields" };
  }

  if (!Number.isFinite(payload.price) || payload.price < 1) {
    return { ok: false as const, error: "invalid_price" };
  }

  try {
    const url = new URL(payload.image);
    if (!["http:", "https:"].includes(url.protocol)) {
      return { ok: false as const, error: "invalid_image_url" };
    }
  } catch {
    return { ok: false as const, error: "invalid_image_url" };
  }

  return { ok: true as const, product: payload };
}
