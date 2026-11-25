"""peace-class 한 줄 명령 — 수업 시나리오(lesson.json) → 스튜디오 · 수업용 파일 · (선택) 영상.

  python3 peace.py new    <작업 폴더> [--from 예시]   새 작업 폴더 (예시: science-photosynthesis · math-slope · history-joseon · math-data)
  python3 peace.py studio <작업 폴더>                 ★ 수업 영상 스튜디오 파일 하나 — 선생님이 스타일을 눈으로 고르고 · 글을 고치고 · 녹음하고 · 수업용 파일로 저장
  python3 peace.py share  <작업 폴더>                 수업용 파일 하나(재생기) — 글꼴 · 수식 · 소리 포함 · 어디서나 재생
  python3 peace.py build  <작업 폴더>                 렌더용 lesson.html (check · video 가 쓴다)
  python3 peace.py check  <작업 폴더>                 점검 · 정지 화면 시트 · 화면 글자 목록 · 소리   (Node + Playwright 가 있을 때)
  python3 peace.py video  <작업 폴더> [--draft]       mp4 (Node + Playwright + ffmpeg 가 있을 때)
  python3 peace.py blank  <출력.html>                 예시만 담은 빈 스튜디오 (배포용)

필요한 것: Python 3 표준 라이브러리만. fontTools + brotli 가 있으면 글꼴을 쓴 글자만 잘라 파일이 작아진다.
"""
import base64
import json
import os
import re
import shutil
import subprocess
import sys
import wave
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
SKILL = os.path.dirname(HERE)
ENG = os.path.join(SKILL, 'engine')
FONT_SRC = os.path.join(SKILL, 'assets', 'fonts')
FF = os.environ.get('FFMPEG', 'ffmpeg')
FONTS = ['kr-500', 'kr-900', 'pen', 'anton']   # Pretendard · Nanum Pen Script · Anton (모두 OFL)
FIXED = '개념흔한실수바르게vsPEACECLASS0123456789/:·—+-.,()%→✕✓▶■●' + ''.join(chr(c) for c in range(32, 127))

if len(sys.argv) < 3:
    sys.exit(__doc__)
cmd, work = sys.argv[1], os.path.abspath(sys.argv[2])
opt = sys.argv[3:]
B = os.path.join(work, 'build')


def read(p, mode='r'):
    with open(p, mode, **({} if 'b' in mode else {'encoding': 'utf-8'})) as f:
        return f.read()


def b64(data, mime):
    return f'data:{mime};base64,' + base64.b64encode(data).decode()


def run(args):
    r = subprocess.run(args, cwd=work)
    if r.returncode:
        sys.exit(r.returncode)


def load_lesson():
    L = json.loads(read(os.path.join(work, 'lesson.json')))
    for sc in L['scenes']:   # 녹음 파일 경로 → 파일 안에 담기
        v = sc.pop('voice', None)
        if v and not sc.get('voiceData'):
            p = os.path.join(work, v)
            ext = os.path.splitext(p)[1].lower().lstrip('.')
            sc['voiceData'] = b64(read(p, 'rb'), {'mp3': 'audio/mpeg', 'm4a': 'audio/mp4', 'webm': 'audio/webm', 'ogg': 'audio/ogg'}.get(ext, 'audio/wav'))
            sc['voiceDur'] = round(audio_len(p), 2)
        src = sc.get('src')   # 사진 경로 → 파일 안에 담기
        if sc.get('type') == 'photo' and src and not src.startswith('data:'):
            p = os.path.join(work, src)
            ext = os.path.splitext(p)[1].lower().lstrip('.')
            sc['src'] = b64(read(p, 'rb'), {'png': 'image/png', 'webp': 'image/webp', 'gif': 'image/gif', 'svg': 'image/svg+xml'}.get(ext, 'image/jpeg'))
    if 'theme' in L and 'style' not in L:
        L['style'] = L.pop('theme')
    return L


def audio_len(p):
    try:
        with wave.open(p) as w:
            return w.getnframes() / w.getframerate()
    except Exception:
        out = subprocess.run([FF, '-i', p], capture_output=True, text=True).stderr
        m = re.search(r'Duration: (\d+):(\d+):([\d.]+)', out)
        return int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3]) if m else 3.0


def font_files(text=None):
    """글꼴 woff2 바이트. text 가 있으면 쓴 글자만 자른다(fontTools 가 없으면 통째로)."""
    out = {}
    if text is not None:
        try:
            from fontTools import subset
            chars = ''.join(sorted(set(text + FIXED)))
            for name in FONTS:
                o = subset.Options(); o.flavor = 'woff2'; o.layout_features = ['*']
                f = subset.load_font(os.path.join(FONT_SRC, name + '.woff2'), o)
                sb = subset.Subsetter(o); sb.populate(text=chars); sb.subset(f)
                tmp = os.path.join(work, '.font.tmp')
                subset.save_font(f, tmp, o); out[name] = read(tmp, 'rb'); os.remove(tmp)
            return out
        except Exception:
            pass
    return {n: read(os.path.join(FONT_SRC, n + '.woff2'), 'rb') for n in FONTS}


def inline_assets(text=None):
    style = read(os.path.join(ENG, 'style.css'))
    for name, data in font_files(text).items():
        style = style.replace(f"url('../fonts/{name}.woff2')", f"url('{b64(data, 'font/woff2')}')")
    kdir = os.path.join(ENG, 'katex')
    kcss = read(os.path.join(kdir, 'katex.min.css'))
    kcss = re.sub(r'url\((fonts/[^)]+\.woff2)\)', lambda m: 'url(' + b64(read(os.path.join(kdir, m[1]), 'rb'), 'font/woff2') + ')', kcss)
    kcss = re.sub(r',url\(fonts/[^)]+\.(woff|ttf)\) format\("(woff|truetype)"\)', '', kcss)
    js = lambda p: read(p).replace('</script', '<\\/script')
    return style, kcss, js(os.path.join(kdir, 'katex.min.js')), js(os.path.join(ENG, 'runtime.js'))


def dumps(o):
    return json.dumps(o, ensure_ascii=False).replace('</', '<\\/')


def examples():
    out = []
    for f in sorted(os.listdir(os.path.join(SKILL, 'examples'))):
        if f.endswith('.json'):
            L = json.loads(read(os.path.join(SKILL, 'examples', f)))
            out.append({'name': f"{L.get('subject', '')} · {L.get('title', f)}", 'lesson': L})
    return out


def studio_html(L, path):
    style, kcss, kjs, rt = inline_assets(None)   # 스튜디오는 무슨 글이든 칠 수 있게 글꼴 통째로
    tpl = read(os.path.join(ENG, 'studio.html'))
    rep = {'{{TITLE}}': L.get('title', '수업'), '{{KATEX_CSS}}': kcss, '{{STYLE}}': style, '{{STUDIO_CSS}}': read(os.path.join(ENG, 'studio.css')),
           '{{KATEX_JS}}': kjs, '{{RUNTIME}}': rt, '{{LESSON}}': dumps(L), '{{EXAMPLES}}': dumps(examples()),
           '{{STUDIO_JS}}': read(os.path.join(ENG, 'studio.js')).replace('</script', '<\\/script')}
    for k, v in rep.items():
        tpl = tpl.replace(k, v)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(tpl)
    print(f'→ {os.path.basename(path)} ({os.path.getsize(path) / 1e6:.1f}MB) — 브라우저로 열어 스타일 고르기 · 글 고치기 · 녹음 · "수업용 파일 저장"')


def slug(L):
    return re.sub(r'[\\/:*?"<>|\s]+', '_', L.get('title', 'lesson'))


if cmd == 'new':
    os.makedirs(work, exist_ok=True)
    ex = opt[opt.index('--from') + 1] if '--from' in opt else 'science-photosynthesis'
    shutil.copy(os.path.join(SKILL, 'examples', ex + '.json'), os.path.join(work, 'lesson.json'))
    os.makedirs(os.path.join(work, 'voice'), exist_ok=True)
    print(f'새 작업 폴더: {work} (예시 {ex}) — lesson.json 을 수업 시나리오로 고친 뒤 studio')

elif cmd == 'studio':
    L = load_lesson()
    studio_html(L, os.path.join(work, f'{slug(L)}_스튜디오.html'))

elif cmd == 'blank':
    ex = examples()
    os.makedirs(os.path.dirname(work) or '.', exist_ok=True)
    first = next((e for e in ex if e['lesson'].get('title') == '광합성'), ex[0])   # 처음 여는 선생님께는 16:9 과학 예시
    studio_html(first['lesson'], work)

elif cmd == 'share':
    L = load_lesson()
    style, kcss, kjs, rt = inline_assets(json.dumps(L, ensure_ascii=False))
    html = (f'<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
            f'<title>{L.get("title", "수업")}</title><style>{kcss}</style><style>{style}</style></head><body><div id="stage"></div>\n'
            f'<script>{kjs}</script>\n<script>window.LESSON = {dumps(L)};</script>\n<script>{rt}</script></body></html>')
    out = os.path.join(work, f'{slug(L)}_수업용.html')
    with open(out, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f'→ {os.path.basename(out)} ({os.path.getsize(out) / 1e6:.1f}MB) — 이 파일 하나만 보내면 어디서나 재생됩니다')

elif cmd == 'build':
    L = load_lesson()
    eng = os.path.join(work, 'engine'); shutil.rmtree(eng, ignore_errors=True)
    shutil.copytree(ENG, eng, ignore=shutil.ignore_patterns('*.html', 'studio.*'))
    fd = os.path.join(work, 'fonts'); os.makedirs(fd, exist_ok=True)
    for name, data in font_files(json.dumps(L, ensure_ascii=False)).items():
        with open(os.path.join(fd, name + '.woff2'), 'wb') as f:
            f.write(data)
    html = read(os.path.join(ENG, 'template.html')).replace('{{TITLE}}', L.get('title', '수업')).replace('{{LESSON}}', dumps(L))
    with open(os.path.join(work, 'lesson.html'), 'w', encoding='utf-8') as f:
        f.write(html)
    print('lesson.html (렌더용)')

elif cmd == 'check':
    os.makedirs(B, exist_ok=True)
    run(['node', os.path.join(HERE, 'render.mjs'), '--html', 'lesson.html', '--info'])
    info = json.loads(read(os.path.join(B, 'info.json')))
    ts = [round(s['t0'] + s['dur'] - 0.55, 2) for s in info['SCENES']]
    run(['node', os.path.join(HERE, 'render.mjs'), '--html', 'lesson.html', '--at', ','.join(map(str, ts))])
    try:
        from PIL import Image, ImageDraw
        ims = [Image.open(os.path.join(B, f'at_{t:.2f}.png')) for t in ts]
        w, h = ims[0].size; k = 480 / max(w, h); tw, th = int(w * k), int(h * k); cols = 4 if w > h else 6
        rows = (len(ims) + cols - 1) // cols
        sheet = Image.new('RGB', (cols * (tw + 12) + 12, rows * (th + 40) + 12), (24, 24, 28)); d = ImageDraw.Draw(sheet)
        for i, im in enumerate(ims):
            x, y = 12 + i % cols * (tw + 12), 12 + i // cols * (th + 40)
            sheet.paste(im.convert('RGB').resize((tw, th)), (x, y + 28)); d.text((x, y + 8), f"{i + 1}. {info['SCENES'][i]['type']}  {ts[i]:.1f}s", fill=(220, 220, 220))
        sheet.save(os.path.join(B, '정지화면.png'))
    except ImportError:
        print('(Pillow 가 없어 정지 화면 시트는 건너뜀 — build/at_*.png 를 보세요)')
    with open(os.path.join(B, '화면글자.md'), 'w', encoding='utf-8') as f:
        f.write('# 화면에 나오는 글자 — 원고 · 교과서와 한 줄씩 대조해 주세요\n\n' + '\n'.join(f'- {t}' for t in info['TEXTS'] if t.strip()) + '\n')
    print(f"\n길이 {info['DUR']:.1f}초 · 장면 {len(ts)}개")
    print('점검: ' + ('이상 없음' if not info['QA'] else '\n  ' + '\n  '.join(info['QA'])))
    print('→ build/정지화면.png · build/화면글자.md · build/music.wav')

elif cmd == 'video':
    info = json.loads(read(os.path.join(B, 'info.json')))
    draft = '--draft' in opt
    fps, sub = (24, 1) if draft else (30, 2)
    n = min(os.cpu_count() or 2, 4, max(1, int(info['DUR'] // 8)))
    seg = info['DUR'] / n
    jobs = [['node', os.path.join(HERE, 'render.mjs'), '--html', 'lesson.html', '--out', f'build/s{i}.mp4', '--from', f'{i * seg:.4f}', '--to', f'{(i + 1) * seg:.4f}', '--fps', str(fps), '--sub', str(sub)] + (['--scale', '720'] if draft else []) for i in range(n)]
    with ThreadPoolExecutor(n) as ex:
        codes = list(ex.map(lambda a: subprocess.run(a, cwd=work).returncode, jobs))
    if any(codes):
        sys.exit('구간 렌더 실패')
    with open(os.path.join(B, 's.txt'), 'w') as f:
        f.write(''.join(f"file 's{i}.mp4'\n" for i in range(n)))
    out = os.path.join(B, f"{slug(json.loads(read(os.path.join(work, 'lesson.json'))))}{'_초안' if draft else ''}.mp4")
    run([FF, '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', 'build/s.txt', '-i', 'build/music.wav', '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out])
    for i in range(n):
        os.remove(os.path.join(B, f's{i}.mp4'))
    print('→', os.path.relpath(out, work))
else:
    sys.exit(__doc__)
