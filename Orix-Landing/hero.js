/**
 * ORIX Hero Section - Waitlist Form Logic
 * Two-step form: collects email, then name, then submits to Formbricks
 */

(function() {
    'use strict';
    
    // Initial waitlist count (will be updated on successful signup)
    let waitlistCount = 30;
    
    // Track current step
    let currentStep = 'email'; // 'email' or 'name'
    let userEmail = '';
    
    // DOM Elements
    const form = document.getElementById('waitlist-form');
    const emailStep = document.getElementById('email-step');
    const nameStep = document.getElementById('name-step');
    const emailInput = document.getElementById('email-input');
    const nameInput = document.getElementById('name-input');
    const submitButton = document.getElementById('waitlist-btn');
    const successMessage = document.getElementById('success-message');
    const errorMessage = document.getElementById('email-error');
    const waitlistCountElement = document.getElementById('waitlist-count');
    
    /**
     * Submit data to Formbricks
     * @param {string} email - User's email
     * @param {string} name - User's name
     */
    function submitToFormbricks(email, name) {
        // Wait for Formbricks to load
        const checkFormbricks = setInterval(() => {
            if (window.formbricks) {
                clearInterval(checkFormbricks);
                
                try {
                    // Set user attributes in Formbricks
                    window.formbricks.setUserId(email);
                    window.formbricks.setAttributes({
                        email: email,
                        firstName: name,
                        signupDate: new Date().toISOString(),
                        source: 'waitlist_form'
                    });
                    
                    // Track the waitlist signup event
                    window.formbricks.track('waitlist_signup', {
                        email: email,
                        firstName: name,
                        timestamp: new Date().toISOString()
                    });
                    
                    // Show success
                    showSuccess();
                    
                } catch (error) {
                    console.error('Formbricks submission error:', error);
                    showError('Oops! Something went wrong. Please try again.');
                    submitButton.disabled = false;
                    submitButton.textContent = 'Submit →';
                }
            }
        }, 100);
        
        // Timeout after 10 seconds if Formbricks doesn't load
        setTimeout(() => {
            clearInterval(checkFormbricks);
            if (!window.formbricks) {
                console.error('Formbricks failed to load');
                // Still show success to user, but log the error
                showSuccess();
            }
        }, 10000);
    }
    
    /**
     * Validate email format (simple validation)
     * @param {string} email - Email address to validate
     * @returns {boolean} - True if valid email format
     */
    function isValidEmail(email) {
        if (!email || typeof email !== 'string') {
            return false;
        }
        
        const emailLower = email.toLowerCase().trim();
        
        // Basic email format validation only
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(emailLower);
    }
    
    /**
     * Show real-time email validation feedback
     */
    function validateEmailInput() {
        const email = emailInput.value.trim();
        
        if (email.length > 0) {
            if (isValidEmail(email)) {
                emailInput.classList.add('input-valid');
                emailInput.classList.remove('border-red-500');
                hideError();
            } else {
                emailInput.classList.remove('input-valid');
            }
        } else {
            emailInput.classList.remove('input-valid');
        }
    }
    
    /**
     * Show error message
     * @param {string} message - Error message to display
     */
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.remove('hidden');
        successMessage.classList.add('hidden');
        
        if (currentStep === 'email') {
            emailInput.setAttribute('aria-invalid', 'true');
            emailInput.classList.add('border-red-500');
            emailInput.focus();
        } else {
            nameInput.setAttribute('aria-invalid', 'true');
            nameInput.classList.add('border-red-500');
            nameInput.focus();
        }
    }
    
    /**
     * Hide error message
     */
    function hideError() {
        errorMessage.classList.add('hidden');
        emailInput.setAttribute('aria-invalid', 'false');
        emailInput.classList.remove('border-red-500');
        nameInput.setAttribute('aria-invalid', 'false');
        nameInput.classList.remove('border-red-500');
    }
    
    /**
     * Move to name step
     */
    function showNameStep() {
        // Hide email step
        emailStep.classList.add('hidden');
        
        // Show name step
        nameStep.classList.remove('hidden');
        nameStep.classList.add('flex-1', 'flex', 'flex-col', 'sm:flex-row', 'gap-3');
        
        // Update button text to "Submit"
        submitButton.textContent = 'Submit →';
        
        // Focus on name input
        setTimeout(() => nameInput.focus(), 100);
        
        currentStep = 'name';
    }
    
    /**
     * Show success message and update UI
     */
    function showSuccess() {
        // Hide form and error
        form.classList.add('hidden');
        hideError();
        
        // Show success message
        successMessage.classList.remove('hidden');
        successMessage.focus();
        
        // Increment waitlist count
        waitlistCount++;
        updateWaitlistCount();
        
        // Store in localStorage (simulation)
        try {
            const emails = JSON.parse(localStorage.getItem('orix-waitlist') || '[]');
            emails.push({
                email: userEmail,
                timestamp: new Date().toISOString()
            });
            localStorage.setItem('orix-waitlist', JSON.stringify(emails));
            
            // Mark waitlist as completed permanently
            markWaitlistCompleted();
        } catch (e) {
            console.warn('localStorage not available:', e);
        }
    }
    
    /**
     * Update waitlist count display
     */
    function updateWaitlistCount() {
        waitlistCountElement.textContent = `${waitlistCount}+`;
        waitlistCountElement.classList.add('count-animate');
        setTimeout(() => waitlistCountElement.classList.remove('count-animate'), 400);
    }
    
    /**
     * Handle form submission
     * @param {Event} event - Form submit event
     */
    function handleSubmit(event) {
        event.preventDefault();
        hideError();
        
        if (currentStep === 'email') {
            // Step 1: Validate email
            const email = emailInput.value.trim();
            
            if (!email) {
                showError('Please enter your email address');
                return;
            }
            
            if (!isValidEmail(email)) {
                showError('Please enter a valid email address');
                return;
            }
            
            // Check if already signed up (localStorage simulation)
            try {
                const emails = JSON.parse(localStorage.getItem('orix-waitlist') || '[]');
                const alreadySignedUp = emails.some(entry => 
                    entry.email.toLowerCase() === email.toLowerCase()
                );
                
                if (alreadySignedUp) {
                    showError('This email is already on the waitlist!');
                    return;
                }
            } catch (e) {
                console.warn('localStorage check failed:', e);
            }
            
            // Store email and move to name step
            userEmail = email;
            showNameStep();
            
        } else if (currentStep === 'name') {
            // Step 2: Validate name and submit to Formbricks
            const name = nameInput.value.trim();
            
            if (!name) {
                showError('Please enter your name');
                return;
            }
            
            // Disable button during submission
            submitButton.disabled = true;
            submitButton.innerHTML = '<span class="flex items-center justify-center gap-2"><svg class="scribble-spinner text-orix-charcoal" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10"/></svg> Joining...</span>';
            
            // Submit to Formbricks
            submitToFormbricks(userEmail, name);
        }
    }
    
    /**
     * Handle input changes - clear error on user typing
     */
    function handleInput() {
        if (!errorMessage.classList.contains('hidden')) {
            hideError();
        }
    }
    
    /**
     * Check if user has already completed waitlist signup
     * @returns {boolean} - True if user has already signed up
     */
    function checkWaitlistCompletion() {
        try {
            const completed = localStorage.getItem('orix-waitlist-completed');
            return completed === 'true';
        } catch (e) {
            console.warn('localStorage check failed:', e);
            return false;
        }
    }
    
    /**
     * Show permanent completion message
     */
    function showPermanentCompletion() {
        // Hide the form
        form.classList.add('hidden');
        hideError();
        
        // Update success message text for returning users
        successMessage.innerHTML = '✓ You\'re already on the list! We\'ll be in touch soon.';
        successMessage.classList.remove('hidden');
    }
    
    /**
     * Mark waitlist as completed in localStorage
     */
    function markWaitlistCompleted() {
        try {
            localStorage.setItem('orix-waitlist-completed', 'true');
        } catch (e) {
            console.warn('localStorage save failed:', e);
        }
    }
    
    /**
     * Initialize the form
     */
    function init() {
        // Check if user has already completed waitlist
        if (checkWaitlistCompletion()) {
            showPermanentCompletion();
            // Update count from localStorage
            try {
                const emails = JSON.parse(localStorage.getItem('orix-waitlist') || '[]');
                if (emails.length > 0) {
                    waitlistCount = 30 + emails.length;
                    updateWaitlistCount();
                }
            } catch (e) {
                console.warn('localStorage count update failed:', e);
            }
            return; // Don't attach form listeners if already completed
        }
        
        // Check localStorage for existing count (simulation)
        try {
            const emails = JSON.parse(localStorage.getItem('orix-waitlist') || '[]');
            if (emails.length > 0) {
                waitlistCount = 30 + emails.length;
                updateWaitlistCount();
            }
        } catch (e) {
            console.warn('localStorage init failed:', e);
        }
        
        // Attach event listeners
        form.addEventListener('submit', handleSubmit);
        emailInput.addEventListener('input', handleInput);
        emailInput.addEventListener('input', validateEmailInput); // Real-time validation
        emailInput.addEventListener('blur', validateEmailInput);  // Validate on blur
        nameInput.addEventListener('input', handleInput);
        
        // Accessibility: announce dynamic count updates
        waitlistCountElement.setAttribute('aria-live', 'polite');
        
        // Add subtle parallax / 'flow' effect to illustration for a water-like scroll feel
        // Respect user's reduced-motion preference
        const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!prefersReduced) {
            const illus = document.querySelector('section#hero img');
            if (illus) {
                let current = 0;
                let target = 0;

                function lerp(a, b, n) { return (1 - n) * a + n * b; }

                function updateTarget() {
                    // small factor to keep motion subtle
                    target = window.scrollY * 0.12;
                }

                const BASE_OFFSET_SMALL = 20; // px upward lift on small screens
                const BASE_OFFSET_LARGE = 40; // px upward lift on md+ screens

                function baseOffset() {
                    return window.innerWidth >= 768 ? BASE_OFFSET_LARGE : BASE_OFFSET_SMALL;
                }

                function tick() {
                    current = lerp(current, target, 0.08);
                    // Combine base upward lift with parallax inverse scroll
                    const offset = baseOffset();
                    illus.style.transform = `translateY(${ offset - current }px)`;
                    requestAnimationFrame(tick);
                }

                window.addEventListener('scroll', updateTarget, { passive: true });
                // start loop
                updateTarget();
                requestAnimationFrame(tick);
            }
        }
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

/**
 * Mobile Navigation Drawer
 * Handles hamburger menu, drawer open/close, backdrop, and accessibility
 */
(function() {
    'use strict';
    
    // DOM Elements
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const closeDrawerBtn = document.getElementById('close-drawer-btn');
    const drawer = document.getElementById('mobile-nav-drawer');
    const backdrop = document.getElementById('mobile-nav-backdrop');
    const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');
    const body = document.body;
    
    // Focus trap elements
    let focusableElements = [];
    let firstFocusableElement = null;
    let lastFocusableElement = null;
    
    /**
     * Open the mobile navigation drawer
     */
    function openDrawer() {
        drawer.classList.add('open');
        backdrop.classList.add('open');
        body.classList.add('drawer-open');
        mobileMenuBtn.classList.add('open');
        mobileMenuBtn.setAttribute('aria-expanded', 'true');
        backdrop.setAttribute('aria-hidden', 'false');
        
        // Set up focus trap
        updateFocusableElements();
        if (firstFocusableElement) {
            // Delay focus slightly for smooth animation
            setTimeout(() => firstFocusableElement.focus(), 100);
        }
    }
    
    /**
     * Close the mobile navigation drawer
     */
    function closeDrawer() {
        drawer.classList.remove('open');
        backdrop.classList.remove('open');
        body.classList.remove('drawer-open');
        mobileMenuBtn.classList.remove('open');
        mobileMenuBtn.setAttribute('aria-expanded', 'false');
        backdrop.setAttribute('aria-hidden', 'true');
        
        // Return focus to hamburger button
        mobileMenuBtn.focus();
    }
    
    /**
     * Update list of focusable elements inside drawer
     */
    function updateFocusableElements() {
        focusableElements = drawer.querySelectorAll(
            'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        firstFocusableElement = focusableElements[0];
        lastFocusableElement = focusableElements[focusableElements.length - 1];
    }
    
    /**
     * Handle focus trap inside drawer
     */
    function handleFocusTrap(e) {
        if (!drawer.classList.contains('open')) return;
        
        if (e.key === 'Tab') {
            if (e.shiftKey) { // Shift + Tab
                if (document.activeElement === firstFocusableElement) {
                    lastFocusableElement.focus();
                    e.preventDefault();
                }
            } else { // Tab
                if (document.activeElement === lastFocusableElement) {
                    firstFocusableElement.focus();
                    e.preventDefault();
                }
            }
        }
    }
    
    /**
     * Handle ESC key to close drawer
     */
    function handleEscape(e) {
        if (e.key === 'Escape' && drawer.classList.contains('open')) {
            closeDrawer();
        }
    }
    
    /**
     * Initialize mobile navigation
     */
    function init() {
        if (!mobileMenuBtn || !drawer || !backdrop) return;
        
        // Open drawer on hamburger click
        mobileMenuBtn.addEventListener('click', openDrawer);
        
        // Close drawer on close button click
        if (closeDrawerBtn) {
            closeDrawerBtn.addEventListener('click', closeDrawer);
        }
        
        // Close drawer on backdrop click
        backdrop.addEventListener('click', closeDrawer);
        
        // Close drawer when nav link is clicked
        mobileNavLinks.forEach(link => {
            link.addEventListener('click', () => {
                // Delay closing to allow smooth scroll to start
                setTimeout(closeDrawer, 150);
            });
        });
        
        // Handle ESC key
        document.addEventListener('keydown', handleEscape);
        
        // Handle focus trap
        document.addEventListener('keydown', handleFocusTrap);
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
