# 정처산기 스터디 — 정보처리산업기사 교육용 웹사이트

정보처리산업기사 수험생을 위한 학습 사이트입니다. 개념 노트, 과목별 문제풀이, 시간제한 모의고사, 오답노트, 학습 기록을 제공합니다.
빌드 단계가 없는 순수 HTML/CSS/JS(ES2020) 정적 사이트이며, 콘텐츠는 모두 `site/data/` 아래 JSON 파일에 있습니다.

## 명령어

```bash
npm run serve      # http://localhost:5173 에서 site/ 제공 (fetch 때문에 file:// 로는 안 열림)
npm run validate   # 문제·노트 JSON 스키마/정합성 검사 (콘텐츠 수정 후 반드시 실행)
npm test           # validate + Playwright 스모크 테스트 (데스크톱 + 모바일 375px)
```

## 디렉터리 구조

```
site/index.html            단일 페이지, 해시 라우팅 (#/, #/learn/s1, #/quiz/s1, #/mock, #/wrong, #/stats)
site/js/app.js             라우터, 뷰, 퀴즈 엔진, localStorage 저장소
site/css/style.css         디자인 토큰(:root) + 다크 모드
site/data/subjects.json    시험 정보 + 과목/토픽 목록 (단일 기준 원천)
site/data/questions/sN.json  과목별 문제 은행
site/data/notes/sN.json      과목별 개념 노트
scripts/validate.mjs       콘텐츠 검사기
scripts/serve.mjs          의존성 없는 정적 서버
tests/smoke.cjs            Playwright 스모크 테스트
docs/exam-spec.md          출제기준 조사 결과 (exam-researcher 담당)
```

## 시험 개요 (docs/exam-spec.md로 확인할 것)

- 필기: 3과목, 과목당 20문항, 총 60문항, 객관식 4지 택일, 90분
  1. 정보시스템 기반 기술 (s1) · 2. 프로그래밍 언어 활용 (s2) · 3. 데이터베이스 활용 (s3)
- 합격: 과목당 40점 이상(과락 없음) **그리고** 전 과목 평균 60점 이상
- 실기: 정보처리 실무, 필답형, 100점 만점에 60점 이상
- `subjects.json`의 `exam.verified`가 `false`이면 아직 Q-Net 최신 출제기준과 대조하지 않은 상태입니다. 수치를 바꾸기 전에 exam-researcher를 먼저 실행하세요.

## 데이터 스키마

문제 (`questions/sN.json` → `{ "subject": "s1", "questions": [...] }`):
```json
{
  "id": "s1-sdlc-001",          // {과목}-{토픽}-{3자리 번호}, 전체에서 고유
  "topic": "sdlc",              // subjects.json에 있는 해당 과목의 토픽 id
  "difficulty": 1,              // 1 기초 · 2 보통 · 3 심화
  "question": "...",            // "옳지 않은 것은?" 같은 부정형 문구는 그대로 표기
  "code": "...",                // 선택: 코드 블록 (\n 줄바꿈, 출력값 문제는 실제 실행 결과와 일치해야 함)
  "options": ["", "", "", ""],  // 정확히 4개, 중복 금지
  "answer": 2,                  // 0부터 시작하는 인덱스
  "explanation": "..."          // 정답 이유 + 오답 선택지가 왜 틀렸는지
}
```
노트 (`notes/sN.json` → `{ "subject": "s1", "sections": [{ "topic", "title", "points": [] }] }`)

## 규칙

1. **콘텐츠는 직접 작성한 것만 사용합니다.** 기출문제·시판 교재 문장을 그대로 옮기지 않습니다. 출제 경향을 반영하되 문항은 새로 씁니다.
2. **정확성이 최우선입니다.** 코드 출력 문제는 반드시 실제로 실행해서 확인합니다 (`gcc`/`java`/`python3`를 쓸 수 있으면 사용하고, 없으면 손으로 추적한 과정을 해설에 남깁니다).
3. UI 문구는 한국어로 씁니다. 용어는 시험에서 쓰는 표기를 따르고 영문을 함께 적습니다. 예: 원자성(Atomicity)
4. 렌더링은 `textContent`나 `h()` 헬퍼만 씁니다. 데이터를 `innerHTML`에 넣지 않습니다.
5. 외부 의존성은 추가하지 않습니다. CDN, 프레임워크, 빌드 도구 모두 해당하며, 꼭 필요하면 사용자에게 먼저 묻습니다.
6. 375px 모바일에서 가로 스크롤이 없어야 하고, 라이트·다크 모드를 모두 지원하며, 키보드로 퀴즈를 끝까지 풀 수 있어야 합니다.
7. `localStorage` 접근은 항상 `store` 래퍼를 통해서만 합니다 (try/catch로 감싸져 있음).
8. 작업을 마치기 전에 `npm test`가 통과해야 합니다.

## 에이전트 팀 (.claude/agents/)

| 에이전트 | 역할 | 쓰기 범위 |
|---|---|---|
| `exam-researcher` | Q-Net 출제기준·시험 정보 조사 및 검증 | `docs/exam-spec.md`, `subjects.json`의 exam/topics |
| `content-writer` | 과목별 개념 노트 작성 | `site/data/notes/` |
| `question-author` | 오리지널 문제·해설 작성, 코드 출력 실행 검증 | `site/data/questions/` |
| `frontend-dev` | UI·기능 구현 (퀴즈 엔진, 화면, 접근성) | `site/js`, `site/css`, `site/index.html`, `tests/` |
| `qa-reviewer` | 콘텐츠 정확성 + 코드 리뷰, 테스트 실행 (읽기 전용) | 없음 (보고만) |

워크플로 스킬: `/new-feature <설명>`, `/add-questions <과목> <토픽> <개수>`, `/check`

메인 에이전트는 오케스트레이터 역할을 합니다. 작업을 위 표의 담당 에이전트에게 맡기고, 콘텐츠나 코드를 변경한 뒤에는 항상 `qa-reviewer`로 마무리합니다. qa-reviewer가 지적한 문제는 해당 담당 에이전트에게 다시 보내 수정하게 합니다.
