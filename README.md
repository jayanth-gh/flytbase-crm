# FlytBase CRM

A lightweight account-intelligence dashboard for FlytBase customer teams. The Express server serves a responsive browser UI, reads cached CRM data, and refreshes it from the MCP service on a rate-limited schedule.

## Features

- Account views for deal value, stakeholders and relationships, fleet telemetry, and active risks.
- Briefings with backed and unbacked opportunities, three priority moves, risks, and open information gaps.
- Clickable `src:` tags that open the evidence behind account insights.
- A note form that queues account actions and risks for MCP.
- Persistent local cache in `data/store.json`.

## Requirements

- Node.js 18 or newer.
- An MCP access token (`AQ_TOKEN`) for live data and note writes.

## Run locally

1. Install dependencies:

   ```sh
   npm install
   ```

2. Create a `.env` file in the project root:

   ```env
   AQ_TOKEN=your_mcp_access_token
   ```

3. Start the server:

   ```sh
   node server.js
   ```

4. Open [http://localhost:3000](http://localhost:3000/).

Set `PORT` to use a different local port. Without a valid `AQ_TOKEN`, the page can load, but live MCP updates and note writes will not work.

## API

- `GET /api/crm` — returns the current dashboard state and cached data.
- `POST /api/notes` — queues a note. Send JSON with `account`, `kind`, `title`, and `text`.

MCP calls are spaced at least 65 seconds apart. Notes and newly received live signals wait in the queue for an available call slot.

## Data and privacy

The local cache may contain customer and account information. Keep `data/store.json`, account exports, inspection output, and `.env` private; do not commit or share them.

## Project layout

```text
public/index.html     Dashboard UI
server.js             Express API, cache, and MCP scheduler
fetch_accounts.js     One-time account export helper
fetch_details.js      Fetches account details into the local cache
data/store.json       Runtime data cache
package.json          Dependencies and project settings
```
