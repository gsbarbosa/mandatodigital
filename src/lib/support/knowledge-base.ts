/**
 * Base de conhecimento curada para o suporte N1.
 * Conteúdo estático — não ler docs/ em runtime.
 */
export function buildSupportKnowledgeBase(): string {
  return `
# Mandato Digital — guia de suporte

## O que é
Plataforma de comunicação política com agentes de IA para campanhas e gabinetes.
Ajuda o candidato a monitorar pautas, criar conteúdo alinhado à persona, gerar vídeos com avatar e manter conformidade eleitoral (TSE/LGPD).

## Navegação principal (produto autenticado)
- Monitoramento de Pautas (/monitoramento): Nacional, Estadual, Municipal, Adversários.
- Selecionar temas (/monitoramento/temas): define temas de interesse por esfera e adversários.
- Avatares: Gêmeo Digital (/avatares/foto-real), Caricato (/avatares/caricato), Mascote 3D (/avatares/3d).
- Configurar avatar (/avatares/foto-real/treinar): foto e áudio de voz.
- Personalizar (/curador): posicionamento ideológico (persona) e glossário de expressões.
- Meus criativos (/criativo): lista e criação de peças/roteiros/vídeos.
- Gerar pauta independente (/independente): geração avulsa fora do fluxo Sentinela.
- Compliance TSE (/compliance): conformidade eleitoral e materiais.
- Auditoria (/auditoria): trilha de ações e checagens.
- Cadastro / planos: /acesso-antecipado/dados, /acesso-antecipado/planos, /acesso-antecipado/cnpj.

## Agentes do ecossistema
1. Sentinela — identifica pautas quentes do dia (sites, blogs, redes, temas e adversários). Entrega pautas quentes e gatilhos para conteúdo.
2. Curador — transforma pauta em roteiro/ângulo alinhado à persona e tom do político.
3. Criativo / produção — gera peças e vídeos com avatar (gêmeo digital, caricato, mascote).
4. Auditor — fact-check e proteção reputacional; evita conteúdos problemáticos.
5. Compliance — metadados e conformidade com regras do TSE; isolamento LGPD (não armazena dados pessoais de eleitores).

## Fluxos comuns
### Onboarding
1) Selecionar temas (4 esferas) → 2) Treinar avatar (foto + áudio) → 3) Personalizar (persona + glossário) → 4) Monitorar pautas → 5) Criar roteiro → 6) Produzir vídeo.
Há um checklist flutuante de onboarding no canto inferior direito enquanto o progresso não estiver completo.

### Monitoramento (Sentinela)
- Configure temas em /monitoramento/temas.
- Em /monitoramento, atualize/sugestões de pautas por esfera.
- Use “Pautar” para levar uma pauta ao fluxo criativo.

### Avatar
- Gêmeo Digital: treino com foto real + áudio de voz.
- Caricato: geração de caricatura com IA.
- Mascote 3D: avatar estilizado.
- Sem áudio de voz, etapas posteriores do onboarding (pauta/roteiro/vídeo) podem redirecionar de volta ao treino.

### Criativos e vídeo
- Em /criativo o usuário cria ou abre projetos (arquétipo, tom, tema, roteiro, avatar, gerar).
- Vídeos podem passar por jobs assíncronos (geração/selo/voz); o status aparece na própria tela do criativo.

### Compliance e segurança
- Resolução TSE 23.732: conteúdos com IA devem ter metadados/rotulagem adequados.
- Apagão algorítmico de 72h: travas perto do pleito.
- Gastos tipificados como serviço de software/comunicação política; NF atrelada ao CNPJ da campanha quando aplicável.
- LGPD: isolamento por gabinete; não guardar dados pessoais de eleitores.

## Conta e acesso
- Login via Firebase Auth (e-mail).
- Planos guest vs premium podem limitar créditos (ex.: Sentinela, caricaturas).
- Problemas de login, cobrança, CNPJ ou contrato devem ser escalados ao atendimento humano se o usuário não conseguir concluir sozinho.

## O que o N1 NÃO resolve sozinho
- Bugs confirmados / erros de servidor persistentes.
- Pedidos de reembolso, alteração contratual, acesso administrativo.
- Conteúdo político estratégico personalizado além de orientação de uso do app.
- Qualquer pedido de senha, código 2FA ou dados sensíveis de terceiros.
`.trim();
}
