"use client";

import { useState, useTransition } from "react";
import { addTransaction } from "@/lib/actions/transactions";

export default function AddTransactionForm() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const today = new Date().toISOString().slice(0, 10);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await addTransaction(formData);
      if (result.ok) {
        setOpen(false);
      } else {
        setError(result.error || "保存に失敗しました");
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-700"
      >
        + 取引を追加
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <div className="border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">取引を追加</h2>
          <button
            onClick={() => setOpen(false)}
            className="text-gray-400 hover:text-gray-600"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        <form action={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                日付 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="date"
                defaultValue={today}
                required
                className="w-full border rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                種別 <span className="text-red-500">*</span>
              </label>
              <select
                name="type"
                defaultValue="expense"
                required
                className="w-full border rounded-md px-3 py-2 text-sm"
              >
                <option value="expense">支出</option>
                <option value="income">収入</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">
              内容 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="description"
              placeholder="例: スターバックス 渋谷店"
              required
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">
              金額(税込) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="amount"
              placeholder="0"
              min="1"
              step="1"
              required
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">
              メモ(任意)
            </label>
            <textarea
              name="note"
              rows={2}
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2 border rounded-md text-sm hover:bg-gray-50"
              disabled={isPending}
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm hover:bg-gray-700 disabled:opacity-50"
            >
              {isPending ? "保存中..." : "保存"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}