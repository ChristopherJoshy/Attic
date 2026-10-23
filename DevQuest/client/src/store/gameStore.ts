import { create } from 'zustand';

interface GameState {
  currentZone: string;
  setCurrentZone: (zone: string) => void;
  
  isMobileMenuOpen: boolean;
  setMobileMenuOpen: (isOpen: boolean) => void;
  
  isMusicPlaying: boolean;
  toggleMusic: () => void;
  setMusicPlaying: (isPlaying: boolean) => void;
}

export const useGameStore = create<GameState>((set) => ({
  currentZone: 'home',
  setCurrentZone: (zone) => set({ currentZone: zone }),
  
  isMobileMenuOpen: false,
  setMobileMenuOpen: (isOpen) => set({ isMobileMenuOpen: isOpen }),
  
  isMusicPlaying: false,
  toggleMusic: () => set((state) => ({ isMusicPlaying: !state.isMusicPlaying })),
  setMusicPlaying: (isPlaying) => set({ isMusicPlaying: isPlaying }),
}));
