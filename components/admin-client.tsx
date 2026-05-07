"use client";

import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Product, ProductInput, Tag, User } from "@/lib/types";

interface AdminClientProps {
  user: User;
  initialProducts: Product[];
  initialTags: Tag[];
}

type InventorySort = "featured" | "bestselling" | "newest";

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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

export function AdminClient({ user, initialProducts, initialTags }: AdminClientProps) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [tags, setTags] = useState(initialTags);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [productForm, setProductForm] = useState<ProductInput>(EMPTY_FORM);
  const [tagName, setTagName] = useState("");
  const [tagMessage, setTagMessage] = useState("");
  const [productMessage, setProductMessage] = useState("");
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryTag, setInventoryTag] = useState("");
  const [inventorySort, setInventorySort] = useState<InventorySort>("featured");
  const [editorOpen, setEditorOpen] = useState(false);
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // ── SCROLL LOCK: prevent body scroll when any modal is open ──
  useEffect(() => {
    const anyModalOpen = editorOpen || tagModalOpen || tagPickerOpen;
    if (anyModalOpen) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }
    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [editorOpen, tagModalOpen, tagPickerOpen]);

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

  const inventoryProducts = useMemo(() => {
    const normalizedQuery = inventorySearch.trim().toLowerCase();

    const filtered = products.filter((product) => {
      const matchesQuery =
        !normalizedQuery ||
        product.name.toLowerCase().includes(normalizedQuery) ||
        product.description.toLowerCase().includes(normalizedQuery);
      const matchesTag = !inventoryTag || product.tags.includes(inventoryTag);
      return matchesQuery && matchesTag;
    });

    if (inventorySort === "bestselling") {
      return filtered.sort((a, b) => b.soldCount - a.soldCount || b.id - a.id);
    }

    if (inventorySort === "newest") {
      return filtered.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || b.id - a.id,
      );
    }

    return filtered.sort((a, b) => Number(b.featured) - Number(a.featured) || b.id - a.id);
  }, [inventorySearch, inventorySort, inventoryTag, products]);

  async function refreshAdminData() {
    const [productsResponse, tagsResponse] = await Promise.all([
      fetch(`/api/products?sort=${inventorySort}`, { cache: "no-store" }),
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
    setTagMessage("");
    setEditorOpen(false);
    setTagPickerOpen(false);
  }

  function openCreateProductModal() {
    setEditingId(null);
    setProductForm(EMPTY_FORM);
    setProductMessage("");
    setTagMessage("");
    setTagPickerOpen(false);
    setEditorOpen(true);
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
    setTagMessage("");
    setEditorOpen(true);
    setProductForm({
      name: product.name,
      description: product.description,
      price: product.price,
      image: product.image,
      featured: product.featured,
      tags: product.tags,
    });
  }

  function submitTag() {
    setTagMessage("");

    startTransition(async () => {
      const response = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: tagName }),
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string; tag?: Tag };
      if (!response.ok) {
        setTagMessage(ERROR_MESSAGES[data.error || "default"]);
        return;
      }

      const createdTag = data.tag?.name;
      if (createdTag) {
        setProductForm((current) => ({
          ...current,
          tags: current.tags.includes(createdTag) ? current.tags : [...current.tags, createdTag],
        }));
      }

      setTagName("");
      setTagMessage("Etiqueta creada y seleccionada.");
      setTagModalOpen(false);
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
      <section className="admin-hero admin-hero-compact">
        <div>
          <p className="section-overline">Panel admin</p>
          <h1>Gestion boutique para un catalogo mas serio y ordenado.</h1>
          <p>
            Sesion activa: <strong>{user.username}</strong>. Ordena productos, asigna etiquetas y
            encuentra rapido cada pieza del inventario.
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

      <section className="admin-panel">
        <div className="panel-heading">
          <div>
            <p className="section-overline">Inventario</p>
            <h2>Productos cargados</h2>
          </div>
          <button className="primary-button" type="button" onClick={openCreateProductModal}>
            Nuevo producto
          </button>
        </div>

        <div className="inventory-toolbar">
          <input
            type="search"
            value={inventorySearch}
            onChange={(event) => setInventorySearch(event.target.value)}
            placeholder="Buscar por nombre o descripcion"
          />
          <select value={inventoryTag} onChange={(event) => setInventoryTag(event.target.value)}>
            <option value="">Todas las etiquetas</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.name}>
                {tag.name}
              </option>
            ))}
          </select>
          <select
            value={inventorySort}
            onChange={(event) => setInventorySort(event.target.value as InventorySort)}
          >
            <option value="featured">Primero destacados</option>
            <option value="bestselling">Mas vendidos</option>
            <option value="newest">Mas nuevos</option>
          </select>
        </div>

        <div className="results-row">
          <p>{inventoryProducts.length} producto(s)</p>
        </div>

        <div className="inventory-list">
          {inventoryProducts.map((product) => (
            <article key={product.id} className="inventory-card">
              <div className="inventory-preview">
                <div
                  className="inventory-media"
                  style={{ backgroundImage: `url(${product.image})` }}
                />
                <div>
                  <div className="inventory-title-row">
                    <h3>{product.name}</h3>
                    {product.featured ? <span className="featured-badge">Destacado</span> : null}
                  </div>
                  <p>{product.description}</p>
                  <div className="inventory-meta-row">
                    <span className="session-pill">{product.soldCount} vendidos</span>
                    <span className="session-pill">
                      {new Date(product.createdAt).toLocaleDateString("es-AR")}
                    </span>
                  </div>
                  <div className="tag-row">
                    {product.tags.map((tag) => (
                      <span key={tag} className="tag-chip">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="inventory-actions">
                <strong>{formatCurrency(product.price)}</strong>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => editProduct(product)}
                >
                  Editar
                </button>
                <button
                  className="danger-button"
                  type="button"
                  onClick={() => removeProduct(product.id)}
                >
                  Eliminar
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {editorOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={resetProductForm}>
          <div
            className="modal-card modal-card-editor"
            role="dialog"
            aria-modal="true"
            aria-label="Editar producto"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <p className="section-overline">Editor</p>
                <h2>{editingId ? "Editar producto" : "Nuevo producto"}</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={resetProductForm}
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            <form className="stack-form editor-form-modal" onSubmit={submitProduct}>
              <div className="editor-grid">
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
              </div>
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

              <div className="inline-heading">
                <div>
                  <p className="section-overline">Etiquetas</p>
                  <h3 className="subsection-title">Elegi etiquetas sin recargar el formulario</h3>
                </div>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setTagPickerOpen(true)}
                >
                  Elegir etiquetas
                </button>
              </div>

              <div className="tag-selection-summary">
                {productForm.tags.length > 0 ? (
                  <div className="tag-row">
                    {productForm.tags.map((tag) => (
                      <span key={tag} className="tag-chip">
                        #{tag}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="helper-text">Todavia no hay etiquetas seleccionadas.</p>
                )}
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
            <p className={`feedback ${tagMessage || productMessage ? "visible" : ""}`}>
              {productMessage || tagMessage}
            </p>
          </div>
        </div>
      ) : null}

      {tagModalOpen ? (
        <div
          className="modal-backdrop modal-backdrop-front"
          role="presentation"
          onClick={() => {
            setTagModalOpen(false);
            setTagMessage("");
          }}
        >
          <div
            className="modal-card modal-card-tag"
            role="dialog"
            aria-modal="true"
            aria-label="Crear etiqueta"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <p className="section-overline">Etiquetas</p>
                <h2>Nueva etiqueta</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={() => {
                  setTagModalOpen(false);
                  setTagMessage("");
                }}
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>
            <div className="mini-form-card stack-form">
              <input
                type="text"
                value={tagName}
                onChange={(event) => setTagName(event.target.value)}
                placeholder="Ej: aromas"
                required
              />
              <div className="inline-actions">
                <button
                  className="primary-button"
                  type="button"
                  disabled={isPending}
                  onClick={submitTag}
                >
                  Guardar etiqueta
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    setTagModalOpen(false);
                    setTagMessage("");
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
            <p className={`feedback ${tagMessage ? "visible" : ""}`}>{tagMessage}</p>
          </div>
        </div>
      ) : null}

      {tagPickerOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setTagPickerOpen(false)}
        >
          <div
            className="modal-card modal-card-tag-picker"
            role="dialog"
            aria-modal="true"
            aria-label="Elegir etiquetas"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <p className="section-overline">Etiquetas</p>
                <h2>Asignar etiquetas al producto</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={() => setTagPickerOpen(false)}
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            <div className="tag-picker-header">
              <p className="helper-text">
                Seleccionadas: <strong>{productForm.tags.length}</strong>
              </p>
              <div className="inline-actions inline-actions-tight">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    setTagMessage("");
                    setTagModalOpen(true);
                  }}
                >
                  Crear nueva etiqueta
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setProductForm((current) => ({ ...current, tags: [] }))}
                >
                  Limpiar
                </button>
                <button className="primary-button" type="button" onClick={() => setTagPickerOpen(false)}>
                  Listo
                </button>
              </div>
            </div>

            <div className="tag-picker-grid">
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
          </div>
        </div>
      ) : null}
    </main>
  );
}
