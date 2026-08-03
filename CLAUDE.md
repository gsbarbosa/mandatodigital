# Mandato Digital — regras do projeto

## Git workflow (obrigatório)

Fluxo canônico. Quem desenvolve feature **não** mexe em `staging` nem em `main`.

### Papéis

| Quem | Faz |
|---|---|
| Dev (ex.: Thiago) | Cria e mantém só `feat/...`; push da feature; avisa o Gustavo |
| Gustavo | Review, merge feature → `staging`, promoção `staging` → `main`, deploy via pipe |

### Passos do dev

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

### Proibições absolutas

- Nunca commit/push em `main` (nem "master").
- Nunca commit/push direto em `staging`.
- Nunca abrir PR direto para `main`.
- Nunca mergear a própria feature em `staging`/`main` sem o Gustavo.
- Nunca force-push em `staging` ou `main`.
- Se precisar atualizar a feature com o que entrou em `staging`: trazer `staging` **para** a feature (`rebase`/`merge`), nunca o contrário.

### Se a tentação for "já subir pra main/staging"

Pare. Empurre só a feature e diga: branch pronta em `origin/feat/...` — aguardando merge do Gustavo.
