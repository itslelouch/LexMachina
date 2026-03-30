import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { 
  Gavel, Sword, Shield, FileText, ChevronRight, Play, Settings, AlertCircle, 
  Plus, Upload, BrainCircuit, ArrowLeft, MoreVertical 
} from "lucide-react";

import { useLiveCase, useChatScroll, useSpeak, useTriggerAiTurn, useUpdateRoles, useAutoProceed, useUpdatePhase, useAddDevelopment } from "@/hooks/use-courtroom";
import type { CourtPhase } from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { TranscriptEntryCard } from "@/components/TranscriptEntryCard";
import { TypingIndicator } from "@/components/TypingIndicator";

export default function Courtroom() {
  const [, params] = useRoute("/case/:id");
  const caseId = params?.id;
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: session, isLoading, error } = useLiveCase(caseId || "");
  const scrollRef = useChatScroll(session?.transcript);

  const speak = useSpeak();
  const triggerAi = useTriggerAiTurn();
  const updateRoles = useUpdateRoles();
  const autoProceed = useAutoProceed();
  const updatePhase = useUpdatePhase();
  const addDev = useAddDevelopment();

  const [inputContent, setInputContent] = useState("");
  const [selectedRole, setSelectedRole] = useState<'judge'|'prosecutor'|'defense'|''>("");
  const [devTitle, setDevTitle] = useState("");
  const [devContent, setDevContent] = useState("");
  const [devOpen, setDevOpen] = useState(false);
  const [autoTriggerAi, setAutoTriggerAi] = useState(true);

  // Set default selected role when session loads
  useEffect(() => {
    if (session && !selectedRole) {
      if (session.roles.judge === 'user') setSelectedRole('judge');
      else if (session.roles.prosecutor === 'user') setSelectedRole('prosecutor');
      else if (session.roles.defense === 'user') setSelectedRole('defense');
    }
  }, [session, selectedRole]);

  if (!caseId) return null;
  if (isLoading) return <LoadingScreen />;
  if (error || !session) return <ErrorScreen onBack={() => navigate("/")} />;

  const isUserRole = (role: 'judge'|'prosecutor'|'defense') => session.roles[role] === 'user';
  const hasAnyUserRole = isUserRole('judge') || isUserRole('prosecutor') || isUserRole('defense');
  const isAiThinking = speak.isPending || triggerAi.isPending || autoProceed.isPending;

  const handleSpeak = async () => {
    if (!inputContent.trim() || !selectedRole) return;
    
    try {
      await speak.mutateAsync({
        caseId,
        data: {
          role: selectedRole as any,
          content: inputContent,
          triggerAiResponses: autoTriggerAi
        }
      });
      setInputContent("");
    } catch (e) {
      toast({ title: "Failed to send message", variant: "destructive" });
    }
  };

  const handleAiTurn = async (role: 'judge'|'prosecutor'|'defense') => {
    try {
      await triggerAi.mutateAsync({ caseId, data: { role } });
    } catch (e) {
      toast({ title: "Failed to trigger AI", variant: "destructive" });
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
    } catch (e) {
      toast({ title: "Failed to add development", variant: "destructive" });
    }
  };

  const nextPhaseMap: Record<CourtPhase, CourtPhase> = {
    opening_statements: 'prosecution_case',
    prosecution_case: 'defense_case',
    defense_case: 'closing_arguments',
    closing_arguments: 'verdict',
    verdict: 'concluded',
    concluded: 'concluded'
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden relative">
      {/* Background Decor */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-500/5 rounded-full blur-[120px]" />
      </div>

      {/* Top Header */}
      <header className="h-16 relative z-10 glass-panel border-b border-white/5 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="hover:bg-white/5 rounded-full">
            <ArrowLeft className="w-5 h-5 text-white/70" />
          </Button>
          <div className="w-px h-6 bg-white/10" />
          <h1 className="font-display font-bold text-xl text-white drop-shadow-md flex items-center">
            {session.title}
          </h1>
          <Badge variant="outline" className="ml-4 bg-white/5 border-white/10 text-primary font-semibold tracking-wider">
            {session.phase.replace('_', ' ').toUpperCase()}
          </Badge>
        </div>

        <div className="flex items-center space-x-6">
          <RoleToggle 
            role="Judge" icon={<Gavel className="w-4 h-4"/>} color="primary" 
            isUser={session.roles.judge === 'user'} 
            onToggle={(val) => updateRoles.mutate({ caseId, data: { roles: { ...session.roles, judge: val ? 'user' : 'ai' } }})} 
          />
          <RoleToggle 
            role="Prosecutor" icon={<Sword className="w-4 h-4"/>} color="blue-500" 
            isUser={session.roles.prosecutor === 'user'} 
            onToggle={(val) => updateRoles.mutate({ caseId, data: { roles: { ...session.roles, prosecutor: val ? 'user' : 'ai' } }})} 
          />
          <RoleToggle 
            role="Defense" icon={<Shield className="w-4 h-4"/>} color="emerald-500" 
            isUser={session.roles.defense === 'user'} 
            onToggle={(val) => updateRoles.mutate({ caseId, data: { roles: { ...session.roles, defense: val ? 'user' : 'ai' } }})} 
          />
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        
        {/* Left Sidebar - Case Context */}
        <aside className="w-80 border-r border-white/5 bg-black/20 flex flex-col shrink-0 overflow-hidden">
          <div className="p-4 border-b border-white/5 flex items-center space-x-2">
            <FileText className="w-5 h-5 text-primary" />
            <h2 className="font-display font-semibold text-lg">Case Docket</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 transcript-scroll space-y-6">
            <div>
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-3">Original Brief</h3>
              <div className="bg-white/5 border border-white/5 rounded-xl p-4 text-sm text-white/70 leading-relaxed font-sans prose prose-invert max-w-none">
                {session.caseText.split('\n').map((p, i) => <p key={i} className="my-1">{p}</p>)}
              </div>
            </div>

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
                        <Input value={devTitle} onChange={e=>setDevTitle(e.target.value)} className="bg-black/50 border-white/10" required/>
                      </div>
                      <div className="space-y-2">
                        <Label>Content</Label>
                        <Textarea value={devContent} onChange={e=>setDevContent(e.target.value)} className="bg-black/50 border-white/10 min-h-[150px]" required/>
                      </div>
                      <Button type="submit" disabled={addDev.isPending} className="w-full bg-primary hover:bg-primary/80 text-black font-bold">
                        {addDev.isPending ? "Submitting..." : "Submit to Record"}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
              
              {session.developments.length === 0 ? (
                <p className="text-xs text-white/30 italic text-center p-4 bg-black/20 rounded-xl">No developments added yet.</p>
              ) : (
                <div className="space-y-3">
                  {session.developments.map(dev => (
                    <div key={dev.id} className="bg-primary/5 border border-primary/20 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-sm font-semibold text-primary">{dev.title}</h4>
                        <span className="text-[10px] text-white/40">{format(new Date(dev.timestamp), 'HH:mm')}</span>
                      </div>
                      <p className="text-xs text-white/70 line-clamp-3">{dev.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="p-4 border-t border-white/5 bg-black/40">
            <Button 
              variant="outline" 
              className="w-full justify-between bg-white/5 border-white/10 hover:bg-white/10 hover:text-white"
              onClick={() => updatePhase.mutate({ caseId, data: { phase: nextPhaseMap[session.phase] }})}
              disabled={session.phase === 'concluded' || updatePhase.isPending}
            >
              <span>Advance Proceeding</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </aside>

        {/* Center - Transcript */}
        <main className="flex-1 flex flex-col min-w-0 bg-background/50 relative">
          
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 md:p-10 transcript-scroll scroll-smooth relative">
            <div className="max-w-4xl mx-auto pb-32">
              <AnimatePresence initial={false}>
                {session.transcript.map(entry => (
                  <TranscriptEntryCard key={entry.id} entry={entry} />
                ))}
                
                {isAiThinking && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-start w-full mb-8"
                  >
                    <TypingIndicator />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Bottom Input Area */}
          <div className="absolute bottom-0 left-0 right-0 p-6 pt-12 bg-gradient-to-t from-background via-background/90 to-transparent">
            <div className="max-w-4xl mx-auto glass-panel p-4 rounded-3xl border border-white/10 shadow-2xl relative">
              
              {!hasAnyUserRole ? (
                <div className="flex flex-col items-center justify-center py-4 space-y-4">
                  <div className="text-sm text-white/50 uppercase tracking-widest font-semibold flex items-center">
                    <BrainCircuit className="w-4 h-4 mr-2" />
                    Viewer Mode - AI Controls All Roles
                  </div>
                  <Button 
                    size="lg"
                    onClick={() => autoProceed.mutate({ caseId })}
                    disabled={autoProceed.isPending}
                    className="bg-primary hover:bg-primary/90 text-black font-bold px-12 rounded-xl h-14 text-lg shadow-[0_0_30px_rgba(212,175,55,0.3)] hover:shadow-[0_0_50px_rgba(212,175,55,0.5)] transition-all"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Auto Proceed Next Turns
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col space-y-3">
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center space-x-3">
                      <Select value={selectedRole} onValueChange={(v: any) => setSelectedRole(v)}>
                        <SelectTrigger className="w-[200px] bg-white/5 border-white/10 text-white font-semibold">
                          <SelectValue placeholder="Speak as..." />
                        </SelectTrigger>
                        <SelectContent className="bg-secondary border-white/10 text-white">
                          {isUserRole('judge') && <SelectItem value="judge">Judge</SelectItem>}
                          {isUserRole('prosecutor') && <SelectItem value="prosecutor">Prosecutor</SelectItem>}
                          {isUserRole('defense') && <SelectItem value="defense">Defense</SelectItem>}
                        </SelectContent>
                      </Select>
                      <div className="flex items-center space-x-2 text-xs text-white/50">
                        <Switch id="auto-ai" checked={autoTriggerAi} onCheckedChange={setAutoTriggerAi} className="scale-75" />
                        <Label htmlFor="auto-ai" className="cursor-pointer">Auto-trigger AI replies</Label>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Button variant="ghost" size="sm" onClick={() => handleAiTurn('judge')} disabled={isAiThinking || isUserRole('judge')} className="text-primary hover:bg-primary/20 hover:text-primary text-xs">
                        Judge AI
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleAiTurn('prosecutor')} disabled={isAiThinking || isUserRole('prosecutor')} className="text-blue-400 hover:bg-blue-500/20 hover:text-blue-400 text-xs">
                        Pros AI
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleAiTurn('defense')} disabled={isAiThinking || isUserRole('defense')} className="text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-400 text-xs">
                        Def AI
                      </Button>
                    </div>
                  </div>

                  <div className="flex space-x-3 items-end">
                    <Textarea 
                      value={inputContent}
                      onChange={e => setInputContent(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSpeak();
                        }
                      }}
                      placeholder="Type your statement to the court... (Press Enter to send)"
                      className="resize-none bg-black/40 border-white/10 text-base py-3 px-4 rounded-2xl focus:ring-primary/50"
                      rows={2}
                    />
                    <Button 
                      onClick={handleSpeak}
                      disabled={!inputContent.trim() || !selectedRole || speak.isPending}
                      className="h-[52px] px-8 rounded-2xl bg-primary hover:bg-primary/90 text-black font-bold shadow-[0_0_20px_rgba(212,175,55,0.2)]"
                    >
                      <Upload className="w-5 h-5" />
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

function RoleToggle({ role, icon, color, isUser, onToggle }: { role: string, icon: React.ReactNode, color: string, isUser: boolean, onToggle: (val: boolean) => void }) {
  return (
    <div className="flex items-center space-x-3 bg-black/40 rounded-full pl-1 pr-3 py-1 border border-white/5">
      <div className={`p-1.5 rounded-full bg-${color}/20 text-${color}`}>
        {icon}
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] font-bold uppercase text-white/50 tracking-wider leading-none">{role}</span>
        <span className={`text-xs font-bold leading-tight ${isUser ? 'text-white' : `text-${color}`}`}>
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
