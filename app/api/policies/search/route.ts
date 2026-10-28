import {
  chatCompletion,
  cosineSimilarity,
  createEmbedding,
  parseEmbedding,
} from "@/lib/ai";
import { Policy } from "@/lib/policies";
import { createSrClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: Request) {
  const question = new URL(request.url).searchParams.get("q")?.trim();

  if (!question) {
    return new NextResponse(
      JSON.stringify({ error: "Missing question parameter" }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }

  const supabaseClient = await createSrClient();

  const { data, error } = await supabaseClient
    .from("policy_passages")
    .select("*")
    .order("title");

  if (error) {
    return new Response(`Error fetching policies: ${error.message}`, {
      status: 500,
    });
  }

  const questionEmbedding = await createEmbedding(question);

  if (data?.length) {
    const rankedPolicies = data
      .flatMap((policy) => {
        const policyEmbedding = parseEmbedding(policy.embedding);
        if (!policyEmbedding) return [];

        console.log("policyEmbedding length:", policyEmbedding.length);
        console.log("questionEmbedding length:", questionEmbedding.length);

        return {
          ...policy,
          similarity: cosineSimilarity(policyEmbedding, questionEmbedding),
        };
      })
      .sort((a, b) => b.similarity - a.similarity);

    // text-embedding-3-small uses a wider dynamic range than older models (ada-002).
    // Relevant matches typically score between 0.25 and 0.50, whereas irrelevant text scores near 0.0 - 0.15.
    const minimumSimilarity = 0.25;

    console.log(
      "Ranked matches:",
      rankedPolicies.map((p) => ({ title: p.title, similarity: p.similarity })),
    );

    if (rankedPolicies[0].similarity < minimumSimilarity) {
      console.log(
        `Top match score (${rankedPolicies[0].similarity}) below threshold (${minimumSimilarity})`,
      );
      return NextResponse.json({
        error: "Couldn't find a better policy",
      });
    }
    return NextResponse.json(rankedPolicies[0]);
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const supabaseClient = await createSrClient();

  const {
    data: { user },
    error: authError,
  } = await supabaseClient.auth.getUser();

  if (!user || authError) {
    return NextResponse.json(
      {
        message: "Unauthorized",
      },
      {
        status: 401,
        statusText: "Unauthorized",
      },
    );
  }

  if (typeof body.question !== "string" || !body.question.trim()) {
    return NextResponse.json({
      status: 400,
      message: "Expected a string field for question",
    });
  }

  if (body.question.length > 2000) {
    return NextResponse.json({
      status: 400,
      message:
        "The question can be atmost 2000 characters long . Please try again. ",
    });
  }

  const { data: policyDocs, error } = await supabaseClient
    .from("policy_passages")
    .select("id, title, passages, suggested_reply, embedding")
    .order("title");

  if (error) {
    return new Response(`Error fetching policies: ${error.message}`, {
      status: 500,
    });
  }
  let questionEmbedding;
  try {
    questionEmbedding = await createEmbedding(body.question);
  } catch (error) {
    console.error("Question embedding failed:", error);

    return NextResponse.json(
      {
        error:
          "The answer service is temporarily unavailable. Please try again.",
      },
      { status: 502 },
    );
  }

  const rankedPolicies = (policyDocs ?? [])
    .flatMap((policy) => {
      const policyEmbedding = parseEmbedding(policy.embedding);
      if (!policyEmbedding) return [];

      return {
        id: policy.id,
        title: policy.title,
        passages: policy.passages,
        suggestedReply: policy.suggested_reply,
        similarity: cosineSimilarity(policyEmbedding, questionEmbedding),
      };
    })
    .sort((a, b) => b.similarity - a.similarity);

  const minimumSimilarity = 0.36;

  console.log(
    "POST Ranked matches:",
    rankedPolicies.map((p) => ({ title: p.title, similarity: p.similarity })),
  );

  if (!rankedPolicies.length) {
    return NextResponse.json(
      { error: "No policies with valid embeddings were found" },
      { status: 404 },
    );
  }

  if (rankedPolicies[0].similarity < minimumSimilarity) {
    return NextResponse.json({
      answer:
        "I couldn't find an answer in the store policies. Please ask a support agent to review this question.",
      source: null,
    });
  }

  const bestMatch = {
    id: rankedPolicies[0].id,
    title: rankedPolicies[0].title,
    passages: rankedPolicies[0].passages,
    suggestedReply: rankedPolicies[0].suggestedReply,
  };

  const chatData = await chatCompletion(
    body.question,
    bestMatch as unknown as Policy,
  );

  if (!chatData) {
    return NextResponse.json(
      { error: "The AI did not return an answer. Please try again." },
      { status: 502 },
    );
  }

  return NextResponse.json({
    answer: chatData,
    source: bestMatch,
  });
}
