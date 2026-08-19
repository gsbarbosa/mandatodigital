import { describe, expect, it } from "vitest";

import {
  mergeWomenWithValidMobile,
  parsePasta1Prospects,
  parseWhatsappScrape,
  pickProspectBatch,
  prospectToContact,
} from "@/lib/outbound/csv-prospects";

const PASTA = `username;Nome Completo;Gênero;Nome de Urna;Cargo;UF;Sigla Partido
alana;ALANA PASSOS;Feminino;ALANA PASSOS;DEPUTADO ESTADUAL;RJ;PL
joao;JOAO SILVA;Masculino;JOAO SILVA;DEPUTADO FEDERAL;MG;PT
maria;MARIA SOUZA;Feminino;MARIA SOUZA;DEPUTADO FEDERAL;BA;PT
`;

const WA = `username,whatsapp,whatsapp_e164,tem_whatsapp
alana,+55 21 99339-0119,+5521993390119,sim
joao,+55 31 98888-0000,+5531988880000,sim
maria,+671,+671,sim
`;

describe("csv-prospects", () => {
  it("só junta mulher TSE com móvel BR válido", () => {
    const pasta = parsePasta1Prospects(PASTA);
    const phones = parseWhatsappScrape(WA);
    const merged = mergeWomenWithValidMobile(pasta, phones);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.instagram).toBe("alana");
    expect(merged[0]?.phoneE164).toBe("5521993390119");
  });

  it("vira contato de disparo sem gravar CSV no id", () => {
    const contact = prospectToContact({
      instagram: "alana",
      name: "ALANA PASSOS",
      gender: "F",
      uf: "RJ",
      parties: ["PL"],
      candidateRole: "DEPUTADO ESTADUAL",
      phoneE164: "5521993390119",
    });
    expect(contact.id).toBe("wa_5521993390119");
    expect(contact.source).toBe("whatsapp_disparo");
    expect(contact.optOut).toBe(false);
    expect(contact.lastTemplate).toBe("");
  });

  it("recorte cabe no tamanho pedido", () => {
    const pasta = parsePasta1Prospects(PASTA);
    const phones = parseWhatsappScrape(
      `username,whatsapp_e164,whatsapp
alana,+5521993390119,+5521993390119
maria,+5571999990001,+5571999990001
`,
    );
    const merged = mergeWomenWithValidMobile(pasta, phones);
    expect(pickProspectBatch(merged, 1)).toHaveLength(1);
  });
});
