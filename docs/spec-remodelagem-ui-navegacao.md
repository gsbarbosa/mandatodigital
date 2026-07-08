# SPEC — Remodelagem UI/UX e navegação (Mandato Digital.IA)

Data: 2026-07-08 · Autor: proposta consolidada aprovada pelo owner · Status: aprovada para implementação

## O quê

Remodelar todo o frontend do produto seguindo os mockups HTML entregues (`LandingPage.html`,
`Redefinir_Tema.html`, `Avatares_msm_p_os_3.html`, `CriarConteudoIndependente.html`,
`ComplianceTSE.html`, `Infos_P_config_avatares.html` + PDF de instruções), **sem alterar nenhuma
rota de API nem lógica de backend existente**. O backend atual (profile, sentinel, heygen, auditor,
creative-projects, training-assets) é reutilizado como está.

## Quem

Candidato/parlamentar logado (fase de acesso antecipado, eleição out/2026).

## Sucesso

1. Navegação lateral fixa conforme mockup, com todos os fluxos acessíveis.
2. Home = feed de Monitoramento de Pautas com 4 seções e CTA "Pautar" funcionando ponta a ponta
   (feed → criativo → vídeo), usando os contratos de API existentes.
3. `npm run build`, `lint` e `vitest` verdes; fluxos principais verificados no dev server.

## Mapa de navegação final

| Menu | Rota | Conteúdo |
|---|---|---|
| Monitoramento de Pautas (home) | `/monitoramento` | Feed: Federal / Estadual / Municipal / Adversários (âncoras) |
| └ Redefinir temas | `/monitoramento/temas` | Config do radar (substitui a UI atual do Sentinela) |
| Avatares → 3D / Caricato / Gêmeo Digital | `/avatares/[tipo]` | Hub único parametrizado |
| └ (treino) | `/avatares/[tipo]/treinar` | Upload foto/voz + consentimento |
| Meus criativos | `/criativo` | Lista existente (restyle leve) |
| Gerar pauta independente | `/independente` | Criativo em modo independente |
| Compliance TSE | `/compliance` | Página institucional |
| Acesso antecipado → Dados Pessoais | `/acesso-antecipado/dados` | Cadastro travado |
| Acesso antecipado → Planos e Preços | `/acesso-antecipado/planos` | Plano pré-selecionado |
| Acesso antecipado → Informar CNPJ até 16/Ago | `/acesso-antecipado/cnpj` | Contrato de adesão (dot vermelho no menu enquanto não informado) |

Fora do menu (rotas preservadas): `/curador` (= "Personalizar", acessado pelo hub de avatares),
`/auditor` e `/distribuidor` (mocks, sem entrada de menu), `/admin/evals/*` (role/URL direta),
`/sentinela` → redirect `/monitoramento`. Redirect pós-login (`/`) passa de `/curador` para
`/monitoramento`.

## Mapeamentos backend↔UI (restrição: backend intocado)

O backend não tem conceito de "esfera" nem de planos/reserva. Mapeamentos adotados:

1. **Esferas do feed (classificação no cliente).** Cada `MockSentinelSuggestion` é classificada:
   - **Adversários**: `evidence.actors[].sourceList === "opposition"`.
   - **Municipal**: actor `sourceList === "interest"` OU artigo cujo domínio bate com
     `interestSites` do perfil.
   - **Federal**: artigo cujo domínio pertence à lista fixa de portais nacionais
     (cnn, bandnews, jovempan, g1, estadao — rodapé do mockup).
   - **Estadual**: o restante.
2. **Card de notícia vs. post**: sugestão com `evidence.articles` → card de notícia (título, fonte,
   `publishedAt`); com `evidence.actors` → card de post (handle, link, engajamento
   curtidas + 2×comentários + 3×compartilhamentos). Badge "Notícia verificada" quando há artigos com
   URL; nos posts, badge "Verificar notícia" abre drawer com as evidências já existentes
   (artigos, atores, tendência). *O fact-check por IA continua acontecendo na aprovação do roteiro
   (contrato existente `POST /api/auditor/fact-check`); não existe verificação sob demanda de URL
   arbitrária no backend e ela NÃO será criada nesta fase.*
3. **Pautar** → `/criativo/novo?sugestao=<id>` (contrato existente do Sentinela).
4. **Redefinir temas** persiste nos campos existentes do perfil via `PUT /api/profile`:
   - Federal + Estadual (catálogos do mockup) → `sentinelThemes` (lista única; tema presente nos
     dois catálogos vale nos dois). Limite de 10 seleções por seção, contador visível.
   - Temas personalizados (máx 3, feature existente) → `customRadarThemes`.
   - Municipal: perfis → `interestProfiles` (máx 10), portais → `interestSites` (máx 10).
   - Adversários: perfis → `oppositionProfiles` (máx 10). `oppositionThemes`/`oppositionSites`
     deixam de ser editáveis na UI (dados preservados no banco).
   - UF: `profile.state` — chip read-only quando preenchida; select habilitado quando vazia.
   - Barra sticky "Salvar radar" → `saveProfile` (fluxo existente).
5. **Avatares (3 tipos)** ↔ tracks existentes: Gêmeo Digital → `realistic`/`digital_twin`;
   Caricato → `caricature`/`caricature_editorial`; 3D → `caricature`/`caricature_mascot_3d`.
   Imagem do hub via training-assets (`preview-url`). Treino reutiliza `uploadTrainingAssets`
   (foto = `avatar_image` com crop modal; voz = `voice_audio`; Gêmeo exibe também upload de vídeo
   `dataset`, exigido pelo treino real do twin).
6. **Independente** = `CriativoPageV2` em `mode="independente"`: sem banner Sentinela/tema/roteiro,
   texto do usuário vira transcript (semântica free-prompt existente → fact-check `skipped` no
   backend), checkbox TSE obrigatório, arquétipo/tom (máx 1 cada), seletor de produção existente.
7. **Acesso antecipado**: não há backend. Persistência **local (localStorage)** com escopo honesto
   declarado na UI. Dados do perfil (nome, cargo, UF, cidade) são lidos do backend; CPF, partido,
   telefone e plano são locais até existir backend de billing. Dot vermelho do menu apaga quando o
   CNPJ é salvo localmente.

## Decisões de produto incorporadas (aprovadas em sessão)

Pautar→criativo com avatar default = último usado; Curador vira "Personalizar" (fora do menu);
Auditor embutido em badges/drawer; "Meus criativos" entra no menu; limite 10 temas/esfera;
Municipal classifica tema automaticamente; Adversários só perfis sociais (sem portais);
UF travada do cadastro; gating por plano com cadeado (UI); copy do fact-check fiel ao Auditor real;
"Copiar legenda" vive no resultado (link da legenda + copiar); página Compliance afirma somente o
que existe (fact-check, aprovação humana, trilha de eventos) e marca como "em breve" marca d'água,
kill switch 72h, dossiê PDF e NF/SPCE.

## Escopo honesto (o que esta fase NÃO faz)

- Não cria endpoints novos, não altera schemas, não mexe em flags de backend.
- Não implementa verificação de URL sob demanda, kill switch, marca d'água, dossiê, billing.
- Dados do acesso antecipado ficam no navegador (declarado na própria UI).
- Telas legadas não listadas (curador/personalizar, auditor, distribuidor, admin) mantêm o visual
  atual dentro do novo shell; reskin delas é fase futura.
- Tailwind v4 entra **utilities-only** (sem preflight) para não afetar o CSS existente.

## Fases de implementação

1. Infra de estilo (Tailwind v4 utilities) + shell/sidebar novo.
2. Home Monitoramento + classificador de esferas + drawer de evidências.
3. Redefinir temas.
4. Hub de avatares + tela de treino.
5. Independente + reforma do Novo criativo.
6. Compliance TSE + Acesso antecipado.
7. Verificação (build, lint, testes, fluxo no dev server).

## Risco & rollback

Mudança é 100% frontend e aditiva em rotas; rollback = revert dos commits de UI (backend intocado).
Maior risco: regressão visual nas telas legadas por CSS global — mitigado pelo Tailwind sem
preflight e por classes novas com prefixo próprio (`md-*`) quando fora de utilities.
