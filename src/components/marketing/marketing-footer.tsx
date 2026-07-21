import { MARKETING_FOOTER } from "@/lib/marketing/shared";

export function MarketingFooter() {
  return (
    <footer className="border-t border-slate-800/80 bg-[#01040c] py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 text-sm text-slate-500 sm:px-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-medium text-slate-400">{MARKETING_FOOTER.razaoSocial}</p>
          <p className="mt-1">CNPJ: {MARKETING_FOOTER.cnpj}</p>
          <p className="mt-1 max-w-md">{MARKETING_FOOTER.address}</p>
        </div>
        <div className="sm:text-right">
          <a
            href={MARKETING_FOOTER.siteUrl}
            className="text-emerald-400/90 transition hover:text-emerald-300"
            rel="noopener noreferrer"
          >
            {MARKETING_FOOTER.siteLabel}
          </a>
          <p className="mt-2 text-xs text-slate-600">
            © {new Date().getFullYear()} Mandato Digital
          </p>
        </div>
      </div>
    </footer>
  );
}
