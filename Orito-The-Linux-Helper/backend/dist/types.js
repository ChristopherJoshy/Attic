import { z } from 'zod';
export const TierEnum = z.enum(['trial', 'free', 'pro']);
export const AgentType = z.enum([
    'research',
    'planner',
    'validator',
    'synthesizer',
    'curious',
    'custom',
]);
export const RiskLevel = z.enum(['low', 'medium', 'high']);
export const IntentType = z.enum(['info', 'action', 'repair', 'system_discovery']);
export const ComplexityLevel = z.enum(['simple', 'moderate', 'complex', 'decline']);
export const ResearchStrategy = z.enum(['quick', 'deep', 'adaptive']);
//# sourceMappingURL=types.js.map