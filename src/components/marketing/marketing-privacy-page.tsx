import { MarketingSection } from "@/components/marketing/marketing-section";
import {
  PRIVACY_CONTACT_EMAIL,
  PRIVACY_EFFECTIVE_DATE,
  PRIVACY_VERSION,
  privacyController,
  privacyIntro,
  privacySections,
  type PrivacySection,
} from "@/lib/marketing/privacidade-content";

/**
 * Documento legal: a leitura corrida vence o visual de marketing. Medida de
 * texto estreita, hierarquia sóbria e um índice para navegar as 11 seções.
 */

function SectionBody({ section }: { section: PrivacySection }) {
  return (
    <div className="space-y-5">
      {section.body?.map((paragraph) => (
        <p key={paragraph} className="text-base leading-relaxed text-md-text-soft">
          {paragraph}
        </p>
      ))}

      {section.bullets ? (
        <ul className="space-y-2.5">
          {section.bullets.map((item) => (
            <li
              key={item}
              className="relative pl-5 text-base leading-relaxed text-md-text-soft before:absolute before:left-0 before:top-[0.7em] before:h-1.5 before:w-1.5 before:rounded-full before:bg-emerald-400/70"
            >
              {item}
            </li>
          ))}
        </ul>
      ) : null}

      {section.rows ? (
        <dl className="divide-y divide-md-border-soft border-y border-md-border-soft">
          {section.rows.map((row) => (
            <div key={row.label} className="py-4 sm:grid sm:grid-cols-3 sm:gap-6">
              <dt className="text-sm font-semibold text-md-text-muted">{row.label}</dt>
              <dd className="mt-1.5 text-base leading-relaxed text-md-text-soft sm:col-span-2 sm:mt-0">
                {row.detail}
                {row.extra ? (
                  <span className="mt-1.5 block text-sm text-md-text-soft/75">{row.extra}</span>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

export function MarketingPrivacyPage() {
  return (
    <>
      <MarketingSection
        titleAs="h1"
        title={privacyIntro.title}
        lead={privacyIntro.subtitle}
        className="border-t-0"
      >
        <div className="max-w-3xl space-y-5">
          <p className="text-sm text-md-text-soft/80">
            Versão {PRIVACY_VERSION} · Em vigor desde {PRIVACY_EFFECTIVE_DATE}
          </p>
          {privacyIntro.body.map((paragraph) => (
            <p key={paragraph} className="text-base leading-relaxed text-md-text-soft">
              {paragraph}
            </p>
          ))}

          <div className="rounded-lg border border-md-border-soft bg-md-bg-soft/40 p-5">
            <p className="text-sm font-semibold text-md-text-muted">Controlador dos dados</p>
            <p className="mt-2 text-base text-md-text-soft">{privacyController.razaoSocial}</p>
            <p className="mt-1 text-sm text-md-text-soft">CNPJ {privacyController.cnpj}</p>
            <p className="mt-1 text-sm text-md-text-soft">{privacyController.endereco}</p>
            <p className="mt-3 text-sm text-md-text-soft">
              Encarregado pelo tratamento de dados:{" "}
              <a
                href={`mailto:${PRIVACY_CONTACT_EMAIL}`}
                className="text-emerald-400 underline underline-offset-2 transition hover:opacity-80"
              >
                {PRIVACY_CONTACT_EMAIL}
              </a>
            </p>
          </div>

          <nav aria-label="Índice desta política" className="pt-2">
            <p className="text-sm font-semibold text-md-text-muted">Nesta página</p>
            <ol className="mt-3 space-y-1.5">
              {privacySections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="text-sm text-md-text-soft underline-offset-2 transition hover:text-md-text-muted hover:underline"
                  >
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </div>
      </MarketingSection>

      {privacySections.map((section) => (
        <MarketingSection key={section.id} id={section.id} title={section.title}>
          <div className="max-w-3xl">
            <SectionBody section={section} />
          </div>
        </MarketingSection>
      ))}

      <MarketingSection id="contato" title="12. Como falar conosco">
        <div className="max-w-3xl space-y-5">
          <p className="text-base leading-relaxed text-md-text-soft">
            Para exercer qualquer direito da seção 6, tirar dúvidas sobre esta política ou
            registrar oposição ao contato comercial, escreva para{" "}
            <a
              href={`mailto:${PRIVACY_CONTACT_EMAIL}`}
              className="text-emerald-400 underline underline-offset-2 transition hover:opacity-80"
            >
              {PRIVACY_CONTACT_EMAIL}
            </a>
            . Respondemos em até 15 dias.
          </p>
          <p className="text-base leading-relaxed text-md-text-soft">
            Você também pode apresentar reclamação à Autoridade Nacional de Proteção de Dados
            (ANPD).
          </p>
        </div>
      </MarketingSection>
    </>
  );
}
