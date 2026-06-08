import {
  applications as mockApplications,
  jobSources as mockJobSources,
  jobs as mockJobs,
  profile as mockProfile,
  type Application,
  type Job,
  type JobSource,
  type Profile,
} from "@/lib/mock-data";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  mapApplication,
  mapJob,
  mapJobSource,
  mapProfile,
} from "@/lib/supabase/types";

/**
 * Server-side data access layer.
 *
 * Each function reads from Supabase when configured and falls back to the
 * local mock data when the Supabase environment variables are missing.
 */

export async function getJobs(): Promise<Job[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return mockJobs;
  }

  const { data, error } = await supabase
    .from("jobs")
    .select("*, job_sources(name)")
    .order("match_score", { ascending: false });

  if (error || !data) {
    return mockJobs;
  }

  return data.map((row) => mapJob(row));
}

export async function getJob(id: string): Promise<Job | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return mockJobs.find((job) => job.id === id) ?? null;
  }

  const numericId = Number.parseInt(id, 10);
  if (Number.isNaN(numericId)) {
    return null;
  }

  const { data, error } = await supabase
    .from("jobs")
    .select("*, job_sources(name), application_packets(*)")
    .eq("id", numericId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapJob(data);
}

export async function getApplications(): Promise<Application[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return mockApplications;
  }

  const { data, error } = await supabase
    .from("applications")
    .select("*, jobs(title, company)")
    .order("created_at", { ascending: false });

  if (error || !data) {
    return mockApplications;
  }

  return data.map((row) => mapApplication(row));
}

export async function getProfile(): Promise<Profile> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return mockProfile;
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return mockProfile;
  }

  return mapProfile(data);
}

export async function getProfileId(): Promise<string | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data.id;
}

export async function getJobSources(): Promise<JobSource[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return mockJobSources;
  }

  const { data, error } = await supabase
    .from("job_sources")
    .select("*")
    .order("id", { ascending: true });

  if (error || !data) {
    return mockJobSources;
  }

  return data.map((row) => mapJobSource(row));
}
