import { createSrClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

type ReviewDecision = "approved" | "edited" | "rejected";

export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const supabaseClient = await createSrClient();
  const {
    data: { user },
    error: authError,
  } = await supabaseClient.auth.getUser();

  if (!user || authError) {
    return NextResponse.json(
      {
        error: "Unauthorized",
      },
      {
        status: 401,
      },
    );
  }

  const { question, draftAnswer, finalAnswer, decision, sourcePolicyId } = body;

  if (
    typeof question !== "string" ||
    typeof draftAnswer !== "string" ||
    !["approved", "edited", "rejected"].includes(decision)
  ) {
    return NextResponse.json(
      {
        error: "Invalid review data",
      },
      {
        status: 400,
      },
    );
  }

  const { data, error } = await supabaseClient
    .from("answer_reviews")
    .insert({
      user_id: user.id,
      question,
      draft_answer: draftAnswer,
      final_answer: finalAnswer,
      decision,
      source_policy_id: sourcePolicyId,
    })
    .select()
    .single();

  if (error) {
    console.error("Could not save review:", error.message);
    return Response.json({ error: "Could not save review" }, { status: 500 });
  }

  return Response.json({ review: data }, { status: 201 });
}

export const GET = async () => {
  const supabaseClient = await createSrClient();
  const {
    data: { user },
    error: authError,
  } = await supabaseClient.auth.getUser();

  if (!user || authError) {
    return NextResponse.json(
      {
        error: "Unauthorized",
      },
      {
        status: 401,
      },
    );
  }

  const response = await supabaseClient
    .from("answer_reviews")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", {
      ascending: false,
    })
    .limit(20);

  if (response.error) {
    return NextResponse.json(
      {
        error: `Could not fetch reviews: ${response.error.message}`,
      },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      reviews: response.data ?? [],
    },
    { status: 200 },
  );
};
