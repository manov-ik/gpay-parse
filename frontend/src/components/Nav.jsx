import { Link, useLocation } from "react-router-dom";

export default function Nav({ onClear }) {
  const { pathname } = useLocation();

  return (
    <nav className="border-b border-zinc-800 bg-zinc-950 px-6 py-3 flex items-center justify-between sticky top-0 z-50">
      <Link to="/" className="text-lg font-black tracking-tight select-none">
        gpay<span className="text-emerald-400">.</span>parse
      </Link>

      <div className="flex items-center gap-4">
        <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
          {[
            { label: "Dashboard", to: "/dashboard" },
            { label: "History", to: "/history" },
          ].map(({ label, to }) => (
            <Link
              key={to}
              to={to}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                pathname === to
                  ? "bg-zinc-700 text-white"
                  : "text-zinc-500 hover:text-white"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        <button
          onClick={onClear}
          className="text-xs text-zinc-600 hover:text-rose-400 transition-colors"
          title="Clear data and upload new file"
        >
          ✕ Clear
        </button>
      </div>
    </nav>
  );
}
