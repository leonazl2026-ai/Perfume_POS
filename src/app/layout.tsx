import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Perfume & Decant POS",
  description: "Point of sale and inventory management for perfume decanting",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
