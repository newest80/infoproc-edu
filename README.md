# 정처산기 스터디

정보처리산업기사 필기 대비 교육용 웹사이트와, 이 사이트를 계속 개발하기 위한 Claude Code 에이전트 팀입니다.

## 실행

```bash
npm run serve
```
→ http://localhost:5173 (의존성 설치 불필요, Node 18+)

```bash
npm test
```
→ 콘텐츠 검증 + Playwright 스모크 테스트

## 사이트 기능
- 과목별 개념 노트 (토픽 단위)
- 과목·토픽별 연습 문제 (즉시 채점 + 해설, 키보드 1~4)
- 시간제한 모의고사 (문항 팔레트, 자동 제출, 과락·평균 합격 판정)
- 오답노트 (자동 수집, 다시 맞히면 제거)
- 학습 기록 (과목별 정답률, 취약 토픽, 최근 풀이)

## 에이전트 팀으로 개발하기

이 폴더에서 Claude Code를 열면 `CLAUDE.md`와 `.claude/`가 자동으로 로드됩니다.

| 이렇게 요청하면 | 실행되는 흐름 |
|---|---|
| `/add-questions s3 sql 10` | question-author 작성 → 코드 실행 검증 → qa-reviewer 감수 |
| `/new-feature 다크모드 토글 버튼` | 설계 → frontend-dev 구현 → qa-reviewer 검토 → 수정 반복 |
| `/check` | 테스트 + 토픽별 문제/노트 커버리지 + 다음 작업 제안 |
| "exam-researcher로 출제기준 검증해줘" | Q-Net 대조 → docs/exam-spec.md, subjects.json 갱신 |
| "content-writer로 운영체제 노트 보강해줘" | 개념 노트 작성 → 검증 |
