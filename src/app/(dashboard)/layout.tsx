import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { InfraSidebar } from '@/components/layout/infra-sidebar';
import { MobileShell } from '@/components/layout/mobile-shell';

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

  // Get active tenant from JWT app_metadata
  const activeTenantId = user.app_metadata?.active_tenant_id as string | undefined;

  // Fetch all memberships via SECURITY DEFINER function (bypasses RLS)
  const { data: tenantRows } = await supabase.rpc('list_user_tenants');

  interface TenantRow { tenant_id: string; tenant_name: string; role: string }
  const tenants = (tenantRows as TenantRow[] ?? []).map((r) => ({
    id: r.tenant_id,
    name: r.tenant_name,
    role: r.role,
  }));

  // Find the active membership (or fallback to first)
  const activeMembership = tenants.find((t: { id: string }) => t.id === activeTenantId) ?? tenants[0];
  const role = (activeMembership?.role as 'owner' | 'admin' | 'member') ?? 'member';

  const activeTenantName = tenants.find((t: { id: string }) => t.id === activeTenantId)?.name
    ?? tenants[0]?.name ?? '';

  // SaaS owner: admin/owner of the SaaS operator tenant
  const saasOwnerTenantId = process.env.SAAS_OWNER_TENANT_ID ?? '';
  const isSaasOwner = !!saasOwnerTenantId
    && activeTenantId === saasOwnerTenantId
    && (role === 'owner' || role === 'admin');

  return (
    <MobileShell
      userEmail={email}
      userRole={role}
      isSaasOwner={isSaasOwner}
      activeTenantId={activeTenantId}
      activeTenantName={activeTenantName}
      tenants={tenants}
    >
      {children}
    </MobileShell>
  );
}
