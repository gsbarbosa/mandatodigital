import { NextResponse } from "next/server";

import { apiRoute } from "@/lib/auth/api-route";
import { isRadarBairroEnabled } from "@/lib/feature-flags";
import { bootstrapRegistry } from "@/lib/radar-bairro";
import { radarBairroStorage } from "@/lib/radar-bairro-storage";

/** Descoberta automática: várias buscas + amostragem. É a rota mais lenta daqui. */
export const maxDuration = 300;

/**
 * Monta o registry automático da cidade do mandato — a parte que decide sozinha
 * entre "cidade inteira" e "bairros", sem o usuário digitar nada.
 *
 * Preserva as localidades que o candidato escolheu à mão: refazer a busca
 * automática não pode apagar o que ele pagou pra ter.
 */
export async function POST() {
  return apiRoute(async (repository) => {
    if (!isRadarBairroEnabled()) {
      return NextResponse.json({ message: "Radar de Bairro indisponível." }, { status: 404 });
    }

    const dashboard = await repository.getDashboard();
    const profile = dashboard.profile;
    if (!profile?.id) {
      return NextResponse.json(
        { message: "Crie e salve um perfil antes de rodar a busca." },
        { status: 400 },
      );
    }

    const city = profile.city?.trim() || "";
    const uf = profile.state?.trim() || "";
    if (!city) {
      return NextResponse.json(
        { message: "Cadastre a cidade do mandato no perfil para usar o Radar de Bairro." },
        { status: 400 },
      );
    }

    const previous = await radarBairroStorage.readRegistry(profile.id);
    const chosenByCandidate = previous.localities.filter((item) => item.source === "candidato");

    const discovered = await bootstrapRegistry({
      city,
      uf,
      knownNeighborhoods: profile.municipalCities ?? [],
    });

    const merged = {
      ...discovered,
      localities: [...discovered.localities, ...chosenByCandidate],
    };
    await radarBairroStorage.writeRegistry(profile.id, merged);

    return NextResponse.json({
      localities: merged.localities,
      registry: {
        city: merged.city,
        uf: merged.uf,
        mode: merged.mode,
        population: merged.population,
        updatedAt: merged.updatedAt,
      },
    });
  });
}
