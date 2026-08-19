# NewsHub

多來源 RSS 新聞聚合平台，side project，用來投遞前端職缺展示「多來源即時資料聚合」能力。

**完整開發計畫見 [`NewsHub-develop-plan.md`](./NewsHub-develop-plan.md)** — 系統架構、技術選型、資料流程、DB schema、Phase 拆分都在裡面，動工前務必先讀過。

## 協作方式

- 照計畫文件第 6 節的 Phase 1-6 順序進行，每個 Phase 結束後手動驗證再進下一步。
- Solo side project，git workflow 用 `git-solo`：直接 commit + push 到 main，不開 feature branch、不開 PR。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
