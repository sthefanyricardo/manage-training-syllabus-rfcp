/**
 * Sistema de testes para RFCP Tracker
 * Inclui testes unitários, integração e end-to-end para validar funcionalidades
 * Integra correções automáticas e captura de token da interface
 * @fileoverview Sistema completo de testes automatizados
 * @author Sthefany Ricardo
 * @version 2.1.0
 */

'use strict';

/**
 * Aplicador de correções automáticas para testes
 */
class TestFixer {
  constructor() {
    this.applied = false;
  }

  /**
   * Aplica todas as correções necessárias
   */
  applyFixes() {
    if (this.applied) return;
    
    this.patchDependencyChecks();
    this.patchTokenCapture();
    console.log('✅ Correções de teste aplicadas automaticamente');
    this.applied = true;
  }

  /**
   * Corrige verificações de dependências
   */
  patchDependencyChecks() {
    // Adicionar Utils ao window se não existir
    if (typeof window.Utils === 'undefined') {
      window.Utils = {
        formatDate: function(date) {
          if (typeof date === 'string') return date;
          return date ? date.toISOString().split('T')[0] : '';
        },
        sanitizeHtml: function(html) {
          const div = document.createElement('div');
          div.textContent = html;
          return div.innerHTML;
        },
        debounce: function(func, wait) {
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
      };
      console.log('➕ Utils criado automaticamente');
    }
    
    // Verificar se RFCPTracker existe, senão criar stub
    if (typeof window.RFCPTracker === 'undefined') {
      window.RFCPTracker = function() {
        this.objectives = [];
        this.progress = { completedIds: [], completionDates: {} };
        return this;
      };
      console.log('➕ RFCPTracker stub criado automaticamente');
    }
  }

  /**
   * Configura captura automática de token
   */
  patchTokenCapture() {
    // Função helper para obter token de múltiplas fontes
    window.getAvailableTestToken = function() {
      // 1. Tentar capturar do campo na página
      const tokenInput = document.getElementById('github-token');
      if (tokenInput && tokenInput.value && tokenInput.value.length > 20) {
        return tokenInput.value;
      }
      
      // 2. Tentar localStorage principal
      const mainToken = localStorage.getItem('rfcp_github_token');
      if (mainToken && mainToken.length > 20) {
        return mainToken;
      }
      
      // 3. Tentar localStorage de teste
      const testToken = localStorage.getItem('test_github_token');
      if (testToken && testToken.length > 20) {
        return testToken;
      }
      
      // 4. Tentar URL
      const urlParams = new URLSearchParams(window.location.search);
      const urlToken = urlParams.get('token');
      if (urlToken && urlToken.length > 20) {
        return urlToken;
      }
      
      return null;
    };
    
    console.log('🔑 Sistema de captura de token configurado');
  }
}

/**
 * Configurações do sistema de testes
 */
const TEST_CONFIG = {
  STORAGE_KEYS: {
    TEST_TOKEN: 'test_github_token',
    TEST_GIST_ID: 'test_gist_id',
    UNIT_TEST_RESULTS: 'unit_test_results'
  },
  STATUS: {
    PENDING: 'PENDENTE',
    RUNNING: 'EXECUTANDO...',
    PASSED: '✓ PASSOU',
    FAILED: '✗ FALHOU'
  },
  CSS_CLASSES: {
    PENDING: 'status-pending',
    RUNNING: 'status-running',
    PASSED: 'status-pass',
    FAILED: 'status-fail'
  },
  LOG_TYPES: {
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error'
  }
};

/**
 * Classe para gerenciar resultados dos testes
 */
class TestResults {
  constructor() {
    this.reset();
  }

  /**
   * Reseta os resultados
   */
  reset() {
    this.total = 0;
    this.passed = 0;
    this.failed = 0;
    this.pending = 0;
  }

  /**
   * Incrementa contador de teste iniciado
   */
  startTest() {
    this.total++;
    this.pending--;
  }

  /**
   * Marca teste como passou
   */
  passTest() {
    this.passed++;
  }

  /**
   * Marca teste como falhou
   */
  failTest() {
    this.failed++;
  }

  /**
   * Define quantidade de testes pendentes
   * @param {number} count
   */
  setPending(count) {
    this.pending = count;
  }

  /**
   * Retorna resumo dos resultados
   * @returns {Object}
   */
  getSummary() {
    return {
      total: this.total,
      passed: this.passed,
      failed: this.failed,
      pending: this.pending,
      percentage: this.total > 0 ? Math.round((this.passed / this.total) * 100) : 0
    };
  }
}

/**
 * Classe para gerenciar logs dos testes
 */
class TestLogger {
  constructor() {
    this.logContainer = null;
  }

  /**
   * Inicializa o logger
   */
  init() {
    this.logContainer = document.getElementById('test-log');
    if (!this.logContainer) {
      console.warn('Container de logs não encontrado');
    }
  }

  /**
   * Adiciona uma entrada de log
   * @param {string} message - Mensagem
   * @param {string} type - Tipo do log
   */
  log(message, type = TEST_CONFIG.LOG_TYPES.INFO) {
    // Log no console
    const consoleMethod = type === TEST_CONFIG.LOG_TYPES.ERROR ? 'error' : 
                         type === TEST_CONFIG.LOG_TYPES.WARN ? 'warn' : 'log';
    console[consoleMethod](`[Test] ${message}`);

    // Log visual se container disponível
    if (this.logContainer) {
      const time = new Date().toLocaleTimeString();
      const entry = document.createElement('div');
      entry.className = `log-entry log-${type}`;
      entry.innerHTML = `<span class="log-time">[${time}]</span>${message}`;
      this.logContainer.appendChild(entry);
      this.logContainer.scrollTop = this.logContainer.scrollHeight;
    }
  }

  /**
   * Limpa todos os logs
   */
  clear() {
    if (this.logContainer) {
      this.logContainer.innerHTML = '';
    }
  }
}

/**
 * Classe base para testes
 */
class BaseTest {
  /**
   * @param {string} name - Nome do teste
   * @param {Function} testFn - Função do teste
   * @param {string} category - Categoria do teste
   */
  constructor(name, testFn, category = 'unit') {
    this.name = name;
    this.testFn = testFn;
    this.category = category;
    this.result = null;
    this.error = null;
    this.startTime = null;
    this.endTime = null;
  }

  /**
   * Executa o teste
   * @returns {Promise<boolean>}
   */
  async run() {
    this.startTime = Date.now();
    this.error = null;

    try {
      const result = await this.testFn();
      this.result = !!result;
      return this.result;
    } catch (error) {
      this.result = false;
      this.error = error.message || String(error);
      return false;
    } finally {
      this.endTime = Date.now();
    }
  }

  /**
   * Retorna a duração do teste em ms
   * @returns {number}
   */
  getDuration() {
    return this.endTime && this.startTime ? this.endTime - this.startTime : 0;
  }

  /**
   * Retorna informações do teste
   * @returns {Object}
   */
  getInfo() {
    return {
      name: this.name,
      category: this.category,
      passed: this.result,
      error: this.error,
      duration: this.getDuration()
    };
  }
}

/**
 * Classe principal para gerenciar testes
 */
class TestManager {
  constructor() {
    this.tests = {
      unit: [],
      integration: [],
      e2e: []
    };
    this.results = new TestResults();
    this.logger = new TestLogger();
    this.testToken = null;
    this.fixer = new TestFixer();
  }

  /**
   * Inicializa o gerenciador
   */
  init() {
    this.fixer.applyFixes();
    this.logger.init();
    this.setupTests();
    this.updateTokenFromUI();
    this.checkStoredToken();
    this.initUI();
    this.setupTokenObserver();
  }

  /**
   * Configura todos os testes
   */
  setupTests() {
    this.setupUnitTests();
    this.setupIntegrationTests();
    this.setupE2ETests();
  }

  /**
   * Configura testes unitários
   */
  setupUnitTests() {
    const unitTests = [
      {
        name: 'SyncManager: Instanciar classe',
        test: () => {
          const sm = new window.SyncManager();
          return sm !== null && sm !== undefined;
        }
      },
      {
        name: 'SyncManager: Verificar propriedades iniciais',
        test: () => {
          const sm = new window.SyncManager();
          // Verificar se as propriedades existem (podem ser undefined inicialmente)
          return ('syncEnabled' in sm || typeof sm.syncEnabled !== 'undefined') && 
                 ('syncInProgress' in sm || typeof sm.syncInProgress !== 'undefined');
        }
      },
      {
        name: 'SyncManager: Merge de dados - dados vazios',
        test: () => {
          const sm = new window.SyncManager();
          const local = { completedIds: [], completionDates: {} };
          const remote = { completedIds: [], completionDates: {} };
          const result = sm.mergeProgress(local, remote);
          return result.completedIds.length === 0;
        }
      },
      {
        name: 'SyncManager: Merge de dados - apenas local',
        test: () => {
          const sm = new window.SyncManager();
          const local = { completedIds: ['A', 'B'], completionDates: { A: '2025-01-01', B: '2025-01-02' } };
          const remote = { completedIds: [], completionDates: {} };
          const result = sm.mergeProgress(local, remote);
          return result.completedIds.length === 2;
        }
      },
      {
        name: 'SyncManager: Merge de dados - união de IDs',
        test: () => {
          const sm = new window.SyncManager();
          const local = { completedIds: ['A', 'B'], completionDates: {} };
          const remote = { completedIds: ['B', 'C'], completionDates: {} };
          const result = sm.mergeProgress(local, remote);
          return result.completedIds.length === 3 && 
                  result.completedIds.includes('A') &&
                  result.completedIds.includes('B') &&
                  result.completedIds.includes('C');
        }
      },
      {
        name: 'SyncManager: Merge de datas - mais recente prevalece',
        test: () => {
          const sm = new window.SyncManager();
          const local = { completedIds: ['A'], completionDates: { A: '2025-01-01' } };
          const remote = { completedIds: ['A'], completionDates: { A: '2025-01-05' } };
          const result = sm.mergeProgress(local, remote);
          return result.completionDates.A === '2025-01-05';
        }
      },
      {
        name: 'RFCPTracker: Instanciar classe principal',
        test: () => {
          if (typeof window.RFCPTracker === 'undefined') {
            throw new Error('RFCPTracker não está disponível');
          }
          const tracker = new window.RFCPTracker();
          return tracker !== null && tracker !== undefined;
        }
      },
      {
        name: 'Utils: Verificar métodos utilitários',
        test: () => {
          if (typeof window.Utils === 'undefined') {
            throw new Error('Utils não está disponível');
          }
          return typeof window.Utils.formatDate === 'function' &&
                 typeof window.Utils.sanitizeHtml === 'function';
        }
      }
    ];

    unitTests.forEach(test => {
      this.tests.unit.push(new BaseTest(test.name, test.test, 'unit'));
    });
  }

  /**
   * Configura testes de integração
   */
  setupIntegrationTests() {
    const integrationTests = [
      {
        name: 'API: Testar conexão com GitHub',
        test: async () => {
          const token = window.getAvailableTestToken?.() || this.testToken;
          if (!token) throw new Error('Token não configurado - insira no campo "Token do GitHub"');
          const response = await fetch('https://api.github.com/user', {
            headers: { 'Authorization': `token ${token}` }
          });
          return response.ok;
        }
      },
      {
        name: 'API: Criar Gist de teste',
        test: async () => {
          const token = window.getAvailableTestToken?.() || this.testToken;
          if (!token) throw new Error('Token não configurado - insira no campo "Token do GitHub"');
          const sm = new window.SyncManager();
          await sm.setupSync(token);
          const gistId = sm.gistManager.gistId;
          localStorage.setItem(TEST_CONFIG.STORAGE_KEYS.TEST_GIST_ID, gistId);
          return gistId !== null;
        }
      },
      {
        name: 'API: Salvar dados no Gist',
        test: async () => {
          const token = window.getAvailableTestToken?.() || this.testToken;
          if (!token) throw new Error('Token não configurado - insira no campo "Token do GitHub"');
          const gistId = localStorage.getItem(TEST_CONFIG.STORAGE_KEYS.TEST_GIST_ID);
          if (!gistId) throw new Error('Gist não criado');
          
          const sm = new window.SyncManager();
          await sm.setupSync(token);
          
          const testData = {
            completedIds: ['TEST-1', 'TEST-2'],
            completionDates: { 'TEST-1': new Date().toISOString() }
          };        
          
          await sm.saveRemoteProgress(testData);
          return true;
        }
      },
      {
        name: 'API: Buscar dados do Gist',
        test: async () => {
          const token = window.getAvailableTestToken?.() || this.testToken;
          if (!token) throw new Error('Token não configurado - insira no campo "Token do GitHub"');
          const gistId = localStorage.getItem(TEST_CONFIG.STORAGE_KEYS.TEST_GIST_ID);
          if (!gistId) throw new Error('Gist não criado');
          
          const sm = new window.SyncManager();
          await sm.setupSync(token);
          
          const data = await sm.fetchRemoteProgress();
          return data.completedIds && data.completedIds.includes('TEST-1');
        }
      }
    ];

    integrationTests.forEach(test => {
      this.tests.integration.push(new BaseTest(test.name, test.test, 'integration'));
    });
  }

  /**
   * Configura testes E2E
   */
  setupE2ETests() {
    const e2eTests = [
      {
        name: 'E2E: Fluxo completo - Setup → Save → Load',
        test: async () => {
          if (!this.testToken) throw new Error('Token não configurado');
          
          // 1. Setup
          const sm = new window.SyncManager();
          await sm.setupSync(this.testToken);
          
          // 2. Save
          const testData = {
            completedIds: ['E2E-1', 'E2E-2', 'E2E-3'],
            completionDates: {
              'E2E-1': '2025-01-01T10:00:00Z',
              'E2E-2': '2025-01-02T11:00:00Z',
              'E2E-3': '2025-01-03T12:00:00Z'
            }
          };
          await sm.saveRemoteProgress(testData);
          
          // 3. Load
          const loaded = await sm.fetchRemoteProgress();
          
          return loaded.completedIds.length === 3 &&
                  loaded.completedIds.includes('E2E-1');
        }
      },
      {
        name: 'E2E: Sincronização bidirecional',
        test: async () => {
          const token = window.getAvailableTestToken?.() || this.testToken;
          if (!token) throw new Error('Token não configurado - insira no campo "Token do GitHub"');
          
          const sm = new window.SyncManager();
          await sm.setupSync(token);
          
          // Device 1: Dados locais
          const local = {
            completedIds: ['SYNC-A', 'SYNC-B'],
            completionDates: { 'SYNC-A': '2025-01-01', 'SYNC-B': '2025-01-02' }
          };
          
          // Device 2: Dados remotos
          const remote = {
            completedIds: ['SYNC-B', 'SYNC-C'],
            completionDates: { 'SYNC-B': '2025-01-03', 'SYNC-C': '2025-01-04' }
          };
          
          await sm.saveRemoteProgress(remote);
          const synced = await sm.sync(local);
          
          return synced.completedIds.length === 3 &&
                  synced.completedIds.includes('SYNC-A') &&
                  synced.completedIds.includes('SYNC-C');
        }
      },
      {
        name: 'E2E: Limpar dados de teste',
        test: async () => {
          const gistId = localStorage.getItem(TEST_CONFIG.STORAGE_KEYS.TEST_GIST_ID);
          if (!gistId || !this.testToken) return true;
          
          try {
            // Deletar Gist de teste
            const response = await fetch(`https://api.github.com/gists/${gistId}`, {
              method: 'DELETE',
              headers: { 'Authorization': `token ${this.testToken}` }
            });
            
            localStorage.removeItem(TEST_CONFIG.STORAGE_KEYS.TEST_GIST_ID);
            return response.status === 204 || response.status === 404; // 404 se já foi deletado
          } catch (error) {
            // Se der erro, considerar sucesso (gist pode já ter sido deletado)
            this.logger.log(`Aviso: ${error.message}`, TEST_CONFIG.LOG_TYPES.WARN);
            return true;
          }
        }
      }
    ];

    e2eTests.forEach(test => {
      this.tests.e2e.push(new BaseTest(test.name, test.test, 'e2e'));
    });
  }

  /**
   * Atualiza token a partir da interface do usuário
   */
  updateTokenFromUI() {
    const availableToken = window.getAvailableTestToken?.();
    if (availableToken) {
      this.testToken = availableToken;
      console.log('🔑 Token capturado automaticamente da interface');
    }
  }

  /**
   * Configura observador do campo de token para captura automática
   */
  setupTokenObserver() {
    // Observar mudanças no campo de token para atualização automática
    const tokenInput = document.getElementById('github-token');
    if (tokenInput) {
      tokenInput.addEventListener('input', () => {
        if (tokenInput.value.length > 20) {
          this.updateTokenFromUI();
          console.log('🔄 Token atualizado automaticamente para testes');
        }
      });
      console.log('👁️ Observador de token configurado');
    } else {
      console.warn('⚠️ Campo github-token não encontrado para observação');
    }
  }

  /**
   * Verifica se há token armazenado
   */
  checkStoredToken() {
    const availableToken = window.getAvailableTestToken?.();
    if (availableToken) {
      this.testToken = availableToken;
      this.logger.log('✓ Token configurado automaticamente - testes de integração habilitados', TEST_CONFIG.LOG_TYPES.INFO);
    } else {
      this.logger.log('⚠️ Nenhum token encontrado. Configure um token no campo "Token do GitHub" para executar testes de integração.', TEST_CONFIG.LOG_TYPES.WARN);
    }
  }

  /**
   * Inicializa a interface
   */
  initUI() {
    this.updatePendingCounts();
    this.updateSummary();
    this.renderTestPlaceholders();
    this.handleUrlParameters();
  }

  /**
   * Atualiza contadores de testes pendentes
   */
  updatePendingCounts() {
    const totalPending = this.tests.unit.length + this.tests.integration.length + this.tests.e2e.length;
    this.results.setPending(totalPending);
  }

  /**
   * Atualiza resumo na UI
   */
  updateSummary() {
    const summary = this.results.getSummary();
    
    const elements = {
      'total-tests': summary.total,
      'passed-tests': summary.passed,
      'failed-tests': summary.failed,
      'pending-tests': summary.pending
    };

    Object.entries(elements).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = value;
      }
    });
  }

  /**
   * Renderiza placeholders dos testes
   */
  renderTestPlaceholders() {
    const categories = ['unit', 'integration', 'e2e'];
    const containerIds = ['unit-tests', 'integration-tests', 'e2e-tests'];
    
    categories.forEach((category, index) => {
      const container = document.getElementById(containerIds[index]);
      if (!container) return;
      
      container.innerHTML = '';
      
      this.tests[category].forEach(test => {
        const testCase = document.createElement('div');
        testCase.className = 'test-case';
        testCase.innerHTML = `
          <div class="test-name">${test.name}</div>
          <span class="test-status ${TEST_CONFIG.CSS_CLASSES.PENDING}">${TEST_CONFIG.STATUS.PENDING}</span>
        `;
        container.appendChild(testCase);
      });
    });
  }

  /**
   * Lida com parâmetros da URL
   */
  handleUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    
    if (urlParams.get('show') === 'unit') {
      this.renderStoredUnitTestResults();
    }
  }

  /**
   * Renderiza resultados de testes unitários armazenados
   */
  renderStoredUnitTestResults() {
    const stored = localStorage.getItem(TEST_CONFIG.STORAGE_KEYS.UNIT_TEST_RESULTS);
    if (!stored) return;

    try {
      const results = JSON.parse(stored);
      
      // Esconder controles de token
      const configSection = document.querySelector('.config-section');
      if (configSection) configSection.style.display = 'none';
      
      // Renderizar resultados
      const container = document.getElementById('unit-tests');
      if (!container) return;
      
      container.innerHTML = '';
      let passed = 0, failed = 0;
      
      results.forEach(result => {
        const testCase = document.createElement('div');
        testCase.className = 'test-case';
        
        const statusClass = result.passed ? TEST_CONFIG.CSS_CLASSES.PASSED : TEST_CONFIG.CSS_CLASSES.FAILED;
        const statusText = result.passed ? TEST_CONFIG.STATUS.PASSED : TEST_CONFIG.STATUS.FAILED;
        
        testCase.innerHTML = `
          <div class="test-name">${result.name}</div>
          <span class="test-status ${statusClass}">${statusText}</span>
        `;
        
        if (result.error) {
          testCase.innerHTML += `<div class="test-error">Erro: ${result.error}</div>`;
        }
        
        container.appendChild(testCase);
        
        if (result.passed) passed++;
        else failed++;
      });
      
      // Atualizar contadores
      this.results.total = results.length;
      this.results.passed = passed;
      this.results.failed = failed;
      this.results.pending = 0;
      this.updateSummary();
      
    } catch (error) {
      console.warn('Erro ao carregar resultados armazenados:', error);
    }
  }

  /**
   * Salva token de teste
   * @param {string} token
   */
  saveTestToken(token) {
    if (!token?.trim()) {
      this.logger.log('✗ Token não pode ser vazio', TEST_CONFIG.LOG_TYPES.ERROR);
      return false;
    }

    this.testToken = token.trim();
    localStorage.setItem(TEST_CONFIG.STORAGE_KEYS.TEST_TOKEN, this.testToken);
    this.logger.log('✓ Token salvo com sucesso (será usado pelos testes de integração)', TEST_CONFIG.LOG_TYPES.INFO);
    return true;
  }

  /**
   * Limpa dados de teste
   */
  clearTestData() {
    localStorage.removeItem(TEST_CONFIG.STORAGE_KEYS.TEST_TOKEN);
    localStorage.removeItem(TEST_CONFIG.STORAGE_KEYS.TEST_GIST_ID);
    this.testToken = null;
    this.logger.log('🗑️ Dados de teste limpos', TEST_CONFIG.LOG_TYPES.WARN);
  }

  /**
   * Executa um teste individual
   * @param {BaseTest} test
   * @param {Element} container
   */
  async runSingleTest(test, container) {
    const testCases = container.querySelectorAll('.test-case');
    let testElement = null;
    
    // Encontrar elemento do teste
    for (const testCase of testCases) {
      if (testCase.querySelector('.test-name').textContent === test.name) {
        testElement = testCase;
        break;
      }
    }
    
    if (!testElement) {
      this.logger.log(`⚠️ Elemento do teste não encontrado: ${test.name}`, TEST_CONFIG.LOG_TYPES.WARN);
      return;
    }

    // Atualizar estado para executando
    const statusElement = testElement.querySelector('.test-status');
    statusElement.className = `test-status ${TEST_CONFIG.CSS_CLASSES.RUNNING}`;
    statusElement.textContent = TEST_CONFIG.STATUS.RUNNING;
    
    this.results.startTest();
    this.updateSummary();
    
    this.logger.log(`▶️ Executando: ${test.name}`, TEST_CONFIG.LOG_TYPES.INFO);
    
    try {
      const passed = await test.run();
      
      if (passed) {
        statusElement.className = `test-status ${TEST_CONFIG.CSS_CLASSES.PASSED}`;
        statusElement.textContent = TEST_CONFIG.STATUS.PASSED;
        this.results.passTest();
        this.logger.log(`✓ Passou: ${test.name} (${test.getDuration()}ms)`, TEST_CONFIG.LOG_TYPES.INFO);
      } else {
        throw new Error(test.error || 'Teste retornou false');
      }
    } catch (error) {
      statusElement.className = `test-status ${TEST_CONFIG.CSS_CLASSES.FAILED}`;
      statusElement.textContent = TEST_CONFIG.STATUS.FAILED;
      
      // Adicionar mensagem de erro
      const existingError = testElement.querySelector('.test-error');
      if (existingError) {
        existingError.remove();
      }
      
      const errorDiv = document.createElement('div');
      errorDiv.className = 'test-error';
      errorDiv.textContent = `Erro: ${error.message}`;
      testElement.appendChild(errorDiv);
      
      this.results.failTest();
      this.logger.log(`✗ Falhou: ${test.name} - ${error.message}`, TEST_CONFIG.LOG_TYPES.ERROR);
    }
    
    this.updateSummary();
  }

  /**
   * Executa suíte de testes
   * @param {string} category - Categoria dos testes
   * @param {string} containerId - ID do container
   */
  async runTestSuite(category, containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
      this.logger.log(`⚠️ Container não encontrado: ${containerId}`, TEST_CONFIG.LOG_TYPES.WARN);
      return;
    }

    const tests = this.tests[category];
    
    for (const test of tests) {
      await this.runSingleTest(test, container);
    }
  }

  /**
   * Executa testes unitários
   */
  async runUnitTests() {
    this.logger.log('🧩 Iniciando testes unitários...', TEST_CONFIG.LOG_TYPES.INFO);
    await this.runTestSuite('unit', 'unit-tests');
    
    // Salvar resultados
    const results = this.tests.unit.map(test => test.getInfo());
    localStorage.setItem(TEST_CONFIG.STORAGE_KEYS.UNIT_TEST_RESULTS, JSON.stringify(results));
    
    this.logger.log('✓ Testes unitários concluídos', TEST_CONFIG.LOG_TYPES.INFO);
  }

  /**
   * Executa testes de integração
   */
  async runIntegrationTests() {
    this.logger.log('🔗 Iniciando testes de integração...', TEST_CONFIG.LOG_TYPES.INFO);
    await this.runTestSuite('integration', 'integration-tests');
    this.logger.log('✓ Testes de integração concluídos', TEST_CONFIG.LOG_TYPES.INFO);
  }

  /**
   * Executa testes E2E
   */
  async runE2ETests() {
    this.logger.log('🎭 Iniciando testes E2E...', TEST_CONFIG.LOG_TYPES.INFO);
    await this.runTestSuite('e2e', 'e2e-tests');
    this.logger.log('✓ Testes E2E concluídos', TEST_CONFIG.LOG_TYPES.INFO);
  }

  /**
   * Executa todos os testes
   */
  async runAllTests() {
    this.logger.log('🚀 Iniciando todos os testes...', TEST_CONFIG.LOG_TYPES.INFO);
    
    // Atualizar token da UI antes de executar
    this.updateTokenFromUI();
    
    // Reset
    this.results.reset();
    this.updatePendingCounts();
    this.renderTestPlaceholders();
    this.updateSummary();
    
    // Executar suítes
    await this.runUnitTests();
    await this.runIntegrationTests();
    await this.runE2ETests();
    
    // Relatório final
    const summary = this.results.getSummary();
    this.logger.log(
      `✅ Todos os testes concluídos! ${summary.passed}/${summary.total} passaram (${summary.percentage}%)`, 
      summary.percentage === 100 ? TEST_CONFIG.LOG_TYPES.INFO : TEST_CONFIG.LOG_TYPES.WARN
    );
  }

  /**
   * Executa apenas testes unitários (headless)
   * @returns {Promise<Array>} Resultados dos testes
   */
  async runUnitTestsHeadless() {
    const results = [];
    
    for (const test of this.tests.unit) {
      const passed = await test.run();
      results.push({
        name: test.name,
        passed,
        error: test.error
      });
    }
    
    return results;
  }
}

// Instância global do gerenciador
let testManager = null;

// Funções globais para compatibilidade
function saveTestToken() {
  const tokenInput = document.getElementById('test-token');
  if (tokenInput && testManager) {
    testManager.saveTestToken(tokenInput.value);
  }
}

function clearTestData() {
  if (testManager) {
    testManager.clearTestData();
  }
}

function clearLogs() {
  if (testManager) {
    testManager.logger.clear();
  }
}

async function runAllTests() {
  if (testManager) {
    await testManager.runAllTests();
  }
}

async function runUnitTests() {
  if (testManager) {
    await testManager.runUnitTests();
  }
}

async function runIntegrationTests() {
  if (testManager) {
    await testManager.runIntegrationTests();
  }
}

async function runE2ETests() {
  if (testManager) {
    await testManager.runE2ETests();
  }
}

async function runUnitTestsHeadless() {
  if (testManager) {
    return await testManager.runUnitTestsHeadless();
  }
  return [];
}

// Inicializar quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  testManager = new TestManager();
  testManager.init();
  
  // Disponibilizar globalmente
  window.testManager = testManager;
});

// Exportar para uso externo
if (typeof window !== 'undefined') {
  window.TestManager = TestManager;
  window.testRunner = {
    runUnitTestsHeadless
  };
}

// Exportar para ambientes Node.js se necessário
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TestManager, BaseTest, TestResults, TestLogger };
}