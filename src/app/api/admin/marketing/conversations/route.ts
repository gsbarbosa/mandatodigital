import { adminApiRoute } from "@/lib/admin/api-route";
import { listConversations } from "@/lib/outbound/conversations-storage";
import { isWhatsappConfigured } from "@/lib/outbound/whatsapp";

export async function GET() {
  return adminApiRoute(async () => {
    const [conversations, whatsappReady] = await Promise.all([
      listConversations(),
      isWhatsappConfigured(),
    ]);

    return {
      conversations,
      whatsappReady,
      webhookConfigured: Boolean(
        process.env.WHATSAPP_VERIFY_TOKEN?.trim() && process.env.WHATSAPP_APP_SECRET?.trim(),
      ),
    };
  });
}
