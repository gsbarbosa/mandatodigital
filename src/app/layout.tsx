import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";
import { APPEARANCE_BOOTSTRAP_SCRIPT } from "@/lib/appearance";

import "./globals.css";
import "./tailwind.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-plus-jakarta-sans",
});

export const metadata: Metadata = {
  title: {
    default: "Mandato Digital — IA para Comunicação Política e Eleitoral",
    template: "%s | Mandato Digital",
  },
  description:
    "Ecossistema de agentes de IA para monitorar, produzir, auditar e publicar a comunicação da sua campanha — com identidade preservada e compliance TSE.",
  icons: {
    icon: [
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/favicon-48.png", sizes: "48x48", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={plusJakartaSans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: APPEARANCE_BOOTSTRAP_SCRIPT }} />
      </head>
      <body className={plusJakartaSans.className}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
