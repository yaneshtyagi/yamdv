import { describe, it, expect } from "vitest";
import {
  commands,
  matchesShortcut,
  commandEnabled,
  commandKeys,
  matchesCommandShortcut,
} from "../src/commands";
describe("commands", () => {
  it("has unique identifiers and shortcuts", () => {
    expect(new Set(commands.map((c) => c.id)).size).toBe(commands.length);
    const keys = commands.flatMap(commandKeys);
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

describe("reading shortcuts", () => {
  it("recognizes both tab bindings and exact Alt modifiers", () => {
    const cmd = commands.find((c) => c.id === "next-tab");
    const event = {
      key: "ArrowRight",
      metaKey: true,
      altKey: true,
      ctrlKey: false,
      shiftKey: false,
    };
    expect(matchesCommandShortcut(event, cmd, true)).toBe(true);
    expect(matchesCommandShortcut({ ...event, altKey: false }, cmd, true)).toBe(
      false,
    );
    expect(
      matchesCommandShortcut(
        { ...event, key: "Tab", ctrlKey: true, metaKey: false, altKey: false },
        cmd,
        true,
      ),
    ).toBe(true);
    expect(
      matchesCommandShortcut(
        { ...event, ctrlKey: true, metaKey: false },
        cmd,
        false,
      ),
    ).toBe(true);
  });
  it("marks Shift-arrow scrolling as sidebar-only and enables back/forward independently", () => {
    expect(commands.find((c) => c.id === "scroll-document-down").scope).toBe(
      "sidebar",
    );
    expect(
      commandEnabled(
        commands.find((c) => c.id === "go-back"),
        { back: true, forward: false },
      ),
    ).toBe(true);
    expect(
      commandEnabled(
        commands.find((c) => c.id === "go-forward"),
        { back: true, forward: false },
      ),
    ).toBe(false);
  });
});

describe("UI zoom shortcuts", () => {
  it("uses separate Alt-modified bindings and handles macOS Option glyphs", () => {
    for (const [id, key, code] of [
      ["ui-in", "≠", "Equal"],
      ["ui-out", "–", "Minus"],
      ["ui-reset", "º", "Digit0"],
    ]) {
      const command = commands.find((c) => c.id === id);
      const event = {
        key,
        code,
        metaKey: true,
        ctrlKey: false,
        altKey: true,
        shiftKey: false,
      };
      expect(matchesCommandShortcut(event, command, true)).toBe(true);
      expect(
        matchesCommandShortcut({ ...event, altKey: false }, command, true),
      ).toBe(false);
    }
    expect(commands.find((c) => c.id === "ui-in").key).toBe("Mod+Alt+Plus");
  });
});
