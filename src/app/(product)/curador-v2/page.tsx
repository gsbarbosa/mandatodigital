import { redirect } from "next/navigation";

/** Rota legada: Curador principal agora e /curador (HeyGen). */
export default function CuradorV2LegacyRoute() {
  redirect("/curador");
}
