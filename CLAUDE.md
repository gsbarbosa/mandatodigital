# Mandato Digital — CLAUDE.md

Repo: plataforma de comunicação política (Sentinela → Criativo → Validador → vídeo HeyGen).

## Comandos

```bash
npm run dev                    # localhost:3000
npm run build
npm run test:sentinel
npm run test:e2e:nav-v2
npm run deploy:firebase
```

## Documentação viva

| Doc | Uso |
|-----|-----|
| `docs/status-desenvolvimento.md` | Checklist ✅/❌ do produto |
| `.cursor/skills/mandato-digital/SKILL.md` | Playbook do agente dev |
| `AGENTS.md` | Como invocar mandato-digital-dev |
| `apphosting.yaml` | Flags de produção |

## Branch e deploy

- Desenvolvimento: `staging`
- Deploy: Firebase App Hosting, projeto `madatodigital`
- Prod: https://mandatodigital--madatodigital.us-central1.hosted.app

## Commits

Conventional Commits PT-BR (`feat`, `fix`, `refactor`, …). Sem Co-Authored-By de IA. Atomicidade.

## Agente

Para tarefas de produto neste repo, seguir `.cursor/skills/mandato-digital/SKILL.md` e backlog P0.
