import { animate, stagger } from 'animejs';
import './style.css';
import { initCatalog } from './catalog.js';
import { initNav } from './nav.js';
import { initModal } from './modal.js';
import { initHeroSceneAnimations } from './heroAnimations.js';

function initScrollProgress() {
    const bar = document.getElementById('progress-bar');
    if (!bar) return;
    window.addEventListener('scroll', () => {
        const scrolled = window.scrollY;
        const total = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.width = (scrolled / total) * 100 + '%';
    }, { passive: true });
}

function animateHero() {
    const tagline = document.getElementById('heroTagline');
    const words = document.querySelectorAll('#heroTitle .word');
    const subtitle = document.getElementById('heroSubtitle');
    const actions = document.getElementById('heroActions');
    const cards = document.querySelectorAll('.editorial-card');

    if (tagline) {
        tagline.style.opacity = '0';
        tagline.style.transform = 'translateY(12px)';
        animate(tagline, {
            opacity: [0, 1],
            translateY: [12, 0],
            duration: 650,
            easing: 'easeOutExpo',
            delay: 100
        });
    }

    if (words.length) {
        words.forEach(w => { w.style.opacity = '0'; w.style.transform = 'translateY(28px)'; });
        animate(words, {
            opacity: [0, 1],
            translateY: [28, 0],
            duration: 650,
            easing: 'easeOutExpo',
            delay: stagger(70, { start: 280 })
        });
    }

    if (subtitle) {
        subtitle.style.opacity = '0';
        animate(subtitle, {
            opacity: [0, 1],
            translateY: [16, 0],
            duration: 600,
            easing: 'easeOutExpo',
            delay: 700
        });
    }

    if (actions) {
        actions.style.opacity = '0';
        animate(actions, {
            opacity: [0, 1],
            translateY: [12, 0],
            duration: 550,
            easing: 'easeOutExpo',
            delay: 900
        });
    }

    const illustration = document.getElementById('heroIllustration');
    if (illustration) {
        illustration.style.opacity = '0';
        animate(illustration, {
            opacity: [0, 1],
            translateY: [24, 0],
            duration: 700,
            easing: 'easeOutExpo',
            delay: 1050
        });
    }

    const seal = document.getElementById('heroSeal');
    if (seal) {
        seal.style.opacity = '0';
        animate(seal, {
            opacity: [0, 1],
            scale: [0.7, 1],
            duration: 600,
            easing: 'easeOutBack',
            delay: 1300
        });
    }

    if (cards.length) {
        cards.forEach(c => { c.style.opacity = '0'; c.style.transform = 'translateY(24px)'; });
        animate(cards, {
            opacity: [0, 1],
            translateY: [24, 0],
            duration: 600,
            easing: 'easeOutExpo',
            delay: stagger(100, { start: 600 })
        });
    }
}

function initHeroClone() {
    // Split headline into per-character spans for the reveal
    const title = document.querySelector('#heroTitle[data-split]');
    if (title) {
        const text = title.textContent.trim();
        title.textContent = '';
        let idx = 0;
        [...text].forEach(ch => {
            if (ch === ' ') {
                const sp = document.createElement('span');
                sp.className = 'space';
                title.appendChild(sp);
                return;
            }
            const s = document.createElement('span');
            s.className = 'char';
            s.textContent = ch;
            s.style.transitionDelay = (idx * 28) + 'ms';
            title.appendChild(s);
            idx++;
        });
        requestAnimationFrame(() => {
            title.querySelectorAll('.char').forEach(c => c.classList.add('in'));
        });
    }

    // Parallax on hero layers driven by scroll
    const layers = [...document.querySelectorAll('.hero-layer[data-depth]')];
    const scene = document.querySelector('.hero-scene');
    if (layers.length && scene) {
        let ticking = false;
        const update = () => {
            const y = window.scrollY;
            layers.forEach(l => {
                const d = parseFloat(l.getAttribute('data-depth')) || 0;
                l.style.transform = 'translateY(' + (y * d * -0.6) + 'px)';
            });
            ticking = false;
        };
        window.addEventListener('scroll', () => {
            if (!ticking) { requestAnimationFrame(update); ticking = true; }
        }, { passive: true });
        update();
    }
}

function initFeatureObserver() {
    const items = document.querySelectorAll('.feature-item');
    if (!items.length) return;

    const observer = new IntersectionObserver((entries) => {
        const visible = entries.filter(e => e.isIntersecting).map(e => e.target);
        if (!visible.length) return;
        animate(visible, {
            opacity: [0, 1],
            translateY: [20, 0],
            duration: 600,
            easing: 'easeOutExpo',
            delay: stagger(100)
        });
        visible.forEach(el => { el.style.opacity = '1'; observer.unobserve(el); });
    }, { threshold: 0.2 });

    items.forEach(item => {
        item.style.opacity = '0';
        item.style.transform = 'translateY(20px)';
        observer.observe(item);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initScrollProgress();
    animateHero();
    initHeroClone();
    initFeatureObserver();
    initNav();
    initModal();
    initCatalog();
    initHeroSceneAnimations();
});
