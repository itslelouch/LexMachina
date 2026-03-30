import { useRef, useEffect } from "react";
import { 
  useGetCase, 
  useCreateCase, 
  useListCases, 
  useUpdateRoles, 
  useSpeak, 
  useTriggerAiTurn, 
  useAutoProceed, 
  useAddDevelopment, 
  useUpdatePhase 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Custom hook to manage auto-scrolling the transcript view
 */
export function useChatScroll<T>(dep: T) {
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [dep]);

  return ref;
}

/**
 * Composite hook to bundle case data fetching with real-time polling
 * This ensures the frontend stays up to date when the AI responds.
 */
export function useLiveCase(caseId: string) {
  return useGetCase(caseId, {
    query: {
      refetchInterval: 3000, // Poll every 3s to get AI responses natively
      retry: false
    }
  });
}

// Re-export standard workspace hooks for convenience
export {
  useGetCase,
  useCreateCase,
  useListCases,
  useUpdateRoles,
  useSpeak,
  useTriggerAiTurn,
  useAutoProceed,
  useAddDevelopment,
  useUpdatePhase
};
