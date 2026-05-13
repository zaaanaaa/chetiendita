import {
  OrderInput,
  OrderStatus,
  OrderUpdateInput,
  ProductInput,
  ProductVariantGroup,
  UserInput,
  UserRole,
} from "@/lib/types";

export function normalizeTagName(value: string) {
  return value.trim().toLowerCase();
}

function normalizeVariantGroupName(value: string) {
  return value.trim();
}

function normalizeVariantOption(value: string) {
  return value.trim();
}

export function normalizeVariantGroups(
  groups?: ProductVariantGroup[],
  legacyVariants?: string[],
): ProductVariantGroup[] {
  const normalizedGroups = (groups || [])
    .map((group) => ({
      name: normalizeVariantGroupName(group.name || ""),
      options: Array.from(
        new Set((group.options || []).map(normalizeVariantOption).filter(Boolean)),
      ),
    }))
    .filter((group) => group.name && group.options.length > 0);

  if (normalizedGroups.length > 0) {
    return normalizedGroups;
  }

  const fallbackOptions = Array.from(
    new Set((legacyVariants || []).map(normalizeVariantOption).filter(Boolean)),
  );

  return fallbackOptions.length > 0
    ? [{ name: "Modelo", options: fallbackOptions }]
    : [];
}

export function flattenVariantGroups(groups: ProductVariantGroup[]) {
  return Array.from(new Set(groups.flatMap((group) => group.options)));
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

function isValidImageValue(value: string) {
  if (!value) {
    return false;
  }

  if (value.startsWith("data:image/")) {
    return true;
  }

  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function normalizeImages(images: string[], fallbackImage: string) {
  const normalized = Array.from(
    new Set(
      images
        .map((image) => image.trim())
        .filter(Boolean)
        .filter(isValidImageValue),
    ),
  );

  if (normalized.length > 0) {
    return normalized;
  }

  const trimmedFallback = fallbackImage.trim();
  return isValidImageValue(trimmedFallback) ? [trimmedFallback] : [];
}

export function validateProductInput(input: ProductInput) {
  const variantGroups = normalizeVariantGroups(input.variantGroups, input.variants);
  const images = normalizeImages(input.images || [], input.image || "");
  const payload: ProductInput = {
    name: input.name.trim(),
    description: input.description.trim(),
    price: Number(input.price),
    discountPrice:
      input.discountPrice === null || input.discountPrice === undefined || input.discountPrice === 0
        ? null
        : Number(input.discountPrice),
    image: images[0] || "",
    images,
    featured: Boolean(input.featured),
    tags: Array.from(new Set(input.tags.map(normalizeTagName).filter(Boolean))),
    variants: flattenVariantGroups(variantGroups),
    variantGroups,
  };

  if (!payload.name || !payload.description || payload.images.length === 0) {
    return { ok: false as const, error: "missing_fields" };
  }

  if (!Number.isFinite(payload.price) || payload.price < 1) {
    return { ok: false as const, error: "invalid_price" };
  }

  if (
    payload.discountPrice !== null &&
    (!Number.isFinite(payload.discountPrice) ||
      payload.discountPrice < 1 ||
      payload.discountPrice >= payload.price)
  ) {
    return { ok: false as const, error: "invalid_discount_price" };
  }

  return { ok: true as const, product: payload };
}

function validateOrderItems(items: OrderInput["items"], requireProductId: boolean) {
  const normalizedItems = (items || []).map((item) => ({
    productId: Number(item.productId || 0),
    productName: (item.productName || "").trim(),
    variant: (item.variant || "").trim(),
    quantity: Number(item.quantity || 0),
    unitPrice: Number(item.unitPrice || 0),
    image: (item.image || "").trim(),
  }));

  if (normalizedItems.length === 0) {
    return { ok: false as const, error: "empty_cart" };
  }

  for (const item of normalizedItems) {
    if (requireProductId && item.productId < 1) {
      return { ok: false as const, error: "invalid_item" };
    }

    if (!item.productName || item.quantity < 1 || !Number.isFinite(item.unitPrice) || item.unitPrice < 0) {
      return { ok: false as const, error: "invalid_item" };
    }
  }

  return { ok: true as const, items: normalizedItems };
}

export function validateOrderInput(input: OrderInput) {
  const itemsValidation = validateOrderItems(input.items || [], true);
  if (!itemsValidation.ok) {
    return itemsValidation;
  }

  const total = itemsValidation.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  return {
    ok: true as const,
    order: {
      customerName: (input.customerName || "").trim(),
      customerPhone: (input.customerPhone || "").trim(),
      notes: (input.notes || "").trim(),
      items: itemsValidation.items,
      total,
    },
  };
}

export function validateOrderUpdateInput(input: OrderUpdateInput) {
  const itemsValidation = validateOrderItems(input.items || [], false);
  if (!itemsValidation.ok) {
    return itemsValidation;
  }

  const customerName = (input.customerName || "").trim();
  if (!customerName) {
    return { ok: false as const, error: "missing_customer_name" };
  }

  if (!["pending", "accepted", "modified", "rejected"].includes(input.status)) {
    return { ok: false as const, error: "invalid_status" };
  }

  const total = itemsValidation.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  return {
    ok: true as const,
    order: {
      customerName,
      customerPhone: (input.customerPhone || "").trim(),
      notes: (input.notes || "").trim(),
      items: itemsValidation.items,
      total,
      status: input.status as OrderStatus,
    },
  };
}

export function validateAdminUserInput(input: UserInput, options?: { requirePassword?: boolean }) {
  const cleanUsername = input.username.trim();
  const cleanName = input.name.trim();
  const cleanEmail = input.email.trim().toLowerCase();
  const cleanPhone = input.phone.trim();
  const cleanPassword = (input.password || "").trim();
  const role: UserRole = input.role === "admin" ? "admin" : "user";

  if (cleanUsername.length < 4 || cleanName.length < 2) {
    return { ok: false as const, error: "invalid_input" };
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(cleanEmail)) {
    return { ok: false as const, error: "invalid_email" };
  }

  if (options?.requirePassword && cleanPassword.length < 4) {
    return { ok: false as const, error: "invalid_input" };
  }

  if (cleanPassword && cleanPassword.length < 4) {
    return { ok: false as const, error: "invalid_input" };
  }

  return {
    ok: true as const,
    user: {
      username: cleanUsername,
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      role,
      password: cleanPassword,
    },
  };
}
