import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import productsSeed from "@/data/products.json";
import {
  HeroSettings,
  Order,
  OrderInput,
  OrderItem,
  OrderStatus,
  OrderUpdateInput,
  Product,
  ProductInput,
  ProductVideo,
  ProductVariantGroup,
  SessionUser,
  Tag,
  User,
  UserInput,
  UserRole,
  UserWithOrders,
} from "@/lib/types";
import { flattenVariantGroups, normalizeVariantGroups } from "@/lib/validation";

const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "data", "catalog.db");

type ProductRow = {
  id: number;
  name: string;
  description: string;
  price: number;
  discount_price: number | null;
  image: string;
  images: string | null;
  videos: string | null;
  video: string | null;
  featured: number;
  sold_count: number;
  created_at: string;
  variants: string | null;
  variant_groups: string | null;
};

type UserRow = {
  id: number;
  username: string;
  name: string;
  email: string;
  phone: string;
  role: "admin" | "user";
};

type OrderRow = {
  id: number;
  user_id: number | null;
  customer_name: string;
  customer_phone: string;
  notes: string;
  status: string;
  total: number;
  created_at: string;
};

type OrderItemRow = {
  id: number;
  order_id: number;
  product_id: number;
  product_name: string;
  variant: string;
  quantity: number;
  unit_price: number;
  image: string;
};

let database: InstanceType<typeof Database> | null = null;

function openDatabase() {
  if (database) {
    return database;
  }

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  database = new Database(DB_PATH);
  database.pragma("journal_mode = WAL");
  database.pragma("busy_timeout = 30000");
  database.pragma("foreign_keys = ON");
  initializeDatabase(database);
  return database;
}

function hasColumn(db: InstanceType<typeof Database>, tableName: string, columnName: string) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return columns.some((column) => column.name === columnName);
}

function initializeDatabase(db: InstanceType<typeof Database>) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      email TEXT UNIQUE,
      phone TEXT NOT NULL DEFAULT '',
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'user'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      price INTEGER NOT NULL,
      discount_price INTEGER,
      image TEXT NOT NULL,
      images TEXT NOT NULL DEFAULT '[]',
      videos TEXT NOT NULL DEFAULT '[]',
      video TEXT,
      featured INTEGER NOT NULL DEFAULT 0,
      sold_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      variants TEXT NOT NULL DEFAULT '[]',
      variant_groups TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS product_tags (
      product_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY(product_id, tag_id),
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS password_recovery_codes (
      email TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'modified', 'rejected')),
      total INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL DEFAULT 0,
      product_name TEXT NOT NULL,
      variant TEXT NOT NULL DEFAULT '',
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price INTEGER NOT NULL DEFAULT 0,
      image TEXT NOT NULL DEFAULT '',
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  migrateDatabase(db);

  const userCount = db.prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number };
  if (userCount.count === 0) {
    const insertUser = db.prepare(
      "INSERT INTO users(username, name, email, phone, password, role) VALUES (?, ?, ?, ?, ?, ?)",
    );
    insertUser.run("admin", "Astrid Andenmatten", "admin@chetiendita.local", "", "admin123", "admin");
    insertUser.run("user", "Usuario Demo", "user@chetiendita.local", "", "user123", "user");
  }

  const productCount = db.prepare("SELECT COUNT(*) AS count FROM products").get() as { count: number };
  if (productCount.count === 0) {
    const insertProduct = db.prepare(
      `
      INSERT INTO products(name, description, price, discount_price, image, images, videos, video, featured, variants, variant_groups)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    );
    const insertTag = db.prepare("INSERT OR IGNORE INTO tags(name) VALUES (?)");
    const getTagId = db.prepare("SELECT id FROM tags WHERE name = ?");
    const linkTag = db.prepare(
      "INSERT OR IGNORE INTO product_tags(product_id, tag_id) VALUES (?, ?)",
    );

    const transaction = db.transaction(() => {
      for (const item of productsSeed) {
        const imagesJson = JSON.stringify([item.image]);
        const result = insertProduct.run(
          item.name,
          item.description,
          Number(item.price),
          null,
          item.image,
          imagesJson,
          JSON.stringify([]),
          null,
          item.featured ? 1 : 0,
          JSON.stringify([]),
          JSON.stringify([]),
        );
        db.prepare(
          "UPDATE products SET sold_count = ?, created_at = datetime('now', ?) WHERE id = ?",
        ).run(
          Math.floor(Math.random() * 40) + 4,
          `-${Number(result.lastInsertRowid) * 2} days`,
          Number(result.lastInsertRowid),
        );
        const tagName = (item.category || "general").trim().toLowerCase();
        insertTag.run(tagName);
        const tag = getTagId.get(tagName) as { id: number } | undefined;
        if (tag) {
          linkTag.run(Number(result.lastInsertRowid), tag.id);
        }
      }
    });

    transaction();
  }
}

function migrateDatabase(db: InstanceType<typeof Database>) {
  if (!hasColumn(db, "users", "email")) {
    db.exec("ALTER TABLE users ADD COLUMN email TEXT");
  }
  if (!hasColumn(db, "users", "name")) {
    db.exec("ALTER TABLE users ADD COLUMN name TEXT NOT NULL DEFAULT ''");
  }
  if (!hasColumn(db, "users", "phone")) {
    db.exec("ALTER TABLE users ADD COLUMN phone TEXT NOT NULL DEFAULT ''");
  }

  if (!hasColumn(db, "products", "sold_count")) {
    db.exec("ALTER TABLE products ADD COLUMN sold_count INTEGER NOT NULL DEFAULT 0");
  }
  if (!hasColumn(db, "products", "created_at")) {
    db.exec("ALTER TABLE products ADD COLUMN created_at TEXT");
  }
  if (!hasColumn(db, "products", "variants")) {
    db.exec("ALTER TABLE products ADD COLUMN variants TEXT NOT NULL DEFAULT '[]'");
  }
  if (!hasColumn(db, "products", "variant_groups")) {
    db.exec("ALTER TABLE products ADD COLUMN variant_groups TEXT NOT NULL DEFAULT '[]'");
  }
  if (!hasColumn(db, "products", "discount_price")) {
    db.exec("ALTER TABLE products ADD COLUMN discount_price INTEGER");
  }
  if (!hasColumn(db, "products", "images")) {
    db.exec("ALTER TABLE products ADD COLUMN images TEXT NOT NULL DEFAULT '[]'");
  }
  if (!hasColumn(db, "products", "videos")) {
    db.exec("ALTER TABLE products ADD COLUMN videos TEXT NOT NULL DEFAULT '[]'");
  }
  if (!hasColumn(db, "products", "video")) {
    db.exec("ALTER TABLE products ADD COLUMN video TEXT");
  }

  if (!hasColumn(db, "orders", "user_id")) {
    db.exec("ALTER TABLE orders ADD COLUMN user_id INTEGER");
  }

  db.exec(`
    DROP TABLE IF EXISTS password_recovery_codes;

    CREATE TABLE password_recovery_codes (
      email TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
  `);

  const productRows = db.prepare("SELECT id, image, images, videos, video, variants, variant_groups FROM products").all() as Array<{
    id: number;
    image: string;
    images: string | null;
    videos: string | null;
    video: string | null;
    variants: string | null;
    variant_groups: string | null;
  }>;

  const updateProductArrays = db.prepare(
    "UPDATE products SET image = ?, images = ?, videos = ?, video = ?, variants = ?, variant_groups = ? WHERE id = ?",
  );

  const productMigration = db.transaction(() => {
    for (const row of productRows) {
      const images = parseImages(row.images, row.image);
      const videos = parseVideos(row.videos, row.video);
      const variantGroups = parseVariantGroups(row.variant_groups, row.variants);
      updateProductArrays.run(
        images[0] || row.image,
        JSON.stringify(images),
        JSON.stringify(videos),
        videos[0]?.url || null,
        JSON.stringify(flattenVariantGroups(variantGroups)),
        JSON.stringify(variantGroups),
        row.id,
      );
    }
  });
  productMigration();

  db.exec(`
    UPDATE users
    SET email = CASE username
      WHEN 'admin' THEN 'admin@chetiendita.local'
      WHEN 'user' THEN 'user@chetiendita.local'
      ELSE username || '@chetiendita.local'
    END
    WHERE email IS NULL OR trim(email) = '';

    UPDATE users
    SET name = CASE username
      WHEN 'admin' THEN 'Astrid Andenmatten'
      WHEN 'user' THEN 'Usuario Demo'
      ELSE username
    END
    WHERE name IS NULL OR trim(name) = '';

    UPDATE products
    SET sold_count = CASE
      WHEN sold_count IS NULL OR sold_count = 0 THEN (id * 7) + 3
      ELSE sold_count
    END;

    UPDATE products
    SET created_at = CASE
      WHEN created_at IS NULL OR trim(created_at) = '' THEN datetime('now', '-' || (id * 2) || ' days')
      ELSE created_at
    END;
  `);
}

const db = openDatabase();

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
  };
}

function parseImages(rawImages: string | null, fallbackImage: string): string[] {
  if (rawImages) {
    try {
      const parsed = JSON.parse(rawImages);
      if (Array.isArray(parsed)) {
        const normalized = parsed.filter(
          (image: unknown) => typeof image === "string" && image.trim(),
        );
        if (normalized.length > 0) {
          return normalized;
        }
      }
    } catch {
      // ignore legacy format
    }
  }

  return fallbackImage ? [fallbackImage] : [];
}

function parseVideos(rawVideos: string | null, fallbackVideo: string | null): ProductVideo[] {
  if (rawVideos) {
    try {
      const parsed = JSON.parse(rawVideos);
      if (Array.isArray(parsed)) {
        const normalized = parsed
          .map((video: unknown) => {
            if (typeof video === "string" && video.trim()) {
              return { url: video, label: "Video" };
            }
            if (
              typeof video === "object" &&
              video !== null &&
              "url" in video &&
              typeof (video as { url: unknown }).url === "string" &&
              (video as { url: string }).url.trim()
            ) {
              const typedVideo = video as { url: string; label?: string };
              return {
                url: typedVideo.url,
                label: (typedVideo.label || "").trim() || "Video",
              };
            }
            return null;
          })
          .filter((video): video is ProductVideo => Boolean(video));
        if (normalized.length > 0) {
          return normalized;
        }
      }
    } catch {
      // ignore legacy format
    }
  }

  return fallbackVideo ? [{ url: fallbackVideo, label: "Video" }] : [];
}

function parseLegacyVariants(raw: string | null): string[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((value: unknown) => typeof value === "string" && value.trim())
      : [];
  } catch {
    return [];
  }
}

function parseVariantGroups(
  rawGroups: string | null,
  rawLegacyVariants: string | null,
): ProductVariantGroup[] {
  const legacyVariants = parseLegacyVariants(rawLegacyVariants);

  if (rawGroups) {
    try {
      const parsed = JSON.parse(rawGroups);
      if (Array.isArray(parsed)) {
        return normalizeVariantGroups(parsed as ProductVariantGroup[], legacyVariants);
      }
    } catch {
      return normalizeVariantGroups(undefined, legacyVariants);
    }
  }

  return normalizeVariantGroups(undefined, legacyVariants);
}

function parseHeroImages(rawValue: string | null | undefined): string[] {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed)
      ? parsed.filter((image: unknown) => typeof image === "string" && image.trim())
      : [];
  } catch {
    return [];
  }
}

function getTagsForProduct(productId: number) {
  const rows = db
    .prepare(
      `
      SELECT t.name
      FROM tags t
      JOIN product_tags pt ON pt.tag_id = t.id
      WHERE pt.product_id = ?
      ORDER BY t.name
      `,
    )
    .all(productId) as Array<{ name: string }>;

  return rows.map((row) => row.name);
}

function mapProduct(row: ProductRow): Product {
  const images = parseImages(row.images, row.image);
  const videos = parseVideos(row.videos, row.video);
  const variantGroups = parseVariantGroups(row.variant_groups, row.variants);

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.price,
    discountPrice: row.discount_price ?? null,
    image: images[0] || row.image,
    images,
    videos,
    video: videos[0]?.url ?? null,
    featured: Boolean(row.featured),
    soldCount: row.sold_count,
    createdAt: row.created_at,
    tags: getTagsForProduct(row.id),
    variants: flattenVariantGroups(variantGroups),
    variantGroups,
  };
}

export function listProducts(filters?: {
  search?: string;
  tag?: string;
  sort?: "featured" | "newest" | "bestselling";
}) {
  const rows = db.prepare("SELECT * FROM products").all() as ProductRow[];

  const search = filters?.search?.trim().toLowerCase() ?? "";
  const tag = filters?.tag?.trim().toLowerCase() ?? "";
  const sort = filters?.sort ?? "featured";

  const products = rows
    .map(mapProduct)
    .filter((product) => {
      const matchesSearch =
        !search ||
        product.name.toLowerCase().includes(search) ||
        product.description.toLowerCase().includes(search);
      const matchesTag = !tag || product.tags.includes(tag);
      return matchesSearch && matchesTag;
    });

  if (sort === "bestselling") {
    return products.sort((a, b) => b.soldCount - a.soldCount || b.id - a.id);
  }

  if (sort === "newest") {
    return products.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || b.id - a.id,
    );
  }

  return products.sort((a, b) => Number(b.featured) - Number(a.featured) || b.id - a.id);
}

export function listTags(): Tag[] {
  return db.prepare("SELECT id, name FROM tags ORDER BY name").all() as Tag[];
}

export function findUserByCredentials(username: string, password: string) {
  const row = db
    .prepare(
      `
      SELECT id, username, name, email, phone, role
      FROM users
      WHERE (username = ? OR email = ?) AND password = ?
      `,
    )
    .get(username, username.toLowerCase(), password) as UserRow | undefined;
  return row ? mapUser(row) : null;
}

export function createUser(
  username: string,
  email: string,
  password: string,
  options?: { name?: string; phone?: string; role?: UserRole },
) {
  const result = db
    .prepare(
      "INSERT INTO users(username, name, email, phone, password, role) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(
      username,
      options?.name?.trim() || username,
      email,
      options?.phone?.trim() || "",
      password,
      options?.role || "user",
    );

  const row = db
    .prepare("SELECT id, username, name, email, phone, role FROM users WHERE id = ?")
    .get(Number(result.lastInsertRowid)) as UserRow;

  return mapUser(row);
}

export function generateUniqueUsernameFromEmail(email: string) {
  const fallback = "cliente";
  const [rawBase] = email.toLowerCase().split("@");
  const base =
    rawBase
      ?.replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) || fallback;

  let candidate = base;
  let attempt = 1;

  while (true) {
    const existing = db
      .prepare("SELECT id FROM users WHERE username = ?")
      .get(candidate) as { id: number } | undefined;

    if (!existing) {
      return candidate;
    }

    attempt += 1;
    candidate = `${base}-${attempt}`;
  }
}

export function createManagedUser(input: UserInput) {
  return createUser(input.username, input.email, input.password || "1234", {
    name: input.name,
    phone: input.phone,
    role: input.role,
  });
}

export function updateManagedUser(userId: number, input: UserInput) {
  if (input.password) {
    db.prepare(
      `
      UPDATE users
      SET username = ?, name = ?, email = ?, phone = ?, role = ?, password = ?
      WHERE id = ?
      `,
    ).run(input.username, input.name, input.email, input.phone, input.role, input.password, userId);
  } else {
    db.prepare(
      `
      UPDATE users
      SET username = ?, name = ?, email = ?, phone = ?, role = ?
      WHERE id = ?
      `,
    ).run(input.username, input.name, input.email, input.phone, input.role, userId);
  }

  return findUser(userId);
}

export function deleteUserRecord(userId: number) {
  db.prepare("DELETE FROM users WHERE id = ?").run(userId);
}

export function findUserByEmail(email: string) {
  const row = db
    .prepare("SELECT id, username, name, email, phone, role FROM users WHERE email = ?")
    .get(email.toLowerCase()) as UserRow | undefined;
  return row ? mapUser(row) : null;
}

export function findUser(userId: number) {
  const row = db
    .prepare("SELECT id, username, name, email, phone, role FROM users WHERE id = ?")
    .get(userId) as UserRow | undefined;
  return row ? mapUser(row) : null;
}

export function listUsers(search?: string) {
  const normalizedSearch = search?.trim().toLowerCase() || "";
  const users = db
    .prepare("SELECT id, username, name, email, phone, role FROM users ORDER BY name, username")
    .all() as UserRow[];

  if (!normalizedSearch) {
    return users.map(mapUser);
  }

  return users
    .map(mapUser)
    .filter((user) => {
      const matchesText =
        user.username.toLowerCase().includes(normalizedSearch) ||
        user.name.toLowerCase().includes(normalizedSearch) ||
        user.email.toLowerCase().includes(normalizedSearch) ||
        user.phone.toLowerCase().includes(normalizedSearch);

      if (matchesText) {
        return true;
      }

      const possibleOrderId = Number(normalizedSearch);
      if (Number.isInteger(possibleOrderId) && possibleOrderId > 0) {
        const order = db
          .prepare("SELECT user_id FROM orders WHERE id = ?")
          .get(possibleOrderId) as { user_id: number | null } | undefined;
        return order?.user_id === user.id;
      }

      return false;
    });
}

export function getUserWithOrders(userId: number): UserWithOrders | null {
  const user = findUser(userId);
  if (!user) {
    return null;
  }

  return {
    ...user,
    orders: listOrdersByUser(userId),
  };
}

export function createSession(userId: number, token: string) {
  db.prepare("INSERT INTO sessions(token, user_id) VALUES (?, ?)").run(token, userId);
}

export function findSessionUser(token: string): SessionUser | null {
  const row = db
    .prepare(
      `
      SELECT u.id, u.username, u.name, u.email, u.phone, u.role
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = ?
      `,
    )
    .get(token) as UserRow | undefined;

  if (!row) {
    return null;
  }

  return {
    ...mapUser(row),
    token,
  };
}

export function deleteSession(token: string) {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export function createTag(name: string) {
  const result = db.prepare("INSERT INTO tags(name) VALUES (?)").run(name);
  return {
    id: Number(result.lastInsertRowid),
    name,
  };
}

export function getHeroSettings(): HeroSettings {
  const row = db
    .prepare("SELECT value FROM site_settings WHERE key = 'hero_images'")
    .get() as { value: string } | undefined;

  return {
    images: parseHeroImages(row?.value),
  };
}

export function updateHeroSettings(input: HeroSettings) {
  db.prepare(
    `
    INSERT INTO site_settings(key, value)
    VALUES ('hero_images', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `,
  ).run(JSON.stringify(input.images || []));

  return getHeroSettings();
}

export function createPasswordRecoveryCode(email: string) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  db.prepare(
    `
    INSERT INTO password_recovery_codes(email, code, expires_at)
    VALUES (?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET code = excluded.code, expires_at = excluded.expires_at
    `,
  ).run(email.toLowerCase(), code, expiresAt);

  return { code, expiresAt };
}

export function resetPasswordWithRecoveryCode(code: string, password: string) {
  const row = db
    .prepare(
      `
      SELECT email, expires_at
      FROM password_recovery_codes
      WHERE code = ?
      `,
    )
    .get(code) as { email: string; expires_at: string } | undefined;

  if (!row) {
    return { ok: false as const, error: "invalid_code" };
  }

  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare("DELETE FROM password_recovery_codes WHERE email = ?").run(row.email);
    return { ok: false as const, error: "expired_code" };
  }

  db.prepare("UPDATE users SET password = ? WHERE email = ?").run(password, row.email);
  db.prepare("DELETE FROM password_recovery_codes WHERE email = ?").run(row.email);
  return { ok: true as const };
}

function syncProductTags(productId: number, tags: string[]) {
  const selectTag = db.prepare("SELECT id FROM tags WHERE name = ?");
  const insertLink = db.prepare(
    "INSERT OR IGNORE INTO product_tags(product_id, tag_id) VALUES (?, ?)",
  );
  const deleteLinks = db.prepare("DELETE FROM product_tags WHERE product_id = ?");

  deleteLinks.run(productId);

  for (const tagName of tags) {
    const tag = selectTag.get(tagName) as { id: number } | undefined;
    if (tag) {
      insertLink.run(productId, tag.id);
    }
  }
}

function serializeVariantGroups(groups?: ProductVariantGroup[]) {
  const normalizedGroups = normalizeVariantGroups(groups, []);
  return {
    variantsJson: JSON.stringify(flattenVariantGroups(normalizedGroups)),
    variantGroupsJson: JSON.stringify(normalizedGroups),
  };
}

export function createProduct(input: ProductInput) {
  const { variantsJson, variantGroupsJson } = serializeVariantGroups(input.variantGroups);
  const imagesJson = JSON.stringify(input.images);
  const result = db
    .prepare(
      `
      INSERT INTO products(name, description, price, discount_price, image, images, videos, video, featured, variants, variant_groups)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      input.name,
      input.description,
      input.price,
      input.discountPrice,
      input.image,
      imagesJson,
      JSON.stringify(input.videos || []),
      input.video,
      input.featured ? 1 : 0,
      variantsJson,
      variantGroupsJson,
    );

  const productId = Number(result.lastInsertRowid);
  syncProductTags(productId, input.tags);

  const row = db.prepare("SELECT * FROM products WHERE id = ?").get(productId) as ProductRow;
  return mapProduct(row);
}

export function updateProduct(productId: number, input: ProductInput) {
  const { variantsJson, variantGroupsJson } = serializeVariantGroups(input.variantGroups);
  db.prepare(
    `
    UPDATE products
    SET name = ?, description = ?, price = ?, discount_price = ?, image = ?, images = ?, videos = ?, video = ?, featured = ?, variants = ?, variant_groups = ?
    WHERE id = ?
    `,
  ).run(
    input.name,
    input.description,
    input.price,
    input.discountPrice,
    input.image,
    JSON.stringify(input.images),
    JSON.stringify(input.videos || []),
    input.video,
    input.featured ? 1 : 0,
    variantsJson,
    variantGroupsJson,
    productId,
  );

  syncProductTags(productId, input.tags);

  const row = db.prepare("SELECT * FROM products WHERE id = ?").get(productId) as ProductRow | undefined;
  return row ? mapProduct(row) : null;
}

export function deleteProduct(productId: number) {
  db.prepare("DELETE FROM products WHERE id = ?").run(productId);
}

export function findProduct(productId: number) {
  const row = db.prepare("SELECT * FROM products WHERE id = ?").get(productId) as ProductRow | undefined;
  return row ? mapProduct(row) : null;
}

function mapOrderItems(orderId: number): OrderItem[] {
  const rows = db
    .prepare("SELECT * FROM order_items WHERE order_id = ? ORDER BY id")
    .all(orderId) as OrderItemRow[];

  return rows.map((row) => ({
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    variant: row.variant,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    image: row.image,
  }));
}

function mapOrder(row: OrderRow): Order {
  return {
    id: row.id,
    userId: row.user_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    notes: row.notes,
    status: row.status as OrderStatus,
    total: row.total,
    createdAt: row.created_at,
    items: mapOrderItems(row.id),
  };
}

function replaceOrderItems(orderId: number, items: OrderInput["items"]) {
  db.prepare("DELETE FROM order_items WHERE order_id = ?").run(orderId);

  const insertItem = db.prepare(
    `
    INSERT INTO order_items(order_id, product_id, product_name, variant, quantity, unit_price, image)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
  );

  for (const item of items) {
    insertItem.run(
      orderId,
      item.productId || 0,
      item.productName,
      item.variant || "",
      item.quantity,
      item.unitPrice,
      item.image || "",
    );
  }
}

function calculateOrderTotal(items: OrderInput["items"]) {
  return items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
}

export function createOrder(input: OrderInput & { total: number; userId?: number | null }) {
  const result = db
    .prepare(
      `
      INSERT INTO orders(user_id, customer_name, customer_phone, notes, status, total)
      VALUES (?, ?, ?, ?, 'pending', ?)
      `,
    )
    .run(
      input.userId ?? null,
      (input.customerName || "").trim() || "Cliente",
      (input.customerPhone || "").trim(),
      (input.notes || "").trim(),
      input.total,
    );

  const orderId = Number(result.lastInsertRowid);
  replaceOrderItems(orderId, input.items);

  const row = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as OrderRow;
  return mapOrder(row);
}

export function listOrders() {
  const rows = db.prepare("SELECT * FROM orders ORDER BY created_at DESC").all() as OrderRow[];
  return rows.map(mapOrder);
}

export function listOrdersByUser(userId: number) {
  const rows = db
    .prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC")
    .all(userId) as OrderRow[];
  return rows.map(mapOrder);
}

export function findOrder(orderId: number) {
  const row = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as OrderRow | undefined;
  return row ? mapOrder(row) : null;
}

export function updateOrderStatus(orderId: number, status: OrderStatus) {
  db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, orderId);
  const row = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as OrderRow | undefined;
  return row ? mapOrder(row) : null;
}

export function updateOrder(orderId: number, input: OrderUpdateInput) {
  const transaction = db.transaction(() => {
    db.prepare(
      `
      UPDATE orders
      SET customer_name = ?, customer_phone = ?, notes = ?, status = ?, total = ?
      WHERE id = ?
      `,
    ).run(
      input.customerName,
      input.customerPhone,
      input.notes,
      input.status,
      calculateOrderTotal(input.items),
      orderId,
    );

    replaceOrderItems(orderId, input.items);
  });

  transaction();

  const row = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as OrderRow | undefined;
  return row ? mapOrder(row) : null;
}

export function deleteOrder(orderId: number) {
  db.prepare("DELETE FROM orders WHERE id = ?").run(orderId);
}
