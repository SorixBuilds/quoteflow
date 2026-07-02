import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/error";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  parseEnumParam,
  parseListParams,
  parseUuidParam,
  requireUuid,
} from "@/lib/api/params";

/**
 * §21.11 list-parameter rules: sane defaults, a hard 100 cap, and 422s (never
 * silent coercion) for malformed values.
 */

const url = (query: string) => new URL(`https://api.test/api/v1/leads${query}`);

describe("parseListParams (§21.11)", () => {
  it("defaults to page 1 / pageSize 25", () => {
    expect(parseListParams(url(""))).toEqual({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      skip: 0,
    });
  });

  it("derives skip from page and pageSize", () => {
    expect(parseListParams(url("?page=3&pageSize=10"))).toEqual({
      page: 3,
      pageSize: 10,
      skip: 20,
    });
  });

  it("caps pageSize at 100", () => {
    expect(parseListParams(url("?pageSize=5000")).pageSize).toBe(MAX_PAGE_SIZE);
  });

  it.each(["?page=0", "?page=-1", "?page=abc", "?page=1.5", "?pageSize=0"])(
    "rejects %s with a 422",
    (query) => {
      expect(() => parseListParams(url(query))).toThrowError(
        expect.objectContaining({ status: 422, code: "invalid_parameter" }),
      );
    },
  );
});

describe("parseEnumParam", () => {
  const allowed = ["NEW", "WON", "LOST"] as const;

  it("returns undefined when absent and the value when valid", () => {
    expect(parseEnumParam(url(""), "status", allowed)).toBeUndefined();
    expect(parseEnumParam(url("?status=WON"), "status", allowed)).toBe("WON");
  });

  it("rejects a value outside the closed set with a 422 (never ignores it)", () => {
    expect(() => parseEnumParam(url("?status=BOGUS"), "status", allowed)).toThrowError(
      expect.objectContaining({ status: 422, code: "invalid_parameter" }),
    );
  });
});

describe("uuid params", () => {
  const uuid = "123e4567-e89b-42d3-a456-426614174000";

  it("accepts a well-formed uuid filter and rejects a malformed one with 422", () => {
    expect(parseUuidParam(url(`?customerId=${uuid}`), "customerId")).toBe(uuid);
    expect(parseUuidParam(url(""), "customerId")).toBeUndefined();
    expect(() => parseUuidParam(url("?customerId=nope"), "customerId")).toThrowError(
      expect.objectContaining({ status: 422 }),
    );
  });

  it("404s (not 422) for a malformed path id — no enumeration signal (§21.9)", () => {
    expect(requireUuid(uuid)).toBe(uuid);
    try {
      requireUuid("not-a-uuid");
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(404);
      expect((error as ApiError).code).toBe("not_found");
    }
  });
});
