import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import type { ActionPlanItem, Recommendation, UserProfile } from "./types";
import { translations } from "./translations";
import type { Language, TranslationKey } from "./translations";

interface AppState {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey, values?: Record<string, string | number>) => string;
  profile: UserProfile | undefined;
  setProfile: (profile: UserProfile) => void;
  recommendations: Recommendation[];
  setRecommendations: (recommendations: Recommendation[]) => void;
  plan: ActionPlanItem[];
  addToPlan: (recommendation: Recommendation) => void;
  togglePlanStep: (opportunityId: string, stepIndex: number) => void;
  removeFromPlan: (opportunityId: string) => void;
}

const AppContext = createContext<AppState | undefined>(undefined);

export function useAppState(): AppState {
  const value = useContext(AppContext);
  if (!value) throw new Error("App context is unavailable.");
  return value;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("rw");
  const [profile, setProfile] = useState<UserProfile>();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [plan, setPlan] = useState<ActionPlanItem[]>([]);

  const value: AppState = {
    language,
    setLanguage,
    t(key, values) {
      const message = translations[language][key];
      return values
        ? message.replace(/\{(\w+)\}/g, (placeholder, name: string) => String(values[name] ?? placeholder))
        : message;
    },
    profile,
    setProfile,
    recommendations,
    setRecommendations,
    plan,
    addToPlan(recommendation) {
      setPlan((current) => current.some((item) => item.recommendation.opportunityId === recommendation.opportunityId)
        ? current
        : [...current, { recommendation, completed: [false, false, false] }]);
    },
    togglePlanStep(opportunityId, stepIndex) {
      setPlan((current) => current.map((item) =>
        item.recommendation.opportunityId === opportunityId
          ? {
              ...item,
              completed: item.completed.map((done, index) => index === stepIndex ? !done : done),
            }
          : item,
      ));
    },
    removeFromPlan(opportunityId) {
      setPlan((current) => current.filter((item) => item.recommendation.opportunityId !== opportunityId));
    },
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
