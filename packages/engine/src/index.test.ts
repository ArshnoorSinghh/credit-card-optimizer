import { describe, expect, it } from "vitest";
import { hello } from "./index";

describe("hello", () => {
  it("returns a greeting string", () => {
    expect(hello()).toBe("Hello from @fils/engine");
  });
});