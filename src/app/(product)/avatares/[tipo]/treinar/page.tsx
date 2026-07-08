import { notFound } from "next/navigation";

import { AvatarTreinarPage } from "@/components/product/avatar-treinar-page";
import { avatarTipoBySlug } from "@/lib/avatar-tipos";

export const metadata = {
  title: "Treinar avatar",
};

export default async function AvatarTreinarRoute({
  params,
}: {
  params: Promise<{ tipo: string }>;
}) {
  const { tipo } = await params;
  const avatarTipo = avatarTipoBySlug(tipo);
  if (!avatarTipo) {
    notFound();
  }
  return <AvatarTreinarPage tipo={avatarTipo} />;
}
