/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * Modal Component - General purpose modal dialog.
 * Handles focus trapping, keyboard navigation, and animations.
 * 
 * --------------------------------------------------------------------------
 *                                  Functions
 * --------------------------------------------------------------------------
 * Modal: Main component.
 * handleKeyDown: Handles closing on Escape key.
 * 
 * --------------------------------------------------------------------------
 *                            Variables and others
 * --------------------------------------------------------------------------
 * ModalProps: Props interface.
 * sizeStyles: Tailwind classes for different sizes.
 * 
 * --------------------------------------------------------------------------
 *                                   imports
 * --------------------------------------------------------------------------
 * react: React core hooks.
 */

import React, { useEffect, useRef, useCallback } from 'react';

// ============================================================================
// Modal Component
// ============================================================================

export interface ModalProps {
    /** Whether the modal is open */
    isOpen: boolean;
    /** Handler called when modal should close */
    onClose: () => void;
    /** Modal title */
    title?: string;
    /** Modal description/subtitle */
    description?: string;
    /** Modal content */
    children: React.ReactNode;
    /** Size variant */
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    /** Whether to show close button */
    showCloseButton?: boolean;
    /** Whether clicking backdrop closes modal */
    closeOnBackdropClick?: boolean;
    /** Whether pressing Escape closes modal */
    closeOnEscape?: boolean;
    /** Additional className for the modal container */
    className?: string;
    /** Footer content */
    footer?: React.ReactNode;
}

const sizeStyles: Record<string, string> = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)]',
};

export function Modal({
    isOpen,
    onClose,
    title,
    description,
    children,
    size = 'md',
    showCloseButton = true,
    closeOnBackdropClick = true,
    closeOnEscape = true,
    className = '',
    footer,
}: ModalProps) {
    const modalRef = useRef<HTMLDivElement>(null);
    const previousActiveElement = useRef<HTMLElement | null>(null);

    // Handle escape key
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (closeOnEscape && e.key === 'Escape') {
            onClose();
        }
    }, [closeOnEscape, onClose]);

    // Focus management
    useEffect(() => {
        if (isOpen) {
            previousActiveElement.current = document.activeElement as HTMLElement;
            modalRef.current?.focus();
            document.body.style.overflow = 'hidden';
            document.addEventListener('keydown', handleKeyDown);
        } else {
            document.body.style.overflow = '';
            previousActiveElement.current?.focus();
        }

        return () => {
            document.body.style.overflow = '';
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, handleKeyDown]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-modal">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
                onClick={closeOnBackdropClick ? onClose : undefined}
                aria-hidden="true"
            />

            {/* Modal container */}
            <div className="absolute inset-0 flex items-center justify-center p-4">
                <div
                    ref={modalRef}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={title ? 'modal-title' : undefined}
                    aria-describedby={description ? 'modal-description' : undefined}
                    tabIndex={-1}
                    className={`
            relative w-full ${sizeStyles[size]}
            bg-bg-secondary/95 backdrop-blur-xl
            border border-surface-border
            rounded-2xl shadow-2xl
            animate-scale-in
            focus:outline-none
            ${className}
          `}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    {(title || showCloseButton) && (
                        <div className="px-6 py-5 border-b border-surface-border">
                            <div className="flex items-center justify-between">
                                <div>
                                    {title && (
                                        <h2
                                            id="modal-title"
                                            className="text-lg font-semibold tracking-tight text-text-primary"
                                        >
                                            {title}
                                        </h2>
                                    )}
                                    {description && (
                                        <p
                                            id="modal-description"
                                            className="text-xs text-text-muted mt-1"
                                        >
                                            {description}
                                        </p>
                                    )}
                                </div>

                                {showCloseButton && (
                                    <button
                                        onClick={onClose}
                                        className="p-1 text-text-muted hover:text-text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 rounded"
                                        aria-label="Close modal"
                                    >
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M18 6L6 18M6 6l12 12" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Content */}
                    <div className="max-h-[60vh] overflow-y-auto">
                        {children}
                    </div>

                    {/* Footer */}
                    {footer && (
                        <div className="px-6 py-4 border-t border-surface-border">
                            {footer}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Modal;
