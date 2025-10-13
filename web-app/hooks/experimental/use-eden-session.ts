"use client";

import { useState, useCallback } from "react";
import axios from "axios";
import { SessionV2 } from "@edenlabs/eden-sdk";

// Types based on the API routes and Eden SDK
export interface PaginationParams {
  limit?: number;
  cursor?: string;
}

export interface SessionListParams extends PaginationParams {
  agent_id?: string;
}

export interface SessionUpdateData {
  title?: string;
  pinned?: boolean;
}

export interface SessionListResponse {
  // Normalized array of sessions regardless of backend shape (results, docs, items, etc.)
  results: SessionV2[];
  // Optional raw cursor (v2 style)
  next_cursor?: string;
  // Whether more pages exist (supports both has_more + hasNextPage forms)
  has_more: boolean;
  // Optional total count if provided by API (e.g. mongoose paginate)
  total?: number;
  // Raw API payload for debugging / advanced usage
  _raw?: any;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface UseEdenSessionOptions {
  onError?: (error: string) => void;
  onSuccess?: (message: string) => void;
}

export function useEdenSession(options: UseEdenSessionOptions = {}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { onError, onSuccess } = options;

  const handleError = useCallback(
    (errorMessage: string) => {
      setError(errorMessage);
      onError?.(errorMessage);
    },
    [onError]
  );

  const handleSuccess = useCallback(
    (message?: string) => {
      setError(null);
      if (message) {
        onSuccess?.(message);
      }
    },
    [onSuccess]
  );

  // List sessions with optional pagination and filtering
  const listSessions = useCallback(
    async (
      params: SessionListParams = {}
    ): Promise<SessionListResponse | null> => {
      setLoading(true);
      try {
        const searchParams = new URLSearchParams();

        if (params.limit) searchParams.append("limit", params.limit.toString());
        if (params.cursor) searchParams.append("cursor", params.cursor);
        if (params.agent_id) searchParams.append("agent_id", params.agent_id);

        const response = await axios.get(
          `/api/eden/sessions/list?${searchParams.toString()}`
        );

        const data = response.data;

        if (data?.error) {
          handleError(data.error);
          return null;
        }

        // Normalize potential shapes:
        // 1) Eden v2 (paginated) might return { results, next_cursor, has_more }
        // 2) Mongoose paginate style returns { docs, total, limit, page, hasNextPage, hasPrevPage, nextPage }
        // 3) Generic arrays (fallback)
        let results: SessionV2[] = [];
        if (Array.isArray(data.results)) {
          results = data.results;
        } else if (Array.isArray(data.docs)) {
          results = data.docs;
        } else if (Array.isArray(data.items)) {
          results = data.items;
        } else if (Array.isArray(data)) {
          results = data; // raw array response
        }

        const hasMore =
          data.has_more !== undefined
            ? !!data.has_more
            : data.hasNextPage !== undefined
            ? !!data.hasNextPage
            : false;

        const nextCursor =
          data.next_cursor ||
          (data.hasNextPage && data.nextPage
            ? String(data.nextPage)
            : undefined);

        const normalized: SessionListResponse = {
          results: results.filter(Boolean),
          has_more: hasMore,
          next_cursor: nextCursor,
          total: data.total,
          _raw: data,
        };

        handleSuccess();
        return normalized;
      } catch (err) {
        const errorMessage = axios.isAxiosError(err)
          ? err.response?.data?.message || err.message
          : "Failed to list sessions";
        handleError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [handleError, handleSuccess]
  );

  // Get a specific session by ID
  const getSession = useCallback(
    async (sessionId: string): Promise<SessionV2 | null> => {
      if (!sessionId) {
        handleError("Session ID is required");
        return null;
      }

      setLoading(true);
      try {
        const response = await axios.get(`/api/eden/sessions/${sessionId}`);

        if (response.data.error) {
          handleError(response.data.error);
          return null;
        }

        if (!response.data.session) {
          handleError("Session not found");
          return null;
        }

        handleSuccess();
        return response.data.session as SessionV2;
      } catch (err) {
        const errorMessage = axios.isAxiosError(err)
          ? err.response?.data?.message || err.message
          : "Failed to get session";
        handleError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [handleError, handleSuccess]
  );

  // Update session (rename or pin/unpin)
  const updateSession = useCallback(
    async (
      sessionId: string,
      updateData: SessionUpdateData
    ): Promise<boolean> => {
      if (!sessionId) {
        handleError("Session ID is required");
        return false;
      }

      if (updateData.title === undefined && updateData.pinned === undefined) {
        handleError("Either title or pinned status must be provided");
        return false;
      }

      setLoading(true);
      try {
        const response = await axios.patch(
          `/api/eden/sessions/${sessionId}`,
          updateData
        );

        if (response.data.error) {
          handleError(response.data.error);
          return false;
        }

        const successMessage =
          updateData.title !== undefined
            ? "Session renamed successfully"
            : updateData.pinned
            ? "Session pinned successfully"
            : "Session unpinned successfully";

        handleSuccess(successMessage);
        return true;
      } catch (err) {
        const errorMessage = axios.isAxiosError(err)
          ? err.response?.data?.message || err.message
          : "Failed to update session";
        handleError(errorMessage);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [handleError, handleSuccess]
  );

  // Delete a session
  const deleteSession = useCallback(
    async (sessionId: string): Promise<boolean> => {
      if (!sessionId) {
        handleError("Session ID is required");
        return false;
      }

      setLoading(true);
      try {
        const response = await axios.delete(`/api/eden/sessions/${sessionId}`);

        if (response.data.error) {
          handleError(response.data.error);
          return false;
        }

        if (!response.data.success) {
          handleError(response.data.error || "Failed to delete session");
          return false;
        }

        handleSuccess("Session deleted successfully");
        return true;
      } catch (err) {
        const errorMessage = axios.isAxiosError(err)
          ? err.response?.data?.message || err.message
          : "Failed to delete session";
        handleError(errorMessage);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [handleError, handleSuccess]
  );

  // Convenience methods for common operations
  const renameSession = useCallback(
    async (sessionId: string, title: string): Promise<boolean> => {
      return updateSession(sessionId, { title });
    },
    [updateSession]
  );

  const pinSession = useCallback(
    async (sessionId: string): Promise<boolean> => {
      return updateSession(sessionId, { pinned: true });
    },
    [updateSession]
  );

  const unpinSession = useCallback(
    async (sessionId: string): Promise<boolean> => {
      return updateSession(sessionId, { pinned: false });
    },
    [updateSession]
  );

  // Clear error state
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // State
    loading,
    error,

    // Methods
    listSessions,
    getSession,
    updateSession,
    deleteSession,

    // Convenience methods
    renameSession,
    pinSession,
    unpinSession,

    // Utility
    clearError,
  };
}

export default useEdenSession;
