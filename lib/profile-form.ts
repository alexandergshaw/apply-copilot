import type { UserProfile } from "@/lib/supabase/types";

export type ProfileFormValues = {
  id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedinUrl: string;
  portfolioUrl: string;
  githubUrl: string;
  targetTitles: string;
  targetLocations: string;
  minSalary: string;
  remotePreference: string;
  skills: string;
  summary: string;
  resumeText: string;
  workHistory: string;
  education: string;
  certifications: string;
  projects: string;
  preferences: string;
};

export function toCommaSeparated(values: string[] | null | undefined): string {
  return (values ?? []).join(", ");
}

export function fromCommaSeparated(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function emptyProfileFormValues(): ProfileFormValues {
  return {
    id: "",
    name: "",
    email: "",
    phone: "",
    location: "",
    linkedinUrl: "",
    portfolioUrl: "",
    githubUrl: "",
    targetTitles: "",
    targetLocations: "",
    minSalary: "",
    remotePreference: "remote",
    skills: "",
    summary: "",
    resumeText: "",
    workHistory: "[]",
    education: "[]",
    certifications: "[]",
    projects: "[]",
    preferences: "{}",
  };
}

export function userProfileToFormValues(profile: UserProfile): ProfileFormValues {
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    phone: profile.phone,
    location: profile.location,
    linkedinUrl: profile.linkedinUrl,
    portfolioUrl: profile.portfolioUrl,
    githubUrl: profile.githubUrl,
    targetTitles: toCommaSeparated(profile.targetTitles),
    targetLocations: toCommaSeparated(profile.targetLocations),
    minSalary: profile.minSalary == null ? "" : String(profile.minSalary),
    remotePreference: profile.remotePreference || "remote",
    skills: toCommaSeparated(profile.skills),
    summary: profile.summary,
    resumeText: profile.resumeText,
    workHistory: JSON.stringify(profile.workHistory, null, 2),
    education: JSON.stringify(profile.education, null, 2),
    certifications: JSON.stringify(profile.certifications, null, 2),
    projects: JSON.stringify(profile.projects, null, 2),
    preferences: JSON.stringify(profile.preferences, null, 2),
  };
}

export function parseJsonObject(text: string, label: string): { value?: Record<string, unknown>; error?: string } {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { error: `${label} must be a JSON object.` };
    }
    return { value: parsed as Record<string, unknown> };
  } catch {
    return { error: `${label} contains invalid JSON.` };
  }
}

export function parseJsonArray(text: string, label: string): { value?: unknown[]; error?: string } {
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      return { error: `${label} must be a JSON array.` };
    }
    return { value: parsed };
  } catch {
    return { error: `${label} contains invalid JSON.` };
  }
}
