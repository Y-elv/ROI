export interface CvEducation {
  qualification: string;
  institution: string;
  dates: string;
  details: string;
}

export interface CvExperience {
  position: string;
  organization: string;
  dates: string;
  responsibilities: string;
  achievements: string;
}

export interface CvProject {
  name: string;
  description: string;
  details: string;
}

export interface CvCertification {
  name: string;
  provider: string;
  date: string;
}

export interface CvLanguage {
  name: string;
  proficiency: string;
}

export interface CvData {
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

export const emptyCv: CvData = {
  fullName: "",
  email: "",
  phone: "",
  location: "",
  summary: "",
  objective: "",
  education: [],
  experience: [],
  projects: [],
  skills: [],
  certifications: [],
  languages: [],
  achievements: [],
  volunteering: "",
};

export type CvLanguageCode = "en" | "rw" | "fr";

export interface CvImproveResponse {
  success: true;
  data: {
    cv: CvData;
    aiEnhanced: boolean;
    message?: string;
  };
}
