import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BriefcaseBusiness,
  Check,
  Download,
  GraduationCap,
  Languages,
  Lightbulb,
  Plus,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import { useAppState } from "../context";
import { downloadCvDocument, getUserFacingErrorMessage, improveCv } from "../api";
import type {
  CvCertification,
  CvData,
  CvEducation,
  CvExperience,
  CvLanguage,
  CvProject,
} from "../cvTypes";
import { emptyCv } from "../cvTypes";
import type { CvLanguageCode } from "../cvTypes";
import type { TranslationKey } from "../translations";
import "./cv-builder.css";

const STORAGE_KEY = "roi.cv-builder.progress.v1";

const steps = [
  { key: "cvStepContact", prompt: "cvPromptContact", icon: UserRound },
  { key: "cvStepProfile", prompt: "cvPromptProfile", icon: Lightbulb },
  { key: "cvStepEducation", prompt: "cvPromptEducation", icon: GraduationCap },
  { key: "cvStepExperience", prompt: "cvPromptExperience", icon: BriefcaseBusiness },
  { key: "cvStepProjects", prompt: "cvPromptProjects", icon: Sparkles },
  { key: "cvStepSkills", prompt: "cvPromptSkills", icon: Sparkles },
  { key: "cvStepCertifications", prompt: "cvPromptCertifications", icon: Award },
  { key: "cvStepLanguages", prompt: "cvPromptLanguages", icon: Languages },
  { key: "cvStepAdditional", prompt: "cvPromptAdditional", icon: Award },
  { key: "cvStepReview", prompt: "cvPromptReview", icon: Check },
] as const;

type StepKey = (typeof steps)[number]["key"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCvData(value: unknown): value is CvData {
  if (!isRecord(value)) return false;
  const textFields = ["fullName", "email", "phone", "location", "summary", "objective", "volunteering"];
  const listFields = ["skills", "achievements"];
  const objectListFields = ["education", "experience", "projects", "certifications", "languages"];
  return textFields.every((field) => typeof value[field] === "string") &&
    listFields.every((field) => Array.isArray(value[field]) && (value[field] as unknown[]).every((item) => typeof item === "string")) &&
    objectListFields.every((field) => Array.isArray(value[field]) &&
      (value[field] as unknown[]).every((item) => isRecord(item) && Object.values(item).every((entry) => typeof entry === "string")));
}

function linesToList(value: string): string[] {
  return value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
}

function listToLines(value: string[]): string {
  return value.join("\n");
}

function nonEmptyEntries<T extends object>(items: T[]): T[] {
  return items.filter((item) => Object.values(item).some((value) => typeof value === "string" && value.trim()));
}

export default function CvBuilderPage() {
  const { t, language } = useAppState();
  const [cv, setCv] = useState<CvData>(emptyCv);
  const [step, setStep] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [error, setError] = useState("");
  const [aiEnhanced, setAiEnhanced] = useState<boolean | undefined>();
  const [busy, setBusy] = useState<"generate" | "download" | null>(null);

  useEffect(() => {
    try {
      const savedProgress = localStorage.getItem(STORAGE_KEY);
      if (savedProgress) {
        const parsed: unknown = JSON.parse(savedProgress);
        if (isRecord(parsed) && isCvData(parsed.cv)) {
          setCv(parsed.cv);
          setStep(typeof parsed.step === "number" ? Math.min(Math.max(0, parsed.step), steps.length - 1) : 0);
          setSaved(true);
        } else {
          setSaveError(t("cvSavedProgressInvalid"));
        }
      }
    } catch {
      setSaveError(t("cvSaveError"));
    }
    setLoaded(true);
  }, []);

  const completedAnswers = useMemo(
    () => steps.slice(0, -1).filter((item) => sectionSummary(item.key, cv, "")).length,
    [cv],
  );
  const progress = Math.round((completedAnswers / (steps.length - 1)) * 100);
  const currentStep = steps[step];
  const StepIcon = currentStep.icon;

  function updateCv(update: (current: CvData) => CvData) {
    setCv(update);
    setSaved(false);
    setAiEnhanced(undefined);
    setError("");
  }

  function setText<K extends keyof CvData>(key: K, value: CvData[K]) {
    updateCv((current) => ({ ...current, [key]: value }));
  }

  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ cv, step }));
      setSaved(true);
      setSaveError("");
    } catch {
      setSaved(false);
      setSaveError(t("cvSaveError"));
    }
  }

  function continueToNextStep() {
    if (step === 0) {
      if (!cv.fullName.trim()) {
        setError(t("cvNameRequired"));
        return;
      }
      if (!cv.email.trim() && !cv.phone.trim()) {
        setError(t("cvContactRequired"));
        return;
      }
      if (cv.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cv.email)) {
        setError(t("cvEmailInvalid"));
        return;
      }
    }
    setError("");
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  async function generateCv() {
    if (!cv.fullName.trim()) {
      setError(t("cvNameRequired"));
      setStep(0);
      return;
    }
    if (!cv.email.trim() && !cv.phone.trim()) {
      setError(t("cvContactRequired"));
      setStep(0);
      return;
    }
    if (cv.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cv.email)) {
      setError(t("cvEmailInvalid"));
      setStep(0);
      return;
    }
    setBusy("generate");
    setError("");
    try {
      const response = await improveCv(cv, language as CvLanguageCode);
      setCv(response.data.cv);
      setAiEnhanced(response.data.aiEnhanced);
      setSaved(false);
    } catch (requestError) {
      setError(getUserFacingErrorMessage(requestError, t("cvGenerateError")));
    } finally {
      setBusy(null);
    }
  }

  async function downloadCv() {
    setBusy("download");
    setError("");
    try {
      const blob = await downloadCvDocument(cv, language as CvLanguageCode);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ROI-CV-${cv.fullName.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "resume"}.docx`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(getUserFacingErrorMessage(requestError, t("cvDownloadError")));
    } finally {
      setBusy(null);
    }
  }

  function editSection(index: number) {
    setStep(index);
    setAiEnhanced(undefined);
  }

  const conversationalHistory = steps.slice(0, step).map((item) => ({
    title: t(item.key),
    answer: sectionSummary(item.key, cv, t("cvNotProvided")),
  })).filter((item) => item.answer);

  return (
    <div className="cv-builder content-page">
      <header className="cv-builder-intro">
        <span className="eyebrow"><Sparkles size={14} /> {t("cvEyebrow")}</span>
        <h1>{t("cvTitle")}</h1>
        <p>{t("cvIntroduction")}</p>
        <p className="cv-privacy-note">{t("cvPrivacy")}</p>
      </header>

      <div className="cv-progress" aria-label={t("cvProgressLabel")}>
        <div className="cv-progress-heading">
          <strong>{t("cvProgressLabel")}</strong>
          <span>{t("cvCompletionCount", { completed: completedAnswers, total: steps.length - 1 })}</span>
        </div>
        <div className="cv-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <span style={{ width: `${progress}%` }} />
        </div>
        <ol className="cv-step-indicators">
          {steps.map((item, index) => (
            <li key={item.key}>
              <button
                type="button"
                aria-label={t(item.key)}
                aria-current={index === step ? "step" : undefined}
                className={index === step ? "active" : index < steps.length - 1 && sectionSummary(item.key, cv, "") ? "complete" : ""}
                onClick={() => setStep(index)}
              >
                {index < step ? <Check size={13} /> : index + 1}
              </button>
            </li>
          ))}
        </ol>
      </div>

      <div className="cv-builder-layout">
        <section className="cv-conversation" aria-labelledby="cv-question-title">
          <div className="cv-chat-history" aria-live="polite">
            {conversationalHistory.slice(-3).map((item) => (
              <div className="cv-chat-turn" key={item.title}>
                <p className="cv-chat-question">{item.title}</p>
                <p className="cv-chat-answer">{item.answer}</p>
              </div>
            ))}
            <div className="cv-current-question">
              <span className="cv-question-icon"><StepIcon size={18} /></span>
              <div>
                <span className="cv-question-eyebrow">{t(currentStep.key)}</span>
                <h2 id="cv-question-title">{t(currentStep.prompt)}</h2>
                {step === 0 && <p>{t("cvContactHint")}</p>}
                {step === 2 && <p>{t("cvEducationHint")}</p>}
                {step === 3 && <p>{t("cvExperienceHint")}</p>}
                {step === 4 && <p>{t("cvProjectsHint")}</p>}
                {step === 5 && <p>{t("cvSkillsHint")}</p>}
              </div>
            </div>
          </div>

          <div className="cv-answer-panel">
            {!loaded ? <p>{t("cvLoading")}</p> : (
              <>
                {step === 0 && <div className="cv-field-grid">
                  <TextField label={t("cvFullName")} value={cv.fullName} onChange={(value) => setText("fullName", value)} autoComplete="name" required />
                  <TextField label={t("cvEmail")} value={cv.email} onChange={(value) => setText("email", value)} type="email" autoComplete="email" />
                  <TextField label={t("cvPhone")} value={cv.phone} onChange={(value) => setText("phone", value)} type="tel" autoComplete="tel" />
                  <TextField label={t("cvLocation")} value={cv.location} onChange={(value) => setText("location", value)} autoComplete="address-level2" />
                </div>}
                {step === 1 && <div className="cv-field-grid">
                  <TextAreaField label={t("cvSummary")} value={cv.summary} onChange={(value) => setText("summary", value)} rows={4} />
                  <TextAreaField label={t("cvObjective")} value={cv.objective} onChange={(value) => setText("objective", value)} rows={3} />
                </div>}
                {step === 2 && <EntryList<CvEducation>
                  items={cv.education}
                  create={() => ({ qualification: "", institution: "", dates: "", details: "" })}
                  onChange={(education) => setText("education", education)}
                  render={(entry, update) => <div className="cv-entry-fields">
                    <TextField label={t("cvQualification")} value={entry.qualification} onChange={(qualification) => update({ ...entry, qualification })} />
                    <TextField label={t("cvInstitution")} value={entry.institution} onChange={(institution) => update({ ...entry, institution })} />
                    <TextField label={t("cvDates")} value={entry.dates} onChange={(dates) => update({ ...entry, dates })} placeholder={t("cvDatesExample")} />
                    <TextAreaField label={t("cvRelevantDetails")} value={entry.details} onChange={(details) => update({ ...entry, details })} rows={2} />
                  </div>}
                  addLabel={t("cvAddEducation")}
                  removeLabel={t("cvRemove")}
                  emptyLabel={t("cvNoEducation")}
                />}
                {step === 3 && <EntryList<CvExperience>
                  items={cv.experience}
                  create={() => ({ position: "", organization: "", dates: "", responsibilities: "", achievements: "" })}
                  onChange={(experience) => setText("experience", experience)}
                  render={(entry, update, index) => <div className="cv-entry-fields">
                    <span className="cv-entry-number">{t("cvExperienceNumber", { number: index + 1 })}</span>
                    <TextField label={t("cvPosition")} value={entry.position} onChange={(position) => update({ ...entry, position })} />
                    <TextField label={t("cvOrganization")} value={entry.organization} onChange={(organization) => update({ ...entry, organization })} />
                    <TextField label={t("cvDates")} value={entry.dates} onChange={(dates) => update({ ...entry, dates })} placeholder={t("cvDatesExample")} />
                    <TextAreaField label={t("cvResponsibilities")} value={entry.responsibilities} onChange={(responsibilities) => update({ ...entry, responsibilities })} rows={3} />
                    <TextAreaField label={t("cvAchievements")} value={entry.achievements} onChange={(achievements) => update({ ...entry, achievements })} rows={2} hint={t("cvAchievementsHint")} />
                  </div>}
                  addLabel={t("cvAddExperience")}
                  removeLabel={t("cvRemove")}
                  emptyLabel={t("cvNoExperience")}
                />}
                {step === 4 && <EntryList<CvProject>
                  items={cv.projects}
                  create={() => ({ name: "", description: "", details: "" })}
                  onChange={(projects) => setText("projects", projects)}
                  render={(entry, update) => <div className="cv-entry-fields">
                    <TextField label={t("cvProjectName")} value={entry.name} onChange={(name) => update({ ...entry, name })} />
                    <TextField label={t("cvProjectContext")} value={entry.description} onChange={(description) => update({ ...entry, description })} />
                    <TextAreaField label={t("cvProjectContribution")} value={entry.details} onChange={(details) => update({ ...entry, details })} rows={3} hint={t("cvAchievementsHint")} />
                  </div>}
                  addLabel={t("cvAddProject")}
                  removeLabel={t("cvRemove")}
                  emptyLabel={t("cvNoProjects")}
                />}
                {step === 5 && <TextAreaField
                  label={t("cvSkills")}
                  value={listToLines(cv.skills)}
                  onChange={(value) => setText("skills", linesToList(value))}
                  rows={5}
                  hint={t("cvSkillsHint")}
                />}
                {step === 6 && <EntryList<CvCertification>
                  items={cv.certifications}
                  create={() => ({ name: "", provider: "", date: "" })}
                  onChange={(certifications) => setText("certifications", certifications)}
                  render={(entry, update) => <div className="cv-entry-fields cv-entry-fields-three">
                    <TextField label={t("cvCertificationName")} value={entry.name} onChange={(name) => update({ ...entry, name })} />
                    <TextField label={t("cvProvider")} value={entry.provider} onChange={(provider) => update({ ...entry, provider })} />
                    <TextField label={t("cvDate")} value={entry.date} onChange={(date) => update({ ...entry, date })} />
                  </div>}
                  addLabel={t("cvAddCertification")}
                  removeLabel={t("cvRemove")}
                  emptyLabel={t("cvNoCertifications")}
                />}
                {step === 7 && <EntryList<CvLanguage>
                  items={cv.languages}
                  create={() => ({ name: "", proficiency: "" })}
                  onChange={(languages) => setText("languages", languages)}
                  render={(entry, update) => <div className="cv-entry-fields cv-entry-fields-two">
                    <TextField label={t("cvLanguage")} value={entry.name} onChange={(name) => update({ ...entry, name })} />
                    <TextField label={t("cvProficiency")} value={entry.proficiency} onChange={(proficiency) => update({ ...entry, proficiency })} placeholder={t("cvProficiencyExample")} />
                  </div>}
                  addLabel={t("cvAddLanguage")}
                  removeLabel={t("cvRemove")}
                  emptyLabel={t("cvNoLanguages")}
                />}
                {step === 8 && <div className="cv-field-grid">
                  <TextAreaField label={t("cvOtherAchievements")} value={listToLines(cv.achievements)} onChange={(value) => setText("achievements", linesToList(value))} rows={3} hint={t("cvListHint")} />
                  <TextAreaField label={t("cvVolunteering")} value={cv.volunteering} onChange={(value) => setText("volunteering", value)} rows={3} />
                </div>}
                {step === 9 && <CvReview
                  cv={cv}
                  t={t}
                  aiEnhanced={aiEnhanced}
                  onEdit={editSection}
                  onGenerate={generateCv}
                  onDownload={downloadCv}
                  onSave={saveProgress}
                  saved={saved}
                  busy={busy}
                />}

                {error && <p className="cv-message cv-message-error" role="alert">{error}</p>}
                {saveError && <p className="cv-message cv-message-error" role="alert">{saveError}</p>}
                {saveError && loaded && <button className="cv-text-action" type="button" onClick={saveProgress}>{t("cvRetrySave")}</button>}
                {step < 9 && <div className="cv-actions">
                  <div className="cv-actions-left">
                    {step > 0 && <button className="cv-button cv-button-secondary" type="button" onClick={() => setStep((current) => Math.max(0, current - 1))}><ArrowLeft size={15} /> {t("cvBack")}</button>}
                    {step > 1 && step !== 8 && <button className="cv-text-action" type="button" onClick={() => setStep((current) => Math.min(current + 1, steps.length - 1))}>{t("cvSkip")}</button>}
                  </div>
                  <div className="cv-actions-right">
                    <button className="cv-button cv-button-secondary" type="button" onClick={saveProgress}>{saved ? <Check size={15} /> : null}{saved ? t("cvSaved") : t("cvSaveProgress")}</button>
                    <button className="cv-button cv-button-primary" type="button" onClick={continueToNextStep}>{t("cvContinue")} <ArrowRight size={15} /></button>
                  </div>
                </div>}
              </>
            )}
          </div>
        </section>

        <CvPreview cv={cv} t={t} onEdit={editSection} />
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, type = "text", required = false, autoComplete, placeholder }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  placeholder?: string;
}) {
  return <label className="cv-field">{label}{required && <span aria-hidden="true"> *</span>}
    <input type={type} required={required} value={value} autoComplete={autoComplete} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
  </label>;
}

function TextAreaField({ label, value, onChange, rows = 3, hint }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  hint?: string;
}) {
  return <label className="cv-field">{label}
    <textarea value={value} rows={rows} onChange={(event) => onChange(event.target.value)} />
    {hint && <small>{hint}</small>}
  </label>;
}

function EntryList<T extends object>({ items, create, onChange, render, addLabel, removeLabel, emptyLabel }: {
  items: T[];
  create: () => T;
  onChange: (items: T[]) => void;
  render: (item: T, update: (item: T) => void, index: number) => ReactNode;
  addLabel: string;
  removeLabel: string;
  emptyLabel: string;
}) {
  function updateAt(index: number, item: T) {
    onChange(items.map((current, itemIndex) => itemIndex === index ? item : current));
  }

  return <div className="cv-entry-list">
    {items.length === 0 && <p className="cv-empty-note">{emptyLabel}</p>}
    {items.map((item, index) => (
      <fieldset className="cv-entry-card" key={index}>
        <legend>{index + 1}</legend>
        {render(item, (updated) => updateAt(index, updated), index)}
        <button className="cv-remove-entry" type="button" onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}>
          <Trash2 size={14} /> {removeLabel}
        </button>
      </fieldset>
    ))}
    <button className="cv-add-entry" type="button" onClick={() => onChange([...items, create()])}><Plus size={15} /> {addLabel}</button>
  </div>;
}

function sectionSummary(step: StepKey, cv: CvData, notProvided: string): string {
  const summaries: Record<StepKey, string> = {
    cvStepContact: cv.fullName ? [cv.fullName, cv.email, cv.phone, cv.location].filter(Boolean).join(" · ") : "",
    cvStepProfile: [cv.summary, cv.objective].filter(Boolean).join(" "),
    cvStepEducation: cv.education.map((item) => [item.qualification, item.institution].filter(Boolean).join(" · ")).filter(Boolean).join(", "),
    cvStepExperience: cv.experience.map((item) => [item.position, item.organization].filter(Boolean).join(" · ")).filter(Boolean).join(", "),
    cvStepProjects: cv.projects.map((item) => item.name).filter(Boolean).join(", "),
    cvStepSkills: cv.skills.join(", "),
    cvStepCertifications: cv.certifications.map((item) => item.name).filter(Boolean).join(", "),
    cvStepLanguages: cv.languages.map((item) => [item.name, item.proficiency].filter(Boolean).join(" · ")).filter(Boolean).join(", "),
    cvStepAdditional: [...cv.achievements, cv.volunteering].filter(Boolean).join(" · "),
    cvStepReview: "",
  };
  const answer = summaries[step].trim();
  return answer || notProvided;
}

function CvPreview({ cv, t, onEdit }: { cv: CvData; t: (key: TranslationKey, values?: Record<string, string | number>) => string; onEdit: (step: number) => void }) {
  const sections: { title: string; step: number; content: ReactNode }[] = [
    { title: t("cvProfileSection"), step: 1, content: cv.summary || cv.objective ? <>{cv.summary && <p>{cv.summary}</p>}{cv.objective && <p>{cv.objective}</p>}</> : null },
    { title: t("cvEducationSection"), step: 2, content: nonEmptyEntries(cv.education).map((item, index) => <PreviewEntry key={index} title={item.qualification} subtitle={item.institution} dates={item.dates} details={item.details} />) },
    { title: t("cvExperienceSection"), step: 3, content: nonEmptyEntries(cv.experience).map((item, index) => <PreviewEntry key={index} title={item.position} subtitle={item.organization} dates={item.dates} details={[item.responsibilities, item.achievements].filter(Boolean).join("\n")} />) },
    { title: t("cvProjectsSection"), step: 4, content: nonEmptyEntries(cv.projects).map((item, index) => <PreviewEntry key={index} title={item.name} subtitle={item.description} details={item.details} />) },
    { title: t("cvSkillsSection"), step: 5, content: cv.skills.length ? <div className="cv-preview-skills">{cv.skills.map((skill) => <span key={skill}>{skill}</span>)}</div> : null },
    { title: t("cvCertificationsSection"), step: 6, content: nonEmptyEntries(cv.certifications).map((item, index) => <PreviewEntry key={index} title={item.name} subtitle={item.provider} dates={item.date} />) },
    { title: t("cvLanguagesSection"), step: 7, content: nonEmptyEntries(cv.languages).map((item, index) => <PreviewEntry key={index} title={item.name} subtitle={item.proficiency} />) },
    { title: t("cvAdditionalSection"), step: 8, content: cv.achievements.length || cv.volunteering ? <>{cv.achievements.map((item, index) => <p key={`achievement-${index}`}>{item}</p>)}{cv.volunteering && <p>{cv.volunteering}</p>}</> : null },
  ];

  return <aside className="cv-preview-panel" aria-label={t("cvPreview")}>
    <div className="cv-preview-heading">
      <div><span className="cv-preview-label">{t("cvPreview")}</span><h2>{t("cvLivePreview")}</h2></div>
      <span className="cv-paper-icon"><GraduationCap size={18} /></span>
    </div>
    <article className="cv-paper">
      <header className="cv-paper-header">
        <h3>{cv.fullName || t("cvYourName")}</h3>
        <p>{[cv.email, cv.phone, cv.location].filter(Boolean).join(" · ") || t("cvContactDetails")}</p>
      </header>
      {sections.map((section) => (
        <section className="cv-paper-section" key={section.title}>
          <div className="cv-paper-section-title">
            <h4>{section.title}</h4>
            <button type="button" onClick={() => onEdit(section.step)} aria-label={`${t("cvEdit")} ${section.title}`}>{t("cvEdit")}</button>
          </div>
          {section.content || <p className="cv-paper-placeholder">{t("cvPreviewPlaceholder")}</p>}
        </section>
      ))}
    </article>
    <p className="cv-preview-footnote">{t("cvPreviewNote")}</p>
  </aside>;
}

function PreviewEntry({ title, subtitle, dates, details }: { title: string; subtitle?: string; dates?: string; details?: string }) {
  return <div className="cv-preview-entry">
    <div><strong>{title || "—"}</strong>{dates && <span>{dates}</span>}</div>
    {subtitle && <p>{subtitle}</p>}
    {details && <p className="cv-preview-details">{details}</p>}
  </div>;
}

function CvReview({ cv, t, aiEnhanced, onEdit, onGenerate, onDownload, onSave, saved, busy }: {
  cv: CvData;
  t: (key: TranslationKey, values?: Record<string, string | number>) => string;
  aiEnhanced: boolean | undefined;
  onEdit: (step: number) => void;
  onGenerate: () => void;
  onDownload: () => void;
  onSave: () => void;
  saved: boolean;
  busy: "generate" | "download" | null;
}) {
  return <section className="cv-review-section">
    <div className="cv-review-intro">
      <Sparkles size={18} />
      <div><h3>{t("cvReviewTitle")}</h3><p>{t("cvReviewHint")}</p></div>
    </div>
    {aiEnhanced === true && <p className="cv-ai-status enhanced" role="status">{t("cvAIEnhanced")}</p>}
    <div className="cv-review-actions">
      <button className="cv-button cv-button-secondary" type="button" onClick={onSave}>{saved ? <Check size={15} /> : null}{saved ? t("cvSaved") : t("cvSaveProgress")}</button>
      <button className="cv-button cv-button-primary" type="button" onClick={onGenerate} disabled={busy !== null || !cv.fullName.trim()}>
        <Sparkles size={15} /> {busy === "generate" ? t("cvGenerating") : t("cvGenerate")}
      </button>
      {aiEnhanced !== undefined && <button className="cv-button cv-button-secondary" type="button" onClick={onDownload} disabled={busy !== null}>
        <Download size={15} /> {busy === "download" ? t("cvDownloading") : t("cvDownloadWord")}
      </button>}
    </div>
    <p className="cv-review-tip">{t("cvFactCheck")}</p>
    <button className="cv-text-action" type="button" onClick={() => onEdit(0)}>{t("cvEditDetails")}</button>
  </section>;
}
