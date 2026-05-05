import json
import os
import secrets
import sqlite3
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

ROOT = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(ROOT, "data", "catalog.db")


def db():
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA busy_timeout=30000;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn


def init_db():
    conn = db()
    cur = conn.cursor()
    cur.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('admin', 'user'))
        );
        CREATE TABLE IF NOT EXISTS sessions (
          token TEXT PRIMARY KEY,
          user_id INTEGER NOT NULL,
          FOREIGN KEY(user_id) REFERENCES users(id)
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
        """
    )
    conn.commit()

    cur.execute("SELECT COUNT(*) c FROM users")
    if cur.fetchone()["c"] == 0:
        cur.execute("INSERT INTO users(username,password,role) VALUES ('admin','admin123','admin')")
        cur.execute("INSERT INTO users(username,password,role) VALUES ('user','user123','user')")
        conn.commit()

    cur.execute("SELECT COUNT(*) c FROM products")
    if cur.fetchone()["c"] == 0:
        products_path = os.path.join(ROOT, "data", "products.json")
        if os.path.exists(products_path):
            with open(products_path, "r", encoding="utf-8-sig") as f:
                items = json.load(f)
            for p in items:
                cur.execute(
                    "INSERT INTO products(name,description,price,image,featured) VALUES (?,?,?,?,?)",
                    (p["name"], p["description"], int(p["price"]), p["image"], 1 if p.get("featured") else 0),
                )
                pid = cur.lastrowid
                default_tag = p.get("category", "general").lower().strip()
                cur.execute("INSERT OR IGNORE INTO tags(name) VALUES(?)", (default_tag,))
                cur.execute("SELECT id FROM tags WHERE name=?", (default_tag,))
                tid = cur.fetchone()["id"]
                cur.execute("INSERT OR IGNORE INTO product_tags(product_id,tag_id) VALUES(?,?)", (pid, tid))
            conn.commit()
    conn.close()


def product_with_tags(conn, row):
    cur = conn.cursor()
    cur.execute(
        """
        SELECT t.name
        FROM tags t
        JOIN product_tags pt ON pt.tag_id=t.id
        WHERE pt.product_id=?
        ORDER BY t.name
        """,
        (row["id"],),
    )
    tags = [r["name"] for r in cur.fetchall()]
    return {
        "id": row["id"],
        "name": row["name"],
        "description": row["description"],
        "price": row["price"],
        "image": row["image"],
        "featured": bool(row["featured"]),
        "tags": tags,
    }


class Handler(SimpleHTTPRequestHandler):
    def _json(self, status, payload):
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _body(self):
        size = int(self.headers.get("Content-Length", "0"))
        if size == 0:
            return {}
        return json.loads(self.rfile.read(size).decode("utf-8"))

    def _token(self):
        auth = self.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            return auth[7:]
        return ""

    def _current_user(self):
        token = self._token()
        if not token:
            return None
        conn = db()
        cur = conn.cursor()
        cur.execute(
            """
            SELECT u.id, u.username, u.role
            FROM sessions s
            JOIN users u ON u.id=s.user_id
            WHERE s.token=?
            """,
            (token,),
        )
        row = cur.fetchone()
        conn.close()
        if not row:
            return None
        return {"id": row["id"], "username": row["username"], "role": row["role"], "token": token}

    def _require_auth(self):
        user = self._current_user()
        if not user:
            self._json(401, {"error": "unauthorized"})
            return None
        return user

    def _require_admin(self):
        user = self._require_auth()
        if not user:
            return None
        if user["role"] != "admin":
            self._json(403, {"error": "forbidden"})
            return None
        return user

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/register":
            data = self._body()
            username = data.get("username", "").strip()
            password = data.get("password", "").strip()
            if len(username) < 4 or len(password) < 4:
                return self._json(400, {"error": "invalid_input"})
            conn = db()
            try:
                conn.execute(
                    "INSERT INTO users(username,password,role) VALUES (?,?,?)",
                    (username, password, "user"),
                )
                conn.commit()
            except sqlite3.IntegrityError:
                conn.close()
                return self._json(400, {"error": "username_exists"})
            conn.close()
            return self._json(201, {"ok": True})

        if parsed.path == "/api/login":
            data = self._body()
            conn = db()
            cur = conn.cursor()
            cur.execute(
                "SELECT id, username, role FROM users WHERE username=? AND password=?",
                (data.get("username", ""), data.get("password", "")),
            )
            row = cur.fetchone()
            if not row:
                conn.close()
                return self._json(401, {"error": "invalid_credentials"})
            token = secrets.token_hex(24)
            cur.execute("INSERT INTO sessions(token,user_id) VALUES (?,?)", (token, row["id"]))
            conn.commit()
            conn.close()
            return self._json(200, {"token": token, "user": {"username": row["username"], "role": row["role"]}})

        if parsed.path == "/api/logout":
            user = self._require_auth()
            if not user:
                return
            conn = db()
            conn.execute("DELETE FROM sessions WHERE token=?", (user["token"],))
            conn.commit()
            conn.close()
            return self._json(200, {"ok": True})

        if parsed.path == "/api/tags":
            if not self._require_admin():
                return
            data = self._body()
            name = data.get("name", "").strip().lower()
            if not name:
                return self._json(400, {"error": "name_required"})
            conn = db()
            try:
                conn.execute("INSERT INTO tags(name) VALUES(?)", (name,))
                conn.commit()
            except sqlite3.IntegrityError:
                conn.close()
                return self._json(400, {"error": "tag_exists"})
            conn.close()
            return self._json(201, {"ok": True})

        if parsed.path == "/api/products":
            if not self._require_admin():
                return
            data = self._body()
            tags = data.get("tags", [])
            conn = db()
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO products(name,description,price,image,featured) VALUES(?,?,?,?,?)",
                (
                    data.get("name", "").strip(),
                    data.get("description", "").strip(),
                    int(data.get("price", 0)),
                    data.get("image", "").strip(),
                    1 if data.get("featured") else 0,
                ),
            )
            pid = cur.lastrowid
            for tag in tags:
                cur.execute("SELECT id FROM tags WHERE name=?", (tag,))
                trow = cur.fetchone()
                if trow:
                    cur.execute("INSERT OR IGNORE INTO product_tags(product_id,tag_id) VALUES(?,?)", (pid, trow["id"]))
            conn.commit()
            conn.close()
            return self._json(201, {"ok": True})

        self._json(404, {"error": "not_found"})

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/me":
            user = self._require_auth()
            if not user:
                return
            return self._json(200, {"user": {"username": user["username"], "role": user["role"]}})

        if parsed.path == "/api/tags":
            conn = db()
            cur = conn.cursor()
            cur.execute("SELECT id,name FROM tags ORDER BY name")
            tags = [{"id": r["id"], "name": r["name"]} for r in cur.fetchall()]
            conn.close()
            return self._json(200, {"tags": tags})

        if parsed.path == "/api/products":
            params = parse_qs(parsed.query)
            search = params.get("search", [""])[0].strip().lower()
            tag = params.get("tag", [""])[0].strip().lower()
            conn = db()
            cur = conn.cursor()
            cur.execute("SELECT * FROM products ORDER BY id DESC")
            rows = cur.fetchall()
            products = [product_with_tags(conn, r) for r in rows]
            conn.close()
            if search:
                products = [p for p in products if search in p["name"].lower() or search in p["description"].lower()]
            if tag:
                products = [p for p in products if tag in p["tags"]]
            return self._json(200, {"products": products})

        return super().do_GET()

    def do_PUT(self):
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/api/products/"):
            return self._json(404, {"error": "not_found"})
        if not self._require_admin():
            return
        pid = int(parsed.path.split("/")[-1])
        data = self._body()
        conn = db()
        conn.execute(
            "UPDATE products SET name=?,description=?,price=?,image=?,featured=? WHERE id=?",
            (
                data.get("name", "").strip(),
                data.get("description", "").strip(),
                int(data.get("price", 0)),
                data.get("image", "").strip(),
                1 if data.get("featured") else 0,
                pid,
            ),
        )
        conn.execute("DELETE FROM product_tags WHERE product_id=?", (pid,))
        for tag in data.get("tags", []):
            row = conn.execute("SELECT id FROM tags WHERE name=?", (tag,)).fetchone()
            if row:
                conn.execute("INSERT OR IGNORE INTO product_tags(product_id,tag_id) VALUES(?,?)", (pid, row["id"]))
        conn.commit()
        conn.close()
        self._json(200, {"ok": True})

    def do_DELETE(self):
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/api/products/"):
            return self._json(404, {"error": "not_found"})
        if not self._require_admin():
            return
        pid = int(parsed.path.split("/")[-1])
        conn = db()
        conn.execute("DELETE FROM product_tags WHERE product_id=?", (pid,))
        conn.execute("DELETE FROM products WHERE id=?", (pid,))
        conn.commit()
        conn.close()
        self._json(200, {"ok": True})


if __name__ == "__main__":
    os.chdir(ROOT)
    if os.path.exists(DB_PATH) and os.path.getsize(DB_PATH) == 0:
        os.remove(DB_PATH)
    init_db()
    port = 8000
    print(f"Servidor en http://localhost:{port}")
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()
