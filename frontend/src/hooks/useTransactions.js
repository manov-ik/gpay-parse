import { useState, useEffect } from "react";

const SESSION_KEY = "gpay_rows";
const FILE_KEY = "gpay_filename";

/**
 * Single source of truth for transaction data.
 * Reads from / writes to sessionStorage so data survives
 * navigation and page refreshes within the same tab.
 */
export function useTransactions() {
  const [rows, setRows] = useState(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [filename, setFilenameState] = useState(
    () => sessionStorage.getItem(FILE_KEY) ?? "",
  );

  function saveRows(newRows, newFilename) {
    setRows(newRows);
    setFilenameState(newFilename ?? "");
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(newRows));
      if (newFilename) sessionStorage.setItem(FILE_KEY, newFilename);
    } catch (e) {
      console.warn("sessionStorage full or unavailable", e);
    }
  }

  function clearRows() {
    setRows([]);
    setFilenameState("");
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(FILE_KEY);
  }

  return { rows, filename, saveRows, clearRows };
}
