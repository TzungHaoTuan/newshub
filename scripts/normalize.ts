export function stripHtml(text: string | undefined): string | null {
  if (!text) return null;
  const cleaned = text.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  return cleaned || null;
}

function normalizeTitle(title: string): string {
  return title.replace(/[\p{P}\p{S}\s]+/gu, "");
}

// Character bigram shingles — cheap stand-in for word tokenization on
// unsegmented Chinese text (no NLP dependency needed at this scale).
function bigrams(s: string): Set<string> {
  const grams = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) grams.add(s.slice(i, i + 2));
  return grams;
}

// Overlap coefficient (intersection / smaller set size) rather than Jaccard,
// so a short headline fully contained in a longer one still scores high.
export function titleSimilarity(a: string, b: string): number {
  const A = bigrams(normalizeTitle(a));
  const B = bigrams(normalizeTitle(b));
  if (A.size === 0 || B.size === 0) return 0;
  let intersection = 0;
  for (const gram of A) if (B.has(gram)) intersection++;
  return intersection / Math.min(A.size, B.size);
}

export const DUPLICATE_THRESHOLD = 0.7;
