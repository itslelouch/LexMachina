import { motion } from "framer-motion";
import { format } from "date-fns";
import { Scale, Shield, Sword, Cpu, User } from "lucide-react";
import type { TranscriptEntry } from "@workspace/api-client-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function TranscriptEntryCard({ entry }: { entry: TranscriptEntry }) {
  const isSystem = entry.role === 'system';
  const isJudge = entry.role === 'judge';
  const isProsecutor = entry.role === 'prosecutor';
  const isDefense = entry.role === 'defense';
  const isUser = entry.controlledBy === 'user';

  if (isSystem) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-center my-6"
      >
        <div className="bg-white/5 border border-white/10 px-6 py-2 rounded-full text-xs text-muted-foreground tracking-widest uppercase font-semibold flex items-center space-x-2 shadow-lg backdrop-blur-sm">
          <span>•</span>
          <span>{entry.content}</span>
          <span>•</span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={cn(
        "flex w-full mb-8",
        isJudge ? "justify-center" : isProsecutor ? "justify-start" : "justify-end"
      )}
    >
      <div className={cn(
        "max-w-[80%] md:max-w-[70%] relative group transition-all duration-300",
        isJudge ? "w-full md:w-[85%]" : ""
      )}>
        {/* Glow effect */}
        <div className={cn(
          "absolute -inset-0.5 rounded-2xl opacity-20 blur-xl transition-opacity duration-500 group-hover:opacity-40",
          isJudge ? "bg-primary" : isProsecutor ? "bg-blue-500" : "bg-emerald-500"
        )} />
        
        <div className={cn(
          "relative glass-panel rounded-2xl p-6 md:p-8",
          isJudge ? "border-primary/30 shadow-[0_0_30px_rgba(212,175,55,0.1)]" : 
          isProsecutor ? "border-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.1)]" : 
          "border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.1)]"
        )}>
          
          <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-4">
            <div className="flex items-center space-x-3">
              <div className={cn(
                "p-2 rounded-xl shadow-inner",
                isJudge ? "bg-primary/20 text-primary" : 
                isProsecutor ? "bg-blue-500/20 text-blue-400" : 
                "bg-emerald-500/20 text-emerald-400"
              )}>
                {isJudge && <Scale className="w-5 h-5" />}
                {isProsecutor && <Sword className="w-5 h-5" />}
                {isDefense && <Shield className="w-5 h-5" />}
              </div>
              <div>
                <h4 className={cn(
                  "font-display font-bold text-lg tracking-wide",
                  isJudge ? "text-primary" : 
                  isProsecutor ? "text-blue-400" : 
                  "text-emerald-400"
                )}>
                  {entry.speaker}
                </h4>
                <div className="flex items-center space-x-2 mt-0.5">
                  <span className="text-xs text-muted-foreground font-medium">
                    {format(new Date(entry.timestamp), "HH:mm:ss")}
                  </span>
                  <span className="text-white/20 text-xs">•</span>
                  <div className="flex items-center space-x-1 text-xs font-semibold text-muted-foreground">
                    {isUser ? (
                      <><User className="w-3 h-3 text-primary" /><span className="text-primary">USER</span></>
                    ) : (
                      <><Cpu className="w-3 h-3 text-white/50" /><span className="text-white/50">AI</span></>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="prose prose-invert max-w-none text-white/90 leading-relaxed font-sans prose-p:my-2 prose-strong:text-white">
            {entry.content.split('\n').map((paragraph, idx) => (
              paragraph.trim() ? <p key={idx}>{paragraph}</p> : null
            ))}
          </div>

        </div>
      </div>
    </motion.div>
  );
}
