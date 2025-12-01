/**
 * GitHub Gist Sync Manager para RFCP Tracker
 * Gerencia a sincronização de dados entre dispositivos usando GitHub Gists
 * @fileoverview Sistema de sincronização via GitHub Gists  
 * @author Sthefany Ricardo
 * @version 2.0.0
 */

'use strict';

/**
 * Configurações do SyncManager
 */
const SYNC_CONFIG = {
  API_BASE_URL: 'https://api.github.com',
  GIST_FILENAME: 'rfcp-progress.json',
  GIST_DESCRIPTION: 'RFCP Study Tracker - Progress Data',
  STORAGE_KEYS: {
    GIST_ID: 'rfcp_gist_id',
    TOKEN: 'rfcp_github_token',
    RATE_LIMITED_UNTIL: 'rfcp_rate_limited_until'
  },
  RATE_LIMIT_BUFFER: 60000 // 1 minute buffer
};

/**
 * Utilitários para requisições HTTP
 */
class HttpClient {
  /**
   * Faz uma requisição HTTP
   * @param {string} url - URL da requisição
   * @param {Object} options - Opções da requisição
   * @returns {Promise<Response>}
   */
  static async request(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'RFCP-Tracker/1.0',
        ...options.headers
      }
    });

    return response;
  }

  /**
   * Faz uma requisição autenticada para a API do GitHub
   * @param {string} endpoint - Endpoint da API
   * @param {string} token - Token de autenticação
   * @param {Object} options - Opções da requisição
   * @returns {Promise<Object>}
   */
  static async githubRequest(endpoint, token, options = {}) {
    const url = `${SYNC_CONFIG.API_BASE_URL}${endpoint}`;
    
    const response = await this.request(url, {
      ...options,
      headers: {
        'Authorization': `token ${token}`,
        ...options.headers
      }
    });

    return { response, data: response.ok ? await response.json() : null };
  }
}

/**
 * Gerenciador de rate limits da API do GitHub
 */
class RateLimitManager {
  constructor() {
    this.resetTime = this.loadStoredReset();
  }

  /**
   * Carrega o tempo de reset do rate limit do localStorage
   * @returns {Date|null}
   */
  loadStoredReset() {
    const stored = localStorage.getItem(SYNC_CONFIG.STORAGE_KEYS.RATE_LIMITED_UNTIL);
    return stored ? new Date(stored) : null;
  }

  /**
   * Verifica se está em rate limit
   * @returns {boolean}
   */
  isRateLimited() {
    if (!this.resetTime) return false;
    return new Date() < this.resetTime;
  }

  /**
   * Define o rate limit baseado na resposta da API
   * @param {Response} response - Resposta da API
   */
  handleRateLimit(response) {
    const resetHeader = response.headers.get('X-RateLimit-Reset');
    const remaining = parseInt(response.headers.get('X-RateLimit-Remaining') || '0');

    if (response.status === 403 && remaining === 0 && resetHeader) {
      const resetTime = new Date(parseInt(resetHeader) * 1000);
      // Adicionar buffer para evitar requests prematuros
      resetTime.setTime(resetTime.getTime() + SYNC_CONFIG.RATE_LIMIT_BUFFER);
      
      this.setRateLimit(resetTime);
      console.warn(`⚠️ Rate limit atingido. Reset em: ${resetTime.toLocaleString()}`);
    }
  }

  /**
   * Define um rate limit
   * @param {Date} resetTime - Tempo para reset
   */
  setRateLimit(resetTime) {
    this.resetTime = resetTime;
    try {
      localStorage.setItem(SYNC_CONFIG.STORAGE_KEYS.RATE_LIMITED_UNTIL, resetTime.toISOString());
    } catch (error) {
      console.warn('Erro ao persistir rate limit:', error);
    }
  }

  /**
   * Limpa o rate limit
   */
  clearRateLimit() {
    this.resetTime = null;
    try {
      localStorage.removeItem(SYNC_CONFIG.STORAGE_KEYS.RATE_LIMITED_UNTIL);
    } catch (error) {
      console.warn('Erro ao limpar rate limit:', error);
    }
  }

  /**
   * Retorna informações do rate limit
   * @returns {Object}
   */
  getStatus() {
    return {
      isLimited: this.isRateLimited(),
      resetTime: this.resetTime
    };
  }
}

/**
 * Gerenciador de Gists
 */
class GistManager {
  constructor(token, rateLimitManager) {
    this.token = token;
    this.rateLimitManager = rateLimitManager;
    this.gistId = localStorage.getItem(SYNC_CONFIG.STORAGE_KEYS.GIST_ID);
  }

  /**
   * Busca todos os gists do usuário
   * @returns {Promise<Array>}
   */
  async fetchUserGists() {
    if (this.rateLimitManager.isRateLimited()) {
      throw new Error('Rate limit ativo. Tente novamente mais tarde.');
    }

    const { response, data } = await HttpClient.githubRequest('/gists', this.token);
    
    this.rateLimitManager.handleRateLimit(response);

    if (!response.ok) {
      throw new Error(`Erro ao buscar gists: ${response.status} ${response.statusText}`);
    }

    this.rateLimitManager.clearRateLimit();
    return data;
  }

  /**
   * Busca um gist específico
   * @param {string} gistId - ID do gist
   * @returns {Promise<Object>}
   */
  async fetchGist(gistId) {
    if (this.rateLimitManager.isRateLimited()) {
      throw new Error('Rate limit ativo. Tente novamente mais tarde.');
    }

    const { response, data } = await HttpClient.githubRequest(`/gists/${gistId}`, this.token);
    
    this.rateLimitManager.handleRateLimit(response);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Gist não encontrado');
      }
      throw new Error(`Erro ao buscar gist: ${response.status} ${response.statusText}`);
    }

    this.rateLimitManager.clearRateLimit();
    return data;
  }

  /**
   * Cria um novo gist
   * @param {Object} initialData - Dados iniciais
   * @returns {Promise<Object>}
   */
  async createGist(initialData = null) {
    if (this.rateLimitManager.isRateLimited()) {
      throw new Error('Rate limit ativo. Tente novamente mais tarde.');
    }

    const data = initialData || {
      completedIds: [],
      completionDates: {},
      lastModified: new Date().toISOString(),
      version: '2.0'
    };

    const payload = {
      description: SYNC_CONFIG.GIST_DESCRIPTION,
      public: false,
      files: {
        [SYNC_CONFIG.GIST_FILENAME]: {
          content: JSON.stringify(data, null, 2)
        }
      }
    };

    const { response, data: responseData } = await HttpClient.githubRequest('/gists', this.token, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    this.rateLimitManager.handleRateLimit(response);

    if (!response.ok) {
      throw new Error(`Erro ao criar gist: ${response.status} ${response.statusText}`);
    }

    this.gistId = responseData.id;
    localStorage.setItem(SYNC_CONFIG.STORAGE_KEYS.GIST_ID, this.gistId);
    this.rateLimitManager.clearRateLimit();
    
    console.log('✅ Gist criado:', this.gistId);
    return responseData;
  }

  /**
   * Atualiza um gist existente
   * @param {string} gistId - ID do gist
   * @param {Object} data - Dados para atualizar
   * @returns {Promise<Object>}
   */
  async updateGist(gistId, data) {
    if (this.rateLimitManager.isRateLimited()) {
      throw new Error('Rate limit ativo. Tente novamente mais tarde.');
    }

    const dataWithTimestamp = {
      ...data,
      lastModified: new Date().toISOString(),
      version: '2.0'
    };

    const payload = {
      files: {
        [SYNC_CONFIG.GIST_FILENAME]: {
          content: JSON.stringify(dataWithTimestamp, null, 2)
        }
      }
    };

    const { response, data: responseData } = await HttpClient.githubRequest(`/gists/${gistId}`, this.token, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    this.rateLimitManager.handleRateLimit(response);

    if (!response.ok) {
      throw new Error(`Erro ao atualizar gist: ${response.status} ${response.statusText}`);
    }

    this.rateLimitManager.clearRateLimit();
    return responseData;
  }

  /**
   * Busca ou cria um gist para o app
   * @returns {Promise<string>} ID do gist
   */
  async ensureGist() {
    // Verificar se gist armazenado ainda existe
    if (this.gistId) {
      try {
        await this.fetchGist(this.gistId);
        console.log('✅ Gist existente validado:', this.gistId);
        return this.gistId;
      } catch (error) {
        console.warn('⚠️ Gist armazenado inválido, buscando/criando novo');
        this.gistId = null;
        localStorage.removeItem(SYNC_CONFIG.STORAGE_KEYS.GIST_ID);
      }
    }

    // Buscar gist existente por descrição
    try {
      const gists = await this.fetchUserGists();
      const existingGist = gists.find(gist => 
        gist.description === SYNC_CONFIG.GIST_DESCRIPTION &&
        gist.files[SYNC_CONFIG.GIST_FILENAME]
      );

      if (existingGist) {
        this.gistId = existingGist.id;
        localStorage.setItem(SYNC_CONFIG.STORAGE_KEYS.GIST_ID, this.gistId);
        console.log('✅ Gist encontrado:', this.gistId);
        return this.gistId;
      }
    } catch (error) {
      console.warn('⚠️ Erro ao buscar gists existentes:', error.message);
    }

    // Criar novo gist
    const newGist = await this.createGist();
    return newGist.id;
  }

  /**
   * Deleta um gist
   * @param {string} gistId - ID do gist
   * @returns {Promise<boolean>}
   */
  async deleteGist(gistId) {
    if (this.rateLimitManager.isRateLimited()) {
      throw new Error('Rate limit ativo. Tente novamente mais tarde.');
    }

    const { response } = await HttpClient.githubRequest(`/gists/${gistId}`, this.token, {
      method: 'DELETE'
    });

    this.rateLimitManager.handleRateLimit(response);

    if (response.ok || response.status === 404) {
      this.rateLimitManager.clearRateLimit();
      return true;
    }

    throw new Error(`Erro ao deletar gist: ${response.status} ${response.statusText}`);
  }
}

/**
 * Classe principal para gerenciamento de sincronização
 */
class SyncManager {
  constructor() {
    this.token = localStorage.getItem(SYNC_CONFIG.STORAGE_KEYS.TOKEN);
    this.syncEnabled = !!this.token;
    this.lastSync = null;
    this.syncInProgress = false;
    
    this.rateLimitManager = new RateLimitManager();
    this.gistManager = this.token ? new GistManager(this.token, this.rateLimitManager) : null;
  }

  /**
   * Configura a sincronização com um token
   * @param {string} token - Token do GitHub
   * @returns {Promise<Object>}
   */
  async setupSync(token) {
    if (!token?.trim()) {
      throw new Error('Token é obrigatório');
    }

    this.token = token.trim();
    this.gistManager = new GistManager(this.token, this.rateLimitManager);

    try {
      // Testar o token
      await this.testToken();
      
      // Garantir que existe um gist
      await this.gistManager.ensureGist();
      
      // Salvar configurações
      localStorage.setItem(SYNC_CONFIG.STORAGE_KEYS.TOKEN, this.token);
      this.syncEnabled = true;
      
      console.log('✅ Sincronização configurada com sucesso');
      return {
        success: true,
        message: 'Sincronização configurada com sucesso!'
      };
    } catch (error) {
      console.error('❌ Erro ao configurar sincronização:', error);
      throw new Error(`Erro na configuração: ${error.message}`);
    }
  }

  /**
   * Testa se o token é válido
   * @returns {Promise<boolean>}
   */
  async testToken() {
    if (!this.token) {
      throw new Error('Token não configurado');
    }

    const { response } = await HttpClient.githubRequest('/user', this.token);
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Token inválido ou expirado');
      }
      throw new Error(`Erro na validação do token: ${response.status}`);
    }

    return true;
  }

  /**
   * Sincroniza dados locais com remotos
   * @param {Object} localData - Dados locais
   * @returns {Promise<Object>} Dados sincronizados
   */
  async sync(localData) {
    if (!this.syncEnabled || this.syncInProgress) {
      return localData;
    }

    if (this.rateLimitManager.isRateLimited()) {
      console.warn('⚠️ Rate limit ativo, pulando sincronização');
      return localData;
    }

    this.syncInProgress = true;

    try {
      console.log('🔄 Iniciando sincronização...');
      
      // Buscar dados remotos
      const remoteData = await this.fetchRemoteProgress();
      
      // Mesclar dados
      const mergedData = this.mergeProgress(localData, remoteData);
      
      // Salvar dados mesclados remotamente se houve mudanças
      if (this.hasChanges(localData, mergedData)) {
        await this.saveRemoteProgress(mergedData);
      }
      
      this.lastSync = new Date().toISOString();
      console.log('✅ Sincronização concluída');
      
      return mergedData;
    } catch (error) {
      console.error('❌ Erro na sincronização:', error);
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Busca o progresso remoto
   * @returns {Promise<Object>}
   */
  async fetchRemoteProgress() {
    if (!this.gistManager) {
      throw new Error('Gist manager não inicializado');
    }

    const gistId = await this.gistManager.ensureGist();
    const gist = await this.gistManager.fetchGist(gistId);
    
    const file = gist.files[SYNC_CONFIG.GIST_FILENAME];
    if (!file) {
      throw new Error('Arquivo de progresso não encontrado no gist');
    }

    try {
      return JSON.parse(file.content);
    } catch (error) {
      console.error('❌ Erro ao parsear dados remotos:', error);
      throw new Error('Dados remotos corrompidos');
    }
  }

  /**
   * Salva o progresso remotamente
   * @param {Object} data - Dados para salvar
   * @returns {Promise<Object>}
   */
  async saveRemoteProgress(data) {
    if (!this.gistManager) {
      throw new Error('Gist manager não inicializado');
    }

    const gistId = await this.gistManager.ensureGist();
    return await this.gistManager.updateGist(gistId, data);
  }

  /**
   * Mescla progresso local e remoto
   * @param {Object} local - Dados locais
   * @param {Object} remote - Dados remotos
   * @returns {Object} Dados mesclados
   */
  mergeProgress(local, remote) {
    // Se não há dados remotos, usar locais
    if (!remote?.completedIds) {
      return local || { completedIds: [], completionDates: {} };
    }

    // Se não há dados locais, usar remotos
    if (!local?.completedIds) {
      return remote;
    }

    // Mesclar IDs (união)
    const allCompletedIds = [...new Set([
      ...local.completedIds,
      ...remote.completedIds
    ])];

    // Mesclar datas (mais recente prevalece)
    const mergedDates = { ...remote.completionDates };
    
    Object.entries(local.completionDates || {}).forEach(([id, date]) => {
      if (!mergedDates[id] || new Date(date) > new Date(mergedDates[id])) {
        mergedDates[id] = date;
      }
    });

    return {
      completedIds: allCompletedIds,
      completionDates: mergedDates
    };
  }

  /**
   * Verifica se houve mudanças entre dois conjuntos de dados
   * @param {Object} oldData - Dados antigos
   * @param {Object} newData - Dados novos
   * @returns {boolean}
   */
  hasChanges(oldData, newData) {
    if (!oldData || !newData) return true;
    
    return (
      JSON.stringify(oldData.completedIds?.sort()) !== JSON.stringify(newData.completedIds?.sort()) ||
      JSON.stringify(oldData.completionDates) !== JSON.stringify(newData.completionDates)
    );
  }

  /**
   * Força sincronização de dados locais
   * @param {Object} localData - Dados locais
   * @returns {Promise<Object>}
   */
  async forceSyncFromLocal(localData) {
    if (!this.syncEnabled) {
      throw new Error('Sincronização não está habilitada');
    }

    await this.saveRemoteProgress(localData);
    this.lastSync = new Date().toISOString();
    
    return {
      success: true,
      message: 'Dados enviados com sucesso!'
    };
  }

  /**
   * Força download de dados remotos
   * @returns {Promise<Object>}
   */
  async forceSyncFromRemote() {
    if (!this.syncEnabled) {
      throw new Error('Sincronização não está habilitada');
    }

    const remoteData = await this.fetchRemoteProgress();
    this.lastSync = new Date().toISOString();
    
    return remoteData;
  }

  /**
   * Desabilita a sincronização
   */
  disable() {
    this.syncEnabled = false;
    this.token = null;
    this.gistManager = null;
    
    try {
      localStorage.removeItem(SYNC_CONFIG.STORAGE_KEYS.TOKEN);
      localStorage.removeItem(SYNC_CONFIG.STORAGE_KEYS.GIST_ID);
      console.log('✅ Sincronização desabilitada');
    } catch (error) {
      console.warn('⚠️ Erro ao limpar dados de sincronização:', error);
    }
  }

  /**
   * Retorna o status atual da sincronização
   * @returns {Object}
   */
  getStatus() {
    const rateLimitStatus = this.rateLimitManager.getStatus();
    
    return {
      enabled: this.syncEnabled,
      lastSync: this.lastSync,
      gistId: this.gistManager?.gistId || null,
      inProgress: this.syncInProgress,
      rateLimitedUntil: rateLimitStatus.isLimited ? rateLimitStatus.resetTime?.toISOString() : null
    };
  }

  /**
   * Limpa todos os dados de sincronização
   * @returns {Promise<void>}
   */
  async cleanup() {
    if (this.gistManager?.gistId) {
      try {
        await this.gistManager.deleteGist(this.gistManager.gistId);
        console.log('✅ Gist deletado');
      } catch (error) {
        console.warn('⚠️ Erro ao deletar gist:', error);
      }
    }
    
    this.disable();
    this.rateLimitManager.clearRateLimit();
  }
}

// Exportar como singleton
if (typeof window !== 'undefined') {
  window.SyncManager = SyncManager;
}

// Exportar para ambientes Node.js se necessário
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SyncManager, HttpClient, RateLimitManager, GistManager };
}