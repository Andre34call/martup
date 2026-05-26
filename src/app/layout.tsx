import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { QueryProvider } from "@/components/ecommerce/providers";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// ==================== SEO METADATA ====================
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://martup-seven.vercel.app";

export const metadata: Metadata = {
  title: {
    default: "MartUp - Belanja Online Terpercaya | Promo & Diskon Terbaik",
    template: "%s | MartUp",
  },
  description:
    "MartUp adalah platform e-commerce terpercaya di Indonesia. Belanja online dengan harga terbaik, promo menarik, dan pengiriman cepat. Ribuan produk dari seller terverifikasi.",
  keywords: [
    "belanja online",
    "e-commerce indonesia",
    "toko online",
    "diskon",
    "promo",
    "belanja murah",
    "marketplace",
    "martup",
    "jual beli online",
    "pengiriman cepat",
  ],
  authors: [{ name: "MartUp Team" }],
  creator: "MartUp",
  publisher: "MartUp",
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: "/",
    languages: {
      "id-ID": "/",
    },
  },
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: siteUrl,
    siteName: "MartUp",
    title: "MartUp - Belanja Online Terpercaya | Promo & Diskon Terbaik",
    description:
      "Platform e-commerce terpercaya di Indonesia. Belanja online dengan harga terbaik, promo menarik, dan pengiriman cepat.",
    images: [
      {
        url: `${siteUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "MartUp - Belanja Online Terpercaya",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MartUp - Belanja Online Terpercaya",
    description:
      "Platform e-commerce terpercaya di Indonesia. Belanja online dengan harga terbaik.",
    images: [`${siteUrl}/og-image.png`],
    creator: "@martup_id",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/apple-icon.png" },
      { url: "/apple-icon-180.png", sizes: "180x180" },
    ],
  },
  manifest: "/manifest.json",
  category: "shopping",
  classification: "E-Commerce Marketplace",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#10b981" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

// ==================== JSON-LD STRUCTURED DATA ====================
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "MartUp",
  url: siteUrl,
  description:
    "Platform e-commerce terpercaya di Indonesia. Belanja online dengan harga terbaik, promo menarik, dan pengiriman cepat.",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${siteUrl}/?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
  publisher: {
    "@type": "Organization",
    name: "MartUp",
    logo: {
      "@type": "ImageObject",
      url: `${siteUrl}/icon-512.png`,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        {/* JSON-LD Structured Data for SEO */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {/* Preconnect to external resources for performance */}
        <link rel="preconnect" href="https://rzrfouzuxcxdbhadbppi.supabase.co" />
        <link rel="dns-prefetch" href="https://rzrfouzuxcxdbhadbppi.supabase.co" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            {children}
            <Toaster />
          </QueryProvider>
        </ThemeProvider>
        {/* Vercel Analytics — automatically tracks page views and Web Vitals */}
        <Analytics />
      </body>
    </html>
  );
}
