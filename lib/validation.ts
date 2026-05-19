import {
  HeroSettings,
  OrderInput,
  OrderStatus,
  OrderUpdateInput,
  ProductInput,
  ProductVideo,
  ProductVariantGroup,
  UserInput,
  UserRole,
} from "@/lib/types";
import { isColorVariantGroup, normalizeColorOption } from "@/lib/color-variants";

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
    .map((group) => {
      const name = normalizeVariantGroupName(group.name || "");
      const options = Array.from(
        new Set(
          (group.options || [])
            .map(normalizeVariantOption)
            .map((option) => (isColorVariantGroup(name) ? normalizeColorOption(option) || option : option))
            .filter(Boolean),
        ),
      );

      return { name, options };
    })
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

export function validatePublicRegistrationInput(
  name: string,
  email: string,
  phone: string,
  password: string,
) {
  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();
  const cleanPhone = phone.trim();
  const cleanPassword = password.trim();

  if (cleanName.length < 2 || cleanPassword.length < 4) {
    return { ok: false as const, error: "invalid_input" };
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(cleanEmail)) {
    return { ok: false as const, error: "invalid_email" };
  }

  if (!cleanEmail.endsWith("@gmail.com")) {
    return { ok: false as const, error: "invalid_gmail" };
  }

  const digits = cleanPhone.replace(/\D/g, "");
  if (digits.length < 8) {
    return { ok: false as const, error: "invalid_phone" };
  }

  return {
    ok: true as const,
    name: cleanName,
    email: cleanEmail,
    phone: cleanPhone,
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

function normalizeYouTubeUrl(value: string) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    const hostname = url.hostname.replace(/^www\./, "");

    if (hostname === "youtube.com" || hostname === "m.youtube.com") {
      const videoId = url.searchParams.get("v");
      return videoId ? `https://www.youtube.com/watch?v=${videoId}` : null;
    }

    if (hostname === "youtu.be") {
      const videoId = url.pathname.split("/").filter(Boolean)[0];
      return videoId ? `https://www.youtube.com/watch?v=${videoId}` : null;
    }
  } catch {
    return null;
  }

  return null;
}

function isValidVideoValue(value: string) {
  if (!value) {
    return false;
  }

  if (value.startsWith("data:video/")) {
    return true;
  }

  if (normalizeYouTubeUrl(value)) {
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

function normalizeVideoLabel(value: string, fallbackUrl: string) {
  const trimmed = value.trim();
  if (trimmed) {
    return trimmed;
  }

  if (fallbackUrl.startsWith("data:video/")) {
    return "Video";
  }

  try {
    const url = new URL(fallbackUrl);
    const lastSegment = url.pathname.split("/").filter(Boolean).pop();
    return lastSegment || "Video";
  } catch {
    return "Video";
  }
}

function normalizeVideos(videos: ProductVideo[], fallbackVideo: string) {
  const seen = new Set<string>();
  const normalized: ProductVideo[] = [];

  for (const video of videos || []) {
    const rawUrl = (video?.url || "").trim();
    if (!rawUrl) {
      continue;
    }
    const normalizedUrl = normalizeYouTubeUrl(rawUrl) || rawUrl;
    if (!isValidVideoValue(normalizedUrl) || seen.has(normalizedUrl)) {
      continue;
    }
    seen.add(normalizedUrl);
    normalized.push({
      url: normalizedUrl,
      label: normalizeVideoLabel(video?.label || "", normalizedUrl),
    });
  }

  if (normalized.length > 0) {
    return normalized;
  }

  const trimmedFallback = fallbackVideo.trim();
  if (!trimmedFallback) {
    return [];
  }

  const normalizedFallback = normalizeYouTubeUrl(trimmedFallback) || trimmedFallback;
  return isValidVideoValue(normalizedFallback)
    ? [{ url: normalizedFallback, label: normalizeVideoLabel("", normalizedFallback) }]
    : [];
}

export function validateHeroSettings(input: HeroSettings) {
  const images = normalizeImages(input.images || [], "");
  return {
    ok: true as const,
    hero: {
      images,
    },
  };
}

export function validateProductInput(input: ProductInput) {
  const variantGroups = normalizeVariantGroups(input.variantGroups, input.variants);
  const images = normalizeImages(input.images || [], input.image || "");
  const videos = normalizeVideos(input.videos || [], input.video || "");
  const normalizedTags = Array.from(new Set(input.tags.map(normalizeTagName).filter(Boolean)));
  const normalizedDiscountPrice =
    input.discountPrice === null || input.discountPrice === undefined || input.discountPrice === 0
      ? null
      : Number(input.discountPrice);
  const hasDiscount =
    normalizedDiscountPrice !== null &&
    Number.isFinite(normalizedDiscountPrice) &&
    normalizedDiscountPrice > 0;
  const tags = hasDiscount
    ? Array.from(new Set([...normalizedTags, "descuento"]))
    : normalizedTags.filter((tag) => tag !== "descuento");
  const payload: ProductInput = {
    name: input.name.trim(),
    description: input.description.trim(),
    price: Number(input.price),
    discountPrice: normalizedDiscountPrice,
    image: images[0] || "",
    images,
    videos,
    video: videos[0]?.url || null,
    featured: Boolean(input.featured) || hasDiscount,
    tags,
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

  if (((input.video || "").trim() || (input.videos || []).some((video) => video.url?.trim())) && payload.videos.length === 0) {
    return { ok: false as const, error: "invalid_video" };
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
      userId: input.userId == null ? null : Number(input.userId || 0),
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
      userId: input.userId == null ? null : Number(input.userId || 0),
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
