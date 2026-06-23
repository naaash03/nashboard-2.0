import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_DB_URL = process.env.DATABASE_URL;

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  if (ORIGINAL_DB_URL === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = ORIGINAL_DB_URL;
  }
});

async function postRegister(body: unknown) {
  const mod = await import("@/app/api/auth/register/route");
  return mod.POST(new Request("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }));
}

describe("POST /api/auth/register", () => {
  it("returns 503 when the database is not configured", async () => {
    delete process.env.DATABASE_URL;
    const res = await postRegister({ email: "a@b.com", password: "longenough" });
    expect(res.status).toBe(503);
  });

  it("rejects an invalid email before touching the database", async () => {
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/db";
    const res = await postRegister({ email: "not-an-email", password: "longenough" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/valid email/i);
  });

  it("rejects a short password", async () => {
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/db";
    const res = await postRegister({ email: "a@b.com", password: "short" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/8 characters/i);
  });
});
