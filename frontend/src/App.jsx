import { Routes, Route, useNavigate } from "react-router-dom";
import { useTransactions } from "./hooks/useTransactions";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import History from "./pages/History";

export default function App() {
  const { rows, filename, saveRows, clearRows } = useTransactions();
  const navigate = useNavigate();

  function handleClear() {
    clearRows();
    navigate("/");
  }

  return (
    <Routes>
      <Route path="/" element={<Home saveRows={saveRows} rows={rows} />} />
      <Route
        path="/dashboard"
        element={
          <Dashboard rows={rows} filename={filename} onClear={handleClear} />
        }
      />
      <Route
        path="/history"
        element={
          <History rows={rows} filename={filename} onClear={handleClear} />
        }
      />
    </Routes>
  );
}
