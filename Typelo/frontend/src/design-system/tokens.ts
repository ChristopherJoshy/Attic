/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * Design Tokens - TypeScript definitions for the design system.
 * Provides type safety for accessing token values.
 * 
 * --------------------------------------------------------------------------
 *                                  Functions
 * --------------------------------------------------------------------------
 * None
 * 
 * --------------------------------------------------------------------------
 *                            Variables and others
 * --------------------------------------------------------------------------
 * tokens: The JSON object containing all design values.
 * ColorToken: Type for color keys.
 * SpacingToken: Type for spacing keys.
 * RadiusToken: Type for border radius keys.
 * ShadowToken: Type for box shadow keys.
 * BreakpointToken: Type for screen breakpoint keys.
 * 
 * --------------------------------------------------------------------------
 *                                   imports
 * --------------------------------------------------------------------------
 * tokensJson: Raw JSON data.
 */

import tokensJson from './tokens.json';

export const tokens = tokensJson;

export type ColorToken = keyof typeof tokens.color;
export type SpacingToken = keyof typeof tokens.spacing;
export type RadiusToken = keyof typeof tokens.radii;
export type ShadowToken = keyof typeof tokens.shadow;
export type BreakpointToken = keyof typeof tokens.breakpoints;
