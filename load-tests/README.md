# Marketplace concurrency load tests

## Auction bidding

This k6 scenario sends the same valid bid from many independent authenticated Customers to one fresh Auction at the same time. PostgreSQL locking must produce exactly one accepted bid and reject every competing equal bid without losing or duplicating the authoritative highest bid.

## Prerequisites

- PostgreSQL and the backend are running.
- [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/) is installed and available as `k6`.
- Prepare one published Auction Product with stock `1` and an Auction that:
  - has already started;
  - remains open for at least 30 seconds;
  - has no existing bids;
  - is `SCHEDULED` or `ACTIVE`;
  - has a starting price no greater than `BID_AMOUNT`.

The Auction can be prepared through the existing Seller Product and Auction APIs or Swagger at `http://localhost:3000/docs`. Use disposable local test data. The script creates one Customer account per VU; use a new `RUN_ID` when rerunning against the same database.

## Run

From the repository root:

```bash
BASE_URL=http://localhost:3000 \
AUCTION_ID=00000000-0000-4000-8000-000000000001 \
BID_AMOUNT=100.00 \
BIDDERS=20 \
RUN_ID=local-001 \
k6 run load-tests/auction-bidding.js
```

Optional configuration:

- `BIDDER_PASSWORD`: generated Customer password; defaults to a safe local test value.
- `P95_LIMIT_MS`: bid-only p95 threshold in milliseconds; defaults to `5000`.
- `SUMMARY_PATH`: writes the measured JSON summary to the specified path in addition to stdout.

Do not point this script at production. It creates users, bids and Outbox events.

## Expected result

For `BIDDERS=N`, thresholds require:

- exactly `N` bid requests;
- exactly one HTTP `201` success;
- exactly `N - 1` expected HTTP `409` business rejections;
- zero unexpected statuses or verification failures;
- bid-request p95 below `P95_LIMIT_MS`;
- exactly one final correctness success.

The teardown fetches `GET /auctions/:id` from the authoritative API and verifies:

- `bidCount` is `1`;
- Auction `version` increased by exactly `1`;
- `currentHighestBid.amount` equals `BID_AMOUNT`.

The JSON summary reports measured bid RPS, bid-only p95 latency, success count, expected rejection count, unexpected error count and final correctness count. Setup registration/login and final verification requests are tagged separately and excluded from the custom bid latency/RPS metrics.

## Recorded local result

Measured at `2026-08-24T11:00:27.103Z` using:

- host: macOS `15.6.1`, Darwin arm64;
- k6: `v2.2.0`, darwin/arm64;
- backend: local Docker Compose service at `http://localhost:3000`;
- scenario: `20` concurrent VUs, one bid attempt per VU;
- bid amount: `1000.00`;
- run identity: `local-005`;
- p95 threshold: `5000 ms`.

This is an actual captured run, not a placeholder date. The timestamp was emitted automatically by `handleSummary` through `new Date().toISOString()`, so it is UTC (`Z`); it corresponds to `2026-08-24 14:00:27 EEST` on the test machine. The captured machine-readable summary is stored at [`results/auction-bidding-local-005.json`](./results/auction-bidding-local-005.json). The Auction UUID in that file identifies disposable local test data and is not a reusable fixture.

Measured output:

- bid RPS: `5.765945289251529`;
- bid-request p95 latency: `109.40969999999999 ms`;
- accepted bids: `1`;
- expected HTTP `409` business rejections: `19`;
- unexpected errors: `0`;
- final correctness successes: `1`.

The run completed all `20/20` iterations with no interruption. Authoritative verification reported `bidCount = 1`, Auction `version = 1`, and highest bid `1000.00`, so the concurrent equal-bid invariant held.

## Scarce-stock checkout

This scenario places one unit of the same fixed-price Product in multiple independent Customer carts, then starts all checkout requests together. PostgreSQL must allow exactly the available number of purchases and reject every competing request without negative stock.

Prepare a disposable published `FIXED_PRICE` Product whose stock is exactly `INITIAL_STOCK`. `PURCHASERS` must be greater than `INITIAL_STOCK`; stock `1` with `5` purchasers is the default and recommended case. Use a new `RUN_ID` for every execution because the script intentionally creates Customers and Orders and consumes the Product stock.

The setup logs in once per purchaser. For larger runs, configure the local backend with `RATE_LIMIT_LOGIN_MAX` at least equal to `PURCHASERS`; do not weaken production rate limits for a public environment.

From the repository root:

```bash
BASE_URL=http://localhost:3000 \
PRODUCT_ID=00000000-0000-4000-8000-000000000002 \
INITIAL_STOCK=1 \
PURCHASERS=5 \
RUN_ID=checkout-local-001 \
k6 run load-tests/scarce-stock-checkout.js
```

Optional configuration:

- `CUSTOMER_PASSWORD`: generated Customer password; defaults to a safe local test value.
- `P95_LIMIT_MS`: checkout-only p95 threshold in milliseconds; defaults to `5000`.
- `SUMMARY_PATH`: writes the measured JSON summary to the specified path in addition to stdout.

For `PURCHASERS=N` and `INITIAL_STOCK=S`, thresholds require exactly `S` HTTP `201` responses, exactly `N - S` expected HTTP `409` conflicts, zero unexpected responses, zero oversells, final authoritative stock `0`, and checkout-request p95 below `P95_LIMIT_MS`.

Final stock is read through an authenticated failed Customer Cart, which is backed by PostgreSQL. The verification intentionally does not use public Product detail because Redis catalog data may be eventually consistent. Setup and verification traffic is excluded from custom checkout RPS and latency metrics.

No checkout benchmark result is recorded here until this scenario is executed against prepared disposable data. Do not infer or fabricate values from the configured thresholds.
