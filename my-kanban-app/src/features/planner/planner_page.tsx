import React from "react";
import { PlannerChatMessage, PlannerChatPanel } from "../board/components/planner_chat_panel";
import { TimelineView } from "../board/components/timeline_view";
import { useBoardTasks } from "../board/hooks/use_board_tasks";
import { ai_service, Planner_Task_Draft } from "../board/services/ai_service";

/** 플래너 페이지 */
export function PlannerPage() {
  const {
    timeline_tasks,
    create_planned_tasks,
    update_task_schedule,
    update_task,
    is_loading,
    error_message,
  } = useBoardTasks();
  const [is_planning, set_is_planning] = React.useState(false);
  const [planning_message, set_planning_message] = React.useState(
    "자연스럽게 오늘 할 일을 입력하면 시간 블록으로 자동 배치합니다."
  );
  const [messages, set_messages] = React.useState<PlannerChatMessage[]>([]);
  const planner_defaults = React.useMemo(
    () => ({
      available_start_time: "09:00",
      available_end_time: "22:00",
      focus_minutes: 60,
      break_minutes: 10,
      lunch_start_time: "12:00",
      lunch_end_time: "13:00",
    }),
    []
  );

  /** 채팅 메시지 추가 */
  const append_message = (role: "user" | "assistant", text: string) => {
    set_messages((previous_messages) => [
      ...previous_messages,
      {
        id: `${Date.now()}_${Math.floor(Math.random() * 100000)}`,
        role,
        text,
        created_at: new Date().toISOString(),
      },
    ]);
  };

  /** AI 정리 텍스트 라인 기준으로 타임블록용 task 재구성 */
  const build_tasks_from_summary_lines = (
    summary_lines: string[],
    fallback_tasks: Planner_Task_Draft[]
  ): Planner_Task_Draft[] => {
    const parsed_tasks = summary_lines
      .map((line_text) => line_text.match(/-\s*(\d{2}:\d{2})\s*~\s*(\d{2}:\d{2})\s*(.+)$/))
      .map((matched_value, index_value) => {
        if (!matched_value) {
          return null;
        }
        const fallback_task = fallback_tasks[index_value];
        return {
          title: matched_value[3].trim(),
          description: fallback_task?.description ?? "",
          category: fallback_task?.category ?? "기타",
          priority: fallback_task?.priority ?? "medium",
          status: fallback_task?.status ?? "todo",
          estimated_minutes: fallback_task?.estimated_minutes ?? 60,
          scheduled_start_at: matched_value[1],
          scheduled_end_at: matched_value[2],
        } satisfies Planner_Task_Draft;
      })
      .filter(Boolean) as Planner_Task_Draft[];

    return parsed_tasks.length > 0 ? parsed_tasks : fallback_tasks;
  };

  /** 문자열에서 HH:mm 시간 추출 */
  const extract_time_hhmm = (source_text: string): string | null => {
    const normalized_text = source_text.toLowerCase();
    const matched_value = normalized_text.match(/(?:오전|오후)?\s*(\d{1,2})\s*(?:시|:)\s*(\d{0,2})?/);
    if (!matched_value) {
      return null;
    }
    let hour_value = Number(matched_value[1]);
    const minute_value = Number(matched_value[2] ?? 0);
    if (normalized_text.includes("오후") && hour_value < 12) {
      hour_value += 12;
    }
    if (normalized_text.includes("오전") && hour_value === 12) {
      hour_value = 0;
    }
    return `${String(Math.max(0, Math.min(hour_value, 23))).padStart(2, "0")}:${String(
      Math.max(0, Math.min(minute_value, 59))
    ).padStart(2, "0")}`;
  };

  /** 채팅 기반 일정 수정 요청 처리 */
  const handle_chat_update_request = async (user_text: string): Promise<boolean> => {
    const has_update_intent = /(바뀌|변경|옮겨|수정|미뤄|당겨)/.test(user_text);
    if (!has_update_intent || timeline_tasks.length === 0) {
      return false;
    }

    const requested_time = extract_time_hhmm(user_text);
    if (!requested_time) {
      return false;
    }

    const target_task = timeline_tasks.find((task_item) => user_text.includes(task_item.title.split(" ")[0]));
    const task_to_update = target_task ?? timeline_tasks[timeline_tasks.length - 1];
    if (!task_to_update) {
      return false;
    }

    const start_minutes = Number(requested_time.split(":")[0]) * 60 + Number(requested_time.split(":")[1]);
    const end_minutes = start_minutes + Math.max(30, task_to_update.estimated_minutes);
    const end_time = `${String(Math.floor(end_minutes / 60)).padStart(2, "0")}:${String(
      end_minutes % 60
    ).padStart(2, "0")}`;

    await update_task_schedule(task_to_update.id, requested_time, end_time);
    await update_task(task_to_update.id, {
      title: task_to_update.title,
      description: task_to_update.description,
      category: task_to_update.category,
      priority: task_to_update.priority,
      status: task_to_update.status,
    });

    append_message(
      "assistant",
      `${task_to_update.title} 일정을 ${requested_time} ~ ${end_time}으로 변경했습니다. 타임라인과 칸반에 반영했어요.`
    );
    return true;
  };

  /** 대화 입력으로 AI 플래닝 실행 */
  const handle_submit_message = async (user_text: string) => {
    append_message("user", user_text);

    const has_updated = await handle_chat_update_request(user_text);
    if (has_updated) {
      return;
    }

    set_is_planning(true);
    try {
      const day_plan_result = await ai_service.plan_interactive_day({
        ...planner_defaults,
        user_text,
        existing_plan_tasks: timeline_tasks.map((task_item) => ({
          title: task_item.title,
          scheduled_start_at: task_item.scheduled_start_at,
          scheduled_end_at: task_item.scheduled_end_at,
        })),
      });
      const bullet_lines = day_plan_result.tasks.map(
        (task_item) =>
          `- ${task_item.scheduled_start_at ?? "--:--"} ~ ${task_item.scheduled_end_at ?? "--:--"} ${
            task_item.title
          }`
      );
      const planned_tasks = build_tasks_from_summary_lines(bullet_lines, day_plan_result.tasks);
      const created_count = await create_planned_tasks(planned_tasks);
      set_planning_message(
        `${day_plan_result.summary_message} (${created_count}개 업무를 시간 블록으로 배치했습니다.)`
      );
      append_message(
        "assistant",
        [`일정 정리를 완료했습니다.`, ...bullet_lines].join("\n")
      );
    } finally {
      set_is_planning(false);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-6 text-zinc-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h1 className="text-xl font-bold">AI 플래너 어시스턴트</h1>
          <p className="mt-1 text-sm text-zinc-600">
            대화형 입력을 바탕으로 업무를 분리하고 오늘 일정을 타임블록으로 자동 배치합니다.
          </p>
        </header>

        {is_loading ? (
          <section className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm">
            Firebase 데이터 로딩 중...
          </section>
        ) : null}

        {error_message ? (
          <section className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error_message}
          </section>
        ) : null}

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <PlannerChatPanel
            is_planning={is_planning}
            messages={messages}
            planning_message={planning_message}
            on_submit_message={handle_submit_message}
          />
          <TimelineView timeline_tasks={timeline_tasks} on_update_schedule={update_task_schedule} />
        </section>
      </div>
    </main>
  );
}
