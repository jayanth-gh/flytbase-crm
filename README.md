# Account CRM

An account dashboard for the FlytBase CRM simulation. It summarizes each account's backed and unbacked deal value, key stakeholders and relationships, three priority moves, risks, and open information gaps. Click a `src:` tag to inspect the supporting source data.

## How it works

- The Express server fetches account, paperwork, file, note, and live signal data from the MCP service.
- Data is cached in `data/store.json` and served to the page through `GET /api/crm`.
- MCP calls are scheduled at least 65 seconds apart. New live signals and submitted notes enter the write queue.
- Submit a note from the page to enqueue it through `POST /api/notes`.

## Run locally

Requires Node.js and an MCP access token.

1. Install dependencies:

   ```sh
   npm install
   ```

2. Add your MCP token to a `.env` file:

   ```env
   AQ_TOKEN=your_token
   ```

3. Start the server:

   ```sh
   node server.js
   ```

4. Open [http://localhost:3000](http://localhost:3000).

The dashboard can initially show cached or incomplete data while the server loads records from MCP.
