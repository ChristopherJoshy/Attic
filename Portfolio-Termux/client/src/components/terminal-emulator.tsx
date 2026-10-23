import { useEffect, useRef } from 'react';
import { useTerminal } from '@/hooks/use-terminal';
import { TerminalLine } from '@/types/terminal';

export function TerminalEmulator() {
  const { state, handleKeyDown, getPrompt } = useTerminal();
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);

  // Focus management
  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      // Skip all terminal handling if user is in a modal or form input
      const target = event.target as Element;
      const isInModal = target.closest('[role="dialog"]') || target.closest('[data-state="open"]') || target.closest('.fixed');
      const isFormElement = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName);
      const isContentEditable = target.hasAttribute('contenteditable');
      
      // Only handle terminal events if not in a form or modal
      if (!isInModal && !isFormElement && !isContentEditable) {
        handleKeyDown(event);
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [handleKeyDown]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [state.output]);

  const renderLine = (line: TerminalLine) => {
    switch (line.type) {
      case 'command':
        const promptData = getPrompt();
        return (
          <div key={line.id} className="flex items-start mb-1">
            <span className={promptData.isAdmin ? 'text-red-400' : 'text-green-400'}>
              {promptData.user}@{promptData.host}
            </span>
            <span className="text-white">:</span>
            <span className="text-blue-400">{promptData.path}</span>
            <span className="text-white">{promptData.symbol} </span>
            <span className="text-white">{line.content}</span>
          </div>
        );
      
      case 'output':
        // Handle clickable links in output
        const processedContent = line.content.split('\n').map((textLine, idx) => {
          // Check for URLs in the line
          const urlRegex = /(https?:\/\/[^\s]+)/g;
          const parts = textLine.split(urlRegex);
          
          return (
            <div key={idx} className="terminal-line">
              {parts.map((part, partIdx) => {
                if (part.match(urlRegex)) {
                  return (
                    <a
                      key={partIdx}
                      href={part}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        e.preventDefault();
                        window.open(part, '_blank');
                      }}
                      className="text-blue-400 hover:text-blue-300 hover:underline cursor-pointer"
                    >
                      {part}
                    </a>
                  );
                }
                return <span key={partIdx}>{part}</span>;
              })}
            </div>
          );
        });

        return (
          <div key={line.id} className="terminal-output mb-2">
            <pre className="text-white whitespace-pre-wrap font-mono">
              {processedContent}
            </pre>
          </div>
        );
      
      case 'error':
        return (
          <div key={line.id} className="terminal-output mb-2 text-red-400">
            <pre className="whitespace-pre-wrap font-mono">
              {line.content}
            </pre>
          </div>
        );
      
      case 'loading':
        return (
          <div key={line.id} className="terminal-output mb-2">
            <pre className="text-white whitespace-pre-wrap font-mono">
              {line.content}
            </pre>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="h-screen w-screen bg-black text-white font-mono overflow-hidden terminal-container">
      <div className="h-full flex flex-col">
        {/* Terminal Content */}
        <div 
          ref={outputRef}
          className="flex-1 p-4 overflow-y-auto terminal-scrollbar terminal-output"
          style={{ scrollBehavior: 'smooth' }}
        >
          {/* Output History */}
          <div className="space-y-0">
            {state.output.map(renderLine)}
          </div>

          {/* Current Input Line */}
          {!state.isProcessing && (
            <div className="flex items-center mt-2">
              <span className={state.isAdminMode ? 'text-red-400' : 'text-green-400'}>
                {getPrompt().user}@{getPrompt().host}
              </span>
              <span className="text-white">:</span>
              <span className="text-blue-400">{getPrompt().path}</span>
              <span className="text-white">{getPrompt().symbol} </span>
              <span className="text-white">{state.currentInput}</span>
              <span 
                className={`inline-block w-2 h-4 ml-0 ${
                  state.cursorVisible ? 'bg-white text-black' : 'bg-transparent'
                } transition-colors duration-100`}
              >
                █
              </span>
            </div>
          )}

          {/* Processing Indicator */}
          {state.isProcessing && (
            <div className="flex items-center mt-2">
              <span className="text-gray-400">Processing...</span>
            </div>
          )}
        </div>
      </div>

      {/* Hidden input for mobile accessibility */}
      <input
        ref={inputRef as any}
        className="absolute -left-9999px opacity-0"
        value={state.currentInput}
        onChange={() => {}} // Handled by keydown
        autoFocus
        aria-label="Terminal input"
      />
    </div>
  );
}
