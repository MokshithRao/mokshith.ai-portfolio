/* ============================================================
   BEYOND THE RESUME — Interactive Experience System
   Handles dynamic categories, nested collections, multi-image
   Instagram-style carousel, image uploads, and CRUD operations.
   ============================================================ */

(function () {
  'use strict';

  // Predefined categories configuration
  const PREDEFINED_CATEGORIES = [
    { id: 'Reading', name: 'Reading', icon: 'menu_book', emoji: '📚', desc: 'Books, essays, reading notes & literature' },
    { id: 'Workshops', name: 'Workshops', icon: 'construction', emoji: '🛠️', desc: 'Hands-on technical workshops & lab sessions' },
    { id: 'Events', name: 'Events', icon: 'campaign', emoji: '🎤', desc: 'Conferences, hackathons, seminars & talks' },
    { id: 'Learning', name: 'Learning', icon: 'school', emoji: '🎓', desc: 'Courses, specializations & certifications' },
    { id: 'Activities', name: 'Activities', icon: 'directions_run', emoji: '🏃', desc: 'Athletics, marathons, sports & outdoor pursuits' },
    { id: 'Hobbies', name: 'Hobbies', icon: 'palette', emoji: '🎨', desc: 'Creative pursuits, photography & design' },
    { id: 'Interests', name: 'Interests', icon: 'track_changes', emoji: '🎯', desc: 'Special research topics, curiosities & focus areas' },
    { id: 'Other', name: 'Other', icon: 'auto_awesome', emoji: '✨', desc: 'Experiences, milestones & other memories' }
  ];

  // State
  let beyondItems = [];
  let currentView = 'categories'; // 'categories' | 'category-items' | 'item-detail' | 'form' | 'picker'
  let currentCategory = null;
  let currentItem = null;
  let editingItem = null;
  let formImages = []; // Array of { data, url, isCover }
  let formCustomFields = []; // Array of { label, value }
  let carouselIndex = 0;
  let carouselTouchStartX = 0;
  let carouselTouchEndX = 0;

  // DOM Elements
  const teaserCard = document.getElementById('btn-open-beyond');
  const teaserCategoriesEl = document.getElementById('beyond-teaser-categories');
  const beyondModal = document.getElementById('modal-beyond');
  const breadcrumbsEl = document.getElementById('beyond-breadcrumbs');
  const modalHeadingEl = document.getElementById('beyond-modal-heading');
  const topActionsEl = document.getElementById('beyond-top-actions');
  const viewContainer = document.getElementById('beyond-view-container');

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

  // Helper: Find Category Info
  function getCategoryInfo(catName) {
    if (!catName) return { name: 'General', icon: 'category', emoji: '✨' };
    const found = PREDEFINED_CATEGORIES.find(c => c.name.toLowerCase() === catName.toLowerCase());
    if (found) return found;
    return { name: catName, icon: 'category', emoji: '✨', desc: 'Custom collection' };
  }

  // Fetch Items from Backend
  async function fetchBeyondItems() {
    try {
      const response = await fetch('/api/beyond');
      if (!response.ok) throw new Error('Failed to load Beyond the Resume items');
      const data = await response.json();
      beyondItems = Array.isArray(data) ? data : [];
      updateTeaserCard();
      renderCurrentView();
    } catch (err) {
      console.error('Error fetching beyond items:', err);
      // If server unreachable, fallback gracefully
      updateTeaserCard();
    }
  }

  // Update Teaser Card on Main Portfolio
  function updateTeaserCard() {
    if (!teaserCategoriesEl) return;
    const categoriesWithContent = getActiveCategories();

    if (categoriesWithContent.length === 0) {
      teaserCategoriesEl.innerHTML = `
        <span class="beyond-teaser-chip">✨ Personal Activities &amp; Interests</span>
      `;
      return;
    }

    teaserCategoriesEl.innerHTML = categoriesWithContent.slice(0, 4).map(cat => {
      const count = beyondItems.filter(i => i.category.toLowerCase() === cat.name.toLowerCase()).length;
      return `<span class="beyond-teaser-chip">${cat.emoji || '✨'} ${escapeHtml(cat.name)} (${count})</span>`;
    }).join('') + (categoriesWithContent.length > 4 ? `<span class="beyond-teaser-chip">+${categoriesWithContent.length - 4} more</span>` : '');
  }

  // Get Only Categories that Contain Content
  function getActiveCategories() {
    const activeMap = new Map();
    beyondItems.forEach(item => {
      if (!item.category) return;
      const catKey = item.category.trim();
      if (!activeMap.has(catKey.toLowerCase())) {
        const info = getCategoryInfo(catKey);
        activeMap.set(catKey.toLowerCase(), {
          id: catKey,
          name: catKey,
          icon: item.categoryIcon || info.icon,
          emoji: info.emoji || '✨',
          desc: info.desc || ''
        });
      }
    });
    return Array.from(activeMap.values());
  }

  // Open Modal Entry Point
  window.openBeyondModal = function (targetCategory = null) {
    if (targetCategory) {
      navigateToCategory(targetCategory);
    } else {
      navigateToCategories();
    }
    if (window.openModal) {
      window.openModal('modal-beyond');
    } else {
      const m = document.getElementById('modal-beyond');
      if (m) m.classList.add('active');
    }
  };

  // Setup Event Listeners
  function initEvents() {
    if (teaserCard) {
      teaserCard.addEventListener('click', () => window.openBeyondModal());
      teaserCard.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          window.openBeyondModal();
        }
      });
    }

    // Modal Global Esc / Key Navigation
    document.addEventListener('keydown', (e) => {
      const modal = document.getElementById('modal-beyond');
      if (!modal || !modal.classList.contains('active')) return;

      if (currentView === 'item-detail') {
        if (e.key === 'ArrowLeft') {
          prevSlide();
        } else if (e.key === 'ArrowRight') {
          nextSlide();
        }
      }
    });
  }

  // ================= Navigation Controllers =================

  function navigateToCategories() {
    currentView = 'categories';
    currentCategory = null;
    currentItem = null;
    editingItem = null;
    renderCategoriesView();
  }

  function navigateToCategory(catName) {
    currentView = 'category-items';
    currentCategory = catName;
    currentItem = null;
    editingItem = null;
    renderCategoryItemsView(catName);
  }

  function navigateToItem(itemId) {
    const item = beyondItems.find(i => i.id === itemId);
    if (!item) return;
    currentView = 'item-detail';
    currentItem = item;
    currentCategory = item.category;
    carouselIndex = 0;
    renderItemDetailView(item);
  }

  function navigateToAddItem(prefilledCategory = null) {
    currentView = 'form';
    editingItem = null;
    formImages = [];
    formCustomFields = [{ label: '', value: '' }];
    renderItemForm(prefilledCategory || currentCategory || 'Reading');
  }

  function navigateToEditItem(itemId) {
    const item = beyondItems.find(i => i.id === itemId);
    if (!item) return;
    currentView = 'form';
    editingItem = item;
    formImages = (item.images || []).map((imgUrl, idx) => ({
      url: imgUrl,
      data: null,
      isCover: idx === 0
    }));
    formCustomFields = Array.isArray(item.customFields) && item.customFields.length > 0
      ? JSON.parse(JSON.stringify(item.customFields))
      : [{ label: '', value: '' }];
    renderItemForm(item.category, item);
  }

  function navigateToCategoryPicker() {
    currentView = 'picker';
    renderCategoryPickerView();
  }

  function renderCurrentView() {
    if (currentView === 'categories') {
      renderCategoriesView();
    } else if (currentView === 'category-items') {
      renderCategoryItemsView(currentCategory);
    } else if (currentView === 'item-detail' && currentItem) {
      renderItemDetailView(currentItem);
    } else if (currentView === 'form') {
      renderItemForm(currentCategory, editingItem);
    } else if (currentView === 'picker') {
      renderCategoryPickerView();
    }
  }

  // ================= View 1: Categories Overview =================
  function renderCategoriesView() {
    // Breadcrumbs
    breadcrumbsEl.innerHTML = `
      <span class="beyond-breadcrumb-btn active">Beyond the Resume</span>
    `;

    modalHeadingEl.innerHTML = `
      <span class="material-symbols-outlined" style="color: var(--primary-light);">auto_awesome</span>
      Beyond the Resume
    `;

    topActionsEl.innerHTML = `
      <button type="button" class="btn btn--secondary magnetic-btn" id="beyond-btn-add-cat" style="padding: 7px 16px; font-size: 13px;">
        <span class="material-symbols-outlined" style="font-size: 16px;">create_new_folder</span> Add Category
      </button>
      <button type="button" class="btn btn--primary magnetic-btn" id="beyond-btn-add-item" style="padding: 7px 18px; font-size: 13px;">
        <span class="material-symbols-outlined" style="font-size: 16px;">add</span> Add Item
      </button>
    `;

    document.getElementById('beyond-btn-add-cat')?.addEventListener('click', navigateToCategoryPicker);
    document.getElementById('beyond-btn-add-item')?.addEventListener('click', () => navigateToAddItem());

    const activeCategories = getActiveCategories();

    if (activeCategories.length === 0) {
      viewContainer.innerHTML = `
        <div class="beyond-empty-state">
          <div class="beyond-empty-state__icon">
            <span class="material-symbols-outlined" style="font-size: 28px;">auto_awesome</span>
          </div>
          <h3 class="beyond-empty-state__title">No Entries Yet</h3>
          <p class="beyond-empty-state__desc">
            Start building your "Beyond the Resume" collection by adding your books, workshops, certifications, or personal activities.
          </p>
          <button type="button" class="btn btn--primary magnetic-btn" id="btn-empty-add-item" style="padding: 10px 24px;">
            <span class="material-symbols-outlined">add</span> Add Your First Item
          </button>
        </div>
      `;
      document.getElementById('btn-empty-add-item')?.addEventListener('click', () => navigateToAddItem());
      return;
    }

    let cardsHtml = activeCategories.map(cat => {
      const itemsInCat = beyondItems.filter(i => i.category.toLowerCase() === cat.name.toLowerCase());
      const count = itemsInCat.length;

      // Extract up to 3 thumbnails from items in this category
      const thumbs = [];
      for (const it of itemsInCat) {
        if (it.images && it.images.length > 0) {
          thumbs.push(it.images[0]);
          if (thumbs.length >= 3) break;
        }
      }

      let thumbsHtml = '';
      if (thumbs.length > 0) {
        thumbsHtml = `
          <div class="beyond-cat-card__thumbs">
            ${thumbs.map(t => `<img src="${escapeHtml(t)}" alt="Preview" class="beyond-cat-card__thumb" loading="lazy" onerror="this.style.display='none'" />`).join('')}
            <span class="beyond-cat-card__arrow material-symbols-outlined">arrow_forward</span>
          </div>
        `;
      } else {
        thumbsHtml = `
          <div class="beyond-cat-card__thumbs">
            <div class="beyond-cat-card__thumb-placeholder">
              <span class="material-symbols-outlined">${cat.icon || 'menu_book'}</span>
            </div>
            <span class="beyond-cat-card__arrow material-symbols-outlined">arrow_forward</span>
          </div>
        `;
      }

      return `
        <div class="beyond-cat-card" data-category="${escapeHtml(cat.name)}" tabindex="0" role="button">
          <div class="beyond-cat-card__header">
            <div class="beyond-cat-card__icon-box">
              <span class="material-symbols-outlined">${cat.icon || 'category'}</span>
            </div>
            <span class="beyond-cat-card__count">${count} ${count === 1 ? 'item' : 'items'}</span>
          </div>
          <div>
            <h3 class="beyond-cat-card__name">${cat.emoji || ''} ${escapeHtml(cat.name)}</h3>
            <p style="font-size: 12px; color: var(--text-muted);">${escapeHtml(cat.desc || '')}</p>
          </div>
          ${thumbsHtml}
        </div>
      `;
    }).join('');

    viewContainer.innerHTML = `
      <div class="beyond-view-header">
        <div>
          <p class="beyond-view-desc">
            A glimpse into the things I explore, learn, and enjoy beyond my professional work.
          </p>
        </div>
      </div>
      <div class="beyond-categories-grid">
        ${cardsHtml}
      </div>
    `;

    // Attach click handlers to category cards
    viewContainer.querySelectorAll('.beyond-cat-card').forEach(card => {
      const cat = card.getAttribute('data-category');
      card.addEventListener('click', () => navigateToCategory(cat));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigateToCategory(cat);
        }
      });
    });
  }

  // ================= Reusable Card Component =================
  function renderItemCard(item, catInfo) {
    const hasImages = Array.isArray(item.images) && item.images.length > 0;
    const firstImage = hasImages ? item.images[0] : null;
    const imgCount = hasImages ? item.images.length : 0;

    let mediaHtml = '';
    if (firstImage) {
      mediaHtml = `
        <div class="beyond-item-card__media">
          <img src="${escapeHtml(firstImage)}" alt="${escapeHtml(item.title)}" class="beyond-item-card__img" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'beyond-item-card__no-media\\'><div class=\\'beyond-item-card__placeholder-icon\\'><span class=\\'material-symbols-outlined\\'>${catInfo.icon || 'image'}</span></div></div>'" />
          <div class="beyond-item-card__media-gradient"></div>
          ${imgCount > 1 ? `<span class="beyond-item-card__photo-badge"><span class="material-symbols-outlined" style="font-size: 13px;">photo_library</span> ${imgCount}</span>` : ''}
          ${item.status ? `<span class="beyond-item-card__status-badge">${escapeHtml(item.status)}</span>` : ''}
        </div>
      `;
    } else {
      mediaHtml = `
        <div class="beyond-item-card__no-media">
          <div class="beyond-item-card__placeholder-icon">
            <span class="material-symbols-outlined">${catInfo.icon || 'category'}</span>
          </div>
          ${item.status ? `<span class="beyond-item-card__status-badge">${escapeHtml(item.status)}</span>` : ''}
        </div>
      `;
    }

    // Determine secondary metadata line: subtitle or first custom field
    let secondaryMetadata = item.subtitle ? item.subtitle : '';
    if (!secondaryMetadata && Array.isArray(item.customFields) && item.customFields.length > 0) {
      const firstF = item.customFields[0];
      if (firstF && (firstF.label || firstF.value)) {
        secondaryMetadata = (firstF.label ? `${firstF.label}: ` : '') + (firstF.value || '');
      }
    }

    return `
      <div class="beyond-item-card" data-item-id="${escapeHtml(item.id)}" tabindex="0" role="button" aria-label="${escapeHtml(item.title)}">
        ${mediaHtml}
        <div class="beyond-item-card__content">
          ${item.date ? `<span class="beyond-item-card__date">${escapeHtml(item.date)}</span>` : ''}
          <h4 class="beyond-item-card__title">${escapeHtml(item.title)}</h4>
          ${secondaryMetadata ? `<p class="beyond-item-card__subtitle">${escapeHtml(secondaryMetadata)}</p>` : ''}
          <div class="beyond-item-card__footer">
            <span class="beyond-item-card__view-btn">
              View Details <span class="material-symbols-outlined beyond-item-card__arrow">arrow_forward</span>
            </span>
          </div>
        </div>
      </div>
    `;
  }

  // ================= Reusable Image Gallery Component =================
  function renderImageGallery(images, itemTitle) {
    if (!Array.isArray(images) || images.length === 0) return '';

    const slidesHtml = images.map((imgUrl, idx) => `
      <div class="beyond-carousel__slide" data-index="${idx}">
        <div class="beyond-carousel__backdrop" style="background-image: url('${escapeHtml(imgUrl)}');"></div>
        <img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(itemTitle)} - Photo ${idx + 1}" class="beyond-carousel__img" loading="lazy" />
      </div>
    `).join('');

    const hasMultiple = images.length > 1;

    return `
      <div class="beyond-carousel" id="beyond-carousel">
        <div class="beyond-carousel__viewport" id="beyond-carousel-viewport">
          <div class="beyond-carousel__track" id="beyond-carousel-track">
            ${slidesHtml}
          </div>
        </div>

        ${hasMultiple ? `
          <button type="button" class="beyond-carousel__nav-btn beyond-carousel__nav-btn--prev" id="carousel-prev" aria-label="Previous Image">
            <span class="material-symbols-outlined">chevron_left</span>
          </button>
          <button type="button" class="beyond-carousel__nav-btn beyond-carousel__nav-btn--next" id="carousel-next" aria-label="Next Image">
            <span class="material-symbols-outlined">chevron_right</span>
          </button>

          <div class="beyond-carousel__dots" id="carousel-dots">
            ${images.map((_, idx) => `<div class="beyond-carousel__dot ${idx === 0 ? 'active' : ''}" data-index="${idx}"></div>`).join('')}
          </div>

          <div class="beyond-carousel__counter" id="carousel-counter">1 / ${images.length}</div>
        ` : ''}
      </div>
    `;
  }

  // ================= View 2: Category Items Grid =================
  function renderCategoryItemsView(catName) {
    const catInfo = getCategoryInfo(catName);
    const items = beyondItems.filter(i => i.category.toLowerCase() === catName.toLowerCase());

    // Breadcrumbs
    breadcrumbsEl.innerHTML = `
      <button type="button" class="beyond-breadcrumb-btn" id="bc-home">
        <span class="material-symbols-outlined" style="font-size: 14px;">arrow_back</span> Beyond the Resume
      </button>
      <span class="beyond-breadcrumb-sep">/</span>
      <span class="beyond-breadcrumb-btn active">${catInfo.emoji || ''} ${escapeHtml(catName)}</span>
    `;
    document.getElementById('bc-home')?.addEventListener('click', navigateToCategories);

    modalHeadingEl.innerHTML = `
      <span class="material-symbols-outlined" style="color: var(--primary-light);">${catInfo.icon || 'category'}</span>
      ${catInfo.emoji || ''} ${escapeHtml(catName)}
    `;

    topActionsEl.innerHTML = `
      <button type="button" class="btn btn--secondary magnetic-btn" id="beyond-btn-back-cats" style="padding: 7px 14px; font-size: 13px;">
        <span class="material-symbols-outlined" style="font-size: 16px;">arrow_back</span> Back
      </button>
      <button type="button" class="btn btn--primary magnetic-btn" id="beyond-btn-add-item-cat" style="padding: 7px 18px; font-size: 13px;">
        <span class="material-symbols-outlined" style="font-size: 16px;">add</span> Add ${escapeHtml(catName)}
      </button>
    `;

    document.getElementById('beyond-btn-back-cats')?.addEventListener('click', navigateToCategories);
    document.getElementById('beyond-btn-add-item-cat')?.addEventListener('click', () => navigateToAddItem(catName));

    if (items.length === 0) {
      viewContainer.innerHTML = `
        <div class="beyond-empty-state">
          <div class="beyond-empty-state__icon">
            <span class="material-symbols-outlined" style="font-size: 28px;">${catInfo.icon || 'folder_open'}</span>
          </div>
          <h3 class="beyond-empty-state__title">No items in ${escapeHtml(catName)}</h3>
          <p class="beyond-empty-state__desc">Add your first entry under this category.</p>
          <button type="button" class="btn btn--primary magnetic-btn" id="btn-empty-add-cat-item" style="padding: 10px 24px;">
            <span class="material-symbols-outlined">add</span> Add ${escapeHtml(catName)} Entry
          </button>
        </div>
      `;
      document.getElementById('btn-empty-add-cat-item')?.addEventListener('click', () => navigateToAddItem(catName));
      return;
    }

    const itemsHtml = items.map(item => renderItemCard(item, catInfo)).join('');

    viewContainer.innerHTML = `
      <div class="beyond-view-header">
        <div>
          <p class="beyond-view-desc">
            Showing all entries in <strong>${escapeHtml(catName)}</strong> (${items.length} ${items.length === 1 ? 'entry' : 'entries'}).
          </p>
        </div>
      </div>
      <div class="beyond-items-grid">
        ${itemsHtml}
      </div>
    `;

    viewContainer.querySelectorAll('.beyond-item-card').forEach(card => {
      const id = card.getAttribute('data-item-id');
      card.addEventListener('click', () => navigateToItem(id));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigateToItem(id);
        }
      });
    });
  }

  // ================= View 3: Full Item Detail View & Instagram Carousel =================
  function renderItemDetailView(item) {
    const catInfo = getCategoryInfo(item.category);
    const images = Array.isArray(item.images) ? item.images : [];
    carouselIndex = 0;

    // Breadcrumbs
    breadcrumbsEl.innerHTML = `
      <button type="button" class="beyond-breadcrumb-btn" id="bc-home">
        Beyond the Resume
      </button>
      <span class="beyond-breadcrumb-sep">/</span>
      <button type="button" class="beyond-breadcrumb-btn" id="bc-cat">
        ${catInfo.emoji || ''} ${escapeHtml(item.category)}
      </button>
      <span class="beyond-breadcrumb-sep">/</span>
      <span class="beyond-breadcrumb-btn active">${escapeHtml(item.title)}</span>
    `;
    document.getElementById('bc-home')?.addEventListener('click', navigateToCategories);
    document.getElementById('bc-cat')?.addEventListener('click', () => navigateToCategory(item.category));

    modalHeadingEl.innerHTML = `
      <span class="material-symbols-outlined" style="color: var(--primary-light);">${catInfo.icon || 'description'}</span>
      ${escapeHtml(item.title)}
    `;

    topActionsEl.innerHTML = `
      <button type="button" class="btn btn--secondary magnetic-btn" id="beyond-btn-back-list" style="padding: 7px 14px; font-size: 13px;">
        <span class="material-symbols-outlined" style="font-size: 16px;">arrow_back</span> Back to ${escapeHtml(item.category)}
      </button>
    `;
    document.getElementById('beyond-btn-back-list')?.addEventListener('click', () => navigateToCategory(item.category));

    // Render reusable gallery component
    const carouselHtml = renderImageGallery(images, item.title);

    // Custom Fields Grid
    let customFieldsHtml = '';
    if (Array.isArray(item.customFields) && item.customFields.length > 0) {
      const validFields = item.customFields.filter(f => f && (f.label || f.value));
      if (validFields.length > 0) {
        customFieldsHtml = `
          <div class="beyond-detail__fields-grid">
            ${validFields.map(f => `
              <div class="beyond-detail__field-card">
                <span class="beyond-detail__field-label">${escapeHtml(f.label || 'Detail')}</span>
                <span class="beyond-detail__field-val">${escapeHtml(f.value || '')}</span>
              </div>
            `).join('')}
          </div>
        `;
      }
    }

    viewContainer.innerHTML = `
      <div class="beyond-detail">
        ${carouselHtml}

        <div class="beyond-detail__header">
          <div class="beyond-detail__meta-top">
            <span class="beyond-detail__category-badge">
              <span class="material-symbols-outlined" style="font-size: 14px;">${catInfo.icon || 'category'}</span>
              ${catInfo.emoji || ''} ${escapeHtml(item.category)}
            </span>
            ${item.status ? `<span class="beyond-detail__status-badge">${escapeHtml(item.status)}</span>` : ''}
            ${item.date ? `<span class="beyond-detail__date">${escapeHtml(item.date)}</span>` : ''}
          </div>

          <h2 class="beyond-detail__title">${escapeHtml(item.title)}</h2>
          ${item.subtitle ? `<h3 class="beyond-detail__subtitle">${escapeHtml(item.subtitle)}</h3>` : ''}
        </div>

        ${item.description ? `
          <div class="beyond-detail__desc">
            ${escapeHtml(item.description)}
          </div>
        ` : ''}

        ${customFieldsHtml}

        <div class="beyond-detail__footer">
          ${item.link ? `
            <a href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer" class="btn btn--outline magnetic-btn beyond-detail__link-btn">
              <span class="material-symbols-outlined" style="font-size: 18px;">open_in_new</span>
              ${escapeHtml(item.linkLabel || 'External Link / Resource')}
            </a>
          ` : '<div></div>'}

          <div class="beyond-detail__admin-actions">
            <button type="button" class="btn btn--secondary magnetic-btn" id="btn-edit-item" style="padding: 8px 18px; font-size: 13px;">
              <span class="material-symbols-outlined" style="font-size: 16px;">edit</span> Edit
            </button>
            <button type="button" class="btn btn--danger magnetic-btn" id="btn-delete-item" style="padding: 8px 18px; font-size: 13px;">
              <span class="material-symbols-outlined" style="font-size: 16px;">delete</span> Delete
            </button>
          </div>
        </div>
      </div>
    `;

    // Attach Carousel Logic
    if (images.length > 1) {
      setupCarousel(images.length);
    }

    // Attach Edit & Delete handlers
    document.getElementById('btn-edit-item')?.addEventListener('click', () => navigateToEditItem(item.id));
    document.getElementById('btn-delete-item')?.addEventListener('click', () => confirmDeleteItem(item));
  }

  // Instagram-style Carousel Controller
  function setupCarousel(totalSlides) {
    const track = document.getElementById('beyond-carousel-track');
    const viewport = document.getElementById('beyond-carousel-viewport');
    const prevBtn = document.getElementById('carousel-prev');
    const nextBtn = document.getElementById('carousel-next');
    const dots = document.querySelectorAll('.beyond-carousel__dot');
    const counter = document.getElementById('carousel-counter');

    function updateCarousel() {
      if (!track) return;
      track.style.transform = `translateX(-${carouselIndex * 100}%)`;
      if (counter) counter.textContent = `${carouselIndex + 1} / ${totalSlides}`;
      dots.forEach((dot, idx) => {
        dot.classList.toggle('active', idx === carouselIndex);
      });
    }

    window.nextSlide = function () {
      carouselIndex = (carouselIndex + 1) % totalSlides;
      updateCarousel();
    };

    window.prevSlide = function () {
      carouselIndex = (carouselIndex - 1 + totalSlides) % totalSlides;
      updateCarousel();
    };

    prevBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      window.prevSlide();
    });

    nextBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      window.nextSlide();
    });

    dots.forEach((dot) => {
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(dot.getAttribute('data-index'), 10);
        if (!isNaN(idx)) {
          carouselIndex = idx;
          updateCarousel();
        }
      });
    });

    // Touch & Swipe gesture handling
    if (viewport) {
      viewport.addEventListener('touchstart', (e) => {
        carouselTouchStartX = e.changedTouches[0].screenX;
      }, { passive: true });

      viewport.addEventListener('touchend', (e) => {
        carouselTouchEndX = e.changedTouches[0].screenX;
        handleSwipe();
      }, { passive: true });

      let isMouseDown = false;
      let mouseStartX = 0;

      viewport.addEventListener('mousedown', (e) => {
        isMouseDown = true;
        mouseStartX = e.clientX;
      });

      viewport.addEventListener('mouseup', (e) => {
        if (!isMouseDown) return;
        isMouseDown = false;
        const mouseEndX = e.clientX;
        if (mouseStartX - mouseEndX > 40) {
          window.nextSlide();
        } else if (mouseEndX - mouseStartX > 40) {
          window.prevSlide();
        }
      });

      viewport.addEventListener('mouseleave', () => {
        isMouseDown = false;
      });
    }

    function handleSwipe() {
      const diff = carouselTouchStartX - carouselTouchEndX;
      if (diff > 45) {
        window.nextSlide();
      } else if (diff < -45) {
        window.prevSlide();
      }
    }
  }

  // ================= View 4: Add / Edit Item Form =================
  function renderItemForm(defaultCategory, itemToEdit = null) {
    const isEdit = !!itemToEdit;
    const catName = defaultCategory || (itemToEdit ? itemToEdit.category : 'Reading');
    const catInfo = getCategoryInfo(catName);

    breadcrumbsEl.innerHTML = `
      <button type="button" class="beyond-breadcrumb-btn" id="bc-home">
        Beyond the Resume
      </button>
      <span class="beyond-breadcrumb-sep">/</span>
      <span class="beyond-breadcrumb-btn active">${isEdit ? 'Edit Item' : 'Add Item'}</span>
    `;
    document.getElementById('bc-home')?.addEventListener('click', navigateToCategories);

    modalHeadingEl.innerHTML = `
      <span class="material-symbols-outlined" style="color: var(--primary-light);">${isEdit ? 'edit_note' : 'add_circle'}</span>
      ${isEdit ? 'Edit Item' : 'Add to Beyond the Resume'}
    `;

    topActionsEl.innerHTML = `
      <button type="button" class="btn btn--secondary magnetic-btn" id="beyond-form-cancel-top" style="padding: 7px 14px; font-size: 13px;">
        Cancel
      </button>
    `;
    document.getElementById('beyond-form-cancel-top')?.addEventListener('click', () => {
      if (isEdit) navigateToItem(itemToEdit.id);
      else if (currentCategory) navigateToCategory(currentCategory);
      else navigateToCategories();
    });

    const categoriesOptions = PREDEFINED_CATEGORIES.map(c => `
      <option value="${c.name}" ${c.name.toLowerCase() === catName.toLowerCase() ? 'selected' : ''}>
        ${c.emoji} ${c.name}
      </option>
    `).join('');

    viewContainer.innerHTML = `
      <form class="beyond-form" id="beyond-item-form">
        <div id="beyond-form-error" class="form-error"></div>

        <div class="beyond-form-grid-2">
          <div class="form-group">
            <label class="form-label" for="beyond-form-category">Category <span style="color: var(--primary-light);">*</span></label>
            <select id="beyond-form-category" class="form-input" style="cursor: pointer;">
              ${categoriesOptions}
              <option value="__custom__">Custom Category...</option>
            </select>
          </div>

          <div class="form-group" id="beyond-custom-cat-group" style="display: none;">
            <label class="form-label" for="beyond-form-custom-category">Custom Category Name <span style="color: var(--primary-light);">*</span></label>
            <input type="text" id="beyond-form-custom-category" class="form-input" placeholder="e.g. Certifications, Volunteering" />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="beyond-form-title">Title / Name <span style="color: var(--primary-light);">*</span></label>
          <input type="text" id="beyond-form-title" class="form-input" placeholder="e.g. Ikigai, Generative AI Workshop, Campus 5K Marathon" value="${escapeHtml(itemToEdit ? itemToEdit.title : '')}" autocomplete="off" required />
        </div>

        <div class="beyond-form-grid-2">
          <div class="form-group">
            <label class="form-label" for="beyond-form-subtitle">Subtitle / Host / Author</label>
            <input type="text" id="beyond-form-subtitle" class="form-input" placeholder="e.g. By Héctor García, Organised by DeepMind, Annual Tech Run" value="${escapeHtml(itemToEdit ? itemToEdit.subtitle : '')}" />
          </div>

          <div class="beyond-form-grid-2">
            <div class="form-group">
              <label class="form-label" for="beyond-form-status">Status / Tag</label>
              <input type="text" id="beyond-form-status" class="form-input" placeholder="e.g. Completed, Attended, In Progress" value="${escapeHtml(itemToEdit ? itemToEdit.status : 'Completed')}" />
            </div>
            <div class="form-group">
              <label class="form-label" for="beyond-form-date">Date / Year</label>
              <input type="text" id="beyond-form-date" class="form-input" placeholder="e.g. Sep 2026, 2025" value="${escapeHtml(itemToEdit ? itemToEdit.date : '2026')}" />
            </div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="beyond-form-desc">Description / Takeaways</label>
          <textarea id="beyond-form-desc" class="form-textarea" style="min-height: 110px;" placeholder="Describe the experience, key insights, learnings, or takeaways...">${escapeHtml(itemToEdit ? itemToEdit.description : '')}</textarea>
        </div>

        <!-- Multi-Image Upload Section -->
        <div class="form-group">
          <label class="form-label">Photos &amp; Documentation <span style="font-weight: 400; text-transform: none; color: var(--text-muted);">(Multiple images supported, Instagram-style carousel)</span></label>
          
          <div class="beyond-upload-zone" id="beyond-upload-zone">
            <span class="material-symbols-outlined beyond-upload-zone__icon">cloud_upload</span>
            <div class="beyond-upload-zone__text">Click to upload or drag and drop images here</div>
            <div class="beyond-upload-zone__subtext">Supports JPG, PNG, WebP (The 1st image becomes the primary cover photo)</div>
            <input type="file" id="beyond-file-input" multiple accept="image/*" style="display: none;" />
          </div>

          <div class="beyond-form-images-list" id="beyond-form-images-list">
            <!-- Rendered dynamically -->
          </div>
        </div>

        <!-- Custom Fields Dynamic Adder -->
        <div class="form-group">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <label class="form-label" style="margin-bottom: 0;">Key Highlights / Metadata Fields</label>
            <button type="button" class="btn btn--secondary magnetic-btn" id="btn-add-custom-field" style="padding: 4px 10px; font-size: 11px;">
              <span class="material-symbols-outlined" style="font-size: 14px;">add</span> Add Field
            </button>
          </div>
          <div class="beyond-custom-fields-wrap" id="beyond-custom-fields-wrap">
            <!-- Custom fields rendered dynamically -->
          </div>
        </div>

        <div class="beyond-form-grid-2">
          <div class="form-group">
            <label class="form-label" for="beyond-form-link">Optional Link URL</label>
            <input type="url" id="beyond-form-link" class="form-input" placeholder="https://..." value="${escapeHtml(itemToEdit ? itemToEdit.link : '')}" />
          </div>
          <div class="form-group">
            <label class="form-label" for="beyond-form-link-label">Link Button Label</label>
            <input type="text" id="beyond-form-link-label" class="form-input" placeholder="e.g. View Certificate, Goodreads Link" value="${escapeHtml(itemToEdit ? itemToEdit.linkLabel : '')}" />
          </div>
        </div>

        <div class="modal__footer" style="padding-top: 20px; margin-top: 8px; justify-content: flex-end; gap: 12px;">
          <button type="button" class="btn btn--secondary magnetic-btn" id="beyond-form-cancel" style="padding: 10px 24px;">Cancel</button>
          <button type="submit" id="beyond-form-submit" class="btn btn--primary magnetic-btn" style="padding: 10px 28px;">
            ${isEdit ? 'Save Changes' : 'Add Item'}
          </button>
        </div>
      </form>
    `;

    // Category Select change handler
    const catSelect = document.getElementById('beyond-form-category');
    const customCatGroup = document.getElementById('beyond-custom-cat-group');
    catSelect?.addEventListener('change', () => {
      if (catSelect.value === '__custom__') {
        customCatGroup.style.display = 'block';
        document.getElementById('beyond-form-custom-category')?.focus();
      } else {
        customCatGroup.style.display = 'none';
      }
    });

    // Cancel Button handler
    document.getElementById('beyond-form-cancel')?.addEventListener('click', () => {
      if (isEdit) navigateToItem(itemToEdit.id);
      else if (currentCategory) navigateToCategory(currentCategory);
      else navigateToCategories();
    });

    // Custom Fields UI
    renderFormCustomFields();
    document.getElementById('btn-add-custom-field')?.addEventListener('click', () => {
      formCustomFields.push({ label: '', value: '' });
      renderFormCustomFields();
    });

    // Image Upload Zone setup
    setupImageUploadZone();
    renderFormImagesList();

    // Form Submit
    const form = document.getElementById('beyond-item-form');
    form?.addEventListener('submit', (e) => handleFormSubmit(e, itemToEdit));
  }

  // Render Custom Fields rows in form
  function renderFormCustomFields() {
    const wrap = document.getElementById('beyond-custom-fields-wrap');
    if (!wrap) return;

    if (formCustomFields.length === 0) {
      wrap.innerHTML = `<p style="font-size: 12px; color: var(--text-muted);">No extra fields. Click "Add Field" above to add metadata like Author, Certificate ID, Rating, etc.</p>`;
      return;
    }

    wrap.innerHTML = formCustomFields.map((field, idx) => `
      <div class="beyond-custom-field-row" data-index="${idx}">
        <input type="text" class="form-input custom-field-label" placeholder="Label (e.g. Author, Rating)" value="${escapeHtml(field.label)}" style="max-width: 180px;" />
        <input type="text" class="form-input custom-field-value" placeholder="Value (e.g. James Clear, 5/5)" value="${escapeHtml(field.value)}" />
        <button type="button" class="beyond-custom-field-remove" data-remove-index="${idx}" aria-label="Remove Field">
          <span class="material-symbols-outlined" style="font-size: 18px;">close</span>
        </button>
      </div>
    `).join('');

    // Attach listeners
    wrap.querySelectorAll('.custom-field-label').forEach((input, idx) => {
      input.addEventListener('input', (e) => { formCustomFields[idx].label = e.target.value; });
    });
    wrap.querySelectorAll('.custom-field-value').forEach((input, idx) => {
      input.addEventListener('input', (e) => { formCustomFields[idx].value = e.target.value; });
    });
    wrap.querySelectorAll('.beyond-custom-field-remove').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-remove-index'), 10);
        formCustomFields.splice(idx, 1);
        renderFormCustomFields();
      });
    });
  }

  // Setup Image Upload Zone (Drop, Click, File Reader)
  function setupImageUploadZone() {
    const zone = document.getElementById('beyond-upload-zone');
    const fileInput = document.getElementById('beyond-file-input');
    if (!zone || !fileInput) return;

    zone.addEventListener('click', () => fileInput.click());

    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('dragover');
    });

    zone.addEventListener('dragleave', () => {
      zone.classList.remove('dragover');
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        processUploadedFiles(Array.from(e.dataTransfer.files));
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        processUploadedFiles(Array.from(e.target.files));
      }
      fileInput.value = '';
    });
  }

  // Read files and add to formImages
  function processUploadedFiles(files) {
    const validImageFiles = files.filter(f => f.type.startsWith('image/'));
    if (validImageFiles.length === 0) return;

    let loaded = 0;
    validImageFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        formImages.push({
          url: e.target.result,
          data: e.target.result,
          isCover: formImages.length === 0
        });
        loaded++;
        if (loaded === validImageFiles.length) {
          renderFormImagesList();
        }
      };
      reader.readAsDataURL(file);
    });
  }

  // Render Thumbnails in Form
  function renderFormImagesList() {
    const list = document.getElementById('beyond-form-images-list');
    if (!list) return;

    if (formImages.length === 0) {
      list.innerHTML = '';
      return;
    }

    list.innerHTML = formImages.map((img, idx) => `
      <div class="beyond-form-img-card ${idx === 0 ? 'is-cover' : ''}">
        <img src="${escapeHtml(img.url || img.data)}" alt="Upload thumbnail ${idx + 1}" />
        ${idx === 0 ? `<span class="beyond-form-img-card__badge">★ Cover</span>` : ''}
        <div class="beyond-form-img-card__actions">
          ${idx > 0 ? `
            <button type="button" class="beyond-form-img-btn" data-action="make-cover" data-index="${idx}" title="Set as primary cover">
              <span class="material-symbols-outlined" style="font-size: 15px;">star</span>
            </button>
            <button type="button" class="beyond-form-img-btn" data-action="move-left" data-index="${idx}" title="Move left">
              <span class="material-symbols-outlined" style="font-size: 15px;">arrow_back</span>
            </button>
          ` : '<div></div>'}
          ${idx < formImages.length - 1 ? `
            <button type="button" class="beyond-form-img-btn" data-action="move-right" data-index="${idx}" title="Move right">
              <span class="material-symbols-outlined" style="font-size: 15px;">arrow_forward</span>
            </button>
          ` : ''}
          <button type="button" class="beyond-form-img-btn beyond-form-img-btn--delete" data-action="delete" data-index="${idx}" title="Remove photo">
            <span class="material-symbols-outlined" style="font-size: 15px;">delete</span>
          </button>
        </div>
      </div>
    `).join('');

    // Attach actions
    list.querySelectorAll('[data-action="make-cover"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        const [target] = formImages.splice(idx, 1);
        formImages.unshift(target);
        renderFormImagesList();
      });
    });

    list.querySelectorAll('[data-action="move-left"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        if (idx > 0) {
          const temp = formImages[idx];
          formImages[idx] = formImages[idx - 1];
          formImages[idx - 1] = temp;
          renderFormImagesList();
        }
      });
    });

    list.querySelectorAll('[data-action="move-right"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        if (idx < formImages.length - 1) {
          const temp = formImages[idx];
          formImages[idx] = formImages[idx + 1];
          formImages[idx + 1] = temp;
          renderFormImagesList();
        }
      });
    });

    list.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        formImages.splice(idx, 1);
        renderFormImagesList();
      });
    });
  }

  // Handle Form Submission (Upload images + Save item)
  async function handleFormSubmit(e, itemToEdit = null) {
    e.preventDefault();
    const errorEl = document.getElementById('beyond-form-error');
    const submitBtn = document.getElementById('beyond-form-submit');
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.classList.remove('visible');
    }

    const catSelect = document.getElementById('beyond-form-category');
    let category = catSelect?.value;
    if (category === '__custom__') {
      const customCatInput = document.getElementById('beyond-form-custom-category');
      category = (customCatInput?.value || '').trim();
    }

    const title = (document.getElementById('beyond-form-title')?.value || '').trim();
    const subtitle = (document.getElementById('beyond-form-subtitle')?.value || '').trim();
    const status = (document.getElementById('beyond-form-status')?.value || '').trim();
    const date = (document.getElementById('beyond-form-date')?.value || '').trim();
    const description = (document.getElementById('beyond-form-desc')?.value || '').trim();
    const link = (document.getElementById('beyond-form-link')?.value || '').trim();
    const linkLabel = (document.getElementById('beyond-form-link-label')?.value || '').trim();

    if (!category) {
      showFormError('Please specify a category');
      return;
    }

    if (!title) {
      showFormError('Please provide a title for this entry');
      return;
    }

    // Disable button during submit
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving...';
    }

    try {
      // 1. Process and upload any new base64 images
      const newBase64Images = formImages.filter(img => img.data && img.data.startsWith('data:image/'));
      const existingUrls = formImages.filter(img => !img.data || !img.data.startsWith('data:image/')).map(img => img.url);

      let uploadedUrls = [];
      if (newBase64Images.length > 0) {
        const uploadRes = await fetch('/api/beyond/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ images: newBase64Images.map(img => img.data) })
        });
        if (!uploadRes.ok) throw new Error('Image upload failed');
        const uploadData = await uploadRes.json();
        uploadedUrls = uploadData.urls || [];
      }

      // Reassemble final images array maintaining order
      const finalImages = [];
      let uploadPtr = 0;
      formImages.forEach(img => {
        if (img.data && img.data.startsWith('data:image/')) {
          if (uploadPtr < uploadedUrls.length) {
            finalImages.push(uploadedUrls[uploadPtr++]);
          }
        } else if (img.url) {
          finalImages.push(img.url);
        }
      });

      // Filter valid custom fields
      const cleanedCustomFields = formCustomFields
        .filter(f => f && (f.label.trim() || f.value.trim()))
        .map(f => ({ label: f.label.trim(), value: f.value.trim() }));

      const payload = {
        category,
        title,
        subtitle,
        status,
        date,
        description,
        images: finalImages,
        link,
        linkLabel,
        customFields: cleanedCustomFields
      };

      let saveRes;
      if (itemToEdit) {
        saveRes = await fetch(`/api/beyond/items/${itemToEdit.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        saveRes = await fetch('/api/beyond/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (!saveRes.ok) {
        const errJson = await saveRes.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to save item');
      }

      const savedItem = await saveRes.json();
      await fetchBeyondItems();
      navigateToItem(savedItem.id);
    } catch (err) {
      console.error('Error submitting form:', err);
      showFormError(err.message || 'Error saving item');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = itemToEdit ? 'Save Changes' : 'Add Item';
      }
    }
  }

  function showFormError(msg) {
    const errorEl = document.getElementById('beyond-form-error');
    if (errorEl) {
      errorEl.textContent = msg;
      errorEl.classList.add('visible');
    }
  }

  // ================= View 5: Category Picker =================
  function renderCategoryPickerView() {
    breadcrumbsEl.innerHTML = `
      <button type="button" class="beyond-breadcrumb-btn" id="bc-home">
        Beyond the Resume
      </button>
      <span class="beyond-breadcrumb-sep">/</span>
      <span class="beyond-breadcrumb-btn active">Add Category</span>
    `;
    document.getElementById('bc-home')?.addEventListener('click', navigateToCategories);

    modalHeadingEl.innerHTML = `
      <span class="material-symbols-outlined" style="color: var(--primary-light);">category</span>
      Choose a Category
    `;

    topActionsEl.innerHTML = `
      <button type="button" class="btn btn--secondary magnetic-btn" id="picker-cancel" style="padding: 7px 14px; font-size: 13px;">
        Cancel
      </button>
    `;
    document.getElementById('picker-cancel')?.addEventListener('click', navigateToCategories);

    const pickerCards = PREDEFINED_CATEGORIES.map(c => `
      <div class="beyond-quick-cat-btn" data-cat="${c.name}">
        <span class="material-symbols-outlined">${c.icon}</span>
        <span>${c.emoji} ${c.name}</span>
      </div>
    `).join('');

    viewContainer.innerHTML = `
      <div class="beyond-view-header">
        <div>
          <p class="beyond-view-desc">
            Select a predefined category to create your first entry in, or specify a custom category name.
          </p>
        </div>
      </div>
      <div class="beyond-quick-cat-grid">
        ${pickerCards}
      </div>

      <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: var(--radius-lg); padding: 24px; margin-top: 16px;">
        <h4 style="font-family: var(--font-headline); font-size: 16px; margin-bottom: 12px; color: var(--text-primary);">Or create a Custom Category:</h4>
        <div style="display: flex; gap: 12px; max-width: 500px;">
          <input type="text" id="picker-custom-input" class="form-input" placeholder="e.g. Certifications, Volunteering, Travel" />
          <button type="button" class="btn btn--primary magnetic-btn" id="picker-custom-btn" style="padding: 10px 20px; white-space: nowrap;">
            Create
          </button>
        </div>
      </div>
    `;

    viewContainer.querySelectorAll('.beyond-quick-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const cat = btn.getAttribute('data-cat');
        navigateToAddItem(cat);
      });
    });

    document.getElementById('picker-custom-btn')?.addEventListener('click', () => {
      const customVal = (document.getElementById('picker-custom-input')?.value || '').trim();
      if (customVal) {
        navigateToAddItem(customVal);
      }
    });
  }

  // ================= Delete Item Handler =================
  async function confirmDeleteItem(item) {
    if (!confirm(`Are you sure you want to delete "${item.title}" from ${item.category}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/beyond/items/${item.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete item');
      await fetchBeyondItems();
      // If there are still items in this category, stay in category; else go to categories
      const remaining = beyondItems.filter(i => i.category.toLowerCase() === item.category.toLowerCase());
      if (remaining.length > 0) {
        navigateToCategory(item.category);
      } else {
        navigateToCategories();
      }
    } catch (err) {
      console.error('Error deleting beyond item:', err);
      alert('Could not delete item: ' + err.message);
    }
  }

  // Initialize
  document.addEventListener('DOMContentLoaded', () => {
    initEvents();
    fetchBeyondItems();
  });
})();
