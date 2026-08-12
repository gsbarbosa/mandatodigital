# Prefill do cadastro pela base TSE 2026

Quando o usuário digita o CPF no cadastro, o sistema busca esse CPF na base de
candidaturas do TSE de 2026 e preenche os campos que consegue.

**O preenchimento é silencioso.** CPF fora da base: nada acontece, nenhuma
mensagem, o cadastro segue normalmente. O usuário nunca descobre se o CPF está
ou não na base — isso é requisito de produto e também evita transformar o
formulário em oráculo de "quem é candidato".

## Fonte do dado

Pacote `consulta_cand_2026` do TSE (divulgação de candidaturas, dado público).
O arquivo usado é o consolidado nacional `consulta_cand_2026_BRASIL.csv`, que já
contém os 27 estaduais + BR.

- Formato: latin-1, separador `;`, todos os campos entre aspas
- 15.866 linhas, 50 colunas
- `NR_CPF_CANDIDATO`: 100% preenchido, 11 dígitos, todos com checksum válido
- 15.856 CPFs distintos

O CSV é PII e **não entra no git**: fica em `.local/` (ignorado) e é consumido
só pelo script de seed.

## O que a base cobre

| Campo do cadastro | Coluna TSE | Cobertura (de 15.856 CPFs) |
|---|---|---|
| `fullName` | `NM_CANDIDATO` | 15.855 |
| `party` | `SG_PARTIDO` | 15.854 |
| `uf` | `SG_UF` | 15.844 |
| `role` | `DS_CARGO` | 15.364 |

Os outros seis campos do cadastro ficam manuais:

- `phone`, `address`, `teamEmail`, `teamPhone` — não existem no dataset
- `email` — existe como `DS_EMAIL`, mas o TSE redige: 100% das linhas vêm
  `NÃO DIVULGÁVEL`
- `cpf` — é o que o usuário digitou

### Por que as coberturas não são 100%

- **UF (12 a menos)**: candidatos a presidente e vice têm `SG_UF = "BR"`, que não
  é opção no `<select>` de estado.
- **Cargo (~490 a menos)**: vice-governador, vice-presidente e 1º/2º suplente de
  senador não existem em `CARGOS_2026`.
- **Nome e partido (1 e 2 a menos)**: efeito do desempate de CPFs duplicados
  descrito abaixo.

### CPFs em mais de uma candidatura

10 CPFs aparecem em dois registros — a mesma pessoa concorrendo a dois cargos ou
por dois partidos (ex.: Dep. Estadual/PL e Dep. Federal/SOLIDARIEDADE no RJ).

A regra é preencher **só o que é consenso** entre os registros. Campo que
diverge fica vazio, em vez de chutar qual candidatura é a "certa"
(`mergeCandidatePrefills`).

## Normalização

`src/lib/tse-candidates.ts` (funções puras, cobertas por teste):

- **Nome** — o TSE grava em caixa alta; convertemos para caixa mista com
  partículas em minúscula (`HEITOR DE SOUZA` → `Heitor de Souza`), preservando
  hífen e apóstrofo.
- **Partido** — a sigla precisa bater exatamente com `PARTIDOS_2026`, senão o
  `<select>` renderiza vazio. Um alias: o TSE usa `UNIÃO`, o cadastro usa
  `UNIÃO BRASIL`.
- **Cargo / UF** — o que não existe na lista do cadastro vira string vazia.

Placeholders do TSE (`#NULO`, `#NE`, `NÃO DIVULGÁVEL`) são tratados como ausência.

### Listas canônicas

`src/lib/eleicao-2026.ts` concentra `UF_LIST`, `PARTIDOS_2026` e `CARGOS_2026`.
Ficam fora do componente porque o seed precisa normalizar para exatamente esses
valores.

Na conferência contra o TSE 2026, `PARTIDOS_2026` estava defasada e foi
atualizada:

- **Adicionados**: `MISSÃO` (464 candidatos) e `DEMOCRATA` (181) — não existiam
  na lista, então 645 candidatos ficariam sem partido preenchido.
- **Alias**: TSE `UNIÃO` → cadastro `UNIÃO BRASIL`.
- **Mantidos apesar de zero candidatos em 2026**: `PCO`, `PMB`, `PRTB`. Remover
  quebraria o `<select>` de quem já tem esse valor salvo no cadastro — o campo
  renderizaria em branco.

## Fluxo

1. `onBlur` do campo CPF chama `GET /api/user/registration/cpf-check`
   (o mesmo endpoint que já validava CPF duplicado).
2. A rota valida o CPF, checa duplicidade e — só quando o CPF é válido **e**
   está disponível — busca o prefill em `tseCandidates2026`.
3. O front aplica o prefill **só em campo vazio**. O que o usuário já digitou
   nunca é sobrescrito.
4. Valor que não exista nos selects é descartado no cliente também, para o caso
   de a base ter sido semeada com uma lista defasada.

Qualquer falha no caminho do prefill (rate limit, Firestore fora, CPF ausente)
devolve `null` e o cadastro segue. O prefill nunca bloqueia nem altera a
validação de CPF que já existia.

## Rate limit

O endpoint já exigia sessão autenticada, o que barra varredura anônima. Mas ele
transforma "CPF" em "nome + partido + cargo", então a busca no TSE tem teto de
**50 consultas por usuário por dia** (`rate-limit-firestore.ts`). Varrer os
15.856 CPFs levaria ~317 dias.

Estourar o teto **não** quebra o cadastro: só desliga o prefill. A validação de
CPF duplicado continua funcionando normalmente.

## Armazenamento

Collection `tseCandidates2026`, doc id = CPF (11 dígitos), campos
`fullName`, `party`, `uf`, `role`, `seededAt`.

É dado de referência, não do usuário — por isso **fica fora do `db:reset`**
(`scripts/reset-database.mjs` mantém a própria lista de collections a apagar).

As regras do Firestore negam leitura pelo client; só o Admin SDK acessa.

## Rodar o seed

```bash
npm run tse:seed -- --dry-run
```

Faz o parse, mostra o total e a cobertura por campo e não grava nada. Use para
conferir depois de trocar o arquivo do TSE.

```bash
npm run tse:seed
```

Grava em lotes de 500 (limite do batch do Firestore). Idempotente: doc id é o
CPF, rodar de novo sobrescreve.

O arquivo default é `.local/consulta_cand_2026_BRASIL.csv`; use `--file=` para
apontar outro caminho. O script exige `FIREBASE_SERVICE_ACCOUNT_JSON`
(`.env.local`) ou ADC, e aborta com mensagem clara se o layout de colunas do TSE
mudar.

## Possível evolução

A base permite **validar que o CPF é de um candidato registrado em 2026** — um
gate de entrada no cadastro. Não implementado: seria mudança de produto e
contraria o requisito de invisibilidade descrito no topo.
