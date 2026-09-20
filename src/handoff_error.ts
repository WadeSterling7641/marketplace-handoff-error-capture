import { z } from "zod";
import { infrai } from "./infrai_errors.js";

export const handoffErrorSchema = z.object({
  reportId: z.string().uuid(),
  seller: z.object({
    sellerId: z.string().min(1),
    assetId: z.string().min(1),
    assetKind: z.enum(["license", "download", "service"]),
  }),
  buyerUpdate: z.object({
    buyerId: z.string().min(1),
    revision: z.number().int().nonnegative(),
  }),
  order: z.object({
    orderId: z.string().min(1),
    handoffStage: z.enum(["payment_confirmed", "asset_release", "buyer_acknowledgement"]),
  }),
  exception: z.object({
    name: z.string().min(1),
    message: z.string().min(1),
    stack: z.string().optional(),
  }),
});

export type HandoffError = z.infer<typeof handoffErrorSchema>;

export function groupingFingerprint(input: HandoffError): string[] {
  return [
    "marketplace-handoff",
    input.seller.sellerId,
    input.seller.assetId,
    input.order.handoffStage,
  ];
}

export async function captureHandoffError(input: HandoffError) {
  const fingerprint = groupingFingerprint(input);
  const exception = input.exception.stack
    ? `${input.exception.name}: ${input.exception.message}\n${input.exception.stack}`
    : `${input.exception.name}: ${input.exception.message}`;

  await infrai.errors.capture(
    {
      title: `Order handoff failed at ${input.order.handoffStage}`,
      message: input.exception.message,
      level: "error",
      fingerprint,
      exception,
      context: {
        reportId: input.reportId,
        seller: input.seller,
        buyerUpdate: input.buyerUpdate,
        order: input.order,
      },
    },
    input.reportId,
  );

  return { captured: true as const, reportId: input.reportId, fingerprint };
}
