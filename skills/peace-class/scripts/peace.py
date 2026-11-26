"""peace-class 한 줄 명령 — 수업 시나리오(lesson.json) → 스튜디오 · 수업용 파일 · (선택) 영상.

  python3 peace.py new    <작업 폴더> [--from 예시]   새 작업 폴더 (예시: science-photosynthesis · math-slope · history-joseon · math-data)
  python3 peace.py studio <작업 폴더>                 ★ 수업 영상 스튜디오 파일 하나 — 선생님이 스타일을 눈으로 고르고 · 글을 고치고 · 녹음하고 · 수업용 파일로 저장
  python3 peace.py share  <작업 폴더>                 수업용 파일 하나(재생기) — 글꼴 · 수식 · 소리 포함 · 어디서나 재생
  python3 peace.py build  <작업 폴더>                 렌더용 lesson.html (check · video 가 쓴다)
  python3 peace.py check  <작업 폴더>                 점검 · 정지 화면 시트 · 화면 글자 목록 · 소리   (Node + Playwright 가 있을 때)
  python3 peace.py video  <작업 폴더> [--draft]       mp4 (Node + Playwright + ffmpeg 가 있을 때)
  python3 peace.py blank  <출력.html>                 예시만 담은 빈 스튜디오 (배포용)
  python3 peace.py doctor                             이 컴퓨터에서 무엇이 되나 · mp4 에 무엇을 깔아야 하나
  python3 peace.py voice-setup                        목소리 복제(Qwen3-TTS)를 이 작업 공간에 설치(처음 한 번 · 몇 분)
  python3 peace.py voice  <작업 폴더> --sample 샘플.m4a --sample-text "샘플에서 한 말"
                                                      장면마다 say(대본)를 선생님 목소리로 — 설치돼 있으면 이 작업 공간에서(토큰 · 외부 전송 없음),
                                                      아니면 허깅페이스 데모(--remote · HF_TOKEN 권장) — 본인 목소리만
  python3 peace.py sync   <작업 폴더>                 목소리와 이름표 맞추기 — 사진 · 모아 보기의 이름표가 그 낱말을 말하는 순간에 나온다

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
FONTS = ['kr-500', 'kr-900', 'pen', 'anton', 'serif', 'pop', 'round', 'chalk', 'pixel', 'brush']   # Pretendard · Nanum Pen Script · Anton · 나눔명조 ExtraBold · Black Han Sans · Jua · Gaegu Bold · Galmuri11 Bold · 나눔손글씨 붓 (모두 OFL)
FIXED = '개념흔한실수바르게vsPEACECLASS0123456789/:·—+-.,()%→✕✓▶■●' + ''.join(chr(c) for c in range(32, 127))



def doctor():
    """이 환경에서 되는 것 · mp4 를 굽는 데 빠진 것을 선생님 말로 알린다."""
    import platform
    osn = platform.system()
    def has(cmd, args=('--version',)):
        exe = shutil.which(cmd)
        if not exe:
            return None
        try:
            out = subprocess.run([exe, *args], capture_output=True, text=True, timeout=20)
            return (out.stdout or out.stderr).strip().splitlines()[0][:60] if (out.stdout or out.stderr) else 'ok'
        except Exception:
            return 'ok'
    py = sys.version.split()[0]
    node = has('node')
    ff = has(FF, ('-version',))
    pw = None
    if node:
        js = ("let m;try{m=require('playwright')}catch(e){try{m=require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright')}catch(e2){}}"
              "if(!m){console.log('NO');process.exit(0)}m.chromium.launch({executablePath:process.env.CHROMIUM||undefined}).then(b=>{console.log('OK');return b.close()}).catch(e=>console.log('NOBROWSER'))")
        try:
            pw = subprocess.run(['node', '-e', js], capture_output=True, text=True, timeout=90).stdout.strip().splitlines()[-1]
        except Exception:
            pw = 'NO'
    ok = lambda v: '✅' if v else '❌'
    print('peace-class 환경 점검')
    print(f'  {ok(True)} Python {py}            → 스튜디오 파일 · 수업용 파일 만들기 (이것만 있으면 됨)')
    print(f'  {ok(node)} Node.js {node or "없음"}')
    print(f'  {ok(pw == "OK")} Playwright + 크로미움 {"" if pw == "OK" else "(" + ("브라우저 없음" if pw == "NOBROWSER" else "없음") + ")"}')
    print(f'  {ok(ff)} ffmpeg {ff or "없음"}')
    try:
        import fontTools  # noqa: F401
        ft = True
    except ImportError:
        ft = False
    try:
        import brotli  # noqa: F401
        br = True
    except ImportError:
        br = False
    print(f'  {ok(ft)} fontTools {"" if ft else "(없으면 수업용 파일에 글꼴을 통째로 담아 커짐 · pip install fonttools)"}')
    print(f'  {ok(br)} brotli {"" if br else "(없으면 글꼴을 woff 로 담아 조금 커짐 · pip install brotli)"}')
    video = bool(node and pw == 'OK' and ff)
    print()
    print('결과: ' + ('mp4 영상까지 만들 수 있어요.' if video else '스튜디오 파일 · 수업용 파일은 돼요. mp4 는 아래를 깔아야 해요(또는 윈도우 화면 녹화 Win+Alt+R).'))
    if not video:
        n_ = not node; f_ = not ff; p_ = pw != 'OK'
        if osn == 'Windows':
            need = (['winget install OpenJS.NodeJS.LTS'] if n_ else []) + (['winget install Gyan.FFmpeg'] if f_ else [])
        elif osn == 'Darwin':
            pk = ' '.join(x for x, w in (('node', n_), ('ffmpeg', f_)) if w)
            need = ['brew install ' + pk] if pk else []
        else:
            pk = ' '.join(x for x, w in (('nodejs npm', n_), ('ffmpeg', f_)) if w)
            need = ['sudo apt-get install -y ' + pk] if pk else []
        if p_:
            need += ['npm install -g playwright', 'npx playwright install' + (' --with-deps' if osn == 'Linux' else '') + ' chromium']
        print('  깔 것 (한 번만 · 터미널에서 차례로):')
        for x in need:
            print('    ' + x)
        print('  다 깔고 터미널을 새로 연 뒤 다시: python3 peace.py doctor')
    print(json.dumps({'python': py, 'node': node, 'playwright': pw, 'ffmpeg': ff, 'video': video, 'os': osn}, ensure_ascii=False))


def tidy_say(t):
    """AI 목소리는 마침표 없이 끝나면 마지막 글자를 삼키기 쉽다 — 끝에 마침표를 붙인다."""
    t = t.strip()
    return t if t[-1:] in '.!?。…~' else t + '.'


TAIL = ' 네.'   # 버리는 꼬리 말 — AI 는 맨 끝 글자를 끊어 버리기 쉬워서, 끊기는 자리를 이 말로 옮긴다


def cut_tail(w, sr):
    """대사 + 꼬리 말로 만든 소리에서, 꼬리 말 앞의 쉼을 찾아 거기서 자르고 부드럽게 줄인다.
    찾지 못하면 None(꼬리가 붙은 채 돌려주지 않는다)."""
    import numpy as np
    n = int(sr * 0.01)
    e = np.array([np.sqrt(np.mean(w[i:i + n] ** 2)) for i in range(0, len(w) - n, n)])
    if not len(e):
        return None
    th = max(0.004, float(np.percentile(e, 90)) * 0.08)
    voiced = np.where(e > th)[0]
    if not len(voiced):
        return None
    last = voiced[-1]
    gaps, run = [], 0
    for i in range(last + 1):   # 0.1초 넘는 쉼들
        if e[i] <= th:
            run += 1
        else:
            if run >= 10:
                gaps.append(i - run)
            run = 0
    gaps = [g for g in gaps if 0.15 <= (last - g) * 0.01 <= 1.8 and g > len(e) * 0.3]   # 꼬리 말 바로 앞의 쉼
    if not gaps:
        return None
    cut = min(len(w), (gaps[-1] + 8) * n)   # 쉼이 시작되고 0.08초까지 두어 끝 글자가 저절로 잦아들게
    out = np.array(w[:cut], dtype='float32')
    f = min(len(out), int(sr * 0.04))
    out[-f:] *= np.linspace(1, 0, f, dtype='float32')
    return out


def pad_tail(path, sec=0.35):
    """끝에 짧은 무음을 붙이고(앞 10ms 페이드) 다시 쓴다."""
    tmp = path + '.tmp.wav'
    subprocess.run([FF, '-y', '-v', 'error', '-i', path, '-af', f'afade=t=in:d=0.01,apad=pad_dur={sec}', tmp], check=True)
    os.replace(tmp, path)


def voice_setup():
    """CPU 용 PyTorch · torchaudio(같은 버전) · qwen-tts 를 깔고 0.6B 목소리 복제 모델을 받아 둔다."""
    try:
        import torch, torchaudio, qwen_tts  # noqa: F401
        print('✅ 이미 설치돼 있어요 (torch', torch.__version__, ')')
    except Exception:
        idx = 'https://download.pytorch.org/whl/cpu'
        # torchaudio 가 torch 보다 늦게 나오므로, torchaudio 의 마지막 판에 torch 를 맞춘다
        out = subprocess.run([sys.executable, '-m', 'pip', 'index', 'versions', 'torchaudio', '--index-url', idx], capture_output=True, text=True).stdout
        m = re.search(r'torchaudio \(([\d.]+)', out)
        ta = m[1] if m else None
        pins = [f'torch=={".".join(ta.split(".")[:2])}.*', f'torchaudio=={ta}+cpu'] if ta else ['torch', 'torchaudio']
        print('설치 중… (CPU 용 PyTorch ' + (ta or '최신') + ' · 몇 분)')
        subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', *pins, '--index-url', idx], check=True)
        subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', 'qwen-tts', 'soundfile', 'faster-whisper'], check=True)
        subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', '--force-reinstall', '--no-deps', *pins[1:], '--index-url', idx], check=True)
    print('모델 받는 중… (Qwen/Qwen3-TTS-12Hz-0.6B-Base · 약 1~2GB · 처음 한 번)')
    from huggingface_hub import snapshot_download
    snapshot_download(VOICE_MODEL)
    print('✅ 준비 끝 — python3 peace.py voice <작업 폴더> --sample 샘플 --sample-text "샘플에서 한 말"')


VOICE_MODEL = os.environ.get('PEACE_VOICE_MODEL', 'Qwen/Qwen3-TTS-12Hz-0.6B-Base')

if len(sys.argv) >= 2 and sys.argv[1] == 'doctor':
    doctor()
    sys.exit(0)
if len(sys.argv) >= 2 and sys.argv[1] == 'voice-setup':
    voice_setup()
    sys.exit(0)
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
        if sc.get('type') in ('photo', 'gallery') and src and not src.startswith('data:'):
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
    """글꼴 바이트와 형식. text 가 있으면 쓴 글자만 자른다.
    woff2 는 brotli 가 있어야 하고, 없으면 woff(zlib · 기본 내장)로 자른다. fontTools 가 없으면 통째로."""
    out, fmt = {}, 'woff2'
    if text is not None:
        try:
            from fontTools import subset
        except ImportError:
            print('ℹ 글꼴 자르기 도구(fontTools)가 없어 글꼴을 통째로 담아요 — 파일이 커집니다(pip install fonttools brotli)')
            subset = None
        if subset:
            try:
                import brotli  # noqa: F401
            except ImportError:
                fmt = 'woff'
                print('ℹ brotli 가 없어 글꼴을 woff 로 잘라 담아요(조금 더 큼) — pip install brotli 면 더 작아집니다')
            chars = ''.join(sorted(set(text + FIXED)))
            import logging
            logging.getLogger('fontTools').setLevel(logging.ERROR)
            for name in FONTS:
                o = subset.Options(); o.flavor = fmt; o.layout_features = ['*']
                f = subset.load_font(os.path.join(FONT_SRC, name + '.woff2'), o)
                sb = subset.Subsetter(o); sb.populate(text=chars); sb.subset(f)
                tmp = os.path.join(work, '.font.tmp')
                subset.save_font(f, tmp, o); out[name] = read(tmp, 'rb'); os.remove(tmp)
            return out, fmt
    return {n: read(os.path.join(FONT_SRC, n + '.woff2'), 'rb') for n in FONTS}, 'woff2'


def inline_assets(text=None):
    style = read(os.path.join(ENG, 'style.css'))
    files, fmt = font_files(text)
    for name, data in files.items():
        style = style.replace(f"url('../fonts/{name}.woff2') format('woff2')", f"url('{b64(data, 'font/' + fmt)}') format('{fmt}')")
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

elif cmd == 'voice':
    # 선생님 목소리 샘플 → 장면마다 대본(say)을 그 목소리로 (Qwen3-TTS · Apache-2.0 공개 모델, 허깅페이스 Space)
    def val(k):
        return opt[opt.index(k) + 1] if k in opt and opt.index(k) + 1 < len(opt) else None
    sample, stext = val('--sample'), val('--sample-text')
    if not sample or not stext:
        sys.exit('--sample 샘플.wav --sample-text "샘플에서 한 말 그대로" 가 필요해요')
    lp = os.path.join(work, 'lesson.json')
    L = json.loads(read(lp))
    os.makedirs(os.path.join(work, 'voice'), exist_ok=True)
    only = val('--only')
    local = '--remote' not in opt
    if local:
        try:
            import torch, numpy as np, soundfile as sf
            from qwen_tts import Qwen3TTSModel
        except Exception:
            local = False
            print('ℹ 이 작업 공간에 목소리 복제가 설치돼 있지 않아 허깅페이스 데모로 해요 (설치: python3 peace.py voice-setup)')
    if local:
        # 샘플(휴대폰 m4a 도)을 24kHz 모노 wav 로
        ref = os.path.join(work, 'voice', '_sample.wav')
        subprocess.run([FF, '-y', '-v', 'error', '-i', os.path.abspath(sample), '-ac', '1', '-ar', '24000', ref], check=True)
        rw, rsr = sf.read(ref, dtype='float32')
        tail = rw[-int(rsr * 0.15):] if len(rw) > rsr else rw
        if len(tail) and float(np.sqrt(np.mean(tail ** 2))) > 0.02:
            print('⚠ 샘플이 말하는 도중에 끝난 것 같아요(마지막 글자가 씹혔을 수 있음). 마지막 "…요/…다" 까지 말하고 1초 쉰 뒤 멈춰 다시 녹음하면 목소리 끝도 또렷해져요.')
        torch.set_num_threads(os.cpu_count() or 4)
        print(f'목소리 모델 불러오는 중… ({VOICE_MODEL} · CPU)')
        tts = Qwen3TTSModel.from_pretrained(VOICE_MODEL, device_map='cpu', dtype=torch.float32)
        import time
        for i, sc in enumerate(L['scenes']):
            say = (sc.get('say') or '').strip()
            if not say or (only and str(i + 1) not in only.split(',')):
                continue
            t0 = time.time()
            out = os.path.join('voice', f'{i + 1:02d}.wav')
            clip = None
            for _try in range(2):   # 꼬리 말 앞 쉼을 못 찾으면 한 번 더
                wavs, sr = tts.generate_voice_clone(text=tidy_say(say) + TAIL, language='Korean', ref_audio=(rw, rsr), ref_text=stext, x_vector_only_mode=False, max_new_tokens=2048)
                clip = cut_tail(np.asarray(wavs[0], dtype='float32'), sr)
                if clip is not None:
                    break
            if clip is None:   # 그래도 안 되면 꼬리 없이 만들고 끝만 부드럽게
                print(f'  ⚠ 장면 {i + 1}: 끝맺음을 다듬지 못해 꼬리 없이 만들어요 — 끝 글자를 들어 보세요')
                wavs, sr = tts.generate_voice_clone(text=tidy_say(say), language='Korean', ref_audio=(rw, rsr), ref_text=stext, x_vector_only_mode=False, max_new_tokens=2048)
                clip = np.asarray(wavs[0], dtype='float32'); f = int(sr * 0.04); clip[-f:] *= np.linspace(1, 0, f, dtype='float32')
            sf.write(os.path.join(work, out), clip, sr)
            pad_tail(os.path.join(work, out))
            sc['voice'] = out; sc.pop('voiceData', None); sc.pop('voiceDur', None)
            print(f'  장면 {i + 1:02d} → {out} ({audio_len(os.path.join(work, out)):.1f}초 · {time.time() - t0:.0f}초 걸림)')
            with open(lp, 'w', encoding='utf-8') as f:
                json.dump(L, f, ensure_ascii=False, indent=2)
        print('→ lesson.json 에 목소리를 달았어요. 이제 studio · share · video 로 파일을 만드세요.')
        sys.exit(0)
    try:
        from gradio_client import Client, handle_file
    except ImportError:
        sys.exit('pip install gradio_client 를 먼저 해 주세요 (또는 python3 peace.py voice-setup 으로 이 작업 공간에 설치)')
    space = val('--space') or 'Qwen/Qwen3-TTS'
    tok = os.environ.get('HF_TOKEN')
    try:
        c = Client(space, verbose=False, **({'token': tok} if tok else {}))
    except TypeError:
        c = Client(space, verbose=False, hf_token=tok) if tok else Client(space, verbose=False)
    for i, sc in enumerate(L['scenes']):
        say = (sc.get('say') or '').strip()
        if not say or (only and str(i + 1) not in only.split(',')):
            continue
        out = os.path.join('voice', f'{i + 1:02d}.wav')
        try:
            a, st = c.predict(handle_file(os.path.abspath(sample)), stext, tidy_say(say), 'Korean', False, val('--size') or '1.7B', api_name='/generate_voice_clone')
        except Exception as e:
            msg = str(e)
            if 'quota' in msg.lower():
                sys.exit(f'장면 {i + 1}: 허깅페이스 무료 GPU 시간이 다 됐어요. HF_TOKEN(로그인 토큰)을 주거나 잠시 뒤에 --only {i + 1},… 로 이어서 하세요.\n{msg[:200]}')
            sys.exit(f'장면 {i + 1}: {msg[:300]}')
        if not a:
            sys.exit(f'장면 {i + 1}: {st}')
        shutil.copy(a, os.path.join(work, out))
        pad_tail(os.path.join(work, out))
        sc['voice'] = out
        sc.pop('voiceData', None); sc.pop('voiceDur', None)
        print(f'  장면 {i + 1:02d} → {out} ({audio_len(os.path.join(work, out)):.1f}초)')
        with open(lp, 'w', encoding='utf-8') as f:
            json.dump(L, f, ensure_ascii=False, indent=2)
    print('→ lesson.json 에 목소리를 달았어요. 이제 studio 또는 share 로 파일을 만드세요.')

elif cmd == 'sync':
    # 목소리와 이름표 맞추기: 녹음을 받아 적어(faster-whisper · 이 작업 공간에서) 이름표 낱말을 말하는 순간에 짚게 한다
    # 사진 장면 pins[] · 모아 보기 cells[] 의 kw(없으면 이름표 첫 낱말)를 찾아 at(초)을 적는다
    try:
        import numpy as np
        from faster_whisper import WhisperModel
    except Exception:
        sys.exit('pip install faster-whisper 를 먼저 해 주세요 (python3 peace.py voice-setup 이 함께 깔아요)')
    lp = os.path.join(work, 'lesson.json')
    L = json.loads(read(lp))
    m = WhisperModel('small', device='cpu', compute_type='int8')
    norm = lambda t: re.sub(r'[^0-9A-Za-z가-힣]', '', t)
    for i, sc in enumerate(L['scenes']):
        marks = sc.get('pins') if sc.get('type') == 'photo' else sc.get('cells') if sc.get('type') == 'gallery' else None
        if not marks or not sc.get('voice'):
            continue
        pcm = subprocess.run([FF, '-v', 'error', '-i', os.path.join(work, sc['voice']), '-ac', '1', '-ar', '16000', '-f', 's16le', '-'], capture_output=True, check=True).stdout
        segs, _ = m.transcribe(np.frombuffer(pcm, np.int16).astype('float32') / 32768, language='ko', word_timestamps=True, initial_prompt=sc.get('say', ''))
        words = [w for sg in segs for w in sg.words]
        flat, owner = '', []
        for j, w in enumerate(words):
            t = norm(w.word); flat += t; owner += [j] * len(t)
        pos, last, got = 0, 0.6, []
        for q in marks:
            kw = norm(q.get('kw') or re.split(r'[\s·→=:(]', (q.get('label') or '').strip())[0])
            k = -1
            for cand in (kw, kw[:2]):
                if cand:
                    k = flat.find(cand, pos)
                    if k >= 0:
                        break
            if k < 0:
                got.append('?')
                continue
            at = max(last + 0.4, 0.35 + words[owner[k]].start)   # 녹음은 장면 시작 0.35초 뒤에 나온다
            q['at'] = round(at, 2); last = at; pos = k + 1
            got.append(f"{q.get('label')}@{q['at']}")
        print(f'  장면 {i + 1:02d}: ' + ' · '.join(got))
    with open(lp, 'w', encoding='utf-8') as f:
        json.dump(L, f, ensure_ascii=False, indent=2)
    print('→ 이름표가 말하는 순간에 나오도록 at 을 적었어요 (못 찾은 것은 ? · 원래 차례대로)')

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
    files, fmt = font_files(json.dumps(L, ensure_ascii=False))
    for name, data in files.items():
        with open(os.path.join(fd, name + '.woff2'), 'wb') as f:   # 이름은 그대로, 속은 woff2 또는 woff
            f.write(data)
    if fmt != 'woff2':
        sp = os.path.join(eng, 'style.css')
        with open(sp, 'w', encoding='utf-8') as f:
            f.write(read(sp).replace("format('woff2')", f"format('{fmt}')"))
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
