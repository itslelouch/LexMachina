import { motion } from "framer-motion";

export function TypingIndicator({ role }: { role?: 'judge' | 'prosecutor' | 'defense' }) {
  let colorClass = "bg-primary"; // default judge/gold
  if (role === 'prosecutor') colorClass = "bg-blue-500";
  if (role === 'defense') colorClass = "bg-emerald-500";

  return (
    <div className="flex items-center space-x-2 p-4 glass-panel rounded-2xl w-fit max-w-[100px]">
      {[0, 1, 2].map((dot) => (
        <motion.div
          key={dot}
          className={`w-2 h-2 rounded-full ${colorClass}`}
          animate={{ y: ["0%", "-50%", "0%"], opacity: [0.5, 1, 0.5] }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            ease: "easeInOut",
            delay: dot * 0.15,
          }}
        />
      ))}
    </div>
  );
}
