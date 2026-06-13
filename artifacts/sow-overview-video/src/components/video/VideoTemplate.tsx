import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';

export const SCENE_DURATIONS = { intro: 6000, journey: 8000, prospecting: 8000, assessment: 8000, outro: 7000 };

const SCENE_COMPONENTS: Record<string, React.ComponentType> = {
  intro: Scene1,
  journey: Scene2,
  prospecting: Scene3,
  assessment: Scene4,
  outro: Scene5,
};

const SCENE_START_SEC: Record<string, number> = (() => {
  const out: Record<string, number> = {};
  let cumulativeMs = 0;
  for (const [key, ms] of Object.entries(SCENE_DURATIONS)) {
    out[key] = cumulativeMs / 1000;
    cumulativeMs += ms;
  }
  return out;
})();

const AUDIO_SEEK_EPSILON_SEC = 0.18;

export default function VideoTemplate({
  durations = SCENE_DURATIONS,
  loop = true,
  muted = false,
  onSceneChange,
}: {
  durations?: Record<string, number>;
  loop?: boolean;
  muted?: boolean;
  onSceneChange?: (sceneKey: string) => void;
} = {}) {
  const { currentSceneKey } = useVideoPlayer({ durations, loop });

  useEffect(() => {
    onSceneChange?.(currentSceneKey);
  }, [currentSceneKey, onSceneChange]);

  const baseSceneKey = currentSceneKey.replace(/_r[12]$/, '') as keyof typeof SCENE_DURATIONS;
  const sceneIndex = Object.keys(SCENE_DURATIONS).indexOf(baseSceneKey as string);
  const SceneComponent = SCENE_COMPONENTS[baseSceneKey as string];

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.45;
    const targetTime = SCENE_START_SEC[baseSceneKey as string] ?? 0;
    if (Math.abs(audio.currentTime - targetTime) > AUDIO_SEEK_EPSILON_SEC) {
      audio.currentTime = targetTime;
    }
    audio.play().catch(() => {});
  }, [currentSceneKey, baseSceneKey, muted]);

  return (
    <div className="relative w-full h-screen overflow-hidden" style={{ backgroundColor: 'var(--color-bg-dark)' }}>
      {/* Persistent Background Layer */}
      <div className="absolute inset-0">
        <motion.div 
          className="absolute w-[80vw] h-[80vw] rounded-full opacity-[0.08] blur-[100px]"
          style={{ background: 'radial-gradient(circle, var(--bank-gold), transparent)' }}
          animate={{ x: ['-20%', '10%', '-20%'], y: ['-20%', '30%', '-20%'], scale: [1, 1.2, 1] }}
          transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }} 
        />
        <motion.div 
          className="absolute right-0 bottom-0 w-[60vw] h-[60vw] rounded-full opacity-[0.15] blur-[80px]"
          style={{ background: 'radial-gradient(circle, var(--bank-blue), transparent)' }}
          animate={{ x: ['10%', '-20%', '10%'], y: ['10%', '-10%', '10%'] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }} 
        />
        {/* Subtle noise texture */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>
      </div>

      {/* Persistent Midground Layer */}
      <motion.div
        className="absolute h-[1px] bg-[var(--bank-gold)] opacity-50"
        animate={{
          left: ['10%', '20%', '5%', '15%', '0%'][sceneIndex] || '0%',
          width: ['0%', '60%', '90%', '70%', '100%'][sceneIndex] || '100%',
          top: ['50%', '80%', '20%', '40%', '90%'][sceneIndex] || '50%',
          opacity: sceneIndex === 0 ? 0 : 0.4,
        }}
        transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
      />
      
      {/* Golden accent shape */}
      <motion.div
        className="absolute border border-[var(--bank-gold)] opacity-10 rounded-sm"
        animate={{
          x: ['70vw', '10vw', '60vw', '-10vw', '35vw'][sceneIndex] || '50vw',
          y: ['-10vh', '60vh', '-20vh', '50vh', '35vh'][sceneIndex] || '50vh',
          width: ['20vw', '30vw', '15vw', '40vw', '10vw'][sceneIndex] || '20vw',
          height: ['20vw', '30vw', '15vw', '40vw', '10vw'][sceneIndex] || '20vw',
          rotate: [0, 45, 90, 135, 180][sceneIndex] || 0,
        }}
        transition={{ duration: 2, ease: [0.16, 1, 0.3, 1] }}
      />

      <AnimatePresence mode="popLayout">
        {SceneComponent && <SceneComponent key={currentSceneKey} />}
      </AnimatePresence>

      <audio
        ref={audioRef}
        src={`${import.meta.env.BASE_URL}audio/bg_music.mp3`}
        preload="auto"
        autoPlay
        muted={muted}
      />
    </div>
  );
}
