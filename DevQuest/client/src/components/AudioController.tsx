import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { getAssetPath } from '@/utils/paths';

export default function AudioController() {
  const { isMusicPlaying, setMusicPlaying } = useGameStore();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Create audio element if it doesn't exist
    if (!audioRef.current) {
      const audio = new Audio();
      audio.src = getAssetPath('assets/music/background/main-theme.mp3');
      audio.loop = true;
      audio.volume = 0.2;
      audio.preload = 'auto';
      
      audio.addEventListener('canplaythrough', () => {
        if (isMusicPlaying) {
          audio.play().catch(error => {
            console.error('Audio playback failed:', error);
          });
        }
      });
      
      audio.addEventListener('error', (e) => {
        console.error('Audio error:', e);
      });
      
      audioRef.current = audio;
    }

    // Handle play/pause based on music toggle state
    if (audioRef.current) {
      if (isMusicPlaying) {
        audioRef.current.play().catch(error => {
          console.error('Audio playback failed:', error);
        });
      } else {
        audioRef.current.pause();
      }
    }

    // Cleanup
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, [isMusicPlaying]);

  return null;
}
