'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface TenantMembership {
  tenant_id: string;
  role: string;
  tenants: {
    id: string;
    name: string;
  };
}

export default function SelectTenantPage() {
  const router = useRouter();
  const [memberships, setMemberships] = useState<TenantMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function loadMemberships() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data } = await supabase
        .from('tenant_members')
        .select('tenant_id, role, tenants(id, name)')
        .eq('user_id', user.id);

      if (!data || data.length === 0) {
        router.push('/login');
        return;
      }

      // Single tenant: auto-switch and skip selection
      if (data.length === 1) {
        await switchTenant(data[0].tenant_id);
        return;
      }

      setMemberships(data as unknown as TenantMembership[]);
      setLoading(false);
    }

    loadMemberships();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function switchTenant(tenantId: string) {
    setSwitching(tenantId);
    const res = await fetch('/api/tenant/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId }),
    });

    if (res.ok) {
      // Refresh session to get new JWT with active_tenant_id
      await supabase.auth.refreshSession();
      window.location.href = '/gallery';
    } else {
      setSwitching(null);
    }
  }

  const roleLabel: Record<string, string> = {
    owner: 'Owner',
    admin: 'Admin',
    member: 'Member',
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading workspaces...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <div className="w-full max-w-md space-y-6 p-4">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Select Workspace</h1>
          <p className="text-sm text-muted-foreground">
            You belong to multiple workspaces. Choose one to continue.
          </p>
        </div>

        <div className="space-y-3">
          {memberships.map((m) => (
            <Card
              key={m.tenant_id}
              className={`cursor-pointer transition-colors hover:border-primary ${
                switching === m.tenant_id ? 'border-primary bg-primary/5' : ''
              }`}
              onClick={() => !switching && switchTenant(m.tenant_id)}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">
                    {(m.tenants as unknown as { name: string })?.name ?? 'Unnamed'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {roleLabel[m.role] ?? m.role}
                  </p>
                </div>
                {switching === m.tenant_id ? (
                  <span className="text-sm text-muted-foreground">Switching...</span>
                ) : (
                  <Button variant="ghost" size="sm" tabIndex={-1}>
                    Select →
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
