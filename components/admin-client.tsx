"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { CartDrawer } from "@/components/cart-drawer";
import { useCart } from "@/components/cart-context";
import { VariantDisplay } from "@/components/variant-display";
import {
  DEFAULT_COLOR_OPTION,
  isColorVariantGroup,
  isHexColor,
  normalizeColorOption,
} from "@/lib/color-variants";
import {
  Order,
  OrderItemInput,
  OrderStatus,
  OrderUpdateInput,
  Product,
  ProductInput,
  ProductVideo,
  ProductVariantGroup,
  Tag,
  User,
  UserInput,
  UserWithOrders,
} from "@/lib/types";

interface AdminClientProps {
  user: User;
  initialProducts: Product[];
  initialTags: Tag[];
}

type InventorySort = "featured" | "bestselling" | "newest";
type AdminTab = "inventory" | "orders" | "users";

const ERROR_MESSAGES: Record<string, string> = {
  name_required: "La etiqueta no puede estar vacia.",
  tag_exists: "Esa etiqueta ya existe.",
  missing_fields: "Completa todos los campos necesarios.",
  invalid_price: "El precio debe ser mayor a cero.",
  invalid_discount_price: "El precio con descuento debe ser menor al precio normal.",
  invalid_image_url: "La imagen debe ser una URL válida o un archivo subido.",
  invalid_video: "El video debe ser una URL válida de YouTube, un enlace directo o un archivo subido.",
  missing_customer_name: "El pedido necesita un nombre de cliente.",
  empty_cart: "El pedido tiene que tener al menos un item.",
  invalid_item: "Revisa los items del pedido.",
  invalid_status: "No se pudo guardar el estado del pedido.",
  invalid_email: "El email no es válido.",
  invalid_input: "Revisá los datos cargados.",
  username_or_email_exists: "Ese usuario o email ya existe.",
  forbidden: "No se puede realizar esta acción.",
  default: "No se pudo guardar. Intenta otra vez.",
};

const EMPTY_FORM: ProductInput = {
  name: "",
  description: "",
  price: 0,
  discountPrice: null,
  image: "",
  images: [],
  videos: [],
  video: null,
  featured: false,
  tags: [],
  variants: [],
  variantGroups: [],
};

const EMPTY_USER_FORM: UserInput = {
  username: "",
  name: "",
  email: "",
  phone: "",
  role: "user",
  password: "",
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

function isDiscountedPrice(price: number, discountPrice: number | null) {
  return discountPrice !== null && discountPrice > 0 && discountPrice < price;
}

function getVariantOptionDraftValue(group: ProductVariantGroup, draft: string | undefined) {
  if (!isColorVariantGroup(group.name)) {
    return draft || "";
  }

  return normalizeColorOption(draft || "") || DEFAULT_COLOR_OPTION;
}

function normalizeProductDraft(input: ProductInput): ProductInput {
  const hasDiscount = isDiscountedPrice(input.price, input.discountPrice);
  const tags = hasDiscount
    ? Array.from(new Set([...input.tags, "descuento"]))
    : input.tags.filter((tag) => tag !== "descuento");

  return {
    ...input,
    featured: hasDiscount ? true : input.featured,
    tags,
  };
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
    userId: order.userId,
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

function createEmptyOrderDraft(): OrderUpdateInput {
  return {
    userId: null,
    customerName: "",
    customerPhone: "",
    notes: "",
    status: "accepted",
    items: [],
  };
}

function calculateDraftTotal(items: OrderItemInput[]) {
  return items.reduce((sum, item) => sum + Number(item.unitPrice || 0) * Number(item.quantity || 0), 0);
}

function createOrderItemFromProduct(product: Product): OrderItemInput {
  const defaultVariant = product.variantGroups
    .map((group) => {
      const firstOption = group.options[0];
      return firstOption ? `${group.name}: ${firstOption}` : null;
    })
    .filter(Boolean)
    .join(" · ");

  return {
    productId: product.id,
    productName: product.name,
    variant: defaultVariant,
    quantity: 1,
    unitPrice: getEffectivePrice(product),
    image: product.images[0] || product.image,
  };
}

function parseVariantSelection(variant: string, variantGroups: ProductVariantGroup[]) {
  const selections = new Map<string, string>();

  for (const segment of variant.split("·")) {
    const [rawName, ...rawValueParts] = segment.split(":");
    const name = rawName?.trim().toLowerCase();
    const value = rawValueParts.join(":").trim();
    if (!name || !value) {
      continue;
    }

    selections.set(name, value);
  }

  return variantGroups.reduce<Record<string, string>>((acc, group) => {
    const selectedOption = selections.get(group.name.trim().toLowerCase());
    if (selectedOption) {
      acc[group.name] = selectedOption;
    }

    return acc;
  }, {});
}

function buildVariantSelection(variantGroups: ProductVariantGroup[], selections: Record<string, string>) {
  return variantGroups
    .map((group) => {
      const selectedOption = selections[group.name];
      return selectedOption ? `${group.name}: ${selectedOption}` : null;
    })
    .filter(Boolean)
    .join(" · ");
}

function moveArrayItem<T>(items: T[], fromIndex: number, toIndex: number) {
  if (toIndex < 0 || toIndex >= items.length || fromIndex === toIndex) {
    return items;
  }

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, movedItem);
  return nextItems;
}

export function AdminClient({ user, initialProducts, initialTags }: AdminClientProps) {
  const router = useRouter();
  const { totalItems } = useCart();
  const [products, setProducts] = useState(initialProducts);
  const [tags, setTags] = useState(initialTags);
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<AdminTab>("inventory");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [productForm, setProductForm] = useState<ProductInput>(EMPTY_FORM);
  const [variantOptionDrafts, setVariantOptionDrafts] = useState<string[]>([]);
  const [tagName, setTagName] = useState("");
  const [tagMessage, setTagMessage] = useState("");
  const [productMessage, setProductMessage] = useState("");
  const [orderMessage, setOrderMessage] = useState("");
  const [userMessage, setUserMessage] = useState("");
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryTag, setInventoryTag] = useState("");
  const [inventorySort, setInventorySort] = useState<InventorySort>("featured");
  const [userSearch, setUserSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [mediaOrderOpen, setMediaOrderOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderDraft, setOrderDraft] = useState<OrderUpdateInput | null>(null);
  const [selectedUserDetail, setSelectedUserDetail] = useState<UserWithOrders | null>(null);
  const [userEditorOpen, setUserEditorOpen] = useState(false);
  const [userEditingId, setUserEditingId] = useState<number | null>(null);
  const [userForm, setUserForm] = useState<UserInput>(EMPTY_USER_FORM);
  const [urlImageDraft, setUrlImageDraft] = useState("");
  const [urlVideoLabelDraft, setUrlVideoLabelDraft] = useState("");
  const [urlVideoDraft, setUrlVideoDraft] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [orderProductSearch, setOrderProductSearch] = useState("");
  const [orderUserSearch, setOrderUserSearch] = useState("");
  const [orderUserMenuOpen, setOrderUserMenuOpen] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const anyModalOpen =
      cartOpen ||
      editorOpen ||
      tagModalOpen ||
      tagPickerOpen ||
      mediaOrderOpen ||
      !!selectedOrder ||
      !!orderDraft ||
      userEditorOpen ||
      productPickerOpen ||
      mobileNavOpen;
    if (anyModalOpen) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }
    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [cartOpen, editorOpen, tagModalOpen, tagPickerOpen, mediaOrderOpen, selectedOrder, orderDraft, userEditorOpen, productPickerOpen, mobileNavOpen]);

  useEffect(() => {
    if (activeTab === "orders") {
      loadOrders();
      loadUsers("");
    }
    if (activeTab === "users") {
      loadUsers(userSearch);
    }
  }, [activeTab]);

  useEffect(() => {
    const normalized = normalizeProductDraft(productForm);
    const tagsChanged =
      normalized.tags.length !== productForm.tags.length ||
      normalized.tags.some((tag, index) => tag !== productForm.tags[index]);

    if (normalized.featured !== productForm.featured || tagsChanged) {
      setProductForm(normalized);
    }
  }, [productForm]);

  const inventoryProducts = useMemo(() => {
    const q = inventorySearch.trim().toLowerCase();
    const filtered = products.filter((product) => {
      const matchesSearch =
        !q ||
        product.name.toLowerCase().includes(q) ||
        product.description.toLowerCase().includes(q);
      const matchesTag =
        !inventoryTag ||
        (inventoryTag === "descuento"
          ? isDiscountedPrice(product.price, product.discountPrice)
          : product.tags.includes(inventoryTag));
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
  const readyOrders = useMemo(
    () => orders.filter((order) => order.status !== "pending"),
    [orders],
  );

  const orderDraftTotal = useMemo(
    () => (orderDraft ? calculateDraftTotal(orderDraft.items) : 0),
    [orderDraft],
  );

  const orderPickerProducts = useMemo(() => {
    const normalizedSearch = orderProductSearch.trim().toLowerCase();

    return products.filter((product) => {
      if (!normalizedSearch) {
        return true;
      }

      return (
        product.name.toLowerCase().includes(normalizedSearch) ||
        product.description.toLowerCase().includes(normalizedSearch) ||
        product.tags.some((tag) => tag.toLowerCase().includes(normalizedSearch))
      );
    });
  }, [orderProductSearch, products]);

  const orderAssignableUsers = useMemo(() => {
    const normalizedSearch = orderUserSearch.trim().toLowerCase();

    return users.filter((listedUser) => {
      if (!normalizedSearch) {
        return true;
      }

      return (
        listedUser.name.toLowerCase().includes(normalizedSearch) ||
        listedUser.username.toLowerCase().includes(normalizedSearch) ||
        listedUser.email.toLowerCase().includes(normalizedSearch) ||
        listedUser.phone.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [orderUserSearch, users]);

  const selectedOrderUser = useMemo(
    () => (orderDraft?.userId ? users.find((listedUser) => listedUser.id === orderDraft.userId) || null : null),
    [orderDraft?.userId, users],
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

  async function loadUsers(search = "") {
    try {
      const response = await fetch(`/api/users?search=${encodeURIComponent(search)}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as { users: User[] };
      setUsers(data.users || []);
    } catch {
      setUsers([]);
    }
  }

  async function loadUserDetail(userId: number) {
    const response = await fetch(`/api/users/${userId}`, { cache: "no-store" });
    if (!response.ok) {
      setSelectedUserDetail(null);
      return;
    }
    const data = (await response.json()) as { user: UserWithOrders };
    setSelectedUserDetail(data.user);
  }

  function resetProductForm() {
    setEditingId(null);
    setProductForm(EMPTY_FORM);
    setVariantOptionDrafts([]);
    setProductMessage("");
    setTagMessage("");
    setUrlImageDraft("");
    setUrlVideoLabelDraft("");
    setUrlVideoDraft("");
    setEditorOpen(false);
    setTagPickerOpen(false);
    setMediaOrderOpen(false);
  }

  function openCreateProductModal() {
    setEditingId(null);
    setProductForm(EMPTY_FORM);
    setVariantOptionDrafts([]);
    setProductMessage("");
    setTagMessage("");
    setUrlImageDraft("");
    setUrlVideoLabelDraft("");
    setUrlVideoDraft("");
    setEditorOpen(true);
    setTagPickerOpen(false);
    setMediaOrderOpen(false);
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
    setEditorOpen(true);
    setProductForm({
      name: product.name,
      description: product.description,
      price: product.price,
      discountPrice: product.discountPrice,
      image: product.image,
      images: product.images,
      videos: product.videos || [],
      video: product.video,
      featured: product.featured,
      tags: product.tags,
      variants: product.variants || [],
      variantGroups: product.variantGroups || [],
    });
    setVariantOptionDrafts((product.variantGroups || []).map(() => ""));
    setUrlVideoLabelDraft("");
    setUrlVideoDraft("");
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
    const group = productForm.variantGroups?.[index];
    if (!group) {
      return;
    }

    const draft = isColorVariantGroup(group.name)
      ? getVariantOptionDraftValue(group, variantOptionDrafts[index])
      : variantOptionDrafts[index]?.trim();
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
    updateVariantOptionDraft(index, isColorVariantGroup(group.name) ? DEFAULT_COLOR_OPTION : "");
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

  function addImageUrl() {
    const draft = urlImageDraft.trim();
    if (!draft) {
      return;
    }

    setProductForm((current) => {
      const images = Array.from(new Set([...(current.images || []), draft]));
      return {
        ...current,
        images,
        image: images[0] || "",
      };
    });
    setUrlImageDraft("");
  }

  function removeImage(index: number) {
    setProductForm((current) => {
      const images = (current.images || []).filter((_, currentIndex) => currentIndex !== index);
      return {
        ...current,
        images,
        image: images[0] || "",
      };
    });
  }

  function moveImage(index: number, direction: "up" | "down") {
    setProductForm((current) => {
      const nextIndex = direction === "up" ? index - 1 : index + 1;
      const images = moveArrayItem(current.images || [], index, nextIndex);
      return {
        ...current,
        images,
        image: images[0] || "",
      };
    });
  }

  function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) {
      return;
    }

    Promise.all(
      files.map(
        (file) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
            reader.readAsDataURL(file);
          }),
      ),
    ).then((encodedImages) => {
      setProductForm((current) => {
        const images = Array.from(new Set([...(current.images || []), ...encodedImages.filter(Boolean)]));
        return {
          ...current,
          images,
          image: images[0] || "",
        };
      });
    });
  }

  function handleVideoUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) {
      return;
    }

    Promise.all(
      files.map(
        (file) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
            reader.readAsDataURL(file);
          }),
      ),
    ).then((encodedVideos) => {
      setProductForm((current) => {
        const existingUrls = new Set((current.videos || []).map((video) => video.url));
        const videos = [
          ...(current.videos || []),
          ...encodedVideos
            .filter(Boolean)
            .filter((encodedVideo) => !existingUrls.has(encodedVideo))
            .map((encodedVideo, index) => ({
              url: encodedVideo,
              label: files[index]?.name || "Video",
            })),
        ];
        return {
          ...current,
          videos,
          video: videos[0]?.url || null,
        };
      });
    });
  }

  function saveVideoUrl() {
    const draft = urlVideoDraft.trim();
    if (!draft) {
      return;
    }

    setProductForm((current) => {
      const normalizedUrl = draft;
      const alreadyExists = (current.videos || []).some((video) => video.url === normalizedUrl);
      const videos = alreadyExists
        ? current.videos || []
        : [
            ...(current.videos || []),
            {
              url: normalizedUrl,
              label: urlVideoLabelDraft.trim() || `Video ${((current.videos || []).length || 0) + 1}`,
            },
          ];
      return {
        ...current,
        videos,
        video: videos[0]?.url || null,
      };
    });
    setUrlVideoLabelDraft("");
    setUrlVideoDraft("");
  }

  function removeVideo(index: number) {
    setProductForm((current) => {
      const videos = (current.videos || []).filter((_, currentIndex) => currentIndex !== index);
      return {
        ...current,
        videos,
        video: videos[0]?.url || null,
      };
    });
  }

  function moveVideo(index: number, direction: "up" | "down") {
    setProductForm((current) => {
      const nextIndex = direction === "up" ? index - 1 : index + 1;
      const videos = moveArrayItem(current.videos || [], index, nextIndex);
      return {
        ...current,
        videos,
        video: videos[0]?.url || null,
      };
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
    setOrderUserSearch("");
    setOrderUserMenuOpen(false);
  }

  function openCreateOrderEditor() {
    setSelectedOrder(null);
    setOrderDraft(createEmptyOrderDraft());
    setOrderMessage("");
    setOrderProductSearch("");
    setOrderUserSearch("");
    setOrderUserMenuOpen(false);
    setProductPickerOpen(false);
    if (users.length === 0) {
      loadUsers("");
    }
  }

  function closeOrderEditor() {
    setSelectedOrder(null);
    setOrderDraft(null);
    setOrderMessage("");
    setProductPickerOpen(false);
    setOrderProductSearch("");
    setOrderUserSearch("");
    setOrderUserMenuOpen(false);
  }

  function updateOrderField<K extends keyof OrderUpdateInput>(field: K, value: OrderUpdateInput[K]) {
    setOrderDraft((current) => (current ? { ...current, [field]: value } : current));
  }

  function assignOrderUser(value: string) {
    setOrderDraft((current) => {
      if (!current) {
        return current;
      }

      const nextUserId = value ? Number(value) : null;
      const assignedUser = nextUserId ? users.find((candidate) => candidate.id === nextUserId) : null;

      return {
        ...current,
        userId: nextUserId,
        customerName: assignedUser?.name || current.customerName || "Cliente",
        customerPhone: assignedUser?.phone || current.customerPhone,
      };
    });

    const assignedUser = value ? users.find((candidate) => candidate.id === Number(value)) : null;
    setOrderUserSearch(assignedUser ? `${assignedUser.name} (@${assignedUser.username})` : "");
    setOrderUserMenuOpen(false);
  }

  function updateOrderItem(index: number, field: keyof OrderItemInput, value: string | number) {
    setOrderDraft((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        items: current.items.map((item, currentIndex) => {
          if (currentIndex !== index) {
            return item;
          }

          const nextItem = {
            ...item,
            [field]:
              field === "productId" || field === "quantity" || field === "unitPrice"
                ? Number(value)
                : value,
          };

          return nextItem;
        }),
      };
    });
  }

  function updateOrderItemVariantSelection(index: number, product: Product, groupName: string, option: string) {
    setOrderDraft((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        items: current.items.map((item, currentIndex) => {
          if (currentIndex !== index) {
            return item;
          }

          const currentSelections = parseVariantSelection(item.variant, product.variantGroups);
          const nextSelections = {
            ...currentSelections,
            [groupName]: option,
          };

          return {
            ...item,
            variant: buildVariantSelection(product.variantGroups, nextSelections),
          };
        }),
      };
    });
  }

  function openOrderProductPicker() {
    setOrderProductSearch("");
    setProductPickerOpen(true);
  }

  function addProductToOrder(product: Product) {
    setOrderDraft((current) =>
      current ? { ...current, items: [...current.items, createOrderItemFromProduct(product)] } : current,
    );
    setProductPickerOpen(false);
  }

  function removeOrderItem(index: number) {
    setOrderDraft((current) =>
      current
        ? { ...current, items: current.items.filter((_, currentIndex) => currentIndex !== index) }
        : current,
    );
  }

  function toggleExpandedOrder(orderId: number) {
    setExpandedOrderId((current) => (current === orderId ? null : orderId));
  }

  function saveOrderChanges(nextStatus?: OrderStatus) {
    if (!orderDraft) {
      return;
    }

    setOrderMessage("");
    startTransition(async () => {
      const payload: OrderUpdateInput = {
        ...orderDraft,
        status: nextStatus ?? orderDraft.status,
      };

      const response = await fetch(selectedOrder ? `/api/orders/${selectedOrder.id}` : "/api/orders", {
        method: selectedOrder ? "PUT" : "POST",
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

  function removeOrder(orderId: number) {
    startTransition(async () => {
      const response = await fetch(`/api/orders/${orderId}`, { method: "DELETE" });
      if (!response.ok) {
        setOrderMessage("No se pudo eliminar el pedido.");
        return;
      }

      await loadOrders();
      if (selectedOrder?.id === orderId) {
        closeOrderEditor();
      }
    });
  }

  function openCreateUser() {
    setUserEditingId(null);
    setUserForm(EMPTY_USER_FORM);
    setUserMessage("");
    setUserEditorOpen(true);
  }

  function openEditUser(targetUser: User) {
    setUserEditingId(targetUser.id);
    setUserForm({
      username: targetUser.username,
      name: targetUser.name,
      email: targetUser.email,
      phone: targetUser.phone,
      role: targetUser.role,
      password: "",
    });
    setUserMessage("");
    setUserEditorOpen(true);
    loadUserDetail(targetUser.id);
  }

  function closeUserEditor() {
    setUserEditorOpen(false);
    setUserEditingId(null);
    setUserForm(EMPTY_USER_FORM);
    setUserMessage("");
  }

  function saveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUserMessage("");

    startTransition(async () => {
      const endpoint = userEditingId ? `/api/users/${userEditingId}` : "/api/users";
      const method = userEditingId ? "PUT" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userForm),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string; user?: User };
      if (!response.ok) {
        setUserMessage(ERROR_MESSAGES[data.error || "default"]);
        return;
      }
      await loadUsers(userSearch);
      if (data.user) {
        await loadUserDetail(data.user.id);
      }
      closeUserEditor();
    });
  }

  function deleteUser(userId: number) {
    startTransition(async () => {
      const response = await fetch(`/api/users/${userId}`, { method: "DELETE" });
      if (!response.ok) {
        setUserMessage("No se pudo eliminar el usuario.");
        return;
      }
      await loadUsers(userSearch);
      if (selectedUserDetail?.id === userId) {
        setSelectedUserDetail(null);
      }
      closeUserEditor();
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
        <div className="navbar-content navbar-content-sidebar">
          <div className="navbar-main">
            <Link href="/" className="navbar-logo">
              <span className="logo-mark">CT</span>
              <span className="logo-text">Che Tiendita</span>
            </Link>
            <div className="navbar-menu navbar-menu-inline">
              <button type="button" className={`nav-link ${activeTab === "inventory" ? "active" : ""}`} onClick={() => setActiveTab("inventory")}>Inventario</button>
              <button type="button" className={`nav-link ${activeTab === "orders" ? "active" : ""}`} onClick={() => setActiveTab("orders")}>Pedidos</button>
              <button type="button" className={`nav-link ${activeTab === "users" ? "active" : ""}`} onClick={() => setActiveTab("users")}>Users</button>
            </div>
          </div>

          <button
            className="mobile-cart-shortcut admin-mobile-cart-shortcut"
            type="button"
            onClick={() => setCartOpen(true)}
            aria-label="Ver carrito"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            {totalItems > 0 ? <span>{totalItems}</span> : null}
          </button>

          <button
            className={`sidebar-toggle admin-sidebar-toggle ${mobileNavOpen ? "active" : ""}`}
            type="button"
            onClick={() => setMobileNavOpen((current) => !current)}
            aria-label="Abrir panel admin"
            aria-expanded={mobileNavOpen}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <div
            className={`header-sidebar-backdrop ${mobileNavOpen ? "open" : ""}`}
            role="presentation"
            onClick={() => setMobileNavOpen(false)}
          />

          <aside className={`header-sidebar admin-header-sidebar ${mobileNavOpen ? "open" : ""}`}>
            <div className="header-sidebar-section mobile-sidebar-nav">
              <span className="header-sidebar-label">Panel</span>
              <div className="header-sidebar-actions">
                <button
                  type="button"
                  className={`sidebar-link mobile-sidebar-tab ${activeTab === "inventory" ? "active" : ""}`}
                  onClick={() => {
                    setActiveTab("inventory");
                    setMobileNavOpen(false);
                  }}
                >
                  Inventario
                </button>
                <button
                  type="button"
                  className={`sidebar-link mobile-sidebar-tab ${activeTab === "orders" ? "active" : ""}`}
                  onClick={() => {
                    setActiveTab("orders");
                    setMobileNavOpen(false);
                  }}
                >
                  Pedidos
                </button>
                <button
                  type="button"
                  className={`sidebar-link mobile-sidebar-tab ${activeTab === "users" ? "active" : ""}`}
                  onClick={() => {
                    setActiveTab("users");
                    setMobileNavOpen(false);
                  }}
                >
                  Users
                </button>
              </div>
            </div>

            <div className="header-sidebar-section">
              <span className="header-sidebar-user">{user.name}</span>
              <p className="admin-sidebar-role">Administrador</p>
            </div>

            <div className="header-sidebar-actions">
              <Link href="/pedidos" className="sidebar-link" onClick={() => setMobileNavOpen(false)}>Mis pedidos</Link>
              <button
                className="sidebar-cart sidebar-cart-desktop-only"
                type="button"
                onClick={() => {
                  setMobileNavOpen(false);
                  setCartOpen(true);
                }}
                aria-label="Ver carrito"
              >
                <span>Carrito</span>
                <strong>Ver</strong>
              </button>
              <button className="sidebar-link" type="button" onClick={() => { setMobileNavOpen(false); logout(); }}>Salir</button>
            </div>
          </aside>
        </div>
      </nav>

      <main className="admin-shell">
        {activeTab === "inventory" ? (
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
                      <div className="inventory-media-frame">
                        <img src={product.image} alt={product.name} className="inventory-media-tag" />
                      </div>
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
                        {product.variantGroups.length > 0 ? (
                          <div className="admin-variant-group-list">
                            {product.variantGroups.map((group) => (
                              <span
                                key={group.name}
                                className={`variant-chip-sm ${isColorVariantGroup(group.name) ? "variant-chip-sm-color-group" : ""}`}
                              >
                                <span>{group.name}:</span>
                                {isColorVariantGroup(group.name) ? (
                                  <span className="color-swatch-list">
                                    {group.options.map((option) =>
                                      isHexColor(option) ? (
                                        <span
                                          key={option}
                                          className="color-swatch color-swatch-mini"
                                          style={{ backgroundColor: option }}
                                          title={option}
                                        />
                                      ) : (
                                        <span key={option}>{option}</span>
                                      ),
                                    )}
                                  </span>
                                ) : (
                                  <span>{group.options.join(", ")}</span>
                                )}
                              </span>
                            ))}
                          </div>
                        ) : null}
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
        ) : null}

        {activeTab === "orders" ? (
          <section className="admin-panel">
            <div className="panel-heading">
              <div>
                <p className="section-overline">Pedidos</p>
                <h2>Gestión de pedidos</h2>
              </div>
              <div className="inline-actions">
                <button className="primary-button" type="button" onClick={openCreateOrderEditor}>Nuevo pedido</button>
                <button className="secondary-button" type="button" onClick={loadOrders}>Actualizar</button>
              </div>
            </div>

            <section className="order-board order-board-stacked">
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
                    <article
                      key={order.id}
                      className={`order-card order-card-compact ${expandedOrderId === order.id ? "order-card-expanded" : ""}`}
                      onClick={() => toggleExpandedOrder(order.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && toggleExpandedOrder(order.id)}
                    >
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
                      {expandedOrderId === order.id ? (
                        <div className="order-card-inline-detail">
                          <div className="order-history-items order-history-items-compact">
                            {order.items.map((item) => (
                              <div key={item.id} className="order-history-item order-history-item-compact">
                                <div className="order-item-img" style={{ backgroundImage: `url(${item.image})` }} />
                                <div>
                                  <h4>{item.productName}</h4>
                                  {item.variant ? <p><VariantDisplay value={item.variant} /></p> : null}
                                </div>
                                <span>{item.quantity}x</span>
                              </div>
                            ))}
                          </div>
                          <div className="order-card-actions-compact">
                            <button
                              className="secondary-button secondary-button-sm"
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openOrderEditor(order);
                              }}
                            >
                              Editar
                            </button>
                            <button
                              className="danger-button danger-button-sm"
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                removeOrder(order.id);
                              }}
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="order-board order-board-stacked order-board-ready">
              <div className="order-board-header">
                <p className="section-overline">Listos</p>
                <h3>{readyOrders.length}</h3>
              </div>
              {readyOrders.length === 0 ? (
                <div className="empty-state">
                  <h3>No hay pedidos listos</h3>
                  <p>Los aceptados y rechazados quedan agrupados acá.</p>
                </div>
              ) : (
                <div className="orders-list">
                  {readyOrders.map((order) => (
                    <article
                      key={order.id}
                      className={`order-card order-card-compact ${expandedOrderId === order.id ? "order-card-expanded" : ""}`}
                      onClick={() => toggleExpandedOrder(order.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && toggleExpandedOrder(order.id)}
                    >
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
                      {expandedOrderId === order.id ? (
                        <div className="order-card-inline-detail">
                          <div className="order-history-items order-history-items-compact">
                            {order.items.map((item) => (
                              <div key={item.id} className="order-history-item order-history-item-compact">
                                <div className="order-item-img" style={{ backgroundImage: `url(${item.image})` }} />
                                <div>
                                  <h4>{item.productName}</h4>
                                  {item.variant ? <p><VariantDisplay value={item.variant} /></p> : null}
                                </div>
                                <span>{item.quantity}x</span>
                              </div>
                            ))}
                          </div>
                          <div className="order-card-actions-compact">
                            <button
                              className="secondary-button secondary-button-sm"
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openOrderEditor(order);
                              }}
                            >
                              Editar
                            </button>
                            <button
                              className="danger-button danger-button-sm"
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                removeOrder(order.id);
                              }}
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </section>
        ) : null}

        {activeTab === "users" ? (
          <section className="admin-panel">
            <div className="panel-heading">
              <div>
                <p className="section-overline">Users</p>
                <h2>Gestión de usuarios</h2>
              </div>
              <button className="primary-button" type="button" onClick={openCreateUser}>Nuevo user</button>
            </div>

            <div className="inventory-toolbar">
              <input
                type="search"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Buscar por nombre, teléfono o id de pedido..."
              />
              <button className="secondary-button" type="button" onClick={() => loadUsers(userSearch)}>Buscar</button>
            </div>

            <div className="users-panel-grid">
              <div className="users-list-panel">
                <div className="orders-list">
                  {users.map((listedUser) => (
                    <article
                      key={listedUser.id}
                      className={`order-card ${selectedUserDetail?.id === listedUser.id ? "order-card-selected" : ""}`}
                      onClick={() => loadUserDetail(listedUser.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && loadUserDetail(listedUser.id)}
                    >
                      <div className="order-card-main">
                        <div className="order-card-header">
                          <h3>{listedUser.name}</h3>
                          <span className={`order-badge ${listedUser.role === "admin" ? "badge-modified" : "badge-pending"}`}>
                            {listedUser.role}
                          </span>
                        </div>
                        <p className="order-customer">@{listedUser.username}</p>
                        <p className="order-date">{listedUser.phone || listedUser.email}</p>
                      </div>
                      <div className="order-card-total">
                        <button className="secondary-button" type="button" onClick={(event) => { event.stopPropagation(); openEditUser(listedUser); }}>
                          Editar
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              <div className="user-detail-panel">
                {selectedUserDetail ? (
                  <>
                    <div className="panel-heading">
                      <div>
                        <p className="section-overline">Detalle</p>
                        <h2>{selectedUserDetail.name}</h2>
                      </div>
                      <button className="secondary-button" type="button" onClick={() => openEditUser(selectedUserDetail)}>Editar user</button>
                    </div>
                    <div className="user-detail-grid">
                      <p><strong>Username:</strong> @{selectedUserDetail.username}</p>
                      <p><strong>Email:</strong> {selectedUserDetail.email}</p>
                      <p><strong>Teléfono:</strong> {selectedUserDetail.phone || "Sin cargar"}</p>
                      <p><strong>Rol:</strong> {selectedUserDetail.role}</p>
                    </div>

                    <div className="user-detail-orders">
                      <div className="panel-heading">
                        <div>
                          <p className="section-overline">Pedidos</p>
                          <h2>{selectedUserDetail.orders.length} pedido(s)</h2>
                        </div>
                      </div>
                      {selectedUserDetail.orders.length === 0 ? (
                        <div className="empty-state">
                          <h3>Este user todavía no hizo pedidos</h3>
                          <p>Cuando compre, vas a ver el historial acá.</p>
                        </div>
                      ) : (
                        <div className="orders-list">
                          {selectedUserDetail.orders.map((order) => (
                            <article key={order.id} className="order-card order-card-static">
                              <div className="order-card-main">
                                <div className="order-card-header">
                                  <h3>Pedido #{order.id}</h3>
                                  <span className={`order-badge ${STATUS_COLORS[order.status]}`}>{STATUS_LABELS[order.status]}</span>
                                </div>
                                <p className="order-date">{new Date(order.createdAt).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}</p>
                              </div>
                              <div className="order-card-total">
                                <strong>{formatCurrency(order.total)}</strong>
                              </div>
                              <div className="order-history-items">
                                {order.items.map((item) => (
                                  <div key={item.id} className="order-history-item">
                                    <div className="order-item-img" style={{ backgroundImage: `url(${item.image})` }} />
                                    <div>
                                      <h4>{item.productName}</h4>
                                      {item.variant ? <p><VariantDisplay value={item.variant} /></p> : null}
                                    </div>
                                    <span>{item.quantity}x</span>
                                  </div>
                                ))}
                              </div>
                            </article>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="empty-state">
                    <h3>Elegí un user para ver su detalle</h3>
                    <p>Podés buscar por nombre, teléfono, username o id de pedido.</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : null}
      </main>

      {editorOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={resetProductForm}>
          <div className="modal-card modal-card-editor modal-card-editor-wide" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div><p className="section-overline">Editor</p><h2>{editingId ? "Editar producto" : "Nuevo producto"}</h2></div>
              <button className="icon-button" type="button" onClick={resetProductForm} aria-label="Cerrar">×</button>
            </div>

            <div className="product-editor-scroll">
              <form className="product-editor-shell" onSubmit={submitProduct}>
                <div className="product-editor-columns">
                  <div className="product-editor-column product-editor-column-main">
                    <section className="editor-section editor-section-priority">
                      <div className="editor-section-head">
                        <div>
                          <p className="section-overline">Base</p>
                          <h3 className="subsection-title">Información principal</h3>
                        </div>
                      </div>

                      <div className="editor-grid editor-grid-compact">
                        <label className="stack-form compact-field product-name-field">
                          <span className="field-label">Nombre del producto</span>
                          <input type="text" value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} placeholder="Nombre" required />
                        </label>
                        <label className="stack-form compact-field">
                          <span className="field-label">Precio normal</span>
                          <div className="currency-input-wrap compact-price-field">
                            <span>$</span>
                            <input type="number" min={1} value={productForm.price || ""} onChange={(e) => setProductForm({ ...productForm, price: Number(e.target.value) })} placeholder="Precio normal" required />
                          </div>
                        </label>
                        <label className="stack-form compact-field">
                          <span className="field-label">Precio con descuento</span>
                          <div className="currency-input-wrap compact-price-field">
                            <span>$</span>
                            <input type="number" min={0} value={productForm.discountPrice || ""} onChange={(e) => setProductForm({ ...productForm, discountPrice: e.target.value ? Number(e.target.value) : null })} placeholder="Precio con descuento" />
                          </div>
                        </label>
                      </div>

                      <label className="stack-form compact-field">
                        <span className="field-label">Descripción</span>
                        <textarea rows={4} value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} placeholder="Descripción" required />
                      </label>

                      <div className="editor-inline-meta">
                        <label className="checkbox-row"><input type="checkbox" checked={productForm.featured} disabled={isDiscountedPrice(productForm.price, productForm.discountPrice)} onChange={(e) => setProductForm({ ...productForm, featured: e.target.checked })} />Marcar como destacado</label>
                        <div className="editor-summary-pills">
                          <span className="session-pill">{productForm.images.length} imagen(es)</span>
                          <span className="session-pill">{productForm.variantGroups?.length || 0} categoría(s)</span>
                          <span className="session-pill">{productForm.tags.length} etiqueta(s)</span>
                        </div>
                      </div>

                      {isDiscountedPrice(productForm.price, productForm.discountPrice) ? (
                        <p className="helper-text">Con descuento activo se marcará automáticamente como destacado, recibirá la etiqueta `descuento` y podrá filtrarse desde catálogo e inventario.</p>
                      ) : null}
                    </section>

                    <section className="editor-section">
                      <div className="inline-heading">
                        <div><p className="section-overline">Variantes</p><h3 className="subsection-title">Opciones del producto</h3></div>
                        <button className="secondary-button" type="button" onClick={addVariantGroup}>Agregar categoría</button>
                      </div>
                      <p className="helper-text">Usá categorías como color, talle, material o modelo para que el pedido quede bien cargado.</p>

                      <div className="variant-group-editor-list">
                        {(productForm.variantGroups || []).map((group, groupIndex) => (
                          <div key={`${group.name}-${groupIndex}`} className="variant-group-editor">
                            <div className="variant-group-editor-head">
                              <input type="text" value={group.name} onChange={(e) => updateVariantGroupName(groupIndex, e.target.value)} placeholder="Ej: Color" />
                              <button className="danger-button" type="button" onClick={() => removeVariantGroup(groupIndex)}>Eliminar</button>
                            </div>
                            <div className={`variant-editor ${isColorVariantGroup(group.name) ? "variant-editor-color" : ""}`}>
                              {isColorVariantGroup(group.name) ? (
                                <label className="color-picker-field">
                                  <input
                                    type="color"
                                    value={getVariantOptionDraftValue(group, variantOptionDrafts[groupIndex])}
                                    onChange={(e) => updateVariantOptionDraft(groupIndex, e.target.value)}
                                    aria-label="Elegir color"
                                  />
                                  <span className="color-picker-value">
                                    <span
                                      className="color-swatch"
                                      style={{ backgroundColor: getVariantOptionDraftValue(group, variantOptionDrafts[groupIndex]) }}
                                    />
                                  </span>
                                </label>
                              ) : (
                                <input type="text" value={variantOptionDrafts[groupIndex] || ""} onChange={(e) => updateVariantOptionDraft(groupIndex, e.target.value)} placeholder="Ej: Negro" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addVariantOption(groupIndex); } }} />
                              )}
                              <button className="secondary-button" type="button" onClick={() => addVariantOption(groupIndex)}>Agregar opción</button>
                            </div>
                            <div className="tag-row">
                              {group.options.map((option) => {
                                const isColorOption = isColorVariantGroup(group.name) && isHexColor(option);

                                return (
                                  <button
                                    key={option}
                                    type="button"
                                    className={`tag-chip tag-chip-action ${isColorOption ? "color-option-chip" : ""}`}
                                    onClick={() => removeVariantOption(groupIndex, option)}
                                    aria-label={isColorOption ? `Quitar color ${option}` : undefined}
                                    title={isColorOption ? option : undefined}
                                  >
                                    {isColorOption ? (
                                      <>
                                        <span className="color-swatch color-swatch-mini" style={{ backgroundColor: option }} />
                                        <span aria-hidden="true">×</span>
                                      </>
                                    ) : (
                                      `${option} ×`
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>

                  <div className="product-editor-column product-editor-column-side">
                    <section className="editor-section">
                      <div className="inline-heading">
                        <div><p className="section-overline">Imágenes</p><h3 className="subsection-title">Galería del producto</h3></div>
                        <button className="secondary-button" type="button" onClick={() => setMediaOrderOpen(true)}>Ordenar medios</button>
                      </div>

                      <div className="editor-dual-source">
                        <div className="variant-group-editor">
                          <div className="editor-source-label">Agregar por URL</div>
                          <div className="variant-editor">
                            <input type="url" value={urlImageDraft} onChange={(e) => setUrlImageDraft(e.target.value)} placeholder="Pegá una URL de imagen" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addImageUrl(); } }} />
                            <button className="secondary-button" type="button" onClick={addImageUrl}>Agregar imagen</button>
                          </div>
                        </div>

                        <label className="file-upload-field file-upload-field-multi">
                          <span>Subir desde tu ordenador</span>
                          <input type="file" accept="image/*" multiple onChange={handleImageUpload} />
                          <strong>Seleccionar archivos</strong>
                        </label>
                      </div>

                      <div className="editor-gallery-grid">
                        {(productForm.images || []).map((image, index) => (
                          <div key={`${image}-${index}`} className="editor-gallery-card">
                            <div className="editor-image-preview-media" style={{ backgroundImage: `url(${image})` }} />
                            <div className="editor-media-footer editor-media-footer-simple">
                              <button className="editor-remove-btn" type="button" onClick={() => removeImage(index)}>Quitar</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="editor-section editor-section-video">
                      <div className="inline-heading">
                        <div><p className="section-overline">Video</p><h3 className="subsection-title">Complemento visual</h3></div>
                      </div>

                      <div className="editor-dual-source">
                        <div className="variant-group-editor">
                          <div className="editor-source-label">Agregar por URL</div>
                          <div className="stack-form">
                            <input
                              type="text"
                              value={urlVideoLabelDraft}
                              onChange={(e) => setUrlVideoLabelDraft(e.target.value)}
                              placeholder="Nombre del video"
                            />
                            <div className="variant-editor">
                              <input
                                type="url"
                                value={urlVideoDraft}
                                onChange={(e) => setUrlVideoDraft(e.target.value)}
                                placeholder="Pegá una URL de YouTube o video"
                                onBlur={saveVideoUrl}
                              />
                              <button className="secondary-button" type="button" onClick={saveVideoUrl}>Guardar video</button>
                            </div>
                          </div>
                        </div>

                        <label className="file-upload-field">
                          <span>Subir desde tu ordenador</span>
                          <input type="file" accept="video/*" multiple onChange={handleVideoUpload} />
                          <strong>Seleccionar archivo</strong>
                        </label>
                      </div>

                      {productForm.videos.length > 0 ? (
                        <div className="editor-video-list">
                          {productForm.videos.map((video, index) => (
                            <div key={`${video.url}-${index}`} className="editor-video-card">
                              <div className="editor-media-footer editor-media-footer-simple">
                                <span className="editor-video-inline-label">{video.label || `Video ${index + 1}`}</span>
                                <button className="editor-remove-btn" type="button" onClick={() => removeVideo(index)}>
                                  Quitar
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="helper-text">Los videos se mostrarán dentro del detalle del producto junto a las imágenes.</p>
                      )}
                    </section>

                    <section className="editor-section">
                      <div className="inline-heading">
                        <div><p className="section-overline">Etiquetas</p><h3 className="subsection-title">Clasificación</h3></div>
                        <button className="secondary-button" type="button" onClick={() => setTagPickerOpen(true)}>Elegir etiquetas</button>
                      </div>
                      <p className="helper-text">Usalas para agrupar, filtrar y destacar mejor los productos.</p>
                      <div className="tag-selection-summary">
                        {productForm.tags.length > 0 ? (
                          <div className="tag-row">{productForm.tags.map((tag) => <span key={tag} className="tag-chip">#{tag}</span>)}</div>
                        ) : (<p className="helper-text">No hay etiquetas seleccionadas.</p>)}
                      </div>
                    </section>
                  </div>
                </div>

                <div className="product-editor-footer">
                  <div className="product-editor-footer-copy">
                    <strong>{editingId ? "Editando producto" : "Nuevo producto"}</strong>
                    <span>Guardá cuando ya estén completos datos, medios y clasificación.</span>
                  </div>
                  <div className="inline-actions">
                    <button className="primary-button" type="submit" disabled={isPending}>{editingId ? "Guardar cambios" : "Crear producto"}</button>
                    <button className="secondary-button" type="button" onClick={resetProductForm}>Cancelar</button>
                  </div>
                </div>
              </form>
              <p className={`feedback ${tagMessage || productMessage ? "visible" : ""}`}>{productMessage || tagMessage}</p>
            </div>
          </div>
        </div>
      ) : null}

      {userEditorOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={closeUserEditor}>
          <div className="modal-card modal-card-wide" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div><p className="section-overline">Users</p><h2>{userEditingId ? "Editar user" : "Nuevo user"}</h2></div>
              <button className="icon-button" type="button" onClick={closeUserEditor} aria-label="Cerrar">×</button>
            </div>

            <form className="stack-form" onSubmit={saveUser}>
              <div className="editor-grid">
                <input type="text" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} placeholder="Nombre y apellido" required />
                <input type="text" value={userForm.username} onChange={(e) => setUserForm({ ...userForm, username: e.target.value })} placeholder="Username" required />
              </div>
              <div className="editor-grid">
                <input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} placeholder="Email" required />
                <input type="text" value={userForm.phone} onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })} placeholder="Teléfono" />
              </div>
              <div className="editor-grid">
                <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value as User["role"] })}>
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
                <input type="password" value={userForm.password || ""} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} placeholder={userEditingId ? "Nueva contraseña (opcional)" : "Contraseña"} />
              </div>

              <div className="inline-actions">
                <button className="primary-button" type="submit" disabled={isPending}>{userEditingId ? "Guardar user" : "Crear user"}</button>
                {userEditingId ? (
                  <button className="danger-button" type="button" disabled={isPending || userEditingId === user.id} onClick={() => deleteUser(userEditingId)}>
                    Eliminar user
                  </button>
                ) : null}
                <button className="secondary-button" type="button" onClick={closeUserEditor}>Cancelar</button>
              </div>
            </form>
            <p className={`feedback ${userMessage ? "visible" : ""}`}>{userMessage}</p>
          </div>
        </div>
      ) : null}

      {tagModalOpen ? (
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
      ) : null}

      {tagPickerOpen ? (
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
      ) : null}

      {orderDraft ? (
        <div className="modal-backdrop" role="presentation" onClick={closeOrderEditor}>
          <div className="modal-card modal-card-order modal-card-order-wide order-editor-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div><p className="section-overline">{selectedOrder ? `Pedido #${selectedOrder.id}` : "Nuevo pedido"}</p><h2>{selectedOrder ? "Editar pedido" : "Crear pedido"}</h2></div>
              <button className="icon-button" type="button" onClick={closeOrderEditor} aria-label="Cerrar">×</button>
            </div>

            <div className="order-editor-scroll">
              <div className="order-edit-grid">
                <div className="stack-form autocomplete-shell">
                  <input
                    type="search"
                    value={orderUserSearch}
                    onChange={(e) => {
                      setOrderUserSearch(e.target.value);
                      setOrderUserMenuOpen(true);
                      if (!e.target.value.trim()) {
                        setOrderDraft((current) => (current ? { ...current, userId: null } : current));
                      }
                    }}
                    onFocus={() => setOrderUserMenuOpen(true)}
                    placeholder="Buscar user por nombre, username, email o teléfono"
                  />
                  {orderUserMenuOpen ? (
                    <div className="autocomplete-menu">
                      <button
                        type="button"
                        className={`autocomplete-option ${orderDraft.userId == null ? "active" : ""}`}
                        onClick={() => assignOrderUser("")}
                      >
                        <span>Sin usuario asignado</span>
                      </button>
                      {orderAssignableUsers.length > 0 ? (
                        orderAssignableUsers.map((listedUser) => (
                          <button
                            key={listedUser.id}
                            type="button"
                            className={`autocomplete-option ${orderDraft.userId === listedUser.id ? "active" : ""}`}
                            onClick={() => assignOrderUser(String(listedUser.id))}
                          >
                            <span>{listedUser.name}</span>
                            <small>@{listedUser.username}{listedUser.phone ? ` · ${listedUser.phone}` : ""}</small>
                          </button>
                        ))
                      ) : (
                        <div className="autocomplete-empty">No encontramos users con esa búsqueda.</div>
                      )}
                    </div>
                  ) : null}
                </div>
                {selectedOrder ? (
                  <input
                    type="text"
                    value={orderDraft.customerName}
                    onChange={(e) => updateOrderField("customerName", e.target.value)}
                    placeholder="Nombre del cliente"
                  />
                ) : (
                  <div className="mini-form-card order-user-summary">
                    <strong>{orderDraft.userId ? "Usuario asignado" : "Pedido sin usuario"}</strong>
                    <span>
                      {orderDraft.userId
                        ? `${selectedOrderUser?.name || orderDraft.customerName || "Cliente"}${selectedOrderUser?.username ? ` · @${selectedOrderUser.username}` : ""}${orderDraft.customerPhone ? ` · ${orderDraft.customerPhone}` : ""}`
                        : "Si no elegís un user, el pedido se guarda sin vincular y con nombre genérico."}
                    </span>
                  </div>
                )}
              </div>

              {selectedOrder ? (
                <div className="order-edit-grid">
                  <input type="text" value={orderDraft.customerPhone} onChange={(e) => updateOrderField("customerPhone", e.target.value)} placeholder="Teléfono del cliente" />
                  <select value={orderDraft.status} onChange={(e) => updateOrderField("status", e.target.value as OrderStatus)}>
                    <option value="pending">Pendiente</option>
                    <option value="accepted">Aceptado</option>
                    <option value="modified">Modificado</option>
                    <option value="rejected">Rechazado</option>
                  </select>
                </div>
              ) : (
                <input
                  type="text"
                  value={orderDraft.customerPhone}
                  onChange={(e) => updateOrderField("customerPhone", e.target.value)}
                  placeholder="Teléfono del cliente"
                />
              )}

              <textarea rows={2} value={orderDraft.notes} onChange={(e) => updateOrderField("notes", e.target.value)} placeholder="Notas del pedido" />

              <div className="order-edit-items">
                {orderDraft.items.map((item, index) => {
                  const isExistingProduct = item.productId > 0;
                  const linkedProduct = isExistingProduct ? products.find((product) => product.id === item.productId) || null : null;
                  const variantGroups = linkedProduct?.variantGroups || [];
                  const hasVariantGroups = variantGroups.length > 0;
                  const currentVariantSelections = hasVariantGroups ? parseVariantSelection(item.variant, variantGroups) : null;

                  return (
                    <div key={`${index}-${item.productName}`} className="order-edit-item-card">
                      <div className="order-edit-item-grid">
                        <input
                          className={!hasVariantGroups && isExistingProduct ? "order-edit-item-grid-full" : undefined}
                          type="text"
                          value={item.productName}
                          onChange={(e) => updateOrderItem(index, "productName", e.target.value)}
                          placeholder="Producto"
                          disabled
                          readOnly={isExistingProduct}
                        />
                        {hasVariantGroups ? (
                          <div className="order-variant-picker">
                            <div className="order-variant-picker-header">
                              <span>Elegí las categorías</span>
                              <strong>{item.variant ? <VariantDisplay value={item.variant} /> : "Sin variantes"}</strong>
                            </div>
                            <div className="order-variant-groups">
                              {variantGroups.map((group) => (
                                <div key={group.name} className="order-variant-group">
                                  <span className="order-variant-group-label">{group.name}</span>
                                  <div className="order-variant-options">
                                    {group.options.map((option) => {
                                      const isActive = currentVariantSelections?.[group.name] === option;
                                      const isColorOption = isColorVariantGroup(group.name) && isHexColor(option);

                                      return (
                                        <button
                                          key={option}
                                          type="button"
                                          className={`order-variant-option ${isColorOption ? "order-variant-option-color" : ""} ${isActive ? "active" : ""}`}
                                          onClick={() => updateOrderItemVariantSelection(index, linkedProduct!, group.name, option)}
                                          aria-label={isColorOption ? `Elegir color ${option}` : undefined}
                                          title={isColorOption ? option : undefined}
                                        >
                                          {isColorOption ? (
                                            <span className="color-swatch color-swatch-mini" style={{ backgroundColor: option }} aria-hidden="true" />
                                          ) : (
                                            option
                                          )}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : !isExistingProduct ? (
                          <input type="text" value={item.variant} onChange={(e) => updateOrderItem(index, "variant", e.target.value)} placeholder="Tipo. Ej: Color: Negro · Talle: M" />
                        ) : null}
                      </div>
                      <div className="order-edit-item-grid order-edit-item-grid-tight">
                        <div className="currency-input-wrap compact-price-field">
                          <span>$</span>
                          <input type="number" min={0} value={item.unitPrice || ""} onChange={(e) => updateOrderItem(index, "unitPrice", e.target.value)} placeholder="Precio" />
                        </div>
                        <input type="number" min={1} value={item.quantity || 1} onChange={(e) => updateOrderItem(index, "quantity", e.target.value)} placeholder="Cantidad" />
                        <button className="danger-button" type="button" onClick={() => removeOrderItem(index)}>Eliminar</button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="order-edit-footer-row">
                <button className="secondary-button" type="button" onClick={openOrderProductPicker}>Agregar producto</button>
                <div className="order-detail-total">
                  <span>Total recalculado</span>
                  <strong>{formatCurrency(orderDraftTotal)}</strong>
                </div>
              </div>

              <div className="order-actions">
                <button className="primary-button" type="button" disabled={isPending} onClick={() => saveOrderChanges(orderDraft.status)}>
                  {selectedOrder ? "Guardar cambios" : "Crear pedido"}
                </button>
                {selectedOrder ? (
                  <>
                    <button className="secondary-button" type="button" disabled={isPending} onClick={() => saveOrderChanges("accepted")}>Aceptar pedido</button>
                    <button className="danger-button" type="button" disabled={isPending} onClick={() => saveOrderChanges("rejected")}>Rechazar pedido</button>
                    <button className="danger-button" type="button" disabled={isPending} onClick={() => removeOrder(selectedOrder.id)}>Eliminar pedido</button>
                  </>
                ) : null}
                <button className="secondary-button" type="button" onClick={closeOrderEditor}>Cancelar</button>
              </div>
              <p className={`feedback ${orderMessage ? "visible" : ""}`}>{orderMessage}</p>
            </div>
          </div>
        </div>
      ) : null}

      {mediaOrderOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setMediaOrderOpen(false)}>
          <div className="modal-card modal-card-tag-picker modal-card-media-order" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div><p className="section-overline">Medios</p><h2>Ordenar imágenes y videos</h2></div>
              <button className="icon-button" type="button" onClick={() => setMediaOrderOpen(false)} aria-label="Cerrar">×</button>
            </div>

            <div className="media-order-layout">
              <section className="editor-section">
                <div className="inline-heading">
                  <div><p className="section-overline">Imágenes</p><h3 className="subsection-title">Orden de aparición</h3></div>
                </div>
                {productForm.images.length > 0 ? (
                  <div className="media-order-list">
                    {productForm.images.map((image, index) => (
                      <div key={`${image}-${index}`} className="media-order-item">
                        <div className="media-order-preview" style={{ backgroundImage: `url(${image})` }} />
                        <div className="media-order-copy">
                          <span className={`editor-media-order ${index === 0 ? "is-primary" : ""}`}>{index === 0 ? "Portada" : `Imagen ${index + 1}`}</span>
                          <span className="editor-media-subtitle">{index === 0 ? "Primera imagen del producto" : "Se muestra después de la anterior"}</span>
                        </div>
                        <div className="editor-order-controls" aria-label="Orden de imagen">
                          <button className="editor-order-btn" type="button" disabled={index === 0} onClick={() => moveImage(index, "up")}>↑</button>
                          <button className="editor-order-btn" type="button" disabled={index === productForm.images.length - 1} onClick={() => moveImage(index, "down")}>↓</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="helper-text">No hay imágenes cargadas.</p>
                )}
              </section>

              <section className="editor-section">
                <div className="inline-heading">
                  <div><p className="section-overline">Videos</p><h3 className="subsection-title">Orden de aparición</h3></div>
                </div>
                {productForm.videos.length > 0 ? (
                  <div className="media-order-list">
                    {productForm.videos.map((video, index) => (
                      <div key={`${video.url}-${index}`} className="media-order-item media-order-item-video">
                        <div className="media-order-preview media-order-preview-video">
                          <span>{video.url.includes("youtube.com") ? "YouTube" : video.url.startsWith("data:video/") ? "Archivo" : "URL"}</span>
                        </div>
                        <div className="media-order-copy">
                          <span className={`editor-media-order ${index === 0 ? "is-primary" : ""}`}>{index === 0 ? "Video principal" : `Video ${index + 1}`}</span>
                          <span className="editor-media-subtitle">{video.label || (index === 0 ? "Primer video del producto" : "Se muestra después del anterior")}</span>
                        </div>
                        <div className="editor-order-controls" aria-label="Orden de video">
                          <button className="editor-order-btn" type="button" disabled={index === 0} onClick={() => moveVideo(index, "up")}>↑</button>
                          <button className="editor-order-btn" type="button" disabled={index === productForm.videos.length - 1} onClick={() => moveVideo(index, "down")}>↓</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="helper-text">No hay videos cargados.</p>
                )}
              </section>
            </div>

            <div className="inline-actions">
              <button className="primary-button" type="button" onClick={() => setMediaOrderOpen(false)}>Listo</button>
            </div>
          </div>
        </div>
      ) : null}

      {productPickerOpen ? (
        <div className="modal-backdrop modal-backdrop-front" role="presentation" onClick={() => setProductPickerOpen(false)}>
          <div className="modal-card modal-card-order modal-card-order-wide order-picker-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="section-overline">Pedidos</p>
                <h2>Elegir producto del catálogo</h2>
              </div>
              <button className="icon-button" type="button" onClick={() => setProductPickerOpen(false)} aria-label="Cerrar">
                ×
              </button>
            </div>

            <div className="stack-form">
              <input
                type="search"
                value={orderProductSearch}
                onChange={(e) => setOrderProductSearch(e.target.value)}
                placeholder="Buscar por nombre, descripción o etiqueta"
              />

              <div className="order-picker-list">
                {orderPickerProducts.map((product) => (
                  <article key={product.id} className="order-picker-card">
                    <div className="order-picker-card-media">
                      <div className="order-picker-media-frame">
                        <img src={product.image} alt={product.name} className="inventory-media-tag" />
                      </div>
                    </div>
                    <div className="order-picker-card-body">
                      <div className="order-picker-card-header">
                        <div className="order-picker-title-row">
                          <h3>{product.name}</h3>
                          {product.discountPrice ? <span className="discount-badge">Descuento</span> : null}
                        </div>
                        <strong className="order-picker-price">{formatCurrency(getEffectivePrice(product))}</strong>
                      </div>
                      <p className="order-picker-description">{product.description}</p>
                      <div className="tag-row order-picker-tags">
                        {product.tags.map((tag) => (
                          <span key={tag} className="tag-chip">#{tag}</span>
                        ))}
                      </div>
                    </div>
                    <div className="order-picker-card-actions">
                      <button className="primary-button" type="button" onClick={() => addProductToOrder(product)}>
                        Agregar
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} onCheckout={() => setCartOpen(false)} />
    </>
  );
}
