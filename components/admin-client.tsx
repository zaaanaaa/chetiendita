"use client";

import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Product, ProductInput, Tag, User, Order, OrderStatus } from "@/lib/types";

interface AdminClientProps {
  user: User;
  initialProducts: Product[];
  initialTags: Tag[];
}

type InventorySort = "featured" | "bestselling" | "newest";
type AdminTab = "inventory" | "orders";

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
  variants: [],
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pendiente",
  accepted: "Aceptado",
  modified: "Modificado",
  rejected: "Rechazado",
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: "badge-pending",
  accepted: "badge-accepted",
  modified: "badge-modified",
  rejected: "badge-rejected",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
}

export function AdminClient({ user, initialProducts, initialTags }: AdminClientProps) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [tags, setTags] = useState(initialTags);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<AdminTab>("inventory");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [productForm, setProductForm] = useState<ProductInput>(EMPTY_FORM);
  const [variantInput, setVariantInput] = useState("");
  const [tagName, setTagName] = useState("");
  const [tagMessage, setTagMessage] = useState("");
  const [productMessage, setProductMessage] = useState("");
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryTag, setInventoryTag] = useState("");
  const [inventorySort, setInventorySort] = useState<InventorySort>("featured");
  const [editorOpen, setEditorOpen] = useState(false);
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const anyModalOpen = editorOpen || tagModalOpen || tagPickerOpen || !!selectedOrder;
    if (anyModalOpen) { document.body.classList.add("modal-open"); }
    else { document.body.classList.remove("modal-open"); }
    return () => { document.body.classList.remove("modal-open"); };
  }, [editorOpen, tagModalOpen, tagPickerOpen, selectedOrder]);

  useEffect(() => {
    if (activeTab === "orders") { loadOrders(); }
  }, [activeTab]);

  const stats = useMemo(() => [
    { label: "Productos", value: String(products.length).padStart(2, "0") },
    { label: "Etiquetas", value: String(tags.length).padStart(2, "0") },
    { label: "Pedidos", value: String(orders.length).padStart(2, "0") },
  ], [products, tags, orders]);

  const inventoryProducts = useMemo(() => {
    const q = inventorySearch.trim().toLowerCase();
    const filtered = products.filter((p) => {
      const mq = !q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
      const mt = !inventoryTag || p.tags.includes(inventoryTag);
      return mq && mt;
    });
    if (inventorySort === "bestselling") return filtered.sort((a, b) => b.soldCount - a.soldCount || b.id - a.id);
    if (inventorySort === "newest") return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || b.id - a.id);
    return filtered.sort((a, b) => Number(b.featured) - Number(a.featured) || b.id - a.id);
  }, [inventorySearch, inventorySort, inventoryTag, products]);

  async function refreshAdminData() {
    const [pr, tr] = await Promise.all([
      fetch(`/api/products?sort=${inventorySort}`, { cache: "no-store" }),
      fetch("/api/tags", { cache: "no-store" }),
    ]);
    const pd = (await pr.json()) as { products: Product[] };
    const td = (await tr.json()) as { tags: Tag[] };
    setProducts(pd.products);
    setTags(td.tags);
  }

  async function loadOrders() {
    try {
      const r = await fetch("/api/orders", { cache: "no-store" });
      const d = (await r.json()) as { orders: Order[] };
      setOrders(d.orders || []);
    } catch { /* ignore */ }
  }

  function resetProductForm() {
    setEditingId(null); setProductForm(EMPTY_FORM); setProductMessage(""); setTagMessage("");
    setEditorOpen(false); setTagPickerOpen(false); setVariantInput("");
  }

  function openCreateProductModal() {
    setEditingId(null); setProductForm(EMPTY_FORM); setProductMessage(""); setTagMessage("");
    setTagPickerOpen(false); setVariantInput(""); setEditorOpen(true);
  }

  function toggleTag(tn: string) {
    setProductForm((c) => ({ ...c, tags: c.tags.includes(tn) ? c.tags.filter((t) => t !== tn) : [...c.tags, tn] }));
  }

  function editProduct(p: Product) {
    setEditingId(p.id); setProductMessage(""); setTagMessage(""); setEditorOpen(true);
    setVariantInput("");
    setProductForm({ name: p.name, description: p.description, price: p.price, image: p.image, featured: p.featured, tags: p.tags, variants: p.variants || [] });
  }

  function addVariant() {
    const v = variantInput.trim();
    if (!v) return;
    setProductForm((c) => ({ ...c, variants: [...(c.variants || []), v] }));
    setVariantInput("");
  }

  function removeVariant(idx: number) {
    setProductForm((c) => ({ ...c, variants: (c.variants || []).filter((_, i) => i !== idx) }));
  }

  function submitTag() {
    setTagMessage("");
    startTransition(async () => {
      const r = await fetch("/api/tags", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: tagName }) });
      const d = (await r.json().catch(() => ({}))) as { error?: string; tag?: Tag };
      if (!r.ok) { setTagMessage(ERROR_MESSAGES[d.error || "default"]); return; }
      const ct = d.tag?.name;
      if (ct) { setProductForm((c) => ({ ...c, tags: c.tags.includes(ct) ? c.tags : [...c.tags, ct] })); }
      setTagName(""); setTagMessage("Etiqueta creada."); setTagModalOpen(false);
      await refreshAdminData();
    });
  }

  function submitProduct(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setProductMessage("");
    startTransition(async () => {
      const endpoint = editingId ? `/api/products/${editingId}` : "/api/products";
      const method = editingId ? "PUT" : "POST";
      const r = await fetch(endpoint, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(productForm) });
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) { setProductMessage(ERROR_MESSAGES[d.error || "default"]); return; }
      await refreshAdminData(); resetProductForm();
    });
  }

  function removeProduct(pid: number) {
    startTransition(async () => {
      await fetch(`/api/products/${pid}`, { method: "DELETE" });
      await refreshAdminData();
      if (editingId === pid) resetProductForm();
    });
  }

  function updateOrder(orderId: number, status: OrderStatus) {
    startTransition(async () => {
      await fetch(`/api/orders/${orderId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      await loadOrders();
      setSelectedOrder(null);
    });
  }

  function logout() {
    startTransition(async () => {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/"); router.refresh();
    });
  }

  return (
    <>
      {/* Admin Navbar - Landing style */}
      <nav className="navbar">
        <div className="navbar-content">
          <Link href="/" className="navbar-logo">
            <span className="logo-mark">CT</span>
            <span className="logo-text">Che Tiendita</span>
          </Link>
          <div className="navbar-center">
            <div className="navbar-menu">
              <button type="button" className={`nav-link ${activeTab === "inventory" ? "active" : ""}`} onClick={() => setActiveTab("inventory")}>Inventario</button>
              <button type="button" className={`nav-link ${activeTab === "orders" ? "active" : ""}`} onClick={() => setActiveTab("orders")}>Pedidos</button>
            </div>
            <div className="navbar-actions">
              <Link href="/" className="nav-btn nav-btn-ghost">Ver tienda</Link>
              <span className="nav-user-badge">{user.username}</span>
              <button className="nav-btn nav-btn-ghost" type="button" onClick={logout}>Salir</button>
            </div>
          </div>
        </div>
      </nav>

      <main className="admin-shell">
        {/* Stats */}
        <section className="stats-grid">
          {stats.map((s) => (
            <article key={s.label} className="stat-card">
              <span>{s.label}</span>
              <strong>{s.value}</strong>
            </article>
          ))}
        </section>

        {/* INVENTORY TAB */}
        {activeTab === "inventory" && (
          <section className="admin-panel">
            <div className="panel-heading">
              <div>
                <p className="section-overline">Inventario</p>
                <h2>Productos cargados</h2>
              </div>
              <button className="primary-button" type="button" onClick={openCreateProductModal}>Nuevo producto</button>
            </div>
            <div className="inventory-toolbar">
              <input type="search" value={inventorySearch} onChange={(e) => setInventorySearch(e.target.value)} placeholder="Buscar por nombre..." />
              <select value={inventoryTag} onChange={(e) => setInventoryTag(e.target.value)}>
                <option value="">Todas las etiquetas</option>
                {tags.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
              <select value={inventorySort} onChange={(e) => setInventorySort(e.target.value as InventorySort)}>
                <option value="featured">Destacados</option>
                <option value="bestselling">Más vendidos</option>
                <option value="newest">Más nuevos</option>
              </select>
            </div>
            <div className="results-row"><p>{inventoryProducts.length} producto(s)</p></div>
            <div className="inventory-list">
              {inventoryProducts.map((p) => (
                <article key={p.id} className="inventory-card">
                  <div className="inventory-preview">
                    <div className="inventory-media" style={{ backgroundImage: `url(${p.image})` }} />
                    <div>
                      <div className="inventory-title-row">
                        <h3>{p.name}</h3>
                        {p.featured ? <span className="featured-badge">Destacado</span> : null}
                      </div>
                      <p>{p.description}</p>
                      <div className="inventory-meta-row">
                        <span className="session-pill">{p.soldCount} vendidos</span>
                        <span className="session-pill">{new Date(p.createdAt).toLocaleDateString("es-AR")}</span>
                      </div>
                      <div className="tag-row">
                        {p.tags.map((t) => <span key={t} className="tag-chip">#{t}</span>)}
                      </div>
                      {p.variants.length > 0 && (
                        <div className="tag-row" style={{ marginTop: "0.3rem" }}>
                          {p.variants.map((v) => <span key={v} className="variant-chip-sm">{v}</span>)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="inventory-actions">
                    <strong>{formatCurrency(p.price)}</strong>
                    <button className="secondary-button" type="button" onClick={() => editProduct(p)}>Editar</button>
                    <button className="danger-button" type="button" onClick={() => removeProduct(p.id)}>Eliminar</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* ORDERS TAB */}
        {activeTab === "orders" && (
          <section className="admin-panel">
            <div className="panel-heading">
              <div>
                <p className="section-overline">Pedidos</p>
                <h2>Gestión de pedidos</h2>
              </div>
              <button className="secondary-button" type="button" onClick={loadOrders}>Actualizar</button>
            </div>
            {orders.length === 0 ? (
              <div className="empty-state"><h3>No hay pedidos todavía</h3><p>Los pedidos de los clientes aparecerán acá.</p></div>
            ) : (
              <div className="orders-list">
                {orders.map((o) => (
                  <article key={o.id} className="order-card" onClick={() => setSelectedOrder(o)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setSelectedOrder(o)}>
                    <div className="order-card-main">
                      <div className="order-card-header">
                        <h3>Pedido #{o.id}</h3>
                        <span className={`order-badge ${STATUS_COLORS[o.status]}`}>{STATUS_LABELS[o.status]}</span>
                      </div>
                      <p className="order-customer">{o.customerName}{o.customerPhone ? ` · ${o.customerPhone}` : ""}</p>
                      <p className="order-date">{new Date(o.createdAt).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                    <div className="order-card-total">
                      <span>{o.items.length} item(s)</span>
                      <strong>{formatCurrency(o.total)}</strong>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Product Editor Modal */}
      {editorOpen && (
        <div className="modal-backdrop" role="presentation" onClick={resetProductForm}>
          <div className="modal-card modal-card-editor" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div><p className="section-overline">Editor</p><h2>{editingId ? "Editar producto" : "Nuevo producto"}</h2></div>
              <button className="icon-button" type="button" onClick={resetProductForm} aria-label="Cerrar">×</button>
            </div>
            <form className="stack-form editor-form-modal" onSubmit={submitProduct}>
              <div className="editor-grid">
                <input type="text" value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} placeholder="Nombre" required />
                <input type="number" min={1} value={productForm.price || ""} onChange={(e) => setProductForm({ ...productForm, price: Number(e.target.value) })} placeholder="Precio" required />
              </div>
              <input type="url" value={productForm.image} onChange={(e) => setProductForm({ ...productForm, image: e.target.value })} placeholder="URL de imagen" required />
              <textarea rows={4} value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} placeholder="Descripcion" required />
              <label className="checkbox-row"><input type="checkbox" checked={productForm.featured} onChange={(e) => setProductForm({ ...productForm, featured: e.target.checked })} />Marcar como destacado</label>

              {/* Variants */}
              <div className="inline-heading">
                <div><p className="section-overline">Variantes / Modelos</p><h3 className="subsection-title">Ej: colores, talles</h3></div>
              </div>
              <div className="variant-editor">
                <input type="text" value={variantInput} onChange={(e) => setVariantInput(e.target.value)} placeholder="Ej: Rojo" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addVariant(); } }} />
                <button className="secondary-button" type="button" onClick={addVariant}>Agregar</button>
              </div>
              {(productForm.variants || []).length > 0 && (
                <div className="tag-row">{(productForm.variants || []).map((v, i) => (
                  <span key={i} className="tag-chip" style={{ cursor: "pointer" }} onClick={() => removeVariant(i)}>
                    {v} ×
                  </span>
                ))}</div>
              )}

              {/* Tags */}
              <div className="inline-heading">
                <div><p className="section-overline">Etiquetas</p><h3 className="subsection-title">Elegí etiquetas</h3></div>
                <button className="secondary-button" type="button" onClick={() => setTagPickerOpen(true)}>Elegir etiquetas</button>
              </div>
              <div className="tag-selection-summary">
                {productForm.tags.length > 0 ? (
                  <div className="tag-row">{productForm.tags.map((t) => <span key={t} className="tag-chip">#{t}</span>)}</div>
                ) : (<p className="helper-text">No hay etiquetas seleccionadas.</p>)}
              </div>

              <div className="inline-actions">
                <button className="primary-button" type="submit" disabled={isPending}>{editingId ? "Guardar cambios" : "Crear producto"}</button>
                <button className="secondary-button" type="button" onClick={resetProductForm}>Cancelar</button>
              </div>
            </form>
            <p className={`feedback ${tagMessage || productMessage ? "visible" : ""}`}>{productMessage || tagMessage}</p>
          </div>
        </div>
      )}

      {/* Tag create modal */}
      {tagModalOpen && (
        <div className="modal-backdrop modal-backdrop-front" role="presentation" onClick={() => { setTagModalOpen(false); setTagMessage(""); }}>
          <div className="modal-card modal-card-tag" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div><p className="section-overline">Etiquetas</p><h2>Nueva etiqueta</h2></div>
              <button className="icon-button" type="button" onClick={() => { setTagModalOpen(false); setTagMessage(""); }} aria-label="Cerrar">×</button>
            </div>
            <div className="mini-form-card stack-form">
              <input type="text" value={tagName} onChange={(e) => setTagName(e.target.value)} placeholder="Ej: aromas" required />
              <div className="inline-actions">
                <button className="primary-button" type="button" disabled={isPending} onClick={submitTag}>Guardar</button>
                <button className="secondary-button" type="button" onClick={() => { setTagModalOpen(false); setTagMessage(""); }}>Cancelar</button>
              </div>
            </div>
            <p className={`feedback ${tagMessage ? "visible" : ""}`}>{tagMessage}</p>
          </div>
        </div>
      )}

      {/* Tag picker modal */}
      {tagPickerOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setTagPickerOpen(false)}>
          <div className="modal-card modal-card-tag-picker" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div><p className="section-overline">Etiquetas</p><h2>Asignar etiquetas</h2></div>
              <button className="icon-button" type="button" onClick={() => setTagPickerOpen(false)} aria-label="Cerrar">×</button>
            </div>
            <div className="tag-picker-header">
              <p className="helper-text">Seleccionadas: <strong>{productForm.tags.length}</strong></p>
              <div className="inline-actions inline-actions-tight">
                <button className="secondary-button" type="button" onClick={() => { setTagMessage(""); setTagModalOpen(true); }}>Crear nueva</button>
                <button className="secondary-button" type="button" onClick={() => setProductForm((c) => ({ ...c, tags: [] }))}>Limpiar</button>
                <button className="primary-button" type="button" onClick={() => setTagPickerOpen(false)}>Listo</button>
              </div>
            </div>
            <div className="tag-picker-grid">
              {tags.map((t) => (
                <label key={t.id} className="checkbox-chip">
                  <input type="checkbox" checked={productForm.tags.includes(t.name)} onChange={() => toggleTag(t.name)} />
                  <span>{t.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Order detail modal */}
      {selectedOrder && (
        <div className="modal-backdrop" role="presentation" onClick={() => setSelectedOrder(null)}>
          <div className="modal-card modal-card-order" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div><p className="section-overline">Pedido #{selectedOrder.id}</p><h2>{selectedOrder.customerName}</h2></div>
              <button className="icon-button" type="button" onClick={() => setSelectedOrder(null)} aria-label="Cerrar">×</button>
            </div>
            <div className="order-detail-meta">
              <span className={`order-badge ${STATUS_COLORS[selectedOrder.status]}`}>{STATUS_LABELS[selectedOrder.status]}</span>
              {selectedOrder.customerPhone && <span className="order-detail-phone">{selectedOrder.customerPhone}</span>}
              <span className="order-detail-date">{new Date(selectedOrder.createdAt).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
            </div>
            {selectedOrder.notes && <p className="order-detail-notes">Notas: {selectedOrder.notes}</p>}
            <div className="order-items-list">
              {selectedOrder.items.map((item) => (
                <div key={item.id} className="order-item-row">
                  <div className="order-item-img" style={{ backgroundImage: `url(${item.image})` }} />
                  <div className="order-item-info">
                    <h4>{item.productName}</h4>
                    {item.variant && <span className="tag-chip">{item.variant}</span>}
                  </div>
                  <span className="order-item-qty">{item.quantity}×</span>
                  <strong>{formatCurrency(item.unitPrice * item.quantity)}</strong>
                </div>
              ))}
            </div>
            <div className="order-detail-total">
              <span>Total</span><strong>{formatCurrency(selectedOrder.total)}</strong>
            </div>
            <div className="order-actions">
              <button className="primary-button" type="button" disabled={isPending || selectedOrder.status === "accepted"} onClick={() => updateOrder(selectedOrder.id, "accepted")}>
                ✓ Aceptar
              </button>
              <button className="secondary-button" type="button" disabled={isPending || selectedOrder.status === "modified"} onClick={() => updateOrder(selectedOrder.id, "modified")}>
                ✎ Modificar
              </button>
              <button className="danger-button" type="button" disabled={isPending || selectedOrder.status === "rejected"} onClick={() => updateOrder(selectedOrder.id, "rejected")}>
                ✕ Rechazar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
