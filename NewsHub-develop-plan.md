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

- `GET /api/news/stream`：SSE endpoint，資料庫有新資料時推播事件給前端
- **備選方案**：Supabase 本身有 Realtime 功能（監聽資料表變更），如果想再簡化開發，可以評估直接用 Supabase Realtime 訂閱取代自己寫的 SSE endpoint；但自己實作 SSE 更能展示你理解「push vs pull」的底層機制，履歷上也更好講清楚技術細節，建議維持原計畫自己寫

### 4.4 前端呈現

- 首頁用 Server Component 抓初始資料（SEO 友善，有 SSR 內容可被爬蟲讀到）
- 進頁後用 Client Component 訂閱 SSE，有新新聞時前端插入卡片並提示「有新新聞」
- 篩選狀態（分類、來源、主題標籤）用 URL query sync（例如 `/news?tag=ai`），延續你在動物領養平台的做法，Server Component 直接依 query 渲染篩選後內容，對 SEO 友善

---

## 5. 資料庫 Schema（實際版本，Phase 1-3 執行後更新）

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
```

**跟草案的差異**：
- 拿掉了 `image_url`——三個選定來源裡 CNA 科技版實測完全沒有 item 層級的圖片欄位（無 `enclosure`），暫不需要這個欄位。之後如果自由時報／公視的來源確認有提供圖片，用 `alter table` 加回來即可。
- 新增 `duplicate_of`，對應 4.1 節語意去重複的落地實作。
- Table 有開 Row Level Security（RLS），未設任何 policy。因為所有存取（抓取 script、之後 Phase 4 的 API Route）都走 `secret key`（等同舊版的 `service_role`），本來就會繞過 RLS；開著 RLS 只是防呆——萬一以後不小心把 `publishable key`（等同舊版 `anon`）洩漏到前端，資料表預設仍是鎖住的。

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

**Phase 4：API 層**

- 建立 `/api/news`，支援分類篩選、分頁
- 建立 SSE endpoint

**Phase 5：前端**

- Server Component 首屏渲染 + SEO metadata
- 分類篩選 UI（URL sync）
- SSE 訂閱、新資料提示

**Phase 6：打磨**

- SEO：`generateMetadata`、sitemap、JSON-LD（NewsArticle schema）
- 錯誤處理：來源掛掉、格式異常時的容錯（不能讓一個來源壞掉拖垮整個抓取流程）
- README：清楚寫明架構、版權合規說明、技術取捨（為何用 GitHub Actions 而非 AWS 等）

---

## 7. 未來建議額外補充的部分

目前規劃沒特別提到，但實作時大概率會遇到、也值得展示的細節：

1. **抓取失敗的容錯機制**：某個來源 RSS 暫時打不通或格式改版時，不該讓整個排程 job fail，應該 try/catch 個別來源、記錄失敗、其他來源照常執行。
2. **重複執行保護**：✅ Phase 3 已實作。沒有自己寫「最後執行時間」記錄，改用 GitHub Actions 原生的 `concurrency` 設定（`group` + `cancel-in-progress: false`）：同一 group 同時最多一個 run 在執行，新排程時間到了但前一個還沒跑完，就排隊等，不會兩個同時寫入 Supabase。另外加了 `timeout-minutes: 5`（正常執行只需幾秒），避免萬一真的卡住，GitHub 預設 6 小時才強制取消、卡住其間所有排程的問題。
3. **圖片來源的可靠性**：新聞來源的圖片連結可能會過期或被防盜鏈擋掉，Next.js `next/image` 搭配 `remotePatterns` 設定要注意，必要時做 fallback 圖。
4. **內容分類的一致性**：不同來源的分類命名不一致（例如「政治」vs「政治軍事」），需要一個 mapping table 統一成你自己的分類系統。
   （去重複的詳細做法已在 4.1 節說明：完全重複靠 unique constraint + upsert，語意重複靠「時間窗口 + 標題正規化比對」，避免隨資料量增加而變慢。）
5. **Rate limit / 禮貌性請求**：雖然 RSS 是公開資源，但抓取頻率不宜過高（15-30 分鐘一次已足夠），且建議在 request header 帶上合理的 User-Agent 標示這是什麼服務。
6. **監控**：GitHub Actions 本身有執行紀錄，但可以額外做一個「最後成功抓取時間」的簡單健康檢查頁面或 badge，展示你有維運意識。
7. **測試**：至少對「欄位正規化」這個函式寫 unit test（不同來源格式輸入 → 統一格式輸出），這是最容易出 bug、也最值得證明你有把關的部分。
8. **資料保留策略**：RSS 本身沒有時間區間查詢功能，只提供來源目前最新的一批項目（通常 20-50 則），無法用 RSS 回填歷史資料，資料庫裡的歷史深度完全取決於排程實際跑了多久。使用者主要關注最新新聞，資料庫不需要無限累積，等資料量成長到有感（例如累積數個月後）再視情況加：
   - 定期（例如每天一次的 cron job）清理或封存超過保留門檻（如 90 天）的舊資料
   - 若想保留完整歷史做其他用途，可改成「封存到另一張 archive 表」而非直接刪除，前台查詢的主表維持精簡
   - 資料庫變小對查詢效能、去重複比對（見 4.1）都有幫助，屬於資料量成長後才需要處理的優化項目

---

## 8. 與 Claude Code 協作的建議方式

- 照上面 Phase 1-6 順序逐步進行，每個 Phase 結束後手動驗證再進下一步，避免一次要求 Claude Code 生成整個系統導致架構失控。
- 每個 Phase 開始前，可以先讓 Claude Code 讀這份計畫文件，再針對該 Phase 給具體指令（例如「請依照 Phase 1 的說明，建立抓取中央社 RSS 的 script」）。
