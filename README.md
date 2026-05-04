# Che Tiendita - Catalogo con BD

Ahora el proyecto usa **base de datos real SQLite** (`data/catalog.db`) con backend en Python.

## Lo que pediste

- Login con roles `admin` y `user`.
- Panel admin en **otra pagina**: `admin.html`.
- CRUD de productos desde admin.
- Atributos (etiquetas) como `electros`, `entretenimiento`, `ninos`.
- Esos atributos los crea el admin y se usan para filtrar en busqueda.

## Credenciales iniciales

- admin / admin123
- user / user123

## Ejecutar

1. Tener Python 3 instalado.
2. Desde la carpeta del proyecto:

```bash
python server.py
```

3. Abrir:
- Catalogo: `http://localhost:8000/index.html`
- Admin: `http://localhost:8000/admin.html`

Importante: no abras `index.html` directo con doble click (`file://...`), porque el login/registro necesita la API en `http://localhost:8000`.

## Base de datos

- Archivo: `data/catalog.db`
- Tablas: `users`, `sessions`, `tags`, `products`, `product_tags`

## Notas

- Si no hay productos en BD, toma semilla inicial desde `data/products.json`.
- La autenticacion es simple (sin hash) para entorno demo. En produccion se recomienda hash de passwords.
