import { afterEach, describe, expect, it } from "vitest";

import { parsePubSubPushBody } from "@/lib/async-jobs-auth";
import {
  getPubSubTopicForJobType,
  isPubSubPublishEnabled,
} from "@/lib/async-jobs-pubsub";

describe("parsePubSubPushBody", () => {
  it("aceita jobId direto", () => {
    expect(parsePubSubPushBody({ jobId: "abc" })).toEqual({ jobId: "abc" });
  });

  it("decodifica mensagem Pub/Sub", () => {
    const data = Buffer.from(JSON.stringify({ jobId: "job-1", type: "seal_video" })).toString(
      "base64",
    );
    expect(parsePubSubPushBody({ message: { data } })).toEqual({ jobId: "job-1" });
  });

  it("usa attributes.jobId", () => {
    expect(
      parsePubSubPushBody({ message: { attributes: { jobId: "from-attr" } } }),
    ).toEqual({ jobId: "from-attr" });
  });
});

describe("getPubSubTopicForJobType", () => {
  it("mapeia tipos para topics", () => {
    expect(getPubSubTopicForJobType("seal_video")).toBe("md-jobs-seal");
    expect(getPubSubTopicForJobType("voice_tts")).toBe("md-jobs-voice");
  });
});

describe("isPubSubPublishEnabled", () => {
  const key = "PUBSUB_JOBS_ENABLED";
  const original = process.env[key];

  afterEach(() => {
    if (original === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = original;
    }
  });

  it("exige flag explicita", () => {
    delete process.env[key];
    expect(isPubSubPublishEnabled()).toBe(false);
    process.env[key] = "true";
    expect(isPubSubPublishEnabled()).toBe(true);
  });
});
