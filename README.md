# FactCheck Agent

AI-powered truth layer that extracts marketing statements from documents and verifies them against live web data.

[Live Demo](https://factcheck-agent-eosin.vercel.app)

---

## How It Works

1. **Upload PDF**: The user drags and drops a PDF statement of marketing materials. The text contents are extracted locally in the browser using `pdfjs-dist`.
2. **AI Audit Execution**: The extracted content is sent to a Supabase Edge Function (`fact-check`), which invokes Gemini AI to extract distinct factual claims and queries Tavily to retrieve real-time verification evidence from the web.
3. **Live Verdict Ledger**: Claims and updates stream directly into the UI in real time via Supabase Realtime channel filters, popping in with responsive scale-in rubber-stamp designs (Verified, Inaccurate, False).

---

## Tech Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Database & Sync**: Supabase Database & Supabase Realtime
- **Client PDF Parsing**: `pdfjs-dist` (using a background CDN worker)
- **Icons**: `lucide-react`

---

## Setup & Local Development

### Prerequisites

Ensure you have [Node.js](https://nodejs.org) (v18 or later) installed.

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yashrajrathiii/Factcheck-Agent.git
   cd Factcheck-Agent
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   Create a `.env` file in the root directory based on `.env.example`:
   ```bash
   cp .env.example .env
   ```
   Open the `.env` file and insert your Supabase project keys:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

4. **Launch the local development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Environment Variables

| Variable Name | Description | Required |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | The public URL endpoint of your Supabase project. | **Yes** |
| `VITE_SUPABASE_ANON_KEY` | The public anonymous key for authentication and database calls. | **Yes** |

---

## Database Schema

The application relies on the following two tables in the database backend:

### `documents`
- `id` (uuid, primary key): Unique identifier.
- `filename` (text): Name of the analyzed file.
- `status` (text): Progress state.
- `total_claims` (int): Total identified claims.
- `verified_count` (int): Count of claims verified as true.
- `inaccurate_count` (int): Count of claims with minor factual updates.
- `false_count` (int): Count of completely false claims.
- `created_at` (timestamp): Record generation timestamp.

### `claims`
- `id` (uuid, primary key): Unique identifier.
- `document_id` (uuid, foreign key to `documents.id`): Back-reference.
- `claim_text` (text): The extracted statement.
- `claim_type` (text): Type tag (`STAT` / `DATE` / `FINANCIAL` / `TECHNICAL`).
- `verdict` (text): Stamp rating (`verified` / `inaccurate` / `false` / `pending`).
- `reasoning` (text): Explanatory reasoning text.
- `source_url` (text): Verification URL.
- `source_snippet` (text): Exact snippet from the source site.
- `correct_fact` (text): True statistics or data if inaccurate or false.
- `created_at` (timestamp): Claim record generation timestamp.

---

## Deployment

### Frontend (Vercel)
You can deploy the Vite React SPA to Vercel:
1. Connect your GitHub repository to Vercel.
2. In the Build & Development Settings, use `Vite` defaults.
3. Configure the environment variables (`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`) in the Vercel dashboard.
4. Click **Deploy**.

### Backend (Supabase)
Deploy edge functions using the Supabase CLI:
```bash
supabase functions deploy fact-check --project-ref your-project-id
```
Ensure you set the Tavily and Gemini API keys inside your Supabase dashboard project secrets.
