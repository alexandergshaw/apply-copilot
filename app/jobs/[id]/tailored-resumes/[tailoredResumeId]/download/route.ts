import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase/server";

type RouteParams = {
  params: Promise<{
    id: string;
    tailoredResumeId: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteParams): Promise<Response> {
  const { id, tailoredResumeId } = await params;

  const jobId = Number.parseInt(id, 10);
  const resumeId = Number.parseInt(tailoredResumeId, 10);

  if (Number.isNaN(jobId) || Number.isNaN(resumeId)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("tailored_resumes")
    .select("id, job_id, output_docx_storage_path")
    .eq("id", resumeId)
    .eq("job_id", jobId)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Tailored resume not found." }, { status: 404 });
  }

  if (!data.output_docx_storage_path) {
    return NextResponse.json({ error: "Tailored DOCX is not available." }, { status: 404 });
  }

  const { data: signed, error: signError } = await supabase.storage
    .from("tailored-resumes")
    .createSignedUrl(data.output_docx_storage_path, 60 * 30);

  if (signError || !signed?.signedUrl) {
    return NextResponse.json(
      { error: signError?.message ?? "Unable to create download URL." },
      { status: 500 },
    );
  }

  return NextResponse.redirect(signed.signedUrl);
}
