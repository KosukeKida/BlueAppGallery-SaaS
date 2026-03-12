import { redirect } from 'next/navigation';

// Settings index redirects to general settings
export default function SettingsPage() {
  redirect('/settings/general');
}
