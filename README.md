# Mandato Digital

MVP interno para colocar em operacao o fluxo central do Mandato Digital:

- onboarding persistido do parlamentar;
- entrada manual de pauta;
- geracao de 3 versoes por pauta;
- revisao humana e aprovacao;
- historico reutilizavel;
- feedback editorial para calibracao futura.

## Stack atual

- `Next.js` com App Router
- `TypeScript`
- persistencia local em `data/mandato-digital.json`
- adaptador pronto para `Supabase` via `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`
- integracao com `OpenAI` ou `Anthropic` quando as chaves estiverem configuradas

Sem credenciais externas, o app continua funcional usando persistencia local e um gerador fallback baseado no perfil salvo.

## Rodando localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

## Variaveis de ambiente

Copie `.env.example` para `.env.local` e preencha conforme necessario:

```bash
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-3-5-sonnet-latest
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

## Banco no Supabase

Se quiser sair do modo local, rode o schema em `supabase/schema.sql` e configure as variaveis.

## Fluxo do MVP

1. Salvar o onboarding do parlamentar.
2. Registrar uma nova pauta com contexto e fatos confirmados.
3. Gerar 3 versoes.
4. Revisar, aprovar e copiar a melhor.
5. Registrar feedback para orientar a proxima rodada.
