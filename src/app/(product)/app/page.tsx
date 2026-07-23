import { redirect } from "next/navigation";

import { APP_DEFAULT_LANDING } from "@/lib/app-home";

/** Entrada do sistema logado — alias estável para o monitoramento. */
export default function AppHomeRoute() {
  redirect(APP_DEFAULT_LANDING);
}
