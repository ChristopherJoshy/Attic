export interface TerminalState {
  output: TerminalLine[];
  currentInput: string;
  commandHistory: string[];
  historyIndex: number;
  isAdminMode: boolean;
  isProcessing: boolean;
  cursorVisible: boolean;
}

export interface TerminalLine {
  id: string;
  type: 'command' | 'output' | 'error' | 'loading';
  content: string;
  timestamp: Date;
  prompt?: string;
}

export interface LoadingAnimation {
  message: string;
  progress: number;
  duration: number;
}

export interface CommandContext {
  isAdminMode: boolean;
  args: string[];
  fullCommand: string;
}

export interface CommandResult {
  output: string;
  success: boolean;
  shouldClear?: boolean;
  loading?: LoadingAnimation;
}
