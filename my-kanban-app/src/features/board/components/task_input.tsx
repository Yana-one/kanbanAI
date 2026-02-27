import React from "react";

interface TaskInputProps {
  create_task: (title: string, description?: string) => Promise<boolean>;
}

/** 작업 입력 UI 컴포넌트 */
export function TaskInput({ create_task }: TaskInputProps) {
  const [title_input, set_title_input] = React.useState("");
  const [description_input, set_description_input] = React.useState("");

  /** 카드 추가 버튼 이벤트 처리 */
  const handle_create_task = async () => {
    const is_success = await create_task(title_input, description_input);
    if (!is_success) {
      return;
    }

    set_title_input("");
    set_description_input("");
  };

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-base font-semibold text-zinc-900">할 일 입력</h2>
      <div className="space-y-3">
        <input
          type="text"
          placeholder="예: 인스타그램 광고 캠페인 기획하기"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          value={title_input}
          onChange={(event) => set_title_input(event.target.value)}
        />
        <textarea
          placeholder="상세 설명 (선택)"
          className="h-24 w-full resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          value={description_input}
          onChange={(event) => set_description_input(event.target.value)}
        />
        <button
          type="button"
          className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white"
          onClick={handle_create_task}
        >
          추가
        </button>
      </div>
    </section>
  );
}
