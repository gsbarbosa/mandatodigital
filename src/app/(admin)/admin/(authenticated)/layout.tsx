import type { Route } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminSession } from "@/lib/admin/session";
import { getSessionUser } from "@/lib/auth/session";

export default async function AdminAuthenticatedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getAdminSession();
  if (!session) {
    const user = await getSessionUser();
    if (!user) {
      redirect("/login?next=/admin" as Route);
    }
    redirect("/" as Route);
  }

  return <AdminShell email={session.email}>{children}</AdminShell>;
}
