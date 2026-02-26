from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from bs4 import BeautifulSoup
import re
import csv
import io
import dotenv
import os

dotenv.load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL")],
    allow_credentials=False,       # ← added (required when allow_origins=*)
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"]
)

KNOWN_STATUSES = {"Completed", "Failed", "Pending", "Cancelled", "Declined"}

def parse_transaction(cell):
    try:
        content_cells = cell.find_all("div", class_=lambda c: c and "content-cell" in c and "mdl-typography--body-1" in c)
        caption_cell = cell.find("div", class_=lambda c: c and "mdl-typography--caption" in c)

        if not content_cells or not caption_cell:
            return None

        main_text = content_cells[0].get_text(separator="\n").strip()
        lines = [l.strip() for l in main_text.split("\n") if l.strip()]

        tx_line = lines[0] if lines else ""
        verb = tx_line.split()[0].lower() if tx_line else ""

        # ── Amount ──────────────────────────────────────────────
        amount = ""
        amount_match = re.search(r"[₹$€£]([\d,]+\.?\d*)", tx_line)
        if amount_match:
            amount = amount_match.group(1).replace(",", "")

        # ── Direction + Party ────────────────────────────────────
        # Debit verbs: paid, sent, transferred
        # Credit verbs: received
        direction = ""
        party = ""

        if verb in ("paid", "transferred"):
            direction = "Debit"
            # "Paid ₹X to PARTY using ..." or "Paid ₹X to PARTY"
            m = re.search(r"(?:Paid|Transferred)\s+[₹$€£][\d,.]+\s+to\s+(.+?)(?:\s+using\s+.+)?$", tx_line, re.IGNORECASE)
            if m:
                party = m.group(1).strip()

        elif verb == "sent":
            direction = "Debit"
            # "Sent ₹X to PARTY using ..." — party may be absent
            m = re.search(r"Sent\s+[₹$€£][\d,.]+\s+to\s+(.+?)(?:\s+using\s+.+)?$", tx_line, re.IGNORECASE)
            if m:
                party = m.group(1).strip()
            # else party stays empty (anonymous send)

        elif verb == "received":
            direction = "Credit"
            # "Received ₹X from PARTY" — "from" clause is optional
            m = re.search(r"Received\s+[₹$€£][\d,.]+\s+from\s+(.+?)(?:\s+using\s+.+)?$", tx_line, re.IGNORECASE)
            if m:
                party = m.group(1).strip()
            # else party stays empty (anonymous receive)

        else:
            direction = "Unknown"
            party = tx_line  # keep raw line so nothing is lost

        # ── Date & Time ──────────────────────────────────────────
        # Format: "Feb 26, 2026, 10:07:29 AM GMT+05:30"
        date_str = ""
        time_str = ""
        if len(lines) > 1:
            dt_line = lines[1]
            # Match: "Mon DD, YYYY, HH:MM:SS AM/PM GMT±HH:MM"
            dt_match = re.match(
                r"(\w+ \d{1,2},\s*\d{4}),\s*(\d{1,2}:\d{2}:\d{2}\s*[AP]M)",
                dt_line, re.IGNORECASE
            )
            if dt_match:
                date_str = dt_match.group(1).strip()
                time_str = dt_match.group(2).strip()

        # ── Transaction ID & Status (from caption) ────────────────
        # The caption block looks like:
        #   Products:
        #    Google Pay
        #   Details:
        #    <TX_ID>
        #    Completed
        caption_text = caption_cell.get_text(separator="\n")
        caption_lines = [l.strip() for l in caption_text.split("\n") if l.strip()]

        tx_id = ""
        status = ""

        # Find everything after "Details:" label
        in_details = False
        for line in caption_lines:
            if line.lower() == "details:":
                in_details = True
                continue
            if not in_details:
                continue
            if line in KNOWN_STATUSES:
                status = line
            elif not tx_id:
                # Transaction IDs: alphanumeric + possible + / - / _ chars, min 8 chars
                if re.match(r"^[A-Za-z0-9+/=_\-]{8,}$", line):
                    tx_id = line

        return {
            "Amount": amount,
            "Direction": direction,
            "Party": party,
            "Date": date_str,
            "Time": time_str,
            "Transaction ID": tx_id,
            "Status": status,
        }
    except Exception:
        return None


@app.post("/parse")
async def parse_html(file: UploadFile = File(...)):
    if not file.filename.endswith((".html", ".htm")):
        raise HTTPException(status_code=400, detail="Please upload an HTML file.")

    content = await file.read()
    soup = BeautifulSoup(content, "html.parser")

    cells = soup.find_all("div", class_=lambda c: c and "outer-cell" in c)
    if not cells:
        raise HTTPException(status_code=400, detail="No transaction cells found in HTML.")

    rows = []
    for cell in cells:
        result = parse_transaction(cell)
        if result:
            rows.append(result)

    if not rows:
        raise HTTPException(status_code=400, detail="Could not parse any transactions.")

    output = io.StringIO()
    fieldnames = ["Amount", "Direction", "Party", "Date", "Time", "Transaction ID", "Status"]
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)

    output.seek(0)
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=gpay_transactions.csv"},
    )


@app.get("/")
def root():
    return {"message": "GPay HTML to CSV parser API. POST /parse with your HTML file.", "frontend_url": test}