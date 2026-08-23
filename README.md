# NewsHub

多來源 RSS 新聞聚合平台。個人 side project，展示「多來源即時資料聚合」的能力：抓取 → 正規化 → 去重複 → 排程入庫 → API 層 → SSR 前端，並用 SSE 做到「後端輪詢、前端即時」的體感。

完整開發過程與每個技術決策的取捨記錄在 [`NewsHub-develop-plan.md`](./NewsHub-develop-plan.md)，這份 README 只整理最終結果。

## 架構

```
新聞來源 (RSS/Atom)  中央社 / 自由時報 / 公視 ... (輪詢制，無推播)
        │  GitHub Actions cron（每 15 分鐘）
        ▼
抓取 & 正規化 Script  Node.js + rss-parser（單一來源失敗不影響其他來源）
        │  欄位統一、標題語意去重複（bigram overlap）
        ▼
Supabase Postgres    只存標題／摘要／連結／來源／時間，不存全文
        │
        ▼
Next.js Route Handler  GET /api/news（分類／來源／tag 篩選 + 分頁）
                        GET /api/news/stream（SSE，新資料時推播）
        │
        ▼
Next.js 前端 (App Router)  Server Component 首屏渲染 + SEO
                            Client Component 訂閱 SSE、顯示「有新新聞」提示
```

關鍵設計：對新聞來源是 **Pull**（輪詢 RSS），對自己前端是 **Push**（SSE）。

## 技術棧

| 分類 | 選擇 |
| --- | --- |
| 前端框架 | Next.js 16（App Router）+ TypeScript |
| 樣式 | Tailwind CSS v4 |
| RSS 解析 | rss-parser |
| 資料庫 | Supabase (Postgres) |
| 資料庫存取 | `@supabase/supabase-js`（抓取 script 與 API Route 共用同一套 client） |
| 排程 | GitHub Actions cron |
| 即時推播 | SSE (Server-Sent Events)，自己實作，不用 WebSocket 或 Supabase Realtime |

## 本地開發

```bash
npm install
cp .env.example .env   # 填入 SUPABASE_URL / SUPABASE_SECRET_KEY
npm run dev            # http://localhost:3000
```

需要的環境變數：

| 變數 | 用途 |
| --- | --- |
| `SUPABASE_URL` | Supabase 專案 URL |
| `SUPABASE_SECRET_KEY` | Supabase secret key（server-only，繞過 RLS，寫入與查詢都用這把） |
| `NEXT_PUBLIC_SITE_URL` | 部署後的正式網址，用於 sitemap／canonical／JSON-LD；本機開發可不設，預設 `http://localhost:3000` |

## 常用指令

```bash
npm run fetch:news   # 手動跑一次抓取（正式排程由 GitHub Actions 每 15 分鐘觸發）
npm test              # 跑 scripts/*.test.ts（目前涵蓋標題去重複邏輯）
npm run build          # production build
```

## 排程

`.github/workflows/fetch-news.yml`：每 15 分鐘觸發一次 `npm run fetch:news`，用 `concurrency` 避免同時有兩個 run 在跑、`timeout-minutes: 5` 避免卡住的 run 占用排程隊列。Supabase 的 `SUPABASE_URL`／`SUPABASE_SECRET_KEY` 存在 repo 的 GitHub Actions secrets 裡，不會出現在程式碼或 log。

## 部署

正式環境：https://newshub-tw.vercel.app

用 Vercel 的 GitHub Integration 部署，push 到 `main` 自動觸發 build + deploy。環境變數（`SUPABASE_URL`／`SUPABASE_SECRET_KEY`／`NEXT_PUBLIC_SITE_URL`）設定在 Vercel 專案的 Production and Preview。

`/api/news/stream` 這條長連線在 Vercel 的 Node.js serverless function 上實測是真的串流（headers 與 heartbeat 會在連線期間陸續送達，不是等函式執行完才整包回傳），但正式環境的「首個位元組送達時間」比本機慢，會卡在目前 15 秒的 heartbeat 週期附近，屬於平台特性、不是 bug；另外加了 `export const maxDuration = 60` 避免平台預設的短逾時值提前砍斷連線。完整驗證過程記錄在計畫書 §9。

## 版權合規

資料庫**只存標題、摘要、原文連結、來源名稱、發布時間**，不存全文——這是配合以下來源的使用條款：

- **中央社**：同意個人、非營利非商業用途使用；須標示出處「中央通訊社」；RSS 僅提供標題／前言／連結，不可引用全文；中央社保留隨時要求停止使用的權利。
- **自由時報**：非營利、個人、Blog 在非商業前提下可使用，須標明出處；保留要求停止發佈的權利。
- **公視新聞網**：同意個人、非營利在私人非商業用途內使用；須註明來源為「公視」，標題不可任意修改；保留要求停止散布的權利。

實作上對應：每則文章卡片明確標示來源名稱，並附回原文連結；本專案為個人非商業性質的作品集展示；若任一來源要求下架，`source` 欄位可直接篩選刪除對應資料。

## 技術取捨

- **GitHub Actions cron，不用 AWS EventBridge／Lambda**：免費、不用另外管一組 AWS 帳號權限，對這個規模的排程任務綽綽有餘。
- **自己寫 SSE + 輪詢，不用 Supabase Realtime**：Realtime 幾乎零後端程式碼，但等於把「維持連線」「推播格式」這幾個技術細節外包給平台，履歷上少了可以講的東西。完整的取捨比較與升級路徑在計畫書 §4.3。
- **手寫 Supabase 型別，不用 CLI 產生**：`supabase gen types typescript` 需要另外申請 personal access token，且目前 dashboard 沒有免 token 的複製貼上入口。改成依照實際 schema 手寫 `Database` type（`lib/database.types.ts`），效果一樣有型別檢查，只是 schema 改了要記得手動同步。
- **語意去重複用字元 bigram，不用 NLP 斷詞**：中文沒有空格分詞，真正的詞彙 tokenization 需要斷詞函式庫，不符合這個規模的投入產出比。改用「每兩個字」切 bigram 集合算重疊係數，字串層級比對就夠用，比對範圍限制在「過去 48 小時」，不會隨資料量增加而變慢。
- **不做站內文章詳情頁**：卡片直接連回原文連結（也是版權合規的要求之一），所以 SEO 的 JSON-LD 用 `ItemList` 包 `NewsArticle` 標記整個列表頁，而不是逐篇文章各自的結構化資料。
- **分頁計數用 `count: "estimated"`，不用 `exact`**：PostgREST 的 count 有三種模式——`exact`（精確但要對篩選後的結果做真正的 `COUNT(*)`）、`planned`（純吃 Postgres 統計資訊估算，快但可能失準）、`estimated`（資料量小時退回 exact、大時用 planned 估算的混合策略）。因為 count 跟資料查詢包在同一次 PostgREST 請求裡送出，`exact` 的成本會直接算進每次切換分類／分頁的等待時間，不是獨立的背景成本。換成 `estimated` 後，代價只在分頁最後一兩頁的邊界可能因估計誤差而輕微不準，不影響實際顯示的文章內容，換來的是查詢成本不會隨資料量線性增加。詳細比較見計畫書 §4.3。

## 已知的擴展性上限

SSE 用輪詢實作，成本是「查詢間隔 × 同時開著頁面的使用者數」——這是這個做法本身的天花板，不是 bug。對 demo／面試官看的規模完全沒問題；真的要撐更大流量，升級路徑是換成 Supabase Realtime（改動範圍只有 `app/api/news/stream/route.ts`）。完整比較見計畫書 §4.3。
