import { useEffect, useState } from 'react';
import type { AuthUser } from '../auth/types';
import { loadWorkspaceOverview, type WorkspaceOverview } from '../services/workspaceSnapshots';

const initialState: WorkspaceOverview = {
  signals: [],
  summaryCards: [],
  activity: [],
  attentionItems: [],
  serviceErrors: []
};

export function useWorkspaceOverview(user: AuthUser | null) {
  const [overview, setOverview] = useState<WorkspaceOverview>(initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function load() {
      if (!user) {
        setOverview(initialState);
        setError('');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const nextOverview = await loadWorkspaceOverview(user);
        if (!active) return;
        setOverview(nextOverview);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load workspace overview right now.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [user]);

  return {
    overview,
    loading,
    error
  };
}
