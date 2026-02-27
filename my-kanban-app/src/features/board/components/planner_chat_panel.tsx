import React from "react";

export interface PlannerChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  created_at: string;
}

interface PlannerChatPanelProps {
  is_planning: boolean;
  messages: PlannerChatMessage[];
  planning_message: string;
  on_submit_message: (user_text: string) => Promise<void>;
}

/** 대화형 플래너 입력 패널 */
export function PlannerChatPanel({
  is_planning,
  messages,
  planning_message,
  on_submit_message,
}: PlannerChatPanelProps) {
  const [user_text, set_user_text] = React.useState("");

  /** AI 계획 생성 이벤트 */
  const handle_submit = async () => {
    if (!user_text.trim()) {
      return;
    }
    await on_submit_message(user_text);
    set_user_text("");
  };

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <h2 className="mb-2 text-base font-semibold text-zinc-900">대화형 플래너</h2>
      <p className="mb-3 text-xs text-zinc-500">
        오늘 할 일을 자연스럽게 입력하면 AI가 자동으로 업무 분해/정리/시간 계획을 생성합니다.
      </p>

      <div className="mb-3 h-56 space-y-2 overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50 p-3">
        {messages.length === 0 ? (
          <p className="text-xs text-zinc-500">아직 대화가 없습니다. 아래에 오늘 할 일을 입력해 주세요.</p>
        ) : (
          messages.map((message_item) => (
            <div
              key={message_item.id}
              className={[
                "max-w-[90%] rounded-2xl px-3 py-2 text-xs shadow-sm",
                message_item.role === "user"
                  ? "ml-auto bg-violet-600 text-white"
                  : "mr-auto bg-white text-zinc-700",
              ].join(" ")}
            >
              <p className="whitespace-pre-wrap">{message_item.text}</p>
            </div>
          ))
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <textarea
          className="h-20 flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          placeholder="예: 오전 11시에 동사무소 들렀다가 2시까지 서울역 도착, 순천 이동 준비해야 해요."
          value={user_text}
          onChange={(event) => set_user_text(event.target.value)}
        />
        <button
          type="button"
          className="h-20 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white"
          onClick={handle_submit}
          disabled={is_planning}
        >
          {is_planning ? "처리중" : "전송"}
        </button>
      </div>

      <p className="mt-2 text-xs text-zinc-600">{planning_message}</p>
    </section>
  );
}
