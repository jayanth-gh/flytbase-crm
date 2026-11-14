require("dotenv").config();
const fs = require("fs");

const MCP_URL = "https://questathon.aihackerscollective.com/api/public/mcp";
const TOKEN = process.env.AQ_TOKEN?.trim();

async function fetchAccountsOnce() {
  if (!TOKEN) {
    throw new Error("AQ_TOKEN is missing or empty in your .env file.");
  }

  console.log("Sending single MCP request: get_my_accounts...");

  const response = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "accept": "application/json, text/event-stream",
      "authorization": `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "get_my_accounts",
        arguments: {},
      },
    }),
  });

  const rawText = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${rawText}`);
  }

  // Extract JSON payload whether the server replies with SSE ("data: ...") or plain JSON
  const sseLine = rawText.split(/\r?\n/).find((line) => line.startsWith("data: "));
  const rpcPayload = JSON.parse(sseLine ? sseLine.slice(6) : rawText);

  if (rpcPayload.error || rpcPayload.result?.isError) {
    const errMsg =
      rpcPayload.error?.message ||
      rpcPayload.result?.content?.[0]?.text ||
      "Unknown MCP tool error";
    throw new Error(errMsg);
  }

  const toolText = rpcPayload.result?.content?.[0]?.text;
  if (!toolText) {
    throw new Error("MCP response returned no content payload.");
  }

  const parsedData = JSON.parse(toolText);
  fs.writeFileSync("accounts.json", JSON.stringify(parsedData, null, 2), "utf8");

  console.log("Success! Saved output to accounts.json.");
  console.log("Top-level keys:", Object.keys(parsedData));
}

fetchAccountsOnce().catch((err) => {
  console.error("Step 1 failed:", err.message);
  process.exitCode = 1;
});