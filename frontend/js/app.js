// ====== STATE ======
const state = {
    notes: [],
    folders: [],
    currentFolder: 'all',
    currentNoteId: null,
    chatContext: null,
    language: 'en',
    isProcessing: false
};

const API_BASE = '';

// ====== PARTICLES BACKGROUND ======
function createParticles() {
    const container = document.getElementById('particles');
    const count = 30;
    for (let i = 0; i < count; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 15 + 's';
        particle.style.animationDuration = (15 + Math.random() * 10) + 's';
        particle.style.width = (3 + Math.random() * 6) + 'px';
        particle.style.height = particle.style.width;
        container.appendChild(particle);
    }
}

// ====== TOAST NOTIFICATIONS ======
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: 'fa-check-circle', error: 'fa-times-circle', info: 'fa-info-circle' };
    toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i> ${message}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

// ====== API HELPERS ======
async function apiFetch(url, options = {}) {
    try {
        const res = await fetch(API_BASE + url, {
            headers: { 'Content-Type': 'application/json', ...options.headers },
            ...options
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Request failed' }));
            throw new Error(err.error || 'Request failed');
        }
        return await res.json();
    } catch (err) {
        if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
            showToast('Backend server is not running. Start with: node backend/server.js', 'error');
        }
        throw err;
    }
}

// ====== FOLDERS ======
async function loadFolders() {
    try {
        state.folders = await apiFetch('/api/folders');
        renderFolders();
    } catch (e) {
        console.error('Failed to load folders:', e);
    }
}

async function createFolder(name) {
    try {
        const folder = await apiFetch('/api/folders', {
            method: 'POST',
            body: JSON.stringify({ name })
        });
        state.folders.push(folder);
        renderFolders();
        populateFolderSelect();
        showToast(`Folder "${name}" created!`, 'success');
        return folder;
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function deleteFolder(id) {
    try {
        await apiFetch(`/api/folders/${id}`, { method: 'DELETE' });
        state.folders = state.folders.filter(f => f.id !== id);
        renderFolders();
        populateFolderSelect();
        if (state.currentFolder === id) {
            state.currentFolder = 'all';
            filterNotes();
        }
        showToast('Folder deleted', 'info');
    } catch (e) {
        showToast(e.message, 'error');
    }
}

function renderFolders() {
    const list = document.getElementById('folderList');
    let html = `
        <div class="folder-item ${state.currentFolder === 'all' ? 'active' : ''}" data-folder="all">
            <i class="fas fa-layer-group"></i>
            <span>All Notes</span>
            <span class="badge" id="allBadge">${state.notes.length}</span>
        </div>
        <div class="folder-item ${state.currentFolder === 'uncategorized' ? 'active' : ''}" data-folder="uncategorized">
            <i class="fas fa-inbox"></i>
            <span>Uncategorized</span>
            <span class="badge" id="uncatBadge">${state.notes.filter(n => !n.folderId).length}</span>
        </div>
    `;

    state.folders.forEach(f => {
        const count = state.notes.filter(n => n.folderId === f.id).length;
        const active = state.currentFolder === f.id ? 'active' : '';
        html += `
            <div class="folder-item ${active}" data-folder="${f.id}">
                <i class="fas fa-folder"></i>
                <span>${escapeHtml(f.name)}</span>
                <span class="badge">${count}</span>
                <div class="folder-actions">
                    <button class="icon-btn delete-folder" data-id="${f.id}" title="Delete folder">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `;
    });

    list.innerHTML = html;

    // Events
    list.querySelectorAll('.folder-item[data-folder]').forEach(el => {
        el.addEventListener('click', (e) => {
            if (e.target.closest('.delete-folder')) return;
            const folderId = el.dataset.folder;
            state.currentFolder = folderId;
            renderFolders();
            filterNotes();
            updatePageTitle();
        });
    });

    list.querySelectorAll('.delete-folder').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Delete this folder? Notes will be moved to Uncategorized.')) {
                deleteFolder(btn.dataset.id);
            }
        });
    });
}

function populateFolderSelect() {
    const select = document.getElementById('uploadFolder');
    select.innerHTML = '<option value="">Uncategorized</option>';
    state.folders.forEach(f => {
        select.innerHTML += `<option value="${f.id}">${escapeHtml(f.name)}</option>`;
    });
}

function updatePageTitle() {
    const title = document.getElementById('pageTitle');
    if (state.currentFolder === 'all') {
        title.innerHTML = '<i class="fas fa-layer-group"></i> All Notes';
    } else if (state.currentFolder === 'uncategorized') {
        title.innerHTML = '<i class="fas fa-inbox"></i> Uncategorized';
    } else {
        const f = state.folders.find(f => f.id === state.currentFolder);
        title.innerHTML = `<i class="fas fa-folder"></i> ${f ? escapeHtml(f.name) : 'Notes'}`;
    }
}

// ====== NOTES ======
async function loadNotes() {
    try {
        state.notes = await apiFetch('/api/notes');
        renderFolders();
        filterNotes();
    } catch (e) {
        console.error('Failed to load notes:', e);
    }
}

async function createNote(data) {
    try {
        const note = await apiFetch('/api/notes', {
            method: 'POST',
            body: JSON.stringify(data)
        });
        state.notes.unshift(note);
        filterNotes();
        renderFolders();
        showToast('Note added! ✨', 'success');
        return note;
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function updateNote(id, data) {
    try {
        const updated = await apiFetch(`/api/notes/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        const idx = state.notes.findIndex(n => n.id === id);
        if (idx !== -1) state.notes[idx] = updated;
        filterNotes();
        return updated;
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function deleteNote(id) {
    try {
        await apiFetch(`/api/notes/${id}`, { method: 'DELETE' });
        state.notes = state.notes.filter(n => n.id !== id);
        filterNotes();
        renderFolders();
        showToast('Note deleted', 'info');
    } catch (e) {
        showToast(e.message, 'error');
    }
}

function filterNotes() {
    let filtered = [...state.notes];

    if (state.currentFolder === 'uncategorized') {
        filtered = filtered.filter(n => !n.folderId);
    } else if (state.currentFolder !== 'all') {
        filtered = filtered.filter(n => n.folderId === state.currentFolder);
    }

    // Search filter
    const searchQuery = document.getElementById('searchNotes').value.toLowerCase().trim();
    if (searchQuery) {
        filtered = filtered.filter(n =>
            (n.title || '').toLowerCase().includes(searchQuery) ||
            (n.content || '').toLowerCase().includes(searchQuery)
        );
    }

    renderNotes(filtered);
    updateBadges();
}

function renderNotes(notes) {
    const grid = document.getElementById('notesGrid');
    const empty = document.getElementById('emptyState');
    const welcome = document.getElementById('welcomeBanner');

    if (notes.length === 0 && state.notes.length === 0) {
        grid.innerHTML = '';
        empty.classList.add('visible');
        welcome.classList.remove('hidden');
        return;
    }

    if (notes.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="display:block;grid-column:1/-1;">
                <div class="empty-icon"><i class="fas fa-search"></i></div>
                <h3>No notes found</h3>
                <p>Try a different search or folder.</p>
            </div>
        `;
        empty.classList.remove('visible');
        welcome.classList.add('hidden');
        return;
    }

    empty.classList.remove('visible');
    welcome.classList.add('hidden');

    grid.innerHTML = notes.map(note => {
        const typeIcon = getSourceIcon(note.sourceType);
        const preview = (note.content || '').substring(0, 120) || 'No content';
        const hasSummary = note.summary && note.summary.length > 0;
        const langLabel = { en: 'EN', id: 'ID', zh: '中文' };
        const folderName = note.folderId
            ? (state.folders.find(f => f.id === note.folderId)?.name || '')
            : '';

        return `
            <div class="note-card" data-id="${note.id}">
                <div class="card-type">
                    <i class="${typeIcon}"></i>
                    ${note.sourceType || 'text'}
                </div>
                <h3>${escapeHtml(note.title || 'Untitled')}</h3>
                <div class="card-preview">${escapeHtml(preview)}</div>
                <div class="card-footer">
                    <span class="card-lang">
                        <i class="fas fa-language"></i>
                        ${langLabel[note.language] || 'EN'}
                        ${folderName ? ` · ${escapeHtml(folderName)}` : ''}
                    </span>
                    ${hasSummary
                        ? `<span class="card-summarized"><i class="fas fa-check-circle"></i> Summarized</span>`
                        : `<span style="color:var(--text-light);font-style:italic;"><i class="fas fa-hourglass-half"></i> Click to summarize</span>`
                    }
                </div>
            </div>
        `;
    }).join('');

    // Click events
    grid.querySelectorAll('.note-card').forEach(card => {
        card.addEventListener('click', () => {
            const id = card.dataset.id;
            openNoteModal(id);
        });
    });
}

function updateBadges() {
    document.getElementById('allBadge').textContent = state.notes.length;
    document.getElementById('uncatBadge').textContent = state.notes.filter(n => !n.folderId).length;
}

function getSourceIcon(type) {
    const map = {
        youtube: 'fab fa-youtube',
        'google drive': 'fab fa-google-drive',
        canva: 'fas fa-paint-brush',
        pdf: 'fas fa-file-pdf',
        link: 'fas fa-link',
        file: 'fas fa-file',
        text: 'fas fa-pen'
    };
    return map[(type || '').toLowerCase()] || 'fas fa-sticky-note';
}

// ====== NOTE DETAIL MODAL ======
let currentNoteDetail = null;

async function openNoteModal(id) {
    const note = state.notes.find(n => n.id === id);
    if (!note) return;
    currentNoteDetail = note;
    state.currentNoteId = id;

    document.getElementById('noteModalTitle').innerHTML = `<i class="fas fa-sticky-note"></i> ${escapeHtml(note.title)}`;
    document.getElementById('noteOriginalContent').textContent = note.content || 'No content available.';

    const langLabel = { en: 'English', id: 'Indonesia', zh: '中文' };
    const folderName = note.folderId
        ? (state.folders.find(f => f.id === note.folderId)?.name || 'Uncategorized')
        : 'Uncategorized';
    const dateStr = note.createdAt ? new Date(note.createdAt).toLocaleDateString() : 'Unknown';

    document.getElementById('noteMeta').innerHTML = `
        <span><i class="fas fa-language"></i> ${langLabel[note.language] || 'English'}</span>
        <span><i class="fas fa-folder"></i> ${folderName}</span>
        <span><i class="fas fa-calendar"></i> ${dateStr}</span>
        <span><i class="fas fa-tag"></i> ${note.sourceType || 'text'}</span>
    `;

    if (note.summary) {
        document.getElementById('noteSummaryContent').innerHTML = `<div class="summary-text">${formatSummary(note.summary)}</div>`;
    } else {
        document.getElementById('noteSummaryContent').innerHTML = `
            <div class="summary-placeholder">
                <i class="fas fa-robot"></i>
                <p><strong>No summary yet</strong></p>
                <p style="font-size:13px;margin-top:4px;">Click <strong>"Summarize"</strong> above to let AI simplify your notes!</p>
                <p style="font-size:12px;color:var(--text-light);margin-top:8px;">Need an OpenAI API key? Set it in <code>backend\.env</code></p>
            </div>
        `;
    }

    document.getElementById('noteModal').classList.add('active');
}

function formatSummary(summary) {
    return summary
        .split('\n')
        .map(line => {
            if (line.trim().startsWith('-') || line.trim().startsWith('*')) {
                return `<li>${escapeHtml(line.replace(/^[\s]*[-*]\s*/, ''))}</li>`;
            }
            if (line.trim().startsWith('1.') || line.trim().startsWith('2.') || line.trim().startsWith('3.') ||
                line.trim().startsWith('4.') || line.trim().startsWith('5.')) {
                return `<li>${escapeHtml(line.replace(/^\s*\d+\.\s*/, ''))}</li>`;
            }
            if (line.trim() === '') return '';
            return `<p>${escapeHtml(line)}</p>`;
        })
        .join('');
}

// ====== AI: SUMMARIZE ======
async function summarizeNote() {
    if (!currentNoteDetail || state.isProcessing) return;
    state.isProcessing = true;

    const btn = document.getElementById('summarizeBtn');
    btn.innerHTML = '<span class="spinner"></span> Processing...';
    btn.disabled = true;

    try {
        const content = currentNoteDetail.content;
        if (!content) {
            showToast('No content to summarize', 'error');
            return;
        }

        const result = await apiFetch('/api/ai/summarize', {
            method: 'POST',
            body: JSON.stringify({
                content: content.substring(0, 8000),
                language: currentNoteDetail.language || state.language
            })
        });

        const summaryContent = document.getElementById('noteSummaryContent');
        summaryContent.innerHTML = `<div class="summary-text">${formatSummary(result.summary)}</div>`;

        // Save summary
        await updateNote(currentNoteDetail.id, { summary: result.summary });
        currentNoteDetail.summary = result.summary;
        filterNotes();

        showToast('Notes summarized! 🎉', 'success');
    } catch (e) {
        showToast(e.message, 'error');
    } finally {
        btn.innerHTML = '<i class="fas fa-sync"></i> Summarize';
        btn.disabled = false;
        state.isProcessing = false;
    }
}

// ====== AI: TRANSLATE ======
async function translateNote() {
    if (!currentNoteDetail || state.isProcessing) return;

    const lang = prompt('Translate to: (en = English, id = Indonesian, zh = Chinese)', currentNoteDetail.language || 'en');
    if (!lang || !['en', 'id', 'zh'].includes(lang)) return;

    state.isProcessing = true;
    const btn = document.getElementById('translateBtn');
    btn.innerHTML = '<span class="spinner"></span> Translating...';
    btn.disabled = true;

    try {
        const content = currentNoteDetail.content;
        if (!content) {
            showToast('No content to translate', 'error');
            return;
        }

        const result = await apiFetch('/api/ai/translate', {
            method: 'POST',
            body: JSON.stringify({
                content: content.substring(0, 5000),
                targetLanguage: lang
            })
        });

        // Update the original content display with translated version
        document.getElementById('noteOriginalContent').textContent = result.translated;

        // Also update the note content
        await updateNote(currentNoteDetail.id, { content: result.translated, language: lang });
        currentNoteDetail.content = result.translated;
        currentNoteDetail.language = lang;
        filterNotes();

        showToast(`Note translated! 🌍`, 'success');
    } catch (e) {
        showToast(e.message, 'error');
    } finally {
        btn.innerHTML = '<i class="fas fa-language"></i> Translate';
        btn.disabled = false;
        state.isProcessing = false;
    }
}

// ====== AI: EXTRACT FROM URL ======
async function extractFromUrl(url) {
    try {
        const result = await apiFetch('/api/ai/extract-url', {
            method: 'POST',
            body: JSON.stringify({ url })
        });
        return result;
    } catch (e) {
        showToast(e.message, 'error');
        return null;
    }
}

// ====== AI: CHAT ======
async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    if (!message || state.isProcessing) return;

    state.isProcessing = true;
    input.value = '';

    // Add user message
    addChatMessage(message, 'user');

    // Show thinking
    const thinkingId = addThinkingMessage();

    try {
        const noteContext = state.chatContext
            ? (state.notes.find(n => n.id === state.chatContext)?.content || '')
            : '';

        const result = await apiFetch('/api/ai/chat', {
            method: 'POST',
            body: JSON.stringify({
                message,
                noteContext: noteContext.substring(0, 4000),
                language: state.language
            })
        });

        // Remove thinking
        document.getElementById(thinkingId)?.remove();

        addChatMessage(result.reply, 'bot');
    } catch (e) {
        document.getElementById(thinkingId)?.remove();
        addChatMessage('Sorry, I encountered an error. Please try again.', 'bot');
        showToast(e.message, 'error');
    } finally {
        state.isProcessing = false;
    }
}

function addChatMessage(content, type) {
    const container = document.getElementById('chatMessages');
    const id = 'msg-' + Date.now();
    const msg = document.createElement('div');
    msg.className = `chat-msg ${type}`;
    msg.id = id;
    msg.innerHTML = `
        <div class="msg-avatar"><i class="fas ${type === 'user' ? 'fa-user' : 'fa-robot'}"></i></div>
        <div class="msg-content">${formatChatMessage(content)}</div>
    `;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
    return id;
}

function addThinkingMessage() {
    const container = document.getElementById('chatMessages');
    const id = 'thinking-' + Date.now();
    const msg = document.createElement('div');
    msg.className = 'chat-msg bot';
    msg.id = id;
    msg.innerHTML = `
        <div class="msg-avatar"><i class="fas fa-robot"></i></div>
        <div class="msg-content">
            <div class="thinking-dots">
                <span></span><span></span><span></span>
            </div>
        </div>
    `;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
    return id;
}

function formatChatMessage(text) {
    return text
        .split('\n')
        .map(line => {
            if (line.trim() === '') return '';
            if (line.trim().startsWith('-') || line.trim().startsWith('*')) {
                return `<li>${escapeHtml(line.replace(/^[\s]*[-*]\s*/, ''))}</li>`;
            }
            if (/^\d+\./.test(line.trim())) {
                return `<li>${escapeHtml(line.replace(/^\s*\d+\.\s*/, ''))}</li>`;
            }
            return `<p>${escapeHtml(line)}</p>`;
        })
        .join('');
}

// ====== UPLOAD HANDLING ======
function openUploadModal() {
    document.getElementById('uploadModal').classList.add('active');
    populateFolderSelect();
}

async function handleSubmitUpload() {
    const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab;

    let title = '';
    let content = '';
    let sourceType = 'text';
    let source = '';

    if (activeTab === 'link') {
        const url = document.getElementById('linkInput').value.trim();
        if (!url) { showToast('Please enter a URL', 'error'); return; }

        title = document.getElementById('linkTitle').value.trim() || 'Notes from Link';
        sourceType = detectSourceType(url);
        source = url;

        showToast('Extracting content from link...', 'info');
        const extracted = await extractFromUrl(url);
        content = extracted?.extractedContent || `Source URL: ${url}\n\nContent will be available after AI processing.`;
        if (extracted?.title) title = extracted.title;

    } else if (activeTab === 'text') {
        content = document.getElementById('textInput').value.trim();
        if (!content) { showToast('Please enter some notes', 'error'); return; }
        title = document.getElementById('textTitle').value.trim() || 'My Notes';
        sourceType = 'text';

    } else if (activeTab === 'file') {
        const files = document.getElementById('fileInput').files;
        if (files.length === 0) { showToast('Please select a file', 'error'); return; }

        // For simplicity, read first file as text
        const file = files[0];
        title = file.name.replace(/\.[^/.]+$/, '') || 'File Notes';
        sourceType = 'file';
        content = await file.text();
    }

    const folderId = document.getElementById('uploadFolder').value || null;
    const language = document.getElementById('uploadLang').value;

    const note = await createNote({
        title: title.substring(0, 200),
        content: content.substring(0, 50000),
        source,
        sourceType,
        folderId,
        language
    });

    if (note) {
        document.getElementById('uploadModal').classList.remove('active');
        // Clear inputs
        document.getElementById('linkInput').value = '';
        document.getElementById('linkTitle').value = '';
        document.getElementById('textInput').value = '';
        document.getElementById('textTitle').value = '';
        document.getElementById('fileInput').value = '';
        document.getElementById('fileList').innerHTML = '';

        // Notify user to summarize manually
        showToast('Note added! Click on it to summarize with AI ✨', 'success');
    }
}

function detectSourceType(url) {
    url = url.toLowerCase();
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    if (url.includes('drive.google.com')) return 'google drive';
    if (url.includes('canva.com')) return 'canva';
    if (url.includes('.pdf')) return 'pdf';
    return 'link';
}

// ====== FILE DRAG & DROP ======
function setupFileDrop() {
    const zone = document.getElementById('fileDropZone');
    const input = document.getElementById('fileInput');

    zone.addEventListener('click', () => input.click());

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
        if (e.dataTransfer.files.length) {
            input.files = e.dataTransfer.files;
            handleFiles(e.dataTransfer.files);
        }
    });

    input.addEventListener('change', () => {
        if (input.files.length) handleFiles(input.files);
    });
}

function handleFiles(files) {
    const list = document.getElementById('fileList');
    list.innerHTML = '';
    for (const file of files) {
        list.innerHTML += `<div style="padding:8px;font-size:13px;color:var(--text-secondary);">
            <i class="fas fa-file"></i> ${escapeHtml(file.name)} (${(file.size / 1024).toFixed(1)} KB)
        </div>`;
    }
}

// ====== UTILITY ======
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ====== INITIALIZATION ======
function init() {
    createParticles();

    // Load data
    loadFolders();
    loadNotes();

    // Sidebar toggle
    document.getElementById('collapseBtn').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('collapsed');
    });

    document.getElementById('hamburger').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
    });

    // Search
    document.getElementById('searchNotes').addEventListener('input', filterNotes);

    // Upload
    document.getElementById('uploadBtn').addEventListener('click', openUploadModal);
    document.getElementById('emptyUploadBtn').addEventListener('click', openUploadModal);
    document.getElementById('submitUpload').addEventListener('click', handleSubmitUpload);

    // Upload tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
        });
    });

    // File drop
    setupFileDrop();

    // Folder creation
    document.getElementById('addFolderBtn').addEventListener('click', () => {
        document.getElementById('folderModal').classList.add('active');
        document.getElementById('folderNameInput').value = '';
        document.getElementById('folderNameInput').focus();
    });

    document.getElementById('createFolderBtn').addEventListener('click', async () => {
        const name = document.getElementById('folderNameInput').value.trim();
        if (!name) { showToast('Please enter a folder name', 'error'); return; }
        await createFolder(name);
        document.getElementById('folderModal').classList.remove('active');
    });

    // Note modal
    document.getElementById('summarizeBtn').addEventListener('click', summarizeNote);
    document.getElementById('translateBtn').addEventListener('click', translateNote);

    document.getElementById('deleteNoteBtn').addEventListener('click', async () => {
        if (!currentNoteDetail) return;
        if (confirm(`Delete "${currentNoteDetail.title}"?`)) {
            await deleteNote(currentNoteDetail.id);
            document.getElementById('noteModal').classList.remove('active');
            currentNoteDetail = null;
        }
    });

    // Chat
    document.getElementById('sendBtn').addEventListener('click', sendChatMessage);
    document.getElementById('chatInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChatMessage();
        }
    });

    // Auto-resize chat input
    document.getElementById('chatInput').addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });

    document.getElementById('toggleChat').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleChatPanel();
    });

    // Click on collapsed chat panel to expand it
    document.getElementById('chatPanel').addEventListener('click', (e) => {
        if (document.getElementById('chatPanel').classList.contains('collapsed') && !e.target.closest('.icon-btn')) {
            toggleChatPanel();
        }
    });

    function toggleChatPanel() {
        const panel = document.getElementById('chatPanel');
        const main = document.getElementById('mainContent');
        const isCollapsed = panel.classList.toggle('collapsed');
        // Directly set margin-right to ensure it works
        main.style.marginRight = isCollapsed ? '0' : 'var(--chat-width)';
        // Update toggle icon
        const icon = document.querySelector('#toggleChat i');
        if (icon) {
            icon.className = isCollapsed ? 'fas fa-chevron-left' : 'fas fa-chevron-down';
        }
    }

    document.getElementById('clearChat').addEventListener('click', () => {
        const container = document.getElementById('chatMessages');
        container.innerHTML = `
            <div class="chat-msg bot">
                <div class="msg-avatar"><i class="fas fa-robot"></i></div>
                <div class="msg-content">
                    <p>Hello! I'm your AI study assistant. 👋</p>
                    <p>Ask me anything about your notes or any topic you're learning!</p>
                </div>
            </div>
        `;
        state.chatContext = null;
        document.getElementById('chatNoteContext').style.display = 'none';
    });

    document.getElementById('clearContext').addEventListener('click', () => {
        state.chatContext = null;
        document.getElementById('chatNoteContext').style.display = 'none';
    });

    // Global language
    document.getElementById('globalLang').addEventListener('change', (e) => {
        state.language = e.target.value;
        document.getElementById('uploadLang').value = e.target.value;
        showToast(`Language set to ${e.target.options[e.target.selectedIndex].text}`, 'info');
    });

    // Close modals
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.classList.remove('active');
        });
    });

    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal-overlay').classList.remove('active');
        });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
        }
    });

    // Quick actions
    document.getElementById('showAllNotes').addEventListener('click', () => {
        state.currentFolder = 'all';
        document.getElementById('searchNotes').value = '';
        renderFolders();
        filterNotes();
        updatePageTitle();
    });

    document.getElementById('showRecentNotes').addEventListener('click', () => {
        state.currentFolder = 'all';
        document.getElementById('searchNotes').value = '';
        renderFolders();
        // Sort by creation date descending
        const sorted = [...state.notes].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        renderNotes(sorted);
        updatePageTitle();
    });

    // Set initial main content margin
    document.getElementById('mainContent').style.marginRight = 'var(--chat-width)';

    console.log('NoteWise AI initialized! 🚀');
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
