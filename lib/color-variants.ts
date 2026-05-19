export const DEFAULT_COLOR_OPTION = "#b5623a";

export function isColorVariantGroup(name: string) {
  const normalized = name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return normalized === "color" || normalized === "colores";
}

export function isHexColor(value: string) {
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

export function normalizeColorOption(value: string) {
  const clean = value.trim();

  if (!isHexColor(clean)) {
    return "";
  }

  if (clean.length === 4) {
    return `#${clean[1]}${clean[1]}${clean[2]}${clean[2]}${clean[3]}${clean[3]}`.toLowerCase();
  }

  return clean.toLowerCase();
}
