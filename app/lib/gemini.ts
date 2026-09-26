// Server-only helper for calling the Gemini API to generate AI Suggestions
// content (description rewrites, SEO meta, and more suggestion types
// later). Never import this file from a "use client" component --
// GEMINI_API_KEY is not a NEXT_PUBLIC_ var and must stay server-side only.

const GEMINI_MODEL = "gemini-flash-lite-latest";

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export type PropertyForAI = {
  title: string;
  type: string;
  price: number;
  bhk: number | null;
  area: string | null;
  facing: string | null;
  parking: string | null;
  road: string | null;
};

export type DescriptionSeoSuggestion = {
  description: string;
  seo_title: string;
  seo_description: string;
};

function formatPriceForPrompt(price: number) {
  if (!price) return "price on request";
  if (price >= 10000000) return `Rs ${(price / 10000000).toFixed(2)} Cr`;
  if (price >= 100000) return `Rs ${(price / 100000).toFixed(0)} Lakh`;
  return `Rs ${price.toLocaleString("en-IN")}`;
}

export async function generateDescriptionAndSeo(
  property: PropertyForAI
): Promise<DescriptionSeoSuggestion> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set in the environment (.env.local)."
    );
  }

  const prompt = `You are writing buyer-facing real estate copy for a Jaipur,
India property listing platform called 99Bricks. Write in clear,
professional English -- no exaggeration, no invented amenities, no
location claims, and no emojis. Only use the details given below.

Property details:
- Title: ${property.title}
- Type: ${property.type}
- Price: ${formatPriceForPrompt(property.price)}
- BHK: ${property.bhk ?? "not specified"}
- Area: ${property.area || "not specified"}
- Facing: ${property.facing || "not specified"}
- Parking: ${property.parking || "not specified"}
- Road width: ${property.road || "not specified"}

Write three things:
1. "description": a 3-5 sentence buyer-facing description for the
   property detail page. A plain paragraph, no headings or bullet points.
2. "seo_title": a search-engine title tag, under 60 characters,
   including the property type and "Jaipur".
3. "seo_description": a search-engine meta description, under 160
   characters, written to make a search result worth clicking.`;

  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            description: { type: "STRING" },
            seo_title: { type: "STRING" },
            seo_description: { type: "STRING" },
          },
          required: ["description", "seo_title", "seo_description"],
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  const text: string | undefined =
    data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error(
      "Gemini API returned no usable content. Raw response: " +
        JSON.stringify(data)
    );
  }

  return JSON.parse(text) as DescriptionSeoSuggestion;
}

export type MarketTrendSource = {
  title: string;
  url: string;
};

// Which part of the platform a piece of research applies to. Lets research
// deliberately spread across the whole product instead of drifting toward
// whichever topic is easiest to find search results for.
export type MarketTrendCategory =
  | "design"
  | "seo_content"
  | "marketing"
  | "features"
  | "monetization"
  | "trust_legal"
  | "rental_management"
  | "financing"
  | "general";

export type MarketTrendRecommendation = {
  // "content" = words on a page (a blog post, a neighborhood guide, a
  // social caption) -- once the blog/content-publishing system exists,
  // approving one of these can draft and publish a real article. "feature"
  // = a new piece of the product (new code) -- approving one of these
  // queues it into build_queue for Claude to actually build next session;
  // it still needs Sumit to review and deploy the resulting code, same as
  // every other code change on this project, because shipping new code
  // with zero human check in between is how live sites break.
  type: "content" | "feature";
  category: MarketTrendCategory;
  title: string;
  detail: string;
};

export type MarketTrendSuggestion = {
  overview: string;
  recommendations: MarketTrendRecommendation[];
  sources: MarketTrendSource[];
};

const TAVILY_URL = "https://api.tavily.com/search";

type TavilySearchResult = {
  title: string;
  url: string;
  content: string;
};

// Live web search, used instead of Gemini's own "Google Search" grounding
// tool -- that tool requires a paid Google Cloud Billing account on the
// Gemini API project, which has been blocked on Sumit's end by a Google-side
// billing bug (error OR_BACR2_59). Tavily is a search API built for this
// exact "feed an LLM real search results" use case, with a free tier (no
// credit card required) that comfortably covers occasional admin-triggered
// research calls.
async function tavilySearch(
  query: string,
  maxResults = 5
): Promise<TavilySearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    throw new Error(
      "TAVILY_API_KEY is not set in the environment (.env.local)."
    );
  }

  const response = await fetch(TAVILY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "basic",
      max_results: maxResults,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Tavily API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  const results = Array.isArray(data?.results) ? data.results : [];

  return results.map((r: { title?: string; url?: string; content?: string }) => ({
    title: r.title || "",
    url: r.url || "",
    // Keep each snippet short so a handful of results don't blow out the
    // prompt -- we just need enough for Gemini to summarize accurately.
    content: (r.content || "").slice(0, 1200),
  }));
}

// The areas research is deliberately spread across, each with its own
// targeted Tavily query -- so "Research Market Trends" actually surveys the
// whole platform (design, content/SEO, marketing, product features, and the
// business model) instead of drifting toward whichever topic is easiest to
// find search results for. This is what Sumit asked for directly: research
// across "each and every platform" and "each and everything," not just one
// slice of it.
//
// 2026-09-24 update, also from Sumit directly: don't limit this to a short
// named list of competitors (Indian or otherwise) -- search real estate
// platforms broadly, worldwide. Each query below names a spread of
// platforms purely as EXAMPLES to steer the search engine, never as the
// full set of what to look at, and mixes Indian names (99acres, MagicBricks,
// NoBroker, Housing.com, Square Yards) with global ones (Zillow, Redfin,
// Rightmove, Realtor.com, Domain, PropertyGuru, Compass, Opendoor) on
// purpose -- a feature's country of origin is irrelevant. The monetization
// query in particular is written to surface actual revenue mechanics
// (subscriptions, paid placements, lead-gen fees, commissions, ads, data
// products), not just the word "monetization," since Sumit specifically
// wants features that make money for the platform, not just ones that look
// nice.
//
// 2026-09-24, second update, also from Sumit: three more research areas
// added -- trust_legal, rental_management, and financing -- after asking
// specifically what ELSE could be added beyond the original five. These
// three were picked because they're the most concretely useful for
// 99Bricks' actual local market (Jaipur/Rajasthan), not just generic
// PropTech trend-chasing: trust_legal ties directly into Rajasthan's own
// RERA portal (project registration numbers, quarterly reports, a public
// complaint mechanism) which is a real, checkable, India-specific trust
// signal no global platform's research would ever surface; rental_management
// matters because 99Bricks already lists both sale AND rent; and financing
// covers loan/EMI/stamp-duty tooling, a real monetization lever (bank
// referral commissions) on top of being genuinely useful to buyers.
//
// 2026-09-24, third update, also from Sumit: the existing "design" query
// sharpened to explicitly chase typography/font choices, color psychology,
// and trust signals -- not just generic "UX best practices" -- because
// Sumit specifically wants the platform to read as professional AND
// eye-catching, reasoned from what's actually on a visitor's mind (what are
// they looking for, what makes them trust a site within seconds) rather
// than a cosmetic pass. See the matching instruction added to the main
// prompt below, which asks for the same psychology-first reasoning on every
// "design" recommendation.
const RESEARCH_TOPICS: {
  category: MarketTrendCategory;
  label: string;
  query: string;
}[] = [
  {
    category: "design",
    label: "Design & UX",
    query:
      "real estate website UI UX design trends 2026 typography font pairing color psychology professional yet eye-catching trust signals first impression global platforms Zillow Redfin Rightmove Realtor.com Domain PropertyGuru 99acres NoBroker Housing.com MagicBricks",
  },
  {
    category: "seo_content",
    label: "SEO & Content",
    query:
      "real estate portal SEO content marketing strategy case study 2026 organic traffic global and Indian platforms",
  },
  {
    category: "marketing",
    label: "Marketing & Lead Generation",
    query:
      "real estate platform lead generation marketing campaign case study 2026 performance marketing global and Indian platforms Zillow NoBroker 99acres MagicBricks WhatsApp",
  },
  {
    category: "features",
    label: "Product Features & Tools",
    query:
      "real estate platform unique product features 2026 global competitor comparison AI tools virtual tour saved search alerts instant offers iBuying agent tools innovation",
  },
  {
    category: "monetization",
    label: "Monetization & Business Model",
    query:
      "real estate portal monetization revenue model 2026 subscription commission featured listings premium leads verified badge advertising data products Zillow Premier Agent Compass Opendoor 99acres MagicBricks",
  },
  {
    category: "trust_legal",
    label: "Trust, Verification & Legal Compliance",
    query:
      "real estate platform trust verification legal compliance 2026 RERA registration verified badge identity KYC fraud prevention duplicate listing detection dispute resolution global and Indian platforms",
  },
  {
    category: "rental_management",
    label: "Rental & Property Management",
    query:
      "real estate platform rental property management tools 2026 tenant screening digital lease agreement online rent collection maintenance requests global and Indian platforms Zillow TurboTenant NoBroker",
  },
  {
    category: "financing",
    label: "Financing & Affordability",
    query:
      "real estate platform financing mortgage loan tools 2026 EMI calculator stamp duty registration cost calculator bank loan partner integration lead referral global and Indian platforms",
  },
];

// What 99Bricks actually has built, as of this writing -- given to Gemini
// alongside the live search results so recommendations are a genuine GAP
// ANALYSIS (competitor has X, we don't, here's how to add it) instead of
// generic advice or, worse, re-suggesting something already built. Sumit
// asked directly for this: "the AI... has the whole data of the platform...
// researching from other platforms... what are the new things that they
// have? We can apply on our platform." Keep this list updated as real
// features ship -- an outdated list here just makes Gemini re-suggest
// things that already exist.
const CURRENT_PLATFORM_CAPABILITIES = `
- Interactive map-based property search (Mapbox), with a location-picker,
  "near me" geolocation, and marker clustering for dense areas.
- Filters: property type, BHK, price range, verified-listing badge.
- Property detail pages: photos, price, BHK, facing, parking, road width,
  AI-written description and SEO meta (admin-reviewed).
- Favorites, side-by-side Compare tool, EMI calculator, WhatsApp share
  button, SEO-focused locality landing pages.
- AI Buyer Advisor (/ai-advisor): a free-text or voice conversation where a
  buyer describes budget/needs and Gemini recommends real matching
  listings with reasons.
- AI Compare Advisor (/compare): an automatic neutral "how these differ"
  storyline plus a guided 3-question wizard that picks the single best-fit
  property among the ones being compared and explains why.
- Admin "AI Suggestions" dashboard (/admin/ai-suggestions): Gemini drafts
  description/SEO rewrites, flags under/overpriced listings (and can
  auto-apply the suggested price on approval), flags stale listings missing
  a description (and can auto-write one on approval), pitches content
  ideas, and runs 5-area market trend research (design, SEO/content,
  marketing, features, monetization) -- every suggestion needs a human
  Approve before anything changes.
- A "build_queue": an approved market-trend "feature" recommendation
  becomes a real build task tracked for a future coding session; an
  approved "content" recommendation gets drafted into a full article.
- A live blog system (/blog, /admin/blog "Blog Studio"): Gemini drafts a
  full SEO article from a queued content idea, an admin reviews/edits it,
  and Publish makes it live on the public site instantly -- no deploy
  needed for that step. Public blog pages are server-rendered with real
  meta tags and Article JSON-LD for Google indexing.
- Account types at signup (broker, builder, colonizer, individual owner,
  agent, PG/rental manager, buyer) shown on profiles and listings, though
  they don't yet change what dashboard or navigation a user sees.
- Admin property moderation queue (/admin/properties): approve/reject new
  seller-submitted listings before they go live -- currently manual, no AI
  assistance yet.
- Terms of Service + Privacy Policy with a required signup consent
  checkbox, JSON-LD structured data, a dynamic sitemap (listings + blog
  posts), robots.txt.
- Supabase email/password auth.

Explicitly NOT built yet (real gaps, fair game to recommend if a
competitor is doing something related): any lead-capture form for
anonymous visitors, WhatsApp-based conversations or notifications, saved
searches or alerts, a real created_at/updated_at timestamp on listings, any
analytics/traffic tracking, payments or any paid tier, a field/visit-agent
system, AI-assisted review of new seller-submitted listings, and any
AI-assisted visual/design changes.
`.trim();

// Runs one live Tavily search per research area above (design, SEO/content,
// marketing, features, monetization), then asks Gemini to write up
// recommendations for 99Bricks grounded ONLY in those real search results
// (never Gemini's own memory), each tagged with which area it belongs to
// and whether it's a "content" or "feature" recommendation, plus a
// "sources" list of what it actually drew on. Recommendations are a real
// gap analysis against CURRENT_PLATFORM_CAPABILITIES above, not generic
// advice or re-suggestions of things already built.
export async function generateMarketTrendResearch(): Promise<MarketTrendSuggestion> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set in the environment (.env.local)."
    );
  }

  const resultsByCategory: {
    category: MarketTrendCategory;
    label: string;
    results: TavilySearchResult[];
  }[] = [];

  for (const topic of RESEARCH_TOPICS) {
    try {
      const results = await tavilySearch(topic.query, 4);
      resultsByCategory.push({
        category: topic.category,
        label: topic.label,
        results,
      });
    } catch (err) {
      // Keep going with whatever the other categories turned up -- only
      // fail outright if EVERY category comes back empty, checked below.
      console.error(
        "Tavily search failed for category:",
        topic.category,
        err
      );
    }
  }

  const allResults = resultsByCategory.flatMap((c) => c.results);

  if (allResults.length === 0) {
    throw new Error(
      "Live web search returned no results (Tavily) across any research area. Check TAVILY_API_KEY and try again."
    );
  }

  // Number every result globally (so Gemini can cite "[7]" etc.) while
  // keeping each one labeled with its category, so recommendations stay
  // grounded in the right area.
  let resultNumber = 0;
  const searchContext = resultsByCategory
    .map((group) =>
      group.results
        .map((r) => {
          resultNumber += 1;
          return `[${resultNumber}] (${group.label}) ${r.title}\n${r.url}\n${r.content}`;
        })
        .join("\n\n")
    )
    .filter(Boolean)
    .join("\n\n");

  const prompt = `You are a real estate product strategist doing a
competitive GAP ANALYSIS for 99Bricks, a small independent map-based
property platform for Jaipur, India (sale and rent). You are researching
real estate platforms worldwide, not limited to Indian competitors and not
limited to any fixed list. The search results below already span both
Indian platforms (99acres, MagicBricks, NoBroker, Housing.com, Square
Yards) and global ones (Zillow, Redfin, Rightmove, Realtor.com, Domain,
PropertyGuru, Compass, Opendoor, and similar) on purpose -- a feature's
country of origin does not matter at all. What matters is only whether it
is realistically adaptable and valuable for 99Bricks' actual market:
Jaipur and Rajasthan, India. Compare all of this against what 99Bricks
already has, to find genuine gaps worth building or writing.

Here is what 99Bricks ALREADY has built -- do not recommend anything
already on this list, and do not recommend rebuilding it under a different
name:

${CURRENT_PLATFORM_CAPABILITIES}

This research deliberately spans EIGHT areas of the platform, not just one:
design & UX, SEO & content, marketing & lead generation, product features &
tools, monetization & business model, trust/verification/legal compliance,
rental & property management, and financing & affordability. Below are
real, current web search results covering all eight, each labeled with
which area it belongs to. Use ONLY the information in these results -- do
not rely on memory alone, and do not invent facts, statistics, or sources
beyond what is given here.

Search results:
${searchContext}

Write three things:

1. "overview": 4-6 specific observations on what is currently working well
   for real estate platforms right now, spread across the different areas
   above (not just one), referencing which numbered result each is based on
   (e.g. "(see [2])"). Plain text, no markdown asterisks for bold, short
   paragraphs.

2. "recommendations": 6-10 concrete, actionable recommendations 99Bricks
   could realistically apply, given it is a small Jaipur-focused platform,
   not a national player. Spread these across the eight areas above -- don't
   let them all cluster into just one or two areas, and don't let them all
   be content/SEO ideas -- AIM FOR AT LEAST HALF of the recommendations to
   be type "feature": a real, specific, nameable product capability you
   found evidence a competitor has (from the search results) that is NOT
   already on 99Bricks' capability list above. A vague direction like
   "improve buyer engagement" is not acceptable for a feature
   recommendation -- name the actual thing (e.g. "a saved-search alert that
   notifies a buyer by email or WhatsApp when a new matching listing
   appears", not "better retention tools"). For EACH recommendation give:
   - "type": exactly "content" if doing this means writing/publishing
     something (a blog post, a neighborhood guide, a social caption, an SEO
     page -- words, not code), or exactly "feature" if doing this means
     building something new into the product itself (a new tool, an
     automation, a new page or workflow, a design change -- code, not
     words). Pick whichever fits best; if a recommendation is really both,
     pick the primary one.
   - "category": exactly one of "design", "seo_content", "marketing",
     "features", "monetization", "trust_legal", "rental_management", or
     "financing" -- whichever area this recommendation belongs to, matching
     the labeled search results it's grounded in.
   - "title": a short (under 10 words) label for the recommendation -- for
     a feature, name the actual capability, not a vague goal.
   - "detail": 1-3 sentences explaining what to do and why, referencing the
     search results where relevant, and (for a feature) naming which real
     platform is already doing it. Whenever there is a real, realistic
     revenue angle -- a subscription, a paid placement, a lead-gen fee, a
     commission, an ad slot, a data product, and so on -- say so explicitly
     in the detail, even for a recommendation filed under "design",
     "seo_content", "marketing", or "features" rather than "monetization".
     Don't force a monetization angle onto something that genuinely doesn't
     have one (a lot of SEO/content ideas won't), but don't skip mentioning
     one when it's really there. For a "design" recommendation specifically,
     reason from the psychology of a first-time visitor -- what they're
     actually looking for in the first few seconds and what makes them trust
     a property site enough to keep browsing instead of bouncing -- and the
     platform should read as professional and credible, not just visually
     loud. Name a concrete, specific change (an actual font pairing, a
     specific color/contrast or trust-badge treatment, a specific layout or
     spacing pattern) grounded in the search results, never a vague
     "make it look better" or "improve the UI".

3. "sources": the search results you actually drew on, each with its
   "title" and "url" copied exactly from the search results above -- never
   invent a source that isn't in the list.`;

  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            overview: { type: "STRING" },
            recommendations: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  type: { type: "STRING", enum: ["content", "feature"] },
                  category: {
                    type: "STRING",
                    enum: [
                      "design",
                      "seo_content",
                      "marketing",
                      "features",
                      "monetization",
                      "trust_legal",
                      "rental_management",
                      "financing",
                    ],
                  },
                  title: { type: "STRING" },
                  detail: { type: "STRING" },
                },
                required: ["type", "category", "title", "detail"],
              },
            },
            sources: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  title: { type: "STRING" },
                  url: { type: "STRING" },
                },
                required: ["title", "url"],
              },
            },
          },
          required: ["overview", "recommendations", "sources"],
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  const text: string | undefined =
    data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error(
      "Gemini API returned no usable content. Raw response: " +
        JSON.stringify(data)
    );
  }

  const parsed = JSON.parse(text) as MarketTrendSuggestion;

  // Defense in depth: only keep sources that were actually among the real
  // search results we sent, matched by url; only keep recommendations with
  // a valid type, defaulting an unrecognized one to "content" (the safer
  // side -- worst case it sits in the queue as a content idea instead of
  // silently vanishing); default an unrecognized category to "general"
  // rather than dropping the recommendation.
  const validUrls = new Set(allResults.map((r) => r.url));
  const validTypes = new Set(["content", "feature"]);
  const validCategories = new Set([
    "design",
    "seo_content",
    "marketing",
    "features",
    "monetization",
    "trust_legal",
    "rental_management",
    "financing",
    "general",
  ]);

  return {
    overview: parsed.overview,
    recommendations: (parsed.recommendations || []).map((r) => ({
      type: validTypes.has(r.type) ? r.type : "content",
      category: validCategories.has(r.category) ? r.category : "general",
      title: r.title,
      detail: r.detail,
    })),
    sources: (parsed.sources || []).filter((s) => validUrls.has(s.url)),
  };
}

export type PropertyCandidate = {
  id: number;
  title: string;
  type: string;
  price: number;
  bhk: number | null;
  area: string | null;
};

export type PropertyRecommendation = {
  id: number;
  reason: string;
};

export type BuyerAdvisorResult = {
  summary: string;
  recommendations: PropertyRecommendation[];
};

// Consumer-facing: given a buyer's free-text request (budget, BHK, area,
// etc.) and the list of currently approved properties, asks Gemini to pick
// the best-matching listings and explain why. Only ever recommends ids
// that were actually in the candidate list -- never invents a property.
export async function generatePropertyRecommendations(
  buyerRequest: string,
  candidates: PropertyCandidate[]
): Promise<BuyerAdvisorResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set in the environment (.env.local)."
    );
  }

  const propertyList = candidates
    .map(
      (p) =>
        `- id ${p.id}: ${p.title} (${p.type}), ${formatPriceForPrompt(
          p.price
        )}, ${p.bhk ?? "BHK not specified"}, area: ${
          p.area || "not specified"
        }`
    )
    .join("\n");

  const prompt = `You are a helpful property advisor for 99Bricks, a Jaipur,
India real estate platform. A buyer has described what they are looking
for in plain language (their budget, and maybe BHK, property type, or
area preference). Recommend the best matching properties from the list
below ONLY -- never invent a property that is not in the list, and never
invent an id that is not in the list.

Buyer's request: "${buyerRequest}"

Available properties:
${propertyList}

Pick up to 5 properties that best match the buyer's budget and needs, best
match first. For each, give a short, specific reason referencing real
details from the list (price, BHK, area, type) -- do not invent facts that
are not in the list above. If nothing in the list is a good match (for
example, the budget is far too low for anything available), return an
empty recommendations array and explain why in the summary instead.

Also write a one to two sentence "summary" giving the buyer friendly,
practical overall guidance.`;

  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            summary: { type: "STRING" },
            recommendations: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  id: { type: "INTEGER" },
                  reason: { type: "STRING" },
                },
                required: ["id", "reason"],
              },
            },
          },
          required: ["summary", "recommendations"],
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  const text: string | undefined =
    data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error(
      "Gemini API returned no usable content. Raw response: " +
        JSON.stringify(data)
    );
  }

  const parsed = JSON.parse(text) as BuyerAdvisorResult;

  // Defense in depth: drop any id Gemini might have hallucinated that
  // isn't actually in the candidate list we gave it.
  const validIds = new Set(candidates.map((c) => c.id));

  return {
    summary: parsed.summary,
    recommendations: (parsed.recommendations || []).filter((r) =>
      validIds.has(r.id)
    ),
  };
}

export type ComparisonCandidate = {
  id: number;
  title: string;
  type: string;
  price: number;
  bhk: number | null;
  area: string | null;
  facing: string | null;
  parking: string | null;
  road: string | null;
  verification_status: string | null;
};

export type ComparisonNote = {
  id: number;
  note: string;
};

export type ComparisonAdvice = {
  recommendedId: number | null;
  reason: string;
  otherNotes: ComparisonNote[];
};

// Consumer-facing: on the /compare page, a buyer describes what matters
// most to them (budget limits, family size, must-haves) and Gemini picks
// the single best fit out of ONLY the properties they are actively
// comparing (2-5 of them), explaining why, plus a short trade-off note for
// each of the others. Never recommends an id that wasn't in the compared
// set.
export async function generateComparisonAdvice(
  buyerPriorities: string,
  candidates: ComparisonCandidate[]
): Promise<ComparisonAdvice> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set in the environment (.env.local)."
    );
  }

  const propertyList = candidates
    .map(
      (p) =>
        `- id ${p.id}: ${p.title} (${p.type}), ${formatPriceForPrompt(
          p.price
        )}, ${p.bhk ?? "BHK not specified"}, area: ${
          p.area || "not specified"
        }, facing: ${p.facing || "not specified"}, parking: ${
          p.parking || "not specified"
        }, road width: ${p.road || "not specified"}, verification: ${
          p.verification_status || "pending"
        }`
    )
    .join("\n");

  const prompt = `You are a helpful property advisor for 99Bricks, a Jaipur,
India real estate platform. A buyer is comparing a small set of specific
properties side by side and has told you what matters most to them (for
example their budget, family size, or must-haves). Decide which ONE of
these specific properties is the best fit for them -- pick only from the
list below, never invent a property or an id that is not in the list.

What the buyer cares about: "${buyerPriorities}"

Properties being compared:
${propertyList}

Pick the single best-fit property id as "recommendedId". Write a "reason"
of 2-4 sentences explaining why it's the best fit for THIS buyer,
referencing real details from the list (price, BHK, area, facing, parking,
road width) -- do not invent facts that are not in the list above. Then,
for every OTHER property in the list (not the recommended one), add a
short one-sentence entry to "otherNotes" explaining the trade-off compared
to the recommendation (for example, cheaper but smaller, or bigger but
over budget). If none of the properties are a reasonable fit for what the
buyer wants, still pick the closest one as recommendedId, but say clearly
in the reason why it's an imperfect match.`;

  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            recommendedId: { type: "INTEGER" },
            reason: { type: "STRING" },
            otherNotes: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  id: { type: "INTEGER" },
                  note: { type: "STRING" },
                },
                required: ["id", "note"],
              },
            },
          },
          required: ["recommendedId", "reason", "otherNotes"],
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  const text: string | undefined =
    data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error(
      "Gemini API returned no usable content. Raw response: " +
        JSON.stringify(data)
    );
  }

  const parsed = JSON.parse(text) as ComparisonAdvice;

  // Defense in depth: only trust ids that were actually in the compared
  // set we sent.
  const validIds = new Set(candidates.map((c) => c.id));

  return {
    recommendedId: validIds.has(parsed.recommendedId as number)
      ? parsed.recommendedId
      : null,
    reason: parsed.reason,
    otherNotes: (parsed.otherNotes || []).filter((n) => validIds.has(n.id)),
  };
}

export type ComparisonStoryline = {
  storyline: string;
};

// Consumer-facing: on the /compare page, runs automatically as soon as 2+
// properties are loaded -- BEFORE the buyer has said anything about what
// they want. Writes a short, neutral narrative describing how the
// compared properties differ (price, size, facing, parking, road width),
// so the buyer has something useful to read immediately, without having
// to ask. Does not recommend one over another -- that's what
// generateComparisonAdvice is for, once the buyer answers the guided
// questions.
export async function generateComparisonStoryline(
  candidates: ComparisonCandidate[]
): Promise<ComparisonStoryline> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set in the environment (.env.local)."
    );
  }

  const propertyList = candidates
    .map(
      (p) =>
        `- id ${p.id}: ${p.title} (${p.type}), ${formatPriceForPrompt(
          p.price
        )}, ${p.bhk ?? "BHK not specified"}, area: ${
          p.area || "not specified"
        }, facing: ${p.facing || "not specified"}, parking: ${
          p.parking || "not specified"
        }, road width: ${p.road || "not specified"}`
    )
    .join("\n");

  const prompt = `You are a property advisor for 99Bricks, a Jaipur, India
real estate platform. A buyer is looking at these specific properties
side by side, before telling you anything about what they personally
want. Write a short, natural 3-5 sentence narrative that helps them
understand how these properties differ at a glance -- price, size, BHK,
facing, parking, road width -- referencing only real details from the
list below. Stay neutral: do not tell them which one to pick, just help
them see the trade-offs. Do not invent facts that are not in the list.

Properties being compared:
${propertyList}`;

  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            storyline: { type: "STRING" },
          },
          required: ["storyline"],
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  const text: string | undefined =
    data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error(
      "Gemini API returned no usable content. Raw response: " +
        JSON.stringify(data)
    );
  }

  return JSON.parse(text) as ComparisonStoryline;
}

export type PriceFlagResult = {
  flag: "fair" | "overpriced" | "underpriced";
  reasoning: string;
  suggestedRange: string;
  suggestedPrice: number;
};

// Admin tool: given one property and a set of comparable properties (same
// type, currently approved) already listed on 99Bricks, asks Gemini
// whether the target property's price looks fair, overpriced, or
// underpriced relative to those comparables. This is a relative
// comparison against 99Bricks' own listings only -- not a professional
// appraisal and not based on any external market data. Returns both a
// human-readable "suggestedRange" (for display) and a single numeric
// "suggestedPrice" (a real rupee amount within that range) so the admin
// UI can apply it directly to the listing on approve, not just display
// it. Never writes to the property itself here; the result only ever
// lands as a pending
// ai_suggestions row for an admin to review.
export async function generatePriceFlag(
  target: PropertyForAI & { id: number },
  comparables: PropertyCandidate[]
): Promise<PriceFlagResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set in the environment (.env.local)."
    );
  }

  const comparableList = comparables
    .map(
      (p) =>
        `- id ${p.id}: ${p.title}, ${formatPriceForPrompt(p.price)}, ${
          p.bhk ?? "BHK not specified"
        }, area: ${p.area || "not specified"}`
    )
    .join("\n");

  const prompt = `You are a pricing analyst for 99Bricks, a Jaipur, India
real estate platform. Compare ONE property's asking price against a set of
comparable properties of the same type currently listed on 99Bricks itself,
to flag whether the asking price looks fair, overpriced, or underpriced
relative to those comparables. This is a relative comparison against
99Bricks' own listings only -- not a professional appraisal, and you have
no external market data, so never claim to know the "real" market value.

Property being reviewed:
- Title: ${target.title}
- Type: ${target.type}
- Price: ${formatPriceForPrompt(target.price)}
- BHK: ${target.bhk ?? "not specified"}
- Area: ${target.area || "not specified"}
- Facing: ${target.facing || "not specified"}
- Parking: ${target.parking || "not specified"}
- Road width: ${target.road || "not specified"}

Comparable properties currently on 99Bricks (same type):
${comparableList}

Decide "flag" as one of exactly "fair", "overpriced", or "underpriced",
based on how this property's price and size compare to the comparables
above. Write a "reasoning" of 2-3 sentences explaining the comparison,
referencing real numbers from the list -- do not invent facts that are not
given. Write a "suggestedRange" giving a rough price range as text (for
example "Rs 55 Lakh - Rs 62 Lakh") that would look more in line with the
comparables, based only on the data given -- if the price already looks
fair, the range can simply bracket the current price. Also give
"suggestedPrice": a single concrete rupee amount (a plain integer, not
text, for example 5800000) that falls inside that same range -- this is
the exact number that would be applied to the listing if the admin
accepts your suggestion, so pick one real, sensible number, not the
midpoint mechanically if that doesn't make sense -- if the price already
looks fair, suggestedPrice can just be the current price.`;

  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            flag: {
              type: "STRING",
              enum: ["fair", "overpriced", "underpriced"],
            },
            reasoning: { type: "STRING" },
            suggestedRange: { type: "STRING" },
            suggestedPrice: { type: "NUMBER" },
          },
          required: [
            "flag",
            "reasoning",
            "suggestedRange",
            "suggestedPrice",
          ],
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  const text: string | undefined =
    data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error(
      "Gemini API returned no usable content. Raw response: " +
        JSON.stringify(data)
    );
  }

  const parsed = JSON.parse(text) as PriceFlagResult;

  const validFlags = new Set(["fair", "overpriced", "underpriced"]);

  const suggestedPrice =
    typeof parsed.suggestedPrice === "number" &&
    isFinite(parsed.suggestedPrice) &&
    parsed.suggestedPrice > 0
      ? Math.round(parsed.suggestedPrice)
      : target.price;

  return {
    flag: validFlags.has(parsed.flag) ? parsed.flag : "fair",
    reasoning: parsed.reasoning,
    suggestedRange: parsed.suggestedRange,
    suggestedPrice,
  };
}

export type StaleListingCandidate = {
  id: number;
  title: string;
  type: string;
  price: number;
  hasDescription: boolean;
};

export type StaleListingSuggestion = {
  id: number;
  reasoning: string;
  suggestedAction: string;
};

// Admin tool: given a batch of properties that look long-listed (see the
// generate-stale-listings route for how "long-listed" is decided -- 99Bricks
// doesn't have a verified listing-age or traffic column yet, so this is a
// best-effort proxy, not a precise "days on market" figure), asks Gemini to
// write a short, specific, useful note per property about what might be
// worth doing about it (refresh photos, revisit the price, add a missing
// description, confirm with the seller it's still available, etc). Never
// invents an id that wasn't in the candidates list, and never touches the
// property itself -- purely drafts text for a pending ai_suggestions row.
export async function generateStaleListingSuggestions(
  candidates: StaleListingCandidate[]
): Promise<StaleListingSuggestion[]> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set in the environment (.env.local)."
    );
  }

  const candidateList = candidates
    .map(
      (p) =>
        `- id ${p.id}: ${p.title} (${p.type}), ${formatPriceForPrompt(
          p.price
        )}, ${
          p.hasDescription
            ? "has a description"
            : "has NO description written yet"
        }`
    )
    .join("\n");

  const prompt = `You are helping the admin of 99Bricks, a Jaipur, India real
estate platform, review listings that have been sitting on the platform
longer than most of the current active listings, relative to everything
else currently live -- these are candidates that may be going stale and
could use some attention.

Listings to review:
${candidateList}

For EACH listing above, write a short 1-2 sentence "reasoning" noting
what's known about it (using only the facts given -- do not invent an
exact number of days listed, since that isn't provided), and a single,
concrete "suggestedAction" the admin could take (for example: refresh the
photos, reconsider the price, write a description if it's missing, or
reach out to the seller to confirm it's still available). Keep each
suggestedAction to one short sentence. Return one entry per listing id,
using only the ids given above -- never invent an id.`;

  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            suggestions: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  id: { type: "INTEGER" },
                  reasoning: { type: "STRING" },
                  suggestedAction: { type: "STRING" },
                },
                required: ["id", "reasoning", "suggestedAction"],
              },
            },
          },
          required: ["suggestions"],
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  const text: string | undefined =
    data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error(
      "Gemini API returned no usable content. Raw response: " +
        JSON.stringify(data)
    );
  }

  const parsed = JSON.parse(text) as { suggestions: StaleListingSuggestion[] };

  // Defense in depth: only trust ids that were actually in the candidate
  // list we sent.
  const validIds = new Set(candidates.map((c) => c.id));

  return (parsed.suggestions || []).filter((s) => validIds.has(s.id));
}

export type PlatformSnapshot = {
  totalListings: number;
  typeBreakdown: { type: string; count: number }[];
  areaBreakdown: { area: string; count: number }[];
};

export type ContentIdea = {
  title: string;
  format: string;
  pitch: string;
};

// Admin tool: platform-wide, not tied to one property (like market trend
// research). Given a snapshot of what's actually currently listed on
// 99Bricks (how many properties, which types, which areas), asks Gemini to
// pitch a handful of concrete marketing content ideas -- blog posts,
// locality guides, social captions -- grounded in the real mix of listings
// rather than invented ones. No search grounding, no billing dependency,
// same plain structured-JSON setup as the rest of the suite.
export async function generateContentIdeas(
  snapshot: PlatformSnapshot
): Promise<ContentIdea[]> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set in the environment (.env.local)."
    );
  }

  const typeList = snapshot.typeBreakdown
    .map((t) => `${t.type}: ${t.count}`)
    .join(", ");

  const areaList = snapshot.areaBreakdown
    .map((a) => `${a.area}: ${a.count}`)
    .join(", ");

  const prompt = `You are a content marketer for 99Bricks, a Jaipur, India
real estate platform. Here is a snapshot of what's actually currently
listed on the platform:

- Total active listings: ${snapshot.totalListings}
- By property type: ${typeList || "no data"}
- By area: ${areaList || "no data"}

Pitch 5 concrete content ideas 99Bricks could publish to attract buyers and
help with SEO -- a mix of formats is good (locality guides, buyer
how-tos, comparison posts, social captions), grounded in the real mix of
listings above where relevant (for example, only pitch a guide to an area
that actually has listings). Do not invent specific facts about Jaipur
neighborhoods that aren't general public knowledge, and do not invent
listing counts beyond what's given above.

For each idea, give a "title" (the headline or post title), a "format"
(one short label, for example "Blog post", "Locality guide", "Social
caption", "Comparison post"), and a "pitch" of 1-2 sentences explaining
what it would cover and why it's worth writing.`;

  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            ideas: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  title: { type: "STRING" },
                  format: { type: "STRING" },
                  pitch: { type: "STRING" },
                },
                required: ["title", "format", "pitch"],
              },
            },
          },
          required: ["ideas"],
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  const text: string | undefined =
    data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error(
      "Gemini API returned no usable content. Raw response: " +
        JSON.stringify(data)
    );
  }

  const parsed = JSON.parse(text) as { ideas: ContentIdea[] };

  return parsed.ideas || [];
}

export type JobPostDraft = {
  platform: string;
  title: string;
  body: string;
};

export type JobPostEmploymentType = "full_time" | "freelance" | "internship";

// Admin tool (HR department): drafts job-post text for external hiring
// platforms. 99Bricks itself has no careers page and Sumit was explicit he
// doesn't want one built yet -- there's no traffic to post jobs to on the
// platform itself. This is a pure drafting tool: Sumit still has to create
// the account on each hiring platform himself and paste/publish the text
// there -- nothing here posts anywhere automatically, and nothing is saved
// to the database (stateless, generate-and-copy).
//
// Each platform gets its own draft written in THAT platform's actual
// style, not one generic post repeated four times: Naukri formal and
// structured, Apna short/direct/location-first (the best fit specifically
// for fresher/field sales roles like a Real Estate Sales Executive, which
// is what prompted this feature), Internshala framed around
// learning/mentorship (only generated for an internship or freelance role,
// since it's the wrong pitch for a full-time senior hire), and Indeed
// neutral and bullet-based.
export async function generateJobPostDrafts(input: {
  roleTitle: string;
  employmentType: JobPostEmploymentType;
  details: string;
}): Promise<JobPostDraft[]> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set in the environment (.env.local)."
    );
  }

  const employmentLabel =
    input.employmentType === "full_time"
      ? "Full-time"
      : input.employmentType === "freelance"
      ? "Freelance / commission-based"
      : "Internship";

  const includeInternshala =
    input.employmentType === "internship" ||
    input.employmentType === "freelance";

  const prompt = `You are writing job-post text for 99Bricks, a Jaipur,
India real estate platform, to hire a real person (for example a real
estate sales executive, a freelance field/site-visit agent, or an intern).
This text will be pasted directly onto external hiring platforms by a
human -- you are NOT posting anywhere yourself, and 99Bricks does not have
its own careers page. Write real, ready-to-paste text, not a template with
blanks to fill in.

Role: ${input.roleTitle}
Employment type: ${employmentLabel}
Location: Jaipur, Rajasthan, India
What the role involves and requires, as given by the employer: ${input.details}

Write a SEPARATE draft for each platform below, each in ITS OWN actual
style -- do not write one generic post and repeat it with a different
label:

1. "Naukri" -- formal and structured: a clear title, a short company blurb
   for 99Bricks (a Jaipur-focused map-based property platform), then
   Responsibilities and Requirements as short plain-text paragraphs (no
   markdown bullets -- Naukri's own posting form has its own fields, so
   keep this as clean paragraphs the employer can drop in).
2. "Apna" -- short, direct, and location-first, matching how fresher and
   field-sales roles actually get filled on Apna: lead with the role,
   location, and pay/incentive structure if the details imply one, keep
   sentences short, emphasize quick joining.
3. "Indeed" -- neutral and professional, structured with short plain-text
   sections (About the role, Responsibilities, Requirements), similar to
   Naukri but slightly more concise.
${
  includeInternshala
    ? `4. "Internshala" -- framed around what the intern or freelancer will
   learn and gain (skills, mentorship, real client exposure), not just
   what's asked of them -- that framing is what actually gets applications
   on Internshala.`
    : ""
}

Do not invent specific salary numbers, office addresses, or company facts
that are not in the details given above -- if pay isn't mentioned, don't
state a number; describe the structure generally if the details imply one
(for example "performance-based incentive on closed deals" without a
rupee figure).

For each platform, give "platform" (exactly the platform name above),
"title" (the job title line as it should appear on that platform), and
"body" (the full post text, ready to paste as-is).`;

  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            drafts: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  platform: { type: "STRING" },
                  title: { type: "STRING" },
                  body: { type: "STRING" },
                },
                required: ["platform", "title", "body"],
              },
            },
          },
          required: ["drafts"],
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  const text: string | undefined =
    data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error(
      "Gemini API returned no usable content. Raw response: " +
        JSON.stringify(data)
    );
  }

  const parsed = JSON.parse(text) as { drafts: JobPostDraft[] };

  return parsed.drafts || [];
}

export type BlogArticleDraft = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  seoTitle: string;
  seoDescription: string;
};

// Admin tool: turns one queued "content" idea (from build_queue, or a
// standalone content_idea) into a full, publishable article. Grounded in
// the same real platform snapshot as generateContentIdeas, so the article
// doesn't invent listing counts or areas 99Bricks doesn't actually have.
// Writing the draft is the ONLY step that touches Gemini -- everything
// after this (review, edit, publish) is a plain database write from the
// admin page, which is what lets "click Publish" apply to the live site
// instantly, with no code deploy needed.
export async function generateBlogArticle(
  ideaTitle: string,
  ideaDetail: string,
  format: string | null,
  snapshot: PlatformSnapshot
): Promise<BlogArticleDraft> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set in the environment (.env.local)."
    );
  }

  const typeList = snapshot.typeBreakdown
    .map((t) => `${t.type}: ${t.count}`)
    .join(", ");

  const areaList = snapshot.areaBreakdown
    .map((a) => `${a.area}: ${a.count}`)
    .join(", ");

  const prompt = `You are writing a real, publishable article for the
99Bricks blog -- a Jaipur, India real estate platform. This will be
published to a public webpage and indexed by Google, so it must read like
a genuine, useful article, not a pitch or an outline.

Article idea to write up:
- Title/topic: ${ideaTitle}
- What it should cover: ${ideaDetail}
- Format: ${format || "Blog post"}

Real snapshot of what's actually listed on 99Bricks right now (use this
only if it's actually relevant to the topic -- don't force it in):
- Total active listings: ${snapshot.totalListings}
- By property type: ${typeList || "no data"}
- By area: ${areaList || "no data"}

Rules:
- Write in clear, natural English for a buyer or seller audience in
  Jaipur. No exaggeration, no invented statistics, no invented named
  amenities or developments, no emojis.
- Do not invent specific facts about Jaipur neighborhoods, prices, or
  regulations that aren't general public knowledge -- when unsure, write
  generally rather than making up a specific number or name.
- Length: roughly 500-700 words.
- Structure the body as multiple short paragraphs (3-6 sentences each),
  separated by a blank line -- no headings, no bullet points, no
  markdown formatting of any kind, just plain paragraphs.
- Do not repeat the title as the first line of the body.

Give back:
1. "title": a clean, specific headline (can refine the given topic).
2. "slug": a URL-safe slug for the headline -- lowercase, words separated
   by hyphens, no special characters.
3. "excerpt": a 1-2 sentence summary for a blog listing card.
4. "content": the full article body as described above.
5. "seoTitle": a search-engine title tag, under 60 characters. The site
   already appends " | 99Bricks" to every page title automatically, so do
   NOT include "99Bricks" or any site name in this field yourself -- just
   the article's own title tag, or it will show up twice.
6. "seoDescription": a search-engine meta description, under 160
   characters, written to make a search result worth clicking.`;

  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            title: { type: "STRING" },
            slug: { type: "STRING" },
            excerpt: { type: "STRING" },
            content: { type: "STRING" },
            seoTitle: { type: "STRING" },
            seoDescription: { type: "STRING" },
          },
          required: [
            "title",
            "slug",
            "excerpt",
            "content",
            "seoTitle",
            "seoDescription",
          ],
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  const text: string | undefined =
    data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error(
      "Gemini API returned no usable content. Raw response: " +
        JSON.stringify(data)
    );
  }

  return JSON.parse(text) as BlogArticleDraft;
}
