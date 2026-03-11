'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  loadWorkspaceMembers,
  saveWorkspaceMember,
  removeWorkspaceMember,
} from '@/lib/utils/workspace-members';
import { useWorkspaceRole } from '@/lib/contexts/WorkspaceRoleContext';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { WorkspaceMember } from '@/lib/types/workspace';
import type { MemberRole } from '@/lib/types/board';
import styles from './MembersTable.module.css';

type ConfirmState = {
  open: boolean;
  title: string;
  message: string;
  variant: 'danger' | 'default';
  onConfirm: () => void;
};

const ROLES: { value: MemberRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'member', label: 'Member' },
  { value: 'viewer', label: 'Viewer' },
];

export function MembersTable() {
  const { canManageMembers } = useWorkspaceRole();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<MemberRole>('member');
  const [confirm, setConfirm] = useState<ConfirmState>({
    open: false,
    title: '',
    message: '',
    variant: 'default',
    onConfirm: () => {},
  });

  const refresh = useCallback(() => {
    setLoading(true);
    loadWorkspaceMembers().then((list) => {
      setMembers(list);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleRoleChange = useCallback(
    (id: string, role: MemberRole) => {
      const m = members.find((x) => x.id === id);
      if (!m || !canManageMembers) return;
      const roleLabel = ROLES.find((r) => r.value === role)?.label ?? role;
      setConfirm({
        open: true,
        title: 'Change role?',
        message: `Change ${m.name}'s role to "${roleLabel}"?`,
        variant: 'default',
        onConfirm: () => {
          const next = { ...m, role };
          setMembers((prev) => prev.map((x) => (x.id === id ? next : x)));
          void saveWorkspaceMember(next);
          setConfirm((c) => ({ ...c, open: false }));
        },
      });
    },
    [members, canManageMembers]
  );

  const handleRemove = useCallback(
    (id: string) => {
      if (!canManageMembers) return;
      const m = members.find((x) => x.id === id);
      setConfirm({
        open: true,
        title: 'Remove member?',
        message: `Remove "${m?.name ?? m?.email ?? 'this member'}" from the workspace? They will lose access.`,
        variant: 'danger',
        onConfirm: () => {
          void removeWorkspaceMember(id).then(() => refresh());
          setConfirm((c) => ({ ...c, open: false }));
        },
      });
    },
    [canManageMembers, members, refresh]
  );

  const handleAdd = useCallback(() => {
    const email = newEmail.trim().toLowerCase();
    const name = newName.trim() || email.split('@')[0] || 'Member';
    if (!email || !canManageMembers) return;
    const roleLabel = ROLES.find((r) => r.value === newRole)?.label ?? newRole;
    setConfirm({
      open: true,
      title: 'Add member?',
      message: `Add ${name} (${email}) with role "${roleLabel}"?`,
      variant: 'default',
      onConfirm: () => {
        const id = crypto.randomUUID();
        const member: WorkspaceMember = { id, email, name, role: newRole };
        void saveWorkspaceMember(member).then(() => {
          setMembers((prev) => [...prev, member]);
          setNewEmail('');
          setNewName('');
          setNewRole('member');
        });
        setConfirm((c) => ({ ...c, open: false }));
      },
    });
  }, [newEmail, newName, newRole, canManageMembers]);

  if (loading) {
    return <p className={styles.loading}>Loading members…</p>;
  }

  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.thName}>Name</th>
            <th className={styles.thEmail}>Email</th>
            <th className={styles.thRole}>Role</th>
            {canManageMembers && <th className={styles.thActions}>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.id}>
              <td className={styles.tdName}>{m.name}</td>
              <td className={styles.tdEmail}>{m.email}</td>
              <td className={styles.tdRole}>
                {canManageMembers ? (
                  <select
                    className={styles.roleSelect}
                    value={m.role}
                    onChange={(e) => handleRoleChange(m.id, e.target.value as MemberRole)}
                    aria-label={`Role for ${m.name}`}
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className={styles.roleBadge}>{m.role}</span>
                )}
              </td>
              {canManageMembers && (
                <td className={styles.tdActions}>
                  <button
                    type="button"
                    className={styles.removeBtn}
                    onClick={() => handleRemove(m.id)}
                    aria-label={`Remove ${m.name}`}
                  >
                    Remove
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {canManageMembers && (
        <div className={styles.addForm}>
          <h3 className={styles.addTitle}>Add member</h3>
          <div className={styles.addRow}>
            <input
              type="email"
              className={styles.addInput}
              placeholder="Email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              aria-label="New member email"
            />
            <input
              type="text"
              className={styles.addInput}
              placeholder="Name (optional)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              aria-label="New member name"
            />
            <select
              className={styles.roleSelect}
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as MemberRole)}
              aria-label="New member role"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={styles.addBtn}
              onClick={handleAdd}
              disabled={!newEmail.trim()}
            >
              Add
            </button>
          </div>
          <p className={styles.addHint}>
            Member will get this role when they log in with this email. Add yourself as Admin first
            if the list is empty.
          </p>
        </div>
      )}

      <ConfirmDialog
        open={confirm.open}
        title={confirm.title}
        message={confirm.message}
        variant={confirm.variant}
        confirmLabel="Confirm"
        cancelLabel="Cancel"
        onConfirm={confirm.onConfirm}
        onCancel={() => setConfirm((c) => ({ ...c, open: false }))}
      />
    </div>
  );
}
