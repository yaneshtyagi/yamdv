import { describe, it, expect, vi } from "vitest";
import { centerInReader } from "../src/scrolling";
describe("reader-only target navigation", () => {
  it("centers a target in the reader using CSS rather than screen coordinates at UI zoom", () => {
    const target = {
        getBoundingClientRect: () => ({ top: 1050, height: 80 }),
        scrollIntoView: vi.fn(),
      },
      reader = {
        contains: () => true,
        clientHeight: 200,
        scrollTop: 100,
        getBoundingClientRect: () => ({ top: 50, height: 400 }),
        scrollTo: vi.fn(),
      };
    centerInReader(reader, target);
    expect(reader.scrollTo).toHaveBeenCalledWith({
      top: 520,
      behavior: "instant",
    });
    expect(target.scrollIntoView).not.toHaveBeenCalled();
  });
  it("clamps the top and ignores detached targets or unmounted/hidden readers", () => {
    const target = { getBoundingClientRect: () => ({ top: 20, height: 20 }) },
      reader = {
        contains: () => true,
        clientHeight: 200,
        scrollTop: 0,
        getBoundingClientRect: () => ({ top: 0, height: 200 }),
        scrollTo: vi.fn(),
      };
    centerInReader(reader, target);
    expect(reader.scrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: "instant",
    });
    reader.scrollTo.mockClear();
    reader.contains = () => false;
    centerInReader(reader, target);
    centerInReader(null, target);
    centerInReader({ ...reader, clientHeight: 0 }, target);
    expect(reader.scrollTo).not.toHaveBeenCalled();
  });
});
