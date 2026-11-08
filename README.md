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

## 사이트 구성
**필기 연습**
- 과목별 개념 노트
- 토픽별 연습 문제 (즉시 채점과 해설)
- 시간제한 모의고사 (과락·평균으로 합격 판정)
- 오답노트

**타자 연습**
- 핵심 개념 문장·SQL 따라 치기
- 두벌식 기준 타수, 정확도, 세트별 최고 기록

**실기 연습**
- 필답형 직접 입력: 코드 결과 쓰기, SQL 작성, 용어 쓰기
- 자동 채점 (띄어쓰기·대소문자·한영 표기 차이 허용)
- 직접 정답 처리
- 100점 환산 점수

**학습 기록**
- 필기 정답률, 취약 토픽, 타자 최고 기록, 최근 풀이

## 에이전트 팀으로 개발하기

이 폴더에서 Claude Code를 열면 `CLAUDE.md`와 `.claude/`가 자동으로 로드됩니다.

| 이렇게 요청하면 | 실행되는 흐름 |
|---|---|
| `/add-questions s3 sql 10` | question-author 작성 → 코드 실행 검증 → qa-reviewer 감수 |
| `/new-feature 다크모드 토글 버튼` | 설계 → frontend-dev 구현 → qa-reviewer 검토 → 수정 반복 |
| `/check` | 테스트 + 토픽별 문제/노트 커버리지 + 다음 작업 제안 |
| "exam-researcher로 출제기준 검증해줘" | Q-Net 대조 → docs/exam-spec.md, subjects.json 갱신 |
| "content-writer로 운영체제 노트 보강해줘" | 개념 노트 작성 → 검증 |
