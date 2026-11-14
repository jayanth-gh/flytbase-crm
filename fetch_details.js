require("dotenv").config();
const fs = require("fs");
const path = require("path");

const MCP_URL = "https://questathon.aihackerscollective.com/api/public/mcp";
const TOKEN = process.env.AQ_TOKEN?.trim();
const COOLDOWN_MS = 65_000; // Strict >60s spacing for 1 call/minute MCP limit
const DATA_DIR = path.join(__dirname, "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function callMcpTool(name, args = {}) {
  const response = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "accept": "application/json, text/event-stream",
      "authorization": `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });

  const rawText = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${rawText}`);
  }

  const sseLine = rawText.split(/\r?\n/).find((line) => line.startsWith("data: "));
  const rpcPayload = JSON.parse(sseLine ? sseLine.slice(6) : rawText);

  if (rpcPayload.error || rpcPayload.result?.isError) {
    throw new Error(
      rpcPayload.error?.message ||
      rpcPayload.result?.content?.[0]?.text ||
      "Unknown MCP tool error"
    );
  }

  const contentText = rpcPayload.result?.content?.[0]?.text ?? "{}";
  try {
    return JSON.parse(contentText);
  } catch {
    return { rawText: contentText };
  }
}

async function run() {
  if (!TOKEN) {
    throw new Error("AQ_TOKEN is missing from .env.");
  }
  if (!fs.existsSync("accounts.json")) {
    throw new Error("accounts.json not found. Run fetch_accounts.js first.");
  }

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const accountsExport = JSON.parse(fs.readFileSync("accounts.json", "utf8"));

  let store = {
    updatedAt: new Date().toISOString(),
    accountsExport,
    paperwork: {},
    files: {},
    flytbaseTeam: null,
    featureRequests: null,
    releaseNotes: null,
    notes: [],
    signals: [],
  };

  if (fs.existsSync(STORE_PATH)) {
    const existing = JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
    store = { ...store, ...existing, accountsExport };
  }

  const saveStore = () => {
    store.updatedAt = new Date().toISOString();
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
  };
  saveStore();

  const tasks = [];

  // 1. Fetch paperwork for each account ("A" and "B")
  for (const acc of accountsExport.accounts || []) {
    if (acc.id && !store.paperwork[acc.id]) {
      tasks.push({
        label: `get_all_paperwork (account: "${acc.id}" - ${acc.name})`,
        execute: async () => {
          store.paperwork[acc.id] = await callMcpTool("get_all_paperwork", {
            account: acc.id,
          });
        },
      });
    }
  }

  // 2. Fetch each file listed in top-level accountsExport.files
  for (const fileMeta of accountsExport.files || []) {
    if (fileMeta.id && !store.files[fileMeta.id]) {
      tasks.push({
        label: `get_file (id: "${fileMeta.id}")`,
        execute: async () => {
          store.files[fileMeta.id] = await callMcpTool("get_file", {
            id: fileMeta.id,
          });
        },
      });
    }
  }

  // 3. Fetch global FlytBase context & existing notes once
  if (!store.flytbaseTeam) {
    tasks.push({
      label: "get_flytbase_team",
      execute: async () => {
        store.flytbaseTeam = await callMcpTool("get_flytbase_team");
      },
    });
  }

  if (!store.featureRequests) {
    tasks.push({
      label: "get_feature_requests",
      execute: async () => {
        store.featureRequests = await callMcpTool("get_feature_requests");
      },
    });
  }

  if (!store.releaseNotes) {
    tasks.push({
      label: "get_release_notes",
      execute: async () => {
        store.releaseNotes = await callMcpTool("get_release_notes");
      },
    });
  }

  if (!Array.isArray(store.notes) || store.notes.length === 0) {
    tasks.push({
      label: "list_notes",
      execute: async () => {
        const res = await callMcpTool("list_notes");
        store.notes = Array.isArray(res) ? res : res.notes || [];
      },
    });
  }

  if (tasks.length === 0) {
    console.log("Nothing left to fetch—all static datasets are already in data/store.json.");
    return;
  }

  console.log(`Starting ${tasks.length} one-time MCP calls (~${tasks.length} minutes total)...`);

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    console.log(`[${i + 1}/${tasks.length}] Waiting 65s before ${task.label}...`);
    await sleep(COOLDOWN_MS);

    console.log(`[${i + 1}/${tasks.length}] Calling ${task.label}...`);
    await task.execute();
    saveStore();
    console.log(`[${i + 1}/${tasks.length}] Saved to data/store.json.`);
  }

  console.log("Step 2 complete! All static records are cached in data/store.json.");
}

run().catch((err) => {
  console.error("Step 2 failed:", err.message);
  process.exitCode = 1;
});