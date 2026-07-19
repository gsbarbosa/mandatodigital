import {
  CONTRACT_TEMPLATE_VERSION,
  DOSSIER_TEMPLATE_VERSION,
  EATEASY,
  formatBrlFromCents,
  PLAN_LABELS,
  PLAN_PRICES_CENTS,
} from "@/lib/legal/constants";
import { formatAcceptedAt, sha256Hex } from "@/lib/legal/request-meta";
import type { EarlyAccessPlanId } from "@/lib/early-access-types";

export type ContractFillInput = {
  acceptanceId: string;
  campaignName: string;
  campaignCnpj: string;
  campaignAddress: string;
  financialResponsible: string;
  planId: EarlyAccessPlanId;
  paymentMethodLabel?: string;
  ip: string;
  userAgent: string;
  acceptedAt?: Date;
};

export type RenderedLegalDocument = {
  version: string;
  title: string;
  text: string;
  hash: string;
  acceptedAtLabel: string;
};

function buildContractBody(input: ContractFillInput & { acceptedAtLabel: string }) {
  const planName = PLAN_LABELS[input.planId];
  const amount = formatBrlFromCents(PLAN_PRICES_CENTS[input.planId]);
  const payment = input.paymentMethodLabel ?? "a definir na liquidação";

  return `INSTRUMENTO PARTICULAR DE LICENCIAMENTO DE SOFTWARE (SaaS) PARA FINS ELEITORAIS

Pelo presente instrumento particular, as partes abaixo qualificadas celebram este Contrato de Licenciamento de Software e Prestação de Serviços, que se regerá pelas cláusulas e condições a seguir, bem como pela legislação eleitoral vigente (em especial as Resoluções TSE nº 23.607/2019 e 23.732/2024).

QUADRO RESUMO E QUALIFICAÇÃO DAS PARTES

1. CONTRATADA (EATEASY):
Razão Social: ${EATEASY.razaoSocial}
CNPJ: ${EATEASY.cnpj} | NIRE: ${EATEASY.nire}
Sede: ${EATEASY.sede}
Representante Legal: ${EATEASY.representante}.

2. CONTRATANTE (CAMPANHA ELEITORAL):
Nome da Campanha/Candidato: ${input.campaignName}
CNPJ Eleitoral: ${input.campaignCnpj}
Endereço: ${input.campaignAddress}
Responsável Financeiro/Administrador: ${input.financialResponsible}

CLÁUSULA PRIMEIRA – DO OBJETO
1.1. O presente contrato tem por objeto o licenciamento temporário, não exclusivo e intransferível de direito de uso da plataforma de software denominada Mandato Digital (modelo SaaS - Software as a Service).
1.2. A plataforma destina-se ao provimento de conteúdo digital sob demanda, inteligência de dados, monitoramento de informações na internet e apoio à comunicação da campanha eleitoral do CONTRATANTE, utilizando agentes de Inteligência Artificial.
1.3. Os serviços prestados enquadram-se nas atividades de licenciamento de programas de computador não-customizáveis e provedores de serviços de informação na internet (CNAEs 62.03-1-00, 63.19-4-00 e 63.11-9-00).

CLÁUSULA SEGUNDA – DAS OBRIGAÇÕES DA CONTRATADA
2.1. Disponibilizar o acesso à plataforma 24 horas por dia, 7 dias por semana, ressalvadas eventuais janelas de manutenção técnica.
2.2. Garantir o funcionamento dos algoritmos (Agentes Sentinela, Curador, Criativo, Auditor e Distribuidor) conforme os parâmetros contratados.
2.3. Aplicar automaticamente em todos os materiais audiovisuais gerados pela plataforma as marcas d'água exigidas pela Justiça Eleitoral informando tratar-se de "Conteúdo Sintético".
2.4. Fornecer, de forma automatizada, as Notas Fiscais correspondentes aos pagamentos efetuados, emitidas estritamente contra o CNPJ Eleitoral do CONTRATANTE.

CLÁUSULA TERCEIRA – DAS OBRIGAÇÕES DO CONTRATANTE
3.1. Efetuar o pagamento do valor acordado, utilizando exclusiva e obrigatoriamente recursos oriundos da conta bancária oficial da campanha eleitoral vinculada ao CNPJ qualificado neste instrumento (Res. TSE 23.607/2019).
3.2. Assegurar que os conteúdos finais publicados em suas redes sociais contenham os avisos de transparência exigidos pelo TSE, assumindo responsabilidade legal integral caso opte por exportar materiais da plataforma para publicação manual e remova as rotulações textuais obrigatórias.
3.3. Não utilizar a plataforma para disseminar desinformação, fake news ou ataques ilícitos contra adversários políticos e o sistema eleitoral.

CLÁUSULA QUARTA – DA RESPONSABILIDADE EDITORIAL E LIMITAÇÕES DA IA
4.1. O CONTRATANTE reconhece que a plataforma Mandato Digital opera por meio de modelos generativos de Inteligência Artificial, os quais, dada a sua natureza probabilística, podem apresentar imprecisões ocasionais. Fica expressamente estabelecido que a aprovação final de qualquer roteiro, legenda, vídeo ou material gráfico gerado pelo sistema é de responsabilidade exclusiva e indelegável do CONTRATANTE.
4.2. O ato de clicar no botão "Aprovar Publicação" ou de exportar o material para uso manual configura a revisão e concordância integral com o teor, veracidade e adequação legal do conteúdo, isentando a CONTRATADA de qualquer responsabilidade civil, criminal ou eleitoral por informações inverídicas, promessas de campanha inexequíveis ou danos morais a terceiros veiculados nas publicações.

CLÁUSULA QUINTA – DA PROPRIEDADE INTELECTUAL E DOS DADOS
5.1. Pertencem única e exclusivamente à CONTRATADA todos os direitos de propriedade intelectual sobre a plataforma Mandato Digital, incluindo, mas não se limitando a, códigos-fonte, algoritmos, fluxos de orquestração de dados, robôs de automação, arquitetura de prompts e painéis de interface.
5.2. Pertencem exclusivamente ao CONTRATANTE os direitos patrimoniais sobre os conteúdos finais gerados (vídeos, imagens e textos) durante a vigência deste contrato, podendo utilizá-los em sua campanha eleitoral de forma perpétua, respeitadas as rotulações do TSE.

CLÁUSULA SEXTA – DA CONFIDENCIALIDADE E TRATAMENTO DE DADOS (LGPD)
6.1. A CONTRATADA compromete-se a manter sob absoluto sigilo todas as informações estratégicas, vídeos de referência e diretrizes inseridas pelo CONTRATANTE para a calibragem dos agentes de Inteligência Artificial, garantindo o isolamento hermético do banco de dados em relação a outros usuários da plataforma.
6.2. Findo o período eleitoral e extinto o CNPJ de campanha, a CONTRATADA providenciará, no prazo legal aplicável, a exclusão ou anonimização definitiva do banco de dados gerado pela campanha, resguardados apenas os logs técnicos e financeiros necessários ao cumprimento de obrigações regulatórias e fiscais exigidas pela Justiça Eleitoral.

CLÁUSULA SÉTIMA – DO PREÇO E CONDIÇÕES DE PAGAMENTO
7.1. Pelo licenciamento do software, o CONTRATANTE pagará à CONTRATADA o valor total de ${amount}, referente ao plano de acesso ${planName}.
7.2. O pagamento será realizado via ${payment}, com liquidação condicionada à comprovação de origem na conta bancária de campanha do CONTRATANTE.
7.3. O acesso à plataforma será liberado imediatamente após a confirmação e conciliação bancária do pagamento.

CLÁUSULA OITAVA – DO COMPLIANCE ELEITORAL E INTELIGÊNCIA ARTIFICIAL (RES. TSE 23.732)
8.1. A CONTRATADA declara, e o CONTRATANTE reconhece, que a plataforma utiliza ferramentas de Inteligência Artificial para otimização de narrativas e edição de mídia.
8.2. Para adequação ao silêncio eleitoral, a CONTRATADA ativará o bloqueio automático de disparos e publicações (Apagão Algorítmico) nas 72 (setenta e duas) horas que antecedem o pleito, impedindo o uso do Agente Distribuidor para fins de propaganda eleitoral.
8.3. As partes atestam o aceite conjunto do "Dossiê de Transparência e Conformidade Eleitoral", gerado no momento desta contratação, que passa a ser parte integrante e inseparável deste instrumento.

CLÁUSULA NONA – DA VIGÊNCIA E RESCISÃO
9.1. Este contrato entra em vigor na data do seu aceite digital e permanecerá válido até o término oficial do período de campanha eleitoral de 2026 ou esgotamento dos créditos do plano contratado.
9.2. O encerramento do CNPJ de campanha do CONTRATANTE rescinde automaticamente este contrato, sem ônus de multas rescisórias para nenhuma das partes.
9.3. O descumprimento de qualquer cláusula de compliance eleitoral (especialmente a Cláusula Terceira) dará à CONTRATADA o direito de suspender imediatamente o acesso à plataforma.
9.4. Em caso de infração eleitoral, civil ou criminal cometida pelo CONTRATANTE no uso da plataforma (como a remoção dolosa das tags de "Conteúdo Sintético" em publicações manuais), que resulte em multas, condenações ou danos à reputação da CONTRATADA, fica assegurado a esta o direito de regresso, devendo o CONTRATANTE arcar com todos os custos de defesa, honorários advocatícios e eventuais indenizações impostas.

CLÁUSULA DÉCIMA – DO ACEITE DIGITAL E TRILHA DE AUDITORIA
10.1. Nos termos da legislação brasileira, as partes reconhecem a validade deste contrato firmado por meio eletrônico (aceite de botão/Clickwrap).
10.2. A validade deste instrumento é garantida pelo log de auditoria técnica da CONTRATADA, que registra o Endereço IP do CONTRATANTE, o carimbo de tempo (Timestamp) e a integridade criptográfica da operação.

CLÁUSULA DÉCIMA PRIMEIRA – DO FORO
11.1. Fica eleito o foro da Comarca de Belo Horizonte, Minas Gerais, para dirimir quaisquer dúvidas oriundas do presente contrato, com exclusão de qualquer outro.

${EATEASY.local}, ${input.acceptedAtLabel}

(Assinatura Eletrônica do Contratante registrada via Aceite no Sistema)
(Assinatura Eletrônica da EatEasy registrada via Sistema)
(Logs Técnicos: IP ${input.ip} | User Agent ${input.userAgent} | Data e Hora do Aceite ${input.acceptedAtLabel})
(Hash SHA-256 do texto: ver carimbo no PDF)
(Referência do aceite: ${input.acceptanceId})
(Versão do template: ${CONTRACT_TEMPLATE_VERSION})`;
}

function buildDossierBody(input: ContractFillInput & { acceptedAtLabel: string; contractHash: string }) {
  return `DOSSIÊ DE TRANSPARÊNCIA E CONFORMIDADE ELEITORAL

Emitente: ${EATEASY.razaoSocial}
CNPJ: ${EATEASY.cnpj}
NIRE: ${EATEASY.nire}
Produto: Plataforma Mandato Digital
Base Legal: Resolução TSE nº 23.607/2019 e Resolução TSE nº 23.732/2024

1. OBJETIVO DO DOCUMENTO
O presente dossiê certifica os parâmetros técnicos, jurídicos e operacionais adotados pela plataforma Mandato Digital para a prestação de serviços de inteligência artificial aplicados à comunicação política. Este documento atesta perante a Justiça Eleitoral e demais órgãos de controle que a tecnologia licenciada opera em estrita obediência às diretrizes de transparência, integridade da informação e proteção do processo eleitoral.

2. CERTIFICADO DE CONFORMIDADE ALGORÍTMICA (Res. TSE 23.732)
Declaramos que o ecossistema de Inteligência Artificial da plataforma, composto por seus agentes autônomos, possui travas de segurança (guardrails) intransponíveis pelo usuário, garantindo:
• Rotulação Visual Obrigatória (Marca d'Água): Todos os vídeos gerados com Avatar Caricato, Mascote 3D ou Gêmeo Digital, recebem, via renderização em servidor (hardcoded), a inserção de uma marca d'água semitransparente com os dizeres padronizados sobre "Conteúdo Sintético", em alto contraste e posicionamento contínuo durante toda a exibição da peça.
• Rotulação Textual (Legendas): Em publicações automatizadas multicanal, o sistema injeta via código a tag informativa de conformidade eleitoral no corpo do texto, sem possibilidade de exclusão prévia pelo usuário.
• Prevenção à Desinformação: O sistema adota mecanismos para reduzir o risco de geração de deepfakes, ataques reputacionais e disseminação de informações sabidamente falsas. Para isso, prioriza a consulta a múltiplas fontes jornalísticas reconhecidas e, quando aplicável, utiliza Inteligência Artificial e integrações com serviços de checagem de fatos para auxiliar na validação das informações antes da geração e disponibilização de conteúdos.

3. ATESTADO DE APAGÃO ALGORÍTMICO (Silêncio Eleitoral)
A fim de proteger o pleito e o candidato de eventuais sanções por propaganda irregular, a plataforma conta com uma contingência automática e programada de segurança. A função de disparo coordenado a partir da plataforma Mandato Digital possui um Kill Switch (Trava de Silêncio Eleitoral).
• O sistema cessa e bloqueia ativamente qualquer impulsionamento ou disparo coordenado através da plataforma nas 72 horas exatas que antecedem o início da votação.
• Nesse período, o sistema restringe-se exclusivamente ao monitoramento de pautas através do Agente Sentinela, impedindo violações das normas de silêncio eleitoral.

4. TRILHA DE AUDITORIA E TRANSFERÊNCIA DE RESPONSABILIDADE
Para garantir o princípio da prestação de contas, a plataforma atua com rastreabilidade total (Auditoria Cruzada):
• Downloads e Exportações Manuais: Caso o usuário opte por exportar a mídia para publicação manual, a plataforma registra o aceite expresso de responsabilidade do cliente quanto à manutenção do rótulo de Inteligência Artificial.
• Registro de Atividades: O sistema arquiva metadados rigorosos contendo o User_ID, Endereço IP, Timestamp (Data, Hora e Fuso), e registro de ações (Aprovação de Conteúdo, Disparo e Exportação). Esses logs atestam a origem do comando e eximem a ferramenta de falhas na ponta humana.

5. PRIVACIDADE E ISOLAMENTO DE DADOS (LGPD)
O Mandato Digital não armazena dados sensíveis ou pessoais de eleitores, garantindo anonimização e aderência à Lei Geral de Proteção de Dados (LGPD). A arquitetura da plataforma assegura o isolamento hermético das bases de dados de cada contratante, impedindo o cruzamento de prompts e estratégias entre gabinetes ou campanhas adversárias.

6. COMPROVAÇÃO DE MATERIALIDADE E ORIGEM DE RECURSOS
Com o objetivo de apoiar a transparência e fornecer subsídios técnicos para a instrução processual na aplicação de recursos públicos ou privados, a plataforma disponibiliza os seguintes parâmetros para auxiliar a prestação de contas do contratante:
• Origem dos Recursos e Adequação de Finalidade: A arquitetura da plataforma é concebida para que sua contratação possa ser devidamente detalhada e justificada pelo cliente. Cabe exclusivamente ao contratante assegurar que a utilização do sistema respeite a natureza e as restrições de sua fonte pagadora.
• Comprovação de Materialidade: Para consubstanciar a efetiva entrega dos serviços e auxiliar o cliente em sua comprovação contábil, a plataforma fornece, sob demanda, relatórios volumétricos de geração de conteúdo, métricas de operação dos agentes autônomos e dashboards de acesso.
• Princípio da Economicidade: Declara-se que os valores cobrados pelo licenciamento do software refletem os padrões e práticas de precificação do mercado de tecnologia SaaS.
• Abrangência do Controle Institucional: Os relatórios de materialidade digital e metadados gerados pelo sistema são estruturados com o propósito de facilitar e instrumentalizar as prestações de contas do usuário junto ao SPCE e à Justiça Eleitoral.

DECLARAÇÃO FINAL
A ${EATEASY.razaoSocial} atesta a veracidade das informações técnicas acima descritas. O sistema se compromete a fornecer os relatórios de uso e a materialidade digital do serviço para a adequada instrução do Sistema de Prestação de Contas Eleitorais (SPCE).

Data de emissão: ${input.acceptedAtLabel}
Contrato de Referência: ${input.acceptanceId}
Campanha Contratante: ${input.campaignName} — ${input.campaignCnpj}
Hash do Contrato (SHA-256): ${input.contractHash}
Versão do template: ${DOSSIER_TEMPLATE_VERSION}

Assinado digitalmente por:
${EATEASY.representante}
Sócio-Administrador / Representante Legal ${EATEASY.razaoSocial}

(Carimbo de Autenticidade Digital: IP ${input.ip} | UA ${input.userAgent} | Timestamp ${input.acceptedAtLabel})`;
}

export function renderContractDocument(input: ContractFillInput): RenderedLegalDocument {
  const acceptedAt = input.acceptedAt ?? new Date();
  const acceptedAtLabel = formatAcceptedAt(acceptedAt);
  const text = buildContractBody({ ...input, acceptedAtLabel });
  return {
    version: CONTRACT_TEMPLATE_VERSION,
    title: "Contrato de Licenciamento SaaS — Mandato Digital",
    text,
    hash: sha256Hex(text),
    acceptedAtLabel,
  };
}

export function renderDossierDocument(
  input: ContractFillInput,
  contractHash: string,
): RenderedLegalDocument {
  const acceptedAt = input.acceptedAt ?? new Date();
  const acceptedAtLabel = formatAcceptedAt(acceptedAt);
  const text = buildDossierBody({ ...input, acceptedAtLabel, contractHash });
  return {
    version: DOSSIER_TEMPLATE_VERSION,
    title: "Dossiê de Transparência e Conformidade Eleitoral",
    text,
    hash: sha256Hex(text),
    acceptedAtLabel,
  };
}
