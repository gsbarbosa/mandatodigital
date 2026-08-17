import { enqueueAsyncJob } from "@/lib/async-jobs-enqueue";
import type { DistributionChannelId } from "@/lib/distribution/channels";

/**
 * `createAsyncJob` devolve o job existente quando a idempotencyKey repete, e um
 * job já concluído não pode ser reivindicado. Por isso cada origem de disparo
 * tem seu próprio formato de chave:
 *
 * - Go da fila: `publish:<post>:<canais>` — reaprovar o mesmo pacote não duplica.
 * - Retry manual: sufixo de tempo, porque é uma ação explícita do usuário.
 * - Agendado: inclui o `scheduledAt`, então dois ticks do Cloud Scheduler na
 *   mesma janela convergem para o mesmo job, e um horário novo gera outro.
 */
export async function enqueuePublishPostJob(input: {
  ownerUserId: string;
  distributionPostId: string;
  channels: DistributionChannelId[];
  scheduledAt?: string | null;
  retryFailedOnly?: boolean;
  /** Marca o disparo vindo do worker de agendados. */
  dueAt?: string | null;
}) {
  const channelKey = [...input.channels].sort().join(",");

  let idempotencyKey: string;
  if (input.retryFailedOnly) {
    idempotencyKey = `publish-retry:${input.distributionPostId}:${channelKey}:${Date.now()}`;
  } else if (input.dueAt) {
    idempotencyKey = `publish-scheduled:${input.distributionPostId}:${channelKey}:${input.dueAt}`;
  } else {
    idempotencyKey = `publish:${input.distributionPostId}:${channelKey}`;
  }

  return enqueueAsyncJob({
    ownerUserId: input.ownerUserId,
    type: "publish_post",
    idempotencyKey,
    payload: {
      distributionPostId: input.distributionPostId,
      channels: input.channels,
      scheduledAt: input.scheduledAt ?? null,
      retryFailedOnly: Boolean(input.retryFailedOnly),
    },
  });
}
