import React from "react";
import { Task_Item } from "../types/task_types";

interface TimelineViewProps {
  timeline_tasks: Task_Item[];
  on_update_schedule: (
    task_id: string,
    scheduled_start_at: string,
    scheduled_end_at: string
  ) => Promise<boolean>;
}

/** 시간 블록 타임라인 뷰 */
export function TimelineView({ timeline_tasks, on_update_schedule }: TimelineViewProps) {
  const start_hour = 6;
  const end_hour = 22;
  const minute_height_px = 1.2;

  /** HH:mm 문자열을 분 단위로 변환 */
  const to_minutes = (time_value?: string): number => {
    const [hour_value, minute_value] = String(time_value ?? "").split(":").map((value) => Number(value));
    if (Number.isNaN(hour_value) || Number.isNaN(minute_value)) {
      return -1;
    }
    return hour_value * 60 + minute_value;
  };

  const positioned_tasks = timeline_tasks
    .map((task_item) => {
      const start_minutes = to_minutes(task_item.scheduled_start_at);
      const end_minutes = to_minutes(task_item.scheduled_end_at);
      if (start_minutes < 0 || end_minutes <= start_minutes) {
        return null;
      }

      const range_start_minutes = start_hour * 60;
      const clipped_start = Math.max(start_minutes, range_start_minutes);
      const clipped_end = Math.min(end_minutes, end_hour * 60);
      if (clipped_end <= clipped_start) {
        return null;
      }

      return {
        task_item,
        top_px: Math.round((clipped_start - range_start_minutes) * minute_height_px),
        height_px: Math.max(44, Math.round((clipped_end - clipped_start) * minute_height_px)),
        start_minutes: clipped_start,
      };
    })
    .filter(
      (value): value is { task_item: Task_Item; top_px: number; height_px: number; start_minutes: number } =>
        Boolean(value)
    );

  const timeline_height = Math.round((end_hour - start_hour) * 60 * minute_height_px);

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <h2 className="mb-2 text-base font-semibold text-zinc-900">타임라인 뷰</h2>
      <p className="mb-3 text-xs text-zinc-500">시간대별 집중 업무/휴식 흐름을 확인하고 직접 수정할 수 있습니다.</p>

      <div>
        {timeline_tasks.length === 0 ? (
          <p className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-500">
            아직 시간 블록이 없습니다. 좌측에서 AI 계획을 생성해 주세요.
          </p>
        ) : (
          <div className="flex gap-3">
            <div className="w-12 text-[11px] text-zinc-500">
              {Array.from({ length: end_hour - start_hour + 1 }).map((_, index_value) => {
                const hour_value = start_hour + index_value;
                return (
                  <div
                    key={hour_value}
                    className="flex items-start justify-end pr-1"
                    style={{ height: `${Math.round(60 * minute_height_px)}px` }}
                  >
                    {String(hour_value).padStart(2, "0")}:00
                  </div>
                );
              })}
            </div>

            <div className="relative flex-1 rounded-xl border border-zinc-200 bg-zinc-50" style={{ height: `${timeline_height}px` }}>
              {Array.from({ length: end_hour - start_hour + 1 }).map((_, index_value) => (
                <div
                  key={`line-${index_value}`}
                  className="absolute left-0 right-0 border-t border-dashed border-zinc-200"
                  style={{ top: `${Math.round(index_value * 60 * minute_height_px)}px` }}
                />
              ))}

              <div
                className="absolute inset-0"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const payload_text = event.dataTransfer.getData("application/json");
                  if (!payload_text) {
                    return;
                  }
                  const payload = JSON.parse(payload_text) as { task_id: string; duration_minutes: number };
                  const container_rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
                  const drop_y_px = event.clientY - container_rect.top;
                  const start_minutes = Math.round(drop_y_px / minute_height_px) + start_hour * 60;
                  const end_minutes = start_minutes + Math.max(15, payload.duration_minutes);
                  const to_time_text = (minutes_value: number) =>
                    `${String(Math.floor(minutes_value / 60)).padStart(2, "0")}:${String(
                      Math.max(0, minutes_value % 60)
                    ).padStart(2, "0")}`;
                  void on_update_schedule(payload.task_id, to_time_text(start_minutes), to_time_text(end_minutes));
                }}
              />

              {positioned_tasks.map(({ task_item, top_px, height_px }) => (
                <article
                  key={task_item.id}
                  className="absolute left-2 right-2 z-10 rounded-lg border border-blue-200 bg-blue-100/90 p-2 shadow-sm"
                  style={{ top: `${top_px}px`, height: `${height_px}px` }}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData(
                      "application/json",
                      JSON.stringify({
                        task_id: task_item.id,
                        duration_minutes: Math.max(15, to_minutes(task_item.scheduled_end_at) - to_minutes(task_item.scheduled_start_at)),
                      })
                    );
                  }}
                >
                  <p className="text-xs font-semibold text-zinc-900">{task_item.title}</p>
                  <div className="mt-1 flex items-center gap-1 text-[10px]">
                    <input
                      type="time"
                      className="rounded border border-zinc-300 px-1 py-0.5"
                      value={task_item.scheduled_start_at ?? ""}
                      onChange={(event) =>
                        void on_update_schedule(task_item.id, event.target.value, task_item.scheduled_end_at ?? "")
                      }
                    />
                    <span>~</span>
                    <input
                      type="time"
                      className="rounded border border-zinc-300 px-1 py-0.5"
                      value={task_item.scheduled_end_at ?? ""}
                      onChange={(event) =>
                        void on_update_schedule(task_item.id, task_item.scheduled_start_at ?? "", event.target.value)
                      }
                    />
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
