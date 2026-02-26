import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Nav from "../components/Nav";

const PER_PAGE = 30;

export default function History({ rows, filename, onClear }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!rows?.length) navigate("/");
  }, [rows, navigate]);

  const [search, setSearch] = useState("");
  const [direction, setDirection] = useState("All");
  const [status, setStatus] = useState("All");
  const [monthFilter, setMonth] = useState("All");
  const [sortKey, setSortKey] = useState("Date");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState("table"); // "table" | "merchants"

  // Redirect handled in useEffect above — render nothing while redirecting
  if (!rows?.length) return null;

  // ── Unique months for dropdown ────────────────────────────
  const months = useMemo(() => {
    const seen = new Set();
    rows.forEach((r) => {
      const m = r.Date?.match(/(\w+ \d{4})/)?.[1];
      if (m) seen.add(m);
    });
    return [
      "All",
      ...Array.from(seen).sort((a, b) => new Date(b) - new Date(a)),
    ];
  }, [rows]);

  // ── Filter + sort ─────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let data = rows.filter((r) => {
      if (
        q &&
        !(
          r.Party?.toLowerCase().includes(q) ||
          r["Transaction ID"]?.toLowerCase().includes(q) ||
          r.Amount?.includes(q) ||
          r.Date?.toLowerCase().includes(q)
        )
      )
        return false;
      if (direction !== "All" && r.Direction !== direction) return false;
      if (status !== "All" && r.Status !== status) return false;
      if (monthFilter !== "All") {
        const m = r.Date?.match(/(\w+ \d{4})/)?.[1];
        if (m !== monthFilter) return false;
      }
      return true;
    });

    data.sort((a, b) => {
      let av = a[sortKey] ?? "",
        bv = b[sortKey] ?? "";
      if (sortKey === "Amount") {
        av = parseFloat(av) || 0;
        bv = parseFloat(bv) || 0;
      }
      return av < bv ? (sortAsc ? -1 : 1) : av > bv ? (sortAsc ? 1 : -1) : 0;
    });

    return data;
  }, [rows, search, direction, status, monthFilter, sortKey, sortAsc]);

  // ── Merchant breakdown (debit only) ──────────────────────
  const merchants = useMemo(() => {
    const map = {};
    filtered
      .filter((r) => r.Direction === "Debit" && r.Party)
      .forEach((r) => {
        if (!map[r.Party]) map[r.Party] = { name: r.Party, count: 0, total: 0 };
        map[r.Party].count++;
        map[r.Party].total += parseFloat(r.Amount || 0);
      });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filtered]);

  const maxMerchant = merchants[0]?.total ?? 1;

  // ── Pagination ────────────────────────────────────────────
  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  function toggleSort(key) {
    if (sortKey === key) setSortAsc((p) => !p);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
    setPage(1);
  }

  function resetFilters() {
    setSearch("");
    setDirection("All");
    setStatus("All");
    setMonth("All");
    setSortKey("Date");
    setSortAsc(false);
    setPage(1);
  }

  const isFiltered =
    search || direction !== "All" || status !== "All" || monthFilter !== "All";

  const totalDebit = filtered
    .filter((r) => r.Direction === "Debit")
    .reduce((s, r) => s + parseFloat(r.Amount || 0), 0);
  const totalCredit = filtered
    .filter((r) => r.Direction === "Credit")
    .reduce((s, r) => s + parseFloat(r.Amount || 0), 0);

  // ── Search highlight ──────────────────────────────────────
  function hl(text) {
    const q = search.trim();
    if (!q || !text) return text || "—";
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-amber-400/25 text-amber-300 rounded px-0.5 not-italic">
          {text.slice(idx, idx + q.length)}
        </mark>
        {text.slice(idx + q.length)}
      </>
    );
  }

  // ── CSV export ────────────────────────────────────────────
  function downloadCSV() {
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(","),
      ...filtered.map((r) =>
        headers.map((h) => `"${(r[h] ?? "").replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = isFiltered ? "gpay_filtered.csv" : "gpay_transactions.csv";
    a.click();
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Nav onClear={onClear} />

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-5 ">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h1 className="text-xl font-bold">History</h1>
            <p className="text-zinc-600 text-xs mt-0.5">{filename}</p>
          </div>
          <button
            onClick={downloadCSV}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm rounded-lg transition-colors"
          >
            ⬇ {isFiltered ? "Export filtered" : "Export all"}
          </button>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-3 mb-3">
          {[
            {
              label: "Showing",
              val: `${filtered.length}`,
              sub: `of ${rows.length} total`,
              color: "text-white",
            },
            {
              label: "Debited",
              val: `₹${totalDebit.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,
              sub: "outflow",
              color: "text-rose-400",
            },
            {
              label: "Credited",
              val: `₹${totalCredit.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,
              sub: "inflow",
              color: "text-emerald-400",
            },
          ].map(({ label, val, sub, color }) => (
            <div
              key={label}
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4"
            >
              <p className="text-zinc-500 text-[10px] uppercase tracking-widest mb-1">
                {label}
              </p>
              <p className={`text-2xl font-black tracking-tight ${color}`}>
                {val}
              </p>
              <p className="text-zinc-600 text-[11px] mt-0.5">{sub}</p>
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-wrap gap-3 items-center mb-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">
              🔍
            </span>
            <input
              type="text"
              placeholder="Search name, TX ID, amount…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* Month */}
          <select
            value={monthFilter}
            onChange={(e) => {
              setMonth(e.target.value);
              setPage(1);
            }}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500 cursor-pointer"
          >
            {months.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>

          {/* Direction */}
          <FilterPills
            options={["All", "Debit", "Credit"]}
            value={direction}
            onChange={(v) => {
              setDirection(v);
              setPage(1);
            }}
          />

          {/* Status */}
          <FilterPills
            options={["All", "Completed", "Failed"]}
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
          />

          {isFiltered && (
            <button
              onClick={resetFilters}
              className="text-xs text-zinc-500 hover:text-rose-400 transition-colors"
            >
              ✕ reset
            </button>
          )}
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1 w-fit mb-3">
          {[
            ["table", "📋 Transactions"],
            ["merchants", "🏪 Merchants"],
          ].map(([t, label]) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                activeTab === t
                  ? "bg-zinc-700 text-white"
                  : "text-zinc-500 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── TABLE ─────────────────────────────────────────── */}
        {activeTab === "table" && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-zinc-800/70">
                    {[
                      ["Date", "Date"],
                      ["Time", "Time"],
                      ["Direction", "Type"],
                      ["Amount", "₹"],
                      ["Party", "Party"],
                      ["Transaction ID", "TX ID"],
                      ["Status", "Status"],
                    ].map(([key, label]) => (
                      <th
                        key={key}
                        onClick={() => toggleSort(key)}
                        className="px-4 py-3 text-left text-zinc-400 font-semibold whitespace-nowrap cursor-pointer hover:text-white select-none transition-colors group"
                      >
                        {label}
                        <span className="ml-1 text-zinc-700 group-hover:text-zinc-400">
                          {sortKey === key ? (sortAsc ? "↑" : "↓") : "⇅"}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-16 text-center">
                        <p className="text-3xl mb-2">🔍</p>
                        <p className="text-zinc-600 text-sm">No results</p>
                        <button
                          onClick={resetFilters}
                          className="mt-2 text-emerald-500 text-xs hover:underline"
                        >
                          Reset filters
                        </button>
                      </td>
                    </tr>
                  ) : (
                    paginated.map((row, i) => (
                      <tr
                        key={i}
                        className="border-t border-zinc-800/50 hover:bg-zinc-800/20 transition-colors"
                      >
                        <td className="px-4 py-3 text-zinc-300 whitespace-nowrap">
                          {hl(row.Date)}
                        </td>
                        <td className="px-4 py-3 text-zinc-600 whitespace-nowrap font-mono text-[11px]">
                          {row.Time}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              row.Direction === "Credit"
                                ? "bg-emerald-500/15 text-emerald-400"
                                : "bg-rose-500/15 text-rose-400"
                            }`}
                          >
                            {row.Direction}
                          </span>
                        </td>
                        <td
                          className={`px-4 py-3 font-bold whitespace-nowrap tabular-nums ${
                            row.Direction === "Credit"
                              ? "text-emerald-400"
                              : "text-zinc-100"
                          }`}
                        >
                          ₹
                          {parseFloat(row.Amount || 0).toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-4 py-3 text-zinc-300 max-w-[200px] truncate">
                          {hl(row.Party) || "—"}
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-zinc-600">
                          {hl(row["Transaction ID"])}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              row.Status === "Completed"
                                ? "bg-emerald-500/15 text-emerald-400"
                                : row.Status === "Failed"
                                  ? "bg-rose-500/15 text-rose-400"
                                  : "bg-zinc-700/50 text-zinc-500"
                            }`}
                          >
                            {row.Status || "—"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="border-t border-zinc-800 px-5 py-3 flex items-center justify-between">
                <span className="text-zinc-600 text-xs">
                  {(page - 1) * PER_PAGE + 1}–
                  {Math.min(page * PER_PAGE, filtered.length)} of{" "}
                  {filtered.length}
                </span>
                <div className="flex gap-1">
                  <PBtn onClick={() => setPage(1)} disabled={page === 1}>
                    «
                  </PBtn>
                  <PBtn
                    onClick={() => setPage((p) => p - 1)}
                    disabled={page === 1}
                  >
                    ‹
                  </PBtn>
                  {pageRange(page, totalPages).map((p) =>
                    typeof p === "string" ? (
                      <span
                        key={p}
                        className="w-7 text-center text-zinc-600 text-xs self-center"
                      >
                        …
                      </span>
                    ) : (
                      <PBtn
                        key={p}
                        onClick={() => setPage(p)}
                        active={p === page}
                      >
                        {p}
                      </PBtn>
                    ),
                  )}
                  <PBtn
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page === totalPages}
                  >
                    ›
                  </PBtn>
                  <PBtn
                    onClick={() => setPage(totalPages)}
                    disabled={page === totalPages}
                  >
                    »
                  </PBtn>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── MERCHANTS ────────────────────────────────────── */}
        {activeTab === "merchants" && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            {merchants.length === 0 ? (
              <div className="py-16 text-center text-zinc-600">
                <p className="text-3xl mb-2">🏪</p>
                <p className="text-sm">No merchant data for current filters</p>
              </div>
            ) : (
              merchants.map((m, i) => (
                <div
                  key={m.name}
                  className="flex items-center gap-4 px-5 py-4 border-t border-zinc-800/50 first:border-t-0 hover:bg-zinc-800/20 transition-colors"
                >
                  <span className="text-zinc-700 font-black text-base w-5 text-right shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between mb-2">
                      <p className="text-sm font-semibold text-zinc-200 truncate pr-4">
                        {m.name}
                      </p>
                      <div className="shrink-0 text-right">
                        <span className="text-sm font-black text-white tabular-nums">
                          ₹
                          {m.total.toLocaleString("en-IN", {
                            maximumFractionDigits: 0,
                          })}
                        </span>
                        <span className="text-zinc-600 text-[11px] ml-2">
                          {m.count}×
                        </span>
                      </div>
                    </div>
                    <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${(m.total / maxMerchant) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────

function FilterPills({ options, value, onChange }) {
  return (
    <div className="flex gap-1 bg-zinc-800 border border-zinc-700 rounded-lg p-1">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
            value === o
              ? "bg-zinc-600 text-white"
              : "text-zinc-500 hover:text-white"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function PBtn({ children, onClick, disabled, active }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`min-w-[28px] h-7 px-1.5 rounded text-xs font-semibold transition-colors ${
        active
          ? "bg-emerald-500 text-black"
          : disabled
            ? "text-zinc-700 cursor-not-allowed"
            : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
      }`}
    >
      {children}
    </button>
  );
}

function pageRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  let pages;
  if (current <= 4) pages = [1, 2, 3, 4, 5, "…a", total];
  else if (current >= total - 3)
    pages = [1, "…b", total - 4, total - 3, total - 2, total - 1, total];
  else pages = [1, "…c", current - 1, current, current + 1, "…d", total];

  return pages;
}
