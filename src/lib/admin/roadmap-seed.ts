import type { RoadmapTaskInput, RoadmapSection, RoadmapStatus, RoadmapValidated } from "@/lib/admin/roadmap-types";

type SeedRow = {
  title: string;
  status: RoadmapStatus;
  validatedByThiago: RoadmapValidated;
  observation: string;
  section: RoadmapSection;
};

/** Espelho inicial de docs/checklist-roadmap-05ago.md */
export const ROADMAP_SEED: SeedRow[] = [
  {
    section: "experiencia",
    title: "Onboarding ao chegar no sistema",
    status: "done",
    validatedByThiago: "pendente",
    observation: "Checklist + coachmarks + fases; ver onboarding-provider",
  },
  {
    section: "experiencia",
    title: "Ajustes de fluxo e navegação",
    status: "done",
    validatedByThiago: "pendente",
    observation: "Home /monitoramento, sidebar, redirects pós-login",
  },
  {
    section: "experiencia",
    title: "Sentinela — melhorias (foco entrega 25/)",
    status: "inprogress",
    validatedByThiago: "pendente",
    observation: "Pipelines v2 + LLM + trend em prod; falta social/Instagram, refresh auto",
  },
  {
    section: "experiencia",
    title: "Revisar textos de Compliance no sistema",
    status: "done",
    validatedByThiago: "sim",
    observation: "Marcado x no roadmap; confirmar se copy atual ainda bate",
  },
  {
    section: "experiencia",
    title: "Revisar dossiê do site de preços",
    status: "done",
    validatedByThiago: "sim",
    observation: "Marcado x no roadmap; templates/PDF legais existem",
  },
  {
    section: "experiencia",
    title: "Cruzar sistema × arquivo compliance-tSE",
    status: "done",
    validatedByThiago: "sim",
    observation: "Selo, export-accept, fact-check e contrato cobrem parte",
  },
  {
    section: "experiencia",
    title: "Testar ambiente guest vs premium (limites)",
    status: "inprogress",
    validatedByThiago: "pendente",
    observation: "Modo conta + créditos guest; falta QA formal",
  },
  {
    section: "experiencia",
    title: "Filtro CNPJ eleitoral + teto vagas partido/UF + lista de reserva",
    status: "inprogress",
    validatedByThiago: "pendente",
    observation: "Natureza jurídica via BrasilAPI; teto 03/partido só no copy",
  },
  {
    section: "experiencia",
    title: "URL canônica → mandatodigital.ia.br",
    status: "inprogress",
    validatedByThiago: "pendente",
    observation: "Alinhar DNS + NEXT_PUBLIC_APP_BASE_URL",
  },
  {
    section: "sistema-agora",
    title: "Migração de banco de dados",
    status: "done",
    validatedByThiago: "n/a",
    observation: "Cutover Firestore + Storage concluído",
  },
  {
    section: "sistema-agora",
    title: "Centralização de contas (APIs/serviços) + painel adm de créditos/alarmes",
    status: "todo",
    validatedByThiago: "pendente",
    observation: "Aguardando painel do Guga",
  },
  {
    section: "sistema-agora",
    title: "Suporte via IA (N1 Sonnet / N2 Opus / N3 humano)",
    status: "todo",
    validatedByThiago: "pendente",
    observation: "Não existe",
  },
  {
    section: "sistema-agora",
    title: "Painel de gestão com suporte",
    status: "inprogress",
    validatedByThiago: "pendente",
    observation: "MVP do painel /admin em andamento",
  },
  {
    section: "sistema-agora",
    title: "Roteiro.gif — UX de progresso do Sentinela",
    status: "todo",
    validatedByThiago: "pendente",
    observation: "Loading genérico existe; animação narrada não",
  },
  {
    section: "sistema-agora",
    title: "Métricas para aperfeiçoamento semi-automático",
    status: "inprogress",
    validatedByThiago: "pendente",
    observation: "/auditoria existe; falta loop de melhoria automática",
  },
  {
    section: "sistema-agora",
    title: "Obter/estruturar contatos TSE (dados/crawler)",
    status: "todo",
    validatedByThiago: "pendente",
    observation: "Fora do produto hoje",
  },
  {
    section: "pos-25",
    title: "Preencher contrato/dossiê + e-mail no aceite",
    status: "inprogress",
    validatedByThiago: "pendente",
    observation: "PDFs + e-mail ok; NF ainda não",
  },
  {
    section: "pos-25",
    title: "Emitir 3 boletos (3 parcelas) de uma vez no aceite",
    status: "todo",
    validatedByThiago: "pendente",
    observation: "Só copy na UI",
  },
  {
    section: "pos-25",
    title: "Conciliação bancária → bloquear plataforma se inadimplente",
    status: "todo",
    validatedByThiago: "pendente",
    observation: "Só texto contratual",
  },
  {
    section: "pos-25",
    title: "Menu “Meus pagamentos” + alerta 5 dias antes do vencimento",
    status: "todo",
    validatedByThiago: "pendente",
    observation: "Fora do nav",
  },
  {
    section: "pos-25",
    title: "Travas/cadeados por ausência de pagamento / data",
    status: "todo",
    validatedByThiago: "pendente",
    observation: "Não existe",
  },
  {
    section: "pos-25",
    title: "Teste de volumetria HeyGen (+ provedor alternativo)",
    status: "todo",
    validatedByThiago: "pendente",
    observation: "Não documentado",
  },
  {
    section: "pos-25",
    title: "Agente Distribuidor",
    status: "inprogress",
    validatedByThiago: "pendente",
    observation: "UI mock; sem publicação real",
  },
  {
    section: "pos-25",
    title: "Materialidade — dados salvos e estruturados (agora)",
    status: "inprogress",
    validatedByThiago: "pendente",
    observation: "audit_log + /auditoria",
  },
  {
    section: "pos-25",
    title: "Materialidade self-service (relatórios + prints + export)",
    status: "todo",
    validatedByThiago: "pendente",
    observation: "Meta sugerida ≥ 10/Set",
  },
  {
    section: "features-novas",
    title: "Multiplicador de cidades (N vídeos localizados)",
    status: "todo",
    validatedByThiago: "pendente",
    observation: "Spec no roadmap; botão nos avatares ainda não existe",
  },
  {
    section: "features-novas",
    title: "Controles de avatar (expressão, gestos, postura, imobilidade, olhar)",
    status: "todo",
    validatedByThiago: "pendente",
    observation: "Só defaults internos HeyGen",
  },
  {
    section: "features-novas",
    title: "Alterar background do avatar",
    status: "todo",
    validatedByThiago: "pendente",
    observation: "Backlog Fase 3.4",
  },
];

export function roadmapSeedAsInputs(): RoadmapTaskInput[] {
  return ROADMAP_SEED.map((row, index) => ({
    title: row.title,
    status: row.status,
    validatedByThiago: row.validatedByThiago,
    observation: row.observation,
    section: row.section,
    sortOrder: index,
  }));
}
