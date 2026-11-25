/* peace-class runtime — lesson.json 한 장을 시간으로 움직이는 수업 모션 그래픽으로 만든다.
 * 페이지가 내보내는 것: window.READY (promise) · window.seek(t) · window.DUR · window.HITS · window.QA() · window.TEXTS
 * 원칙: 같은 t 에는 언제나 같은 화면(렌더러가 프레임마다 seek 한다). 화면의 글자 · 값은 lesson.json 에서만 온다.
 */
(() => {
  const L = window.LESSON;
  const R = L.ratio === '9:16';
  const W = R ? 1080 : 1920, H = R ? 1920 : 1080, U = Math.min(W, H) / 100;
  // 안전 영역: 9:16 은 쇼츠 화면의 버튼 · 자막 자리를 비운다(위 300 · 아래 480 · 오른쪽 200 · 왼쪽 60)
  const S = R ? { x: 60, y: 300, w: 820, h: 1140 } : { x: 0.075 * W, y: 0.14 * H, w: 0.85 * W, h: 0.72 * H };
  const SUBJ = { '수학': '#d7ff00', '과학': '#3ee0ff', '국어': '#ff6b9a', '영어': '#ffb21e', '사회': '#9b7bff' };
  const ACC = L.accent || SUBJ[L.subject] || '#d7ff00';
  const BAD = '#ff4d5e';

  // ---------- 작은 도구 ----------
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const p = (t, a, b) => clamp((t - a) / (b - a));
  const eo = x => 1 - Math.pow(1 - x, 3);
  const eio = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const back = x => { const c = 1.9, c3 = c + 1; return 1 + c3 * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
  const lerp = (a, b, k) => a + (b - a) * k;
  const el = (tag, cls, parent, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; if (parent) parent.appendChild(e); return e; };
  const SVGNS = 'http://www.w3.org/2000/svg';
  const sv = (tag, attrs, parent) => { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
  const css = (e, o) => Object.assign(e.style, o);
  const px = v => v + 'px';
  const place = (e, x, y, w, h) => css(e, { left: px(x), top: px(y), ...(w != null ? { width: px(w) } : {}), ...(h != null ? { height: px(h) } : {}) });
  const fmt = (v, like) => { const d = (String(like).split('.')[1] || '').length; return Number(v).toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d }); };
  let stageRect;
  const box = e => { const r = e.getBoundingClientRect(); return { x: r.left - stageRect.left, y: r.top - stageRect.top, w: r.width, h: r.height }; };
  const arc = (a, b, k, lift) => { const x = lerp(a.x, b.x, k), y = lerp(a.y, b.y, k); const d = Math.hypot(b.x - a.x, b.y - a.y); return { x, y: y - Math.sin(Math.PI * k) * (lift != null ? lift : Math.min(d * .32, 16 * U)) }; };
  // 수식: $...$ 은 KaTeX, [[...]] 은 형광 칠할 곳
  const KOPT = { throwOnError: false, strict: false, trust: true, macros: { '\\hl': '\\htmlClass{hl}{#1}' } };
  const rich = (parent, str) => {
    String(str).split(/(\$[^$]+\$)/).forEach(part => {
      if (!part) return;
      if (part.startsWith('$') && part.endsWith('$') && part.length > 2) { const s = el('span', null, parent); katex.render(part.slice(1, -1), s, KOPT); }
      else part.split(/(\[\[[^\]]+\]\])/).forEach(q => { if (!q) return; if (q.startsWith('[[')) el('span', 'hl', parent, q.slice(2, -2)); else parent.appendChild(document.createTextNode(q)); });
    });
    return parent;
  };
  const plain = s => String(s).replace(/\$([^$]+)\$/g, '$1').replace(/\[\[|\]\]/g, '').replace(/\\hl\{([^}]*)\}/g, '$1');
  const maskLine = (parent, cls, str, isTex) => { const m = el('span', 'mask', parent); const inner = el('span', cls || '', m); if (isTex) katex.render(str, inner, KOPT); else rich(inner, str); return { m, inner }; };
  const rise = (inner, k, dist = 105) => { const e = eo(k); inner.style.transform = `translateY(${(1 - e) * dist}%)`; };
  const wipe = (e, k) => { e.style.clipPath = `inset(-20% ${((1 - k) * 100).toFixed(2)}% -20% -2%)`; };

  // ---------- 무대 ----------
  const stage = document.getElementById('stage');
  css(stage, { width: px(W), height: px(H) });
  stage.style.setProperty('--acc', ACC); stage.style.setProperty('--bad', BAD); stage.style.setProperty('--u', px(U));
  if (L.theme === 'light') stage.classList.add('theme-light');
  const HITS = [], TEXTS = [];
  const scenes = [];

  // ---------- 화면 틀 ----------
  const frame = el('div', 'frame', stage);
  const top = R ? S.y - 8 * U : 4.2 * U, bot = R ? S.y + S.h + 5 * U : H - 6.2 * U;
  const labTL = el('div', 'lab', frame); labTL.innerHTML = `<b>${L.subject || ''}</b>  ${L.unit || ''}`;
  const labTR = el('div', 'lab', frame); const labBL = el('div', 'lab', frame, L.brand || 'PEACE CLASS'); const labBR = el('div', 'lab', frame);
  place(labTL, S.x, top); place(labBL, S.x, bot);
  const ruleT = el('div', 'rule', frame); place(ruleT, S.x, top + 3.4 * U, S.w);
  const ruleB = el('div', 'rule', frame); place(ruleB, S.x, bot - 1.4 * U, S.w);
  const prog = el('div', 'prog', frame); place(prog, 0, H - .35 * U, 0);
  const dot = el('div', 'dot', stage);

  // ================= 장면 틀 =================
  const T = {};

  // 1) 제목: 점이 지나가며 제목을 밝힌다(마스크 리빌 · 빛 훑기), 손글씨 한 줄
  T.title = (sc, root) => {
    const col = el('div', 'abs qa', root); place(col, S.x, S.y, S.w, S.h);
    css(col, { display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: R ? 'flex-start' : 'center', textAlign: R ? 'left' : 'center', gap: px(2.6 * U) });
    const kick = el('div', 'kicker', col, sc.kicker || [L.subject, L.unit].filter(Boolean).join(' · '));
    const ti = el('div', 'big', col); rich(ti, sc.title); css(ti, { fontSize: px((sc.size || (R ? 13 : 13.5)) * U) });
    const sub = sc.sub ? el('div', 'pen', col, sc.sub) : null; if (sub) css(sub, { fontSize: px(6.2 * U) });
    TEXTS.push(kick.textContent, plain(sc.title)); if (sc.sub) TEXTS.push(sc.sub);
    let b; const dur = sc.dur || (sc.sub ? 4.6 : 3.6);
    return {
      dur, hits: [[0.1, 'pop'], [0.45, 'sweep'], ...(sub ? [[1.55, 'write']] : [])],
      measure() { b = box(ti); this.dotIn = { x: b.x - 2.5 * U, y: b.y + b.h * .52 }; this.dotOut = { x: b.x + b.w + 2.5 * U, y: b.y + b.h * .52 }; },
      update(lt) {
        kick.style.opacity = eo(p(lt, 0.1, 0.6)); kick.style.letterSpacing = `${lerp(.9, .38, eo(p(lt, 0.1, 0.9)))}em`;
        wipe(ti, eio(p(lt, 0.45, 1.45)));
        if (sub) wipe(sub, p(lt, 1.55, 2.55));
      },
      dotAt(lt) { const k = eio(p(lt, 0.45, 1.45)); return { x: lerp(this.dotIn.x, this.dotOut.x, k), y: this.dotIn.y, s: back(p(lt, 0.05, 0.4)) }; },
    };
  };

  // 2) 개념: 용어가 올라오고, 정의가 낱말씩, 핵심 낱말은 점이 형광펜으로 칠한다
  T.concept = (sc, root) => {
    const col = el('div', 'abs qa', root); place(col, S.x, S.y, S.w * (R ? 1 : .86), S.h);
    css(col, { display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: px(2.4 * U) });
    const kick = el('div', 'kicker', col, sc.label || '개념');
    const term = el('div', 'big', col); const tm = maskLine(term, '', sc.term); css(term, { fontSize: px((sc.size || 10) * U) });
    const tx = el('div', 'textwrap', col); css(tx, { fontSize: px((R ? 5.4 : 4.6) * U), lineHeight: 1.55, maxWidth: px(S.w * (R ? 1 : .8)) });
    const keys = (sc.keys || []).filter(k => sc.text.includes(k));
    const words = []; const keyEls = [];
    // 원문을 핵심 낱말 기준으로 쪼갠다
    let rest = sc.text;
    const pushWords = (str, parent) => str.split(/(\s+)/).forEach(w => { if (!w) return; if (/^\s+$/.test(w)) { parent.appendChild(document.createTextNode(' ')); return; } words.push(el('span', 'word', parent, w)); });
    while (rest.length) {
      let hit = null, at = rest.length;
      keys.forEach(k => { const i = rest.indexOf(k); if (i >= 0 && i < at) { at = i; hit = k; } });
      pushWords(rest.slice(0, at), tx);
      if (!hit) break;
      const ke = el('span', 'key', tx); el('span', 'bar', ke); pushWords(hit, ke); keyEls.push(ke);
      rest = rest.slice(at + hit.length);
    }
    TEXTS.push(kick.textContent, plain(sc.term), sc.text);
    const w0 = 0.9, ws = Math.min(0.07, 1.6 / Math.max(1, words.length)), wEnd = w0 + words.length * ws + 0.35;
    const kt = keyEls.map((_, j) => wEnd + 0.25 + j * 0.85);
    const dur = sc.dur || (kt.length ? kt[kt.length - 1] + 2.2 : wEnd + 2.0);
    let kb = [];
    return {
      dur, hits: [[0.25, 'rise'], [w0, 'words'], ...kt.map(t => [t, 'mark'])],
      measure() { const tb = box(term.firstChild.firstChild); kb = keyEls.map(k => box(k)); this.dotIn = { x: tb.x + tb.w + 2.6 * U, y: tb.y + tb.h * .5 }; this.dotOut = kb.length ? { x: kb.at(-1).x + kb.at(-1).w + 1.6 * U, y: kb.at(-1).y + kb.at(-1).h * .62 } : this.dotIn; },
      update(lt) {
        kick.style.opacity = eo(p(lt, 0.1, 0.5)); rise(tm.inner, p(lt, 0.25, 0.85));
        words.forEach((w, i) => { const k = eo(p(lt, w0 + i * ws, w0 + i * ws + 0.35)); w.style.opacity = k; w.style.transform = `translateY(${(1 - k) * .5}em)`; });
        keyEls.forEach((ke, j) => { const k = eio(p(lt, kt[j], kt[j] + 0.5)); ke.firstChild.style.transform = `scaleX(${k})`; ke.classList.toggle('on', k > .45); });
      },
      dotAt(lt) {
        let pt = this.dotIn;
        for (let j = 0; j < kt.length; j++) {
          const b = kb[j], a = { x: b.x - 1.2 * U, y: b.y + b.h * .62 }, z = { x: b.x + b.w + 1.6 * U, y: a.y };
          if (lt >= kt[j] - 0.3) pt = lt < kt[j] ? arc(j ? { x: kb[j - 1].x + kb[j - 1].w + 1.6 * U, y: kb[j - 1].y + kb[j - 1].h * .62 } : this.dotIn, a, eio(p(lt, kt[j] - 0.3, kt[j]))) : { x: lerp(a.x, z.x, eio(p(lt, kt[j], kt[j] + 0.5))), y: a.y };
        }
        return pt;
      },
    };
  };

  // 3) 수식 · 풀이: 한 줄씩 올라오고, 바뀐 곳(\hl{…} · [[…]])은 형광으로, 지난 줄은 흐려진다
  T.steps = (sc, root) => {
    const col = el('div', 'abs qa', root); place(col, S.x, S.y, S.w, S.h);
    css(col, { display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: R ? 'flex-start' : 'center', gap: px(2.2 * U) });
    let tt = null; if (sc.title) { tt = el('div', 'head', col); rich(tt, sc.title); css(tt, { fontSize: px((R ? 4.4 : 3.8) * U) }); TEXTS.push(plain(sc.title)); }
    const tex = sc.tex !== false;
    const lines = sc.lines.map(s => { const row = el('div', null, col); css(row, { fontSize: px((sc.size || (R ? 6.4 : 6.2)) * U), lineHeight: 1.3, fontWeight: 900 }); const m = maskLine(row, '', s, tex); TEXTS.push(plain(s)); return { row, ...m, hls: [...row.querySelectorAll('.hl')] }; });
    const note = sc.note ? el('div', 'pen', col, sc.note) : null; if (note) { css(note, { fontSize: px(5 * U), marginTop: px(1.6 * U) }); TEXTS.push(sc.note); }
    const G = sc.gap || 1.8, a = lines.map((_, i) => 0.45 + i * G), nT = a.at(-1) + G * .75;
    const dur = sc.dur || nT + (note ? 2.2 : 1.4);
    let lb = [];
    return {
      dur, hits: [...(tt ? [[0.1, 'rise']] : []), ...a.map(t => [t, 'rise']), ...lines.flatMap((l, i) => l.hls.map((_, j) => [a[i] + 0.6 + j * 0.3, 'mark'])), ...(note ? [[nT, 'write']] : [])],
      measure() { lb = lines.map(l => box(l.inner)); this.pts = lb.map(b => ({ x: b.x - 3 * U, y: b.y + b.h * .5 })); this.dotIn = this.pts[0]; this.dotOut = note ? (b => ({ x: b.x + b.w + 2 * U, y: b.y + b.h * .55 }))(box(note)) : this.pts.at(-1); },
      update(lt) {
        if (tt) tt.style.opacity = eo(p(lt, 0.1, 0.5));
        lines.forEach((l, i) => {
          rise(l.inner, p(lt, a[i], a[i] + 0.55));
          const next = i + 1 < a.length ? a[i + 1] : 1e9; l.row.style.opacity = lerp(1, sc.keep ? 1 : .42, eo(p(lt, next, next + 0.4)));
          l.hls.forEach((h, j) => { const k = eio(p(lt, a[i] + 0.6 + j * 0.3, a[i] + 1.0 + j * 0.3)); h.style.setProperty('--k', k); h.classList.toggle('on', k > .5); });
        });
        if (note) wipe(note, p(lt, nT, nT + 1.1));
      },
      dotAt(lt) {
        let pt = this.pts[0];
        for (let i = 1; i < a.length; i++) if (lt >= a[i] - 0.35) pt = arc(this.pts[i - 1], this.pts[i], eio(p(lt, a[i] - 0.35, a[i])));
        if (note && lt >= nT) pt = arc(this.pts.at(-1), this.dotOut, eio(p(lt, nT, nT + 1.1)), 4 * U);
        return pt;
      },
    };
  };

  // 4) 함수 그래프: 좌표축이 그어지고, 점이 곡선을 타고 그린다. 점 · 기울기 삼각형 · 메모
  T.graph = (sc, root) => {
    const [x0, x1] = sc.x || [-5, 5], [y0, y1] = sc.y || [-5, 5];
    const side = el('div', 'abs qa', root);
    let P; // 그래프 영역
    if (R) { const s = S.w; P = { x: S.x, y: S.y + 9 * U, w: s, h: s * (sc.aspect || 1) }; place(side, S.x, P.y + P.h + 4 * U, S.w, S.y + S.h - (P.y + P.h + 4 * U)); }
    else { const h = S.h, w = Math.min(S.w * .58, h * (sc.aspect ? 1 / sc.aspect : 1.15)); P = { x: S.x, y: S.y, w, h }; place(side, S.x + w + 6 * U, S.y, S.w - w - 6 * U, S.h); }
    css(side, { display: 'flex', flexDirection: 'column', justifyContent: R ? 'flex-start' : 'center', gap: px(2.2 * U) });
    const X = x => P.x + (x - x0) / (x1 - x0) * P.w, Y = y => P.y + (y1 - y) / (y1 - y0) * P.h;
    const svg = sv('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}` }, root); css(svg, { position: 'absolute', left: 0, top: 0 });
    const clipId = 'c' + Math.random().toString(36).slice(2);
    const defs = sv('defs', {}, svg); const cp = sv('clipPath', { id: clipId }, defs); sv('rect', { x: P.x, y: P.y, width: P.w, height: P.h }, cp);
    const step = sc.step || (v => v <= 12 ? 1 : v <= 24 ? 2 : v <= 60 ? 5 : 10)(Math.max(x1 - x0, y1 - y0));
    const gridG = sv('g', {}, svg), tickG = sv('g', {}, svg);
    for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) { sv('line', { x1: X(x), y1: P.y, x2: X(x), y2: P.y + P.h, class: 'grid' }, gridG); if (x) { const t = sv('text', { x: X(x), y: Y(clamp(0, y0, y1)) + 3.4 * U, 'text-anchor': 'middle', class: 'tick', 'font-size': 2.2 * U }, tickG); t.textContent = x; } }
    for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) { sv('line', { x1: P.x, y1: Y(y), x2: P.x + P.w, y2: Y(y), class: 'grid' }, gridG); if (y) { const t = sv('text', { x: X(clamp(0, x0, x1)) - 1.4 * U, y: Y(y) + .8 * U, 'text-anchor': 'end', class: 'tick', 'font-size': 2.2 * U }, tickG); t.textContent = y; } }
    const o = sv('text', { x: X(clamp(0, x0, x1)) - 1.4 * U, y: Y(clamp(0, y0, y1)) + 3.4 * U, 'text-anchor': 'end', class: 'tick', 'font-size': 2.2 * U }, tickG); o.textContent = 'O';
    const axX = sv('line', { x1: P.x, y1: Y(clamp(0, y0, y1)), x2: P.x + P.w, y2: Y(clamp(0, y0, y1)), class: 'ax' }, svg);
    const axY = sv('line', { x1: X(clamp(0, x0, x1)), y1: P.y + P.h, x2: X(clamp(0, x0, x1)), y2: P.y, class: 'ax' }, svg);
    const lx = sv('text', { x: P.x + P.w + 1.2 * U, y: Y(clamp(0, y0, y1)) + .9 * U, class: 'tick', 'font-size': 2.8 * U, 'font-style': 'italic' }, svg); lx.textContent = 'x';
    const ly = sv('text', { x: X(clamp(0, x0, x1)) + 1.2 * U, y: P.y - 1.2 * U, class: 'tick', 'font-size': 2.8 * U, 'font-style': 'italic' }, svg); ly.textContent = 'y';
    const COLS = [ACC, 'var(--ink)', '#6fd3ff', '#ff8f6b'];
    const fns = (sc.fns || []).map((f, j) => {
      const fn = new Function('x', `with (Math) { return (${f.f}); }`);
      let d = '', pen = false; const N = 400;
      for (let i = 0; i <= N; i++) { const x = x0 + (x1 - x0) * i / N, y = fn(x); if (!isFinite(y) || y < y0 - (y1 - y0) || y > y1 + (y1 - y0)) { pen = false; continue; } d += (pen ? 'L' : 'M') + X(x).toFixed(1) + ' ' + Y(y).toFixed(1); pen = true; }
      const path = sv('path', { d, class: 'curve', stroke: f.color || COLS[j % 4], 'clip-path': `url(#${clipId})` }, svg);
      const lab = el('div', null, side); css(lab, { fontSize: px((R ? 5.2 : 4.4) * U), fontWeight: 900, color: f.color || COLS[j % 4], display: 'flex', alignItems: 'center', gap: px(1.4 * U) });
      const sw = el('span', null, lab); css(sw, { width: px(4 * U), height: px(.7 * U), background: f.color || COLS[j % 4], borderRadius: px(U), flex: 'none' });
      const lt_ = el('span', null, lab); if (f.label) katex.render(f.label, lt_, KOPT); TEXTS.push(f.label || f.f);
      return { fn, path, lab };
    });
    const c0 = 1.1, CD = sc.drawTime || 1.7, cs = fns.map((_, j) => c0 + j * (CD + 0.5)), cEnd = (cs.at(-1) || c0) + CD;
    const pts = (sc.points || []).map(([x, y, label], k) => {
      const g = sv('g', {}, svg); const c = sv('circle', { cx: X(x), cy: Y(y), r: 1.1 * U, class: 'pt' }, g);
      const t = sv('text', { x: X(x) + 1.8 * U, y: Y(y) - 1.6 * U, class: 'ptlab', 'font-size': 2.8 * U }, g); t.textContent = label || `(${x}, ${y})`; TEXTS.push(t.textContent);
      return { x, y, g, c, at: cEnd + 0.4 + k * 0.75 };
    });
    let triT = null, tri = null;
    if (sc.tri) {
      const f = fns[sc.tri.fn || 0].fn, a = sc.tri.at || 0, dx = sc.tri.dx || 1, ya = f(a), yb = f(a + dx), dy = Math.round((yb - ya) * 1000) / 1000;
      triT = (pts.at(-1)?.at || cEnd) + 0.8;
      const g = sv('g', {}, svg);
      const h = sv('path', { d: `M${X(a)} ${Y(ya)}L${X(a + dx)} ${Y(ya)}`, class: 'curve', stroke: 'var(--ink)', 'stroke-width': 5, 'stroke-dasharray': '1 0' }, g);
      const v = sv('path', { d: `M${X(a + dx)} ${Y(ya)}L${X(a + dx)} ${Y(yb)}`, class: 'curve', stroke: ACC, 'stroke-width': 5 }, g);
      const th = sv('text', { x: (X(a) + X(a + dx)) / 2, y: Y(ya) + (dy >= 0 ? 4 : -2) * U, 'text-anchor': 'middle', class: 'ptlab', 'font-size': 3.2 * U }, g); th.textContent = `+${dx}`;
      const tv = sv('text', { x: X(a + dx) + 1.6 * U, y: (Y(ya) + Y(yb)) / 2 + U, class: 'ptlab', 'font-size': 3.2 * U, fill: ACC }, g); tv.textContent = (dy >= 0 ? '+' : '') + dy;
      TEXTS.push(th.textContent, tv.textContent);
      tri = { h, v, th, tv, a: { x: X(a), y: Y(ya) }, b: { x: X(a + dx), y: Y(ya) }, c: { x: X(a + dx), y: Y(yb) } };
    }
    const nT = (triT || pts.at(-1)?.at || cEnd) + 1.4;
    const note = sc.note ? el('div', 'pen', side, sc.note) : null; if (note) { css(note, { fontSize: px((R ? 5.6 : 4.8) * U), alignSelf: 'flex-start' }); TEXTS.push(sc.note); }
    const dur = sc.dur || nT + (note ? 2.4 : 0.8);
    return {
      dur, hits: [[0.2, 'draw'], ...cs.map(t => [t, 'draw']), ...pts.map(q => [q.at, 'pop']), ...(triT ? [[triT, 'hop'], [triT + 0.6, 'hop']] : []), ...(note ? [[nT, 'write']] : [])],
      measure() { this.L = fns.map(f => f.path.getTotalLength()); this.dotIn = fns.length ? (q => ({ x: q.x, y: q.y }))(fns[0].path.getPointAtLength(0)) : { x: X(0), y: Y(0) }; this.dotOut = note ? (b => ({ x: b.x + b.w + 2 * U, y: b.y + b.h * .55 }))(box(note)) : this.dotIn; },
      update(lt) {
        gridG.style.opacity = .9 * eo(p(lt, 0, 0.5)); tickG.style.opacity = eo(p(lt, 0.6, 1.0));
        const ka = eio(p(lt, 0.2, 0.95)); [axX, axY].forEach(a => { a.setAttribute('stroke-dasharray', `${ka * 4000} 4000`); }); lx.style.opacity = ly.style.opacity = ka;
        fns.forEach((f, j) => { const k = p(lt, cs[j], cs[j] + CD), len = this.L[j]; f.path.setAttribute('stroke-dasharray', `${len} ${len}`); f.path.setAttribute('stroke-dashoffset', (1 - eio(k)) * len); const kl = eo(p(lt, cs[j] + CD * .6, cs[j] + CD * .6 + 0.5)); f.lab.style.opacity = kl; f.lab.style.transform = `translateX(${(1 - kl) * 3 * U}px)`; });
        pts.forEach(q => { const k = back(p(lt, q.at, q.at + 0.45)); q.c.setAttribute('r', Math.max(0, 1.1 * U * k)); q.g.lastChild.style.opacity = eo(p(lt, q.at + 0.15, q.at + 0.5)); });
        if (tri) { const k1 = eio(p(lt, triT, triT + 0.5)), k2 = eio(p(lt, triT + 0.6, triT + 1.1)); tri.h.setAttribute('d', `M${tri.a.x} ${tri.a.y}L${lerp(tri.a.x, tri.b.x, k1)} ${tri.a.y}`); tri.v.setAttribute('d', `M${tri.b.x} ${tri.b.y}L${tri.b.x} ${lerp(tri.b.y, tri.c.y, k2)}`); tri.h.style.opacity = k1 > 0 ? 1 : 0; tri.v.style.opacity = k2 > 0 ? 1 : 0; tri.th.style.opacity = eo(p(lt, triT + 0.3, triT + 0.6)); tri.tv.style.opacity = eo(p(lt, triT + 0.9, triT + 1.2)); }
        if (note) wipe(note, p(lt, nT, nT + 1.2));
      },
      dotAt(lt) {
        let pt = this.dotIn;
        fns.forEach((f, j) => { if (lt >= cs[j] - 0.4) { const s = f.path.getPointAtLength(this.L[j] * eio(p(lt, cs[j], cs[j] + CD))); const q = { x: s.x, y: s.y }; pt = lt < cs[j] && j ? arc(pt, (z => ({ x: z.x, y: z.y }))(f.path.getPointAtLength(0)), eio(p(lt, cs[j] - 0.4, cs[j]))) : q; } });
        pts.forEach(q => { if (lt >= q.at - 0.4) pt = arc(pt, { x: X(q.x), y: Y(q.y) }, eio(p(lt, q.at - 0.4, q.at))); });
        if (tri) { if (lt >= triT - 0.3) pt = arc(pt, tri.a, eio(p(lt, triT - 0.3, triT))); if (lt >= triT) pt = { x: lerp(tri.a.x, tri.b.x, eio(p(lt, triT, triT + 0.5))), y: tri.a.y }; if (lt >= triT + 0.6) pt = { x: tri.b.x, y: lerp(tri.b.y, tri.c.y, eio(p(lt, triT + 0.6, triT + 1.1))) }; }
        if (note && lt >= nT) pt = arc(pt, this.dotOut, eio(p(lt, nT, nT + 1.2)));
        return pt;
      },
    };
  };

  // 5) 막대 그래프: 막대가 차례로 자라고 숫자가 세어 오른다. 점은 막대 꼭대기를 건너뛰다 가장 큰 막대에 앉는다
  T.bars = (sc, root) => {
    const tt = el('div', 'abs qa', root); css(tt, { fontWeight: 900, fontSize: px((R ? 5.6 : 4.6) * U) }); place(tt, S.x, S.y, S.w); rich(tt, sc.title || ''); TEXTS.push(plain(sc.title || ''));
    const items = sc.items, n = items.length, max = Math.max(...items.map(i => +i[1]));
    const A = { x: S.x, y: S.y + 12 * U, w: S.w, h: S.h - 12 * U - 7 * U }, base = A.y + A.h;
    const slot = A.w / n, bw = Math.min(slot * .58, 18 * U);
    const line = el('div', 'abs', root); css(line, { height: '3px', background: 'var(--ink)', transformOrigin: '0 50%' }); place(line, A.x, base, A.w);
    const bars = items.map(([lab, v], i) => {
      const cx = A.x + slot * (i + .5), h = (+v / max) * (A.h - 8 * U);
      const b = el('div', 'abs', root); css(b, { background: 'var(--ink)', borderRadius: `${U}px ${U}px 0 0`, transformOrigin: '50% 100%' }); place(b, cx - bw / 2, base - h, bw, h);
      const val = el('div', 'abs', root); css(val, { width: px(slot), textAlign: 'center', fontWeight: 900, fontSize: px((R ? 4.4 : 3.8) * U) }); place(val, cx - slot / 2, base - h - 6 * U);
      const lb = el('div', 'abs', root, lab); css(lb, { width: px(slot), textAlign: 'center', fontSize: px((R ? 3.2 : 2.6) * U), color: 'var(--dim)' }); place(lb, cx - slot / 2, base + 1.6 * U);
      TEXTS.push(`${lab} ${v}${sc.unit || ''}`);
      return { cx, h, b, val, lb, v: +v, raw: v, at: 0.9 + i * Math.min(0.45, 2.4 / n), top: { x: cx, y: base - h - 8.4 * U } };
    });
    const src = sc.source ? el('div', 'src', root, sc.source) : null; if (src) { place(src, S.x, base + 6.5 * U, S.w); src.style.textAlign = 'right'; TEXTS.push(sc.source); }
    const mi = bars.findIndex(b => b.v === max), tm = bars.at(-1).at + 1.1;
    const dur = sc.dur || tm + 2.2;
    return {
      dur, hits: [[0.2, 'rise'], [0.45, 'draw'], ...bars.map(b => [b.at, 'grow']), [tm, 'mark']],
      measure() { this.dotIn = { x: A.x, y: base }; this.dotOut = bars[mi].top; },
      update(lt) {
        tt.style.opacity = eo(p(lt, 0.2, 0.6)); line.style.transform = `scaleX(${eio(p(lt, 0.45, 1.0))})`;
        bars.forEach((b, i) => {
          const k = p(lt, b.at, b.at + 0.75); b.b.style.transform = `scaleY(${Math.max(0, back(k))})`; b.lb.style.opacity = eo(p(lt, b.at - 0.2, b.at + 0.3));
          b.val.textContent = fmt(b.v * eo(k), b.raw) + (sc.unit || ''); b.val.style.opacity = k > 0 ? 1 : 0; b.val.style.transform = `translateY(${(1 - back(k)) * b.h}px)`;
          const hk = eo(p(lt, tm, tm + 0.5)); b.b.style.background = i === mi ? `color-mix(in srgb, ${ACC} ${hk * 100}%, var(--ink))` : 'var(--ink)'; b.b.style.opacity = i === mi ? 1 : lerp(1, .35, hk); b.val.style.color = i === mi && hk > .5 ? ACC : 'var(--ink)';
        });
        if (src) src.style.opacity = eo(p(lt, tm, tm + 0.6));
      },
      dotAt(lt) {
        let pt = this.dotIn;
        bars.forEach((b, i) => { if (lt >= b.at - 0.3) { const tgt = { x: b.cx, y: base - b.h * back(clamp(p(lt, b.at, b.at + 0.75), 0, 1)) - 2.4 * U }; pt = lt < b.at ? arc(pt, { x: b.cx, y: base - 2.4 * U }, eio(p(lt, b.at - 0.3, b.at))) : tgt; } });
        if (lt >= tm - 0.1) pt = arc(pt, bars[mi].top, eio(p(lt, tm - 0.1, tm + 0.5)));
        return pt;
      },
    };
  };

  // 6) 연표: 점이 선을 그으며 지나가고, 지나간 자리에 사건이 선다
  T.timeline = (sc, root) => {
    const ev = sc.events, n = ev.length;
    let tt = null; if (sc.title) { tt = el('div', 'abs kicker qa', root, sc.title); place(tt, S.x, S.y); TEXTS.push(sc.title); }
    const A = R ? { x: S.x + 4 * U, y: S.y + 10 * U, w: 0, h: S.h - 14 * U } : { x: S.x + 2 * U, y: S.y + S.h * .52, w: S.w - 4 * U, h: 0 };
    const line = el('div', 'abs', root); css(line, { background: 'var(--ink)', transformOrigin: R ? '50% 0' : '0 50%' });
    if (R) place(line, A.x - 1.5, A.y, 3, A.h); else place(line, A.x, A.y - 1.5, A.w, 3);
    const nums = ev.map(e => parseFloat(e[0])); const scaled = sc.scale && nums.every(isFinite);
    const pos = i => { const f = scaled ? (nums[i] - nums[0]) / (nums.at(-1) - nums[0] || 1) * .84 + .08 : (i + .5) / n; return R ? { x: A.x, y: A.y + f * A.h } : { x: A.x + f * A.w, y: A.y }; };
    const L0 = 0.5, per = sc.per || 1.25;
    const items = ev.map(([when, what], i) => {
      const q = pos(i), up = !R && i % 2 === 0;
      const tick = el('div', 'abs', root); css(tick, { width: px(2.2 * U), height: px(2.2 * U), borderRadius: '50%', background: 'var(--bg)', border: `${.5 * U}px solid var(--ink)` }); place(tick, q.x - 1.1 * U, q.y - 1.1 * U);
      const card = el('div', 'abs qa', root); const cw = R ? S.w - 12 * U : Math.min(A.w / n * 1.05, 40 * U);
      css(card, { width: px(cw), display: 'flex', flexDirection: 'column', gap: px(.8 * U), textAlign: R ? 'left' : 'center' });
      const y = el('div', null, card, when); css(y, { fontFamily: "'ANTON','KR'", fontSize: px((R ? 6 : 5) * U), color: ACC, letterSpacing: '.04em', lineHeight: 1 });
      const w = el('div', null, card); rich(w, what); css(w, { fontSize: px((R ? 3.8 : 3.0) * U), lineHeight: 1.35 });
      if (R) place(card, q.x + 5 * U, q.y - 3.4 * U); else place(card, q.x - cw / 2, up ? q.y - 4 * U : q.y + 4 * U);
      if (up && !R) card.style.transform = 'translateY(-100%)';
      TEXTS.push(`${when} ${plain(what)}`);
      return { q, tick, card, up, at: L0 + (i + 0.5) * per };
    });
    const lEnd = L0 + n * per; const dur = sc.dur || lEnd + 1.8;
    const tipAt = lt => { const k = p(lt, L0, lEnd); return R ? { x: A.x, y: A.y + k * A.h } : { x: A.x + k * A.w, y: A.y }; };
    return {
      dur, hits: [...(tt ? [[0.1, 'rise']] : []), [L0, 'draw'], ...items.map(it => [it.at, 'tick'])],
      measure() { this.dotIn = R ? { x: A.x, y: A.y } : { x: A.x, y: A.y }; this.dotOut = R ? { x: A.x, y: A.y + A.h } : { x: A.x + A.w, y: A.y }; },
      update(lt) {
        if (tt) tt.style.opacity = eo(p(lt, 0.1, 0.5));
        const k = p(lt, L0, lEnd); line.style.transform = R ? `scaleY(${k})` : `scaleX(${k})`;
        items.forEach(it => {
          const kk = back(p(lt, it.at - 0.1, it.at + 0.35)); it.tick.style.transform = `scale(${Math.max(0, kk)})`; it.tick.style.background = lt > it.at ? ACC : 'var(--bg)';
          const kc = eo(p(lt, it.at, it.at + 0.5)); it.card.style.opacity = kc;
          const off = (1 - kc) * 3 * U * (R ? 0 : it.up ? 1 : -1); it.card.style.transform = `${it.up && !R ? 'translateY(-100%) ' : ''}translate(${R ? (1 - kc) * 3 * U : 0}px, ${off}px)`;
        });
      },
      dotAt(lt) { return tipAt(lt); },
    };
  };

  // 7) 둘 비교: 점이 가운데 선을 긋고, 양쪽이 서로 엇갈려 들어온다
  T.compare = (sc, root) => {
    const sides = [sc.left, sc.right];
    const gap = 6 * U;
    const cols = sides.map((s, i) => {
      const c = el('div', 'abs qa', root);
      if (R) place(c, S.x, S.y + i * (S.h / 2 + gap / 2), S.w, S.h / 2 - gap / 2); else place(c, S.x + i * (S.w / 2 + gap / 2), S.y, S.w / 2 - gap / 2, S.h);
      css(c, { display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: px(2 * U), padding: R ? `0 ${2 * U}px` : `0 ${3 * U}px` });
      const h = el('div', 'big', c); rich(h, s.title); css(h, { fontSize: px((R ? 6.4 : 5.6) * U), color: i === 0 ? 'var(--ink)' : ACC });
      const ps = (s.points || []).map(t => { const d = el('div', null, c); rich(d, '— ' + t); css(d, { fontSize: px((R ? 3.8 : 3.2) * U), lineHeight: 1.45 }); return d; });
      TEXTS.push(plain(s.title), ...(s.points || []).map(plain));
      return { c, h, ps, at: 0.75 + i * 0.25 };
    });
    const div = el('div', 'abs', root); css(div, { background: 'var(--line)', transformOrigin: R ? '0 50%' : '50% 0' });
    if (R) place(div, S.x, S.y + S.h / 2 - 1, S.w, 2); else place(div, S.x + S.w / 2 - 1, S.y, 2, S.h);
    const vs = el('div', 'abs pen', root, sc.vs || 'vs'); css(vs, { fontSize: px(5 * U), background: 'var(--bg)', padding: `0 ${U}px`, transform: 'translate(-50%,-50%)' });
    const C = { x: S.x + S.w / 2, y: S.y + S.h / 2 }; place(vs, C.x, C.y);
    const np = Math.max(...cols.map(c => c.ps.length)); const pEnd = 1.3 + np * 0.4;
    const dur = sc.dur || pEnd + 2.6;
    return {
      dur, hits: [[0.15, 'draw'], [0.75, 'rise'], [1.0, 'rise'], ...Array.from({ length: np }, (_, j) => [1.3 + j * 0.4, 'words']), [0.7, 'pop']],
      measure() { this.dotIn = R ? { x: S.x, y: C.y } : { x: C.x, y: S.y }; this.dotOut = R ? { x: S.x + S.w, y: C.y } : { x: C.x, y: S.y + S.h }; },
      update(lt) {
        div.style.transform = R ? `scaleX(${eio(p(lt, 0.15, 0.75))})` : `scaleY(${eio(p(lt, 0.15, 0.75))})`;
        const kv = back(p(lt, 0.7, 1.05)); vs.style.transform = `translate(-50%,-50%) scale(${Math.max(0, kv)})`;
        cols.forEach((c, i) => {
          const k = eo(p(lt, c.at, c.at + 0.6)), dir = i ? 1 : -1; c.h.style.opacity = k; c.h.style.transform = R ? `translateY(${(1 - k) * dir * 4 * U}px)` : `translateX(${(1 - k) * dir * 6 * U}px)`;
          c.ps.forEach((d, j) => { const kk = eo(p(lt, 1.3 + j * 0.4 + i * 0.12, 1.3 + j * 0.4 + i * 0.12 + 0.45)); d.style.opacity = kk; d.style.transform = `translateY(${(1 - kk) * 1.6 * U}px)`; });
        });
      },
      dotAt(lt) { const k = eio(p(lt, 0.15, 0.75)); return { x: lerp(this.dotIn.x, this.dotOut.x, k), y: lerp(this.dotIn.y, this.dotOut.y, k) }; },
    };
  };

  // 8) 흔한 실수 → 바로잡기: 틀린 말에 줄이 그어지고 ✕, 되감기, 바른 말과 ✓
  T.fix = (sc, root) => {
    const col = el('div', 'abs qa', root); place(col, S.x, S.y, S.w, S.h);
    css(col, { display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: R ? 'flex-start' : 'center', textAlign: R ? 'left' : 'center', gap: px(3 * U) });
    const lab = el('div', 'kicker', col, sc.label || '흔한 실수'); lab.style.color = BAD;
    const stack = el('div', null, col); css(stack, { position: 'relative', fontWeight: 900, fontSize: px((sc.size || (R ? 6.6 : 6.4)) * U), lineHeight: 1.25 });
    const wrong = el('div', null, stack); rich(wrong, sc.wrong);
    const right = el('div', null, stack); rich(right, sc.right); css(right, { position: 'absolute', left: R ? 0 : '50%', top: 0, whiteSpace: 'nowrap', transform: R ? 'none' : 'translateX(-50%)' });
    const why = sc.why ? el('div', 'pen', col, sc.why) : null; if (why) css(why, { fontSize: px((R ? 5.4 : 4.8) * U), maxWidth: px(S.w) });
    TEXTS.push(lab.textContent, '✕ ' + plain(sc.wrong), '✓ ' + plain(sc.right)); if (sc.why) TEXTS.push(sc.why);
    const svg = sv('svg', { width: W, height: H }, root); css(svg, { position: 'absolute', left: 0, top: 0, pointerEvents: 'none' });
    const strike = sv('path', { class: 'curve', stroke: BAD, 'stroke-width': 9 }, svg);
    const x1 = sv('path', { class: 'curve', stroke: BAD, 'stroke-width': 12 }, svg), x2 = sv('path', { class: 'curve', stroke: BAD, 'stroke-width': 12 }, svg);
    const chk = sv('path', { class: 'curve', stroke: ACC, 'stroke-width': 12 }, svg);
    const tS = 1.3, tX = 1.75, tR = 2.6, tOk = 3.25, tW = 3.9;
    const dur = sc.dur || (why ? tW + 2.8 : tOk + 2.0);
    let wb, rb, sx;
    return {
      dur, hits: [[0.2, 'rise'], [tS, 'strike'], [tX, 'wrong'], [tR, 'rewind'], [tOk, 'right'], ...(why ? [[tW, 'write']] : [])],
      measure() {
        wb = box(wrong); rb = box(right); sx = { x: wb.x + wb.w + 4 * U, y: wb.y + wb.h * .5 }; const s = 2.4 * U;
        strike.setAttribute('d', `M${wb.x - U} ${wb.y + wb.h * .55}L${wb.x + wb.w + U} ${wb.y + wb.h * .5}`);
        x1.setAttribute('d', `M${sx.x - s} ${sx.y - s}L${sx.x + s} ${sx.y + s}`); x2.setAttribute('d', `M${sx.x + s} ${sx.y - s}L${sx.x - s} ${sx.y + s}`);
        const c = { x: rb.x + rb.w + 4 * U, y: rb.y + rb.h * .5 }; chk.setAttribute('d', `M${c.x - s} ${c.y}L${c.x - s * .3} ${c.y + s * .8}L${c.x + s * 1.2} ${c.y - s}`);
        this.chk = { x: c.x + s * 1.2, y: c.y - s };
        this.dotIn = { x: wb.x - 3 * U, y: wb.y + wb.h * .55 }; this.dotOut = why ? (b => ({ x: b.x + b.w + 2 * U, y: b.y + b.h * .55 }))(box(why)) : this.chk;
        [strike, x1, x2, chk].forEach(q => { const l = q.getTotalLength(); q.dataset.l = l; q.setAttribute('stroke-dasharray', `${l} ${l}`); });
      },
      update(lt) {
        lab.style.opacity = eo(p(lt, 0.1, 0.5));
        const fixed = lt >= tR + 0.3; lab.textContent = fixed ? (sc.label2 || '바르게') : (sc.label || '흔한 실수'); lab.style.color = fixed ? ACC : BAD;
        const kw = eo(p(lt, 0.2, 0.75)), kr = eio(p(lt, tR, tR + 0.55));
        css(wrong, { opacity: kw * (1 - kr), transform: `translateY(${(1 - kw) * 2 * U}px) translateX(${-kr * 14 * U}px) skewX(${kr * 18}deg)`, filter: `blur(${kr * 14}px)` });
        const ko = eo(p(lt, tOk - 0.25, tOk + 0.35)); right.style.opacity = ko; right.style.filter = `blur(${(1 - ko) * 10}px)`;
        const dash = (q, k) => q.setAttribute('stroke-dashoffset', q.dataset.l * (1 - k));
        dash(strike, eio(p(lt, tS, tS + 0.4))); strike.style.opacity = 1 - kr;
        const kx = p(lt, tX, tX + 0.3); dash(x1, eo(kx)); dash(x2, eo(p(lt, tX + 0.12, tX + 0.42))); x1.style.opacity = x2.style.opacity = 1 - kr;
        const sh = lt > tX && lt < tX + 0.5 ? Math.sin(lt * 90) * (1 - p(lt, tX, tX + 0.5)) * 1.2 * U : 0; stack.style.transform = `translateX(${sh}px)`;
        dash(chk, eio(p(lt, tOk + 0.2, tOk + 0.7)));
        if (why) wipe(why, p(lt, tW, tW + 1.3));
      },
      dotAt(lt) {
        let pt = this.dotIn;
        if (lt >= tS) pt = { x: lerp(wb.x - U, wb.x + wb.w + U, eio(p(lt, tS, tS + 0.4))), y: wb.y + wb.h * .52 };
        if (lt >= tR) pt = arc(pt, { x: rb.x - 3 * U, y: rb.y + rb.h * .5 }, eio(p(lt, tR, tOk)), 10 * U);
        if (lt >= tOk + 0.2) pt = arc({ x: rb.x - 3 * U, y: rb.y + rb.h * .5 }, this.chk, eio(p(lt, tOk + 0.2, tOk + 0.7)));
        if (why && lt >= tW) pt = arc(this.chk, this.dotOut, eio(p(lt, tW, tW + 1.3)));
        return pt;
      },
    };
  };

  // 9) 과정 · 단계: 동그라미가 차례로 채워지며 선으로 이어진다
  T.process = (sc, root) => {
    const st = sc.steps, n = st.length;
    let tt = null; if (sc.title) { tt = el('div', 'abs kicker qa', root, sc.title); place(tt, S.x, S.y); TEXTS.push(sc.title); }
    const A = R ? { x: S.x + 4 * U, y: S.y + 10 * U, h: S.h - 14 * U } : { x: S.x + 4 * U, y: S.y + S.h * .42, w: S.w - 8 * U };
    const posi = i => R ? { x: A.x, y: A.y + A.h * (n === 1 ? 0 : i / (n - 1)) } : { x: A.x + A.w * (n === 1 ? .5 : i / (n - 1)), y: A.y };
    const line = el('div', 'abs', root); css(line, { background: 'var(--line)' }); const fill = el('div', 'abs', root); css(fill, { background: ACC, transformOrigin: R ? '50% 0' : '0 50%' });
    if (R) { place(line, A.x - 2, A.y, 4, A.h); place(fill, A.x - 2, A.y, 4, A.h); } else { place(line, A.x, A.y - 2, A.w, 4); place(fill, A.x, A.y - 2, A.w, 4); }
    const per = sc.per || 1.4, s0 = 0.6;
    const items = st.map((s, i) => {
      const q = posi(i);
      const c = el('div', 'abs', root); css(c, { width: px(6 * U), height: px(6 * U), borderRadius: '50%', border: `${.5 * U}px solid var(--ink)`, background: 'var(--bg)', display: 'grid', placeItems: 'center', fontFamily: "'ANTON','KR'", fontSize: px(2.8 * U) }); place(c, q.x - 3 * U, q.y - 3 * U); c.textContent = i + 1;
      const t = el('div', 'abs qa', root); rich(t, s); const tw = R ? S.w - 12 * U : Math.min(A.w / Math.max(1, n - 1) * .95, 38 * U);
      css(t, { width: px(tw), fontSize: px((R ? 4 : 3.1) * U), lineHeight: 1.4, textAlign: R ? 'left' : 'center' });
      if (R) place(t, q.x + 6 * U, q.y - 2.4 * U); else place(t, q.x - tw / 2, q.y + 5 * U);
      TEXTS.push(`${i + 1}. ${plain(s)}`);
      return { q, c, t, at: s0 + i * per };
    });
    const dur = sc.dur || s0 + (n - 1) * per + 2.4;
    return {
      dur, hits: [...(tt ? [[0.1, 'rise']] : []), ...items.map(it => [it.at, 'hop'])],
      measure() { this.dotIn = items[0].q; this.dotOut = items.at(-1).q; },
      update(lt) {
        if (tt) tt.style.opacity = eo(p(lt, 0.1, 0.5));
        const k = n === 1 ? 1 : p(lt, s0, s0 + (n - 1) * per); fill.style.transform = R ? `scaleY(${k})` : `scaleX(${k})`;
        items.forEach(it => { const kk = back(p(lt, it.at, it.at + 0.4)); const on = lt >= it.at; it.c.style.transform = `scale(${on ? Math.max(.6, kk) : .6})`; it.c.style.background = on ? ACC : 'var(--bg)'; it.c.style.color = on ? '#111' : 'var(--ink)'; it.c.style.borderColor = on ? ACC : 'var(--ink)'; it.c.style.opacity = eo(p(lt, 0.1, 0.5)); const kt = eo(p(lt, it.at + 0.1, it.at + 0.6)); it.t.style.opacity = kt; it.t.style.transform = `translateY(${(1 - kt) * 2 * U}px)`; });
      },
      dotAt(lt) { let pt = items[0].q; items.forEach((it, i) => { if (i && lt >= it.at - per * .6) pt = arc(items[i - 1].q, it.q, eio(p(lt, it.at - per * .6, it.at)), 5 * U); }); return pt; },
    };
  };

  // 10) 마무리: 손글씨 한 줄, 점이 마침표가 되어 두 번 뛴다
  T.end = (sc, root) => {
    const col = el('div', 'abs qa', root); place(col, S.x, S.y, S.w, S.h);
    css(col, { display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: R ? 'flex-start' : 'center', textAlign: R ? 'left' : 'center', gap: px(3 * U) });
    const tx = el('div', 'pen', col, sc.text); css(tx, { fontSize: px((sc.size || (R ? 10 : 9.5)) * U), color: 'var(--ink)' });
    const sub = sc.sub ? el('div', 'kicker', col, sc.sub) : null; if (sub) css(sub, { color: 'var(--dim)' });
    TEXTS.push(sc.text); if (sc.sub) TEXTS.push(sc.sub);
    const dur = sc.dur || 4.8;
    let b;
    return {
      dur, hits: [[0.2, 'write'], [2.0, 'end']],
      measure() { b = box(tx); this.dotIn = { x: b.x - 2 * U, y: b.y + b.h * .6 }; this.dotOut = { x: b.x + b.w + 2.2 * U, y: b.y + b.h * .74 }; },
      update(lt) { wipe(tx, eio(p(lt, 0.2, 1.8))); if (sub) { sub.style.opacity = eo(p(lt, 2.2, 2.8)); } },
      dotAt(lt) {
        const k = eio(p(lt, 0.2, 1.8)); let pt = { x: lerp(this.dotIn.x, b.x + b.w, k), y: this.dotIn.y };
        if (lt >= 1.8) pt = arc(pt, this.dotOut, eio(p(lt, 1.8, 2.05)), 3 * U);
        const beat = lt > 2.05 ? Math.max(0, Math.sin((lt - 2.05) * Math.PI * 2 / 0.9)) * (lt < 3.9 ? 0.35 : 0) : 0;
        return { ...pt, s: 1 + beat };
      },
    };
  };

  // ================= 짓기 =================
  L.scenes.forEach((sc, i) => {
    const root = el('div', 'scene', stage);
    if (!T[sc.type]) throw new Error(`모르는 장면 틀: ${sc.type}`);
    const s = T[sc.type](sc, root); s.root = root; s.sc = sc; s.i = i; scenes.push(s);
    if (sc.minDur) s.dur = Math.max(s.dur, sc.minDur);   // 나레이션이 있으면 말 길이만큼은 머문다
  });
  let acc = 0; scenes.forEach(s => { s.t0 = acc; acc += s.dur; s.hits.forEach(([t, k]) => HITS.push({ t: +(s.t0 + t).toFixed(3), kind: k, scene: s.i + 1 })); });
  const DUR = acc;
  HITS.sort((a, b) => a.t - b.t);

  // 장면 사이 점 옮기기 (아크 · 스쿼시 앤 스트레치)
  const TA = 0.5, TB = 0.32;
  const dotPos = t => {
    for (let i = 0; i < scenes.length - 1; i++) { const T0 = scenes[i + 1].t0; if (t >= T0 - TA && t < T0 + TB) { const a = scenes[i].dotOut, b = scenes[i + 1].dotIn; return { ...arc(a, b, eio(p(t, T0 - TA, T0 + TB))), s: 1 }; } }
    const s = scenes.find(s => t >= s.t0 && t < s.t0 + s.dur) || scenes.at(-1);
    const lt = t - s.t0, q = s.dotAt(clamp(lt, 0, s.dur));
    return { x: q.x, y: q.y, s: q.s != null ? q.s : 1 };
  };
  const seek = t => {
    t = clamp(t, 0, DUR - 1e-4);
    for (const s of scenes) {
      const lt = t - s.t0, on = lt >= -0.0001 && lt < s.dur;
      s.root.style.display = on ? 'block' : 'none';
      if (!on) continue;
      s.update(lt);
      const isLast = s === scenes.at(-1);
      const kin = eo(p(lt, 0, 0.22)), kout = isLast ? 0 : eio(p(lt, s.dur - 0.42, s.dur));
      s.root.style.opacity = kin * (1 - kout); s.root.style.transform = `translateY(${-kout * 2.4 * U}px)`; s.root.style.filter = kout > 0.01 ? `blur(${kout * 8}px)` : '';
      labTR.innerHTML = `<b>${String(s.i + 1).padStart(2, '0')}</b> / ${String(scenes.length).padStart(2, '0')}`;
    }
    // 점
    const a = dotPos(t), b = dotPos(Math.max(0, t - 1 / 30));
    const vx = a.x - b.x, vy = a.y - b.y, v = Math.min(Math.hypot(vx, vy) / (6 * U), 1), ang = Math.atan2(vy, vx) * 180 / Math.PI;
    const endFade = 1 - p(t, DUR - 0.5, DUR);
    dot.style.transform = `translate(${a.x}px, ${a.y}px) rotate(${ang}deg) scale(${a.s * (1 + v * .7)}, ${a.s * (1 - v * .35)})`;
    dot.style.opacity = (t < 0.05 ? 0 : 1) * endFade;
    const mm = Math.floor(t / 60), ss = Math.floor(t % 60);
    labBR.textContent = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    prog.style.width = px(W * t / DUR);
    frame.style.opacity = eo(p(t, 0, 0.6)) * endFade;
    stage.style.setProperty('--fade', endFade);
    stage.querySelectorAll('.scene').forEach(sc => { if (sc.style.display === 'block' && t > DUR - 0.5) sc.style.opacity = String(+sc.style.opacity * endFade); });
  };

  // 오른쪽 아래 라벨 자리(글자 너비를 알아야 해서 READY 에서)
  const placeRight = (e, y) => place(e, S.x + S.w - e.offsetWidth, y);

  // 겹침 · 넘침 점검: 장면마다 다 나온 순간을 보고, 안전 영역을 넘거나 글 덩어리가 겹치면 알린다
  const QA = () => {
    const out = [];
    for (const s of scenes) {
      seek(s.t0 + s.dur - 0.5);
      const blocks = [...s.root.querySelectorAll('.qa')].map(e => ({ e, b: box(e) })).filter(o => o.b.w > 0);
      const lim = R ? S : { x: 2 * U, y: 7.5 * U, w: W - 4 * U, h: H - 15 * U };
      // 글 덩어리 안의 실제 글자 상자로 넘침을 본다
      s.root.querySelectorAll('.qa *').forEach(c => {
        if (c.children.length || !c.textContent.trim()) return; const r = box(c); if (!r.w) return;
        if (r.x < lim.x - 2 || r.y < lim.y - 2 || r.x + r.w > lim.x + lim.w + 2 || r.y + r.h > lim.y + lim.h + 2) out.push(`장면 ${s.i + 1}(${s.sc.type}): "${c.textContent.trim().slice(0, 20)}" 이(가) 안전 영역 밖`);
      });
      for (let i = 0; i < blocks.length; i++) for (let j = i + 1; j < blocks.length; j++) {
        const a = blocks[i].b, b = blocks[j].b, ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (ox > 4 && oy > 4 && (blocks[i].e.textContent.trim() && blocks[j].e.textContent.trim())) out.push(`장면 ${s.i + 1}(${s.sc.type}): 글 덩어리 두 개가 겹침 — "${blocks[i].e.textContent.trim().slice(0, 14)}" / "${blocks[j].e.textContent.trim().slice(0, 14)}"`);
      }
    }
    return [...new Set(out)];
  };

  const fontLoads = ['500 40px KR', '900 40px KR', '40px PEN', '40px ANTON', '40px KaTeX_Main', 'italic 40px KaTeX_Math', '40px KaTeX_Size1', '40px KaTeX_Size2', 'bold 40px KaTeX_Main', '40px KaTeX_AMS'];
  window.READY = (async () => {
    const sample = TEXTS.join(' ') + '0123456789';
    await Promise.all(fontLoads.map(f => document.fonts.load(f, sample).catch(() => null)));
    await document.fonts.ready;
    stageRect = stage.getBoundingClientRect();
    for (const s of scenes) { s.root.style.display = 'block'; s.measure(); s.root.style.display = 'none'; }
    placeRight(labTR, top); placeRight(labBR, bot);
    seek(0);
  })();
  Object.assign(window, { seek, DUR, HITS, QA, TEXTS, SCENES: scenes.map(s => ({ n: s.i + 1, type: s.sc.type, t0: +s.t0.toFixed(3), dur: +s.dur.toFixed(3) })) });

  // ---------- 브라우저로 열었을 때: 미리보기 재생 ----------
  if (!window.__RENDER_MODE__) window.READY.then(() => {
    const fit = () => { const k = Math.min(innerWidth / W, innerHeight / H); stage.style.transform = `scale(${k})`; css(document.body, { width: '100vw', height: '100vh', display: 'grid', placeItems: 'center' }); css(stage, { marginRight: px(W * k - W), marginBottom: px(H * k - H) }); };
    fit(); addEventListener('resize', fit);
    const au = new Audio('build/music.wav'); let playing = false, t = 0, last = 0;
    const loop = now => { if (playing) { t += (now - last) / 1000; if (t >= DUR) { t = 0; au.currentTime = 0; } } last = now; seek(t); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    const toggle = () => { playing = !playing; if (playing) { au.currentTime = t; au.play().catch(() => {}); } else au.pause(); };
    addEventListener('click', toggle);
    addEventListener('keydown', e => { if (e.code === 'Space') toggle(); if (e.code === 'ArrowRight') { t = Math.min(DUR, t + 2); au.currentTime = t; } if (e.code === 'ArrowLeft') { t = Math.max(0, t - 2); au.currentTime = t; } });
  });
})();
