(function() { // Wrap in IIFE to avoid polluting global scope
    // --- App State ---
    let currentPostId = null;
    let currentPostName = 'New Post';
    let appCategories = [];
    let textToRedact = '';
    const LOCAL_STORAGE_KEY = 'blacklistGeneratorPosts';
    const TEMPLATES_KEY = 'blacklistGeneratorTemplates';
    const CATEGORIES_KEY = 'blacklistGeneratorCategories';
    const VERSIONS_PREFIX = 'blacklistPostVersions_';
    const AUTOSAVE_KEY = 'blacklistGeneratorAutosave';
    const THEME_KEY = 'blacklistGeneratorTheme';
    const API_KEY_LS_KEY = 'blacklistGeneratorApiKey';
    let autosaveInterval;
    let _confirmCallbacks = { onConfirm: null, onCancel: null };

    // --- DOM Elements ---
    const appContainer = document.getElementById('app-container');
    const formColumn = document.getElementById('form-column');
    const dynamicFormContainer = document.getElementById('dynamic-form-container');
    const stickyHeader = document.getElementById('sticky-header');
    const preview = document.getElementById('preview');
    const charCount = document.getElementById('charCount');
    const platformSelect = document.getElementById('platform-select');
    const editingStatus = document.getElementById('editingStatus');
    const themeToggle = document.getElementById('theme-toggle');
    const copyButtonText = document.getElementById('copyButtonText');
    const exportBtn = document.getElementById('exportBtn');
    const exportDropdown = document.getElementById('exportDropdown');
    const redactBtn = document.getElementById('redactBtn');
    
    const modals = {
        loadPosts: document.getElementById('loadPostsModal'),
        templates: document.getElementById('templatesModal'),
        history: document.getElementById('historyModal'),
        confirm: document.getElementById('confirmModal'),
        categoryManager: document.getElementById('categoryManagerModal'),
        selectiveExport: document.getElementById('selectiveExportModal'),
        aiReview: document.getElementById('aiReviewModal'),
    };

    const closeButtons = {
        loadPosts: document.getElementById('closeLoadModal'),
        templates: document.getElementById('closeTemplatesModal'),
        history: document.getElementById('closeHistoryModal'),
        categoryManager: document.getElementById('closeCategoryManagerModal'),
        selectiveExport: document.getElementById('closeSelectiveExportModal'),
        aiReview: document.getElementById('closeAiReviewModal'),
    };

    const lists = {
        savedPosts: document.getElementById('savedPostsList'),
        templates: document.getElementById('templatesList'),
        history: document.getElementById('historyList'),
        categories: document.getElementById('categoryList'),
        selectiveExport: document.getElementById('selectiveExportCategoryList'),
    };
    
    const postSearchInput = document.getElementById('postSearchInput');
    const importFileInput = document.getElementById('importFileInput');

    // --- Debounce Function ---
    function debounce(func, delay) { let timeoutId; return function(...args) { clearTimeout(timeoutId); timeoutId = setTimeout(() => { func.apply(this, args); }, delay); }; }
    const debouncedUpdatePreview = debounce(updatePreview, 250);

    // --- Event Listeners ---
    formColumn.addEventListener('input', (e) => {
        if (e.target.closest('.form-section')) {
            debouncedUpdatePreview();
            startAutosave();
        }
    });
    formColumn.addEventListener('scroll', () => {
        stickyHeader.classList.toggle('scrolled', formColumn.scrollTop > 0);
    });
    
    themeToggle.addEventListener('change', toggleTheme);
    postSearchInput.addEventListener('input', openLoadModal);
    platformSelect.addEventListener('change', updatePreview);
    
    exportBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        exportBtn.parentElement.classList.toggle('show');
    });
    
    // --- Redaction Listener ---
    preview.addEventListener('mouseup', (e) => {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        
        if (selectedText.length > 0) {
            textToRedact = selectedText;
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            redactBtn.style.left = `${e.pageX}px`;
            redactBtn.style.top = `${e.pageY - 35}px`;
            redactBtn.style.display = 'block';
        } else {
            redactBtn.style.display = 'none';
        }
    });

    redactBtn.addEventListener('click', () => {
        if (!textToRedact) return;
        
        showConfirmation(`Are you sure you want to redact "${textToRedact}"? This cannot be easily undone.`, () => {
            let redacted = false;
            const allInputs = dynamicFormContainer.querySelectorAll('input, textarea');
            for (const input of allInputs) {
                if (input.value.includes(textToRedact)) {
                    input.value = input.value.replace(textToRedact, '[REDACTED]');
                    input.dispatchEvent(new Event('input', { bubbles: true })); // Trigger update
                    redacted = true;
                    break; // Only redact the first instance found
                }
            }
            if (redacted) {
                showToast('Text redacted.', 'success');
            } else {
                showToast('Could not find the selected text in the form.', 'error');
            }
        });
        
        redactBtn.style.display = 'none';
        textToRedact = '';
    });

    document.addEventListener('click', (e) => {
        if (!exportBtn.contains(e.target) && !e.target.closest('.dropdown-content')) {
            document.querySelectorAll('.dropdown.show').forEach(d => d.classList.remove('show'));
        }
        if (e.target !== redactBtn && e.target !== preview && !preview.contains(e.target)) {
             redactBtn.style.display = 'none';
        }
    });

    // --- Modal Listeners ---
    Object.keys(closeButtons).forEach(key => {
        if(closeButtons[key]) closeButtons[key].addEventListener('click', () => closeModal(modals[key]));
    });
    
    function handleConfirm(isConfirmed) {
        if (isConfirmed && typeof _confirmCallbacks.onConfirm === 'function') {
            _confirmCallbacks.onConfirm();
        } else if (!isConfirmed && typeof _confirmCallbacks.onCancel === 'function') {
            _confirmCallbacks.onCancel();
        }
        closeModal(modals.confirm);
    }

    document.getElementById('confirmOkBtn').addEventListener('click', () => handleConfirm(true));
    document.getElementById('confirmCancelBtn').addEventListener('click', () => handleConfirm(false));

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            Object.values(modals).forEach(modal => {
                if (modal && modal.style.display === 'flex') {
                    if (modal === modals.confirm) handleConfirm(false);
                    else closeModal(modal);
                }
            });
        }
    });

    // --- Event Handlers ---
    document.getElementById('newPost').addEventListener('click', confirmAndClearForm);
    document.getElementById('loadPosts').addEventListener('click', openLoadModal);
    document.getElementById('loadTemplate').addEventListener('click', openTemplatesModal);
    document.getElementById('manageCategoriesBtn').addEventListener('click', openCategoryManager);
    document.getElementById('saveOrUpdate').addEventListener('click', saveOrUpdatePost);
    document.getElementById('saveAsNew').addEventListener('click', () => saveNewPost(true));
    document.getElementById('copyButton').addEventListener('click', copyToClipboard);
    document.getElementById('exportTxt').addEventListener('click', exportAsTxt);
    document.getElementById('exportMd').addEventListener('click', exportAsMd);
    document.getElementById('exportPdf').addEventListener('click', exportAsPdf);
    document.getElementById('selectiveExportBtn').addEventListener('click', openSelectiveExportModal);
    document.getElementById('exportPostsBtn').addEventListener('click', exportPosts);
    document.getElementById('importPostsBtn').addEventListener('click', () => importFileInput.click());
    importFileInput.addEventListener('change', handleImport);
    document.getElementById('saveAsTemplateBtn').addEventListener('click', saveCurrentAsTemplate);
    document.getElementById('addNewCategoryBtn').addEventListener('click', addNewCategory);
    document.getElementById('saveCategoryChangesBtn').addEventListener('click', saveCategoryChanges);
    document.getElementById('fetchArticleBtn').addEventListener('click', handleArticleExtraction);
    document.getElementById('aiReviewBtn').addEventListener('click', runSanityCheck);
    
    function handleDynamicItemControls(e) {
        const button = e.target.closest('.control-btn');
        if (!button) return;
        const item = button.closest('.dynamic-item');
        const container = item.parentElement;
        if (button.getAttribute('aria-label') === 'Remove item') {
            item.remove();
        } else if (button.getAttribute('aria-label') === 'Move item up') {
            const prevSibling = item.previousElementSibling;
            if (prevSibling) container.insertBefore(item, prevSibling);
        } else if (button.getAttribute('aria-label') === 'Move item down') {
            const nextSibling = item.nextElementSibling;
            if (nextSibling) container.insertBefore(nextSibling, item);
        }
        updateItemControls(container);
        debouncedUpdatePreview();
        startAutosave();
    }

    function toggleSection(e) {
        const header = e.currentTarget;
        const content = document.getElementById(header.getAttribute('aria-controls'));
        const icon = header.querySelector('.chevron-icon');
        const isExpanded = header.getAttribute('aria-expanded') === 'true';
        header.setAttribute('aria-expanded', !isExpanded);
        header.classList.toggle('collapsed');
        content.classList.toggle('collapsed');
        icon.classList.toggle('collapsed');
    }

    // --- Dynamic Item Management ---
    const itemTemplates = {
        individual: (id) => `<div class="flex gap-4"><img class="image-preview" id="img-preview-${id}" src="https://placehold.co/64x64/f8fafc/cbd5e1?text=🖼️" onerror="this.onerror=null;this.src='https://placehold.co/64x64/f8fafc/cbd5e1?text=❌';"><div class="flex-grow"><label for="individual-img-${id}" class="block text-sm font-medium text-secondary mb-1">Image URL</label><input type="url" id="individual-img-${id}" name="individual-image-url" class="w-full p-2 border rounded-md mb-2 individual-image-url" oninput="this.closest('.dynamic-item').querySelector('.image-preview').src=this.value || 'https://placehold.co/64x64/f8fafc/cbd5e1?text=🖼️'"></div></div><div><label for="individual-name-${id}" class="block text-sm font-medium text-secondary mb-1">Full Name</label><input type="text" id="individual-name-${id}" name="individual-name" class="w-full p-2 border rounded-md mb-2 individual-name"></div><div class="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2"><div><label for="individual-dob-${id}" class="block text-sm font-medium text-secondary mb-1">Date of Birth</label><input type="text" id="individual-dob-${id}" name="individual-dob" class="w-full p-2 border rounded-md individual-dob"></div><div><label for="individual-phone-${id}" class="block text-sm font-medium text-secondary mb-1">Phone Number</label><input type="tel" id="individual-phone-${id}" name="individual-phone" class="w-full p-2 border rounded-md individual-phone"></div></div><div><label for="individual-email-${id}" class="block text-sm font-medium text-secondary mb-1">Email Address</label><input type="email" id="individual-email-${id}" name="individual-email" class="w-full p-2 border rounded-md mb-2 individual-email"></div><div><label for="individual-address-${id}" class="block text-sm font-medium text-secondary mb-1">Last Known Address</label><textarea id="individual-address-${id}" name="individual-address" rows="2" class="w-full p-2 border rounded-md mb-2 individual-address"></textarea></div><h4 class="font-semibold text-sm mt-3 mb-1 text-gray-600 dark:text-gray-400">Social Media Links</h4><div class="space-y-2"><input type="url" placeholder="Facebook URL" name="individual-fb-link" class="w-full p-2 border rounded-md individual-fb-link" aria-label="Individual Facebook URL"><input type="url" placeholder="Instagram URL" name="individual-ig-link" class="w-full p-2 border rounded-md individual-ig-link" aria-label="Individual Instagram URL"><input type="url" placeholder="X (Twitter) URL" name="individual-x-link" class="w-full p-2 border rounded-md individual-x-link" aria-label="Individual X (Twitter) URL"><input type="text" placeholder="Other URLs (comma-sep)" name="individual-other-links" class="w-full p-2 border rounded-md individual-other-links" aria-label="Individual Other URLs"></div>`,
        alias: (id) => `<div><label for="alias-name-${id}" class="block text-sm font-medium text-secondary mb-1">Alias Name</label><input type="text" id="alias-name-${id}" name="alias-name" class="w-full p-2 border rounded-md alias-name"></div>`,
        organization: (id) => `<div><label for="org-name-${id}" class="block text-sm font-medium text-secondary mb-1">Organization Name</label><input type="text" id="org-name-${id}" name="org-name" class="w-full p-2 border rounded-md mb-2 org-name"></div><div class="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2"><div><label for="org-ein-${id}" class="block text-sm font-medium text-secondary mb-1">EIN</label><input type="text" id="org-ein-${id}" name="org-ein" class="w-full p-2 border rounded-md org-ein"></div><div><label for="org-license-${id}" class="block text-sm font-medium text-secondary mb-1">License #</label><input type="text" id="org-license-${id}" name="org-license" class="w-full p-2 border rounded-md org-license"></div></div><div><label for="org-record-${id}" class="block text-sm font-medium text-secondary mb-1">Official Record Link</label><input type="url" id="org-record-${id}" name="org-record-link" class="w-full p-2 border rounded-md mb-2 org-record-link"></div><div><label for="org-status-${id}" class="block text-sm font-medium text-secondary mb-1">Status</label><input type="text" id="org-status-${id}" name="org-status" placeholder="e.g., Active, CLOSED" class="w-full p-2 border rounded-md mb-2 org-status"></div><h4 class="font-semibold text-sm mt-3 mb-1 text-gray-600 dark:text-gray-400">Links</h4><div class="grid grid-cols-1 md:grid-cols-2 gap-2"><input type="url" placeholder="Facebook URL" name="org-fb-link" class="w-full p-2 border rounded-md org-fb-link" aria-label="Organization Facebook URL"><input type="url" placeholder="Instagram URL" name="org-ig-link" class="w-full p-2 border rounded-md org-ig-link" aria-label="Organization Instagram URL"><input type="url" placeholder="X (Twitter) URL" name="org-x-link" class="w-full p-2 border rounded-md org-x-link" aria-label="Organization X (Twitter) URL"><input type="url" placeholder="Website URL" name="org-website-link" class="w-full p-2 border rounded-md org-website-link" aria-label="Organization Website URL"></div><div class="mt-2"><input type="text" placeholder="Other URLs (comma-sep)" name="org-other-links" class="w-full p-2 border rounded-md org-other-links" aria-label="Organization Other URLs"></div>`,
        legalRegistration: (id) => `<div><label for="legal-title-${id}" class="block text-sm font-medium text-secondary mb-1">Document Title</label><input type="text" id="legal-title-${id}" name="legal-registration-title" class="w-full p-2 border rounded-md mb-2 legal-registration-title"></div><div><label for="legal-url-${id}" class="block text-sm font-medium text-secondary mb-1">URL</label><input type="url" id="legal-url-${id}" name="legal-registration-url" class="w-full p-2 border rounded-md mb-2 legal-registration-url"></div>`,
        fraudulentSolicitation: (id) => `<div><label for="fraud-text-${id}" class="block text-sm font-medium text-secondary mb-1">Allegation Details</label><textarea id="fraud-text-${id}" name="fraudulent-solicitation-text" rows="3" class="w-full p-2 border rounded-md fraudulent-solicitation-text"></textarea></div>`,
        warningAndAccount: (id) => `<div><label for="warning-text-${id}" class="block text-sm font-medium text-secondary mb-1">Account/Warning Details</label><textarea id="warning-text-${id}" name="warning-account-text" rows="3" class="w-full p-2 border rounded-md warning-account-text"></textarea></div>`,
        investigation: (id) => `<div><label for="inv-title-${id}" class="block text-sm font-medium text-secondary mb-1">Title</label><input type="text" id="inv-title-${id}" name="investigation-title" class="w-full p-2 border rounded-md mb-2 investigation-title"></div><div><label for="inv-url-${id}" class="block text-sm font-medium text-secondary mb-1">URL</label><input type="url" id="inv-url-${id}" name="investigation-url" class="w-full p-2 border rounded-md mb-2 investigation-url"></div>`,
        evidence: (id) => `<div class="flex gap-4"><img class="image-preview" id="img-preview-${id}" src="https://placehold.co/64x64/f8fafc/cbd5e1?text=🖼️" onerror="this.onerror=null;this.src='https://placehold.co/64x64/f8fafc/cbd5e1?text=❌';"><div class="flex-grow"><label for="evidence-img-${id}" class="block text-sm font-medium text-secondary mb-1">Upload Image</label><input type="file" id="evidence-img-${id}" class="w-full p-1 border rounded-md mb-2 evidence-image-upload" accept="image/*" data-preview-id="img-preview-${id}"></div></div><div><label for="evidence-title-${id}" class="block text-sm font-medium text-secondary mb-1">Title</label><input type="text" id="evidence-title-${id}" name="evidence-title" class="w-full p-2 border rounded-md mb-2 evidence-title"></div><div><label for="evidence-desc-${id}" class="block text-sm font-medium text-secondary mb-1">Description</label><textarea id="evidence-desc-${id}" name="evidence-description" rows="3" class="w-full p-2 border rounded-md mb-2 evidence-description"></textarea></div><div class="grid grid-cols-1 md:grid-cols-2 gap-2"><div><label for="evidence-url-${id}" class="block text-sm font-medium text-secondary mb-1">Source URL</label><input type="url" id="evidence-url-${id}" name="evidence-url" class="w-full p-2 border rounded-md evidence-url"></div><div><label for="evidence-date-${id}" class="block text-sm font-medium text-secondary mb-1">Date (Optional)</label><input type="date" id="evidence-date-${id}" name="evidence-date" class="w-full p-2 border rounded-md evidence-date"></div></div><textarea id="evidence-img-data-${id}" name="evidence-image-data" class="hidden evidence-image-data"></textarea>`,
        article: (id) => `<div><label for="art-title-${id}" class="block text-sm font-medium text-secondary mb-1">Title</label><input type="text" id="art-title-${id}" name="article-title" class="w-full p-2 border rounded-md mb-2 article-title"></div><div><label for="art-url-${id}" class="block text-sm font-medium text-secondary mb-1">URL</label><input type="url" id="art-url-${id}" name="article-url" class="w-full p-2 border rounded-md mb-2 article-url"></div>`,
        timelineEvent: (id) => `<div><label for="timeline-date-${id}" class="block text-sm font-medium text-secondary mb-1">Date</label><input type="date" id="timeline-date-${id}" name="timeline-date" class="w-full p-2 border rounded-md timeline-date"></div><div><label for="timeline-desc-${id}" class="block text-sm font-medium text-secondary mb-1">Description</label><input type="text" id="timeline-desc-${id}" name="timeline-description" placeholder="e.g., Court Hearing" class="w-full p-2 border rounded-md timeline-description"></div>`,
        generic: (id) => `<div><label for="generic-text-${id}" class="block text-sm font-medium text-secondary mb-1">Content</label><textarea id="generic-text-${id}" name="generic-text" rows="3" class="w-full p-2 border rounded-md generic-text"></textarea></div>`
    };

    function addDynamicItem(container, itemType, options = {}) {
        const { suppressSideEffects = false } = options;
        if (!container || !itemType || !itemTemplates[itemType]) return null;
        
        const uniqueId = `${itemType}-${Date.now()}`;
        const div = document.createElement('div');
        div.className = 'dynamic-item';
        div.innerHTML = `<div class="item-controls"><button class="control-btn up-btn" aria-label="Move item up">▲</button><button class="control-btn down-btn" aria-label="Move item down">▼</button><button class="control-btn remove-btn" aria-label="Remove item">X</button></div>${itemTemplates[itemType](uniqueId)}`;
        
        const emptyState = container.querySelector('.empty-state');
        if (emptyState) emptyState.style.display = 'none';
        
        container.appendChild(div);

        if (!suppressSideEffects) {
            updateItemControls(container);
            debouncedUpdatePreview();
            startAutosave();
        }
        return div;
    }

    // --- Core Logic: Preview & Formatting ---
    function updatePreview(options = {}) {
        const { includedCategories = null } = options;
        const markdownText = generatePostText({ includedCategories });
        const textForClipboard = markdownText.replace(/\[IMAGE_PREVIEW:(.*?),(.*?)\]/g, '[IMAGE: $2]').replace(/\[REDACTED\]/g, '…');
        
        preview.innerHTML = renderMarkdown(markdownText);
        
        const limit = parseInt(platformSelect.value, 10);
        charCount.classList.toggle('char-count-limit-exceeded', limit > 0 && textForClipboard.length > limit);
        charCount.textContent = limit > 0 ? `${textForClipboard.length} / ${limit}` : `${textForClipboard.length}`;
    }

    function generatePostText(options = {}) {
        const { includedCategories = null, forExport = false } = options;
        let markdown = '';
        
        const categoriesToRender = includedCategories ? appCategories.filter(c => includedCategories.includes(c.id)) : appCategories;

        categoriesToRender.forEach(category => {
            const section = document.getElementById(`section-content-${category.id}`);
            if (!section) return;

            let sectionContent = '';
            if (category.type === 'fields') {
                const categoryDef = appCategories.find(c => c.id === category.id);
                if (categoryDef) {
                    categoryDef.fields.forEach(field => {
                        const input = document.getElementById(field.id);
                        if (input && input.value) {
                           sectionContent += `${input.value}\n`;
                        }
                    });
                }
            } else if (category.type === 'dynamic') {
                const items = Array.from(section.querySelectorAll('.dynamic-item'));
                if (items.length > 0) {
                     if (category.itemType === 'timelineEvent') {
                        const events = items.map(item => ({
                            date: item.querySelector('[name="timeline-date"]')?.value,
                            description: item.querySelector('[name="timeline-description"]')?.value
                        })).filter(e => e.date && e.description);
                        
                        events.sort((a, b) => new Date(a.date) - new Date(b.date));
                        
                        events.forEach(event => {
                            sectionContent += `* **${new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}:** ${event.description}\n`;
                        });
                     } else if (category.itemType === 'evidence') {
                        items.forEach(item => {
                            const title = item.querySelector('[name="evidence-title"]').value;
                            const desc = item.querySelector('[name="evidence-description"]').value;
                            const url = item.querySelector('[name="evidence-url"]').value;
                            const date = item.querySelector('[name="evidence-date"]').value;
                            const imageData = item.querySelector('[name="evidence-image-data"]').value;
                            if (imageData && !forExport) sectionContent += `[IMAGE_PREVIEW:${imageData},${title || 'Evidence'}]\n`;
                            if(title) sectionContent += `* **${title}**`;
                            if(date) sectionContent += ` (${new Date(date + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })})\n`;
                            else if (title) sectionContent += '\n';
                            if(desc) sectionContent += `  ${desc.replace(/\n/g, '\n  ')}\n`;
                            if(url) sectionContent += `  [Source Link](${url})\n`;
                            sectionContent += '\n';
                        });
                     } else {
                        items.forEach((item, index) => {
                            const inputs = item.querySelectorAll('input[name], textarea[name]');
                            let itemText = '';
                            inputs.forEach(input => {
                                if(input.value && input.type !== 'file' && input.name) itemText += `${input.value}\n`;
                            });
                            if (itemText.trim()) {
                                sectionContent += itemText.trim() + '\n\n';
                            }
                        });
                     }
                }
            }

            if (sectionContent.trim()) {
                markdown += `**${category.title.toUpperCase()}**\n${sectionContent.trim()}\n\n`;
            }
        });
        
        return markdown.trim();
    }

    function renderMarkdown(text) {
        const placeholderUrl = 'https://placehold.co/64x64/f8fafc/cbd5e1?text=❌';
        return text
            .replace(/\[IMAGE_PREVIEW:(.*?),(.*?)\]/g, (match, p1, p2) => {
                const src = p1.startsWith('data:image') ? p1 : p1;
                return `<div class="my-2"><img src="${src}" class="inline-block h-16 w-16 rounded-md object-cover" onerror="this.onerror=null;this.src='${placeholderUrl}';"><br><span class="text-xs text-blue-500">${p2}</span></div>`;
            })
            .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            .replace(/^\* (.*$)/gim, '<li>$1</li>')
            .replace(/\n/g, '<br>');
    }
    
    // --- Local Storage & Data Functions ---
    function getFromStorage(key) { try { return JSON.parse(localStorage.getItem(key)) || null; } catch (e) { return null; } }
    function saveToStorage(key, data) { localStorage.setItem(key, JSON.stringify(data)); }
    
    function saveOrUpdatePost() { if (currentPostId) { updatePost(); } else { saveNewPost(); } }
    
    function saveNewPost(isSaveAs = false) {
        const subjectName = document.getElementById('subjectName')?.value || "Untitled Post";
        const promptName = isSaveAs && currentPostName !== 'New Post' ? `${currentPostName} (Copy)` : subjectName;
        const postName = prompt("Enter a name for this new post:", promptName);
        if (!postName) return;
        
        const data = getFormData();
        data.name = postName;
        data.savedAt = new Date().toISOString();
        data.id = crypto.randomUUID();
        
        currentPostId = data.id;
        currentPostName = data.name;

        const posts = getFromStorage(LOCAL_STORAGE_KEY) || [];
        posts.push(data);
        saveToStorage(LOCAL_STORAGE_KEY, posts);
        showToast(`Post "${postName}" saved.`, 'success');
        clearAutosave();
        updateUIForState();
    }

    function updatePost() {
        if (!currentPostId) return;
        
        const posts = getFromStorage(LOCAL_STORAGE_KEY) || [];
        const postIndex = posts.findIndex(p => p.id === currentPostId);
        if (postIndex > -1) {
            saveVersion(currentPostId, posts[postIndex]);
            const data = getFormData();
            data.savedAt = new Date().toISOString();
            data.id = currentPostId;
            data.name = currentPostName;
            posts[postIndex] = data;
            saveToStorage(LOCAL_STORAGE_KEY, posts);
            showToast(`Post "${data.name}" updated.`, 'success');
            clearAutosave();
            updateUIForState();
        } else {
            saveNewPost();
        }
    }
    
    function openLoadModal() {
        const searchTerm = postSearchInput.value.toLowerCase();
        const posts = getFromStorage(LOCAL_STORAGE_KEY) || [];
        lists.savedPosts.innerHTML = '';

        const filteredPosts = posts.filter(post => post.name && post.name.toLowerCase().includes(searchTerm));

        if (filteredPosts.length === 0) {
            lists.savedPosts.innerHTML = `<p class="text-secondary">No ${searchTerm ? 'matching' : 'saved'} posts found.</p>`;
        } else {
            filteredPosts.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
            filteredPosts.forEach(post => {
                const postElement = document.createElement('div');
                postElement.className = 'modal-list-item';
                postElement.innerHTML = `
                    <div class="modal-list-item-text" data-post-id="${post.id}">
                        <span class="text-primary font-medium">${post.name}</span> 
                        <span class="text-xs text-secondary ml-2">Saved: ${new Date(post.savedAt).toLocaleDateString()}</span>
                    </div>
                    <div class="modal-list-item-controls">
                        <button class="modal-control-btn" data-history-id="${post.id}" title="View History">🕔</button>
                        <button class="modal-control-btn" data-export-id="${post.id}" title="Export Post">📤</button>
                        <button class="modal-control-btn text-red-500" data-delete-id="${post.id}" data-delete-name="${post.name}" title="Delete Post">🗑️</button>
                    </div>`;
                lists.savedPosts.appendChild(postElement);
            });
        }
        
        if (document.getElementById('loadPostsModal').style.display !== 'flex') openModal(modals.loadPosts);
    }

    function handleModalListClick(evt) {
        const textTarget = evt.target.closest('.modal-list-item-text');
        const controlTarget = evt.target.closest('.modal-control-btn');

        if (textTarget) {
            loadSpecificPost(textTarget.dataset.postId);
        } else if (controlTarget) {
            const { historyId, exportId, deleteId, deleteName } = controlTarget.dataset;
            if (historyId) openHistoryModal(historyId);
            else if (exportId) exportSinglePost(exportId);
            else if (deleteId) deletePost(deleteId, deleteName);
        }
    }
    
    lists.savedPosts.addEventListener('click', handleModalListClick);

    function loadSpecificPost(postId) {
        showConfirmation("Loading this post will overwrite your current unsaved changes. Continue?", () => {
            const posts = getFromStorage(LOCAL_STORAGE_KEY) || [];
            const postToLoad = posts.find(p => p.id === postId);
            if (postToLoad) {
                populateForm(postToLoad);
                closeModal(modals.loadPosts);
                showToast(`Loaded post: ${postToLoad.name}`, 'success');
            }
        });
    }

    function deletePost(postId, postName) {
        showConfirmation(`Are you sure you want to delete "${postName}" and all its history? This cannot be undone.`, () => {
            const posts = getFromStorage(LOCAL_STORAGE_KEY) || [];
            saveToStorage(LOCAL_STORAGE_KEY, posts.filter(p => p.id !== postId));
            localStorage.removeItem(VERSIONS_PREFIX + postId);
            if (currentPostId === postId) {
                clearForm();
            }
            openLoadModal(); // Refresh the modal list
            showToast(`Post "${postName}" deleted.`, 'success');
        });
    }

    // --- Utility Functions ---
    function copyToClipboard() {
        const markdownText = generatePostText({ forExport: true });
        const textToCopy = markdownText.replace(/\[IMAGE_PREVIEW:(.*?),(.*?)\]/g, '[IMAGE: $2]').replace(/\[REDACTED\]/g, '…');
        const textArea = document.createElement('textarea');
        textArea.value = textToCopy;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            copyButtonText.textContent = '✔ Copied!';
            setTimeout(() => { copyButtonText.textContent = 'Copy to Clipboard'; }, 2000);
        } catch (err) { showToast('Copy failed.', 'error'); }
        document.body.removeChild(textArea);
    }
    
    function clearForm() {
        renderForm(); // Re-render the form based on current categories
        currentPostId = null;
        currentPostName = 'New Post';
        clearAutosave();
        updateUIForState();
        updatePreview();
    }
    
    function confirmAndClearForm() {
        const hasUnsavedChanges = localStorage.getItem(AUTOSAVE_KEY);
        if (hasUnsavedChanges) {
            showConfirmation("Are you sure you want to start a new post? All unsaved changes will be lost.", () => clearForm());
        } else {
            clearForm();
        }
    }

    function getFormData(isTemplate = false) {
        const data = {};
        if (!isTemplate) {
            data.id = currentPostId;
            data.name = currentPostName;
        }
        
        data.categories = {};

        appCategories.forEach(category => {
            const section = document.getElementById(`section-content-${category.id}`);
            if (!section) return;
            
            if (category.type === 'fields') {
                const fieldData = {};
                category.fields.forEach(field => {
                    const input = document.getElementById(field.id);
                    if (input) {
                        fieldData[field.id] = isTemplate ? '' : input.value;
                    }
                });
                data.categories[category.id] = fieldData;
            } else if (category.type === 'dynamic') {
                data.categories[category.id] = Array.from(section.querySelectorAll('.dynamic-item')).map(item => {
                    if (isTemplate) return {};
                    const singleItemData = {};
                    const inputs = item.querySelectorAll('input[name], textarea[name]');
                    inputs.forEach(input => {
                       if (input.name) {
                           singleItemData[input.name] = input.value;
                       }
                    });
                    return singleItemData;
                });
            }
        });
        
        return data;
    }

    function populateForm(data, isFromTemplate = false) {
        clearForm();
        
        if (data.categories) {
             Object.keys(data.categories).forEach(catId => {
                const categoryData = data.categories[catId];
                const categoryDef = appCategories.find(c => c.id === catId);
                if (!categoryDef) return;

                if (categoryDef.type === 'fields') {
                    Object.keys(categoryData).forEach(fieldId => {
                        const input = document.getElementById(fieldId);
                        if (input) input.value = categoryData[fieldId] || '';
                    });
                } else if (categoryDef.type === 'dynamic') {
                    const container = document.getElementById(`dynamic-container-${catId}`);
                    if (container && Array.isArray(categoryData)) {
                        categoryData.forEach(itemData => {
                            const itemEl = addDynamicItem(container, categoryDef.itemType, { suppressSideEffects: true });
                            if (itemEl) {
                                 Object.keys(itemData).forEach(key => { // key is now the 'name' attribute
                                    const input = itemEl.querySelector(`[name="${key}"]`);
                                    if (input) {
                                        input.value = itemData[key] || '';
                                        // Handle special case for image previews
                                        if ((key === 'evidence-image-data' || key === 'individual-image-url') && input.value) {
                                            const previewImg = itemEl.querySelector('.image-preview');
                                            if(previewImg) previewImg.src = input.value;
                                        }
                                    }
                                 });
                            }
                        });
                    }
                }
             });
        }
        
        if (!isFromTemplate) {
            currentPostId = data.id || null;
            currentPostName = data.name || 'New Post';
        }
        
        appCategories.forEach(cat => {
            if (cat.type === 'dynamic') {
                const container = document.getElementById(`dynamic-container-${cat.id}`);
                if (container) updateItemControls(container);
            }
        });
        clearAutosave();
        updatePreview();
        updateUIForState();
    }

    // --- UI/UX & New Feature Functions ---
    function toggleTheme() {
        const isDark = themeToggle.checked;
        document.documentElement.classList.toggle('dark', isDark);
        localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
    }

    function updateItemControls(container) {
        if (!container) return;
        const items = container.querySelectorAll('.dynamic-item');
        const emptyState = container.querySelector('.empty-state');
        if (items.length === 0) { if (emptyState) emptyState.style.display = 'block'; return; }
        if (emptyState) emptyState.style.display = 'none';
        items.forEach((item, index) => {
            const upBtn = item.querySelector('.up-btn');
            const downBtn = item.querySelector('.down-btn');
            if (upBtn) upBtn.disabled = (index === 0);
            if (downBtn) downBtn.disabled = (index === items.length - 1);
        });
    }

    function addEmptyStateMessage(container) {
        if (!container.querySelector('.empty-state')) {
            const p = document.createElement('p');
            p.className = 'empty-state';
            p.textContent = 'No items added yet.';
            container.appendChild(p);
        }
    }

    function startAutosave() {
        clearInterval(autosaveInterval);
        editingStatus.textContent = 'Unsaved changes...';
        autosaveInterval = setInterval(() => {
            const data = getFormData();
            saveToStorage(AUTOSAVE_KEY, data);
            editingStatus.textContent = `Draft saved at ${new Date().toLocaleTimeString()}`;
        }, 10000);
    }

    function clearAutosave() {
        clearInterval(autosaveInterval);
        localStorage.removeItem(AUTOSAVE_KEY);
    }

    function loadAutosavedDraft() {
        const draft = getFromStorage(AUTOSAVE_KEY);
        if (draft) {
            showConfirmation( "We found an unsaved draft. Would you like to restore it?", () => {
                try {
                    populateForm(draft);
                    showToast("Draft restored.", 'info');
                } catch (e) {
                    console.error("Failed to parse autosaved draft:", e);
                    showToast("Could not restore draft, it was corrupted.", 'error');
                    clearAutosave();
                    clearForm();
                }
            }, () => {
                clearAutosave();
                clearForm();
            });
        } else {
            clearForm();
        }
    }

    function exportPosts() {
        const posts = getFromStorage(LOCAL_STORAGE_KEY) || [];
        if (posts.length === 0) { showToast("No posts to export.", 'error'); return; }
        const dataStr = JSON.stringify(posts, null, 2);
        const dataBlob = new Blob([dataStr], {type: "application/json"});
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.download = `blacklist_posts_backup_${new Date().toISOString().split('T')[0]}.json`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        showToast("Posts exported successfully.", 'success');
    }

    function exportSinglePost(postId) {
        const posts = getFromStorage(LOCAL_STORAGE_KEY) || [];
        const post = posts.find(p => p.id === postId);
        if (!post) { showToast("Post not found for export.", "error"); return; }
        const dataStr = JSON.stringify(post, null, 2);
        const dataBlob = new Blob([dataStr], {type: "application/json"});
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.download = `${post.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
    }

    function handleImport(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                const importedPosts = Array.isArray(importedData) ? importedData : [importedData];
                
                showConfirmation(`Found ${importedPosts.length} posts. Do you want to merge these by adding new posts from the file?`, () => {
                    const existingPosts = getFromStorage(LOCAL_STORAGE_KEY) || [];
                    const existingIds = new Set(existingPosts.map(p => p.id));
                    let addedCount = 0;
                    importedPosts.forEach(p => {
                        if (p && p.id && !existingIds.has(p.id)) {
                            existingPosts.push(p);
                            addedCount++;
                        }
                    });
                    saveToStorage(LOCAL_STORAGE_KEY, existingPosts);
                    showToast(`${addedCount} new posts imported successfully!`, 'success');
                    openLoadModal();
                });
            } catch (err) {
                showToast("Import failed. Invalid file format.", 'error');
            } finally {
                importFileInput.value = '';
            }
        };
        reader.readAsText(file);
    }
    
    // --- Template Functions ---
    function openTemplatesModal() {
        const templates = getFromStorage(TEMPLATES_KEY) || [];
        lists.templates.innerHTML = '';
        if (templates.length === 0) {
            lists.templates.innerHTML = '<p class="text-secondary">No templates saved.</p>';
        } else {
            templates.forEach(template => {
                const el = document.createElement('div');
                el.className = 'modal-list-item';
                el.innerHTML = `<div class="modal-list-item-text" data-template-id="${template.id}">${template.name}</div><div class="modal-list-item-controls"><button class="modal-control-btn text-red-500" data-delete-id="${template.id}" data-delete-name="${template.name}" title="Delete Template">🗑️</button></div>`;
                lists.templates.appendChild(el);
            });
        }
        openModal(modals.templates);
    }
    
    lists.templates.addEventListener('click', (evt) => {
        const textTarget = evt.target.closest('.modal-list-item-text');
        const controlTarget = evt.target.closest('.modal-control-btn');

        if (textTarget) {
            loadTemplate(textTarget.dataset.templateId);
        } else if (controlTarget) {
            deleteTemplate(controlTarget.dataset.deleteId, controlTarget.dataset.deleteName);
        }
    });

    function saveCurrentAsTemplate() {
        const templateName = prompt("Enter a name for this template:");
        if (!templateName) return;
        const data = getFormData(true);
        data.name = templateName;
        data.id = crypto.randomUUID();
        const templates = getFromStorage(TEMPLATES_KEY) || [];
        templates.push(data);
        saveToStorage(TEMPLATES_KEY, templates);
        showToast(`Template "${templateName}" saved.`, 'success');
        openTemplatesModal(); // Refresh list
    }

    function loadTemplate(templateId) {
        showConfirmation("Loading this template will overwrite your current unsaved changes. Continue?", () => {
            const templates = getFromStorage(TEMPLATES_KEY) || [];
            const template = templates.find(t => t.id === templateId);
            if (template) {
                populateForm(template, true); // Pass true to indicate it's a template
                closeModal(modals.templates);
                showToast(`Loaded template: ${template.name}`, 'success');
            }
        });
    }

    function deleteTemplate(templateId, templateName) {
        showConfirmation(`Are you sure you want to delete the template "${templateName}"?`, () => {
            const templates = getFromStorage(TEMPLATES_KEY) || [];
            saveToStorage(TEMPLATES_KEY, templates.filter(t => t.id !== templateId));
            showToast(`Template "${templateName}" deleted.`, 'success');
            openTemplatesModal(); // Refresh list
        });
    }

    // --- Version History Functions ---
    function saveVersion(postId, postData) {
        const versions = getFromStorage(VERSIONS_PREFIX + postId) || [];
        versions.unshift({ versionId: crypto.randomUUID(), savedAt: new Date().toISOString(), data: postData });
        if (versions.length > 10) versions.pop();
        saveToStorage(VERSIONS_PREFIX + postId, versions);
    }

    function openHistoryModal(postId) {
        const versions = getFromStorage(VERSIONS_PREFIX + postId) || [];
        const posts = getFromStorage(LOCAL_STORAGE_KEY) || [];
        lists.history.innerHTML = '';
        modals.history.querySelector('h2').textContent = `History for ${posts.find(p=>p.id===postId)?.name || 'Post'}`;

        if (versions.length === 0) {
            lists.history.innerHTML = '<p class="text-secondary">No previous versions found.</p>';
        } else {
            versions.forEach(version => {
                const el = document.createElement('div');
                el.className = 'modal-list-item';
                el.innerHTML = `<div class="modal-list-item-text">Version from ${new Date(version.savedAt).toLocaleString()}</div><div class="modal-list-item-controls"><button class="action-btn text-sm bg-blue-500 text-white px-2 py-1 rounded" data-post-id="${postId}" data-version-id="${version.versionId}">Restore</button></div>`;
                lists.history.appendChild(el);
            });
        }
        
        openModal(modals.history);
    }
    
    lists.history.addEventListener('click', (evt) => {
        const button = evt.target.closest('[data-version-id]');
        if(button) {
            restoreVersion(button.dataset.postId, button.dataset.versionId);
        }
    });

    function restoreVersion(postId, versionId) {
        showConfirmation("Restoring this version will overwrite the current post content. Continue?", () => {
            const versions = getFromStorage(VERSIONS_PREFIX + postId) || [];
            const versionToRestore = versions.find(v => v.versionId === versionId);
            if (versionToRestore) {
                populateForm(versionToRestore.data);
                closeModal(modals.history);
                showToast("Version restored successfully.", 'success');
            } else {
                showToast("Could not find version to restore.", 'error');
            }
        });
    }

    // --- Gemini AI Functions ---
    function getApiKey() {
        const apiKey = "__GEMINI_API_KEY_PLACEHOLDER__"; 
        if (apiKey.includes("PLACEHOLDER")) {
            return localStorage.getItem(API_KEY_LS_KEY);
        }
        return apiKey;
    }
    
    function ensureApiKey() {
        const key = getApiKey();
        if (!key || key.includes("PLACEHOLDER")) {
            const userKey = prompt("Please enter your Gemini API key for local testing:");
            if (userKey) {
                localStorage.setItem(API_KEY_LS_KEY, userKey);
                return true;
            }
            showToast("Gemini API Key is required for AI features.", "error");
            return false;
        }
        return true;
    }

    async function handleAIAssist(type, element, button) {
        if (!ensureApiKey()) return;

        let prompt = '';
        let content = element.value;

        if (type !== 'suggest' && !content) { 
            showToast('There is no text to rewrite.', 'info'); 
            return;
        }

        button.classList.add('loading');
        button.disabled = true;

        try {
            switch (type) {
                case 'suggest':
                    content = generatePostText();
                    if (!content) { showToast('Please write some content before suggesting hashtags.', 'info'); return; }
                    prompt = `Based on the following social media post content, generate a list of 5-10 relevant and effective hashtags. Return them as a single line, separated by spaces, starting with '#'.\n\nPost Content:\n${content}`;
                    break;
                case 'formal':
                    prompt = `Rewrite the following text to have a more formal and official tone:\n\n${content}`;
                    break;
                case 'urgent':
                    prompt = `Rewrite the following text to sound more urgent and immediate:\n\n${content}`;
                    break;
                case 'factual':
                    prompt = `Rewrite the following text to state only the facts, removing any emotional or persuasive language:\n\n${content}`;
                    break;
                case 'persuasive':
                    prompt = `Rewrite the following text to be more persuasive and compelling, encouraging action or awareness:\n\n${content}`;
                    break;
                default:
                    throw new Error(`Unknown AI assist type: ${type}`);
            }

            const result = await callGeminiAPI(prompt);
            element.value = result;
            element.dispatchEvent(new Event('input', { bubbles: true })); // To trigger preview update
            showToast('AI assistance complete!', 'success');

        } catch (error) {
            console.error('Gemini API Error:', error);
            showToast(error.message, 'error');
        } finally {
            button.classList.remove('loading');
            button.disabled = false;
        }
    }

    async function callGeminiAPI(prompt, jsonSchema = null) {
        const apiKey = getApiKey();
        if (!apiKey || apiKey.includes("PLACEHOLDER")) {
            throw new Error("API Key not set. Please set it for local development.");
        }
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        
        const payload = {
            contents: [{ role: "user", parts: [{ text: prompt }] }]
        };

        if (jsonSchema) {
            payload.generationConfig = {
                responseMimeType: "application/json",
                responseSchema: jsonSchema
            };
        }

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorBody = await response.json();
            const errorMessage = errorBody.error?.message || 'Unknown network error';
            throw new Error(`API request failed: ${errorMessage}`);
        }

        const result = await response.json();

        if (result.candidates && result.candidates.length > 0 && result.candidates[0].content?.parts?.length > 0) {
            return result.candidates[0].content.parts[0].text.trim();
        } else {
             if (result.promptFeedback?.blockReason) {
                throw new Error(`AI request blocked for: ${result.promptFeedback.blockReason}. Please revise your text.`);
            }
            throw new Error('AI returned an invalid response.');
        }
    }

    // --- Export Functions ---
    function downloadFile(filename, content, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function exportAsTxt(includedCategories = null) {
        const text = generatePostText({ includedCategories, forExport: true }).replace(/\[REDACTED\]/g, '…');
        downloadFile(`${currentPostName || 'post'}.txt`, text, 'text/plain;charset=utf-8;');
    }

    function exportAsMd(includedCategories = null) {
        const text = generatePostText({ includedCategories, forExport: true }).replace(/\[REDACTED\]/g, '…');
        downloadFile(`${currentPostName || 'post'}.md`, text, 'text/markdown;charset=utf-8;');
    }

    function exportAsPdf(includedCategories = null) {
        const tempPreview = document.createElement('div');
        tempPreview.innerHTML = renderMarkdown(generatePostText({ includedCategories, forExport: true }).replace(/\[REDACTED\]/g, '…'));
        
        showToast("Generating PDF...", "info");

        html2canvas(tempPreview, {
            useCORS: true,
            scale: 2,
            backgroundColor: document.documentElement.classList.contains('dark') ? '#1f2937' : '#f3f4f6',
        }).then(canvas => {
            const { jsPDF } = window.jspdf;
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const imgHeight = canvas.height * pdfWidth / canvas.width;
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
            heightLeft -= pdf.internal.pageSize.getHeight();

            while (heightLeft > 0) {
                position = -heightLeft;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
                heightLeft -= pdf.internal.pageSize.getHeight();
            }
            pdf.save(`${currentPostName || 'post'}.pdf`);
            showToast("PDF downloaded.", "success");
        }).catch(err => {
            console.error("PDF export failed:", err);
            showToast("PDF export failed. See console for details.", "error");
        });
    }
    
    function openSelectiveExportModal() {
        lists.selectiveExport.innerHTML = '';
        appCategories.forEach(category => {
            const item = document.createElement('div');
            item.innerHTML = `
                <label>
                    <input type="checkbox" class="selective-export-checkbox" value="${category.id}" checked>
                    <span>${category.emoji} ${category.title}</span>
                </label>
            `;
            lists.selectiveExport.appendChild(item);
        });
        openModal(modals.selectiveExport);
    }

    document.getElementById('performSelectiveExportBtn').addEventListener('click', () => {
        const selectedCategories = Array.from(document.querySelectorAll('.selective-export-checkbox:checked')).map(cb => cb.value);
        exportAsMd(selectedCategories); // Defaulting to MD for selective, could add more options
        closeModal(modals.selectiveExport);
    });


    // --- Toast & Modal Helpers ---
    function showToast(message, type = 'success') { const toastContainer = document.getElementById('toast-container'); const toast = document.createElement('div'); toast.className = `toast ${type}`; toast.textContent = message; toastContainer.appendChild(toast); setTimeout(() => { toast.classList.add('show'); }, 10); setTimeout(() => { toast.classList.remove('show'); toast.addEventListener('transitionend', () => toast.remove()); }, 4000); }
    
    function showConfirmation(message, onConfirm, onCancel) {
        document.getElementById('confirmModalText').textContent = message;
        _confirmCallbacks = { onConfirm, onCancel };
        openModal(modals.confirm);
    }

    function openModal(modalElement) {
        if (!modalElement) return;
        modalElement.style.display = 'flex';
        appContainer.setAttribute('aria-hidden', 'true');
        const focusableElement = modalElement.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusableElement) setTimeout(() => focusableElement.focus(), 100);
    }

    function closeModal(modalElement) {
        if (!modalElement) return;
        modalElement.style.display = 'none';
        appContainer.removeAttribute('aria-hidden');
        if (modalElement === modals.confirm) {
            _confirmCallbacks = { onConfirm: null, onCancel: null };
        }
    }
    
    function updateUIForState() {
        if (localStorage.getItem(AUTOSAVE_KEY)) {
             editingStatus.textContent = `Draft saved at ${new Date(JSON.parse(localStorage.getItem(AUTOSAVE_KEY))?.savedAt || Date.now()).toLocaleTimeString()}`;
             document.getElementById('saveOrUpdate').textContent = 'Save Draft'; // Indicate it's saving the draft
             document.getElementById('saveOrUpdate').classList.remove('bg-indigo-600', 'hover:bg-indigo-700', 'bg-purple-600', 'hover:bg-purple-700');
             document.getElementById('saveOrUpdate').classList.add('bg-yellow-600', 'hover:bg-yellow-700');
             return;
        }

        clearInterval(autosaveInterval);
        if (currentPostId) {
            const subjectName = document.getElementById('subjectName')?.value;
            editingStatus.textContent = `Editing: ${currentPostName || subjectName || 'Untitled'}`;
            document.getElementById('saveOrUpdate').textContent = 'Update';
            document.getElementById('saveOrUpdate').classList.remove('bg-indigo-600', 'hover:bg-indigo-700', 'bg-yellow-600', 'hover:bg-yellow-700');
            document.getElementById('saveOrUpdate').classList.add('bg-purple-600', 'hover:bg-purple-700');
        } else {
            editingStatus.textContent = '';
            document.getElementById('saveOrUpdate').textContent = 'Save';
            document.getElementById('saveOrUpdate').classList.remove('bg-purple-600', 'hover:bg-purple-700', 'bg-yellow-600', 'hover:bg-yellow-700');
            document.getElementById('saveOrUpdate').classList.add('bg-indigo-600', 'hover:bg-indigo-700');
        }
    }

    // --- Category Management ---
    const defaultCategories = [
        { id: 'mainInfo', title: 'Main Information', emoji: 'ℹ️', type: 'fields', fields: [
            { id: 'subjectName', label: "Subject's Full Name", type: 'text' },
            { id: 'caseType', label: "Case Type", type: 'text', placeholder: "e.g., Animal Cruelty Case" },
            { id: 'location', label: "Location", type: 'text', placeholder: "e.g., Puerto Rico" },
            { id: 'updateDate', label: "Date of Update", type: 'date' },
            { id: 'caseUpdate', label: "Key Updates & Orders", type: 'textarea', rows: 4, placeholder: "Use '▪️' for bullet points", aiAction: 'rewrite' },
            { id: 'trialDate', label: "Trial / Hearing Date", type: 'text' },
        ]},
        { id: 'timeline', title: 'Timeline of Events', emoji: '🗓️', type: 'dynamic', itemType: 'timelineEvent' },
        { id: 'individuals', title: 'Blacklisted Individuals', emoji: '👤', type: 'dynamic', itemType: 'individual' },
        { id: 'aliases', title: 'Aliases', emoji: '🎭', type: 'dynamic', itemType: 'alias' },
        { id: 'organizations', title: 'Associated Organizations', emoji: '🏢', type: 'dynamic', itemType: 'organization' },
        { id: 'legalReg', title: 'Legal Registration', emoji: '⚖️', type: 'dynamic', itemType: 'legalRegistration' },
        { id: 'fraudAllegations', title: 'Allegations of Fraudulent Solicitations', emoji: '💸', type: 'dynamic', itemType: 'fraudulentSolicitation' },
        { id: 'warnings', title: 'Warnings and First-Hand Accounts', emoji: '⚠️', type: 'dynamic', itemType: 'warningAndAccount' },
        { id: 'investigations', title: 'Animal Cruelty Investigations', emoji: '🕵️', type: 'dynamic', itemType: 'investigation' },
        { id: 'evidence', title: 'Enhanced Documentation & Evidence', emoji: '📊', type: 'dynamic', itemType: 'evidence' },
        { id: 'articles', title: 'News & Legal Documents', emoji: '📰', type: 'dynamic', itemType: 'article' },
        { id: 'summary', title: 'Summary & Extra Details', emoji: '📝', type: 'fields', fields: [
            { id: 'backgroundInfo', label: "Background Information", type: 'textarea', rows: 6, aiAction: 'rewrite' },
            { id: 'emergingReports', label: "Emerging Reports", type: 'textarea', rows: 3, aiAction: 'rewrite' },
            { id: 'hashtags', label: "Hashtags", type: 'text', placeholder: "#Hashtag1 #Hashtag2", aiAction: 'suggest' },
        ]},
    ];

    function renderForm() {
        dynamicFormContainer.innerHTML = '';
        appCategories.forEach(category => {
            const section = document.createElement('div');
            section.className = 'form-section shadow-md';
            section.id = `section-${category.id}`;

            let contentHtml = '';
            if (category.type === 'fields') {
                const fieldsHtml = category.fields.map(field => {
                    let aiButtonHtml = '';
                    if (field.aiAction === 'suggest') {
                        aiButtonHtml = `<button id="${field.aiAction}Btn" class="ai-btn action-btn text-xs bg-purple-600 hover:bg-purple-700 text-white font-bold py-1 px-2 rounded-lg shadow">
                            <span class="btn-text">✨ Suggest</span><span class="spinner">🌀</span>
                        </button>`;
                    } else if (field.aiAction === 'rewrite') {
                        aiButtonHtml = `<div class="dropdown">
                            <button class="ai-btn action-btn text-xs bg-purple-600 hover:bg-purple-700 text-white font-bold py-1 px-2 rounded-lg shadow" data-field-id="${field.id}">
                                ✨ Rewrite with AI
                            </button>
                            <div class="dropdown-content ai-rewrite-menu">
                                <a href="#" data-rewrite-style="formal">More Formal</a>
                                <a href="#" data-rewrite-style="urgent">More Urgent</a>
                                <a href="#" data-rewrite-style="factual">Just the Facts</a>
                                <a href="#" data-rewrite-style="persuasive">More Persuasive</a>
                            </div>
                        </div>`;
                    }

                    const labelHtml = `<div class="flex justify-between items-center mb-1">
                        <label for="${field.id}" class="block text-sm font-medium text-secondary">${field.label}</label>
                        ${aiButtonHtml}
                    </div>`;

                    if (field.type === 'textarea') {
                        return `<div>${labelHtml}<textarea id="${field.id}" rows="${field.rows || 3}" placeholder="${field.placeholder || ''}" class="w-full p-2 border rounded-md"></textarea></div>`;
                    }
                    return `<div>${labelHtml}<input type="${field.type}" id="${field.id}" placeholder="${field.placeholder || ''}" class="w-full p-2 border rounded-md"></div>`;
                }).join('');
                contentHtml = `<div class="space-y-4">${fieldsHtml}</div>`;
            } else if (category.type === 'dynamic') {
                contentHtml = `<div id="dynamic-container-${category.id}" class="space-y-4"></div>
                               <button data-item-type="${category.itemType}" data-container-id="dynamic-container-${category.id}" class="add-dynamic-item-btn mt-4 bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg w-full action-btn">Add Item</button>`;
            }

            section.innerHTML = `
                <div class="form-section-header" role="button" aria-expanded="true" aria-controls="section-content-${category.id}" tabindex="0">
                    <h3><span aria-hidden="true" class="text-xl mr-2">${category.emoji}</span>${category.title}</h3>
                    <svg class="chevron-icon w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
                <div class="form-section-content" id="section-content-${category.id}">
                    ${contentHtml}
                </div>
            `;
            dynamicFormContainer.appendChild(section);
        });

        // --- Initialize SortableJS for Drag-and-Drop ---
        document.querySelectorAll('[id^="dynamic-container-"]').forEach(container => {
            new Sortable(container, {
                animation: 150,
                ghostClass: 'sortable-ghost',
                onEnd: () => {
                    updateItemControls(container);
                    debouncedUpdatePreview();
                    startAutosave();
                }
            });
        });

        // Re-attach event listeners for new elements
        document.querySelectorAll('.form-section-header').forEach(header => {
            header.addEventListener('click', toggleSection);
            header.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSection(e); } });
        });
        document.querySelectorAll('.add-dynamic-item-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const container = document.getElementById(e.currentTarget.dataset.containerId);
                addDynamicItem(container, e.currentTarget.dataset.itemType);
            });
        });
        document.getElementById('suggestBtn')?.addEventListener('click', (e) => {
            const element = document.getElementById('hashtags');
            handleAIAssist('suggest', element, e.currentTarget);
        });
        document.querySelectorAll('[data-field-id]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.currentTarget.parentElement.classList.toggle('show');
            });
        });
        document.querySelectorAll('[data-rewrite-style]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const style = e.currentTarget.dataset.rewriteStyle;
                const dropdown = e.currentTarget.closest('.dropdown');
                const button = dropdown.querySelector('button');
                const fieldId = button.dataset.fieldId;
                const element = document.getElementById(fieldId);
                handleAIAssist(style, element, button);
                dropdown.classList.remove('show');
            });
        });

        dynamicFormContainer.addEventListener('click', (e) => {
            handleDynamicItemControls(e);
            if (e.target.classList.contains('evidence-image-upload')) {
                handleImageUpload(e);
            }
        });
    }

    function openCategoryManager() {
        renderCategoryList();
        openModal(modals.categoryManager);
    }

    function renderCategoryList() {
        lists.categories.innerHTML = '';
        appCategories.forEach((category, index) => {
            const item = document.createElement('div');
            item.className = 'category-manager-item';
            item.dataset.id = category.id;
            item.innerHTML = `
                <span class="handle">↕️</span>
                <input type="text" value="${category.emoji}" class="w-10 p-1 border rounded-md emoji-input">
                <input type="text" value="${category.title}" class="flex-grow p-1 border rounded-md title-input">
                <button class="modal-control-btn" data-action="move-up" ${index === 0 ? 'disabled' : ''}>🔼</button>
                <button class="modal-control-btn" data-action="move-down" ${index === appCategories.length - 1 ? 'disabled' : ''}>🔽</button>
                <button class="modal-control-btn text-red-500" data-action="delete">🗑️</button>
            `;
            lists.categories.appendChild(item);
        });

        lists.categories.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (!button) return;
            const item = button.closest('.category-manager-item');
            const id = item.dataset.id;
            const currentIndex = appCategories.findIndex(c => c.id === id);

            switch(button.dataset.action) {
                case 'move-up':
                    if (currentIndex > 0) {
                        [appCategories[currentIndex], appCategories[currentIndex - 1]] = [appCategories[currentIndex - 1], appCategories[currentIndex]];
                    }
                    break;
                case 'move-down':
                    if (currentIndex < appCategories.length - 1) {
                        [appCategories[currentIndex], appCategories[currentIndex + 1]] = [appCategories[currentIndex + 1], appCategories[currentIndex]];
                    }
                    break;
                case 'delete':
                    showConfirmation(`Are you sure you want to delete the "${appCategories[currentIndex].title}" category? This cannot be undone.`, () => {
                       appCategories.splice(currentIndex, 1);
                       renderCategoryList();
                    });
                    return; // Prevent re-render before confirmation
            }
            renderCategoryList();
        });
    }

    function addNewCategory() {
        const title = prompt("Enter the new category title:");
        if (!title) return;
        const newCategory = {
            id: title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, ''),
            title: title,
            emoji: '🆕',
            type: 'dynamic', // Default to dynamic
            itemType: 'generic' // A new generic template might be needed
        };
        // For simplicity, new categories are dynamic. A more complex UI could allow choosing the type.
        if (!itemTemplates.generic) {
            itemTemplates.generic = (id) => `<div><label for="generic-text-${id}" class="block text-sm font-medium text-secondary mb-1">Content</label><textarea id="generic-text-${id}" name="generic-text" rows="3" class="w-full p-2 border rounded-md generic-text"></textarea></div>`;
        }
        appCategories.push(newCategory);
        renderCategoryList();
    }

    function saveCategoryChanges() {
        const items = lists.categories.querySelectorAll('.category-manager-item');
        const newOrder = Array.from(items).map(item => item.dataset.id);
        
        const updatedCategories = [];
        newOrder.forEach(id => {
            const originalCategory = appCategories.find(c => c.id === id);
            if (originalCategory) {
                const itemElement = lists.categories.querySelector(`[data-id="${id}"]`);
                originalCategory.title = itemElement.querySelector('.title-input').value;
                originalCategory.emoji = itemElement.querySelector('.emoji-input').value;
                updatedCategories.push(originalCategory);
            }
        });
        appCategories = updatedCategories;
        saveToStorage(CATEGORIES_KEY, appCategories);
        renderForm();
        closeModal(modals.categoryManager);
        showToast('Categories updated!', 'success');
    }

    async function handleArticleExtraction() {
        if (!ensureApiKey()) return;

        const url = document.getElementById('articleUrlInput').value;
        if (!url) {
            showToast('Please enter a URL.', 'info');
            return;
        }

        const button = document.getElementById('fetchArticleBtn');
        button.classList.add('loading');
        button.disabled = true;

        try {
            // In a real application, you would fetch the URL content via a server-side proxy
            // to avoid CORS issues. Here, we simulate it with sample text.
            const articleText = `
                MAYAGÜEZ, PR – Jury selection was completed Tuesday in the animal cruelty case against Erica Marie Erickson in Mayagüez, Puerto Rico. 
                The trial is set to begin on July 15, 2025. Previously, on May 7, 2025, a motion to dismiss was denied by the judge.
                Erickson, also known as "Erica the Rescuer" on social media, faces multiple charges after dozens of malnourished animals were found on her property in early February.
                Authorities were alerted by a former volunteer, Jane Smith, who provided testimony about the conditions. Another individual, John Doe, is also being investigated in connection with the case.
            `;
            
            showToast('Extracting information with AI...', 'info');

            const jsonSchema = {
                type: "OBJECT",
                properties: {
                    subjectName: { type: "STRING", description: "The full name of the main person the case is about." },
                    caseType: { type: "STRING", description: "The type of case, e.g., 'Animal Cruelty Case'." },
                    location: { type: "STRING", description: "The city and state/country where the case is located." },
                    keyUpdates: { type: "STRING", description: "A summary of the most recent key updates mentioned in the article." },
                    trialDate: { type: "STRING", description: "The upcoming trial or hearing date, formatted as Month Day, Year." },
                    timelineEvents: {
                        type: "ARRAY",
                        description: "A list of important events with their dates.",
                        items: {
                            type: "OBJECT",
                            properties: {
                                date: { type: "STRING", description: "The date of the event in YYYY-MM-DD format." },
                                description: { type: "STRING", description: "A brief description of the event." }
                            }
                        }
                    },
                    individuals: {
                        type: "ARRAY",
                        description: "A list of all individuals mentioned by name.",
                        items: {
                            type: "OBJECT",
                            properties: {
                                name: { type: "STRING", description: "Full name of the individual." }
                            }
                        }
                    },
                    aliases: {
                        type: "ARRAY",
                        description: "A list of aliases or nicknames mentioned.",
                         items: {
                            type: "OBJECT",
                            properties: {
                                name: { type: "STRING", description: "The alias name." }
                            }
                        }
                    }
                }
            };
            
            const prompt = `Analyze the following news article and extract the specified information in JSON format.
            Article:
            ---
            ${articleText}
            ---
            `;

            const result = await callGeminiAPI(prompt, jsonSchema);
            const extractedData = JSON.parse(result);
            
            showConfirmation("AI has extracted information from the article. Do you want to apply it to the form? This will overwrite existing data in the filled fields.", () => {
                populateFormWithExtractedData(extractedData);
                showToast('Information applied successfully!', 'success');
            });

        } catch (error) {
            console.error('Article Extraction Error:', error);
            showToast(error.message, 'error');
        } finally {
            button.classList.remove('loading');
            button.disabled = false;
        }
    }

    function populateFormWithExtractedData(data) {
        if (!data) return;

        // Simple fields
        if (data.subjectName) document.getElementById('subjectName').value = data.subjectName;
        if (data.caseType) document.getElementById('caseType').value = data.caseType;
        if (data.location) document.getElementById('location').value = data.location;
        if (data.keyUpdates) document.getElementById('caseUpdate').value = data.keyUpdates;
        if (data.trialDate) document.getElementById('trialDate').value = data.trialDate;

        // Dynamic timeline events
        if (data.timelineEvents && Array.isArray(data.timelineEvents)) {
            const container = document.getElementById('dynamic-container-timeline');
            if(container) {
                data.timelineEvents.forEach(event => {
                    const itemEl = addDynamicItem(container, 'timelineEvent', { suppressSideEffects: true });
                    if (itemEl) {
                        itemEl.querySelector('[name="timeline-date"]').value = event.date;
                        itemEl.querySelector('[name="timeline-description"]').value = event.description;
                    }
                });
                updateItemControls(container);
            }
        }
        
        // Dynamic individuals
        if (data.individuals && Array.isArray(data.individuals)) {
             const container = document.getElementById('dynamic-container-individuals');
             if(container) {
                data.individuals.forEach(person => {
                    const itemEl = addDynamicItem(container, 'individual', { suppressSideEffects: true });
                    if(itemEl) itemEl.querySelector('[name="individual-name"]').value = person.name;
                });
                updateItemControls(container);
             }
        }
        
        // Dynamic aliases
        if (data.aliases && Array.isArray(data.aliases)) {
             const container = document.getElementById('dynamic-container-aliases');
             if(container) {
                data.aliases.forEach(alias => {
                    const itemEl = addDynamicItem(container, 'alias', { suppressSideEffects: true });
                    if(itemEl) itemEl.querySelector('[name="alias-name"]').value = alias.name;
                });
                updateItemControls(container);
             }
        }

        debouncedUpdatePreview();
    }
    
    function handleImageUpload(e) {
        const fileInput = e.target;
        const file = fileInput.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const dataUrl = event.target.result;
            const dynamicItem = fileInput.closest('.dynamic-item');
            const previewImg = dynamicItem.querySelector('.image-preview');
            const dataTextarea = dynamicItem.querySelector('[name="evidence-image-data"]');
            
            if (previewImg) previewImg.src = dataUrl;
            if (dataTextarea) dataTextarea.value = dataUrl;
            
            debouncedUpdatePreview();
            startAutosave();
        };
        reader.readAsDataURL(file);
    }

    async function runSanityCheck() {
        if (!ensureApiKey()) return;
        
        const button = document.getElementById('aiReviewBtn');
        const resultContainer = document.getElementById('aiReviewResult');
        
        button.classList.add('loading');
        button.disabled = true;
        resultContainer.innerHTML = `<p class="text-secondary">AI is reviewing your post...</p>`;
        openModal(modals.aiReview);

        const data = getFormData();
        const issues = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Check 1: Individuals vs Aliases
        const individualsCount = data.categories.individuals?.length || 0;
        const aliasesCount = data.categories.aliases?.length || 0;
        if (individualsCount > 0 && aliasesCount === 0) {
            issues.push(`The post lists ${individualsCount} individual(s) but no aliases. Consider if any aliases should be added.`);
        }

        // Check 2: Past dates
        const trialDateStr = data.categories.mainInfo?.trialDate;
        if (trialDateStr) {
            try {
                const trialDate = new Date(trialDateStr + 'T00:00:00');
                if (!isNaN(trialDate.getTime()) && trialDate < today) {
                    issues.push(`The trial/hearing date "${trialDateStr}" appears to be in the past. Please verify if this is correct or if it should be a future date.`);
                }
            } catch(e) { /* Ignore parsing errors */ }
        }

        // Check 3: Allegations without sources
        const hasAllegations = (data.categories.fraudAllegations?.length > 0 && data.categories.fraudAllegations.some(a => a['fraudulent-solicitation-text']?.trim())) ||
                               (data.categories.warnings?.length > 0 && data.categories.warnings.some(w => w['warning-account-text']?.trim()));
        const hasSources = (data.categories.evidence?.length > 0) || (data.categories.articles?.length > 0);
        if (hasAllegations && !hasSources) {
            issues.push("The post contains allegations or warnings but does not appear to have any sources listed in the 'Evidence' or 'News & Legal Documents' sections. Adding source links can improve credibility.");
        }

        if (issues.length === 0) {
            resultContainer.innerHTML = `<p class="text-green-600 font-semibold">✅ No obvious issues found. The post looks good!</p>`;
            button.classList.remove('loading');
            button.disabled = false;
            return;
        }

        const prompt = `You are a helpful assistant reviewing a social media alert post for potential issues. The user has provided the following points of concern. Please rephrase them into a friendly, constructive, and easy-to-read bulleted list of suggestions. Do not add any new information, just rephrase the provided points.

Points of concern:
- ${issues.join('\n- ')}
`;

        try {
            const suggestions = await callGeminiAPI(prompt);
            resultContainer.innerHTML = `
                <p class="text-secondary mb-4">Here are a few suggestions to improve the post:</p>
                <ul class="text-primary space-y-3">
                    ${suggestions.replace(/^\* /gm, '<li>').replace(/$/gm, '</li>')}
                </ul>
            `;
        } catch (error) {
            console.error("Sanity Check Error:", error);
            showToast(error.message, 'error');
            resultContainer.innerHTML = `<p class="text-red-500">Could not complete AI review. ${error.message}</p>`;
        } finally {
            button.classList.remove('loading');
            button.disabled = false;
        }
    }


    // --- Initial Load ---
    function initialize() {
        const savedTheme = localStorage.getItem(THEME_KEY);
        if (savedTheme === 'dark') {
            themeToggle.checked = true;
            document.documentElement.classList.add('dark');
        } else {
            themeToggle.checked = false;
            document.documentElement.classList.remove('dark');
        }
        
        appCategories = getFromStorage(CATEGORIES_KEY) || defaultCategories;
        saveToStorage(CATEGORIES_KEY, appCategories); // Ensure it's saved if it was null

        renderForm();
        loadAutosavedDraft();
    }
    
    document.addEventListener('DOMContentLoaded', initialize);
})(); // End IIFE
