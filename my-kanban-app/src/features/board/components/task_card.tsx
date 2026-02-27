import React from "react";
import { Task_Item, Task_Priority, Task_Status } from "../types/task_types";

interface TaskCardProps {
  task_item: Task_Item;
  is_dragging?: boolean;
  is_draggable?: boolean;
  on_drag_start?: (task_id: string) => void;
  on_edit_task?: (
    task_id: string,
    update_params: {
      title: string;
      description?: string;
      category: string;
      priority: Task_Priority;
      status: Task_Status;
    }
  ) => Promise<boolean>;
  on_delete_task?: (task_id: string) => void;
}

/** 작업 카드 UI 컴포넌트 */
export function TaskCard({
  task_item,
  is_dragging = false,
  is_draggable = false,
  on_drag_start,
  on_edit_task,
  on_delete_task,
}: TaskCardProps) {
  const [is_edit_mode, set_is_edit_mode] = React.useState(false);
  const [title_input, set_title_input] = React.useState(task_item.title);
  const [description_input, set_description_input] = React.useState(task_item.description ?? "");
  const [category_input, set_category_input] = React.useState(task_item.category);
  const [priority_input, set_priority_input] = React.useState<Task_Priority>(task_item.priority);
  const [status_input, set_status_input] = React.useState<Task_Status>(task_item.status);

  React.useEffect(() => {
    set_title_input(task_item.title);
    set_description_input(task_item.description ?? "");
    set_category_input(task_item.category);
    set_priority_input(task_item.priority);
    set_status_input(task_item.status);
  }, [task_item]);

  /** 수정 저장 이벤트 처리 */
  const handle_save_edit = async () => {
    if (!on_edit_task) {
      return;
    }

    const is_success = await on_edit_task(task_item.id, {
      title: title_input,
      description: description_input,
      category: category_input,
      priority: priority_input,
      status: status_input,
    });
    if (!is_success) {
      return;
    }

    set_is_edit_mode(false);
  };

  const priority_color_class = {
    high: "bg-red-100 text-red-700",
    medium: "bg-yellow-100 text-yellow-700",
    low: "bg-green-100 text-green-700",
  }[task_item.priority];

  if (is_edit_mode) {
    return (
      <article className="rounded-xl border border-zinc-300 bg-white p-3 shadow-sm">
        <div className="space-y-2">
          <input
            className="w-full rounded-lg border border-zinc-300 px-2 py-2 text-xs outline-none focus:border-blue-500"
            value={title_input}
            onChange={(event) => set_title_input(event.target.value)}
            placeholder="제목"
          />
          <textarea
            className="h-20 w-full resize-none rounded-lg border border-zinc-300 px-2 py-2 text-xs outline-none focus:border-blue-500"
            value={description_input}
            onChange={(event) => set_description_input(event.target.value)}
            placeholder="설명"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              className="rounded-lg border border-zinc-300 px-2 py-2 text-xs outline-none focus:border-blue-500"
              value={category_input}
              onChange={(event) => set_category_input(event.target.value)}
              placeholder="카테고리"
            />
            <select
              className="rounded-lg border border-zinc-300 px-2 py-2 text-xs outline-none focus:border-blue-500"
              value={priority_input}
              onChange={(event) => set_priority_input(event.target.value as Task_Priority)}
            >
              <option value="high">high</option>
              <option value="medium">medium</option>
              <option value="low">low</option>
            </select>
          </div>
          <select
            className="w-full rounded-lg border border-zinc-300 px-2 py-2 text-xs outline-none focus:border-blue-500"
            value={status_input}
            onChange={(event) => set_status_input(event.target.value as Task_Status)}
          >
            <option value="todo">todo</option>
            <option value="in_progress">in_progress</option>
            <option value="done">done</option>
          </select>
          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 rounded-lg bg-blue-600 px-2 py-2 text-xs font-medium text-white"
              onClick={handle_save_edit}
            >
              저장
            </button>
            <button
              type="button"
              className="flex-1 rounded-lg border border-zinc-300 px-2 py-2 text-xs text-zinc-700"
              onClick={() => set_is_edit_mode(false)}
            >
              취소
            </button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      draggable={is_draggable}
      onDragStart={() => on_drag_start?.(task_item.id)}
      className={[
        "rounded-xl border border-zinc-200 bg-white p-3 shadow-sm transition",
        is_dragging ? "scale-105 rotate-1 shadow-xl opacity-95" : "",
      ].join(" ")}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <h4 className="text-sm font-semibold text-zinc-900">{task_item.title}</h4>
        <span className={`rounded-full px-2 py-1 text-xs font-medium ${priority_color_class}`}>
          {task_item.priority}
        </span>
      </div>

      {task_item.description ? (
        <p className="mb-3 text-xs text-zinc-600">{task_item.description}</p>
      ) : null}

      <div className="flex items-center justify-between">
        <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-700">
          {task_item.category}
        </span>
        {!task_item.is_ai_analyzed ? (
          <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700">
            AI 미분석
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="flex-1 rounded-lg border border-zinc-300 px-2 py-1 text-xs text-zinc-700"
          onClick={() => set_is_edit_mode(true)}
        >
          수정
        </button>
        <button
          type="button"
          className="flex-1 rounded-lg border border-red-300 px-2 py-1 text-xs text-red-600"
          onClick={() => on_delete_task?.(task_item.id)}
        >
          삭제
        </button>
      </div>
    </article>
  );
}
