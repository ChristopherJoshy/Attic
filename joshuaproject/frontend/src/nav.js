import { animate, stagger } from 'animejs';

export function initNav() {
    const header = document.getElementById('appHeader');
    const megaMenu = document.getElementById('megaMenu');
    const navProducts = document.getElementById('navProducts');
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const mobileDrawer = document.getElementById('mobileDrawer');
    const drawerClose = document.getElementById('drawerClose');
    const drawerOverlay = document.getElementById('drawerOverlay');

    window.addEventListener('scroll', () => {
        if (window.scrollY > 40) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    }, { passive: true });

    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link');

    const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                navLinks.forEach(link => link.classList.remove('active'));
                const active = document.querySelector(`.nav-link[href="#${entry.target.id}"]`);
                if (active) active.classList.add('active');
            }
        });
    }, { rootMargin: '-40% 0px -55% 0px' });

    sections.forEach(s => sectionObserver.observe(s));

    let megaTimer;
    let megaOpenAnim;
    let megaCloseAnim;
    let closeMega = () => {};

    if (navProducts && megaMenu) {
        const openMega = () => {
            clearTimeout(megaTimer);
            if (megaCloseAnim) megaCloseAnim.cancel();
            megaMenu.classList.add('open');
            megaMenu.style.visibility = 'visible';
            megaOpenAnim = animate(megaMenu, {
                opacity: [0, 1],
                translateY: [-10, 0],
                duration: 300,
                easing: 'easeOutExpo'
            });
            const megaItems = megaMenu.querySelectorAll('.mega-menu-column, .mega-menu-item');
            if (megaItems.length) {
                animate(megaItems, {
                    opacity: [0, 1],
                    translateY: [12, 0],
                    duration: 350,
                    delay: stagger(25, { start: 60 }),
                    easing: 'easeOutQuad'
                });
            }
        };

        closeMega = () => {
            if (megaOpenAnim) megaOpenAnim.cancel();
            megaCloseAnim = animate(megaMenu, {
                opacity: [1, 0],
                translateY: [0, -10],
                duration: 260,
                easing: 'easeInQuad',
                onComplete: () => {
                    megaMenu.classList.remove('open');
                    megaMenu.style.visibility = 'hidden';
                }
            });
        };

        navProducts.addEventListener('mouseenter', openMega);

        megaMenu.addEventListener('mouseenter', () => {
            clearTimeout(megaTimer);
        });

        navProducts.addEventListener('mouseleave', () => {
            megaTimer = setTimeout(closeMega, 200);
        });

        megaMenu.addEventListener('mouseleave', () => {
            megaTimer = setTimeout(closeMega, 200);
        });

        navProducts.addEventListener('click', (e) => {
            e.preventDefault();
        });

        document.addEventListener('click', (e) => {
            if (!megaMenu.contains(e.target) && e.target !== navProducts) {
                closeMega();
            }
        });
    }

    const toggleDrawer = (open) => {
        mobileDrawer.classList.toggle('open', open);
        drawerOverlay.classList.toggle('open', open);
        document.body.style.overflow = open ? 'hidden' : '';
    };

    mobileMenuToggle?.addEventListener('click', () => toggleDrawer(true));
    drawerClose?.addEventListener('click', () => toggleDrawer(false));
    drawerOverlay?.addEventListener('click', () => toggleDrawer(false));

    document.querySelectorAll('.drawer-link').forEach(link => {
        link.addEventListener('click', () => toggleDrawer(false));
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            toggleDrawer(false);
            if (megaMenu?.classList.contains('open')) {
                closeMega();
            }
        }
    });

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', (e) => {
            const target = document.querySelector(anchor.getAttribute('href'));
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
}
