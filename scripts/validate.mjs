// 콘텐츠 검사기: node scripts/validate.mjs [--coverage]
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA = fileURLToPath(new URL('../site/data/', import.meta.url));
const errors = [];
const warnings = [];
const load = (p) => {
  try { return JSON.parse(readFileSync(join(DATA, p), 'utf8')); }
  catch (e) { errors.push(`${p}: JSON 파싱 실패 — ${e.message}`); return null; }
};

const meta = load('subjects.json');
if (!meta) { report(); }
const subjects = new Map(meta.subjects.map((s) => [s.id, new Set(s.topics.map((t) => t.id))]));
const seen = new Set();
const coverage = {};

for (const [sid, topics] of subjects) {
  coverage[sid] = Object.fromEntries([...topics].map((t) => [t, { q: 0, n: 0 }]));

  // 문제
  const qf = load(`questions/${sid}.json`);
  if (qf) {
    if (qf.subject !== sid) errors.push(`questions/${sid}.json: subject 값이 "${qf.subject}"`);
    const answerDist = [0, 0, 0, 0];
    let negative = 0;
    qf.questions.forEach((q, i) => {
      const at = `questions/${sid}.json[${i}] ${q.id ?? '(id 없음)'}`;
      if (!/^s\d+-[a-z0-9]+-\d{3}$/.test(q.id || '')) errors.push(`${at}: id 형식 오류 (예: ${sid}-topic-001)`);
      else if (!q.id.startsWith(sid + '-' + q.topic + '-')) errors.push(`${at}: id 접두사가 과목/토픽(${sid}-${q.topic})과 다름`);
      if (seen.has(q.id)) errors.push(`${at}: 중복 id`);
      seen.add(q.id);
      if (!topics.has(q.topic)) errors.push(`${at}: 알 수 없는 topic "${q.topic}"`);
      else coverage[sid][q.topic].q++;
      if (![1, 2, 3].includes(q.difficulty)) errors.push(`${at}: difficulty는 1~3`);
      if (typeof q.question !== 'string' || q.question.trim().length < 5) errors.push(`${at}: question이 비었거나 너무 짧음`);
      if (q.code != null && typeof q.code !== 'string') errors.push(`${at}: code는 문자열이어야 함`);
      if (!Array.isArray(q.options) || q.options.length !== 4) errors.push(`${at}: options는 정확히 4개`);
      else {
        if (q.options.some((o) => typeof o !== 'string' || !o.trim())) errors.push(`${at}: 빈 선택지`);
        if (new Set(q.options.map((o) => String(o).trim())).size !== 4) errors.push(`${at}: 중복 선택지`);
      }
      if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) errors.push(`${at}: answer는 0~3 정수`);
      else answerDist[q.answer]++;
      if (typeof q.explanation !== 'string' || q.explanation.trim().length < 15) errors.push(`${at}: explanation이 비었거나 너무 짧음`);
      if (/<[a-z/][^>]*>/i.test(q.question + (q.explanation || '')) && !q.code) warnings.push(`${at}: HTML 태그처럼 보이는 문자열 (텍스트로 표시됨)`);
      if (/않은|아닌|틀린/.test(q.question)) negative++;
    });
    const n = qf.questions.length;
    if (n >= 8) {
      const max = Math.max(...answerDist);
      if (max / n > 0.4) warnings.push(`questions/${sid}.json: 정답 위치 편중 ${JSON.stringify(answerDist)} (0~3번)`);
      if (negative / n > 0.3) warnings.push(`questions/${sid}.json: 부정형 문제 비율 ${Math.round((negative / n) * 100)}% (권장 30% 이하)`);
    }
  }

  // 노트
  const nf = load(`notes/${sid}.json`);
  if (nf) {
    if (nf.subject !== sid) errors.push(`notes/${sid}.json: subject 값이 "${nf.subject}"`);
    nf.sections.forEach((s, i) => {
      const at = `notes/${sid}.json sections[${i}]`;
      if (!topics.has(s.topic)) errors.push(`${at}: 알 수 없는 topic "${s.topic}"`);
      else coverage[sid][s.topic].n++;
      if (!s.title) errors.push(`${at}: title 없음`);
      if (!Array.isArray(s.points) || !s.points.length || s.points.some((p) => typeof p !== 'string' || !p.trim())) errors.push(`${at}: points 오류`);
    });
  }
}

// 고아 파일
for (const dir of ['questions', 'notes']) {
  for (const f of readdirSync(join(DATA, dir))) {
    if (!subjects.has(f.replace(/\.json$/, ''))) warnings.push(`${dir}/${f}: subjects.json에 없는 과목 파일`);
  }
}

if (process.argv.includes('--coverage')) {
  console.log('과목\t토픽\t문제\t노트섹션');
  for (const [sid, topics] of Object.entries(coverage)) {
    for (const [tid, c] of Object.entries(topics)) console.log(`${sid}\t${tid}\t${c.q}\t${c.n}${c.q < 5 ? '\t← 문제 부족' : ''}${c.n === 0 ? '\t← 노트 없음' : ''}`);
  }
  console.log(`\n시험 정보 검증 상태: ${meta.exam.verified ? '검증됨' : '미검증 (exam-researcher 실행 필요)'}`);
}

report();

function report() {
  for (const w of warnings) console.warn('경고: ' + w);
  if (errors.length) {
    for (const e of errors) console.error('오류: ' + e);
    console.error(`\n검증 실패: 오류 ${errors.length}개`);
    process.exit(1);
  }
  console.log(`검증 통과: 문제 ${seen.size}개, 경고 ${warnings.length}개`);
  process.exit(0);
}
