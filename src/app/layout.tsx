import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { brandCss } from "@/lib/brand";
import { BrandProvider, type Brand } from "@/components/BrandContext";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", weight: ["400", "600", "700", "800"] });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jet = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jet" });

export const metadata: Metadata = {
  title: "VINCIT HUB",
  description: "Central de sistemas da VINCIT",
};

async function myBrand(): Promise<Brand> {
  try {
    const s = await createClient();
    const { data: { user } } = await s.auth.getUser();
    if (!user) return {};
    const { data } = await s.from("profiles").select("brand_color,brand_logo_url,brand_name").eq("id", user.id).maybeSingle();
    return { color: data?.brand_color, logo: data?.brand_logo_url, name: data?.brand_name };
  } catch { return {}; }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const brand = await myBrand();
  const css = brandCss(brand.color);
  return (
    <html lang="pt-BR" className={`${bricolage.variable} ${inter.variable} ${jet.variable}`}>
      <body className="grain min-h-screen">
        {css && <style id="brand-theme" dangerouslySetInnerHTML={{ __html: css }} />}
        <BrandProvider value={brand}>{children}</BrandProvider>
      </body>
    </html>
  );
}
