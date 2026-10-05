/* ============================================================
   Technical Skills Manager
   Loads skill groups and persists edits through the local API.
   ============================================================ */

(function () {
  'use strict';

  const container = document.getElementById('skills-container');
  const status = document.getElementById('skills-status');
  const addGroupButton = document.getElementById('skills-add-group');
  const editorForm = document.getElementById('form-skill-group');
  const editorTitle = document.getElementById('skill-editor-title');
  const titleInput = document.getElementById('skill-group-title');
  const iconInput = document.getElementById('skill-group-icon');
  const skillsInput = document.getElementById('skill-group-items');
  const errorMessage = document.getElementById('skill-editor-error');
  const saveButton = document.getElementById('skill-editor-save');

  let skillGroups = [];
  let editingId = null;

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function setStatus(message, isError = false) {
    if (!status) return;
    status.textContent = message;
    status.classList.toggle('skills__status--error', isError);
  }

  function renderSkills() {
    if (!container) return;
    container.innerHTML = skillGroups.map((group) => `
      <article class="skill-card tilt-card">
        <div class="skill-card__glow"></div>
        <div class="skill-card__gradient"></div>
        <div class="skill-card__content">
          <div class="skill-card__header">
            <div class="skill-card__icon-wrap">
              <span class="material-symbols-outlined skill-card__icon" aria-hidden="true">${escapeHtml(group.icon)}</span>
            </div>
            <h3 class="skill-card__title">${escapeHtml(group.title)}</h3>
            <div class="skill-card__manage">
              <button type="button" class="skill-card__manage-btn" data-action="edit" data-id="${escapeHtml(group.id)}" aria-label="Edit ${escapeHtml(group.title)}">
                <span class="material-symbols-outlined" aria-hidden="true">edit</span>
              </button>
              <button type="button" class="skill-card__manage-btn skill-card__manage-btn--delete" data-action="delete" data-id="${escapeHtml(group.id)}" aria-label="Delete ${escapeHtml(group.title)}">
                <span class="material-symbols-outlined" aria-hidden="true">delete</span>
              </button>
            </div>
          </div>
          <div class="skill-card__chips">
            ${group.skills.map((skill) => `<span class="chip">${escapeHtml(skill)}</span>`).join('')}
          </div>
        </div>
      </article>
    `).join('');
    if (window.initializeTiltCard) {
      container.querySelectorAll('.tilt-card').forEach(window.initializeTiltCard);
    }
  }

  async function saveGroups(nextGroups) {
    const response = await fetch('/api/skills', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skills: nextGroups })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unable to save skills.');
    skillGroups = result;
    renderSkills();
  }

  function openEditor(group = null) {
    editingId = group ? group.id : null;
    editorTitle.textContent = group ? 'Edit Skill Group' : 'Add Skill Group';
    titleInput.value = group ? group.title : '';
    iconInput.value = group ? group.icon : '';
    skillsInput.value = group ? group.skills.join('\n') : '';
    errorMessage.textContent = '';
    errorMessage.classList.remove('visible');
    saveButton.textContent = group ? 'Save Changes' : 'Add Group';
    window.openModal('modal-skill-group');
    titleInput.focus();
  }

  async function loadSkills() {
    try {
      const response = await fetch('/api/skills');
      if (!response.ok) throw new Error('Unable to load technical skills.');
      skillGroups = await response.json();
      if (!Array.isArray(skillGroups)) throw new Error('The saved skills data is invalid.');
      renderSkills();
    } catch (error) {
      console.error('Error loading technical skills:', error);
      container.innerHTML = '<p class="skills__load-error">Technical skills could not be loaded. Please refresh and try again.</p>';
    }
  }

  addGroupButton?.addEventListener('click', () => openEditor());

  document.getElementById('skill-editor-close')?.addEventListener('click', () => window.closeModal('modal-skill-group'));
  document.getElementById('skill-editor-cancel')?.addEventListener('click', () => window.closeModal('modal-skill-group'));

  container?.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const group = skillGroups.find((item) => item.id === button.dataset.id);
    if (!group) {
      setStatus('That skill group could not be found. Refresh the page and try again.', true);
      return;
    }

    if (button.dataset.action === 'edit') {
      openEditor(group);
      return;
    }

    if (button.dataset.action === 'delete') {
      if (!window.confirm(`Delete the "${group.title}" skill group? This cannot be undone.`)) return;
      button.disabled = true;
      try {
        await saveGroups(skillGroups.filter((item) => item.id !== group.id));
        setStatus(`"${group.title}" was deleted.`);
      } catch (error) {
        console.error('Error deleting skill group:', error);
        setStatus(error.message || 'Unable to delete skill group.', true);
        button.disabled = false;
      }
    }
  });

  editorForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const title = titleInput.value.trim();
    const icon = iconInput.value.trim();
    const skills = skillsInput.value
      .split(/[,\n]/)
      .map((skill) => skill.trim())
      .filter(Boolean)
      .filter((skill, index, all) => all.indexOf(skill) === index);

    let validationError = '';
    if (!title) validationError = 'Enter a name for this skill group.';
    else if (!/^[a-z0-9_]{1,40}$/i.test(icon)) validationError = 'Enter a valid Material Symbol name using letters, numbers, or underscores.';
    else if (!skills.length) validationError = 'Add at least one skill.';
    else if (skills.some((skill) => skill.length > 50)) validationError = 'Each skill must be 50 characters or fewer.';
    else if (skills.length > 50) validationError = 'A group can have up to 50 skills.';

    if (validationError) {
      errorMessage.textContent = validationError;
      errorMessage.classList.add('visible');
      return;
    }

    const group = {
      id: editingId || `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'skill-group'}-${Date.now().toString(36)}`,
      title,
      icon,
      skills
    };
    const nextGroups = editingId
      ? skillGroups.map((item) => item.id === editingId ? group : item)
      : [...skillGroups, group];

    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';
    errorMessage.textContent = '';
    errorMessage.classList.remove('visible');

    try {
      await saveGroups(nextGroups);
      window.closeModal('modal-skill-group');
      setStatus(`"${title}" was ${editingId ? 'updated' : 'added'}.`);
    } catch (error) {
      console.error('Error saving skill group:', error);
      errorMessage.textContent = error.message || 'Unable to save skill group.';
      errorMessage.classList.add('visible');
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = editingId ? 'Save Changes' : 'Add Group';
    }
  });

  loadSkills();
})();
