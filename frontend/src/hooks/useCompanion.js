import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../utils/api";

export function useCompanion(userId) {
  const [companion, setCompanion] = useState(null);
  const [points, setPoints] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  const fetchData = useCallback(async () => {
    if (!userId) return;
    try {
      const [compData, ptsData] = await Promise.all([
        api.getCompanion(userId),
        api.getUserPoints(userId),
      ]);
      setCompanion(compData);
      setPoints(ptsData);
      setError(null);
    } catch (err) {
      console.error("useCompanion fetch error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    fetchData();
    intervalRef.current = setInterval(fetchData, 30000);
    return () => clearInterval(intervalRef.current);
  }, [userId, fetchData]);

  const feedCompanion = useCallback(async () => {
    if (!userId) return;
    try {
      const result = await api.feedCompanion(userId);
      setCompanion(result);
      // Refresh points after feeding
      const ptsData = await api.getUserPoints(userId);
      setPoints(ptsData);
      return result;
    } catch (err) {
      throw err;
    }
  }, [userId]);

  const renameCompanion = useCallback(
    async (name) => {
      if (!userId) return;
      try {
        const result = await api.renameCompanion(userId, name);
        setCompanion(result);
        return result;
      } catch (err) {
        throw err;
      }
    },
    [userId]
  );

  return {
    companion,
    points,
    loading,
    error,
    feedCompanion,
    renameCompanion,
    refresh: fetchData,
  };
}
