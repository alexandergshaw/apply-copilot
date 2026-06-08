"use client";

import { useState, useTransition } from "react";

import { updateProfile } from "@/lib/actions";
import type { Profile } from "@/lib/mock-data";

type ProfileFormProps = {
  initialProfile: Profile;
  profileId?: string | null;
};

export function ProfileForm({ initialProfile, profileId = null }: ProfileFormProps) {
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const saveProfile = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await updateProfile(profileId, profile);
      setMessage(result.ok ? "Profile saved." : result.message ?? "Unable to save profile.");
    });
  };

  return (
    <form className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Profile</h2>

      <label className="block text-sm text-slate-700">
        <span className="mb-1 block font-medium">Name</span>
        <input
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          type="text"
          value={profile.name}
          onChange={(event) => setProfile({ ...profile, name: event.target.value })}
        />
      </label>

      <label className="block text-sm text-slate-700">
        <span className="mb-1 block font-medium">Target titles</span>
        <input
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          type="text"
          value={profile.targetTitles}
          onChange={(event) => setProfile({ ...profile, targetTitles: event.target.value })}
        />
      </label>

      <label className="block text-sm text-slate-700">
        <span className="mb-1 block font-medium">Target locations</span>
        <input
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          type="text"
          value={profile.targetLocations}
          onChange={(event) => setProfile({ ...profile, targetLocations: event.target.value })}
        />
      </label>

      <label className="block text-sm text-slate-700">
        <span className="mb-1 block font-medium">Minimum salary</span>
        <input
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          type="number"
          value={profile.minimumSalary}
          onChange={(event) => setProfile({ ...profile, minimumSalary: event.target.value })}
        />
      </label>

      <label className="block text-sm text-slate-700">
        <span className="mb-1 block font-medium">Remote preference</span>
        <select
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          value={profile.remotePreference}
          onChange={(event) => setProfile({ ...profile, remotePreference: event.target.value as Profile["remotePreference"] })}
        >
          <option value="remote">Remote</option>
          <option value="hybrid">Hybrid</option>
          <option value="onsite">Onsite</option>
        </select>
      </label>

      <label className="block text-sm text-slate-700">
        <span className="mb-1 block font-medium">Skills</span>
        <textarea
          className="min-h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          value={profile.skills}
          onChange={(event) => setProfile({ ...profile, skills: event.target.value })}
        />
      </label>

      <label className="block text-sm text-slate-700">
        <span className="mb-1 block font-medium">Resume text</span>
        <textarea
          className="min-h-40 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          value={profile.resumeText}
          onChange={(event) => setProfile({ ...profile, resumeText: event.target.value })}
        />
      </label>

      <button
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
        type="button"
        disabled={isPending}
        onClick={saveProfile}
      >
        Save profile
      </button>
      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </form>
  );
}
