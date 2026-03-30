import { useState, useEffect, useRef, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import {
  Gavel, Sword, Shield, FileText, ChevronRight, Play, Square,
  AlertCircle, Plus, BrainCircuit, ArrowLeft, Scale, Cpu, Repeat,
  UserCheck, Users, X, Loader2, RefreshCw,
} from "lucide-react";

import {
  useLiveCase, useChatScroll, useCourtStream, useWitnessActions,
  useUpdateRoles, useUpdatePhase, useAddDevelopment,
} from "@/hooks/use-courtroom";
import type { CourtPhase, TranscriptEntry, CasePerson, ActiveWitness } from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { TranscriptEntryCard } from "@/components/TranscriptEntryCard";
import { TypingIndicator } from "@/components/TypingIndicator";

const PHASE_LABELS: Record<string, string> = {
  opening_statements: "Opening Statements",
  prosecution_case: "Prosecution Case",
  defense_case: "Defense Case",
  closing_arguments: "Closing Arguments",
  verdict: "Verdict",
  concluded: "Concluded",
};

const NEXT_PHASE: Record<CourtPhase, CourtPhase> = {
  opening_statements: "prosecution_case",
  prosecution_case: "defense_case",
  defense_case: "closing_arguments",
  closing_arguments: "verdict",
  verdict: "concluded",
  concluded: "concluded",
};

type Role = "judge" | "prosecutor" | "defense";

export default function Courtroom() {
  const [, params] = useRoute("/case/:id");
  const caseId = params?.id ?? "";
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: session, isLoading, error } = useLiveCase(caseId);
  const { streamState, streamSpeak, streamAiTurn, streamAutoProceed, streamWitnessRespond } = useCourtStream(caseId);
  const { extractPersons, callWitness, dismissWitness } = useWitnessActions(caseId);

  const updateRoles = useUpdateRoles();
  const updatePhase = useUpdatePhase();
  const addDev = useAddDevelopment();

  const [inputContent, setInputContent] = useState("");
  const [selectedRole, setSelectedRole] = useState<Role | "">("");
  const [devTitle, setDevTitle] = useState("");
  const [devContent, setDevContent] = useState("");
  const [devOpen, setDevOpen] = useState(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [isExtractingPersons, setIsExtractingPersons] = useState(false);
  const [isCallingWitness, setIsCallingWitness] = useState<string | null>(null);
  const [isDismissing, setIsDismissing] = useState(false);

  const pendingRolesRef = useRef<typeof session.roles | null>(null);
  const rolesTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamAutoProceedRef = useRef(streamAutoProceed);
  streamAutoProceedRef.current = streamAutoProceed;

  const scrollRef = useChatScroll(
    `${session?.transcript?.length ?? 0}|${streamState.streamingContent.length}`
  );

  useEffect(() => {
    if (session && !selectedRole) {
      if (session.roles.judge === "user") setSelectedRole("judge");
      else if (session.roles.prosecutor === "user") setSelectedRole("prosecutor");
      else if (session.roles.defense === "user") setSelectedRole("defense");
    }
  }, [session, selectedRole]);

  useEffect(() => {
    if (session?.roles) pendingRolesRef.current = session.roles;
  }, [session?.roles]);

  const autoPlayEffect = useCallback(() => {
    if (!isAutoPlaying || streamState.isPending || session?.phase === "concluded") return;
    const timer = setTimeout(() => {
      streamAutoProceedRef.current();
    }, 1200);
    return () => clearTimeout(timer);
  }, [isAutoPlaying, streamState.isPending, session?.phase]);

  useEffect(() => {
    return autoPlayEffect();
  }, [autoPlayEffect]);

  const handleRoleToggle = useCallback((role: Role, isUser: boolean) => {
    pendingRolesRef.current = {
      ...(pendingRolesRef.current ?? session?.roles ?? { judge: "ai", prosecutor: "ai", defense: "ai" }),
      [role]: isUser ? "user" : "ai",
    };
    if (rolesTimeoutRef.current) clearTimeout(rolesTimeoutRef.current);
    rolesTimeoutRef.current = setTimeout(() => {
      if (pendingRolesRef.current) {
        updateRoles.mutate({ caseId, data: { roles: pendingRolesRef.current } });
        if (isUser) {
          setSelectedRole(role);
          setIsAutoPlaying(false);
        }
      }
    }, 350);
  }, [caseId, session?.roles, updateRoles]);

  if (!caseId) return null;
  if (isLoading) return <LoadingScreen />;
  if (error || !session) return <ErrorScreen onBack={() => navigate("/")} />;

  const isUserRole = (role: Role) => session.roles[role] === "user";
  const hasAnyUserRole = isUserRole("judge") || isUserRole("prosecutor") || isUserRole("defense");
  const isAiThinking = streamState.isPending;
  const persons: CasePerson[] = session.persons ?? [];
  const activeWitness: ActiveWitness | null = session.activeWitness ?? null;

  const handleSpeak = async () => {
    if (!inputContent.trim() || !selectedRole || isAiThinking) return;
    const content = inputContent;
    setInputContent("");
    try {
      await streamSpeak(selectedRole, content, true);
    } catch {
      toast({ title: "Failed to send message", variant: "destructive" });
    }
  };

  const handleAiTurn = async (role: Role) => {
    if (isAiThinking) return;
    try {
      await streamAiTurn(role);
    } catch {
      toast({ title: "Failed to trigger AI", variant: "destructive" });
    }
  };

  const handleAutoProceed = async () => {
    if (isAiThinking) return;
    try {
      await streamAutoProceed();
    } catch {
      toast({ title: "Failed to auto-proceed", variant: "destructive" });
    }
  };

  const handleAddDevelopment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDev.mutateAsync({ caseId, data: { title: devTitle, content: devContent } });
      setDevOpen(false);
      setDevTitle("");
      setDevContent("");
      toast({ title: "Development Added", description: "The case context has been updated." });
    } catch {
      toast({ title: "Failed to add development", variant: "destructive" });
    }
  };

  const handleExtractPersons = async () => {
    setIsExtractingPersons(true);
    try {
      const extracted = await extractPersons();
      toast({
        title: `${extracted.length} person${extracted.length !== 1 ? "s" : ""} identified`,
        description: "All named individuals from the case file have been added.",
      });
    } catch {
      toast({ title: "Failed to identify persons", variant: "destructive" });
    } finally {
      setIsExtractingPersons(false);
    }
  };

  const handleCallWitness = async (personId: string) => {
    setIsCallingWitness(personId);
    try {
      await callWitness(personId);
    } catch {
      toast({ title: "Failed to call witness", variant: "destructive" });
    } finally {
      setIsCallingWitness(null);
    }
  };

  const handleDismissWitness = async () => {
    setIsDismissing(true);
    try {
      await dismissWitness();
    } catch {
      toast({ title: "Failed to dismiss witness", variant: "destructive" });
    } finally {
      setIsDismissing(false);
    }
  };

  const phaseLabel = PHASE_LABELS[session.phase] ?? session.phase.replace(/_/g, " ");

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden relative">
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-500/5 rounded-full blur-[120px]" />
      </div>

      {/* Header */}
      <header className="h-16 relative z-10 glass-panel border-b border-white/5 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="hover:bg-white/5 rounded-full">
            <ArrowLeft className="w-5 h-5 text-white/70" />
          </Button>
          <div className="w-px h-6 bg-white/10" />
          <h1 className="font-display font-bold text-xl text-white drop-shadow-md truncate max-w-[200px]">
            {session.title}
          </h1>
          <Badge variant="outline" className="ml-2 bg-white/5 border-white/10 text-primary font-semibold tracking-wider shrink-0">
            {phaseLabel.toUpperCase()}
          </Badge>
        </div>

        <div className="flex items-center space-x-4">
          <RoleToggle
            role="Judge" icon={<Gavel className="w-4 h-4" />} color="primary"
            isUser={session.roles.judge === "user"}
            onToggle={(val) => handleRoleToggle("judge", val)}
          />
          <RoleToggle
            role="Prosecutor" icon={<Sword className="w-4 h-4" />} color="blue-500"
            isUser={session.roles.prosecutor === "user"}
            onToggle={(val) => handleRoleToggle("prosecutor", val)}
          />
          <RoleToggle
            role="Defense" icon={<Shield className="w-4 h-4" />} color="emerald-500"
            isUser={session.roles.defense === "user"}
            onToggle={(val) => handleRoleToggle("defense", val)}
          />
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden relative z-10">

        {/* Left Sidebar */}
        <aside className="w-72 border-r border-white/5 bg-black/20 flex flex-col shrink-0 overflow-hidden">
          <div className="p-4 border-b border-white/5 flex items-center space-x-2">
            <FileText className="w-5 h-5 text-primary" />
            <h2 className="font-display font-semibold text-lg">Case Docket</h2>
          </div>

          <div className="flex-1 overflow-y-auto p-4 transcript-scroll space-y-6">
            {/* Original Brief */}
            <div>
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-3">Original Brief</h3>
              <div className="bg-white/5 border border-white/5 rounded-xl p-4 text-sm text-white/70 leading-relaxed font-sans max-h-48 overflow-y-auto transcript-scroll">
                {session.caseText.split("\n").map((p, i) => <p key={i} className="my-1">{p}</p>)}
              </div>
            </div>

            {/* Developments */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Developments</h3>
                <Dialog open={devOpen} onOpenChange={setDevOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-primary/20 hover:text-primary">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="glass-panel border-white/10 text-white sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle className="font-display text-2xl text-primary">Introduce Development</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleAddDevelopment} className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label>Title / Evidence Name</Label>
                        <Input value={devTitle} onChange={e => setDevTitle(e.target.value)} className="bg-black/50 border-white/10" required />
                      </div>
                      <div className="space-y-2">
                        <Label>Content</Label>
                        <Textarea value={devContent} onChange={e => setDevContent(e.target.value)} className="bg-black/50 border-white/10 min-h-[150px]" required />
                      </div>
                      <Button type="submit" disabled={addDev.isPending} className="w-full bg-primary hover:bg-primary/80 text-black font-bold">
                        {addDev.isPending ? "Submitting..." : "Submit to Record"}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              {session.developments.length === 0 ? (
                <p className="text-xs text-white/30 italic text-center p-4 bg-black/20 rounded-xl">No developments yet.</p>
              ) : (
                <div className="space-y-3">
                  {session.developments.map(dev => (
                    <div key={dev.id} className="bg-primary/5 border border-primary/20 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-sm font-semibold text-primary truncate">{dev.title}</h4>
                        <span className="text-[10px] text-white/40 shrink-0 ml-2">{format(new Date(dev.timestamp), "HH:mm")}</span>
                      </div>
                      <p className="text-xs text-white/70 line-clamp-3">{dev.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Persons & Witnesses */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4 text-orange-400" />
                  <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Persons</h3>
                </div>
                <Button
                  variant="ghost" size="icon"
                  className="h-6 w-6 rounded-full hover:bg-orange-400/20 hover:text-orange-400"
                  onClick={handleExtractPersons}
                  disabled={isExtractingPersons}
                  title="Re-identify all persons from case file"
                >
                  {isExtractingPersons ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                </Button>
              </div>

              {persons.length === 0 ? (
                <div className="text-center p-4 bg-black/20 rounded-xl">
                  <p className="text-xs text-white/30 italic mb-3">No persons identified yet.</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-orange-400/30 text-orange-400 hover:bg-orange-400/10 text-xs h-7"
                    onClick={handleExtractPersons}
                    disabled={isExtractingPersons}
                  >
                    {isExtractingPersons ? (
                      <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Scanning...</>
                    ) : (
                      <><Users className="w-3 h-3 mr-1" />Identify Persons</>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {persons.map(person => {
                    const isActive = activeWitness?.personId === person.id;
                    const isCalling = isCallingWitness === person.id;
                    return (
                      <div
                        key={person.id}
                        className={`rounded-xl p-3 border transition-all ${
                          isActive
                            ? "bg-orange-400/10 border-orange-400/40"
                            : "bg-white/3 border-white/5 hover:border-white/10"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center space-x-1.5">
                              {isActive && <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse shrink-0" />}
                              <p className="text-sm font-semibold text-white truncate">{person.name}</p>
                            </div>
                            <p className="text-[10px] text-orange-400/80 font-medium mt-0.5">{person.role}</p>
                            <p className="text-[10px] text-white/40 mt-1 line-clamp-2">{person.context}</p>
                          </div>
                          {isActive ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-[10px] text-red-400 hover:bg-red-500/10 hover:text-red-400 shrink-0"
                              onClick={handleDismissWitness}
                              disabled={isDismissing || isAiThinking}
                            >
                              {isDismissing ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-[10px] text-orange-400 hover:bg-orange-400/10 hover:text-orange-400 shrink-0"
                              onClick={() => handleCallWitness(person.id)}
                              disabled={isCalling || isAiThinking}
                            >
                              {isCalling ? <Loader2 className="w-3 h-3 animate-spin" /> : "Call"}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="p-4 border-t border-white/5 bg-black/40">
            <Button
              variant="outline"
              className="w-full justify-between bg-white/5 border-white/10 hover:bg-white/10 hover:text-white"
              onClick={() => updatePhase.mutate({ caseId, data: { phase: NEXT_PHASE[session.phase] } })}
              disabled={session.phase === "concluded" || updatePhase.isPending}
            >
              <span>Advance Proceeding</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </aside>

        {/* Center — Transcript */}
        <main className="flex-1 flex flex-col min-w-0 bg-background/50 relative">

          {/* Active Witness Banner */}
          <AnimatePresence>
            {activeWitness && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="shrink-0 px-6 py-2 bg-orange-400/10 border-b border-orange-400/20 flex items-center justify-between"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse" />
                  <UserCheck className="w-4 h-4 text-orange-400" />
                  <span className="text-sm font-semibold text-orange-400">
                    On the Stand: <span className="text-white">{activeWitness.name}</span>
                  </span>
                  <span className="text-xs text-white/40">— {activeWitness.role}</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs text-red-400 hover:bg-red-500/10 hover:text-red-400 h-7"
                  onClick={handleDismissWitness}
                  disabled={isDismissing || isAiThinking}
                >
                  {isDismissing ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <X className="w-3 h-3 mr-1" />}
                  Dismiss
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 md:p-10 transcript-scroll scroll-smooth">
            <div className="max-w-4xl mx-auto pb-40">
              <AnimatePresence initial={false}>
                {session.transcript.map(entry => (
                  <TranscriptEntryCard key={entry.id} entry={entry} />
                ))}

                {streamState.activeRole && streamState.streamingContent && (
                  <StreamingEntryCard
                    key="streaming"
                    role={streamState.activeRole}
                    witnessName={streamState.activeWitnessName}
                    content={streamState.streamingContent}
                  />
                )}

                {streamState.isPending && streamState.activeRole && !streamState.streamingContent && (
                  <motion.div
                    key="typing-indicator"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex w-full mb-8 ${
                      streamState.activeRole === "judge" || streamState.activeRole === "witness"
                        ? "justify-center"
                        : streamState.activeRole === "prosecutor"
                        ? "justify-start"
                        : "justify-end"
                    }`}
                  >
                    <div className="flex flex-col items-start space-y-2">
                      <span className="text-xs text-white/40 font-semibold uppercase tracking-widest ml-2">
                        {streamState.activeRole === "witness"
                          ? `${streamState.activeWitnessName ?? "Witness"} is speaking...`
                          : `${streamState.activeRole} is speaking...`}
                      </span>
                      {streamState.activeRole !== "witness" && (
                        <TypingIndicator role={streamState.activeRole} />
                      )}
                    </div>
                  </motion.div>
                )}

                {streamState.isPending && !streamState.activeRole && session.transcript.length > 0 && !streamState.streamingContent && (
                  <motion.div
                    key="processing"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex justify-center my-4"
                  >
                    <div className="flex items-center space-x-2 text-xs text-white/30 font-medium">
                      <Repeat className="w-3 h-3 animate-spin" />
                      <span>Processing...</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Bottom Input */}
          <div className="absolute bottom-0 left-0 right-0 p-6 pt-12 bg-gradient-to-t from-background via-background/90 to-transparent">
            <div className="max-w-4xl mx-auto glass-panel p-4 rounded-3xl border border-white/10 shadow-2xl relative">

              {!hasAnyUserRole ? (
                <div className="flex flex-col items-center justify-center py-4 space-y-4">
                  <div className="text-sm text-white/50 uppercase tracking-widest font-semibold flex items-center">
                    <BrainCircuit className="w-4 h-4 mr-2" />
                    Viewer Mode — AI Controls All Roles
                  </div>
                  <div className="flex items-center space-x-4">
                    <Button
                      size="lg"
                      onClick={handleAutoProceed}
                      disabled={isAiThinking || session.phase === "concluded"}
                      className="bg-primary hover:bg-primary/90 text-black font-bold px-10 rounded-xl h-14 text-base shadow-[0_0_30px_rgba(212,175,55,0.3)] hover:shadow-[0_0_50px_rgba(212,175,55,0.5)] transition-all"
                    >
                      <Play className="w-5 h-5 mr-2" />
                      {isAiThinking ? "AI Speaking..." : "Next Turn"}
                    </Button>

                    <div className="flex flex-col items-center space-y-1">
                      <Button
                        size="lg"
                        variant={isAutoPlaying ? "destructive" : "outline"}
                        onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                        disabled={session.phase === "concluded"}
                        className={`h-14 px-6 rounded-xl font-bold border transition-all ${isAutoPlaying
                          ? "bg-red-500/20 border-red-500/50 text-red-400 hover:bg-red-500/30"
                          : "bg-white/5 border-white/10 hover:bg-white/10"
                          }`}
                      >
                        {isAutoPlaying ? (
                          <><Square className="w-4 h-4 mr-2" />Stop Auto Play</>
                        ) : (
                          <><Repeat className="w-4 h-4 mr-2" />Auto Play</>
                        )}
                      </Button>
                      {isAutoPlaying && (
                        <span className="text-[10px] text-emerald-400 font-semibold tracking-widest animate-pulse">● LIVE</span>
                      )}
                    </div>
                  </div>
                  {session.phase === "concluded" && (
                    <p className="text-xs text-white/30 italic">The proceedings have concluded.</p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col space-y-3">
                  {activeWitness && (
                    <div className="flex items-center space-x-2 px-2 py-1 bg-orange-400/10 rounded-xl border border-orange-400/20">
                      <UserCheck className="w-3 h-3 text-orange-400" />
                      <span className="text-xs text-orange-400 font-semibold">
                        {activeWitness.name} is on the stand — your statement will be directed to them
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center space-x-3">
                      <Select value={selectedRole} onValueChange={(v: any) => setSelectedRole(v)}>
                        <SelectTrigger className="w-[180px] bg-white/5 border-white/10 text-white font-semibold">
                          <SelectValue placeholder="Speak as..." />
                        </SelectTrigger>
                        <SelectContent className="bg-secondary border-white/10 text-white">
                          {isUserRole("judge") && <SelectItem value="judge">⚖️ Judge</SelectItem>}
                          {isUserRole("prosecutor") && <SelectItem value="prosecutor">⚔️ Prosecutor</SelectItem>}
                          {isUserRole("defense") && <SelectItem value="defense">🛡️ Defense</SelectItem>}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center space-x-2">
                      {!isUserRole("judge") && (
                        <Button variant="ghost" size="sm" onClick={() => handleAiTurn("judge")} disabled={isAiThinking} className="text-primary hover:bg-primary/20 hover:text-primary text-xs">
                          Judge AI
                        </Button>
                      )}
                      {!isUserRole("prosecutor") && (
                        <Button variant="ghost" size="sm" onClick={() => handleAiTurn("prosecutor")} disabled={isAiThinking} className="text-blue-400 hover:bg-blue-500/20 hover:text-blue-400 text-xs">
                          Pros AI
                        </Button>
                      )}
                      {!isUserRole("defense") && (
                        <Button variant="ghost" size="sm" onClick={() => handleAiTurn("defense")} disabled={isAiThinking} className="text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-400 text-xs">
                          Def AI
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="flex space-x-3 items-end">
                    <Textarea
                      value={inputContent}
                      onChange={e => setInputContent(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSpeak();
                        }
                      }}
                      placeholder={
                        activeWitness
                          ? `Question ${activeWitness.name}... (Enter to send)`
                          : "Type your statement to the court... (Enter to send, Shift+Enter for new line)"
                      }
                      className="resize-none bg-black/40 border-white/10 text-base py-3 px-4 rounded-2xl focus:ring-primary/50"
                      rows={2}
                      disabled={isAiThinking}
                    />
                    <Button
                      onClick={handleSpeak}
                      disabled={!inputContent.trim() || !selectedRole || isAiThinking}
                      className="h-[52px] px-8 rounded-2xl bg-primary hover:bg-primary/90 text-black font-bold shadow-[0_0_20px_rgba(212,175,55,0.2)]"
                    >
                      {isAiThinking ? <Repeat className="w-5 h-5 animate-spin" /> : <Gavel className="w-5 h-5" />}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function StreamingEntryCard({
  role,
  witnessName,
  content,
}: {
  role: "judge" | "prosecutor" | "defense" | "witness";
  witnessName?: string | null;
  content: string;
}) {
  const isJudge = role === "judge";
  const isProsecutor = role === "prosecutor";
  const isWitness = role === "witness";

  const textColor = isJudge ? "text-primary" : isProsecutor ? "text-blue-400" : isWitness ? "text-orange-400" : "text-emerald-400";
  const borderClass = isJudge ? "border-primary/30" : isProsecutor ? "border-blue-500/20" : isWitness ? "border-orange-400/30" : "border-emerald-500/20";
  const glowClass = isJudge ? "bg-primary" : isProsecutor ? "bg-blue-500" : isWitness ? "bg-orange-400" : "bg-emerald-500";
  const iconBgClass = isJudge ? "bg-primary/20 text-primary" : isProsecutor ? "bg-blue-500/20 text-blue-400" : isWitness ? "bg-orange-400/20 text-orange-400" : "bg-emerald-500/20 text-emerald-400";
  const speaker = isJudge ? "The Honorable Judge" : isProsecutor ? "Prosecution Counsel" : isWitness ? (witnessName ?? "Witness") : "Defense Counsel";
  const alignment = isJudge || isWitness ? "justify-center" : isProsecutor ? "justify-start" : "justify-end";
  const width = isJudge || isWitness ? "w-full md:w-[85%]" : "max-w-[80%] md:max-w-[70%]";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={`flex w-full mb-8 ${alignment}`}
    >
      <div className={`${width} relative group`}>
        <div className={`absolute -inset-0.5 rounded-2xl opacity-30 blur-xl ${glowClass}`} />
        <div className={`relative glass-panel rounded-2xl p-6 md:p-8 ${borderClass}`}>
          <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-4">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-xl ${iconBgClass}`}>
                {isJudge && <Scale className="w-5 h-5" />}
                {isProsecutor && <Sword className="w-5 h-5" />}
                {isWitness && <UserCheck className="w-5 h-5" />}
                {!isJudge && !isProsecutor && !isWitness && <Shield className="w-5 h-5" />}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  {isWitness && (
                    <span className="text-[10px] uppercase tracking-widest font-bold text-orange-400/70 bg-orange-400/10 border border-orange-400/20 px-2 py-0.5 rounded-full">
                      Witness
                    </span>
                  )}
                  <h4 className={`font-display font-bold text-lg tracking-wide ${textColor}`}>{speaker}</h4>
                </div>
                <div className="flex items-center space-x-2 mt-0.5">
                  <Cpu className="w-3 h-3 text-white/40" />
                  <span className="text-xs text-white/40 font-semibold">AI — generating...</span>
                </div>
              </div>
            </div>
          </div>
          <div className="prose prose-invert max-w-none text-white/90 leading-relaxed font-sans">
            {content.split("\n").map((paragraph, idx) => (
              paragraph.trim() ? <p key={idx}>{paragraph}</p> : null
            ))}
            <span className="inline-block w-0.5 h-4 bg-white/70 ml-0.5 animate-pulse" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function RoleToggle({ role, icon, color, isUser, onToggle }: {
  role: string; icon: React.ReactNode; color: string; isUser: boolean; onToggle: (val: boolean) => void;
}) {
  return (
    <div className="flex items-center space-x-3 bg-black/40 rounded-full pl-1 pr-3 py-1 border border-white/5">
      <div className={`p-1.5 rounded-full bg-${color}/20 text-${color}`}>{icon}</div>
      <div className="flex flex-col">
        <span className="text-[10px] font-bold uppercase text-white/50 tracking-wider leading-none">{role}</span>
        <span className={`text-xs font-bold leading-tight ${isUser ? "text-white" : `text-${color}`}`}>
          {isUser ? "USER" : "AI"}
        </span>
      </div>
      <Switch checked={isUser} onCheckedChange={onToggle} className="scale-[0.8] ml-2 data-[state=checked]:bg-white" />
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-background">
      <img src={`${import.meta.env.BASE_URL}images/logo.png`} className="w-20 h-20 animate-pulse mb-6 opacity-50" />
      <div className="text-primary font-display text-xl tracking-widest animate-pulse">ENTERING CHAMBERS</div>
    </div>
  );
}

function ErrorScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-background">
      <AlertCircle className="w-16 h-16 text-destructive mb-6" />
      <h2 className="text-2xl font-display font-bold text-white mb-2">Session Not Found</h2>
      <p className="text-muted-foreground mb-8">This proceeding has been sealed or does not exist.</p>
      <Button onClick={onBack} variant="outline" className="border-white/20">Return to Directory</Button>
    </div>
  );
}
