export type Locality = {
  slug: string;
  name: string;
  tier: "Premium" | "Mid-range" | "Affordable" | "Growth corridor";
  priceBand: string;
  blurb: string;
};

export const LOCALITIES: Locality[] = [
  {
    slug: "c-scheme",
    name: "C-Scheme",
    tier: "Premium",
    priceBand: "INR 8,000 - 20,000 / sq ft",
    blurb:
      "C-Scheme is Jaipur's most premium address, with new-build pricing typically running INR 8,000-20,000 per sq ft (averaging around INR 10,900). It's home to some of the city's costliest villas and apartments, often INR 2-5 crore for larger properties.",
  },
  {
    slug: "bani-park",
    name: "Bani Park",
    tier: "Premium",
    priceBand: "~INR 7,850 / sq ft",
    blurb:
      "Bani Park sits in Jaipur's premium tier, with new-construction pricing averaging around INR 7,850 per sq ft - a step below C-Scheme but still among the city's higher-value addresses.",
  },
  {
    slug: "civil-lines",
    name: "Civil Lines",
    tier: "Premium",
    priceBand: "INR 8,000 - 20,000 / sq ft",
    blurb:
      "Civil Lines falls in Jaipur's premium price band (INR 8,000-20,000 per sq ft for new construction), alongside C-Scheme and MI Road, and is known for its wide, tree-lined streets and established bungalows.",
  },
  {
    slug: "mi-road",
    name: "MI Road",
    tier: "Premium",
    priceBand: "INR 8,000 - 20,000+ / sq ft",
    blurb:
      "MI Road combines premium residential pricing (INR 8,000-20,000 per sq ft) with being one of Jaipur's busiest commercial corridors, where retail and office space commonly trades above INR 10,900 per sq ft.",
  },
  {
    slug: "vaishali-nagar",
    name: "Vaishali Nagar",
    tier: "Mid-range",
    priceBand: "INR 4,800 - 7,000 / sq ft",
    blurb:
      "Vaishali Nagar is a well-established mid-range locality, with new-build pricing typically between INR 4,800 and 7,000 per sq ft. It's also an active retail growth corridor, with new commercial development ongoing.",
  },
  {
    slug: "nirman-nagar",
    name: "Nirman Nagar",
    tier: "Mid-range",
    priceBand: "~INR 5,600 / sq ft",
    blurb:
      "Nirman Nagar sits in the mid-range band, with new-construction pricing averaging around INR 5,600 per sq ft, and is popular for its central location and connectivity.",
  },
  {
    slug: "sikar-road",
    name: "Sikar Road",
    tier: "Mid-range",
    priceBand: "~INR 7,250 / sq ft",
    blurb:
      "Sikar Road prices toward the top of the mid-range band, averaging around INR 7,250 per sq ft for new construction, driven by strong connectivity to the northern parts of the city.",
  },
  {
    slug: "jagatpura",
    name: "Jagatpura",
    tier: "Affordable",
    priceBand: "INR 3,750 - 5,700 / sq ft",
    blurb:
      "Jagatpura is one of Jaipur's fastest-emerging affordable localities, with new-build pricing spanning INR 3,750-5,700 per sq ft. It also shows one of the city's better rental yields, estimated around 5-5.5%.",
  },
  {
    slug: "jhotwara",
    name: "Jhotwara",
    tier: "Affordable",
    priceBand: "~INR 3,700 / sq ft",
    blurb:
      "Jhotwara is among the most affordable established localities in Jaipur, with new-construction pricing averaging around INR 3,700 per sq ft.",
  },
  {
    slug: "ajmer-road",
    name: "Ajmer Road",
    tier: "Affordable",
    priceBand: "INR 3,700 - 5,000 / sq ft",
    blurb:
      "Ajmer Road sits in the affordable price tier and is cited as an active retail growth corridor, making it a popular pick for both budget housing and new commercial development.",
  },
  {
    slug: "mahapura",
    name: "Mahapura",
    tier: "Affordable",
    priceBand: "INR 3,700 - 5,000 / sq ft",
    blurb:
      "Mahapura is part of Jaipur's affordable, emerging belt, typically in the INR 3,700-5,000 per sq ft band for new construction.",
  },
  {
    slug: "kalwar-road",
    name: "Kalwar Road",
    tier: "Affordable",
    priceBand: "INR 3,700 - 5,000 / sq ft",
    blurb:
      "Kalwar Road falls in the affordable, emerging price band (roughly INR 3,700-5,000 per sq ft), popular with buyers looking for lower entry prices on the city's outskirts.",
  },
  {
    slug: "mansarovar-extension",
    name: "Mansarovar Extension",
    tier: "Affordable",
    priceBand: "INR 3,700 - 5,000 / sq ft",
    blurb:
      "Mansarovar Extension is in the affordable, emerging tier and is flagged as an active retail growth corridor. Note: some established Mansarovar-core pockets have seen resale prices soften recently, so it's worth checking recent comparable sales.",
  },
  {
    slug: "tonk-road",
    name: "Tonk Road",
    tier: "Growth corridor",
    priceBand: "Commercial ~INR 10,900+ / sq ft",
    blurb:
      "Tonk Road is one of Jaipur's key office-space growth corridors, with premium commercial pricing commonly above INR 10,900 per sq ft.",
  },
  {
    slug: "sitapura",
    name: "Sitapura",
    tier: "Growth corridor",
    priceBand: "Emerging - limited pricing data",
    blurb:
      "Sitapura is an emerging office and industrial corridor on Jaipur's southern edge, with development still ramping up.",
  },
  {
    slug: "mahal-road",
    name: "Mahal Road",
    tier: "Growth corridor",
    priceBand: "Emerging - limited pricing data",
    blurb:
      "Mahal Road is cited as an active office-space growth corridor amid Jaipur's ongoing commercial expansion.",
  },
];

export function getLocalityBySlug(slug: string) {
  return LOCALITIES.find((locality) => locality.slug === slug) || null;
}
