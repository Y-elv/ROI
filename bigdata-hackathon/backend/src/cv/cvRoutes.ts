import { AlignmentType, BorderStyle, Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { Request, Response, Router } from "express";

type Language = "en" | "rw" | "fr";

interface CvEducation {
  qualification: string;
  institution: string;
  dates: string;
  details: string;
}

interface CvExperience {
  position: string;
  organization: string;
  dates: string;
  responsibilities: string;
  achievements: string;
}

interface CvProject {
  name: string;
  description: string;
  details: string;
}

interface CvCertification {
  name: string;
  provider: string;
  date: string;
}

interface CvLanguage {
  name: string;
  proficiency: string;
}

interface CvData {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
  objective: string;
  education: CvEducation[];
  experience: CvExperience[];
  projects: CvProject[];
  skills: string[];
  certifications: CvCertification[];
  languages: CvLanguage[];
  achievements: string[];
  volunteering: string;
}

const languageNames: Record<Language, string> = {
  en: "English",
  rw: "Kinyarwanda",
  fr: "French",
};

const documentLabels: Record<Language, Record<string, string>> = {
  en: {
    profile: "PROFILE", objective: "CAREER OBJECTIVE", experience: "WORK EXPERIENCE",
    education: "EDUCATION", projects: "PROJECTS", skills: "SKILLS",
    certifications: "CERTIFICATIONS & TRAINING", languages: "LANGUAGES",
    achievements: "ACHIEVEMENTS", volunteering: "VOLUNTEERING & COMMUNITY EXPERIENCE",
  },
  rw: {
    profile: "UMWIRONDORO", objective: "INTEGO Z'UMWUGA", experience: "UBURAMBE MU KAZI",
    education: "AMASHURI", projects: "IMISHINGA", skills: "UBUMENYI",
    certifications: "IMPAMYABUMENYI N'AMAHUGURWA", languages: "INDIMI",
    achievements: "IBYO WAGEZEHO", volunteering: "UBUKORANABUSHake N'IBIKORWA BY'ABATURAGE",
  },
  fr: {
    profile: "PROFIL", objective: "OBJECTIF PROFESSIONNEL", experience: "EXPÉRIENCE PROFESSIONNELLE",
    education: "FORMATION", projects: "PROJETS", skills: "COMPÉTENCES",
    certifications: "CERTIFICATIONS ET FORMATIONS", languages: "LANGUES",
    achievements: "RÉALISATIONS", volunteering: "BÉNÉVOLAT ET ENGAGEMENT COMMUNAUTAIRE",
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(value: unknown, field: string, errors: string[]): string {
  if (value === undefined) return "";
  if (typeof value !== "string") {
    errors.push(`${field} must be text.`);
    return "";
  }
  if (value.length > 6000) errors.push(`${field} must be 6000 characters or fewer.`);
  return value.trim();
}

function readObjectList<T extends object>(
  value: unknown,
  field: string,
  keys: (keyof T & string)[],
  errors: string[],
): T[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 30) {
    errors.push(`${field} must be a list with no more than 30 entries.`);
    return [];
  }
  return value.map((entry, index) => {
    if (!isRecord(entry)) {
      errors.push(`${field}[${index}] must be an object.`);
      return Object.fromEntries(keys.map((key) => [key, ""])) as T;
    }
    return Object.fromEntries(keys.map((key) => [
      key,
      readText(entry[String(key)], `${field}[${index}].${String(key)}`, errors),
    ])) as T;
  });
}

function readTextList(value: unknown, field: string, errors: string[]): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 100) {
    errors.push(`${field} must be a list with no more than 100 entries.`);
    return [];
  }
  return value.map((entry, index) => readText(entry, `${field}[${index}]`, errors));
}

function parseCv(value: unknown): { cv?: CvData; errors: string[] } {
  const errors: string[] = [];
  if (!isRecord(value)) return { errors: ["cv must be an object."] };
  const cv: CvData = {
    fullName: readText(value.fullName, "fullName", errors),
    email: readText(value.email, "email", errors),
    phone: readText(value.phone, "phone", errors),
    location: readText(value.location, "location", errors),
    summary: readText(value.summary, "summary", errors),
    objective: readText(value.objective, "objective", errors),
    education: readObjectList<CvEducation>(value.education, "education", ["qualification", "institution", "dates", "details"], errors),
    experience: readObjectList<CvExperience>(value.experience, "experience", ["position", "organization", "dates", "responsibilities", "achievements"], errors),
    projects: readObjectList<CvProject>(value.projects, "projects", ["name", "description", "details"], errors),
    skills: readTextList(value.skills, "skills", errors),
    certifications: readObjectList<CvCertification>(value.certifications, "certifications", ["name", "provider", "date"], errors),
    languages: readObjectList<CvLanguage>(value.languages, "languages", ["name", "proficiency"], errors),
    achievements: readTextList(value.achievements, "achievements", errors),
    volunteering: readText(value.volunteering, "volunteering", errors),
  };
  if (!cv.fullName) errors.push("fullName is required.");
  if (!cv.email && !cv.phone) errors.push("Provide at least an email address or phone number.");
  if (cv.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cv.email)) errors.push("email must be a valid email address.");
  return { cv, errors };
}

function readLanguage(value: unknown): Language | null {
  return value === "en" || value === "rw" || value === "fr" ? value : null;
}

function getAiConfiguration(): { apiKey: string; url: string; model: string } | null {
  const apiKey = process.env.AI_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    url: process.env.AI_API_URL?.trim() || "https://api.openai.com/v1/chat/completions",
    model: process.env.AI_MODEL?.trim() || "gpt-4o-mini",
  };
}

function parseAiJson(content: string): unknown {
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(trimmed) as unknown;
}

function preservesFacts(original: CvData, improved: CvData): boolean {
  const identityFields: (keyof CvData)[] = ["fullName", "email", "phone", "location"];
  if (identityFields.some((field) => original[field] !== improved[field])) return false;

  const sameEntryFields = <T extends object>(left: T[], right: T[], fields: (keyof T)[]) =>
    left.length === right.length && left.every((entry, index) =>
      fields.every((field) => entry[field] === right[index][field]));

  return original.skills.length === improved.skills.length &&
    original.skills.every((skill, index) => skill === improved.skills[index]) &&
    sameEntryFields(original.education, improved.education, ["qualification", "institution", "dates"]) &&
    sameEntryFields(original.experience, improved.experience, ["position", "organization", "dates"]) &&
    sameEntryFields(original.projects, improved.projects, ["name"]) &&
    sameEntryFields(original.certifications, improved.certifications, ["name", "provider", "date"]) &&
    sameEntryFields(original.languages, improved.languages, ["name", "proficiency"]);
}

async function enhanceCv(cv: CvData, language: Language): Promise<CvData> {
  const configuration = getAiConfiguration();
  if (!configuration) return cv;

  const response = await fetch(configuration.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${configuration.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: configuration.model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a careful CV editor. Improve grammar, clarity, structure and ATS readability in ${languageNames[language]}. Return only a JSON object with the exact input CV fields and types. Use only facts in the input. Never add, infer or embellish qualifications, employers, responsibilities, skills, dates, achievements, numbers, contact details or proficiency. Keep identity fields, item counts and factual labels exactly unchanged. Rewrite only existing narrative text; if a narrative is empty, keep it empty. Keep the same language as the user's original text for each field.`,
        },
        { role: "user", content: JSON.stringify(cv) },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) throw new Error(`AI provider request failed with HTTP ${response.status}.`);
  const payload: unknown = await response.json();
  if (!isRecord(payload) || !Array.isArray(payload.choices) || !isRecord(payload.choices[0]) ||
      !isRecord(payload.choices[0].message) || typeof payload.choices[0].message.content !== "string") {
    throw new Error("AI provider returned an unsupported response.");
  }
  const choices = payload.choices;
  const choice = choices[0];
  if (!isRecord(choice) || !isRecord(choice.message) || typeof choice.message.content !== "string") {
    throw new Error("AI provider returned an unsupported response.");
  }
  const parsed = parseAiJson(choice.message.content);
  const { cv: improved, errors } = parseCv(parsed);
  if (!improved || errors.length || !preservesFacts(cv, improved)) {
    throw new Error("AI output did not pass CV structure and factual-preservation checks.");
  }
  return improved;
}

type ParagraphConfiguration = Extract<NonNullable<ConstructorParameters<typeof Paragraph>[0]>, object>;
type ParagraphOptions = Pick<ParagraphConfiguration, "heading" | "alignment" | "spacing" | "border">;

function paragraph(text: string, options: ParagraphOptions = {}): Paragraph {
  return new Paragraph({
    text,
    heading: options.heading,
    alignment: options.alignment,
    spacing: options.spacing,
    border: options.border,
  });
}

function richParagraph(options: ConstructorParameters<typeof Paragraph>[0]): Paragraph {
  return new Paragraph(options);
}

function heading(text: string): Paragraph {
  return paragraph(text, {
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 240, after: 100 },
    border: { bottom: { color: "D7E4EF", style: BorderStyle.SINGLE, size: 4, space: 3 } },
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    text,
    bullet: { level: 0 },
    spacing: { after: 55 },
  });
}

function addLine(lines: Paragraph[], text: string): void {
  if (text.trim()) lines.push(paragraph(text.trim(), { spacing: { after: 90 } }));
}

function buildCvDocument(cv: CvData, language: Language): Document {
  const labels = documentLabels[language];
  const body: Paragraph[] = [
    paragraph(cv.fullName, {
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 90 },
    }),
    paragraph([cv.email, cv.phone, cv.location].filter(Boolean).join("  |  "), {
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
    }),
  ];

  if (cv.summary) body.push(heading(labels.profile), paragraph(cv.summary, { spacing: { after: 100 } }));
  if (cv.objective) body.push(heading(labels.objective), paragraph(cv.objective, { spacing: { after: 100 } }));

  const experiences = cv.experience.filter((item) => Object.values(item).some(Boolean));
  if (experiences.length) {
    body.push(heading(labels.experience));
    for (const item of experiences) {
      const employmentRuns = [new TextRun({ text: [item.position, item.organization].filter(Boolean).join(" · "), bold: true })];
      if (item.dates) employmentRuns.push(new TextRun({ text: `\t${item.dates}` }));
      body.push(richParagraph({
        children: employmentRuns,
        tabStops: [{ type: "right", position: 9000 }],
        spacing: { before: 100, after: 45 },
      }));
      for (const line of [...item.responsibilities.split("\n"), ...item.achievements.split("\n")].map((value) => value.trim()).filter(Boolean)) body.push(bullet(line));
    }
  }

  const education = cv.education.filter((item) => Object.values(item).some(Boolean));
  if (education.length) {
    body.push(heading(labels.education));
    for (const item of education) {
      addLine(body, [item.qualification, item.institution, item.dates].filter(Boolean).join(" · "));
      for (const line of item.details.split("\n").map((value) => value.trim()).filter(Boolean)) body.push(bullet(line));
    }
  }

  const projects = cv.projects.filter((item) => Object.values(item).some(Boolean));
  if (projects.length) {
    body.push(heading(labels.projects));
    for (const item of projects) {
      addLine(body, [item.name, item.description].filter(Boolean).join(" · "));
      for (const line of item.details.split("\n").map((value) => value.trim()).filter(Boolean)) body.push(bullet(line));
    }
  }

  if (cv.skills.length) body.push(heading(labels.skills), paragraph(cv.skills.join("  ·  "), { spacing: { after: 100 } }));

  const certifications = cv.certifications.filter((item) => Object.values(item).some(Boolean));
  if (certifications.length) {
    body.push(heading(labels.certifications));
    for (const item of certifications) addLine(body, [item.name, item.provider, item.date].filter(Boolean).join(" · "));
  }

  const languages = cv.languages.filter((item) => Object.values(item).some(Boolean));
  if (languages.length) {
    body.push(heading(labels.languages));
    for (const item of languages) addLine(body, [item.name, item.proficiency].filter(Boolean).join(" · "));
  }

  if (cv.achievements.length) {
    body.push(heading(labels.achievements));
    for (const achievement of cv.achievements.filter(Boolean)) body.push(bullet(achievement));
  }
  if (cv.volunteering) body.push(heading(labels.volunteering), paragraph(cv.volunteering, { spacing: { after: 100 } }));

  return new Document({
    creator: "Rwanda Opportunity Intelligence",
    title: `${cv.fullName} - CV`,
    description: "User-provided CV content formatted by Rwanda Opportunity Intelligence.",
    styles: {
      default: {
        document: { run: { font: "Arial", size: 20, color: "1E293B" }, paragraph: { spacing: { after: 70 } } },
      },
      paragraphStyles: [
        {
          id: "Title",
          name: "Title",
          basedOn: "Normal",
          next: "Normal",
          run: { font: "Arial", size: 32, bold: true, color: "005CAB" },
          paragraph: { alignment: AlignmentType.CENTER, spacing: { after: 90 } },
        },
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: "Arial", size: 22, bold: true, color: "005CAB" },
          paragraph: { spacing: { before: 240, after: 100 }, keepNext: true },
        },
      ],
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 850, right: 900, bottom: 850, left: 900 },
        },
      },
      children: body,
    }],
  });
}

function errorResponse(res: Response, status: number, code: string, message: string): void {
  res.status(status).json({ success: false, error: { code, message } });
}

export function createCvRouter(): Router {
  const router = Router();

  /**
   * @openapi
   * /api/v1/cv/improve:
   *   post:
   *     summary: Improve supplied CV wording without adding personal facts
   *     tags: [CV]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [cv, language]
   *             properties:
   *               cv: { type: object, description: User-provided CV content }
   *               language: { type: string, enum: [en, rw, fr] }
   *     responses:
   *       200: { description: Improved CV or unchanged CV when AI is not configured }
   *       400: { description: Invalid CV data }
   *       502: { description: AI provider failure or unsafe AI output }
   */
  router.post("/improve", async (req: Request, res: Response) => {
    const language = readLanguage(req.body?.language);
    const { cv, errors } = parseCv(req.body?.cv);
    if (!language) errors.push("language must be en, rw, or fr.");
    if (errors.length || !cv || !language) {
      errorResponse(res, 400, "INVALID_CV", errors.join(" "));
      return;
    }

    try {
      const aiEnhanced = Boolean(getAiConfiguration());
      const improved = aiEnhanced ? await enhanceCv(cv, language) : cv;
      res.json({ success: true, data: { cv: improved, aiEnhanced } });
    } catch {
      console.error("[CV] AI improvement failed.");
      errorResponse(res, 502, "CV_AI_FAILED", "AI improvement failed. Your original CV answers are unchanged; retry or export without AI.");
    }
  });

  /**
   * @openapi
   * /api/v1/cv/docx:
   *   post:
   *     summary: Generate a genuine downloadable Word CV
   *     tags: [CV]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [cv, language]
   *             properties:
   *               cv: { type: object, description: Reviewed CV content }
   *               language: { type: string, enum: [en, rw, fr] }
   *     responses:
   *       200:
   *         description: Microsoft Word Open XML document
   *         content:
   *           application/vnd.openxmlformats-officedocument.wordprocessingml.document:
   *             schema: { type: string, format: binary }
   *       400: { description: Invalid CV data }
   */
  router.post("/docx", async (req: Request, res: Response) => {
    const language = readLanguage(req.body?.language);
    const { cv, errors } = parseCv(req.body?.cv);
    if (!language) errors.push("language must be en, rw, or fr.");
    if (errors.length || !cv || !language) {
      errorResponse(res, 400, "INVALID_CV", errors.join(" "));
      return;
    }

    try {
      const document = buildCvDocument(cv, language);
      const buffer = await Packer.toBuffer(document);
      const name = cv.fullName.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "resume";
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="ROI-CV-${name}.docx"`);
      res.setHeader("Cache-Control", "no-store");
      res.status(200).send(buffer);
    } catch {
      console.error("[CV] DOCX generation failed.");
      errorResponse(res, 500, "CV_DOCX_FAILED", "Unable to generate the Word document.");
    }
  });

  return router;
}
