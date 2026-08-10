# Mandato Digital — regras do projeto

## Git workflow (obrigatório)

Fluxo canônico. As restrições abaixo valem pra quem desenvolve feature **e não é o Gustavo** (ex.: Thiago). O Gustavo é dev sênior e owner do código — as proibições da seção abaixo não se aplicam a ele; ver "Regras específicas do Gustavo".

### Papéis

| Quem | Faz |
|---|---|
| Dev (ex.: Thiago) | Cria e mantém só `feat/...`; push da feature; avisa o Gustavo |
| Gustavo (dev sênior / owner) | Pode commitar/pushar direto em `staging` (sem passar por `feat/...`); review e merge de features de terceiros → `staging`; promoção `staging` → `main`; deploy via pipe |

### Passos do dev (Thiago e futuros devs — não o Gustavo)

1. Partir de `staging` atualizada:

```bash
git fetch origin
git checkout staging
git pull origin staging
```

2. Criar branch específica a partir de `staging`:

```bash
git checkout -b feat/<slug-curto-descritivo>
```

Exemplos: `feat/sentinela-filtros-esfera`, `feat/demo-roteiro-arquetipo`.

3. Trabalhar **somente** nessa branch (commits e push só nela).

4. Subir a feature:

```bash
git push -u origin HEAD
```

5. Avisar o Gustavo que a branch está pronta. Ele puxa, revisa, mergeia em `staging` e depois promove `staging` → `main`.

### Proibições absolutas (Thiago e futuros devs — não o Gustavo)

- Nunca commit/push em `main` (nem "master").
- Nunca commit/push direto em `staging`.
- Nunca abrir PR direto para `main`.
- Nunca mergear a própria feature em `staging`/`main` sem o Gustavo.
- Nunca force-push em `staging` ou `main`.
- Se precisar atualizar a feature com o que entrou em `staging`: trazer `staging` **para** a feature (`rebase`/`merge`), nunca o contrário.

### Se a tentação for "já subir pra main/staging" (vale pro Thiago e futuros devs)

Pare. Empurre só a feature e diga: branch pronta em `origin/feat/...` — aguardando merge do Gustavo.

### Regras específicas do Gustavo (owner)

- Pode commitar e pushar diretamente em `staging` (não precisa de `feat/...` pro próprio trabalho) e promover `staging` → `main` sem pedir permissão de novo a cada vez.
- Force-push em `staging`/`main` continua exigindo confirmação explícita a cada vez — é destrutivo mesmo pra ele, não é fluxo padrão.
- Push em `main` dispara deploy real em produção (pipe do App Hosting) — ao fazer isso, deixe claro que é isso que está acontecendo.
