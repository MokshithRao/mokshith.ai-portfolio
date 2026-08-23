/* ============================================================
   Main — Intersection Observer, Navigation, Modals
   ============================================================ */

(function () {
  'use strict';

  // ---- Intersection Observer: Fade-in Sections ----
  document.addEventListener('DOMContentLoaded', () => {
    const observerOptions = { root: null, rootMargin: '0px', threshold: 0.15 };

    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
        }
      });
    }, observerOptions);

    document.querySelectorAll('.fade-in-section, .timeline').forEach((el) => {
      sectionObserver.observe(el);
    });

    // Timeline nodes
    const nodeObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const node = entry.target.querySelector('.timeline__node');
            if (node) node.classList.add('is-active');
          }
        });
      },
      { threshold: 0.8 }
    );

    document.querySelectorAll('.timeline__item').forEach((item) => {
      nodeObserver.observe(item);
    });
  });

  // ---- Smooth Scroll for Nav Links ----
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;

      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // Close mobile menu if open
        const mobileMenu = document.getElementById('mobile-menu');
        if (mobileMenu && mobileMenu.classList.contains('active')) {
          mobileMenu.classList.remove('active');
          document.body.style.overflow = '';
        }
      }
    });
  });

  // ---- Nav Active State on Scroll ----
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav__link');

  window.addEventListener('scroll', () => {
    let current = '';
    sections.forEach((section) => {
      const sectionTop = section.offsetTop;
      if (window.pageYOffset >= sectionTop - 300) {
        current = section.getAttribute('id');
      }
    });

    navLinks.forEach((link) => {
      link.classList.remove('active');
      if (link.getAttribute('data-target') === current) {
        link.classList.add('active');
      }
    });
  });

  // ---- Mobile Menu ----
  const mobileToggle = document.getElementById('mobile-toggle');
  const mobileMenu = document.getElementById('mobile-menu');
  const mobileClose = document.getElementById('mobile-close');

  function openMobileMenu() {
    if (mobileMenu) {
      mobileMenu.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeMobileMenu() {
    if (mobileMenu) {
      mobileMenu.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  if (mobileToggle && mobileMenu) {
    mobileToggle.addEventListener('click', () => {
      if (mobileMenu.classList.contains('active')) {
        closeMobileMenu();
      } else {
        openMobileMenu();
      }
    });
  }

  if (mobileClose && mobileMenu) {
    mobileClose.addEventListener('click', closeMobileMenu);
  }

  // ---- Modals ----
  window.openModal = function (id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  };

  window.closeModal = function (id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  };

  // Close modal on overlay click
  document.querySelectorAll('.modal-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal(overlay.id);
      }
    });
  });

  // Close modal on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach((overlay) => {
        closeModal(overlay.id);
      });

      // Also close mobile menu
      if (mobileMenu && mobileMenu.classList.contains('active')) {
        mobileMenu.classList.remove('active');
        document.body.style.overflow = '';
      }
    }
  });
})();
