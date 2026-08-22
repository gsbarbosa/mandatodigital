# Radar de Bairro

Monitoramento do que os moradores publicam em **grupos de bairro do Facebook** —
obra, segurança, serviço público, mobilização local — para virar pauta do mandato.

Mecanismo **isolado** do Sentinela e da Notícias do Dia: coleta, filtro, cache,
cota e botão de atualizar próprios. Mesmo raciocínio já registrado em
`docs/noticias-do-dia.md`: não competir por orçamento nem por rate-limit com o
radar principal.

> **Status:** desligado por default (`RADAR_BAIRRO_ENABLED=false`). Envolve
> conteúdo público de terceiros e **ainda depende de parecer jurídico** (LGPD e
> uso em período eleitoral) antes de ligar em produção. Ver "Pendências".

---

## 1. Por que Facebook, e não Instagram

Decidido com teste real, não por intuição. Testamos os dois com bairros **comuns**
(nome genérico, que é a maioria dos bairros do Brasil), em 3 cidades:

| Bairro (cidade) | Instagram (hashtag) | Facebook (grupo) |
|---|---|---|
| Castelo (BH) | 0/6 relevantes — clube De Molay, castelo em Portugal, bolo de festa | 2 grupos específicos |
| Betânia (BH) | 0/6 — Betania do Panamá, Colômbia, conteúdo bíblico | 1 grupo específico |
| Montese (Fortaleza) | ~3/6 — resto é uma cidade da Itália | 2–3 grupos específicos |
| São José (Arcos) | 0/6 — São José de outros 3 estados + santo católico | nenhum (só grupo da cidade) |
| Cruzeiro (Arcos) | 0/6 — 100% time de futebol / cruzeiro marítimo | nenhum (só grupo da cidade) |

**Causa estrutural:** o Instagram não tem noção de cidade — hashtag é um espaço
único global, então nome comum de bairro colide com time, santo, cidade homônima
em outro estado ou país. A busca de grupo no Facebook combina **bairro + cidade**,
o que desambigua sozinho (buscar "Cruzeiro" em Arcos/MG não trouxe nada de
futebol; a mesma palavra no Instagram trouxe 100% futebol).

Instagram funciona bem só quando o bairro já tem nome distinto (Vila Madalena,
Pinheiros) — fica como complemento possível, não como base.

---

## 2. Arquitetura

```
Perfil (cidade do Sentinela)
        │
        ▼
[curadoria]  população IBGE ──► < 125 mil ──► 1 grupo da CIDADE
        │                       ≥ 125 mil ──► até 5 BAIRROS (OSM → busca → verificação)
        ▼
   registry (Firestore)
        │
        ▼
[coleta]  Apify (grupos) ──► filtro 2 estágios ──► cache ──► tela
```

### Arquivos

| Arquivo | Papel |
|---|---|
| `src/lib/radar-bairro-types.ts` | Tipos e temas |
| `src/lib/radar-bairro-geo.ts` | População IBGE, corte de 125 mil, bairros do OSM, priorização |
| `src/lib/radar-bairro-discovery.ts` | Descoberta do grupo (busca externa) + verificação de qualidade |
| `src/lib/radar-bairro-facebook.ts` | Coleta de posts via Apify |
| `src/lib/radar-bairro-relevance.ts` | Filtro em 2 estágios (heurística + LLM) |
| `src/lib/radar-bairro.ts` | Orquestrador (`bootstrapRegistry`, `collectRadarBairro`) |
| `src/lib/radar-bairro-storage.ts` | Firestore: registry + cache |
| `src/lib/radar-bairro-suggestion.ts` | Ponte para o card e o botão "Pautar" |

### Rotas

| Rota | O que faz | Custo |
|---|---|---|
| `GET /api/radar-bairro` | Lê cache + registry. Nunca dispara coleta | zero |
| `POST /api/radar-bairro/curadoria` | Busca automática da cidade (decide cidade × bairro) | alto, ocasional |
| `POST /api/radar-bairro/localidades` | Adiciona bairro escolhido (cota do plano) | alto, ocasional |
| `DELETE /api/radar-bairro/localidades` | Remove bairro | zero |
| `POST /api/radar-bairro/refresh` | Coleta os posts | 1 crédito mensal |

---

## 3. Decisão cidade × bairro (o usuário nunca digita bairro)

Corte: **125.000 habitantes** (`RADAR_BAIRRO_POPULATION_THRESHOLD`), via API de
população do IBGE, a partir da cidade **já cadastrada no perfil** — não se pergunta
nada de novo ao candidato.

Por que população e não "capital ou região metropolitana": **Governador Valadares
tem 266.561 habitantes** e não é nem capital nem RM — o critério anterior erraria
justamente esse tipo de caso. Sem população confiável, cai no modo cidade (mais
barato e sem curadoria de N bairros).

### Como os bairros candidatos são escolhidos (cidade grande)

Nenhuma fonte isolada é confiável, então combinam-se, nesta ordem:

1. **População do bairro no OSM** — sinal mais forte, mas raro (9 de 520 em SP, 0 em BH)
2. **`place=suburb`** — só quando de fato filtra: funciona em BH (289 → 36), não em
   SP (320 de 520 são suburb, não separa nada). A heurística detecta isso sozinha
3. **Nomes conhecidos** informados pelo time (usa `profile.municipalCities`)
4. **Resto da lista**

A ordem só decide **quem é tentado primeiro**. Quem entra de fato é decidido pela
verificação — bairro inexpressivo não tem grupo ativo e cai lá.

---

## 4. Verificação de qualidade do grupo

Dois mínimos, ambos vindos de caso real:

- **Grupo pode existir e estar morto:** "Associação de Moradores do Bairro Vila
  Amélia" tinha nome perfeito e ~30 posts **no ano inteiro**.
- **Grupo pode ser ativo e inútil:** "Grupo Bairro Montese" tinha 30 posts
  recentes, mas só 4 com texto — e os 4 eram classificado puro (cardápio, relógio
  à venda, aluguel). Zero conteúdo cívico.

Por isso a verificação amostra o grupo e exige **post com texto** *e* **parte desse
texto sobrevivendo à peneira de ruído**. Volume sozinho não qualifica.

---

## 5. Filtro de relevância (2 estágios)

**Estágio 1 — peneira barata** (`passesCheapNoiseFilter`): corta texto curto,
classificado, vaga avulsa, religioso genérico e vida pessoal, antes de gastar LLM.

**Estágio 2 — LLM** (`RADAR_BAIRRO_LLM_ENABLED`): decide relevância e classifica em
tema. Reaproveita o pool de LLM do Sentinela — não é integração nova.

Por que 2 e não só palavra-chave: falhou em teste real **duas vezes** —
"buraco"/"esgoto" no X deram 7 de 8 falso-positivo (gíria, xingamento político,
anúncio imobiliário), e "Vila Maria" trouxe escola de samba do carnaval de SP.

### Temas

Infraestrutura e serviço público · Segurança pública · Trânsito e mobilidade ·
Clima e eventos extremos · Saúde e educação pública · Mobilização comunitária ·
Ação institucional.

### Regra contraintuitiva: **não filtramos por engajamento**

O melhor achado de toda a validação — comunicado de fechamento de equipamento
público após temporal derrubar o telhado — tinha **zero curtida e zero comentário**.
Reclamação de serviço público não viraliza como foto bonita. Engajamento no máximo
ordena; nunca corta.

### Com o estágio 2 desligado, a tela fica vazia de propósito

Sem julgamento semântico, o que passa da peneira barata ainda é majoritariamente
ruído. Encher a tela de lixo é pior do que mostrar nada.

---

## 6. Cotas e créditos

| Plano | Bairros escolhidos pelo candidato |
|---|---|
| Trial | 0 (só enxerga o que a busca automática achar) |
| Essencial | 10 |
| Avançado | 20 |
| Elite | 30 |

Em `ACCOUNT_ENTITLEMENTS.radarBairroLocalities`.

- **Atualização:** 10 créditos **por mês** (`RADAR_BAIRRO_REFRESH_MAX_PER_MONTH`),
  só sob pedido. **Não existe coleta automática em segundo plano** — isso mantém o
  custo por conta previsível (créditos × tamanho do pacote) em vez de crescer com o
  número de bairros cadastrados.
- **Bairro sem grupo não consome cota** — mas conta como tentativa, limitada a 10
  (`RADAR_BAIRRO_FAILED_LOOKUP_MAX`), porque cada tentativa gasta busca real.

---

## 7. Por que um ator pago no Apify

Testamos o caminho genérico (navegador sem login) contra 3 grupos reais em 2
cidades: **100% foram redirecionados para a tela de login**, com a resposta do
Facebook marcada internamente como "crawler mode" — é bloqueio ativo, não
instabilidade. Página de Facebook não redireciona, mas também não entregou
conteúdo.

O ator dedicado (`apify/facebook-groups-scraper`, default trocável por
`RADAR_BAIRRO_FACEBOOK_ACTOR_ID`) usa proxy residencial e funciona **sem nenhuma
credencial de conta pessoal**. O `cookieString` dele é opcional e **não é usado**:
pendurar o produto numa conta real do Facebook seria risco de banimento da conta de
alguém e de termos de uso.

Custo no teste: $2,60/1.000 posts, com 500 posts grátis — a validação saiu de graça.

---

## 7.1 Deduplicação entre fontes

Diferente de plataforma-por-grupo (Facebook), uma futura fonte por busca (ex.: X)
pode trazer o MESMO evento contado por contas diferentes, com texto diferente —
achado real: duas contas de notícia cobrindo o mesmo acidente de ônibus.
Deduplicação por autor+texto (`radar-bairro-facebook.ts`) não pega esse caso.

`radar-bairro-dedup.ts` resolve em 2 estágios, mesmo padrão do filtro de
relevância:

1. **Peneira barata** (`findCandidateDuplicatePairs`): sobreposição de palavras
   (Jaccard), limiar propositalmente baixo (0,15) — só acha CANDIDATO, roda
   depois do filtro de relevância (universo menor, evita gastar em post que
   seria descartado de qualquer jeito).
2. **IA decide** (`confirmSameEvent`): pra cada par candidato, pergunta se é
   de fato o mesmo evento.

**Por que não dá pra confiar só na peneira barata:** calibrado contra dado
real, o par de duplicata verdadeira (mesmo acidente, fontes diferentes) deu
jaccard 0,200; o par mais parecido que existe SEM ser duplicata (2 crimes
diferentes no mesmo bairro, mesmo veículo de notícia — vocabulário
compartilhado é só o estilo do repórter) deu 0,182. Diferença de 0,018 não é
limiar confiável.

**Falha segura:** sem IA disponível, não funde nada. Post duplicado visível é
ruim; post real perdido por fusão errada é pior — não tem estágio depois pra
recuperar.

---

## 8. Limitações conhecidas

- **Grupo que funcionou pode falhar depois.** Num reteste, 2 de 3 grupos que já
  tinham funcionado falharam (um vazio, outro "conteúdo indisponível"). Por isso a
  verificação é refeita a cada curadoria, e a tela mostra o status por localidade.
- **Cidade pequena pode não ter grupo de bairro.** Em Arcos (~38 mil), nenhum dos
  dois bairros testados tinha grupo próprio — só grupo da cidade. É o comportamento
  esperado do modo "cidade".
- **Overpass (OSM) é instável.** Devolve 429/406 com frequência; por isso a lista de
  espelhos e o User-Agent identificável. Falha → lista vazia → cai no modo cidade.
- **Nem todo post útil cita o bairro.** O comunicado da Distrital não citava "Vila
  Maria" — só fazia sentido para quem estava no grupo certo. A localidade vem do
  grupo de origem, não de tag no texto.

---

## 9. Configuração

```bash
RADAR_BAIRRO_ENABLED=false        # liga a feature (default: off)
RADAR_BAIRRO_LLM_ENABLED=false    # estágio 2 do filtro (default: off)
RADAR_BAIRRO_FACEBOOK_ACTOR_ID=   # opcional; default apify/facebook-groups-scraper
```

Reaproveitados (já existentes): `APIFY_TOKEN` (coleta) e `SENTINEL_SERPAPI_KEY`
(descoberta de grupos). Sem a chave de busca, a curadoria não acha grupo novo — o
que já estiver no registry continua funcionando.

---

## 10. Pendências antes de ligar em produção

1. **Jurídico — LGPD.** Os posts são de pessoas que não são clientes do produto.
   Propósito e retenção precisam estar definidos antes de guardar conteúdo de
   terceiro. Ver `docs/legal/`.
2. **Jurídico — período eleitoral.** Confirmar enquadramento nas regras do TSE para
   uso em campanha ativa.
3. **Decisão de arquitetura do Gustavo** (Rota B já é a proposta; falta o aval).
4. Reverificação periódica das localidades ainda é manual (roda junto da curadoria).
