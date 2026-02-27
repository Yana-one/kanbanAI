const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

/** 요청 본문을 JSON으로 파싱 */
const parse_json_body = async (request) => {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const raw_body = Buffer.concat(chunks).toString("utf8");
  if (!raw_body) {
    return {};
  }

  return JSON.parse(raw_body);
};

/** Gemini 응답 텍스트에서 JSON 본문만 추출 */
const extract_json_text = (raw_text) => {
  const cleaned_text = String(raw_text ?? "").replace(/```json|```/gi, "").trim();
  const json_start_index = cleaned_text.indexOf("{");
  const json_end_index = cleaned_text.lastIndexOf("}");

  if (json_start_index === -1 || json_end_index === -1 || json_end_index <= json_start_index) {
    throw new Error("Gemini 응답에서 JSON 본문을 찾지 못했습니다.");
  }

  return cleaned_text.slice(json_start_index, json_end_index + 1);
};

/** Gemini 원본 응답을 API 응답 형식으로 정규화 */
const normalize_gemini_result = (gemini_response_json) => {
  const response_text =
    gemini_response_json?.candidates?.[0]?.content?.parts?.map((part) => part?.text ?? "").join("\n") ??
    "{}";
  const parsed_value = JSON.parse(extract_json_text(response_text));

  const valid_priorities = ["high", "medium", "low"];
  const valid_statuses = ["todo", "in_progress", "done"];
  const normalized_priority = valid_priorities.includes(parsed_value.priority)
    ? parsed_value.priority
    : "medium";
  const normalized_status = valid_statuses.includes(parsed_value.status)
    ? parsed_value.status
    : "todo";

  return {
    category: String(parsed_value.category ?? "기타"),
    priority: normalized_priority,
    status: normalized_status,
  };
};

/** Gemini 에러 메시지에서 재시도 대기시간을 파싱 */
const parse_retry_seconds = (error_message) => {
  const matched_value = String(error_message ?? "").match(/retry in ([\d.]+)s/i);
  if (!matched_value) {
    return 30;
  }

  const parsed_seconds = Number(matched_value[1]);
  return Number.isNaN(parsed_seconds) ? 30 : parsed_seconds;
};

/** 문자열에서 time token(예: 10시, 13:30, 오전 11시)을 추출해 HH:mm로 변환 */
const extract_time_hhmm = (source_text, fallback_value = "", context = {}) => {
  const normalized_text = String(source_text ?? "").toLowerCase();
  const hhmm_match = normalized_text.match(/(\d{1,2})(?::|시)?\s*(\d{1,2})?/);
  if (!hhmm_match) {
    return fallback_value;
  }

  let hour_value = Number(hhmm_match[1]);
  const minute_value = Number(hhmm_match[2] ?? 0);
  const last_hour_24 = Number.isFinite(context.last_hour_24) ? Number(context.last_hour_24) : null;
  if (normalized_text.includes("오후") && hour_value < 12) {
    hour_value += 12;
  }
  if (normalized_text.includes("오전") && hour_value === 12) {
    hour_value = 0;
  }
  if (!normalized_text.includes("오전") && !normalized_text.includes("오후")) {
    const is_likely_afternoon =
      /(점심|오후|저녁|퇴근|약속|회식|저녁식사|밤)/.test(normalized_text) ||
      /(까지|전까지)/.test(normalized_text);
    if (last_hour_24 !== null) {
      const am_candidate = hour_value % 12;
      const pm_candidate = am_candidate + 12;
      if (am_candidate >= last_hour_24) {
        hour_value = am_candidate;
      } else if (pm_candidate >= last_hour_24) {
        hour_value = pm_candidate;
      } else {
        hour_value = pm_candidate;
      }
    } else if (is_likely_afternoon && hour_value < 12) {
      hour_value += 12;
    } else if (hour_value >= 1 && hour_value <= 6) {
      hour_value += 12;
    }
  }

  const safe_hour = Math.max(0, Math.min(hour_value, 23));
  const safe_minute = Math.max(0, Math.min(minute_value, 59));
  return `${String(safe_hour).padStart(2, "0")}:${String(safe_minute).padStart(2, "0")}`;
};

/** HH:mm 문자열을 분 단위 숫자로 변환 */
const time_to_minutes = (time_text) => {
  const [hour_value, minute_value] = String(time_text).split(":").map((value) => Number(value));
  if (Number.isNaN(hour_value) || Number.isNaN(minute_value)) {
    return 0;
  }
  return hour_value * 60 + minute_value;
};

/** 분 단위를 HH:mm 문자열로 변환 */
const minutes_to_time = (minutes_value) => {
  const safe_minutes = Math.max(0, Math.min(minutes_value, 23 * 60 + 59));
  const hour_value = Math.floor(safe_minutes / 60);
  const minute_value = safe_minutes % 60;
  return `${String(hour_value).padStart(2, "0")}:${String(minute_value).padStart(2, "0")}`;
};

/** 시간표현을 기준으로 문장을 분해 */
const split_by_time_markers = (source_text) => {
  const normalized_text = String(source_text ?? "")
    .replace(/\n/g, " ")
    .replace(/했다가|하고\s*난\s*다음|난\s*다음|그다음|그리고|후에|이후|,|[.]/g, "|")
    .replace(/((?:오전|오후)?\s*\d{1,2}\s*(?:시|:)\s*\d{0,2}\s*(?:분)?)/g, "|$1")
    .trim();
  if (!normalized_text) {
    return [];
  }

  const time_pattern = /((?:오전|오후)?\s*\d{1,2}\s*(?:시|:)\s*\d{0,2}\s*(?:분)?(?:\s*(?:까지|전까지))?)/g;
  const matches = [...normalized_text.matchAll(time_pattern)];
  if (matches.length === 0) {
    return normalized_text
      .split("|")
      .map((value) => value.trim())
      .filter((value) => value.length > 1);
  }

  const segments = [];
  for (let index = 0; index < matches.length; index += 1) {
    const current_match = matches[index];
    const start_index = current_match.index ?? 0;
    const end_index = index + 1 < matches.length ? matches[index + 1].index ?? normalized_text.length : normalized_text.length;
    const segment_text = normalized_text.slice(start_index, end_index).trim();
    if (segment_text.length > 1) {
      segments.push(segment_text);
    }
  }

  return segments;
};

/** 문맥을 바탕으로 예상 소요시간 추정 */
const infer_duration_minutes = (source_text, default_minutes) => {
  const normalized_text = String(source_text ?? "");
  const hour_match = normalized_text.match(/(\d+)\s*시간/);
  if (hour_match) {
    return Math.max(30, Number(hour_match[1]) * 60);
  }
  const minute_match = normalized_text.match(/(\d+)\s*분/);
  if (minute_match) {
    return Math.max(15, Number(minute_match[1]));
  }
  if (/블로그|글/.test(normalized_text)) {
    return 120;
  }
  if (/약속|미팅|회의/.test(normalized_text)) {
    return 60;
  }
  if (/헬스|운동/.test(normalized_text)) {
    return 60;
  }
  if (/점심|아침|저녁|식사/.test(normalized_text)) {
    return 60;
  }
  return default_minutes;
};

/** 문장을 할 일형 문장(예: ~하기, ~끝내기)으로 정규화 */
const to_action_title = (raw_text) => {
  const source_text = String(raw_text ?? "").trim();
  if (!source_text) {
    return "할 일 하기";
  }

  if (/블로그/.test(source_text)) {
    return "블로그 글 쓰기";
  }
  if (/점심|아침|저녁|식사/.test(source_text)) {
    return "점심 먹기";
  }
  if (/헬스|운동/.test(source_text)) {
    return "헬스장 가기";
  }
  if (/역/.test(source_text)) {
    const station_match = source_text.match(/([가-힣A-Za-z0-9]+역)/);
    return `${station_match ? station_match[1] : "목적지"} 가기`;
  }
  if (/약속/.test(source_text)) {
    const person_match = source_text.match(/([가-힣A-Za-z0-9]+)(?:랑|와|과)\s*약속/);
    if (person_match?.[1]) {
      return `${person_match[1]}와 약속`;
    }
    const location_match = source_text.match(/([가-힣A-Za-z0-9]+역)\s*약속/);
    if (location_match?.[1]) {
      return `${location_match[1]} 약속`;
    }
    return "약속 일정";
  }
  if (/동사무소|주민센터|관공서/.test(source_text)) {
    return "동사무소 방문하기";
  }

  const cleaned_text = source_text
    .replace(/(?:오전|오후)?\s*\d{1,2}\s*(?:시|:)\s*\d{0,2}\s*(?:분)?(?:\s*(?:까지|전까지))?/g, " ")
    .replace(/오늘|쯤|가야해|해야해|해야|해야지|했다가|하고|해서|도착해서|도착|전까지|까지/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned_text) {
    return "할 일 하기";
  }
  if (/약속/.test(cleaned_text)) {
    return cleaned_text.replace(/\s+/g, " ").trim();
  }
  if (/(쓰기|작성|업로드|정리|준비)/.test(cleaned_text)) {
    return cleaned_text.endsWith("기") ? cleaned_text : `${cleaned_text} 하기`;
  }
  if (cleaned_text.endsWith("기") || cleaned_text.endsWith("하기") || cleaned_text.endsWith("끝내기")) {
    return cleaned_text;
  }
  return `${cleaned_text} 하기`;
};

/** AI/폴백 task 배열을 공통 포맷으로 정리 */
const normalize_planner_tasks = (tasks, defaults) => {
  const day_start_minutes = time_to_minutes(defaults.available_start_time);
  const day_end_minutes = time_to_minutes(defaults.available_end_time);
  const lunch_start_minutes = time_to_minutes(defaults.lunch_start_time || "12:00");
  const lunch_end_minutes = time_to_minutes(defaults.lunch_end_time || "13:00");
  const existing_blocks = (defaults.existing_plan_tasks || [])
    .map((task_item) => ({
      start: time_to_minutes(task_item?.scheduled_start_at || ""),
      end: time_to_minutes(task_item?.scheduled_end_at || ""),
    }))
    .filter((block_item) => block_item.start >= 0 && block_item.end > block_item.start);
  let cursor_minutes = day_start_minutes;
  let last_hour_24 = null;

  return (tasks ?? []).map((task_item) => {
    const source_text = String(task_item?.description ?? task_item?.title ?? "");
    const explicit_time = extract_time_hhmm(source_text, "", { last_hour_24 });
    const explicit_minutes = explicit_time ? time_to_minutes(explicit_time) : null;
    const has_deadline = /(까지|전까지)/.test(source_text);

    let start_minutes = explicit_minutes ?? cursor_minutes;
    let estimated_minutes = Number(
      task_item?.estimated_minutes ?? infer_duration_minutes(source_text, defaults.focus_minutes)
    );
    if (!Number.isFinite(estimated_minutes) || estimated_minutes <= 0) {
      estimated_minutes = infer_duration_minutes(source_text, defaults.focus_minutes);
    }

    if (has_deadline && explicit_minutes !== null) {
      estimated_minutes = Math.max(estimated_minutes, infer_duration_minutes(source_text, 120));
      start_minutes = Math.max(cursor_minutes, explicit_minutes - estimated_minutes);
    }

    if (start_minutes >= lunch_start_minutes && start_minutes < lunch_end_minutes) {
      start_minutes = lunch_end_minutes;
    } else if (start_minutes < lunch_start_minutes && start_minutes + estimated_minutes > lunch_start_minutes) {
      start_minutes = lunch_end_minutes;
    }

    for (const existing_block of existing_blocks) {
      const is_overlapped =
        start_minutes < existing_block.end && start_minutes + estimated_minutes > existing_block.start;
      if (is_overlapped) {
        start_minutes = existing_block.end + defaults.break_minutes;
      }
    }

    const end_minutes = Math.min(day_end_minutes, start_minutes + estimated_minutes);
    last_hour_24 = Math.floor(start_minutes / 60);
    cursor_minutes = Math.min(day_end_minutes, end_minutes + defaults.break_minutes);

    return {
      title: to_action_title(String(task_item?.title ?? source_text)),
      description: String(task_item?.description ?? source_text).trim(),
      category: String(task_item?.category ?? "기타"),
      priority: has_deadline ? "high" : String(task_item?.priority ?? "medium"),
      status: "todo",
      estimated_minutes: Math.max(15, end_minutes - start_minutes),
      scheduled_start_at: minutes_to_time(start_minutes),
      scheduled_end_at: minutes_to_time(end_minutes),
    };
  });
};

/** Gemini 실패 시 규칙 기반으로 타임블록 계획 생성 */
const build_fallback_plan = ({
  user_text,
  available_start_time,
  available_end_time,
  focus_minutes,
  break_minutes,
  lunch_start_time,
  lunch_end_time,
  existing_plan_tasks = [],
}) => {
  const segments = split_by_time_markers(user_text).slice(0, 12);
  const raw_tasks = (segments.length > 0 ? segments : [String(user_text ?? "").trim()]).map((segment) => ({
    title: segment,
    description: segment,
    category: /(헬스|운동|식사|점심|아침)/.test(segment) ? "운영" : "기획",
    priority: /(까지|전까지)/.test(segment) ? "high" : "medium",
    estimated_minutes: infer_duration_minutes(
      segment,
      /(까지|전까지)/.test(segment) ? Math.max(focus_minutes * 2, 120) : Math.max(focus_minutes, 60)
    ),
  }));
  const tasks = normalize_planner_tasks(raw_tasks, {
    available_start_time,
    available_end_time,
    focus_minutes,
    break_minutes,
    lunch_start_time,
    lunch_end_time,
    existing_plan_tasks,
  });

  return {
    summary_message: `${tasks.length}개 업무를 시간 기반으로 분해했습니다.`,
    tasks,
  };
};

module.exports = function register_proxy(app) {
  app.post("/api/gemini/analyze", async (request, response) => {
    try {
      const gemini_api_key = process.env.GEMINI_API_KEY ?? "";
      const gemini_model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";

      if (!gemini_api_key.trim()) {
        response.status(500).json({
          error_code: "MISSING_SERVER_KEY",
          message: "서버 Gemini API 키가 설정되지 않았습니다.",
        });
        return;
      }

      const request_body = await parse_json_body(request);
      const title = String(request_body?.title ?? "").trim();
      const description = String(request_body?.description ?? "").trim();

      if (!title) {
        response.status(400).json({
          error_code: "INVALID_REQUEST",
          message: "title은 필수 값입니다.",
        });
        return;
      }

      const system_prompt = [
        "당신은 사용자의 할 일을 분류하는 AI 칸반 매니저입니다.",
        "오직 유효한 JSON 객체만 반환하세요.",
        '{ "category": "개발|디자인|마케팅|기획|운영|기타", "priority": "high|medium|low", "status": "todo|in_progress|done" }',
      ].join("\n");
      const user_prompt = [
        "[할 일 정보]",
        `제목: ${title}`,
        `설명: ${description}`,
      ].join("\n");
      const gemini_url = `${GEMINI_API_BASE_URL}/${gemini_model}:generateContent?key=${gemini_api_key}`;
      const gemini_request_body = {
        contents: [
          {
            role: "user",
            parts: [{ text: `${system_prompt}\n\n${user_prompt}` }],
          },
        ],
      };

      const gemini_response = await fetch(gemini_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gemini_request_body),
      });
      const gemini_response_json = await gemini_response.json();

      if (!gemini_response.ok) {
        const error_message = gemini_response_json?.error?.message ?? "unknown";
        if (gemini_response.status === 429) {
          response.status(429).json({
            error_code: "RATE_LIMITED",
            retry_after_seconds: parse_retry_seconds(error_message),
            message: "API 사용량 제한에 도달했습니다.",
          });
          return;
        }

        response.status(502).json({
          error_code: "GEMINI_HTTP_ERROR",
          message: "Gemini 요청 처리에 실패했습니다.",
        });
        return;
      }

      response.json(normalize_gemini_result(gemini_response_json));
    } catch (error) {
      console.error("[setupProxy] /api/gemini/analyze 처리 중 오류:", error);
      response.status(500).json({
        error_code: "INTERNAL_SERVER_ERROR",
        message: "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      });
    }
  });

  app.post("/api/gemini/plan-day", async (request, response) => {
    try {
      const gemini_api_key = process.env.GEMINI_API_KEY ?? "";
      const gemini_model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";

      if (!gemini_api_key.trim()) {
        response.status(500).json({
          error_code: "MISSING_SERVER_KEY",
          message: "서버 Gemini API 키가 설정되지 않았습니다.",
        });
        return;
      }

      const request_body = await parse_json_body(request);
      const user_text = String(request_body?.user_text ?? "").trim();
      const available_start_time = String(request_body?.available_start_time ?? "09:00").trim();
      const available_end_time = String(request_body?.available_end_time ?? "18:00").trim();
      const focus_minutes = Number(request_body?.focus_minutes ?? 60);
      const break_minutes = Number(request_body?.break_minutes ?? 10);
      const lunch_start_time = String(request_body?.lunch_start_time ?? "12:00").trim();
      const lunch_end_time = String(request_body?.lunch_end_time ?? "13:00").trim();
      const existing_plan_tasks = Array.isArray(request_body?.existing_plan_tasks)
        ? request_body.existing_plan_tasks
        : [];

      if (!user_text) {
        response.status(400).json({
          error_code: "INVALID_REQUEST",
          message: "user_text는 필수 값입니다.",
        });
        return;
      }

      const system_prompt = [
        "당신은 인터렉티브 플래너 AI입니다.",
        "사용자 문장을 업무 단위로 분리하고 각 업무를 시간 블록으로 배치하세요.",
        "task title은 반드시 '무엇을 할지'가 드러나는 할 일 형태로 작성하세요. 예: '10시 헬스장 가기', '1시 점심 먹기', '블로그 글 쓰기'.",
        "원문 문장을 그대로 복사하지 말고, 행동 중심으로 간결하게 재작성하세요.",
        "오직 JSON 객체만 반환하세요.",
        `{`,
        `  "summary_message": "한 줄 요약",`,
        `  "tasks": [`,
        `    {`,
        `      "title": "업무명",`,
        `      "description": "상세",`,
        `      "category": "개발|디자인|마케팅|기획|운영|기타",`,
        `      "priority": "high|medium|low",`,
        `      "status": "todo|in_progress|done",`,
        `      "estimated_minutes": 60,`,
        `      "scheduled_start_at": "HH:mm",`,
        `      "scheduled_end_at": "HH:mm"`,
        `    }`,
        `  ]`,
        `}`,
      ].join("\n");

      const user_prompt = [
        "[사용자 입력]",
        user_text,
        "",
        "[스케줄 조건]",
        `가용 시작 시간: ${available_start_time}`,
        `가용 종료 시간: ${available_end_time}`,
        `집중 블록(분): ${focus_minutes}`,
        `휴식 블록(분): ${break_minutes}`,
        `점심 시간: ${lunch_start_time} ~ ${lunch_end_time} (해당 시간은 비우기)`,
        `[기존 일정(겹치지 않게 배치)]`,
        ...existing_plan_tasks.map(
          (task_item) =>
            `- ${String(task_item?.title ?? "")} (${String(task_item?.scheduled_start_at ?? "")} ~ ${String(
              task_item?.scheduled_end_at ?? ""
            )})`
        ),
      ].join("\n");

      const gemini_url = `${GEMINI_API_BASE_URL}/${gemini_model}:generateContent?key=${gemini_api_key}`;
      const gemini_request_body = {
        contents: [
          {
            role: "user",
            parts: [{ text: `${system_prompt}\n\n${user_prompt}` }],
          },
        ],
      };

      const gemini_response = await fetch(gemini_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gemini_request_body),
      });
      const gemini_response_json = await gemini_response.json();

      if (!gemini_response.ok) {
        const error_message = gemini_response_json?.error?.message ?? "unknown";
        if (gemini_response.status === 429) {
          const fallback_plan = build_fallback_plan({
            user_text,
            available_start_time,
            available_end_time,
            focus_minutes,
            break_minutes,
            lunch_start_time,
            lunch_end_time,
            existing_plan_tasks,
          });
          response.status(200).json({
            ...fallback_plan,
            error_code: "RATE_LIMITED",
            retry_after_seconds: parse_retry_seconds(error_message),
          });
          return;
        }

        const fallback_plan = build_fallback_plan({
          user_text,
          available_start_time,
          available_end_time,
          focus_minutes,
          break_minutes,
          lunch_start_time,
          lunch_end_time,
          existing_plan_tasks,
        });
        response.status(200).json({
          ...fallback_plan,
          error_code: "GEMINI_HTTP_ERROR",
        });
        return;
      }

      const response_text =
        gemini_response_json?.candidates?.[0]?.content?.parts?.map((part) => part?.text ?? "").join("\n") ??
        "{}";
      const parsed_value = JSON.parse(extract_json_text(response_text));
      const normalized_tasks = normalize_planner_tasks(parsed_value.tasks ?? [], {
        available_start_time,
        available_end_time,
        focus_minutes,
        break_minutes,
        lunch_start_time,
        lunch_end_time,
        existing_plan_tasks,
      });

      response.json({
        summary_message: String(parsed_value.summary_message ?? "오늘 일정 초안을 생성했습니다."),
        tasks: normalized_tasks,
      });
    } catch (error) {
      console.error("[setupProxy] /api/gemini/plan-day 처리 중 오류:", error);
      const fallback_plan = build_fallback_plan({
        user_text: "오늘 할 일 정리",
        available_start_time: "09:00",
        available_end_time: "18:00",
        focus_minutes: 60,
        break_minutes: 10,
        lunch_start_time: "12:00",
        lunch_end_time: "13:00",
        existing_plan_tasks: [],
      });
      response.status(200).json({
        ...fallback_plan,
        error_code: "INTERNAL_SERVER_ERROR",
      });
    }
  });
};
