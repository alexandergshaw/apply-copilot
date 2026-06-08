import { ProfileForm } from "@/components/ProfileForm";
import { getProfile, getProfileId } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const [profile, profileId] = await Promise.all([getProfile(), getProfileId()]);

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Profile</h1>
        <p className="text-slate-600">Set your target role preferences and core application materials.</p>
      </div>
      <ProfileForm initialProfile={profile} profileId={profileId} />
    </section>
  );
}
