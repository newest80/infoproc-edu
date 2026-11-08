---
name: add-questions
description: 문제 은행에 오리지널 문제를 추가하는 워크플로(question-author 작성 → qa-reviewer 감수 → 수정). "문제 N개 추가", "OO 토픽 문제 만들어줘" 같은 요청에 사용.
argument-hint: <과목 s1|s2|s3|all> <토픽 id|all> <개수>
---

# 문제 추가 워크플로

인자: $ARGUMENTS (형식: 과목, 토픽, 개수. 빠진 값은 기본값 사용: 과목 all, 토픽 all, 개수 10)

1. `site/data/subjects.json`과 각 과목 문제 파일을 읽고, 토픽별 문제 수를 표로 정리합니다. 토픽이 `all`이면 문제가 적은 토픽부터 배분합니다.
2. 과목이 여러 개이면 과목마다 `question-author` 에이전트를 하나씩 **병렬로** 실행합니다. 넘길 내용: 과목, 토픽별 개수, 기존 문제 id 목록.
3. 모든 작성이 끝나면 `qa-reviewer`에게 새로 추가된 문제 id만 넘겨 감수를 맡깁니다.
4. `치명`·`중요` 지적은 해당 과목의 `question-author`에게 다시 보내 고치게 합니다. 고친 뒤 `npm run validate`를 다시 실행합니다.
5. 사용자에게 보고합니다: 추가한 개수(과목·토픽별), 정답 분포, 실행으로 검증한 문제 수, 감수 결과.
