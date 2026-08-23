# 新聞聚合平台（NewsHub）開發計畫

> 目的：作為 side project 投遞前端職缺，展示「多來源即時資料聚合」能力。

---

## 1. 專案目標與定位

- **核心敘事**：多來源 RSS 抓取 → 正規化 → 排程入庫 → API 層 → 前端呈現，並透過 SSE 做到「後端輪詢、前端即時」的體感。
- **技術點**：
  - 串接第三方 API / 資料源
  - SSR / Next.js Server Components
  - SEO
  - Node.js 排程 script

---

## 2. 系統架構

```
┌─────────────────────┐
│  新聞來源 (RSS XML)   │  中央社 / 自由時報 / 公視 ... (輪詢制，無推播)
└──────────┬───────────┘
           │ GitHub Actions cron（例如每 15 分鐘）
           ▼
┌─────────────────────┐
│  抓取 & 正規化 Script  │  Node.js + rss-parser
│  （去重、欄位統一）     │
└──────────┬───────────┘
           ▼
┌─────────────────────┐
│  Supabase Postgres   │  儲存正規化後的新聞資料
└──────────┬───────────┘
           ▼
┌─────────────────────┐
│  Next.js Route        │  對外 API（分類篩選、分頁）
│  Handler (API層)      │  + SSE endpoint（新資料推播）
└──────────┬───────────┘
           ▼
┌─────────────────────┐
│  Next.js 前端          │  Server Components 首屏渲染
│  (App Router)          │  + Client Components 處理 SSE / 互動
└─────────────────────┘
```

**關鍵設計原則**：對新聞來源是 Pull（輪詢），對自己前端是 Push（SSE），這是這個專案技術上最值得講的地方。

---

## 3. 技術選型

| 分類                          | 選擇                          | 說明                                                                                            |
| ----------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------- |
| 前端框架                      | Next.js（最新版, App Router） | Server Components 處理首屏、SEO                                                                 |
| 語言                          | TypeScript                    | 延續你既有專案慣例                                                                              |
| UI                            | Tailwind CSS + shadcn/ui      | 延續既有專案慣例                                                                                |
| 狀態管理 / 資料抓取           | TanStack Query                | 前端互動（篩選、分頁）用                                                                        |
| 表單驗證（如有訂閱/收藏功能） | Zod + react-hook-form         | 延續既有專案慣例                                                                                |
| RSS 解析                      | rss-parser                    | 處理 XML → JS 物件                                                                              |
| 資料庫                        | Supabase (Postgres)           | 免費額度、免維運                                                                                |
| 資料庫存取                    | supabase-js                   | 直接用 Supabase 自動生成的 API 存取，不額外導入 ORM；抓取 script 與 API Route 共用同一套 client |
| 排程                          | GitHub Actions cron           | 對應 AWS EventBridge 的免費替代方案                                                             |
| 即時推播                      | SSE (Server-Sent Events)      | Next.js Route Handler 原生支援，比 WebSocket 簡單                                               |
| 部署                          | Vercel                        | 前端 + API routes                                                                               |

---

## 4. 資料流程細節

### 4.1 抓取階段（GitHub Actions cron 觸發）

1. 逐一打各新聞來源 RSS URL（`rss-parser` 的 `parseURL`）
2. 統一欄位格式：不同來源的 `pubDate` 格式不一致、`description` 可能含 HTML tag 需清理、圖片欄位有的在 `enclosure`、有的要從 `description` 裡解析
3. **主題標籤判斷**：RSS 來源只有大分類（政治、生活、科技等），沒有細部主題。像「AI 新聞」這種跨分類的標籤，要自己在正規化階段對標題／摘要做關鍵字比對（例如「AI」「人工智慧」「ChatGPT」「大模型」「生成式」等），符合就寫入 `tags` 陣列欄位一起存進資料庫，之後查詢直接吃索引，不用每次即時判斷。
4. **去重複判斷**：分兩個層次處理，不能混為一談：
   - **完全重複（同一則新聞）**：靠資料庫 `link` 欄位的 unique constraint + upsert 處理，這是索引查找（B-tree，O(log n)），不需要自己寫比對邏輯，資料量增加也不會變慢。
   - **語意重複（不同來源報導同一事件，連結不同）**：需要自己比對，但**只跟近期資料比對，不跟全部歷史比對**：
     1. 先用已建索引的 `published_at` 欄位，篩出資料庫裡「過去 24-48 小時內」的文章當候選集合，不管資料庫累積多少筆，實際參與比對的範圍都是固定的，不會隨時間變慢。
     2. 對候選集合做標題正規化（去標點符號、多餘空白），再做關鍵字 overlap 比對，例如標題詞彙重疊超過某個門檻（如 70%）就視為疑似重複，標記或合併顯示「多家媒體報導」。
        **實作採用字元 bigram 的 overlap coefficient**（而非詞彙級比對）：中文沒有空格分詞，要做真正的詞彙 tokenization 得上斷詞函式庫，不符合這個規模的投入產出比；改用「每兩個字」切 bigram 集合，算交集除以較小集合大小，對長度差異較大的標題（例如同事件但一篇標題比較長）也還算穩健。門檻維持 70%。比對結果寫回新增的 `duplicate_of` 欄位（見第 5 節），指向被認定是同一事件的既有文章 `id`，不刪資料、留給前端之後做「多家媒體報導」的聚合顯示。
     3. 不需要上 NLP / 語意向量模型，MVP 階段字串層級的比對就夠，投入產出比更合理。
     4. **進階選項（非必做）**：Postgres 的 `pg_trgm` extension 可以對文字欄位建立相似度索引（trigram），讓模糊比對也能吃到索引加速。如果想在履歷上多一個「資料庫優化」的技術亮點可以加，但不是這個規模的專案必需品。
5. Upsert 進資料庫（用 `link` 當作唯一鍵，避免重複寫入）

### 4.2 儲存（Supabase）

- 只存：標題、摘要（非全文）、原文連結、來源名稱、發布時間、分類、圖片網址
- **版權合規**：中央社、自由時報等來源條款都明確要求「僅提供標題/摘要/連結，不可存全文」，這點在 README 或關於頁面上主動說明，反而是加分（展示你有讀過來源使用條款）

  **選定的三個來源與 RSS 網址**：

  | 來源           | 分類 | RSS 網址                                         |
  | -------------- | ---- | ------------------------------------------------ |
  | 中央社 CNA     | 科技 | `https://feeds.feedburner.com/rsscna/technology` |
  | 自由時報 LTN   | 即時 | `https://news.ltn.com.tw/rss/all.xml`            |
  | 公視新聞網 PTS | 新聞 | `https://news.pts.org.tw/xml/newsfeed.xml`（實測 `about.pts.org.tw` 那個網址會 301 導到這裡，且格式其實是 **Atom** 不是 RSS 2.0，欄位對應到 `rss-parser` 的 `summary`／`isoDate` 而非 `contentSnippet`／`pubDate`，直接用最終網址避免依賴轉址） |

  （中央社、自由時報都有更多分類可選，之後要擴充分類直接照同樣規則加即可。）

  **各來源使用條款重點（實作時需遵守）**：
  - **中央社**：同意個人、非營利組織非商業用途使用；引用頁面須標示出處「中央通訊社」；須保留中央社發稿訊頭，不可隨意移除；RSS 服務僅提供標題、前言、連結與首圖連結，**不可引用全文**；中央社保留隨時要求停止使用的權利。
  - **自由時報**：非營利機構網站、個人及 Blog 在非商業用途前提下可免費使用新聞訊息，但須標明新聞出處；自由電子報保留要求停止發佈的權利。
  - **公視**：同意個人、非營利組織在私人非商業用途內免費使用；引用資料須註明來源為「公視」；文章標題須保留原資訊來源，不可任意修改；公視保留隨時要求停止散布的權利。

  **共通實作原則**：資料庫只存標題、摘要、連結、來源名稱、圖片網址（不存全文）；每則文章卡片上明確標示來源名稱並附回原文連結；README 需寫明本專案為個人非商業性質的 side project 展示；若任一來源要求下架，需能快速依來源篩選刪除對應資料（`source` 欄位已支援這個操作）。

- **資料庫存取統一用 supabase-js**：抓取 script（GitHub Actions 執行環境）跟 API Route（Next.js 後端）都用同一套 `@supabase/supabase-js` client 呼叫，不額外導入 Prisma。抓取 script 用 upsert（`onConflict: 'link'`）避免重複寫入：

```ts
const { error } = await supabase
  .from("articles")
  .upsert(normalizedArticles, { onConflict: "link" });
```

- **型別安全**：原計畫用 Supabase CLI 產生 TypeScript type（`supabase gen types typescript`）。實作時發現這需要另外申請 personal access token（CLI 走 Management API，跟平常寫入用的 `secret key` 是不同權限系統），且目前 dashboard 版面也沒有直接複製貼上的入口。改為**依照 Schema Visualizer 確認過的實際欄位，手寫 `Database` type**（`scripts/database.types.ts`，標了 `ponytail:` 註解說明原因），效果一樣有型別檢查，只是 schema 改了要記得手動同步，不會自動重新產生。之後 schema 變動頻繁再考慮換回 CLI + token 那條路。

### 4.3 API 層（Next.js Route Handler）

- `GET /api/news`：內部用 supabase-js 查詢，支援分類、來源、**主題標籤（`tag=ai`）**、分頁 query
- **主題篩選走 server-side query，不做 client-side filter**：像「只看 AI 新聞」這種篩選在資料庫層完成，用 `tags` 欄位的 GIN 索引查詢，前端只拿到篩選後的結果，不會把所有新聞都傳到瀏覽器再過濾。範例：

```ts
const { data } = await supabase
  .from("articles")
  .select("*")
  .contains("tags", ["ai"])
  .order("published_at", { ascending: false })
  .range(offset, offset + pageSize - 1);
```

**分頁計數（count）策略**：`getArticles()` 一開始用 `count: "exact"`——每次查詢在回傳這頁資料的同時，也精確算出符合篩選條件的總筆數，給 `Pagination` 元件算頁碼、判斷「是否還有下一頁」用。PostgREST 支援三種 count 模式：

| 模式 | 機制 | 準確度 | 成本 |
| --- | --- | --- | --- |
| `exact`（原本採用） | 對篩選後的結果做真正的 `COUNT(*)`，跟資料查詢包在同一個 window function、同一次請求裡送出 | 精確 | 隨符合篩選條件的列數增加；因為跟資料查詢同一個 round-trip，這個成本會直接算進使用者切換分類／分頁時的等待時間，不是獨立的背景成本 |
| `planned` | 不掃資料表，改讀 Postgres 統計資訊（跟 `EXPLAIN` 估計列數同一套機制） | 可能有落差，尤其統計資訊剛好過時 | 幾乎常數時間 |
| `estimated`（改用後） | 先用 `planned` 估一次；估計值夠小就回頭做一次真正的 `exact`，估計值大就直接用估算值 | 資料量小時精確、大時近似 | 小表跟 `exact` 一樣準，大表接近 `planned` 的速度 |

**改用 `estimated` 的原因**：這個 side project 資料量目前不大，`exact` 感覺不到延遲，但這是值得記錄的效能取捨——PostgREST 把 count 跟資料查詢包在同一次請求裡，不是背景非同步算的，所以 `exact` 的成本不是「多算一個數字」，是直接疊加在每次頁面回應時間上，且會隨篩選後的資料量線性增加。換成 `estimated` 後，代價只在分頁最後一兩頁的邊界可能因估計誤差而跟真實筆數對不上（例如「下一頁」按鈕在邊界上誤判要不要 disable），不影響實際顯示的文章內容是否正確。

改動範圍只有 `lib/articles.ts` 裡 `.select(..., { count: "estimated" })` 這一行；`getArticles()` 同時被 `/api/news` 跟首頁 Server Component 共用，兩邊都受益，不用分別改。

- `GET /api/news/stream`：SSE endpoint，資料庫有新資料時推播事件給前端

**實作細節（Phase 4 已完成）**：

Route Handler 回傳一個不會結束的 `ReadableStream`，連線建立當下記錄一個時間戳 `lastCheckedAt`。之後每 10 秒（`POLL_INTERVAL_MS`）查一次 `fetched_at > lastCheckedAt` 有沒有新資料，有的話用 `event: news\ndata: {...}\n\n` 的 SSE 格式推給前端，並把 `lastCheckedAt` 更新成現在。另外每 15 秒送一個 `: heartbeat\n\n` 註解行，避免中間的 proxy／瀏覽器判定連線閒置太久而自動斷開。前端斷線（關分頁、切換頁面、網路中斷）時，`request.signal` 會觸發 `abort` 事件，這時清掉兩個 `setInterval`、關閉 controller，釋放資源。

**跟首頁初始載入的分工**：SSE 故意只推「連線建立之後」發生的新資料，不會把資料庫既有的資料倒出來——所以首頁第一次載入一定要靠 `/api/news`（SSR、拿得到現有資料、對 SEO 友善），SSE 只負責接續在那之後的即時更新，兩者互補、不能互相取代。

**這個做法的效能天花板，以及為什麼還是這樣做**：

這個輪詢式 SSE 的成本，是「查詢間隔 × 同時開著頁面的使用者數」——每一條 SSE 連線都各自每 10 秒查一次資料庫，10 個人同時看頁面，資料庫就要處理 10 條並行、幾乎一樣的查詢，而且是常駐輪詢，不是「真的有變更才查」。這是已知的擴展性上限，不是 bug；對這個專案的規模（demo、面試官看）完全沒問題，但值得誠實記錄，之後若要撐更大流量，有兩條更省資源的路。（`fetched_at` 已補上 index — `idx_articles_fetched_at` — 確保單次查詢本身是 indexed range scan，不會隨資料量增加變慢；沒解決的是「並發連線數 × 輪詢頻率」這個結構性成本，這只能靠換架構解決，不是加 index 能處理的問題。）

| 方案 | 機制 | 優點 | 缺點 |
| --- | --- | --- | --- |
| **自寫 SSE + 輪詢**（目前採用） | 每條連線各自定時查 DB | 不依賴額外基礎設施；完全掌控推播邏輯與格式；最能展示你理解「連線如何維持」「push vs pull 差在哪」的底層機制 | 成本隨並發連線數線性增加；資料變動與查詢時機脫鉤（最多延遲一個輪詢間隔，這裡是 10 秒） |
| **Postgres `LISTEN/NOTIFY`** | DB 有異動時主動通知監聽中的連線，事件驅動 | 不用輪詢，資料一變就推，延遲更低；查詢次數只跟「真的有異動」相關，不跟並發使用者數字掛勾 | 需要一個常駐 process 維持跟 DB 的 `LISTEN` 連線（Serverless Route Handler 這種「每次請求才啟動」的執行模型不天然適合，需要額外的常駐服務） |
| **Supabase Realtime** | Supabase 內建，底層也是監聽 Postgres WAL（跟 `LISTEN/NOTIFY` 概念類似，但封裝好、能直接在前端訂閱） | 幾乎零後端程式碼，開發最快；原生支援 Serverless／前端直接訂閱，不用自己維護常駐連線 | 跳過了自己實作「維持連線」「推播格式」這幾個技術細節，履歷上比較難講清楚你懂底層在幹嘛；多一個對 Supabase 特定功能的依賴 |

**這個專案的選擇**：維持自己寫 SSE + 輪詢。原因是這個 side project 的目的是投遞前端職缺、展示「你理解 push vs pull、SSE 連線怎麼維持」，換成 Supabase Realtime 雖然程式碼更少，但等於把整個技術亮點外包給平台，反而少了可以在面試講的細節。**升級路徑**：如果之後真的要處理明顯的並發流量，優先評估換成 Supabase Realtime（改動範圍小，只動 `/api/news/stream` 這支檔案），而不是自己維護 `LISTEN/NOTIFY` 的常駐服務——除非情境需要完全不依賴 Supabase 的可攜性，才考慮自己接 `LISTEN/NOTIFY`。

### 4.4 前端呈現 ✅ Phase 5 已完成

- 首頁用 Server Component 抓初始資料（SEO 友善，有 SSR 內容可被爬蟲讀到）
- 進頁後用 Client Component 訂閱 SSE，有新新聞時前端插入卡片並提示「有新新聞」
- 篩選狀態（分類、來源、主題標籤）用 URL query sync（例如 `/news?tag=ai`），延續你在動物領養平台的做法，Server Component 直接依 query 渲染篩選後內容，對 SEO 友善

**實際做法（跟草案的差異）**：

- **路由用 `/`，不是 `/news`**：草案例句寫的是 `/news?tag=ai`，但既然新聞列表本身就是首頁，直接把篩選 query 掛在 `/` 上（`/?category=科技`），不用多一層 `/news` 路徑再導過去。
- **Phase 5 UI 範圍縮小到分類篩選**：`/api/news` 早就支援 `source`／`tag` 篩選，但 §6 Phase 5 的清單只明確要求「分類篩選 UI」，所以這次只做分類 tabs（全部／科技／即時／新聞），來源跟主題標籤篩選先不做對應 UI（API 已經支援，之後要加只是多寫幾個 Link，不是重新設計）。
- **「插入卡片」簡化成「提示 + 點擊刷新」**：沒有做「SSE 收到新資料就在前端手動 append DOM」這種雙軌渲染（Server Component 渲染一次、Client 端又要維護一份平行的文章清單狀態，容易兩邊對不齊）。做法是 SSE 收到新文章只累加一個計數、顯示橫幅「N 則新新聞・點擊更新」，使用者點下去呼叫 Next.js 的 `router.refresh()`，讓 Server Component 用原本那套查詢邏輯重新渲染一次——資料來源只有一個，不會有「兩份文章清單邏輯要對齊」的問題，UX 上也更符合原意的「提示」（不是靜默背景改動畫面）。
- **共用元件**：`lib/articles.ts` 的 `getArticles()` 被 `/api/news` 和首頁 Server Component 兩邊共用，同一套篩選／分頁邏輯只寫一次。
- **視覺方向**：抓「通訊社／新聞編輯室」的意象做視覺識別——`WIRE SERVICE` 字樣、Space Grotesk 做 wordmark、Noto Serif TC 做文章標題、JetBrains Mono 做時間戳與來源標籤，頂部一條會脈動的 LIVE 連線狀態列直接呼應 SSE 這個技術亮點，不是裝飾。
- **JSON-LD 用 `ItemList`，不是逐篇 `NewsArticle`（Phase 6）**：因為版權合規要求（見 4.2）卡片一律連回原文，沒有站內的文章詳情頁，所以沒有「每篇文章一個獨立頁面、各自帶 `NewsArticle` structured data」這種結構。改成在列表頁本身輸出一個 `ItemList`，裡面每個 `ListItem` 包一個 `NewsArticle`（`headline`／`url`／`datePublished`／`publisher` 指向原文），準確描述「這是一個新聞列表頁」，而不是假裝有文章詳情頁。

---

## 5. 資料庫 Schema（實際版本，Phase 1-4 執行後更新）

```sql
create table articles (
  id uuid primary key default gen_random_uuid(),
  source text not null,           -- 來源名稱，如 "中央社"
  category text,                  -- 分類，如 "政治"
  tags text[] default '{}',       -- 主題標籤，如 {'ai'}，供 AI 新聞等跨分類篩選用
  title text not null,
  summary text,
  link text not null unique,      -- 去重複用
  published_at timestamptz not null,
  fetched_at timestamptz default now(),
  duplicate_of uuid references articles(id)  -- 指向語意重複的「原始」文章，null 代表非重複（見 4.1）
);

create index idx_articles_published_at on articles (published_at desc);
create index idx_articles_category on articles (category);
create index idx_articles_tags on articles using gin (tags);   -- 陣列欄位查詢用 GIN 索引
create index idx_articles_fetched_at on articles (fetched_at desc);  -- SSE 輪詢用（見 4.3），沒有這個 index 該查詢會全表掃描
```

**跟草案的差異**：
- 拿掉了 `image_url`——三個選定來源裡 CNA 科技版實測完全沒有 item 層級的圖片欄位（無 `enclosure`），暫不需要這個欄位。之後如果自由時報／公視的來源確認有提供圖片，用 `alter table` 加回來即可。
- 新增 `duplicate_of`，對應 4.1 節語意去重複的落地實作。
- 新增 `idx_articles_fetched_at`——Phase 4 寫 SSE endpoint 時發現 `.gt("fetched_at", ...)` 這個查詢原本沒有 index 可用，補上避免資料量變大後全表掃描。
- Table 有開 Row Level Security（RLS），未設任何 policy。因為所有存取（抓取 script、Phase 4 的 API Route）都走 `secret key`（等同舊版的 `service_role`），本來就會繞過 RLS；開著 RLS 只是防呆——萬一以後不小心把 `publishable key`（等同舊版 `anon`）洩漏到前端，資料表預設仍是鎖住的。

---

## 6. 開發階段拆分（建議給 Claude Code 的任務切分方式）

**Phase 1：資料抓取基礎** ✅ 已完成

- 寫一支獨立 Node.js script，串接 1 個來源（先用中央社），parse + 正規化 + console.log 驗證
- 確認 rss-parser 的欄位對應正確

**Phase 2：資料庫整合** ✅ 已完成

- 建 Supabase 專案 + table
- Script 改為寫入 DB（upsert by link）
- 手動跑一次，確認資料正確落地

**Phase 3：多來源 + 去重複** ✅ 已完成

- 加入第 2、3 個來源（自由時報、公視）
- 加上去重複邏輯
- 設定 GitHub Actions cron，排程自動執行（每 15 分鐘 + 手動觸發 `workflow_dispatch`，並加上 `concurrency`／`timeout-minutes` 保護，見第 7 節第 2 點）

**Phase 4：API 層** ✅ 已完成

- 建立 `/api/news`，支援分類篩選、分頁（實際還多做了 `tag` 篩選，並預設排除 `duplicate_of` 不為 null 的文章）
- 建立 SSE endpoint（10 秒輪詢 + 15 秒 heartbeat，詳見 4.3 節的實作細節與取捨比較）
- 順便把 Next.js App Router 掃進專案，`lib/supabase.ts` 讓抓取 script 跟 API Route 共用同一套 client

**Phase 5：前端** ✅ 已完成

- Server Component 首屏渲染 + SEO metadata
- 分類篩選 UI（URL sync）
- SSE 訂閱、新資料提示（做法細節與跟草案的差異，見 4.4 節）

**Phase 6：打磨** ✅ 已完成

- SEO：`generateMetadata`（分類篩選頁各自標題／canonical）、`app/sitemap.ts`、`app/robots.ts`、JSON-LD（因為沒有站內文章詳情頁，改用 `ItemList` 包 `NewsArticle` 標記整個列表，而非逐篇獨立標記，見 4.4 節）
- 錯誤處理：Phase 3 已實作單一來源 try/catch，Phase 6 確認無需額外修改
- 順便補了 §7 提到的兩個低成本項目：RSS 請求帶自訂 User-Agent（§7.5）、`normalize.ts` 的 unit test（§7.7）
- README：架構圖、技術棧、環境變數、常用指令、版權合規說明、技術取捨、已知擴展性上限

**Phase 7：部署（Vercel）** ✅ 已完成

- Vercel 從 GitHub repo import，push 到 `main` 自動觸發部署
- 環境變數（`SUPABASE_URL`／`SUPABASE_SECRET_KEY`／`NEXT_PUBLIC_SITE_URL`）設定在 Production and Preview
- 端到端驗證正式環境：首頁、`/api/news`、`sitemap.xml`、`robots.txt`、JSON-LD、SSE 連線，其中 SSE 在 serverless 環境下的行為需要額外實測，詳見 §9
- 過程中抓到並修好一個 bug：`NEXT_PUBLIC_SITE_URL` 結尾多打斜線，導致 `sitemap.xml`／`robots.txt` 網址雙斜線（見 §9）

---

## 7. 未來建議額外補充的部分

目前規劃沒特別提到，但實作時大概率會遇到、也值得展示的細節：

1. **抓取失敗的容錯機制**：✅ Phase 3 已實作。`scripts/fetch-news.ts` 對每個來源各自 try/catch，單一來源失敗只記錄錯誤訊息、繼續處理下一個來源；全部來源都失敗時也不會 throw，正常結束（`process.exit(0)`）。
2. **重複執行保護**：✅ Phase 3 已實作。沒有自己寫「最後執行時間」記錄，改用 GitHub Actions 原生的 `concurrency` 設定（`group` + `cancel-in-progress: false`）：同一 group 同時最多一個 run 在執行，新排程時間到了但前一個還沒跑完，就排隊等，不會兩個同時寫入 Supabase。另外加了 `timeout-minutes: 5`（正常執行只需幾秒），避免萬一真的卡住，GitHub 預設 6 小時才強制取消、卡住其間所有排程的問題。
3. **圖片來源的可靠性**：新聞來源的圖片連結可能會過期或被防盜鏈擋掉，Next.js `next/image` 搭配 `remotePatterns` 設定要注意，必要時做 fallback 圖。
4. **內容分類的一致性**：不同來源的分類命名不一致（例如「政治」vs「政治軍事」），需要一個 mapping table 統一成你自己的分類系統。
   （去重複的詳細做法已在 4.1 節說明：完全重複靠 unique constraint + upsert，語意重複靠「時間窗口 + 標題正規化比對」，避免隨資料量增加而變慢。）
5. **Rate limit / 禮貌性請求**：✅ Phase 6 已實作。抓取頻率維持 15 分鐘一次；`rss-parser` 的 `Parser` 建構時帶上自訂 `User-Agent`（標示服務名稱、repo 連結、非商業用途），避免來源端看到匿名 UA 覺得可疑。
6. **監控**：GitHub Actions 本身有執行紀錄，但可以額外做一個「最後成功抓取時間」的簡單健康檢查頁面或 badge，展示你有維運意識。（尚未實作，留待之後有感需要再加。）
7. **測試**：✅ Phase 6 已實作。`scripts/normalize.test.ts` 用 Node 內建 test runner（`node:test` + `node:assert`，沒有另外裝測試框架）涵蓋 `stripHtml` 跟 `titleSimilarity`，包含一組從正式資料庫抓到的真實重複案例當回歸測試，`npm test` 執行。
8. **資料保留策略**：RSS 本身沒有時間區間查詢功能，只提供來源目前最新的一批項目（通常 20-50 則），無法用 RSS 回填歷史資料，資料庫裡的歷史深度完全取決於排程實際跑了多久。使用者主要關注最新新聞，資料庫不需要無限累積，等資料量成長到有感（例如累積數個月後）再視情況加：
   - 定期（例如每天一次的 cron job）清理或封存超過保留門檻（如 90 天）的舊資料
   - 若想保留完整歷史做其他用途，可改成「封存到另一張 archive 表」而非直接刪除，前台查詢的主表維持精簡
   - 資料庫變小對查詢效能、去重複比對（見 4.1）都有幫助，屬於資料量成長後才需要處理的優化項目

---

## 8. 與 Claude Code 協作的建議方式

- 照上面 Phase 1-6 順序逐步進行，每個 Phase 結束後手動驗證再進下一步，避免一次要求 Claude Code 生成整個系統導致架構失控。
- 每個 Phase 開始前，可以先讓 Claude Code 讀這份計畫文件，再針對該 Phase 給具體指令（例如「請依照 Phase 1 的說明，建立抓取中央社 RSS 的 script」）。

---

## 9. 部署驗證：SSE 在 Vercel Serverless 環境下的行為

上線後針對 `/api/news/stream` 做了一次端到端驗證，結果記錄下來，因為這不是本地開發環境測得出來的。

**目的**：SSE 這條路線本質上是一個「不會結束的回應」（`ReadableStream` 一直開著）。本地用 `next dev` 測沒問題，但 Vercel 的 Route Handler 預設跑在 serverless（Node.js runtime，非 Edge）上——每次請求各自啟動一個函式執行個體，這種執行模型是否真的支援「邊執行邊把資料流出去」，還是會把整個回應緩衝到函式執行結束才一次送出，只能對正式環境實測才知道。

**遇到的問題**：第一次用 `curl -N --max-time 8` 測，8 秒內收到 0 bytes，連 HTTP response header 都沒有。乍看像連線根本沒建立，或被平台悄悄卡住。

**結果**：把 timeout 拉到 20 秒重測，發現 header 加上第一筆 heartbeat（13 bytes 的 `: heartbeat\n\n`）在約 15 秒時一起送達，且連線在 20 秒視窗結束時仍是開啟狀態（`Connection ... left intact`，不是被關閉）。這證明 Vercel 確實把這個回應當串流處理，不是全緩衝——只是「第一個位元組送達的時間」比本地慢了不少，剛好卡在自己設的 15 秒 heartbeat 週期：前 15 秒沒有任何 event 是預期內的（沒有新文章、heartbeat 還沒到），不是平台的問題。

**選擇**：
- 不改 SSE 的實作方式——`LiveStatus` 元件本來就是等 `EventSource` 真的 open 才顯示 LIVE，正式環境多等十幾秒不影響功能正確性，可接受。
- 額外加上 `export const maxDuration = 60`（`app/api/news/stream/route.ts`），避免 Vercel 用平台預設的短逾時值提前砍斷這條長連線；就算被砍，`EventSource` 本身有自動重連機制，這個設定只是把重連頻率拉低，成本是一行程式碼。
- 驗證過程中順手抓到一個真的 bug（跟 SSE 無關）：`NEXT_PUBLIC_SITE_URL` 在 Vercel 上設定時結尾多打了一個 `/`，導致 `sitemap.xml`／`robots.txt` 組出來的網址變成雙斜線（`//sitemap.xml`）。修法是在 `lib/site.ts` 用 `.replace(/\/+$/, "")` 一次性 strip 掉結尾斜線，讓程式碼不管 env var 有沒有手滑多打斜線都安全，比要求自己以後設定時小心不要打錯更可靠。
