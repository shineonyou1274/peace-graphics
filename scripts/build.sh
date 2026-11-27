#!/usr/bin/env bash
# skills/ 안의 스킬 폴더를 하나씩 Claude 에 올릴 수 있는 .skill(zip) 파일로 묶는다.
# 쓰는 법: ./scripts/build.sh            (전부)
#         ./scripts/build.sh <스킬이름>  (하나만)
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p dist

names=("$@")
if [ ${#names[@]} -eq 0 ]; then
  for d in skills/*/; do names+=("$(basename "$d")"); done
fi

for NAME in "${names[@]}"; do
  SK="skills/$NAME/SKILL.md"
  [ -f "$SK" ] || { echo "❌ SKILL.md 가 없습니다: $SK"; exit 1; }
  head -1 "$SK" | grep -q '^---$' || { echo "❌ SKILL.md 머리(---)가 없습니다: $SK"; exit 1; }
  grep -q "^name: $NAME\$" "$SK" || { echo "❌ SKILL.md 의 name 이 폴더 이름($NAME)과 다릅니다"; exit 1; }
  OUT="dist/$NAME.skill"
  rm -f "$OUT"
  (cd skills && zip -qr -X "../$OUT" "$NAME" -x '*.DS_Store')
  VERSION=$(grep -m1 'version:' "$SK" | awk '{print $2}')
  echo "✅ $OUT (v$VERSION · $(unzip -l "$OUT" | tail -1 | awk '{print $2}') files)"
done

# 저장소의 받기용 사본도 새로 고친다 (README 의 다운로드 링크)
# Claude 앱의 "스킬 올리기"는 ZIP 을 받는다 — 같은 파일을 .zip 이름으로
mkdir -p download
for f in dist/*.skill; do cp "$f" "download/$(basename "${f%.skill}").zip"; cp "$f" "download/$(basename "$f")"; done   # .zip(앱에 올리기) · .skill(예전 링크) 둘 다
echo "↪ download/ 갱신 (*.zip · *.skill)"

# 선생님용 빈 스튜디오 (예시가 담긴 파일 하나)
python3 skills/peace-class/scripts/peace.py blank download/수업영상스튜디오.html
