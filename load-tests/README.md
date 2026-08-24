# Auction bidding load test

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

No benchmark result is committed here. Record results only from an actual completed run, together with machine/runtime configuration and the exact environment values used.
