const reportId = crypto.randomUUID();
const response = await fetch("http://localhost:3000/handoff-errors", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    reportId,
    seller: { sellerId: "seller-42", assetId: "theme-forest", assetKind: "download" },
    buyerUpdate: { buyerId: "buyer-17", revision: 3 },
    order: { orderId: "order-9001", handoffStage: "asset_release" },
    exception: { name: "AssetReleaseError", message: "Signed package was not attached" },
  }),
});

console.log(JSON.stringify(await response.json(), null, 2));
