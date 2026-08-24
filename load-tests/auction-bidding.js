import http from "k6/http";
import { check, fail, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";

const baseUrl = (__ENV.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const auctionId = __ENV.AUCTION_ID || "";
const bidAmount = normalizeMoney(__ENV.BID_AMOUNT || "100.00");
const bidders = integerEnv("BIDDERS", 20, 2);
const p95LimitMs = integerEnv("P95_LIMIT_MS", 5000, 1);
const password = __ENV.BIDDER_PASSWORD || "load-test-password-123";
const runId = (__ENV.RUN_ID || `${Date.now()}`).replace(/[^a-zA-Z0-9-]/g, "");

const bidRequests = new Counter("auction_bid_requests");
const bidSuccesses = new Counter("auction_bid_successes");
const expectedRejections = new Counter("auction_bid_expected_rejections");
const unexpectedErrors = new Counter("auction_bid_unexpected_errors");
const finalCorrectness = new Counter("auction_final_correctness");
const bidDuration = new Trend("auction_bid_duration", true);

export const options = {
  scenarios: {
    concurrent_equal_bids: {
      executor: "per-vu-iterations",
      vus: bidders,
      iterations: 1,
      maxDuration: "30s",
    },
  },
  thresholds: {
    auction_bid_requests: [`count==${bidders}`],
    auction_bid_successes: ["count==1"],
    auction_bid_expected_rejections: [`count==${bidders - 1}`],
    auction_bid_unexpected_errors: ["count==0"],
    auction_final_correctness: ["count==1"],
    auction_bid_duration: [`p(95)<${p95LimitMs}`],
  },
};

export function setup() {
  if (!auctionId) fail("AUCTION_ID is required");
  unexpectedErrors.add(0);

  const initial = getAuction();
  if (initial.status !== "ACTIVE" && initial.status !== "SCHEDULED") {
    fail(`Auction must be active or scheduled, received ${initial.status}`);
  }
  if (initial.bidCount !== 0 || initial.currentHighestBid !== null) {
    fail("Auction must have no existing bids");
  }
  if (Date.parse(initial.startsAt) > Date.now()) {
    fail("Auction has not started");
  }
  if (Date.parse(initial.endsAt) <= Date.now() + 30000) {
    fail("Auction must remain open for at least 30 seconds");
  }
  if (moneyToCents(bidAmount) < moneyToCents(initial.startingPrice)) {
    fail(`BID_AMOUNT must be at least ${initial.startingPrice}`);
  }

  const tokens = [];
  for (let index = 0; index < bidders; index += 1) {
    const email = `k6-auction-${runId}-${index}@example.test`;
    const registration = http.post(
      `${baseUrl}/auth/register`,
      JSON.stringify({ email, password }),
      jsonParams("setup"),
    );
    if (registration.status !== 201 && registration.status !== 409) {
      fail(`Bidder registration failed with HTTP ${registration.status}`);
    }
    const login = http.post(
      `${baseUrl}/auth/login`,
      JSON.stringify({ email, password }),
      jsonParams("setup"),
    );
    if (login.status !== 200) {
      fail(`Bidder login failed with HTTP ${login.status}`);
    }
    const token = login.json("accessToken");
    if (typeof token !== "string" || token.length === 0) {
      fail("Login response did not contain an access token");
    }
    tokens.push(token);
  }

  return {
    tokens,
    initialVersion: initial.version,
    startAt: Date.now() + 2000,
  };
}

export default function (data) {
  const waitMs = data.startAt - Date.now();
  if (waitMs > 0) sleep(waitMs / 1000);

  const response = http.post(
    `${baseUrl}/auctions/${auctionId}/bids`,
    JSON.stringify({ amount: bidAmount }),
    {
      headers: {
        Authorization: `Bearer ${data.tokens[__VU - 1]}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `k6-${runId}-${__VU}`,
        "X-Correlation-Id": correlationId(runId, __VU),
      },
      tags: { phase: "bid" },
    },
  );

  bidRequests.add(1);
  bidDuration.add(response.timings.duration);
  if (response.status === 201) {
    bidSuccesses.add(1);
  } else if (response.status === 409) {
    expectedRejections.add(1);
  } else {
    unexpectedErrors.add(1);
  }

  check(response, {
    "bid returned a business-classified status": (result) =>
      result.status === 201 || result.status === 409,
  });
}

export function teardown(data) {
  const finalState = getAuction();
  const finalAmount = finalState.currentHighestBid?.amount;
  const correct =
    finalState.bidCount === 1 &&
    finalState.version === data.initialVersion + 1 &&
    typeof finalAmount === "string" &&
    normalizeMoney(finalAmount) === bidAmount;

  finalCorrectness.add(correct ? 1 : 0);
  if (!correct) unexpectedErrors.add(1);

  console.log(
    JSON.stringify({
      finalCorrectness: correct,
      expected: {
        bidCount: 1,
        version: data.initialVersion + 1,
        highestBid: bidAmount,
      },
      actual: {
        bidCount: finalState.bidCount,
        version: finalState.version,
        highestBid: finalState.currentHighestBid?.amount ?? null,
      },
    }),
  );
}

export function handleSummary(data) {
  const report = {
    measuredAt: new Date().toISOString(),
    configuration: {
      baseUrl,
      auctionId,
      bidders,
      bidAmount,
      p95LimitMs,
    },
    measurements: {
      rps: metricValue(data, "auction_bid_requests", "rate"),
      p95LatencyMs: metricValue(data, "auction_bid_duration", "p(95)"),
      successCount: metricValue(data, "auction_bid_successes", "count"),
      expectedBusinessRejectionCount: metricValue(
        data,
        "auction_bid_expected_rejections",
        "count",
      ),
      unexpectedErrorCount: metricValue(
        data,
        "auction_bid_unexpected_errors",
        "count",
      ),
      finalCorrectnessCount: metricValue(
        data,
        "auction_final_correctness",
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

function getAuction() {
  const response = http.get(`${baseUrl}/auctions/${auctionId}`, {
    tags: { phase: "verification" },
  });
  if (response.status !== 200) {
    fail(`Auction lookup failed with HTTP ${response.status}`);
  }
  return response.json();
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

function moneyToCents(value) {
  const normalized = normalizeMoney(value);
  const [whole, fraction] = normalized.split(".");
  return Number.parseInt(whole, 10) * 100 + Number.parseInt(fraction, 10);
}

function normalizeMoney(value) {
  if (typeof value !== "string" || !/^\d+(?:\.\d{1,2})?$/.test(value)) {
    fail(`Invalid money value: ${value}`);
  }
  const [whole, fraction = ""] = value.split(".");
  return `${whole}.${fraction.padEnd(2, "0")}`;
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
