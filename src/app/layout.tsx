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
});

export const metadata: Metadata = {
  title: {
    default: "Mandato Digital — IA para Comunicação Política e Eleitoral",
    template: "%s | Mandato Digital",
  },
  description:
    "Ecossistema de agentes de IA para monitorar, produzir, auditar e publicar a comunicação da sua campanha — com identidade preservada e compliance TSE.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: APPEARANCE_BOOTSTRAP_SCRIPT }} />
      </head>
      <body className={plusJakartaSans.className}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
