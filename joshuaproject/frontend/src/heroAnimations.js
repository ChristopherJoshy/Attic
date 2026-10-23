/**
 * heroAnimations.js
 * ------------------------------------------------------------------
 * Ambient cloud-drift & bird-flight animations for the hero section.
 * Desktop-only (≥901px), respects prefers-reduced-motion.
 * Uses anime.js v4 animate() — no CSS @keyframes, no GSAP.
 * ------------------------------------------------------------------
 */

import { animate } from 'animejs';

// ─── Cloud configuration ────────────────────────────────────────────
// Each cloud drifts across the full viewport width at a different speed.
// translateX values use vw-based pixel estimates so the cloud travels
// fully off one edge before looping. anime.js v4 auto-resets on loop.
const CLOUD_CONFIGS = [
    {
        selector: '.hero-cloud--1',
        duration: 75000,            // ~75s to cross — slow, ambient
        translateX: ['-10vw', '110vw'],  // left edge → right edge
        easing: 'linear',
    },
    {
        selector: '.hero-cloud--2',
        duration: 55000,            // slightly faster mid-layer
        translateX: ['-30vw', '100vw'],
        easing: 'linear',
    },
    {
        selector: '.hero-cloud--3',
        duration: 90000,            // slowest — farthest away
        translateX: ['10vw', '-120vw'],  // drifts opposite (right → left)
        easing: 'linear',
    },
];

// ─── Bird configuration ─────────────────────────────────────────────
// Birds start at their CSS left position (visible in the hero) and drift
// rightward off-screen. loopDelay creates the occasional-crossing feel.
// translateY keyframes give a gentle, non-robotic diagonal path.
// CSS left: 8%  + translateX: 0→120vw  = starts visible, exits right.
// CSS left: 55% + translateX: 0→70vw   = starts visible further right, exits right.
const BIRD_CONFIGS = [
    {
        selector: '.hero-bird--1',
        duration: 9000,             // ~9s to cross the remaining viewport
        loopDelay: 18000,           // 18s off-screen before looping back
        translateX: ['0px', '120vw'],
        translateY: ['0px', '-28px', '12px', '-8px'],  // gentle rise-dip path
        easing: 'easeInOutSine',
    },
    {
        selector: '.hero-bird--2',
        duration: 7500,
        loopDelay: 24000,           // longer pause — staggered so birds don't sync
        translateX: ['0px', '80vw'],
        translateY: ['0px', '18px', '-20px', '6px'],
        easing: 'easeInOutSine',
    },
];

// ─── State ───────────────────────────────────────────────────────────
let activeAnimations = [];
let isAnimating = false;

// ─── Core animation lifecycle ────────────────────────────────────────

function startAnimations() {
    if (isAnimating) return;
    isAnimating = true;

    // Clouds — continuous looping drift
    CLOUD_CONFIGS.forEach((cfg) => {
        const el = document.querySelector(cfg.selector);
        if (!el) return;

        // Apply will-change only while animating
        el.style.willChange = 'transform';

        const anim = animate(el, {
            translateX: cfg.translateX,
            duration: cfg.duration,
            loop: true,
            easing: cfg.easing,
        });

        activeAnimations.push({ anim, el });
    });

    // Birds — fly across, then pause off-screen before repeating
    BIRD_CONFIGS.forEach((cfg) => {
        const el = document.querySelector(cfg.selector);
        if (!el) return;

        el.style.willChange = 'transform';

        const anim = animate(el, {
            translateX: cfg.translateX,
            translateY: cfg.translateY,
            duration: cfg.duration,
            loop: true,
            loopDelay: cfg.loopDelay,
            easing: cfg.easing,
        });

        activeAnimations.push({ anim, el });
    });
}

function stopAnimations() {
    if (!isAnimating) return;

    activeAnimations.forEach(({ anim, el }) => {
        // anime.js v4: cancel() stops and removes the animation
        if (anim && typeof anim.cancel === 'function') {
            anim.cancel();
        }
        // Reset transform so element sits in its CSS-declared position
        el.style.transform = '';
        el.style.willChange = '';
    });

    activeAnimations = [];
    isAnimating = false;
}

// ─── Media-query gates ───────────────────────────────────────────────

const desktopMQ = window.matchMedia('(min-width: 901px)');
const reducedMotionMQ = window.matchMedia('(prefers-reduced-motion: reduce)');

function shouldAnimate() {
    return desktopMQ.matches && !reducedMotionMQ.matches;
}

function handleMediaChange() {
    if (shouldAnimate() && !isAnimating) {
        startAnimations();
    } else if (!shouldAnimate() && isAnimating) {
        stopAnimations();
    }
}

// ─── Public init ─────────────────────────────────────────────────────

/**
 * Call once from DOMContentLoaded. Sets up media-query listeners and
 * starts animations if currently on desktop with motion allowed.
 */
export function initHeroSceneAnimations() {
    // Initial check
    handleMediaChange();

    // React to viewport/preference changes
    desktopMQ.addEventListener('change', handleMediaChange);
    reducedMotionMQ.addEventListener('change', handleMediaChange);
}
