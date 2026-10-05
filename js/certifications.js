/* ============================================================
   CERTIFICATIONS — Data-driven Portfolio Certification System
   Handles category filtering, certificate cards gallery, multi-image
   detail carousel, certificate verification links, and CRUD management.
   ============================================================ */

(function () {
  'use strict';

  // Category Configuration
  const CERT_CATEGORIES = [
    { id: 'All', name: 'All', icon: 'apps' },
    { id: 'AI / ML', name: 'AI / ML', icon: 'psychology' },
    { id: 'Data Science', name: 'Data Science', icon: 'analytics' },
    { id: 'Cloud', name: 'Cloud', icon: 'cloud' },
    { id: 'Programming', name: 'Programming', icon: 'code' },
    { id: 'Other', name: 'Other', icon: 'verified' }
  ];

  // State
  let certifications = [];
  let currentFilter = 'All';
  let currentView = 'grid'; // 'grid' | 'detail' | 'form'
  let selectedCert = null;
  let editingCert = null;
  let formImages = []; // Array of { data, url, isCover }
  let carouselIndex = 0;
  let carouselTouchStartX = 0;
  let carouselTouchEndX = 0;

  // DOM Elements
  const teaserCard = document.getElementById('btn-open-certs');
  const teaserCategoriesEl = document.getElementById('certs-teaser-categories');
  const certsModal = document.getElementById('modal-certs');
  const breadcrumbsEl = document.getElementById('certs-breadcrumbs');
  const modalHeadingEl = document.getElementById('certs-modal-heading');
  const topActionsEl = document.getElementById('certs-top-actions');
  const viewContainer = document.getElementById('certs-view-container');

  // Helper: Escape HTML
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Helper: Detect PDF URLs or Base64
  function isPdfUrl(str) {
    if (!str) return false;
    const cleanStr = String(str).toLowerCase().split('?')[0].split('#')[0];
    return cleanStr.startsWith('data:application/pdf') || cleanStr.endsWith('.pdf');
  }

  function getReadOnlyPdfUrl(url) {
    return `${url.split('#')[0]}#toolbar=0&navpanes=0&scrollbar=0`;
  }

  // Fetch Certifications from Backend
  async function fetchCertifications() {
    try {
      const response = await fetch('/api/certifications');
      if (!response.ok) throw new Error('Failed to load certifications');
      const data = await response.json();
      certifications = Array.isArray(data) ? data : [];
      updateTeaserCard();
      renderCurrentView();
    } catch (err) {
      console.error('Error fetching certifications:', err);
      // Graceful fallback
      updateTeaserCard();
    }
  }

  // Update Teaser Card on Main Portfolio
  function updateTeaserCard() {
    if (!teaserCategoriesEl) return;
    
    if (certifications.length === 0) {
      teaserCategoriesEl.innerHTML = `
        <span class="beyond-teaser-chip">🎓 Professional Credentials</span>
      `;
      return;
    }

    // Collect counts per category
    const catCounts = {};
    certifications.forEach(c => {
      const cat = c.category || 'Other';
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    });

    const activeCats = Object.keys(catCounts);
    teaserCategoriesEl.innerHTML = activeCats.slice(0, 3).map(cat => {
      return `<span class="beyond-teaser-chip">🏅 ${escapeHtml(cat)} (${catCounts[cat]})</span>`;
    }).join('') + (activeCats.length > 3 ? `<span class="beyond-teaser-chip">+${activeCats.length - 3} more</span>` : '');
  }

  // Open Modal Entry Point
  window.openCertificationsModal = function (certId = null) {
    // 1. Activate modal overlay immediately
    if (window.openModal) {
      window.openModal('modal-certs');
    } else {
      const m = document.getElementById('modal-certs');
      if (m) {
        m.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
    }

    // 2. Render target view
    try {
      if (certId) {
        const cert = certifications.find(c => c.id === certId);
        if (cert) {
          openCertDetail(cert);
        } else {
          navigateToGrid();
        }
      } else {
        navigateToGrid();
      }
    } catch (err) {
      console.error('Error rendering certifications view:', err);
    }
  };

  window.openCertForm = openCertForm;
  window.openCertDetail = openCertDetail;

  // Setup Event Listeners
  function initEvents() {
    if (teaserCard) {
      teaserCard.addEventListener('click', () => window.openCertificationsModal());
      teaserCard.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          window.openCertificationsModal();
        }
      });
    }

    // Modal Global Esc / Key Navigation
    document.addEventListener('keydown', (e) => {
      const modal = document.getElementById('modal-certs');
      if (!modal || !modal.classList.contains('active')) return;

      if (currentView === 'detail') {
        if (e.key === 'ArrowLeft') {
          prevSlide();
        } else if (e.key === 'ArrowRight') {
          nextSlide();
        } else if (e.key === 'Escape') {
          // If in detail view, return to grid on first Escape
          e.stopPropagation();
          navigateToGrid();
        }
      } else if (currentView === 'form') {
        if (e.key === 'Escape') {
          e.stopPropagation();
          if (editingCert) {
            openCertDetail(editingCert);
          } else {
            navigateToGrid();
          }
        }
      }
    });
  }

  // Navigation: Go to Grid
  function navigateToGrid(filter = null) {
    if (filter) currentFilter = filter;
    currentView = 'grid';
    selectedCert = null;
    editingCert = null;
    renderCurrentView();
  }

  // Navigation: Go to Detail
  function openCertDetail(cert) {
    selectedCert = cert;
    currentView = 'detail';
    carouselIndex = 0;
    renderCurrentView();
  }

  // Navigation: Go to Add / Edit Form
  function openCertForm(cert = null) {
    editingCert = cert;
    currentView = 'form';
    
    // Prepare initial form images
    if (cert && Array.isArray(cert.images) && cert.images.length > 0) {
      formImages = cert.images.filter(Boolean).map((url, idx) => ({
        url,
        data: null,
        name: url.split('/').pop(),
        isPdf: isPdfUrl(url),
        isCover: idx === 0
      }));
    } else {
      formImages = [];
    }

    renderCurrentView();
  }

  // Main Render Switcher
  function renderCurrentView() {
    if (!viewContainer) return;

    if (currentView === 'grid') {
      renderGridView();
    } else if (currentView === 'detail') {
      renderDetailView();
    } else if (currentView === 'form') {
      renderFormView();
    }
  }

  // Render Breadcrumbs & Top Actions
  function updateHeader(breadcrumbs, title, actionsHtml = '') {
    if (breadcrumbsEl) {
      breadcrumbsEl.innerHTML = breadcrumbs.map((b, idx) => {
        if (idx === breadcrumbs.length - 1) {
          return `<span class="beyond-crumb beyond-crumb--active">${escapeHtml(b.label)}</span>`;
        }
        return `
          <button class="beyond-crumb-btn" data-action="${escapeHtml(b.action || '')}" data-param="${escapeHtml(b.param || '')}">
            ${escapeHtml(b.label)}
          </button>
          <span class="beyond-crumb-sep">/</span>
        `;
      }).join('');

      // Attach breadcrumb click handlers
      breadcrumbsEl.querySelectorAll('.beyond-crumb-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const action = btn.dataset.action;
          const param = btn.dataset.param;
          if (action === 'grid') navigateToGrid(param || null);
        });
      });
    }

    if (modalHeadingEl) {
      modalHeadingEl.textContent = title;
    }

    if (topActionsEl) {
      topActionsEl.innerHTML = actionsHtml;
    }
  }

  // ==========================================
  // VIEW 1: CERTIFICATE GRID & CATEGORY FILTER
  // ==========================================
  function renderGridView() {
    const breadcrumbs = [
      { label: 'Certifications', action: 'grid' }
    ];

    const actionsHtml = `
      <button class="btn btn--primary magnetic-btn certs-add-btn" id="certs-btn-add">
        <span class="material-symbols-outlined" style="font-size: 18px;">add</span>
        <span>Add Certificate</span>
      </button>
    `;

    updateHeader(breadcrumbs, 'Certifications', actionsHtml);

    const addBtn = document.getElementById('certs-btn-add');
    if (addBtn) {
      addBtn.addEventListener('click', () => openCertForm(null));
    }

    // Filter certs
    const filteredCerts = currentFilter === 'All' 
      ? certifications 
      : certifications.filter(c => (c.category || 'Other').toLowerCase() === currentFilter.toLowerCase());

    let html = `
      <div class="certs-view">
        <!-- Subtitle -->
        <p class="certs-subtitle">
          Professional certifications and learning achievements that complement my technical skills.
        </p>

        <!-- Category Filter Bar -->
        <div class="certs-filter-bar" role="tablist" aria-label="Certificate categories">
          <button class="certs-filter-chip ${currentFilter === 'All' ? 'certs-filter-chip--active' : ''}" data-category="All" role="tab" aria-selected="${currentFilter === 'All'}">
            <span class="material-symbols-outlined" style="font-size: 16px;">apps</span>
            <span>All</span>
            <span class="certs-filter-count">${certifications.length}</span>
          </button>
    `;

    CERT_CATEGORIES.forEach(cat => {
      if (cat.id === 'All') return;
      // Show filter if it exists in data or standard list
      const count = certifications.filter(c => (c.category || 'Other').toLowerCase() === cat.id.toLowerCase()).length;
      if (count > 0 || cat.id === 'AI / ML' || cat.id === 'Data Science' || cat.id === 'Cloud' || cat.id === 'Programming') {
        const isActive = currentFilter.toLowerCase() === cat.id.toLowerCase();
        html += `
          <button class="certs-filter-chip ${isActive ? 'certs-filter-chip--active' : ''}" data-category="${escapeHtml(cat.id)}" role="tab" aria-selected="${isActive}">
            <span class="material-symbols-outlined" style="font-size: 16px;">${cat.icon}</span>
            <span>${escapeHtml(cat.name)}</span>
            ${count > 0 ? `<span class="certs-filter-count">${count}</span>` : ''}
          </button>
        `;
      }
    });

    html += `
        </div>

        <!-- Certificate Cards Grid -->
        <div class="certs-grid">
    `;

    if (filteredCerts.length === 0) {
      html += `
        <div class="certs-empty-state">
          <div class="certs-empty-icon">
            <span class="material-symbols-outlined">workspace_premium</span>
          </div>
          <h3 class="certs-empty-title">No certificates found in "${escapeHtml(currentFilter)}"</h3>
          <p class="certs-empty-desc">Add a new certificate or select a different category.</p>
          <button class="btn btn--secondary magnetic-btn" onclick="openCertForm()">
            <span class="material-symbols-outlined">add</span> Add First Certificate
          </button>
        </div>
      `;
    } else {
      filteredCerts.forEach(cert => {
        html += renderCertCardHtml(cert);
      });
    }

    html += `
        </div>
      </div>
    `;

    viewContainer.innerHTML = html;

    // Attach Category Filter handlers
    viewContainer.querySelectorAll('.certs-filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const cat = chip.dataset.category;
        currentFilter = cat;
        renderGridView();
      });
    });

    // Attach Card Click handlers
    viewContainer.querySelectorAll('.cert-card').forEach(card => {
      const id = card.dataset.id;
      card.addEventListener('click', () => {
        const cert = certifications.find(c => c.id === id);
        if (cert) openCertDetail(cert);
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const cert = certifications.find(c => c.id === id);
          if (cert) openCertDetail(cert);
        }
      });
    });
  }

  // Render Individual Certificate Card
  function renderCertCardHtml(cert) {
    const images = Array.isArray(cert.images) ? cert.images.filter(Boolean) : [];
    const coverImage = images[0] || '';
    const imageCount = images.length;
    const category = cert.category || 'Other';
    const dateOrYear = cert.date || cert.year || '';
    const isCoverPdf = isPdfUrl(coverImage);

    // Category style accents
    let catClass = 'cert-tag--default';
    if (category.toLowerCase().includes('ai') || category.toLowerCase().includes('ml')) catClass = 'cert-tag--ai';
    else if (category.toLowerCase().includes('data')) catClass = 'cert-tag--data';
    else if (category.toLowerCase().includes('cloud')) catClass = 'cert-tag--cloud';
    else if (category.toLowerCase().includes('program') || category.toLowerCase().includes('python')) catClass = 'cert-tag--code';

    return `
      <div class="cert-card" data-id="${escapeHtml(cert.id)}" onclick="window.openCertificationsModal('${escapeHtml(cert.id)}')" role="button" tabindex="0" aria-label="${escapeHtml(cert.name)} by ${escapeHtml(cert.issuer)}">
        <!-- Card Glow / Background Effect -->
        <div class="cert-card__glow"></div>
        
        <!-- Image Container -->
        <div class="cert-card__image-wrap">
          ${coverImage ? (isCoverPdf ? `
            <div class="cert-card__pdf-cover">
              <iframe
                src="${escapeHtml(coverImage)}#page=1&view=FitH&toolbar=0&navpanes=0&scrollbar=0"
                class="cert-card__pdf-preview"
                title="${escapeHtml(cert.name)} certificate preview"
                loading="lazy"
                tabindex="-1"
                aria-hidden="true"
              ></iframe>
            </div>
          ` : `
            <img src="${escapeHtml(coverImage)}" alt="${escapeHtml(cert.name)}" class="cert-card__image" loading="lazy" onerror="this.style.display='none'; this.parentElement.querySelector('.cert-card__image-placeholder-fallback').style.display='flex';" />
            <div class="cert-card__image-placeholder cert-card__image-placeholder-fallback" style="display: none;">
              <span class="material-symbols-outlined">workspace_premium</span>
              <span class="cert-placeholder-text">${escapeHtml(cert.issuer || 'Certificate')}</span>
            </div>
          `) : `
            <div class="cert-card__image-placeholder">
              <span class="material-symbols-outlined">workspace_premium</span>
              <span class="cert-placeholder-text">${escapeHtml(cert.issuer || 'Certificate')}</span>
            </div>
          `}
          
          <div class="cert-card__image-overlay${isCoverPdf ? ' cert-card__image-overlay--pdf' : ''}"></div>

          <!-- Category Badge -->
          <div class="cert-card__badge-top-left">
            <span class="cert-tag ${catClass}">${escapeHtml(category)}</span>
          </div>

          <!-- Multi-Image Counter -->
          ${imageCount > 1 ? `
            <div class="cert-card__badge-count">
              <span class="material-symbols-outlined" style="font-size: 13px;">photo_library</span>
              <span>${imageCount}</span>
            </div>
          ` : ''}

          ${dateOrYear ? `
            <div class="cert-card__badge-date">
              <span>${escapeHtml(dateOrYear)}</span>
            </div>
          ` : ''}
        </div>

        <!-- Card Body -->
        <div class="cert-card__body">
          <div class="cert-card__issuer">
            <span class="material-symbols-outlined" style="font-size: 14px; opacity: 0.7;">verified</span>
            <span>${escapeHtml(cert.issuer || 'Certified')}</span>
          </div>

          <h3 class="cert-card__title" title="${escapeHtml(cert.name)}">
            ${escapeHtml(cert.name)}
          </h3>

          ${cert.credentialId ? `
            <div class="cert-card__cred-id">
              <span class="cert-cred-label">ID:</span>
              <span class="cert-cred-value">${escapeHtml(cert.credentialId)}</span>
            </div>
          ` : ''}

          <!-- Card Footer Affordance -->
          <div class="cert-card__footer">
            <span class="cert-card__action-text">View Details</span>
            <span class="material-symbols-outlined cert-card__action-arrow">arrow_forward</span>
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================
  // VIEW 2: CERTIFICATE DETAIL & CAROUSEL
  // ==========================================
  function renderDetailView() {
    if (!selectedCert) {
      navigateToGrid();
      return;
    }

    const cert = selectedCert;
    const images = Array.isArray(cert.images) ? cert.images.filter(Boolean) : [];
    const category = cert.category || 'Other';
    const dateOrYear = cert.date || cert.year || '';

    const breadcrumbs = [
      { label: 'Certifications', action: 'grid' },
      { label: cert.name }
    ];

    const actionsHtml = `
      <div class="beyond-modal__action-group">
        <button class="btn btn--primary magnetic-btn" id="certs-btn-edit" style="padding: 8px 16px;">
          <span class="material-symbols-outlined" style="font-size: 17px;">edit</span>
          <span>Edit</span>
        </button>
        <button class="btn btn--primary magnetic-btn certs-back-btn" id="certs-btn-back-grid" style="padding: 8px 16px;">
          <span class="material-symbols-outlined" style="font-size: 17px;">arrow_back</span>
          <span>All Certificates</span>
        </button>
      </div>
    `;

    updateHeader(breadcrumbs, cert.name, actionsHtml);

    const editBtn = document.getElementById('certs-btn-edit');
    if (editBtn) editBtn.addEventListener('click', () => openCertForm(cert));

    const backBtn = document.getElementById('certs-btn-back-grid');
    if (backBtn) backBtn.addEventListener('click', () => navigateToGrid());

    let html = `
      <div class="cert-detail-view">
        <div class="cert-detail-layout">
          
          <!-- Left / Top Column: Certificate Visual Gallery / Carousel -->
          <div class="cert-detail-gallery">
            ${images.length > 0 ? `
              <div class="cert-carousel" id="cert-carousel-wrap">
                <div class="cert-carousel__viewport" id="cert-carousel-viewport">
                  <div class="cert-carousel__track" id="cert-carousel-track" style="transform: translateX(-${carouselIndex * 100}%);">
                    ${images.map((img, idx) => {
                      const isPdfDoc = isPdfUrl(img);
                      if (isPdfDoc) {
                        return `
                          <div class="cert-carousel__slide cert-carousel__slide--pdf" data-index="${idx}">
                            <div class="cert-pdf-viewer-box">
                              <div class="cert-pdf-header-bar">
                                <div class="cert-pdf-header-left">
                                  <span class="material-symbols-outlined" style="color: #ff5252; font-size: 18px;">picture_as_pdf</span>
                                  <span class="cert-pdf-title-text">${escapeHtml(cert.name)} (PDF)</span>
                                </div>
                                <div class="cert-pdf-header-right">
                                  <a href="${escapeHtml(getReadOnlyPdfUrl(img))}" target="_blank" rel="noopener noreferrer" class="btn btn--secondary magnetic-btn cert-pdf-open-btn" style="padding: 5px 12px; font-size: 11px;">
                                    <span class="material-symbols-outlined" style="font-size: 14px;">open_in_new</span> Full Screen
                                  </a>
                                  <a href="${escapeHtml(img)}" download="${escapeHtml(cert.name)}.pdf" class="btn btn--outline magnetic-btn cert-pdf-download-btn" style="padding: 5px 12px; font-size: 11px;">
                                    <span class="material-symbols-outlined" style="font-size: 14px;">download</span> Download
                                  </a>
                                </div>
                              </div>
                              <div class="cert-pdf-embed-wrapper">
                                <iframe src="${escapeHtml(getReadOnlyPdfUrl(img))}" class="cert-pdf-iframe" title="${escapeHtml(cert.name)} PDF Document"></iframe>
                              </div>
                            </div>
                          </div>
                        `;
                      }
                      return `
                        <div class="cert-carousel__slide" data-index="${idx}">
                          <img src="${escapeHtml(img)}" alt="${escapeHtml(cert.name)} - Page ${idx + 1}" class="cert-carousel__img" onerror="this.style.display='none'; this.parentElement.innerHTML='<div class=\\'cert-detail-placeholder\\'><span class=\\'material-symbols-outlined\\' style=\\'font-size: 40px; color: var(--primary-light);\\'>workspace_premium</span><p style=\\'margin-top: 8px; color: var(--text-muted);\\'>Image file missing</p></div>';" />
                        </div>
                      `;
                    }).join('')}
                  </div>
                </div>

                ${images.length > 1 ? `
                  <!-- Navigation Buttons -->
                  <button class="cert-carousel__btn cert-carousel__btn--prev" id="cert-prev-btn" aria-label="Previous image">
                    <span class="material-symbols-outlined">chevron_left</span>
                  </button>
                  <button class="cert-carousel__btn cert-carousel__btn--next" id="cert-next-btn" aria-label="Next image">
                    <span class="material-symbols-outlined">chevron_right</span>
                  </button>

                  <!-- Image Index Counter Badge -->
                  <div class="cert-carousel__badge-counter" id="cert-carousel-counter">
                    ${carouselIndex + 1} / ${images.length}
                  </div>

                  <!-- Pagination Dots -->
                  <div class="cert-carousel__dots" id="cert-carousel-dots">
                    ${images.map((_, idx) => `
                      <button class="cert-carousel__dot ${idx === carouselIndex ? 'cert-carousel__dot--active' : ''}" data-index="${idx}" aria-label="Go to slide ${idx + 1}"></button>
                    `).join('')}
                  </div>
                ` : ''}
              </div>
            ` : `
              <div class="cert-detail-placeholder">
                <span class="material-symbols-outlined" style="font-size: 44px; color: var(--primary-light); opacity: 0.7;">workspace_premium</span>
                <p style="color: var(--text-muted); font-size: 14px; margin-top: 10px;">No certificate PDF or image attached yet</p>
                <button class="btn btn--primary magnetic-btn" style="margin-top: 14px; font-size: 13px;" onclick="document.getElementById('certs-btn-edit').click()">
                  <span class="material-symbols-outlined" style="font-size: 16px;">cloud_upload</span> Upload Certificate File
                </button>
              </div>
            `}
          </div>

          <!-- Right Column: Certificate Metadata & Verification Info -->
          <div class="cert-detail-info">
            
            <!-- Category & Date Header Line -->
            <div class="cert-detail-header-meta">
              <span class="cert-tag cert-tag--ai">${escapeHtml(category)}</span>
              ${dateOrYear ? `<span class="cert-detail-date">Issued ${escapeHtml(dateOrYear)}</span>` : ''}
            </div>

            <h1 class="cert-detail-title">${escapeHtml(cert.name)}</h1>

            <!-- Issuer Info Bar -->
            <div class="cert-detail-issuer-card">
              <div class="cert-detail-issuer-icon">
                <span class="material-symbols-outlined">verified</span>
              </div>
              <div class="cert-detail-issuer-text">
                <div class="cert-detail-issuer-label">Issuing Organization</div>
                <div class="cert-detail-issuer-name">${escapeHtml(cert.issuer || 'Independent Certification')}</div>
              </div>
            </div>

            <!-- Credential ID Box (if available) -->
            ${cert.credentialId ? `
              <div class="cert-detail-cred-box">
                <div class="cert-detail-cred-header">
                  <span class="material-symbols-outlined" style="font-size: 16px;">fingerprint</span>
                  <span>Credential ID</span>
                </div>
                <code class="cert-detail-cred-code">${escapeHtml(cert.credentialId)}</code>
              </div>
            ` : ''}

            <!-- Skills / Topics Covered -->
            ${Array.isArray(cert.skills) && cert.skills.length > 0 ? `
              <div class="cert-detail-section">
                <h4 class="cert-detail-section-title">
                  <span class="material-symbols-outlined" style="font-size: 16px;">local_activity</span>
                  <span>Skills &amp; Competencies</span>
                </h4>
                <div class="cert-detail-skills">
                  ${cert.skills.map(s => `<span class="chip">${escapeHtml(s)}</span>`).join('')}
                </div>
              </div>
            ` : ''}

            <!-- Description -->
            ${cert.description ? `
              <div class="cert-detail-section">
                <h4 class="cert-detail-section-title">
                  <span class="material-symbols-outlined" style="font-size: 16px;">description</span>
                  <span>Description &amp; Highlights</span>
                </h4>
                <div class="cert-detail-desc">
                  <p>${escapeHtml(cert.description)}</p>
                </div>
              </div>
            ` : ''}

            <!-- Action Buttons / External Verification CTA -->
            <div class="cert-detail-actions">
              ${images.find(isPdfUrl) ? `
                <a href="${escapeHtml(getReadOnlyPdfUrl(images.find(isPdfUrl)))}" target="_blank" rel="noopener noreferrer" class="btn btn--secondary magnetic-btn cert-pdf-action-btn">
                  <span class="material-symbols-outlined" style="font-size: 18px; color: #ff5252;">picture_as_pdf</span>
                  <span>View PDF Document</span>
                </a>
              ` : ''}

              ${cert.credentialUrl ? `
                <a href="${escapeHtml(cert.credentialUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn--primary magnetic-btn cert-verify-btn">
                  <span>Open Credential</span>
                  <span class="material-symbols-outlined">open_in_new</span>
                </a>
              ` : ''}

              <button class="btn btn--danger-outline magnetic-btn" id="cert-btn-delete" style="padding: 10px 18px;">
                <span class="material-symbols-outlined" style="font-size: 18px;">delete</span>
                <span>Delete</span>
              </button>
            </div>

          </div>

        </div>
      </div>
    `;

    viewContainer.innerHTML = html;

    // Attach Carousel events
    if (images.length > 1) {
      const prevBtn = document.getElementById('cert-prev-btn');
      const nextBtn = document.getElementById('cert-next-btn');
      if (prevBtn) prevBtn.addEventListener('click', prevSlide);
      if (nextBtn) nextBtn.addEventListener('click', nextSlide);

      viewContainer.querySelectorAll('.cert-carousel__dot').forEach(dot => {
        dot.addEventListener('click', () => {
          const idx = parseInt(dot.dataset.index, 10);
          goToSlide(idx);
        });
      });

      // Swipe support for touch
      const carouselWrap = document.getElementById('cert-carousel-wrap');
      if (carouselWrap) {
        carouselWrap.addEventListener('touchstart', (e) => {
          carouselTouchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        carouselWrap.addEventListener('touchend', (e) => {
          carouselTouchEndX = e.changedTouches[0].screenX;
          handleSwipe();
        }, { passive: true });
      }
    }

    // Attach Delete handler
    const delBtn = document.getElementById('cert-btn-delete');
    if (delBtn) {
      delBtn.addEventListener('click', () => confirmDeleteCert(cert));
    }
  }

  function handleSwipe() {
    const diff = carouselTouchStartX - carouselTouchEndX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) nextSlide();
      else prevSlide();
    }
  }

  function nextSlide() {
    if (!selectedCert || !Array.isArray(selectedCert.images)) return;
    const total = selectedCert.images.filter(Boolean).length;
    if (total <= 1) return;
    carouselIndex = (carouselIndex + 1) % total;
    updateCarouselDom();
  }

  function prevSlide() {
    if (!selectedCert || !Array.isArray(selectedCert.images)) return;
    const total = selectedCert.images.filter(Boolean).length;
    if (total <= 1) return;
    carouselIndex = (carouselIndex - 1 + total) % total;
    updateCarouselDom();
  }

  function goToSlide(idx) {
    carouselIndex = idx;
    updateCarouselDom();
  }

  function updateCarouselDom() {
    const track = document.getElementById('cert-carousel-track');
    if (track) {
      track.style.transform = `translateX(-${carouselIndex * 100}%)`;
    }

    const counter = document.getElementById('cert-carousel-counter');
    if (counter && selectedCert && selectedCert.images) {
      counter.textContent = `${carouselIndex + 1} / ${selectedCert.images.filter(Boolean).length}`;
    }

    const dots = document.querySelectorAll('.cert-carousel__dot');
    dots.forEach((dot, idx) => {
      if (idx === carouselIndex) dot.classList.add('cert-carousel__dot--active');
      else dot.classList.remove('cert-carousel__dot--active');
    });
  }

  // Confirm and Execute Delete
  async function confirmDeleteCert(cert) {
    if (!confirm(`Are you sure you want to delete "${cert.name}"?`)) return;

    try {
      const res = await fetch(`/api/certifications/${cert.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete certificate');
      
      // Update local state
      certifications = certifications.filter(c => c.id !== cert.id);
      updateTeaserCard();
      navigateToGrid();
    } catch (err) {
      console.error('Delete error:', err);
      alert('Error deleting certificate: ' + err.message);
    }
  }

  // ==========================================
  // VIEW 3: ADD / EDIT CERTIFICATE FORM
  // ==========================================
  function renderFormView() {
    const isEditing = Boolean(editingCert);
    const cert = editingCert || {
      name: '',
      issuer: '',
      date: new Date().getFullYear().toString(),
      year: new Date().getFullYear().toString(),
      category: 'AI / ML',
      credentialId: '',
      credentialUrl: '',
      skills: [],
      description: ''
    };

    const breadcrumbs = [
      { label: 'Certifications', action: 'grid' },
      { label: isEditing ? `Edit: ${cert.name}` : 'Add Certificate' }
    ];

    const actionsHtml = `
      <button class="btn btn--outline magnetic-btn" id="certs-form-btn-cancel" style="padding: 8px 16px;">
        <span class="material-symbols-outlined" style="font-size: 17px;">close</span>
        <span>Cancel</span>
      </button>
    `;

    updateHeader(breadcrumbs, isEditing ? 'Edit Certificate' : 'Add New Certificate', actionsHtml);

    const cancelBtn = document.getElementById('certs-form-btn-cancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        if (isEditing) openCertDetail(editingCert);
        else navigateToGrid();
      });
    }

    const skillsString = Array.isArray(cert.skills) ? cert.skills.join(', ') : '';

    let html = `
      <div class="certs-form-view">
        <form class="modal__form certs-form" id="certs-manage-form">
          <div id="certs-form-error" class="form-error" style="margin-bottom: 16px;"></div>

          <div class="form-row-2">
            <!-- Name -->
            <div class="form-group">
              <label class="form-label" for="cert-name-input">Certificate Name <span style="color: var(--primary-light);">*</span></label>
              <input type="text" id="cert-name-input" class="form-input" placeholder="e.g. AWS Certified Machine Learning Specialty" value="${escapeHtml(cert.name)}" required autocomplete="off" />
              <div id="cert-name-error" class="form-error"></div>
            </div>

            <!-- Issuer -->
            <div class="form-group">
              <label class="form-label" for="cert-issuer-input">Issuing Organization <span style="color: var(--primary-light);">*</span></label>
              <input type="text" id="cert-issuer-input" class="form-input" placeholder="e.g. Amazon Web Services, Google, NVIDIA" value="${escapeHtml(cert.issuer)}" required autocomplete="off" />
              <div id="cert-issuer-error" class="form-error"></div>
            </div>
          </div>

          <div class="form-row-2">
            <!-- Category -->
            <div class="form-group">
              <label class="form-label" for="cert-category-input">Category</label>
              <select id="cert-category-input" class="form-input cert-category-select">
                <option value="AI / ML" ${cert.category === 'AI / ML' ? 'selected' : ''}>AI / ML</option>
                <option value="Data Science" ${cert.category === 'Data Science' ? 'selected' : ''}>Data Science</option>
                <option value="Cloud" ${cert.category === 'Cloud' ? 'selected' : ''}>Cloud</option>
                <option value="Programming" ${cert.category === 'Programming' ? 'selected' : ''}>Programming</option>
                <option value="Other" ${cert.category === 'Other' ? 'selected' : ''}>Other</option>
              </select>
            </div>

            <!-- Date / Year -->
            <div class="form-group">
              <label class="form-label" for="cert-date-input">Issue Date / Year</label>
              <input type="text" id="cert-date-input" class="form-input" placeholder="e.g. 2024 or Oct 2024" value="${escapeHtml(cert.date || cert.year || '')}" autocomplete="off" />
            </div>
          </div>

          <div class="form-row-2">
            <!-- Credential ID -->
            <div class="form-group">
              <label class="form-label" for="cert-cred-id-input">Credential ID <span style="color: var(--text-muted); font-weight: normal;">(Optional)</span></label>
              <input type="text" id="cert-cred-id-input" class="form-input" placeholder="e.g. AWS-ML-12345" value="${escapeHtml(cert.credentialId || '')}" autocomplete="off" />
            </div>

            <!-- Credential URL -->
            <div class="form-group">
              <label class="form-label" for="cert-cred-url-input">Credential Verification URL <span style="color: var(--text-muted); font-weight: normal;">(Optional)</span></label>
              <input type="url" id="cert-cred-url-input" class="form-input" placeholder="https://coursera.org/verify/..." value="${escapeHtml(cert.credentialUrl || '')}" autocomplete="off" />
            </div>
          </div>

          <!-- Skills / Competencies -->
          <div class="form-group">
            <label class="form-label" for="cert-skills-input">Skills / Topics Covered <span style="color: var(--text-muted); font-weight: normal;">(Comma-separated)</span></label>
            <input type="text" id="cert-skills-input" class="form-input" placeholder="e.g. PyTorch, Computer Vision, Model Optimization, Docker" value="${escapeHtml(skillsString)}" autocomplete="off" />
            <div class="form-hint">Displayed as competency chips on the certificate detail card.</div>
          </div>

          <!-- Description -->
          <div class="form-group">
            <label class="form-label" for="cert-desc-input">Description / Curriculum Summary <span style="color: var(--text-muted); font-weight: normal;">(Optional)</span></label>
            <textarea id="cert-desc-input" class="form-textarea" placeholder="Brief summary of key topics, hands-on labs, or capstone projects completed...">${escapeHtml(cert.description || '')}</textarea>
          </div>

          <!-- Certificate Image / PDF Upload & Management -->
          <div class="form-group">
            <label class="form-label">Certificate Image(s) / PDF <span style="color: var(--text-muted); font-weight: normal;">(Multi-page &amp; PDF supported)</span></label>
            
            <div class="beyond-upload-dropzone" id="cert-dropzone">
              <input type="file" id="cert-file-input" multiple accept="image/*,.svg,.pdf,application/pdf" style="display: none;" />
              <div class="beyond-dropzone-content">
                <span class="material-symbols-outlined beyond-dropzone-icon">cloud_upload</span>
                <p class="beyond-dropzone-title">Click to browse or drag certificate images / PDFs here</p>
                <p class="beyond-dropzone-hint">Supports PNG, JPG, WebP, SVG, and PDF documents. Multiple files supported.</p>
              </div>
            </div>

            <!-- Preview of uploaded images -->
            <div class="beyond-form-images-list" id="cert-form-images-container">
              <!-- Rendered dynamically -->
            </div>
          </div>

          <!-- Submit Buttons -->
          <div class="modal__footer certs-form-footer">
            <button type="button" class="btn btn--secondary magnetic-btn" id="certs-form-cancel-btn">Cancel</button>
            <button type="submit" class="btn btn--primary magnetic-btn" id="certs-form-submit-btn">
              <span>${isEditing ? 'Save Changes' : 'Add Certificate'}</span>
            </button>
          </div>
        </form>
      </div>
    `;

    viewContainer.innerHTML = html;

    renderFormImagesList();

    // Dropzone logic
    const dropzone = document.getElementById('cert-dropzone');
    const fileInput = document.getElementById('cert-file-input');
    
    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => handleFileSelection(e.target.files));

      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('beyond-upload-dropzone--dragover');
      });

      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('beyond-upload-dropzone--dragover');
      });

      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('beyond-upload-dropzone--dragover');
        if (e.dataTransfer && e.dataTransfer.files) {
          handleFileSelection(e.dataTransfer.files);
        }
      });
    }

    // Cancel Button
    const cancelBottomBtn = document.getElementById('certs-form-cancel-btn');
    if (cancelBottomBtn) {
      cancelBottomBtn.addEventListener('click', () => {
        if (isEditing) openCertDetail(editingCert);
        else navigateToGrid();
      });
    }

    // Form Submission
    const form = document.getElementById('certs-manage-form');
    if (form) {
      form.addEventListener('submit', handleFormSubmit);
    }
  }

  // Handle Image & PDF File Selection
  function handleFileSelection(files) {
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

      if (!isImage && !isPdf) {
        alert('File "' + file.name + '" is not a supported image (PNG, JPG, WebP, SVG) or PDF document.');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        formImages.push({
          url: '',
          data: e.target.result,
          name: file.name,
          isPdf: isPdf,
          isCover: formImages.length === 0
        });
        renderFormImagesList();
      };
      reader.readAsDataURL(file);
    });
  }

  // Render Form Images & PDFs List
  function renderFormImagesList() {
    const container = document.getElementById('cert-form-images-container');
    if (!container) return;

    if (formImages.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = formImages.map((img, idx) => {
      const src = img.data || img.url || '';
      const isPdfDoc = Boolean(img.isPdf || isPdfUrl(src) || isPdfUrl(img.url));

      return `
        <div class="beyond-form-img-card ${img.isCover ? 'beyond-form-img-card--cover' : ''} ${isPdfDoc ? 'beyond-form-img-card--pdf' : ''}">
          ${isPdfDoc ? `
            <div class="beyond-form-pdf-thumb">
              <span class="material-symbols-outlined" style="font-size: 30px; color: #ff5252;">picture_as_pdf</span>
              <span class="beyond-form-pdf-badge-tag">PDF</span>
              <span class="beyond-form-pdf-name" title="${escapeHtml(img.name || 'Certificate PDF')}">${escapeHtml(img.name || 'Certificate PDF')}</span>
            </div>
          ` : `
            <img src="${escapeHtml(src)}" alt="Cert preview ${idx + 1}" class="beyond-form-img-thumb" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
            <div class="beyond-form-pdf-thumb" style="display: none;">
              <span class="material-symbols-outlined" style="font-size: 28px; color: var(--primary-light);">workspace_premium</span>
              <span class="beyond-form-pdf-name">${escapeHtml(img.name || 'Attachment')}</span>
            </div>
          `}
          
          <div class="beyond-form-img-overlay">
            <button type="button" class="beyond-form-img-btn set-cover-btn" data-index="${idx}" title="${img.isCover ? 'Main Cover File' : 'Set as Main File'}">
              <span class="material-symbols-outlined" style="font-size: 16px; color: ${img.isCover ? '#ffd700' : '#ffffff'};">
                ${img.isCover ? 'star' : 'star_border'}
              </span>
            </button>
            <button type="button" class="beyond-form-img-btn remove-img-btn" data-index="${idx}" title="Remove File">
              <span class="material-symbols-outlined" style="font-size: 16px; color: #ff8080;">delete</span>
            </button>
          </div>

          ${img.isCover ? `<span class="beyond-form-cover-badge">MAIN</span>` : ''}
        </div>
      `;
    }).join('');

    // Attach button handlers
    container.querySelectorAll('.set-cover-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index, 10);
        formImages.forEach((img, i) => {
          img.isCover = (i === idx);
        });
        // Move cover to index 0
        const cover = formImages.splice(idx, 1)[0];
        formImages.unshift(cover);
        renderFormImagesList();
      });
    });

    container.querySelectorAll('.remove-img-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index, 10);
        formImages.splice(idx, 1);
        if (formImages.length > 0 && !formImages.some(i => i.isCover)) {
          formImages[0].isCover = true;
        }
        renderFormImagesList();
      });
    });
  }

  // Handle Form Submission (Add or Edit)
  async function handleFormSubmit(e) {
    e.preventDefault();
    const errorEl = document.getElementById('certs-form-error');
    if (errorEl) errorEl.textContent = '';

    const nameInput = document.getElementById('cert-name-input');
    const issuerInput = document.getElementById('cert-issuer-input');
    const categoryInput = document.getElementById('cert-category-input');
    const dateInput = document.getElementById('cert-date-input');
    const credIdInput = document.getElementById('cert-cred-id-input');
    const credUrlInput = document.getElementById('cert-cred-url-input');
    const skillsInput = document.getElementById('cert-skills-input');
    const descInput = document.getElementById('cert-desc-input');
    const submitBtn = document.getElementById('certs-form-submit-btn');

    const name = (nameInput ? nameInput.value : '').trim();
    const issuer = (issuerInput ? issuerInput.value : '').trim();

    if (!name) {
      if (errorEl) errorEl.textContent = 'Please enter a certificate name.';
      if (nameInput) nameInput.focus();
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="loading-spinner"></span> Saving...';
    }

    try {
      // 1. Upload new base64 images if any
      const newImagesToUpload = formImages.filter(img => img.data && !img.url);
      let uploadedUrls = [];

      if (newImagesToUpload.length > 0) {
        const uploadRes = await fetch('/api/certifications/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            images: newImagesToUpload.map(img => img.data)
          })
        });

        if (!uploadRes.ok) throw new Error('Failed to upload images');
        const uploadData = await uploadRes.json();
        uploadedUrls = uploadData.urls || [];
      }

      // Map back uploaded URLs to formImages
      let uploadIdx = 0;
      const finalImageUrls = formImages.map(img => {
        if (img.url) return img.url;
        if (uploadedUrls[uploadIdx]) {
          return uploadedUrls[uploadIdx++];
        }
        return null;
      }).filter(Boolean);

      // Parse skills
      const rawSkills = skillsInput ? skillsInput.value : '';
      const skills = rawSkills.split(',').map(s => s.trim()).filter(Boolean);

      const payload = {
        name,
        issuer: issuer || 'Independent Certification',
        date: dateInput ? dateInput.value.trim() : '',
        year: dateInput ? dateInput.value.trim() : '',
        category: categoryInput ? categoryInput.value : 'Other',
        credentialId: credIdInput ? credIdInput.value.trim() : '',
        credentialUrl: credUrlInput ? credUrlInput.value.trim() : '',
        skills,
        description: descInput ? descInput.value.trim() : '',
        images: finalImageUrls
      };

      let resultCert = null;

      if (editingCert) {
        // PUT update
        const res = await fetch(`/api/certifications/${editingCert.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Failed to update certificate');
        resultCert = await res.json();

        // Update in memory
        const idx = certifications.findIndex(c => c.id === editingCert.id);
        if (idx !== -1) certifications[idx] = resultCert;
      } else {
        // POST create
        const res = await fetch('/api/certifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Failed to create certificate');
        resultCert = await res.json();
        certifications.unshift(resultCert);
      }

      updateTeaserCard();
      openCertDetail(resultCert);
    } catch (err) {
      console.error('Error saving certificate:', err);
      if (errorEl) errorEl.textContent = 'Error: ' + err.message;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Save Changes</span>';
      }
    }
  }

  // Initialize safely across all document ready states
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initEvents();
      fetchCertifications();
    });
  } else {
    initEvents();
    fetchCertifications();
  }

})();
