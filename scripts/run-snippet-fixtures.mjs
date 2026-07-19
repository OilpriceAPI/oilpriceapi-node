#!/usr/bin/env node
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
let scenario = "success";

const server = createServer((request, response) => {
  if (scenario === "timeout") {
    setTimeout(() => {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end("{}");
    }, 100);
    return;
  }

  const statuses = { authentication: 401, entitlement: 403, rateLimit: 429 };
  const status = statuses[scenario] ?? 200;
  if (status !== 200) {
    response.writeHead(status, {
      "Content-Type": "application/json",
      ...(status === 429 ? { "Retry-After": "0" } : {}),
    });
    response.end(JSON.stringify({ error: scenario }));
    return;
  }

  const historical = request.url?.startsWith("/v1/prices/past_year");
  const price = {
    code: "BRENT_CRUDE_USD",
    price: 72.5,
    formatted: "$72.50",
    currency: "USD",
    created_at: "2026-01-15T12:00:00Z",
    type: "spot_price",
    source: "fixture",
  };
  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(
    JSON.stringify({
      status: "success",
      data: historical ? { prices: [price] } : price,
    }),
  );
});

function runSnippet(file, nextScenario, expected) {
  scenario = nextScenario;
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(resolve(root, "node_modules/.bin/tsx"), [resolve(root, file)], {
      cwd: root,
      env: {
        ...process.env,
        OILPRICEAPI_KEY: "fixture-key",
        OILPRICEAPI_BASE_URL: `http://127.0.0.1:${server.address().port}`,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (code !== 0) {
        rejectPromise(new Error(`${file} exited ${code}: ${stderr}`));
        return;
      }
      const result = JSON.parse(stdout.trim());
      for (const [key, value] of Object.entries(expected)) {
        if (result[key] !== value) {
          rejectPromise(new Error(`${file} expected ${key}=${value}, got ${result[key]}`));
          return;
        }
      }
      resolvePromise();
    });
  });
}

await new Promise((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise));
try {
  await runSnippet("examples/snippets/latest-price.ts", "success", {
    commodity: "BRENT_CRUDE_USD",
    valueType: "number",
  });
  await runSnippet("examples/snippets/history.ts", "success", {
    commodity: "BRENT_CRUDE_USD",
    count: 1,
  });
  await runSnippet("examples/snippets/authentication-error.ts", "authentication", {
    handled: true,
    statusCode: 401,
  });
  await runSnippet("examples/snippets/entitlement-error.ts", "entitlement", {
    handled: true,
    statusCode: 403,
  });
  await runSnippet("examples/snippets/rate-limit-error.ts", "rateLimit", {
    handled: true,
    statusCode: 429,
  });
  await runSnippet("examples/snippets/timeout-error.ts", "timeout", {
    handled: true,
    errorType: "TimeoutError",
  });
  console.log("Executable snippet fixtures passed (6/6)");
} finally {
  await new Promise((resolvePromise) => server.close(resolvePromise));
}
