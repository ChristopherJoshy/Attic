export declare function validateCommand(command: string, detectedPM: string | null): {
    blocked: boolean;
    risk: 'low' | 'medium' | 'high';
    reason: string;
    incompatiblePM: boolean;
};
export declare function getDryRunEquivalent(command: string): string | null;
//# sourceMappingURL=command-validator.d.ts.map