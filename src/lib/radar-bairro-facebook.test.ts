import { describe, expect, it } from "vitest";

import { normalizeFacebookGroupItems } from "@/lib/radar-bairro-facebook";

/**
 * O dataset cru do ator mistura post, linha de erro e "lápide" de conteúdo
 * removido — os três apareceram na coleta real que validou a feature.
 */
describe("normalizeFacebookGroupItems", () => {
  it("descarta a linha de erro que o ator devolve para grupo vazio/privado", () => {
    const items = [
      {
        url: "https://www.facebook.com/groups/360247957361676/",
        error: "no_items",
        errorDescription: "Empty or private data for provided input",
      },
    ];

    expect(normalizeFacebookGroupItems(items, "Santa Cruz")).toEqual([]);
  });

  it("descarta post marcado como indisponível (apagado ou restrito depois da coleta)", () => {
    const items = [
      {
        url: "https://www.facebook.com/groups/1/posts/1",
        text: "",
        title: "This content isn't available right now",
      },
    ];

    expect(normalizeFacebookGroupItems(items, "Vila Amélia")).toEqual([]);
  });

  it("descarta post sem texto — não há o que classificar", () => {
    const items = [{ url: "https://www.facebook.com/groups/1/posts/2", text: "   " }];

    expect(normalizeFacebookGroupItems(items, "Centro")).toEqual([]);
  });

  it("deduplica repost idêntico do mesmo autor", () => {
    const repeated = {
      url: "https://www.facebook.com/groups/1/posts/3",
      text: "PRECISA-SE DE FREE-LANCER PARA RESTAURANTE E EVENTOS AO FINAL DE SEMANA",
      user: { name: "Luis Diaas Cesar" },
    };
    const items = [repeated, { ...repeated, url: "https://www.facebook.com/groups/1/posts/4" }];

    expect(normalizeFacebookGroupItems(items, "Vila Maria")).toHaveLength(1);
  });

  it("normaliza post válido e ordena do mais recente para o mais antigo", () => {
    const items = [
      {
        url: "https://www.facebook.com/groups/1/posts/antigo",
        legacyId: "antigo",
        text: "Post mais antigo do grupo",
        time: "2026-08-01T10:00:00.000Z",
        user: { name: "Maria" },
        likesCount: 2,
        commentsCount: 1,
        groupTitle: "Moradores Vila Maria",
      },
      {
        url: "https://www.facebook.com/groups/1/posts/novo",
        legacyId: "novo",
        text: "Post mais recente do grupo",
        time: "2026-08-17T13:32:35.000Z",
        user: { name: "Fábio" },
        likesCount: 0,
        commentsCount: 0,
        groupTitle: "Moradores Vila Maria",
      },
    ];

    const posts = normalizeFacebookGroupItems(items, "Vila Maria");

    expect(posts.map((item) => item.id)).toEqual(["novo", "antigo"]);
    expect(posts[0]).toMatchObject({
      authorName: "Fábio",
      groupTitle: "Moradores Vila Maria",
      localityName: "Vila Maria",
      publishedAt: "2026-08-17T13:32:35.000Z",
    });
  });
});
