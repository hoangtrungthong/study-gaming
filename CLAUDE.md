# CLAUDE.md

Rule của dự án nằm ở `AGENTS.md` (dùng chung cho mọi công cụ AI):

@AGENTS.md

## Riêng cho Claude Code

- Hook `.claude/hooks/routing.md` chèn tóm tắt rule vào mọi prompt; quyền và lệnh bị chặn ở `.claude/settings.json`.
- Skill của dự án: `dod-report` (checklist xong việc). Skill thiết kế: `impeccable`, `design`, `ui-ux-pro-max`, `brand`…
  (`.claude/skills/`). Agent chuyên môn (thiết kế game, UX, kiểm thử…): `.claude/agents/`.
- Review theo `dod-report` mục 4.2: reviewer subagent mỗi chiều một người, finding Critical/High qua 3 phản biện độc lập.
