import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    return new Response("Supabase URL or key is not set", { status: 500 });
  }

  const supabaseClient = createClient(url, key);

  const { data, error } = await supabaseClient
    .from("policy_passages")
    .select("id, title, passages, suggested_reply")
    .order("title");

  if (error) {
    return new Response(`Error fetching policies: ${error.message}`, {
      status: 500,
    });
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
