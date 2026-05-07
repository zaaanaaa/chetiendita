"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Product, ProductInput, Tag, User } from "@/lib/types";

interface AdminClientProps {
  user: User;
  initialProducts: Product[];
  initialTags: Tag[];
}

const ERROR_MESSAGES: Record<string, string> = {
  name_required: "La etiqueta no puede estar vacia.",
  tag_exists: "Esa etiqueta ya existe.",
  missing_fields: "Completa todos los campos del producto.",
  invalid_price: "El precio debe ser mayor a cero.",
  invalid_image_url: "La imagen debe ser una URL valida.",
  default: "No se pudo guardar. Intenta otra vez.",
};

const EMPTY_FORM: ProductInput = {
  name: "",
  description: "",
  price: 0,
  image: "",
  featured: false,
  tags: [],
};

export function AdminClient({ user, initialProducts, initialTags }: AdminClientProps) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [tags, setTags] = useState(initialTags);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [productForm, setProductForm] = useState<ProductInput>(EMPTY_FORM);
  const [tagName, setTagName] = useState("");
  const [tagMessage, setTagMessage] = useState("");
  const [productMessage, setProductMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const stats = useMemo(
    () => [
      { label: "Productos", value: String(products.length).padStart(2, "0") },
      { label: "Etiquetas", value: String(tags.length).padStart(2, "0") },
      {
        label: "Destacados",
        value: String(products.filter((product) => product.featured).length).padStart(2, "0"),
      },
    ],
    [products, tags],
  );

  async function refreshAdminData() {
    const [productsResponse, tagsResponse] = await Promise.all([
      fetch("/api/products", { cache: "no-store" }),
      fetch("/api/tags", { cache: "no-store" }),
    ]);

    const productsData = (await productsResponse.json()) as { products: Product[] };
    const tagsData = (await tagsResponse.json()) as { tags: Tag[] };
    setProducts(productsData.products);
    setTags(tagsData.tags);
  }

  function resetProductForm() {
    setEditingId(null);
    setProductForm(EMPTY_FORM);
    setProductMessage("");
  }

  function toggleTag(tagNameValue: string) {
    setProductForm((current) => {
      const exists = current.tags.includes(tagNameValue);
      return {
        ...current,
        tags: exists
          ? current.tags.filter((tag) => tag !== tagNameValue)
          : [...current.tags, tagNameValue],
      };
    });
  }

  function editProduct(product: Product) {
    setEditingId(product.id);
    setProductMessage("");
    setProductForm({
      name: product.name,
      description: product.description,
      price: product.price,
      image: product.image,
      featured: product.featured,
      tags: product.tags,
    });
  }

  function submitTag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTagMessage("");

    startTransition(async () => {
      const response = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: tagName }),
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setTagMessage(ERROR_MESSAGES[data.error || "default"]);
        return;
      }

      setTagName("");
      setTagMessage("Etiqueta creada.");
      await refreshAdminData();
    });
  }

  function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProductMessage("");

    startTransition(async () => {
      const endpoint = editingId ? `/api/products/${editingId}` : "/api/products";
      const method = editingId ? "PUT" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productForm),
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setProductMessage(ERROR_MESSAGES[data.error || "default"]);
        return;
      }

      await refreshAdminData();
      resetProductForm();
    });
  }

  function removeProduct(productId: number) {
    startTransition(async () => {
      await fetch(`/api/products/${productId}`, { method: "DELETE" });
      await refreshAdminData();
      if (editingId === productId) {
        resetProductForm();
      }
    });
  }

  function logout() {
    startTransition(async () => {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    });
  }

  return (
    <main className="admin-shell">
      <section className="admin-hero">
        <div>
          <p className="section-overline">Panel admin</p>
          <h1>Gestion boutique para un catalogo mas serio y ordenado.</h1>
          <p>
            Sesion activa: <strong>{user.username}</strong>. Desde aca administras etiquetas,
            productos destacados y la presentacion visual del catalogo.
          </p>
        </div>
        <div className="admin-actions-row">
          <button className="secondary-button" type="button" onClick={() => router.push("/")}>
            Ver tienda
          </button>
          <button className="secondary-button" type="button" onClick={logout}>
            Cerrar sesion
          </button>
        </div>
      </section>

      <section className="stats-grid">
        {stats.map((stat) => (
          <article key={stat.label} className="stat-card">
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </article>
        ))}
      </section>

      <section className="admin-grid">
        <article className="admin-panel">
          <div className="panel-heading">
            <div>
              <p className="section-overline">Etiquetas</p>
              <h2>Categorias y atributos</h2>
            </div>
          </div>
          <form className="stack-form" onSubmit={submitTag}>
            <input
              type="text"
              value={tagName}
              onChange={(event) => setTagName(event.target.value)}
              placeholder="Ej: aromas"
              required
            />
            <button className="primary-button" type="submit" disabled={isPending}>
              Crear etiqueta
            </button>
          </form>
          <p className={`feedback ${tagMessage ? "visible" : ""}`}>{tagMessage}</p>
          <div className="tag-cloud">
            {tags.map((tag) => (
              <span key={tag.id} className="tag-chip">
                #{tag.name}
              </span>
            ))}
          </div>
        </article>

        <article className="admin-panel">
          <div className="panel-heading">
            <div>
              <p className="section-overline">Editor</p>
              <h2>{editingId ? "Editar producto" : "Nuevo producto"}</h2>
            </div>
          </div>
          <form className="stack-form" onSubmit={submitProduct}>
            <input
              type="text"
              value={productForm.name}
              onChange={(event) => setProductForm({ ...productForm, name: event.target.value })}
              placeholder="Nombre"
              required
            />
            <input
              type="number"
              min={1}
              value={productForm.price || ""}
              onChange={(event) =>
                setProductForm({ ...productForm, price: Number(event.target.value) })
              }
              placeholder="Precio"
              required
            />
            <input
              type="url"
              value={productForm.image}
              onChange={(event) => setProductForm({ ...productForm, image: event.target.value })}
              placeholder="URL de imagen"
              required
            />
            <textarea
              rows={4}
              value={productForm.description}
              onChange={(event) =>
                setProductForm({ ...productForm, description: event.target.value })
              }
              placeholder="Descripcion"
              required
            />
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={productForm.featured}
                onChange={(event) =>
                  setProductForm({ ...productForm, featured: event.target.checked })
                }
              />
              Marcar como destacado
            </label>
            <div className="checkbox-grid">
              {tags.map((tag) => (
                <label key={tag.id} className="checkbox-chip">
                  <input
                    type="checkbox"
                    checked={productForm.tags.includes(tag.name)}
                    onChange={() => toggleTag(tag.name)}
                  />
                  <span>{tag.name}</span>
                </label>
              ))}
            </div>
            <div className="inline-actions">
              <button className="primary-button" type="submit" disabled={isPending}>
                {editingId ? "Guardar cambios" : "Crear producto"}
              </button>
              <button className="secondary-button" type="button" onClick={resetProductForm}>
                Cancelar
              </button>
            </div>
          </form>
          <p className={`feedback ${productMessage ? "visible" : ""}`}>{productMessage}</p>
        </article>
      </section>

      <section className="admin-panel">
        <div className="panel-heading">
          <div>
            <p className="section-overline">Inventario</p>
            <h2>Productos cargados</h2>
          </div>
        </div>
        <div className="inventory-list">
          {products.map((product) => (
            <article key={product.id} className="inventory-card">
              <div>
                <div className="inventory-title-row">
                  <h3>{product.name}</h3>
                  {product.featured ? <span className="featured-badge">Destacado</span> : null}
                </div>
                <p>{product.description}</p>
                <div className="tag-row">
                  {product.tags.map((tag) => (
                    <span key={tag} className="tag-chip">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="inventory-actions">
                <strong>
                  {new Intl.NumberFormat("es-AR", {
                    style: "currency",
                    currency: "ARS",
                    maximumFractionDigits: 0,
                  }).format(product.price)}
                </strong>
                <button className="secondary-button" type="button" onClick={() => editProduct(product)}>
                  Editar
                </button>
                <button className="danger-button" type="button" onClick={() => removeProduct(product.id)}>
                  Eliminar
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
