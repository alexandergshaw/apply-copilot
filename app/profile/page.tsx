import { ProfileForm } from "@/components/ProfileForm";
import { profile } from "@/lib/mock-data";

export default function ProfilePage() {
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Profile</h1>
        <p className="text-slate-600">Set your target role preferences and core application materials.</p>
      </div>
      <ProfileForm initialProfile={profile} />
    </section>
  );
}
