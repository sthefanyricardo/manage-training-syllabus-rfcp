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

// Load progress from localStorage
const loadProgress = () => {
    const progress = localStorage.getItem('rfcpProgressv2');
    return progress ? JSON.parse(progress) : { completedIds: [], completionDates: {} };
};

// Save progress to localStorage
const saveProgress = (completedIds, completionDates) => {
    localStorage.setItem('rfcpProgressv2', JSON.stringify({ completedIds, completionDates }));
};

// Update progress display (protegido contra divisão por zero) — textos em PT-BR com pluralização
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

    document.querySelector('.preferences p').innerHTML =
        `<span id="completed-count">${completedCount}</span> / <span id="total-count">${totalCount}</span> ${concluido} · 
         <span id="completed-time">${completedTime}</span> / <span id="total-time">${totalTime}</span> minutos`;
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
    // First filter by category
    let filtered = objectives;
    if (filter === 'completed') filtered = objectives.filter(obj => completedIds.includes(obj.id));
    else if (filter === 'unfinished') filtered = objectives.filter(obj => !completedIds.includes(obj.id));
    else if (filter !== 'all') filtered = objectives.filter(obj => obj.type === filter);

    // Then filter by search term if provided
    if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(obj => obj.name.toLowerCase().includes(term) || obj.id.toLowerCase().includes(term));
    }

    return filtered;
};

// Generate contribution grid for the last 30 days (tooltip custom em PT-BR)
const generateContributionGrid = (completionDates) => {
    const gridContainer = document.getElementById('contribution-grid');
    if (!gridContainer) return;

    gridContainer.innerHTML = '';

    // Get dates for the last 30 days
    const today = new Date();
    const dates = [];

    for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        date.setHours(0, 0, 0, 0);
        dates.push(date);
    }

    // Count completions per day
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

    // Create grid cells with data-attributes for custom tooltip
    dates.forEach(date => {
        const dateKey = date.toISOString().split('T')[0];
        const count = completionsPerDay[dateKey] || 0;

        const cell = document.createElement('div');
        cell.className = 'contribution-cell';
        cell.setAttribute('tabindex', '0');

        // Add level class based on count
        if (count >= 10) {
            cell.classList.add('level-4');
        } else if (count >= 7) {
            cell.classList.add('level-3');
        } else if (count >= 4) {
            cell.classList.add('level-2');
        } else if (count >= 1) {
            cell.classList.add('level-1');
        }

        // Add data-attributes for custom tooltip (PT-BR)
        const plural = count === 1 ? 'objetivo concluído' : 'objetivos concluídos';
        cell.dataset.date = date.toLocaleDateString('pt-BR');
        cell.dataset.count = count;
        cell.setAttribute('aria-label', `${date.toLocaleDateString('pt-BR')}: ${count} ${plural}`);

        gridContainer.appendChild(cell);
    });

    // Add custom tooltip functionality
    setupContributionTooltip();
};

// Setup custom tooltip for contribution grid
const setupContributionTooltip = () => {
    const gridContainer = document.getElementById('contribution-grid');
    if (!gridContainer) return;

    // Remove existing tooltip if any
    const existingTooltip = document.querySelector('.contribution-tooltip');
    if (existingTooltip) {
        existingTooltip.remove();
    }

    // Create tooltip element
    const tooltip = document.createElement('div');
    tooltip.className = 'contribution-tooltip';
    document.body.appendChild(tooltip);

    const showTooltip = (cell, event) => {
        const date = cell.dataset.date;
        const count = parseInt(cell.dataset.count, 10);
        const plural = count === 1 ? 'objetivo concluído' : 'objetivos concluídos';
        tooltip.textContent = `${date}: ${count} ${plural}`;
        tooltip.style.opacity = '1';

        // Position tooltip
        const rect = cell.getBoundingClientRect();
        tooltip.style.left = `${rect.left + window.scrollX + rect.width / 2 - tooltip.offsetWidth / 2}px`;
        tooltip.style.top = `${rect.top + window.scrollY - tooltip.offsetHeight - 8}px`;
    };

    const hideTooltip = () => {
        tooltip.style.opacity = '0';
    };

    // Add event listeners to cells
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

// Initialize app
const initApp = async () => {
    const objectives = await loadObjectives();
    let { completedIds, completionDates } = loadProgress();
    const objectivesList = document.getElementById('objectives-list');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const searchInput = document.getElementById('search-input');
    let currentFilter = 'all';
    let currentSearch = '';

    // Show error banner if loading failed
    if (loadError) {
        showErrorBanner();
    }

    // Setup error banner close button
    setupErrorBannerClose();

    // Se não houver objetivos, mostra mensagem e desabilita filtros/busca
    if (!objectives || objectives.length === 0) {
        if (objectivesList) {
            objectivesList.innerHTML = '<p style="color:#666">Nenhum objetivo carregado. Verifique o arquivo <code>src/data/syllabus_rfcp.json</code> no repositório.</p>';
        }
        if (searchInput) searchInput.disabled = true;
        filterButtons.forEach(b => b.disabled = true);

        // Atualiza progress com zeros e retorna
        updateProgress(completedIds, 0, []);
        generateContributionGrid(completionDates);
        return;
    }

    // Update progress display with objectives data
    updateProgress(completedIds, objectives.length, objectives);

    // Generate contribution grid
    generateContributionGrid(completionDates);

    // Render objectives
    const renderObjectives = (filter, search = '') => {
        const filteredObjectives = filterObjectives(objectives, filter, completedIds, search);
        objectivesList.innerHTML = '';

        filteredObjectives.forEach(objective => {
            const isCompleted = completedIds.includes(objective.id);
            const card = createObjectiveCard(objective, isCompleted);
            objectivesList.appendChild(card);
        });
    };

    // Handle filter clicks
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderObjectives(currentFilter, currentSearch);
        });
    });

    // Handle search input
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentSearch = e.target.value;
            renderObjectives(currentFilter, currentSearch);
        });
    }

    // Handle objective clicks (toggle conclusão)
    objectivesList.addEventListener('click', (e) => {
        const card = e.target.closest('.objective-card');
        if (!card || e.target.classList.contains('objective-link')) return;

        const objectiveId = card.dataset.id;
        const index = completedIds.indexOf(objectiveId);
        const wasCompleted = index !== -1;

        if (!wasCompleted) {
            completedIds.push(objectiveId);
            completionDates[objectiveId] = new Date().toISOString();
            card.classList.add('completed');

            // Trigger confetti effect at the click position
            if (window.confetti) {
                window.confetti.burst(e.clientX, e.clientY);
            }
        } else {
            completedIds.splice(index, 1);
            delete completionDates[objectiveId];
            card.classList.remove('completed');
        }

        // Atualiza texto do botão de marcar/mostrar estado e aria-pressed
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

        saveProgress(completedIds, completionDates);
        updateProgress(completedIds, objectives.length, objectives);
        generateContributionGrid(completionDates); // Update the contribution grid
        renderObjectives(currentFilter, currentSearch); // Re-render com filtro atual e busca
    });

    // Setup export/import/reset/demo buttons
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

    // Initial render
    renderObjectives(currentFilter);
};

// Show error banner
const showErrorBanner = () => {
    const banner = document.getElementById('error-banner');
    if (banner) {
        banner.hidden = false;
    }
};

// Hide error banner
const hideErrorBanner = () => {
    const banner = document.getElementById('error-banner');
    if (banner) {
        banner.hidden = true;
    }
};

// Setup error banner close button
const setupErrorBannerClose = () => {
    const closeBtn = document.getElementById('error-banner-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', hideErrorBanner);
    }
};

// Export progress to JSON file
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

// Import progress from JSON file
const importProgress = (file, onUpdate) => {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            // Validate format
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

// Reset progress
const resetProgress = (onUpdate) => {
    if (confirm('Tem certeza que deseja resetar todo o progresso? Esta ação não pode ser desfeita.')) {
        saveProgress([], {});
        if (onUpdate) onUpdate();
        alert('Progresso resetado com sucesso!');
    }
};

// Generate random date within last 30 days (for demo)
const getRandomDate = () => {
    const today = new Date();
    const daysAgo = Math.floor(Math.random() * 30);
    const date = new Date(today);
    date.setDate(today.getDate() - daysAgo);
    return date.toISOString();
};

// Populate demo progress
const populateDemo = (objectives, onUpdate) => {
    if (confirm('Isto irá substituir seu progresso atual com dados de demonstração. Continuar?')) {
        const completedIds = [];
        const completionDates = {};
        
        // Randomly complete 50-80% of objectives
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

/**
 * Finds an element using multiple strategies for robustness across different HTML versions.
 * Tries IDs first, then data-action attribute, then class + text content.
 * @param {Object} options - Search options
 * @param {string[]} options.ids - Array of possible IDs to search
 * @param {string} options.dataAction - Value for data-action attribute fallback
 * @param {string[]} options.textMatches - Array of text patterns to match in button text (case-insensitive)
 * @param {string} options.elementType - Element type for logging (e.g., 'export', 'import')
 * @returns {HTMLElement|null} - Found element or null
 */
const findElement = ({ ids = [], dataAction = '', textMatches = [], elementType = 'unknown' }) => {
    // Strategy 1: Try all possible IDs
    for (const id of ids) {
        const el = document.getElementById(id);
        if (el) {
            return el;
        }
    }

    // Strategy 2: Try data-action attribute
    if (dataAction) {
        const el = document.querySelector(`[data-action="${dataAction}"]`);
        if (el) {
            return el;
        }
    }

    // Strategy 3: Try finding by class and text content
    if (textMatches.length > 0) {
        const buttons = document.querySelectorAll('button.action-btn');
        for (const btn of buttons) {
            const btnText = btn.textContent.toLowerCase().trim();
            for (const textMatch of textMatches) {
                if (btnText.includes(textMatch.toLowerCase())) {
                    return btn;
                }
            }
        }
    }

    // Log warning if element not found
    console.warn(
        `[RFCP] Elemento "${elementType}" não encontrado. ` +
        `Verifique se o HTML contém um dos seguintes IDs: ${ids.join(', ')} ` +
        `ou data-action="${dataAction}" ou um botão com classe "action-btn" contendo texto: ${textMatches.join(', ')}`
    );
    return null;
};

/**
 * Finds the file input element for import, or creates one dynamically if not found.
 * @param {HTMLElement} importButton - The import button element to attach the input to
 * @returns {HTMLInputElement|null} - The file input element or null
 */
const findOrCreateFileInput = (importButton) => {
    // Strategy 1: Try known IDs
    const knownIds = ['import-file', 'import-input', 'file-input', 'btn-import-file'];
    for (const id of knownIds) {
        const el = document.getElementById(id);
        if (el) {
            return el;
        }
    }

    // Strategy 2: Try data-action
    let el = document.querySelector('[data-action="import-file"]');
    if (el) {
        return el;
    }

    // Strategy 3: Try finding input[type="file"] near the import button
    el = document.querySelector('input[type="file"][accept=".json"]');
    if (el) {
        return el;
    }

    // Strategy 4: Create a dynamic hidden input element
    if (importButton) {
        console.warn(
            '[RFCP] Input de arquivo para importação não encontrado. ' +
            'Criando input dinâmico. Verifique se o HTML contém um input com ID: ' +
            knownIds.join(', ')
        );
        const dynamicInput = document.createElement('input');
        dynamicInput.type = 'file';
        dynamicInput.accept = '.json';
        dynamicInput.hidden = true;
        dynamicInput.setAttribute('aria-hidden', 'true');
        dynamicInput.id = 'import-file-dynamic';
        importButton.parentNode.insertBefore(dynamicInput, importButton.nextSibling);
        return dynamicInput;
    }

    console.warn(
        '[RFCP] Input de arquivo para importação não encontrado e não foi possível criar dinamicamente. ' +
        'Verifique o HTML.'
    );
    return null;
};

// Setup progress action buttons
const setupProgressActions = (objectives, completedIds, completionDates, onUpdate) => {
    // Find export button with fallbacks
    const btnExport = findElement({
        ids: ['btn-export', 'export-btn', 'exportBtn', 'export-progress'],
        dataAction: 'export',
        textMatches: ['export', 'exportar'],
        elementType: 'botão de exportar'
    });

    // Find import button with fallbacks
    const btnImport = findElement({
        ids: ['btn-import', 'import-btn', 'importBtn', 'import-progress'],
        dataAction: 'import',
        textMatches: ['import', 'importar'],
        elementType: 'botão de importar'
    });

    // Find or create file input for import
    const importFile = findOrCreateFileInput(btnImport);

    // Find reset button with fallbacks
    const btnReset = findElement({
        ids: ['btn-reset', 'reset-btn', 'resetBtn', 'reset-progress'],
        dataAction: 'reset',
        textMatches: ['reset', 'resetar', 'limpar'],
        elementType: 'botão de resetar'
    });

    // Find demo/seed button with fallbacks
    const btnDemo = findElement({
        ids: ['btn-demo', 'demo-btn', 'demoBtn', 'seed-btn', 'populate-demo', 'populate-btn'],
        dataAction: 'demo',
        textMatches: ['demo', 'popular', 'seed'],
        elementType: 'botão de popular demo'
    });

    if (btnExport) {
        btnExport.addEventListener('click', exportProgress);
    }

    if (btnImport && importFile) {
        btnImport.addEventListener('click', () => importFile.click());
        importFile.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                importProgress(e.target.files[0], onUpdate);
                e.target.value = ''; // Reset input
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
