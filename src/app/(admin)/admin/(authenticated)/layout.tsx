import type { Route } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminSession } from "@/lib/admin/session";

export default async function AdminAuthenticatedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login" as Route);
  }

  return <AdminShell email={session.email}>{children}</AdminShell>;
}
