// ============================================
// RFCP Tracker - main.js com Sincronização
// ============================================

// ✅ NOVA VARIÁVEL: Instância do SyncManager
let syncManager = null;

// Load RFCP data (mais robusto: lê como texto e faz JSON.parse com try/catch)
let loadError = false;

// Constants
const MAX_LOG_CHARS = 1000;
const DEMO_MIN_COMPLETION_RATE = 0.5;
const DEMO_COMPLETION_RANGE = 0.3;

const loadObjectives = async () => {
    try {
        const response = await fetch('src/data/syllabus_rfcp.json');
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const text = await response.text();
        try {
            const data = JSON.parse(text);
            if (!data || !Array.isArray(data.lessons)) {
                console.error('Arquivo JSON carregado, mas não contém "lessons".');
                loadError = true;
                return [];
            }
            return data.lessons || [];
        } catch (parseErr) {
            console.error('Erro ao parsear src/data/syllabus_rfcp.json:', parseErr);
            console.error('Conteúdo parcial do arquivo (primeiros ' + MAX_LOG_CHARS + ' chars):', text.slice(0, MAX_LOG_CHARS));
            loadError = true;
            return [];
        }
    } catch (error) {
        console.error('Error loading objectives:', error);
        loadError = true;
        return [];
    }
};

// ✅ MODIFICADO: Load progress com sincronização
const loadProgress = async () => {
    const localProgress = localStorage.getItem('rfcpProgressv2');
    const local = localProgress ? JSON.parse(localProgress) : { completedIds: [], completionDates: {} };
    
    // NOVO: Tentar sincronizar se habilitado
    if (syncManager && syncManager.syncEnabled) {
        try {
            console.log('🔄 Sincronizando progresso...');
            const synced = await syncManager.sync(local);
            saveProgress(synced.completedIds, synced.completionDates);
            updateSyncStatus(true, 'Sincronizado');
            return synced;
        } catch (error) {
            console.error('❌ Erro na sincronização:', error);
            showSyncError('Erro ao sincronizar. Usando dados locais.');
            updateSyncStatus(false, 'Erro na sincronização');
            return local;
        }
    }
    
    return local;
};

// ✅ MODIFICADO: Save progress com sincronização
const saveProgress = async (completedIds, completionDates) => {
    const data = { completedIds, completionDates };
    localStorage.setItem('rfcpProgressv2', JSON.stringify(data));
    
    // NOVO: Sincronizar em background se habilitado
    if (syncManager && syncManager.syncEnabled) {
        try {
            await syncManager.saveRemoteProgress(data);
            updateSyncStatus(true, 'Sincronizado');
        } catch (error) {
            console.error('❌ Erro ao sincronizar:', error);
            updateSyncStatus(false, 'Erro na sincronização');
        }
    }
};

// ✅ NOVA FUNÇÃO: Mostrar erro de sincronização
const showSyncError = (message) => {
    const existingAlert = document.querySelector('.sync-alert');
    if (existingAlert) existingAlert.remove();
    
    const alert = document.createElement('div');
    alert.className = 'sync-alert sync-alert-error';
    alert.innerHTML = `
        <span>⚠️ ${message}</span>
        <button onclick="this.parentElement.remove()" aria-label="Fechar alerta">×</button>
    `;
    
    const header = document.querySelector('header');
    if (header) {
        header.after(alert);
        setTimeout(() => alert.remove(), 5000);
    }
};

// ✅ NOVA FUNÇÃO: Atualizar status de sincronização na UI
const updateSyncStatus = (success, message = '') => {
    const statusEl = document.getElementById('sync-status');
    if (!statusEl) return;
    
    if (success) {
        statusEl.innerHTML = `✓ ${message || 'Sincronizado'}`;
        statusEl.className = 'sync-status success';
    } else {
        statusEl.innerHTML = `✗ ${message || 'Erro'}`;
        statusEl.className = 'sync-status error';
    }
    
    setTimeout(() => {
        statusEl.innerHTML = '';
    }, 3000);
};

// ✅ MODIFICADO: Update progress com indicador de sync
const updateProgress = (completedIds, totalCount, objectives) => {
    const completedCount = completedIds.length;
    document.getElementById('completed-count').textContent = completedCount;
    document.getElementById('total-count').textContent = totalCount;

    const progressBar = document.getElementById('progress');
    const progressPercentage = totalCount === 0 ? 0 : (completedCount / totalCount) * 100;
    const rounded = Number.isFinite(progressPercentage) ? Math.round(progressPercentage) : 0;

    progressBar.style.width = `${rounded}%`;
    progressBar.textContent = `${rounded}%`;

    // Calculate total time from objectives data
    let totalTime = 0;
    let completedTime = 0;

    objectives.forEach(objective => {
        const t = Number(objective.time_min) || 0;
        totalTime += t;
        if (completedIds.includes(objective.id)) {
            completedTime += t;
        }
    });

    // Pluralização correta em PT-BR
    const concluido = completedCount === 1 ? 'concluído' : 'concluídos';

    // ✅ MODIFICADO: Adicionar span de sync-status
    document.querySelector('.preferences p').innerHTML =
        `<span id="completed-count">${completedCount}</span> / <span id="total-count">${totalCount}</span> ${concluido} · 
         <span id="completed-time">${completedTime}</span> / <span id="total-time">${totalTime}</span> minutos
         <span id="sync-status" class="sync-status"></span>`;
};

// Create objective card (texto em PT-BR) with accessibility attributes
const createObjectiveCard = (objective, isCompleted) => {
    const card = document.createElement('div');
    card.className = `objective-card${isCompleted ? ' completed' : ''}`;
    card.dataset.id = objective.id;

    const completedText = isCompleted ? 'Concluído' : 'Marcar como concluído';
    const ariaPressed = isCompleted ? 'true' : 'false';

    card.innerHTML = `
        <div class="objective-header">
            <div class="type-id-container">
                <span class="objective-type type-${objective.type}">${objective.type}</span>
                <span class="objective-id">${objective.id}</span>
            </div>
            <span class="objective-time">${objective.time_min} min</span>
        </div>
        <h3 class="objective-name">${objective.name}</h3>
        <div class="objective-actions">
            <a href="${objective.url}" class="objective-link" target="_blank" rel="noopener">Ver detalhes</a>
            <button class="mark-complete-btn" aria-pressed="${ariaPressed}" aria-label="${completedText} - ${objective.name}">${completedText}</button>
        </div>
        <button class="complete-button" aria-label="Alternar conclusão para ${objective.name}" aria-pressed="${ariaPressed}">
            ✓
        </button>
    `;

    return card;
};

// Filter objectives
const filterObjectives = (objectives, filter = 'all', completedIds = [], searchTerm = '') => {
    let filtered = objectives;
    if (filter === 'completed') filtered = objectives.filter(obj => completedIds.includes(obj.id));
    else if (filter === 'unfinished') filtered = objectives.filter(obj => !completedIds.includes(obj.id));
    else if (filter !== 'all') filtered = objectives.filter(obj => obj.type === filter);

    if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(obj => obj.name.toLowerCase().includes(term) || obj.id.toLowerCase().includes(term));
    }

    return filtered;
};

// Generate contribution grid for the last 30 days
const generateContributionGrid = (completionDates) => {
    const gridContainer = document.getElementById('contribution-grid');
    if (!gridContainer) return;

    gridContainer.innerHTML = '';

    const today = new Date();
    const dates = [];

    for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        date.setHours(0, 0, 0, 0);
        dates.push(date);
    }

    const completionsPerDay = {};

    Object.values(completionDates).forEach(dateString => {
        const date = new Date(dateString);
        date.setHours(0, 0, 0, 0);
        const dateKey = date.toISOString().split('T')[0];

        if (completionsPerDay[dateKey]) {
            completionsPerDay[dateKey]++;
        } else {
            completionsPerDay[dateKey] = 1;
        }
    });

    dates.forEach(date => {
        const dateKey = date.toISOString().split('T')[0];
        const count = completionsPerDay[dateKey] || 0;

        const cell = document.createElement('div');
        cell.className = 'contribution-cell';
        cell.setAttribute('tabindex', '0');

        if (count >= 10) {
            cell.classList.add('level-4');
        } else if (count >= 7) {
            cell.classList.add('level-3');
        } else if (count >= 4) {
            cell.classList.add('level-2');
        } else if (count >= 1) {
            cell.classList.add('level-1');
        }

        const plural = count === 1 ? 'objetivo concluído' : 'objetivos concluídos';
        cell.dataset.date = date.toLocaleDateString('pt-BR');
        cell.dataset.count = count;
        cell.setAttribute('aria-label', `${date.toLocaleDateString('pt-BR')}: ${count} ${plural}`);

        gridContainer.appendChild(cell);
    });

    setupContributionTooltip();
};

// Setup custom tooltip for contribution grid
const setupContributionTooltip = () => {
    const gridContainer = document.getElementById('contribution-grid');
    if (!gridContainer) return;

    const existingTooltip = document.querySelector('.contribution-tooltip');
    if (existingTooltip) {
        existingTooltip.remove();
    }

    const tooltip = document.createElement('div');
    tooltip.className = 'contribution-tooltip';
    document.body.appendChild(tooltip);

    const showTooltip = (cell, event) => {
        const date = cell.dataset.date;
        const count = parseInt(cell.dataset.count, 10);
        const plural = count === 1 ? 'objetivo concluído' : 'objetivos concluídos';
        tooltip.textContent = `${date}: ${count} ${plural}`;
        tooltip.style.opacity = '1';

        const rect = cell.getBoundingClientRect();
        tooltip.style.left = `${rect.left + window.scrollX + rect.width / 2 - tooltip.offsetWidth / 2}px`;
        tooltip.style.top = `${rect.top + window.scrollY - tooltip.offsetHeight - 8}px`;
    };

    const hideTooltip = () => {
        tooltip.style.opacity = '0';
    };

    gridContainer.addEventListener('mouseover', (e) => {
        if (e.target.classList.contains('contribution-cell')) {
            showTooltip(e.target, e);
        }
    });

    gridContainer.addEventListener('mouseout', (e) => {
        if (e.target.classList.contains('contribution-cell')) {
            hideTooltip();
        }
    });

    gridContainer.addEventListener('focusin', (e) => {
        if (e.target.classList.contains('contribution-cell')) {
            showTooltip(e.target, e);
        }
    });

    gridContainer.addEventListener('focusout', (e) => {
        if (e.target.classList.contains('contribution-cell')) {
            hideTooltip();
        }
    });
};

// ✅ NOVA FUNÇÃO: Adicionar botão de sincronização no header
const addSyncButton = () => {
    const header = document.querySelector('header');
    if (!header) return;
    
    // Verificar se já existe
    if (document.querySelector('.sync-button')) return;
    
    const syncButton = document.createElement('a');
    syncButton.href = 'sync-settings.html';
    syncButton.className = 'sync-button';
    syncButton.innerHTML = '⚙️ Sincronização';
    syncButton.style.cssText = `
        display: inline-block;
        margin-top: 15px;
        padding: 10px 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        text-decoration: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        transition: all 0.3s;
        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
    `;
    syncButton.onmouseover = () => {
        syncButton.style.transform = 'translateY(-2px)';
        syncButton.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.4)';
    };
    syncButton.onmouseout = () => {
        syncButton.style.transform = 'translateY(0)';
        syncButton.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.3)';
    };
    
    header.appendChild(syncButton);
};

// ✅ MODIFICADO: Initialize app com sincronização
const initApp = async () => {
    // NOVO: Inicializar Sync Manager
    if (window.SyncManager) {
        syncManager = new window.SyncManager();
        console.log('✅ SyncManager inicializado');
    } else {
        console.warn('⚠️ SyncManager não encontrado. Sincronização desabilitada.');
    }
    
    const objectives = await loadObjectives();
    let { completedIds, completionDates } = await loadProgress(); // ✅ agora é async
    const objectivesList = document.getElementById('objectives-list');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const searchInput = document.getElementById('search-input');
    let currentFilter = 'all';
    let currentSearch = '';

    // Show error banner if loading failed
    if (loadError) {
        showErrorBanner();
    }

    setupErrorBannerClose();

    if (!objectives || objectives.length === 0) {
        if (objectivesList) {
            objectivesList.innerHTML = '<p style="color:#666">Nenhum objetivo carregado. Verifique o arquivo <code>src/data/syllabus_rfcp.json</code> no repositório.</p>';
        }
        if (searchInput) searchInput.disabled = true;
        filterButtons.forEach(b => b.disabled = true);

        updateProgress(completedIds, 0, []);
        generateContributionGrid(completionDates);
        return;
    }

    // ✅ NOVO: Adicionar botão de sincronização
    addSyncButton();

    updateProgress(completedIds, objectives.length, objectives);
    generateContributionGrid(completionDates);

    const renderObjectives = (filter, search = '') => {
        const filteredObjectives = filterObjectives(objectives, filter, completedIds, search);
        objectivesList.innerHTML = '';

        filteredObjectives.forEach(objective => {
            const isCompleted = completedIds.includes(objective.id);
            const card = createObjectiveCard(objective, isCompleted);
            objectivesList.appendChild(card);
        });
    };

    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderObjectives(currentFilter, currentSearch);
        });
    });

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentSearch = e.target.value;
            renderObjectives(currentFilter, currentSearch);
        });
    }

    // ✅ MODIFICADO: Handle objective clicks com await
    objectivesList.addEventListener('click', async (e) => { // ✅ adicionar async
        const card = e.target.closest('.objective-card');
        if (!card || e.target.classList.contains('objective-link')) return;

        const objectiveId = card.dataset.id;
        const index = completedIds.indexOf(objectiveId);
        const wasCompleted = index !== -1;

        if (!wasCompleted) {
            completedIds.push(objectiveId);
            completionDates[objectiveId] = new Date().toISOString();
            card.classList.add('completed');

            if (window.confetti) {
                window.confetti.burst(e.clientX, e.clientY);
            }
        } else {
            completedIds.splice(index, 1);
            delete completionDates[objectiveId];
            card.classList.remove('completed');
        }

        const markBtn = card.querySelector('.mark-complete-btn');
        const completeBtn = card.querySelector('.complete-button');
        const newState = !wasCompleted;
        if (markBtn) {
            markBtn.textContent = newState ? 'Concluído' : 'Marcar como concluído';
            markBtn.setAttribute('aria-pressed', newState ? 'true' : 'false');
        }
        if (completeBtn) {
            completeBtn.setAttribute('aria-pressed', newState ? 'true' : 'false');
        }

        await saveProgress(completedIds, completionDates); // ✅ adicionar await
        updateProgress(completedIds, objectives.length, objectives);
        generateContributionGrid(completionDates);
        renderObjectives(currentFilter, currentSearch);
    });

    setupProgressActions(objectives, completedIds, completionDates, () => {
        const progress = loadProgress();
        completedIds.length = 0;
        completedIds.push(...progress.completedIds);
        Object.keys(completionDates).forEach(key => delete completionDates[key]);
        Object.assign(completionDates, progress.completionDates);
        updateProgress(completedIds, objectives.length, objectives);
        generateContributionGrid(completionDates);
        renderObjectives(currentFilter, currentSearch);
    });

    renderObjectives(currentFilter);
};

// Show/hide error banner
const showErrorBanner = () => {
    const banner = document.getElementById('error-banner');
    if (banner) banner.hidden = false;
};

const hideErrorBanner = () => {
    const banner = document.getElementById('error-banner');
    if (banner) banner.hidden = true;
};

const setupErrorBannerClose = () => {
    const closeBtn = document.getElementById('error-banner-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', hideErrorBanner);
    }
};

// Export/Import/Reset/Demo functions (mantidas sem alteração)
const exportProgress = () => {
    const progress = loadProgress();
    const dataStr = JSON.stringify(progress, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'rfcp-progresso.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

const importProgress = (file, onUpdate) => {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (!data || !Array.isArray(data.completedIds) || typeof data.completionDates !== 'object') {
                alert('Formato de arquivo inválido. O arquivo deve conter "completedIds" (array) e "completionDates" (objeto).');
                return;
            }
            saveProgress(data.completedIds, data.completionDates);
            if (onUpdate) onUpdate();
            alert('Progresso importado com sucesso!');
        } catch (err) {
            console.error('Erro ao importar progresso:', err);
            alert('Erro ao importar arquivo. Verifique se é um JSON válido.');
        }
    };
    reader.readAsText(file);
};

const resetProgress = async (onUpdate) => { // Adicionar async
    if (confirm('Tem certeza que deseja resetar todo o progresso?')) {
        await saveProgress([], {}); // Adicionar await
        if (onUpdate) onUpdate();
        alert('Progresso resetado com sucesso!');
    }
};

const getRandomDate = () => {
    const today = new Date();
    const daysAgo = Math.floor(Math.random() * 30);
    const date = new Date(today);
    date.setDate(today.getDate() - daysAgo);
    return date.toISOString();
};

const populateDemo = (objectives, onUpdate) => {
    if (confirm('Isto irá substituir seu progresso atual com dados de demonstração. Continuar?')) {
        const completedIds = [];
        const completionDates = {};
        
        const totalToComplete = Math.floor(objectives.length * (DEMO_MIN_COMPLETION_RATE + Math.random() * DEMO_COMPLETION_RANGE));
        const shuffled = [...objectives].sort(() => 0.5 - Math.random());
        const selectedObjectives = shuffled.slice(0, totalToComplete);

        selectedObjectives.forEach(obj => {
            completedIds.push(obj.id);
            completionDates[obj.id] = getRandomDate();
        });

        saveProgress(completedIds, completionDates);
        if (onUpdate) onUpdate();
        alert(`Demo populado com ${totalToComplete} objetivos concluídos!`);
    }
};

const findElement = (idCandidates, dataActionValue, textKeywords, tagName = 'button') => {
    for (const id of idCandidates) {
        const el = document.getElementById(id);
        if (el) return el;
    }

    if (dataActionValue) {
        const el = document.querySelector(`[data-action="${dataActionValue}"]`);
        if (el) return el;
    }

    if (textKeywords && textKeywords.length > 0) {
        const elements = document.querySelectorAll(tagName);
        for (const el of elements) {
            const text = el.textContent.toLowerCase().trim();
            if (textKeywords.some(keyword => text.includes(keyword.toLowerCase()))) {
                return el;
            }
        }
    }

    return null;
};

const ensureActionBtnClass = (element) => {
    if (element && !element.classList.contains('action-btn')) {
        element.classList.add('action-btn');
        console.info('Added .action-btn class to element:', element);
    }
};

const setupProgressActions = (objectives, completedIds, completionDates, onUpdate) => {
    const btnExport = findElement(
        ['btn-export', 'export-btn', 'exportBtn', 'export-progress'],
        'export',
        ['exportar', 'export']
    );

    const btnImport = findElement(
        ['btn-import', 'import-btn', 'importBtn', 'import-progress'],
        'import',
        ['importar', 'import']
    );

    let importFile = findElement(
        ['import-file', 'import-input', 'importFile', 'file-input'],
        'import-file',
        null,
        'input[type="file"]'
    );

    if (!importFile && btnImport) {
        importFile = document.createElement('input');
        importFile.type = 'file';
        importFile.id = 'import-file';
        importFile.accept = '.json';
        importFile.hidden = true;
        importFile.setAttribute('aria-hidden', 'true');
        document.body.appendChild(importFile);
        console.info('Created hidden file input #import-file dynamically');
    }

    const btnReset = findElement(
        ['btn-reset', 'reset-btn', 'resetBtn', 'reset-progress'],
        'reset',
        ['resetar', 'reset', 'limpar']
    );

    const btnDemo = findElement(
        ['btn-demo', 'demo-btn', 'demoBtn', 'populate-demo', 'btn-populate'],
        'demo',
        ['demo', 'popular']
    );

    if (!btnExport) {
        console.warn('Export button not found.');
    } else {
        ensureActionBtnClass(btnExport);
    }

    if (!btnImport) {
        console.warn('Import button not found.');
    } else {
        ensureActionBtnClass(btnImport);
    }

    if (!btnReset) {
        console.warn('Reset button not found.');
    } else {
        ensureActionBtnClass(btnReset);
    }

    if (!btnDemo) {
        console.warn('Demo button not found.');
    } else {
        ensureActionBtnClass(btnDemo);
    }

    if (btnExport) {
        btnExport.addEventListener('click', exportProgress);
    }

    if (btnImport && importFile) {
        btnImport.addEventListener('click', () => importFile.click());
        importFile.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                importProgress(e.target.files[0], onUpdate);
                e.target.value = '';
            }
        });
    } else if (btnImport && !importFile) {
        console.warn('[RFCP] Botão de importar encontrado, mas input de arquivo não disponível.');
    }

    if (btnReset) {
        btnReset.addEventListener('click', () => resetProgress(onUpdate));
    }

    if (btnDemo) {
        btnDemo.addEventListener('click', () => populateDemo(objectives, onUpdate));
    }
};

// Start the app
document.addEventListener('DOMContentLoaded', initApp);