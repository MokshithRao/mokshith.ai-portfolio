/* ============================================================
   Interactive Effects
   3D tilt cards, magnetic buttons, cursor glow, data stream
   ============================================================ */

(function () {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = window.matchMedia('(max-width: 768px)').matches;

  // ---- Cursor Glow ----
  if (!isMobile && !prefersReducedMotion) {
    const glow = document.getElementById('cursor-glow');
    if (glow) {
      document.addEventListener('mousemove', (e) => {
        glow.style.setProperty('--mouse-x', `${e.clientX}px`);
        glow.style.setProperty('--mouse-y', `${e.clientY}px`);
      });
    }
  } else {
    // Hide cursor glow on mobile
    const glow = document.getElementById('cursor-glow');
    if (glow) glow.style.display = 'none';
  }

  // ---- 3D Tilt Cards ----
  if (!isMobile && !prefersReducedMotion) {
    document.querySelectorAll('.tilt-card').forEach((card) => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Set CSS vars for glow
        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);

        // Calculate tilt
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = ((y - centerY) / centerY) * -8;
        const rotateY = ((x - centerX) / centerX) * 8;

        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
      });

      card.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';
      });
    });
  }

  // ---- Magnetic Buttons ----
  if (!isMobile && !prefersReducedMotion) {
    document.querySelectorAll('.magnetic-btn').forEach((btn) => {
      btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        btn.style.transform = `translate(${x * 0.3}px, ${y * 0.3}px)`;
      });

      btn.addEventListener('mouseleave', () => {
        btn.style.transform = 'translate(0px, 0px)';
      });
    });
  }

  // ---- Data Stream Particles ----
  if (!isMobile && !prefersReducedMotion) {
    const container = document.getElementById('data-stream-container');
    if (container) {
      setInterval(() => {
        const particle = document.createElement('div');
        particle.classList.add('data-stream-particle');

        const size = Math.random() * 4 + 2;
        const left = Math.random() * 100;
        const duration = Math.random() * 2 + 2;

        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.left = `${left}%`;
        particle.style.setProperty('--duration', `${duration}s`);

        container.appendChild(particle);

        setTimeout(() => {
          particle.remove();
        }, duration * 1000);
      }, 150);
    }
  }

  // ---- Parallax on hero (subtle) ----
  if (!isMobile && !prefersReducedMotion) {
    const heroContent = document.getElementById('hero-content');
    if (heroContent) {
      window.addEventListener('scroll', () => {
        const scrolled = window.scrollY;
        if (scrolled < window.innerHeight) {
          heroContent.style.opacity = 1 - (scrolled / window.innerHeight) * 1.5;
        }
      });
    }
  }
})();
