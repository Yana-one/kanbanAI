import { useMemo, useState } from "react";
import { Task_Item } from "../types/task_types";
import { ai_service, Task_Analysis_Result } from "../services/ai_service";

interface UseAiOrganizeParams {
  pending_tasks: Task_Item[];
  apply_ai_result_to_task: (task_id: string, analysis_result: Task_Analysis_Result) => Promise<void>;
}

/** AI 정리 실행/진행률 상태 훅 */
export function useAiOrganize({
  pending_tasks,
  apply_ai_result_to_task,
}: UseAiOrganizeParams) {
  const [is_ai_organizing, set_is_ai_organizing] = useState(false);
  const [completed_count, set_completed_count] = useState(0);
  const [total_count, set_total_count] = useState(0);

  /** 대기 카드 일괄 분석 실행 */
  const run_ai_organize = async () => {
    if (is_ai_organizing || pending_tasks.length === 0) {
      return;
    }

    set_is_ai_organizing(true);
    set_total_count(pending_tasks.length);
    set_completed_count(0);

    for (const task_item of pending_tasks) {
      try {
        const analysis_result = await ai_service.analyze_task({
          title: task_item.title,
          description: task_item.description,
        });
        apply_ai_result_to_task(task_item.id, analysis_result);
      } catch (error) {
        console.error("[use_ai_organize] 카드 분석 실패:", {
          task_id: task_item.id,
          error,
        });
      } finally {
        set_completed_count((previous_count) => previous_count + 1);
      }
    }

    set_is_ai_organizing(false);
  };

  const ai_progress_label = useMemo(() => {
    if (!is_ai_organizing) {
      return `${pending_tasks.length}개 대기 중`;
    }

    return `${completed_count} / ${total_count} 분석 완료`;
  }, [completed_count, is_ai_organizing, pending_tasks.length, total_count]);

  return {
    is_ai_organizing,
    ai_progress_label,
    run_ai_organize,
  };
}
