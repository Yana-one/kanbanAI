# AI 칸반보드 기본 기능 구현 명세 (React + TypeScript + Tailwind)

이 문서는 `require/database.md`, `require/uiux.md`를 기반으로  
보드의 기본 기능(생성, 수정, 이동, 삭제)을 구현하기 위한 기준 문서입니다.

---

## 1) 구현 목표

- 사용자는 할 일을 생성/수정/이동/삭제할 수 있어야 합니다.
- `AI 정리` 버튼을 눌렀을 때만 AI 분석이 수행됩니다.
- 분석 전 카드는 `AI 미분석` 상태로 대기 영역에 표시됩니다.
- 분석 후 카드는 `todo`, `in_progress`, `done` 컬럼에 자동 배치됩니다.
- 사용자는 AI 결과를 수동으로 다시 수정/이동할 수 있어야 합니다.

---

## 2) 데이터 모델 (Tasks)

`database.md`의 `Tasks` 구조를 그대로 사용합니다.

```ts
/** 작업 카드 상태 타입 */
export type Task_Status = "todo" | "in_progress" | "done";

/** 작업 카드 우선순위 타입 */
export type Task_Priority = "high" | "medium" | "low";

/** 작업 카드 엔티티 */
export interface Task_Item {
  id: string;
  title: string;
  description?: string;
  category: string;
  priority: Task_Priority;
  status: Task_Status;
  createdAt: string;
  updatedAt: string;

  /** AI 분석 완료 여부 (UI 상태 제어용) */
  is_ai_analyzed: boolean;
}
```

> 참고: `is_ai_analyzed`는 UI/UX 요구사항(분석 대기 영역, AI 미분석 뱃지)을 위해 프론트 상태 또는 DB 필드로 추가 권장합니다.

---

## 3) 화면 구조

### A. 입력 영역
- 할 일 입력창(`title`, 선택 `description`)
- `추가` 버튼

### B. 분석 대기 영역
- `is_ai_analyzed === false`인 카드 리스트
- 카드에 `AI 미분석` 뱃지 표시
- `AI 정리` 버튼

### C. 칸반보드 영역
- 3개 컬럼
  - To Do (`todo`)
  - In Progress (`in_progress`)
  - Done (`done`)
- 카드 드래그 앤 드롭 이동

---

## 4) 기능 요구사항

### 4-1. 생성(Create)

#### 동작
1. 사용자가 제목(필수) 입력 후 `추가` 버튼 클릭
2. 유효성 검사
   - 제목 공백만 입력 시 생성 불가
3. 카드 생성
   - 기본값: `status = "todo"`, `priority = "medium"`, `category = "미분류"`, `is_ai_analyzed = false`
4. 분석 대기 영역에 즉시 표시

#### UX 포인트
- 생성 직후 카드에 `AI 미분석` 뱃지 표시
- 에러 시 "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요." 안내

---

### 4-2. 수정(Update)

#### 동작
1. 카드의 `수정` 버튼 클릭
2. 제목/설명/카테고리/우선순위 수정 가능
3. 저장 시 `updatedAt` 갱신

#### 규칙
- 제목은 빈 값 불가
- AI 분석 결과가 있더라도 사용자가 수동으로 수정 가능
- 수정 후에도 `status`는 유지 (사용자가 직접 바꾸지 않은 경우)

---

### 4-3. 이동(Move)

#### 동작
1. 카드를 컬럼 간 드래그 앤 드롭
2. 이동 시 `status`를 대상 컬럼 값으로 변경
3. `updatedAt` 갱신

#### 규칙
- 분석 대기 영역 카드는 기본적으로 보드 컬럼 이동 대상이 아님
- `AI 정리` 완료 후 보드 컬럼으로 진입
- 사용자는 이후 자유롭게 재이동 가능

---

### 4-4. 삭제(Delete)

#### 동작
1. 카드의 `삭제` 버튼 클릭
2. 확인 모달 노출
3. 확인 시 삭제 처리

#### UX 포인트
- 실수 방지용 확인 문구 제공
- 실패 시 일반 메시지 + 재시도 유도 문구 제공

---

## 5) AI 정리 기능 요구사항

### 트리거
- `AI 정리` 버튼 클릭 시점에만 실행

### 대상
- `is_ai_analyzed === false`인 카드 전체

### 처리 흐름
1. 대기 카드 목록 수집
2. 카드별로 Gemini API 요청 (`title` 기반)
3. 응답에서 `category`, `priority`, `status` 반영
4. `is_ai_analyzed = true`로 변경
5. 보드 컬럼으로 자동 배치

### 실패 처리
- 일부 카드 실패 시 성공한 카드만 반영
- 실패 카드는 대기 영역 유지 + 재시도 가능

---

## 6) 컴포넌트 구조 제안

```txt
src/
  features/
    board/
      components/
        task_input.tsx
        pending_task_list.tsx
        board_column.tsx
        task_card.tsx
        delete_task_modal.tsx
      hooks/
        use_board_tasks.ts
        use_ai_organize.ts
      services/
        task_service.ts
        ai_service.ts
      types/
        task_types.ts
      constants/
        board_constants.ts
      board_page.tsx
```

---

## 7) 상태 관리 기준

- `all_tasks`: 전체 카드
- `pending_tasks`: `!is_ai_analyzed`
- `board_tasks_by_status`: 분석 완료 카드의 상태별 그룹
- `is_ai_organizing`: AI 정리 요청 중 여부
- `is_loading`, `error_message`: 비동기 UI 상태

> 작은 규모에서는 React 상태 훅으로 시작하고, 확장 시 Zustand 또는 React Query 도입 권장

---

## 8) Tailwind UI 가이드 (기본)

- 레이아웃: `grid grid-cols-1 md:grid-cols-4 gap-4`
  - 좌측 1칸: 분석 대기
  - 우측 3칸: 칸반 3열
- 카드 공통: `rounded-xl border bg-white p-3 shadow-sm`
- 우선순위 뱃지
  - high: `bg-red-100 text-red-700`
  - medium: `bg-yellow-100 text-yellow-700`
  - low: `bg-green-100 text-green-700`
- 미분석 뱃지: `bg-zinc-100 text-zinc-700`

---

## 9) 이벤트 시나리오 요약

1. 사용자가 할 일 입력 후 `추가`  
2. 카드가 분석 대기 영역에 쌓임 (`AI 미분석`)  
3. 사용자가 `AI 정리` 클릭  
4. AI 분석 결과에 따라 카드 자동 배치  
5. 사용자가 카드 수정/이동/삭제로 최종 정리

---

## 10) 최소 구현 체크리스트

- [ ] 카드 생성 (유효성 포함)
- [ ] 카드 수정 (제목 필수)
- [ ] 카드 이동 (드래그 앤 드롭)
- [ ] 카드 삭제 (확인 모달)
- [ ] 분석 대기 영역 + 미분석 뱃지
- [ ] AI 정리 버튼 일괄 처리
- [ ] 분석 실패 카드 재시도 UX
- [ ] 상태/로딩/에러 메시지 처리

---

## 11) 사용자 경험(UX) 개선 포인트

### 11-1. 로딩 상태 표시 (AI 분석 중)

- `AI 정리` 실행 중에는 버튼을 비활성화하고 로딩 인디케이터를 표시합니다.
- 버튼 텍스트를 `AI 정리 중...`으로 변경하여 현재 상태를 명확히 전달합니다.
- 분석 대기 카드 영역 상단에 전체 진행 상태를 표시합니다.  
  예: `3 / 10 분석 완료`

#### 권장 UI
- 전체 로딩: 스피너 + 반투명 오버레이
- 카드 단위 로딩: 카드 우측 상단 작은 스피너

---

### 11-2. 오류 처리 (API 호출 실패)

- 오류 메시지는 사용자에게 구체적인 내부 원인 대신 일반 메시지로 안내합니다.
- 실패한 카드는 대기 영역에 유지하고, `다시 시도` 액션을 제공합니다.
- 전역 토스트 + 카드 인라인 오류를 함께 사용해 가시성을 높입니다.

#### 권장 메시지 예시
- 기본: `요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.`
- 재시도 안내: `문제가 계속되면 네트워크 상태를 확인한 뒤 다시 시도해 주세요.`

---

### 11-3. 드래그 앤 드롭 시각적 피드백

- 드래그 중인 카드는 확대(`scale`)와 그림자 강조로 현재 선택 상태를 표현합니다.
- 드롭 가능한 컬럼은 배경색/테두리 강조로 드롭 위치를 명확히 보여줍니다.
- 드롭 직후 짧은 트랜지션을 적용해 이동 결과를 자연스럽게 인지시킵니다.

#### Tailwind 예시 클래스
- 드래그 카드: `scale-105 rotate-1 shadow-xl opacity-95`
- 드롭 영역 강조: `ring-2 ring-blue-400 bg-blue-50`

---

### 11-4. 필터링 (카테고리, 우선순위별)

- 보드 상단에 필터 바를 배치하고, 다중 조건 필터를 지원합니다.
  - 카테고리: 전체 / 마케팅 / 개발 / 디자인 ...
  - 우선순위: 전체 / high / medium / low
- 필터 적용 시 현재 결과 개수를 표시합니다.  
  예: `총 24개 중 8개 표시`
- `필터 초기화` 버튼을 제공해 빠른 복귀를 지원합니다.

#### 상태 예시
- `selected_category: string`
- `selected_priority: "all" | "high" | "medium" | "low"`

---

### 11-5. 모바일 대응 (반응형 레이아웃)

- 모바일에서는 단일 컬럼 + 가로 스와이프 가능한 보드 레이아웃을 사용합니다.
- 터치 환경에서 카드 조작이 쉽도록 최소 터치 영역(44px 이상)을 유지합니다.
- 상단 고정 액션바(입력/AI 정리/필터)로 주요 기능 접근성을 높입니다.

#### 권장 반응형 전략
- `sm`: 입력/필터 세로 정렬
- `md`: 2열 구성 (대기 + 보드)
- `lg`: 4열 구성 (대기 1 + 보드 3)

---

## 12) UX 개선 체크리스트

- [ ] AI 정리 중 버튼 비활성화 + 진행 상태 표시
- [ ] API 실패 시 토스트/인라인 오류 + 재시도 제공
- [ ] 드래그 카드/드롭 영역 시각 강조 스타일 적용
- [ ] 카테고리/우선순위 필터 + 초기화 버튼 구현
- [ ] 모바일 반응형 레이아웃 및 터치 영역 기준 적용
