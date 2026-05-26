import type { ReactNode } from "react";
import type { Route } from "next";

import {
  archetypeOptions,
  defaultFormats,
  defaultIntensities,
  spectrumOptions,
} from "@/lib/constants";
import type { DashboardData } from "@/lib/types";
import type {
  ContentFormat,
  ContentStatus,
  EvaluationCriterion,
  EvaluationReport,
  IntensityLevel,
  ProductFeedback,
} from "@/lib/types";

export type ProfileFormState = {
  id?: string;
  fullName: string;
  role: string;
  city: string;
  state: string;
  audience: string;
  spectrum: string;
  archetype: string;
  voiceTones: string[];
  keyIssues: string;
  slogans: string;
  redLines: string;
  referenceExamples: string;
  bio: string;
};

export type RequestFormState = {
  topic: string;
  objective: string;
  format: ContentFormat;
  intensity: IntensityLevel;
  context: string;
  keyFacts: string;
  desiredCallToAction: string;
};

export type ProductFeedbackFormState = {
  screen: string;
  workedWell: string;
  issueObserved: string;
};

export type DashboardSectionId =
  | "overview"
  | "sentinela"
  | "curador"
  | "criativo"
  | "auditor"
  | "distribuidor"
  | "admin";

export type WorkflowStageStatus = "ativo" | "parcial" | "planejado" | "aberto";

export type WorkflowStageDefinition = {
  id: Exclude<DashboardSectionId, "overview">;
  menuLabel: string;
  title: string;
  subtitle: string;
  description: string;
  inputLabel: string;
  outputLabel: string;
  status: WorkflowStageStatus;
};

export type ApiErrorPayload = {
  message?: string;
  issues?: {
    fieldErrors?: Record<string, string[] | undefined>;
    formErrors?: string[];
  };
};

export function toTextarea(items: string[]) {
  return items.join("\n");
}

export function parseTextarea(value: string) {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function buildProfileState(data: DashboardData["profile"]): ProfileFormState {
  return {
    id: data?.id,
    fullName: data?.fullName ?? "",
    role: data?.role ?? "",
    city: data?.city ?? "",
    state: data?.state ?? "",
    audience: data?.audience ?? "",
    spectrum: data?.spectrum ?? spectrumOptions[0],
    archetype: data?.archetype ?? archetypeOptions[0],
    voiceTones: data?.voiceTones?.length ? data.voiceTones : ["Didatico"],
    keyIssues: toTextarea(data?.keyIssues ?? []),
    slogans: toTextarea(data?.slogans ?? []),
    redLines: toTextarea(data?.redLines ?? []),
    referenceExamples: toTextarea(data?.referenceExamples ?? []),
    bio:
      data?.bio ??
      "Mandato focado em entregas concretas, linguagem clara e defesa consistente das pautas prioritarias.",
  };
}

export function buildRequestState(): RequestFormState {
  return {
    topic: "",
    objective: "",
    format: defaultFormats[0],
    intensity: defaultIntensities[1],
    context: "",
    keyFacts: "",
    desiredCallToAction: "",
  };
}

export function buildProductFeedbackState(): ProductFeedbackFormState {
  return {
    screen: "",
    workedWell: "",
    issueObserved: "",
  };
}

export function buildEvaluationReportsFromDashboard(
  data: DashboardData,
): EvaluationReport[] {
  return data.evaluationRuns.map((run) => {
    const candidates = data.evaluationCandidates
      .filter((candidate) => candidate.evaluationRunId === run.id)
      .map((candidate) => {
        const scores = data.evaluationScores.filter(
          (score) => score.candidateId === candidate.id,
        );
        const overall =
          scores.find((score) => score.criterion === "overall")?.score ??
          (scores.length
            ? scores.reduce((sum, score) => sum + score.score, 0) / scores.length
            : 0);

        return {
          ...candidate,
          scores,
          totalScore: Number(overall.toFixed(2)),
        };
      });

    const winner =
      candidates.find((candidate) => candidate.id === run.winnerCandidateId) ??
      [...candidates].sort((left, right) => right.totalScore - left.totalScore)[0] ??
      null;

    return {
      run,
      candidates,
      winner,
    };
  });
}

export const dashboardMenuItems: Array<{
  id: DashboardSectionId;
  label: string;
  href: Route;
}> = [
  { id: "overview", label: "Visao inicial", href: "/" },
  { id: "sentinela", label: "Sentinela", href: "/sentinela" },
  { id: "curador", label: "Curador", href: "/curador" },
  { id: "criativo", label: "Criativo", href: "/criativo" },
  { id: "auditor", label: "Auditor", href: "/auditor" },
  { id: "distribuidor", label: "Distribuidor", href: "/distribuidor" },
  { id: "admin", label: "Admin", href: "/admin" },
];

export const workflowStages: WorkflowStageDefinition[] = [
  {
    id: "sentinela",
    menuLabel: "Sentinela",
    title: "Sentinela",
    subtitle: "Radar e sinais",
    description:
      "Camada de captura de temas, alertas e oportunidades. No MVP atual, essa etapa ainda e manual e alimenta o fluxo por briefing humano.",
    inputLabel: "Sinais de rua, noticias, demandas internas e observacoes do time.",
    outputLabel: "Fila priorizada de temas que merecem curadoria editorial.",
    status: "planejado",
  },
  {
    id: "curador",
    menuLabel: "Curador",
    title: "Curador",
    subtitle: "Identidade e framing",
    description:
      "Aqui o sistema organiza identidade politica, tom e contexto para transformar uma necessidade em briefing editorial acionavel.",
    inputLabel: "Perfil do parlamentar, contexto politico e direcionamento do time.",
    outputLabel: "Briefing editorial pronto para a geracao criativa.",
    status: "ativo",
  },
  {
    id: "criativo",
    menuLabel: "Criativo",
    title: "Criativo",
    subtitle: "Geracao de pecas",
    description:
      "O motor criativo gera variacoes de conteudo com base na pauta priorizada, formato e intensidade escolhidos pela equipe.",
    inputLabel: "Briefing editorial estruturado e CTA esperado.",
    outputLabel: "Rascunhos candidatos para revisao humana.",
    status: "ativo",
  },
  {
    id: "auditor",
    menuLabel: "Auditor",
    title: "Auditor",
    subtitle: "Revisao e qualidade",
    description:
      "Fase de lapidacao humana, registro de feedback editorial e checagem da qualidade do material antes de seguir adiante.",
    inputLabel: "Pecas geradas, prompt usado e observacoes do time.",
    outputLabel: "Texto aprovado, feedback acumulado e trilha de revisao.",
    status: "ativo",
  },
  {
    id: "distribuidor",
    menuLabel: "Distribuidor",
    title: "Distribuidor",
    subtitle: "Entrega e publicacao",
    description:
      "Camada futura para empacotar o conteudo aprovado para canais, agenda e operacao de distribuicao.",
    inputLabel: "Conteudo aprovado e contexto de canal/publico.",
    outputLabel: "Plano de distribuicao, publicacao e acompanhamento de entrega.",
    status: "planejado",
  },
  {
    id: "admin",
    menuLabel: "Admin",
    title: "Admin",
    subtitle: "Governanca do sistema",
    description:
      "Area visivel para todos por enquanto, concentrando feedbacks do produto, avaliacoes do core da LLM e leitura operacional do MVP.",
    inputLabel: "Logs de avaliacao, feedbacks de uso e execucoes do pipeline.",
    outputLabel: "Decisoes sobre prompt, modelo, backlog e qualidade operacional.",
    status: "aberto",
  },
];

export const workflowStageById = Object.fromEntries(
  workflowStages.map((stage) => [stage.id, stage]),
) as Record<Exclude<DashboardSectionId, "overview">, WorkflowStageDefinition>;

const fieldLabels: Record<string, string> = {
  fullName: "Nome publico",
  role: "Cargo / posicao",
  city: "Cidade",
  state: "UF",
  audience: "Eleitorado prioritario",
  spectrum: "Espectro politico",
  archetype: "Arquetipo dominante",
  voiceTones: "Tons de voz",
  keyIssues: "Pautas prioritarias",
  slogans: "Bordoes / assinaturas",
  redLines: "Linhas vermelhas",
  referenceExamples: "Exemplos de fala / referencia",
  bio: "Resumo da identidade",
  topic: "Tema do dia",
  objective: "Objetivo da peca",
  format: "Formato",
  intensity: "Intensidade",
  context: "Contexto adicional",
  keyFacts: "Fatos confirmados",
  desiredCallToAction: "CTA desejado",
  screen: "Tela / fluxo",
  workedWell: "O que funcionou bem",
  issueObserved: "O que nao funcionou / observacao",
};

const productFeedbackLabelMap: Record<ProductFeedback["classification"], string> = {
  bug: "Bug",
  melhoria: "Melhoria",
  fora_do_escopo_atual: "Fora do escopo atual",
};

const productFeedbackCriticalityLabelMap: Record<
  ProductFeedback["criticality"],
  string
> = {
  alta: "Alta",
  media: "Media",
  baixa: "Baixa",
};

export const evaluationCriterionLabelMap: Record<EvaluationCriterion, string> = {
  aderencia_perfil_politico: "Aderencia ao perfil politico",
  adequacao_cargo_cidade_base: "Cargo, cidade e base",
  respeito_redlines: "Respeito as redLines",
  aderencia_objetivo_cta: "Objetivo e CTA",
  uso_keyfacts: "Uso de keyFacts",
  adequacao_formato_intensidade: "Formato e intensidade",
  clareza_utilidade_politica: "Clareza e utilidade politica",
  overall: "Nota final",
};

export const evaluationModeLabelMap: Record<EvaluationReport["run"]["mode"], string> = {
  judge: "Juiz",
  shadow: "Shadow",
  manual: "Manual",
};

const evaluationStatusLabelMap: Record<EvaluationReport["run"]["status"], string> = {
  pending: "Em andamento",
  completed: "Concluido",
  failed: "Falhou",
};

const workflowStageStatusLabelMap: Record<WorkflowStageStatus, string> = {
  ativo: "Ativo no MVP",
  parcial: "Parcial no MVP",
  planejado: "Planejado",
  aberto: "Visivel para todos",
};

export function formatApiError(payload: ApiErrorPayload) {
  const formErrors = payload.issues?.formErrors?.filter(Boolean) ?? [];
  const fieldErrors = Object.entries(payload.issues?.fieldErrors ?? {}).flatMap(
    ([field, messages]) =>
      (messages ?? []).filter(Boolean).map((message) => {
        const label = fieldLabels[field] ?? field;
        return `${label}: ${message}`;
      }),
  );

  if (fieldErrors.length || formErrors.length) {
    return [...fieldErrors, ...formErrors].join(" | ");
  }

  return payload.message || "Falha na operacao.";
}

export function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">{subtitle}</p>
          <h2>{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}

export function WorkflowStagePill({ status }: { status: WorkflowStageStatus }) {
  return (
    <span className={`status-pill workflow-pill workflow-${status}`}>
      {workflowStageStatusLabelMap[status]}
    </span>
  );
}

export function PhaseSectionIntro({
  stage,
}: {
  stage: WorkflowStageDefinition;
}) {
  return (
    <div className="phase-intro-card">
      <div className="phase-intro-top">
        <div>
          <p className="eyebrow">{stage.subtitle}</p>
          <h2>{stage.title}</h2>
        </div>
        <WorkflowStagePill status={stage.status} />
      </div>

      <p className="phase-intro-copy">{stage.description}</p>

      <div className="phase-io-grid">
        <div className="phase-io-card">
          <strong>Input</strong>
          <p>{stage.inputLabel}</p>
        </div>
        <div className="phase-io-card">
          <strong>Output</strong>
          <p>{stage.outputLabel}</p>
        </div>
      </div>
    </div>
  );
}

export function StatusPill({ status }: { status: ContentStatus }) {
  return <span className={`status-pill status-${status}`}>{status}</span>;
}

export function ProductFeedbackPill({
  classification,
}: {
  classification: ProductFeedback["classification"];
}) {
  return (
    <span className={`analysis-pill analysis-${classification}`}>
      {productFeedbackLabelMap[classification]}
    </span>
  );
}

export function ProductFeedbackCriticalityPill({
  criticality,
}: {
  criticality: ProductFeedback["criticality"];
}) {
  return (
    <span className={`criticality-pill criticality-${criticality}`}>
      Criticidade {productFeedbackCriticalityLabelMap[criticality]}
    </span>
  );
}

export function EvaluationStatusPill({
  status,
}: {
  status: EvaluationReport["run"]["status"];
}) {
  return (
    <span className={`status-pill eval-status-pill eval-${status}`}>
      {evaluationStatusLabelMap[status]}
    </span>
  );
}
