/* ============================================================
   Project Management System
   Handles dynamic project loading, addition, editing, deletion,
   and modal interactions with local file persistence.
   ============================================================ */

(function () {
  'use strict';

  let currentProjects = [];
  let currentDetailProject = null;
  let projectToDeleteId = null;

  // DOM Elements
  const container = document.getElementById('projects-container');
  const addProjectBtn = document.getElementById('btn-open-add-project');
  const addProjectModal = document.getElementById('modal-add-project');
  const addProjectForm = document.getElementById('form-add-project');
  const confirmDeleteModal = document.getElementById('modal-confirm-delete');
  const confirmDeleteBtn = document.getElementById('btn-confirm-delete');
  const cancelDeleteBtn = document.getElementById('btn-cancel-delete');
  const deleteProjectNameEl = document.getElementById('delete-project-name');
  const detailModal = document.getElementById('modal-project-view');
  const detailEditBtn = document.getElementById('project-view-edit-btn');

  // Add Form Elements
  const nameInput = document.getElementById('project-name-input');
  const nameError = document.getElementById('project-name-error');
  const descInput = document.getElementById('project-desc-input');
  const descError = document.getElementById('project-desc-error');
  const githubInput = document.getElementById('project-github-input');
  const githubError = document.getElementById('project-github-error');
  const tagsInput = document.getElementById('project-tags-input');
  const formSubmitBtn = document.getElementById('btn-submit-project');
  const formGeneralError = document.getElementById('form-general-error');

  // Edit Form Elements
  const editProjectModal = document.getElementById('modal-edit-project');
  const editProjectForm = document.getElementById('form-edit-project');
  const editIdInput = document.getElementById('project-edit-id');
  const editNameInput = document.getElementById('project-edit-name-input');
  const editNameError = document.getElementById('project-edit-name-error');
  const editDescInput = document.getElementById('project-edit-desc-input');
  const editDescError = document.getElementById('project-edit-desc-error');
  const editGithubInput = document.getElementById('project-edit-github-input');
  const editGithubError = document.getElementById('project-edit-github-error');
  const editTagsInput = document.getElementById('project-edit-tags-input');
  const editFormSubmitBtn = document.getElementById('btn-submit-edit-project');
  const editFormGeneralError = document.getElementById('form-edit-general-error');

  // URL Validator
  function isValidUrl(string) {
    try {
      const parsed = new URL(string);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch (_) {
      return false;
    }
  }

  // Escape HTML helper
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Fetch projects from API
  async function fetchProjects() {
    if (!container) return;
    try {
      const response = await fetch('/api/projects');
      if (!response.ok) throw new Error('Failed to load projects');
      const data = await response.json();
      currentProjects = Array.isArray(data) ? data : [];
      renderProjects(currentProjects);
    } catch (err) {
      console.error('Error fetching projects:', err);
      container.innerHTML = `
        <div class="projects-empty">
          <p class="projects-empty__title" style="color: #ff8080;">Unable to connect to local project service</p>
          <p class="projects-empty__desc">Make sure the local server is running (<code style="color: var(--primary-light);">npm run dev</code>).</p>
          <button class="btn btn--secondary magnetic-btn" onclick="window.fetchProjectsRetry()">Retry</button>
        </div>
      `;
    }
  }

  window.fetchProjectsRetry = fetchProjects;

  // Render projects into DOM
  function renderProjects(projects) {
    if (!container) return;

    if (!projects || projects.length === 0) {
      container.innerHTML = `
        <div class="projects-empty">
          <span class="material-symbols-outlined" style="font-size: 40px; color: var(--text-muted); margin-bottom: 12px;">folder_open</span>
          <h3 class="projects-empty__title">No projects added yet</h3>
          <p class="projects-empty__desc">Add your first project to highlight your AI/ML and engineering work.</p>
          <button class="btn btn--primary magnetic-btn" onclick="window.openAddProjectModal()">
            <span class="material-symbols-outlined" style="font-size: 16px;">add</span> Add Project
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = '';

    projects.forEach((proj, idx) => {
      const isFeatured = Boolean(proj.featured && proj.image);
      const card = document.createElement('div');

      const tagsHtml = (proj.tags || [])
        .map(tag => `<span class="project-tag">${escapeHtml(tag)}</span>`)
        .join('');

      const categoryText = proj.category || (isFeatured ? '01 / FEATURED' : `0${idx + 1} / AI`);
      const iconName = proj.icon || 'terminal';

      if (isFeatured) {
        card.className = 'project-featured tilt-card';
        card.innerHTML = `
          <div class="project-featured__inner">
            <div class="project-featured__image">
              <div class="project-featured__image-bg" style="background-image: url('${escapeHtml(proj.image)}');"></div>
              <div class="project-featured__image-overlay"></div>
            </div>
            <div class="project-featured__body">
              <div class="project-featured__meta" style="justify-content: space-between;">
                <span style="display: flex; align-items: center; gap: 8px;">
                  <span class="project-featured__meta-dot"></span> ${escapeHtml(categoryText)}
                </span>
                <div class="project-card__actions">
                  <button type="button" class="project-card__action project-card__edit" title="Edit Project" data-edit-id="${escapeHtml(proj.id)}">
                    <span class="material-symbols-outlined">edit</span>
                  </button>
                  <button type="button" class="project-card__action project-card__delete" title="Delete Project" data-delete-id="${escapeHtml(proj.id)}" data-delete-name="${escapeHtml(proj.name)}">
                    <span class="material-symbols-outlined">delete</span>
                  </button>
                </div>
              </div>
              <h3 class="project-featured__title">${escapeHtml(proj.name)}</h3>
              <p class="text-body-md project-featured__desc">
                ${escapeHtml(proj.description)}
              </p>
              <div class="project-featured__tags">
                ${tagsHtml}
              </div>
              <div class="project-featured__cta">
                View Details <span class="material-symbols-outlined">arrow_forward</span>
              </div>
            </div>
          </div>
        `;
      } else {
        card.className = 'project-card tilt-card';
        card.style.position = 'relative';
        card.style.overflow = 'hidden';
        card.innerHTML = `
          <div class="project-card__glow"></div>
          <div class="project-card__header">
            <div class="project-card__icon-wrap">
              <span class="material-symbols-outlined">${escapeHtml(iconName)}</span>
            </div>
            <div class="project-card__meta-wrap">
              <div class="project-card__meta">${escapeHtml(categoryText)}</div>
              <div class="project-card__actions">
                <button type="button" class="project-card__action project-card__edit" title="Edit Project" data-edit-id="${escapeHtml(proj.id)}">
                  <span class="material-symbols-outlined">edit</span>
                </button>
                <button type="button" class="project-card__action project-card__delete" title="Delete Project" data-delete-id="${escapeHtml(proj.id)}" data-delete-name="${escapeHtml(proj.name)}">
                  <span class="material-symbols-outlined">delete</span>
                </button>
              </div>
            </div>
          </div>
          <h3 class="project-card__title">${escapeHtml(proj.name)}</h3>
          <p class="text-body-md project-card__desc">
            ${escapeHtml(proj.description)}
          </p>
          <div class="project-card__tags">
            ${tagsHtml}
          </div>
        `;
      }

      // Card click opens detail modal
      card.addEventListener('click', (e) => {
        // If action buttons clicked, ignore card open
        if (e.target.closest('.project-card__action')) return;
        openProjectDetail(proj);
      });

      // Edit button listener
      const editBtn = card.querySelector('.project-card__edit');
      if (editBtn) {
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openEditProjectModal(proj);
        });
      }

      // Delete button listener
      const delBtn = card.querySelector('.project-card__delete');
      if (delBtn) {
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = delBtn.getAttribute('data-delete-id');
          const name = delBtn.getAttribute('data-delete-name');
          openConfirmDeleteModal(id, name);
        });
      }

      container.appendChild(card);
    });

    // Re-attach 3D tilt effects
    attachTiltEffects();
  }

  // Open Project Details Modal
  function openProjectDetail(project) {
    if (!detailModal) return;
    currentDetailProject = project;

    const titleEl = document.getElementById('project-view-title');
    const descEl = document.getElementById('project-view-desc');
    const tagsEl = document.getElementById('project-view-tags');
    const githubLinkEl = document.getElementById('project-view-github');
    const imageContainer = document.getElementById('project-view-image-wrap');

    if (titleEl) titleEl.textContent = project.name;
    if (descEl) descEl.textContent = project.description;

    if (tagsEl) {
      tagsEl.innerHTML = (project.tags || [])
        .map(t => `<span class="modal__tag">${escapeHtml(t)}</span>`)
        .join('');
    }

    if (githubLinkEl) {
      githubLinkEl.href = project.github || '#';
      githubLinkEl.style.display = project.github ? 'inline-flex' : 'none';
    }

    if (imageContainer) {
      if (project.image) {
        imageContainer.style.display = 'block';
        imageContainer.style.backgroundImage = `url('${escapeHtml(project.image)}')`;
      } else {
        imageContainer.style.display = 'none';
      }
    }

    window.openModal('modal-project-view');
  }

  // Detail Modal Edit Button Listener
  if (detailEditBtn) {
    detailEditBtn.addEventListener('click', () => {
      if (currentDetailProject) {
        window.closeModal('modal-project-view');
        openEditProjectModal(currentDetailProject);
      }
    });
  }

  // Open Add Project Modal
  window.openAddProjectModal = function () {
    resetAddForm();
    window.openModal('modal-add-project');
    if (nameInput) nameInput.focus();
  };

  if (addProjectBtn) {
    addProjectBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.openAddProjectModal();
    });
  }

  // Reset Add Form
  function resetAddForm() {
    if (addProjectForm) addProjectForm.reset();
    if (nameError) { nameError.textContent = ''; nameError.classList.remove('visible'); }
    if (descError) { descError.textContent = ''; descError.classList.remove('visible'); }
    if (githubError) { githubError.textContent = ''; githubError.classList.remove('visible'); }
    if (formGeneralError) { formGeneralError.textContent = ''; formGeneralError.classList.remove('visible'); }
    if (formSubmitBtn) { formSubmitBtn.disabled = false; formSubmitBtn.textContent = 'Add Project'; }
  }

  // Open Edit Project Modal
  function openEditProjectModal(project) {
    if (!project) return;
    resetEditForm();

    if (editIdInput) editIdInput.value = project.id || '';
    if (editNameInput) editNameInput.value = project.name || '';
    if (editDescInput) editDescInput.value = project.description || '';
    if (editGithubInput) editGithubInput.value = project.github || '';
    if (editTagsInput) editTagsInput.value = (project.tags || []).join(', ');

    window.openModal('modal-edit-project');
    if (editNameInput) editNameInput.focus();
  }
  window.openEditProjectModal = openEditProjectModal;

  // Reset Edit Form
  function resetEditForm() {
    if (editProjectForm) editProjectForm.reset();
    if (editNameError) { editNameError.textContent = ''; editNameError.classList.remove('visible'); }
    if (editDescError) { editDescError.textContent = ''; editDescError.classList.remove('visible'); }
    if (editGithubError) { editGithubError.textContent = ''; editGithubError.classList.remove('visible'); }
    if (editFormGeneralError) { editFormGeneralError.textContent = ''; editFormGeneralError.classList.remove('visible'); }
    if (editFormSubmitBtn) { editFormSubmitBtn.disabled = false; editFormSubmitBtn.textContent = 'Save Changes'; }
  }

  // Add Form Submit Handler
  if (addProjectForm) {
    addProjectForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      let hasError = false;
      const name = (nameInput?.value || '').trim();
      const desc = (descInput?.value || '').trim();
      const github = (githubInput?.value || '').trim();
      const tags = (tagsInput?.value || '').trim();

      // Reset errors
      if (nameError) { nameError.textContent = ''; nameError.classList.remove('visible'); }
      if (descError) { descError.textContent = ''; descError.classList.remove('visible'); }
      if (githubError) { githubError.textContent = ''; githubError.classList.remove('visible'); }
      if (formGeneralError) { formGeneralError.textContent = ''; formGeneralError.classList.remove('visible'); }

      // Validate Name
      if (!name) {
        if (nameError) {
          nameError.textContent = 'Please enter a project name.';
          nameError.classList.add('visible');
        }
        hasError = true;
      }

      // Validate Description
      if (!desc) {
        if (descError) {
          descError.textContent = 'Please enter a project description.';
          descError.classList.add('visible');
        }
        hasError = true;
      }

      // Validate GitHub Link
      if (!github) {
        if (githubError) {
          githubError.textContent = 'Please enter a GitHub repository link.';
          githubError.classList.add('visible');
        }
        hasError = true;
      } else if (!isValidUrl(github)) {
        if (githubError) {
          githubError.textContent = 'Please enter a valid URL (e.g. https://github.com/...)';
          githubError.classList.add('visible');
        }
        hasError = true;
      }

      if (hasError) return;

      // Submit to API
      try {
        if (formSubmitBtn) {
          formSubmitBtn.disabled = true;
          formSubmitBtn.textContent = 'Saving...';
        }

        const response = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            description: desc,
            github,
            tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : []
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to save project');
        }

        // Success: update UI
        currentProjects.unshift(data);
        renderProjects(currentProjects);
        window.closeModal('modal-add-project');
        resetAddForm();
      } catch (err) {
        console.error('Error adding project:', err);
        if (formGeneralError) {
          formGeneralError.textContent = err.message || 'An error occurred while saving. Please try again.';
          formGeneralError.classList.add('visible');
        }
        if (formSubmitBtn) {
          formSubmitBtn.disabled = false;
          formSubmitBtn.textContent = 'Add Project';
        }
      }
    });
  }

  // Edit Form Submit Handler
  if (editProjectForm) {
    editProjectForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      let hasError = false;
      const id = (editIdInput?.value || '').trim();
      const name = (editNameInput?.value || '').trim();
      const desc = (editDescInput?.value || '').trim();
      const github = (editGithubInput?.value || '').trim();
      const tags = (editTagsInput?.value || '').trim();

      // Reset errors
      if (editNameError) { editNameError.textContent = ''; editNameError.classList.remove('visible'); }
      if (editDescError) { editDescError.textContent = ''; editDescError.classList.remove('visible'); }
      if (editGithubError) { editGithubError.textContent = ''; editGithubError.classList.remove('visible'); }
      if (editFormGeneralError) { editFormGeneralError.textContent = ''; editFormGeneralError.classList.remove('visible'); }

      if (!id) {
        if (editFormGeneralError) {
          editFormGeneralError.textContent = 'Invalid project ID.';
          editFormGeneralError.classList.add('visible');
        }
        return;
      }

      // Validate Name
      if (!name) {
        if (editNameError) {
          editNameError.textContent = 'Please enter a project name.';
          editNameError.classList.add('visible');
        }
        hasError = true;
      }

      // Validate Description
      if (!desc) {
        if (editDescError) {
          editDescError.textContent = 'Please enter a project description.';
          editDescError.classList.add('visible');
        }
        hasError = true;
      }

      // Validate GitHub Link
      if (!github) {
        if (editGithubError) {
          editGithubError.textContent = 'Please enter a GitHub repository link.';
          editGithubError.classList.add('visible');
        }
        hasError = true;
      } else if (!isValidUrl(github)) {
        if (editGithubError) {
          editGithubError.textContent = 'Please enter a valid URL (e.g. https://github.com/...)';
          editGithubError.classList.add('visible');
        }
        hasError = true;
      }

      if (hasError) return;

      // Submit PUT to API
      try {
        if (editFormSubmitBtn) {
          editFormSubmitBtn.disabled = true;
          editFormSubmitBtn.textContent = 'Saving...';
        }

        const response = await fetch(`/api/projects/${encodeURIComponent(id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            description: desc,
            github,
            tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : []
          })
        });

        const updatedProject = await response.json();

        if (!response.ok) {
          throw new Error(updatedProject.error || 'Failed to update project');
        }

        // Update local list
        const idx = currentProjects.findIndex(p => p.id === id);
        if (idx !== -1) {
          currentProjects[idx] = updatedProject;
        }
        renderProjects(currentProjects);
        window.closeModal('modal-edit-project');
        resetEditForm();
      } catch (err) {
        console.error('Error updating project:', err);
        if (editFormGeneralError) {
          editFormGeneralError.textContent = err.message || 'An error occurred while saving changes.';
          editFormGeneralError.classList.add('visible');
        }
        if (editFormSubmitBtn) {
          editFormSubmitBtn.disabled = false;
          editFormSubmitBtn.textContent = 'Save Changes';
        }
      }
    });
  }

  // Open Delete Confirmation Modal
  function openConfirmDeleteModal(id, name) {
    projectToDeleteId = id;
    if (deleteProjectNameEl) {
      deleteProjectNameEl.textContent = name || 'this project';
    }
    window.openModal('modal-confirm-delete');
  }

  // Cancel Delete
  if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener('click', () => {
      projectToDeleteId = null;
      window.closeModal('modal-confirm-delete');
    });
  }

  // Confirm Delete
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', async () => {
      if (!projectToDeleteId) return;

      try {
        confirmDeleteBtn.disabled = true;
        confirmDeleteBtn.textContent = 'Deleting...';

        const response = await fetch(`/api/projects/${encodeURIComponent(projectToDeleteId)}`, {
          method: 'DELETE'
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to delete project');
        }

        // Remove from list
        currentProjects = currentProjects.filter(p => p.id !== projectToDeleteId);
        renderProjects(currentProjects);
        window.closeModal('modal-confirm-delete');
      } catch (err) {
        console.error('Error deleting project:', err);
        alert(err.message || 'Error deleting project');
      } finally {
        projectToDeleteId = null;
        confirmDeleteBtn.disabled = false;
        confirmDeleteBtn.textContent = 'Delete Project';
      }
    });
  }

  // Helper: Attach 3D tilt effects to rendered cards
  function attachTiltEffects() {
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isMobile || prefersReducedMotion) return;

    document.querySelectorAll('.tilt-card').forEach((card) => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);

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

  // Initialize on DOM load
  document.addEventListener('DOMContentLoaded', () => {
    fetchProjects();
  });
})();
