import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";

import { CartProvider } from "@/components/cart-context";

import "@/app/globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Che Tiendita",
  description: "Catalogo boutique en Next.js, TypeScript y SQLite.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${fraunces.variable} ${manrope.variable}`}>
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
