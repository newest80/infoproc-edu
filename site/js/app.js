'use strict';

/* ---------- 저장소: localStorage는 막혀 있을 수 있으므로 항상 이 래퍼만 사용 ---------- */
const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem('jcsg:' + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem('jcsg:' + key, JSON.stringify(value)); } catch { /* 저장 불가 환경 */ }
  },
  remove(key) {
    try { localStorage.removeItem('jcsg:' + key); } catch { /* noop */ }
  },
};

/* ---------- DOM 헬퍼: 데이터는 항상 텍스트 노드로 들어감 ---------- */
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : String(kid));
  }
  return el;
}

// replaceChildren은 false/null을 "false"/"null" 문자열로 출력하므로 반드시 이 함수를 사용
function fill(el, ...kids) {
  el.replaceChildren(...kids.flat(Infinity).filter((k) => k != null && k !== false));
  return el;
}

const DB = { exam: null, subjects: [], questions: [], byId: new Map(), notes: {} };
let cleanup = null; // 현재 화면이 등록한 정리 함수 (타이머·키보드 핸들러 해제)

async function loadData() {
  const getJSON = async (path) => {
    const res = await fetch(path);
    if (!res.ok) throw new Error(path + ' (' + res.status + ')');
    return res.json();
  };
  const meta = await getJSON('data/subjects.json');
  DB.exam = meta.exam;
  DB.subjects = meta.subjects;
  const loaded = await Promise.all(meta.subjects.map((s) => Promise.all([
    getJSON('data/questions/' + s.id + '.json'),
    getJSON('data/notes/' + s.id + '.json'),
  ])));
  loaded.forEach(([q, n], i) => {
    const sid = meta.subjects[i].id;
    for (const item of q.questions) {
      const full = { ...item, subject: sid };
      DB.questions.push(full);
      DB.byId.set(full.id, full);
    }
    DB.notes[sid] = n.sections;
  });
}

const subjectOf = (id) => DB.subjects.find((s) => s.id === id);
const topicName = (sid, tid) => subjectOf(sid)?.topics.find((t) => t.id === tid)?.name || tid;
const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const pct = (c, t) => (t ? Math.round((c / t) * 100) : 0);
const fmtTime = (sec) => {
  const m = Math.floor(sec / 60), s = sec % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
};
const fmtDate = (ts) => new Date(ts).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' });

/* ---------- 학습 기록 ---------- */
function recordResults(session) {
  const wrong = new Set(store.get('wrong', []));
  const qstats = store.get('qstats', {});
  session.qs.forEach((q, i) => {
    const ok = session.picks[i] === q.answer;
    const st = qstats[q.id] || [0, 0];
    st[ok ? 0 : 1] += 1;
    qstats[q.id] = st;
    if (ok) wrong.delete(q.id); else wrong.add(q.id);
  });
  store.set('wrong', [...wrong]);
  store.set('qstats', qstats);
  const history = store.get('history', []);
  history.unshift({
    at: Date.now(),
    title: session.title,
    mode: session.mode,
    correct: session.qs.filter((q, i) => session.picks[i] === q.answer).length,
    total: session.qs.length,
  });
  store.set('history', history.slice(0, 50));
}

/* ---------- 화면: 홈 ---------- */
function viewHome() {
  const w = DB.exam.written;
  const wrongCount = store.get('wrong', []).length;
  return [
    h('h1', null, DB.exam.name + ' 필기 대비'),
    h('p', { class: 'muted' }, '개념을 정리하고, 과목별로 문제를 풀고, 실전처럼 모의고사를 보세요.'),
    h('dl', { class: 'facts' },
      h('div', null, h('dt', null, '문항'), h('dd', null, w.questions + '문항 (과목당 ' + w.perSubject + ')')),
      h('div', null, h('dt', null, '시간'), h('dd', null, w.minutes + '분')),
      h('div', null, h('dt', null, '형식'), h('dd', null, w.format)),
      h('div', null, h('dt', null, '합격 기준'), h('dd', null, '과목 ' + w.subjectCutoff + '점↑ · 평균 ' + w.passAverage + '점↑')),
    ),
    !DB.exam.verified && h('p', { class: 'notice' }, '시험 정보는 아직 최신 출제기준과 대조하지 않았습니다. 응시 전 Q-Net 공고를 꼭 확인하세요.'),
    h('h2', null, '과목'),
    h('div', { class: 'grid' }, DB.subjects.map((s) => {
      const n = DB.questions.filter((q) => q.subject === s.id).length;
      return h('section', { class: 'card', 'aria-labelledby': 'subj-' + s.id },
        h('span', { class: 'tag' }, s.no + '과목'),
        h('h3', { id: 'subj-' + s.id }, s.name),
        h('p', { class: 'muted small' }, s.topics.map((t) => t.name).join(' · ')),
        h('p', { class: 'small' }, '문제 ' + n + '개'),
        h('div', { class: 'actions' },
          h('a', { class: 'btn', href: '#/learn/' + s.id }, '개념 노트'),
          h('a', { class: 'btn primary', href: '#/quiz/' + s.id }, '문제 풀기'),
        ),
      );
    })),
    h('h2', null, '바로 가기'),
    h('div', { class: 'actions' },
      h('a', { class: 'btn primary', href: '#/mock' }, '모의고사 보기'),
      h('a', { class: 'btn', href: '#/wrong' }, '오답노트 (' + wrongCount + ')'),
    ),
  ];
}

/* ---------- 화면: 개념 노트 ---------- */
function viewLearn(sid) {
  const s = subjectOf(sid);
  if (!s) return viewNotFound();
  const sections = DB.notes[sid] || [];
  return [
    h('p', null, h('a', { href: '#/' }, '← 홈')),
    h('h1', null, s.no + '과목 ' + s.name),
    h('p', { class: 'muted' }, '토픽별 핵심 정리'),
    s.topics.map((t) => {
      const secs = sections.filter((x) => x.topic === t.id);
      const n = DB.questions.filter((q) => q.subject === sid && q.topic === t.id).length;
      return h('section', { class: 'notes' },
        h('h2', null, t.name),
        secs.length
          ? secs.map((sec) => h('div', { class: 'card' }, h('h3', null, sec.title), h('ul', null, sec.points.map((p) => h('li', null, p)))))
          : h('p', { class: 'muted small' }, '아직 정리된 노트가 없습니다.'),
        n > 0 && h('a', { class: 'btn', href: '#/quiz/' + sid + '/' + t.id }, t.name + ' 문제 풀기 (' + n + ')'),
      );
    }),
  ];
}

/* ---------- 화면: 과목/토픽 문제풀이 (연습 모드) ---------- */
function viewQuiz(sid, tid) {
  const s = subjectOf(sid);
  if (!s) return viewNotFound();
  let pool = DB.questions.filter((q) => q.subject === sid && (!tid || q.topic === tid));
  if (!pool.length) return [h('h1', null, '문제가 없습니다'), h('a', { class: 'btn', href: '#/learn/' + sid }, '노트로 돌아가기')];
  pool = shuffle(pool).slice(0, 10);
  const title = s.name + (tid ? ' · ' + topicName(sid, tid) : '');
  return quizSession({ title, qs: pool, mode: 'practice', back: '#/learn/' + sid });
}

/* ---------- 화면: 모의고사 (시험 모드) ---------- */
function viewMock() {
  const w = DB.exam.written;
  const qs = DB.subjects.flatMap((s) => shuffle(DB.questions.filter((q) => q.subject === s.id)).slice(0, w.perSubject));
  const minutes = Math.max(1, Math.round((w.minutes * qs.length) / w.questions));
  const root = h('div');
  fill(root,
    h('h1', null, '모의고사'),
    h('p', null, '총 ' + qs.length + '문항 · 제한 시간 ' + minutes + '분'),
    qs.length < w.questions && h('p', { class: 'notice' }, '문제 은행이 아직 작아 실제(' + w.questions + '문항)보다 적게 출제됩니다. 시간은 문항 수에 비례해 줄였습니다.'),
    h('p', { class: 'muted small' }, '제출하기 전까지 정답은 공개되지 않습니다. 시간이 끝나면 자동으로 제출됩니다.'),
    h('button', { class: 'btn primary', type: 'button', onclick: () => {
      fill(root, quizSession({ title: '모의고사', qs, mode: 'exam', minutes, back: '#/' }));
    } }, '시작하기'),
  );
  return root;
}

/* ---------- 퀴즈 엔진 ---------- */
function quizSession({ title, qs, mode, minutes, back }) {
  const S = {
    title, qs, mode,
    idx: 0,
    picks: Array(qs.length).fill(null),
    locked: Array(qs.length).fill(false), // 연습 모드: 답을 고르면 잠그고 해설 공개
    finished: false,
    deadline: mode === 'exam' ? Date.now() + minutes * 60000 : null,
  };
  const root = h('div', { class: 'quiz' });
  let timerEl = null;
  let interval = null;

  function finish() {
    if (S.finished) return;
    S.finished = true;
    if (interval) clearInterval(interval);
    recordResults(S);
    fill(root, resultView(S, back));
    window.scrollTo(0, 0);
  }

  function pick(i) {
    if (S.finished || S.locked[S.idx]) return;
    S.picks[S.idx] = i;
    if (S.mode === 'practice') S.locked[S.idx] = true;
    render();
  }
  function go(delta) {
    const next = S.idx + delta;
    if (next < 0) return;
    if (next >= S.qs.length) {
      if (S.mode === 'practice' && S.locked[S.idx]) finish();
      return;
    }
    S.idx = next;
    render();
  }
  function submit() {
    const empty = S.picks.filter((p) => p == null).length;
    if (empty && !window.confirm('답하지 않은 문항이 ' + empty + '개 있습니다. 제출할까요?')) return;
    finish();
  }

  function tick() {
    if (!timerEl) return;
    const left = Math.max(0, Math.round((S.deadline - Date.now()) / 1000));
    timerEl.textContent = '남은 시간 ' + fmtTime(left);
    timerEl.classList.toggle('low', left <= 300);
    if (left === 0) finish();
  }

  function render() {
    const q = S.qs[S.idx];
    const picked = S.picks[S.idx];
    const locked = S.locked[S.idx];
    const answered = S.picks.filter((p) => p != null).length;
    timerEl = S.mode === 'exam' ? h('span', { class: 'timer', role: 'timer' }) : null;

    const optionButtons = q.options.map((opt, i) => {
      let cls = 'opt';
      if (locked && i === q.answer) cls += ' correct';
      else if (locked && i === picked) cls += ' wrong';
      return h('li', null, h('button', {
        type: 'button', class: cls,
        'aria-pressed': String(picked === i),
        disabled: locked,
        onclick: () => pick(i),
      }, h('span', { class: 'num', 'aria-hidden': 'true' }, i + 1), h('span', null, opt)));
    });

    const isLast = S.idx === S.qs.length - 1;
    fill(root,
      h('div', { class: 'quiz-head' },
        h('h1', null, S.title),
        timerEl,
      ),
      h('p', { class: 'muted small' },
        (S.idx + 1) + ' / ' + S.qs.length + ' · ' + subjectOf(q.subject).name + ' · ' + topicName(q.subject, q.topic)),
      h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(S.qs.length), 'aria-valuenow': String(answered), 'aria-label': '답한 문항 수' },
        h('div', { style: 'width:' + pct(answered, S.qs.length) + '%' })),
      h('div', { class: 'card' },
        h('p', { class: 'qtext', id: 'qtext' }, (S.idx + 1) + '. ' + q.question),
        q.code && h('pre', { class: 'code', tabindex: '0', 'aria-label': '문제 코드' }, h('code', null, q.code)),
        h('ul', { class: 'options', 'aria-labelledby': 'qtext' }, optionButtons),
        h('p', { class: 'muted small' }, '키보드: 1~4 선택 · ← → 이동'),
      ),
      locked && h('div', { class: 'card explain ' + (picked === q.answer ? 'ok' : 'bad'), role: 'status' },
        h('h3', null, picked === q.answer ? '정답입니다' : '오답입니다 — 정답 ' + (q.answer + 1) + '번'),
        h('p', null, q.explanation)),
      S.mode === 'exam' && h('nav', { class: 'palette', 'aria-label': '문항 이동' }, S.qs.map((_, i) => h('button', {
        type: 'button',
        class: (S.picks[i] != null ? 'done ' : '') + (i === S.idx ? 'cur' : ''),
        'aria-label': (i + 1) + '번' + (S.picks[i] != null ? ' (답함)' : ''),
        'aria-current': i === S.idx ? 'step' : null,
        onclick: () => { S.idx = i; render(); },
      }, i + 1))),
      h('div', { class: 'actions' },
        h('button', { type: 'button', class: 'btn', disabled: S.idx === 0, onclick: () => go(-1) }, '이전'),
        S.mode === 'practice'
          ? h('button', { type: 'button', class: 'btn primary', disabled: !locked, onclick: () => go(1) }, isLast ? '결과 보기' : '다음')
          : [
              !isLast && h('button', { type: 'button', class: 'btn', onclick: () => go(1) }, '다음'),
              h('button', { type: 'button', class: 'btn primary', onclick: submit }, '제출'),
            ],
        h('a', { class: 'btn', href: back }, '그만두기'),
      ),
    );
    if (timerEl) tick();
  }

  function onKey(e) {
    if (S.finished || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (/^[1-4]$/.test(e.key)) { pick(Number(e.key) - 1); return; }
    if (e.key === 'ArrowRight') { if (S.mode === 'exam' || S.locked[S.idx]) go(1); }
    else if (e.key === 'ArrowLeft') go(-1);
  }

  document.addEventListener('keydown', onKey);
  if (S.mode === 'exam') interval = setInterval(tick, 1000);
  cleanup = () => {
    document.removeEventListener('keydown', onKey);
    if (interval) clearInterval(interval);
  };
  render();
  return root;
}

function resultView(S, back) {
  const w = DB.exam.written;
  const rows = DB.subjects.map((s) => {
    const idxs = S.qs.map((q, i) => (q.subject === s.id ? i : -1)).filter((i) => i >= 0);
    const correct = idxs.filter((i) => S.picks[i] === S.qs[i].answer).length;
    return { s, total: idxs.length, correct, score: pct(correct, idxs.length) };
  }).filter((r) => r.total > 0);
  const correctAll = rows.reduce((a, r) => a + r.correct, 0);
  const avg = rows.length ? Math.round(rows.reduce((a, r) => a + r.score, 0) / rows.length) : 0;
  const isMock = S.mode === 'exam';
  const passed = rows.every((r) => r.score >= w.subjectCutoff) && avg >= w.passAverage;
  const wrongIdx = S.qs.map((q, i) => i).filter((i) => S.picks[i] !== S.qs[i].answer);

  return h('div', { class: 'result' },
    h('h1', null, S.title + ' 결과'),
    h('div', { class: 'card' },
      h('p', { class: 'big' }, correctAll + ' / ' + S.qs.length),
      isMock
        ? h('p', { class: passed ? 'pass' : 'fail' }, (passed ? '합격 기준 충족' : '불합격') + ' · 평균 ' + avg + '점')
        : h('p', { class: 'muted' }, '정답률 ' + pct(correctAll, S.qs.length) + '%'),
      h('div', { class: 'table-wrap' }, h('table', null,
        h('thead', null, h('tr', null, h('th', null, '과목'), h('th', null, '정답'), h('th', null, '점수'), isMock && h('th', null, '과락'))),
        h('tbody', null, rows.map((r) => h('tr', null,
          h('td', null, r.s.name),
          h('td', null, r.correct + '/' + r.total),
          h('td', null, r.score + '점'),
          isMock && h('td', { class: r.score >= w.subjectCutoff ? 'pass' : 'fail' }, r.score >= w.subjectCutoff ? '통과' : '과락'),
        ))),
      )),
    ),
    h('h2', null, wrongIdx.length ? '틀린 문제 다시 보기 (' + wrongIdx.length + ')' : '모두 맞혔습니다!'),
    wrongIdx.map((i) => {
      const q = S.qs[i];
      return h('div', { class: 'card explain bad' },
        h('p', { class: 'qtext' }, q.question),
        q.code && h('pre', { class: 'code', tabindex: '0' }, h('code', null, q.code)),
        h('p', { class: 'small' }, '내 답: ' + (S.picks[i] == null ? '미응답' : (S.picks[i] + 1) + '. ' + q.options[S.picks[i]])),
        h('p', { class: 'small' }, h('strong', null, '정답: ' + (q.answer + 1) + '. ' + q.options[q.answer])),
        h('p', null, q.explanation),
      );
    }),
    h('div', { class: 'actions' },
      h('button', { type: 'button', class: 'btn primary', onclick: () => router() }, '다시 풀기'),
      h('a', { class: 'btn', href: back }, '돌아가기'),
      h('a', { class: 'btn', href: '#/wrong' }, '오답노트'),
    ),
  );
}

/* ---------- 화면: 오답노트 ---------- */
function viewWrong(arg) {
  const ids = store.get('wrong', []).filter((id) => DB.byId.has(id));
  const qs = ids.map((id) => DB.byId.get(id));
  if (arg === 'retry' && qs.length) {
    return quizSession({ title: '오답 다시 풀기', qs: shuffle(qs), mode: 'practice', back: '#/wrong' });
  }
  return [
    h('h1', null, '오답노트'),
    h('p', { class: 'muted' }, '틀린 문제가 자동으로 모이고, 다시 맞히면 목록에서 빠집니다.'),
    qs.length
      ? [
          h('div', { class: 'actions' },
            h('a', { class: 'btn primary', href: '#/wrong/retry' }, '오답 ' + qs.length + '문제 다시 풀기'),
            h('button', { type: 'button', class: 'btn', onclick: () => {
              if (window.confirm('오답노트를 비울까요?')) { store.set('wrong', []); router(); }
            } }, '비우기'),
          ),
          DB.subjects.map((s) => {
            const list = qs.filter((q) => q.subject === s.id);
            return list.length > 0 && h('section', null,
              h('h2', null, s.name + ' (' + list.length + ')'),
              list.map((q) => h('details', { class: 'card' },
                h('summary', null, q.question.split('\n')[0]),
                q.code && h('pre', { class: 'code', tabindex: '0' }, h('code', null, q.code)),
                h('p', { class: 'small' }, h('strong', null, '정답: ' + (q.answer + 1) + '. ' + q.options[q.answer])),
                h('p', null, q.explanation),
              )),
            );
          }),
        ]
      : h('p', { class: 'card' }, '아직 틀린 문제가 없습니다. 문제를 풀면 여기에 모입니다.'),
  ];
}

/* ---------- 화면: 학습 기록 ---------- */
function viewStats() {
  const qstats = store.get('qstats', {});
  const history = store.get('history', []);
  const agg = (filter) => {
    let c = 0, t = 0;
    for (const [id, [ok, ng]] of Object.entries(qstats)) {
      const q = DB.byId.get(id);
      if (q && filter(q)) { c += ok; t += ok + ng; }
    }
    return { c, t };
  };
  const topicRows = DB.subjects.flatMap((s) => s.topics.map((t) => ({ s, t, ...agg((q) => q.subject === s.id && q.topic === t.id) })))
    .filter((r) => r.t > 0)
    .sort((a, b) => pct(a.c, a.t) - pct(b.c, b.t));

  return [
    h('h1', null, '학습 기록'),
    h('p', { class: 'muted small' }, '기록은 이 브라우저에만 저장됩니다.'),
    h('h2', null, '과목별 정답률'),
    h('dl', { class: 'facts' }, DB.subjects.map((s) => {
      const { c, t } = agg((q) => q.subject === s.id);
      return h('div', null, h('dt', null, s.name), h('dd', null, t ? pct(c, t) + '% (' + c + '/' + t + ')' : '기록 없음'));
    })),
    h('h2', null, '취약 토픽'),
    topicRows.length
      ? h('div', { class: 'table-wrap' }, h('table', null,
          h('thead', null, h('tr', null, h('th', null, '토픽'), h('th', null, '정답률'), h('th', null, ''))),
          h('tbody', null, topicRows.slice(0, 5).map((r) => h('tr', null,
            h('td', null, r.t.name, h('br'), h('span', { class: 'muted small' }, r.s.name)),
            h('td', null, pct(r.c, r.t) + '%'),
            h('td', null, h('a', { href: '#/quiz/' + r.s.id + '/' + r.t.id }, '다시 풀기')),
          ))),
        ))
      : h('p', { class: 'muted' }, '문제를 풀면 취약한 토픽을 알려 드립니다.'),
    h('h2', null, '최근 풀이'),
    history.length
      ? h('div', { class: 'table-wrap' }, h('table', null,
          h('thead', null, h('tr', null, h('th', null, '일시'), h('th', null, '내용'), h('th', null, '점수'))),
          h('tbody', null, history.slice(0, 20).map((r) => h('tr', null,
            h('td', { class: 'small' }, fmtDate(r.at)),
            h('td', null, r.title),
            h('td', null, r.correct + '/' + r.total),
          ))),
        ))
      : h('p', { class: 'muted' }, '아직 기록이 없습니다.'),
    history.length > 0 && h('button', { type: 'button', class: 'btn', onclick: () => {
      if (window.confirm('모든 학습 기록과 오답노트를 삭제할까요?')) {
        ['history', 'qstats', 'wrong'].forEach((k) => store.remove(k));
        router();
      }
    } }, '기록 초기화'),
  ];
}

function viewNotFound() {
  return [h('h1', null, '페이지를 찾을 수 없습니다'), h('a', { class: 'btn', href: '#/' }, '홈으로')];
}

/* ---------- 라우터 ---------- */
const routes = { '': viewHome, learn: viewLearn, quiz: viewQuiz, mock: viewMock, wrong: viewWrong, stats: viewStats };
const navKey = { '': 'home', mock: 'mock', wrong: 'wrong', stats: 'stats' };

function router() {
  if (cleanup) { cleanup(); cleanup = null; }
  const [name = '', ...args] = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  const view = routes[name] || viewNotFound;
  const app = document.getElementById('app');
  const out = view(...args);
  fill(app, out);
  document.querySelectorAll('[data-nav]').forEach((a) => {
    if (a.dataset.nav === navKey[name]) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  const heading = app.querySelector('h1');
  document.title = (heading ? heading.textContent + ' — ' : '') + '정처산기 스터디';
  app.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

loadData()
  .then(() => {
    window.addEventListener('hashchange', router);
    router();
  })
  .catch((err) => {
    fill(document.getElementById('app'), 
      h('h1', null, '데이터를 불러오지 못했습니다'),
      h('p', null, String(err.message || err)),
      h('p', { class: 'muted small' }, 'file:// 로 열었다면 npm run serve 로 로컬 서버를 실행하세요.'),
    );
  });
