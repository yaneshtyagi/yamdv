import { describe, it, expect } from "vitest";
import { commands, matchesShortcut, commandEnabled } from "../src/commands";
describe("commands", () => {
  it("has unique identifiers and shortcuts", () => {
    expect(new Set(commands.map((c) => c.id)).size).toBe(commands.length);
    const keys = commands.map((c) => c.key).filter(Boolean);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it("matches platform shortcuts including shifted plus and enabled states", () => {
    const e = {
      key: "+",
      metaKey: true,
      ctrlKey: false,
      shiftKey: true,
      altKey: false,
    };
    expect(matchesShortcut(e, "Mod+Plus", true)).toBe(true);
    expect(
      matchesShortcut({ ...e, key: "t", shiftKey: false }, "Mod+T", true),
    ).toBe(true);
    expect(
      matchesShortcut(
        { ...e, key: "t", shiftKey: false, metaKey: false, ctrlKey: true },
        "Mod+T",
        false,
      ),
    ).toBe(true);
    expect(commandEnabled({ needs: "document" }, { document: false })).toBe(
      false,
    );
  });
});
