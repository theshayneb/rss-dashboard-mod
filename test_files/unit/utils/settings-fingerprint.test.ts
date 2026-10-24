import { describe, expect, it } from "vitest";
import { settingsFingerprint } from "../../../src/utils/settings-fingerprint";

describe("settingsFingerprint()", () => {
  it("matches settings that differ only by sync bookkeeping", () => {
    expect(
      settingsFingerprint({ refreshInterval: 60, _syncNonce: "1", _syncPad: "a" }),
    ).toBe(
      settingsFingerprint({ refreshInterval: 60, _syncNonce: "2", _syncPad: "bb" }),
    );
  });

  it("differs when a real setting differs", () => {
    expect(settingsFingerprint({ refreshInterval: 60 })).not.toBe(
      settingsFingerprint({ refreshInterval: 30 }),
    );
  });
});
