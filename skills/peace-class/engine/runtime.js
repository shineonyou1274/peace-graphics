/* peace-class runtime — lesson.json 한 장을 시간으로 움직이는 수업 모션 그래픽으로 만든다.
 * PeaceClass.mount(무대 div, lesson) → { READY, seek(t), DUR, HITS, QA(), TEXTS, SCENES, audio() }
 * 원칙: 같은 t 에는 언제나 같은 화면(렌더러가 프레임마다 seek 한다). 화면의 글자 · 값은 lesson.json 에서만 온다.
 * 소리도 이 파일이 브라우저 안에서 만든다(Shiny Peace Studio 의 videointro 음악 엔진 설계를 웹 오디오로 옮김).
 */
(() => {
  // 스타일: 선생님이 눈으로 보고 고른다. light = 밝은 바탕(형광 칠한 글자를 흰색으로)
  const SUBJ = { '수학': '#d7ff00', '과학': '#3ee0ff', '국어': '#ff6b9a', '영어': '#ffb21e', '사회': '#9b7bff' };
  const SUBJ_DEEP = { '수학': '#3a7d00', '과학': '#0077b6', '국어': '#d6336c', '영어': '#d97706', '사회': '#6741d9' };
  // 스타일마다 글꼴 · 강조 모양 · 점 · 장면 넘김 · 장식이 다르다(색만 바꾸지 않는다)
  const STYLES = [
    { id: 'dark', name: '형광', desc: '검정 · 형광 막대 · 빛나는 점 · 박자 쾅', acc: s => SUBJ[s] || '#d7ff00', tr: 'rise', beat: true },
    { id: 'light', name: '신문', desc: '명조 제목 · 빨간 밑줄 · 도장 쾅', light: true, acc: () => '#c8102e', tr: 'page', stamp: true },
    { id: 'board', name: '칠판', desc: '굵은 분필 글씨 · 분필 결 · 빗금 칠 · 지우개 자국', acc: () => '#ffe066', tr: 'erase' },
    { id: 'note', name: '공책', desc: '둥근 제목 · 형광 마커 · 포스트잇', light: true, acc: () => '#2f5bd3', tr: 'flip' },
    { id: 'pop', name: '팝', desc: '노랑 · 굵은 테두리 · 통통 튀는 움직임 · 박자 쾅', light: true, acc: () => '#ff3d8b', tr: 'pop', bounce: true, beat: true },
    { id: 'grid', name: '모눈', desc: '모눈종이 · 상자 강조 · 수학 · 과학 그래프', light: true, acc: s => SUBJ_DEEP[s] || '#0077b6', tr: 'fade' },
    { id: 'night', name: '청사진', desc: '설계도 · 외곽선 제목 · 점선 상자 · 십자 점', acc: () => '#ffd166', tr: 'wipe' },
    { id: 'ink', name: '먹', desc: '한지 · 붓글씨 · 먹 번짐 · 붉은 낙관', light: true, acc: () => '#b8322a', tr: 'ink', seal: true },
    { id: 'craft', name: '종이 공작', desc: '크라프트지 · 오린 색종이 · 초당 12장 뚝뚝', light: true, acc: () => '#e63946', tr: 'paper', steps: 12 },
    { id: 'pixel', name: '픽셀', desc: '도트 글꼴 · 8비트 소리 · 블록 넘김', acc: () => '#ffec27', tr: 'pixel', steps: 15, chip: true, beat: true },
    { id: 'cinema', name: '예고편', desc: '검은 띠 · 빛 번짐 · 천천히 다가가다 쾅', acc: () => '#f4c76b', tr: 'cinema', beat: true },
  ];
  const styleOf = L => STYLES.find(s => s.id === (L.style || L.theme)) || STYLES[0];

  // 그림 자료: 스타일마다 다르게 그린 그림(사진 대신). 판 650×540 · 사진과 같은 자리(%)를 짚을 수 있게 구도를 맞춘다
  const ART = {
    // 잎: 갈래 6개(단풍 · 플라타너스형) · 톱니 가장자리 · 굵은 잎맥 → 곁잎맥
    leaf() {
      const B = [220, 335], deg = Math.PI / 180;
      const lobes = [[218, 150], [262, 250], [300, 372], [338, 440], [372, 378], [410, 240]];   // [방향°, 길이]
      const rOf = a => {   // a: 165~490°
        const t = Math.max(0, Math.min(1, (a - 168) / 30, (490 - a) / 34));
        let r = 30 + 85 * t;
        lobes.forEach(([c, L]) => { const d = Math.abs(a - c) / 34; if (d < 1) r = Math.max(r, L * Math.pow(1 - d, 0.62)); });
        return r;
      };
      const pt = (a, r, o = B) => [o[0] + r * Math.cos(a * deg), o[1] + r * Math.sin(a * deg)];
      const f = v => v.toFixed(1);
      let out = '';
      for (let a = 166; a <= 490; a += 0.5) { const tooth = 1 + 0.045 * ((a % 6) / 6); const [x, y] = pt(a, rOf(a) * (rOf(a) > 120 ? tooth : 1)); out += (out ? 'L' : 'M') + f(x) + ' ' + f(y); }
      out += 'Z';
      const veins = [], small = [];
      lobes.forEach(([c, L]) => {
        const e = pt(c, L * 0.94), m = pt(c - 3, L * 0.5);
        veins.push(`M${B[0]} ${B[1]}Q${f(m[0])} ${f(m[1])} ${f(e[0])} ${f(e[1])}`);
        [.28, .46, .64, .8].forEach(s => {
          if (L * s < 50) return;
          const o = pt(c - 3 * (1 - s), L * s);
          [-1, 1].forEach(side => {
            const bd = c + side * 42; let len = (L * (1 - s)) * 0.62 + 18;
            for (let k = 0; k < 12; k++) { const q = pt(bd, len, o), dx = q[0] - B[0], dy = q[1] - B[1]; let ang = Math.atan2(dy, dx) / deg; while (ang < 165) ang += 360; while (ang > 525) ang -= 360; if (Math.hypot(dx, dy) < rOf(ang) * 0.9) break; len *= 0.85; }
            const q = pt(bd, len, o), cq = pt(bd - side * 12, len * 0.5, o);
            small.push(`M${f(o[0])} ${f(o[1])}Q${f(cq[0])} ${f(cq[1])} ${f(q[0])} ${f(q[1])}`);
          });
        });
      });
      const stem = `M${B[0]} ${B[1]}Q120 380 12 462`;
      return { w: 650, h: 540, out, veins: veins.join(''), small: small.join(''), stem };
    },
  };
  // 스타일에 맞춰 칠하기. 반환: SVG 글(draw-on 은 class dw · 채움은 class fl)
  const artSVG = (name, sid, acc) => {
    const g = ART[name](); const V = `viewBox="0 0 ${g.w} ${g.h}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"`;
    const P = (d, a) => `<path d="${d}" pathLength="1" ${a}/>`;
    const lines = (st, w1, w2, w3, extra = '') => P(g.stem, `class="dw" fill="none" stroke="${st}" stroke-width="${w1 * 1.6}" stroke-linecap="round" ${extra}`) + P(g.out, `class="dw" fill="none" stroke="${st}" stroke-width="${w1}" stroke-linejoin="round" ${extra}`)
      + P(g.veins, `class="dw" fill="none" stroke="${st}" stroke-width="${w2}" stroke-linecap="round" ${extra}`) + P(g.small, `class="dw" fill="none" stroke="${st}" stroke-width="${w3}" stroke-linecap="round" opacity=".8" ${extra}`);
    const S = {
      dark: () => `<defs><filter id="ag-glow" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`
        + `<path class="fl" d="${g.out}" fill="${acc}" opacity=".1"/><g filter="url(#ag-glow)">${lines(acc, 4, 3, 1.6)}</g>`,
      light: () => `<defs><pattern id="ag-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="2" height="7" fill="#1a1a1a"/></pattern></defs>`
        + `<path class="fl" d="${g.out}" fill="url(#ag-hatch)" opacity=".28"/>${lines('#141414', 3.5, 2.6, 1.2)}`,
      board: () => `<defs><pattern id="ag-chalk" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(-28)"><rect width="5" height="16" fill="#9be59a"/></pattern></defs>`
        + `<g filter="url(#pc-chalk)"><path class="fl" d="${g.out}" fill="url(#ag-chalk)" opacity=".55"/>${lines('#f4f3ea', 7, 5, 2.6)}</g>`,
      note: () => `<path class="fl" d="${g.out}" fill="#a8ef6a" opacity=".6" transform="translate(9 7)"/>${lines('#2f5bd3', 3, 2.4, 1.3)}`,
      pop: () => `<path class="fl" d="${g.out}" fill="#111" transform="translate(14 14)"/><path class="fl" d="${g.out}" fill="#2ee67a"/>${lines('#111', 9, 6, 3)}`,
      grid: () => `<path class="fl" d="${g.out}" fill="${acc}" opacity=".12"/>${lines(acc, 3.5, 2.6, 1.3)}`
        + `<g class="fl" fill="none" stroke="${acc}" stroke-width="1.6" stroke-dasharray="6 6"><line x1="220" y1="335" x2="640" y2="165"/><circle cx="220" cy="335" r="22"/></g>`,
      night: () => `<g class="fl" fill="none" stroke="#e8f1ff" stroke-width="1.4" stroke-dasharray="8 7" opacity=".6"><circle cx="220" cy="335" r="160"/><circle cx="220" cy="335" r="360"/><line x1="0" y1="335" x2="650" y2="335"/><line x1="220" y1="0" x2="220" y2="540"/></g>`
        + lines('#e8f1ff', 3, 2.4, 1.2),
      ink: () => `<defs><radialGradient id="ag-wash" cx="40%" cy="55%" r="65%"><stop offset="0" stop-color="#111" stop-opacity=".55"/><stop offset=".7" stop-color="#111" stop-opacity=".22"/><stop offset="1" stop-color="#111" stop-opacity=".08"/></radialGradient></defs>`
        + `<g filter="url(#pc-ink)"><path class="fl" d="${g.out}" fill="url(#ag-wash)"/>${lines('#141414', 6, 4.5, 2)}</g>`,
      craft: () => `<defs><filter id="ag-paper" x="-5%" y="-5%" width="115%" height="115%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="2" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -.9 .55" result="s"/><feComposite in="s" in2="SourceGraphic" operator="in" result="t"/><feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="t"/></feMerge></filter></defs>`
        + `<path class="fl" d="${g.out}" fill="#000" opacity=".22" transform="translate(10 12)"/><g class="fl" filter="url(#ag-paper)"><path d="${g.stem}" fill="none" stroke="#2f7d32" stroke-width="14" stroke-linecap="round"/><path d="${g.out}" fill="#43a047" stroke="#fff" stroke-width="5"/><path d="${g.veins}" fill="none" stroke="#c5e8a5" stroke-width="9" stroke-linecap="round"/><path d="${g.small}" fill="none" stroke="#9ed36d" stroke-width="4" stroke-linecap="round"/></g>`,
      pixel: () => `<path d="${g.stem}" fill="none" stroke="#008751" stroke-width="18" stroke-linecap="round"/><path d="${g.out}" fill="#00e436" stroke="#1d2b53" stroke-width="10"/><path d="${g.veins}" fill="none" stroke="#008751" stroke-width="10" stroke-linecap="round"/>`,
      cinema: () => `<defs><radialGradient id="ag-cine" cx="62%" cy="28%" r="80%"><stop offset="0" stop-color="#c9f27a"/><stop offset=".45" stop-color="#3c8d2f"/><stop offset="1" stop-color="#0a2a12"/></radialGradient><filter id="ag-rim"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`
        + `<path class="fl" d="${g.out}" fill="url(#ag-cine)"/><g opacity=".55">${lines('#eaffc2', 0, 2.4, 1.1)}</g><g filter="url(#ag-rim)">${P(g.out, `class="dw" fill="none" stroke="${acc}" stroke-width="3"`)}${P(g.stem, `class="dw" fill="none" stroke="${acc}" stroke-width="5" stroke-linecap="round"`)}</g>`,
    };
    return { w: g.w, h: g.h, svg: `<svg xmlns="http://www.w3.org/2000/svg" ${V}>${(S[sid] || S.dark)()}</svg>` };
  };
  const ARTS = { leaf: '잎' };

  function mount(stage, L, opt = {}) {
  const R = L.ratio === '9:16';
  const W = R ? 1080 : 1920, H = R ? 1920 : 1080, U = Math.min(W, H) / 100;
  // 안전 영역: 9:16 은 쇼츠 화면의 버튼 · 자막 자리를 비운다(위 300 · 아래 480 · 오른쪽 200 · 왼쪽 60)
  const S = R ? { x: 60, y: 300, w: 820, h: 1140 } : { x: 0.075 * W, y: 0.14 * H, w: 0.85 * W, h: 0.72 * H };
  // 장면마다 스타일을 따로 고를 수 있다(sc.style). 지금 보이는 장면의 스타일로 무대 전체(바탕 · 점 · 틀 · 장식)가 바뀐다
  const STY0 = styleOf(L), styleOfScene = sc => (sc && sc.style && STYLES.find(x => x.id === sc.style)) || STY0;
  const USED = new Set([STY0.id, ...L.scenes.map(sc => styleOfScene(sc).id)]);
  let STY = STY0, ACC = L.accent || STY0.acc(L.subject);
  const useStyle = sty => { STY = sty; ACC = L.accent || sty.acc(L.subject); };
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
  const box = e => { const sr = stage.getBoundingClientRect(), r = e.getBoundingClientRect(), k = sr.width / W || 1; return { x: (r.left - sr.left) / k, y: (r.top - sr.top) / k, w: r.width / k, h: r.height / k }; };
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
  const rise = (inner, k, dist = 105) => { const e = STY.bounce ? back(k) : eo(k); inner.style.transform = `translateY(${(1 - e) * dist}%)`; };
  const wipe = (e, k) => { e.style.clipPath = `inset(-20% ${((1 - k) * 100).toFixed(2)}% -20% -2%)`; };

  // ---------- 무대 ----------
  stage.innerHTML = ''; stage.className = `pc-stage theme-${STY.id}${STY.light ? ' pc-light' : ''}${R ? ' r916' : ''}`; stage.dataset.th = STY.id;
  css(stage, { width: px(W), height: px(H) });
  stage.style.setProperty('--acc', ACC); stage.style.setProperty('--bad', BAD); stage.style.setProperty('--u', px(U));
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
  // 스타일 장식: 귀퉁이 십자(청사진) · 분필 질감(칠판)
  ['tl', 'tr', 'bl', 'br'].forEach(k => { const c = el('i', 'cm cm-' + k, frame); place(c, k[1] === 'l' ? S.x - 2.2 * U : S.x + S.w + .2 * U, k[0] === 't' ? top + 5.2 * U : bot - 4.6 * U); });
  if (USED.has('board')) {
    // 분필 글씨: 결 사이로 칠판이 비치고(구멍), 획 가장자리가 살짝 떨린다
    stage.insertAdjacentHTML('beforeend', '<svg width="0" height="0" style="position:absolute"><filter id="pc-chalk" x="-4%" y="-12%" width="108%" height="124%">'
      + '<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="4" result="n"/>'
      + '<feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -2.6 0 0 0 2.05" result="holes"/>'
      + '<feComposite in="SourceGraphic" in2="holes" operator="in" result="t"/>'
      + '<feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="1" seed="9" result="w"/>'
      + '<feDisplacementMap in="t" in2="w" scale="3.2" xChannelSelector="R" yChannelSelector="G"/></filter></svg>');
    // 칠판 바탕: 분필 가루 · 지우개 자국 · 지워진 옛 글씨 자국 (늘 같은 자리 · 무작위 없음)
    const smear = [[.18, .28, .34, .10, -8], [.62, .2, .42, .12, 6], [.34, .72, .5, .13, -4], [.8, .78, .3, .09, 10], [.5, .48, .62, .16, 2]]
      .map(([x, y, w, h, r]) => `<ellipse cx="${x * W}" cy="${y * H}" rx="${w * W / 2}" ry="${h * H / 2}" transform="rotate(${r} ${x * W} ${y * H})" fill="#fff" opacity=".045" filter="url(#pc-blur)"/>`).join('');
    const bg = el('div', 'chalkbg', null); bg.dataset.th = 'board'; stage.insertBefore(bg, stage.firstChild);
    bg.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs><filter id="pc-blur"><feGaussianBlur stdDeviation="${3 * U}"/></filter>`
      + `<filter id="pc-dust" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="3"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 -1.9 1.04"/></filter></defs>`
      + `<rect width="${W}" height="${H}" filter="url(#pc-dust)" opacity=".3"/>${smear}`
      + `<g stroke="#fff" stroke-width="${.9 * U}" stroke-linecap="round" fill="none" opacity=".035" filter="url(#pc-blur)"><path d="M${.08 * W} ${.9 * H} q ${.1 * W} ${-.05 * H} ${.22 * W} ${-.01 * H}"/><path d="M${.7 * W} ${.12 * H} q ${.08 * W} ${.04 * H} ${.2 * W} 0"/></g></svg>`;
  }
  if (USED.has('ink')) {
    // 먹: 획 가장자리가 한지에 번진다 · 한지 섬유
    stage.insertAdjacentHTML('beforeend', '<svg width="0" height="0" style="position:absolute"><filter id="pc-ink" x="-5%" y="-10%" width="110%" height="120%">'
      + '<feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="5" result="w"/><feDisplacementMap in="SourceGraphic" in2="w" scale="4" xChannelSelector="R" yChannelSelector="G" result="d"/>'
      + '<feGaussianBlur in="d" stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="d"/></feMerge></filter></svg>');
    const bg = el('div', 'inkbg', null); bg.dataset.th = 'ink'; stage.insertBefore(bg, stage.firstChild);
    bg.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><filter id="pc-fiber" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.006 0.09" numOctaves="3" seed="11"/><feColorMatrix type="matrix" values="0 0 0 0 .55  0 0 0 0 .48  0 0 0 0 .38  0 0 0 -1.6 1.0"/></filter><rect width="${W}" height="${H}" filter="url(#pc-fiber)" opacity=".22"/>`
      + `<filter id="pc-wash"><feGaussianBlur stdDeviation="${6 * U}"/></filter><ellipse cx="${.86 * W}" cy="${.84 * H}" rx="${.22 * W}" ry="${.12 * H}" fill="#000" opacity=".05" filter="url(#pc-wash)"/></svg>`;
  }
  // 픽셀 그림: 글자 지도(한 글자 = 한 칸)를 SVG 네모로
  const SPR = {
    coin: ['..YYYY..', '.YyyyyY.', 'YyYYYYyY', 'YyYyyYyY', 'YyYyyYyY', 'YyYYYYyY', '.YyyyyY.', '..YYYY..'],
    star: ['...Y...', '...Y...', '...W...', 'YYWWWYY', '...W...', '...Y...', '...Y...'],
    heart: ['.RR.RR.', 'RRRRRRR', 'RRRRRRR', '.RRRRR.', '..RRR..', '...R...'],
    cloud: ['...WWW......', '..WWWWW.WW..', '.WWWWWWWWWW.', 'WWWWWWWWWWWW', '.wwwwwwwwww.'],
    kid: ['..HHHH..', '.HHHHHH.', '.SSSSSS.', '.SKSSKS.', '..SSSS..', '.BBBBBB.', 'S.BBBB.S', '..L..L..'],
  };
  const PAL = { Y: '#ffec27', y: '#ffa300', R: '#ff004d', W: '#fff1e8', w: '#c2c3c7', H: '#5f3a1d', S: '#ffccaa', K: '#1d2b53', B: '#29adff', L: '#1d2b53' };
  const sprite = (name, cell) => { const m = SPR[name], h = m.length, w = m[0].length; let r = ''; m.forEach((row, y) => { for (let x = 0; x < w;) { const c = row[x]; if (c === '.') { x++; continue; } let n = 1; while (row[x + n] === c) n++; r += `<rect x="${x * cell}" y="${y * cell}" width="${n * cell}" height="${cell}" fill="${PAL[c]}"/>`; x += n; } }); return `<svg width="${w * cell}" height="${h * cell}" shape-rendering="crispEdges">${r}</svg>`; };
  let pix = null;
  if (USED.has('pixel')) {
    const bg = el('div', 'pixbg', null); bg.dataset.th = 'pixel'; stage.insertBefore(bg, stage.firstChild);
    const c = Math.round(U * 0.9);
    const clouds = [[.08, .2, 1], [.66, .12, 1.4], [.4, .78, .8]].map(([x, y, k]) => { const e = el('div', 'abs spr', bg); e.innerHTML = sprite('cloud', Math.round(c * k)); e.style.opacity = .16; place(e, x * W, y * H); return { e, x: x * W, sp: 12 + k * 10 }; });
    const stars = [[.15, .1], [.3, .28], [.52, .08], [.86, .3], [.92, .62], [.06, .58], [.74, .86], [.22, .9]].map(([x, y], i) => { const e = el('div', 'abs spr', bg); e.innerHTML = sprite('star', Math.round(c * .5)); place(e, x * W, y * H); return { e, i }; });
    const kid = el('div', 'abs spr', stage); kid.innerHTML = sprite('kid', Math.round(c * .75)); kid.style.zIndex = 5; kid.dataset.th = 'pixel';
    pix = { clouds, stars, kid, y0: R ? S.y + S.h + 1.4 * U : H - 11.6 * U };
  }
  let leak = null;
  if (USED.has('cinema')) {
    // 예고편: 위아래 검은 띠 · 빛 번짐(시간에 따라 천천히 흐른다)
    leak = el('div', 'leak', stage); leak.dataset.th = 'cinema';
    const bh = R ? 9 * U : 6.5 * U; const bt = el('div', 'lbox', stage); place(bt, 0, 0, W, bh); const bb = el('div', 'lbox', stage); place(bb, 0, H - bh, W, bh); bt.dataset.th = bb.dataset.th = 'cinema';
  }
  const dot = el('div', 'dot', stage);
  const COIN = pix ? sprite('coin', Math.round(U * .42)) : '';
  // 무대를 한 스타일로: 바탕 · 점 · 틀 · 장식(그 스타일 것만 보인다)
  let curTheme = null;
  const applyTheme = sty => {
    useStyle(sty); if (curTheme === sty.id) return; curTheme = sty.id;
    stage.className = `pc-stage theme-${sty.id}${sty.light ? ' pc-light' : ''}${R ? ' r916' : ''}`; stage.style.setProperty('--acc', ACC);
    stage.querySelectorAll('[data-th]').forEach(e => { if (e !== stage) e.style.display = e.dataset.th === sty.id ? '' : 'none'; });
    dot.innerHTML = sty.id === 'pixel' ? COIN : '';
  };
  applyTheme(STY0);
  // 박자마다 쾅: 배경음 박자(분위기마다 빠르기)에 맞춰 장면이 살짝 튄다
  const BPM = { calm: 84, bright: 100, serious: 70 }[L.mood || 'calm'] || 84, BT = 60 / BPM;
  const beatOf = sty => L.beat === 'on' || (L.beat !== 'off' && !!sty.beat);
  // 진짜 도장: 나무 도장이 내려와 꾹 누르고 올라가면, 붉은 인주 자국이 남는다
  const mkStamp = (parent, text, cls = '') => {
    const w = el('div', 'stampwrap', parent), imp = el('div', 'stamp ' + cls, w, text), tool = el('div', 'stamper', w);
    return {
      w, imp,
      at(x, y) {
        place(w, x, y); const iw = imp.offsetWidth || 10 * U, ih = 15 * U, bw = iw * 1.08, kr = Math.min(bw * .32, 4.2 * U);
        tool.innerHTML = `<svg width="${bw}" height="${ih}" viewBox="0 0 ${bw} ${ih}"><defs><linearGradient id="wd" x1="0" x2="1"><stop offset="0" stop-color="#6b4423"/><stop offset=".45" stop-color="#a87445"/><stop offset="1" stop-color="#5a381c"/></linearGradient></defs>`
          + `<ellipse cx="${bw / 2}" cy="${kr * 1.05}" rx="${kr}" ry="${kr}" fill="url(#wd)"/><rect x="${bw / 2 - kr * .42}" y="${kr * 1.6}" width="${kr * .84}" height="${ih * .42}" fill="url(#wd)"/>`
          + `<rect x="0" y="${ih * .62}" width="${bw}" height="${ih * .3}" rx="${U * .6}" fill="url(#wd)"/><rect x="${bw * .02}" y="${ih * .92}" width="${bw * .96}" height="${ih * .08}" fill="${ACC}"/></svg>`;
        css(tool, { width: px(bw), height: px(ih), marginLeft: px(-bw / 2), bottom: px(imp.offsetHeight * .02) });
      },
      upd(lt, tc, rot = -9) {   // tc = 찍히는 순간
        const down = eio(p(lt, tc - 0.38, tc)), up = eio(p(lt, tc + 0.14, tc + 0.55)), sq = Math.sin(clamp(p(lt, tc - 0.03, tc + 0.14)) * Math.PI);
        tool.style.opacity = lt > tc - 0.38 && lt < tc + 0.55 ? 1 - up : 0;
        tool.style.transform = `translateY(${-(1 - down) * 18 * U - up * 16 * U}px) rotate(${rot * 0.3}deg) scaleY(${1 - 0.1 * sq})`;
        const ki = clamp(p(lt, tc, tc + 0.06)); imp.style.opacity = ki; imp.style.transform = `rotate(${rot}deg) scale(${1.06 - 0.06 * ki})`;
      },
    };
  };

  // ================= 장면 틀 =================
  const T = {};

  // 1) 제목: 점이 지나가며 제목을 밝힌다(마스크 리빌 · 빛 훑기), 손글씨 한 줄
  T.title = (sc, root) => {
    const col = el('div', 'abs qa c-title', root); place(col, S.x, S.y, S.w, S.h);
    css(col, { display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: R ? 'flex-start' : 'center', textAlign: R ? 'left' : 'center', gap: px(2.6 * U) });
    const kick = el('div', 'kicker', col, sc.kicker || [L.subject, L.unit].filter(Boolean).join(' · '));
    const ti = el('div', 'big', col); rich(ti, sc.title); css(ti, { fontSize: px((sc.size || (R ? 13 : 13.5)) * U) });
    const sub = sc.sub ? el('div', 'pen', col, sc.sub) : null; if (sub) css(sub, { fontSize: px(6.2 * U) });
    TEXTS.push(kick.textContent, plain(sc.title)); if (sc.sub) TEXTS.push(sc.sub);
    let b; const dur = sc.dur || (sc.sub ? 4.6 : 3.6) + (STY.seal ? 0.6 : 0);
    const seal = STY.seal ? mkStamp(root, (L.subject || '수업').slice(0, 2), 'seal') : null, tSeal = sub ? 2.8 : 1.8;
    return {
      dur, hits: [[0.1, 'pop'], [0.45, 'sweep'], ...(sub ? [[1.55, 'write']] : []), ...(seal ? [[tSeal, 'stamp']] : [])],
      measure() {
        b = box(ti); this.dotIn = { x: b.x - 2.5 * U, y: b.y + b.h * .52 }; this.dotOut = { x: b.x + b.w + 2.5 * U, y: b.y + b.h * .52 };
        if (seal) seal.at(Math.min(S.x + S.w - 8 * U, b.x + b.w + 5.5 * U), b.y + b.h - 8 * U);
      },
      update(lt) {
        kick.style.opacity = eo(p(lt, 0.1, 0.6)); kick.style.letterSpacing = `${lerp(.9, .38, eo(p(lt, 0.1, 0.9)))}em`;
        wipe(ti, eio(p(lt, 0.45, 1.45)));
        if (sub) wipe(sub, p(lt, 1.55, 2.55));
        if (seal) seal.upd(lt, tSeal, -5);
      },
      dotAt(lt) { const k = eio(p(lt, 0.45, 1.45)); return { x: lerp(this.dotIn.x, this.dotOut.x, k), y: this.dotIn.y, s: back(p(lt, 0.05, 0.4)) }; },
    };
  };

  // 2) 개념: 용어가 올라오고, 정의가 낱말씩, 핵심 낱말은 점이 형광펜으로 칠한다
  const rest = b => ({ x: b.x + b.w - 0.4 * U, y: b.y - 1.6 * U });   // 글자 위 빈 자리
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
      measure() { const tb = box(term.firstChild.firstChild); kb = keyEls.map(k => box(k)); this.dotIn = { x: tb.x + tb.w + 2.6 * U, y: tb.y + tb.h * .5 }; const lw = words.length ? box(words.at(-1)) : null; this.endPt = lw ? { x: lw.x + lw.w + 1.8 * U, y: lw.y + lw.h * .62 } : this.dotIn; this.dotOut = kb.length ? this.endPt : this.dotIn; },
      update(lt) {
        kick.style.opacity = eo(p(lt, 0.1, 0.5)); rise(tm.inner, p(lt, 0.25, 0.85));
        words.forEach((w, i) => { const k = eo(p(lt, w0 + i * ws, w0 + i * ws + 0.35)); w.style.opacity = k; w.style.transform = `translateY(${(1 - k) * .5}em)`; });
        keyEls.forEach((ke, j) => { const k = eio(p(lt, kt[j], kt[j] + 0.5)); ke.firstChild.style.transform = `scaleX(${k})`; ke.classList.toggle('on', k > .45); });
      },
      dotAt(lt) {
        let pt = this.dotIn;
        // 점이 형광펜이 되어 핵심 말을 긋고, 다 그으면 그 말 위로 살짝 올라가 앉는다(뒤 글자를 가리지 않게)
        for (let j = 0; j < kt.length; j++) {
          const b = kb[j], a = { x: b.x - 1.2 * U, y: b.y + b.h * .62 }, z = { x: b.x + b.w, y: a.y };
          if (lt < kt[j] - 0.3) break;
          if (lt < kt[j]) pt = arc(j ? rest(kb[j - 1]) : this.dotIn, a, eio(p(lt, kt[j] - 0.3, kt[j])));
          else if (lt < kt[j] + 0.5) pt = { x: lerp(a.x, z.x, eio(p(lt, kt[j], kt[j] + 0.5))), y: a.y };
          else pt = arc(z, j === kt.length - 1 ? this.endPt : rest(b), eio(p(lt, kt[j] + 0.5, kt[j] + 0.9)), 2 * U);
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
      // 앞에 붙은 빼기(-(x-2)**2 · -x**2)는 자바스크립트가 못 읽으니 -1* 로 바꿔 읽는다 · ^ 도 거듭제곱으로
      const src = String(f.f).replace(/\^/g, '**').replace(/(^|[(,=+\-*/]\s*)-(?=\s*[\w(.])/g, '$1-1*');
      const fn = new Function('x', `with (Math) { return (${src}); }`);
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
    const tt = el('div', 'abs qa', root); css(tt, { fontWeight: 900, fontSize: px((R ? 5.6 : 4.6) * U) }); place(tt, S.x, S.y, S.w - (sc.total ? 22 * U : 0)); rich(tt, sc.title || ''); TEXTS.push(plain(sc.title || ''));
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
    // 대시보드: 합계 카드가 숫자를 세고, 커서가 가장 큰 막대를 눌러 값을 띄운다
    const sum = items.reduce((a, i) => a + (+i[1] || 0), 0);
    let tot = null, totV = null;
    if (sc.total) { tot = el('div', 'abs qa kpi', root); place(tot, S.x + S.w - 20 * U, S.y, 20 * U); const tl = el('div', null, tot, '합계'); css(tl, { fontSize: px(1.8 * U), color: 'var(--dim)', letterSpacing: '.2em' }); totV = el('div', null, tot, '0'); css(totV, { fontFamily: "'ANTON','KR'", fontSize: px(5 * U), lineHeight: 1 }); TEXTS.push(`합계 ${sum}${sc.unit || ''}`); }
    let cur = null, ring = null, tip = null; const tC = tm + 0.9;
    if (sc.cursor) {
      cur = el('div', 'abs cursor', root); cur.innerHTML = `<svg width="${3.4 * U}" height="${4.6 * U}" viewBox="0 0 17 23"><path d="M1 1 L1 18 L5.5 14 L8.6 21 L11.6 19.6 L8.6 12.8 L14.5 12.8 Z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
      ring = el('div', 'abs ring', root); tip = el('div', 'abs tip', root, `${items[mi][0]} ${fmt(max, items[mi][1])}${sc.unit || ''}`);
    }
    const dur = sc.dur || (cur ? tC + 2.4 : tm + 2.2);
    return {
      dur, hits: [[0.2, 'rise'], [0.45, 'draw'], ...bars.map(b => [b.at, 'grow']), [tm, 'mark'], ...(cur ? [[tC, 'tick']] : [])],
      measure() { this.dotIn = { x: A.x, y: base }; this.dotOut = bars[mi].top; },
      update(lt) {
        tt.style.opacity = eo(p(lt, 0.2, 0.6)); line.style.transform = `scaleX(${eio(p(lt, 0.45, 1.0))})`;
        bars.forEach((b, i) => {
          const k = p(lt, b.at, b.at + 0.75); b.b.style.transform = `scaleY(${Math.max(0, back(k))})`; b.lb.style.opacity = eo(p(lt, b.at - 0.2, b.at + 0.3));
          b.val.textContent = fmt(b.v * eo(k), b.raw) + (sc.unit || ''); b.val.style.opacity = k > 0 ? 1 : 0; b.val.style.transform = `translateY(${(1 - back(k)) * b.h}px)`;
          const hk = eo(p(lt, tm, tm + 0.5)); b.b.style.background = i === mi ? `color-mix(in srgb, ${ACC} ${hk * 100}%, var(--ink))` : 'var(--ink)'; b.b.style.opacity = i === mi ? 1 : lerp(1, .35, hk); b.val.style.color = i === mi && hk > .5 ? ACC : 'var(--ink)';
        });
        if (src) src.style.opacity = eo(p(lt, tm, tm + 0.6));
        if (tot) { const k = clamp(p(lt, bars[0].at, bars.at(-1).at + 0.75)); totV.textContent = fmt(sum * eo(k), items[0][1]) + (sc.unit || ''); tot.style.opacity = eo(p(lt, 0.3, 0.8)); }
        if (cur) {
          const a = { x: S.x + S.w * .96, y: base + 3 * U }, b = { x: bars[mi].cx + U, y: base - bars[mi].h * .5 }, k = eio(p(lt, tm + 0.1, tC - 0.1)), q = arc(a, b, k, 3 * U);
          cur.style.opacity = eo(p(lt, tm, tm + 0.3)); place(cur, q.x, q.y); const press = p(lt, tC - 0.06, tC + 0.12); cur.style.transform = `scale(${1 - 0.18 * Math.sin(press * Math.PI)})`;
          const rk = p(lt, tC, tC + 0.6); place(ring, b.x - 3 * U, b.y - 3 * U, 6 * U, 6 * U); ring.style.opacity = rk > 0 && rk < 1 ? 1 - rk : 0; ring.style.transform = `scale(${0.3 + rk * 1.5})`;
          const tk = eo(p(lt, tC + 0.1, tC + 0.45)); place(tip, bars[mi].cx + bw / 2 + 2 * U, base - bars[mi].h * .5 - 6 * U); tip.style.opacity = tk; tip.style.transform = `translateX(${(1 - tk) * -U}px)`;
        }
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
      const c = el('div', 'abs qa c-cmp c-cmp' + i, root);
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
    const stp = STY.stamp || sc.stamp ? mkStamp(root, sc.stamp || '정답') : null, tSt = tOk + 0.6;
    let wb, rb, sx;
    return {
      dur, hits: [[0.2, 'rise'], [tS, 'strike'], [tX, 'wrong'], [tR, 'rewind'], [tOk, 'right'], ...(why ? [[tW, 'write']] : []), ...(stp ? [[tSt, 'stamp']] : [])],
      measure() {
        wb = box(wrong); rb = box(right); sx = { x: wb.x + wb.w + 4 * U, y: wb.y + wb.h * .5 }; const s = 2.4 * U;
        strike.setAttribute('d', `M${wb.x - U} ${wb.y + wb.h * .55}L${wb.x + wb.w + U} ${wb.y + wb.h * .5}`);
        x1.setAttribute('d', `M${sx.x - s} ${sx.y - s}L${sx.x + s} ${sx.y + s}`); x2.setAttribute('d', `M${sx.x + s} ${sx.y - s}L${sx.x - s} ${sx.y + s}`);
        const c = { x: rb.x + rb.w + 4 * U, y: rb.y + rb.h * .5 }; chk.setAttribute('d', `M${c.x - s} ${c.y}L${c.x - s * .3} ${c.y + s * .8}L${c.x + s * 1.2} ${c.y - s}`);
        this.chk = { x: c.x + s * 1.2, y: c.y - s };
        if (stp) { const sw = stp.imp.offsetWidth || 14 * U, sh = stp.imp.offsetHeight || 7 * U; let x = this.chk.x + 3 * U; if (x + sw > S.x + S.w) x = rb.x - sw - 3 * U; if (x < S.x) x = rb.x + rb.w - sw; stp.at(x, rb.y + rb.h / 2 - sh / 2 - (x === rb.x + rb.w - sw ? sh + U : 0)); }
        this.dotIn = { x: wb.x - 3 * U, y: wb.y + wb.h * .55 }; this.dotOut = why ? (b => ({ x: b.x + b.w + 2 * U, y: b.y + b.h * .55 }))(box(why)) : this.chk;
        [strike, x1, x2, chk].forEach(q => { const l = q.getTotalLength(); q.dataset.l = l; q.setAttribute('stroke-dasharray', `${l} ${l}`); });
      },
      update(lt) {
        lab.style.opacity = eo(p(lt, 0.1, 0.5));
        const fixed = lt >= tR + 0.3; lab.textContent = fixed ? (sc.label2 || '바르게') : (sc.label || '흔한 실수'); lab.style.color = fixed ? ACC : BAD;
        const kw = eo(p(lt, 0.2, 0.75)), kr = eio(p(lt, tR, tR + 0.55));
        css(wrong, { opacity: kw * (1 - kr), transform: `translateY(${(1 - kw) * 2 * U}px) translateX(${-kr * 14 * U}px) skewX(${kr * 18}deg)`, filter: `blur(${kr * 14}px)` });
        const ko = eo(p(lt, tOk - 0.25, tOk + 0.35)); right.style.opacity = ko; right.style.filter = `blur(${(1 - ko) * 10}px)`;
        if (stp) stp.upd(lt, tSt, -11);
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
    const col = el('div', 'abs qa c-end', root); place(col, S.x, S.y, S.w, S.h);
    css(col, { display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: R ? 'flex-start' : 'center', textAlign: R ? 'left' : 'center', gap: px(3 * U) });
    const tx = el('div', 'pen', col, sc.text); css(tx, { fontSize: px((sc.size || (R ? 10 : 9.5)) * U), color: 'var(--ink)' });
    const sub = sc.sub ? el('div', 'kicker', col, sc.sub) : null; if (sub) css(sub, { color: 'var(--dim)' });
    TEXTS.push(sc.text); if (sc.sub) TEXTS.push(sc.sub);
    const dur = sc.dur || 4.8;
    let b;
    return {
      dur, hits: [[0.2, 'write'], [2.0, 'end']],
      measure() { b = box(tx); this.dotIn = { x: b.x - 2 * U, y: b.y + b.h * .6 }; const dw = (dot && box(dot).w) || 0; this.dotOut = { x: b.x + b.w + Math.max(2.2 * U, dw * .75), y: b.y + b.h * .74 }; },
      update(lt) { wipe(tx, eio(p(lt, 0.2, 1.8))); if (sub) { sub.style.opacity = eo(p(lt, 2.2, 2.8)); } },
      dotAt(lt) {
        const k = eio(p(lt, 0.2, 1.8)); let pt = { x: lerp(this.dotIn.x, b.x + b.w, k), y: this.dotIn.y };
        if (lt >= 1.8) { const bb = box(tx), dw = box(dot).w || 0, o = { x: bb.x + bb.w + Math.max(2.2 * U, dw * .75), y: this.dotOut.y };   // 다가가기(예고편)로 글이 커져도 마침표 자리를 따라간다
          pt = arc(pt, o, eio(p(lt, 1.8, 2.05)), 3 * U); }
        const beat = lt > 2.05 ? Math.max(0, Math.sin((lt - 2.05) * Math.PI * 2 / 0.9)) * (lt < 3.9 ? 0.35 : 0) : 0;
        return { ...pt, s: 1 + beat };
      },
    };
  };

  // 사진: 사진이 열리고 천천히 다가가며, 점이 짚는 곳마다 이름표가 붙는다
  // sc.src(사진 · data URL 또는 경로) · sc.title(위 작은 글) · sc.caption(설명 · [[형광]]) · sc.pins[{x,y,label}](사진 위 % 자리)
  T.photo = (sc, root) => {
    const PIXEL = STY.id === 'pixel';
    const DRAW = sc.draw && ART[sc.draw] ? artSVG(sc.draw, STY.id, ACC) : null;   // 그림 자료(사진 대신 · 스타일에 맞춰 그림)
    if (!sc.src && !DRAW) throw new Error('사진을 넣어 주세요');
    const pins = (sc.pins || []).filter(q => q && q.x != null && q.y != null);
    const hasSide = !!(sc.title || sc.caption);
    // 사진 칸: 16:9 는 왼쪽(글이 있으면 62%), 9:16 은 위
    const A = R ? { x: S.x, y: S.y, w: S.w, h: hasSide ? S.h * .64 : S.h } : { x: S.x, y: S.y, w: hasSide ? S.w * .62 : S.w, h: S.h };
    const box0 = el('div', 'abs photo', root); place(box0, A.x, A.y, A.w, A.h);
    const zoom = el('div', 'abs', box0); if (DRAW) box0.classList.add('drawn');
    const INLINE = DRAW && !PIXEL;   // 픽셀은 그림도 네모 칸으로 바꾸려고 img 로
    const img = INLINE ? el('div', null, zoom) : el('img', null, zoom);
    if (INLINE) img.innerHTML = DRAW.svg; else { img.src = DRAW ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(DRAW.svg) : sc.src; img.alt = ''; }
    const dws = INLINE ? [...img.querySelectorAll('.dw')] : [], fls = INLINE ? [...img.querySelectorAll('.fl')] : [];
    css(img, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block' });
    const pinEls = pins.map(q => { const g = el('div', 'pin', zoom); el('span', 'ring', g); const lb = q.label ? el('div', 'pinlab qa', g, q.label) : null; if (q.label) TEXTS.push(q.label); return { q, g, lb }; });
    let side = null, kick = null, cap = null;
    if (hasSide) {
      side = el('div', 'abs qa', root);
      if (R) place(side, S.x, A.y + A.h + 3 * U, S.w, S.h - A.h - 3 * U); else place(side, A.x + A.w + 4 * U, S.y, S.w - A.w - 4 * U, S.h);
      css(side, { display: 'flex', flexDirection: 'column', justifyContent: R ? 'flex-start' : 'center', gap: px(2 * U) });
      if (sc.title) { kick = el('div', 'kicker', side, sc.title); TEXTS.push(sc.title); }
      if (sc.caption) { cap = el('div', 'textwrap', side); rich(cap, sc.caption); css(cap, { fontSize: px((R ? 5 : 3.6) * U), lineHeight: 1.5 }); TEXTS.push(plain(sc.caption)); }
    }
    const pt = pins.map((_, j) => 1.5 + j * 1.15);
    const tCap = 1.0;
    const dur = sc.dur || Math.max(4.5, (pt.length ? pt.at(-1) + 2.2 : 4.5));
    let F = null, O = { x: 50, y: 50 };   // F = 사진이 실제로 놓인 자리(비율 유지), O = 다가가는 가운데
    const zs = lt => 1 + 0.07 * eio(p(lt, 0.15, dur));
    const zq = (q, lt) => { const k = zs(lt); return { x: O.x + (q.x - O.x) * k, y: O.y + (q.y - O.y) * k }; };   // 다가가도 짚은 곳을 따라간다
    const layout = () => {
      const nw = DRAW ? DRAW.w : img.naturalWidth || 4, nh = DRAW ? DRAW.h : img.naturalHeight || 3, k = Math.min(A.w / nw, A.h / nh), w = nw * k, h = nh * k;
      F = { x: (A.w - w) / 2, y: (A.h - h) / 2, w, h };
      place(zoom, F.x, F.y, w, h); css(zoom, { overflow: 'hidden', borderRadius: px(1.2 * U) });
      // 다가가는 곳: 짚는 곳들의 가운데
      if (pins.length) O = { x: pins.reduce((a, q) => a + q.x, 0) / pins.length, y: pins.reduce((a, q) => a + q.y, 0) / pins.length };
      img.style.transformOrigin = `${O.x}% ${O.y}%`;
    };
    const at = (q, lt) => { const z = zq(q, lt); return { x: A.x + F.x + F.w * z.x / 100, y: A.y + F.y + F.h * z.y / 100 }; };
    return {
      dur, hits: [[0.15, 'sweep'], ...(cap ? [[tCap, 'words']] : []), ...(cap && cap.querySelector('.hl') ? [[tCap + 1.0, 'mark']] : []), ...pt.map(t => [t, 'pop'])],
      async prepare() {
        if (INLINE) return;
        if (!img.complete) await new Promise(r => { img.onload = img.onerror = r; }); if (!img.naturalWidth) throw new Error('사진을 읽지 못했어요');
        if (PIXEL) {   // 픽셀 스타일: 사진도 큰 네모 칸으로(가로 72칸 · 색 단계 줄이기)
          const cw = 72, ch = Math.max(1, Math.round(cw * img.naturalHeight / img.naturalWidth)), cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
          const g = cv.getContext('2d'); g.drawImage(img, 0, 0, cw, ch); const d = g.getImageData(0, 0, cw, ch); for (let i = 0; i < d.data.length; i += 4) for (let j = 0; j < 3; j++) d.data[i + j] = Math.round(d.data[i + j] / 48) * 48; g.putImageData(d, 0, 0);
          img.style.imageRendering = 'pixelated'; await new Promise(r => { img.onload = r; img.src = cv.toDataURL(); });
        }
      },
      measure() {
        layout();
        this.dotIn = { x: A.x + F.x - 2 * U, y: A.y + F.y + F.h * .5 };
        this.pts = pins.map(q => at(q, dur));
        this.dotOut = this.pts.length ? this.pts.at(-1) : (cap ? (b => ({ x: b.x + b.w + 1.6 * U, y: b.y + b.h * .6 }))(box(cap)) : { x: A.x + F.x + F.w + 2 * U, y: A.y + F.y + F.h * .5 });
      },
      update(lt) {
        const k = eio(p(lt, 0.15, 1.0));
        if (INLINE) {   // 그림: 선이 그려지고 색이 스민다
          const n = dws.length; dws.forEach((e, j) => { const a = eio(p(lt, 0.15 + j / n * 0.6, 0.9 + j / n * 0.9)); e.style.strokeDasharray = '1 1'; e.style.strokeDashoffset = (1 - a).toFixed(4); });
          fls.forEach(e => { e.style.opacity = ''; e.style.opacity = (+(e.getAttribute('opacity') || 1) * eo(p(lt, 0.7, 1.6))).toFixed(3); });
        } else zoom.style.clipPath = `inset(0 ${((1 - k) * 100).toFixed(2)}% 0 0 round ${1.2 * U}px)`;
        img.style.transform = `scale(${zs(lt)})`;
        if (kick) kick.style.opacity = eo(p(lt, 0.4, 0.9));
        if (cap) { wipe(cap, eio(p(lt, tCap, tCap + 1.0))); cap.querySelectorAll('.hl').forEach((e, j) => { const k = eio(p(lt, tCap + 1.0 + j * 0.3, tCap + 1.4 + j * 0.3)); e.style.setProperty('--k', k); e.classList.toggle('on', k > .5); }); }
        pinEls.forEach(({ q, g, lb }, j) => {
          const z = zq(q, lt); place(g, F.w * z.x / 100, F.h * z.y / 100);
          const a = p(lt, pt[j], pt[j] + 0.45);
          g.style.opacity = a > 0 ? 1 : 0; g.firstChild.style.transform = `translate(-50%,-50%) scale(${back(a)})`;
          if (lb) { lb.style.opacity = eo(p(lt, pt[j] + 0.15, pt[j] + 0.55)); lb.style.transform = `translate(-50%, ${(1 - eo(p(lt, pt[j] + 0.15, pt[j] + 0.55))) * 0.6 + 0.9}em)`; }
        });
      },
      dotAt(lt) {
        if (!this.pts.length) { const k = eio(p(lt, 0.15, 1.0)); return { x: lerp(this.dotIn.x, A.x + F.x + F.w + 2 * U, k), y: this.dotIn.y, s: 1 }; }
        let q = this.dotIn;
        const P = pins.map(x => at(x, lt));
        for (let j = 0; j < P.length; j++) { const t0 = pt[j] - 0.5; if (lt >= t0) q = arc(j ? P[j - 1] : this.dotIn, P[j], eio(p(lt, t0, pt[j])), 4 * U); }
        const j = pt.findIndex((t, i) => lt >= t && lt < t + 0.4);
        return { ...q, s: j >= 0 ? 1 + 0.5 * Math.sin(p(lt, pt[j], pt[j] + 0.4) * Math.PI) : 1 };
      },
    };
  };

  // 12) 한글 자모 조립: 자모가 날아와 글자가 되고, 획 하나(자모 하나)가 바뀌면 뜻이 바뀐다
  const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ', JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ', JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
  const split = ch => { const c = ch.charCodeAt(0) - 0xAC00; if (c < 0 || c > 11171) return null; return [CHO[Math.floor(c / 588)], JUNG[Math.floor((c % 588) / 28)], JONG[c % 28]]; };
  // 자모 자리(글자 상자 안 비율): 세로 모음은 오른쪽, 가로 모음은 아래, 겹모음은 아래+오른쪽, 받침은 맨 아래
  const slots = j => {
    const v = j[1], vert = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅣ'.includes(v), horiz = 'ㅗㅛㅜㅠㅡ'.includes(v), hb = j[2] ? .62 : 1;
    const P = [];
    if (vert) { P.push([.04, .06 * hb, .5, .88 * hb]); P.push([.52, .02, .44, .94 * hb]); }
    else if (horiz) { P.push([.22, .02, .56, .5 * hb]); P.push([.08, .5 * hb, .84, .48 * hb]); }
    else { P.push([.06, .02, .5, .5 * hb]); P.push([.06, .44 * hb, .9, .56 * hb]); }
    if (j[2]) P.push([.2, .64, .6, .36]);
    return P;
  };
  T.hangul = (sc, root) => {
    const words = (sc.words || []).map(w => Array.isArray(w) ? w : [w, '']).filter(w => w[0]);
    if (!words.length) throw new Error('낱말을 넣어 주세요');
    let tt = null; if (sc.title) { tt = el('div', 'abs kicker qa', root, sc.title); place(tt, S.x, S.y); TEXTS.push(sc.title); }
    const maxN = Math.max(...words.map(w => [...w[0]].length));
    const B = Math.min(R ? S.w / maxN * .92 : 26 * U, (S.w * .9) / maxN, 30 * U);
    const cy = S.y + S.h * (R ? .4 : .44);
    const step0 = 0.4, per = 2.9;
    const groups = words.map(([w, mean], wi) => {
      const chs = [...w], x0 = S.x + (R ? 0 : (S.w - chs.length * B) / 2);
      const g = el('div', 'abs', root); place(g, 0, 0, W, H);
      const syl = chs.map((ch, ci) => {
        const j = split(ch), bx = x0 + ci * B, by = cy - B / 2;
        const glyph = el('div', 'abs hg-glyph', g, ch); place(glyph, bx, by, B, B); css(glyph, { fontSize: px(B * .86), lineHeight: px(B), textAlign: 'center', fontWeight: 900 });
        const pcs = j ? slots(j).map((r, k) => { const e = el('div', 'abs hg-piece', g, j[k]); const [rx, ry, rw, rh] = r; place(e, bx + rx * B, by + ry * B, rw * B, rh * B); css(e, { fontSize: px(Math.min(Math.min(rw, rh) * 1.4, Math.max(rw, rh) * .8) * B), lineHeight: px(rh * B), textAlign: 'center', fontWeight: 900 }); return { e, ch: j[k], k }; }) : [];
        return { ch, j, glyph, pcs, bx, by };
      });
      const m = mean ? el('div', 'abs pen qa', g, mean) : null; if (m) { css(m, { fontSize: px((R ? 6 : 5.2) * U), width: px(S.w), textAlign: R ? 'left' : 'center' }); place(m, S.x, cy + B / 2 + 3 * U); }
      TEXTS.push(w + (mean ? ' ' + mean : ''));
      return { w, chs, syl, m, g, t0: step0 + wi * per };
    });
    // 바뀌는 자모 찾기(앞 낱말과 같은 자리 · 같은 순서)
    groups.forEach((G, gi) => { if (!gi) return; const P = groups[gi - 1];
      G.syl.forEach((s, ci) => s.pcs.forEach(pc => { const o = P.syl[ci] && P.syl[ci].pcs[pc.k]; pc.changed = !o || o.ch !== pc.ch || P.syl[ci].j[1] !== s.j[1] && pc.k === 1; }));
      P.out = P.syl.map((s, ci) => s.pcs.map(pc => { const n = G.syl[ci] && G.syl[ci].pcs[pc.k]; return !n || n.ch !== pc.ch; })); });
    const last = groups.at(-1).t0 + (groups.length > 1 ? 2.2 : 2.0);
    const note = sc.note ? el('div', 'abs pen qa', root, sc.note) : null; if (note) { css(note, { fontSize: px(4.4 * U), width: px(S.w), textAlign: R ? 'left' : 'center' }); place(note, S.x, S.y + S.h - 6 * U); TEXTS.push(sc.note); }
    const dur = sc.dur || last + (note ? 2.6 : 1.6);
    const hits = [];
    groups.forEach((G, gi) => {
      if (!gi) { G.syl.forEach((s, ci) => s.pcs.forEach((pc, k) => hits.push([G.t0 + (ci * 3 + k) * 0.12, 'hop']))); hits.push([G.t0 + 1.25, 'pop']); }
      else { hits.push([G.t0, 'rewind']); hits.push([G.t0 + 0.7, 'mark']); hits.push([G.t0 + 1.35, 'pop']); }
    });
    if (note) hits.push([last + 0.3, 'write']);
    const fly = (ci, k) => { const a = (ci * 3 + k) * 2.399; return { x: Math.cos(a) * 30 * U, y: Math.sin(a) * 18 * U - 10 * U }; };
    return {
      dur, hits,
      measure() {
        const s0 = groups[0].syl[0]; this.dotIn = { x: s0.bx - 3 * U, y: cy };
        const L2 = groups.at(-1).syl.at(-1); this.dotOut = note ? (b => ({ x: b.x + b.w + 2 * U, y: b.y + b.h * .5 }))(box(note)) : { x: L2.bx + B + 2 * U, y: cy };
      },
      update(lt) {
        if (tt) tt.style.opacity = eo(p(lt, 0.1, 0.5));
        groups.forEach((G, gi) => {
          const nx = groups[gi + 1], tEnd = nx ? nx.t0 : Infinity;
          const on = lt >= (gi ? G.t0 : 0) && lt < tEnd + 0.7;
          G.g.style.display = on ? 'block' : 'none'; if (!on) return;
          const asm = gi ? G.t0 + 1.25 : G.t0 + 1.2;   // 다시 한 글자로 합치는 때
          G.syl.forEach((s, ci) => {
            // 글자 한 덩어리 ↔ 자모 조각
            const kg = eo(p(lt, asm, asm + 0.35)) * (nx ? 1 - eo(p(lt, tEnd - 0.05, tEnd + 0.1)) : 1);
            s.glyph.style.opacity = kg; s.glyph.style.transform = `scale(${0.9 + 0.1 * kg})`;
            const kA = eo(p(lt, asm, asm + 0.35)), leaving = nx && lt >= tEnd - 0.05;
            s.pcs.forEach((pc, k) => {
              let o = 0, x = 0, y = 0, sc2 = 1;
              const out = nx && G.out && G.out[ci][k];
              if (leaving) {   // 다음 낱말로: 바뀌는 자모만 떨어져 나간다(나머지는 다음 낱말이 같은 자리에서 이어받음)
                if (out) { const ko = eio(p(lt, tEnd + 0.1, tEnd + 0.5)); o = 1 - ko; y = ko * 14 * U; x = ko * 4 * U; }
              } else if (!gi) {   // 첫 낱말: 흩어진 자모가 날아와 제자리에
                const t1 = G.t0 + (ci * 3 + k) * 0.12, f = fly(ci, k), kf = eo(p(lt, t1, t1 + 0.55));
                o = kf * (1 - kA); x = f.x * (1 - kf); y = f.y * (1 - kf); sc2 = 0.6 + 0.4 * kf;
              } else if (pc.changed) {   // 새 자모가 위에서 떨어져 끼워진다
                const kd = back(p(lt, G.t0 + 0.55, G.t0 + 0.95)); o = clamp(p(lt, G.t0 + 0.5, G.t0 + 0.7)) * (1 - kA); y = (1 - kd) * -12 * U; sc2 = 1.6 - 0.6 * kd;
              } else o = (lt >= G.t0 ? 1 : 0) * (1 - kA);
              pc.e.style.opacity = o; pc.e.style.transform = `translate(${x}px, ${y}px) scale(${sc2})`;
              pc.e.style.color = (gi && pc.changed) || (leaving && out) ? ACC : '';
            });
          });
          if (G.m) { const km = eo(p(lt, asm + 0.15, asm + 0.6)) * (nx ? 1 - eo(p(lt, tEnd - 0.1, tEnd + 0.2)) : 1); G.m.style.opacity = km; G.m.style.transform = `translateY(${(1 - km) * 1.5 * U}px)`; }
        });
        if (note) wipe(note, p(lt, last + 0.3, last + 1.3));
      },
      dotAt(lt) {
        let pt = this.dotIn;
        groups.forEach((G, gi) => {
          if (!gi) { if (lt >= G.t0) { const sL = G.syl.at(-1); pt = arc(this.dotIn, { x: sL.bx + B + 2 * U, y: cy }, eio(p(lt, G.t0 + 0.2, G.t0 + 1.4))); } return; }
          const hit = G.syl.find(sy => sy.pcs.some(pc => pc.changed)); if (!hit || lt < G.t0 + 0.3) return;
          pt = arc(pt, { x: hit.bx + B * .5, y: cy - B * .64 }, eio(p(lt, G.t0 + 0.3, G.t0 + 0.7)));
        });
        if (lt >= last + 0.2) pt = arc(pt, this.dotOut, eio(p(lt, last + 0.2, last + 0.8)));
        return pt;
      },
    };
  };

  // 그릴 수 없는 장면: 무엇이 빠졌는지 화면에 알린다
  T.oops = (sc, root, err) => {
    const why = err && err.message || '빈 칸';
    const c = el('div', 'abs qa', root); place(c, S.x, S.y, S.w, S.h);
    css(c, { display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: px(2 * U), textAlign: 'center' });
    el('div', 'kicker', c, '이 장면을 그릴 수 없어요').style.color = BAD;
    const m = el('div', null, c, '빈 칸을 채워 주세요 · ' + (err && err.message || '')); css(m, { fontSize: px(2.6 * U), color: 'var(--dim)' });
    return { oops: why, dur: 2.5, hits: [], measure() { this.dotIn = this.dotOut = { x: S.x + S.w / 2, y: S.y + S.h * .7 }; }, update() {}, dotAt() { return this.dotIn; } };
  };

  // ================= 짓기 =================
  L.scenes.forEach((sc, i) => {
    const root = el('div', 'scene', stage);
    const ST = styleOfScene(sc); useStyle(ST);
    let s;
    try { if (!T[sc.type]) throw new Error(`모르는 장면 틀: ${sc.type}`); s = T[sc.type](sc, root); }
    catch (e) { root.innerHTML = ''; s = T.oops(sc, root, e); }   // 고치는 중에 빈 칸이 있어도 멈추지 않는다
    s.root = root; s.sc = sc; s.i = i; s.STY = ST; scenes.push(s);
    const md = Math.max(sc.minDur || 0, sc.voiceDur ? sc.voiceDur + 1.2 : 0); if (md) s.dur = Math.max(s.dur, md);   // 녹음이 있으면 말 길이만큼은 머문다
  });
  let acc = 0; scenes.forEach(s => { s.t0 = acc; acc += s.dur; s.hits.forEach(([t, k]) => HITS.push({ t: +(s.t0 + t).toFixed(3), kind: k, scene: s.i + 1 })); });
  const DUR = acc;
  HITS.sort((a, b) => a.t - b.t);

  // 장면 사이 점 옮기기 (아크 · 스쿼시 앤 스트레치)
  const TA = 0.5, TB = 0.32;
  const dotPos = t => {
    for (let i = 0; i < scenes.length - 1; i++) { const T0 = scenes[i + 1].t0; if (t >= T0 - TA && t < T0 + TB) { const a = scenes[i].dotOut, b = scenes[i + 1].dotIn; return { ...arc(a, b, eio(p(t, T0 - TA, T0 + TB))), s: 1 }; } }
    const s = scenes.find(s => t >= s.t0 && t < s.t0 + s.dur) || scenes.at(-1);
    const lt = t - s.t0; let q; try { q = s.dotAt(clamp(lt, 0, s.dur)) || s.dotIn; } catch (e) { q = s.dotIn || { x: 0, y: 0 }; }
    return { x: q.x, y: q.y, s: q.s != null ? q.s : 1 };
  };
  const endHit = (HITS.find(h => h.kind === 'end') || { t: DUR }).t;
  let qaMode = false;   // 점검할 때는 박자 튐을 빼고 잰다
  const punch = (t, sty) => { if (qaMode || !beatOf(sty) || t < BT * 4 || t > endHit) return 0; const n = Math.floor(t / BT), ph = (t - n * BT) / BT; return Math.exp(-ph * 9) * (n % 4 === 0 ? 1 : 0.5); };
  const seek = t => {
    t = clamp(t, 0, DUR - 1e-4);
    const act = scenes.find(s => t >= s.t0 && t < s.t0 + s.dur) || scenes.at(-1); applyTheme(act.STY);
    if (STY.steps) t = Math.floor(t * STY.steps) / STY.steps;   // 종이 공작 · 픽셀: 뚝뚝 끊기는 움직임
    for (const s of scenes) {
      const lt = t - s.t0, on = lt >= -0.0001 && lt < s.dur;
      s.root.style.display = on ? 'block' : 'none';
      if (!on) continue;
      useStyle(s.STY); const TRK = L.trans === 'zoom' ? 'zoom' : STY.tr;
      try { s.update(lt); } catch (e) { /* 고치는 중 빈 값 */ }
      const isLast = s === scenes.at(-1);
      const kin = eo(p(lt, 0, 0.22)), kout = isLast ? 0 : eio(p(lt, s.dur - 0.42, s.dur));
      const ti = 1 - kin, rs = s.root.style; rs.opacity = kin * (1 - kout); rs.filter = ''; rs.clipPath = ''; rs.transform = ''; rs.transformOrigin = '';
      switch (TRK) {
        case 'zoom': {   // 끝없는 줌: 점이 있는 곳으로 빨려 들어가고, 다음 장면은 그 점에서 열린다
          const kz = eo(p(lt, 0, 0.45));
          if (kout > 0) { const o = s.dotOut || { x: W / 2, y: H / 2 }; rs.transformOrigin = `${o.x}px ${o.y}px`; rs.transform = `scale(${1 + kout * kout * 6})`; rs.opacity = (1 - kout) * (1 - kout); }
          else if (kz < 1) { const o = s.dotIn || { x: W / 2, y: H / 2 }; rs.transformOrigin = `${o.x}px ${o.y}px`; rs.transform = `scale(${0.2 + 0.8 * kz})`; rs.opacity = kz; }
          break;
        }
        case 'ink': rs.filter = (ti + kout) > 0.01 ? `blur(${ti * 7 + kout * 12}px)` : ''; break;                     // 먹이 번지듯
        case 'paper': rs.transform = `translateY(${(ti * 7 + kout * 3) * U}px) rotate(${-ti * 4 + kout * 3}deg)`; break; // 색종이를 붙였다 뗀다
        case 'pixel': rs.opacity = 1; rs.clipPath = kout > 0 ? `inset(0 0 0 ${Math.ceil(kout * 8) / 8 * 100}%)` : (ti > 0 ? `inset(0 ${Math.ceil(ti * 8) / 8 * 100}% 0 0)` : ''); break;
        case 'cinema': { const kc = eo(p(lt, 0, 0.7)); rs.opacity = kc * (1 - kout); rs.transform = `scale(${0.96 + 0.04 * Math.min(1, lt / (s.dur - 0.5))})`; break; }   // 검게 열렸다 닫히며 천천히 다가간다
        case 'page': rs.transform = `translateX(${(ti * 5 - kout * 5) * U}px)`; break;                    // 지면 넘기기
        case 'erase': rs.filter = kout > 0.01 ? `blur(${kout * 14}px)` : ''; rs.opacity = kin * (1 - kout * kout); break;   // 지우개
        case 'flip': rs.transform = `translateY(${(ti * 3 - kout * 6) * U}px) rotate(${-kout * 2}deg)`; break; // 공책 넘기기
        case 'pop': rs.transform = `scale(${kin < 1 ? 0.9 + 0.1 * back(kin) : 1 + kout * 0.08})`; break;     // 통통
        case 'fade': break;
        case 'wipe': rs.clipPath = kout > 0 ? `inset(0 0 0 ${kout * 100}%)` : (kin < 1 ? `inset(0 ${ti * 100}% 0 0)` : ''); rs.opacity = 1; break; // 설계도 긋기
        default: rs.transform = `translateY(${-kout * 2.4 * U}px)`; rs.filter = kout > 0.01 ? `blur(${kout * 8}px)` : '';
      }
      const pk = punch(t, STY); if (pk > 0.01) rs.transform = (rs.transform || '') + ` scale(${1 + 0.02 * pk})`;
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
    if (pix && curTheme === 'pixel') {   // 구름은 칸 단위로 흐르고, 별은 깜빡이고, 아이는 박자에 맞춰 걷다 뛴다
      pix.clouds.forEach(c => { c.e.style.transform = `translateX(${Math.round(((t * c.sp) % (W * .4)) / (U * .9)) * U * .9}px)`; });
      pix.stars.forEach(st => { st.e.style.opacity = (Math.floor(t * 3 + st.i * 1.7) % 4 === 0) ? .15 : .55; });
      const bt = 60 / BPM, k = (t % bt) / bt, hop = Math.sin(k * Math.PI) * 1.6 * U * (t > bt * 4 && t < endHit ? 1 : 0.3);
      place(pix.kid, S.x + ((t * 7 * U) % (S.w - 6 * U)), pix.y0 - Math.round(hop / (U * .7)) * U * .7); pix.kid.style.opacity = endFade;
      dot.firstChild.style.transform = `scaleX(${[1, .6, .2, .6][Math.floor(t * 8) % 4]})`;
    }
    if (leak && curTheme === 'cinema') { leak.style.transform = `translateX(${Math.sin(t * 0.33) * W * 0.2}px)`; leak.style.opacity = (0.45 + 0.3 * Math.sin(t * 0.7 + 1)) * endFade; }
    stage.style.setProperty('--fade', endFade);
    stage.querySelectorAll('.scene').forEach(sc => { if (sc.style.display === 'block' && t > DUR - 0.5) sc.style.opacity = String(+sc.style.opacity * endFade); });
  };

  // 오른쪽 아래 라벨 자리(글자 너비를 알아야 해서 READY 에서)
  const placeRight = (e, y) => css(e, { left: 'auto', right: px(W - S.x - S.w), top: px(y) });   // 스타일마다 글꼴 너비가 달라 오른쪽에 붙인다

  // 겹침 · 넘침 점검: 장면마다 다 나온 순간을 보고, 안전 영역을 넘거나 글 덩어리가 겹치면 알린다
  const KN = { title: '제목', concept: '개념', steps: '수식 · 풀이', graph: '함수 그래프', bars: '막대그래프', timeline: '연표', compare: '둘 비교', fix: '흔한 실수', process: '과정', photo: '사진', hangul: '한글 조립', end: '마무리' };
  const QA = () => {
    const out = []; qaMode = true;
    for (const s of scenes) {
      if (s.oops) out.push(`장면 ${s.i + 1}(${KN[s.sc.type] || s.sc.type}): 그릴 수 없음 — ${s.oops}`);
      seek(s.t0 + s.dur - 0.5);
      const blocks = [...s.root.querySelectorAll('.qa')].map(e => ({ e, b: box(e) })).filter(o => o.b.w > 0);
      const lim = R ? S : { x: 2 * U, y: 7.5 * U, w: W - 4 * U, h: H - 15 * U };
      // 글 덩어리 안의 실제 글자 상자로 넘침을 본다
      // 점이 글자를 가리는지(다 나온 순간)
      const db = box(dot), dr = { x: db.x + db.w * .2, y: db.y + db.h * .2, w: db.w * .6, h: db.h * .6 };
      let hid = '';
      s.root.querySelectorAll('.qa *').forEach(c => { if (hid || c.children.length || !c.textContent.trim() || dot.style.opacity === '0') return; const r = box(c); if (!r.w) return;
        const ox = Math.min(r.x + r.w, dr.x + dr.w) - Math.max(r.x, dr.x), oy = Math.min(r.y + r.h, dr.y + dr.h) - Math.max(r.y, dr.y); if (ox > dr.w * .35 && oy > dr.h * .35) hid = c.textContent.trim().slice(0, 12); });
      if (hid) out.push(`장면 ${s.i + 1}(${KN[s.sc.type] || s.sc.type}): 점이 글자 "${hid}" 을(를) 가림`);
      s.root.querySelectorAll('.qa *').forEach(c => {
        if (c.children.length || !c.textContent.trim()) return; const r = box(c); if (!r.w) return;
        if (r.x < lim.x - 2 || r.y < lim.y - 2 || r.x + r.w > lim.x + lim.w + 2 || r.y + r.h > lim.y + lim.h + 2) out.push(`장면 ${s.i + 1}(${KN[s.sc.type] || s.sc.type}): "${c.textContent.trim().slice(0, 20)}" 이(가) 화면 밖으로 넘침`);
      });
      for (let i = 0; i < blocks.length; i++) for (let j = i + 1; j < blocks.length; j++) {
        const a = blocks[i].b, b = blocks[j].b, ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (ox > 4 && oy > 4 && (blocks[i].e.textContent.trim() && blocks[j].e.textContent.trim())) out.push(`장면 ${s.i + 1}(${KN[s.sc.type] || s.sc.type}): 글 덩어리 두 개가 겹침 — "${blocks[i].e.textContent.trim().slice(0, 14)}" / "${blocks[j].e.textContent.trim().slice(0, 14)}"`);
      }
    }
    qaMode = false;
    return [...new Set(out)];
  };

  const fontLoads = ['500 40px KR', '900 40px KR', '40px PEN', '40px ANTON', '800 40px SERIF', '40px POP', '40px ROUND', '700 40px CHALK', '700 40px PIXEL', '40px BRUSH', '40px KaTeX_Main', 'italic 40px KaTeX_Math', '40px KaTeX_Size1', '40px KaTeX_Size2', 'bold 40px KaTeX_Main', '40px KaTeX_AMS'];
  const READY = (async () => {
    const sample = TEXTS.join(' ') + '0123456789';
    await Promise.all(fontLoads.map(f => document.fonts.load(f, sample).catch(() => null)));
    await document.fonts.ready;
    await Promise.all(scenes.map(s => s.prepare ? s.prepare().catch(e => { s.root.innerHTML = ''; const d = s.dur; Object.assign(s, T.oops(s.sc, s.root, e)); s.dur = d; }) : null));   // 사진이 다 읽힌 뒤 잰다
    for (const s of scenes) {
      applyTheme(s.STY); s.root.style.display = 'block';
      try { s.measure(); } catch (e) { s.dotIn = s.dotOut = { x: S.x + S.w / 2, y: S.y + S.h / 2 }; s.update = () => {}; s.dotAt = () => s.dotIn; console.warn('장면', s.i + 1, e); }
      s.root.style.display = 'none';
    }
    placeRight(labTR, top); placeRight(labBR, bot);
    seek(0);
  })();
  const SCENES = scenes.map(s => ({ n: s.i + 1, type: s.sc.type, t0: +s.t0.toFixed(3), dur: +s.dur.toFixed(3) }));
  let audioP = null;
  const audio = () => audioP || (audioP = renderSound(L, HITS, SCENES, DUR));
  return { READY, seek, DUR, HITS, QA, TEXTS, SCENES, W, H, audio, poster: Math.max(0, scenes[0].dur - 0.6) };
  }

  // ================= 소리 =================
  // 배경음 · 효과음 · 녹음을 한 번에 만든다(OfflineAudioContext). 같은 lesson 이면 언제나 같은 소리(씨앗 고정).
  const SR = 32000;
  const rngOf = seed => { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
  const PROG = { bright: [[0, 'M'], [7, 'M'], [-3, 'm'], [5, 'M']], dark: [[0, 'm'], [-4, 'M'], [3, 'M'], [-2, 'M']] };
  const chord = (b, key) => { const [o, q] = PROG[key][b % 4]; const r = 50 + o; return [r, r + (q === 'm' ? 3 : 4), r + 7]; };
  async function renderSound(L, HITS, SCENES, DUR) {
    const CHIP = (L.style || L.theme) === 'pixel', CINE = (L.style || L.theme) === 'cinema';   // 픽셀 = 8비트 칩 소리 · 예고편 = 낮은 쾅
    const N = Math.ceil((DUR + 1.2) * SR), ctx = new OfflineAudioContext(1, N, SR), rnd = rngOf(L.seed || 7);
    const nb = ctx.createBuffer(1, SR * 2, SR), nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = rnd() * 2 - 1;
    const hz = m => 440 * 2 ** ((m - 69) / 12);
    const master = ctx.createGain(); master.connect(ctx.destination);
    const bus = n => { const g = ctx.createGain(); g.connect(master); return g; };
    const bed = bus(), fx = bus(), vo = bus();
    const rev = ctx.createConvolver(), irb = ctx.createBuffer(1, SR * 1.5, SR), ir = irb.getChannelData(0);
    for (let i = 0; i < ir.length; i++) ir[i] = (rnd() * 2 - 1) * Math.exp(-i / SR / 0.4) * 0.3;
    rev.buffer = irb; const wet = ctx.createGain(); wet.gain.value = CHIP ? 0.04 : CINE ? 0.32 : 0.2; rev.connect(wet); wet.connect(master); bed.connect(rev); fx.connect(rev);
    const env = (g, t, a, d, pk) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(pk, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
    const vca = (dest, t, a, d, pk) => { const g = ctx.createGain(); env(g, t, a, d, pk); g.connect(dest); return g; };
    const filt = (dest, f, type = 'lowpass', q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; b.connect(dest); return b; };
    const osc = (type, f, t, d, dest, det = 0) => { const o = ctx.createOscillator(); o.type = CHIP ? (type === 'sine' && f < 200 ? 'triangle' : 'square') : type; if (CHIP) det = 0; o.frequency.value = f; o.detune.value = det; o.connect(dest); o.start(t); o.stop(t + d + 0.05); return o; };
    const noise = (t, d, dest) => { const s = ctx.createBufferSource(); s.buffer = nb; s.loop = true; s.connect(dest); s.start(t, rnd() * 1.5); s.stop(t + d + 0.05); };
    const I = {
      pluck: (t, m, d = 0.3, g = 0.12) => { const f = filt(vca(fx, t, 0.003, d, g), 3200); osc('sawtooth', hz(m), t, d, f, -7); osc('sawtooth', hz(m), t, d, f, 7); },
      bell: (t, m, d = 1.2, g = 0.12) => { osc('sine', hz(m), t, d, vca(fx, t, 0.002, d, g)); osc('sine', hz(m) * 4, t, d, vca(fx, t, 0.002, d * 0.35, g * 0.3)); osc('sine', hz(m) * 9.2, t, d, vca(fx, t, 0.002, d * 0.15, g * 0.12)); },
      keys: (t, ms, d, g) => ms.forEach(m => { osc('sine', hz(m), t, d, vca(bed, t, 0.006, d, g / ms.length)); osc('sine', hz(m) * 4, t, 0.25, vca(bed, t, 0.002, 0.12, g * 0.2 / ms.length)); }),
      pad: (t, ms, d, g, dest = bed) => { const v = ctx.createGain(); v.gain.setValueAtTime(0.0001, t); v.gain.exponentialRampToValueAtTime(g, t + 0.3); v.gain.setValueAtTime(g, t + d * 0.6); v.gain.exponentialRampToValueAtTime(0.0001, t + d); v.connect(dest); const f = filt(v, 1500); ms.forEach(m => { osc('sawtooth', hz(m), t, d, f, -6); osc('sawtooth', hz(m), t, d, f, 6); }); },
      strings: (t, ms, d, g) => { const v = ctx.createGain(); v.gain.setValueAtTime(0.0001, t); v.gain.exponentialRampToValueAtTime(g, t + 0.45); v.gain.setValueAtTime(g, t + d * 0.75); v.gain.exponentialRampToValueAtTime(0.0001, t + d); v.connect(bed); const f = filt(v, 2200); ms.forEach(m => [-9, -3, 3, 9].forEach(dd => osc('sawtooth', hz(m), t, d, f, dd))); },
      sub: (t, m, d, g) => osc('sine', hz(m), t, d, vca(bed, t, 0.01, d * 0.8, g)),
      kick: (t, g) => { const o = ctx.createOscillator(); o.frequency.setValueAtTime(170, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.08); o.connect(vca(bed, t, 0.001, 0.22, g)); o.start(t); o.stop(t + 0.4); },
      rim: (t, g, dest = bed) => { noise(t, 0.06, filt(vca(dest, t, 0.0005, 0.035, g), 2200, 'bandpass', 3)); osc('sine', 1700, t, 0.05, vca(dest, t, 0.0005, 0.025, g * 0.5)); },
      hat: (t, g) => noise(t, 0.06, filt(vca(bed, t, 0.0005, 0.035, g), 7500, 'highpass')),
      clap: (t, g) => [0, 0.012, 0.024].forEach(o => noise(t + o, 0.12, filt(vca(bed, t + o, 0.0005, 0.07, g), 1400, 'bandpass', 1.5))),
      boom: (t, g) => { const os = ctx.createOscillator(); os.frequency.setValueAtTime(62, t); os.frequency.exponentialRampToValueAtTime(30, t + 1.4); os.connect(vca(fx, t, 0.005, 1.6, g)); os.start(t); os.stop(t + 1.8); noise(t, 0.5, filt(vca(fx, t, 0.002, 0.45, g * 0.5), 500)); },
      heart: (t, g) => [0, 0.17].forEach((o, i) => { const os = ctx.createOscillator(); os.frequency.setValueAtTime(80, t + o); os.frequency.exponentialRampToValueAtTime(45, t + o + 0.06); os.connect(vca(bed, t + o, 0.003, 0.12, g * (i ? 0.7 : 1))); os.start(t + o); os.stop(t + o + 0.3); }),
      swish: (t, d, lo, hi, g) => { const b = ctx.createBiquadFilter(); b.type = 'bandpass'; b.Q.value = 1.2; b.frequency.setValueAtTime(lo, t); b.frequency.exponentialRampToValueAtTime(hi, t + d); b.connect(vca(fx, t, d * 0.3, d * 0.7, g)); noise(t, d, b); },
      riser: (t, d, g) => { const v = ctx.createGain(); v.gain.setValueAtTime(0.0001, t); v.gain.exponentialRampToValueAtTime(g, t + d); v.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.1); v.connect(fx); const b = ctx.createBiquadFilter(); b.type = 'bandpass'; b.Q.value = 2; b.frequency.setValueAtTime(300, t); b.frequency.exponentialRampToValueAtTime(5000, t + d); b.connect(v); noise(t, d + 0.1, b); const o = ctx.createOscillator(); o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(660, t + d); const og = ctx.createGain(); og.gain.value = 0.2; o.connect(og); og.connect(v); o.start(t); o.stop(t + d + 0.12); },
      buzz: (t, m, g) => { const f = filt(vca(fx, t, 0.004, 0.13, g), 900); osc('sawtooth', hz(m), t, 0.2, f); osc('sawtooth', hz(m), t, 0.2, f, 15); },
      rewind: (t, d, ms, g) => { const v = ctx.createGain(); v.gain.setValueAtTime(0.0001, t); v.gain.exponentialRampToValueAtTime(g, t + d); v.gain.linearRampToValueAtTime(0, t + d + 0.02); v.connect(fx); ms.forEach(m => osc('sine', hz(m), t, d, v)); noise(t, d, filt(v, 2500, 'highpass')); },
      scratch: (t, d, g) => { const v = ctx.createGain(); v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(g, t + 0.05); v.gain.setValueAtTime(g, t + d - 0.1); v.gain.linearRampToValueAtTime(0, t + d); v.connect(fx); const tr = ctx.createGain(); tr.gain.value = 0.5; tr.connect(v); const lfo = ctx.createOscillator(); lfo.frequency.value = 13; const lg = ctx.createGain(); lg.gain.value = 0.5; lfo.connect(lg); lg.connect(tr.gain); lfo.start(t); lfo.stop(t + d); noise(t, d, filt(tr, 2800, 'highpass')); },
    };
    const MOOD = L.mood || 'calm';
    const P = { calm: { bpm: 84, key: 'bright' }, bright: { bpm: 100, key: 'bright' }, serious: { bpm: 70, key: 'dark' } }[MOOD] || { bpm: 84, key: 'bright' };
    const beat = 60 / P.bpm, bar = beat * 4;
    const endT = (HITS.find(h => h.kind === 'end') || { t: DUR - 1 }).t;
    // 배경음
    for (let b = 0; b * bar < Math.min(DUR, endT + bar); b++) {
      const t0 = b * bar, ch = chord(b, P.key);
      if (MOOD === 'serious') { I.strings(t0, ch.map(m => m + 12), bar * 1.05, 0.05); I.sub(t0, ch[0] - 12, bar * 0.9, 0.18); if (b && t0 < endT) { I.heart(t0, 0.35); I.heart(t0 + beat * 2, 0.25); } continue; }
      I.keys(t0, ch.map(m => m + 12), bar * 0.98, 0.16); I.sub(t0, ch[0] - 12, bar * 0.9, 0.14);
      if (MOOD === 'bright') for (let k = 0; k < 8; k++) I.pluck(t0 + k * beat / 2, ch[k % 3] + 24, 0.2, 0.05);
      if (b === 0 || t0 >= endT) continue;
      for (let k = 0; k < 4; k++) {
        const tb = t0 + k * beat;
        if (k % 2 === 0) I.kick(tb, MOOD === 'calm' ? 0.4 : 0.5); else (MOOD === 'calm' ? I.rim(tb, 0.16) : I.clap(tb, 0.13));
        I.hat(tb, 0.05); I.hat(tb + beat / 2 + beat * 0.06, 0.035);
      }
    }
    I.pad(endT, chord(0, P.key).map(m => m + 12), 3.2, 0.06);
    // 효과음 — 화면의 사건마다
    const SC = P.key === 'bright' ? [62, 64, 66, 69, 71, 74, 76, 78, 81, 83, 86] : [62, 65, 67, 69, 72, 74, 77, 79, 81];
    let hop = 0;
    for (const { t, kind } of HITS) {
      if (kind === 'pop') { I.pluck(t, SC[5], 0.25, 0.14); I.bell(t, SC[7], 0.6, 0.1); }
      else if (kind === 'sweep') I.riser(t, 0.9, 0.08);
      else if (kind === 'rise') I.pluck(t, SC[3], 0.2, 0.09);
      else if (kind === 'words') I.rim(t, 0.08, fx);
      else if (kind === 'mark') { I.swish(t, 0.45, 2200, 7000, 0.12); I.bell(t + 0.4, SC[6], 0.5, 0.07); }
      else if (kind === 'draw') { I.riser(t, 1.3, 0.06); I.bell(t, SC[4], 0.8, 0.06); }
      else if (kind === 'hop') { I.pluck(t, SC[Math.min(SC.length - 1, 3 + hop % 6)], 0.2, 0.12); hop++; }
      else if (kind === 'grow') { I.pluck(t, SC[Math.min(SC.length - 1, 2 + hop % 7)], 0.25, 0.11); hop++; }
      else if (kind === 'tick') { I.rim(t, 0.14, fx); I.bell(t, SC[5 + hop % 3], 0.7, 0.09); hop++; }
      else if (kind === 'strike') I.swish(t, 0.4, 1500, 5000, 0.14);
      else if (kind === 'wrong') { I.buzz(t, 45, 0.12); I.buzz(t + 0.17, 44, 0.12); }
      else if (kind === 'rewind') I.rewind(t - 0.1, 0.6, [SC[0], SC[4]], 0.12);
      else if (kind === 'right') [SC[5], SC[6], SC[8]].forEach((m, j) => I.bell(t + j * 0.05, m, 1.4, 0.11));
      else if (kind === 'write') I.scratch(t, 1.1, 0.05);
      else if (kind === 'stamp') { I.kick(t, 0.7); noise(t, 0.12, filt(vca(fx, t, 0.001, 0.1, 0.35), 900)); I.rim(t + 0.01, 0.12, fx); }
      else if (kind === 'end') { I.bell(t, SC[5], 2.4, 0.13); I.bell(t + 0.08, SC[8], 2.4, 0.08); }
    }
    SCENES.forEach((s, i) => { if (i && ((L.scenes[i] && L.scenes[i].style) || L.style || L.theme) === 'cinema') I.boom(s.t0 + 0.05, 0.5); });   // 장면이 바뀔 때마다 낮게 쾅
    // 녹음(선생님 목소리) — 장면 시작 0.35초 뒤 · 말하는 동안 배경음을 낮춘다
    for (let i = 0; i < L.scenes.length; i++) {
      const sc = L.scenes[i]; if (!sc.voiceData) continue;
      try {
        const ab = await (await fetch(sc.voiceData)).arrayBuffer(); const buf = await ctx.decodeAudioData(ab);
        const t = SCENES[i].t0 + 0.35, s = ctx.createBufferSource(); s.buffer = buf; const g = ctx.createGain(); g.gain.value = 1.0; s.connect(g); g.connect(vo); s.start(t);
        bed.gain.setTargetAtTime(0.35, t - 0.1, 0.08); bed.gain.setTargetAtTime(1, t + buf.duration, 0.25);
      } catch (e) { console.warn('녹음을 읽지 못함', i + 1, e); }
    }
    master.gain.setValueAtTime(1, Math.max(0, DUR - 0.6)); master.gain.linearRampToValueAtTime(0, DUR + 0.2);
    const out = await ctx.startRendering(), d = out.getChannelData(0);
    let sq = 0; for (let i = 0; i < d.length; i++) sq += d[i] * d[i];
    const k = Math.pow(10, -17 / 20) / (Math.sqrt(sq / d.length) || 1), th = Math.tanh(1.1);
    for (let i = 0; i < d.length; i++) d[i] = Math.tanh(d[i] * k * 1.1) * 0.97;   // 1 을 넘지 않게(큰북 찢어짐 방지)
    return out;
  }
  const wav = buf => {
    const d = buf.getChannelData(0), n = d.length, ab = new ArrayBuffer(44 + n * 2), v = new DataView(ab);
    const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, buf.sampleRate, true); v.setUint32(28, buf.sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 32000, true);
    return new Uint8Array(ab);
  };
  const wavBase64 = buf => { const u = wav(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };

  // ================= 수업용 재생기 =================
  // 스페이스 · 클릭 = 재생/멈춤 · → / ← = 다음/앞 장면 · F = 전체 화면 · R = 처음부터 · 멈춰 있으면 제목 화면이 표지
  function player(inst, stage) {
    const { W, H, DUR, SCENES, seek } = inst;
    const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
    Object.assign(document.body.style, { margin: 0, background: '#000', width: '100vw', height: '100vh', display: 'grid', placeItems: 'center', cursor: 'pointer', overflow: 'hidden' });
    const fit = () => { const k = Math.min(innerWidth / W, innerHeight / H); stage.style.transform = `scale(${k})`; stage.style.transformOrigin = '0 0'; stage.style.marginRight = (W * k - W) + 'px'; stage.style.marginBottom = (H * k - H) + 'px'; };
    fit(); addEventListener('resize', fit);
    let ac = null, buf = null, src = null, playing = false, started = false, t = 0, last = performance.now(), idle = 0;
    inst.audio().then(b => { buf = b; }).catch(e => console.warn('소리를 만들지 못함', e));
    const hint = document.createElement('div'); document.body.appendChild(hint);
    Object.assign(hint.style, { position: 'fixed', left: '50%', bottom: '4vh', transform: 'translateX(-50%)', padding: '10px 18px', borderRadius: '999px', background: 'rgba(0,0,0,.72)', color: '#fff', font: "500 15px 'KR', sans-serif", transition: 'opacity .4s', zIndex: 9, whiteSpace: 'nowrap' });
    hint.textContent = '▶ 클릭 · 스페이스 = 재생   → ← 장면 넘기기   F 전체 화면';
    const starts = SCENES.map(s => s.t0);
    const stopA = () => { if (src) { try { src.stop(); } catch (e) {} src = null; } };
    const startA = () => { stopA(); if (!buf) return; ac = ac || new (window.AudioContext || window.webkitAudioContext)(); src = ac.createBufferSource(); src.buffer = buf; src.connect(ac.destination); src.start(0, t); };
    const go = nt => { started = true; t = clamp(nt, 0, DUR - 0.01); idle = 0; if (playing) startA(); };
    const loop = now => {
      const dt = (now - last) / 1000; last = now;
      if (playing) { t += dt; if (t >= DUR - 0.01) { t = DUR - 0.01; playing = false; stopA(); } }
      idle += dt; hint.style.opacity = playing && idle > 2.5 ? 0 : 1;
      seek(started ? t : inst.poster); requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    const toggle = () => { started = true; if (t >= DUR - 0.02) t = 0; playing = !playing; if (playing) startA(); else stopA(); idle = 0; };
    addEventListener('click', toggle);
    addEventListener('mousemove', () => { idle = 0; });
    addEventListener('keydown', e => {
      if (e.code === 'Space') { e.preventDefault(); toggle(); }
      else if (e.code === 'ArrowRight') { const n = starts.find(x => x > t + 0.05); go(n != null ? n : DUR - 0.01); }
      else if (e.code === 'ArrowLeft') { const c = [...starts].reverse().find(x => x <= t - 0.6); go(c != null ? c : 0); }
      else if (e.code === 'KeyF') { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {}); }
      else if (e.code === 'KeyR') go(0);
    });
  }

  window.PeaceClass = { mount, player, STYLES, wav, wavBase64, ARTS, artURL: (n, sid = 'grid', acc = '#0077b6') => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(artSVG(n, sid, acc).svg) };
  // 수업용 파일 · 렌더용 페이지: LESSON 과 #stage 가 있으면 바로 띄운다
  const st = document.getElementById('stage');
  if (window.LESSON && st && !window.__NO_AUTO__) {
    const inst = mount(st, window.LESSON);
    Object.assign(window, { READY: inst.READY, seek: inst.seek, DUR: inst.DUR, HITS: inst.HITS, QA: inst.QA, TEXTS: inst.TEXTS, SCENES: inst.SCENES, AUDIO: inst.audio });
    if (!window.__RENDER_MODE__) inst.READY.then(() => player(inst, st));
  }
})();
