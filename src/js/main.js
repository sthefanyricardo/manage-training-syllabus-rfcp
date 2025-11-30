/**
 * RFCP Tracker - Sistema de acompanhamento de estudos
 * Gerencia o progresso dos objetivos de aprendizagem RFCP
 * @fileoverview Sistema principal de gerenciamento do tracker RFCP
 * @author Sthefany Ricardo
 * @version 2.0.0
 */

'use strict';

/**
 * Configurações da aplicação
 * @const {Object} CONFIG
 */
const CONFIG = {
  MAX_LOG_CHARS: 1000,
  DEMO_MIN_COMPLETION_RATE: 0.5,
  DEMO_COMPLETION_RANGE: 0.3,
  STORAGE_KEY: 'rfcpProgressv2',
  DATA_FILE: 'src/data/syllabus_rfcp.json',
  CONTRIBUTION_GRID_DAYS: 30,
  CONFETTI_PARTICLES: 50,
  ALERT_TIMEOUT: 5000,
  STATUS_TIMEOUT: 3000
};

/**
 * Utilitários para manipulação de DOM e dados
 */
class Utils {
  /**
   * Busca um elemento DOM por múltiplos seletores
   * @param {string[]} selectors - Lista de seletores CSS
   * @returns {HTMLElement|null}
   */
  static findElement(selectors) {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) return element;
    }
    return null;
  }

  /**
   * Cria um elemento DOM com atributos
   * @param {string} tag - Tag do elemento
   * @param {Object} attributes - Atributos do elemento
   * @param {string} content - Conteúdo HTML interno
   * @returns {HTMLElement}
   */
  static createElement(tag, attributes = {}, content = '') {
    const element = document.createElement(tag);
    Object.entries(attributes).forEach(([key, value]) => {
      if (key === 'className') {
        element.className = value;
      } else if (key === 'dataset') {
        Object.entries(value).forEach(([dataKey, dataValue]) => {
          element.dataset[dataKey] = dataValue;
        });
      } else {
        element.setAttribute(key, value);
      }
    });
    if (content) element.innerHTML = content;
    return element;
  }

  /**
   * Debounce para funções
   * @param {Function} func - Função a ser executada
   * @param {number} wait - Tempo de espera em ms
   * @returns {Function}
   */
  static debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Formata data para exibição
   * @param {Date|string} date - Data a ser formatada
   * @returns {string}
   */
  static formatDate(date) {
    const dateObj = date instanceof Date ? date : new Date(date);
    return dateObj.toLocaleDateString('pt-BR');
  }

  /**
   * Gera data aleatória nos últimos 30 dias
   * @returns {string}
   */
  static getRandomDate() {
    const today = new Date();
    const daysAgo = Math.floor(Math.random() * CONFIG.CONTRIBUTION_GRID_DAYS);
    const date = new Date(today);
    date.setDate(today.getDate() - daysAgo);
    return date.toISOString();
  }
}

/**
 * Gerenciador de notificações da aplicação
 */
class NotificationManager {
  constructor() {
    this.container = this.createContainer();
  }

  /**
   * Cria o container de notificações
   * @returns {HTMLElement}
   */
  createContainer() {
    let container = document.querySelector('.notification-container');
    if (!container) {
      container = Utils.createElement('div', {
        className: 'notification-container',
        style: 'position: fixed; top: 20px; right: 20px; z-index: 9999;'
      });
      document.body.appendChild(container);
    }
    return container;
  }

  /**
   * Mostra uma notificação
   * @param {string} message - Mensagem da notificação
   * @param {string} type - Tipo da notificação (success, error, warning, info)
   * @param {number} timeout - Tempo para auto-remoção em ms
   */
  show(message, type = 'info', timeout = CONFIG.ALERT_TIMEOUT) {
    const notification = Utils.createElement('div', {
      className: `notification notification-${type}`,
      style: 'margin-bottom: 10px; padding: 15px; border-radius: 8px; background: white; box-shadow: 0 4px 15px rgba(0,0,0,0.1); max-width: 300px;'
    }, `
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <span>${this.getIcon(type)} ${message}</span>
        <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; font-size: 18px; cursor: pointer;">×</button>
      </div>
    `);

    this.container.appendChild(notification);

    if (timeout > 0) {
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
      }, timeout);
    }
  }

  /**
   * Retorna ícone baseado no tipo
   * @param {string} type - Tipo da notificação
   * @returns {string}
   */
  getIcon(type) {
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    return icons[type] || icons.info;
  }
}

/**
 * Gerenciador do grid de contribuições
 */
class ContributionGrid {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.tooltip = this.createTooltip();
  }

  /**
   * Cria o tooltip para o grid
   * @returns {HTMLElement}
   */
  createTooltip() {
    const existing = document.querySelector('.contribution-tooltip');
    if (existing) existing.remove();

    const tooltip = Utils.createElement('div', {
      className: 'contribution-tooltip',
      style: 'position: absolute; background: rgba(0,0,0,0.8); color: white; padding: 8px; border-radius: 4px; font-size: 12px; pointer-events: none; z-index: 1000; opacity: 0; transition: opacity 0.2s;'
    });
    
    document.body.appendChild(tooltip);
    return tooltip;
  }

  /**
   * Gera o grid de contribuições
   * @param {Object} completionDates - Datas de conclusão dos objetivos
   */
  generate(completionDates) {
    if (!this.container) return;

    this.container.innerHTML = '';
    const dates = this.generateDateRange();
    const completionsPerDay = this.processCompletionData(completionDates);

    dates.forEach(date => {
      const dateKey = date.toISOString().split('T')[0];
      const count = completionsPerDay[dateKey] || 0;
      const cell = this.createCell(date, count);
      this.container.appendChild(cell);
    });

    this.setupEventListeners();
  }

  /**
   * Gera array de datas dos últimos 30 dias
   * @returns {Date[]}
   */
  generateDateRange() {
    const today = new Date();
    const dates = [];

    for (let i = CONFIG.CONTRIBUTION_GRID_DAYS - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      date.setHours(0, 0, 0, 0);
      dates.push(date);
    }

    return dates;
  }

  /**
   * Processa os dados de conclusão por dia
   * @param {Object} completionDates - Datas de conclusão
   * @returns {Object}
   */
  processCompletionData(completionDates) {
    const completionsPerDay = {};

    Object.values(completionDates).forEach(dateString => {
      const date = new Date(dateString);
      date.setHours(0, 0, 0, 0);
      const dateKey = date.toISOString().split('T')[0];
      completionsPerDay[dateKey] = (completionsPerDay[dateKey] || 0) + 1;
    });

    return completionsPerDay;
  }

  /**
   * Cria uma célula do grid
   * @param {Date} date - Data da célula
   * @param {number} count - Número de objetivos concluídos
   * @returns {HTMLElement}
   */
  createCell(date, count) {
    const cell = Utils.createElement('div', {
      className: `contribution-cell ${this.getCellLevel(count)}`,
      tabindex: '0',
      dataset: {
        date: Utils.formatDate(date),
        count: count.toString()
      },
      'aria-label': `${Utils.formatDate(date)}: ${count} ${count === 1 ? 'objetivo concluído' : 'objetivos concluídos'}`
    });

    return cell;
  }

  /**
   * Determina o nível da célula baseado na contagem
   * @param {number} count - Número de objetivos
   * @returns {string}
   */
  getCellLevel(count) {
    if (count >= 10) return 'level-4';
    if (count >= 7) return 'level-3';
    if (count >= 4) return 'level-2';
    if (count >= 1) return 'level-1';
    return '';
  }

  /**
   * Configura os event listeners do grid
   */
  setupEventListeners() {
    const showTooltip = (cell, event) => {
      const { date, count } = cell.dataset;
      const plural = parseInt(count) === 1 ? 'objetivo concluído' : 'objetivos concluídos';
      this.tooltip.textContent = `${date}: ${count} ${plural}`;
      this.tooltip.style.opacity = '1';

      const rect = cell.getBoundingClientRect();
      this.tooltip.style.left = `${rect.left + window.scrollX + rect.width / 2 - this.tooltip.offsetWidth / 2}px`;
      this.tooltip.style.top = `${rect.top + window.scrollY - this.tooltip.offsetHeight - 8}px`;
    };

    const hideTooltip = () => {
      this.tooltip.style.opacity = '0';
    };

    this.container.addEventListener('mouseover', (e) => {
      if (e.target.classList.contains('contribution-cell')) {
        showTooltip(e.target, e);
      }
    });

    this.container.addEventListener('mouseout', (e) => {
      if (e.target.classList.contains('contribution-cell')) {
        hideTooltip();
      }
    });

    this.container.addEventListener('focusin', (e) => {
      if (e.target.classList.contains('contribution-cell')) {
        showTooltip(e.target, e);
      }
    });

    this.container.addEventListener('focusout', (e) => {
      if (e.target.classList.contains('contribution-cell')) {
        hideTooltip();
      }
    });
  }
}

/**
 * Classe principal do RFCP Tracker
 * Gerencia todo o ciclo de vida da aplicação
 */
class RFCPTracker {
  constructor() {
    this.objectives = [];
    this.completedIds = [];
    this.completionDates = {};
    this.syncManager = null;
    this.loadError = false;
    this.currentFilter = 'all';
    this.currentSearch = '';
    
    // Managers
    this.notificationManager = new NotificationManager();
    this.contributionGrid = new ContributionGrid('contribution-grid');
    
    // DOM elements
    this.elements = {
      objectivesList: document.getElementById('objectives-list'),
      filterButtons: document.querySelectorAll('.filter-btn'),
      searchInput: document.getElementById('search-input'),
      progressBar: document.getElementById('progress'),
      completedCount: document.getElementById('completed-count'),
      totalCount: document.getElementById('total-count'),
      errorBanner: document.getElementById('error-banner')
    };
  }

  /**
   * Inicializa a aplicação
   * @returns {Promise<void>}
   */
  async init() {
    try {
      await this.initSyncManager();
      await this.loadObjectives();
      await this.loadProgress();
      this.setupEventListeners();
      this.addSyncButton();
      this.updateUI();
      this.render();
      
      console.log('✅ RFCP Tracker inicializado com sucesso');
    } catch (error) {
      console.error('❌ Erro na inicialização:', error);
      this.notificationManager.show('Erro ao inicializar aplicação', 'error');
    }
  }

  /**
   * Inicializa o gerenciador de sincronização
   */
  async initSyncManager() {
    if (window.SyncManager) {
      this.syncManager = new window.SyncManager();
      console.log('✅ SyncManager inicializado');
    } else {
      console.warn('⚠️ SyncManager não encontrado. Sincronização desabilitada.');
    }
  }

  /**
   * Carrega os objetivos do arquivo JSON
   * @returns {Promise<Array>} Lista de objetivos carregados
   * @throws {Error} Erro ao carregar arquivo JSON
   */
  async loadObjectives() {
    try {
      const response = await fetch(CONFIG.DATA_FILE);
      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }
      
      const text = await response.text();
      if (!text.trim()) {
        throw new Error('Arquivo JSON está vazio');
      }
      
      const data = JSON.parse(text);
      if (!data.lessons || !Array.isArray(data.lessons)) {
        throw new Error('Formato JSON inválido: propriedade "lessons" não encontrada');
      }
      
      this.objectives = data.lessons;
      this.loadError = false;
      this.hideErrorBanner();
      
      console.log(`✅ ${this.objectives.length} objetivos carregados com sucesso`);
      return this.objectives;
    } catch (error) {
      console.error('❌ Erro ao carregar objetivos:', error);
      this.loadError = true;
      this.showErrorBanner();
      this.notificationManager.show('Erro ao carregar objetivos', 'error');
      throw error;
    }
  }

  /**
   * Carrega o progresso do usuário (local e/ou sincronizado)
   * @returns {Promise<Object>} Dados de progresso carregados
   */
  async loadProgress() {
    try {
      const localProgress = localStorage.getItem(CONFIG.STORAGE_KEY);
      const local = localProgress ? JSON.parse(localProgress) : { completedIds: [], completionDates: {} };
      
      // Tentar sincronizar se habilitado
      if (this.syncManager?.syncEnabled) {
        try {
          const synced = await this.syncManager.sync(local);
          if (synced) {
            console.log('📊 Progresso sincronizado com sucesso');
            this.completedIds = synced.completedIds;
            this.completionDates = synced.completionDates;
            return synced;
          }
        } catch (syncError) {
          console.warn('⚠️ Erro na sincronização, usando dados locais:', syncError.message);
          this.notificationManager.show('Erro na sincronização, usando dados locais', 'warning');
        }
      }
      
      this.completedIds = local.completedIds;
      this.completionDates = local.completionDates;
      return local;
    } catch (error) {
      console.error('❌ Erro ao carregar progresso:', error);
      this.completedIds = [];
      this.completionDates = {};
      return { completedIds: [], completionDates: {} };
    }
  }

  /**
   * Salva o progresso do usuário
   * @returns {Promise<void>}
   */
  async saveProgress() {
    try {
      const data = { 
        completedIds: this.completedIds, 
        completionDates: this.completionDates 
      };
      
      localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(data));
      
      // Sincronizar em background se habilitado
      if (this.syncManager?.syncEnabled) {
        try {
          await this.syncManager.sync(data);
          this.updateSyncStatus(true, 'Progresso sincronizado');
        } catch (syncError) {
          console.warn('⚠️ Erro na sincronização:', syncError.message);
          this.updateSyncStatus(false, syncError.message);
        }
      }
    } catch (error) {
      console.error('❌ Erro ao salvar progresso:', error);
      this.notificationManager.show('Erro ao salvar progresso', 'error');
      throw error;
    }
  }

  /**
   * Atualiza o status de sincronização na interface
   * @param {boolean} success Status da sincronização
   * @param {string} message Mensagem de status
   */
  updateSyncStatus(success, message = '') {
    const statusEl = document.getElementById('sync-status');
    if (!statusEl) return;
    
    if (success) {
      statusEl.textContent = '✅ Sincronizado';
      statusEl.className = 'sync-status sync-success';
    } else {
      statusEl.textContent = `❌ ${message}`;
      statusEl.className = 'sync-status sync-error';
    }
    
    setTimeout(() => {
      statusEl.textContent = '';
      statusEl.className = 'sync-status';
    }, CONFIG.STATUS_TIMEOUT);
  }

  /**
   * Configura todos os event listeners
   */
  setupEventListeners() {
    this.setupFilterButtons();
    this.setupSearch();
    this.setupObjectiveClicks();
    this.setupProgressActions();
    this.setupErrorBanner();
  }

  /**
   * Configura os botões de filtro
   */
  setupFilterButtons() {
    this.elements.filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        this.elements.filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilter = btn.dataset.filter;
        this.render();
      });
    });
  }

  /**
   * Configura a busca com debounce
   */
  setupSearch() {
    if (this.elements.searchInput) {
      const debouncedSearch = Utils.debounce((term) => {
        this.currentSearch = term;
        this.render();
      }, 300);

      this.elements.searchInput.addEventListener('input', (e) => {
        debouncedSearch(e.target.value);
      });
    }
  }

  /**
   * Configura os cliques nos objetivos
   */
  setupObjectiveClicks() {
    if (!this.elements.objectivesList) return;

    this.elements.objectivesList.addEventListener('click', async (e) => {
      const card = e.target.closest('.objective-card');
      if (!card || e.target.classList.contains('objective-link')) return;

      await this.toggleObjective(card.dataset.id, e);
    });
  }

  /**
   * Alterna o status de um objetivo
   * @param {string} objectiveId ID do objetivo
   * @param {Event} event Evento do clique
   */
  async toggleObjective(objectiveId, event) {
    const index = this.completedIds.indexOf(objectiveId);
    const wasCompleted = index !== -1;

    if (!wasCompleted) {
      this.completedIds.push(objectiveId);
      this.completionDates[objectiveId] = new Date().toISOString();
      
      // Trigger confetti animation
      if (window.confetti) {
        window.confetti.burst(event.clientX, event.clientY);
      }
      
      this.notificationManager.show('Objetivo concluído! 🎉', 'success', 2000);
    } else {
      this.completedIds.splice(index, 1);
      delete this.completionDates[objectiveId];
    }

    await this.saveProgress();
    this.updateUI();
    this.render();
  }

  /**
   * Filtra objetivos baseado nos critérios atuais
   * @returns {Array} Objetivos filtrados
   */
  getFilteredObjectives() {
    let filtered = [...this.objectives];

    // Filtrar por status
    if (this.currentFilter === 'completed') {
      filtered = filtered.filter(obj => this.completedIds.includes(obj.id));
    } else if (this.currentFilter === 'unfinished') {
      filtered = filtered.filter(obj => !this.completedIds.includes(obj.id));
    } else if (this.currentFilter !== 'all') {
      filtered = filtered.filter(obj => obj.type === this.currentFilter);
    }

    // Filtrar por busca
    if (this.currentSearch.trim() !== '') {
      const term = this.currentSearch.toLowerCase();
      filtered = filtered.filter(obj => 
        obj.name.toLowerCase().includes(term) || 
        obj.id.toLowerCase().includes(term)
      );
    }

    return filtered;
  }

  /**
   * Cria um card de objetivo
   * @param {Object} objective Dados do objetivo
   * @returns {HTMLElement} Card do objetivo
   */
  createObjectiveCard(objective) {
    const isCompleted = this.completedIds.includes(objective.id);
    const completedText = isCompleted ? 'Concluído' : 'Marcar como concluído';
    const ariaPressed = isCompleted ? 'true' : 'false';

    return Utils.createElement('div', {
      className: `objective-card${isCompleted ? ' completed' : ''}`,
      dataset: { id: objective.id }
    }, `
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
        <button class="mark-complete-btn" aria-pressed="${ariaPressed}" aria-label="${completedText} - ${objective.name}">
          ${completedText}
        </button>
      </div>
      <button class="complete-button" aria-label="Alternar conclusão para ${objective.name}" aria-pressed="${ariaPressed}">
        ✓
      </button>
    `);
  }

  /**
   * Renderiza a lista de objetivos
   */
  render() {
    if (!this.elements.objectivesList) return;

    if (this.loadError || this.objectives.length === 0) {
      this.elements.objectivesList.innerHTML = '<p style="color:#666">Nenhum objetivo carregado. Verifique o arquivo JSON.</p>';
      return;
    }

    const filteredObjectives = this.getFilteredObjectives();
    this.elements.objectivesList.innerHTML = '';

    filteredObjectives.forEach(objective => {
      const card = this.createObjectiveCard(objective);
      this.elements.objectivesList.appendChild(card);
    });
  }

  /**
   * Atualiza a interface do usuário
   */
  updateUI() {
    this.updateProgressBar();
    this.contributionGrid.generate(this.completionDates);
  }

  /**
   * Atualiza a barra de progresso
   */
  updateProgressBar() {
    const completedCount = this.completedIds.length;
    const totalCount = this.objectives.length;
    
    if (this.elements.completedCount) {
      this.elements.completedCount.textContent = completedCount;
    }
    if (this.elements.totalCount) {
      this.elements.totalCount.textContent = totalCount;
    }

    if (this.elements.progressBar) {
      const percentage = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
      this.elements.progressBar.style.width = `${percentage}%`;
      this.elements.progressBar.textContent = `${percentage}%`;
    }

    // Calcular tempo total e tempo concluído
    let totalTime = 0;
    let completedTime = 0;

    this.objectives.forEach(objective => {
      const time = Number(objective.time_min) || 0;
      totalTime += time;
      if (this.completedIds.includes(objective.id)) {
        completedTime += time;
      }
    });

    // Atualizar texto de progresso
    const concluido = completedCount === 1 ? 'concluído' : 'concluídos';
    const progressText = document.querySelector('.preferences p');
    if (progressText) {
      progressText.innerHTML = `
        <span id="completed-count">${completedCount}</span> / 
        <span id="total-count">${totalCount}</span> ${concluido} · 
        <span id="completed-time">${completedTime}</span> / 
        <span id="total-time">${totalTime}</span> minutos
        <span id="sync-status" class="sync-status"></span>
      `;
    }
  }

  /**
   * Configura as ações de progresso (export, import, reset, demo)
   */
  setupProgressActions() {
    // Export
    const btnExport = Utils.findElement(['#btn-export', '.export-btn']);
    if (btnExport) {
      btnExport.addEventListener('click', () => this.exportProgress());
    }

    // Import
    const btnImport = Utils.findElement(['#btn-import', '.import-btn']);
    const fileInput = Utils.findElement(['#import-file', 'input[type="file"][accept=".json"]']);
    if (btnImport && fileInput) {
      btnImport.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => {
        if (e.target.files?.[0]) {
          this.importProgress(e.target.files[0]);
          e.target.value = '';
        }
      });
    }

    // Reset
    const btnReset = Utils.findElement(['#btn-reset', '.reset-btn']);
    if (btnReset) {
      btnReset.addEventListener('click', () => this.resetProgress());
    }

    // Demo
    const btnDemo = Utils.findElement(['#btn-demo', '.demo-btn']);
    if (btnDemo) {
      btnDemo.addEventListener('click', () => this.populateDemo());
    }
  }

  /**
   * Exporta o progresso para arquivo JSON
   */
  exportProgress() {
    try {
      const data = {
        completedIds: this.completedIds,
        completionDates: this.completionDates,
        exportDate: new Date().toISOString()
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `rfcp-progresso-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      this.notificationManager.show('Progresso exportado com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao exportar:', error);
      this.notificationManager.show('Erro ao exportar progresso', 'error');
    }
  }

  /**
   * Importa progresso de arquivo JSON
   * @param {File} file Arquivo para importar
   */
  importProgress(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        
        if (!data || !Array.isArray(data.completedIds) || typeof data.completionDates !== 'object') {
          throw new Error('Formato de arquivo inválido');
        }

        this.completedIds = data.completedIds;
        this.completionDates = data.completionDates;
        
        await this.saveProgress();
        this.updateUI();
        this.render();
        
        this.notificationManager.show('Progresso importado com sucesso!', 'success');
      } catch (error) {
        console.error('Erro ao importar:', error);
        this.notificationManager.show('Erro ao importar arquivo. Verifique se é um JSON válido.', 'error');
      }
    };
    reader.readAsText(file);
  }

  /**
   * Reseta todo o progresso
   */
  async resetProgress() {
    if (!confirm('Tem certeza que deseja resetar todo o progresso?')) return;

    try {
      this.completedIds = [];
      this.completionDates = {};
      
      await this.saveProgress();
      this.updateUI();
      this.render();
      
      this.notificationManager.show('Progresso resetado com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao resetar:', error);
      this.notificationManager.show('Erro ao resetar progresso', 'error');
    }
  }

  /**
   * Popula dados de demonstração
   */
  async populateDemo() {
    if (!confirm('Isto irá substituir seu progresso atual com dados de demonstração. Continuar?')) return;

    try {
      const totalToComplete = Math.floor(
        this.objectives.length * 
        (CONFIG.DEMO_MIN_COMPLETION_RATE + Math.random() * CONFIG.DEMO_COMPLETION_RANGE)
      );

      const shuffled = [...this.objectives].sort(() => 0.5 - Math.random());
      const selectedObjectives = shuffled.slice(0, totalToComplete);

      this.completedIds = [];
      this.completionDates = {};

      selectedObjectives.forEach(obj => {
        this.completedIds.push(obj.id);
        this.completionDates[obj.id] = Utils.getRandomDate();
      });

      await this.saveProgress();
      this.updateUI();
      this.render();
      
      this.notificationManager.show(`Demo populado com ${totalToComplete} objetivos concluídos!`, 'success');
    } catch (error) {
      console.error('Erro ao popular demo:', error);
      this.notificationManager.show('Erro ao popular demo', 'error');
    }
  }

  /**
   * Adiciona botão de sincronização ao header
   */
  addSyncButton() {
    const header = document.querySelector('header');
    if (!header || document.querySelector('.sync-button')) return;
    
    const syncButton = Utils.createElement('a', {
      href: 'sync-settings.html',
      className: 'sync-button',
      style: `
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
      `
    }, '⚙️ Sincronização');

    syncButton.addEventListener('mouseover', () => {
      syncButton.style.transform = 'translateY(-2px)';
      syncButton.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.4)';
    });

    syncButton.addEventListener('mouseout', () => {
      syncButton.style.transform = 'translateY(0)';
      syncButton.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.3)';
    });
    
    header.appendChild(syncButton);
  }

  /**
   * Mostra banner de erro
   */
  showErrorBanner() {
    if (this.elements.errorBanner) {
      this.elements.errorBanner.hidden = false;
    }
  }

  /**
   * Oculta banner de erro
   */
  hideErrorBanner() {
    if (this.elements.errorBanner) {
      this.elements.errorBanner.hidden = true;
    }
  }

  /**
   * Configura o botão de fechar do banner de erro
   */
  setupErrorBanner() {
    const closeBtn = document.getElementById('error-banner-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hideErrorBanner());
    }
  }
}

/**
 * Inicialização da aplicação
 */
let rfcpTracker;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    rfcpTracker = new RFCPTracker();
    await rfcpTracker.init();
  } catch (error) {
    console.error('❌ Erro crítico na inicialização:', error);
  }
});

// Exportar para uso global se necessário
window.RFCPTracker = RFCPTracker;