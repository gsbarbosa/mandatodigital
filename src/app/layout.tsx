import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";

import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Mandato Digital — A Tropa de IA do Seu Mandato",
    template: "%s | Mandato Digital",
  },
  description:
    "Do fato ao feed em 15 minutos. Ecossistema de IA para monitorar, produzir, auditar e publicar comunicação política sem perder a sua voz.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={plusJakartaSans.className}>{children}</body>
    </html>
  );
}
