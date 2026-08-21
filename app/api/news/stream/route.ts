import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
// ponytail: Vercel kills functions past maxDuration; EventSource auto-reconnects either way,
// this just spaces the reconnects out instead of every ~10-60s on the platform default.
export const maxDuration = 60;

const POLL_INTERVAL_MS = 10_000;
const HEARTBEAT_INTERVAL_MS = 15_000;

export async function GET(request: Request) {
  const encoder = new TextEncoder();
  let lastCheckedAt = new Date().toISOString();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      const poll = async () => {
        const { data, error } = await supabase
          .from("articles")
          .select("id, source, category, tags, title, summary, link, published_at")
          .is("duplicate_of", null)
          .gt("fetched_at", lastCheckedAt)
          .order("published_at", { ascending: false });

        if (!error && data && data.length > 0) {
          lastCheckedAt = new Date().toISOString();
          send("news", data);
        }
      };

      const pollTimer = setInterval(poll, POLL_INTERVAL_MS);
      // Idle SSE connections get killed by proxies/browsers without periodic traffic.
      const heartbeatTimer = setInterval(() => {
        controller.enqueue(encoder.encode(": heartbeat\n\n"));
      }, HEARTBEAT_INTERVAL_MS);

      request.signal.addEventListener("abort", () => {
        clearInterval(pollTimer);
        clearInterval(heartbeatTimer);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
