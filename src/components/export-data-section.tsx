"use client";

import { useCallback, useRef, useState } from "react";

export function ExportDataSection() {
  return (
    <section className="rounded-[18px] border border-hairline bg-canvas p-5">
      <h2 className="text-lg font-semibold text-ink">Backup & Export</h2>
      <p className="mt-1 text-sm text-steel">
        Xuất toàn bộ dữ liệu cá nhân để sao lưu hoặc dùng ngoài app.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <ExportButton format="json" label="Export JSON" />
        <ExportButton format="markdown" label="Export Markdown" />
        <ImportButton />
      </div>
    </section>
  );
}

function ExportButton({ format, label }: { format: string; label: string }) {
  const [loading, setLoading] = useState(false);

  const handleExport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/export/personal?format=${format}`);
      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const filenameMatch = disposition.match(/filename="([^"]+)"/);
      const filename = filenameMatch?.[1] ?? `cuochop-export.${format === "markdown" ? "md" : "json"}`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("Không thể export dữ liệu. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, [format]);

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={loading}
      className="inline-flex h-10 items-center gap-2 rounded-full border border-hairline bg-canvas px-5 text-sm font-semibold text-ink transition hover:border-primary hover:text-primary disabled:opacity-50"
    >
      {loading ? "Đang export..." : label}
    </button>
  );
}

function ImportButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImport = useCallback(async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      fileRef.current?.click();
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.error?.message ?? "Import failed");

      const imported = body.imported as { meetings: number; actions: number; decisions: number };
      setResult(`Đã import: ${imported.meetings} meetings, ${imported.actions} actions, ${imported.decisions} decisions`);
    } catch (err) {
      setResult(err instanceof Error ? err.message : "Không thể import. Kiểm tra file JSON.");
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, []);

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <input
        ref={fileRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleImport}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={loading}
        className="inline-flex h-10 items-center gap-2 rounded-full border border-hairline bg-canvas px-5 text-sm font-semibold text-ink transition hover:border-primary hover:text-primary disabled:opacity-50"
      >
        {loading ? "Đang import..." : "Import JSON"}
      </button>
      {result && (
        <p className="text-xs text-steel">{result}</p>
      )}
    </div>
  );
}
