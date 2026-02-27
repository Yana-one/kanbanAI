import React from "react";
import { Task_Item, Task_Priority, Task_Status } from "../types/task_types";
import { TaskCard } from "./task_card";

interface BoardColumnProps {
  title: string;
  status: Task_Status;
  tasks: Task_Item[];
  is_drop_target?: boolean;
  dragging_task_id: string | null;
  on_drag_start_task: (task_id: string) => void;
  on_drop_task: (target_status: Task_Status) => void;
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
  on_delete_all_tasks_in_column: (status: Task_Status) => Promise<void>;
}

/** 칸반 컬럼 UI 컴포넌트 */
export function BoardColumn({
  title,
  status,
  tasks,
  is_drop_target = false,
  dragging_task_id,
  on_drag_start_task,
  on_drop_task,
  on_edit_task,
  on_delete_task,
  on_delete_all_tasks_in_column,
}: BoardColumnProps) {
  return (
    <section
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        on_drop_task(status);
      }}
      className={[
        "rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition",
        is_drop_target ? "ring-2 ring-blue-400 bg-blue-50" : "",
      ].join(" ")}
      aria-label={status}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-600">{tasks.length}</span>
          <button
            type="button"
            className="rounded-lg border border-red-300 px-2 py-1 text-[11px] text-red-600"
            onClick={() => void on_delete_all_tasks_in_column(status)}
          >
            모두 삭제
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {tasks.length > 0 ? (
          tasks.map((task_item) => (
            <TaskCard
              key={task_item.id}
              task_item={task_item}
              is_draggable
              is_dragging={dragging_task_id === task_item.id}
              on_drag_start={on_drag_start_task}
              on_edit_task={on_edit_task}
              on_delete_task={on_delete_task}
            />
          ))
        ) : (
          <p className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-500">카드가 없습니다.</p>
        )}
      </div>
    </section>
  );
}
