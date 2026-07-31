#!/usr/bin/env node
/**
 * Preflight / check de sobreaviso — demo com plateia (DEMO_MODE).
 *
 * Uso:
 *   npm run demo:oncall-check
 *   npm run demo:oncall-check -- --json
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run demo:oncall-check
 *
 * Exit codes:
 *   0 = GO (ou só avisos informativos)
 *   2 = NO-GO (cotas/provedores críticos)
 *   1 = falha de execução (rede/auth)
 *
 * Credenciais admin: ADMIN_EMAIL / ADMIN_PASSWORD no env, senão defaults de bootstrap.
 */

import { spawnSync } from "node:child_process";

const BASE =
  process.env.DEMO_ONCALL_BASE_URL?.trim() ||
  "https://mandatodigital--madatodigital.us-central1.hosted.app";
const MARKETING =
  process.env.DEMO_ONCALL_MARKETING_URL?.trim() || "https://www.mandatodigital.ia.br/";
const ADMIN_EMAIL =
  process.env.ADMIN_EMAIL?.trim() || "admin@mandatodigital.com.br";
const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD?.trim() || "TarsSinistro1@#";

/** Margem mínima HeyGen (USD) para liberar geração em massa (~$1.3–1.8 / vídeo demo). */
const HEYGEN_MIN_USD = Number(process.env.DEMO_ONCALL_HEYGEN_MIN_USD || 50);
/** Chars ElevenLabs mínimos (~390 chars/roteiro × 180 ≈ 70k). */
const ELEVENLABS_MIN_CHARS = Number(process.env.DEMO_ONCALL_EL_MIN_CHARS || 70000);
const USAGE_ALERT_PCT = Number(process.env.DEMO_ONCALL_USAGE_ALERT_PCT || 60);

const wantJson = process.argv.includes("--json");
const showContainment = process.argv.includes("--containment");

const CONTAINMENT = `
=== Contenção rápida (vídeo falhando em massa) ===
1. Pedir pausa de "Gerar vídeo" na sala (não é bug de UI — cota compartilhada).
2. /admin/provedores → HeyGen remaining + ElevenLabs chars.
3. Recarregar:
   - HeyGen: app.heygen.com → Settings → API → Add credits (pay-as-you-go)
     (créditos do plano WEB não alimentam a API)
   - ElevenLabs: elevenlabs.io → Subscription / credits
4. NÃO fazer no evento: deploy App Hosting, flip DEMO_MODE, force-push.
5. App 5xx/timeout: health + retry escalonado; async jobs estão OFF (sync no mesmo pool).
6. Limites DEMO (esperado): 3 saves tema, 2 vídeos/avatar, refresh pauta manual off.
`;

function curlJson(args) {
  const result = spawnSync(
    "curl",
    ["-sS", "--http1.1", "--connect-timeout", "10", "--max-time", "45", "--retry", "2", ...args],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || result.stdout?.trim() || "curl failed");
  }
  const text = (result.stdout || "").trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text.slice(0, 200) };
  }
}

function curlTiming(url) {
  const result = spawnSync(
    "curl",
    [
      "-sS",
      "--http1.1",
      "--connect-timeout",
      "10",
      "--max-time",
      "30",
      "-o",
      "/dev/null",
      "-w",
      "%{http_code}|%{time_total}",
      "-L",
      url,
    ],
    { encoding: "utf8" },
  );
  const out = (result.stdout || "").trim();
  const [code, time] = out.split("|");
  return {
    url,
    status: Number(code) || 0,
    timeSec: Number(time) || 99,
    ok: result.status === 0 && Number(code) >= 200 && Number(code) < 400,
  };
}

function main() {
  if (showContainment) {
    console.log(CONTAINMENT.trim());
    process.exit(0);
  }

  const cookieJar = `/tmp/md-demo-oncall-${process.pid}.cookies`;
  const alerts = [];
  const warnings = [];
  const rows = [];

  const healthUrls = [
    ["home", `${BASE}/`],
    ["entrar", `${BASE}/entrar`],
    ["health", `${BASE}/api/health/runtime-env`],
    ["marketing", MARKETING],
  ];
  const http = healthUrls.map(([label, url]) => {
    const hit = curlTiming(url);
    const row = { label, ...hit };
    if (!hit.ok || hit.status >= 400) {
      alerts.push(`HTTP ${label}: status ${hit.status}`);
    } else if (hit.timeSec > 5) {
      alerts.push(`HTTP ${label}: lento ${hit.timeSec.toFixed(2)}s`);
    }
    return row;
  });

  let health = null;
  try {
    health = curlJson([`${BASE}/api/health/runtime-env`]);
  } catch (err) {
    alerts.push(`health JSON: ${err.message}`);
  }

  const demoMode =
    health?.flags?.demoMode === true || health?.readiness?.mode === "demo_degustacao";
  if (health && health.flags == null && health.readiness == null) {
    warnings.push(
      "Health sem flags/readiness (build antigo?). Confirme DEMO_MODE no App Hosting /admin e UX pós-login.",
    );
  } else if (health && !demoMode) {
    alerts.push("DEMO_MODE aparentemente OFF no health — plateia não está em degustação.");
  }

  try {
    const login = curlJson([
      "-c",
      cookieJar,
      "-b",
      cookieJar,
      "-X",
      "POST",
      `${BASE}/api/admin/login`,
      "-H",
      "Content-Type: application/json",
      "-d",
      JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    ]);
    if (!login?.ok) {
      throw new Error(login?.message || "login admin falhou");
    }
  } catch (err) {
    console.error(JSON.stringify({ ok: false, error: String(err.message || err) }, null, 2));
    process.exit(1);
  }

  for (const provider of ["apify", "openai", "heygen", "elevenlabs", "resend"]) {
    let payload;
    try {
      payload = curlJson(["-b", cookieJar, `${BASE}/api/admin/providers/${provider}`]);
    } catch (err) {
      alerts.push(`${provider}: ${err.message}`);
      continue;
    }
    const status = payload?.status || {};
    const usage = status.usage || null;
    const account = status.account || {};
    const row = {
      provider,
      ok: status.ok,
      error: status.error || null,
      percentUsed: usage?.percentUsed ?? null,
      remaining: usage?.remaining ?? null,
      limit: usage?.limit ?? null,
      unit: usage?.unit ?? null,
      label: usage?.label ?? null,
    };
    rows.push(row);

    if (status.tokenSource !== "none" && status.ok === false) {
      alerts.push(`${provider}: ok=false — ${status.error || "erro"}`);
    }

    if (provider === "heygen" && usage) {
      const rem = Number(usage.remaining || 0);
      if (rem < 2) {
        alerts.push(`HeyGen wallet crítica: US$ ${rem.toFixed(2)}`);
      } else if (rem < HEYGEN_MIN_USD) {
        alerts.push(
          `HeyGen wallet US$ ${rem.toFixed(2)} < mínimo ${HEYGEN_MIN_USD} (NO-GO geração em massa; ~US$1.3–1.8/vídeo). Recarregar API wallet.`,
        );
      }
    }

    if (provider === "elevenlabs" && usage) {
      const rem = Number(usage.remaining || 0);
      const pct = Number(usage.percentUsed || 0);
      if (pct >= USAGE_ALERT_PCT || usage.exhausted) {
        alerts.push(`ElevenLabs ${pct.toFixed(0)}% uso`);
      } else if (rem < ELEVENLABS_MIN_CHARS) {
        alerts.push(
          `ElevenLabs ${rem.toFixed(0)} chars < mínimo ${ELEVENLABS_MIN_CHARS} (~180 TTS). Subir plano/créditos.`,
        );
      }
    }

    if (provider === "apify" && usage) {
      const pct = Number(usage.percentUsed || 0);
      if (pct >= USAGE_ALERT_PCT || usage.exhausted) {
        alerts.push(`Apify ${pct.toFixed(0)}% uso`);
      }
    }

    if (provider === "openai" && !usage) {
      warnings.push(
        account.adminKey ||
          "OpenAI sem % de uso — defina OPENAI_ADMIN_KEY; se caricaturas falharem, ver platform.openai.com",
      );
    }
  }

  try {
    spawnSync("rm", ["-f", cookieJar]);
  } catch {
    /* ignore */
  }

  const nogo = alerts.length > 0;
  const report = {
    checkedAt: new Date().toISOString(),
    base: BASE,
    verdict: nogo ? "NO-GO" : warnings.length ? "GO_WITH_WARNINGS" : "GO",
    demoMode: demoMode || null,
    thresholds: {
      heygenMinUsd: HEYGEN_MIN_USD,
      elevenLabsMinChars: ELEVENLABS_MIN_CHARS,
      usageAlertPct: USAGE_ALERT_PCT,
    },
    http,
    health,
    providers: rows,
    alerts,
    warnings,
    expectedDemoLimits: {
      themeSaves: 3,
      videosPerAvatar: 2,
      manualPautaRefresh: false,
    },
    recharge: {
      heygen: "https://app.heygen.com → Settings → API → Add credits (pay-as-you-go)",
      elevenlabs: "https://elevenlabs.io/app/settings → subscription / credits",
    },
  };

  if (wantJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`=== demo oncall ${report.checkedAt} ===`);
    console.log(`verdict: ${report.verdict}`);
    console.log(
      `demoMode: ${report.demoMode === null ? "desconhecido (health antigo)" : report.demoMode}`,
    );
    console.log("--- http ---");
    for (const h of http) {
      console.log(`${h.label}: HTTP ${h.status} ${h.timeSec.toFixed(2)}s`);
    }
    console.log("--- providers ---");
    for (const p of rows) {
      const pct = p.percentUsed == null ? "—" : `${Number(p.percentUsed).toFixed(1)}%`;
      const rem = p.remaining == null ? "—" : String(p.remaining);
      console.log(`${p.provider}: ok=${p.ok} pct=${pct} rem=${rem} ${p.error || ""}`.trim());
    }
    if (alerts.length) {
      console.log("--- ALERTS (NO-GO) ---");
      for (const a of alerts) console.log(`! ${a}`);
    }
    if (warnings.length) {
      console.log("--- warnings ---");
      for (const w of warnings) console.log(`~ ${w}`);
    }
    if (nogo) {
      console.log("\nRecarga:");
      console.log(`  HeyGen: ${report.recharge.heygen}`);
      console.log(`  ElevenLabs: ${report.recharge.elevenlabs}`);
      console.log("\nContenção: npm run demo:oncall-check -- --containment");
    }
  }

  process.exit(nogo ? 2 : 0);
}

main();
