'use client';

import { useCallback, useEffect, useState } from 'react';

export interface CurrentUser {
  email: string;
  role: 'owner' | 'admin' | 'member';
  tenantId: string;
  tenantName: string;
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch('/api/tenant');
      if (res.ok) {
        const data = await res.json();
        setUser({
          email: '', // Will be filled from layout
          role: data.role,
          tenantId: data.tenant.id,
          tenantName: data.tenant.name,
        });
      }
    } catch {
      // Silently fail
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const isOwner = user?.role === 'owner';
  const isAdmin = user?.role === 'owner' || user?.role === 'admin';

  return { user, loading, isOwner, isAdmin };
}
