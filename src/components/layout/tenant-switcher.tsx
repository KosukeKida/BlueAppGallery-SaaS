'use client';

import { useState, useRef, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';

interface Tenant {
  id: string;
  name: string;
  role: string;
}

interface TenantSwitcherProps {
  activeTenantId: string;
  activeTenantName: string;
  tenants: Tenant[];
}

export function TenantSwitcher({ activeTenantId, activeTenantName, tenants }: TenantSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Don't render switcher if user belongs to only one tenant
  if (tenants.length <= 1) {
    return (
      <div className="px-3 py-1">
        <p className="text-xs font-medium text-muted-foreground truncate">{activeTenantName}</p>
      </div>
    );
  }

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function handleSwitch(tenantId: string) {
    if (tenantId === activeTenantId || switching) return;
    setSwitching(true);

    const res = await fetch('/api/tenant/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId }),
    });

    if (res.ok) {
      await supabase.auth.refreshSession();
      window.location.href = '/gallery';
    } else {
      setSwitching(false);
    }
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => !switching && setOpen(!open)}
        className="w-full px-3 py-1.5 flex items-center justify-between text-left hover:bg-muted rounded-md transition-colors"
        disabled={switching}
      >
        <span className="text-xs font-medium truncate">
          {switching ? 'Switching...' : activeTenantName}
        </span>
        <svg
          className={`w-3 h-3 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-background border rounded-md shadow-lg py-1">
          {tenants.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => handleSwitch(t.id)}
              className={`w-full px-3 py-2 text-left text-xs hover:bg-muted transition-colors flex items-center justify-between ${
                t.id === activeTenantId ? 'bg-muted/50 font-medium' : ''
              }`}
            >
              <span className="truncate">{t.name}</span>
              {t.id === activeTenantId && (
                <span className="text-primary ml-2">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
