// Load RFCP data (mais robusto: lê como texto e faz JSON.parse com try/catch)
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
                return [];
            }
            return data.lessons || [];
        } catch (parseErr) {
            console.error('Erro ao parsear src/data/syllabus_rfcp.json:', parseErr);
            console.error('Conteúdo parcial do arquivo (primeiros 2000 chars):', text.slice(0, 2000));
            return [];
        }
    } catch (error) {
        console.error('Error loading objectives:', error);
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

// Update progress display (protegido contra divisão por zero) — textos em PT-BR
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

    document.querySelector('.preferences p').innerHTML =
        `<span id="completed-count">${completedCount}</span> / <span id="total-count">${totalCount}</span> concluídos · 
         <span id="completed-time">${completedTime}</span> / <span id="total-time">${totalTime}</span> minutos`;
};

// Create objective card (texto em PT-BR)
const createObjectiveCard = (objective, isCompleted) => {
    const card = document.createElement('div');
    card.className = `objective-card${isCompleted ? ' completed' : ''}`;
    card.dataset.id = objective.id;

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
            <button class="mark-complete-btn">${isCompleted ? 'Concluído' : 'Marcar como concluído'}</button>
        </div>
        <button class="complete-button" aria-label="Alternar conclusão">
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

// Generate contribution grid for the last 30 days (tooltip em PT-BR)
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

    // Create grid cells
    dates.forEach(date => {
        const dateKey = date.toISOString().split('T')[0];
        const count = completionsPerDay[dateKey] || 0;

        const cell = document.createElement('div');
        cell.className = 'contribution-cell';

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

        // Add tooltip data (PT-BR)
        const plural = count === 1 ? 'objetivo' : 'objetivos';
        cell.title = `${date.toLocaleDateString()}: ${count} ${plural} concluídos`;

        gridContainer.appendChild(cell);
    });
};

// Initialize app
const initApp = async () => {
    const objectives = await loadObjectives();
    const { completedIds, completionDates } = loadProgress();
    const objectivesList = document.getElementById('objectives-list');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const searchInput = document.getElementById('search-input');
    let currentFilter = 'all';
    let currentSearch = '';

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

        // Atualiza texto do botão de marcar/mostrar estado
        const markBtn = card.querySelector('.mark-complete-btn');
        if (markBtn) {
            markBtn.textContent = !wasCompleted ? 'Concluído' : 'Marcar como concluído';
        }

        saveProgress(completedIds, completionDates);
        updateProgress(completedIds, objectives.length, objectives);
        generateContributionGrid(completionDates); // Update the contribution grid
        renderObjectives(currentFilter, currentSearch); // Re-render com filtro atual e busca
    });

    // Initial render
    renderObjectives(currentFilter);
};

// Start the app
document.addEventListener('DOMContentLoaded', initApp);
