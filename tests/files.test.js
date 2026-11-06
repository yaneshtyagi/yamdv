import { describe, it, expect, vi } from "vitest";
const { saved } = vi.hoisted(() => ({ saved: new Map() }));
vi.mock("../src/services/store", () => ({
  desktop: null,
  handleStore: async (id) => saved.get(id),
  storedHandles: async () => [],
}));
import { availability, readFile, grant } from "../src/services/files";
describe("persistent browser file references", () => {
  it("distinguishes missing, inaccessible, and ungranted handles", async () => {
    saved.set("denied", { queryPermission: async () => "prompt" });
    saved.set("missing", {
      queryPermission: async () => "granted",
      getFile: async () => {
        throw new DOMException("Gone", "NotFoundError");
      },
    });
    saved.set("inaccessible", {
      queryPermission: async () => "granted",
      getFile: async () => {
        throw new DOMException("Denied", "NotAllowedError");
      },
    });
    expect(await availability({ id: "denied" })).toBe("permission");
    expect(await availability({ id: "missing" })).toBe("missing");
    expect(await availability({ id: "inaccessible" })).toBe("inaccessible");
    await expect(
      readFile({ id: "denied", content: "old snapshot" }),
    ).rejects.toMatchObject({ status: "permission" });
  });
  it("renews access from an explicit action and reads the current file rather than stale text", async () => {
    let permission = "prompt";
    saved.set("renew", {
      queryPermission: async () => permission,
      requestPermission: async () => {
        permission = "granted";
      },
      getFile: async () => ({ text: async () => "current" }),
    });
    expect(await grant({ id: "renew" })).toBe("available");
    expect(await readFile({ id: "renew", content: "stale" })).toBe("current");
  });
});
