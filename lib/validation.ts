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
