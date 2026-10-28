import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  useMutation,
  useQuery,
} from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  BriefcaseBusiness,
  FileUser,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Compass,
  GraduationCap,
  Heart,
  Lightbulb,
  MapPin,
  RotateCw,
  Search,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import {
  Link,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import CareerPathwaysPage from "./pages/CareerPathwaysPage";
import CvBuilderPage from "./pages/CvBuilderPage";
import {
  ApiError,
  checkEligibility,
  getMatches,
  getOpportunities,
  getOpportunity,
  type OpportunityFilters,
} from "./api";
import {
  opportunityTypes,
  type EligibilityResult,
  type Opportunity,
  type OpportunityType,
  type Recommendation,
  type UserProfile,
} from "./types";
import {
  districtsForProvince,
  formatOpportunityLocation,
  locationMatchesFilters,
  RWANDA_PROVINCES,
} from "./location";
import { AppProvider, useAppState } from "./context";
import type { Language } from "./translations";

const navItems = [
  { to: "/", label: "navHome", icon: Compass, end: true },
  { to: "/opportunities", label: "navOpportunities", icon: BriefcaseBusiness, end: false },
  { to: "/guidance", label: "navGuidance", icon: Sparkles, end: false },
  { to: "/action-plan", label: "navActionPlan", icon: CheckCircle2, end: false },
  { to: "/career-pathways", label: "navCareerPathways", icon: TrendingUp, end: false },
  { to: "/create-cv", label: "navCvBuilder", icon: FileUser, end: false },
] as const;

export default function App() {
  return (
    <AppProvider>
      <AppFrame />
    </AppProvider>
  );
}

function AppFrame() {
  const { language, setLanguage, t } = useAppState();
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return (
      <div className="app-shell">
        <aside className="sidebar">
          <Link className="brand" to="/" aria-label="Rwanda Opportunity Intelligence home">
            <span className="brand-mark"><Compass size={21} strokeWidth={2.2} /></span>
            <span className="brand-text">ROI<span>RWANDA OPPORTUNITY INTELLIGENCE</span></span>
          </Link>
          <div className="nav-label">{t("navLabel")}</div>
          <nav className="main-nav" aria-label="Main navigation">
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end ?? false} className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
                <Icon size={18} strokeWidth={1.8} />
                <span>{t(label)}</span>
                {label === "navActionPlan" && <span className="nav-count"><PlanCount /></span>}
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-note">
            <span className="note-icon"><Lightbulb size={17} /></span>
            <strong>{t("sidebarTitle")}</strong>
            <p>{t("sidebarDescription")}</p>
            <Link to="/guidance">{t("sidebarLink")} <ArrowRight size={14} /></Link>
          </div>
          <div className="sidebar-foot">{t("sidebarFoot")}</div>
        </aside>
        <div className="main-column">
          <header className="topbar">
            <div className="topbar-mobile-brand"><Compass size={19} /> ROI <span>RWANDA</span></div>
            <div className="topbar-context">{t("topbarContext")}</div>
            <div className="topbar-actions">
              <label className="language-picker"><span>{t("language")}</span><select aria-label={t("language")} value={language} onChange={(event) => {
                const nextLanguage = event.target.value;
                if (isLanguage(nextLanguage)) setLanguage(nextLanguage);
              }}>
                <option value="rw">{t("languageKinyarwanda")}</option>
                <option value="en">{t("languageEnglish")}</option>
                <option value="fr">{t("languageFrench")}</option>
              </select></label>
              <NearMeAction />
              <Link className="profile-link" to="/guidance"><span className="avatar">R</span><span>{t("navGuidance")}</span><ChevronDown size={15} /></Link>
            </div>
          </header>
          <main className="page-content">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/opportunities" element={<OpportunitiesPage />} />
              <Route path="/opportunities/:id" element={<OpportunityDetailPage />} />
              <Route path="/guidance" element={<GuidancePage />} />
              <Route path="/action-plan" element={<ActionPlanPage />} />
              <Route path="/career-pathways" element={<CareerPathwaysPage />} />
              <Route path="/create-cv" element={<CvBuilderPage />} />
              <Route path="/insights" element={<Navigate to="/career-pathways" replace />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </main>
          <footer className="site-footer">
            <span>{t("footerGuidance")}</span>
            <span>{t("footerEvidence")}</span>
          </footer>
        </div>
      </div>
  );
}

function isLanguage(value: string): value is Language {
  return value === "rw" || value === "en" || value === "fr";
}

function PlanCount() {
  const { plan } = useAppState();
  return <>{plan.length}</>;
}

function NearMeAction({ prominent = false }: { prominent?: boolean }) {
  const { t, nearbyLocation, findNearbyLocation } = useAppState();
  const { pathname } = useLocation();
  const showResults = prominent || pathname !== "/";
  return (
    <div className={`nearby-action${prominent ? " nearby-action-prominent" : ""}`}>
      <button
        className={`button button-nearby${prominent ? " button-nearby-prominent" : ""}`}
        type="button"
        onClick={findNearbyLocation}
        disabled={nearbyLocation.status === "requesting"}
        aria-label={t("findOpportunitiesNearMe")}
      >
        <MapPin size={prominent ? 17 : 15} />
        <span>{nearbyLocation.status === "requesting" ? t("findingYourLocation") : t("findOpportunitiesNearMe")}</span>
      </button>
      {showResults && nearbyLocation.status === "success" && (
        <div className="nearby-action-status" role="status">
          <strong>{t("nearbySummary", { count: nearbyLocation.locatedCount })}</strong>
          {nearbyLocation.opportunities.length === 0
            ? <p>{t("nearbyNoneFound")}</p>
            : <ol>{nearbyLocation.opportunities.map((opportunity) => (
                <li key={opportunity.id}>
                  <Link to={`/opportunities/${encodeURIComponent(opportunity.id)}`}>{opportunity.title}</Link>
                  <span>{opportunity.organization} · {opportunity.location}</span>
                  <b>{opportunity.kilometers.toFixed(1)} km</b>
                </li>
              ))}</ol>}
          {nearbyLocation.missingCoordinatesCount > 0 && <small>{nearbyLocation.missingCoordinatesCount} opportunities skipped because they have no valid coordinates.</small>}
        </div>
      )}
      {nearbyLocation.status === "error" && <p className="nearby-action-error" role="alert">{nearbyLocation.message}</p>}
    </div>
  );
}

function HomePage() {
  const { t } = useAppState();
  return (
    <div className="home-page">
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow"><span className="eyebrow-dot" /> {t("homeEyebrow")}</span>
          <h1>{t("homeTitle")}<br /><span>{t("homeTitleAccent")}</span></h1>
          <p>{t("homeDescription")}</p>
          <div className="hero-actions">
            <Link className="button button-dark" to="/opportunities">{t("exploreOpportunities")} <ArrowRight size={16} /></Link>
            <Link className="button button-outline" to="/guidance">{t("buildProfile")} <Sparkles size={16} /></Link>
          </div>
          <NearMeAction prominent />
          <div className="hero-trust"><CheckCircle2 size={16} /> {t("homeTrust")}</div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="hero-sun" />
          <div className="hero-stairs stairs-one" />
          <div className="hero-stairs stairs-two" />
          <div className="hero-path"><ArrowUpRight size={26} /></div>
          <div className="hero-card card-top"><span className="mini-icon mint"><Target size={17} /></span><span><b>{t("interests")}</b><small>{t("step1Description")}</small></span></div>
          <div className="hero-card card-bottom"><span className="mini-icon orange"><Check size={17} /></span><span><b>{t("next")}</b><small>{t("homeHelpNote")}</small></span></div>
          <span className="art-caption">{t("homeHelpNote")}</span>
        </div>
      </section>
      <section className="welcome-strip">
        <div className="welcome-icon"><Heart size={20} /></div>
        <div><strong>{t("welcomeTitle")}</strong><p>{t("welcomeDescription")}</p></div>
        <Link to="/guidance" aria-label={t("exploreGuidance")}><ArrowRight size={19} /></Link>
      </section>
      <section className="section-block">
        <div className="section-heading">
          <div><span className="eyebrow">{t("homeHelpEyebrow")}</span><h2>{t("homeHelpTitle")}</h2></div>
          <p>{t("homeHelpNote")}</p>
        </div>
        <div className="pathway-grid">
          <PathwayCard icon={<Search size={20} />} step="01" title={t("cardExploreTitle")} text={t("cardExploreText")} to="/opportunities" action={t("cardExploreAction")} tone="green" />
          <PathwayCard icon={<Sparkles size={20} />} step="02" title={t("cardFitTitle")} text={t("cardFitText")} to="/guidance" action={t("cardFitAction")} tone="peach" />
          <PathwayCard icon={<BookOpen size={20} />} step="03" title={t("cardPlanTitle")} text={t("cardPlanText")} to="/action-plan" action={t("cardPlanAction")} tone="lavender" />
        </div>
      </section>
      <section className="evidence-banner">
        <div className="evidence-symbol"><GraduationCap size={25} /></div>
        <div className="evidence-text"><span className="eyebrow">{t("careerEyebrow")}</span><h2>{t("careerHomeTitle")}</h2><p>{t("careerHomeDescription")}</p></div>
        <Link className="button button-dark" to="/career-pathways">{t("careerHomeAction")} <ArrowRight size={16} /></Link>
      </section>
    </div>
  );
}

function PathwayCard({ icon, step, title, text, to, action, tone }: {
  icon: ReactNode;
  step: string;
  title: string;
  text: string;
  to: string;
  action: string;
  tone: string;
}) {
  return (
    <article className={`pathway-card ${tone}`}>
      <div className="pathway-top"><span className="pathway-icon">{icon}</span><span className="pathway-step">{step}</span></div>
      <h3>{title}</h3><p>{text}</p>
      <Link to={to}>{action} <ArrowRight size={15} /></Link>
    </article>
  );
}

const emptyFilters: OpportunityFilters = {
  page: 1,
  limit: 12,
  type: "",
  status: "",
  deadlineStatus: "",
  province: "",
  district: "",
  category: "",
  isSynthetic: "",
  isLiveOpportunity: "",
};

function OpportunitiesPage() {
  const [filters, setFilters] = useState(emptyFilters);
  const query = useQuery({
    queryKey: ["opportunities", filters],
    queryFn: () => getOpportunities(filters),
  });
  const page = query.data?.data;

  function updateFilter<K extends keyof OpportunityFilters>(key: K, value: OpportunityFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value, page: 1 }));
  }

  function updateProvince(province: string) {
    setFilters((current) => ({
      ...current,
      province,
      district: current.district && !districtsForProvince(province).includes(current.district) ? "" : current.district,
      page: 1,
    }));
  }

  return (
    <div className="content-page">
      <PageIntro eyebrow="OPPORTUNITY DIRECTORY" title="Explore your options." description="Browse jobs, training, scholarships and more. Each listing keeps its source and confirmation status visible." />
      <section className="filter-panel" aria-label="Opportunity filters">
        <div className="filter-panel-title"><span><Search size={17} /> Find an opportunity</span><span className="filter-hint">Filters use fields available in the catalogue</span></div>
        <div className="filter-grid">
          <label>Opportunity type<select value={filters.type} onChange={(event) => updateFilter("type", event.target.value as OpportunityType | "")}><option value="">All types</option>{opportunityTypes.map((type) => <option key={type} value={type}>{humanize(type)}</option>)}</select></label>
          <label>Status<select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}><option value="">All statuses</option>{["open", "rolling", "closed", "needs_confirmation", "rolling_example", "synthetic_example"].map((item) => <option key={item} value={item}>{humanize(item)}</option>)}</select></label>
          <label>Deadline<select value={filters.deadlineStatus} onChange={(event) => updateFilter("deadlineStatus", event.target.value)}><option value="">Any deadline status</option>{["confirmed", "rolling", "not_confirmed", "historical"].map((item) => <option key={item} value={item}>{humanize(item)}</option>)}</select></label>
          <label>Province<select value={filters.province} onChange={(event) => updateProvince(event.target.value)}><option value="">All provinces</option>{RWANDA_PROVINCES.map((province) => <option key={province} value={province}>{province}</option>)}</select></label>
          <label>District<select value={filters.district} onChange={(event) => updateFilter("district", event.target.value)}><option value="">All districts</option>{districtsForProvince(filters.province).map((district) => <option key={district} value={district}>{district}</option>)}</select></label>
          <label>Category<input value={filters.category} onChange={(event) => updateFilter("category", event.target.value)} placeholder="Catalogue category" maxLength={100} /></label>
          <label>Record kind<select value={filters.isSynthetic} onChange={(event) => updateFilter("isSynthetic", event.target.value)}><option value="">All record kinds</option><option value="false">Non-synthetic records</option><option value="true">Synthetic demo records</option></select></label>
          <label>Live listing<select value={filters.isLiveOpportunity} onChange={(event) => updateFilter("isLiveOpportunity", event.target.value)}><option value="">Any live status</option><option value="true">Marked live</option><option value="false">Not marked live</option></select></label>
        </div>
        <button className="text-button clear-filters" type="button" onClick={() => setFilters(emptyFilters)}>Clear filters <RotateCw size={13} /></button>
      </section>
      <div className="results-bar">
        <div><span className="eyebrow">CATALOGUE RESULTS</span><h2>{query.isPending ? "Loading opportunities…" : page ? `${page.pagination.total} ${page.pagination.total === 1 ? "listing" : "listings"}` : "Opportunities"}</h2></div>
        {page?.source && <span className="catalogue-source">Source: {page.source.name}</span>}
      </div>
      {query.isPending && <LoadingState text="Loading catalogue listings…" />}
      {query.isError && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
      {page && page.opportunities.length === 0 && <EmptyState title="No listings match these filters" text="Try clearing a filter to explore more of the catalogue." action={<button className="button button-outline" type="button" onClick={() => setFilters(emptyFilters)}>Clear filters</button>} />}
      {page && page.opportunities.length > 0 && (
        <>
          <div className="opportunity-grid">
            {page.opportunities.map((opportunity, index) => <OpportunityCard key={`${opportunity.id}-${index}`} opportunity={opportunity} />)}
          </div>
          <div className="pagination">
            <span>Page {page.pagination.page} of {Math.max(page.pagination.totalPages, 1)}</span>
            <div><button className="button button-small button-outline" type="button" disabled={filters.page <= 1} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}><ArrowLeft size={14} /> Previous</button><button className="button button-small button-outline" type="button" disabled={filters.page >= page.pagination.totalPages} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>Next <ArrowRight size={14} /></button></div>
          </div>
          <p className="catalogue-warning">{page.source.warning}</p>
        </>
      )}
    </div>
  );
}

function OpportunityCard({ opportunity }: { opportunity: Opportunity }) {
  return (
    <article className="opportunity-card">
      <div className="card-topline"><span className="type-pill">{humanize(opportunity.type)}</span><StatusBadge opportunity={opportunity} /></div>
      <Link className="opportunity-title" to={`/opportunities/${encodeURIComponent(opportunity.id)}`}>{opportunity.title}</Link>
      <div className="organization">{opportunity.organization.name}</div>
      <div className="location-line"><MapPin size={14} /> {formatOpportunityLocation(opportunity.location)}</div>
      {opportunity.description && <p className="card-description">{opportunity.description}</p>}
      <div className="card-meta">
        <span><b>Deadline</b>{deadlineText(opportunity)}</span>
        <span><b>Source</b>{opportunity.source.name}</span>
      </div>
      <div className="card-footer">
        {opportunity.metadata?.isSynthetic === true && <span className="record-flag">Synthetic demo record</span>}
        {opportunity.metadata?.isLiveOpportunity === false && <span className="record-flag muted-flag">Not marked live</span>}
        <Link to={`/opportunities/${encodeURIComponent(opportunity.id)}`} className="card-link">View details <ArrowRight size={15} /></Link>
      </div>
    </article>
  );
}

function OpportunityDetailPage() {
  const { id = "" } = useParams();
  const { profile, addToPlan, plan } = useAppState();
  const navigate = useNavigate();
  const query = useQuery({ queryKey: ["opportunity", id], queryFn: () => getOpportunity(id), enabled: Boolean(id) });
  const eligibility = useMutation({ mutationFn: () => checkEligibility(profile!, id) });
  const opportunity = query.data?.data.opportunity;
  const isInPlan = plan.some((item) => item.recommendation.opportunityId === id);
  const recommendation = useAppState().recommendations.find((result) => result.opportunityId === id);

  if (query.isPending) return <LoadingState text="Loading opportunity details…" />;
  if (query.isError) return <div className="content-page"><Link to="/opportunities" className="back-link"><ArrowLeft size={15} /> Back to opportunities</Link><ErrorState error={query.error} onRetry={() => void query.refetch()} /></div>;
  if (!opportunity) return null;

  return (
    <div className="content-page detail-page">
      <Link to="/opportunities" className="back-link"><ArrowLeft size={15} /> All opportunities</Link>
      <section className="detail-hero">
        <div className="card-topline"><span className="type-pill">{humanize(opportunity.type)}</span><StatusBadge opportunity={opportunity} /></div>
        <h1>{opportunity.title}</h1>
        <p className="detail-org">{opportunity.organization.name}{opportunity.organization.kind ? ` · ${humanize(opportunity.organization.kind)}` : ""}</p>
        <p className="location-line"><MapPin size={15} /> {formatOpportunityLocation(opportunity.location)}</p>
        <div className="detail-actions">
          {opportunity.applicationUrl && <a className="button button-dark" href={opportunity.applicationUrl} target="_blank" rel="noreferrer">Visit application link <ArrowUpRight size={16} /></a>}
          {recommendation && !isInPlan && <button className="button button-outline" type="button" onClick={() => addToPlan(recommendation)}><CheckCircle2 size={16} /> Add to action plan</button>}
          {isInPlan && <Link className="button button-outline" to="/action-plan"><Check size={16} /> In your action plan</Link>}
        </div>
      </section>
      {opportunity.metadata?.isSynthetic === true && <div className="notice notice-warn"><CircleAlert size={18} /><p><strong>Synthetic demo record.</strong> This is not a genuine live listing. Do not rely on it as an available opportunity.</p></div>}
      {opportunity.metadata?.isLiveOpportunity === false && <div className="notice notice-neutral"><CircleAlert size={18} /><p>This record is not marked as a live opportunity. Confirm availability directly with the source.</p></div>}
      <div className="detail-layout">
        <div className="detail-main">
          <section className="detail-section"><h2>About this opportunity</h2><p>{opportunity.description || "A description was not provided in this catalogue record."}</p></section>
          <section className="detail-section">
            <h2>Requirements</h2>
            {opportunity.requirements.length ? <ul className="requirements-list">{opportunity.requirements.map((requirement, index) => <li key={typeof requirement === "string" ? `${index}-${requirement}` : requirement.id}><CheckCircle2 size={16} /> <span>{typeof requirement === "string" ? requirement : requirement.description}{typeof requirement !== "string" && <small>{humanize(requirement.importance)} · {humanize(requirement.certainty)}</small>}</span></li>)}</ul> : <p>No requirements were specified in this record.</p>}
          </section>
          <section className="detail-section">
            <div className="section-title-row"><div><span className="eyebrow">PROFILE CHECK</span><h2>Check eligibility</h2></div><Target size={20} /></div>
            {!profile ? <div className="inline-empty"><p>Create a profile first to check requirements against information you have provided.</p><Link className="button button-outline" to="/guidance">Build my profile <ArrowRight size={14} /></Link></div> : <button className="button button-dark" type="button" onClick={() => eligibility.mutate()} disabled={eligibility.isPending}>{eligibility.isPending ? "Checking…" : "Check my eligibility"} <ArrowRight size={15} /></button>}
            {eligibility.isError && <ErrorState error={eligibility.error} onRetry={() => eligibility.mutate()} compact />}
            {eligibility.data && <EligibilityPanel result={eligibility.data.data.eligibility} />}
          </section>
        </div>
        <aside className="detail-aside">
          <div className="aside-card"><h3>At a glance</h3><DetailFact label="Deadline" value={deadlineText(opportunity)} /><DetailFact label="Deadline status" value={humanize(opportunity.deadlineStatus)} /><DetailFact label="Duration" value={opportunity.duration || "Not specified"} /><DetailFact label="Location mode" value={humanize(opportunity.location?.workMode || "Not specified")} /></div>
          <div className="aside-card"><h3>Cost & support</h3><DetailFact label="Cost" value={displayValue(opportunity.costAndFunding.cost)} /><DetailFact label="Cost certainty" value={humanize(opportunity.costAndFunding.costCertainty || "Not specified")} />{opportunity.costAndFunding.benefits?.length ? <div className="detail-fact"><span>Benefits listed</span><ul>{opportunity.costAndFunding.benefits.map((benefit) => <li key={benefit}>{benefit}</li>)}</ul></div> : null}</div>
          <div className="source-card"><span className="eyebrow">LISTING SOURCE</span><h3>{opportunity.source.name}</h3>{opportunity.source.attribution && <p>{opportunity.source.attribution}</p>}{opportunity.source.url && <a href={opportunity.source.url} target="_blank" rel="noreferrer">Open source <ArrowUpRight size={14} /></a>}<p className="verification-note">Verification: {humanize(opportunity.verification.state)}{opportunity.verification.lastVerifiedAt ? ` · ${formatDate(opportunity.verification.lastVerifiedAt)}` : ""}</p>{opportunity.verification.verificationNote && <p>{opportunity.verification.verificationNote}</p>}</div>
        </aside>
      </div>
      <button className="text-button back-bottom" type="button" onClick={() => navigate(-1)}><ArrowLeft size={14} /> Go back</button>
    </div>
  );
}

function DetailFact({ label, value }: { label: string; value: string }) {
  return <div className="detail-fact"><span>{label}</span><strong>{value}</strong></div>;
}

function EligibilityPanel({ result }: { result: EligibilityResult }) {
  return (
    <div className="eligibility-panel">
      <div className={`eligibility-outcome outcome-${result.outcome}`}><strong>{humanize(result.outcome)} based on information provided</strong><p>{result.explanation}</p></div>
      {[
        ["Satisfied", result.satisfied],
        ["Unmet", result.unmet],
        ["Need more information", result.unresolved],
        ["Preferred", result.preferred],
      ].filter(([, entries]) => (entries as EligibilityResult["satisfied"]).length > 0).map(([label, entries]) => (
        <div className="requirement-group" key={label as string}><h4>{label as string}</h4>{(entries as EligibilityResult["satisfied"]).map((entry) => <p key={entry.requirementId}>{entry.description}<small>{entry.explanation}</small></p>)}</div>
      ))}
    </div>
  );
}

function GuidancePage() {
  const { profile, setProfile, setRecommendations, recommendations, addToPlan, plan, t } = useAppState();
  const mutation = useMutation({ mutationFn: getMatches });
  const [form, setForm] = useState(() => initialProfileForm(profile));
  const [selectedTypes, setSelectedTypes] = useState<OpportunityType[]>(profile?.preferredOpportunityTypes ?? []);
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedMatchProvince, setSelectedMatchProvince] = useState("");
  const [selectedMatchDistrict, setSelectedMatchDistrict] = useState("");
  const steps = [
    { title: "step1Title", description: "step1Description" },
    { title: "step2Title", description: "step2Description" },
    { title: "step3Title", description: "step3Description" },
    { title: "step4Title", description: "step4Description" },
    { title: "step5Title", description: "step5Description" },
  ] as const;

  function setField<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (stepIndex !== steps.length - 1) return;
    const newProfile = createProfile(form, selectedTypes);
    setProfile(newProfile);
    mutation.mutate(newProfile, {
      onSuccess(response) {
        setRecommendations(response.data);
      },
    });
  }

  const matches = mutation.data?.data ?? recommendations;
  const filteredMatches = matches.filter(({ opportunity }) =>
    locationMatchesFilters(opportunity.location, selectedMatchProvince, selectedMatchDistrict));
  const inPlan = new Set(plan.map((item) => item.recommendation.opportunityId));
  const progressPercent = ((stepIndex + 1) / steps.length) * 100;

  function updateMatchProvince(province: string) {
    setSelectedMatchProvince(province);
    setSelectedMatchDistrict((current) =>
      current && !districtsForProvince(province).includes(current) ? "" : current);
  }

  return (
    <div className="content-page">
      <PageIntro eyebrow={t("guidanceEyebrow")} title={t("guidanceTitle")} description={t("guidanceDescription")} />
      <div className="guidance-layout">
        <form className="profile-form" onSubmit={submit}>
          <div className="guidance-progress">
            <div className="guidance-progress-label"><strong>{t(steps[stepIndex].title)}</strong><span>{t("stepLabel", { current: stepIndex + 1, total: steps.length })}</span></div>
            <div className="guidance-progress-track" role="progressbar" aria-label={t("stepProgress")} aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={stepIndex + 1}>
              <span style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
          <div className="form-section-heading">
            <span className="form-number">{String(stepIndex + 1).padStart(2, "0")}</span>
            <div><h2>{t(steps[stepIndex].title)}</h2><p>{t(steps[stepIndex].description)}</p></div>
          </div>
          {stepIndex === 0 && <div className="guidance-step-fields">
            <div className="form-row">
              <label>{t("age")}<input type="number" min="0" max="120" value={form.age} onChange={(event) => setField("age", event.target.value)} placeholder="22" /></label>
              <label>{t("location")}<input value={form.locations} onChange={(event) => setField("locations", event.target.value)} placeholder={t("locationPlaceholder")} /></label>
            </div>
          </div>}
          {stepIndex === 1 && <div className="guidance-step-fields">
            <div className="form-row">
              <label>{t("qualification")}<input value={form.qualification} onChange={(event) => setField("qualification", event.target.value)} placeholder="e.g. Upper secondary" /></label>
              <label>{t("fieldOfStudy")}<input value={form.fieldOfStudy} onChange={(event) => setField("fieldOfStudy", event.target.value)} placeholder={t("optional")} /></label>
            </div>
          </div>}
          {stepIndex === 2 && <div className="guidance-step-fields">
            <label>{t("skills")}<input value={form.skills} onChange={(event) => setField("skills", event.target.value)} placeholder={t("skillsPlaceholder")} /></label>
            <label className="check-label"><input type="checkbox" checked={form.skillsComplete} onChange={(event) => setField("skillsComplete", event.target.checked)} /> {t("skillsComplete")}</label>
          </div>}
          {stepIndex === 3 && <div className="guidance-step-fields">
            <div className="form-row">
              <label>{t("experienceRole")}<input value={form.experienceRole} onChange={(event) => setField("experienceRole", event.target.value)} placeholder={t("optional")} /></label>
              <label>{t("yearsRole")}<input type="number" min="0" step="0.5" value={form.experienceYears} onChange={(event) => setField("experienceYears", event.target.value)} placeholder={t("optional")} /></label>
            </div>
            <label>{t("project")}<input value={form.project} onChange={(event) => setField("project", event.target.value)} placeholder={t("optional")} /></label>
          </div>}
          {stepIndex === 4 && <div className="guidance-step-fields">
            <label>{t("interests")}<input value={form.interests} onChange={(event) => setField("interests", event.target.value)} placeholder={t("interestsPlaceholder")} /></label>
            <label className="check-label"><input type="checkbox" checked={form.interestsComplete} onChange={(event) => setField("interestsComplete", event.target.checked)} /> {t("interestsComplete")}</label>
            <div className="form-row">
              <label>{t("careerGoals")}<input value={form.careerGoals} onChange={(event) => setField("careerGoals", event.target.value)} placeholder={t("careerGoalsPlaceholder")} /></label>
              <label>{t("educationGoal")}<input value={form.educationGoal} onChange={(event) => setField("educationGoal", event.target.value)} placeholder={t("optional")} /></label>
            </div>
            <fieldset className="type-fieldset"><legend>{t("opportunityTypes")}</legend><div className="type-checkbox-grid">{opportunityTypes.map((type) => <label className="check-label" key={type}><input type="checkbox" checked={selectedTypes.includes(type)} onChange={(event) => setSelectedTypes((current) => event.target.checked ? [...current, type] : current.filter((item) => item !== type))} />{humanize(type)}</label>)}</div></fieldset>
          </div>}
          <div className="guidance-step-actions">
            {stepIndex > 0 && <button className="button button-outline" type="button" onClick={() => setStepIndex((current) => current - 1)}><ArrowLeft size={15} /> {t("previous")}</button>}
            {stepIndex < steps.length - 1
              ? <button className="button button-dark" type="button" onClick={() => setStepIndex((current) => current + 1)}>{t("next")} <ArrowRight size={15} /></button>
              : <button className="button button-dark form-submit" type="submit" disabled={mutation.isPending}>{mutation.isPending ? t("findingOptions") : t("showGuidance")} <ArrowRight size={16} /></button>}
          </div>
          <p className="form-disclaimer">{t("profileDisclaimer")}</p>
          {mutation.isError && <ErrorState error={mutation.error} onRetry={() => mutation.mutate(createProfile(form, selectedTypes))} compact />}
        </form>
        <aside className="guidance-aside">
          <div className="guidance-tip"><span className="mini-icon mint"><Lightbulb size={17} /></span><h3>{t("tipHonestTitle")}</h3><p>{t("tipHonestText")}</p></div>
          <div className="guidance-tip peach-tip"><span className="mini-icon orange"><Target size={17} /></span><h3>{t("tipFitTitle")}</h3><p>{t("tipFitText")}</p></div>
          <div className="guidance-tip"><span className="eyebrow">{t("whatNext")}</span><p>{t("whatNextText")}</p></div>
        </aside>
      </div>
      {(matches.length > 0 || mutation.isSuccess) && (
        <section className="matches-section">
          <div className="section-heading"><div><span className="eyebrow">{t("matchesEyebrow")}</span><h2>{matches.length ? t("matchesTitle") : t("noMatchesTitle")}</h2></div><p>{t("matchesNote")}</p></div>
          {profile?.interests?.length ? <p className="profile-interests"><strong>Your stated interests:</strong> {profile.interests.join(", ")}</p> : null}
          <div className="match-location-filter">
            <label>Province
              <select value={selectedMatchProvince} onChange={(event) => updateMatchProvince(event.target.value)}>
                <option value="">All provinces</option>
                {RWANDA_PROVINCES.map((province) => <option key={province} value={province}>{province}</option>)}
              </select>
            </label>
            <label>District
              <select value={selectedMatchDistrict} onChange={(event) => setSelectedMatchDistrict(event.target.value)}>
                <option value="">All districts</option>
                {districtsForProvince(selectedMatchProvince).map((district) => <option key={district} value={district}>{district}</option>)}
              </select>
            </label>
            <div className="nearby-actions">
              {(selectedMatchProvince || selectedMatchDistrict) && <button className="text-button" type="button" onClick={() => {
                setSelectedMatchProvince("");
                setSelectedMatchDistrict("");
              }}>Clear location filters</button>}
            </div>
          </div>
          {matches.length === 0 && <EmptyState title={t("noMatchesTitle")} text={t("noMatchesText")} />}
          {matches.length > 0 && filteredMatches.length === 0 && <EmptyState title="No profile matches in this location" text="The selected province and district narrow the returned profile matches. Clear the location filters to review all matches." action={<button className="button button-outline" type="button" onClick={() => {
            setSelectedMatchProvince("");
            setSelectedMatchDistrict("");
          }}>Show all profile matches</button>} />}
          <div className="match-list">{filteredMatches.map((result) => <RecommendationCard key={result.opportunityId} recommendation={result} onAdd={() => addToPlan(result)} inPlan={inPlan.has(result.opportunityId)} />)}</div>
        </section>
      )}
    </div>
  );
}

interface ProfileForm {
  age: string;
  locations: string;
  qualification: string;
  fieldOfStudy: string;
  skills: string;
  skillsComplete: boolean;
  experienceRole: string;
  experienceYears: string;
  project: string;
  interests: string;
  careerGoals: string;
  educationGoal: string;
  interestsComplete: boolean;
}

function initialProfileForm(profile?: UserProfile): ProfileForm {
  return {
    age: profile?.age === undefined ? "" : String(profile.age),
    locations: profile?.preferredLocations?.join(", ") ?? "",
    qualification: profile?.qualifications?.[0]?.name ?? "",
    fieldOfStudy: profile?.qualifications?.[0]?.fieldOfStudy ?? "",
    skills: profile?.skills?.map((skill) => skill.name).join(", ") ?? "",
    skillsComplete: profile?.skillDisclosure === "complete",
    experienceRole: profile?.workExperience?.[0]?.role ?? "",
    experienceYears: profile?.workExperience?.[0]?.years === undefined ? "" : String(profile.workExperience[0].years),
    project: profile?.projects?.[0]?.name ?? "",
    interests: profile?.interests?.join(", ") ?? "",
    careerGoals: profile?.careerGoals?.join(", ") ?? "",
    educationGoal: profile?.preferredCategories?.join(", ") ?? "",
    interestsComplete: profile?.interestDisclosure === "complete",
  };
}

function createProfile(form: ProfileForm, preferredOpportunityTypes: OpportunityType[]): UserProfile {
  const profile: UserProfile = {};
  const age = Number(form.age);
  if (form.age.trim() && Number.isFinite(age) && age >= 0) profile.age = age;
  const locations = splitList(form.locations);
  if (locations.length) profile.preferredLocations = locations;
  if (form.qualification.trim()) {
    profile.qualifications = [{
      name: form.qualification.trim(),
      ...(form.fieldOfStudy.trim() ? { fieldOfStudy: form.fieldOfStudy.trim() } : {}),
    }];
    profile.qualificationDisclosure = "complete";
  } else {
    profile.qualificationDisclosure = "unknown";
  }
  const skills = splitList(form.skills).map((name) => ({ name }));
  if (skills.length) profile.skills = skills;
  profile.skillDisclosure = form.skillsComplete ? "complete" : "partial";
  const years = Number(form.experienceYears);
  if (form.experienceRole.trim() && form.experienceYears.trim() && Number.isFinite(years) && years >= 0) {
    profile.workExperience = [{ role: form.experienceRole.trim(), years }];
    profile.workExperienceDisclosure = "complete";
  } else {
    profile.workExperienceDisclosure = "unknown";
  }
  if (form.project.trim()) profile.projects = [{ name: form.project.trim() }];
  const interests = splitList(form.interests);
  if (interests.length) profile.interests = interests;
  const careerGoals = splitList(form.careerGoals);
  const educationGoals = splitList(form.educationGoal);
  if (careerGoals.length || educationGoals.length) profile.careerGoals = [...careerGoals, ...educationGoals];
  if (educationGoals.length) profile.preferredCategories = educationGoals;
  profile.interestDisclosure = form.interestsComplete ? "complete" : "partial";
  if (preferredOpportunityTypes.length) profile.preferredOpportunityTypes = preferredOpportunityTypes;
  return profile;
}

function RecommendationCard({
  recommendation,
  onAdd,
  inPlan,
}: {
  recommendation: Recommendation;
  onAdd: () => void;
  inPlan: boolean;
}) {
  const { opportunity } = recommendation;
  const skillEvidence = recommendation.suitability.components.find((component) => component.factor === "skills");
  const interestEvidence = recommendation.suitability.components.find((component) => component.factor === "interests");
  return (
    <article className="recommendation-card">
      <div className="recommendation-main">
        <div className="card-topline"><span className="type-pill">{humanize(opportunity.type)}</span><EligibilityBadge outcome={recommendation.eligibility.outcome} /></div>
        <Link className="opportunity-title" to={`/opportunities/${encodeURIComponent(opportunity.id)}`}>{recommendation.title}</Link>
        <div className="organization">{recommendation.organization}</div>
        <div className="recommendation-location"><MapPin size={13} /> {formatOpportunityLocation(opportunity.location)}</div>
        <div className="recommendation-meta">
          <span><strong>Deadline:</strong> {deadlineText(opportunity)}</span>
          {opportunity.applicationUrl && <a href={opportunity.applicationUrl} target="_blank" rel="noreferrer">Application link <ArrowUpRight size={13} /></a>}
        </div>
        <p>{recommendation.eligibility.explanation}</p>
        {opportunity.metadata?.isSynthetic === true && <span className="record-flag">Synthetic demo record</span>}
        <details className="score-explanation">
          <summary>Profile-match score explanation</summary>
          <p>{recommendation.suitability.scoreMeaning}</p>
          <p>Evidence coverage: {recommendation.suitability.evidenceCoveragePercent}% of configured scoring weight had comparable evidence.</p>
        </details>
        {(skillEvidence || interestEvidence) && <details className="recommendation-evidence">
          <summary>Skills and interests evidence</summary>
          {skillEvidence && <EvidenceFactor label="Skill alignment" component={skillEvidence} />}
          {interestEvidence && <EvidenceFactor label="Interest alignment" component={interestEvidence} />}
        </details>}
      </div>
      <div className="recommendation-side">
        <span className="score-label">SUITABILITY</span>
        <strong className="suitability-score">{recommendation.suitability.score === null ? "—" : `${recommendation.suitability.score}%`}</strong>
        <span className="score-note">Not a success probability</span>
        <div className="recommendation-actions"><Link className="text-link" to={`/opportunities/${encodeURIComponent(opportunity.id)}`}>Review details <ArrowRight size={14} /></Link>{inPlan ? <Link className="button button-small button-outline" to="/action-plan">In action plan <Check size={13} /></Link> : <button className="button button-small button-dark" type="button" onClick={onAdd}>Add to plan <ArrowRight size={13} /></button>}</div>
      </div>
    </article>
  );
}

function EvidenceFactor({ label, component }: { label: string; component: Recommendation["suitability"]["components"][number] }) {
  return (
    <section className="evidence-factor">
      <h4>{label}{component.score === null ? "" : ` · ${component.score}%`}</h4>
      {component.score !== null && <progress max={100} value={component.score} aria-label={`${label}: ${component.score}%`} />}
      <p>{component.explanation}</p>
      {component.matchedEvidence.length > 0 && <p><strong>Aligned:</strong> {component.matchedEvidence.join("; ")}</p>}
      {component.nonMatchingEvidence.length > 0 && <p><strong>Not aligned:</strong> {component.nonMatchingEvidence.join("; ")}</p>}
      {component.unresolvedEvidence.length > 0 && <p><strong>Unknown:</strong> {component.unresolvedEvidence.join("; ")}</p>}
    </section>
  );
}

function ActionPlanPage() {
  const { plan, togglePlanStep, removeFromPlan } = useAppState();
  const steps = [
    "Review the listed requirements and compare them with your profile.",
    "Check the latest opportunity details with the listed source.",
    "Decide on a next action, such as preparing questions or application materials.",
  ];
  return (
    <div className="content-page">
      <PageIntro eyebrow="YOUR NEXT STEPS" title="A plan you can work through." description="Keep recommendations you want to explore and track a few simple actions. This plan is held in the current page session only; it is not saved to an account." />
      {plan.length === 0 ? <EmptyState icon={<CheckCircle2 size={24} />} title="Your plan starts with one option" text="Build your profile to see catalogue matches, then add an option that feels worth exploring." action={<Link className="button button-dark" to="/guidance">Build my profile <ArrowRight size={15} /></Link>} /> : (
        <div className="plan-list">{plan.map((item) => {
          const opportunity = item.recommendation.opportunity;
          const doneCount = item.completed.filter(Boolean).length;
          return (
            <article className="plan-card" key={opportunity.id}>
              <div className="plan-card-head"><div><span className="type-pill">{humanize(opportunity.type)}</span><h2><Link to={`/opportunities/${encodeURIComponent(opportunity.id)}`}>{opportunity.title}</Link></h2><p>{opportunity.organization.name}</p></div><button className="text-button remove-plan" type="button" onClick={() => removeFromPlan(opportunity.id)}>Remove</button></div>
              <div className="plan-progress"><span>{doneCount} of {steps.length} steps complete</span><span className="progress-track"><span style={{ width: `${(doneCount / steps.length) * 100}%` }} /></span></div>
              <div className="plan-steps">{steps.map((step, index) => <label className={`plan-step${item.completed[index] ? " step-done" : ""}`} key={step}><input type="checkbox" checked={item.completed[index] ?? false} onChange={() => togglePlanStep(opportunity.id, index)} /><span className="step-check">{item.completed[index] && <Check size={13} />}</span><span>{step}</span></label>)}</div>
              <Link className="text-link" to={`/opportunities/${encodeURIComponent(opportunity.id)}`}>Review listing details <ArrowRight size={14} /></Link>
            </article>
          );
        })}</div>
      )}
    </div>
  );
}

function PageIntro({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="page-intro"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>;
}

function StatusBadge({ opportunity }: { opportunity: Opportunity }) {
  const synthetic = opportunity.metadata?.isSynthetic === true || opportunity.verification.state === "synthetic";
  const label = synthetic ? "Synthetic" : opportunity.status === "needs_confirmation" || opportunity.verification.state === "needs_confirmation" ? "Needs confirmation" : humanize(opportunity.status);
  const tone = synthetic ? "badge-synthetic" : opportunity.status === "open" || opportunity.status === "rolling" ? "badge-open" : opportunity.status === "closed" ? "badge-closed" : "badge-review";
  return <span className={`status-badge ${tone}`}>{label}</span>;
}

function EligibilityBadge({ outcome }: { outcome: EligibilityResult["outcome"] }) {
  return <span className={`eligibility-badge eligibility-${outcome}`}>{humanize(outcome)}</span>;
}

function LoadingState({ text }: { text: string }) {
  return <div className="loading-state"><span className="loading-spinner" aria-hidden="true" /><span>{text}</span></div>;
}

function ErrorState({ error, onRetry, compact = false }: { error: unknown; onRetry: () => void; compact?: boolean }) {
  const message = error instanceof ApiError ? error.message : error instanceof Error ? error.message : "The request failed unexpectedly.";
  const code = error instanceof ApiError ? error.code : undefined;
  return (
    <div className={`error-state${compact ? " error-compact" : ""}`} role="alert">
      <span className="error-icon"><CircleAlert size={19} /></span><div><strong>{code || "Couldn’t load this information"}</strong><p>{message}</p><button className="button button-outline button-small" type="button" onClick={onRetry}><RotateCw size={14} /> Retry</button></div>
    </div>
  );
}

function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: string; text: string; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-icon">{icon ?? <Search size={23} />}</span><h2>{title}</h2><p>{text}</p>{action}</div>;
}

function NotFoundPage() {
  return <div className="content-page"><EmptyState title="We couldn’t find that page" text="The address may have changed. Return to opportunities to keep exploring." action={<Link className="button button-dark" to="/opportunities">Explore opportunities <ArrowRight size={15} /></Link>} /></div>;
}

function humanize(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toLocaleUpperCase());
}

function splitList(value: string): string[] {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}

function displayValue(value: string | number | null | undefined): string {
  return value === undefined || value === null || value === "" ? "Not specified" : String(value);
}

function deadlineText(opportunity: Opportunity): string {
  return opportunity.deadline ? formatDate(opportunity.deadline) : opportunity.deadlineStatus === "rolling" ? "Rolling" : "Not specified";
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(date);
}
