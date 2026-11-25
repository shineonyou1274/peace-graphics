"""peace-class 한 줄 명령 — 수업 원고(lesson.json) → 미리보기 · 점검 · 영상.

  python3 peace.py new   <작업 폴더> [--from 예시이름]   새 작업 폴더 (예시: math-slope · history-joseon · science-orbit …)
  python3 peace.py build <작업 폴더>                    lesson.html + 글꼴 (브라우저로 열면 바로 미리보기)
  python3 peace.py check <작업 폴더>                    점검 · 소리 · 정지 화면 시트 · 화면 글자 목록   ⏸ 선생님 확인
  python3 peace.py video <작업 폴더> [--draft]          mp4 (draft = 빠른 720p)

작업 폴더: lesson.json · voice/(녹음) · build/(결과)
"""
import json
import os
import re
import shutil
import subprocess
import sys
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
SKILL = os.path.dirname(HERE)
FF = os.environ.get('FFMPEG', 'ffmpeg')
cmd, work = sys.argv[1], os.path.abspath(sys.argv[2])
opt = sys.argv[3:]
B = os.path.join(work, 'build')


def run(args, **kw):
    r = subprocess.run(args, cwd=work, **kw)
    if r.returncode:
        sys.exit(r.returncode)


def wav_len(path):
    out = subprocess.run([FF, '-i', path], capture_output=True, text=True).stderr
    m = re.search(r'Duration: (\d+):(\d+):([\d.]+)', out)
    return int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3]) if m else 0


FONTS = [("Noto Sans KR", 500, "kr-500"), ("Noto Sans KR", 900, "kr-900"), ("Nanum Pen Script", None, "pen"), ("Anton", None, "anton")]
FIXED = '개념흔한실수바르게vsPEACECLASS0123456789/:·—+-.,()%' + ''.join(chr(c) for c in range(32, 127))


def fonts(text):
    """쓴 글자만 담은 글꼴 조각을 받는다(글자를 바꾸면 build 를 다시)."""
    chars = ''.join(sorted(set(text + FIXED)))
    out = os.path.join(work, 'fonts'); os.makedirs(out, exist_ok=True)
    for fam, w, name in FONTS:
        q = 'https://fonts.googleapis.com/css2?family=' + fam.replace(' ', '+') + (f':wght@{w}' if w else '') + '&text=' + urllib.parse.quote(chars)
        css = urllib.request.urlopen(urllib.request.Request(q, headers={'User-Agent': 'Mozilla/5.0 Chrome/120'})).read().decode()
        url = re.search(r'url\((.*?)\)', css).group(1)
        open(os.path.join(out, name + '.woff2'), 'wb').write(urllib.request.urlopen(url).read())
    print(f'글꼴 {len(FONTS)}개 · 글자 {len(chars)}개 → fonts/')


if cmd == 'new':
    os.makedirs(work, exist_ok=True)
    ex = opt[opt.index('--from') + 1] if '--from' in opt else 'math-slope'
    shutil.copy(os.path.join(SKILL, 'examples', ex + '.json'), os.path.join(work, 'lesson.json'))
    os.makedirs(os.path.join(work, 'voice'), exist_ok=True)
    print(f'새 작업 폴더: {work} (예시 {ex}) — lesson.json 을 수업 원고로 고친 뒤 build')

elif cmd == 'build':
    lesson = json.load(open(os.path.join(work, 'lesson.json'), encoding='utf-8'))
    for sc in lesson['scenes']:  # 녹음이 있으면 말 길이 + 여유만큼은 머문다
        if sc.get('voice'):
            sc['minDur'] = round(wav_len(os.path.join(work, sc['voice'])) + 1.2, 2)
    eng = os.path.join(work, 'engine')
    shutil.rmtree(eng, ignore_errors=True); shutil.copytree(os.path.join(SKILL, 'engine'), eng, ignore=shutil.ignore_patterns('template.html'))
    tpl = open(os.path.join(SKILL, 'engine', 'template.html'), encoding='utf-8').read()
    data = json.dumps(lesson, ensure_ascii=False).replace('</', '<\\/')
    html = tpl.replace('{{TITLE}}', lesson.get('title', '수업 영상')).replace('{{LESSON}}', data)
    open(os.path.join(work, 'lesson.html'), 'w', encoding='utf-8').write(html)
    if '--no-fonts' not in opt:
        fonts(json.dumps(lesson, ensure_ascii=False))
    print('lesson.html — 브라우저로 열면 미리보기(클릭 = 재생/멈춤 · ←→ 2초)')

elif cmd == 'check':
    os.makedirs(B, exist_ok=True)
    run(['node', os.path.join(HERE, 'render.mjs'), '--html', 'lesson.html', '--info'])
    info = json.load(open(os.path.join(B, 'info.json'), encoding='utf-8'))
    run([sys.executable, os.path.join(HERE, 'class_audio.py'), work])
    ts = [round(s['t0'] + s['dur'] - 0.55, 2) for s in info['SCENES']]
    run(['node', os.path.join(HERE, 'render.mjs'), '--html', 'lesson.html', '--at', ','.join(map(str, ts))])
    from PIL import Image, ImageDraw
    ims = [Image.open(os.path.join(B, f'at_{t:.2f}.png')) for t in ts]
    w, h = ims[0].size; k = 480 / max(w, h); tw, th = int(w * k), int(h * k); cols = 4 if w > h else 6
    rows = (len(ims) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * (tw + 12) + 12, rows * (th + 40) + 12), (24, 24, 28)); d = ImageDraw.Draw(sheet)
    for i, im in enumerate(ims):
        x, y = 12 + i % cols * (tw + 12), 12 + i // cols * (th + 40)
        sheet.paste(im.convert('RGB').resize((tw, th)), (x, y + 28)); d.text((x, y + 8), f"{i + 1}. {info['SCENES'][i]['type']}  {ts[i]:.1f}s", fill=(220, 220, 220))
    sheet.save(os.path.join(B, '정지화면.png'))
    with open(os.path.join(B, '화면글자.md'), 'w', encoding='utf-8') as f:
        f.write('# 화면에 나오는 글자 — 원고 · 교과서와 한 줄씩 대조해 주세요\n\n' + '\n'.join(f'- {t}' for t in info['TEXTS'] if t.strip()) + '\n')
    print(f"\n길이 {info['DUR']:.1f}초 · 장면 {len(ts)}개")
    print('점검: ' + ('이상 없음' if not info['QA'] else '\n  ' + '\n  '.join(info['QA'])))
    print('→ build/정지화면.png · build/화면글자.md · build/music.wav')

elif cmd == 'video':
    info = json.load(open(os.path.join(B, 'info.json'), encoding='utf-8'))
    draft = '--draft' in opt
    fps, sub = (24, 1) if draft else (30, 2)
    n = min(os.cpu_count() or 2, 4, max(1, int(info['DUR'] // 8)))
    seg = info['DUR'] / n
    jobs = [['node', os.path.join(HERE, 'render.mjs'), '--html', 'lesson.html', '--out', f'build/s{i}.mp4', '--from', f'{i * seg:.4f}', '--to', f'{(i + 1) * seg:.4f}', '--fps', str(fps), '--sub', str(sub)] + (['--scale', '720'] if draft else []) for i in range(n)]
    with ThreadPoolExecutor(n) as ex:
        codes = list(ex.map(lambda a: subprocess.run(a, cwd=work).returncode, jobs))
    if any(codes):
        sys.exit('구간 렌더 실패')
    open(os.path.join(B, 's.txt'), 'w').write(''.join(f"file 's{i}.mp4'\n" for i in range(n)))
    name = re.sub(r'[\\/:*?"<>|\s]+', '_', json.load(open(os.path.join(work, 'lesson.json'), encoding='utf-8')).get('title', 'lesson'))
    out = os.path.join(B, f"{name}{'_초안' if draft else ''}.mp4")
    run([FF, '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', 'build/s.txt', '-i', 'build/music.wav', '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out])
    for i in range(n):
        os.remove(os.path.join(B, f's{i}.mp4'))
    print('→', os.path.relpath(out, work))
else:
    sys.exit(__doc__)
