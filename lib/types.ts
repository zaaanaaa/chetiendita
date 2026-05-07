export type UserRole = "admin" | "user";

export interface User {
  id: number;
  username: string;
  email: string;
  role: UserRole;
}

export interface SessionUser extends User {
  token: string;
}

export interface Tag {
  id: number;
  name: string;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  image: string;
  featured: boolean;
  soldCount: number;
  createdAt: string;
  tags: string[];
  variants: string[];
}

export interface ProductInput {
  name: string;
  description: string;
  price: number;
  image: string;
  featured: boolean;
  tags: string[];
  variants?: string[];
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
  customerName: string;
  customerPhone: string;
  notes: string;
  items: OrderItemInput[];
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
