import { createServer, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import { captureHandoffError, handoffErrorSchema } from "./handoff_error.js";
import { InfraiError } from "./infrai_errors.js";

function reply(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/handoff-errors") {
    reply(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const input = handoffErrorSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    reply(response, 202, await captureHandoffError(input));
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      reply(response, 400, { error: "Invalid handoff error request" });
      return;
    }
    if (error instanceof InfraiError && error.status >= 400 && error.status < 500) {
      reply(response, error.status, { error: error.code, message: error.message });
      return;
    }
    console.error(error);
    reply(response, 502, { error: "Error capture transport failed" });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Marketplace error service listening on http://localhost:${port}`));
