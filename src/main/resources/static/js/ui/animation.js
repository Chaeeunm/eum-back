// ================================
// Landing Page Animations
// ================================

// Typing animation - characters appear one by one
export function initTypingAnimation() {
    const typingElements = document.querySelectorAll('.typing-text');

    typingElements.forEach(element => {
        const text = element.dataset.text;
        const delay = parseInt(element.dataset.delay) || 0;

        if (!text) return;

        // Wrap each character in a span
        element.innerHTML = '';
        const chars = text.split('');

        chars.forEach((char, index) => {
            const span = document.createElement('span');
            span.className = 'char';
            span.textContent = char === ' ' ? '\u00A0' : char;
            span.style.animationDelay = `${delay + (index * 200)}ms`;
            element.appendChild(span);
        });
    });
}

// Scroll animation with Intersection Observer
export function initScrollAnimations() {
    const scrollElements = document.querySelectorAll('.scroll-fade');

    if (scrollElements.length === 0) return;

    const observerOptions = {
        root: null,
        rootMargin: '0px 0px -100px 0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Set CSS variable if delay attribute exists
                const delay = entry.target.dataset.delay;
                if (delay) {
                    entry.target.style.setProperty('--delay', `${delay}ms`);
                }
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    scrollElements.forEach(element => {
        observer.observe(element);
    });
}

// Initialize landing page animations
export function initLandingAnimations() {
    // Start typing animation with slight delay
    setTimeout(() => {
        initTypingAnimation();
    }, 300);

    // Initialize scroll animations
    initScrollAnimations();
}