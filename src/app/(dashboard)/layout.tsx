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

  // Fetch all memberships for tenant switcher
  const { data: memberships } = await supabase
    .from('tenant_members')
    .select('tenant_id, role')
    .eq('user_id', user.id);

  // Find the active membership (or fallback to first)
  const activeMembership = memberships?.find(m => m.tenant_id === activeTenantId)
    ?? memberships?.[0];
  const role = (activeMembership?.role as 'owner' | 'admin' | 'member') ?? 'member';

  // Fetch tenant names for switcher
  const tenantIds = memberships?.map(m => m.tenant_id) ?? [];
  const { data: tenantRows } = tenantIds.length > 0
    ? await supabase.from('tenants').select('id, name').in('id', tenantIds)
    : { data: [] };

  const tenants = (memberships ?? []).map(m => ({
    id: m.tenant_id,
    name: (tenantRows ?? []).find(t => t.id === m.tenant_id)?.name ?? 'Unnamed',
    role: m.role,
  }));

  const activeTenantName = tenants.find(t => t.id === activeTenantId)?.name
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
