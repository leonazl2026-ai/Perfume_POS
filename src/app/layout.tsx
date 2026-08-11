import type { Metadata } from "next";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { getLanguage } from "@/lib/i18n/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "Perfume & Decant POS",
  description: "Point of sale and inventory management for perfume decanting",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Read on the server so the first paint is already in the chosen language.
  const lang = await getLanguage();

  return (
    <html lang={lang === "mm" ? "my" : "en"}>
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <I18nProvider initialLang={lang}>{children}</I18nProvider>
      </body>
    </html>
  );
}
