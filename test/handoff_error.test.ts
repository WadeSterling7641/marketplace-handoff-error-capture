import assert from "node:assert/strict";
import test from "node:test";
import { groupingFingerprint, handoffErrorSchema } from "../src/handoff_error.js";

test("buyer revisions for the same seller asset and stage join one error group", () => {
  const base = {
    reportId: "c3027e56-e167-4ae1-9387-755b5db9322c",
    seller: { sellerId: "seller-42", assetId: "theme-forest", assetKind: "download" as const },
    buyerUpdate: { buyerId: "buyer-17", revision: 1 },
    order: { orderId: "order-9001", handoffStage: "asset_release" as const },
    exception: { name: "AssetReleaseError", message: "Package missing" },
  };
  const laterUpdate = handoffErrorSchema.parse({
    ...base,
    reportId: "82804154-79da-4810-be8f-740157150084",
    buyerUpdate: { buyerId: "buyer-88", revision: 9 },
    order: { ...base.order, orderId: "order-9002" },
  });

  assert.deepEqual(groupingFingerprint(handoffErrorSchema.parse(base)), groupingFingerprint(laterUpdate));
  assert.deepEqual(groupingFingerprint(laterUpdate), [
    "marketplace-handoff",
    "seller-42",
    "theme-forest",
    "asset_release",
  ]);
});

test("handoff stage separates operationally different failures", () => {
  const input = handoffErrorSchema.parse({
    reportId: "c3027e56-e167-4ae1-9387-755b5db9322c",
    seller: { sellerId: "seller-42", assetId: "theme-forest", assetKind: "download" },
    buyerUpdate: { buyerId: "buyer-17", revision: 1 },
    order: { orderId: "order-9001", handoffStage: "asset_release" },
    exception: { name: "AssetReleaseError", message: "Package missing" },
  });
  const acknowledgement = handoffErrorSchema.parse({
    ...input,
    order: { ...input.order, handoffStage: "buyer_acknowledgement" },
  });

  assert.notDeepEqual(groupingFingerprint(input), groupingFingerprint(acknowledgement));
});
