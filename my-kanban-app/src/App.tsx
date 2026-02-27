import React from "react";
import { BoardPage } from "./features/board/board_page";
import { PlannerPage } from "./features/planner/planner_page";
import { validate_firebase_config } from "./config/firebase_config";

/** 앱 루트 컴포넌트 */
function App() {
  const [active_page, set_active_page] = React.useState<"kanban" | "planner">("kanban");

  /** 앱 시작 시 Firebase 환경변수의 유효성을 검증 */
  React.useEffect(() => {
    validate_firebase_config();
  }, []);

  return (
    <div className="min-h-screen bg-zinc-100">
      <nav className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center gap-2">
          <button
            type="button"
            className={[
              "rounded-lg px-3 py-2 text-sm font-medium",
              active_page === "kanban"
                ? "bg-zinc-900 text-white"
                : "border border-zinc-300 bg-white text-zinc-700",
            ].join(" ")}
            onClick={() => set_active_page("kanban")}
          >
            칸반보드
          </button>
          <button
            type="button"
            className={[
              "rounded-lg px-3 py-2 text-sm font-medium",
              active_page === "planner"
                ? "bg-zinc-900 text-white"
                : "border border-zinc-300 bg-white text-zinc-700",
            ].join(" ")}
            onClick={() => set_active_page("planner")}
          >
            플래너
          </button>
        </div>
      </nav>

      {active_page === "kanban" ? <BoardPage /> : <PlannerPage />}
    </div>
  );
}

export default App;
