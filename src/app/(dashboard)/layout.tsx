import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { InfraSidebar } from '@/components/layout/infra-sidebar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const email = user.email ?? '';

  // Fetch user's role for sidebar visibility
  const { data: member } = await supabase
    .from('tenant_members')
    .select('role')
    .eq('user_id', user.id)
    .single();

  const role = (member?.role as 'owner' | 'admin' | 'member') ?? 'member';

  return (
    <div className="flex min-h-screen">
      <Sidebar userEmail={email} userRole={role} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header userEmail={email} />
        <main className="flex-1 p-8">{children}</main>
      </div>
      <InfraSidebar />
    </div>
  );
}
