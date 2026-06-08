import { ProfileForm } from "@/components/profile/ProfileForm";
import { emptyProfileFormValues, userProfileToFormValues } from "@/lib/profile-form";
import { getUserProfile } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const profile = await getUserProfile();
  const initialValues = profile ? userProfileToFormValues(profile) : emptyProfileFormValues();

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Profile</h1>
        <p className="text-slate-600">
          Store your base profile and resume data for future matching and packet generation.
        </p>
      </div>
      <ProfileForm initialValues={initialValues} />
    </section>
  );
}
