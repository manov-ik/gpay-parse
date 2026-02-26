# GPay Statement Parser

Convert your Google Pay HTML transaction history into a clean CSV.

## Project Structure
```
backend/   → FastAPI (deploy to Vercel)
frontend/  → Static HTML (deploy to Netlify)
```

---

## 🚀 Backend — Deploy to Vercel

### 1. Install Vercel CLI
```bash
npm i -g vercel
```

### 2. Deploy
```bash
cd backend
vercel --prod
```

Vercel will give you a URL like `https://gpay-parser.vercel.app`.

---

## 🌐 Frontend — Deploy to Netlify

### Option A: Drag & Drop
1. Go to [netlify.com](https://netlify.com) → Add new site → Deploy manually
2. Drag the `frontend/` folder onto the deploy area
3. Done — you get a URL like `https://gpay-parser.netlify.app`

### Option B: CLI
```bash
npm i -g netlify-cli
cd frontend
netlify deploy --prod --dir .
```

---

## Usage

1. Open your Netlify URL
2. Paste your Vercel backend URL into the API field
3. Upload your Google Pay HTML file (from Google Takeout)
4. Click Parse → Download CSV

## Getting the HTML file

1. Go to [Google Takeout](https://takeout.google.com)
2. Deselect all → select **Google Pay**
3. Download → extract zip
4. Find `MyActivity.html` inside

---

## CSV Columns

| Column | Description |
|--------|-------------|
| Amount | Transaction amount (₹) |
| Direction | `Credit` or `Debit` |
| Party | Who you paid / received from |
| Date | e.g. `Feb 26, 2026` |
| Time | e.g. `10:07:29 AM` |
| Transaction ID | UPI reference ID |
| Status | `Completed`, `Failed`, etc. |
