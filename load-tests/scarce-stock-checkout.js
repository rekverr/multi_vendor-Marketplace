import http from "k6/http";
import { check, fail, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";

const baseUrl = (__ENV.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const productId = __ENV.PRODUCT_ID || "";
const purchasers = integerEnv("PURCHASERS", 5, 2);
const initialStock = integerEnv("INITIAL_STOCK", 1, 1);
const p95LimitMs = integerEnv("P95_LIMIT_MS", 5000, 1);
const password = __ENV.CUSTOMER_PASSWORD || "load-test-password-123";
const runId = (__ENV.RUN_ID || `${Date.now()}`).replace(/[^a-zA-Z0-9-]/g, "");

if (purchasers <= initialStock) {
  fail("PURCHASERS must be greater than INITIAL_STOCK");
}

const checkoutRequests = new Counter("checkout_requests");
const checkoutSuccesses = new Counter("checkout_successes");
const expectedRejections = new Counter("checkout_expected_rejections");
const unexpectedErrors = new Counter("checkout_unexpected_errors");
const oversells = new Counter("checkout_oversells");
const finalCorrectness = new Counter("checkout_final_correctness");
const checkoutDuration = new Trend("checkout_duration", true);

export const options = {
  scenarios: {
    concurrent_scarce_stock_checkout: {
      executor: "per-vu-iterations",
      vus: purchasers,
      iterations: 1,
      maxDuration: "30s",
    },
  },
  thresholds: {
    checkout_requests: [`count==${purchasers}`],
    checkout_successes: [`count==${initialStock}`],
    checkout_expected_rejections: [
      `count==${purchasers - initialStock}`,
    ],
    checkout_unexpected_errors: ["count==0"],
    checkout_oversells: ["count==0"],
    checkout_final_correctness: ["count==1"],
    checkout_duration: [`p(95)<${p95LimitMs}`],
  },
};

export function setup() {
  if (!productId) fail("PRODUCT_ID is required");
  unexpectedErrors.add(0);
  oversells.add(0);

  const tokens = [];
  for (let index = 0; index < purchasers; index += 1) {
    const email = `k6-checkout-${runId}-${index}@example.test`;
    const registration = http.post(
      `${baseUrl}/auth/register`,
      JSON.stringify({ email, password }),
      jsonParams("setup"),
    );
    if (registration.status !== 201) {
      fail(
        `Customer registration failed with HTTP ${registration.status}; use a fresh RUN_ID`,
      );
    }

    const login = http.post(
      `${baseUrl}/auth/login`,
      JSON.stringify({ email, password }),
      jsonParams("setup"),
    );
    if (login.status !== 200) {
      fail(
        `Customer login failed with HTTP ${login.status}; ensure RATE_LIMIT_LOGIN_MAX is at least PURCHASERS`,
      );
    }
    const token = login.json("accessToken");
    if (typeof token !== "string" || token.length === 0) {
      fail("Login response did not contain an access token");
    }

    const cart = http.post(
      `${baseUrl}/cart/items`,
      JSON.stringify({ productId, quantity: 1 }),
      authenticatedParams(token, "setup"),
    );
    if (cart.status !== 201) {
      fail(`Adding Product to Cart failed with HTTP ${cart.status}`);
    }
    const authoritativeStock = cart.json("items.0.product.stock");
    if (authoritativeStock !== initialStock) {
      fail(
        `Product stock must be exactly INITIAL_STOCK=${initialStock}, received ${authoritativeStock}`,
      );
    }
    tokens.push(token);
  }

  return { tokens, startAt: Date.now() + 2000 };
}

export default function (data) {
  const waitMs = data.startAt - Date.now();
  if (waitMs > 0) sleep(waitMs / 1000);

  const response = http.post(
    `${baseUrl}/checkout`,
    JSON.stringify({ requestContext: `k6-scarce-stock-${runId}` }),
    {
      headers: {
        Authorization: `Bearer ${data.tokens[__VU - 1]}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `k6-checkout-${runId}-${__VU}`,
        "X-Correlation-Id": correlationId(runId, __VU),
      },
      tags: { phase: "checkout" },
    },
  );

  checkoutRequests.add(1);
  checkoutDuration.add(response.timings.duration);
  if (response.status === 201) {
    checkoutSuccesses.add(1);
  } else if (response.status === 409) {
    expectedRejections.add(1);
  } else {
    unexpectedErrors.add(1);
  }

  check(response, {
    "checkout returned a business-classified status": (result) =>
      result.status === 201 || result.status === 409,
  });
}

export function teardown(data) {
  const finalStock = findAuthoritativeStock(data.tokens);
  const oversold = typeof finalStock === "number" && finalStock < 0;
  const correct = finalStock === 0;

  if (oversold) oversells.add(1);
  finalCorrectness.add(correct ? 1 : 0);
  if (!correct) unexpectedErrors.add(1);

  console.log(
    JSON.stringify({
      finalCorrectness: correct,
      expected: { stock: 0, oversellCount: 0 },
      actual: { stock: finalStock, oversellCount: oversold ? 1 : 0 },
    }),
  );
}

export function handleSummary(data) {
  const report = {
    measuredAt: new Date().toISOString(),
    configuration: {
      baseUrl,
      productId,
      purchasers,
      initialStock,
      p95LimitMs,
    },
    measurements: {
      rps: metricValue(data, "checkout_requests", "rate"),
      p95LatencyMs: metricValue(data, "checkout_duration", "p(95)"),
      successCount: metricValue(data, "checkout_successes", "count"),
      expectedBusinessRejectionCount: metricValue(
        data,
        "checkout_expected_rejections",
        "count",
      ),
      unexpectedErrorCount: metricValue(
        data,
        "checkout_unexpected_errors",
        "count",
      ),
      oversellCount: metricValue(data, "checkout_oversells", "count"),
      finalCorrectnessCount: metricValue(
        data,
        "checkout_final_correctness",
        "count",
      ),
    },
  };
  const output = `${JSON.stringify(report, null, 2)}\n`;
  const destination = __ENV.SUMMARY_PATH;
  return destination
    ? { stdout: output, [destination]: output }
    : { stdout: output };
}

function findAuthoritativeStock(tokens) {
  for (const token of tokens) {
    const response = http.get(
      `${baseUrl}/cart`,
      authenticatedParams(token, "verification"),
    );
    if (response.status !== 200) continue;
    const items = response.json("items");
    if (!Array.isArray(items)) continue;
    const item = items.find((candidate) => candidate.product?.id === productId);
    if (typeof item?.product?.stock === "number") return item.product.stock;
  }
  return null;
}

function authenticatedParams(token, phase) {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    tags: { phase },
  };
}

function jsonParams(phase) {
  return {
    headers: { "Content-Type": "application/json" },
    tags: { phase },
  };
}

function integerEnv(name, fallback, minimum) {
  const value = Number.parseInt(__ENV[name] || `${fallback}`, 10);
  if (!Number.isInteger(value) || value < minimum) {
    fail(`${name} must be an integer greater than or equal to ${minimum}`);
  }
  return value;
}

function correlationId(value, vu) {
  const suffix = `${value}${vu}`
    .replace(/\D/g, "")
    .slice(-12)
    .padStart(12, "0");
  return `00000000-0000-4000-8000-${suffix}`;
}

function metricValue(summary, metricName, valueName) {
  return summary.metrics[metricName]?.values?.[valueName] ?? null;
}
