import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import { getOpportunities, getUserFacingErrorMessage, type OpportunityFilters } from "./api";
import type { ActionPlanItem, Opportunity, Recommendation, UserProfile } from "./types";
import { calculateDistanceKm, formatOpportunityLocation, isValidCoordinates } from "./location";
import type { Coordinates } from "./location";
import { translations } from "./translations";
import type { Language, TranslationKey } from "./translations";

interface NearbyOpportunity {
  id: string;
  title: string;
  organization: string;
  location: string;
  kilometers: number;
}

type NearbyLocationState =
  | { status: "idle" | "requesting" }
  | { status: "success"; opportunities: NearbyOpportunity[]; locatedCount: number; missingCoordinatesCount: number }
  | { status: "error"; message: string };

interface AppState {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey, values?: Record<string, string | number>) => string;
  profile: UserProfile | undefined;
  setProfile: (profile: UserProfile) => void;
  recommendations: Recommendation[];
  setRecommendations: (recommendations: Recommendation[]) => void;
  plan: ActionPlanItem[];
  nearbyLocation: NearbyLocationState;
  findNearbyLocation: () => void;
  addToPlan: (recommendation: Recommendation) => void;
  togglePlanStep: (opportunityId: string, stepIndex: number) => void;
  removeFromPlan: (opportunityId: string) => void;
}

const AppContext = createContext<AppState | undefined>(undefined);

const nearbyOpportunityFilters: OpportunityFilters = {
  page: 1,
  limit: 100,
  type: "",
  status: "",
  deadlineStatus: "",
  province: "",
  district: "",
  category: "",
};

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
  const [nearbyLocation, setNearbyLocation] = useState<NearbyLocationState>({ status: "idle" });

  async function findNearbyOpportunities(origin: Coordinates) {
    const opportunities: Opportunity[] = [];
    let totalPages = 1;

    for (let page = 1; page <= totalPages; page += 1) {
      const response = await getOpportunities({ ...nearbyOpportunityFilters, page });
      opportunities.push(...response.data.opportunities);
      totalPages = response.data.pagination.totalPages;
    }

    const ranked: NearbyOpportunity[] = [];
    let missingCoordinatesCount = 0;
    for (const opportunity of opportunities) {
      const location = opportunity.location;
      const coordinates = location &&
        typeof location.latitude === "number" &&
        typeof location.longitude === "number"
        ? { latitude: location.latitude, longitude: location.longitude }
        : null;
      const kilometers = coordinates ? calculateDistanceKm(origin, coordinates) : null;

      if (kilometers === null) {
        missingCoordinatesCount += 1;
        continue;
      }

      const result = {
        id: opportunity.id,
        title: opportunity.title,
        organization: opportunity.organization.name,
        location: formatOpportunityLocation(location),
        kilometers,
      };
      ranked.push(result);
    }

    ranked.sort((left, right) => left.kilometers - right.kilometers);
    setNearbyLocation({
      status: "success",
      opportunities: ranked.slice(0, 5),
      locatedCount: ranked.length,
      missingCoordinatesCount,
    });
  }

  function findNearbyLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      const message = translations[language].locationUnavailable;
      setNearbyLocation({ status: "error", message });
      return;
    }

    setNearbyLocation({ status: "requesting" });
    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const latitude = position.coords.latitude;
          const longitude = position.coords.longitude;
          const origin = { latitude, longitude };
          if (!isValidCoordinates(origin)) {
            const message = translations[language].locationUnavailable;
            setNearbyLocation({ status: "error", message });
            return;
          }

          void findNearbyOpportunities(origin).catch((error: unknown) => {
            const message = getUserFacingErrorMessage(error, translations[language].locationError);
            setNearbyLocation({ status: "error", message });
          });
        },
        (error) => {
          const message = error.code === 1
            ? translations[language].locationPermissionDenied
            : error.code === 2
              ? translations[language].locationUnavailable
              : error.code === 3
                ? translations[language].locationTimeout
                : translations[language].locationError;
          setNearbyLocation({ status: "error", message });
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
      );
    } catch {
      setNearbyLocation({ status: "error", message: translations[language].locationError });
    }
  }

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
    nearbyLocation,
    findNearbyLocation,
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
