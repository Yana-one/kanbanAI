import React from "react";
import { Task_Item, Task_Priority, Task_Status } from "../types/task_types";
import { TaskCard } from "./task_card";

interface PendingTaskListProps {
  pending_tasks: Task_Item[];
  is_ai_organizing: boolean;
  ai_progress_label: string;
  run_ai_organize: () => Promise<void>;
  on_edit_task: (
    task_id: string,
    update_params: {
      title: string;
      description?: string;
      category: string;
      priority: Task_Priority;
      status: Task_Status;
    }
  ) => Promise<boolean>;
  on_delete_task: (task_id: string) => void;
  on_delete_all_pending: () => Promise<void>;
}

/** AI 분석 대기 카드 리스트 컴포넌트 */
export function PendingTaskList({
  pending_tasks,
  is_ai_organizing,
  ai_progress_label,
  run_ai_organize,
  on_edit_task,
  on_delete_task,
  on_delete_all_pending,
}: PendingTaskListProps) {
  const can_run_ai_organize = pending_tasks.length > 0 && !is_ai_organizing;

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-900">AI 분석 대기</h2>
        <span className="text-xs text-zinc-500">{ai_progress_label}</span>
      </div>

      <button
        type="button"
        className="mb-4 w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white opacity-90"
        disabled={!can_run_ai_organize}
        onClick={run_ai_organize}
      >
        {is_ai_organizing ? "AI 정리 중..." : "AI 정리"}
      </button>

      <button
        type="button"
        className="mb-4 w-full rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600"
        onClick={() => void on_delete_all_pending()}
      >
        대기 작업 모두 삭제
      </button>

      <div className="space-y-3">
        {pending_tasks.length > 0 ? (
          pending_tasks.map((task_item) => (
            <TaskCard
              key={task_item.id}
              task_item={task_item}
              on_edit_task={on_edit_task}
              on_delete_task={on_delete_task}
            />
          ))
        ) : (
          <p className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-500">대기 중인 카드가 없습니다.</p>
        )}
      </div>
    </section>
  );
}
