import { describe, expect, it } from "vitest";
import { dynamicHttpUrl, getUrlParamNames, substituteUrlParams } from "./link";

describe("dynamicHttpUrl", () => {
  const schema = dynamicHttpUrl();
  it("accepts params in the host and path", () => {
    expect(schema.safeParse("https://:subd.matthiaz.dev").success).toBe(true);
    expect(schema.safeParse("https://:subd.matthiaz.dev/x/:id").success).toBe(
      true,
    );
    expect(schema.safeParse("https://a.:b.example.com:8080/").success).toBe(
      true,
    );
  });
  it("still rejects garbage", () => {
    expect(schema.safeParse("ftp://x.dev").success).toBe(false);
    expect(schema.safeParse("not a url").success).toBe(false);
  });
});

describe("getUrlParamNames", () => {
  it("finds host and path params, ignores ports", () => {
    expect(getUrlParamNames("https://:subd.example.com:8080/a/:id")).toEqual([
      "subd",
      "id",
    ]);
  });
});

describe("substituteUrlParams", () => {
  it("fills host and path", () => {
    expect(
      substituteUrlParams("https://:subd.matthiaz.dev/u/:id", {
        subd: "foo",
        id: "1",
      }),
    ).toBe("https://foo.matthiaz.dev/u/1");
  });
  it("refuses host values that could redirect elsewhere", () => {
    expect(
      substituteUrlParams("https://:subd.matthiaz.dev", { subd: "evil.com#" }),
    ).toBeNull();
    expect(
      substituteUrlParams("https://:subd.matthiaz.dev", { subd: "a@evil.com" }),
    ).toBeNull();
  });
});
