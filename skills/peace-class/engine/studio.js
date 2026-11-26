/* 수업 영상 스튜디오 — 선생님이 스타일을 눈으로 고르고, 시나리오를 화면에서 고치고, 수업용 파일로 저장한다.
 * 이 파일 하나에 엔진 · 글꼴 · 수식이 다 들어 있다(인터넷 · 설치 없음).
 */
(() => {
  const PC = window.PeaceClass;
  const h = (tag, attrs = {}, ...kids) => {
    const e = document.createElement(tag);
    for (const k in attrs) {
      const v = attrs[k];
      if (k === 'class') e.className = v; else if (k === 'style') e.style.cssText = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k === 'value') e.value = v; else if (k === 'checked') e.checked = !!v;
      else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
    }
    kids.flat().forEach(c => { if (c != null && c !== false) e.append(c.nodeType ? c : String(c)); });
    return e;
  };
  const clone = o => JSON.parse(JSON.stringify(o));
  const store = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
  // 아티팩트(claude.ai 안)에서는 alert · confirm 이 안 뜬다 → 화면 안에서 묻고 알린다
  const IN_ART = !!(window.claude && typeof window.claude.use === 'function');
  const modal = (msg, btns) => new Promise(res => {
    const box = h('div', { class: 'ask' }, h('div', {}, h('p', {}, msg), h('div', { class: 'btns' }, btns.map(([label, v, cls]) => h('button', { class: cls || '', onclick: () => { box.remove(); res(v); } }, label)))));
    document.body.append(box); box.querySelector('button:last-child')?.focus();
  });
  const uiAsk = (msg, yes = '네', no = '아니요') => modal(msg, [[no, false, 'ghost'], [yes, true, 'main']]);
  const uiSay = msg => modal(msg, [['확인', true, 'main']]);

  // ---------- 장면 틀과 칸 ----------
  const TYPES = {
    title: { name: '제목', tip: '오늘 배울 것 한 단어 + 손글씨 한 줄', fields: [['title', '제목', 'text'], ['sub', '손글씨 한 줄', 'text']], make: () => ({ title: '제목', sub: '손글씨 한 줄' }) },
    concept: { name: '개념', tip: '용어와 정의 · 핵심 말을 형광펜으로', fields: [['term', '용어', 'text'], ['text', '정의', 'area'], ['keys', '형광펜으로 칠할 말 (정의 안에 똑같이 있는 말)', 'list'], ['label', '위 작은 글 (비우면 "개념")', 'text']], make: () => ({ term: '용어', text: '정의를 적어 주세요', keys: [] }) },
    fix: { name: '흔한 실수', tip: '틀린 생각 → ✕ → 되감기 → 바른 생각', fields: [['label', '위 작은 글 (비우면 "흔한 실수")', 'text'], ['wrong', '틀린 말', 'text'], ['right', '바른 말', 'text'], ['why', '손글씨 까닭', 'text'], ['stamp', '도장 글 (적으면 어느 스타일이든 도장 쾅 · 신문은 비워도 "정답")', 'text']], make: () => ({ wrong: '틀린 말', right: '바른 말', why: '' }) },
    steps: { name: '수식 · 풀이', tip: '한 줄씩 올라오고 바뀐 곳은 형광', fields: [['title', '위 제목', 'text'], ['lines', '한 줄씩 (수식 = LaTeX · 형광 = \\hl{…})', 'list'], ['tex', '수식으로 보기 (끄면 일반 글 · 형광 = [[…]])', 'check'], ['note', '손글씨 메모', 'text']], make: () => ({ title: '', lines: ['2x + 3 = 7', '2x = \\hl{4}', 'x = \\hl{2}'], note: '' }) },
    graph: { name: '함수 그래프', tip: '좌표축 · 곡선이 그려지고 점 · 기울기', fields: [['fns', '함수 (식 · 이름)', 'pairs', ['식  예) 2*x+1 · x**2 · sin(x)', '이름  예) y = 2x + 1'], ['f', 'label']], ['x', 'x 범위', 'range'], ['y', 'y 범위', 'range'], ['points', '점 (x · y · 이름)', 'triples', ['x', 'y', '이름 (비우면 좌표)']], ['tri', '기울기 삼각형', 'tri'], ['note', '손글씨 메모', 'text']], make: () => ({ fns: [{ f: 'x**2', label: 'y = x^2' }], x: [-4, 4], y: [-2, 10], points: [], note: '' }) },
    bars: { name: '막대그래프', tip: '값은 출처가 있는 자료만 · 대시보드처럼 커서 · 합계', fields: [['title', '제목', 'text'], ['items', '항목 · 값', 'pairs', ['항목', '값']], ['unit', '단위', 'text'], ['source', '출처 · 기준 연도', 'text'], ['cursor', '커서가 가장 큰 막대를 눌러 값 띄우기 (대시보드)', 'check'], ['total', '합계 카드가 숫자를 세기 (대시보드)', 'check']], make: () => ({ title: '제목', items: [['가', 3], ['나', 5]], unit: '', source: '' }) },
    timeline: { name: '연표', tip: '선 위로 때와 일이 차례로', fields: [['title', '위 제목', 'text'], ['events', '때 · 일', 'pairs', ['때', '일']], ['scale', '연도 간격대로 띄우기', 'check']], make: () => ({ title: '연표', events: [['1392', '사건'], ['1446', '사건']] }) },
    compare: { name: '둘 비교', tip: '양쪽이 엇갈려 들어온다', fields: [['left.title', '왼쪽 제목', 'text'], ['left.points', '왼쪽 내용', 'list'], ['right.title', '오른쪽 제목', 'text'], ['right.points', '오른쪽 내용', 'list'], ['vs', '가운데 글 (비우면 vs)', 'text']], make: () => ({ left: { title: 'A', points: ['내용'] }, right: { title: 'B', points: ['내용'] } }) },
    process: { name: '과정', tip: '단계가 차례로 채워진다', fields: [['title', '위 제목', 'text'], ['steps', '단계', 'list']], make: () => ({ title: '과정', steps: ['첫째', '둘째', '셋째'] }) },
    gallery: { name: '모아 보기', tip: '같은 그림을 스타일마다 한 칸씩 — 격자로 한 화면에', fields: [['title', '위 작은 글', 'text'], ['note', '아래 한 줄 (손글씨)', 'text']], make: () => ({ draw: 'leaf', title: '같은 잎, 여러 얼굴', note: '' }) },
    photo: { name: '사진', tip: '사진을 넣고 짚을 곳을 눌러 이름표 달기', fields: [['src', '사진 · 그림 (위를 누르면 그 자리에 이름표)', 'photo'], ['title', '위 작은 글', 'text'], ['caption', '설명 (형광 = [[…]])', 'area']], make: () => ({ src: '', title: '', caption: '', pins: [] }) },
    hangul: { name: '한글 조립', tip: '자모가 날아와 글자가 되고, 자모 하나가 바뀌면 뜻이 바뀐다', fields: [['title', '위 작은 글', 'text'], ['words', '낱말 · 뜻 (차례로 바뀜 · 같은 글자 수가 좋아요)', 'pairs', ['낱말  예) 불', '뜻  예) 타오르는 불']], ['note', '손글씨 메모', 'text']], make: () => ({ title: '자음 하나로 뜻이 바뀐다', words: [['불', '타오르는 불'], ['풀', '들판의 풀'], ['뿔', '소의 뿔']], note: '' }) },
    end: { name: '마무리', tip: '전할 것 한 문장 · 점이 마침표가 된다', fields: [['text', '마무리 한 마디 (손글씨)', 'text'], ['sub', '아래 작은 글', 'text']], make: () => ({ text: '마무리 한 마디', sub: '' }) },
  };
  const SUBJECTS = ['수학', '과학', '국어', '영어', '사회', '기타'];
  const MOODS = [['calm', '잔잔하게'], ['bright', '밝고 통통'], ['serious', '무겁게 (단조)']];
  const getp = (o, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const setp = (o, path, v) => { const ks = path.split('.'); let a = o; ks.slice(0, -1).forEach(k => { if (a[k] == null) a[k] = {}; a = a[k]; }); if (v === '' || v == null) delete a[ks.at(-1)]; else a[ks.at(-1)] = v; };

  // ---------- 상태 ----------
  let L = clone(window.START_LESSON || (window.EXAMPLES && window.EXAMPLES[0] && window.EXAMPLES[0].lesson));
  if (!L.style) L.style = L.theme || 'dark';
  delete L.theme;
  let cur = 0, inst = null, playing = false, t = 0, last = 0, ac = null, src = null, buf = null, bufFor = null, dirty = 0;

  // ---------- 화면 ----------
  const app = document.getElementById('app');
  const fileIn = h('input', { type: 'file', accept: '.json,application/json', style: 'display:none', onchange: e => loadFile(e.target.files[0]) });
  const exSel = h('select', { class: 'ghost', onchange: async e => { const ex = window.EXAMPLES[+e.target.value]; e.target.value = ''; if (ex && await uiAsk(`예시 "${ex.name}" 을(를) 불러올까요? 지금 고친 내용은 사라져요.`, '불러오기', '그만두기')) { L = clone(ex.lesson); L.style = L.style || L.theme || 'dark'; delete L.theme; cur = 0; renderAll(); } } },
    h('option', { value: '' }, '예시 불러오기'), ...(window.EXAMPLES || []).map((ex, i) => h('option', { value: i }, ex.name)));
  const bar = h('header', { class: 'top' },
    h('div', { class: 'brand' }, h('b', {}, '●'), ' 수업 영상 스튜디오'),
    h('div', { class: 'acts' }, h('button', { class: 'ghost', onclick: () => showHelp() }, '쓰는 법'), exSel,
      h('button', { class: 'ghost', onclick: () => fileIn.click() }, '시나리오 열기')), fileIn);
  // 단계: 한 번에 한 가지만 — ① 스타일 · 효과 → ② 글 · 목소리 → ③ 흐름 보기 → ④ 저장
  const STEPS = [['스타일 · 효과', '어떤 느낌으로'], ['글 · 목소리', '화면 글과 대사 고치기'], ['흐름 보기', '장면 순서대로 확인'], ['저장', '수업에 쓰기 · 보내기']];
  let step = 1;
  const stepBtns = STEPS.map(([a, b], k) => h('button', { class: 'stp', onclick: () => setStep(k + 1) }, h('i', {}, String(k + 1)), h('span', {}, h('b', {}, a), h('small', {}, b))));
  const nextBtn = h('button', { class: 'next', onclick: () => setStep(Math.min(4, step + 1)) }, '');
  const stepBar = h('nav', { class: 'stepbar' }, h('div', { class: 'stps' }, stepBtns), nextBtn);
  const left = h('aside', { class: 'left' });
  const right = h('main', { class: 'right' });
  const body = h('div', { class: 'body' }, left, right);
  function setStep(n) {
    step = n; body.dataset.step = n;
    stepBtns.forEach((b, k) => { b.classList.toggle('on', k + 1 === n); b.classList.toggle('done', k + 1 < n); });
    nextBtn.textContent = n < 4 ? `다음: ${n + 1} ${STEPS[n][0]} →` : '처음으로 ↺';
    if (n === 4) nextBtn.onclick = () => setStep(1); else nextBtn.onclick = null;
    scrollTo({ top: 0 }); requestAnimationFrame(() => { if (inst) fitPv(); if (n === 1) refreshGallery(); if (n === 3) refreshFlow(); });
  }
  nextBtn.addEventListener('click', () => { if (step < 4) setStep(step + 1); });
  app.append(bar, stepBar, body);

  // 오른쪽: 스타일 고르기 · 미리보기 · 점검
  const gallery = h('div', { class: 'gallery' });
  const pvWrap = h('div', { class: 'pv' }); const pvStage = h('div'); pvWrap.append(pvStage);
  const chips = h('div', { class: 'chips' });
  const playBtn = h('button', { class: 'play', onclick: () => toggle() }, '▶ 재생');
  const timeEl = h('span', { class: 'time' }, '0:00');
  const qaBox = h('div', { class: 's-qa' });
  const flow = h('div', { class: 'flow' });
  let onlyScene = false;
  const scopeBox = h('div', { class: 'scope' },
    h('label', {}, h('input', { type: 'radio', name: 'scope', checked: true, onchange: () => { onlyScene = false; refreshGallery(); } }), ' 수업 전체에'),
    h('label', {}, h('input', { type: 'radio', name: 'scope', onchange: () => { onlyScene = true; refreshGallery(); } }), ' 지금 장면에만'),
    h('button', { class: 'linkbtn', onclick: () => { L.scenes.forEach(x => delete x.style); changed(true); renderLeft(); refreshGallery(); } }, '장면별 스타일 모두 지우기'));
  const fxBox = h('div', { class: 'fx' });
  function renderFx() {
    fxBox.innerHTML = '';
    fxBox.append(
      h('div', { class: 'fxcard' }, h('div', {}, h('small', {}, '장면 넘김'), h('b', {}, transName(L.trans))), h('button', { class: 'pill main', onclick: pickTrans }, '🎬 움직여 보고 고르기')),
      h('div', { class: 'fxcard' }, h('div', {}, h('small', {}, '박자마다 쾅'), h('b', {}, ({ on: '켜기', off: '끄기' })[L.beat] || '스타일대로')), h('button', { class: 'pill main', onclick: pickBeat }, '🥁 움직여 보고 고르기')));
  }
  const pvSec = h('section', { class: 'sec-pv' }, h('h3', {}, '미리보기 ', h('small', {}, '아래 장면 번호를 누르면 그 장면으로 · 스페이스 = 재생')), pvWrap, h('div', { class: 'ctl' }, playBtn, timeEl, chips), qaBox);
  const saveSec = h('section', { class: 'sec-save' }, h('h3', {}, '어떻게 쓸까요?'),
    h('div', { class: 'savegrid' },
      h('div', { class: 'savecard' }, h('b', {}, '📄 수업에 바로 쓰기'), h('p', {}, '재생 파일 하나로 저장해요. 수업 시간에 열어 재생하고, 다른 선생님께 보내도 돼요.'), h('button', { class: 'pill main', onclick: exportHTML }, '수업용 파일 저장')),
      h('div', { class: 'savecard' }, h('b', {}, '💾 나중에 이어서 · Claude 에게 보내기'), h('p', {}, '고친 내용을 파일로 저장해요. Claude 에게 보내며 "이걸로 내 목소리 넣고 영상 만들어 줘"라고 하면 목소리와 mp4 를 만들어 줘요.'), h('button', { class: 'pill main', onclick: saveJSON }, '시나리오 저장')),
      h('div', { class: 'savecard' }, h('b', {}, '🎬 mp4 영상'), h('p', {}, '영상 파일은 Claude 가 만들어요. 위의 시나리오 파일을 Claude 에게 보내 주세요. 목소리 샘플(10초 녹음)도 함께 보내면 선생님 목소리로 읽어 넣어요.'))));
  right.append(
    h('section', { class: 'sec-style' }, h('h3', {}, '어떤 느낌으로 만들까요? ', h('small', {}, '그림에 마우스를 올리면 움직여요')), h('div', { class: 'row-acts' }, h('button', { class: 'pill main', onclick: () => showStarter() }, '▶ 11가지를 크게 움직여 보기'), scopeBox), gallery),
    h('section', { class: 'sec-fx' }, h('h3', {}, '효과 ', h('small', {}, '설명보다 직접 보고 골라요')), fxBox),
    pvSec,
    h('section', { class: 'sec-flow' }, h('h3', {}, '흐름 보기 ', h('small', {}, '장면 순서대로 · 그림을 누르면 미리보기로 · 아래 칸에서 대사 · 자막을 바로 고쳐요')), flow),
    saveSec);

  function renderAll() { renderLeft(); refresh(true); }

  // ---------- 왼쪽: 수업 정보 · 장면 목록 ----------
  function renderLeft() {
    const keepScroll = left.scrollTop, keepWin = scrollY;
    left.innerHTML = '';
    requestAnimationFrame(() => { left.scrollTop = keepScroll; scrollTo(0, keepWin); });
    const info = h('section', { class: 's-card info' }, h('h3', {}, '수업 정보'),
      row('제목', h('input', { value: L.title || '', oninput: e => { L.title = e.target.value; changed(); } })),
      h('div', { class: 'two' },
        row('과목', h('select', { onchange: e => { L.subject = e.target.value; changed(true); } }, SUBJECTS.map(s => h('option', { value: s, selected: L.subject === s }, s)))),
        row('화면', h('select', { onchange: e => { L.ratio = e.target.value; changed(true); } }, h('option', { value: '16:9', selected: L.ratio !== '9:16' }, '16:9 수업용'), h('option', { value: '9:16', selected: L.ratio === '9:16' }, '9:16 쇼츠')))),
      h('div', { class: 'two' },
        row('학년 · 단원', h('input', { value: L.unit || '', oninput: e => { L.unit = e.target.value; changed(); } })),
        row('소리', h('select', { onchange: e => { L.mood = e.target.value; changed(); } }, MOODS.map(([v, n]) => h('option', { value: v, selected: (L.mood || 'calm') === v }, n))))),
      h('div', { class: 'two' },
        row('자막', h('select', { onchange: e => { if (e.target.value === 'off') L.subs = 'off'; else delete L.subs; changed(true); } }, [['on', '켜기 (목소리 있는 장면)'], ['off', '끄기']].map(([v, n]) => h('option', { value: v, selected: (L.subs === 'off' ? 'off' : 'on') === v }, n))))));
    left.append(h('div', { class: 'lefthead' }, h('h3', { class: 'step' }, '글 · 목소리 고치기 ', h('small', {}, '화면에 나올 글은 여기 있는 것이 전부예요')), h('button', { class: 'pill', onclick: () => voiceAI() }, '🗣 내 목소리 AI')), info);
    renderFx();
    L.scenes.forEach((sc, i) => left.append(sceneCard(sc, i)));
    left.append(addBox(L.scenes.length - 1));
  }
  function row(label, input) { return h('label', { class: 'row' }, h('span', {}, label), input); }

  function sceneCard(sc, i) {
    const T = TYPES[sc.type] || { name: sc.type, fields: [] };
    const card = h('section', { class: 's-card s-scene' + (i === cur ? ' on' : ''), onclick: e => { if (cur !== i) { cur = i; markCur(); jumpTo(i); refreshGallery(); } } });
    card.append(h('div', { class: 'shead' },
      h('span', { class: 'num' }, String(i + 1).padStart(2, '0')), h('b', {}, T.name), h('span', { class: 'tip' }, T.tip || ''),
      h('span', { class: 'tools' },
        h('button', { title: '위로', onclick: e => { e.stopPropagation(); move(i, -1); } }, '↑'),
        h('button', { title: '아래로', onclick: e => { e.stopPropagation(); move(i, 1); } }, '↓'),
        h('button', { title: '복제', onclick: e => { e.stopPropagation(); L.scenes.splice(i + 1, 0, clone(sc)); cur = i + 1; renderAll(); } }, '⧉'),
        h('button', { title: '지우기', onclick: async e => { e.stopPropagation(); if (L.scenes.length > 1 && await uiAsk(`${i + 1}번 장면(${T.name})을 지울까요?`, '지우기', '그만두기')) { L.scenes.splice(i, 1); cur = Math.min(cur, L.scenes.length - 1); renderAll(); } } }, '✕'))));
    card.append(row('이 장면 스타일', h('select', { class: 'stsel', onchange: e => { if (e.target.value) sc.style = e.target.value; else delete sc.style; changed(true); markCur(); refreshGallery(); } },
      h('option', { value: '' }, `수업 스타일대로 (${(PC.STYLES.find(x => x.id === (L.style || 'dark')) || PC.STYLES[0]).name})`), ...PC.STYLES.map(x => h('option', { value: x.id, selected: sc.style === x.id }, x.name)))));
    T.fields.forEach(([path, label, kind, extra, keys]) => card.append(field(sc, path, label, kind, extra, keys)));
    card.append(voiceField(sc, i));
    card.append(h('details', { class: 'more' }, h('summary', {}, '길이'),
      row('머무는 시간(초) · 비우면 저절로', h('input', { type: 'number', step: '0.5', min: '1', value: sc.dur || '', oninput: e => { setp(sc, 'dur', e.target.value ? +e.target.value : ''); changed(); } }))));
    return card;
  }
  function markCur() { [...left.querySelectorAll('.s-scene')].forEach((c, j) => c.classList.toggle('on', j === cur)); }
  function move(i, d) { const j = i + d; if (j < 0 || j >= L.scenes.length) return; const [s] = L.scenes.splice(i, 1); L.scenes.splice(j, 0, s); cur = j; renderAll(); }
  function addBox(after) {
    const box = h('div', { class: 'add' }, h('span', {}, '+ 장면 더하기'));
    Object.entries(TYPES).forEach(([k, T]) => box.append(h('button', { title: T.tip, onclick: () => { L.scenes.splice(after + 1, 0, { type: k, ...T.make() }); cur = after + 1; renderAll(); left.querySelectorAll('.s-scene')[cur]?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }, T.name)));
    return box;
  }

  function field(sc, path, label, kind, extra, keys) {
    const v = getp(sc, path);
    if (kind === 'text') return row(label, h('input', { value: v || '', oninput: e => { setp(sc, path, e.target.value); changed(); } }));
    if (kind === 'area') return row(label, h('textarea', { rows: 3, oninput: e => { setp(sc, path, e.target.value); changed(); } }, v || ''));
    if (kind === 'check') return h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: path === 'tex' ? v !== false : !!v, onchange: e => { setp(sc, path, path === 'tex' ? (e.target.checked ? '' : false) : (e.target.checked || '')); changed(); } }), label);
    if (kind === 'range') { const a = v || [-5, 5]; const n = (j, x) => h('input', { type: 'number', step: 'any', value: a[j], oninput: e => { const r = (getp(sc, path) || [-5, 5]).slice(); r[j] = +e.target.value; setp(sc, path, r); changed(); } }); return row(label, h('div', { class: 'pair' }, n(0), h('span', {}, '부터'), n(1), h('span', {}, '까지'))); }
    if (kind === 'photo') return photoField(sc, label);
    if (kind === 'tri') {
      const on = !!v; const t = v || { fn: 0, at: 0 };
      return h('div', { class: 'row' }, h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: on, onchange: e => { setp(sc, path, e.target.checked ? { fn: 0, at: 0 } : ''); changed(); renderLeft(); } }), label),
        on ? h('div', { class: 'pair' }, h('span', {}, '함수'), h('input', { type: 'number', min: 1, value: (t.fn || 0) + 1, oninput: e => { sc.tri.fn = Math.max(0, +e.target.value - 1); changed(); } }), h('span', {}, '번째의 x ='), h('input', { type: 'number', step: 'any', value: t.at || 0, oninput: e => { sc.tri.at = +e.target.value; changed(); } }), h('span', {}, '에서')) : null);
    }
    // 목록: list(글 하나) · pairs(둘) · triples(셋)
    const n = kind === 'list' ? 1 : kind === 'pairs' ? 2 : 3;
    const arr = (v || []).map(x => clone(x));
    const wrap = h('div', { class: 'list' });
    const read = x => n === 1 ? [x] : keys ? keys.map(k => x[k]) : x;
    const num = s => (s !== '' && s != null && !isNaN(+s) ? +s : s);
    const write = vals => n === 1 ? vals[0] : keys ? Object.fromEntries(keys.map((k, j) => [k, vals[j] ?? ''])) : kind === 'triples' ? [num(vals[0]), num(vals[1]), ...(vals[2] ? [vals[2]] : [])] : path === 'items' ? [vals[0] ?? '', num(vals[1])] : vals.map(x => x ?? '');
    const save = () => { setp(sc, path, arr.length ? arr : (n === 1 ? [] : '')); changed(); };
    const draw = () => {
      wrap.innerHTML = '';
      arr.forEach((x, i) => {
        const vals = read(x);
        const ins = Array.from({ length: n }, (_, j) => h('input', { value: vals[j] ?? '', placeholder: (extra && extra[j]) || '', oninput: e => { const nv = read(arr[i]).slice(); nv[j] = e.target.value; arr[i] = write(nv); save(); } }));
        wrap.append(h('div', { class: 'li n' + n }, ...ins,
          h('button', { title: '위로', onclick: () => { if (i) { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; save(); draw(); } } }, '↑'),
          h('button', { title: '지우기', onclick: () => { arr.splice(i, 1); save(); draw(); } }, '✕')));
      });
      wrap.append(h('button', { class: 'plus', onclick: () => { arr.push(write(Array(n).fill(''))); save(); draw(); wrap.querySelectorAll('input')[arr.length * n - n]?.focus(); } }, '+ 한 줄'));
    };
    draw();
    return row(label, wrap);
  }

  // 사진: 파일 · 붙여 넣기로 넣고, 사진 위를 누르면 그 자리에 이름표(pins)
  const shrink = file => new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => {
      const url = fr.result;
      if (file.size < 600 * 1024) return res(url);   // 작은 사진은 그대로
      const im = new Image();
      im.onload = () => { const k = Math.min(1, 1600 / Math.max(im.width, im.height)); const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.86)); };
      im.onerror = () => rej(new Error('사진을 읽지 못했어요'));
      im.src = url;
    };
    fr.onerror = () => rej(fr.error); fr.readAsDataURL(file);
  });
  function photoField(sc, label) {
    const take = async f => { if (!f || !/^image\//.test(f.type)) return uiSay('사진 파일(jpg · png)을 넣어 주세요.'); try { sc.src = await shrink(f); delete sc.draw; changed(true); renderLeft(); } catch (e) { uiSay(e.message); } };
    const fin = h('input', { type: 'file', accept: 'image/*', style: 'display:none', onchange: e => take(e.target.files[0]) });
    const wrap = h('div', { class: 'photo-f' });
    const shown = sc.draw && PeaceClass.ARTS?.[sc.draw] ? PeaceClass.artURL(sc.draw) : sc.src;
    if (shown) {
      const pic = h('div', { class: 'pic', title: '누르면 그 자리에 이름표가 생겨요', onclick: e => {
        e.stopPropagation(); const r = img.getBoundingClientRect();
        (sc.pins = sc.pins || []).push({ x: +((e.clientX - r.left) / r.width * 100).toFixed(1), y: +((e.clientY - r.top) / r.height * 100).toFixed(1), label: '' });
        changed(true); renderLeft(); setTimeout(() => [...left.querySelectorAll('.s-scene.on .pins input')].at(-1)?.focus(), 0);
      } });
      const img = h('img', { src: shown, alt: '' }); pic.append(img);
      (sc.pins || []).forEach((q, j) => pic.append(h('span', { class: 'mk', style: `left:${q.x}%;top:${q.y}%` }, String(j + 1))));
      wrap.append(pic);
      const list = h('div', { class: 'pins list' });
      (sc.pins || []).forEach((q, j) => list.append(h('div', { class: 'li n1' }, h('input', { value: q.label || '', placeholder: `${j + 1}번 이름표 (예: 엽록체)`, oninput: e => { q.label = e.target.value; changed(); } }),
        h('button', { title: '먼저 짚기', onclick: () => { if (j) { [sc.pins[j - 1], sc.pins[j]] = [sc.pins[j], sc.pins[j - 1]]; changed(true); renderLeft(); } } }, '↑'),
        h('button', { title: '지우기', onclick: () => { sc.pins.splice(j, 1); changed(true); renderLeft(); } }, '✕'))));
      if (!(sc.pins || []).length) list.append(h('small', { class: 'hint' }, '↑ 사진에서 짚을 곳을 눌러 보세요 (없어도 돼요)'));
      wrap.append(list);
    }
    wrap.append(h('div', { class: 'pair' }, h('button', { class: 'plus', onclick: e => { e.stopPropagation(); fin.click(); } }, sc.src ? '사진 바꾸기' : '📷 사진 넣기'),
      ...Object.entries(PeaceClass.ARTS || {}).map(([k, nm]) => h('button', { class: 'plus' + (sc.draw === k ? ' on' : ''), title: '사진 대신 스타일에 맞춰 그린 그림 (칠판이면 분필, 픽셀이면 도트)', onclick: e => { e.stopPropagation(); sc.draw = k; sc.src = ''; changed(true); renderLeft(); } }, `🎨 그림 ${nm}`)),
      h('span', {}, sc.draw ? '그림은 고른 스타일에 맞춰 다시 그려져요' : '또는 사진을 복사해 이 칸을 누르고 Ctrl+V'), fin));
    wrap.tabIndex = 0;
    wrap.addEventListener('paste', e => { const it = [...(e.clipboardData?.items || [])].find(x => x.type.startsWith('image/')); if (it) { e.preventDefault(); take(it.getAsFile()); } });
    wrap.addEventListener('dragover', e => e.preventDefault());
    wrap.addEventListener('drop', e => { e.preventDefault(); take(e.dataTransfer.files[0]); });
    return h('div', { class: 'row' }, h('span', {}, label), wrap);
  }

  // 소리 파일 → 장면에 담기 (성공하면 true)
  async function voiceFromBlob(sc, blob) {
    try {
      const a = new (window.AudioContext || window.webkitAudioContext)(); const b = await a.decodeAudioData(await blob.arrayBuffer()); a.close();
      sc.voiceDur = +b.duration.toFixed(2);
      sc.voiceData = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
      return true;
    } catch (e) { return false; }
  }

  // 내 목소리 AI: 샘플 녹음 → 대본 → Qwen3-TTS(허깅페이스) → 받은 파일 한꺼번에 넣기
  const SAMPLE_TEXT = '안녕하세요, 여러분. 오늘도 즐겁게 공부해 볼까요? 지금부터 함께 알아볼 내용은 아주 재미있어요. 천천히, 또박또박 들어 보세요.';
  const QWEN = 'https://huggingface.co/spaces/Qwen/Qwen3-TTS';
  function voiceAI() {
    const copy = async (txt, btn) => { try { await navigator.clipboard.writeText(txt); } catch (e) { const t = h('textarea', {}, txt); document.body.append(t); t.select(); document.execCommand('copy'); t.remove(); } const o = btn.textContent; btn.textContent = '복사했어요 ✓'; setTimeout(() => btn.textContent = o, 1500); };
    // 1 샘플
    let rec = null, sample = null;
    const sst = h('span', { class: 'vst' }, '');
    const sBtn = h('button', { class: 'pill', onclick: async () => {
      if (rec) { if (rec.state === 'recording' && !sBtn.dataset.ending) { sBtn.dataset.ending = 1; sBtn.textContent = '마무리 중…'; setTimeout(() => { delete sBtn.dataset.ending; rec && rec.stop(); }, 700); } return; }   // 끝 글자가 씹히지 않게 0.7초 더
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); const chunks = [];
        rec = new MediaRecorder(stream); rec.ondataavailable = ev => chunks.push(ev.data);
        rec.onstop = async () => {
          stream.getTracks().forEach(t => t.stop()); rec = null; sBtn.textContent = '🎙 다시 녹음'; sBtn.classList.remove('rec');
          try { const a = new (window.AudioContext || window.webkitAudioContext)(); const b = await a.decodeAudioData(await new Blob(chunks).arrayBuffer()); a.close(); sample = PC.wav(b); sst.textContent = `샘플 ${b.duration.toFixed(1)}초 ✓ ` + (b.duration < 5 ? '(조금 짧아요 · 8초 이상 권장)' : ''); saveS.disabled = false; playS.disabled = false; }
          catch (e) { sst.textContent = '녹음을 읽지 못했어요. 다시 해 주세요.'; }
        };
        rec.start(); sBtn.textContent = '■ 멈추기'; sBtn.classList.add('rec'); sst.textContent = '녹음 중… 아래 글을 읽어 주세요';
      } catch (err) { uiSay(IN_ART ? '여기(Claude 화면 안)에서는 마이크를 쓸 수 없어요. 휴대폰 음성 메모나 PC 녹음기로 10초 녹음한 파일을 Qwen 에 바로 올리면 돼요.' : '마이크를 쓸 수 없어요. 휴대폰으로 녹음한 파일을 Qwen 에 바로 올려도 돼요. (' + err.name + ')'); }
    } }, '🎙 샘플 녹음');
    const playS = h('button', { class: 'pill', disabled: true, onclick: () => new Audio(URL.createObjectURL(new Blob([sample], { type: 'audio/wav' }))).play() }, '▶ 듣기');
    const saveS = h('button', { class: 'pill', disabled: true, onclick: () => download('내목소리_샘플.wav', sample, 'audio/wav') }, '샘플 저장 (.wav)');
    // 2 대본
    const lines = h('div', { class: 'says' });
    const allText = () => L.scenes.map((sc, i) => sc.say ? `${String(i + 1).padStart(2, '0')} ${sc.say}` : null).filter(Boolean).join('\n');
    L.scenes.forEach((sc, i) => {
      const b = h('button', { class: 'pill', onclick: e => copy(sc.say || '', e.target) }, '복사');
      lines.append(h('div', { class: 'sayrow' }, h('b', {}, String(i + 1).padStart(2, '0')), h('span', {}, TYPES[sc.type]?.name || sc.type),
        h('textarea', { rows: 2, placeholder: '이 장면에서 읽을 대본 (비우면 이 장면은 목소리 없음)', oninput: e => { setp(sc, 'say', e.target.value); store.set('peace-studio-draft', JSON.stringify(L)); } }, sc.say || ''), b));
    });
    // 4 받은 파일
    const res = h('div', { class: 'vst' });
    const fin = h('input', { type: 'file', accept: 'audio/*', multiple: true, style: 'display:none', onchange: async e => {
      const files = [...e.target.files].sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true }));
      const want = L.scenes.map((sc, i) => i).filter(i => L.scenes[i].say);
      const done = [];
      for (let k = 0; k < files.length; k++) {
        const m = files[k].name.match(/(\d+)/); let i = m ? +m[1] - 1 : want[k];
        if (!(i >= 0 && i < L.scenes.length)) i = want[k];
        if (i == null) continue;
        if (await voiceFromBlob(L.scenes[i], files[k])) done.push(`${i + 1}번 ← ${files[k].name}`);
      }
      res.textContent = done.length ? '넣었어요: ' + done.join(' · ') : '넣은 파일이 없어요. 파일 이름에 장면 번호(01, 02 …)를 넣어 주세요.';
      renderLeft(); changed(true); fin.value = '';
    } });
    const box = h('div', { class: 'help', onclick: e => { if (e.target === box) box.remove(); } }, h('div', {},
      h('button', { class: 'x', onclick: () => box.remove() }, '닫기 ✕'),
      h('h2', {}, '🗣 내 목소리로 AI 가 읽게 하기'),
      h('p', {}, '내 목소리 샘플 10초만 주면, AI(Qwen3-TTS · 무료 공개 모델)가 장면마다 대본을 내 목소리로 읽어 줘요. 한 장면씩 직접 녹음하지 않아도 돼요.'),
      h('p', { class: 'warn' }, '⚠ 반드시 본인 목소리만 쓰세요. 다른 사람 목소리는 동의 없이 쓰면 안 돼요. 학생들에게 "AI 로 만든 선생님 목소리"라고 알려 주면 좋아요. 샘플과 대본은 허깅페이스(외부 사이트)로 보내져요.'),
      h('h4', {}, '1 · 내 목소리 샘플 (한 번만)'),
      h('p', { class: 'sample' }, SAMPLE_TEXT),
      h('div', { class: 'pair' }, sBtn, playS, saveS, sst),
      h('p', { class: 'hint' }, '조용한 곳에서, 평소 수업하는 말투로 읽으세요. 마지막 "…요" "…다" 까지 또렷하게 말하고 1초 쉰 뒤 멈추세요(끝 글자가 씹히면 AI 목소리도 끝이 잘려요). 샘플은 저장해 두면 계속 쓸 수 있어요.'),
      h('h4', {}, '2 · 장면마다 읽을 대본'),
      lines, h('button', { class: 'pill', onclick: e => copy(allText(), e.target) }, '대본 모두 복사'),
      h('h4', {}, '3 · Qwen 에서 만들기 (장면마다 되풀이)'),
      h('ol', {},
        h('li', {}, h('a', { href: QWEN, target: '_blank', rel: 'noopener' }, 'Qwen3-TTS 열기 ↗'), ' → 위쪽 탭에서 ', h('b', {}, 'Voice Clone (Base)'), ' 를 누르세요. (오른쪽 위 Sign in 으로 허깅페이스에 로그인하면 무료로 더 많이 쓸 수 있어요)'),
        h('li', {}, h('b', {}, 'Reference Audio'), ' 에 샘플(내목소리_샘플.wav)을 올리고, ', h('b', {}, 'Reference Text'), ' 에 위의 샘플 글을 그대로 붙여 넣으세요.'),
        h('li', {}, h('b', {}, 'Target Text'), ' 에 장면 대본 하나를 붙여 넣고, ', h('b', {}, 'Language'), ' 는 ', h('b', {}, 'Korean'), ' 으로 → ', h('b', {}, 'Clone & Generate'), '.'),
        h('li', {}, '나온 소리(Generated Audio) 오른쪽 ⬇ 로 내려받고, 파일 이름을 장면 번호로 바꿔 두세요 (예: 02.wav). 다음 장면도 같은 방법으로.')),
      h('p', { class: 'hint' }, '"quota" 가 다 됐다는 말이 나오면 로그인하거나 잠시 뒤에 다시 하세요. 긴 대본은 두세 문장씩 나누면 더 자연스러워요.'),
      h('h4', {}, '4 · 받은 파일 한꺼번에 넣기'),
      h('div', { class: 'pair' }, h('button', { class: 'pill main', onclick: () => fin.click() }, '소리 파일 여러 개 고르기'), fin),
      h('p', { class: 'hint' }, '파일 이름의 번호(01, 02 …)대로 그 장면에 들어가요. 번호가 없으면 대본이 있는 장면에 차례로 들어가요.'), res));
    document.body.append(box);
  }

  // 녹음: 마이크로 바로 녹음하거나 파일을 넣는다 → 장면에 담긴다
  function voiceField(sc, i) {
    const st = h('span', { class: 'vst' }, sc.voiceData ? `녹음 ${sc.voiceDur.toFixed(1)}초 ✓` : '녹음 없음');
    const fin = h('input', { type: 'file', accept: 'audio/*', style: 'display:none', onchange: e => e.target.files[0] && takeBlob(e.target.files[0]) });
    let rec = null;
    const takeBlob = async blob => { if (await voiceFromBlob(sc, blob)) { st.textContent = `녹음 ${sc.voiceDur.toFixed(1)}초 ✓`; changed(true); } else uiSay('이 소리 파일을 읽지 못했어요. mp3 · wav · m4a 로 다시 넣어 주세요.'); };
    const recBtn = h('button', { title: IN_ART ? '여기서는 마이크를 쓸 수 없어 녹음한 파일을 넣어요 (휴대폰 음성 메모 · PC 녹음기)' : '', onclick: async e => {
      e.stopPropagation();
      if (IN_ART) { fin.click(); return; }
      if (rec) { if (rec.state === 'recording' && !recBtn.dataset.ending) { recBtn.dataset.ending = 1; recBtn.textContent = '마무리 중…'; setTimeout(() => { delete recBtn.dataset.ending; rec && rec.stop(); }, 700); } return; }   // 끝 글자가 씹히지 않게 0.7초 더
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); const chunks = [];
        rec = new MediaRecorder(stream); rec.ondataavailable = ev => chunks.push(ev.data);
        rec.onstop = () => { stream.getTracks().forEach(t => t.stop()); rec = null; recBtn.textContent = '🎙 녹음'; recBtn.classList.remove('rec'); takeBlob(new Blob(chunks, { type: chunks[0]?.type || 'audio/webm' })); };
        rec.start(); recBtn.textContent = '■ 멈추기'; recBtn.classList.add('rec'); st.textContent = '녹음 중…';
      } catch (err) { if (await modal(IN_ART ? '여기(Claude 화면 안)에서는 마이크를 쓸 수 없어요. 휴대폰 음성 메모나 PC 녹음기로 녹음한 파일을 넣어 주세요.' : '마이크를 쓸 수 없어요(' + err.name + '). 녹음한 파일을 넣어 주세요.', [['닫기', false, 'ghost'], ['녹음 파일 고르기', true, 'main']])) fin.click(); }
    } }, IN_ART ? '🎙 녹음 파일' : '🎙 녹음');
    const say = h('textarea', { rows: 2, class: 'say', placeholder: '읽을 대본 (화면에는 안 나와요 · 녹음하거나 AI 목소리로 만들 때 읽을 글)', oninput: e => { setp(sc, 'say', e.target.value); store.set('peace-studio-draft', JSON.stringify(L)); } }, sc.say || '');
    return h('div', { class: 'voice' }, say, h('span', { class: 'vl' }, '목소리'), recBtn,
      h('button', { onclick: e => { e.stopPropagation(); fin.click(); } }, '파일'),
      sc.voiceData ? h('button', { onclick: e => { e.stopPropagation(); new Audio(sc.voiceData).play(); } }, '▶ 듣기') : null,
      sc.voiceData ? h('button', { onclick: e => { e.stopPropagation(); delete sc.voiceData; delete sc.voiceDur; renderLeft(); changed(true); } }, '지우기') : null, st, fin);
  }

  // ---------- 미리보기 ----------
  let timer = null;
  function changed(now) { dirty++; store.set('peace-studio-draft', JSON.stringify(L)); clearTimeout(timer); timer = setTimeout(() => refresh(), now ? 0 : 450); }
  async function refresh() {
    stop();
    const keep = inst ? t : null;
    try { inst = PC.mount(pvStage, L); } catch (e) { qaBox.innerHTML = ''; qaBox.append(h('p', { class: 'bad' }, '⚠ ' + e.message)); return; }
    fitPv(); buf = null; bufFor = null;
    await inst.READY;
    const s = inst.SCENES[Math.min(cur, inst.SCENES.length - 1)];
    t = keep != null && keep >= s.t0 && keep < s.t0 + s.dur ? keep : s.t0 + s.dur - 0.55;
    renderChips(); inst.seek(t); showTime();
    // 점검(넘침 · 겹침)
    const qa = inst.QA(); inst.seek(t);
    qaBox.innerHTML = '';
    qaBox.append(qa.length ? h('div', { class: 'bad' }, h('b', {}, `⚠ 화면 점검 ${qa.length}건 — 글을 줄이거나 장면을 나눠 주세요`), h('ul', {}, qa.map(q => h('li', {}, q)))) : h('div', { class: 'good' }, `✓ 화면 점검 이상 없음 · 장면 ${inst.SCENES.length}개 · 약 ${Math.round(inst.DUR)}초`));
    refreshGallery(); refreshFlow();
  }
  function fitPv() { const avail = right.clientWidth, maxW = innerHeight * 0.62 * inst.W / inst.H; pvWrap.style.width = Math.min(avail, maxW) + 'px'; const k = Math.min(avail, maxW) / inst.W; pvStage.style.transform = `scale(${k})`; pvWrap.style.height = inst.H * k + 'px'; }
  addEventListener('resize', () => { if (inst) fitPv(); refreshGallery(); });
  function renderChips() {
    chips.innerHTML = '';
    inst.SCENES.forEach((s, i) => chips.append(h('button', { class: i === cur ? 'on' : '', onclick: () => { cur = i; markCur(); jumpTo(i); refreshGallery(); } }, `${i + 1} ${TYPES[s.type]?.name || s.type}`)));
  }
  function jumpTo(i) { if (!inst) return; const s = inst.SCENES[i]; t = s.t0 + (playing ? 0 : s.dur - 0.55); if (playing) startA(); inst.seek(t); showTime(); [...chips.children].forEach((c, j) => c.classList.toggle('on', j === i)); }
  function showTime() { const f = x => `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, '0')}`; timeEl.textContent = `${f(t)} / ${f(inst.DUR)}`; }

  // 재생 (소리는 처음 누를 때 만든다)
  async function toggle() {
    if (!inst) return;
    if (playing) return stop();
    playing = true; playBtn.textContent = '■ 멈춤';
    if (t >= inst.DUR - 0.05) t = 0;
    if (bufFor !== inst) { playBtn.textContent = '소리 만드는 중…'; try { buf = await inst.audio(); bufFor = inst; } catch (e) { buf = null; } if (!playing) return; playBtn.textContent = '■ 멈춤'; }
    startA(); last = performance.now(); requestAnimationFrame(tick);
  }
  function startA() { stopA(); if (!buf) return; ac = ac || new (window.AudioContext || window.webkitAudioContext)(); src = ac.createBufferSource(); src.buffer = buf; src.connect(ac.destination); src.start(0, t); }
  function stopA() { if (src) { try { src.stop(); } catch (e) {} src = null; } }
  function stop() { playing = false; stopA(); playBtn.textContent = '▶ 재생'; }
  function tick(now) {
    if (!playing) return;
    t += (now - last) / 1000; last = now;
    if (t >= inst.DUR) { t = inst.DUR - 0.01; stop(); }
    inst.seek(t); showTime();
    const i = inst.SCENES.findIndex(s => t >= s.t0 && t < s.t0 + s.dur);
    if (i >= 0 && i !== cur) { cur = i; markCur(); [...chips.children].forEach((c, j) => c.classList.toggle('on', j === i)); }
    requestAnimationFrame(tick);
  }
  addEventListener('keydown', e => { if (e.code === 'Space' && !/INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement.tagName)) { e.preventDefault(); toggle(); } });

  // ---------- 스타일 갤러리: 지금 장면을 스타일 11가지로 ----------
  let gTimer = null;
  function refreshGallery() { clearTimeout(gTimer); gTimer = setTimeout(drawGallery, 120); }
  async function drawGallery() {
    gallery.innerHTML = '';
    const sc = L.scenes[cur]; if (!sc) return;
    const one = { ...clone(L), scenes: [clone(sc)] }; delete one.scenes[0].style;
    for (const S of PC.STYLES) {
      const holder = h('div', { class: 'thumb-stage' }); const st = h('div'); holder.append(st);
      const eff = sc.style || L.style || 'dark';
      const card = h('button', { class: 'thumb' + (eff === S.id ? ' on' : ''), onclick: () => {
        if (onlyScene) { if (S.id === (L.style || 'dark')) delete sc.style; else sc.style = S.id; }
        else { L.style = S.id; }
        changed(true); renderLeft(); refreshGallery();
      } }, holder, h('b', {}, S.name), h('small', {}, S.desc));
      gallery.append(card);
      try {
        const g = PC.mount(st, { ...one, style: S.id });
        const k = Math.min(holder.clientWidth / g.W, 170 / g.H); st.style.transform = `scale(${k})`; st.style.left = (holder.clientWidth - g.W * k) / 2 + 'px'; holder.style.height = g.H * k + 'px';
        g.READY.then(() => {
          g.seek(g.SCENES[0].dur - 0.55);
          let on = false, t0 = 0; const loop = now => { if (!on) return; g.seek(((now - t0) / 1000) % g.SCENES[0].dur); requestAnimationFrame(loop); };
          card.addEventListener('mouseenter', () => { on = true; t0 = performance.now(); requestAnimationFrame(loop); });   // 올려 두면 움직인다
          card.addEventListener('mouseleave', () => { on = false; g.seek(g.SCENES[0].dur - 0.55); });
        });
      } catch (e) { holder.textContent = '⚠'; }
    }
  }

  // ---------- 흐름 보기: 장면마다 그림 한 장 + 대사(자막) ----------
  let fTimer = null;
  function refreshFlow() { clearTimeout(fTimer); fTimer = setTimeout(drawFlow, 250); }
  async function drawFlow() {
    flow.innerHTML = '';
    let acc = 0;
    L.scenes.forEach((sc, i) => {
      const s0 = inst && inst.SCENES[i], dur = s0 ? s0.dur : 0, at = acc; acc += dur;
      const holder = h('div', { class: 'thumb-stage' }); const st = h('div'); holder.append(st);
      const changedSay = sc.voiceSay != null && sc.voiceData && (sc.say || '').trim() !== (sc.voiceSay || '').trim();
      const subs = sc.say && sc.voiceData && L.subs !== 'off' ? PC.chunkSay(sc.say) : [];
      const card = h('div', { class: 'fcard' + (i === cur ? ' on' : '') },
        h('button', { class: 'fpic', title: '이 장면 미리보기', onclick: () => { cur = i; markCur(); jumpTo(i); refreshGallery(); [...flow.children].forEach((c, j) => c.classList.toggle('on', j === i)); left.querySelectorAll('.s-scene')[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }, holder),
        h('div', { class: 'fmeta' }, h('b', {}, `${i + 1} · ${TYPES[sc.type]?.name || sc.type}`), h('span', {}, `${Math.floor(at / 60)}:${String(Math.floor(at % 60)).padStart(2, '0')} · ${dur.toFixed(1)}초`), h('span', { class: 'vs' }, sc.voiceData ? '🔊 목소리' : '🔇 목소리 없음')),
        h('textarea', { rows: 3, class: 'fsay', placeholder: '대사 (목소리로 읽을 글 · 목소리가 있으면 자막으로 나와요)', oninput: e => { sc.say = e.target.value; delete sc.cues; store.set('peace-studio-draft', JSON.stringify(L)); clearTimeout(timer); timer = setTimeout(() => { renderLeft(); refresh(); }, 900); } }, sc.say || ''),
        subs.length ? h('div', { class: 'fsubs' }, subs.map(x => h('span', {}, x))) : null,
        changedSay ? h('div', { class: 'fwarn' }, '✎ 대사가 바뀌었어요 — 목소리는 예전 그대로예요. 시나리오를 저장해 Claude 에게 보내면 이 장면만 다시 읽혀요.') : null);
      flow.append(card);
      try {
        const one = { ...clone(L), scenes: [clone(sc)] }; one.scenes[0].style = sc.style || L.style; delete one.scenes[0].voiceData; delete one.scenes[0].voiceDur;
        const g = PC.mount(st, one);
        const k = holder.clientWidth / g.W; st.style.transform = `scale(${k})`; holder.style.height = g.H * k + 'px';
        g.READY.then(() => g.seek(g.SCENES[0].dur - 0.55));
      } catch (e) { holder.textContent = '⚠'; }
    });
  }

  // ---------- 저장 · 열기 ----------
  const slug = () => (L.title || '수업').replace(/[\\/:*?"<>|\s]+/g, '_');
  // 저장: 크롬 · 엣지 · 웨일은 "다른 이름으로 저장" 창(한글 이름 그대로), 나머지는 내려받기
  const download = async (name, text, type) => {
    const blob = new Blob([text], { type });
    if (IN_ART) {   // Claude 화면 안: 저장은 '내려받기' 기능으로(선생님이 한 번 확인)
      const dl = await window.claude.use('downloads').catch(() => null);
      if (!dl) return uiSay('여기서는 파일을 저장할 수 없어요. 이 스튜디오 파일을 내려받아 크롬 · 엣지 · 웨일로 열어 저장해 주세요.');
      try { const r = await dl.save({ filename: name, data: blob }); if (r && r.status === 'saved') toast(`저장했어요 · ${name}`); }
      catch (e) {
        const c = e && e.code;
        if (c === 'declined') return;
        if (c === 'rejected_extension' || c === 'extension_not_enabled') return uiSay('이 종류의 파일은 여기서 저장할 수 없어요. 내려받은 스튜디오 파일에서 저장해 주세요.');
        if (c === 'rate_limited') return uiSay('저장 창이 이미 열려 있어요. 잠시 뒤에 다시 눌러 주세요.');
        if (c === 'host_unavailable') return uiSay('이 앱에서는 저장할 수 없어요. 브라우저나 컴퓨터에서 열어 저장해 주세요.');
        uiSay('저장하지 못했어요. 잠시 뒤 다시 해 보거나, 스튜디오 파일을 내려받아 저장해 주세요.');
      }
      return;
    }
    if (window.showSaveFilePicker) {
      try {
        const ext = name.slice(name.lastIndexOf('.'));
        const fh = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: ext === '.json' ? '시나리오' : '수업용 파일', accept: { [type]: [ext] } }] });
        const w = await fh.createWritable(); await w.write(blob); await w.close(); toast(`저장했어요 · ${fh.name}`); return;
      } catch (e) { if (e.name === 'AbortError') return; }
    }
    const a = h('a', { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    toast(`내려받았어요 · ${name}`);
  };
  const toast = msg => { const n = h('div', { class: 'toast' }, msg); document.body.append(n); setTimeout(() => n.remove(), 2600); };
  function saveJSON() { download(slug() + '_시나리오.json', JSON.stringify(L, null, 2), 'application/json'); }
  function loadFile(f) {
    if (!f) return; const fr = new FileReader();
    fr.onload = () => { try { const o = JSON.parse(fr.result); if (!o.scenes) throw new Error('scenes 없음'); L = o; L.style = L.style || L.theme || 'dark'; delete L.theme; cur = 0; renderAll(); } catch (e) { uiSay('시나리오 파일이 아니에요: ' + e.message); } };
    fr.readAsText(f); fileIn.value = '';
  }
  function exportHTML() {
    const A = id => document.getElementById(id).textContent;
    const esc = s => s.replace(/<\/script/gi, '<\\/script');
    const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${(L.title || '수업').replace(/</g, '&lt;')}</title>
<style>${A('a-katex-css')}</style><style>${A('a-style')}</style></head><body><div id="stage"></div>
<script>${esc(A('a-katex'))}<\/script>
<script>window.LESSON = ${esc(JSON.stringify(L))};<\/script>
<script>${esc(A('a-runtime'))}<\/script></body></html>`;
    download(slug() + '_수업용.html', html, 'text/html');
  }

  // 쓰는 법: 처음 열면 한 번 저절로
  function showHelp() {
    const li = (...xs) => xs.map(x => h('li', {}, x));
    const box = h('div', { class: 'help', onclick: e => { if (e.target === box) box.remove(); } }, h('div', {},
      h('button', { class: 'x', onclick: () => box.remove() }, '닫기 ✕'),
      h('h2', {}, '처음이세요? 3분 안내'),
      h('h4', {}, '🖥 준비물 — 설치할 것 없어요'),
      h('ul', {}, li('컴퓨터(윈도우 · 맥) + 크롬 · 엣지 · 웨일 중 하나. 이 파일을 그 브라우저로 열면 끝이에요.', '인터넷 · 로그인 · 프로그램 설치가 필요 없어요. 휴대폰 · 태블릿은 화면이 좁아 권하지 않아요.', '카카오톡 · 메일 미리보기 안에서 열면 안 돼요. 꼭 내려받은 뒤 브라우저로 여세요.')),
      h('h4', {}, '1 · 스타일 → 2 · 글 고치기 → 3 · 미리보기'),
      h('ul', {}, li('오른쪽 위 그림 중 마음에 드는 스타일을 누르세요(11가지).', '왼쪽 칸의 글을 고치면 미리보기에 바로 나와요. "+ 장면 더하기"로 장면을 늘려요.', '빨간 점검 상자가 나오면 글을 줄이거나 장면을 둘로 나누세요.')),
      h('h4', {}, '🎙 내 목소리 넣기'),
      h('ol', {}, li('장면 아래 "🎙 녹음"을 누르세요. 처음 한 번 "마이크 허용"을 물으면 허용을 누르세요.', '그 장면의 글을 읽고 "■ 멈추기". "▶ 듣기"로 확인하고, 마음에 안 들면 다시 녹음하면 덮어써요.', '말 길이만큼 장면이 저절로 늘고, 말하는 동안 배경음이 작아져요.')),
      h('p', {}, '팁: 마지막 "…요" "…다" 까지 다 말하고 1초 쉰 다음 멈추세요(끝 글자가 씹히지 않게). 조용한 곳에서, 이어폰 마이크가 노트북 마이크보다 깨끗해요. 휴대폰 녹음 앱으로 녹음한 파일은 "파일" 버튼으로 넣어요. 장면 하나에 한 녹음이에요.'),
      h('p', {}, '🗣 장면마다 녹음하기 번거로우면: 위쪽 "🗣 내 목소리 AI" — 내 목소리 샘플 10초로 AI 가 대본을 읽어 줘요(무료 · 본인 목소리만).'),
      h('h4', {}, '📷 사진 넣기'),
      h('ol', {}, li('"+ 장면 더하기 → 사진"을 누르고 "📷 사진 넣기" (또는 사진을 복사해 그 칸을 누르고 Ctrl+V, 끌어다 놓기도 돼요).', '사진 위에서 짚을 곳을 누르면 번호가 생겨요. 번호마다 이름표(예: 엽록체)를 적으면, 영상에서 점이 차례로 짚고 이름표가 붙어요.', '옆에 나올 설명을 적어요. [[이렇게]] 묶은 말은 형광펜으로 칠해져요.')),
      h('p', {}, '학생 얼굴은 동의를 받고, 교과서 · 인터넷 그림은 저작권을 확인하세요. 직접 찍은 사진이 가장 안전해요.'),
      h('h4', {}, '💾 저장과 수업'),
      h('ul', {}, li('"수업용 파일 저장" → 파일 하나. 수업 때 열고 스페이스로 재생, → ← 장면 넘기기, F 전체 화면.', '다른 선생님께는 그 파일을 그대로 보내면 돼요(목소리 · 사진도 안에 들어 있어요).', '"시나리오 저장"은 나중에 이어서 고칠 때 쓰는 파일이에요. 고치던 내용은 이 컴퓨터 이 브라우저에만 자동 보관돼요.')),
      h('h4', {}, '🎞 mp4 영상이 꼭 필요할 때'),
      h('ul', {}, li('윈도우: 수업용 파일을 열고 F(전체 화면) → Win + Alt + R 로 녹화 시작, 끝나면 다시 Win + Alt + R. 소리도 함께 녹화돼요(동영상 폴더 → 캡처).', '맥: 화면 기록(⌘ + Shift + 5)은 소리가 함께 녹화되지 않아요. Claude 에게 시나리오 파일을 주고 mp4 를 부탁하세요.'))));
    document.body.append(box);
  }
  // ---------- 처음 화면: 스타일을 설명이 아니라 '움직이는 모습'으로 보고 고른다 ----------
  function previewLesson(id) {
    const one = clone(L); one.style = id;
    one.scenes = one.scenes.slice(0, 3).map(x => { const y = clone(x); delete y.style; delete y.voiceData; delete y.voiceDur; delete y.cues; return y; });
    return one;
  }
  function showStarter() {
    stop();
    let alive = true; const live = [];
    const close = () => { alive = false; box.remove(); };
    const pick = id => { L.style = id; close(); changed(true); renderLeft(); setStep(1); toast(`${PC.STYLES.find(x => x.id === id).name} 스타일로 시작해요`); };
    const grid = h('div', { class: 'st-grid' });
    const box = h('div', { class: 'starter' }, h('div', { class: 'st-in' },
      h('div', { class: 'st-head' }, h('div', {}, h('h2', {}, '어떤 느낌으로 만들까요?'), h('p', {}, '설명 말고 움직이는 모습을 보고 골라 주세요. 지금 수업의 첫 장면들로 보여 드려요 · 마음에 드는 칸을 누르면 바로 시작해요')),
        h('div', { class: 'st-acts' }, h('button', { class: 'ghost', onclick: () => { close(); showHelp(); } }, '처음이세요? 쓰는 법'), h('button', { class: 'ghost', onclick: close }, `지금 스타일(${(PC.STYLES.find(x => x.id === L.style) || PC.STYLES[0]).name})로 시작`))),
      grid));
    document.body.append(box);
    PC.STYLES.forEach((S, j) => {
      const holder = h('div', { class: 'thumb-stage' }); const st = h('div'); holder.append(st);
      const card = h('div', { class: 'st-card' + (L.style === S.id ? ' on' : '') },
        h('button', { class: 'st-pic', title: '이 스타일로 시작', onclick: () => pick(S.id) }, holder),
        h('div', { class: 'st-row' }, h('b', {}, S.name), h('button', { class: 'pill', title: '크게 · 소리와 함께', onclick: () => bigView(S.id, pick) }, '🔊 크게 보기')));
      grid.append(card);
      try {
        const g = PC.mount(st, previewLesson(S.id));
        const k = holder.clientWidth / g.W; st.style.transform = `scale(${k})`; holder.style.height = g.H * k + 'px';
        g.READY.then(() => live.push({ g, off: j * 0.37 }));
      } catch (e) { holder.textContent = '⚠'; }
    });
    const t0 = performance.now();
    const loop = now => { if (!alive) return; const T = (now - t0) / 1000; live.forEach(({ g, off }) => g.seek((T + off) % g.DUR)); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
  // 크게 보기: 한 스타일을 크게, 소리와 함께 한 바퀴
  async function bigView(id, pick) {
    const holder = h('div', { class: 'thumb-stage' }); const st = h('div'); holder.append(st);
    let alive = true, a = null, sn = null;
    const close = () => { alive = false; try { sn && sn.stop(); } catch (e) {} box.remove(); };
    const S = PC.STYLES.find(x => x.id === id);
    const box = h('div', { class: 'ask big' }, h('div', {}, h('h3', {}, S.name), holder,
      h('div', { class: 'btns' }, h('button', { class: 'ghost', onclick: close }, '다른 것 보기'), h('button', { class: 'main', onclick: () => { close(); pick(id); } }, '이 스타일로 하기'))));
    document.body.append(box);
    const g = PC.mount(st, previewLesson(id));
    const k = holder.clientWidth / g.W; st.style.transform = `scale(${k})`; holder.style.height = g.H * k + 'px';
    await g.READY;
    try { const b = await g.audio(); if (!alive) return; a = ac = ac || new (window.AudioContext || window.webkitAudioContext)(); sn = a.createBufferSource(); sn.buffer = b; sn.connect(a.destination); sn.start(); } catch (e) {}
    const t0 = performance.now();
    const loop = now => { if (!alive) return; const T = (now - t0) / 1000; g.seek(Math.min(T, g.DUR - 0.01)); if (T < g.DUR + 0.8) requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
  // ---------- 효과도 '움직이는 모습'을 보고 고른다 ----------
  const transName = id => { const x = (PC.TRANS || []).find(y => y[0] === id); return x ? x[1] : '스타일대로'; };
  // opts: [{id, name, sub, patch(lesson), win(inst) → [a, b] 되풀이할 구간}]
  function fxPicker(title, lead, opts, curId, onPick) {
    stop();
    let alive = true; const live = [];
    const close = () => { alive = false; box.remove(); };
    const grid = h('div', { class: 'st-grid' });
    const box = h('div', { class: 'starter' }, h('div', { class: 'st-in' },
      h('div', { class: 'st-head' }, h('div', {}, h('h2', {}, title), h('p', {}, lead)), h('div', { class: 'st-acts' }, h('button', { class: 'ghost', onclick: close }, '닫기'))), grid));
    document.body.append(box);
    opts.forEach(o => {
      const holder = h('div', { class: 'thumb-stage' }); const st = h('div'); holder.append(st);
      grid.append(h('div', { class: 'st-card' + (o.id === curId ? ' on' : '') },
        h('button', { class: 'st-pic', onclick: () => { close(); onPick(o.id); } }, holder),
        h('div', { class: 'st-row' }, h('b', {}, o.name), o.sub ? h('small', {}, o.sub) : null)));
      try {
        const one = previewLesson(L.style); o.patch(one);
        const g = PC.mount(st, one); const k = holder.clientWidth / g.W; st.style.transform = `scale(${k})`; holder.style.height = g.H * k + 'px';
        g.READY.then(() => live.push({ g, w: o.win(g), slow: o.slow }));
      } catch (e) { holder.textContent = '⚠'; }
    });
    const t0 = performance.now();
    const loop = now => { if (!alive) return; const T = (now - t0) / 1000;
      live.forEach(({ g, w, slow }) => {
        if (!slow) return g.seek(w[0] + T % (w[1] - w[0]));
        const run = (w[1] - w[0]) / slow, P = 0.6 + run + 0.9, x = T % P;   // 앞뒤로 잠깐 멈추고, 넘어가는 순간만 느리게
        g.seek(x < 0.6 ? w[0] : x < 0.6 + run ? w[0] + (x - 0.6) * slow : w[1]);
      });
      requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
  const edge = g => { const s1 = g.SCENES[1] || g.SCENES[0]; return [Math.max(0, s1.t0 - 0.75), Math.min(g.DUR - 0.01, s1.t0 + 1.1)]; };
  function pickTrans() {
    const opts = [{ id: '', name: '스타일대로', sub: `${(PC.STYLES.find(x => x.id === L.style) || PC.STYLES[0]).name} 스타일의 넘김`, patch: one => { one.beat = 'off'; }, win: edge, slow: 0.3 },
      ...(PC.TRANS || []).map(([id, name, sub]) => ({ id, name, sub, patch: one => { one.trans = id; one.beat = 'off'; }, win: edge, slow: 0.3 }))];
    fxPicker('장면이 어떻게 넘어갈까요?', '1번 장면이 2번 장면으로 넘어가는 순간만 느리게 되풀이해 보여 드려요 · 마음에 드는 칸을 누르세요', opts, L.trans || '', id => { if (id) L.trans = id; else delete L.trans; changed(true); renderLeft(); });
  }
  function pickBeat() {
    const w = g => [1.5, Math.min(g.DUR - 0.01, 7.5)];
    const opts = [['', '스타일대로', '형광 · 팝 · 픽셀 · 예고편만 켜짐'], ['on', '켜기', '배경음 박자마다 화면이 살짝 쾅'], ['off', '끄기', '차분하게 · 글 읽기에 집중']]
      .map(([id, name, sub]) => ({ id, name, sub, patch: one => { if (id) one.beat = id; one.beatGain = 3; }, win: w }));   // 미리보기는 3배로 크게
    fxPicker('박자마다 쾅 할까요?', '배경음 박자에 맞춰 화면이 쾅 튀는 효과예요 · 잘 보이게 3배로 크게 보여 드려요(실제는 더 살짝) · 움직임을 보고 골라 주세요', opts, L.beat || '', id => { if (id) L.beat = id; else delete L.beat; changed(true); renderLeft(); });
  }
  setStep(1);
  setTimeout(showStarter, 300);

  // 지난 작업이 있으면 알려 준다
  const draft = store.get('peace-studio-draft');
  if (draft && draft !== JSON.stringify(L)) {
    try { const d = JSON.parse(draft); const n = h('div', { class: 'restore' }, `지난번에 고치던 "${d.title || '수업'}"이 있어요. `, h('button', { onclick: () => { L = d; cur = 0; n.remove(); renderAll(); } }, '이어서 하기'), h('button', { onclick: () => n.remove() }, '닫기')); app.prepend(n); } catch (e) {}
  }
  renderAll();
})();
