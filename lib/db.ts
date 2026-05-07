import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import productsSeed from "@/data/products.json";
import { Product, ProductInput, SessionUser, Tag, User } from "@/lib/types";

const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "data", "catalog.db");

type ProductRow = {
  id: number;
  name: string;
  description: string;
  price: number;
  image: string;
  featured: number;
  sold_count: number;
  created_at: string;
};

type UserRow = {
  id: number;
  username: string;
  email: string;
  role: "admin" | "user";
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

function initializeDatabase(db: InstanceType<typeof Database>) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
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
      image TEXT NOT NULL,
      featured INTEGER NOT NULL DEFAULT 0,
      sold_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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
  `);

  migrateDatabase(db);

  const userCount = db.prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number };
  if (userCount.count === 0) {
    const insertUser = db.prepare(
      "INSERT INTO users(username, email, password, role) VALUES (?, ?, ?, ?)",
    );
    insertUser.run("admin", "admin@chetiendita.local", "admin123", "admin");
    insertUser.run("user", "user@chetiendita.local", "user123", "user");
  }

  const productCount = db.prepare("SELECT COUNT(*) AS count FROM products").get() as { count: number };
  if (productCount.count === 0) {
    const insertProduct = db.prepare(
      "INSERT INTO products(name, description, price, image, featured) VALUES (?, ?, ?, ?, ?)",
    );
    const insertTag = db.prepare("INSERT OR IGNORE INTO tags(name) VALUES (?)");
    const getTagId = db.prepare("SELECT id FROM tags WHERE name = ?");
    const linkTag = db.prepare(
      "INSERT OR IGNORE INTO product_tags(product_id, tag_id) VALUES (?, ?)",
    );

    const transaction = db.transaction(() => {
      for (const item of productsSeed) {
        const result = insertProduct.run(
          item.name,
          item.description,
          Number(item.price),
          item.image,
          item.featured ? 1 : 0,
        );
        db.prepare(
          "UPDATE products SET sold_count = ?, created_at = datetime('now', ?) WHERE id = ?",
        ).run(Math.floor(Math.random() * 40) + 4, `-${Number(result.lastInsertRowid) * 2} days`, Number(result.lastInsertRowid));
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

function hasColumn(db: InstanceType<typeof Database>, tableName: string, columnName: string) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return columns.some((column) => column.name === columnName);
}

function migrateDatabase(db: InstanceType<typeof Database>) {
  if (!hasColumn(db, "users", "email")) {
    db.exec("ALTER TABLE users ADD COLUMN email TEXT");
  }

  if (!hasColumn(db, "products", "sold_count")) {
    db.exec("ALTER TABLE products ADD COLUMN sold_count INTEGER NOT NULL DEFAULT 0");
  }

  if (!hasColumn(db, "products", "created_at")) {
    db.exec("ALTER TABLE products ADD COLUMN created_at TEXT");
  }

  db.exec(`
    DROP TABLE IF EXISTS password_recovery_codes;

    CREATE TABLE password_recovery_codes (
      email TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
  `);

  db.exec(`
    UPDATE users
    SET email = CASE username
      WHEN 'admin' THEN 'admin@chetiendita.local'
      WHEN 'user' THEN 'user@chetiendita.local'
      ELSE username || '@chetiendita.local'
    END
    WHERE email IS NULL OR trim(email) = '';

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
    email: row.email,
    role: row.role,
  };
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
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.price,
    image: row.image,
    featured: Boolean(row.featured),
    soldCount: row.sold_count,
    createdAt: row.created_at,
    tags: getTagsForProduct(row.id),
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
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || b.id - a.id,
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
      "SELECT id, username, email, role FROM users WHERE (username = ? OR email = ?) AND password = ?",
    )
    .get(username, username.toLowerCase(), password) as UserRow | undefined;
  return row ? mapUser(row) : null;
}

export function createUser(username: string, email: string, password: string) {
  const result = db
    .prepare("INSERT INTO users(username, email, password, role) VALUES (?, ?, ?, 'user')")
    .run(username, email, password);

  const row = db
    .prepare("SELECT id, username, email, role FROM users WHERE id = ?")
    .get(Number(result.lastInsertRowid)) as UserRow;

  return mapUser(row);
}

export function findUserByEmail(email: string) {
  const row = db
    .prepare("SELECT id, username, email, role FROM users WHERE email = ?")
    .get(email.toLowerCase()) as UserRow | undefined;
  return row ? mapUser(row) : null;
}

export function createSession(userId: number, token: string) {
  db.prepare("INSERT INTO sessions(token, user_id) VALUES (?, ?)").run(token, userId);
}

export function findSessionUser(token: string): SessionUser | null {
  const row = db
    .prepare(
      `
      SELECT u.id, u.username, u.role
      , u.email
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

export function createProduct(input: ProductInput) {
  const result = db
    .prepare(
      "INSERT INTO products(name, description, price, image, featured) VALUES (?, ?, ?, ?, ?)",
    )
    .run(input.name, input.description, input.price, input.image, input.featured ? 1 : 0);

  const productId = Number(result.lastInsertRowid);
  syncProductTags(productId, input.tags);

  const row = db.prepare("SELECT * FROM products WHERE id = ?").get(productId) as ProductRow;
  return mapProduct(row);
}

export function updateProduct(productId: number, input: ProductInput) {
  db.prepare(
    `
    UPDATE products
    SET name = ?, description = ?, price = ?, image = ?, featured = ?
    WHERE id = ?
    `,
  ).run(input.name, input.description, input.price, input.image, input.featured ? 1 : 0, productId);

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
