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
};

type UserRow = {
  id: number;
  username: string;
  role: "admin" | "user";
};

let database: Database.Database | null = null;

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

function initializeDatabase(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
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
      featured INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS product_tags (
      product_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY(product_id, tag_id),
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );
  `);

  const userCount = db.prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number };
  if (userCount.count === 0) {
    const insertUser = db.prepare(
      "INSERT INTO users(username, password, role) VALUES (?, ?, ?)",
    );
    insertUser.run("admin", "admin123", "admin");
    insertUser.run("user", "user123", "user");
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

const db = openDatabase();

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
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
    tags: getTagsForProduct(row.id),
  };
}

export function listProducts(filters?: { search?: string; tag?: string }) {
  const rows = db
    .prepare("SELECT * FROM products ORDER BY featured DESC, id DESC")
    .all() as ProductRow[];

  const search = filters?.search?.trim().toLowerCase() ?? "";
  const tag = filters?.tag?.trim().toLowerCase() ?? "";

  return rows
    .map(mapProduct)
    .filter((product) => {
      const matchesSearch =
        !search ||
        product.name.toLowerCase().includes(search) ||
        product.description.toLowerCase().includes(search);
      const matchesTag = !tag || product.tags.includes(tag);
      return matchesSearch && matchesTag;
    });
}

export function listTags(): Tag[] {
  return db.prepare("SELECT id, name FROM tags ORDER BY name").all() as Tag[];
}

export function findUserByCredentials(username: string, password: string) {
  const row = db
    .prepare("SELECT id, username, role FROM users WHERE username = ? AND password = ?")
    .get(username, password) as UserRow | undefined;
  return row ? mapUser(row) : null;
}

export function createUser(username: string, password: string) {
  const result = db
    .prepare("INSERT INTO users(username, password, role) VALUES (?, ?, 'user')")
    .run(username, password);

  const row = db
    .prepare("SELECT id, username, role FROM users WHERE id = ?")
    .get(Number(result.lastInsertRowid)) as UserRow;

  return mapUser(row);
}

export function createSession(userId: number, token: string) {
  db.prepare("INSERT INTO sessions(token, user_id) VALUES (?, ?)").run(token, userId);
}

export function findSessionUser(token: string): SessionUser | null {
  const row = db
    .prepare(
      `
      SELECT u.id, u.username, u.role
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
