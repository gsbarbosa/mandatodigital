import Link from "next/link";

import { MARKETING_FOOTER } from "@/lib/marketing/shared";

export function MarketingFooter() {
  return (
    <footer className="border-t border-md-border bg-md-bg py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 text-sm text-md-text-soft sm:px-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-medium text-md-text-muted">{MARKETING_FOOTER.razaoSocial}</p>
          <p className="mt-1">CNPJ: {MARKETING_FOOTER.cnpj}</p>
          <p className="mt-1 max-w-md">{MARKETING_FOOTER.address}</p>
        </div>
        <div className="sm:text-right">
          <a
            href={MARKETING_FOOTER.siteUrl}
            className="text-[var(--sentinela-text)] transition hover:opacity-90"
            rel="noopener noreferrer"
          >
            {MARKETING_FOOTER.siteLabel}
          </a>
          <p className="mt-2">
            <Link
              href="/politica-de-privacidade"
              className="transition hover:text-md-text-muted"
            >
              Política de Privacidade
            </Link>
          </p>
          <p className="mt-2 text-xs text-md-text-soft">
            © {new Date().getFullYear()} Mandato Digital
          </p>
        </div>
      </div>
    </footer>
  );
}
