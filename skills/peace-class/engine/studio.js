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

  // ---------- 장면 틀과 칸 ----------
  const TYPES = {
    title: { name: '제목', tip: '오늘 배울 것 한 단어 + 손글씨 한 줄', fields: [['title', '제목', 'text'], ['sub', '손글씨 한 줄', 'text']], make: () => ({ title: '제목', sub: '손글씨 한 줄' }) },
    concept: { name: '개념', tip: '용어와 정의 · 핵심 말을 형광펜으로', fields: [['term', '용어', 'text'], ['text', '정의', 'area'], ['keys', '형광펜으로 칠할 말 (정의 안에 똑같이 있는 말)', 'list'], ['label', '위 작은 글 (비우면 "개념")', 'text']], make: () => ({ term: '용어', text: '정의를 적어 주세요', keys: [] }) },
    fix: { name: '흔한 실수', tip: '틀린 생각 → ✕ → 되감기 → 바른 생각', fields: [['label', '위 작은 글 (비우면 "흔한 실수")', 'text'], ['wrong', '틀린 말', 'text'], ['right', '바른 말', 'text'], ['why', '손글씨 까닭', 'text']], make: () => ({ wrong: '틀린 말', right: '바른 말', why: '' }) },
    steps: { name: '수식 · 풀이', tip: '한 줄씩 올라오고 바뀐 곳은 형광', fields: [['title', '위 제목', 'text'], ['lines', '한 줄씩 (수식 = LaTeX · 형광 = \\hl{…})', 'list'], ['tex', '수식으로 보기 (끄면 일반 글 · 형광 = [[…]])', 'check'], ['note', '손글씨 메모', 'text']], make: () => ({ title: '', lines: ['2x + 3 = 7', '2x = \\hl{4}', 'x = \\hl{2}'], note: '' }) },
    graph: { name: '함수 그래프', tip: '좌표축 · 곡선이 그려지고 점 · 기울기', fields: [['fns', '함수 (식 · 이름)', 'pairs', ['식  예) 2*x+1 · x**2 · sin(x)', '이름  예) y = 2x + 1'], ['f', 'label']], ['x', 'x 범위', 'range'], ['y', 'y 범위', 'range'], ['points', '점 (x · y · 이름)', 'triples', ['x', 'y', '이름 (비우면 좌표)']], ['tri', '기울기 삼각형', 'tri'], ['note', '손글씨 메모', 'text']], make: () => ({ fns: [{ f: 'x**2', label: 'y = x^2' }], x: [-4, 4], y: [-2, 10], points: [], note: '' }) },
    bars: { name: '막대그래프', tip: '값은 출처가 있는 자료만', fields: [['title', '제목', 'text'], ['items', '항목 · 값', 'pairs', ['항목', '값']], ['unit', '단위', 'text'], ['source', '출처 · 기준 연도', 'text']], make: () => ({ title: '제목', items: [['가', 3], ['나', 5]], unit: '', source: '' }) },
    timeline: { name: '연표', tip: '선 위로 때와 일이 차례로', fields: [['title', '위 제목', 'text'], ['events', '때 · 일', 'pairs', ['때', '일']], ['scale', '연도 간격대로 띄우기', 'check']], make: () => ({ title: '연표', events: [['1392', '사건'], ['1446', '사건']] }) },
    compare: { name: '둘 비교', tip: '양쪽이 엇갈려 들어온다', fields: [['left.title', '왼쪽 제목', 'text'], ['left.points', '왼쪽 내용', 'list'], ['right.title', '오른쪽 제목', 'text'], ['right.points', '오른쪽 내용', 'list'], ['vs', '가운데 글 (비우면 vs)', 'text']], make: () => ({ left: { title: 'A', points: ['내용'] }, right: { title: 'B', points: ['내용'] } }) },
    process: { name: '과정', tip: '단계가 차례로 채워진다', fields: [['title', '위 제목', 'text'], ['steps', '단계', 'list']], make: () => ({ title: '과정', steps: ['첫째', '둘째', '셋째'] }) },
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
  const exSel = h('select', { class: 'ghost', onchange: e => { const ex = window.EXAMPLES[+e.target.value]; if (ex && confirm(`예시 "${ex.name}" 을(를) 불러올까요? 지금 고친 내용은 사라져요.`)) { L = clone(ex.lesson); L.style = L.style || L.theme || 'dark'; delete L.theme; cur = 0; renderAll(); } e.target.value = ''; } },
    h('option', { value: '' }, '예시 불러오기'), ...(window.EXAMPLES || []).map((ex, i) => h('option', { value: i }, ex.name)));
  const bar = h('header', { class: 'top' },
    h('div', { class: 'brand' }, h('b', {}, '●'), ' 수업 영상 스튜디오'),
    h('div', { class: 'acts' }, exSel,
      h('button', { class: 'ghost', onclick: () => fileIn.click() }, '시나리오 열기'),
      h('button', { class: 'ghost', onclick: saveJSON }, '시나리오 저장'),
      h('button', { class: 'main', onclick: exportHTML }, '수업용 파일 저장 ↓')), fileIn);
  const left = h('aside', { class: 'left' });
  const right = h('main', { class: 'right' });
  app.append(bar, h('div', { class: 'body' }, left, right));

  // 오른쪽: 스타일 고르기 · 미리보기 · 점검
  const gallery = h('div', { class: 'gallery' });
  const pvWrap = h('div', { class: 'pv' }); const pvStage = h('div'); pvWrap.append(pvStage);
  const chips = h('div', { class: 'chips' });
  const playBtn = h('button', { class: 'play', onclick: () => toggle() }, '▶ 재생');
  const timeEl = h('span', { class: 'time' }, '0:00');
  const qaBox = h('div', { class: 's-qa' });
  right.append(
    h('section', {}, h('h3', {}, '1 · 스타일 고르기 ', h('small', {}, '지금 고른 장면이 스타일마다 어떻게 보이는지')), gallery),
    h('section', {}, h('h3', {}, '3 · 미리보기 ', h('small', {}, '장면을 누르면 그 장면으로 · 스페이스 = 재생')), pvWrap, h('div', { class: 'ctl' }, playBtn, timeEl, chips), qaBox));

  function renderAll() { renderLeft(); refresh(true); }

  // ---------- 왼쪽: 수업 정보 · 장면 목록 ----------
  function renderLeft() {
    left.innerHTML = '';
    const info = h('section', { class: 's-card info' }, h('h3', {}, '수업 정보'),
      row('제목', h('input', { value: L.title || '', oninput: e => { L.title = e.target.value; changed(); } })),
      h('div', { class: 'two' },
        row('과목', h('select', { onchange: e => { L.subject = e.target.value; changed(true); } }, SUBJECTS.map(s => h('option', { value: s, selected: L.subject === s }, s)))),
        row('화면', h('select', { onchange: e => { L.ratio = e.target.value; changed(true); } }, h('option', { value: '16:9', selected: L.ratio !== '9:16' }, '16:9 수업용'), h('option', { value: '9:16', selected: L.ratio === '9:16' }, '9:16 쇼츠')))),
      h('div', { class: 'two' },
        row('학년 · 단원', h('input', { value: L.unit || '', oninput: e => { L.unit = e.target.value; changed(); } })),
        row('소리', h('select', { onchange: e => { L.mood = e.target.value; changed(); } }, MOODS.map(([v, n]) => h('option', { value: v, selected: (L.mood || 'calm') === v }, n))))));
    left.append(h('h3', { class: 'step' }, '2 · 시나리오 고치기 ', h('small', {}, '화면에 나올 글은 여기 있는 것이 전부예요')), info);
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
        h('button', { title: '지우기', onclick: e => { e.stopPropagation(); if (L.scenes.length > 1 && confirm(`${i + 1}번 장면(${T.name})을 지울까요?`)) { L.scenes.splice(i, 1); cur = Math.min(cur, L.scenes.length - 1); renderAll(); } } }, '✕'))));
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

  // 녹음: 마이크로 바로 녹음하거나 파일을 넣는다 → 장면에 담긴다
  function voiceField(sc, i) {
    const st = h('span', { class: 'vst' }, sc.voiceData ? `녹음 ${sc.voiceDur.toFixed(1)}초 ✓` : '녹음 없음');
    const fin = h('input', { type: 'file', accept: 'audio/*', style: 'display:none', onchange: e => e.target.files[0] && takeBlob(e.target.files[0]) });
    let rec = null;
    const takeBlob = async blob => {
      const url = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
      try { const a = new (window.AudioContext || window.webkitAudioContext)(); const b = await a.decodeAudioData(await blob.arrayBuffer()); sc.voiceDur = +b.duration.toFixed(2); a.close(); }
      catch (e) { alert('이 소리 파일을 읽지 못했어요. mp3 · wav · m4a 로 다시 넣어 주세요.'); return; }
      sc.voiceData = url; st.textContent = `녹음 ${sc.voiceDur.toFixed(1)}초 ✓`; changed(true);
    };
    const recBtn = h('button', { onclick: async e => {
      e.stopPropagation();
      if (rec) { rec.stop(); return; }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); const chunks = [];
        rec = new MediaRecorder(stream); rec.ondataavailable = ev => chunks.push(ev.data);
        rec.onstop = () => { stream.getTracks().forEach(t => t.stop()); rec = null; recBtn.textContent = '🎙 녹음'; recBtn.classList.remove('rec'); takeBlob(new Blob(chunks, { type: chunks[0]?.type || 'audio/webm' })); };
        rec.start(); recBtn.textContent = '■ 멈추기'; recBtn.classList.add('rec'); st.textContent = '녹음 중…';
      } catch (err) { alert('마이크를 쓸 수 없어요. 파일로 넣어 주세요. (' + err.name + ')'); }
    } }, '🎙 녹음');
    return h('div', { class: 'voice' }, h('span', { class: 'vl' }, '목소리'), recBtn,
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
    refreshGallery();
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

  // ---------- 스타일 갤러리: 지금 장면을 스타일 6가지로 ----------
  let gTimer = null;
  function refreshGallery() { clearTimeout(gTimer); gTimer = setTimeout(drawGallery, 120); }
  async function drawGallery() {
    gallery.innerHTML = '';
    const sc = L.scenes[cur]; if (!sc) return;
    const one = { ...clone(L), scenes: [clone(sc)] };
    for (const S of PC.STYLES) {
      const holder = h('div', { class: 'thumb-stage' }); const st = h('div'); holder.append(st);
      const card = h('button', { class: 'thumb' + ((L.style || 'dark') === S.id ? ' on' : ''), onclick: () => { L.style = S.id; changed(true); } }, holder, h('b', {}, S.name), h('small', {}, S.desc));
      gallery.append(card);
      try {
        const g = PC.mount(st, { ...one, style: S.id });
        const k = Math.min(holder.clientWidth / g.W, 170 / g.H); st.style.transform = `scale(${k})`; st.style.left = (holder.clientWidth - g.W * k) / 2 + 'px'; holder.style.height = g.H * k + 'px';
        g.READY.then(() => g.seek(g.SCENES[0].dur - 0.55));
      } catch (e) { holder.textContent = '⚠'; }
    }
  }

  // ---------- 저장 · 열기 ----------
  const slug = () => (L.title || '수업').replace(/[\\/:*?"<>|\s]+/g, '_');
  // 저장: 크롬 · 엣지 · 웨일은 "다른 이름으로 저장" 창(한글 이름 그대로), 나머지는 내려받기
  const download = async (name, text, type) => {
    const blob = new Blob([text], { type });
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
    fr.onload = () => { try { const o = JSON.parse(fr.result); if (!o.scenes) throw new Error('scenes 없음'); L = o; L.style = L.style || L.theme || 'dark'; delete L.theme; cur = 0; renderAll(); } catch (e) { alert('시나리오 파일이 아니에요: ' + e.message); } };
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

  // 지난 작업이 있으면 알려 준다
  const draft = store.get('peace-studio-draft');
  if (draft && draft !== JSON.stringify(L)) {
    try { const d = JSON.parse(draft); const n = h('div', { class: 'restore' }, `지난번에 고치던 "${d.title || '수업'}"이 있어요. `, h('button', { onclick: () => { L = d; cur = 0; n.remove(); renderAll(); } }, '이어서 하기'), h('button', { onclick: () => n.remove() }, '닫기')); app.prepend(n); } catch (e) {}
  }
  renderAll();
})();
