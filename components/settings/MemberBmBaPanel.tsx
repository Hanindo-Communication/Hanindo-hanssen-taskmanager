'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkspaceRole } from '@/lib/contexts/WorkspaceRoleContext';
import {
  loadMemberBmBa,
  saveMemberBmBaRemote,
  saveMemberBmBaToStorage,
  type MemberBmBaSlot,
  type MemberBmBaState,
  type ClientRow,
} from '@/lib/utils/member-bm-ba-storage';
import styles from './MemberBmBaPanel.module.css';

const SLOTS: { slot: MemberBmBaSlot; name: string; roleShort: string }[] = [
  { slot: 'hanssen', name: 'Hanssen', roleShort: 'BM' },
  { slot: 'kezia', name: 'Kezia', roleShort: 'BA' },
];

type RowBaseline = { label: string; incentives: string };
type BaselineMap = Record<MemberBmBaSlot, Record<string, RowBaseline>>;

function emptyBaseline(): BaselineMap {
  return { hanssen: {}, kezia: {} };
}

function rebuildBaseline(state: MemberBmBaState): BaselineMap {
  const out = emptyBaseline();
  for (const slot of ['hanssen', 'kezia'] as MemberBmBaSlot[]) {
    for (const c of state[slot].clients) {
      out[slot][c.id] = { label: c.label, incentives: c.incentives };
    }
  }
  return out;
}

function newClientRow(): ClientRow {
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  return { id, label: '', incentives: '' };
}

function isRowDirty(slot: MemberBmBaSlot, row: ClientRow, baseline: BaselineMap): boolean {
  const b = baseline[slot][row.id];
  if (!b) return true;
  return b.label !== row.label || b.incentives !== row.incentives;
}

export function MemberBmBaPanel() {
  const { canManageMembers } = useWorkspaceRole();
  const [state, setState] = useState<MemberBmBaState | null>(null);
  const [baseline, setBaseline] = useState<BaselineMap>(emptyBaseline);
  const stateRef = useRef<MemberBmBaState | null>(null);
  stateRef.current = state;

  useEffect(() => {
    loadMemberBmBa().then((data) => {
      setState(data);
      setBaseline(rebuildBaseline(data));
    });
  }, []);

  const persist = useCallback((updater: (prev: MemberBmBaState) => MemberBmBaState) => {
    setState((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      saveMemberBmBaToStorage(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const handler = () => {
      const s = stateRef.current;
      if (!s) return;
      setBaseline(rebuildBaseline(s));
      void saveMemberBmBaRemote(s);
    };
    window.addEventListener('task-manager:save-request', handler);
    return () => window.removeEventListener('task-manager:save-request', handler);
  }, []);

  const setJobDesc = useCallback(
    (slot: MemberBmBaSlot, jobDesc: string) => {
      if (!canManageMembers) return;
      persist((prev) => ({
        ...prev,
        [slot]: { ...prev[slot], jobDesc },
      }));
    },
    [canManageMembers, persist]
  );

  const setClientLabel = useCallback(
    (slot: MemberBmBaSlot, rowId: string, label: string) => {
      if (!canManageMembers) return;
      persist((prev) => ({
        ...prev,
        [slot]: {
          ...prev[slot],
          clients: prev[slot].clients.map((c) =>
            c.id === rowId ? { ...c, label } : c
          ),
        },
      }));
    },
    [canManageMembers, persist]
  );

  const setClientIncentives = useCallback(
    (slot: MemberBmBaSlot, rowId: string, incentives: string) => {
      if (!canManageMembers) return;
      persist((prev) => ({
        ...prev,
        [slot]: {
          ...prev[slot],
          clients: prev[slot].clients.map((c) =>
            c.id === rowId ? { ...c, incentives } : c
          ),
        },
      }));
    },
    [canManageMembers, persist]
  );

  const confirmRow = useCallback((slot: MemberBmBaSlot, row: ClientRow) => {
    setBaseline((prev) => ({
      ...prev,
      [slot]: {
        ...prev[slot],
        [row.id]: { label: row.label, incentives: row.incentives },
      },
    }));
  }, []);

  const cancelRow = useCallback(
    (slot: MemberBmBaSlot, rowId: string) => {
      if (!canManageMembers) return;
      const b = baseline[slot][rowId];
      if (!b) return;
      persist((prev) => ({
        ...prev,
        [slot]: {
          ...prev[slot],
          clients: prev[slot].clients.map((c) =>
            c.id === rowId ? { ...c, label: b.label, incentives: b.incentives } : c
          ),
        },
      }));
    },
    [canManageMembers, baseline, persist]
  );

  const addClientRow = useCallback(
    (slot: MemberBmBaSlot) => {
      if (!canManageMembers) return;
      const nr = newClientRow();
      persist((prev) => ({
        ...prev,
        [slot]: {
          ...prev[slot],
          clients: [...prev[slot].clients, nr],
        },
      }));
      setBaseline((prev) => ({
        ...prev,
        [slot]: { ...prev[slot], [nr.id]: { label: '', incentives: '' } },
      }));
    },
    [canManageMembers, persist]
  );

  const removeClientRow = useCallback(
    (slot: MemberBmBaSlot, rowId: string) => {
      if (!canManageMembers) return;
      persist((prev) => {
        const list = prev[slot].clients;
        if (list.length <= 1) return prev;
        return {
          ...prev,
          [slot]: {
            ...prev[slot],
            clients: list.filter((c) => c.id !== rowId),
          },
        };
      });
      setBaseline((prev) => {
        const nextSlot = { ...prev[slot] };
        delete nextSlot[rowId];
        return { ...prev, [slot]: nextSlot };
      });
    },
    [canManageMembers, persist]
  );

  if (!state) {
    return <p className={styles.loading}>Loading…</p>;
  }

  const disabled = !canManageMembers;

  return (
    <div className={styles.wrap}>
      {disabled && (
        <p className={styles.readOnlyHint}>
          Only workspace admins can edit job descriptions and client lists.
        </p>
      )}

      {SLOTS.map(({ slot, name, roleShort }) => (
        <article key={slot} className={styles.card}>
          <div className={styles.cardHeader}>
            <h3 className={styles.memberName}>{name}</h3>
            <span className={styles.roleBadge}>{roleShort}</span>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor={`job-desc-${slot}`}>
              Job Desc
            </label>
            <textarea
              id={`job-desc-${slot}`}
              className={styles.textarea}
              value={state[slot].jobDesc}
              onChange={(e) => setJobDesc(slot, e.target.value)}
              disabled={disabled}
              rows={4}
              placeholder="Describe responsibilities…"
            />
          </div>

          <div className={styles.field}>
            <h4 className={styles.clientsTitle}>List of Clients</h4>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={`${styles.thClient} ${styles.thIndex}`}>#</th>
                    <th
                      className={`${styles.thClient} ${styles.thColClient}`}
                    >
                      Client
                    </th>
                    <th
                      className={`${styles.thClient} ${styles.thColIncentives}`}
                    >
                      Incentives
                    </th>
                    {canManageMembers && (
                      <th className={styles.thClient}>Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {state[slot].clients.map((row, index) => {
                    const dirty =
                      canManageMembers && isRowDirty(slot, row, baseline);
                    return (
                      <tr key={row.id}>
                        <td className={`${styles.tdIndex}`}>{index + 1}</td>
                        <td className={styles.tdClient}>
                          <textarea
                            className={`${styles.input} ${styles.inputMultiline}`}
                            value={row.label}
                            onChange={(e) =>
                              setClientLabel(slot, row.id, e.target.value)
                            }
                            disabled={disabled}
                            aria-label={`Client for ${name}`}
                            rows={2}
                          />
                        </td>
                        <td className={styles.tdIncentives}>
                          <textarea
                            className={`${styles.input} ${styles.inputMultiline}`}
                            value={row.incentives}
                            onChange={(e) =>
                              setClientIncentives(slot, row.id, e.target.value)
                            }
                            disabled={disabled}
                            aria-label={`Incentives for ${name}`}
                            placeholder="Incentives…"
                            rows={2}
                          />
                        </td>
                      {canManageMembers && (
                        <td className={styles.tdActions}>
                          <div className={styles.actionsCell}>
                            {dirty ? (
                              <>
                                <button
                                  type="button"
                                  className={styles.confirmBtn}
                                  onClick={() => confirmRow(slot, row)}
                                  aria-label="Confirm row changes"
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  className={styles.cancelBtn}
                                  onClick={() => cancelRow(slot, row.id)}
                                  aria-label="Cancel row changes"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : null}
                            <button
                              type="button"
                              className={styles.removeBtn}
                              onClick={() => removeClientRow(slot, row.id)}
                              disabled={state[slot].clients.length <= 1}
                              aria-label="Remove client row"
                            >
                              Remove
                            </button>
                          </div>
                        </td>
                      )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {canManageMembers && (
              <div className={styles.toolbar}>
                <button
                  type="button"
                  className={styles.addBtn}
                  onClick={() => addClientRow(slot)}
                >
                  Add client row
                </button>
              </div>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
