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
}

export interface ProductInput {
  name: string;
  description: string;
  price: number;
  image: string;
  featured: boolean;
  tags: string[];
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
