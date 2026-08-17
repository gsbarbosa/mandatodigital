import { AsyncJobQuotaError } from "@/lib/async-jobs-enqueue";
import { checkElectoralBlackout } from "@/lib/distribution/blackout";
import { socialConnectionStorage } from "@/lib/distribution/connection-storage";
import { enqueuePublishPostJob } from "@/lib/distribution/enqueue-publish";
import { distributionPostStorage } from "@/lib/distribution/post-storage";

/**
 * O Instagram Graph não agenda: o publisher marca `scheduled` e devolve. Sem
 * este passo o pacote ficaria parado para sempre. Aqui varremos os agendados
 * cujo horário já venceu e reenfileiramos com `scheduledAt: null`, que é o que
 * faz o publisher postar de fato.
 */

export type ScheduledSweepResult = {
  scanned: number;
  enqueued: number;
  blocked: number;
  skipped: number;
  failed: number;
  details: Array<{
    postId: string;
    outcome: "enqueued" | "blocked_blackout" | "skipped" | "failed";
    reason?: string;
  }>;
};

export async function publishDueScheduledPosts(input?: {
  now?: Date;
  limit?: number;
}): Promise<ScheduledSweepResult> {
  const now = input?.now ?? new Date();
  const due = await distributionPostStorage.listScheduledDue({
    now,
    limit: input?.limit ?? 25,
  });

  const result: ScheduledSweepResult = {
    scanned: due.length,
    enqueued: 0,
    blocked: 0,
    skipped: 0,
    failed: 0,
    details: [],
  };

  for (const post of due) {
    // O blackout pode ter entrado em vigor entre o Go e o horário marcado.
    const connection = await socialConnectionStorage.getByProfileId(post.profileId);
    const blackout = checkElectoralBlackout({
      at: now,
      electionDate: connection?.electionDate,
    });
    if (blackout.blocked) {
      await distributionPostStorage.update(post.id, {
        status: "blocked_blackout",
        lastError: blackout.reason,
      });
      result.blocked += 1;
      result.details.push({
        postId: post.id,
        outcome: "blocked_blackout",
        reason: blackout.reason,
      });
      continue;
    }

    const pending = post.channels.filter(
      (channel) => post.perChannelStatus[channel]?.status !== "published",
    );
    if (pending.length === 0) {
      // Cura o registro em vez de pular para sempre: pacote com todos os
      // canais publicados e status "scheduled" e resquicio do bug antigo em
      // derivePostStatus, onde a flag de agendamento vencia o publicado.
      await distributionPostStorage.update(post.id, {
        status: "published",
        lastError: "",
      });
      result.skipped += 1;
      result.details.push({
        postId: post.id,
        outcome: "skipped",
        reason: "Todos os canais ja publicados — status corrigido para published.",
      });
      continue;
    }

    try {
      // scheduledAt null = publica agora. O worker usa `payload.scheduledAt`
      // quando definido, então isto vence o valor gravado no pacote.
      await enqueuePublishPostJob({
        ownerUserId: post.ownerUserId,
        distributionPostId: post.id,
        channels: pending,
        scheduledAt: null,
        dueAt: post.scheduledAt,
      });
      result.enqueued += 1;
      result.details.push({ postId: post.id, outcome: "enqueued" });
    } catch (error) {
      // Quota é transitória: o próximo tick tenta de novo, o pacote continua
      // `scheduled`. Não marcamos falha para não perder o agendamento.
      const reason =
        error instanceof Error ? error.message : "Falha ao enfileirar publicacao.";
      if (error instanceof AsyncJobQuotaError) {
        result.skipped += 1;
        result.details.push({ postId: post.id, outcome: "skipped", reason });
        continue;
      }
      await distributionPostStorage.update(post.id, { lastError: reason });
      result.failed += 1;
      result.details.push({ postId: post.id, outcome: "failed", reason });
    }
  }

  return result;
}
