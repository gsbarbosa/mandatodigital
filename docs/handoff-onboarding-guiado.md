# Handoff — branch `feature/onboarding-guiado`

Data: 2026-07-19
Branch base: `main` (divergiu em `2be7c20`)

Este relatório separa o que já está **commitado** nesta branch (feito por Gustavo Barbosa,
antes desta sessão) do que está **em andamento**, ainda não commitado (feito nesta sessão).

---

## 1. Já commitado (9 commits, pronto para revisão/merge)

Autor: Gustavo Barbosa. Commits do mais antigo ao mais recente:

### Selo TSE / marca d'água em vídeo
- `resolve audio`, `ajuste marca dagua video`, `seal`, `video fix`,
  `fix(criativo): separa selagem do loading e evita hang no FFmpeg`,
  `fix(criativo): timeout no selo FFmpeg e esconde HTML 504`
- **O que muda pro negócio:** o vídeo final gerado passa a receber a marca d'água/selo
  obrigatório do TSE de forma mais confiável — o processo de selagem (FFmpeg) foi separado
  do carregamento da tela, evitando que a geração trave ("hang") ou mostre uma tela de erro
  HTML crua (504) para o usuário quando o selo demora. Também foram adicionados os assets
  reais do selo (`assets/seals/`) e a fonte usada na marca d'água (`assets/fonts/`).

### Clonagem de voz na HeyGen
- `fix(heygen): amarra clone de voz ao asset de audio novo`
- `feat(heygen): apaga clones orfaos via DELETE para liberar cota`
- **O que muda pro negócio:** cada clone de voz passa a ficar amarrado ao arquivo de áudio
  que o originou (evita usar uma voz desatualizada se o candidato reenvia um áudio novo).
  Além disso, clones "órfãos" (não usados por nenhum avatar) são apagados automaticamente
  na HeyGen para **liberar cota de clones da conta** — evita bater no limite e travar a
  criação de novos avatares.

### TTS via ElevenLabs (voz do criativo)
- `feat(criativo): voz ElevenLabs TTS via audio_url na HeyGen`
- **O que muda pro negócio:** foi adicionado um caminho alternativo de geração de voz —
  em vez de sempre clonar a voz do candidato na própria HeyGen (limite baixo, ~10 clones),
  o áudio pode ser gerado via **ElevenLabs (texto-para-fala)** e entregue à HeyGen como um
  arquivo de áudio pronto (`audio_url`). Isso aumenta a escala de quantos candidatos podem
  ter voz clonada simultaneamente, sem esbarrar no limite da HeyGen.

> Estes 9 commits não tocam nos arquivos do Radar Sentinela nem no onboarding — são uma
> frente de trabalho separada (geração/selagem de vídeo e voz), mas trafegam na mesma branch.

---

## 2. Em andamento (working tree — ainda não commitado)

Tudo abaixo está no working tree local, sem commit. Precisa ser revisado, testado e
commitado antes de seguir.

### 2.1 Onboarding guiado (feature nova, arquivos novos)
- `src/lib/onboarding.ts` + `src/lib/onboarding.test.ts`
- `src/components/product/onboarding-provider.tsx`
- `src/components/product/onboarding-modals.tsx`
- `src/components/product/onboarding-tracker.tsx`
- Integração em `src/app/(product)/layout.tsx`, `src/components/product/shell.tsx`,
  `src/components/product/nav-sidebar.tsx`

Jornada guiada de 4 etapas para novos usuários: **Selecionar Temas → Treinar Avatar →
Ver notícias dos temas → Pautar e Gerar Vídeo**.
- Modal de boas-vindas (3 telas) na primeira visita, explicando o produto e as garantias
  de compliance eleitoral (fact-check por IA, aprovação humana obrigatória, trilha de
  auditoria, marca d'água em vídeo).
- Item do menu lateral correspondente à etapa atual pisca com um destaque (ponto ciano).
- Modais-ponte aparecem em momentos de espera (radar recém-ativado, avatar em
  treinamento, vídeo sendo gerado) — orientam o próximo passo e reforçam confiança.
- O progresso é **derivado do estado real do sistema** (temas salvos, foto/áudio
  enviados, conteúdo gerado) combinado com marcadores locais — contas antigas não veem
  a jornada do zero.
- **Testado:** `onboarding.test.ts` cobre a lógica pura (sem React) de cálculo de etapas.
- **Pendente:** validar visualmente no navegador (não foi testado na UI ainda nesta
  sessão) e revisar copy das telas de boas-vindas/pontes.

### 2.2 Radar Sentinela — mais fontes de notícia
- `src/lib/sentinel-rss.ts` + `src/lib/sentinel-rss.test.ts`
- Descoberta automática de feed RSS lendo `<link rel="alternate">` da home do portal
  (sem precisar cadastrar manualmente cada veículo novo).
- Suporte a **Google News Sitemap** (`news:news`) para portais sem RSS/Atom tradicional
  (ex.: O Tempo/MG), incluindo descoberta via `robots.txt`.
- Lista separada de portais de **circulação regional/restrita** vs. **alcance nacional**,
  para evitar que um jornal estadual apareça em buscas nacionais.
- **Pendente:** rodar a suíte de testes e validar em produção que os novos portais
  regionais estão sendo capturados corretamente nas buscas estaduais/municipais.

### 2.3 Cards de sinais sociais (monitoramento)
- `src/components/product/monitor-signal-card.tsx`
- Ícones coloridos por rede social (Instagram, TikTok, X) nos cards de sinal.
- Handle (`@usuario`) do perfil monitorado em destaque no lugar do texto genérico
  "Post da oposição".

### 2.4 Texto "Selecionar temas" (consistência)
- `src/app/(product)/monitoramento/temas/page.tsx`, `monitoramento-page.tsx`,
  `nav-sidebar.tsx`
- Padronização do rótulo "Redefinir temas" / "Ajustar pautas" → **"Selecionar temas"**
  em toda a UI (título da página, link e menu lateral).

### 2.5 Reaproveitamento de clone de voz ElevenLabs
- `src/lib/voice-provider-resolve.ts` + teste
- `src/lib/elevenlabs.ts` (novo `elevenLabsListVoices`)
- Antes de clonar uma voz nova na ElevenLabs, o sistema agora **lista as vozes existentes
  na conta e reutiliza um clone já feito com o mesmo nome** (mesmo avatar + mesmo áudio),
  evitando gastar clones/quota à toa.

### 2.6 Avatar (treino de foto/voz) — copy e UX
- `src/components/product/avatar-treinar-page.tsx`, `avatar-image-crop-modal.tsx`
- Checklist de requisitos de foto e áudio simplificada (✓/✕ no lugar de emojis),
  aviso de que qualidade da foto/áudio impacta o realismo do avatar.
- Seção de voz renomeada de "Clonagem de Voz" para **"A Voz Perfeita"**, com requisitos
  claros antes de exigir a gravação do roteiro padrão (só pede o roteiro se o áudio do
  usuário não atender aos requisitos).
- Correção de texto no modal de recorte de foto (removida referência a fornecedor
  específico — texto ficou agnóstico).

### 2.7 Fidelidade de cor dos olhos na caricatura/avatar gerado por IA
- `src/lib/openai-caricature-prompts.ts`
- Prompts de geração (2D editorial e mascote 3D) agora **exigem que a cor dos olhos do
  avatar gerado combine com a foto de referência** do candidato.

### 2.8 Infra de desenvolvimento
- `.claude/launch.json`: novo servidor de preview (`claude-preview`, porta 3100) —
  não afeta produção.
- `package-lock.json`: alteração trivial de metadado de uma dependência (`fsevents`).
- `tsconfig.tsbuildinfo`: artefato de build (cache incremental do TypeScript) —
  atualizado automaticamente, não é conteúdo de negócio.

---

## 3. Pontos de atenção para o próximo dev

1. **`.env.example` foi apagado** no working tree. Esse arquivo documentava todas as
   variáveis de ambiente do projeto (Firebase, Supabase, HeyGen, ElevenLabs, Sentinela,
   Argil, Resend). Confirmar se a remoção foi intencional antes de commitar — se não
   houver um substituto, algum novo dev vai sentir falta dessa referência.
2. Nenhum dos itens da seção 2 foi commitado ainda — estão todos no working tree.
   Recomendo revisar e quebrar em commits temáticos (onboarding / sentinela / voz /
   avatar-copy / caricatura) em vez de um commit único.
3. `onboarding.ts`/`onboarding.test.ts` têm teste automatizado; os demais itens da seção 2
   (sentinel-rss, voice-provider-resolve) já têm testes atualizados no diff — rodar
   `npm test` antes de commitar.
4. A jornada de onboarding ainda não foi validada visualmente no navegador nesta sessão —
   vale um teste manual do fluxo completo (boas-vindas → temas → avatar → notícias → gerar
   vídeo) antes de considerar pronta.
