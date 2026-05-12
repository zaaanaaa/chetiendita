"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import {
  Order,
  OrderItemInput,
  OrderStatus,
  OrderUpdateInput,
  Product,
  ProductInput,
  ProductVariantGroup,
  Tag,
  User,
} from "@/lib/types";

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
  invalid_discount_price: "El precio con descuento debe ser menor al precio normal.",
  invalid_image_url: "La imagen debe ser una URL valida o un archivo subido.",
  missing_customer_name: "El pedido necesita un nombre de cliente.",
  empty_cart: "El pedido tiene que tener al menos un item.",
  invalid_item: "Revisa los items del pedido.",
  invalid_status: "Elegí un estado válido para el pedido.",
  default: "No se pudo guardar. Intenta otra vez.",
};

const EMPTY_FORM: ProductInput = {
  name: "",
  description: "",
  price: 0,
  discountPrice: null,
  image: "",
  featured: false,
  tags: [],
  variants: [],
  variantGroups: [],
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
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

function getEffectivePrice(product: Product) {
  return product.discountPrice ?? product.price;
}

function getDiscountPercentage(price: number, discountPrice: number | null) {
  if (!discountPrice || discountPrice >= price) {
    return null;
  }

  return Math.round(((price - discountPrice) / price) * 100);
}

function createEmptyVariantGroup(): ProductVariantGroup {
  return { name: "", options: [] };
}

function createEmptyOrderItem(): OrderItemInput {
  return {
    productId: 0,
    productName: "",
    variant: "",
    quantity: 1,
    unitPrice: 0,
    image: "",
  };
}

function createOrderDraft(order: Order): OrderUpdateInput {
  return {
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    notes: order.notes,
    status: order.status,
    items: order.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      variant: item.variant,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      image: item.image,
    })),
  };
}

function calculateDraftTotal(items: OrderItemInput[]) {
  return items.reduce((sum, item) => sum + Number(item.unitPrice || 0) * Number(item.quantity || 0), 0);
}

export function AdminClient({ user, initialProducts, initialTags }: AdminClientProps) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [tags, setTags] = useState(initialTags);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<AdminTab>("inventory");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [productForm, setProductForm] = useState<ProductInput>(EMPTY_FORM);
  const [variantOptionDrafts, setVariantOptionDrafts] = useState<string[]>([]);
  const [imageUploadName, setImageUploadName] = useState("");
  const [tagName, setTagName] = useState("");
  const [tagMessage, setTagMessage] = useState("");
  const [productMessage, setProductMessage] = useState("");
  const [orderMessage, setOrderMessage] = useState("");
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryTag, setInventoryTag] = useState("");
  const [inventorySort, setInventorySort] = useState<InventorySort>("featured");
  const [editorOpen, setEditorOpen] = useState(false);
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderDraft, setOrderDraft] = useState<OrderUpdateInput | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const anyModalOpen = editorOpen || tagModalOpen || tagPickerOpen || !!selectedOrder;
    if (anyModalOpen) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }
    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [editorOpen, tagModalOpen, tagPickerOpen, selectedOrder]);

  useEffect(() => {
    if (activeTab === "orders") {
      loadOrders();
    }
  }, [activeTab]);

  const stats = useMemo(
    () => [
      { label: "Productos", value: String(products.length).padStart(2, "0") },
      { label: "Etiquetas", value: String(tags.length).padStart(2, "0") },
      { label: "Pedidos", value: String(orders.length).padStart(2, "0") },
    ],
    [products, tags, orders],
  );

  const inventoryProducts = useMemo(() => {
    const q = inventorySearch.trim().toLowerCase();
    const filtered = products.filter((product) => {
      const matchesSearch =
        !q ||
        product.name.toLowerCase().includes(q) ||
        product.description.toLowerCase().includes(q);
      const matchesTag = !inventoryTag || product.tags.includes(inventoryTag);
      return matchesSearch && matchesTag;
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

  const pendingOrders = useMemo(
    () => orders.filter((order) => order.status === "pending"),
    [orders],
  );
  const resolvedOrders = useMemo(
    () => orders.filter((order) => order.status !== "pending"),
    [orders],
  );

  const orderDraftTotal = useMemo(
    () => (orderDraft ? calculateDraftTotal(orderDraft.items) : 0),
    [orderDraft],
  );

  async function refreshAdminData() {
    const [productResponse, tagResponse] = await Promise.all([
      fetch(`/api/products?sort=${inventorySort}`, { cache: "no-store" }),
      fetch("/api/tags", { cache: "no-store" }),
    ]);
    const productData = (await productResponse.json()) as { products: Product[] };
    const tagData = (await tagResponse.json()) as { tags: Tag[] };
    setProducts(productData.products);
    setTags(tagData.tags);
  }

  async function loadOrders() {
    try {
      const response = await fetch("/api/orders", { cache: "no-store" });
      const data = (await response.json()) as { orders: Order[] };
      setOrders(data.orders || []);
    } catch {
      setOrders([]);
    }
  }

  function resetProductForm() {
    setEditingId(null);
    setProductForm(EMPTY_FORM);
    setVariantOptionDrafts([]);
    setImageUploadName("");
    setProductMessage("");
    setTagMessage("");
    setEditorOpen(false);
    setTagPickerOpen(false);
  }

  function openCreateProductModal() {
    setEditingId(null);
    setProductForm(EMPTY_FORM);
    setVariantOptionDrafts([]);
    setImageUploadName("");
    setProductMessage("");
    setTagMessage("");
    setEditorOpen(true);
    setTagPickerOpen(false);
  }

  function toggleTag(tagNameToToggle: string) {
    setProductForm((current) => ({
      ...current,
      tags: current.tags.includes(tagNameToToggle)
        ? current.tags.filter((tag) => tag !== tagNameToToggle)
        : [...current.tags, tagNameToToggle],
    }));
  }

  function editProduct(product: Product) {
    setEditingId(product.id);
    setProductMessage("");
    setTagMessage("");
    setImageUploadName("");
    setEditorOpen(true);
    setProductForm({
      name: product.name,
      description: product.description,
      price: product.price,
      discountPrice: product.discountPrice,
      image: product.image,
      featured: product.featured,
      tags: product.tags,
      variants: product.variants || [],
      variantGroups: product.variantGroups || [],
    });
    setVariantOptionDrafts((product.variantGroups || []).map(() => ""));
  }

  function addVariantGroup() {
    setProductForm((current) => ({
      ...current,
      variantGroups: [...(current.variantGroups || []), createEmptyVariantGroup()],
    }));
    setVariantOptionDrafts((current) => [...current, ""]);
  }

  function removeVariantGroup(index: number) {
    setProductForm((current) => ({
      ...current,
      variantGroups: (current.variantGroups || []).filter((_, currentIndex) => currentIndex !== index),
    }));
    setVariantOptionDrafts((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  function updateVariantGroupName(index: number, value: string) {
    setProductForm((current) => ({
      ...current,
      variantGroups: (current.variantGroups || []).map((group, currentIndex) =>
        currentIndex === index ? { ...group, name: value } : group,
      ),
    }));
  }

  function updateVariantOptionDraft(index: number, value: string) {
    setVariantOptionDrafts((current) =>
      current.map((draft, currentIndex) => (currentIndex === index ? value : draft)),
    );
  }

  function addVariantOption(index: number) {
    const draft = variantOptionDrafts[index]?.trim();
    if (!draft) {
      return;
    }

    setProductForm((current) => ({
      ...current,
      variantGroups: (current.variantGroups || []).map((group, currentIndex) =>
        currentIndex === index
          ? {
              ...group,
              options: Array.from(new Set([...(group.options || []), draft])),
            }
          : group,
      ),
    }));
    updateVariantOptionDraft(index, "");
  }

  function removeVariantOption(groupIndex: number, optionToRemove: string) {
    setProductForm((current) => ({
      ...current,
      variantGroups: (current.variantGroups || []).map((group, currentIndex) =>
        currentIndex === groupIndex
          ? {
              ...group,
              options: group.options.filter((option) => option !== optionToRemove),
            }
          : group,
      ),
    }));
  }

  function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setProductForm((current) => ({ ...current, image: result }));
      setImageUploadName(file.name);
    };
    reader.readAsDataURL(file);
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
      setTagMessage("Etiqueta creada.");
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

  function openOrderEditor(order: Order) {
    setSelectedOrder(order);
    setOrderDraft(createOrderDraft(order));
    setOrderMessage("");
  }

  function closeOrderEditor() {
    setSelectedOrder(null);
    setOrderDraft(null);
    setOrderMessage("");
  }

  function updateOrderField<K extends keyof OrderUpdateInput>(field: K, value: OrderUpdateInput[K]) {
    setOrderDraft((current) => (current ? { ...current, [field]: value } : current));
  }

  function updateOrderItem(index: number, field: keyof OrderItemInput, value: string | number) {
    setOrderDraft((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        items: current.items.map((item, currentIndex) =>
          currentIndex === index
            ? {
                ...item,
                [field]:
                  field === "productId" || field === "quantity" || field === "unitPrice"
                    ? Number(value)
                    : value,
              }
            : item,
        ),
      };
    });
  }

  function addOrderItem() {
    setOrderDraft((current) =>
      current ? { ...current, items: [...current.items, createEmptyOrderItem()] } : current,
    );
  }

  function removeOrderItem(index: number) {
    setOrderDraft((current) =>
      current
        ? { ...current, items: current.items.filter((_, currentIndex) => currentIndex !== index) }
        : current,
    );
  }

  function saveOrderChanges(nextStatus?: OrderStatus) {
    if (!selectedOrder || !orderDraft) {
      return;
    }

    setOrderMessage("");
    startTransition(async () => {
      const payload: OrderUpdateInput = {
        ...orderDraft,
        status: nextStatus ?? orderDraft.status,
      };

      const response = await fetch(`/api/orders/${selectedOrder.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setOrderMessage(ERROR_MESSAGES[data.error || "default"]);
        return;
      }

      await loadOrders();
      closeOrderEditor();
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
    <>
      <nav className="navbar">
        <div className="navbar-content">
          <Link href="/" className="navbar-logo">
            <span className="logo-mark">CT</span>
            <span className="logo-text">Che Tiendita</span>
          </Link>

          <button
            className="mobile-menu-btn"
            type="button"
            onClick={() => setMobileNavOpen((current) => !current)}
            aria-label="Menú"
          >
            <span className={`hamburger ${mobileNavOpen ? "open" : ""}`}>
              <span /><span /><span />
            </span>
          </button>

          <div className={`navbar-center ${mobileNavOpen ? "mobile-open" : ""}`}>
            <div className="navbar-menu">
              <button type="button" className={`nav-link ${activeTab === "inventory" ? "active" : ""}`} onClick={() => { setActiveTab("inventory"); setMobileNavOpen(false); }}>Inventario</button>
              <button type="button" className={`nav-link ${activeTab === "orders" ? "active" : ""}`} onClick={() => { setActiveTab("orders"); setMobileNavOpen(false); }}>Pedidos</button>
            </div>
            <div className="navbar-actions">
              <Link href="/" className="nav-btn nav-btn-ghost" onClick={() => setMobileNavOpen(false)}>Ver tienda</Link>
              <Link href="/pedidos" className="nav-btn nav-btn-ghost" onClick={() => setMobileNavOpen(false)}>Mis pedidos</Link>
              <span className="nav-user-badge">{user.username}</span>
              <button className="nav-btn nav-btn-ghost" type="button" onClick={logout}>Salir</button>
            </div>
          </div>
        </div>
      </nav>

      <main className="admin-shell">
        <section className="stats-grid">
          {stats.map((stat) => (
            <article key={stat.label} className="stat-card">
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
            </article>
          ))}
        </section>

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
                {tags.map((tag) => (
                  <option key={tag.id} value={tag.name}>{tag.name}</option>
                ))}
              </select>
              <select value={inventorySort} onChange={(e) => setInventorySort(e.target.value as InventorySort)}>
                <option value="featured">Destacados</option>
                <option value="bestselling">Más vendidos</option>
                <option value="newest">Más nuevos</option>
              </select>
            </div>

            <div className="results-row"><p>{inventoryProducts.length} producto(s)</p></div>

            <div className="inventory-list">
              {inventoryProducts.map((product) => {
                const effectivePrice = getEffectivePrice(product);
                const discountPercentage = getDiscountPercentage(product.price, product.discountPrice);

                return (
                  <article key={product.id} className="inventory-card">
                    <div className="inventory-preview">
                      <div className="inventory-media" style={{ backgroundImage: `url(${product.image})` }} />
                      <div>
                        <div className="inventory-title-row">
                          <h3>{product.name}</h3>
                          {product.featured ? <span className="featured-badge">Destacado</span> : null}
                          {discountPercentage ? <span className="discount-badge">-{discountPercentage}%</span> : null}
                        </div>
                        <p>{product.description}</p>
                        <div className="inventory-meta-row">
                          <span className="session-pill">{product.soldCount} vendidos</span>
                          <span className="session-pill">{new Date(product.createdAt).toLocaleDateString("es-AR")}</span>
                        </div>
                        <div className="tag-row">
                          {product.tags.map((tag) => <span key={tag} className="tag-chip">#{tag}</span>)}
                        </div>
                        {product.variantGroups.length > 0 && (
                          <div className="admin-variant-group-list">
                            {product.variantGroups.map((group) => (
                              <span key={group.name} className="variant-chip-sm">
                                {group.name}: {group.options.join(", ")}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="inventory-actions">
                      <div className="inventory-price-stack">
                        {product.discountPrice ? <span className="inventory-price-original">{formatCurrency(product.price)}</span> : null}
                        <strong>{formatCurrency(effectivePrice)}</strong>
                      </div>
                      <button className="secondary-button" type="button" onClick={() => editProduct(product)}>Editar</button>
                      <button className="danger-button" type="button" onClick={() => removeProduct(product.id)}>Eliminar</button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {activeTab === "orders" && (
          <section className="admin-panel">
            <div className="panel-heading">
              <div>
                <p className="section-overline">Pedidos</p>
                <h2>Gestión de pedidos</h2>
              </div>
              <button className="secondary-button" type="button" onClick={loadOrders}>Actualizar</button>
            </div>

            <div className="order-history-grid">
              <section className="order-board">
                <div className="order-board-header">
                  <p className="section-overline">Pendientes</p>
                  <h3>{pendingOrders.length}</h3>
                </div>
                {pendingOrders.length === 0 ? (
                  <div className="empty-state">
                    <h3>No hay pedidos pendientes</h3>
                    <p>Cuando entre un pedido nuevo, lo vas a ver acá.</p>
                  </div>
                ) : (
                  <div className="orders-list">
                    {pendingOrders.map((order) => (
                      <article key={order.id} className="order-card" onClick={() => openOrderEditor(order)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && openOrderEditor(order)}>
                        <div className="order-card-main">
                          <div className="order-card-header">
                            <h3>Pedido #{order.id}</h3>
                            <span className={`order-badge ${STATUS_COLORS[order.status]}`}>{STATUS_LABELS[order.status]}</span>
                          </div>
                          <p className="order-customer">{order.customerName}{order.customerPhone ? ` · ${order.customerPhone}` : ""}</p>
                          <p className="order-date">{new Date(order.createdAt).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                        </div>
                        <div className="order-card-total">
                          <span>{order.items.length} item(s)</span>
                          <strong>{formatCurrency(order.total)}</strong>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="order-board">
                <div className="order-board-header">
                  <p className="section-overline">Resueltos</p>
                  <h3>{resolvedOrders.length}</h3>
                </div>
                {resolvedOrders.length === 0 ? (
                  <div className="empty-state">
                    <h3>No hay pedidos resueltos</h3>
                    <p>Los aceptados, modificados y rechazados aparecen en este módulo.</p>
                  </div>
                ) : (
                  <div className="orders-list">
                    {resolvedOrders.map((order) => (
                      <article key={order.id} className="order-card" onClick={() => openOrderEditor(order)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && openOrderEditor(order)}>
                        <div className="order-card-main">
                          <div className="order-card-header">
                            <h3>Pedido #{order.id}</h3>
                            <span className={`order-badge ${STATUS_COLORS[order.status]}`}>{STATUS_LABELS[order.status]}</span>
                          </div>
                          <p className="order-customer">{order.customerName}{order.customerPhone ? ` · ${order.customerPhone}` : ""}</p>
                          <p className="order-date">{new Date(order.createdAt).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                        </div>
                        <div className="order-card-total">
                          <span>{order.items.length} item(s)</span>
                          <strong>{formatCurrency(order.total)}</strong>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </section>
        )}
      </main>

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
                <div className="currency-input-wrap">
                  <span>$</span>
                  <input type="number" min={1} value={productForm.price || ""} onChange={(e) => setProductForm({ ...productForm, price: Number(e.target.value) })} placeholder="Precio normal" required />
                </div>
              </div>

              <div className="editor-grid">
                <div className="currency-input-wrap">
                  <span>$</span>
                  <input type="number" min={0} value={productForm.discountPrice || ""} onChange={(e) => setProductForm({ ...productForm, discountPrice: e.target.value ? Number(e.target.value) : null })} placeholder="Precio con descuento" />
                </div>
                <label className="file-upload-field">
                  <span>Subir imagen desde tu ordenador</span>
                  <input type="file" accept="image/*" onChange={handleImageUpload} />
                  <strong>{imageUploadName || "Seleccionar archivo"}</strong>
                </label>
              </div>

              <input type="url" value={productForm.image} onChange={(e) => { setProductForm({ ...productForm, image: e.target.value }); setImageUploadName(""); }} placeholder="URL de imagen o data URL" required />

              {productForm.image ? (
                <div className="editor-image-preview">
                  <div className="editor-image-preview-media" style={{ backgroundImage: `url(${productForm.image})` }} />
                </div>
              ) : null}

              <textarea rows={4} value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} placeholder="Descripcion" required />
              <label className="checkbox-row"><input type="checkbox" checked={productForm.featured} onChange={(e) => setProductForm({ ...productForm, featured: e.target.checked })} />Marcar como destacado</label>

              <div className="inline-heading">
                <div><p className="section-overline">Variantes</p><h3 className="subsection-title">Creá categorías como color, talle o tela</h3></div>
                <button className="secondary-button" type="button" onClick={addVariantGroup}>Agregar categoría</button>
              </div>

              <div className="variant-group-editor-list">
                {(productForm.variantGroups || []).map((group, groupIndex) => (
                  <div key={`${group.name}-${groupIndex}`} className="variant-group-editor">
                    <div className="variant-group-editor-head">
                      <input type="text" value={group.name} onChange={(e) => updateVariantGroupName(groupIndex, e.target.value)} placeholder="Nombre de la categoría. Ej: Color" />
                      <button className="danger-button" type="button" onClick={() => removeVariantGroup(groupIndex)}>Eliminar</button>
                    </div>
                    <div className="variant-editor">
                      <input type="text" value={variantOptionDrafts[groupIndex] || ""} onChange={(e) => updateVariantOptionDraft(groupIndex, e.target.value)} placeholder="Ej: Negro" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addVariantOption(groupIndex); } }} />
                      <button className="secondary-button" type="button" onClick={() => addVariantOption(groupIndex)}>Agregar opción</button>
                    </div>
                    <div className="tag-row">
                      {group.options.map((option) => (
                        <button key={option} type="button" className="tag-chip tag-chip-action" onClick={() => removeVariantOption(groupIndex, option)}>
                          {option} ×
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="inline-heading">
                <div><p className="section-overline">Etiquetas</p><h3 className="subsection-title">Elegí etiquetas</h3></div>
                <button className="secondary-button" type="button" onClick={() => setTagPickerOpen(true)}>Elegir etiquetas</button>
              </div>
              <div className="tag-selection-summary">
                {productForm.tags.length > 0 ? (
                  <div className="tag-row">{productForm.tags.map((tag) => <span key={tag} className="tag-chip">#{tag}</span>)}</div>
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
                <button className="secondary-button" type="button" onClick={() => setProductForm((current) => ({ ...current, tags: [] }))}>Limpiar</button>
                <button className="primary-button" type="button" onClick={() => setTagPickerOpen(false)}>Listo</button>
              </div>
            </div>
            <div className="tag-picker-grid">
              {tags.map((tag) => (
                <label key={tag.id} className="checkbox-chip">
                  <input type="checkbox" checked={productForm.tags.includes(tag.name)} onChange={() => toggleTag(tag.name)} />
                  <span>{tag.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedOrder && orderDraft && (
        <div className="modal-backdrop" role="presentation" onClick={closeOrderEditor}>
          <div className="modal-card modal-card-order" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div><p className="section-overline">Pedido #{selectedOrder.id}</p><h2>Editar pedido</h2></div>
              <button className="icon-button" type="button" onClick={closeOrderEditor} aria-label="Cerrar">×</button>
            </div>

            <div className="order-edit-grid">
              <input type="text" value={orderDraft.customerName} onChange={(e) => updateOrderField("customerName", e.target.value)} placeholder="Nombre del cliente" />
              <input type="text" value={orderDraft.customerPhone} onChange={(e) => updateOrderField("customerPhone", e.target.value)} placeholder="Teléfono" />
            </div>

            <textarea rows={3} value={orderDraft.notes} onChange={(e) => updateOrderField("notes", e.target.value)} placeholder="Notas del pedido" />

            <div className="order-edit-status-row">
              <label className="order-status-field">
                <span>Estado</span>
                <select value={orderDraft.status} onChange={(e) => updateOrderField("status", e.target.value as OrderStatus)}>
                  <option value="pending">Pendiente</option>
                  <option value="accepted">Aceptado</option>
                  <option value="modified">Modificado</option>
                  <option value="rejected">Rechazado</option>
                </select>
              </label>
              <button className="secondary-button" type="button" onClick={addOrderItem}>Agregar item</button>
            </div>

            <div className="order-edit-items">
              {orderDraft.items.map((item, index) => (
                <div key={`${index}-${item.productName}`} className="order-edit-item-card">
                  <div className="order-edit-item-grid">
                    <input type="text" value={item.productName} onChange={(e) => updateOrderItem(index, "productName", e.target.value)} placeholder="Producto" />
                    <input type="text" value={item.variant} onChange={(e) => updateOrderItem(index, "variant", e.target.value)} placeholder="Variante. Ej: Color: Negro · Talle: M" />
                  </div>
                  <div className="order-edit-item-grid">
                    <input type="number" min={0} value={item.productId || ""} onChange={(e) => updateOrderItem(index, "productId", e.target.value)} placeholder="ID del producto (opcional)" />
                    <input type="url" value={item.image} onChange={(e) => updateOrderItem(index, "image", e.target.value)} placeholder="Imagen del item" />
                  </div>
                  <div className="order-edit-item-grid order-edit-item-grid-tight">
                    <div className="currency-input-wrap">
                      <span>$</span>
                      <input type="number" min={0} value={item.unitPrice || ""} onChange={(e) => updateOrderItem(index, "unitPrice", e.target.value)} placeholder="Precio" />
                    </div>
                    <input type="number" min={1} value={item.quantity || 1} onChange={(e) => updateOrderItem(index, "quantity", e.target.value)} placeholder="Cantidad" />
                    <button className="danger-button" type="button" onClick={() => removeOrderItem(index)}>Eliminar</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="order-detail-total">
              <span>Total recalculado</span>
              <strong>{formatCurrency(orderDraftTotal)}</strong>
            </div>

            <div className="order-actions">
              <button className="primary-button" type="button" disabled={isPending} onClick={() => saveOrderChanges("accepted")}>Aceptar y guardar</button>
              <button className="secondary-button" type="button" disabled={isPending} onClick={() => saveOrderChanges("modified")}>Guardar como modificado</button>
              <button className="danger-button" type="button" disabled={isPending} onClick={() => saveOrderChanges("rejected")}>Rechazar</button>
              <button className="secondary-button" type="button" disabled={isPending} onClick={() => saveOrderChanges()}>Guardar cambios</button>
            </div>
            <p className={`feedback ${orderMessage ? "visible" : ""}`}>{orderMessage}</p>
          </div>
        </div>
      )}
    </>
  );
}
