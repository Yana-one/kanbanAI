import React from "react";
import { BoardColumn } from "./components/board_column";
import { PendingTaskList } from "./components/pending_task_list";
import { TaskInput } from "./components/task_input";
import { BOARD_COLUMN_LABELS, PRIORITY_FILTER_OPTIONS } from "./constants/board_constants";
import { useAiOrganize } from "./hooks/use_ai_organize";
import { useBoardTasks } from "./hooks/use_board_tasks";
import { Task_Status } from "./types/task_types";

/** 칸반보드 페이지 */
export function BoardPage() {
  const {
    pending_tasks,
    todo_tasks,
    in_progress_tasks,
    done_tasks,
    board_tasks_count,
    filtered_board_tasks_count,
    selected_category,
    selected_priority,
    category_options,
    error_message,
    is_loading,
    create_task,
    update_task,
    delete_task,
    delete_tasks_by_status,
    move_task_status,
    reset_filters,
    clear_error_message,
    set_selected_category,
    set_selected_priority,
    apply_ai_result_to_task,
  } = useBoardTasks();
  const { is_ai_organizing, ai_progress_label, run_ai_organize } = useAiOrganize({
    pending_tasks,
    apply_ai_result_to_task,
  });
  const [dragging_task_id, set_dragging_task_id] = React.useState<string | null>(null);

  /** 드래그 시작 처리 */
  const handle_drag_start_task = (task_id: string) => {
    set_dragging_task_id(task_id);
  };

  /** 컬럼 드롭 처리 */
  const handle_drop_task = async (target_status: Task_Status) => {
    if (!dragging_task_id) {
      return;
    }
    await move_task_status(dragging_task_id, target_status);
    set_dragging_task_id(null);
  };

  /** 단건 즉시 삭제 */
  const handle_delete_task = (task_id: string) => {
    void delete_task(task_id);
  };

  /** 상태별 전체 삭제 */
  const handle_delete_all_pending = async () => {
    await delete_tasks_by_status("pending");
  };
  const handle_delete_all_by_column = async (status: Task_Status) => {
    await delete_tasks_by_status(status);
  };

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-6 text-zinc-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h1 className="text-xl font-bold">AI 칸반보드</h1>
          <p className="mt-1 text-sm text-zinc-600">
            할 일을 입력하면 AI 분석 대기 영역에 쌓이고, AI 정리로 자동 분류해 보드에 배치합니다.
          </p>
        </header>

        {error_message ? (
          <section className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <div className="flex items-center justify-between gap-2">
              <p>{error_message}</p>
              <button
                type="button"
                className="rounded-lg border border-red-300 px-2 py-1 text-xs"
                onClick={clear_error_message}
              >
                닫기
              </button>
            </div>
            <p className="mt-1 text-xs text-red-600">
              문제가 계속되면 네트워크 상태를 확인한 뒤 다시 시도해 주세요.
            </p>
          </section>
        ) : null}

        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex flex-1 flex-col gap-2 sm:flex-row">
              <select
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700"
                value={selected_category}
                onChange={(event) => set_selected_category(event.target.value)}
              >
                {category_options.map((category_option) => (
                  <option key={category_option} value={category_option}>
                    카테고리: {category_option === "all" ? "전체" : category_option}
                  </option>
                ))}
              </select>

              <select
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700"
                value={selected_priority}
                onChange={(event) => set_selected_priority(event.target.value as "all" | "high" | "medium" | "low")}
              >
                {PRIORITY_FILTER_OPTIONS.map((priority_option) => (
                  <option key={priority_option} value={priority_option}>
                    우선순위: {priority_option}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700"
              onClick={reset_filters}
            >
              필터 초기화
            </button>
          </div>

          <p className="mt-2 text-xs text-zinc-500">
            총 {board_tasks_count}개 중 {filtered_board_tasks_count}개 표시
          </p>
        </section>

        {is_loading ? (
          <section className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm">
            Firebase 데이터 로딩 중...
          </section>
        ) : null}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <div className="space-y-4 lg:col-span-1">
            <TaskInput create_task={create_task} />
            <PendingTaskList
              pending_tasks={pending_tasks}
              is_ai_organizing={is_ai_organizing}
              ai_progress_label={ai_progress_label}
              run_ai_organize={run_ai_organize}
              on_edit_task={update_task}
              on_delete_task={handle_delete_task}
              on_delete_all_pending={handle_delete_all_pending}
            />
          </div>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:col-span-3">
            <BoardColumn
              title={BOARD_COLUMN_LABELS.todo}
              status="todo"
              tasks={todo_tasks}
              dragging_task_id={dragging_task_id}
              on_drag_start_task={handle_drag_start_task}
              on_drop_task={handle_drop_task}
              on_edit_task={update_task}
              on_delete_task={handle_delete_task}
              on_delete_all_tasks_in_column={handle_delete_all_by_column}
            />
            <BoardColumn
              title={BOARD_COLUMN_LABELS.in_progress}
              status="in_progress"
              tasks={in_progress_tasks}
              is_drop_target
              dragging_task_id={dragging_task_id}
              on_drag_start_task={handle_drag_start_task}
              on_drop_task={handle_drop_task}
              on_edit_task={update_task}
              on_delete_task={handle_delete_task}
              on_delete_all_tasks_in_column={handle_delete_all_by_column}
            />
            <BoardColumn
              title={BOARD_COLUMN_LABELS.done}
              status="done"
              tasks={done_tasks}
              dragging_task_id={dragging_task_id}
              on_drag_start_task={handle_drag_start_task}
              on_drop_task={handle_drop_task}
              on_edit_task={update_task}
              on_delete_task={handle_delete_task}
              on_delete_all_tasks_in_column={handle_delete_all_by_column}
            />
          </section>
        </div>
      </div>
    </main>
  );
}
