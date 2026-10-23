import { useState, useEffect, useCallback, useRef } from "react";
import { TerminalState, TerminalLine, CommandContext, CommandResult } from "@/types/terminal";
import { terminalCommands } from "@/lib/commands";
import { terminalAudio } from "@/lib/audio";
import { nanoid } from "nanoid";

const CURSOR_BLINK_INTERVAL = 1000;
const ADMIN_SESSION_TIMEOUT = 3600000; // 1 hour

export function useTerminal() {
  const [state, setState] = useState<TerminalState>({
    output: [
      {
        id: nanoid(),
        type: 'output',
        content: `██████╗  ██████╗ ██████╗ ████████╗███████╗ ██████╗ ██╗     ██╗ ██████╗ 
██╔══██╗██╔═══██╗██╔══██╗╚══██╔══╝██╔════╝██╔═══██╗██║     ██║██╔═══██╗
██████╔╝██║   ██║██████╔╝   ██║   █████╗  ██║   ██║██║     ██║██║   ██║
██╔═══╝ ██║   ██║██╔══██╗   ██║   ██╔══╝  ██║   ██║██║     ██║██║   ██║
██║     ╚██████╔╝██║  ██║   ██║   ██║     ╚██████╔╝███████╗██║╚██████╔╝
╚═╝      ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚═╝      ╚═════╝ ╚══════╝╚═╝ ╚═════╝ 
                                                                        
           Welcome to Christopher Joshy's Developer Portfolio
                    Type 'help' to get started`,
        timestamp: new Date(),
      }
    ],
    currentInput: '',
    commandHistory: [],
    historyIndex: -1,
    isAdminMode: false,
    isProcessing: false,
    cursorVisible: true,
  });

  const adminSessionRef = useRef<number>(0);
  const cursorIntervalRef = useRef<NodeJS.Timeout>();

  // Cursor blink animation
  useEffect(() => {
    cursorIntervalRef.current = setInterval(() => {
      setState(prev => ({ ...prev, cursorVisible: !prev.cursorVisible }));
    }, CURSOR_BLINK_INTERVAL);

    return () => {
      if (cursorIntervalRef.current) {
        clearInterval(cursorIntervalRef.current);
      }
    };
  }, []);

  // Admin session timeout
  useEffect(() => {
    if (state.isAdminMode && adminSessionRef.current > 0) {
      const timeout = setTimeout(() => {
        setState(prev => ({ ...prev, isAdminMode: false }));
        addOutput({
          type: 'output',
          content: '⏰ Admin session expired. Please authenticate again.',
        });
      }, ADMIN_SESSION_TIMEOUT);

      return () => clearTimeout(timeout);
    }
  }, [state.isAdminMode]);

  const addOutput = useCallback((line: Omit<TerminalLine, 'id' | 'timestamp'>) => {
    const newLine: TerminalLine = {
      ...line,
      id: nanoid(),
      timestamp: new Date(),
    };

    setState(prev => ({
      ...prev,
      output: [...prev.output, newLine],
    }));
  }, []);

  const clearTerminal = useCallback(() => {
    setState(prev => ({
      ...prev,
      output: [],
    }));
  }, []);

  const executeCommand = useCallback(async (command: string) => {
    if (!command.trim() || state.isProcessing) return;

    setState(prev => ({ ...prev, isProcessing: true }));

    // Add command to output
    const prompt = state.isAdminMode ? 
      'christopher@portfolio:~# ' : 
      'christopher@portfolio:~$ ';

    addOutput({
      type: 'command',
      content: command,
      prompt,
    });

    // Add to history
    setState(prev => ({
      ...prev,
      commandHistory: [...prev.commandHistory, command],
      historyIndex: prev.commandHistory.length + 1,
      currentInput: '',
    }));

    try {
      const context: CommandContext = {
        isAdminMode: state.isAdminMode,
        args: command.split(' ').slice(1),
        fullCommand: command,
      };

      const result: CommandResult = await terminalCommands.executeCommand(command, context);

      if (result.shouldClear) {
        clearTerminal();
      } else if (result.loading) {
        // Show loading animation
        await simulateLoading(result.loading.message, result.loading.duration);
      }

      if (result.output) {
        addOutput({
          type: result.success ? 'output' : 'error',
          content: result.output,
        });
      }

      // Handle admin mode changes
      if (command.startsWith('admin') && command.includes('passwordissoory')) {
        setState(prev => ({ ...prev, isAdminMode: true }));
        adminSessionRef.current = Date.now();
      } else if (command === 'exit' && state.isAdminMode) {
        setState(prev => ({ ...prev, isAdminMode: false }));
        adminSessionRef.current = 0;
      }

      if (!result.success) {
        terminalAudio.playErrorSound();
      }
    } catch (error) {
      console.error('Terminal command error:', error);
      addOutput({
        type: 'error',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
      });
      terminalAudio.playErrorSound().catch(e => console.warn('Audio error:', e));
    } finally {
      setState(prev => ({ ...prev, isProcessing: false }));
    }
  }, [state.isAdminMode, state.isProcessing, addOutput, clearTerminal]);

  const simulateLoading = useCallback(async (message: string, duration: number) => {
    return new Promise<void>((resolve) => {
      let progress = 0;
      const steps = 20;
      const stepDuration = duration / steps;

      const loadingLine: TerminalLine = {
        id: nanoid(),
        type: 'loading',
        content: `${message}\n[░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 0%`,
        timestamp: new Date(),
      };

      setState(prev => ({
        ...prev,
        output: [...prev.output, loadingLine],
      }));

      const interval = setInterval(() => {
        progress += 100 / steps;
        const filledBars = Math.floor((progress / 100) * 50);
        const emptyBars = 50 - filledBars;
        const progressBar = '█'.repeat(filledBars) + '░'.repeat(emptyBars);
        
        setState(prev => ({
          ...prev,
          output: prev.output.map(line => 
            line.id === loadingLine.id 
              ? { ...line, content: `${message}\n[${progressBar}] ${Math.floor(progress)}%` }
              : line
          ),
        }));

        if (progress >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setState(prev => ({
              ...prev,
              output: prev.output.filter(line => line.id !== loadingLine.id),
            }));
            resolve();
          }, 500);
        }
      }, stepDuration);
    });
  }, []);

  const handleKeyDown = useCallback(async (event: KeyboardEvent) => {
    if (state.isProcessing) return;

    switch (event.key) {
      case 'Enter':
        event.preventDefault();
        if (state.currentInput.trim()) {
          terminalAudio.playEnterSound();
          await executeCommand(state.currentInput);
        }
        break;

      case 'Backspace':
        event.preventDefault();
        if (state.currentInput.length > 0) {
          terminalAudio.playKeypressSound();
          setState(prev => ({
            ...prev,
            currentInput: prev.currentInput.slice(0, -1),
          }));
        }
        break;

      case 'ArrowUp':
        event.preventDefault();
        if (state.historyIndex > 0) {
          const newIndex = state.historyIndex - 1;
          setState(prev => ({
            ...prev,
            historyIndex: newIndex,
            currentInput: prev.commandHistory[newIndex] || '',
          }));
        }
        break;

      case 'ArrowDown':
        event.preventDefault();
        if (state.historyIndex < state.commandHistory.length - 1) {
          const newIndex = state.historyIndex + 1;
          setState(prev => ({
            ...prev,
            historyIndex: newIndex,
            currentInput: prev.commandHistory[newIndex] || '',
          }));
        } else {
          setState(prev => ({
            ...prev,
            historyIndex: prev.commandHistory.length,
            currentInput: '',
          }));
        }
        break;

      case 'Tab':
        event.preventDefault();
        // TODO: Implement command auto-completion
        break;

      case 'c':
        if (event.ctrlKey) {
          event.preventDefault();
          // Ctrl+C - Interrupt current command or clear current input
          if (state.isProcessing) {
            setState(prev => ({ ...prev, isProcessing: false }));
            addOutput({
              type: 'error',
              content: '^C',
            });
          } else if (state.currentInput.length > 0) {
            setState(prev => ({ ...prev, currentInput: '' }));
            addOutput({
              type: 'output',
              content: '^C',
            });
          }
        } else if (event.key.length === 1 && !event.altKey && !event.metaKey) {
          event.preventDefault();
          terminalAudio.playKeypressSound();
          setState(prev => ({
            ...prev,
            currentInput: prev.currentInput + event.key,
          }));
        }
        break;

      case 'v':
        if (event.ctrlKey) {
          event.preventDefault();
          // Ctrl+V - Paste from clipboard
          try {
            navigator.clipboard.readText().then(text => {
              if (text) {
                setState(prev => ({
                  ...prev,
                  currentInput: prev.currentInput + text,
                }));
              }
            }).catch(() => {
              // Fallback - show paste notification
              addOutput({
                type: 'output',
                content: 'Paste with Ctrl+V (clipboard access required)',
              });
            });
          } catch (error) {
            addOutput({
              type: 'output',
              content: 'Clipboard access not available',
            });
          }
        } else if (event.key.length === 1 && !event.altKey && !event.metaKey) {
          event.preventDefault();
          terminalAudio.playKeypressSound();
          setState(prev => ({
            ...prev,
            currentInput: prev.currentInput + event.key,
          }));
        }
        break;

      default:
        if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
          event.preventDefault();
          terminalAudio.playKeypressSound();
          setState(prev => ({
            ...prev,
            currentInput: prev.currentInput + event.key,
          }));
        }
        break;
    }
  }, [state.currentInput, state.commandHistory, state.historyIndex, state.isProcessing, executeCommand]);

  const getPrompt = useCallback(() => {
    const symbol = state.isAdminMode ? '#' : '$';
    return {
      user: 'christopher',
      host: 'portfolio',
      path: '~',
      symbol: symbol,
      isAdmin: state.isAdminMode
    };
  }, [state.isAdminMode]);

  return {
    state,
    handleKeyDown,
    getPrompt,
    clearTerminal,
    addOutput,
  };
}
