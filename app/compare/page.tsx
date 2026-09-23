"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

type ComparisonNote = { id: number; note: string };

type ComparisonAdvice = {
  recommendedId: number | null;
  reason: string;
  otherNotes: ComparisonNote[];
};

type Property = {
  id: number;
  title: string;
  type: string;
  price: number;
  bhk: number;
  area: string;
  facing: string;
  parking: string;
  road: string;
  image: string;
  verification_status?: string;
};

function formatPrice(price: number) {
  if (price >= 10000000) {
    return "INR " + (price / 10000000).toFixed(2) + " Cr";
  }

  if (price >= 100000) {
    return "INR " + (price / 100000).toFixed(0) + " Lakh";
  }

  return "INR " + price.toLocaleString("en-IN");
}

function parseAreaSqft(area: string) {
  if (!area) return null;

  const match = area.match(/[\d,.]+/);

  if (!match) return null;

  const value = parseFloat(match[0].replace(/,/g, ""));

  return isNaN(value) ? null : value;
}

function pricePerSqft(price: number, area: string) {
  const sqft = parseAreaSqft(area);

  if (!sqft || sqft === 0) return null;

  return Math.round(price / sqft);
}

const ROWS: {
  label: string;
  render: (p: Property) => React.ReactNode;
}[] = [
  {
    label: "Price",
    render: (p) => (
      <span className="font-black text-accent">
        {formatPrice(p.price)}
      </span>
    ),
  },
  {
    label: "Price / sq ft",
    render: (p) => {
      const value = pricePerSqft(p.price, p.area);

      return value
        ? `INR ${value.toLocaleString("en-IN")}`
        : "-";
    },
  },
  {
    label: "Type",
    render: (p) => p.type || "-",
  },
  {
    label: "BHK",
    render: (p) => (p.bhk ? `${p.bhk} BHK` : "-"),
  },
  {
    label: "Area",
    render: (p) => p.area || "-",
  },
  {
    label: "Facing",
    render: (p) => p.facing || "-",
  },
  {
    label: "Parking",
    render: (p) => p.parking || "-",
  },
  {
    label: "Road Width",
    render: (p) => p.road || "-",
  },
  {
    label: "Verification",
    render: (p) =>
      p.verification_status === "approved" ? (
        <span className="font-bold text-verified">
          Verified
        </span>
      ) : (
        <span className="font-semibold text-zinc-400">
          Pending
        </span>
      ),
  },
];

const QUESTIONS = [
  {
    key: "budget",
    question: "What's your budget?",
    placeholder: "e.g. Firm at 90 lakh, or flexible up to 1 crore",
  },
  {
    key: "household",
    question: "Who's this home for?",
    placeholder: "e.g. Family of 4, need 2 car parking",
  },
  {
    key: "priority",
    question: "What matters most to you?",
    placeholder:
      "e.g. Price above everything, or more space even if pricier",
  },
] as const;

function ComparePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [properties, setProperties] = useState<Property[]>(
    []
  );
  const [loading, setLoading] = useState(true);

  const [answers, setAnswers] = useState<Record<string, string>>({
    budget: "",
    household: "",
    priority: "",
  });
  const [step, setStep] = useState(0);
  const [advisorLoading, setAdvisorLoading] = useState(false);
  const [advisorError, setAdvisorError] = useState("");
  const [advice, setAdvice] = useState<ComparisonAdvice | null>(null);
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const recognitionRef = useRef<any>(null);

  const [storyline, setStoryline] = useState("");
  const [storylineLoading, setStorylineLoading] = useState(false);
  const [storylineError, setStorylineError] = useState("");
  const storylineFetchedFor = useRef("");

  const idsParam = searchParams.get("ids") || "";

  useEffect(() => {
    async function loadProperties() {
      const ids = idsParam
        .split(",")
        .map((id) => Number(id))
        .filter((id) => !isNaN(id));

      if (ids.length === 0) {
        setProperties([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .in("id", ids);

      if (!error && data) {
        const ordered = ids
          .map((id) =>
            data.find((p) => p.id === id)
          )
          .filter(Boolean) as Property[];

        setProperties(ordered);
      }

      setLoading(false);
    }

    loadProperties();
  }, [idsParam]);

  useEffect(() => {
    if (loading || properties.length < 2) return;
    if (storylineFetchedFor.current === idsParam) return;

    storylineFetchedFor.current = idsParam;

    async function loadStoryline() {
      setStorylineLoading(true);
      setStorylineError("");

      const response = await fetch("/api/compare-storyline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyIds: properties.map((p) => p.id),
        }),
      });

      const result = await response.json().catch(() => ({}));

      setStorylineLoading(false);

      if (!response.ok) {
        setStorylineError(result?.error || "Couldn't generate an overview.");
        return;
      }

      setStoryline(result.storyline || "");
    }

    loadStoryline();
  }, [loading, properties, idsParam]);

  function removeProperty(id: number) {
    const remaining = properties
      .filter((p) => p.id !== id)
      .map((p) => p.id);

    if (remaining.length === 0) {
      router.push("/");
      return;
    }

    router.push(`/compare?ids=${remaining.join(",")}`);
  }

  function updateAnswer(key: string, updater: string | ((prev: string) => string)) {
    setAnswers((prev) => ({
      ...prev,
      [key]:
        typeof updater === "function"
          ? (updater as (prev: string) => string)(prev[key] || "")
          : updater,
    }));
  }

  function startListening(key: string) {
    if (listening) return;

    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setAdvisorError(
        "Voice input isn't supported in this browser. Try Chrome, or just type instead."
      );
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-IN";
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      let interim = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interim += transcript;
        }
      }

      if (finalTranscript) {
        updateAnswer(key, (prev) =>
          prev ? `${prev} ${finalTranscript}`.trim() : finalTranscript.trim()
        );
        setInterimText("");
      } else {
        setInterimText(interim);
      }
    };

    recognition.onerror = (event: any) => {
      let message =
        "Voice input had a problem. Please try again, or just type instead.";

      if (event?.error === "not-allowed" || event?.error === "service-not-allowed") {
        message =
          "Microphone access is blocked. Allow microphone permission for this site in your browser, then try again.";
      } else if (event?.error === "no-speech") {
        message = "Didn't catch that -- no speech detected. Try again.";
      } else if (event?.error === "audio-capture") {
        message = "No microphone found on this device.";
      } else if (event?.error === "network") {
        message = "Voice input needs an internet connection.";
      }

      setAdvisorError(message);
      setInterimText("");
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
      setInterimText("");
    };

    recognitionRef.current = recognition;
    setAdvisorError("");

    try {
      setListening(true);
      recognition.start();
    } catch {
      setListening(false);
    }
  }

  function stopListening() {
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore -- already stopped
    }
    setListening(false);
  }

  async function handleAskAdvisor() {
    const hasAnyAnswer = QUESTIONS.some((q) => (answers[q.key] || "").trim());

    if (!hasAnyAnswer) {
      setAdvisorError(
        "Answer at least one question so the advisor has something to go on."
      );
      return;
    }

    const message = QUESTIONS.map(
      (q) => `${q.question} ${answers[q.key]?.trim() || "Not specified."}`
    ).join(" ");

    setAdvisorLoading(true);
    setAdvisorError("");
    setAdvice(null);

    const response = await fetch("/api/compare-advisor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        propertyIds: properties.map((p) => p.id),
      }),
    });

    const result = await response.json().catch(() => ({}));

    setAdvisorLoading(false);

    if (!response.ok) {
      setAdvisorError(result?.error || "Something went wrong. Please try again.");
      return;
    }

    setAdvice(result as ComparisonAdvice);
  }

  return (
    <main className="min-h-screen bg-zinc-50">

      <div className="border-b border-black/10 bg-header-bg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">

          <Link href="/" className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt="99Bricks"
              className="h-9 w-9 rounded-full object-cover shadow-sm"
            />
            <span className="text-sm font-black text-header-fg">
              99Bricks
            </span>
          </Link>

          <div className="flex items-center gap-4">

            <Link
              href="/ai-advisor"
              className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white transition hover:opacity-90"
            >
              Ask AI Advisor
            </Link>

            <Link
              href="/"
              className="text-sm font-semibold text-header-fg/70 hover:text-white"
            >
              Back to listings
            </Link>

          </div>

        </div>
      </div>


      <div className="mx-auto max-w-6xl px-4 py-8">

        <div className="mb-7">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-500">
            Compare properties
          </p>

          <h1 className="mt-2 text-3xl font-black text-zinc-900 md:text-4xl">
            Side-by-side comparison
          </h1>
        </div>


        {loading && (
          <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center text-sm font-medium text-zinc-500">
            Loading properties...
          </div>
        )}


        {!loading && properties.length < 2 && (
          <div className="rounded-3xl border border-zinc-200 bg-white p-10 text-center">
            <h2 className="text-xl font-black text-zinc-900">
              Select at least 2 properties to compare
            </h2>

            <p className="mt-2 text-sm text-zinc-500">
              Go back to the listings, tick &quot;Compare&quot; on
              two or more properties, then hit Compare.
            </p>

            <Link
              href="/"
              className="mt-5 inline-block rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
            >
              Back to listings
            </Link>
          </div>
        )}


        {!loading && properties.length >= 2 && (
          <div className="overflow-x-auto rounded-3xl border border-zinc-200 bg-white shadow-sm">
            <table className="w-full min-w-[640px] border-collapse text-sm">

              <thead>
                <tr>
                  <th className="w-40 border-b border-zinc-200 bg-zinc-50 p-4 text-left text-xs font-bold uppercase tracking-wide text-zinc-400">
                    &nbsp;
                  </th>

                  {properties.map((property) => (
                    <th
                      key={property.id}
                      className="min-w-[220px] border-b border-l border-zinc-200 p-4 text-left align-top"
                    >
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            removeProperty(property.id)
                          }
                          className="absolute right-0 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-500 hover:bg-zinc-200"
                          title="Remove from comparison"
                        >
                          ×
                        </button>

                        <Link
                          href={`/properties/${property.id}`}
                        >
                          <img
                            src={
                              property.image ||
                              "https://placehold.co/300x200?text=Property"
                            }
                            alt={property.title}
                            className="h-28 w-full rounded-xl object-cover"
                          />

                          {advice?.recommendedId === property.id && (
                            <span className="mt-2 inline-block rounded-full bg-accent px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                              AI Pick
                            </span>
                          )}

                          <p className="mt-2 pr-6 text-sm font-bold leading-snug text-zinc-900 hover:text-accent">
                            {property.title}
                          </p>
                        </Link>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {ROWS.map((row, index) => (
                  <tr
                    key={row.label}
                    className={
                      index % 2 === 0
                        ? "bg-white"
                        : "bg-zinc-50/60"
                    }
                  >
                    <td className="border-b border-zinc-200 p-4 text-xs font-bold uppercase tracking-wide text-zinc-400">
                      {row.label}
                    </td>

                    {properties.map((property) => (
                      <td
                        key={property.id}
                        className="border-b border-l border-zinc-200 p-4 font-semibold text-zinc-800"
                      >
                        {row.render(property)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>

            </table>
          </div>
        )}


        {!loading && properties.length >= 2 && (
          <div className="mt-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">

            <p className="text-xs font-bold uppercase tracking-wider text-red-500">
              AI overview
            </p>

            <h2 className="mt-1 text-xl font-black text-zinc-900">
              How these compare
            </h2>

            {storylineLoading && (
              <p className="mt-3 text-sm text-zinc-400">
                Writing an overview...
              </p>
            )}

            {storylineError && (
              <p className="mt-3 text-sm font-semibold text-red-600">
                {storylineError}
              </p>
            )}

            {!storylineLoading && !storylineError && storyline && (
              <p className="mt-3 text-sm leading-6 text-zinc-700">
                {storyline}
              </p>
            )}

          </div>
        )}


        {!loading && properties.length >= 2 && (
          <div className="mt-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">

            <p className="text-xs font-bold uppercase tracking-wider text-red-500">
              Ask AI which one is best for you
            </p>

            <h2 className="mt-1 text-xl font-black text-zinc-900">
              {step < QUESTIONS.length
                ? `Question ${step + 1} of ${QUESTIONS.length}`
                : "Ready for your recommendation"}
            </h2>

            {step < QUESTIONS.length && (
              <>

                <p className="mt-2 text-base font-semibold text-zinc-800">
                  {QUESTIONS[step].question}
                </p>

                <div className="relative mt-3">

                  <textarea
                    value={answers[QUESTIONS[step].key] || ""}
                    onChange={(e) =>
                      updateAnswer(QUESTIONS[step].key, e.target.value)
                    }
                    placeholder={QUESTIONS[step].placeholder}
                    rows={2}
                    className="w-full resize-none rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 pr-14 text-sm text-zinc-800 outline-none focus:border-accent"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      listening
                        ? stopListening()
                        : startListening(QUESTIONS[step].key)
                    }
                    title={listening ? "Stop listening" : "Speak your answer"}
                    className={`absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-lg transition ${
                      listening
                        ? "animate-pulse bg-red-600 text-white"
                        : "bg-zinc-100 text-zinc-500 hover:bg-accent-soft hover:text-accent"
                    }`}
                  >
                    🎤
                  </button>

                </div>

                {listening && (
                  <p className="mt-2 text-xs font-semibold text-accent">
                    Listening... {interimText || "speak now."}
                  </p>
                )}

                <div className="mt-4 flex items-center justify-between gap-2">

                  {step > 0 ? (
                    <button
                      type="button"
                      onClick={() => setStep((s) => s - 1)}
                      className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-50"
                    >
                      Back
                    </button>
                  ) : (
                    <span />
                  )}

                  <button
                    type="button"
                    onClick={() => setStep((s) => s + 1)}
                    className="rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
                  >
                    {step === QUESTIONS.length - 1 ? "Review my answers" : "Next"}
                  </button>

                </div>

              </>
            )}

            {step >= QUESTIONS.length && (
              <>

                <div className="mt-3 space-y-2 rounded-2xl bg-zinc-50 p-4">
                  {QUESTIONS.map((q) => (
                    <p key={q.key} className="text-sm text-zinc-700">
                      <span className="font-bold text-zinc-900">
                        {q.question}
                      </span>{" "}
                      {answers[q.key]?.trim() ? (
                        answers[q.key]
                      ) : (
                        <span className="italic text-zinc-400">
                          (skipped)
                        </span>
                      )}
                    </p>
                  ))}
                </div>

                <p className="mt-3 text-xs text-zinc-400">
                  Happy with these answers? Confirm below to run the
                  recommendation -- it won&apos;t run on its own.
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">

                  <button
                    type="button"
                    onClick={() => setStep(0)}
                    className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-50"
                  >
                    Edit answers
                  </button>

                  <button
                    type="button"
                    onClick={handleAskAdvisor}
                    disabled={advisorLoading}
                    className="rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                  >
                    {advisorLoading
                      ? "Thinking..."
                      : "Okay, Get My Recommendation"}
                  </button>

                </div>

              </>
            )}


            {advisorError && (
              <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {advisorError}
              </div>
            )}


            {advice && advice.recommendedId !== null && (
              <div className="mt-5 rounded-2xl border border-accent-soft bg-accent-soft/40 px-5 py-4">

                <p className="text-xs font-bold uppercase tracking-wide text-accent">
                  AI recommends
                </p>

                <h3 className="mt-1 text-lg font-black text-zinc-900">
                  {
                    properties.find((p) => p.id === advice.recommendedId)
                      ?.title
                  }
                </h3>

                <p className="mt-2 text-sm leading-6 text-zinc-700">
                  {advice.reason}
                </p>

                {advice.otherNotes.length > 0 && (
                  <div className="mt-4 space-y-2 border-t border-accent-soft pt-4">
                    {advice.otherNotes.map((note) => (
                      <p
                        key={note.id}
                        className="text-sm leading-5 text-zinc-600"
                      >
                        <span className="font-bold text-zinc-800">
                          {properties.find((p) => p.id === note.id)?.title}:
                        </span>{" "}
                        {note.note}
                      </p>
                    ))}
                  </div>
                )}

              </div>
            )}

          </div>
        )}

      </div>

    </main>
  );
}

export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-zinc-50">
          <p className="text-sm font-medium text-zinc-500">
            Loading...
          </p>
        </main>
      }
    >
      <ComparePageInner />
    </Suspense>
  );
}
