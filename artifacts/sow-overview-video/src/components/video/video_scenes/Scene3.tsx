import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 2500),
      setTimeout(() => setPhase(4), 6500), // begin exit
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center px-[10vw] z-10"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, filter: 'blur(10px)' }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="w-1/2 pr-12">
        <motion.h2 
          className="text-[4vw] font-display leading-tight mb-6"
          initial={{ opacity: 0, y: 30 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 1 }}
        >
          AI-Powered <br/><span className="text-gradient-gold">Prospecting</span>
        </motion.h2>
        <motion.p 
          className="text-[1.5vw] font-light text-[var(--color-text-secondary)] leading-relaxed"
          initial={{ opacity: 0 }}
          animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 1 }}
        >
          Live web research. Pre-meeting briefings. Structured cold-call tracks. All synthesized instantly.
        </motion.p>
      </div>

      <div className="w-1/2 relative h-[50vh]">
        <motion.div 
          className="absolute inset-0 border border-[var(--color-bg-muted)] bg-[var(--color-bg-dark)]/50 backdrop-blur-md rounded-xl p-8 flex flex-col gap-4"
          initial={{ x: '20vw', opacity: 0, rotateY: 20 }}
          animate={phase >= 3 ? { x: 0, opacity: 1, rotateY: 0 } : { x: '20vw', opacity: 0, rotateY: 20 }}
          transition={{ type: 'spring', stiffness: 100, damping: 20 }}
          style={{ perspective: 1000 }}
        >
          <div className="flex items-center gap-4 border-b border-[var(--color-bg-muted)] pb-4">
            <div className="w-12 h-12 rounded-full bg-[var(--bank-gold)]/20 flex items-center justify-center">
              <div className="w-6 h-6 bg-[var(--bank-gold)] rounded-full"></div>
            </div>
            <div>
              <div className="w-32 h-3 bg-[var(--color-bg-muted)] rounded mb-2"></div>
              <div className="w-24 h-2 bg-[var(--color-bg-muted)]/50 rounded"></div>
            </div>
          </div>
          <div className="flex-1 flex flex-col gap-3 mt-2">
            {[1, 2, 3].map((i) => (
              <motion.div 
                key={i}
                className="w-full h-8 bg-[var(--color-bg-muted)]/30 rounded"
                initial={{ opacity: 0, x: 20 }}
                animate={phase >= 3 ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
                transition={{ delay: i * 0.2, duration: 0.5 }}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
