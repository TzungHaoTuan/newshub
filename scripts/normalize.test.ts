import { test } from "node:test";
import assert from "node:assert/strict";
import { stripHtml, titleSimilarity, DUPLICATE_THRESHOLD } from "./normalize";

test("stripHtml removes tags and collapses whitespace", () => {
  assert.equal(stripHtml("<p>hello\n\n  world</p>"), "hello world");
});

test("stripHtml returns null for empty or missing input", () => {
  assert.equal(stripHtml(undefined), null);
  assert.equal(stripHtml("   "), null);
});

test("titleSimilarity is 1 for identical titles", () => {
  assert.equal(titleSimilarity("AI模型百家爭鳴", "AI模型百家爭鳴"), 1);
});

test("titleSimilarity is low for unrelated titles", () => {
  const score = titleSimilarity("特斯拉傳與SpaceX合作", "颱風假明天停班停課");
  assert.ok(score < DUPLICATE_THRESHOLD, `expected < ${DUPLICATE_THRESHOLD}, got ${score}`);
});

test("titleSimilarity ignores punctuation differences", () => {
  const score = titleSimilarity("薄底鞋熱潮燒進Loro Piana！", "薄底鞋熱潮燒進Loro Piana");
  assert.equal(score, 1);
});

test("titleSimilarity scores a short title fully contained in a longer one as high (overlap coefficient)", () => {
  const score = titleSimilarity("台灣隊力退巴林闖8強", "U18亞洲盃》台灣隊力退巴林闖8強晉級四強賽");
  assert.ok(score >= DUPLICATE_THRESHOLD, `expected >= ${DUPLICATE_THRESHOLD}, got ${score}`);
});

test("titleSimilarity flags a real near-duplicate pair caught in production", () => {
  const score = titleSimilarity(
    "今年度總預算三讀通刪480億元 府院稱不合理恐衝擊運作",
    "今年度總預算減列480億元 府院稱遺憾、衝擊運作",
  );
  assert.ok(score >= DUPLICATE_THRESHOLD, `expected >= ${DUPLICATE_THRESHOLD}, got ${score}`);
});
