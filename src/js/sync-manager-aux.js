/**
 * Interface auxiliar para configuração de sincronização RFCP Tracker
 * Gerencia a UI de configuração do sistema de sincronização via GitHub Gists
 * @fileoverview Interface de configuração para sincronização
 * @author Sthefany Ricardo
 * @version 2.0.0
 */

'use strict';

/**
 * Configurações da interface de sincronização
 */
const SYNC_UI_CONFIG = {
  STORAGE_KEYS: {
    LOCAL_PROGRESS: 'rfcpProgressv2',
    UNIT_TEST_RESULTS: 'unit_test_results'
  },
  UI_ELEMENTS: {
    FORM: 'sync-form',
    TOKEN_INPUT: 'github-token',
    ALERT_CONTAINER: 'alert-container',
    STATUS_BADGE: 'status-badge',
    SYNC_INFO: 'sync-info',
    ADVANCED_OPTIONS: 'advanced-options',
    LOADING: 'loading',
    INSTRUCTIONS: 'instructions',
    TESTS_SECTION: 'tests-section'
  },
  ALERT_DURATION: 5000,
  TOKEN_PLACEHOLDER: '••••••••••••••••••••'
};

/**
 * Classe para gerenciar alertas da interface
 */
class AlertManager {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
  }

  /**
   * Exibe um alerta
   * @param {string} message - Mensagem do alerta
   * @param {string} type - Tipo do alerta (info, success, warning, error)
   * @param {number} duration - Duração em ms (opcional)
   */
  show(message, type = 'info', duration = SYNC_UI_CONFIG.ALERT_DURATION) {
    if (!this.container) {
      console.warn('Container de alertas não encontrado');
      return;
    }

    this.clear();
    
    const alertElement = document.createElement('div');
    alertElement.className = `alert alert-${type}`;
    alertElement.innerHTML = message;
    
    this.container.appendChild(alertElement);
    
    if (duration > 0) {
      setTimeout(() => this.clear(), duration);
    }
  }

  /**
   * Limpa todos os alertas
   */
  clear() {
    if (this.container) {
      this.container.innerHTML = '';
    }
  }

  /**
   * Exibe alerta de sucesso
   * @param {string} message
   */
  success(message) {
    this.show(message, 'success');
  }

  /**
   * Exibe alerta de erro
   * @param {string} message
   */
  error(message) {
    this.show(message, 'error');
  }

  /**
   * Exibe alerta de informação
   * @param {string} message
   */
  info(message) {
    this.show(message, 'info');
  }

  /**
   * Exibe alerta de aviso
   * @param {string} message
   */
  warning(message) {
    this.show(message, 'warning');
  }
}

/**
 * Classe para gerenciar estado de loading
 */
class LoadingManager {
  constructor(loadingElementId) {
    this.loadingElement = document.getElementById(loadingElementId);
    this.activeOperations = new Set();
  }

  /**
   * Inicia loading para uma operação
   * @param {string} operationId - ID da operação
   */
  start(operationId = 'default') {
    this.activeOperations.add(operationId);
    this.updateUI();
  }

  /**
   * Para loading para uma operação
   * @param {string} operationId - ID da operação
   */
  stop(operationId = 'default') {
    this.activeOperations.delete(operationId);
    this.updateUI();
  }

  /**
   * Atualiza a UI baseado no estado
   */
  updateUI() {
    if (!this.loadingElement) return;
    
    if (this.activeOperations.size > 0) {
      this.loadingElement.classList.add('active');
    } else {
      this.loadingElement.classList.remove('active');
    }
  }

  /**
   * Verifica se há operações ativas
   * @returns {boolean}
   */
  isActive() {
    return this.activeOperations.size > 0;
  }
}

/**
 * Classe para gerenciar testes integrados
 */
class TestsManager {
  constructor() {
    this.setupEventListeners();
  }

  /**
   * Configura event listeners para os testes
   */
  setupEventListeners() {
    document.addEventListener('DOMContentLoaded', () => {
      this.wireTestButtons();
    });
  }

  /**
   * Conecta botões de teste às suas funções
   */
  wireTestButtons() {
    // Botão principal de testes unitários
    const mainTestBtn = document.getElementById('run-unit-tests-btn');
    if (mainTestBtn) {
      mainTestBtn.addEventListener('click', async () => {
        await this.runMainTests(mainTestBtn);
      });
    }

    // Botões inline se existirem
    this.wireInlineTestButtons();
  }

  /**
   * Conecta botões inline dos testes
   */
  wireInlineTestButtons() {
    const buttonConfigs = [
      { id: 'run-all-tests-inline', fn: 'runAllTests', text: '▶️ Executar Todos' },
      { id: 'run-unit-tests-inline', fn: 'runUnitTests', text: 'Testes Unitários' },
      { id: 'run-integration-tests-inline', fn: 'runIntegrationTests', text: 'Testes Integração' },
      { id: 'run-e2e-tests-inline', fn: 'runE2ETests', text: 'Testes E2E' }
    ];

    buttonConfigs.forEach(config => {
      const button = document.getElementById(config.id);
      if (button) {
        button.addEventListener('click', async () => {
          await this.runTestFunction(button, config.fn, config.text);
        });
      }
    });

    // Botão de limpar logs
    const clearLogBtn = document.getElementById('clear-log-inline');
    if (clearLogBtn) {
      clearLogBtn.addEventListener('click', () => {
        if (typeof clearLogs === 'function') {
          clearLogs();
        }
      });
    }
  }

  /**
   * Executa testes principais
   * @param {Element} button - Botão que iniciou a operação
   */
  async runMainTests(button) {
    const originalText = button.textContent;
    const testsSection = document.getElementById(SYNC_UI_CONFIG.UI_ELEMENTS.TESTS_SECTION);
    
    this.disableButton(button, 'Executando testes...');
    
    try {
      // Mostrar seção de testes se existir
      if (testsSection) {
        testsSection.style.display = 'block';
      }

      // Tentar executar runner de UI primeiro
      if (typeof runAllTests === 'function') {
        await runAllTests();
      } else if (window.testRunner && window.testRunner.runUnitTestsHeadless) {
        // Fallback para testes headless
        const results = await window.testRunner.runUnitTestsHeadless();
        localStorage.setItem(SYNC_UI_CONFIG.STORAGE_KEYS.UNIT_TEST_RESULTS, JSON.stringify(results));
        alert('Testes unitários executados (headless). Resultados salvos no localStorage.');
      } else {
        throw new Error('Runner de testes não está disponível. Certifique-se de que test-sync.js foi carregado.');
      }
    } catch (error) {
      console.error('Erro ao executar testes:', error);
      alert(`Erro ao executar testes: ${error.message}`);
    } finally {
      this.enableButton(button, originalText);
    }
  }

  /**
   * Executa função específica de teste
   * @param {Element} button - Botão
   * @param {string} functionName - Nome da função
   * @param {string} originalText - Texto original do botão
   */
  async runTestFunction(button, functionName, originalText) {
    this.disableButton(button, 'Executando...');
    
    try {
      if (typeof window[functionName] === 'function') {
        await window[functionName]();
      } else {
        throw new Error(`Função ${functionName} não está disponível`);
      }
    } catch (error) {
      console.error(`Erro ao executar ${functionName}:`, error);
      alert(`Erro: ${error.message}`);
    } finally {
      this.enableButton(button, originalText);
    }
  }

  /**
   * Desabilita botão temporariamente
   * @param {Element} button
   * @param {string} text
   */
  disableButton(button, text) {
    button.disabled = true;
    button.textContent = text;
  }

  /**
   * Reabilita botão
   * @param {Element} button
   * @param {string} originalText
   */
  enableButton(button, originalText) {
    button.disabled = false;
    button.textContent = originalText;
  }
}

/**
 * Classe principal para gerenciar a interface de sincronização
 */
class SyncManagerUI {
  constructor() {
    this.syncManager = new window.SyncManager();
    this.alertManager = new AlertManager(SYNC_UI_CONFIG.UI_ELEMENTS.ALERT_CONTAINER);
    this.loadingManager = new LoadingManager(SYNC_UI_CONFIG.UI_ELEMENTS.LOADING);
    this.testsManager = new TestsManager();
    
    this.elements = {};
    this.initializeElements();
    this.setupEventListeners();
  }

  /**
   * Inicializa referências aos elementos DOM
   */
  initializeElements() {
    Object.entries(SYNC_UI_CONFIG.UI_ELEMENTS).forEach(([key, id]) => {
      this.elements[key] = document.getElementById(id);
    });

    // Elementos adicionais
    this.elements.ENABLE_BTN = document.getElementById('enable-btn');
    this.elements.TEST_BTN = document.getElementById('test-btn');
    this.elements.FORCE_UPLOAD_BTN = document.getElementById('force-upload-btn');
    this.elements.FORCE_DOWNLOAD_BTN = document.getElementById('force-download-btn');
    this.elements.DISABLE_BTN = document.getElementById('disable-btn');
    this.elements.LAST_SYNC = document.getElementById('last-sync');
    this.elements.GIST_ID = document.getElementById('gist-id');
  }

  /**
   * Configura event listeners
   */
  setupEventListeners() {
    if (this.elements.FORM) {
      this.elements.FORM.addEventListener('submit', (e) => this.handleSyncSetup(e));
    }

    if (this.elements.TEST_BTN) {
      this.elements.TEST_BTN.addEventListener('click', () => this.testConnection());
    }

    if (this.elements.FORCE_UPLOAD_BTN) {
      this.elements.FORCE_UPLOAD_BTN.addEventListener('click', () => this.forceUpload());
    }

    if (this.elements.FORCE_DOWNLOAD_BTN) {
      this.elements.FORCE_DOWNLOAD_BTN.addEventListener('click', () => this.forceDownload());
    }

    if (this.elements.DISABLE_BTN) {
      this.elements.DISABLE_BTN.addEventListener('click', () => this.disableSync());
    }

    // Atualizar UI inicialmente
    this.updateUI();
  }

  /**
   * Atualiza interface baseada no status atual
   */
  updateUI() {
    const status = this.syncManager.getStatus();
    
    this.updateStatusBadge(status);
    this.updateSyncInfo(status);
    this.updateTokenInput(status);
    this.updateButtons(status);
    this.handleRateLimit(status);
  }

  /**
   * Atualiza badge de status
   * @param {Object} status
   */
  updateStatusBadge(status) {
    if (!this.elements.STATUS_BADGE) return;

    let badgeContent = '';
    
    if (status.rateLimitedUntil) {
      const resetDate = new Date(status.rateLimitedUntil);
      badgeContent = `<span class="status-badge status-rate-limited">✗ API Rate Limit — reset em ${resetDate.toLocaleString()}</span>`;
    } else if (status.enabled) {
      badgeContent = '<span class="status-badge status-enabled">✓ Sincronização Ativa</span>';
    } else {
      badgeContent = '<span class="status-badge status-disabled">✗ Sincronização Desativada</span>';
    }
    
    this.elements.STATUS_BADGE.innerHTML = badgeContent;
  }

  /**
   * Atualiza informações de sincronização
   * @param {Object} status
   */
  updateSyncInfo(status) {
    const show = status.enabled && !status.rateLimitedUntil;
    
    if (this.elements.SYNC_INFO) {
      this.elements.SYNC_INFO.style.display = show ? 'block' : 'none';
    }
    
    if (this.elements.ADVANCED_OPTIONS) {
      this.elements.ADVANCED_OPTIONS.style.display = show ? 'block' : 'none';
    }
    
    if (this.elements.INSTRUCTIONS) {
      this.elements.INSTRUCTIONS.style.display = status.enabled ? 'none' : 'block';
    }

    // Atualizar informações específicas
    if (this.elements.LAST_SYNC) {
      this.elements.LAST_SYNC.textContent = status.lastSync ? 
        new Date(status.lastSync).toLocaleString() : 'Nunca';
    }
    
    if (this.elements.GIST_ID) {
      this.elements.GIST_ID.textContent = status.gistId || '-';
    }
  }

  /**
   * Atualiza campo de token
   * @param {Object} status
   */
  updateTokenInput(status) {
    if (!this.elements.TOKEN_INPUT) return;
    
    if (status.enabled) {
      this.elements.TOKEN_INPUT.value = SYNC_UI_CONFIG.TOKEN_PLACEHOLDER;
      this.elements.TOKEN_INPUT.disabled = true;
    } else {
      this.elements.TOKEN_INPUT.value = '';
      this.elements.TOKEN_INPUT.disabled = false;
    }
  }

  /**
   * Atualiza botões baseado no status
   * @param {Object} status
   */
  updateButtons(status) {
    // Botão de ativar/atualizar
    if (this.elements.ENABLE_BTN) {
      this.elements.ENABLE_BTN.textContent = status.enabled ? 
        'Atualizar Token' : 'Ativar Sincronização';
      this.elements.ENABLE_BTN.disabled = status.rateLimitedUntil;
    }

    // Botões de força (upload/download)
    const forceButtonsEnabled = status.enabled && !status.rateLimitedUntil;
    
    if (this.elements.FORCE_UPLOAD_BTN) {
      this.elements.FORCE_UPLOAD_BTN.disabled = !forceButtonsEnabled;
    }
    
    if (this.elements.FORCE_DOWNLOAD_BTN) {
      this.elements.FORCE_DOWNLOAD_BTN.disabled = !forceButtonsEnabled;
    }
  }

  /**
   * Trata rate limit
   * @param {Object} status
   */
  handleRateLimit(status) {
    if (status.rateLimitedUntil) {
      const resetDate = new Date(status.rateLimitedUntil);
      this.alertManager.error(
        `API rate limit atingido — operações remotas desativadas até <strong>${resetDate.toLocaleString()}</strong>.`,
        0 // Não remover automaticamente
      );
    } else {
      this.alertManager.clear();
    }
  }

  /**
   * Manipula configuração de sincronização
   * @param {Event} event
   */
  async handleSyncSetup(event) {
    event.preventDefault();
    
    const token = this.elements.TOKEN_INPUT?.value?.trim();
    
    if (!token || token === SYNC_UI_CONFIG.TOKEN_PLACEHOLDER) {
      this.alertManager.error('Por favor, insira um token válido');
      return;
    }

    this.loadingManager.start('setup');
    
    try {
      const result = await this.syncManager.setupSync(token);
      this.alertManager.success(result.message);
      this.updateUI();
      
      // Sincronizar dados existentes se houver
      await this.syncExistingData();
      
    } catch (error) {
      this.alertManager.error(error.message);
    } finally {
      this.loadingManager.stop('setup');
    }
  }

  /**
   * Sincroniza dados existentes localmente
   */
  async syncExistingData() {
    const localProgress = localStorage.getItem(SYNC_UI_CONFIG.STORAGE_KEYS.LOCAL_PROGRESS);
    if (!localProgress) return;

    try {
      const data = JSON.parse(localProgress);
      await this.syncManager.forceSyncFromLocal(data);
      this.alertManager.success('Progresso local sincronizado com sucesso!');
    } catch (error) {
      console.warn('Erro ao sincronizar dados existentes:', error);
      this.alertManager.warning('Sincronização configurada, mas erro ao enviar dados locais');
    }
  }

  /**
   * Testa conexão com GitHub
   */
  async testConnection() {
    const token = this.elements.TOKEN_INPUT?.value?.trim();
    
    if (!token) {
      this.alertManager.error('Por favor, insira um token primeiro');
      return;
    }

    this.loadingManager.start('test');
    
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${token}`.replace(/[^\x00-\x7F]/g, ''),
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'RFCP-Tracker/1.0'
        }
      });

      if (response.ok) {
        const user = await response.json();
        this.alertManager.success(`✓ Conexão bem-sucedida! Autenticado como: ${user.login}`);
      } else {
        this.alertManager.error('✗ Token inválido ou sem permissões adequadas');
      }
    } catch (error) {
      this.alertManager.error(`Erro ao testar conexão: ${error.message}`);
    } finally {
      this.loadingManager.stop('test');
    }
  }

  /**
   * Força upload do progresso local
   */
  async forceUpload() {
    this.loadingManager.start('upload');
    
    try {
      const localProgress = localStorage.getItem(SYNC_UI_CONFIG.STORAGE_KEYS.LOCAL_PROGRESS);
      if (!localProgress) {
        this.alertManager.error('Nenhum progresso local para sincronizar');
        return;
      }
      
      const data = JSON.parse(localProgress);
      await this.syncManager.forceSyncFromLocal(data);
      this.alertManager.success('Progresso enviado para o GitHub com sucesso!');
      this.updateUI();
    } catch (error) {
      this.alertManager.error(`Erro ao enviar progresso: ${error.message}`);
    } finally {
      this.loadingManager.stop('upload');
    }
  }

  /**
   * Força download do progresso remoto
   */
  async forceDownload() {
    const confirmed = confirm(
      'Isso irá sobrescrever seu progresso local com os dados do GitHub. Deseja continuar?'
    );
    
    if (!confirmed) return;

    this.loadingManager.start('download');
    
    try {
      const remoteData = await this.syncManager.forceSyncFromRemote();
      localStorage.setItem(SYNC_UI_CONFIG.STORAGE_KEYS.LOCAL_PROGRESS, JSON.stringify(remoteData));
      this.alertManager.success('Progresso baixado do GitHub com sucesso!');
      this.updateUI();
      
      // Recarregar página para atualizar UI principal se necessário
      if (window.location.pathname.includes('sync-settings')) {
        window.opener?.location?.reload();
      }
    } catch (error) {
      this.alertManager.error(`Erro ao baixar progresso: ${error.message}`);
    } finally {
      this.loadingManager.stop('download');
    }
  }

  /**
   * Desabilita sincronização
   */
  disableSync() {
    const confirmed = confirm(
      'Deseja realmente desativar a sincronização? Seus dados locais não serão afetados.'
    );
    
    if (!confirmed) return;

    this.syncManager.disable();
    this.alertManager.info('Sincronização desativada');
    this.updateUI();
  }

  /**
   * Obtém status atual da sincronização
   * @returns {Object}
   */
  getStatus() {
    return this.syncManager.getStatus();
  }

  /**
   * Força atualização da UI
   */
  refresh() {
    this.updateUI();
  }
}

// Inicializar quando DOM estiver pronto
let syncManagerUI = null;

document.addEventListener('DOMContentLoaded', () => {
  // Verificar se SyncManager está disponível
  if (typeof window.SyncManager === 'undefined') {
    console.error('SyncManager não encontrado. Certifique-se de que sync-manager.js foi carregado.');
    return;
  }

  syncManagerUI = new SyncManagerUI();
  console.log('✅ Interface de sincronização inicializada');
});

// Exportar para uso global
if (typeof window !== 'undefined') {
  window.SyncManagerUI = SyncManagerUI;
  window.AlertManager = AlertManager;
  window.LoadingManager = LoadingManager;
  window.TestsManager = TestsManager;
}

// Exportar para ambientes Node.js se necessário
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SyncManagerUI, AlertManager, LoadingManager, TestsManager };
}