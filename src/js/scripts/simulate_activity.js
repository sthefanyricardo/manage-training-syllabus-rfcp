/**
 * Simulador de atividade para RFCP Tracker
 * Gera dados de progresso aleatórios para testar o grid de contribuições
 * @fileoverview Utilitário para simular progresso e testar funcionalidades
 * @author Sthefany Ricardo
 * @version 2.0.0
 */

'use strict';

/**
 * Configurações do simulador
 */
const SIMULATOR_CONFIG = {
  DATA_SOURCE: 'src/data/syllabus_rfcp.json',
  STORAGE_KEY: 'rfcpProgressv2',
  SIMULATION_PARAMS: {
    DAYS_RANGE: 30,           // Dias para voltar no tempo
    MIN_COMPLETION: 0.5,       // Mínimo 50% de conclusão
    MAX_COMPLETION: 0.8,       // Máximo 80% de conclusão
    DATE_SPREAD: true          // Distribuir datas aleatoriamente
  }
};

/**
 * Classe para gerenciar geração de datas aleatórias
 */
class DateGenerator {
  /**
   * Gera uma data aleatória dentro do período especificado
   * @param {number} daysBack - Número de dias para voltar
   * @returns {string} Data em formato ISO
   */
  static getRandomDate(daysBack = SIMULATOR_CONFIG.SIMULATION_PARAMS.DAYS_RANGE) {
    const today = new Date();
    const daysAgo = Math.floor(Math.random() * daysBack);
    const date = new Date(today);
    date.setDate(today.getDate() - daysAgo);
    return date.toISOString();
  }

  /**
   * Gera múltiplas datas distribuídas no período
   * @param {number} count - Número de datas para gerar
   * @param {number} daysBack - Período em dias
   * @returns {Array<string>} Array de datas ISO
   */
  static getDistributedDates(count, daysBack = SIMULATOR_CONFIG.SIMULATION_PARAMS.DAYS_RANGE) {
    const dates = [];
    const today = new Date();
    
    for (let i = 0; i < count; i++) {
      // Distribuir uniformemente ao longo do período
      const dayOffset = Math.floor((daysBack / count) * i) + Math.floor(Math.random() * (daysBack / count));
      const date = new Date(today);
      date.setDate(today.getDate() - dayOffset);
      dates.push(date.toISOString());
    }
    
    return dates.sort(); // Ordenar cronologicamente
  }

  /**
   * Gera datas com padrão mais realista (mais atividade recente)
   * @param {number} count - Número de datas
   * @returns {Array<string>}
   */
  static getRealisticDates(count) {
    const dates = [];
    const today = new Date();
    
    for (let i = 0; i < count; i++) {
      // Bias para datas mais recentes usando distribuição exponencial inversa
      const random = Math.random();
      const exponentialRandom = -Math.log(1 - random) * 0.3; // Parâmetro de escala
      const daysAgo = Math.min(Math.floor(exponentialRandom * SIMULATOR_CONFIG.SIMULATION_PARAMS.DAYS_RANGE), SIMULATOR_CONFIG.SIMULATION_PARAMS.DAYS_RANGE - 1);
      
      const date = new Date(today);
      date.setDate(today.getDate() - daysAgo);
      dates.push(date.toISOString());
    }
    
    return dates;
  }
}

/**
 * Classe para gerenciar dados de progresso
 */
class ProgressManager {
  constructor() {
    this.storageKey = SIMULATOR_CONFIG.STORAGE_KEY;
  }

  /**
   * Carrega progresso atual do localStorage
   * @returns {Object} Dados de progresso
   */
  loadCurrentProgress() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) {
        return { completedIds: [], completionDates: {} };
      }
      
      const progress = JSON.parse(stored);
      return {
        completedIds: progress.completedIds || [],
        completionDates: progress.completionDates || {}
      };
    } catch (error) {
      console.warn('Erro ao carregar progresso atual:', error);
      return { completedIds: [], completionDates: {} };
    }
  }

  /**
   * Salva progresso no localStorage
   * @param {Object} progress - Dados de progresso
   * @returns {boolean} Sucesso da operação
   */
  saveProgress(progress) {
    try {
      const dataToSave = {
        ...progress,
        lastModified: new Date().toISOString(),
        version: '2.0',
        isSimulated: true // Flag para indicar dados simulados
      };
      
      localStorage.setItem(this.storageKey, JSON.stringify(dataToSave));
      return true;
    } catch (error) {
      console.error('Erro ao salvar progresso:', error);
      return false;
    }
  }

  /**
   * Limpa progresso simulado
   */
  clearSimulatedProgress() {
    try {
      const current = this.loadCurrentProgress();
      
      // Se não há flag de simulação, não limpar (pode ser progresso real)
      const stored = localStorage.getItem(this.storageKey);
      if (stored && !JSON.parse(stored).isSimulated) {
        console.warn('Progresso não é simulado, não será limpo automaticamente');
        return false;
      }
      
      localStorage.removeItem(this.storageKey);
      return true;
    } catch (error) {
      console.error('Erro ao limpar progresso:', error);
      return false;
    }
  }

  /**
   * Verifica se o progresso atual é simulado
   * @returns {boolean}
   */
  isSimulatedProgress() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) return false;
      
      const progress = JSON.parse(stored);
      return !!progress.isSimulated;
    } catch (error) {
      return false;
    }
  }
}

/**
 * Classe principal para simulação de atividade
 */
class ActivitySimulator {
  constructor() {
    this.progressManager = new ProgressManager();
    this.objectives = null;
  }

  /**
   * Carrega objetivos do arquivo JSON
   * @returns {Promise<Array>} Lista de objetivos
   */
  async loadObjectives() {
    if (this.objectives) {
      return this.objectives;
    }

    try {
      const response = await fetch(SIMULATOR_CONFIG.DATA_SOURCE);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      this.objectives = data.lessons || data.objectives || [];
      
      if (this.objectives.length === 0) {
        throw new Error('Nenhum objetivo encontrado no arquivo de dados');
      }
      
      console.log(`✅ Carregados ${this.objectives.length} objetivos`);
      return this.objectives;
    } catch (error) {
      console.error('Erro ao carregar objetivos:', error);
      throw new Error(`Falha ao carregar dados: ${error.message}`);
    }
  }

  /**
   * Seleciona objetivos aleatórios para simulação
   * @param {Array} objectives - Lista de todos os objetivos
   * @param {number} percentage - Percentual a ser concluído (0-1)
   * @returns {Array} Objetivos selecionados
   */
  selectRandomObjectives(objectives, percentage) {
    const totalToComplete = Math.floor(objectives.length * percentage);
    const shuffled = [...objectives].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, totalToComplete);
  }

  /**
   * Gera progresso simulado
   * @param {Object} options - Opções de simulação
   * @returns {Promise<Object>} Dados de progresso gerados
   */
  async generateProgress(options = {}) {
    const config = {
      completionPercentage: options.completionPercentage || 
        (SIMULATOR_CONFIG.SIMULATION_PARAMS.MIN_COMPLETION + 
         Math.random() * (SIMULATOR_CONFIG.SIMULATION_PARAMS.MAX_COMPLETION - SIMULATOR_CONFIG.SIMULATION_PARAMS.MIN_COMPLETION)),
      dateStrategy: options.dateStrategy || 'realistic', // 'random', 'distributed', 'realistic'
      preserveExisting: options.preserveExisting || false
    };

    const objectives = await this.loadObjectives();
    const currentProgress = config.preserveExisting ? 
      this.progressManager.loadCurrentProgress() : 
      { completedIds: [], completionDates: {} };

    // Selecionar objetivos para completar
    const selectedObjectives = this.selectRandomObjectives(objectives, config.completionPercentage);
    
    // Gerar datas baseado na estratégia
    let dates = [];
    switch (config.dateStrategy) {
      case 'distributed':
        dates = DateGenerator.getDistributedDates(selectedObjectives.length);
        break;
      case 'realistic':
        dates = DateGenerator.getRealisticDates(selectedObjectives.length);
        break;
      default:
        dates = selectedObjectives.map(() => DateGenerator.getRandomDate());
    }

    // Construir dados de progresso
    const newProgress = {
      completedIds: [...currentProgress.completedIds],
      completionDates: { ...currentProgress.completionDates }
    };

    selectedObjectives.forEach((objective, index) => {
      if (!newProgress.completedIds.includes(objective.id)) {
        newProgress.completedIds.push(objective.id);
        newProgress.completionDates[objective.id] = dates[index];
      }
    });

    return newProgress;
  }

  /**
   * Executa simulação completa
   * @param {Object} options - Opções de simulação
   * @returns {Promise<Object>} Resultado da simulação
   */
  async runSimulation(options = {}) {
    const startTime = Date.now();
    
    try {
      console.log('🎲 Iniciando simulação de atividade...');
      
      // Verificar se há progresso simulado existente
      if (this.progressManager.isSimulatedProgress() && !options.force) {
        const shouldOverwrite = confirm(
          'Progresso simulado detectado. Deseja sobrescrevê-lo com nova simulação?'
        );
        if (!shouldOverwrite) {
          console.log('⚠️ Simulação cancelada pelo usuário');
          return { success: false, message: 'Cancelado pelo usuário' };
        }
      }

      // Gerar novo progresso
      const progress = await this.generateProgress(options);
      
      // Salvar progresso
      const saved = this.progressManager.saveProgress(progress);
      if (!saved) {
        throw new Error('Falha ao salvar progresso simulado');
      }

      const duration = Date.now() - startTime;
      const result = {
        success: true,
        message: `Simulação concluída em ${duration}ms`,
        stats: {
          totalObjectives: this.objectives.length,
          completedCount: progress.completedIds.length,
          completionPercentage: Math.round((progress.completedIds.length / this.objectives.length) * 100),
          timeRange: this.getDateRange(progress.completionDates),
          duration
        }
      };

      console.log('✅ Simulação concluída:', result.stats);
      return result;

    } catch (error) {
      console.error('❌ Erro na simulação:', error);
      return {
        success: false,
        message: `Erro na simulação: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * Calcula intervalo de datas no progresso
   * @param {Object} completionDates - Datas de conclusão
   * @returns {Object} Informações do intervalo
   */
  getDateRange(completionDates) {
    const dates = Object.values(completionDates).map(d => new Date(d));
    if (dates.length === 0) {
      return { earliest: null, latest: null, span: 0 };
    }

    const earliest = new Date(Math.min(...dates));
    const latest = new Date(Math.max(...dates));
    const span = Math.ceil((latest - earliest) / (1000 * 60 * 60 * 24));

    return {
      earliest: earliest.toLocaleDateString(),
      latest: latest.toLocaleDateString(),
      span: `${span} dias`
    };
  }

  /**
   * Limpa simulação atual
   * @returns {boolean} Sucesso da operação
   */
  clearSimulation() {
    const cleared = this.progressManager.clearSimulatedProgress();
    if (cleared) {
      console.log('🗑️ Progresso simulado limpo');
    }
    return cleared;
  }
}

/**
 * Função de conveniência para executar simulação rápida
 * @param {Object} options - Opções opcionais
 * @returns {Promise<Object>}
 */
async function runQuickSimulation(options = {}) {
  const simulator = new ActivitySimulator();
  const result = await simulator.runSimulation(options);
  
  // Recarregar página se solicitado e simulação bem-sucedida
  if (result.success && (options.reload !== false)) {
    console.log('🔄 Recarregando página para mostrar mudanças...');
    setTimeout(() => window.location.reload(), 1000);
  }
  
  return result;
}

/**
 * Função para limpar dados simulados
 * @param {boolean} reload - Se deve recarregar a página
 * @returns {boolean}
 */
function clearSimulatedData(reload = true) {
  const simulator = new ActivitySimulator();
  const cleared = simulator.clearSimulation();
  
  if (cleared && reload) {
    console.log('🔄 Recarregando página...');
    setTimeout(() => window.location.reload(), 500);
  }
  
  return cleared;
}

// Executar simulação automaticamente quando script é carregado diretamente
if (typeof window !== 'undefined' && !window.ACTIVITY_SIMULATOR_LOADED) {
  window.ACTIVITY_SIMULATOR_LOADED = true;
  
  // Marcar como carregado para evitar execução múltipla
  console.log('🎲 Simulador de atividade carregado');
  
  // Executar simulação padrão
  runQuickSimulation({
    completionPercentage: 0.6 + Math.random() * 0.2, // 60-80%
    dateStrategy: 'realistic'
  });
}

// Exportar para uso global
if (typeof window !== 'undefined') {
  window.ActivitySimulator = ActivitySimulator;
  window.DateGenerator = DateGenerator;
  window.ProgressManager = ProgressManager;
  window.runQuickSimulation = runQuickSimulation;
  window.clearSimulatedData = clearSimulatedData;
}

// Exportar para ambientes Node.js se necessário
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    ActivitySimulator, 
    DateGenerator, 
    ProgressManager, 
    runQuickSimulation, 
    clearSimulatedData 
  };
}