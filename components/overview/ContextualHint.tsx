'use client';

import { useMemo } from 'react';
import { getAllTasks } from '@/lib/utils/board';
import type { Board } from '@/lib/types/board';
import styles from './ContextualHint.module.css';

function getTodayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

type ContextualHintProps = {
  boards: Board[];
  activeBoardId?: string;
};

/**
 * One-line contextual hint: due today → stuck → all done → default.
 * Uses existing board/task data; no new API.
 */
export function ContextualHint({ boards, activeBoardId }: ContextualHintProps) {
  const hint = useMemo(() => {
    const relevantBoards = activeBoardId
      ? boards.filter((b) => b.id === activeBoardId)
      : boards;
    const tasks = relevantBoards.flatMap((b) => getAllTasks(b));
    const today = getTodayISO();

    const dueToday = tasks.filter((t) => t.dueDate === today).length;
    const stuckCount = tasks.filter((t) => t.status === 'stuck').length;
    const allDone = tasks.length > 0 && tasks.every((t) => t.status === 'done');

    if (dueToday > 0) {
      return dueToday === 1
        ? 'Kamu punya 1 task due hari ini.'
        : `Kamu punya ${dueToday} task due hari ini.`;
    }
    if (stuckCount > 0) {
      return stuckCount === 1 ? 'Ada 1 task stuck.' : `Ada ${stuckCount} task stuck.`;
    }
    if (allDone) {
      return activeBoardId ? 'Semua task di board ini selesai.' : 'Semua task selesai.';
    }
    return 'Belum ada task due hari ini. Lanjutkan task kamu.';
  }, [boards, activeBoardId]);

  return (
    <p className={styles.hint} role="status">
      {hint}
    </p>
  );
}
