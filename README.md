# Che Tiendita - Next.js + TypeScript + SQLite

Migracion de la app original a una sola aplicacion en `Next.js`, con `TypeScript`, rutas API dentro del mismo proyecto y persistencia en `SQLite`.

## Stack

- `Next.js` con `App Router`
- `TypeScript`
- `better-sqlite3`
- Base existente reutilizada: `data/catalog.db`

## Funcionalidades

- Catalogo publico con busqueda y filtro por etiquetas
- Login y registro con sesiones en cookie `HttpOnly`
- Panel admin en `/admin`
- CRUD de productos
- Gestion de etiquetas

## Credenciales iniciales

- `admin / admin123`
- `user / user123`

## Ejecutar

1. Instalar dependencias:

```bash
npm install
```

2. Iniciar en desarrollo:

```bash
npm run dev
```

3. Abrir `http://localhost:3000`

## Notas

- La base `data/catalog.db` se reutiliza y no se pisa si ya tiene datos.
- Si la tabla de productos esta vacia, se carga seed desde `data/products.json`.
