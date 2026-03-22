'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export interface ConnectionData {
  id: string;
  display_name: string;
  account_identifier: string;
  account_locator: string;
  username: string;
  role: string;
  database: string;
  warehouse: string | null;
}

interface ConnectionFormProps {
  onSuccess: () => void;
  onCancel?: () => void;
  editConnection?: ConnectionData;
}

export function ConnectionForm({ onSuccess, onCancel, editConnection }: ConnectionFormProps) {
  const isEdit = !!editConnection;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState(editConnection?.display_name ?? 'Default');
  const [accountIdentifier, setAccountIdentifier] = useState(editConnection?.account_identifier ?? '');
  const [accountLocator, setAccountLocator] = useState(editConnection?.account_locator ?? '');
  const [username, setUsername] = useState(editConnection?.username ?? 'BLUE_APP_GALLERY_SVC');
  const [privateKey, setPrivateKey] = useState('');
  const [role, setRole] = useState(editConnection?.role ?? 'BLUE_APP_GALLERY_SAAS_ROLE');
  const [database, setDatabase] = useState(editConnection?.database ?? 'BLUE_APP_GALLERY');
  const [warehouse, setWarehouse] = useState(editConnection?.warehouse ?? 'COMPUTE_WH');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload: Record<string, unknown> = {
      displayName,
      accountIdentifier,
      accountLocator,
      username,
      role,
      database,
      warehouse: warehouse || undefined,
    };

    // Private key: required for create, optional for edit
    if (privateKey) {
      payload.privateKey = privateKey;
    }

    const url = isEdit ? `/api/connections/${editConnection.id}` : '/api/connections';
    const method = isEdit ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.json();
      setError(body.error || `Failed to ${isEdit ? 'update' : 'create'} connection`);
      setLoading(false);
      return;
    }

    setLoading(false);
    onSuccess();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEdit ? 'Edit Connection' : 'New Snowflake Connection'}</CardTitle>
        <CardDescription>
          {isEdit
            ? 'Update the connection settings. Leave the private key empty to keep the existing key.'
            : 'Configure the connection to your Snowflake account where App Gallery Operator is installed.'}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Default"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="accountIdentifier">Account Identifier</Label>
              <Input
                id="accountIdentifier"
                value={accountIdentifier}
                onChange={(e) => setAccountIdentifier(e.target.value)}
                placeholder="ACME-PROD01"
                required
              />
              <p className="text-xs text-muted-foreground">
                URL format (e.g., ACME-PROD01)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="accountLocator">Account Locator</Label>
              <Input
                id="accountLocator"
                value={accountLocator}
                onChange={(e) => setAccountLocator(e.target.value)}
                placeholder="AZ19283"
                required
              />
              <p className="text-xs text-muted-foreground">
                SELECT CURRENT_ACCOUNT() for this value
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="BLUE_APP_GALLERY_SVC"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Input
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="BLUE_APP_GALLERY_SAAS_ROLE"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="privateKey">
              Private Key (PEM){isEdit && ' — leave empty to keep current'}
            </Label>
            <Textarea
              id="privateKey"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
              rows={6}
              className="font-mono text-xs"
              required={!isEdit}
            />
            <p className="text-xs text-muted-foreground">
              RSA private key in PKCS8 PEM format for SQL API keypair authentication.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="database">Database</Label>
              <Input
                id="database"
                value={database}
                onChange={(e) => setDatabase(e.target.value)}
                placeholder="BLUE_APP_GALLERY"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="warehouse">Warehouse</Label>
              <Input
                id="warehouse"
                value={warehouse}
                onChange={(e) => setWarehouse(e.target.value)}
                placeholder="COMPUTE_WH"
                required
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="gap-2">
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : isEdit ? 'Update Connection' : 'Save Connection'}
          </Button>
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </CardFooter>
      </form>
    </Card>
  );
}
