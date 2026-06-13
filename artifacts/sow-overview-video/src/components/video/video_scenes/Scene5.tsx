import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 600),
      setTimeout(() => setPhase(2), 2000),
      setTimeout(() => setPhase(3), 3500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center z-10"
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        className="w-24 h-24 rounded-full border border-[var(--bank-gold)] flex items-center justify-center mb-8 bg-[var(--color-bg-dark)]"
        initial={{ opacity: 0, scale: 0 }}
        animate={phase >= 1 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      >
        <div className="w-12 h-12 bg-[var(--bank-gold)] rounded-full"></div>
      </motion.div>

      <div className="text-center overflow-hidden">
        <motion.h2 
          className="text-[4vw] font-display leading-tight text-gradient-gold mb-4"
          initial={{ y: '100%' }}
          animate={phase >= 2 ? { y: 0 } : { y: '100%' }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        >
          Audit-Ready Workflow.
        </motion.h2>
      </div>

      <motion.p 
        className="text-[1.5vw] font-light text-[var(--color-text-secondary)] tracking-wide"
        initial={{ opacity: 0 }}
        animate={phase >= 3 ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 1 }}
      >
        Fragmented compliance, unified.
      </motion.p>
    </motion.div>
  );
}
