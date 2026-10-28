import { createClient } from "@supabase/supabase-js";
import { createEmbedding, openAi } from "../../ai";
import "dotenv/config";

const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  },
);

async function main() {
  if (!supabaseClient) {
    throw new Error("Error configuring supabase client");
  }

  if (!openAi) {
    throw new Error("Error configuring openai client");
  }

  const passages = await supabaseClient
    .from("policy_passages")
    .select("*")
    .is("embedding", null);

  if (passages.error) {
    throw passages.error;
  }

  if (passages.data) {
    for (let i = 0; i < passages.data.length; i++) {
      const passage = passages.data[i];
      const text = `${passage.title},\n${passage.passages}`;

      if (!text) {
        throw new Error("Error embedding text");
      }

      const embeddedTextArray = await createEmbedding(text);

      if (!embeddedTextArray || embeddedTextArray.length != 1536) {
        throw new Error("Failed to create an embedding");
      }
      console.log("embed", embeddedTextArray[0], passage);
      const { error: updateError, data } = await supabaseClient
        .from("policy_passages")
        .update({ embedding: embeddedTextArray })
        .eq("id", passage.id)
        .select("id");

      if (updateError) {
        throw updateError;
      }

      if (!data || data.length === 0) {
        throw new Error(
          `Failed to update passage ${passage.id}: 0 rows affected. RLS may be blocking updates.`,
        );
      }

      console.log(
        "Text has been embedded for ",
        passage.id,
        embeddedTextArray.length,
      );
    }
  }
}

main();
