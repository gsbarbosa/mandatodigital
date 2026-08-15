import { afterEach, describe, expect, it } from "vitest";

import {
  buildAsaasNfsInvoiceSettings,
  buildAsaasScheduleInvoiceInput,
  isAsaasNfsEnabled,
} from "./nfs-config";

const ENV_KEYS = [
  "ASAAS_NFS_ENABLED",
  "ASAAS_NFS_MUNICIPAL_SERVICE_ID",
  "ASAAS_NFS_MUNICIPAL_SERVICE_CODE",
  "ASAAS_NFS_MUNICIPAL_SERVICE_NAME",
  "ASAAS_NFS_ISS",
  "ASAAS_NFS_RETAIN_ISS",
  "ASAAS_NFS_COFINS",
] as const;

afterEach(() => {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
});

describe("nfs-config", () => {
  it("fica off por padrao", () => {
    expect(isAsaasNfsEnabled()).toBe(false);
    expect(buildAsaasNfsInvoiceSettings({ planLabel: "Essencial" })).toBeNull();
  });

  it("exige servico municipal e ISS quando enabled", () => {
    process.env.ASAAS_NFS_ENABLED = "true";
    expect(buildAsaasNfsInvoiceSettings({ planLabel: "Essencial" })).toBeNull();

    process.env.ASAAS_NFS_MUNICIPAL_SERVICE_ID = "svc_1";
    expect(buildAsaasNfsInvoiceSettings({ planLabel: "Essencial" })).toBeNull();

    process.env.ASAAS_NFS_ISS = "2.5";
    const settings = buildAsaasNfsInvoiceSettings({ planLabel: "Essencial" });
    expect(settings).toMatchObject({
      municipalServiceId: "svc_1",
      effectiveDatePeriod: "ON_PAYMENT_CONFIRMATION",
      receivedOnly: true,
      updatePayment: false,
      taxes: { iss: 2.5, retainIss: false },
    });
    expect(settings?.serviceDescription).toContain("Essencial");
  });

  it("aceita codigo + nome quando nao ha id", () => {
    process.env.ASAAS_NFS_ENABLED = "true";
    process.env.ASAAS_NFS_MUNICIPAL_SERVICE_CODE = "1.01";
    process.env.ASAAS_NFS_MUNICIPAL_SERVICE_NAME = "Desenvolvimento de software";
    process.env.ASAAS_NFS_ISS = "3";
    process.env.ASAAS_NFS_RETAIN_ISS = "true";

    const settings = buildAsaasNfsInvoiceSettings({ planLabel: "Elite" });
    expect(settings).toMatchObject({
      municipalServiceCode: "1.01",
      municipalServiceName: "Desenvolvimento de software",
      taxes: { iss: 3, retainIss: true },
    });
    expect(settings?.municipalServiceId).toBeUndefined();
  });

  it("monta agendamento de NFS por parcela paga", () => {
    process.env.ASAAS_NFS_ENABLED = "true";
    process.env.ASAAS_NFS_MUNICIPAL_SERVICE_ID = "svc_1";
    process.env.ASAAS_NFS_ISS = "2.5";

    expect(
      buildAsaasScheduleInvoiceInput({
        planLabel: "Avançado",
        paymentId: "pay_9",
        value: 1998,
        effectiveDate: "2026-08-05",
      }),
    ).toMatchObject({
      paymentId: "pay_9",
      value: 1998,
      effectiveDate: "2026-08-05",
      municipalServiceId: "svc_1",
      taxes: { iss: 2.5 },
    });
  });
});
