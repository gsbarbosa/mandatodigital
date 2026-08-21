import { describe, expect, it } from "vitest";

import { filterRadarBairroPosts, passesCheapNoiseFilter } from "@/lib/radar-bairro-relevance";
import type { RadarBairroPost } from "@/lib/radar-bairro-types";

/**
 * Os textos aqui são recortes de posts REAIS coletados na validação (grupos de
 * bairro em SP e Fortaleza) — é o que dá confiança de que a peneira barata está
 * calibrada pro conteúdo que aparece de verdade, não pra um caso imaginado.
 */
describe("passesCheapNoiseFilter", () => {
  it("mantém aviso de serviço público (o achado que motivou a feature)", () => {
    const comunicado =
      "COMUNICADO Informamos que a Distrital permanecerá temporariamente fechada e que " +
      "suas atividades ficarão suspensas por um período indeterminado. Durante o último " +
      "final de semana, em decorrência das fortes chuvas, houve o desabamento de parte do telhado.";
    expect(passesCheapNoiseFilter(comunicado)).toBe(true);
  });

  it("corta classificado de imóvel", () => {
    expect(
      passesCheapNoiseFilter(
        "Alugo apartamento com 1 quarto, sala, cozinha e banheiro a 1 quilômetro do centro da cidade.",
      ),
    ).toBe(false);
  });

  it("corta anúncio de comércio local", () => {
    expect(
      passesCheapNoiseFilter(
        "SEGUNDA-FEIRA É DIA DE VIRADO À PAULISTA, também grelhados e parmegianas. Temos delivery, faça seu pedido!",
      ),
    ).toBe(false);
  });

  it("corta vaga de emprego avulsa", () => {
    expect(
      passesCheapNoiseFilter(
        "Vaga: Auxiliar de Limpeza. Estamos contratando para nossa equipe, local de trabalho Vila Maria Alta.",
      ),
    ).toBe(false);
  });

  it("corta post curto demais para classificar", () => {
    expect(passesCheapNoiseFilter("@todos")).toBe(false);
    expect(passesCheapNoiseFilter("Boa noite! ❤️")).toBe(false);
  });

  it("corta conteúdo religioso genérico", () => {
    expect(
      passesCheapNoiseFilter(
        "ABENÇOADA SEMANA COM DEUS A FRENTE, que todos tenham uma excelente jornada nesta semana.",
      ),
    ).toBe(false);
  });

  it("mantém pedido de mobilização comunitária", () => {
    expect(
      passesCheapNoiseFilter(
        "Estou fazendo um projeto na escola em que trabalho e preciso de papelão bem resistente. Alguém tem para doar?",
      ),
    ).toBe(true);
  });

  /**
   * Regressão de um bug real, achado testando o filtro contra post de verdade
   * do X (não do Facebook): a frase de ruído "vendo " (pra pegar classificado
   * tipo "Vendo relógio") também batia dentro de "envolvendo", derrubando uma
   * notícia real de acidente de ônibus com 20 vítimas. Corrigido com fronteira
   * de palavra (`\b`) no início de cada frase — este teste garante que não volta.
   */
  it("não corta notícia real por causa de substring dentro de outra palavra (envolvendo ⊃ vendo)", () => {
    expect(
      passesCheapNoiseFilter(
        "ATENÇÃO, MOTORISTAS! O trânsito no Anel Rodoviário, no bairro Betânia, em Belo Horizonte, está travado. O acidente envolvendo um ônibus de viagem, com cerca de 20 vítimas, interdita totalmente a pista do meio.",
      ),
    ).toBe(true);
  });

  it("ainda corta classificado real de venda (o caso que a frase deveria pegar)", () => {
    expect(passesCheapNoiseFilter("Vendo relógio casio 200, pouco uso, aceito proposta razoável.")).toBe(
      false,
    );
  });
});

function post(text: string): RadarBairroPost {
  return {
    id: "1",
    url: "https://facebook.com/groups/1/posts/1",
    text,
    publishedAt: null,
    authorName: "Fulano",
    likes: 0,
    comments: 0,
    groupTitle: "Moradores",
    localityName: "Centro",
  };
}

describe("filterRadarBairroPosts", () => {
  it("sem o estágio de IA não devolve sinal — a peneira barata sozinha deixa passar ruído demais", async () => {
    const { signals, stats } = await filterRadarBairroPosts(
      [post("Aviso importante sobre a obra da praça central que começou nesta segunda-feira.")],
      { llmEnabled: false },
    );

    expect(signals).toEqual([]);
    expect(stats.passedCheapFilter).toBe(1);
    expect(stats.llmCalls).toBe(0);
  });

  it("não chama a IA para post que já morreu na peneira barata", async () => {
    const { stats } = await filterRadarBairroPosts([post("Vendo relógio casio 200")], {
      llmEnabled: false,
    });

    expect(stats.received).toBe(1);
    expect(stats.passedCheapFilter).toBe(0);
  });
});
