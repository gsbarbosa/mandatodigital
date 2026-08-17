/**
 * Conteúdo da Política de Privacidade (LGPD, Lei 13.709/2018).
 *
 * Descreve o tratamento que a plataforma realmente faz — as categorias abaixo
 * foram levantadas do código: cofre de provider secrets, base de prospects do
 * outbound (`marketingContacts`), clone de voz (ElevenLabs), avatar (HeyGen),
 * publicação via Instagram Graph e cobrança via Asaas.
 *
 * Mudou o tratamento? Atualize aqui e a data de vigência abaixo.
 */

export const PRIVACY_CONTACT_EMAIL = "privacidade@mandatodigital.ia.br";
export const PRIVACY_EFFECTIVE_DATE = "17 de agosto de 2026";
export const PRIVACY_VERSION = "1.0";

export const privacyController = {
  razaoSocial: "EATEASY SERVIÇOS DIGITAIS LTDA",
  cnpj: "48.142.514/0001-08",
  endereco:
    "Av. Raja Gabaglia, nº 1000, Sala 409, Gutierrez, Belo Horizonte - MG, CEP 30.441-070",
  marca: "Mandato Digital",
} as const;

export const privacyIntro = {
  title: "Política de Privacidade",
  subtitle:
    "Como o Mandato Digital coleta, usa, compartilha e protege dados pessoais, nos termos da Lei Geral de Proteção de Dados (Lei 13.709/2018).",
  body: [
    "Esta política vale para o site institucional, para a plataforma e para as comunicações que enviamos. Ela descreve o tratamento que realmente executamos — cada categoria de dado abaixo corresponde a uma funcionalidade em produção.",
    "Somos controladores dos dados descritos aqui. Quando um gabinete usa a plataforma para tratar dados de terceiros, o gabinete é o controlador desse tratamento e nós atuamos como operadores.",
  ],
} as const;

export type PrivacySection = {
  id: string;
  title: string;
  body?: string[];
  rows?: Array<{ label: string; detail: string; extra?: string }>;
  bullets?: string[];
};

export const privacySections: readonly PrivacySection[] = [
  {
    id: "titulares",
    title: "1. A quem esta política se aplica",
    body: [
      "Tratamos dados de três grupos distintos, com bases legais diferentes:",
    ],
    rows: [
      {
        label: "Clientes e equipes de gabinete",
        detail:
          "Quem contrata e quem usa a plataforma. Inclui dados de cadastro, faturamento e uso do produto.",
      },
      {
        label: "Prospects de relacionamento comercial",
        detail:
          "Dirigentes partidários e parlamentares em exercício, a partir de fontes públicas (registros do TSE e portais oficiais das casas legislativas). Recebem nosso contato comercial e podem se opor a qualquer momento.",
      },
      {
        label: "Terceiros citados em conteúdo público",
        detail:
          "Pessoas mencionadas em notícias e publicações públicas que o monitoramento coleta para gerar pautas. Não montamos perfis individuais nem enriquecemos esses dados.",
      },
    ],
  },
  {
    id: "dados",
    title: "2. Que dados tratamos e por quê",
    rows: [
      {
        label: "Identificação e contato",
        detail:
          "Nome, e-mail, telefone, CPF/CNPJ e endereço. Finalidade: criar a conta, emitir contrato e nota fiscal, e prestar suporte.",
        extra: "Base legal: execução de contrato (art. 7º, V) e obrigação legal (art. 7º, II).",
      },
      {
        label: "Dados de pagamento",
        detail:
          "Processados pela Asaas, nossa operadora financeira. Não armazenamos número de cartão em nossos servidores — recebemos apenas status da cobrança e identificadores da transação.",
        extra: "Base legal: execução de contrato (art. 7º, V).",
      },
      {
        label: "Imagem e voz (dado biométrico)",
        detail:
          "Vídeos e áudios que o cliente envia para treinar avatar e clone de voz usados na geração de conteúdo. São dados pessoais sensíveis.",
        extra:
          "Base legal: consentimento específico e destacado (art. 11, I), coletado no momento do envio e revogável a qualquer tempo.",
      },
      {
        label: "Conteúdo produzido na plataforma",
        detail:
          "Roteiros, legendas, pautas, vídeos gerados e o histórico de aprovação de cada peça. Fica isolado por gabinete.",
        extra: "Base legal: execução de contrato (art. 7º, V).",
      },
      {
        label: "Contas sociais conectadas",
        detail:
          "Ao conectar o Instagram, guardamos o identificador da conta, o nome de usuário e um token de acesso cifrado, usados só para publicar o que o gabinete aprovou. Não lemos mensagens diretas nem a lista de seguidores.",
        extra: "Base legal: execução de contrato (art. 7º, V).",
      },
      {
        label: "Base de prospects",
        detail:
          "Nome, e-mail, telefone, UF, município, partido e cargo de dirigentes partidários e parlamentares, obtidos de fontes públicas oficiais.",
        extra:
          "Base legal: legítimo interesse em prospecção B2B (art. 7º, IX), com direito de oposição garantido — ver seção 6.",
      },
      {
        label: "Registros de acesso e auditoria",
        detail:
          "Logs de ações na plataforma, endereço IP e data/hora. Sustentam a trilha de auditoria e a prestação de contas eleitoral.",
        extra: "Base legal: obrigação legal (art. 7º, II) e exercício regular de direitos (art. 7º, VI).",
      },
    ],
  },
  {
    id: "sensiveis",
    title: "3. Dados sensíveis: imagem, voz e atuação política",
    body: [
      "Imagem e voz usadas para gerar avatar e narração são dados biométricos, classificados como sensíveis pelo art. 5º, II da LGPD. Só os tratamos mediante consentimento específico, dado no envio do material, e exclusivamente para produzir o conteúdo que o próprio titular solicita.",
      "Filiação partidária e atuação política também são dados sensíveis. Tratamos essas informações de clientes e prospects porque são inerentes ao serviço e constam de registros públicos oficiais — nunca as usamos para segmentação de eleitores.",
      "Revogado o consentimento, interrompemos o uso e excluímos o material biométrico, ressalvado o que a lei exigir manter.",
    ],
  },
  {
    id: "compartilhamento",
    title: "4. Com quem compartilhamos",
    body: [
      "Não vendemos dados pessoais. Compartilhamos apenas com operadores necessários ao funcionamento do serviço, cada um limitado à sua finalidade:",
    ],
    rows: [
      {
        label: "Google Cloud / Firebase",
        detail: "Hospedagem, banco de dados, arquivos e autenticação.",
        extra: "Estados Unidos",
      },
      {
        label: "OpenAI e Anthropic",
        detail: "Geração de texto e verificação de fatos.",
        extra: "Estados Unidos",
      },
      {
        label: "HeyGen",
        detail: "Geração de vídeo com avatar a partir da imagem do titular.",
        extra: "Estados Unidos",
      },
      {
        label: "ElevenLabs",
        detail: "Síntese e clonagem de voz.",
        extra: "Estados Unidos",
      },
      {
        label: "Meta (Instagram Graph e WhatsApp Business)",
        detail: "Publicação das peças aprovadas e envio de mensagens.",
        extra: "Estados Unidos",
      },
      {
        label: "Apify e SerpAPI",
        detail: "Coleta de conteúdo público para o monitoramento de pautas.",
        extra: "Estados Unidos",
      },
      {
        label: "Resend",
        detail: "Envio de e-mails transacionais.",
        extra: "Estados Unidos",
      },
      {
        label: "Asaas",
        detail: "Cobrança, boleto e emissão de nota fiscal.",
        extra: "Brasil",
      },
    ],
  },
  {
    id: "internacional",
    title: "5. Transferência internacional",
    body: [
      "Parte dos operadores acima está fora do Brasil, com processamento majoritariamente nos Estados Unidos. Essas transferências ocorrem para execução do contrato com o titular (art. 33, VI) e, quando aplicável, sob cláusulas contratuais de proteção firmadas com cada fornecedor (art. 33, II).",
    ],
  },
  {
    id: "direitos",
    title: "6. Seus direitos",
    body: [
      "O art. 18 da LGPD garante a você, a qualquer momento e sem custo:",
    ],
    bullets: [
      "confirmação de que tratamos seus dados e acesso a eles",
      "correção de dados incompletos, inexatos ou desatualizados",
      "anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade",
      "portabilidade a outro fornecedor, mediante requisição expressa",
      "eliminação dos dados tratados com base no seu consentimento",
      "informação sobre com quem compartilhamos seus dados",
      "revogação do consentimento, inclusive o de imagem e voz",
      "oposição a tratamento fundado em legítimo interesse — é o caso da base de prospects",
    ],
  },
  {
    id: "retencao",
    title: "7. Por quanto tempo guardamos",
    rows: [
      {
        label: "Dados de conta e conteúdo produzido",
        detail: "Enquanto durar o contrato e por 6 meses após o encerramento.",
      },
      {
        label: "Material biométrico (imagem e voz)",
        detail:
          "Até a revogação do consentimento ou o fim do contrato, o que ocorrer primeiro.",
      },
      {
        label: "Documentos fiscais e contratuais",
        detail: "5 anos, por exigência da legislação tributária e civil.",
      },
      {
        label: "Registros de acesso",
        detail: "6 meses, conforme o art. 15 do Marco Civil da Internet.",
      },
      {
        label: "Trilha de auditoria eleitoral",
        detail:
          "Até o encerramento dos prazos de prestação de contas do pleito a que se refere.",
      },
      {
        label: "Base de prospects",
        detail:
          "Até a oposição do titular. Registrada a oposição, mantemos apenas o mínimo necessário para não voltar a contatá-lo.",
      },
    ],
  },
  {
    id: "seguranca",
    title: "8. Segurança",
    bullets: [
      "tráfego cifrado em trânsito (TLS) e credenciais de terceiros cifradas em repouso",
      "isolamento de dados por gabinete, com regras de acesso no banco",
      "acesso administrativo restrito e registrado em trilha de auditoria",
      "segredos de integração mantidos em cofre gerenciado, fora do código",
    ],
    body: [
      "Nenhum sistema é imune a incidentes. Havendo incidente de segurança com risco relevante aos titulares, comunicaremos a Autoridade Nacional de Proteção de Dados e os afetados, nos prazos do art. 48 da LGPD.",
    ],
  },
  {
    id: "cookies",
    title: "9. Cookies",
    body: [
      "Usamos apenas cookies essenciais: o de sessão, que mantém você autenticado, e um cookie temporário de segurança durante a conexão de contas sociais, que expira em minutos.",
      "Não usamos cookies de publicidade, remarketing ou análise comportamental, e não há pixels ou scripts de rastreamento de terceiros no site.",
    ],
  },
  {
    id: "menores",
    title: "10. Crianças e adolescentes",
    body: [
      "A plataforma é destinada a agentes políticos e suas equipes, maiores de 18 anos. Não coletamos dados de crianças e adolescentes de forma consciente. Identificado um cadastro nessa condição, ele é eliminado.",
    ],
  },
  {
    id: "alteracoes",
    title: "11. Alterações desta política",
    body: [
      "Mudanças relevantes são comunicadas por e-mail aos clientes ativos e passam a valer na data de vigência indicada no topo. O histórico de versões fica disponível mediante solicitação.",
    ],
  },
] as const;
