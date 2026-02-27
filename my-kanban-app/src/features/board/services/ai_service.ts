import { Task_Priority, Task_Status } from "../types/task_types";

type analyze_task_params = {
  title: string;
  description?: string;
};

export interface Planner_Task_Draft {
  title: string;
  description?: string;
  category: string;
  priority: Task_Priority;
  status: Task_Status;
  estimated_minutes: number;
  scheduled_start_at?: string;
  scheduled_end_at?: string;
}

interface Day_Plan_Params {
  user_text: string;
  available_start_time: string;
  available_end_time: string;
  focus_minutes: number;
  break_minutes: number;
  lunch_start_time: string;
  lunch_end_time: string;
  existing_plan_tasks: Array<{
    title: string;
    scheduled_start_at?: string;
    scheduled_end_at?: string;
  }>;
}

export interface Day_Plan_Result {
  tasks: Planner_Task_Draft[];
  summary_message: string;
}

export interface Task_Analysis_Result {
  category: string;
  priority: Task_Priority;
  status: Task_Status;
}

interface Gemini_Analyze_Response {
  category?: string;
  priority?: string;
  status?: string;
}

interface Gemini_Day_Plan_Response {
  tasks?: Array<{
    title?: string;
    description?: string;
    category?: string;
    priority?: string;
    status?: string;
    estimated_minutes?: number;
    scheduled_start_at?: string;
    scheduled_end_at?: string;
  }>;
  summary_message?: string;
}

interface Gemini_Error_Response {
  error_code?: string;
  retry_after_seconds?: number;
}

const VALID_PRIORITIES: Task_Priority[] = ["high", "medium", "low"];
const VALID_STATUSES: Task_Status[] = ["todo", "in_progress", "done"];
const GEMINI_RETRY_STORAGE_KEY = "gemini_retry_available_at";
let gemini_retry_available_at = 0;
let has_logged_retry_wait = false;

/** 로컬스토리지에서 재시도 가능 시각을 복원 */
const hydrate_retry_available_at = (): void => {
  try {
    const stored_value = window.localStorage.getItem(GEMINI_RETRY_STORAGE_KEY);
    if (!stored_value) {
      return;
    }

    const parsed_value = Number(stored_value);
    if (Number.isNaN(parsed_value)) {
      return;
    }

    gemini_retry_available_at = parsed_value;
  } catch (error) {
    console.error("[ai_service] retry 시각 복원 실패:", error);
  }
};

/** 재시도 가능 시각을 메모리/로컬스토리지에 동기화 */
const set_retry_available_at = (retry_available_at: number): void => {
  gemini_retry_available_at = retry_available_at;
  try {
    window.localStorage.setItem(GEMINI_RETRY_STORAGE_KEY, String(retry_available_at));
  } catch (error) {
    console.error("[ai_service] retry 시각 저장 실패:", error);
  }
};

/** 문장에 키워드가 포함되어 있는지 확인 */
const includes_any_keyword = (source_text: string, keywords: string[]): boolean => {
  return keywords.some((keyword) => source_text.includes(keyword));
};

/** PRD 기준 로컬 규칙 분류 (Gemini 실패 대비 폴백) */
const classify_task_locally = (params: analyze_task_params): Task_Analysis_Result => {
  const combined_text = `${params.title} ${params.description ?? ""}`.toLowerCase();

  const category_rules: Array<{ category: string; keywords: string[] }> = [
    { category: "개발", keywords: ["api", "서버", "버그", "프론트엔드", "백엔드", "데이터베이스", "테스트", "코드", "배포"] },
    { category: "디자인", keywords: ["디자인", "ui", "ux", "피그마", "시안", "목업", "로고", "배너"] },
    { category: "마케팅", keywords: ["광고", "캠페인", "sns", "인스타그램", "프로모션", "이벤트", "카피"] },
    { category: "기획", keywords: ["기획", "prd", "요구사항", "리서치", "일정", "와이어프레임"] },
    { category: "운영", keywords: ["문서", "가이드", "고객", "cs", "결제", "정산", "온보딩"] },
  ];

  const matched_category =
    category_rules.find((rule) => includes_any_keyword(combined_text, rule.keywords))?.category ?? "기타";

  const high_priority_keywords = ["긴급", "asap", "오늘까지", "치명적", "크리티컬", "핫픽스", "장애", "최우선"];
  const low_priority_keywords = ["나중에", "시간 날 때", "여유", "아이디어", "백로그", "참고용"];
  const in_progress_keywords = ["진행 중", "작성 중", "검토 중", "수정 중"];
  const done_keywords = ["완료", "끝남", "배포 완료", "처리 완료", "해결됨"];

  const priority: Task_Priority = includes_any_keyword(combined_text, high_priority_keywords)
    ? "high"
    : includes_any_keyword(combined_text, low_priority_keywords)
      ? "low"
      : "medium";
  const status: Task_Status = includes_any_keyword(combined_text, done_keywords)
    ? "done"
    : includes_any_keyword(combined_text, in_progress_keywords)
      ? "in_progress"
      : "todo";

  return {
    category: matched_category,
    priority,
    status,
  };
};

/** Gemini 응답 텍스트에서 JSON 영역만 추출 */
const extract_json_text = (raw_text: string): string => {
  const cleaned_text = raw_text.replace(/```json|```/gi, "").trim();
  const json_start_index = cleaned_text.indexOf("{");
  const json_end_index = cleaned_text.lastIndexOf("}");

  if (json_start_index === -1 || json_end_index === -1 || json_end_index <= json_start_index) {
    throw new Error("Gemini 응답에서 JSON 본문을 찾지 못했습니다.");
  }

  return cleaned_text.slice(json_start_index, json_end_index + 1);
};

/** Gemini 응답을 안전한 분석 결과 포맷으로 정규화 */
const parse_analysis_result = (raw_text: string): Task_Analysis_Result => {
  const json_text = extract_json_text(raw_text);
  const parsed_value = JSON.parse(json_text) as Partial<Task_Analysis_Result>;

  const normalized_priority = VALID_PRIORITIES.includes(parsed_value.priority as Task_Priority)
    ? (parsed_value.priority as Task_Priority)
    : "medium";
  const normalized_status = VALID_STATUSES.includes(parsed_value.status as Task_Status)
    ? (parsed_value.status as Task_Status)
    : "todo";

  return {
    category: (parsed_value.category ?? "기타").toString(),
    priority: normalized_priority,
    status: normalized_status,
  };
};

/** 서버 응답을 안전한 분석 결과 포맷으로 정규화 */
const parse_server_result = (response_json: Gemini_Analyze_Response): Task_Analysis_Result => {
  const normalized_priority = VALID_PRIORITIES.includes(response_json.priority as Task_Priority)
    ? (response_json.priority as Task_Priority)
    : "medium";
  const normalized_status = VALID_STATUSES.includes(response_json.status as Task_Status)
    ? (response_json.status as Task_Status)
    : "todo";

  return {
    category: (response_json.category ?? "기타").toString(),
    priority: normalized_priority,
    status: normalized_status,
  };
};

/** HH:mm 문자열을 분 단위 정수로 변환 */
const to_minutes = (time_value: string): number => {
  const [hour_value, minute_value] = time_value.split(":").map((value) => Number(value));
  if (Number.isNaN(hour_value) || Number.isNaN(minute_value)) {
    return 0;
  }
  return hour_value * 60 + minute_value;
};

/** 분 단위를 HH:mm 문자열로 변환 */
const to_time_string = (minutes_value: number): string => {
  const safe_minutes = Math.max(0, Math.min(minutes_value, 23 * 60 + 59));
  const hour_value = Math.floor(safe_minutes / 60);
  const minute_value = safe_minutes % 60;
  return `${String(hour_value).padStart(2, "0")}:${String(minute_value).padStart(2, "0")}`;
};

/** 로컬 규칙으로 문장을 업무 단위로 분해 */
const split_tasks_locally = (user_text: string): string[] => {
  return user_text
    .split(/[\n,.]|그리고|그다음|했다가|후에|이후/g)
    .map((value) => value.trim())
    .filter((value) => value.length > 1)
    .slice(0, 8);
};

/** 문장을 할 일형 제목으로 정규화 */
const to_action_title = (raw_text: string): string => {
  const source_text = raw_text.trim();
  if (!source_text) {
    return "할 일 하기";
  }
  if (/헬스|운동/.test(source_text)) {
    return "헬스장 가기";
  }
  if (/점심|아침|저녁|식사/.test(source_text)) {
    return "점심 먹기";
  }
  if (/블로그/.test(source_text)) {
    return "블로그 글 쓰기";
  }

  const normalized_text = source_text
    .replace(/(?:오전|오후)?\s*\d{1,2}\s*(?:시|:)\s*\d{0,2}\s*(?:분)?(?:\s*(?:까지|전까지))?/g, " ")
    .replace(/오늘|그리고|했다가|후에|이후|해야해|가야해|까지|전까지/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized_text) {
    return "할 일 하기";
  }
  if (normalized_text.endsWith("기") || normalized_text.endsWith("하기") || normalized_text.endsWith("끝내기")) {
    return normalized_text;
  }
  return `${normalized_text} 하기`;
};

/** 로컬 타임블록 생성 */
const build_local_schedule = (task_titles: string[], params: Day_Plan_Params): Planner_Task_Draft[] => {
  const start_minutes = to_minutes(params.available_start_time);
  const end_minutes = to_minutes(params.available_end_time);
  let cursor_minutes = start_minutes;

  return task_titles.map((task_title, index_value) => {
    const default_duration = Math.max(20, params.focus_minutes);
    const estimated_minutes = default_duration;
    const task_start = cursor_minutes;
    const task_end = Math.min(end_minutes, task_start + estimated_minutes);
    cursor_minutes = Math.min(end_minutes, task_end + params.break_minutes);

    return {
      title: to_action_title(task_title),
      description: "",
      category: "기타",
      priority: "medium",
      status: "todo",
      estimated_minutes,
      scheduled_start_at: to_time_string(task_start),
      scheduled_end_at: to_time_string(task_end),
    };
  });
};

/** 서버 day plan 응답 정규화 */
const parse_day_plan_response = (
  response_json: Gemini_Day_Plan_Response,
  params: Day_Plan_Params
): Day_Plan_Result => {
  const normalized_tasks = (response_json.tasks ?? []).map((task_item) => ({
    title: to_action_title(String(task_item.title ?? "").trim()),
    description: String(task_item.description ?? "").trim(),
    category: String(task_item.category ?? "기타"),
    priority: VALID_PRIORITIES.includes(task_item.priority as Task_Priority)
      ? (task_item.priority as Task_Priority)
      : "medium",
    status: VALID_STATUSES.includes(task_item.status as Task_Status)
      ? (task_item.status as Task_Status)
      : "todo",
    estimated_minutes:
      Number.isFinite(task_item.estimated_minutes) && Number(task_item.estimated_minutes) > 0
        ? Number(task_item.estimated_minutes)
        : params.focus_minutes,
    scheduled_start_at: String(task_item.scheduled_start_at ?? ""),
    scheduled_end_at: String(task_item.scheduled_end_at ?? ""),
  }));

  const filtered_tasks = normalized_tasks.filter((task_item) => task_item.title.length > 0);

  return {
    tasks: filtered_tasks,
    summary_message:
      String(response_json.summary_message ?? "").trim() ||
      `${filtered_tasks.length}개의 업무를 자동 정리했습니다.`,
  };
};

/** AI 분석 서비스 인터페이스 자리 (MVP UI 단계에서는 미구현) */
export const ai_service = {
  /** Gemini API를 호출해 단일 작업을 분류 */
  analyze_task: async (params: analyze_task_params): Promise<Task_Analysis_Result> => {
    try {
      hydrate_retry_available_at();

      if (Date.now() < gemini_retry_available_at) {
        if (!has_logged_retry_wait) {
          console.warn("[ai_service] Gemini 재시도 대기 중입니다. 로컬 분류로 처리합니다.");
          has_logged_retry_wait = true;
        }
        return classify_task_locally(params);
      }
      has_logged_retry_wait = false;

      console.log("[ai_service] Gemini 요청 시작:", {
        title: params.title,
        has_description: Boolean(params.description?.trim()),
        requested_at: new Date().toISOString(),
      });

      const response = await fetch("/api/gemini/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: params.title,
          description: params.description ?? "",
        }),
      });
      const response_json = (await response.json()) as Gemini_Analyze_Response & Gemini_Error_Response;

      if (!response.ok) {
        if (response.status === 429 || response_json.error_code === "RATE_LIMITED") {
          const retry_seconds = response_json.retry_after_seconds ?? 30;
          set_retry_available_at(Date.now() + retry_seconds * 1000);
          console.warn("[ai_service] Gemini 쿼터 초과. 로컬 분류로 자동 전환:", {
            retry_seconds,
            retry_at: new Date(gemini_retry_available_at).toISOString(),
          });
          return classify_task_locally(params);
        }

        console.error("[ai_service] Gemini HTTP 오류:", response_json);
        return classify_task_locally(params);
      }

      const parsed_result = response_json.category
        ? parse_server_result(response_json)
        : parse_analysis_result(JSON.stringify(response_json));

      console.log("[ai_service] Gemini 요청 완료:", parsed_result);

      return parsed_result;
    } catch (error) {
      console.error("[ai_service] analyze_task 처리 중 오류:", error);
      return classify_task_locally(params);
    }
  },
  /** 대화형 입력을 업무/시간 계획으로 변환 */
  plan_interactive_day: async (params: Day_Plan_Params): Promise<Day_Plan_Result> => {
    try {
      const response = await fetch("/api/gemini/plan-day", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const response_json = (await response.json()) as Gemini_Day_Plan_Response & Gemini_Error_Response;

      if (!response.ok) {
        console.error("[ai_service] plan_day_from_text HTTP 오류:", response_json);
        const split_titles = split_tasks_locally(params.user_text);
        return {
          tasks: build_local_schedule(split_titles, params),
          summary_message: "AI 호출 실패로 로컬 규칙 기반 일정 초안을 생성했습니다.",
        };
      }

      const parsed_result = parse_day_plan_response(response_json, params);
      if (parsed_result.tasks.length === 0) {
        const split_titles = split_tasks_locally(params.user_text);
        return {
          tasks: build_local_schedule(split_titles, params),
          summary_message: "업무를 분해하지 못해 로컬 규칙 기반으로 보완했습니다.",
        };
      }

      return parsed_result;
    } catch (error) {
      console.error("[ai_service] plan_day_from_text 처리 중 오류:", error);
      const split_titles = split_tasks_locally(params.user_text);
      return {
        tasks: build_local_schedule(split_titles, params),
        summary_message: "네트워크 오류로 로컬 규칙 기반 일정 초안을 생성했습니다.",
      };
    }
  },
  /** 하위 호환용 래퍼 (기존 호출 유지) */
  plan_day_from_text: async (params: Day_Plan_Params): Promise<Day_Plan_Result> => {
    return ai_service.plan_interactive_day(params);
  },
};
