"use client";

import { useRef, useState } from "react";
import Link from "next/link";

type Recommendation = {
  id: number;
  title: string;
  type: string;
  price: number;
  bhk: number | null;
  area: string | null;
  image: string | null;
  reason: string;
};

function formatPrice(price: number) {
  const rupee = "₹";

  if (price >= 10000000) {
    return rupee + (price / 10000000).toFixed(2) + " Cr";
  }

  if (price >= 100000) {
    return rupee + (price / 100000).toFixed(0) + " Lakh";
  }

  return rupee + price.toLocaleString("en-IN");
}

const EXAMPLE_PROMPTS = [
  "My budget is 60 lakh, I want a 2BHK apartment",
  "Looking for a villa under 1.5 crore for a family of 4",
  "I have 30 lakh saved, what plot options do I have?",
];

export default function AiAdvisorPage() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState("");
  const [recommendations, setRecommendations] = useState<Recommendation[]>(
    []
  );
  const [hasAsked, setHasAsked] = useState(false);
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const recognitionRef = useRef<any>(null);

  function startListening() {
    if (listening) return;

    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setError(
        "Voice input isn't supported in this browser. Try Chrome, or just type your request instead."
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
        setMessage((prev) =>
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

      setError(message);
      setInterimText("");
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
      setInterimText("");
    };

    recognitionRef.current = recognition;
    setError("");

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

  async function handleAsk(text?: string) {
    const query = (text ?? message).trim();

    if (!query) {
      setError("Tell the advisor what you're looking for first.");
      return;
    }

    setLoading(true);
    setError("");

    const response = await fetch("/api/ai-advisor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: query }),
    });

    const result = await response.json().catch(() => ({}));

    setLoading(false);
    setHasAsked(true);

    if (!response.ok) {
      setError(result?.error || "Something went wrong. Please try again.");
      setSummary("");
      setRecommendations([]);
      return;
    }

    setSummary(result.summary || "");
    setRecommendations(result.recommendations || []);
  }

  return (
    <main className="min-h-screen bg-zinc-50">

      <div className="border-b border-black/10 bg-header-bg">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">

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

          <Link
            href="/"
            className="text-sm font-semibold text-header-fg/70 hover:text-white"
          >
            Back to listings
          </Link>

        </div>
      </div>


      <div className="mx-auto max-w-4xl px-4 py-10">

        <div className="mb-7 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
            AI Property Advisor
          </p>

          <h1 className="mt-2 text-3xl font-black text-zinc-900 md:text-4xl">
            Tell us what you&apos;re looking for
          </h1>

          <p className="mx-auto mt-2 max-w-xl text-zinc-500">
            Describe your budget and what kind of property you want, in
            your own words. The advisor will suggest matching listings
            from what&apos;s currently available.
          </p>
        </div>


        <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">

          <div className="relative">

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. My salary is 80,000 a month, I've saved 25 lakh, and I want a 2BHK apartment in Jagatpura..."
              rows={3}
              className="w-full resize-none rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 pr-14 text-sm text-zinc-800 outline-none focus:border-accent"
            />

            <button
              type="button"
              onClick={listening ? stopListening : startListening}
              title={listening ? "Stop listening" : "Speak your request"}
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

          <div className="mt-3 flex flex-wrap gap-2">
            {EXAMPLE_PROMPTS.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => {
                  setMessage(example);
                  handleAsk(example);
                }}
                className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-500 transition hover:border-accent hover:text-accent"
              >
                {example}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => handleAsk()}
            disabled={loading}
            className="mt-4 w-full rounded-2xl bg-accent px-5 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Thinking..." : "Ask the Advisor"}
          </button>

        </div>


        {error && (
          <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}


        {!error && hasAsked && summary && (
          <div className="mt-6 rounded-2xl border border-accent-soft bg-accent-soft/40 px-5 py-4">
            <p className="text-sm leading-6 text-zinc-800">{summary}</p>
          </div>
        )}


        {!error && recommendations.length > 0 && (
          <div className="mt-6 space-y-4">

            {recommendations.map((property) => (
              <Link
                key={property.id}
                href={`/properties/${property.id}`}
                className="flex flex-col gap-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-accent sm:flex-row"
              >

                <img
                  src={
                    property.image ||
                    "https://placehold.co/300x200?text=Property"
                  }
                  alt={property.title}
                  className="h-40 w-full rounded-2xl object-cover sm:h-32 sm:w-44"
                />

                <div className="flex-1">

                  <p className="text-xs font-bold uppercase tracking-wide text-accent">
                    {property.type}
                    {property.bhk ? ` - ${property.bhk} BHK` : ""}
                  </p>

                  <h2 className="mt-1 text-lg font-black text-zinc-900">
                    {property.title}
                  </h2>

                  <p className="mt-1 text-sm text-zinc-500">
                    {property.area}
                  </p>

                  <p className="mt-1 text-base font-black text-accent">
                    {formatPrice(property.price)}
                  </p>

                  <p className="mt-2 rounded-xl bg-zinc-50 px-3 py-2 text-sm leading-5 text-zinc-600">
                    {property.reason}
                  </p>

                </div>

              </Link>
            ))}

          </div>
        )}


        {!error &&
          hasAsked &&
          !loading &&
          recommendations.length === 0 &&
          summary && (
            <div className="mt-6 text-center">
              <Link
                href="/"
                className="inline-block rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-bold text-white"
              >
                Browse all listings instead
              </Link>
            </div>
          )}

      </div>

    </main>
  );
}
