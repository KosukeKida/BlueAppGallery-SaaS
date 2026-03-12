'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

interface TenantInfo {
  id: string;
  name: string;
  plan: string;
  created_at: string;
  member_count: number;
  connection_count: number;
}

export default function GeneralSettingsPage() {
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [role, setRole] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [saveMessage, setSaveMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const fetchTenant = useCallback(async () => {
    const res = await fetch('/api/tenant');
    if (res.ok) {
      const data = await res.json();
      setTenant(data.tenant);
      setRole(data.role);
      setName(data.tenant.name || '');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTenant();
  }, [fetchTenant]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);

    const res = await fetch('/api/tenant', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });

    if (res.ok) {
      setSaveMessage({ ok: true, text: 'Settings saved.' });
      fetchTenant();
    } else {
      const data = await res.json();
      setSaveMessage({ ok: false, text: data.error || 'Failed to save.' });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div>
        <h2 className="text-2xl font-bold mb-6">General Settings</h2>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div>
        <h2 className="text-2xl font-bold mb-6">General Settings</h2>
        <p className="text-muted-foreground">No tenant information found.</p>
      </div>
    );
  }

  const isOwner = role === 'owner';

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">General Settings</h2>

      <div className="space-y-6">
        {/* Organization */}
        <Card>
          <CardHeader>
            <CardTitle>Organization</CardTitle>
            <CardDescription>
              Your organization name and settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="orgName">Organization Name</Label>
              <Input
                id="orgName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!isOwner}
                placeholder="My Organization"
              />
              {!isOwner && (
                <p className="text-xs text-muted-foreground">
                  Only the tenant owner can change the organization name.
                </p>
              )}
            </div>
            {saveMessage && (
              <div className={`rounded-md p-3 text-sm ${
                saveMessage.ok
                  ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300'
                  : 'bg-destructive/15 text-destructive'
              }`}>
                {saveMessage.text}
              </div>
            )}
          </CardContent>
          {isOwner && (
            <CardFooter>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </CardFooter>
          )}
        </Card>

        {/* Tenant Details */}
        <Card>
          <CardHeader>
            <CardTitle>Tenant Details</CardTitle>
            <CardDescription>
              Information about your tenant for reference and support.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Tenant ID</dt>
                <dd className="font-mono text-xs mt-1">{tenant.id}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Plan</dt>
                <dd className="mt-1 capitalize">{tenant.plan || 'basic'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Your Role</dt>
                <dd className="mt-1 capitalize">{role}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Created</dt>
                <dd className="mt-1">{new Date(tenant.created_at).toLocaleDateString()}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Members</dt>
                <dd className="mt-1">{tenant.member_count}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Connections</dt>
                <dd className="mt-1">{tenant.connection_count}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
