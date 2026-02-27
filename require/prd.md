# AI 칸반보드 PRD (Product Requirements Document)

## 1. 문서 목적
- 본 문서는 `require/database.md`, `require/uiux.md`, `require/borad.md`를 통합하여 AI 칸반보드의 제품 요구사항을 정의합니다.
- 구현 대상 프로젝트는 `my-kanban-app`(React + TypeScript + Tailwind)입니다.
- 본 문서를 기준으로 MVP 개발, 테스트, 검수 기준을 일관되게 맞춥니다.

---

## 2. 제품 개요
- 사용자는 할 일을 자유 입력하고, 원하는 시점에 `AI 정리`를 실행해 업무를 자동 분류합니다.
- AI는 각 할 일을 `category`, `priority`, `status`로 분석합니다.
- 분석 결과는 칸반보드(To Do / In Progress / Done)에 자동 반영됩니다.
- 사용자는 AI 결과를 신뢰하되, 언제든 수동으로 수정/이동/삭제할 수 있습니다.

핵심 가치:
- 제어감: AI는 자동 상시 실행이 아니라 버튼 기반 실행
- 예측성: 분석 전/후 상태가 명확히 분리
- 효율성: 반복 정리 작업 감소

---

## 3. 목표와 비목표

### 3.1 목표 (Goals)
- 기본 보드 기능 완성: 생성, 수정, 이동, 삭제
- AI 일괄 분석 기능 완성: `AI 정리` 버튼 기반
- 분석 대기 영역 + 분석 완료 보드 영역 분리
- 반응형 UI 및 기본 UX 개선(로딩/오류/피드백/필터) 제공

### 3.2 비목표 (Non-Goals, MVP 범위 제외)
- 사용자 인증/권한 관리
- 실시간 협업(멀티 유저 동시 편집)
- 고급 리포팅/통계 대시보드
- 알림/이메일/푸시 연동

---

## 4. 타겟 사용자 및 사용 시나리오
- 개인 또는 소규모 팀의 실무자(기획/개발/디자인/마케팅)
- 사용 시나리오:
  1) 할 일을 빠르게 여러 개 입력
  2) AI 분석 대기 리스트를 확인
  3) `AI 정리` 실행
  4) 자동 분류된 보드에서 카드 수정/이동/삭제
  5) 카테고리/우선순위 필터로 집중 작업

---

## 5. 핵심 사용자 흐름 (User Flow)
1. 사용자가 제목(필수) 중심으로 할 일을 입력하고 `추가`
2. 카드는 `AI 미분석` 뱃지와 함께 대기 영역에 표시
3. 사용자가 `AI 정리` 버튼 클릭
4. Gemini API가 대기 카드들을 분석 (`category`, `priority`, `status`)
5. 분석 완료 카드는 칸반 컬럼으로 자동 이동
6. 사용자는 필요 시 카드 수정/드래그 이동/삭제 수행
7. 필터(카테고리/우선순위)로 카드 목록 정제

---

## 6. 기능 요구사항 (Functional Requirements)

### FR-01 카드 생성 (Create)
- 제목 필수, 공백 입력 불가
- 생성 시 기본값:
  - `status = todo`
  - `priority = medium`
  - `category = 미분류`
  - `is_ai_analyzed = false`
- 생성된 카드는 분석 대기 영역에 즉시 표시

### FR-02 카드 수정 (Update)
- 수정 가능 항목: 제목, 설명, 카테고리, 우선순위
- 제목은 빈 값 불가
- 저장 시 `updatedAt` 갱신
- AI 분석 결과 이후에도 사용자 수동 수정 가능

### FR-03 카드 이동 (Move)
- 드래그 앤 드롭으로 컬럼 간 이동
- 이동 시 `status`를 대상 컬럼으로 갱신
- 이동 시 `updatedAt` 갱신
- 분석 전 카드는 기본적으로 대기 영역에 유지

### FR-04 카드 삭제 (Delete)
- 삭제 버튼 클릭 시 확인 모달 노출
- 확인 후 삭제 반영
- 실패 시 일반 오류 메시지 및 재시도 안내

### FR-05 AI 정리 (Analyze & Organize)
- `AI 정리` 버튼 클릭 시에만 실행
- 대상: `is_ai_analyzed = false` 카드 전체
- 카드별 분석 결과를 반영:
  - `category`, `priority`, `status`
  - `is_ai_analyzed = true`
- 일부 실패 허용: 성공 카드 우선 반영, 실패 카드는 대기 유지

### FR-06 필터링 (Filtering)
- 카테고리 필터 + 우선순위 필터 동시 지원
- 필터 적용 건수 표시 (`총 N개 중 M개`)
- 필터 초기화 제공

---

## 7. 비기능 요구사항 (Non-Functional Requirements)

### NFR-01 UX/사용성
- AI 분석 중 로딩 상태를 명확히 표시
- 오류 발생 시 사용자 친화 메시지 표시
- 드래그 중/드롭 가능 영역 시각 피드백 제공
- 모바일 터치 환경에서 조작 가능한 UI(최소 터치 영역 44px)

### NFR-02 성능
- 일반 조작(생성/수정/삭제/이동)에서 체감 지연 최소화
- 필터링은 즉시 반영(클라이언트 측 계산 기준)

### NFR-03 안정성/복구
- API 실패 시 전체 중단보다 부분 성공 전략 우선
- 실패 카드 재시도 액션 제공

### NFR-04 유지보수성
- 기능 중심 모듈화
- 컴포넌트/훅/서비스/타입/상수 분리
- 중복 로직 최소화(DRY)

---

## 8. 데이터 요구사항

### 8.1 Task 엔티티 필드
- `id: string`
- `title: string`
- `description?: string`
- `category: string`
- `priority: high | medium | low`
- `status: todo | in_progress | done`
- `createdAt: timestamp/string`
- `updatedAt: timestamp/string`
- `is_ai_analyzed: boolean` (UI 상태 제어용 권장 필드)

### 8.2 저장소
- Firebase Firestore(NoSQL) 기준 설계
- 단일 컬렉션 `Tasks` 사용

---

## 9. 화면/인터랙션 요구사항

### 9.1 화면 구성
- 입력 영역: 제목/설명 입력 + 추가 버튼
- 분석 대기 영역: AI 미분석 카드 리스트 + AI 정리 버튼
- 칸반보드 영역: To Do / In Progress / Done

### 9.2 UX 개선 포인트
- 로딩 상태: AI 정리 중 버튼 비활성화 + 스피너 + 진행률
- 오류 처리: 토스트 + 인라인 오류 + 다시 시도
- 드래그 피드백: 드래그 카드 강조, 드롭 영역 강조
- 필터링: 카테고리/우선순위 다중 필터
- 모바일 대응: `sm`, `md`, `lg` 브레이크포인트 기반 반응형

---

## 10. 기술 스택 및 제약
- Frontend: React + TypeScript
- Styling: Tailwind CSS
- Build Base: `my-kanban-app` (기본 React 프로젝트 생성 완료)
- AI 연동: Gemini API
- DB: Firebase Firestore

제약:
- AI 결과는 보조 수단이며 최종 수정 권한은 사용자에게 있음
- 에러 메시지는 내부 상세를 숨긴 일반 메시지 원칙 준수

---

## 11. 권장 아키텍처 (MVVM 기반)

파일 구조는 기능 중심 + MVVM 분리를 따릅니다.

- Model: 타입, 엔티티, 저장소 접근 서비스
- View: 페이지/컴포넌트(UI)
- ViewModel: 상태 훅, 비즈니스 흐름 제어

권장 구조:
- `src/features/board/components`
- `src/features/board/hooks`
- `src/features/board/services`
- `src/features/board/types`
- `src/features/board/constants`
- `src/features/board/board_page.tsx`

---

## 12. 수용 기준 (Acceptance Criteria)

### AC-01 생성
- 유효한 제목 입력 시 카드가 대기 영역에 생성된다.
- 공백 제목 입력 시 생성되지 않고 오류 안내가 표시된다.

### AC-02 AI 정리
- `AI 정리` 클릭 전에는 카드가 자동 분류되지 않는다.
- 클릭 후 대기 카드가 분석되어 보드 컬럼으로 이동한다.

### AC-03 수정/이동/삭제
- 수정 저장 시 변경값과 `updatedAt`이 반영된다.
- 드래그 이동 시 `status`가 컬럼에 맞게 변경된다.
- 삭제 확인 후 카드가 목록에서 제거된다.

### AC-04 UX
- AI 분석 중 로딩 상태를 사용자가 인지할 수 있다.
- API 실패 시 일반 오류 메시지와 재시도 동선을 제공한다.
- 모바일 화면에서도 주요 기능 사용이 가능하다.

---

## 13. 릴리스 범위 (MVP)
- 포함:
  - 보드 CRUD + 이동
  - AI 정리(일괄 분석)
  - 필터(카테고리/우선순위)
  - 기본 반응형 + 로딩/오류 피드백
- 제외:
  - 인증/협업/알림/고급 통계

---

## 14. 개발 체크리스트
- [ ] Task 타입/상태 모델 정의
- [ ] 보드 화면 뼈대(입력/대기/보드) 구성
- [ ] 생성/수정/이동/삭제 동작 구현
- [ ] AI 정리 플로우 및 실패 재시도 구현
- [ ] 필터 바 구현(카테고리/우선순위)
- [ ] 로딩/오류/드래그 피드백 UI 적용
- [ ] 모바일 반응형 검증
- [ ] 수용 기준(AC) 시나리오 테스트 완료