import React from "react";

interface DeleteTaskModalProps {
  is_open: boolean;
  task_title: string;
  on_confirm: () => void;
  on_cancel: () => void;
}

/** 삭제 확인 모달 UI 컴포넌트 */
export function DeleteTaskModal({ is_open, task_title, on_confirm, on_cancel }: DeleteTaskModalProps) {
  if (!is_open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <section className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold text-zinc-900">카드를 삭제하시겠습니까?</h3>
        <p className="mb-3 text-xs text-zinc-600">
          "{task_title}" 카드는 삭제 후 복구할 수 없습니다.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-xs text-zinc-700"
            onClick={on_cancel}
          >
            취소
          </button>
          <button
            type="button"
            className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white"
            onClick={on_confirm}
          >
            삭제
          </button>
        </div>
      </section>
    </div>
  );
}
