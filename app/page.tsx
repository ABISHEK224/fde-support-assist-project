"use client";

import { createClient } from "@/lib/supabase/client";
import { AuthError } from "@supabase/supabase-js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type AnswerResponse = {
  answer: string;
  source: {
    id: number;
    title: string;
    passages: string;
  } | null;
};

type Review = {
  id: string;
  question: string;
  draft_answer: string;
  final_answer: string | null;
  decision: "approved" | "edited" | "rejected";
  created_at: string;
};

type ReviewDecision = "approved" | "edited" | "rejected";

export default function Home() {
  const [question, setQuestion] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const router = useRouter();

  const [signOutError, setSignoutError] = useState<AuthError>();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [editedAnswer, setEditedAnswer] = useState("");
  const [isReviewPending, setIsReviewPending] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewError, setReviewError] = useState("");

  const queryClient = useQueryClient();

  useEffect(() => {
    setIsSigningOut(false);
  }, []);

  const reviewsQuery = useQuery({
    queryKey: ["reviews"],
    queryFn: async () => {
      const response = await fetch("/api/policies/reviews");

      if (!response.ok) {
        throw new Error("Error fetching reply");
      }

      return await response.json();
    },
  });

  const {
    mutate: getAnswer,
    data: mutationResponse,
    error: mutationError,
    isSuccess: mutationSuccess,
    isPending: isAnswerPending,
  } = useMutation<AnswerResponse, Error, string>({
    mutationFn: async (question: string) => {
      setReviewMessage("");
      const response = await fetch("/api/policies/search", {
        method: "POST",
        body: JSON.stringify({
          question,
        }),
      });

      if (!response.ok) {
        throw new Error("Error fetching reply");
      }

      return await response.json();
    },
  });

  const saveReview = async (decision: ReviewDecision) => {
    setIsReviewPending(true);
    setReviewMessage("");
    setReviewError("");

    const finalAnswer =
      decision === "approved"
        ? mutationResponse?.answer
        : decision === "edited"
          ? editedAnswer
          : null;
    try {
      const response = await fetch("/api/policies/reviews", {
        method: "POST",
        body: JSON.stringify({
          question,
          draftAnswer: mutationResponse?.answer,
          finalAnswer,
          decision,
          sourcePolicyId: mutationResponse?.source?.id ?? null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Could not save review");
      }
      setReviewMessage(`Review ${decision}`);
      await queryClient.invalidateQueries({ queryKey: ["reviews"] });
    } catch (error) {
      setReviewError(
        error instanceof Error ? error.message : "Could not save review",
      );
    } finally {
      setIsReviewPending(false);
    }
  };

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (question.trim()) {
      setSubmitted(true);
      setEditedAnswer("");
      setReviewMessage("");
      setReviewError("");
      getAnswer(question);
    }
  }

  const handleSignOut = async () => {
    setIsSigningOut(true);
    const supabaseClient = createClient();

    const response = await supabaseClient.auth.signOut();

    if (response.error) {
      setSignoutError(response.error);
      setIsSigningOut(false);
      return;
    }

    queryClient.clear();
    window.location.href = "/login";
  };
  return (
    <div>
      <main className="mx-auto min-h-screen max-w-3xl px-6 py-12">
        <header className="mb-10">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-blue-700">
              Store support assistant
            </p>
            <button
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:text-red-600 hover:border-red-200 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-3.5 h-3.5"
              >
                <path
                  fillRule="evenodd"
                  d="M3 4.25A2.25 2.25 0 0 1 5.25 2h5.5A2.25 2.25 0 0 1 13 4.25v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2a.75.75 0 0 1 1.5 0v2A2.25 2.25 0 0 1 10.75 18h-5.5A2.25 2.25 0 0 1 3 15.75V4.25Z"
                  clipRule="evenodd"
                />
                <path
                  fillRule="evenodd"
                  d="M19 10a.75.75 0 0 0-.75-.75H8.704l2.473-2.47a.75.75 0 1 0-1.06-1.06l-3.75 3.75a.75.75 0 0 0 0 1.06l3.75 3.75a.75.75 0 1 0 1.06-1.06L8.704 10.75H18.25A.75.75 0 0 0 19 10Z"
                  clipRule="evenodd"
                />
              </svg>
              {isSigningOut ? "Signing out..." : "Sign out"}
            </button>
          </div>
          <h1 className="mt-2 text-3xl font-bold">
            Find an answer for a customer
          </h1>
          <p className="mt-2 text-gray-600">
            Ask about shipping, returns, or damaged items.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label htmlFor="question" className="block font-medium">
            Customer question
          </label>

          <textarea
            id="question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="For example: Can I return an item after 20 days?"
            rows={4}
            className="w-full rounded-lg border border-gray-300 p-3"
          />

          <button
            type="submit"
            disabled={isAnswerPending}
            className="rounded-lg bg-blue-700 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isAnswerPending ? "Finding an answer..." : "Find an answer"}
          </button>
        </form>
        {isAnswerPending && (
          <p className="mt-5 text-gray-600" role="status" aria-live="polite">
            Searching for an answer...
          </p>
        )}
        {mutationError && (
          <p className="mt-5 text-red-600">
            Error searching for an answer: {mutationError.message}
          </p>
        )}
        {signOutError && <p role="alert">{signOutError.message}</p>}
        {submitted && mutationSuccess && (
          <section aria-live="polite" className="mt-8 rounded-lg border p-5">
            {mutationResponse ? (
              <>
                <h2 className="text-xl font-semibold">Suggested answer</h2>
                <p className="mt-3">{mutationResponse.answer}</p>

                {mutationResponse.source && (
                  <>
                    <h3 className="mt-5 font-semibold">
                      Source: {mutationResponse.source?.title || "--"}
                    </h3>
                    <blockquote className="mt-2 border-l-4 pl-3 text-gray-600">
                      <label
                        htmlFor="edited-answer"
                        className="mt-5 block font-medium"
                      >
                        Final answer
                      </label>

                      <textarea
                        id="edited-answer"
                        value={editedAnswer || mutationResponse.answer}
                        onChange={(event) =>
                          setEditedAnswer(event.target.value)
                        }
                        rows={4}
                        className="mt-2 w-full rounded-lg border border-gray-300 p-3"
                      />

                      <div className="mt-4 flex gap-2">
                        <button
                          type="button"
                          onClick={() => saveReview("approved")}
                          disabled={isReviewPending}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                          Approve
                        </button>

                        <button
                          type="button"
                          onClick={() => saveReview("edited")}
                          disabled={isReviewPending}
                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                          Save edit
                        </button>

                        <button
                          type="button"
                          onClick={() => saveReview("rejected")}
                          disabled={isReviewPending}
                          className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                          Reject
                        </button>
                      </div>

                      {reviewMessage && (
                        <p role="status" className="mt-3 text-sm font-medium text-emerald-600">
                          {reviewMessage}
                        </p>
                      )}
                      {reviewError && (
                        <p role="alert" className="mt-3 text-sm font-medium text-red-600">
                          {reviewError}
                        </p>
                      )}
                    </blockquote>
                  </>
                )}
              </>
            ) : (
              <p>
                I couldn't find a matching policy. Ask a human support agent to
                review this question.
              </p>
            )}
          </section>
        )}

        <section className="mt-10">
          <h2 className="text-xl font-semibold">Recent reviews</h2>

          {reviewsQuery.isPending && (
            <p className="mt-3 text-gray-500">Loading reviews...</p>
          )}

          {reviewsQuery.isError && (
            <p role="alert" className="mt-3 text-red-600">
              Could not load reviews: {reviewsQuery.error.message}
            </p>
          )}

          {reviewsQuery.data?.reviews?.length === 0 && (
            <p className="mt-3 text-gray-600">No reviews saved yet.</p>
          )}

          <ul className="mt-4 space-y-4">
            {reviewsQuery.data?.reviews?.map((review: Review) => (
              <li key={review.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-gray-900">{review.question}</p>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      review.decision === "approved"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : review.decision === "edited"
                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                          : "bg-red-50 text-red-700 border border-red-200"
                    }`}
                  >
                    {review.decision}
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-700">
                  {review.final_answer ??
                    (review.decision === "rejected"
                      ? "Draft rejected"
                      : review.draft_answer)}
                </p>
                <time className="mt-2 block text-xs text-gray-400">
                  {new Date(review.created_at).toLocaleString()}
                </time>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
