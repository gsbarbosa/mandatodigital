# Runbook — sobreaviso demo (~180 pessoas)

Uso durante apresentação com `DEMO_MODE` ligado. Complementa o monitor a cada 5 min.

## Veredito

App e degustação aguentam **navegação / onboarding / Sentinela limitado**. O gargalo é a **carteira HeyGen (API)** e a **cota ElevenLabs** — compartilhadas por todos.

## Comando único (preflight / durante)

```bash
npm run demo:oncall-check
npm run demo:oncall-check -- --json
npm run demo:oncall-check -- --containment
```

- Exit `0` = GO (pode ter warnings)
- Exit `2` = **NO-GO** (recarregar cotas antes de liberar vídeo em massa)
- Thresholds default: HeyGen ≥ US$ 50 · ElevenLabs ≥ 70k chars · alerta uso ≥ 60%

Override: `DEMO_ONCALL_HEYGEN_MIN_USD`, `DEMO_ONCALL_EL_MIN_CHARS`, `ADMIN_PASSWORD`.

## Limites DEMO (esperado — não é incidente)

| Limite | Valor |
|--------|-------|
| Saves de tema | 3 |
| Vídeos por avatar | 2 |
| Refresh pauta manual | off (só de manhã) |
| Pós-créditos | lock → Planos / CNPJ |

## O que olhar

1. HeyGen `remaining` (API wallet) — &lt; US$ 2 = crítico; queda rápida = pausar vídeos
2. ElevenLabs chars / % — ≥ 60% ou 401
3. HTTP home, `/entrar`, health, marketing — ≥ 400 ou &gt; 5s
4. OpenAI — sem % sem `OPENAI_ADMIN_KEY`; se caricatura falhar, console OpenAI
5. Apify — pouco relevante com refresh manual off

## Reclamações vs incidente

| Usuário | Causa | Ação |
|---------|-------|------|
| Não atualiza pauta | DEMO | Explicar |
| Não salva tema | 3 saves | Esperado |
| Não gera vídeo neste avatar | 2/avatar | Esperado |
| Saldo insuficiente API | HeyGen wallet | Recarregar API credits |
| Voz falhou | EL chars/key | Admin provedores + créditos |
| 5xx / timeout | App Hosting / sync | Health + retry escalonado |
| Login em massa falha | Auth/domínio | Domínios autorizados Firebase |

## Contenção (ordem)

1. App fora → health + logs; retry escalonado (async jobs OFF)
2. Vídeo quebrado, app ok → HeyGen + ElevenLabs **primeiro**
3. Só caricatura/LLM → OpenAI
4. Sentinela vazio → refresh manual off; não gastar Apify
5. **Não** deployar / flipar `DEMO_MODE` no meio do evento

Recargas:

- HeyGen: [app.heygen.com](https://app.heygen.com) → Settings → **API** → Add credits (pay-as-you-go). Créditos do plano web **não** contam.
- ElevenLabs: [elevenlabs.io](https://elevenlabs.io/app/settings) → subscription / credits

## Checklist pré-abertura

- [ ] `npm run demo:oncall-check` → GO (ou GO_WITH_WARNINGS aceitável se vídeo for só do apresentador)
- [ ] Combinar com a sala: quem gera vídeo (todos vs demonstrador)
- [ ] Monitor 5 min ativo nesta sessão
- [ ] Admin: `/admin/provedores`

## Pós-evento

```bash
node scripts/disable-demo-mode-post-event.mjs
# commit + push na branch da pipe — nunca firebase deploy --only apphosting
```

Depois: revisar gasto HeyGen / EL / OpenAI; anotar falhas reais vs limites de degustação.

## Capacidade (referência)

- Roteiro fixo demo ≈ 66 palavras ≈ 26s → ~US$ 1,3 (foto) a ~US$ 1,8 (gêmeo) / vídeo
- Cloud Run: `minInstances: 1`, `maxInstances: 10`, `concurrency: 40`
- `ASYNC_*` / `PUBSUB_JOBS_ENABLED=false` → seal/voz/vídeo sync no mesmo pool
