#!/bin/sh
# In các mục của checklist xong việc (SKILL.md mục 2) mà diff chạm tới, kèm file làm mục đó phải kiểm.
# Mục 1, 2, 2a, 2b, 10–15 luôn kiểm khi có file code đổi nên không in ở đây.
#
# Dùng (ở gốc repo): sh .claude/skills/dod-report/dod-scope.sh [base]   (mặc định: main)
# Tính cả commit trên nhánh (base...HEAD), thay đổi chưa commit và file mới chưa add.

base="${1:-main}"

if git rev-parse --verify --quiet "$base" >/dev/null; then
  range_files=$(git diff --name-only "$base...HEAD")
else
  echo "Chưa có nhánh base '$base' (repo chưa có commit?): xét mọi file trong thư mục làm việc." >&2
  range_files=""
fi

files=$(
  {
    printf '%s\n' "$range_files"
    git diff --name-only HEAD 2>/dev/null
    git ls-files --others --exclude-standard
  } | sed '/^$/d' | sort -u
)

# Chỉ xét code và nội dung: tài liệu, spec, cấu hình agent không làm mục nào bị chạm
code=$(printf '%s\n' "$files" | grep -vE '(\.md$|^docs/|^\.kiro/|^\.claude/|^\.agents/|^\.cursor/|^\.github/(agents|skills|hooks)/|^\.codex/)')

if [ -z "$code" ]; then
  echo "Không có file code nào đổi so với $base (chỉ tài liệu / spec, hoặc không đổi gì)."
  exit 0
fi

has() {
  printf '%s\n' "$code" | grep -qE "$1"
}

# item <tên mục> <regex>: in mục và các file khớp, không khớp thì bỏ qua.
item() {
  matched=$(printf '%s\n' "$code" | grep -E "$2")
  [ -z "$matched" ] && return
  echo "## $1"
  printf '%s\n' "$matched" | sed 's/^/- /'
  echo
}

echo "# Mục checklist bị chạm (so với $base)"
echo
echo "## 2. Lệnh phải chạy (ở gốc repo)"
echo "- pnpm lint · pnpm typecheck · pnpm test · pnpm -r test:coverage"
has '^apps/game/' && echo "- pnpm build · pnpm e2e"
has '^tools/tts/' && echo "- cd tools/tts && .venv/Scripts/python -m unittest (hoặc python -m unittest)"
echo

item "3. Chơi không cần mạng" '(^apps/game/(vite\.config\.ts|public/|index\.html)|/sw|workbox|manifest)'
item "4. Song ngữ, giọng đọc" '(^packages/content/(data/|src/(speech|phrases)\.ts)|^apps/game/src/audio/|^tools/tts/)'
item "5. Nhóm tuổi" '(ageConfig|settings\.ts$|AgeGroup)'
item "6. Nội dung bài học" '^packages/content/data/'
item "7. Quảng cáo, mua bán" '(ads|Ads|billing|Billing|purchase|Purchase|payment|Payment|webhook|Webhook)'
item "8. Dữ liệu trẻ em, bảo mật" '(^apps/server/|auth|Auth|account|Account)'
item "9. Cấu hình, build" '(\.example$|vite\.config\.ts$|package\.json$|pnpm-workspace\.yaml$|capacitor\.config|^\.github/workflows/|^apps/game/(android|ios)/)'
