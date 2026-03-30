import { useRef, useEffect, useState, useCallback } from "react";
import {
  useGetCase,
  useCreateCase,
  useListCases,
  useUpdateRoles,
  useDeleteCase,
  useAddDevelopment,
  useUpdatePhase,
  getGetCaseQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export function useChatScroll<T>(dep: T) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [dep]);
  return ref;
}

export function useLiveCase(caseId: string) {
  return useGetCase(caseId, {
    query: {
      refetchInterval: (query) => {
        if (query.state.status === "pending") return false;
        return 5000;
      },
      retry: false,
    },
  });
}

export type StreamState = {
  isPending: boolean;
  activeRole: "judge" | "prosecutor" | "defense" | "witness" | null;
  activeWitnessName: string | null;
  streamingContent: string;
};

export function useCourtStream(caseId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const abortRef = useRef<AbortController | null>(null);
  const [streamState, setStreamState] = useState<StreamState>({
    isPending: false,
    activeRole: null,
    activeWitnessName: null,
    streamingContent: "",
  });

  const callStream = useCallback(
    async (path: string, body: unknown): Promise<void> => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setStreamState({ isPending: true, activeRole: null, activeWitnessName: null, streamingContent: "" });

      try {
        const response = await fetch(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`HTTP ${response.status}: ${text}`);
        }
        if (!response.body) throw new Error("No response body");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            const lines = part.split("\n");
            let eventName = "";
            let dataStr = "";

            for (const line of lines) {
              if (line.startsWith("event: ")) eventName = line.slice(7).trim();
              else if (line.startsWith("data: ")) dataStr = line.slice(6).trim();
            }

            if (!eventName || !dataStr) continue;

            let data: Record<string, unknown>;
            try {
              data = JSON.parse(dataStr);
            } catch {
              continue;
            }

            if (eventName === "error") {
              const msg = (data.message as string) ?? "The AI encountered an error. Please try again.";
              toast({ title: "AI Error", description: msg, variant: "destructive" });
            } else if (eventName === "ai_start") {
              setStreamState({
                isPending: true,
                activeRole: data.role as "judge" | "prosecutor" | "defense",
                activeWitnessName: null,
                streamingContent: "",
              });
            } else if (eventName === "witness_start") {
              setStreamState({
                isPending: true,
                activeRole: "witness",
                activeWitnessName: (data.name as string) ?? null,
                streamingContent: "",
              });
            } else if (eventName === "token") {
              setStreamState((prev) => ({
                ...prev,
                streamingContent: prev.streamingContent + (data.token as string),
              }));
            } else if (eventName === "ai_entry" || eventName === "witness_entry") {
              setStreamState((prev) => ({
                ...prev,
                activeRole: null,
                activeWitnessName: null,
                streamingContent: "",
              }));
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        throw err;
      } finally {
        setStreamState({ isPending: false, activeRole: null, activeWitnessName: null, streamingContent: "" });
        queryClient.invalidateQueries({
          queryKey: getGetCaseQueryKey(caseId),
        });
      }
    },
    [caseId, queryClient]
  );

  const streamSpeak = useCallback(
    (role: "judge" | "prosecutor" | "defense", content: string, triggerAiResponse = true) =>
      callStream(`/api/cases/${caseId}/speak/stream`, { role, content, triggerAiResponse }),
    [caseId, callStream]
  );

  const streamAiTurn = useCallback(
    (role: "judge" | "prosecutor" | "defense") =>
      callStream(`/api/cases/${caseId}/ai-turn/stream`, { role }),
    [caseId, callStream]
  );

  const streamAutoProceed = useCallback(
    () => callStream(`/api/cases/${caseId}/auto-proceed/stream`, {}),
    [caseId, callStream]
  );

  const streamWitnessRespond = useCallback(
    (question: string) =>
      callStream(`/api/cases/${caseId}/witness/respond/stream`, { question }),
    [caseId, callStream]
  );

  return { streamState, streamSpeak, streamAiTurn, streamAutoProceed, streamWitnessRespond };
}

export function useWitnessActions(caseId: string) {
  const queryClient = useQueryClient();

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getGetCaseQueryKey(caseId) });
  }, [caseId, queryClient]);

  const extractPersons = useCallback(async () => {
    const res = await fetch(`/api/cases/${caseId}/persons/extract`, { method: "POST" });
    if (!res.ok) throw new Error("Failed to extract persons");
    const data = await res.json() as { persons: CasePerson[] };
    invalidate();
    return data.persons;
  }, [caseId, invalidate]);

  const callWitness = useCallback(async (personId: string) => {
    const res = await fetch(`/api/cases/${caseId}/witness/call`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personId }),
    });
    if (!res.ok) throw new Error("Failed to call witness");
    invalidate();
  }, [caseId, invalidate]);

  const dismissWitness = useCallback(async () => {
    const res = await fetch(`/api/cases/${caseId}/witness/dismiss`, { method: "POST" });
    if (!res.ok) throw new Error("Failed to dismiss witness");
    invalidate();
  }, [caseId, invalidate]);

  return { extractPersons, callWitness, dismissWitness };
}

export {
  useGetCase,
  useCreateCase,
  useListCases,
  useUpdateRoles,
  useDeleteCase,
  useAddDevelopment,
  useUpdatePhase,
};
