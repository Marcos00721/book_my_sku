import { expect, test } from "@playwright/test";

test("protected API methods send the token, correct HTTP verb and payload", async ({
  page,
}) => {
  const calls = [];
  await page.route("**/api/v1/helper-*", async (route) => {
    const request = route.request();
    calls.push({
      method: request.method(),
      body: request.postDataJSON(),
      headers: request.headers(),
      url: request.url(),
    });
    await route.fulfill({ json: { data: { method: request.method() } } });
  });
  await page.goto("/login");
  const responses = await page.evaluate(async () => {
    const { api, setAccessTokenProvider } =
      await import("/src/services/api.js");
    setAccessTokenProvider(async () => "test-access-token");
    return Promise.all([
      api.get("/helper-get?search=A%26B"),
      api.post(
        "/helper-post",
        { name: "Alex" },
        { idempotencyKey: "test-operation" },
      ),
      api.put("/helper-put", { name: "Morgan" }),
      api.patch("/helper-patch", { active: true }),
      api.delete("/helper-delete", { expectedRevision: 1 }),
    ]);
  });
  expect(responses.map((response) => response.data.method)).toEqual([
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
  ]);
  expect(calls.find((call) => call.method === "GET").body).toBeNull();
  expect(calls.find((call) => call.method === "POST").body).toEqual({
    name: "Alex",
  });
  expect(calls.find((call) => call.method === "PUT").body).toEqual({
    name: "Morgan",
  });
  expect(calls.find((call) => call.method === "PATCH").body).toEqual({
    active: true,
  });
  expect(calls.find((call) => call.method === "DELETE").body).toEqual({
    expectedRevision: 1,
  });
  expect(
    calls.every(
      (call) => call.headers.authorization === "Bearer test-access-token",
    ),
  ).toBeTruthy();
  expect(
    calls.find((call) => call.method === "POST").headers["idempotency-key"],
  ).toBe("test-operation");
});

test("all headerless methods ignore tokens and omit Authorization", async ({
  page,
}) => {
  const calls = [];
  await page.route("**/api/v1/helper-*", async (route) => {
    const request = route.request();
    calls.push({
      method: request.method(),
      body: request.postDataJSON(),
      headers: request.headers(),
    });
    await route.fulfill({ json: { data: { method: request.method() } } });
  });
  await page.goto("/login");
  const result = await page.evaluate(async () => {
    const { headerlessApi, setAccessTokenProvider } =
      await import("/src/services/api.js");
    let tokenReads = 0;
    setAccessTokenProvider(() => {
      tokenReads++;
      throw new Error("Public calls must not read the token");
    });
    const options = { headers: { Authorization: "Bearer unwanted-token" } };
    const responses = await Promise.all([
      headerlessApi.get("/helper-get", options),
      headerlessApi.post("/helper-post", { name: "Alex" }, options),
      headerlessApi.put("/helper-put", { name: "Morgan" }, options),
      headerlessApi.patch("/helper-patch", { active: true }, options),
      headerlessApi.delete("/helper-delete", { expectedRevision: 1 }, options),
    ]);
    return {
      tokenReads,
      methods: responses.map((response) => response.data.method),
    };
  });
  expect(result).toEqual({
    tokenReads: 0,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  });
  expect(calls).toHaveLength(5);
  expect(calls.every((call) => !call.headers.authorization)).toBeTruthy();
  expect(calls.find((call) => call.method === "GET").body).toBeNull();
  expect(calls.find((call) => call.method === "POST").body).toEqual({
    name: "Alex",
  });
  expect(calls.find((call) => call.method === "PUT").body).toEqual({
    name: "Morgan",
  });
  expect(calls.find((call) => call.method === "PATCH").body).toEqual({
    active: true,
  });
  expect(calls.find((call) => call.method === "DELETE").body).toEqual({
    expectedRevision: 1,
  });
});

test("protected methods require a token before making a request", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**/api/v1/helper-*", (route) => {
    requests++;
    return route.fulfill({ json: {} });
  });
  await page.goto("/login");
  const codes = await page.evaluate(async () => {
    const { api } = await import("/src/services/api.js");
    return Promise.all(
      ["get", "post", "put", "patch", "delete"].map(async (method) => {
        try {
          await api[method]("/helper-protected");
        } catch (error) {
          return error.code;
        }
      }),
    );
  });
  expect(codes).toEqual(Array(5).fill("UNAUTHENTICATED"));
  expect(requests).toBe(0);
});

test("API methods preserve safe server errors and handle empty responses", async ({
  page,
}) => {
  await page.route("**/api/v1/helper-error", (route) =>
    route.fulfill({
      status: 429,
      headers: { "Retry-After": "5", "X-Request-Id": "api-reference" },
      json: { error: { code: "RATE_LIMITED", message: "Please wait." } },
    }),
  );
  await page.route("**/api/v1/helper-empty", (route) =>
    route.fulfill({ status: 204 }),
  );
  await page.goto("/login");
  const result = await page.evaluate(async () => {
    const { headerlessApi } = await import("/src/services/api.js");
    let failure;
    try {
      await headerlessApi.get("/helper-error");
    } catch (error) {
      failure = {
        status: error.status,
        code: error.code,
        requestId: error.requestId,
        retryAfterMs: error.retryAfterMs,
      };
    }
    return { failure, empty: await headerlessApi.delete("/helper-empty") };
  });
  expect(result.failure).toEqual({
    status: 429,
    code: "RATE_LIMITED",
    requestId: "api-reference",
    retryAfterMs: 5000,
  });
  expect(result.empty).toBeNull();
});
