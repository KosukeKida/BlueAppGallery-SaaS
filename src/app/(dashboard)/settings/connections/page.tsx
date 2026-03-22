'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ConnectionForm, type ConnectionData } from '@/components/settings/connection-form';

interface Connection {
  id: string;
  display_name: string;
  account_identifier: string;
  account_locator: string;
  username: string;
  role: string;
  database: string;
  schema_name: string;
  warehouse: string | null;
  is_active: boolean;
  last_tested_at: string | null;
  last_test_result: string | null;
  created_at: string;
}

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingConnection, setEditingConnection] = useState<ConnectionData | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; ok: boolean; message: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Connection | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchConnections = useCallback(async () => {
    const res = await fetch('/api/connections');
    if (res.ok) {
      const data = await res.json();
      setConnections(data.connections || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const handleTest = async (connectionId: string) => {
    setTesting(connectionId);
    setTestResult(null);

    const res = await fetch(`/api/connections/${connectionId}/test`, {
      method: 'POST',
    });

    const data = await res.json();
    setTestResult({
      id: connectionId,
      ok: data.ok,
      message: data.ok
        ? `Connected! Found ${data.resources?.resources?.length ?? 0} registered resources.`
        : data.error || 'Connection failed',
    });
    setTesting(null);
    fetchConnections();
  };

  const handleEdit = (conn: Connection) => {
    setShowForm(false);
    setEditingConnection({
      id: conn.id,
      display_name: conn.display_name,
      account_identifier: conn.account_identifier,
      account_locator: conn.account_locator,
      username: conn.username,
      role: conn.role,
      database: conn.database,
      warehouse: conn.warehouse,
    });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);

    const res = await fetch(`/api/connections/${deleteTarget.id}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      const data = await res.json();
      setDeleteError(data.error || 'Failed to delete connection');
      setDeleting(false);
      return;
    }

    setDeleting(false);
    setDeleteTarget(null);
    fetchConnections();
  };

  if (loading) {
    return (
      <div>
        <h2 className="text-2xl font-bold mb-6">Snowflake Connections</h2>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Snowflake Connections</h2>
          <p className="text-sm text-muted-foreground">
            Configure connections to Snowflake accounts with App Gallery Operator installed.
            {' '}
            <a href="/setup-guide" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Setup Guide ↗
            </a>
          </p>
        </div>
        {!showForm && !editingConnection && (
          <Button onClick={() => setShowForm(true)}>
            Add Connection
          </Button>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <div className="mb-6">
          <ConnectionForm
            onSuccess={() => {
              setShowForm(false);
              fetchConnections();
            }}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {/* Edit form */}
      {editingConnection && (
        <div className="mb-6">
          <ConnectionForm
            editConnection={editingConnection}
            onSuccess={() => {
              setEditingConnection(null);
              fetchConnections();
            }}
            onCancel={() => setEditingConnection(null)}
          />
        </div>
      )}

      {connections.length === 0 && !showForm ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              No connections configured yet.
            </p>
            <Button onClick={() => setShowForm(true)}>
              Add Your First Connection
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {connections.map((conn) => (
            <Card key={conn.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{conn.display_name}</CardTitle>
                    <CardDescription>
                      {conn.account_identifier} / {conn.username} / {conn.role}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {conn.last_test_result && (
                      <Badge variant={conn.last_test_result === 'OK' ? 'default' : 'destructive'}>
                        {conn.last_test_result === 'OK' ? 'Connected' : 'Failed'}
                      </Badge>
                    )}
                    <Badge variant={conn.is_active ? 'outline' : 'secondary'}>
                      {conn.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    <span>DB: {conn.database}.{conn.schema_name}</span>
                    {conn.warehouse && <span className="ml-4">WH: {conn.warehouse}</span>}
                    {conn.last_tested_at && (
                      <span className="ml-4">
                        Last tested: {new Date(conn.last_tested_at).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(conn)}
                      disabled={!!editingConnection}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTest(conn.id)}
                      disabled={testing === conn.id}
                    >
                      {testing === conn.id ? 'Testing...' : 'Test'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(conn)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
                {testResult && testResult.id === conn.id && (
                  <div
                    className={`mt-3 rounded-md p-3 text-sm ${
                      testResult.ok
                        ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300'
                        : 'bg-destructive/15 text-destructive'
                    }`}
                  >
                    {testResult.message}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteError(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Connection</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.display_name}&quot;?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {deleteError}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
