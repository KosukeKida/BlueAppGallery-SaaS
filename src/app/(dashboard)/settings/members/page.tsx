'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { toast } from 'sonner';

interface Member {
  id: string;
  user_id: string;
  email: string;
  role: string;
  is_current: boolean;
  created_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
};

function roleBadgeVariant(role: string): 'default' | 'secondary' | 'outline' {
  if (role === 'owner') return 'default';
  if (role === 'admin') return 'secondary';
  return 'outline';
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [currentRole, setCurrentRole] = useState('');
  const [loading, setLoading] = useState(true);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviting, setInviting] = useState(false);

  // Role change
  const [roleTarget, setRoleTarget] = useState<Member | null>(null);
  const [newRole, setNewRole] = useState('');

  // Remove
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);
  const [removing, setRemoving] = useState(false);

  const isOwner = currentRole === 'owner';
  const isAdmin = currentRole === 'owner' || currentRole === 'admin';

  const fetchMembers = useCallback(async () => {
    const res = await fetch('/api/members');
    if (res.ok) {
      const data = await res.json();
      setMembers(data.members || []);
      setCurrentRole(data.current_role || '');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviting(true);

    const res = await fetch('/api/members/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    });

    const data = await res.json();
    if (res.ok) {
      toast.success(
        data.method === 'invited'
          ? `Invitation sent to ${inviteEmail}`
          : `${inviteEmail} added to organization`
      );
      setInviteEmail('');
      setInviteRole('member');
      fetchMembers();
    } else {
      toast.error(data.error || 'Failed to invite member');
    }
    setInviting(false);
  };

  const handleRoleChange = async () => {
    if (!roleTarget || !newRole) return;

    const res = await fetch(`/api/members/${roleTarget.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    });

    if (res.ok) {
      toast.success(`Role updated to ${ROLE_LABELS[newRole]}`);
      fetchMembers();
    } else {
      const data = await res.json();
      toast.error(data.error || 'Failed to update role');
    }
    setRoleTarget(null);
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    setRemoving(true);

    const res = await fetch(`/api/members/${removeTarget.id}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      toast.success(`${removeTarget.email} removed from organization`);
      fetchMembers();
    } else {
      const data = await res.json();
      toast.error(data.error || 'Failed to remove member');
    }
    setRemoving(false);
    setRemoveTarget(null);
  };

  if (loading) {
    return (
      <div>
        <h2 className="text-2xl font-bold mb-6">Members</h2>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Members</h2>
        <p className="text-sm text-muted-foreground">
          Manage your organization members and their roles.
        </p>
      </div>

      {/* Invite form */}
      {isAdmin && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Invite Member</CardTitle>
            <CardDescription>
              Add a new member by email address. If they don&apos;t have an account, an invitation will be sent.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleInvite}>
            <CardContent>
              <div className="flex items-end gap-3">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="inviteEmail">Email</Label>
                  <Input
                    id="inviteEmail"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="user@example.com"
                    required
                  />
                </div>
                <div className="w-32 space-y-2">
                  <Label>Role</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={inviting}>
                {inviting ? 'Inviting...' : 'Send Invite'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}

      {/* Member list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {members.length} {members.length === 1 ? 'Member' : 'Members'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {members.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between border-b pb-3 last:border-b-0 last:pb-0"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                    {m.email[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-medium">
                      {m.email}
                      {m.is_current && (
                        <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Joined {new Date(m.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={roleBadgeVariant(m.role)}>
                    {ROLE_LABELS[m.role] || m.role}
                  </Badge>
                  {isOwner && !m.is_current && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setRoleTarget(m);
                          setNewRole(m.role);
                        }}
                      >
                        Change Role
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setRemoveTarget(m)}
                      >
                        Remove
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Role change dialog */}
      <AlertDialog open={!!roleTarget} onOpenChange={(open) => { if (!open) setRoleTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change Role</AlertDialogTitle>
            <AlertDialogDescription>
              Update the role for {roleTarget?.email}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="owner">Owner</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="member">Member</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRoleChange}>
              Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove confirmation dialog */}
      <AlertDialog open={!!removeTarget} onOpenChange={(open) => { if (!open) setRemoveTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {removeTarget?.email} from your organization?
              They will lose access to all resources.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              disabled={removing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removing ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
