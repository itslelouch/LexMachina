import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Scale, FileText, Settings2, Play, AlertCircle, ChevronRight, Gavel, Trash2, BrainCircuit } from "lucide-react";
import { useListCases, useCreateCase, useDeleteCase } from "@/hooks/use-courtroom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import type { LegalSystem, AIDemeanor } from "@workspace/api-client-react";

const PHASE_LABELS: Record<string, string> = {
  pre_trial_motions: "Pre-Trial Motions",
  opening_statements: "Opening Statements",
  prosecution_case: "Prosecution Case",
  defense_case: "Defense Case",
  closing_arguments: "Closing Arguments",
  verdict: "Verdict",
  concluded: "Concluded",
};

const LEGAL_SYSTEMS: Array<{ value: LegalSystem; flag: string; label: string; description: string }> = [
  { value: "general", flag: "⚖️", label: "General", description: "Standard adversarial system" },
  { value: "indian", flag: "🇮🇳", label: "Indian Law", description: "BNS 2023 · BNSS 2023 · BSA 2023" },
  { value: "us_federal", flag: "🇺🇸", label: "US Federal", description: "FRCrP · FRE · Title 18" },
  { value: "uk", flag: "🇬🇧", label: "UK Common Law", description: "Crown Court · CrimPR 2020 · PACE" },
];

const AI_DEMEANORS: Array<{ value: AIDemeanor; icon: string; label: string; description: string }> = [
  { value: "formal", icon: "🎓", label: "Formal", description: "Measured, precise, by the book" },
  { value: "aggressive", icon: "⚔️", label: "Aggressive", description: "Sharp, combative, unrelenting" },
  { value: "theatrical", icon: "🎭", label: "Theatrical", description: "Dramatic, persuasive, emotional" },
];

const PHASE_STATUS_COLOR: Record<string, string> = {
  concluded: "text-white/40",
  verdict: "text-emerald-400",
};

export default function Home() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: caseList, isLoading: loadingCases } = useListCases();
  const createCase = useCreateCase();
  const deleteCase = useDeleteCase();

  const [title, setTitle] = useState("");
  const [caseText, setCaseText] = useState("");
  const [roles, setRoles] = useState({ judge: false, prosecutor: false, defense: false });
  const [legalSystem, setLegalSystem] = useState<LegalSystem>("general");
  const [demeanor, setDemeanor] = useState<AIDemeanor>("formal");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !caseText.trim()) {
      toast({ title: "Missing fields", description: "Please provide both a title and case file context.", variant: "destructive" });
      return;
    }
    try {
      const newCase = await createCase.mutateAsync({
        data: {
          title,
          caseText,
          legalSystem,
          demeanor,
          roles: {
            judge: roles.judge ? "user" : "ai",
            prosecutor: roles.prosecutor ? "user" : "ai",
            defense: roles.defense ? "user" : "ai",
          },
        },
      });
      toast({ title: "Court is now in session", description: "Entering the courtroom..." });
      navigate(`/case/${newCase.caseId}`);
    } catch {
      toast({ title: "Error creating case", description: "Something went wrong. Please try again.", variant: "destructive" });
    }
  };

  const handleDeleteCase = async (caseId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(caseId);
    try {
      await deleteCase.mutateAsync({ caseId });
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      toast({ title: "Case dismissed", description: "The proceeding has been sealed." });
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
      <div className="absolute inset-0 z-0">
        <img
          src={`${import.meta.env.BASE_URL}images/courtroom-bg.png`}
          alt="Dark majestic courtroom"
          className="w-full h-full object-cover opacity-30 mix-blend-overlay"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/80 to-background" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-24">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <div className="flex justify-center mb-6">
            <img
              src={`${import.meta.env.BASE_URL}images/logo.png`}
              alt="Lex Machina Logo"
              className="w-24 h-24 rounded-2xl shadow-2xl shadow-primary/20 animate-float"
            />
          </div>
          <h1 className="text-5xl md:text-7xl font-display font-bold text-white mb-6 tracking-tight drop-shadow-2xl">
            Lex <span className="text-primary">Machina</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto font-light">
            An advanced AI courtroom simulator. Preside over proceedings, prosecute, or defend against sophisticated AI entities.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">

          {/* Create New Case Form */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="lg:col-span-8"
          >
            <div className="glass-panel p-8 md:p-10 rounded-3xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />

              <div className="flex items-center space-x-4 mb-8">
                <Gavel className="w-8 h-8 text-primary" />
                <h2 className="text-3xl font-display font-bold">Commence Proceeding</h2>
              </div>

              <form onSubmit={handleStartSession} className="space-y-8 relative z-10">
                <div className="space-y-3">
                  <Label htmlFor="title" className="text-lg text-white/90">Case Docket Title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g., State v. CyberDyne Systems"
                    className="bg-black/40 border-white/10 text-lg h-14 rounded-xl focus:ring-primary focus:border-primary placeholder:text-white/20 transition-all"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="caseText" className="text-lg text-white/90">Case Brief & Evidence</Label>
                    <span className="text-xs text-muted-foreground bg-white/5 px-3 py-1 rounded-full border border-white/5 flex items-center">
                      <AlertCircle className="w-3 h-3 mr-1" /> Provides context to all AI models
                    </span>
                  </div>
                  <Textarea
                    id="caseText"
                    value={caseText}
                    onChange={e => setCaseText(e.target.value)}
                    placeholder="Paste the full case background, incident report, witness statements, and any relevant laws here..."
                    className="bg-black/40 border-white/10 min-h-[200px] text-base rounded-xl focus:ring-primary focus:border-primary placeholder:text-white/20 resize-y"
                  />
                </div>

                {/* Legal System Selector */}
                <div className="p-6 bg-black/30 rounded-2xl border border-white/5 space-y-4">
                  <div className="flex items-center space-x-3 mb-1">
                    <Scale className="w-5 h-5 text-primary" />
                    <h3 className="text-xl font-display font-semibold">Legal System</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Select the jurisdiction. The AI will cite relevant statutes, follow procedural rules, and argue within that legal framework.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                    {LEGAL_SYSTEMS.map((sys) => (
                      <button
                        key={sys.value}
                        type="button"
                        onClick={() => setLegalSystem(sys.value)}
                        className={`p-3 rounded-xl border text-left transition-all duration-200 ${
                          legalSystem === sys.value
                            ? "bg-primary/15 border-primary/50 shadow-[0_0_20px_rgba(212,175,55,0.15)]"
                            : "bg-white/3 border-white/5 hover:border-white/15 hover:bg-white/5"
                        }`}
                      >
                        <div className="text-2xl mb-2">{sys.flag}</div>
                        <div className={`text-sm font-bold ${legalSystem === sys.value ? "text-primary" : "text-white/80"}`}>
                          {sys.label}
                        </div>
                        <div className="text-[10px] text-white/40 mt-0.5 leading-tight">{sys.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* AI Demeanor Selector */}
                <div className="p-6 bg-black/30 rounded-2xl border border-white/5 space-y-4">
                  <div className="flex items-center space-x-3 mb-1">
                    <BrainCircuit className="w-5 h-5 text-primary" />
                    <h3 className="text-xl font-display font-semibold">AI Demeanor</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Set the personality style of all AI courtroom actors. This shapes how the Judge, Prosecutor, and Defense AI behave.
                  </p>
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    {AI_DEMEANORS.map((d) => (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => setDemeanor(d.value)}
                        className={`p-3 rounded-xl border text-left transition-all duration-200 ${
                          demeanor === d.value
                            ? "bg-primary/15 border-primary/50 shadow-[0_0_20px_rgba(212,175,55,0.15)]"
                            : "bg-white/3 border-white/5 hover:border-white/15 hover:bg-white/5"
                        }`}
                      >
                        <div className="text-2xl mb-2">{d.icon}</div>
                        <div className={`text-sm font-bold ${demeanor === d.value ? "text-primary" : "text-white/80"}`}>
                          {d.label}
                        </div>
                        <div className="text-[10px] text-white/40 mt-0.5 leading-tight">{d.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Role Assignments */}
                <div className="p-6 bg-black/30 rounded-2xl border border-white/5 space-y-6">
                  <div className="flex items-center space-x-3 mb-2">
                    <Settings2 className="w-5 h-5 text-primary" />
                    <h3 className="text-xl font-display font-semibold">Role Assignments</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-6">
                    Select which roles you wish to control. Unselected roles will be autonomously powered by AI. Leave all off to watch the entire trial unfold on its own.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <RoleSwitch label="The Judge" color="bg-primary/20 text-primary border-primary/30" checked={roles.judge} onChange={(v) => setRoles(r => ({ ...r, judge: v }))} />
                    <RoleSwitch label="Prosecutor" color="bg-blue-500/20 text-blue-400 border-blue-500/30" checked={roles.prosecutor} onChange={(v) => setRoles(r => ({ ...r, prosecutor: v }))} />
                    <RoleSwitch label="Defense" color="bg-emerald-500/20 text-emerald-400 border-emerald-500/30" checked={roles.defense} onChange={(v) => setRoles(r => ({ ...r, defense: v }))} />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={createCase.isPending}
                  className="w-full h-16 text-lg font-bold rounded-xl bg-gradient-to-r from-primary/90 to-primary hover:from-primary hover:to-amber-400 text-primary-foreground shadow-[0_0_40px_rgba(212,175,55,0.2)] hover:shadow-[0_0_60px_rgba(212,175,55,0.4)] transition-all duration-300"
                >
                  {createCase.isPending ? "Preparing Chambers..." : "Enter Courtroom"}
                  {!createCase.isPending && <Play className="ml-2 w-5 h-5" />}
                </Button>
              </form>
            </div>
          </motion.div>

          {/* Recent Cases Sidebar */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="lg:col-span-4"
          >
            <div className="glass-panel p-6 rounded-3xl h-full flex flex-col">
              <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-white/10">
                <FileText className="w-6 h-6 text-white/70" />
                <h3 className="text-xl font-display font-semibold text-white/90">Recent Dockets</h3>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 space-y-3 transcript-scroll">
                {loadingCases ? (
                  <div className="text-center py-10 text-white/30">Retrieving records...</div>
                ) : !caseList?.cases?.length ? (
                  <div className="text-center py-10 text-white/30">No active cases found.</div>
                ) : (
                  caseList.cases.map((c) => {
                    const hasVerdict = c.verdict != null;
                    const phaseColor = PHASE_STATUS_COLOR[c.phase] ?? "text-primary";
                    return (
                      <div
                        key={c.caseId}
                        className="w-full text-left p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-primary/50 transition-all duration-200 group cursor-pointer relative"
                        onClick={() => navigate(`/case/${c.caseId}`)}
                      >
                        <h4 className="font-semibold text-white/90 truncate pr-10">{c.title}</h4>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-white/5 border border-white/10 ${phaseColor}`}>
                              {PHASE_LABELS[c.phase] ?? c.phase.replace(/_/g, " ")}
                            </span>
                            {hasVerdict && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 uppercase tracking-wider">
                                {c.verdict!.outcome}
                              </span>
                            )}
                          </div>
                          <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-primary transition-colors shrink-0 ml-2" />
                        </div>
                        {hasVerdict && (
                          <p className="text-[10px] text-white/40 mt-1.5 line-clamp-1 italic">{c.verdict!.summary}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[9px] font-mono text-white/30">{format(new Date(c.createdAt), "MMM dd, yyyy · HH:mm")}</span>
                          {c.demeanor && c.demeanor !== "formal" && (
                            <span className="text-[9px] text-white/25">
                              {c.demeanor === "aggressive" ? "⚔️" : "🎭"} {c.demeanor}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={(e) => handleDeleteCase(c.caseId, e)}
                          disabled={deletingId === c.caseId}
                          className="absolute top-3 right-3 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-all"
                          title="Dismiss case"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function RoleSwitch({ label, color, checked, onChange }: { label: string; color: string; checked: boolean; onChange: (val: boolean) => void }) {
  return (
    <div className={`p-4 rounded-xl border flex flex-col justify-between h-28 transition-colors ${checked ? color : "border-white/5 bg-white/5 text-white/50"}`}>
      <div className="font-semibold">{label}</div>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider">{checked ? "User" : "AI"}</span>
        <Switch checked={checked} onCheckedChange={onChange} className={checked ? "data-[state=checked]:bg-current" : ""} />
      </div>
    </div>
  );
}
