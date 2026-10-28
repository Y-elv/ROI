import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  BriefcaseBusiness,
  CheckCircle2,
  CircleAlert,
  GraduationCap,
  MapPin,
  RotateCw,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  getUserFacingErrorMessage,
  getMatches,
  getNisrEducation,
  getNisrEstablishments,
  getNisrLabourMarket,
  getNisrOverview,
} from "../api";
import { useAppState } from "../context";
import type {
  NISREducationDistribution,
  NISREstablishmentGroup,
  NISRLabourMarket,
  Recommendation,
} from "../types";

export default function CareerPathwaysPage() {
  const { profile, recommendations, setRecommendations, addToPlan, plan } = useAppState();
  const [careerGoal, setCareerGoal] = useState(profile?.careerGoals?.[0] ?? "");
  const [requestedGoal, setRequestedGoal] = useState("");

  const overview = useQuery({ queryKey: ["nisr", "overview"], queryFn: getNisrOverview });
  const labour = useQuery({ queryKey: ["nisr", "labour"], queryFn: getNisrLabourMarket });
  const education = useQuery({ queryKey: ["nisr", "education"], queryFn: getNisrEducation });
  const establishments = useQuery({ queryKey: ["nisr", "establishments"], queryFn: getNisrEstablishments });

  const matching = useMutation({
    mutationFn: (goal: string) => {
      if (!profile) throw new Error("Create a profile before finding opportunity matches.");
      const careerGoals = [...new Set([...(profile.careerGoals ?? []), goal.trim()].filter(Boolean))];
      return getMatches({ ...profile, careerGoals });
    },
    onSuccess(response, goal) {
      setRequestedGoal(goal);
      setRecommendations(response.data);
    },
  });

  function submitGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const goal = careerGoal.trim();
    if (!goal || !profile) return;
    setRequestedGoal(goal);
    matching.mutate(goal);
  }

  const currentRecommendations = matching.data?.data ?? recommendations;
  const shownRecommendations = currentRecommendations;
  const plannedIds = new Set(plan.map((item) => item.recommendation.opportunityId));
  const occupationCategories = labour.data?.data.employmentByOccupation.categories ?? [];
  const sectorCategories = labour.data?.data.employmentBySector.categories ?? [];
  const topOccupations = topByShare(occupationCategories, 5);
  const topSectors = topByShare(sectorCategories, 5);
  const educationDistributions = education.data?.data.distributions;
  const selectedEducation = educationDistributions
    ? [
        ["highestEducationAttended", "Education attended"],
        ["educationCompleted", "Education completed"],
        ["currentlyAttendingTVET", "Currently attending TVET"],
        ["everLearnedTVET", "Ever learned TVET"],
        ["technicalSkillLearned", "Technical skills learned"],
      ].flatMap(([key, title]) => {
        const distribution = educationDistributions[key];
        return distribution ? [{ key, title, distribution }] : [];
      })
    : [];
  const establishmentSectors = establishments.data?.data.dimensions.sector;

  return (
    <div className="career-page">
      <header className="career-hero">
        <div className="career-hero-copy">
          <span className="career-kicker"><Sparkles size={14} /> CAREER PATHWAYS · RWANDA</span>
          <h1>Make your next move<br /><span>with more clarity.</span></h1>
          <p>Bring together your interests, real opportunities, and Rwanda’s labour-market evidence to explore a practical next step.</p>
          <a className="career-hero-link" href="#pathway-match">Explore my next step <ArrowRight size={16} /></a>
        </div>
        <div className="career-hero-visual" aria-hidden="true">
          <div className="career-visual-orbit orbit-one" />
          <div className="career-visual-orbit orbit-two" />
          <div className="career-visual-center"><Target size={29} /></div>
          <span className="career-visual-node node-one"><BookOpen size={17} /></span>
          <span className="career-visual-node node-two"><BriefcaseBusiness size={17} /></span>
          <span className="career-visual-node node-three"><GraduationCap size={18} /></span>
        </div>
        <div className="career-hero-foot">
          <span><span className="career-live-dot" /> Evidence, not promises</span>
          <span>Survey patterns describe populations; they do not predict an individual’s outcome.</span>
        </div>
      </header>

      <section id="pathway-match" className="career-match-section">
        <div className="career-section-heading">
          <div>
            <span className="career-overline">YOUR CAREER DIRECTION</span>
            <h2>Start with a direction that matters to you.</h2>
          </div>
          <p>Matches compare your profile with catalogue opportunities. They do not model job-to-job career progression.</p>
        </div>
        <div className="career-match-layout">
          <form className="career-goal-card" onSubmit={submitGoal}>
            <div className="career-card-icon"><Target size={19} /></div>
            <h3>What would you like to work towards?</h3>
            <p>Choose an occupation, field, or career goal in your own words.</p>
            <label htmlFor="career-goal">Your career direction</label>
            <input
              id="career-goal"
              value={careerGoal}
              onChange={(event) => setCareerGoal(event.target.value)}
              placeholder="e.g. agricultural work, healthcare"
              maxLength={120}
            />
            {profile ? (
              <>
                <button className="career-button career-button-primary" type="submit" disabled={!careerGoal.trim() || matching.isPending}>
                  {matching.isPending ? "Finding opportunities…" : "Find relevant opportunities"} <ArrowRight size={15} />
                </button>
                <p className="career-small-note">Uses the opportunity catalogue’s profile matcher. Your career direction is added to the match request, not saved to your profile.</p>
              </>
            ) : (
              <div className="career-profile-needed">
                <p>Create a profile before matching your experience to opportunities.</p>
                <Link className="career-button career-button-primary" to="/guidance">Build my profile <ArrowRight size={15} /></Link>
              </div>
            )}
          </form>

          <div className="career-match-results">
            {!profile && (
              <div className="career-no-profile">
                <span><GraduationCap size={23} /></span>
                <strong>Your starting point comes first.</strong>
                <p>Add education, skills, experience, or interests to get catalogue matches.</p>
                <Link to="/guidance">Create a profile <ArrowRight size={14} /></Link>
              </div>
            )}
            {profile && matching.isError && <CareerError title="Opportunity matches could not be loaded" error={matching.error} onRetry={() => matching.mutate(careerGoal.trim())} />}
            {profile && matching.isPending && <CareerLoading label="Comparing your profile with catalogue opportunities…" />}
            {profile && !matching.isPending && !matching.isError && shownRecommendations.length === 0 && (
              <div className="career-no-profile">
                <span><BriefcaseBusiness size={21} /></span>
                <strong>{requestedGoal ? "No catalogue matches to show yet." : "Your profile is ready to explore."}</strong>
                <p>{requestedGoal ? "Try another career direction or broaden your profile. No sample opportunities are substituted." : "Choose a direction and request matches to explore real catalogue listings."}</p>
              </div>
            )}
            {shownRecommendations.length > 0 && (
              <>
                <div className="career-results-title">
                  <div><span className="career-overline">CATALOGUE OPPORTUNITIES</span><h3>{requestedGoal ? `Options related to “${requestedGoal}”` : "Options from your guidance"}</h3></div>
                  <span>{shownRecommendations.length} results</span>
                </div>
                <div className="career-recommendation-list">
                  {shownRecommendations.slice(0, 3).map((recommendation) => (
                    <CareerRecommendation
                      key={recommendation.opportunityId}
                      recommendation={recommendation}
                      inPlan={plannedIds.has(recommendation.opportunityId)}
                      onAdd={() => addToPlan(recommendation)}
                    />
                  ))}
                </div>
                {shownRecommendations.length > 3 && <Link className="career-text-link" to="/guidance">See guidance and all {shownRecommendations.length} matches <ArrowRight size={14} /></Link>}
              </>
            )}
          </div>
        </div>
      </section>

      <section className="career-evidence-section">
        <div className="career-section-heading">
          <div><span className="career-overline">RWANDA LABOUR EVIDENCE</span><h2>Explore the work landscape.</h2></div>
          <p>National survey patterns can provide context for exploration. They are not vacancy counts or forecasts.</p>
        </div>
        {labour.isPending ? <CareerLoading label="Loading labour-market evidence…" /> : labour.isError ? <CareerError error={labour.error} onRetry={() => void labour.refetch()} /> : (
          <>
            <EvidenceProvenance name={labour.data.data.source.name} year={labour.data.data.source.sourceYear} />
            <div className="career-rate-grid">
              <CareerRate label="Youth unemployment" metric={labour.data.data.overview.youthUnemploymentRate} />
              <CareerRate label="Youth employment-to-population" metric={labour.data.data.overview.youthEmploymentToPopulationRatio} />
              <CareerRate label="Labour-force participation" metric={labour.data.data.overview.labourForceParticipationRate} />
            </div>
            <div className="career-evidence-grid">
              <CategoryEvidence
                title="Occupation groups among employed respondents"
                description="Weighted distribution of employed Labour Force Survey respondents—not current vacancies."
                categories={topOccupations}
                onExplore={setCareerGoal}
                targetLabel="Use as career direction"
              />
              <CategoryEvidence
                title="Employment by sector"
                description="Weighted sector distribution among employed respondents; not a measure of hiring demand."
                categories={topSectors}
              />
            </div>
            <div className="career-evidence-caveat">
              <CircleAlert size={16} />
              <p>These occupation and sector distributions describe weighted responses among employed survey respondents. They are not vacancy counts, employer demand estimates, or career forecasts.</p>
            </div>
            <details className="career-methodology"><summary>Labour Force Survey methodology</summary><ul>{labour.data.data.methodology.map((item) => <li key={item}>{item}</li>)}</ul></details>
          </>
        )}
      </section>

      <section className="career-learning-section">
        <div className="career-section-heading">
          <div><span className="career-overline">LEARNING & PRACTICAL SKILLS</span><h2>Explore learning context.</h2></div>
          <p>Survey responses show participation and attainment; they do not certify a qualification or a skill.</p>
        </div>
        {education.isPending ? <CareerLoading label="Loading education and TVET evidence…" /> : education.isError ? <CareerError error={education.error} onRetry={() => void education.refetch()} /> : (
          <>
            <EvidenceProvenance name={education.data.data.source.name} year={education.data.data.source.sourceYear} />
            <div className="career-learning-grid">
              {selectedEducation.map(({ key, title, distribution }) => (
                <LearningDistribution key={key} title={title} distribution={distribution} />
              ))}
            </div>
            {education.data.data.limitations.length > 0 && <details className="career-methodology"><summary>About these education and TVET measures</summary><ul>{education.data.data.limitations.map((item) => <li key={item}>{item}</li>)}</ul></details>}
          </>
        )}
      </section>

      <section className="career-business-section">
        <div className="career-section-heading">
          <div><span className="career-overline">ESTABLISHMENTS & WORKFORCE</span><h2>See the business landscape.</h2></div>
          <p>The establishment census describes recorded establishments and workers, not open jobs or employers currently recruiting.</p>
        </div>
        {establishments.isPending ? <CareerLoading label="Loading establishment census evidence…" /> : establishments.isError ? <CareerError error={establishments.error} onRetry={() => void establishments.refetch()} /> : (
          <>
            <EvidenceProvenance name={establishments.data.data.source.name} year={establishments.data.data.sourceYear} />
            <div className="career-census-summary">
              <div><span>Establishment records</span><strong>{establishments.data.data.establishmentRecords.toLocaleString()}</strong></div>
              <div><span>Workers in supplied census fields</span><strong>{formatNumber(establishments.data.data.workforceTotals.Total_workers)}</strong></div>
              <div><span>Exact repeated rows retained</span><strong>{establishments.data.data.exactDuplicateRowsRetained.toLocaleString()}</strong></div>
            </div>
            {establishmentSectors && <EstablishmentEvidence groups={establishmentSectors} />}
            {establishments.data.data.limitations.length > 0 && <details className="career-methodology"><summary>Establishment census limitations</summary><ul>{establishments.data.data.limitations.map((item) => <li key={item}>{item}</li>)}</ul></details>}
          </>
        )}
      </section>

      <section className="career-next-steps">
        <div className="career-next-icon"><TrendingUp size={21} /></div>
        <div><span className="career-overline">KEEP MOVING FORWARD</span><h2>Turn a possibility into a practical next step.</h2><p>Review actual catalogue requirements, explore training listings, and make a plan that works for you.</p></div>
        <Link className="career-button career-button-primary" to="/opportunities">Explore opportunities <ArrowRight size={15} /></Link>
      </section>

      <div className="career-data-note">
        <span><CircleAlert size={15} /> Important context</span>
        <p>
          NISR Labour Force Survey evidence is from {overview.data?.data.sources.labourForceSurvey.sourceYear ?? "the survey source"}; establishment counts are from {establishments.data?.data.sourceYear ?? "the census source"}. These sources describe different years and populations. ROI does not currently provide a validated occupation taxonomy, career-transition graph, or skills-gap forecast.
        </p>
        {overview.isError && <CareerError error={overview.error} onRetry={() => void overview.refetch()} compact />}
      </div>
    </div>
  );
}

function CareerRecommendation({ recommendation, inPlan, onAdd }: {
  recommendation: Recommendation;
  inPlan: boolean;
  onAdd: () => void;
}) {
  const opportunity = recommendation.opportunity;
  const skills = recommendation.suitability.components.find((component) => component.factor === "skills");
  return (
    <article className="career-result-card">
      <div className="career-result-type">{humanize(opportunity.type)}<span className={`career-outcome outcome-${recommendation.eligibility.outcome}`}>{humanize(recommendation.eligibility.outcome)} eligibility</span></div>
      <Link to={`/opportunities/${encodeURIComponent(opportunity.id)}`} className="career-result-title">{recommendation.title}<ArrowUpRight size={15} /></Link>
      <p className="career-result-org">{recommendation.organization}</p>
      {opportunity.location?.displayLocation && <span className="career-result-location"><MapPin size={13} /> {opportunity.location.displayLocation}</span>}
      <p className="career-result-explanation">{recommendation.eligibility.explanation}</p>
      {skills && <div className="career-skills-evidence"><strong>Skills evidence</strong><span>{skills.score === null ? "No score: there are no comparable stated skill criteria." : skills.explanation}</span></div>}
      <div className="career-result-footer">
        <span className="career-fit-score">{recommendation.suitability.score === null ? "Suitability not scored" : `Suitability ${recommendation.suitability.score}%`}<small>Not a success probability</small></span>
        <div>
          {inPlan ? <Link className="career-button career-button-secondary" to="/action-plan">In your plan <CheckCircle2 size={14} /></Link> : <button className="career-button career-button-secondary" type="button" onClick={onAdd}>Add to plan <ArrowRight size={14} /></button>}
          <Link className="career-text-link" to={`/opportunities/${encodeURIComponent(opportunity.id)}`}>Review details</Link>
        </div>
      </div>
    </article>
  );
}

function CareerRate({ label, metric }: {
  label: string;
  metric?: { value?: number; unit?: string; denominator?: string };
}) {
  return (
    <article className="career-rate-card">
      <span>{label}</span>
      <strong>{metric?.value === undefined ? "Not reported" : `${metric.value.toFixed(1)}${metric.unit === "percent" ? "%" : ""}`}</strong>
      <small>{metric?.denominator ?? "Denominator not reported"}</small>
    </article>
  );
}

function CategoryEvidence({ title, description, categories, onExplore, targetLabel }: {
  title: string;
  description: string;
  categories: NISRLabourMarket["employmentByOccupation"]["categories"];
  onExplore?: (label: string) => void;
  targetLabel?: string;
}) {
  return (
    <article className="career-evidence-card">
      <h3>{title}</h3>
      <p>{description}</p>
      <div className="career-bar-list">
        {categories.slice(0, 5).map((category) => (
          <div className="career-bar-row" key={category.label}>
            <div className="career-bar-heading"><span>{category.label}</span><strong>{formatPercent(category.sharePercent)}</strong></div>
            <div className="career-bar-track"><span style={{ width: `${barWidth(category.sharePercent)}%` }} /></div>
            {onExplore && <button className="career-inline-button" type="button" onClick={() => onExplore(category.label)}>{targetLabel} <ArrowRight size={12} /></button>}
          </div>
        ))}
        {categories.length === 0 && <p className="career-no-data">No categories were returned by this source.</p>}
      </div>
    </article>
  );
}

function LearningDistribution({ title, distribution }: { title: string; distribution: NISREducationDistribution }) {
  return (
    <article className="career-learning-card">
      <h3>{title}</h3>
      <p>{distribution.variableLabel}</p>
      <div className="career-bar-list">
        {distribution.categories.map((category) => (
          <div className="career-bar-row" key={category.label}>
            <div className="career-bar-heading"><span>{category.label}</span><strong>{formatPercent(category.sharePercent)}</strong></div>
            <div className="career-bar-track"><span style={{ width: `${barWidth(category.sharePercent)}%` }} /></div>
          </div>
        ))}
        {distribution.categories.length === 0 && <p className="career-no-data">No categories were returned by this source.</p>}
      </div>
      <small>Valid survey responses: {distribution.validUnweightedRecords.toLocaleString()}</small>
    </article>
  );
}

function EstablishmentEvidence({ groups }: { groups: NISREstablishmentGroup[] }) {
  const topGroups = [...groups].sort((a, b) => b.establishmentRecords - a.establishmentRecords).slice(0, 5);
  return (
    <article className="career-establishment-card">
      <div className="career-establishment-title"><div><h3>Records by economic sector</h3><p>Counts of supplied census records, not confirmed unique establishments or vacancies.</p></div><span><BriefcaseBusiness size={16} /> CENSUS</span></div>
      <div className="career-table" role="table" aria-label="Establishment records by sector">
        <div className="career-table-head" role="row"><span role="columnheader">Sector</span><span role="columnheader">Records</span><span role="columnheader">Workers recorded</span></div>
        {topGroups.map((group) => (
          <div className="career-table-row" role="row" key={group.code ?? group.label}>
            <span role="cell">{cleanLabel(group.label)}</span>
            <strong role="cell">{group.establishmentRecords.toLocaleString()}</strong>
            <strong role="cell">{group.workforce.Total_workers.toLocaleString()}</strong>
          </div>
        ))}
        {topGroups.length === 0 && <p className="career-no-data">No sector breakdown was returned.</p>}
      </div>
    </article>
  );
}

function EvidenceProvenance({ name, year }: { name: string; year: number }) {
  return <div className="career-provenance"><span><span className="career-source-dot" /> {name}</span><strong>{year}</strong></div>;
}

function CareerLoading({ label }: { label: string }) {
  return <div className="career-loading"><span className="career-spinner" />{label}</div>;
}

function CareerError({ error, onRetry, compact = false, title = "Evidence could not be loaded" }: {
  error: unknown;
  onRetry: () => void;
  compact?: boolean;
  title?: string;
}) {
  const message = getUserFacingErrorMessage(error, "We couldn’t load this information. Please try again.");
  return (
    <div className={`career-error${compact ? " career-error-compact" : ""}`} role="alert">
      <CircleAlert size={17} /><div><strong>{title}</strong><p>{message}</p><button className="career-button career-button-secondary" type="button" onClick={onRetry}><RotateCw size={13} /> Retry</button></div>
    </div>
  );
}

function topByShare<T extends { sharePercent?: number | null }>(categories: T[], count: number): T[] {
  return [...categories]
    .filter((category) => typeof category.sharePercent === "number")
    .sort((a, b) => (b.sharePercent ?? 0) - (a.sharePercent ?? 0))
    .slice(0, count);
}

function formatPercent(value: number | null | undefined): string {
  return typeof value === "number" ? `${value.toFixed(1)}%` : "Not reported";
}

function barWidth(value: number | null | undefined): number {
  return typeof value === "number" ? Math.min(100, Math.max(0, value)) : 0;
}

function formatNumber(value: number | undefined): string {
  return typeof value === "number" ? value.toLocaleString() : "Not reported";
}

function humanize(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toLocaleUpperCase());
}

function cleanLabel(value: string): string {
  return value.replace(/^\d+[\s.-]*/, "");
}
