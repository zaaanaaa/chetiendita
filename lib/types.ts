export type UserRole = "admin" | "user";

export interface User {
  id: number;
  username: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
}

export interface SessionUser extends User {
  token: string;
}

export interface UserInput {
  username: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  password?: string;
}

export interface Tag {
  id: number;
  name: string;
}

export interface HeroSettings {
  images: string[];
}

export interface ProductVariantGroup {
  name: string;
  options: string[];
}

export interface ProductVideo {
  url: string;
  label: string;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  discountPrice: number | null;
  image: string;
  images: string[];
  videos: ProductVideo[];
  video: string | null;
  featured: boolean;
  soldCount: number;
  createdAt: string;
  tags: string[];
  variants: string[];
  variantGroups: ProductVariantGroup[];
}

export interface ProductInput {
  name: string;
  description: string;
  price: number;
  discountPrice: number | null;
  image: string;
  images: string[];
  videos: ProductVideo[];
  video: string | null;
  featured: boolean;
  tags: string[];
  variants?: string[];
  variantGroups?: ProductVariantGroup[];
}

export type OrderStatus = "pending" | "accepted" | "modified" | "rejected";

export interface OrderItem {
  id: number;
  productId: number;
  productName: string;
  variant: string;
  quantity: number;
  unitPrice: number;
  image: string;
}

export interface Order {
  id: number;
  userId: number | null;
  customerName: string;
  customerPhone: string;
  notes: string;
  status: OrderStatus;
  total: number;
  createdAt: string;
  items: OrderItem[];
}

export interface OrderItemInput {
  productId: number;
  productName: string;
  variant: string;
  quantity: number;
  unitPrice: number;
  image: string;
}

export interface OrderInput {
  userId?: number | null;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  items: OrderItemInput[];
}

export interface OrderUpdateInput {
  userId?: number | null;
  customerName: string;
  customerPhone: string;
  notes: string;
  status: OrderStatus;
  items: OrderItemInput[];
}

export interface UserWithOrders extends User {
  orders: Order[];
}

export interface AuthResponse {
  user: User;
}

export interface RecoveryRequestResult {
  ok: boolean;
  previewCode?: string;
}

export interface ApiError {
  error: string;
}
