import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { apiFetch } from '../utils';
import type { Workspace, WorkspaceSummary } from '../types';

export function useWorkspace() {
  const { address, isConnected } = useAccount();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspaceState] = useState<Workspace | null>(null);
  const [summary, setSummary] = useState<WorkspaceSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const loadWorkspaces = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const data = await apiFetch<Workspace[]>(`/workspaces?owner=${address.toLowerCase()}`);
      setWorkspaces(data);
      if (data.length > 0 && !activeWorkspace) {
        setActiveWorkspaceState(data[0]);
      }
    } catch (err) {
      console.error('Failed to load workspaces:', err);
    } finally {
      setLoading(false);
    }
  }, [address]); // eslint-disable-line

  const loadSummary = useCallback(async (wsId: string) => {
    setSummaryLoading(true);
    try {
      const data = await apiFetch<WorkspaceSummary>(`/workspaces/${wsId}/summary`);
      setSummary(data);
    } catch (err) {
      console.error('Failed to load summary:', err);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  // Initial load when wallet connects
  useEffect(() => {
    if (isConnected && address) {
      void loadWorkspaces();
    } else {
      setWorkspaces([]);
      setActiveWorkspaceState(null);
      setSummary(null);
    }
  }, [isConnected, address, loadWorkspaces]);

  // Load summary when active workspace changes
  useEffect(() => {
    if (activeWorkspace) {
      void loadSummary(activeWorkspace.id);
    }
  }, [activeWorkspace?.id, loadSummary]); // eslint-disable-line

  const setActiveWorkspace = useCallback((ws: Workspace) => {
    setActiveWorkspaceState(ws);
  }, []);

  const createWorkspace = useCallback(async (name: string) => {
    if (!address) throw new Error('Wallet not connected');
    const ws = await apiFetch<Workspace>('/workspaces', {
      method: 'POST',
      body: JSON.stringify({ name, owner_address: address.toLowerCase() }),
    });
    setWorkspaces(prev => [...prev, ws]);
    setActiveWorkspaceState(ws);
    return ws;
  }, [address]);

  // Refresh only the dashboard summary — does NOT reload workspaces list,
  // so no remount/re-render of the active view occurs.
  const refreshSummary = useCallback(() => {
    if (activeWorkspace) void loadSummary(activeWorkspace.id);
  }, [activeWorkspace, loadSummary]);

  return {
    workspaces,
    activeWorkspace,
    setActiveWorkspace,
    summary,
    loading,
    summaryLoading,
    createWorkspace,
    refreshSummary,
  };
}
