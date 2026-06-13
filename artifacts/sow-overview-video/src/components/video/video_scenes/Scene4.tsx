import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 2500),
      setTimeout(() => setPhase(4), 3500),
      setTimeout(() => setPhase(5), 6500), // begin exit
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-between px-[10vw] z-10"
      initial={{ opacity: 0, y: '20vh' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="w-[45%]">
        <motion.h2 
          className="text-[4vw] font-display leading-tight mb-6"
          initial={{ opacity: 0, x: -30 }}
          animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 }}
          transition={{ duration: 1 }}
        >
          Dynamic <br/><span className="text-gradient-gold italic">Due Diligence</span>
        </motion.h2>
        
        <div className="flex flex-col gap-6 mt-8">
          {[
            "Live Completion %", 
            "Real-time Risk Rating", 
            "Voice-to-text Capture"
          ].map((feature, i) => (
            <motion.div 
              key={feature}
              className="flex items-center gap-4 text-[1.5vw] font-light text-[var(--color-text-secondary)]"
              initial={{ opacity: 0, x: -20 }}
              animate={phase >= i + 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
              transition={{ duration: 0.8 }}
            >
              <div className="w-2 h-2 rounded-full bg-[var(--bank-gold)]"></div>
              {feature}
            </motion.div>
          ))}
        </div>
      </div>

      <div className="w-[45%] relative h-[60vh] flex items-center justify-center">
        <motion.div 
          className="w-full max-w-md bg-[var(--color-bg-muted)]/20 border border-[var(--color-bg-muted)] backdrop-blur-md rounded-2xl p-8"
          initial={{ opacity: 0, scale: 0.8, rotateZ: -5 }}
          animate={phase >= 2 ? { opacity: 1, scale: 1, rotateZ: 0 } : { opacity: 0, scale: 0.8, rotateZ: -5 }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        >
          <div className="flex justify-between items-center mb-8">
            <div className="text-[1.2vw] font-medium text-[var(--color-text-primary)]">Assessment Progress</div>
            <motion.div 
              className="text-[1.5vw] font-mono text-[var(--bank-gold)]"
              initial={{ opacity: 0 }}
              animate={phase >= 4 ? { opacity: 1 } : { opacity: 0 }}
            >
              87%
            </motion.div>
          </div>
          
          <div className="w-full h-2 bg-[var(--color-bg-dark)] rounded-full overflow-hidden mb-8">
            <motion.div 
              className="h-full bg-[var(--bank-gold)]"
              initial={{ width: 0 }}
              animate={phase >= 4 ? { width: '87%' } : { width: 0 }}
              transition={{ duration: 2, ease: "easeOut" }}
            />
          </div>

          <div className="space-y-4">
            <div className="h-10 bg-[var(--color-bg-dark)]/50 rounded flex items-center px-4 border border-[var(--bank-gold)]/30">
              <div className="w-3 h-3 rounded-full bg-[var(--color-success)] mr-4"></div>
              <div className="w-32 h-2 bg-[var(--color-bg-muted)] rounded"></div>
            </div>
            <div className="h-10 bg-[var(--color-bg-dark)]/50 rounded flex items-center px-4">
              <div className="w-3 h-3 rounded-full bg-[var(--color-text-muted)] mr-4"></div>
              <div className="w-24 h-2 bg-[var(--color-bg-muted)] rounded"></div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
