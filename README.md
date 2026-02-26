# gpay.parse

> Convert your Google Pay transaction history HTML export into structured CSV data — with a React dashboard for insights.

---

## What it does

Google Takeout gives you your GPay history as a messy HTML file. This tool:

1. Parses every transaction out of that HTML (handles `Paid`, `Received`, `Sent`, `Transferred`)
2. Extracts amount, direction, party name, date, time, transaction ID, and status
3. Returns a clean CSV
4. Displays charts and insights in a React dashboard

---

## Project Structure

```
gpay-parser/
├── backend/                  # FastAPI — deploy to Vercel
│   ├── api/
│   │   └── index.py          # Parser + API endpoint
│   ├── requirements.txt
│   └── vercel.json
│
└── frontend-react/           # Vite + React — deploy to Netlify
    └── src/
        ├── main.jsx           # App entry point
        ├── App.jsx            # Routes
        ├── hooks/
        │   └── useTransactions.js   # sessionStorage state
        ├── components/
        │   └── Nav.jsx              # Shared navigation
        └── pages/
            ├── Home.jsx       # File upload
            ├── Dashboard.jsx  # Charts & insights
            └── History.jsx    # Filterable transaction table
```

---

## Getting Your Google Pay HTML File

1. Go to [Google Takeout](https://takeout.google.com)
2. Click **Deselect all**
3. Scroll down and check **Google Pay**
4. Click **Next step** → **Create export**
5. Download the zip → extract it
6. Find `MyActivity.html` inside the GPay folder

---

## Backend Setup (FastAPI)

### Run locally

```bash
cd backend
pip install -r requirements.txt
uvicorn api.index:app --reload
# → http://localhost:8000
```

### Deploy to Vercel

```bash
npm i -g vercel
cd backend
vercel login
vercel --prod
# → https://your-project.vercel.app
```

**Test it:**

```bash
curl https://your-project.vercel.app/
# {"message":"GPay HTML to CSV parser API..."}
```

### API

```
POST /parse
Content-Type: multipart/form-data
Body: file=<your .html file>

Response: text/csv (streamed download)
```

**CSV columns:**

| Column         | Example                   |
| -------------- | ------------------------- |
| Amount         | `60.00`                   |
| Direction      | `Debit` or `Credit`       |
| Party          | `GOWRI KRISHNA VEG HOTEL` |
| Date           | `Feb 26, 2026`            |
| Time           | `10:07:29 AM`             |
| Transaction ID | `MPbT2WF9RXCxIUlR`        |
| Status         | `Completed`               |

**Supported transaction types:**

| Format                                   | Direction |
| ---------------------------------------- | --------- |
| `Paid ₹X to PARTY using Bank Account...` | Debit     |
| `Sent ₹X using Bank Account...`          | Debit     |
| `Transferred ₹X to PARTY using...`       | Debit     |
| `Received ₹X`                            | Credit    |
| `Received ₹X from PARTY`                 | Credit    |

---

## Frontend Setup (React + Vite)

### Install dependencies

```bash
cd frontend-react
npm install
npm install react-router-dom chart.js
```

### Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
VITE_API_URL=https://your-project.vercel.app
```

> **Note:** The variable must start with `VITE_` — Vite only exposes env vars with this prefix to the browser.

### Run locally

```bash
npm run dev
# → http://localhost:5173
```

### Deploy to Netlify

**Option A — Drag and drop (quickest):**

1. Run `npm run build`
2. Go to [netlify.com](https://netlify.com) → Add new site → Deploy manually
3. Drag the `dist/` folder onto the deploy area

**Option B — Connect GitHub repo:**

1. Push your code to GitHub
2. In Netlify: Add new site → Import from Git
3. Set build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Add environment variable: `VITE_API_URL=https://your-project.vercel.app`
5. Deploy

---

## Pages

### Home `/`

- Drag and drop or click to upload your `.html` file
- Shows a **"Session restored"** banner if you already uploaded in this tab — lets you jump straight back to the dashboard without re-uploading
- Sends the file to the backend, parses the CSV response, saves to `sessionStorage`

### Dashboard `/dashboard`

- **8 stat cards:** total transactions, total debited, total credited, net flow, avg debit, avg credit, failed count, top merchant
- **Largest debit & credit** with party name and date
- **6 charts (Chart.js):**
  - Monthly debit vs credit — chronologically sorted
  - Daily spend — last 30 days
  - Cumulative spend over time
  - Top 8 merchants by amount (horizontal bar)
  - Debit vs credit split (doughnut)
  - Spending by hour of day

### History `/history`

- Filter by month, direction (Debit/Credit), status (Completed/Failed)
- Search across party name, TX ID, amount, date — with **yellow highlight** on matches
- Sort by any column
- Paginated at 30 rows per page with smart ellipsis pagination
- **Merchant tab** — ranked list of merchants by total spend with proportional bars
- Export filtered results as CSV

---

## Data Flow

```
User uploads HTML
      ↓
POST /parse  (FastAPI on Vercel)
      ↓
BeautifulSoup parses HTML → CSV streamed back
      ↓
React parses CSV → array of row objects
      ↓
Saved to sessionStorage via useTransactions hook
      ↓
Dashboard and History read from props (App owns state)
```

Session data persists across page refreshes and navigation within the same browser tab. Clicking **✕ Clear** in the nav wipes `sessionStorage` and returns to Home.

---

## Tech Stack

| Layer            | Tech                                  |
| ---------------- | ------------------------------------- |
| Backend          | Python, FastAPI, BeautifulSoup4       |
| Backend hosting  | Vercel (serverless Python)            |
| Frontend         | React 18, Vite, React Router v6       |
| Charts           | Chart.js                              |
| Styling          | Tailwind CSS (inline utility classes) |
| Frontend hosting | Netlify                               |
| State            | sessionStorage via custom hook        |

---

## Common Issues

**`FUNCTION_INVOCATION_FAILED` on Vercel**
→ Make sure `requirements.txt` is at `backend/` root (same level as `vercel.json`), not inside `api/`.

**CORS error in browser**
→ Check that `CORSMiddleware` is present in `api/index.py` with `allow_origins=["*"]`.

**`VITE_API_URL` is undefined**
→ Variable must start with `VITE_`. After editing `.env`, restart `npm run dev`.

**Refreshing `/dashboard` redirects to home**
→ This is expected if `sessionStorage` is empty (e.g. opened in a new tab). Re-upload your file on Home.

**Transaction party name is blank**
→ Some GPay transactions like `Received ₹X` don't include a sender — party is intentionally left empty in the CSV.
