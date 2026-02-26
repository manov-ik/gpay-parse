import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.svg";

const API_URL = import.meta.env.VITE_API_URL;

export default function Home({ saveRows, rows }) {
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef();
  const navigate = useNavigate();

  // If session already has data, show a "continue" option
  const hasExisting = rows?.length > 0;

  function handleFile(f) {
    if (!f) return;
    if (!f.name.match(/\.html?$/i)) {
      setError("Please upload a .html file from Google Takeout.");
      return;
    }
    setError("");
    setFile(f);
  }

  async function handleParse() {
    if (!file) return;
    setLoading(true);
    setError("");

    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch(`${API_URL}/parse`, {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Server error: ${res.status}`);
      }

      const csvText = await res.text();

      const lines = csvText.trim().split("\n");
      const headers = lines[0].split(",");
      const rows = lines.slice(1).map((line) => {
        const values = parseCSVLine(line);
        return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
      });

      saveRows(rows, file.name);
      navigate("/dashboard");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center px-4">
      {/* Header */}
      <img src={logo} alt="gpay.parse" className="w-16 h-16 mb-4" />

      <div className="mb-10 text-center">
        <h1 className="text-4xl font-black tracking-tight mb-2">
          gpay<span className="text-emerald-400">.</span>parse
        </h1>
        <p className="text-zinc-400 text-sm">
          Upload your Google Pay HTML export → get insights
        </p>
      </div>

      {/* Resume session banner */}
      {hasExisting && (
        <div className="w-full max-w-md bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-5 py-4 flex items-center justify-between mb-3">
          <div>
            <p className="text-emerald-400 text-sm font-semibold">
              Session restored
            </p>
            <p className="text-zinc-400 text-xs mt-0.5">
              {rows.length} transactions in memory
            </p>
          </div>
          <button
            onClick={() => navigate("/dashboard")}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-lg transition-colors"
          >
            Continue →
          </button>
        </div>
      )}

      {/* Upload card */}
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl">
        {/* Drop zone */}
        <div
          onClick={() => inputRef.current.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFile(e.dataTransfer.files[0]);
          }}
          className={`
            border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all
            ${
              dragging
                ? "border-emerald-400 bg-emerald-400/10"
                : file
                  ? "border-emerald-500 bg-emerald-500/5"
                  : "border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/50"
            }
          `}
        >
          <div className="text-4xl mb-3">{file ? "✅" : "📂"}</div>
          {file ? (
            <>
              <p className="text-emerald-400 font-semibold text-sm">
                {file.name}
              </p>
              <p className="text-zinc-500 text-xs mt-1">
                {(file.size / 1024).toFixed(1)} KB · click to change
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold text-sm text-zinc-200">
                Drop your HTML file here
              </p>
              <p className="text-zinc-500 text-xs mt-1">
                Google Takeout → Google Pay → MyActivity.html
              </p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".html,.htm"
            className="hidden"
            onChange={(e) => handleFile(e.target.files[0])}
          />
        </div>
        {/* Error */}
        {error && (
          <div className="mt-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs">
            {error}
          </div>
        )}
        {/* Parse button */}
        <button
          onClick={handleParse}
          disabled={!file || loading}
          className={`
            mt-5 w-full py-3 rounded-xl font-bold text-sm transition-all
            ${
              !file || loading
                ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                : "bg-emerald-500 hover:bg-emerald-400 text-black cursor-pointer"
            }
          `}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="animate-spin h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
              Parsing…
            </span>
          ) : (
            "Parse Transactions →"
          )}
        </button>
        {/* Help text */}
        <p className="text-center text-zinc-600 text-xs mt-4">
          Files are processed in server but never stored. Parsing happens
          in-memory and results are sent back as CSV.
          <span className="text-zinc-400 font-mono text-[11px]">
            {/* {API_URL || "VITE_API_URL not set"} */}
          </span>
        </p>
      </div>

      {/* Footer hint */}
      <p className="mt-8 text-zinc-700 text-xs">
        Developed by{" "}
        <span className="font-mono text-zinc-500">
          <a href="https://manovik.netlify.app/">manov-ik</a>
        </span>
      </p>
    </div>
  );
}

// Handles quoted CSV values correctly
function parseCSVLine(line) {
  const result = [];
  let cur = "";
  let inQuote = false;
  for (const c of line) {
    if (c === '"') inQuote = !inQuote;
    else if (c === "," && !inQuote) {
      result.push(cur);
      cur = "";
    } else cur += c;
  }
  result.push(cur);
  return result;
}
