import { useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Chart, registerables } from "chart.js";
import Nav from "../components/Nav";

Chart.register(...registerables);

// ── Chart theme ───────────────────────────────────────────────
const GRID = "#27272a";
const TICK = "#71717a";
const baseOpts = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { color: TICK, font: { size: 11 } }, grid: { color: GRID } },
    y: { ticks: { color: TICK, font: { size: 11 } }, grid: { color: GRID } },
  },
};

// Correctly parse "Feb 26, 2026" → sortable date
function parseDate(str) {
  if (!str) return new Date(0);
  return new Date(str); // e.g. "Feb 26, 2026" parses fine in V8
}

// "Feb 26, 2026" → "Feb 2026"
function toMonthLabel(dateStr) {
  const m = dateStr?.match(/(\w+)\s+\d+,\s+(\d{4})/);
  return m ? `${m[1]} ${m[2]}` : "Unknown";
}

// Sort month labels chronologically e.g. "Jan 2026" < "Feb 2026"
function sortMonthLabels(labels) {
  return [...labels].sort((a, b) => new Date(`1 ${a}`) - new Date(`1 ${b}`));
}

export default function Dashboard({ rows, filename, onClear }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!rows?.length) navigate("/");
  }, [rows, navigate]);

  if (!rows?.length) return null;

  // ── All derived data via useMemo ──────────────────────────
  const debits = useMemo(
    () => rows.filter((r) => r.Direction === "Debit"),
    [rows],
  );
  const credits = useMemo(
    () => rows.filter((r) => r.Direction === "Credit"),
    [rows],
  );

  const totalDebit = useMemo(
    () => debits.reduce((s, r) => s + parseFloat(r.Amount || 0), 0),
    [debits],
  );
  const totalCredit = useMemo(
    () => credits.reduce((s, r) => s + parseFloat(r.Amount || 0), 0),
    [credits],
  );
  const netFlow = totalCredit - totalDebit;
  const avgDebit = debits.length ? totalDebit / debits.length : 0;
  const avgCredit = credits.length ? totalCredit / credits.length : 0;
  const failed = useMemo(
    () => rows.filter((r) => r.Status === "Failed").length,
    [rows],
  );
  const completed = useMemo(
    () => rows.filter((r) => r.Status === "Completed").length,
    [rows],
  );

  // Biggest single debit / credit
  const biggestDebit = useMemo(
    () =>
      debits.reduce(
        (m, r) => (parseFloat(r.Amount) > parseFloat(m.Amount || 0) ? r : m),
        {},
      ),
    [debits],
  );
  const biggestCredit = useMemo(
    () =>
      credits.reduce(
        (m, r) => (parseFloat(r.Amount) > parseFloat(m.Amount || 0) ? r : m),
        {},
      ),
    [credits],
  );

  // Most frequent merchant
  const topMerchant = useMemo(() => {
    const map = {};
    debits
      .filter((r) => r.Party)
      .forEach((r) => {
        map[r.Party] = (map[r.Party] || 0) + 1;
      });
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
    return sorted[0] ? { name: sorted[0][0], count: sorted[0][1] } : null;
  }, [debits]);

  // ── Monthly data (correctly sorted) ──────────────────────
  const monthlyData = useMemo(() => {
    const debitMap = {};
    const creditMap = {};
    rows.forEach((r) => {
      const label = toMonthLabel(r.Date);
      if (r.Direction === "Debit")
        debitMap[label] = (debitMap[label] || 0) + parseFloat(r.Amount || 0);
      if (r.Direction === "Credit")
        creditMap[label] = (creditMap[label] || 0) + parseFloat(r.Amount || 0);
    });
    const allLabels = sortMonthLabels([
      ...new Set([...Object.keys(debitMap), ...Object.keys(creditMap)]),
    ]);
    return {
      labels: allLabels,
      debits: allLabels.map((l) => (debitMap[l] || 0).toFixed(2)),
      credits: allLabels.map((l) => (creditMap[l] || 0).toFixed(2)),
    };
  }, [rows]);

  // ── Daily spend (last 30 days) ────────────────────────────
  const dailyData = useMemo(() => {
    const map = {};
    debits.forEach((r) => {
      const d = r.Date || "Unknown";
      map[d] = (map[d] || 0) + parseFloat(r.Amount || 0);
    });
    const sorted = Object.entries(map)
      .sort((a, b) => parseDate(a[0]) - parseDate(b[0]))
      .slice(-30);
    return {
      labels: sorted.map((e) => e[0]),
      values: sorted.map((e) => e[1].toFixed(2)),
    };
  }, [debits]);

  // ── Cumulative spend ──────────────────────────────────────
  const cumulativeData = useMemo(() => {
    const sorted = [...debits].sort(
      (a, b) => parseDate(a.Date) - parseDate(b.Date),
    );
    let cum = 0;
    return {
      labels: sorted.map((r) => r.Date),
      values: sorted.map((r) => {
        cum += parseFloat(r.Amount || 0);
        return cum.toFixed(2);
      }),
    };
  }, [debits]);

  // ── Top 8 merchants by spend ──────────────────────────────
  const merchantData = useMemo(() => {
    const map = {};
    debits
      .filter((r) => r.Party)
      .forEach((r) => {
        map[r.Party] = (map[r.Party] || 0) + parseFloat(r.Amount || 0);
      });
    const sorted = Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    return {
      labels: sorted.map((e) => e[0]),
      values: sorted.map((e) => e[1].toFixed(2)),
    };
  }, [debits]);

  // ── Hourly distribution ───────────────────────────────────
  const hourlyData = useMemo(() => {
    const buckets = Array(24).fill(0);
    debits.forEach((r) => {
      const m = r.Time?.match(/(\d+):(\d+).*?(AM|PM)/i);
      if (!m) return;
      let h = parseInt(m[1]);
      if (m[3].toUpperCase() === "PM" && h !== 12) h += 12;
      if (m[3].toUpperCase() === "AM" && h === 12) h = 0;
      buckets[h] += parseFloat(r.Amount || 0);
    });
    return {
      labels: buckets.map((_, i) => `${i}:00`),
      values: buckets.map((v) => v.toFixed(2)),
    };
  }, [debits]);

  // ── Chart refs ────────────────────────────────────────────
  const monthlyRef = useRef();
  const cumulativeRef = useRef();
  const merchantRef = useRef();
  const dailyRef = useRef();
  const doughnutRef = useRef();
  const hourlyRef = useRef();

  // ── Draw charts ───────────────────────────────────────────
  useChartEffect(
    monthlyRef,
    () =>
      new Chart(monthlyRef.current, {
        type: "bar",
        data: {
          labels: monthlyData.labels,
          datasets: [
            {
              label: "Debit ₹",
              data: monthlyData.debits,
              backgroundColor: "#f43f5e99",
              borderRadius: 4,
            },
            {
              label: "Credit ₹",
              data: monthlyData.credits,
              backgroundColor: "#10b98199",
              borderRadius: 4,
            },
          ],
        },
        options: {
          ...baseOpts,
          plugins: {
            legend: {
              display: true,
              labels: { color: TICK, boxWidth: 12, font: { size: 11 } },
            },
            tooltip: {
              callbacks: {
                label: (c) => ` ₹${parseFloat(c.raw).toLocaleString("en-IN")}`,
              },
            },
          },
        },
      }),
    [monthlyData],
  );

  useChartEffect(
    cumulativeRef,
    () =>
      new Chart(cumulativeRef.current, {
        type: "line",
        data: {
          labels: cumulativeData.labels,
          datasets: [
            {
              data: cumulativeData.values,
              borderColor: "#f59e0b",
              backgroundColor: "rgba(245,158,11,0.08)",
              fill: true,
              tension: 0.3,
              pointRadius: 0,
              borderWidth: 2,
            },
          ],
        },
        options: {
          ...baseOpts,
          scales: {
            x: { display: false },
            y: {
              ticks: {
                color: TICK,
                callback: (v) => `₹${(v / 1000).toFixed(0)}k`,
              },
              grid: { color: GRID },
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (c) => ` ₹${parseFloat(c.raw).toLocaleString("en-IN")}`,
              },
            },
          },
        },
      }),
    [cumulativeData],
  );

  useChartEffect(
    dailyRef,
    () =>
      new Chart(dailyRef.current, {
        type: "bar",
        data: {
          labels: dailyData.labels,
          datasets: [
            {
              data: dailyData.values,
              backgroundColor: "#6366f1aa",
              borderRadius: 3,
            },
          ],
        },
        options: {
          ...baseOpts,
          scales: {
            x: { display: false },
            y: {
              ticks: { color: TICK, font: { size: 11 } },
              grid: { color: GRID },
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: (c) => c[0].label,
                label: (c) => ` ₹${parseFloat(c.raw).toLocaleString("en-IN")}`,
              },
            },
          },
        },
      }),
    [dailyData],
  );

  useChartEffect(
    merchantRef,
    () =>
      new Chart(merchantRef.current, {
        type: "bar",
        data: {
          labels: merchantData.labels,
          datasets: [
            {
              data: merchantData.values,
              backgroundColor: [
                "#10b981",
                "#6366f1",
                "#f59e0b",
                "#f43f5e",
                "#3b82f6",
                "#a855f7",
                "#ec4899",
                "#14b8a6",
              ],
              borderRadius: 4,
            },
          ],
        },
        options: {
          ...baseOpts,
          indexAxis: "y",
          scales: {
            x: {
              ticks: {
                color: TICK,
                font: { size: 10 },
                callback: (v) => `₹${v}`,
              },
              grid: { color: GRID },
            },
            y: {
              ticks: { color: "#d4d4d8", font: { size: 10 } },
              grid: { display: false },
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (c) => ` ₹${parseFloat(c.raw).toLocaleString("en-IN")}`,
              },
            },
          },
        },
      }),
    [merchantData],
  );

  useChartEffect(
    doughnutRef,
    () =>
      new Chart(doughnutRef.current, {
        type: "doughnut",
        data: {
          labels: ["Debit", "Credit"],
          datasets: [
            {
              data: [totalDebit.toFixed(2), totalCredit.toFixed(2)],
              backgroundColor: ["#f43f5e", "#10b981"],
              borderColor: "#18181b",
              borderWidth: 3,
            },
          ],
        },
        options: {
          responsive: true,
          cutout: "65%",
          plugins: {
            legend: {
              position: "bottom",
              labels: {
                color: TICK,
                boxWidth: 12,
                font: { size: 11 },
                padding: 16,
              },
            },
            tooltip: {
              callbacks: {
                label: (c) => ` ₹${parseFloat(c.raw).toLocaleString("en-IN")}`,
              },
            },
          },
        },
      }),
    [totalDebit, totalCredit],
  );

  useChartEffect(
    hourlyRef,
    () =>
      new Chart(hourlyRef.current, {
        type: "bar",
        data: {
          labels: hourlyData.labels,
          datasets: [
            {
              data: hourlyData.values,
              backgroundColor: "#a855f7aa",
              borderRadius: 2,
            },
          ],
        },
        options: {
          ...baseOpts,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: (c) => c[0].label,
                label: (c) => ` ₹${parseFloat(c.raw).toLocaleString("en-IN")}`,
              },
            },
          },
          scales: {
            x: {
              ticks: { color: TICK, font: { size: 9 }, maxRotation: 0 },
              grid: { display: false },
            },
            y: {
              ticks: { color: TICK, font: { size: 10 } },
              grid: { color: GRID },
            },
          },
        },
      }),
    [hourlyData],
  );

  // ── CSV export ────────────────────────────────────────────
  function downloadCSV() {
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(","),
      ...rows.map((r) =>
        headers.map((h) => `"${(r[h] ?? "").replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "gpay_transactions.csv";
    a.click();
  }

  const fmt = (n) =>
    n.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Nav onClear={onClear} />

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6 ">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h1 className="text-xl font-bold">Dashboard</h1>
            <p className="text-zinc-600 text-xs mt-0.5">{filename}</p>
          </div>
          <button
            onClick={downloadCSV}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm rounded-lg transition-colors"
          >
            ⬇ Download CSV
          </button>
        </div>

        {/* ── Stat cards row 1 ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3  mb-3">
          <StatCard
            label="Total Transactions"
            value={rows.length}
            color="text-white"
          />
          <StatCard
            label="Total Debited"
            value={`₹${fmt(totalDebit)}`}
            color="text-rose-400"
          />
          <StatCard
            label="Total Credited"
            value={`₹${fmt(totalCredit)}`}
            color="text-emerald-400"
          />
          <StatCard
            label="Net Flow"
            value={`${netFlow >= 0 ? "+" : ""}₹${fmt(Math.abs(netFlow))}`}
            color={netFlow >= 0 ? "text-emerald-400" : "text-rose-400"}
            sub={netFlow >= 0 ? "surplus" : "deficit"}
          />
        </div>

        {/* ── Stat cards row 2 ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <StatCard
            label="Avg Debit"
            value={`₹${fmt(avgDebit)}`}
            color="text-orange-400"
            sub="per transaction"
          />
          <StatCard
            label="Avg Credit"
            value={`₹${fmt(avgCredit)}`}
            color="text-sky-400"
            sub="per transaction"
          />
          <StatCard
            label="Failed Transactions"
            value={failed}
            color={failed > 0 ? "text-rose-400" : "text-zinc-400"}
            sub={`${completed} completed`}
          />
          {topMerchant && (
            <StatCard
              label="Top Merchant"
              value={topMerchant.name}
              color="text-amber-400"
              sub={`${topMerchant.count} payments`}
              small
            />
          )}
        </div>

        {/* ── Biggest transactions ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          {biggestDebit.Amount && (
            <div className=" bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1">
                  Largest Debit
                </p>
                <p className="text-2xl font-black text-rose-400">
                  ₹{fmt(parseFloat(biggestDebit.Amount))}
                </p>
                <p className="text-zinc-400 text-xs mt-1 truncate max-w-[200px]">
                  {biggestDebit.Party || "—"} · {biggestDebit.Date}
                </p>
              </div>
              <span className="text-4xl opacity-20">↑</span>
            </div>
          )}
          {biggestCredit.Amount && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1">
                  Largest Credit
                </p>
                <p className="text-2xl font-black text-emerald-400">
                  ₹{fmt(parseFloat(biggestCredit.Amount))}
                </p>
                <p className="text-zinc-400 text-xs mt-1 truncate max-w-[200px]">
                  {biggestCredit.Party || "—"} · {biggestCredit.Date}
                </p>
              </div>
              <span className="text-4xl opacity-20">↓</span>
            </div>
          )}
        </div>

        {/* ── Monthly debit vs credit (fixed sort) ── */}
        <ChartCard title="Monthly Debit vs Credit" sub="Chronological order">
          <canvas ref={monthlyRef} />
        </ChartCard>

        {/* ── Daily + Cumulative ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-0">
          <ChartCard title="Daily Spend" sub="Last 30 days with transactions">
            <canvas ref={dailyRef} />
          </ChartCard>
          <ChartCard title="Cumulative Spend" sub="Running total of all debits">
            <canvas ref={cumulativeRef} />
          </ChartCard>
        </div>

        {/* ── Top merchants + Doughnut ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-0">
          <ChartCard title="Top Merchants" sub="By total amount spent">
            <canvas ref={merchantRef} />
          </ChartCard>
          <ChartCard title="Debit vs Credit" sub="By total ₹ amount">
            <div className="flex items-center justify-center py-2">
              <canvas ref={doughnutRef} className="max-w-[220px]" />
            </div>
          </ChartCard>
        </div>

        {/* ── Hourly pattern ── */}
        <ChartCard
          title="Spending by Hour of Day"
          sub="Which hours you spend the most"
        >
          <canvas ref={hourlyRef} />
        </ChartCard>
      </div>
    </div>
  );
}

// ── Reusable components ───────────────────────────────────────

function StatCard({ label, value, color, sub, small }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4">
      <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">
        {label}
      </p>
      <p
        className={`font-black tracking-tight truncate ${color} ${small ? "text-base" : "text-2xl"}`}
      >
        {value}
      </p>
      {sub && <p className="text-zinc-600 text-[11px] mt-0.5">{sub}</p>}
    </div>
  );
}

function ChartCard({ title, sub, children }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-3">
      <p className="text-sm font-semibold text-zinc-200">{title}</p>
      {sub && <p className="text-[11px] text-zinc-600 mb-4">{sub}</p>}
      {children}
    </div>
  );
}

// ── Custom hook: create chart, destroy on dep change ──────────
function useChartEffect(ref, factory, deps) {
  useEffect(() => {
    if (!ref.current) return;
    const chart = factory();
    return () => chart.destroy();
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}
