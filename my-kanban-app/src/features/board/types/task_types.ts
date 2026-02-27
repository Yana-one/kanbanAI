/** 작업 카드 상태 타입 */
export type Task_Status = "todo" | "in_progress" | "done";

/** 작업 카드 우선순위 타입 */
export type Task_Priority = "high" | "medium" | "low";

/** 작업 생성 경로 타입 */
export type Task_Source_Type = "chat" | "manual";

/** 작업 카드 엔티티 타입 */
export interface Task_Item {
  id: string;
  title: string;
  description?: string;
  category: string;
  priority: Task_Priority;
  status: Task_Status;
  createdAt: string;
  updatedAt: string;
  is_ai_analyzed: boolean;
  estimated_minutes: number;
  scheduled_start_at?: string;
  scheduled_end_at?: string;
  source_type: Task_Source_Type;
}
