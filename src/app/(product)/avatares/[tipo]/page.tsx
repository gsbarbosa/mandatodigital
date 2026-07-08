import { notFound } from "next/navigation";

import { AvatarHubPage } from "@/components/product/avatar-hub-page";
import { avatarTipoBySlug } from "@/lib/avatar-tipos";

export const metadata = {
  title: "Avatares",
};

export default async function AvatarHubRoute({
  params,
}: {
  params: Promise<{ tipo: string }>;
}) {
  const { tipo } = await params;
  const avatarTipo = avatarTipoBySlug(tipo);
  if (!avatarTipo) {
    notFound();
  }
  return <AvatarHubPage tipo={avatarTipo} />;
}
