// ================================================================
//  CBT SYSTEM — STUDENT PROFILE PAGE
//  File    : src/pages/student/StudentProfilePage.tsx
//
//  NEW — read-only display of the student's own profile, including
//  the extended fields (guardian info, bio-data, health info) added
//  earlier this session. Students can VIEW this data but cannot
//  edit any of it — editing stays staff-only, matching the
//  confirmed decision that profile edits (including photos) are a
//  staff action, not student self-service.
// ================================================================

import React, { useEffect, useState } from 'react';
import {
  UserCircle, IdCard, Building2,
  Phone, Users2, Cake, MapPin, Droplet, Dna, School, CalendarPlus,
} from 'lucide-react';

import axiosInstance from '../../api/axiosInstance';


interface FullProfile {
  full_name: string; login_pin: string;
  class_name: string; arm_name: string | null; department_name: string; branch_name: string;
  photo_path: string | null;
  gender: string | null; residential_address: string | null;
  mother_name: string | null; father_name: string | null; admission_number: string | null;
  father_phone: string | null; mother_phone: string | null;
  guardian_name: string | null; guardian_relationship: string | null; guardian_phone: string | null;
  date_of_birth: string | null; state_of_origin: string | null; lga: string | null;
  blood_group: string | null; genotype: string | null;
  previous_school: string | null; date_joined: string | null;
}
interface MyProfileResponse { success: boolean; student: FullProfile }

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null }): React.JSX.Element {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-[#F4FBF6] last:border-0">
      <div className="w-8 h-8 rounded-lg bg-[#F4FBF6] border border-[#D7F2E0] flex items-center justify-center flex-shrink-0 text-[#6B8479] mt-0.5">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[#6B8479] text-sm">{label}</p>
        <p className="text-[#0B1F14] text-base font-semibold">{value || 'Not provided'}</p>
      </div>
    </div>
  );
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat('en-NG', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(iso));
  } catch { return iso; }
}

export default function StudentProfilePage(): React.JSX.Element {
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect((): void => {
    const load = async (): Promise<void> => {
      try {
        const res = await axiosInstance.get<MyProfileResponse>('/api/student/me');
        if (res.data.success) setProfile(res.data.student);
      } catch { /* stays null — page shows nothing rather than crashing */ } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  if (loading) {
    return <div className="h-64 bg-white border border-[#D7F2E0] rounded-2xl animate-pulse" />;
  }
  if (profile === null) {
    return <p className="text-[#6B8479] text-base">Could not load your profile. Please try refreshing.</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-[#0B1F14] text-2xl font-bold tracking-tight">My Profile</h1>

      <div className="bg-white border border-[#D7F2E0] rounded-2xl px-6 py-5 flex items-center gap-4">
        {profile.photo_path !== null ? (
          <img
            src       = {`${axiosInstance.defaults.baseURL ?? ''}${profile.photo_path}`}
            alt       = {profile.full_name}
            className = "w-16 h-16 rounded-2xl object-cover border border-[#D7F2E0] flex-shrink-0"
          />
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-[#4AE17A] flex items-center justify-center flex-shrink-0">
            <span className="text-[#0B1F14] text-2xl font-bold">{profile.full_name.charAt(0).toUpperCase()}</span>
          </div>
        )}
        <div>
          <p className="text-[#0B1F14] text-lg font-bold">{profile.full_name}</p>
          <p className="text-[#6B8479] text-sm mt-0.5">
            {profile.class_name}{profile.arm_name ?? ''} · {profile.department_name} · {profile.branch_name}
          </p>
        </div>
      </div>

      <div className="bg-white border border-[#D7F2E0] rounded-2xl px-6 py-2">
        <p className="text-[#3D5347] text-sm font-bold uppercase tracking-wider pt-3 pb-1">Identity</p>
        <InfoRow icon={<IdCard size={16} />}         label="Admission Number" value={profile.admission_number} />
        <InfoRow icon={<Users2 size={16} />}         label="Gender"           value={profile.gender} />
        <InfoRow icon={<Cake size={16} />}           label="Date of Birth"    value={formatDate(profile.date_of_birth)} />
        <InfoRow icon={<MapPin size={16} />}         label="State of Origin"  value={profile.state_of_origin} />
        <InfoRow icon={<MapPin size={16} />}         label="LGA"              value={profile.lga} />
      </div>

      <div className="bg-white border border-[#D7F2E0] rounded-2xl px-6 py-2">
        <p className="text-[#3D5347] text-sm font-bold uppercase tracking-wider pt-3 pb-1">Health</p>
        <InfoRow icon={<Droplet size={16} />} label="Blood Group" value={profile.blood_group} />
        <InfoRow icon={<Dna size={16} />}     label="Genotype"    value={profile.genotype} />
      </div>

      <div className="bg-white border border-[#D7F2E0] rounded-2xl px-6 py-2">
        <p className="text-[#3D5347] text-sm font-bold uppercase tracking-wider pt-3 pb-1">Parents / Guardian</p>
        <InfoRow icon={<UserCircle size={16} />} label="Father's Name"  value={profile.father_name} />
        <InfoRow icon={<Phone size={16} />}      label="Father's Phone" value={profile.father_phone} />
        <InfoRow icon={<UserCircle size={16} />} label="Mother's Name"  value={profile.mother_name} />
        <InfoRow icon={<Phone size={16} />}      label="Mother's Phone" value={profile.mother_phone} />
        {(profile.guardian_name || profile.guardian_phone) && (
          <>
            <InfoRow icon={<UserCircle size={16} />} label={`Guardian${profile.guardian_relationship ? ` (${profile.guardian_relationship})` : ''}`} value={profile.guardian_name} />
            <InfoRow icon={<Phone size={16} />}      label="Guardian's Phone" value={profile.guardian_phone} />
          </>
        )}
      </div>

      <div className="bg-white border border-[#D7F2E0] rounded-2xl px-6 py-2">
        <p className="text-[#3D5347] text-sm font-bold uppercase tracking-wider pt-3 pb-1">Address & School History</p>
        <InfoRow icon={<Building2 size={16} />}    label="Residential Address" value={profile.residential_address} />
        <InfoRow icon={<School size={16} />}       label="Previous School"     value={profile.previous_school} />
        <InfoRow icon={<CalendarPlus size={16} />} label="Date Joined"         value={formatDate(profile.date_joined)} />
      </div>

      <p className="text-[#6B8479] text-sm text-center">
        Spotted something wrong here? Ask your class teacher to update it — students can't edit this themselves.
      </p>
    </div>
  );
}