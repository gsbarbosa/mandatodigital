import type { ReactNode } from "react";

export const metadata = {
  title: "Compliance TSE",
};

/*
 * Honest-copy rule (SPEC): pillars only claim what the product does today
 * (fact-check with sources, human approval, event log). Everything else is
 * explicitly marked "Em breve".
 */

function PillarCard({
  title,
  children,
  comingSoon = false,
  icon,
}: {
  title: string;
  children: ReactNode;
  comingSoon?: boolean;
  icon: ReactNode;
}) {
  return (
    <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between hover:border-emerald-500/40 transition-all duration-300 shadow-lg hover:shadow-emerald-950/25 hover:shadow-xl">
      <div>
        <div className="flex items-start justify-between mb-6">
          <div className="bg-emerald-500/10 text-emerald-400 w-10 h-10 rounded-xl flex items-center justify-center border border-emerald-500/20">
            {icon}
          </div>
          {comingSoon ? (
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-full px-2.5 py-1">
              Em breve
            </span>
          ) : null}
        </div>
        <h3 className="text-lg font-bold text-white mb-3">{title}</h3>
        <p className="text-slate-400 text-sm leading-relaxed">{children}</p>
      </div>
    </div>
  );
}

function ChecklistItem({
  title,
  children,
  comingSoon = false,
}: {
  title: string;
  children: ReactNode;
  comingSoon?: boolean;
}) {
  return (
    <div className="group flex items-start gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] hover:border-emerald-500/20 transition-all duration-300">
      <div className="bg-emerald-500/10 text-emerald-400 p-2 rounded-xl shrink-0 mt-0.5 border border-emerald-500/20 group-hover:scale-110 transition-transform duration-300">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div>
        <h4 className="text-white font-semibold text-sm mb-1 group-hover:text-emerald-300 transition-colors">
          {title}
          {comingSoon ? (
            <span className="ml-2 text-[9px] font-bold uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-full px-2 py-0.5 align-middle">
              Em breve
            </span>
          ) : null}
        </h4>
        <p className="text-slate-400 text-sm leading-relaxed">{children}</p>
      </div>
    </div>
  );
}

export default function ComplianceRoute() {
  return (
    <div className="min-h-full relative overflow-hidden pb-24">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[40%] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[10%] left-[20%] w-[35%] h-[35%] bg-cyan-600/5 rounded-full blur-[130px] pointer-events-none" />

      <div className="max-w-5xl mx-auto relative z-10 px-4 sm:px-6 lg:px-8 pt-[51px] md:pt-[77px]">
        <header className="text-center max-w-4xl mx-auto mb-16 space-y-6">
          <div className="inline-block p-1 bg-emerald-500/10 rounded-2xl border border-emerald-500/30 shadow-2xl backdrop-blur-sm mb-8">
            <span className="text-emerald-400 text-xs font-bold uppercase tracking-widest px-4 py-1.5 block">
              Dossiê de Transparência Eleitoral
            </span>
          </div>

          <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Tecnologia a favor da sua <br />
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              Segurança Jurídica
            </span>
          </h1>

          <p className="text-slate-400 text-base md:text-lg font-normal max-w-3xl mx-auto leading-relaxed">
            O Mandato Digital foi construído para blindar a sua campanha. Transformamos as complexas
            regras eleitorais em processos automáticos para que você foque apenas em conquistar
            votos, sem dores de cabeça com a Justiça Eleitoral.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch mb-20">
          <PillarCard
            title="Checagem de fatos antes da produção"
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.965 11.965 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            }
          >
            Todo roteiro aprovado passa pelo Agente Auditor, que confere as afirmações contra a
            notícia de origem e as matérias capturadas pelo monitoramento. Conteúdo com informação
            contestada é bloqueado para sua revisão.
          </PillarCard>

          <PillarCard
            title="Aprovação humana obrigatória"
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            }
          >
            Nenhum vídeo é produzido sem a sua aprovação explícita do roteiro. Edições após a
            aprovação exigem novo termo de responsabilidade — a palavra final é sempre sua.
          </PillarCard>

          <PillarCard
            title="Registro dos eventos de aprovação"
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
          >
            Cada checagem de fatos e aprovação de roteiro fica registrada com data, resultado e
            fontes consultadas, compondo o histórico de conformidade do seu conteúdo.
          </PillarCard>

          <PillarCard
            title="Marca d'água “Conteúdo Sintético” (Res. 23.732 TSE)"
            comingSoon
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            }
          >
            Rotulagem automática de conteúdo gerado por IA em todos os vídeos, em conformidade com a
            Resolução 23.732 do TSE. Recurso em implantação antes do período eleitoral.
          </PillarCard>

          <PillarCard
            title="“Kill Switch” do Silêncio Eleitoral"
            comingSoon
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 11-12.728 0M12 3v9" />
              </svg>
            }
          >
            Bloqueio automático de produções e aprovações nas 72h anteriores à votação, garantindo o
            cumprimento rigoroso da lei na reta final. Recurso em implantação antes do período
            eleitoral.
          </PillarCard>

          <PillarCard
            title="Contas de Campanha, NFs e SPCE"
            comingSoon
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            }
          >
            Contratação vinculada ao CNPJ de campanha, notas fiscais com rubricas oficiais do TSE e
            pagamentos rastreados para a prestação de contas. Estrutura comercial em implantação
            junto ao lançamento dos planos.
          </PillarCard>
        </div>

        <div className="w-full max-w-5xl mx-auto">
          <div className="bg-gradient-to-b from-slate-800/40 to-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-[2.5rem] p-8 md:p-12 shadow-[0_8px_30px_rgb(0,0,0,0.12)] relative overflow-hidden group/card">
            <div className="absolute -top-32 -right-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none group-hover/card:bg-emerald-500/15 transition-colors duration-700" />
            <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-cyan-500/10 rounded-full blur-[90px] pointer-events-none" />

            <div className="relative z-10">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
                <div className="lg:col-span-5 flex flex-col items-center lg:items-start text-center lg:text-left">
                  <div className="inline-flex items-center gap-2 text-emerald-400 text-[11px] font-bold tracking-widest uppercase mb-5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.965 11.965 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    Escudo Corporativo
                  </div>

                  <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-5 tracking-tight leading-tight">
                    Seu Escudo Jurídico: <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                      Dossiê de Transparência
                    </span>
                  </h2>

                  <p className="text-slate-300 text-sm md:text-base leading-relaxed mb-8">
                    Não deixe sua campanha vulnerável a detalhes técnicos. O dossiê consolida, para a
                    sua equipe jurídica e contábil, as provas de conformidade do conteúdo produzido
                    na plataforma.
                  </p>
                </div>

                <div className="lg:col-span-7 flex flex-col gap-3">
                  <ChecklistItem title="Checagem com fontes citadas">
                    Cada verificação registra as matérias consultadas e o veredito — a origem de cada
                    afirmação é sempre rastreável.
                  </ChecklistItem>
                  <ChecklistItem title="Histórico de aprovações">
                    Registro de quem aprovou cada roteiro, quando e com qual resultado de checagem.
                  </ChecklistItem>
                  <ChecklistItem title="Atestado de Apagão (Silêncio Eleitoral)" comingSoon>
                    Garantia documentada do bloqueio do sistema nas 72h antes do pleito.
                  </ChecklistItem>
                  <ChecklistItem title="Contrato Automatizado" comingSoon>
                    Documentação formal de Prestação de Serviços gerada na contratação e enviada por
                    e-mail.
                  </ChecklistItem>
                </div>
              </div>

              <div className="mt-12 pt-6 border-t border-slate-700/50">
                <p className="text-slate-500 text-xs md:text-sm text-center font-medium">
                  * Os itens marcados como “Em breve” entram em operação junto ao lançamento
                  comercial — esta página reflete somente o que o sistema já executa hoje.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
