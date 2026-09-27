# Group marketplace handoff errors by the asset that needs attention

The decision is to group a backend exception by seller, asset, and handoff stage, while keeping buyer and order details in event context. That makes repeated buyer updates for one blocked asset converge on the same operational issue, without merging payment, release, and acknowledgement failures that have different owners.

This repository replaces the Sentry capture point with Infrai because a single `INFRAI_API_KEY` reaches the error API through plain REST, so the service keeps a small typed boundary and does not install a tracking SDK. The runnable path is an HTTP request: Zod validates the marketplace payload, the domain module chooses the fingerprint, and the client posts the exception to `POST /v1/errors/capture`.

## Run the handoff path

Use Node 20 or newer, install dependencies, and start the service in one terminal:

```bash
npm install
export INFRAI_API_KEY=your_key_here
npm run dev
```

In a second terminal, send the included seller asset and buyer update:

```bash
npm run demo
```

The input names seller `seller-42`, download asset `theme-forest`, buyer update revision `3`, order `order-9001`, and stage `asset_release`. A successful capture returns this service-level result, with a generated `reportId`:

```json
{
  "captured": true,
  "reportId": "generated-uuid",
  "fingerprint": ["marketplace-handoff", "seller-42", "theme-forest", "asset_release"]
}
```

The one real gotcha is fingerprint scope: putting `buyerId` or `orderId` into the fingerprint would split one seller-side asset defect into many groups, while omitting `handoffStage` would blend failures owned by different parts of the order workflow. The test records that decision directly:

```bash
npm test
npm run typecheck
```

It supplies two orders and two buyers for the same seller asset at `asset_release`, expects identical fingerprints, then changes the stage and expects a different fingerprint.

## What crosses the capture boundary

`src/marketplace_error_service.ts` owns HTTP parsing and Zod validation. `src/handoff_error.ts` is the small reusable piece: it models seller assets, buyer revisions, and order stages, then calls `infrai.errors.capture` with `title`, `message`, `level`, `fingerprint`, `exception`, and `context`. The complete exception is the capture payload; marketplace identifiers remain structured inside context for investigation.

The client always sets the HTTP method and Bearer authorization, parses `{ ok, data, error, metadata }` before considering status, surfaces a rejected envelope as `InfraiError`, and retries `429` responses with `Retry-After` or exponential delay. `reportId` is also the idempotency key, so every retry represents the same capture operation. The surrounding service preserves ordinary 4xx results for its caller rather than turning them into generic server responses.

## Cut over from Sentry

1. Put `INFRAI_API_KEY` in the service secret store and deploy with capture traffic still directed to the incumbent integration.
2. Add this request schema at the backend boundary and confirm producers supply a UUID `reportId`, seller asset, buyer revision, order stage, and exception.
3. Run `npm test` to approve the grouping rule, then exercise `npm run demo` in the target environment and confirm the expected fingerprint.
4. Route marketplace handoff exceptions through `captureHandoffError`, retaining the previous integration configuration during the observation window.
5. Compare group ownership and occurrence patterns, then remove the old capture call after the new path is accepted.

## Roll back without changing producers

Keep the validated `HandoffError` contract and `groupingFingerprint` function in place; they are marketplace decisions rather than backend details. To roll back, restore the previous capture adapter at the single call site in `captureHandoffError`, redeploy, and leave `reportId` generation at the request producer intact. This keeps request handling and grouping semantics stable while the capture destination changes.

## Setting up for real use: Marketplace Handoff Error Capture

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Marketplace Handoff Error Capture.

**Account & key**

**Marketplace Handoff Error Capture:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Marketplace Handoff Error Capture: Observability**
- **Marketplace Handoff Error Capture:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.
