import { useEffect, useMemo, useState } from "react";
import { Planner_Task_Draft, Task_Analysis_Result } from "../services/ai_service";
import { task_service } from "../services/task_service";
import { Task_Item, Task_Priority, Task_Status } from "../types/task_types";

type Update_Task_Params = {
  title: string;
  description?: string;
  category: string;
  priority: Task_Priority;
  status: Task_Status;
};

type Priority_Filter = "all" | Task_Priority;

/** 보드 전체 상태/이벤트를 관리하는 훅 */
export function useBoardTasks() {
  const [all_tasks, set_all_tasks] = useState<Task_Item[]>([]);
  const [is_loading, set_is_loading] = useState<boolean>(true);
  const [selected_category, set_selected_category] = useState<string>("all");
  const [selected_priority, set_selected_priority] = useState<Priority_Filter>("all");
  const [error_message, set_error_message] = useState<string>("");

  /** 공통 에러 메시지 설정 */
  const set_common_error_message = () => {
    set_error_message("요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  };
  /** 입력값 정리 */
  const normalize_text = (input_value?: string): string => (input_value ?? "").trim();
  /** 현재 시각 ISO 문자열 생성 */
  const get_now_iso_string = (): string => new Date().toISOString();

  /** 고유 ID 생성 */
  const generate_task_id = (): string => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `task_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  };

  /** AI 분석 결과를 특정 카드에 반영 */
  const apply_ai_result_to_task = async (
    task_id: string,
    analysis_result: Task_Analysis_Result
  ): Promise<void> => {
    try {
      let updated_task: Task_Item | null = null;
      set_all_tasks((previous_tasks) =>
        previous_tasks.map((task_item) => {
          if (task_item.id !== task_id) {
            return task_item;
          }

          const next_task = {
            ...task_item,
            category: analysis_result.category,
            priority: analysis_result.priority,
            status: analysis_result.status,
            is_ai_analyzed: true,
            updatedAt: get_now_iso_string(),
          };
          updated_task = next_task;
          return next_task;
        })
      );

      if (updated_task) {
        await task_service.update_task(updated_task);
      }
    } catch (error) {
      console.error("[use_board_tasks] apply_ai_result_to_task 오류:", error);
      set_common_error_message();
    }
  };

  /** 새 카드 생성 */
  const create_task = async (title: string, description?: string): Promise<boolean> => {
    try {
      const normalized_title = normalize_text(title);
      if (!normalized_title) {
        set_common_error_message();
        return false;
      }

      const now_iso_string = get_now_iso_string();
      const new_task: Task_Item = {
        id: generate_task_id(),
        title: normalized_title,
        description: normalize_text(description),
        category: "미분류",
        priority: "medium",
        status: "todo",
        createdAt: now_iso_string,
        updatedAt: now_iso_string,
        is_ai_analyzed: false,
        estimated_minutes: 60,
        scheduled_start_at: "",
        scheduled_end_at: "",
        source_type: "manual",
      };

      set_all_tasks((previous_tasks) => [new_task, ...previous_tasks]);
      await task_service.create_task(new_task);
      set_error_message("");
      return true;
    } catch (error) {
      console.error("[use_board_tasks] create_task 오류:", error);
      set_common_error_message();
      return false;
    }
  };

  /** 대화형 플래너에서 생성된 카드 일괄 저장 */
  const create_planned_tasks = async (planned_tasks: Planner_Task_Draft[]): Promise<number> => {
    try {
      const now_iso_string = get_now_iso_string();
      const created_tasks: Task_Item[] = planned_tasks
        .filter((task_item) => normalize_text(task_item.title).length > 0)
        .map((task_item) => ({
          id: generate_task_id(),
          title: normalize_text(task_item.title),
          description: normalize_text(task_item.description),
          category: normalize_text(task_item.category) || "기타",
          priority: task_item.priority,
          status: task_item.status,
          createdAt: now_iso_string,
          updatedAt: now_iso_string,
          is_ai_analyzed: true,
          estimated_minutes: Number(task_item.estimated_minutes) > 0 ? Number(task_item.estimated_minutes) : 60,
          scheduled_start_at: normalize_text(task_item.scheduled_start_at),
          scheduled_end_at: normalize_text(task_item.scheduled_end_at),
          source_type: "chat",
        }));

      if (created_tasks.length === 0) {
        return 0;
      }

      set_all_tasks((previous_tasks) => [...created_tasks, ...previous_tasks]);
      await Promise.all(created_tasks.map((task_item) => task_service.create_task(task_item)));
      set_error_message("");
      return created_tasks.length;
    } catch (error) {
      console.error("[use_board_tasks] create_planned_tasks 오류:", error);
      set_common_error_message();
      return 0;
    }
  };

  /** 카드 정보 수정 */
  const update_task = async (task_id: string, update_params: Update_Task_Params): Promise<boolean> => {
    try {
      const normalized_title = normalize_text(update_params.title);
      if (!normalized_title) {
        set_common_error_message();
        return false;
      }

      let updated_task: Task_Item | null = null;
      set_all_tasks((previous_tasks) =>
        previous_tasks.map((task_item) => {
          if (task_item.id !== task_id) {
            return task_item;
          }

          const next_task = {
            ...task_item,
            title: normalized_title,
            description: normalize_text(update_params.description),
            category: normalize_text(update_params.category) || "기타",
            priority: update_params.priority,
            status: update_params.status,
            updatedAt: get_now_iso_string(),
          };
          updated_task = next_task;
          return next_task;
        })
      );

      if (updated_task) {
        await task_service.update_task(updated_task);
      }
      set_error_message("");
      return true;
    } catch (error) {
      console.error("[use_board_tasks] update_task 오류:", error);
      set_common_error_message();
      return false;
    }
  };

  /** 카드 삭제 */
  const delete_task = async (task_id: string): Promise<boolean> => {
    try {
      set_all_tasks((previous_tasks) => previous_tasks.filter((task_item) => task_item.id !== task_id));
      await task_service.delete_task(task_id);
      set_error_message("");
      return true;
    } catch (error) {
      console.error("[use_board_tasks] delete_task 오류:", error);
      set_common_error_message();
      return false;
    }
  };

  /** 특정 상태 카드 전체 삭제 */
  const delete_tasks_by_status = async (
    target_status: "pending" | Task_Status
  ): Promise<boolean> => {
    try {
      const target_tasks = all_tasks.filter((task_item) =>
        target_status === "pending"
          ? !task_item.is_ai_analyzed
          : task_item.is_ai_analyzed && task_item.status === target_status
      );
      if (target_tasks.length === 0) {
        return true;
      }

      set_all_tasks((previous_tasks) =>
        previous_tasks.filter((task_item) => !target_tasks.some((target_task) => target_task.id === task_item.id))
      );

      await Promise.all(target_tasks.map((task_item) => task_service.delete_task(task_item.id)));
      set_error_message("");
      return true;
    } catch (error) {
      console.error("[use_board_tasks] delete_tasks_by_status 오류:", error);
      set_common_error_message();
      return false;
    }
  };

  /** 카드 상태 이동 (드래그앤드롭) */
  const move_task_status = async (task_id: string, target_status: Task_Status): Promise<boolean> => {
    try {
      let has_updated = false;
      let updated_task: Task_Item | null = null;
      set_all_tasks((previous_tasks) =>
        previous_tasks.map((task_item) => {
          if (task_item.id !== task_id || !task_item.is_ai_analyzed) {
            return task_item;
          }
          if (task_item.status === target_status) {
            return task_item;
          }

          has_updated = true;
          const next_task = {
            ...task_item,
            status: target_status,
            updatedAt: get_now_iso_string(),
          };
          updated_task = next_task;
          return next_task;
        })
      );

      if (has_updated && updated_task) {
        await task_service.update_task(updated_task);
      }

      set_error_message("");
      return has_updated;
    } catch (error) {
      console.error("[use_board_tasks] move_task_status 오류:", error);
      set_common_error_message();
      return false;
    }
  };

  /** 타임라인 시간 편집 저장 */
  const update_task_schedule = async (
    task_id: string,
    scheduled_start_at: string,
    scheduled_end_at: string
  ): Promise<boolean> => {
    try {
      let updated_task: Task_Item | null = null;
      set_all_tasks((previous_tasks) =>
        previous_tasks.map((task_item) => {
          if (task_item.id !== task_id) {
            return task_item;
          }
          const next_task = {
            ...task_item,
            scheduled_start_at: normalize_text(scheduled_start_at),
            scheduled_end_at: normalize_text(scheduled_end_at),
            updatedAt: get_now_iso_string(),
          };
          updated_task = next_task;
          return next_task;
        })
      );

      if (updated_task) {
        await task_service.update_task(updated_task);
      }
      return Boolean(updated_task);
    } catch (error) {
      console.error("[use_board_tasks] update_task_schedule 오류:", error);
      set_common_error_message();
      return false;
    }
  };

  const reset_filters = () => {
    set_selected_category("all");
    set_selected_priority("all");
  };
  const clear_error_message = () => {
    set_error_message("");
  };

  /** Firestore에서 초기 카드 목록 로딩 */
  useEffect(() => {
    const load_initial_tasks = async () => {
      try {
        const task_items = await task_service.list_tasks();
        set_all_tasks(task_items);
      } catch (error) {
        console.error("[use_board_tasks] 초기 데이터 로딩 오류:", error);
        set_common_error_message();
        set_all_tasks([]);
      } finally {
        set_is_loading(false);
      }
    };
    load_initial_tasks();
  }, []);

  const pending_tasks = useMemo(() => all_tasks.filter((task_item) => !task_item.is_ai_analyzed), [all_tasks]);
  const board_tasks = useMemo(() => all_tasks.filter((task_item) => task_item.is_ai_analyzed), [all_tasks]);

  const filtered_board_tasks = useMemo(
    () =>
      board_tasks.filter((task_item) => {
        const is_category_matched = selected_category === "all" || task_item.category === selected_category;
        const is_priority_matched = selected_priority === "all" || task_item.priority === selected_priority;
        return is_category_matched && is_priority_matched;
      }),
    [board_tasks, selected_category, selected_priority]
  );

  const todo_tasks = useMemo(
    () => filtered_board_tasks.filter((task_item) => task_item.status === "todo"),
    [filtered_board_tasks]
  );
  const in_progress_tasks = useMemo(
    () => filtered_board_tasks.filter((task_item) => task_item.status === "in_progress"),
    [filtered_board_tasks]
  );
  const done_tasks = useMemo(
    () => filtered_board_tasks.filter((task_item) => task_item.status === "done"),
    [filtered_board_tasks]
  );
  const timeline_tasks = useMemo(
    () =>
      board_tasks
        .filter((task_item) => task_item.scheduled_start_at && task_item.scheduled_end_at)
        .sort((left_item, right_item) =>
          String(left_item.scheduled_start_at).localeCompare(String(right_item.scheduled_start_at))
        ),
    [board_tasks]
  );

  const category_options = useMemo(() => {
    const category_set = new Set<string>(["all"]);
    for (const task_item of all_tasks) {
      category_set.add(task_item.category);
    }
    return Array.from(category_set);
  }, [all_tasks]);

  return {
    all_tasks,
    pending_tasks,
    todo_tasks,
    in_progress_tasks,
    done_tasks,
    timeline_tasks,
    board_tasks_count: board_tasks.length,
    filtered_board_tasks_count: filtered_board_tasks.length,
    selected_category,
    selected_priority,
    category_options,
    error_message,
    is_loading,
    create_task,
    create_planned_tasks,
    update_task,
    delete_task,
    move_task_status,
    delete_tasks_by_status,
    update_task_schedule,
    reset_filters,
    clear_error_message,
    set_selected_category,
    set_selected_priority,
    apply_ai_result_to_task,
  } satisfies {
    all_tasks: Task_Item[];
    pending_tasks: Task_Item[];
    todo_tasks: Task_Item[];
    in_progress_tasks: Task_Item[];
    done_tasks: Task_Item[];
    timeline_tasks: Task_Item[];
    board_tasks_count: number;
    filtered_board_tasks_count: number;
    selected_category: string;
    selected_priority: Priority_Filter;
    category_options: string[];
    error_message: string;
    is_loading: boolean;
    create_task: (title: string, description?: string) => Promise<boolean>;
    create_planned_tasks: (planned_tasks: Planner_Task_Draft[]) => Promise<number>;
    update_task: (task_id: string, update_params: Update_Task_Params) => Promise<boolean>;
    delete_task: (task_id: string) => Promise<boolean>;
    move_task_status: (task_id: string, target_status: Task_Status) => Promise<boolean>;
    delete_tasks_by_status: (target_status: "pending" | Task_Status) => Promise<boolean>;
    update_task_schedule: (
      task_id: string,
      scheduled_start_at: string,
      scheduled_end_at: string
    ) => Promise<boolean>;
    reset_filters: () => void;
    clear_error_message: () => void;
    set_selected_category: (value: string) => void;
    set_selected_priority: (value: Priority_Filter) => void;
    apply_ai_result_to_task: (task_id: string, analysis_result: Task_Analysis_Result) => Promise<void>;
  };
}
