import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { firestore_db } from "../../../config/firebase_client";
import { Task_Item } from "../types/task_types";

const TASKS_COLLECTION_NAME = "tasks";

/** Firestore 문서를 Task_Item으로 변환 */
const to_task_item = (raw_data: Partial<Task_Item>, fallback_id: string): Task_Item => {
  return {
    id: raw_data.id ?? fallback_id,
    title: raw_data.title ?? "",
    description: raw_data.description ?? "",
    category: raw_data.category ?? "미분류",
    priority: raw_data.priority ?? "medium",
    status: raw_data.status ?? "todo",
    createdAt: raw_data.createdAt ?? new Date().toISOString(),
    updatedAt: raw_data.updatedAt ?? new Date().toISOString(),
    is_ai_analyzed: raw_data.is_ai_analyzed ?? false,
    estimated_minutes: raw_data.estimated_minutes ?? 60,
    scheduled_start_at: raw_data.scheduled_start_at ?? "",
    scheduled_end_at: raw_data.scheduled_end_at ?? "",
    source_type: raw_data.source_type ?? "manual",
  };
};

/** 작업 카드 Firestore 서비스 */
export const task_service = {
  /** 전체 카드 조회 */
  list_tasks: async (): Promise<Task_Item[]> => {
    const tasks_ref = collection(firestore_db, TASKS_COLLECTION_NAME);
    const task_query = query(tasks_ref, orderBy("createdAt", "desc"));
    const task_snapshot = await getDocs(task_query);

    return task_snapshot.docs.map((snapshot_item) => {
      const raw_data = snapshot_item.data() as Partial<Task_Item>;
      return to_task_item(raw_data, snapshot_item.id);
    });
  },

  /** 카드 생성 */
  create_task: async (task_item: Task_Item): Promise<void> => {
    const task_doc_ref = doc(firestore_db, TASKS_COLLECTION_NAME, task_item.id);
    await setDoc(task_doc_ref, task_item);
  },

  /** 카드 수정 */
  update_task: async (task_item: Task_Item): Promise<void> => {
    const task_doc_ref = doc(firestore_db, TASKS_COLLECTION_NAME, task_item.id);
    await updateDoc(task_doc_ref, {
      title: task_item.title,
      description: task_item.description ?? "",
      category: task_item.category,
      priority: task_item.priority,
      status: task_item.status,
      updatedAt: task_item.updatedAt,
      is_ai_analyzed: task_item.is_ai_analyzed,
      estimated_minutes: task_item.estimated_minutes,
      scheduled_start_at: task_item.scheduled_start_at ?? "",
      scheduled_end_at: task_item.scheduled_end_at ?? "",
      source_type: task_item.source_type,
    });
  },

  /** 카드 삭제 */
  delete_task: async (task_id: string): Promise<void> => {
    const task_doc_ref = doc(firestore_db, TASKS_COLLECTION_NAME, task_id);
    await deleteDoc(task_doc_ref);
  },
};
