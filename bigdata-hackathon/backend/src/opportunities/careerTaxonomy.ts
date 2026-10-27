import { Opportunity, UserProfile } from "./types";

const CAREER_TAXONOMY: Record<string, string[]> = {
  software_development: [
    "software development", "software developer", "software engineering", "programming",
    "coding", "application development", "python", "javascript", "java", "kotlin", "android",
    "information technology", "information technology (it)", "it support", "ict",
  ],
  data_analysis: [
    "data analysis", "data analyst", "data analytics", "data science", "statistics",
    "sql", "business intelligence",
  ],
  digital_skills: [
    "digital skills", "digital technology", "digital economy", "computer applications",
    "information technology", "information technology (it)", "ict",
  ],
  agriculture: [
    "agriculture", "agricultural", "agribusiness", "farming", "smallholder farmers",
    "agricultural value chains", "crop production",
  ],
  healthcare: ["healthcare", "health care", "medical", "medicine", "nursing", "nurse", "clinical"],
  business_entrepreneurship: [
    "business", "business development", "entrepreneur", "entrepreneurship", "startup",
    "small business", "sme", "investment readiness", "finance", "financial analysis", "accounting",
  ],
  education_teaching: ["education", "teacher", "teaching", "school", "training", "tvet"],
  public_service: ["public service", "district-level", "government recruitment", "public administration"],
  mechanical_trades: ["mechanical engineering", "mechanic", "motor mechanic", "industrial placement"],
};

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function containsTerm(text: string, term: string): boolean {
  const normalizedText = ` ${normalize(text)} `;
  const normalizedTerm = ` ${normalize(term)} `;
  return normalizedText.includes(normalizedTerm);
}

const SKILL_ALIASES = new Map<string, string>([
  ["js", "javascript"],
  ["python 3", "python"],
  ["sql server", "sql"],
  ["data analytics", "data analysis"],
  ["data analyst", "data analysis"],
  ["software developer", "software development"],
  ["software engineering", "software development"],
  ["coding", "programming"],
]);

function canonicalSkill(value: string): string {
  const normalized = normalize(value);
  return SKILL_ALIASES.get(normalized) ?? normalized;
}

export function careerFamiliesForText(value: string): string[] {
  return Object.entries(CAREER_TAXONOMY)
    .filter(([, terms]) => terms.some((term) => containsTerm(value, term)))
    .map(([family]) => family);
}

export function equivalentSkill(profileSkill: string, opportunitySkill: string): boolean {
  return canonicalSkill(profileSkill) === canonicalSkill(opportunitySkill);
}

export function profileCareerTerms(profile: UserProfile): string[] {
  return [...new Set([...(profile.careerGoals ?? []), ...(profile.preferredCategories ?? [])]
    .map((term) => term.trim())
    .filter(Boolean))];
}

export function matchCareerFamilies(
  profile: UserProfile,
  opportunity: Opportunity,
): { score: number | null; matched: string[]; unmatched: string[]; inferred: string[] } {
  const goals = profileCareerTerms(profile);
  if (goals.length === 0) return { score: null, matched: [], unmatched: [], inferred: [] };

  const opportunityFamilies = opportunity.careerFamilies ?? [];
  const goalResults = goals.map((goal) => {
    const goalFamilies = careerFamiliesForText(goal);
    const matchedFamily = opportunityFamilies.find((signal) => goalFamilies.includes(signal.family));
    if (matchedFamily) return { goal, family: matchedFamily.family, confidence: matchedFamily.confidence };

    const text = [
      opportunity.title,
      opportunity.description ?? "",
      opportunity.metadata?.category ?? "",
      ...opportunity.requirements.map((requirement) =>
        typeof requirement === "string" ? requirement : requirement.description),
    ].join(" ");
    const directMatch = containsTerm(text, goal);
    return directMatch ? { goal, family: "direct_text", confidence: "source_stated" as const } : undefined;
  });
  const matched = goalResults.flatMap((result) => result ? [result.goal] : []);
  const inferred = goalResults.flatMap((result) =>
    result?.confidence === "taxonomy_inferred" ? [`${result.goal} → ${result.family}`] : []);
  return {
    score: Math.round((matched.length / goals.length) * 10000) / 100,
    matched,
    unmatched: goals.filter((goal) => !matched.includes(goal)),
    inferred,
  };
}
