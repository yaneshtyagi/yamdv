import { describe, it, expect } from "vitest";
import {
  wordMotion,
  nextCharacter,
  previousCharacter,
} from "../src/reader-text";
describe("read-only cursor motions", () => {
  it("moves across words, punctuation and paragraph boundaries", () => {
    const text = "One bold, two\nNext";
    expect(wordMotion(text, 0, "w")).toBe(4);
    expect(wordMotion(text, 4, "e")).toBe(7);
    expect(wordMotion(text, 7, "w")).toBe(8);
    expect(wordMotion(text, 8, "w")).toBe(10);
    expect(wordMotion(text, 10, "b")).toBe(8);
    expect(wordMotion(text, 13, "w")).toBe(14);
    expect(wordMotion("", 0, "w")).toBe(0);
  });
  it("keeps grapheme clusters intact for emoji, combining accents and non-Latin words", () => {
    const text = "a👩‍💻e\u0301中";
    expect(nextCharacter(text, 1)).toBe(6);
    expect(previousCharacter(text, 6)).toBe(1);
    expect(nextCharacter(text, 6)).toBe(8);
    expect(previousCharacter(text, 8)).toBe(6);
    expect(wordMotion("👩‍💻 ok", 0, "e")).toBe(7);
    expect(wordMotion("👩‍💻 ok", 0, "w")).toBe(6);
    expect(wordMotion("你好 世界", 0, "w")).toBe(3);
  });
});
