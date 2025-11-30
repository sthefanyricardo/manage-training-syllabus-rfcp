// src/js/sync-manager.js
// GitHub Gist Sync Manager para RFCP Tracker

class SyncManager {
    constructor() {
        this.gistId = localStorage.getItem('rfcp_gist_id');
        this.token = localStorage.getItem('rfcp_github_token');
        this.syncEnabled = !!this.token;
        this.lastSync = null;
        this.syncInProgress = false;
        // Load persisted rate-limit state (ISO string) if present
        const storedReset = localStorage.getItem('rfcp_rate_limited_until');
        this._rateLimitedUntil = storedReset ? new Date(storedReset) : null; // cache reset time when rate-limited
    }

    // Parse rate-limit info from a response (returns { isRateLimit, resetDate })
    _parseRateLimitInfo(response, bodyText) {
        try {
            const body = bodyText ? JSON.parse(bodyText) : null;
            const msg = body && body.message ? String(body.message) : '';
            const isRateLimit = /rate limit/i.test(msg) || response.status === 429 || response.status === 403 && /rate limit/i.test(msg);
            const resetHeader = response.headers && (response.headers.get ? response.headers.get('x-ratelimit-reset') : null);
            let resetDate = null;
            if (resetHeader) {
                const seconds = Number(resetHeader);
                if (!Number.isNaN(seconds)) resetDate = new Date(seconds * 1000);
            }
            return { isRateLimit, resetDate };
        } catch (e) {
            return { isRateLimit: false, resetDate: null };
        }
    }

    _setRateLimited(resetDate) {
        if (resetDate && !(resetDate instanceof Date)) {
            resetDate = new Date(resetDate);
        }
        this._rateLimitedUntil = resetDate || this._rateLimitedUntil || null;
        if (this._rateLimitedUntil) {
            try { localStorage.setItem('rfcp_rate_limited_until', this._rateLimitedUntil.toISOString()); } catch(e){}
        }
    }

    _clearRateLimit() {
        this._rateLimitedUntil = null;
        try { localStorage.removeItem('rfcp_rate_limited_until'); } catch(e){}
    }

    // Configurar sincronização com GitHub
    async setupSync(token) {
        if (!token || token.trim() === '') {
            throw new Error('Token do GitHub é obrigatório');
        }

        this.token = token.trim();
        localStorage.setItem('rfcp_github_token', this.token);

        // Tentar buscar gist existente ou criar novo
        try {
            await this.findOrCreateGist();
            this.syncEnabled = true;
            return { success: true, message: 'Sincronização configurada com sucesso!' };
        } catch (error) {
            this.disable();
            throw new Error(`Erro ao configurar sincronização: ${error.message}`);
        }
    }

    // Buscar gist existente ou criar novo
    async findOrCreateGist() {
        // Ensure a single gist exists for this app/user. This will validate stored gistId,
        // search existing gists by description and only create a new one if none found.
        await this.ensureGistExists();
        return this.gistId;
    }

    // Ensure a single gist exists: validate stored id, search user's gists, or create one.
    async ensureGistExists() {
        // If we have a stored gistId, verify it first
        if (this.gistId) {
            try {
                const resp = await fetch(`https://api.github.com/gists/${this.gistId}`, {
                    headers: {
                        'Authorization': `token ${this.token}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                });

                if (resp.ok) {
                    // gistId is valid
                    localStorage.setItem('rfcp_gist_id', this.gistId);
                    console.log('Gist armazenado válido:', this.gistId);
                    return this.gistId;
                }
            } catch (err) {
                console.warn('Falha ao verificar gist armazenado:', err);
            }

            // Invalidate stored id and continue
            this.gistId = null;
            localStorage.removeItem('rfcp_gist_id');
        }

        // Search user's gists for one matching our description
        try {
            const gists = await this.fetchGists();
            const existingGist = gists.find(g =>
                g.description === 'RFCP Study Tracker - Progress Data' &&
                g.files && g.files['rfcp-progress.json']
            );

            if (existingGist) {
                this.gistId = existingGist.id;
                localStorage.setItem('rfcp_gist_id', this.gistId);
                console.log('Gist existente encontrado via busca:', this.gistId);
                return this.gistId;
            }
        } catch (err) {
            console.warn('Busca por gists existentes falhou:', err);
        }

        // No existing gist found — create one and use it
        const newGist = await this.createGist();
        this.gistId = newGist.id;
        localStorage.setItem('rfcp_gist_id', this.gistId);
        console.log('Novo Gist criado:', this.gistId);
        return this.gistId;
    }

    // Buscar todos os gists do usuário
    async fetchGists() {
        const response = await fetch('https://api.github.com/gists', {
            headers: {
                'Authorization': `token ${this.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) {
            const body = await response.text().catch(() => '');
            const info = this._parseRateLimitInfo(response, body);
            if (info.isRateLimit) {
                this._setRateLimited(info.resetDate);
                const resetMsg = info.resetDate ? ` (resets at ${info.resetDate.toISOString()})` : '';
                console.error('fetchGists failed: rate limit exceeded' + resetMsg, body);
                throw new Error(`Rate limit excedido${resetMsg}`);
            }

            console.error('fetchGists failed:', response.status, body);
            throw new Error(`Erro ao buscar gists: ${response.status} ${body}`);
        }

        const json = await response.json();
        // successful fetch, clear any previous rate-limit state
        this._clearRateLimit();
        return json;
    }

    // Criar novo gist
    async createGist() {
        const initialData = {
            completedIds: [],
            completionDates: {},
            lastModified: new Date().toISOString()
        };
        // Double-check there's not already a gist (race condition avoidance)
        try {
            const gists = await this.fetchGists();
            const existingGist = gists.find(g =>
                g.description === 'RFCP Study Tracker - Progress Data' &&
                g.files && g.files['rfcp-progress.json']
            );

            if (existingGist) {
                console.log('createGist: encontrado gist existente, retornando ele em vez de criar novo:', existingGist.id);
                return existingGist;
            }
        } catch (err) {
            // ignore and proceed to create
            console.warn('createGist: não foi possível listar gists, prosseguindo para criar:', err);
        }

        const response = await fetch('https://api.github.com/gists', {
            method: 'POST',
            headers: {
                'Authorization': `token ${this.token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                description: 'RFCP Study Tracker - Progress Data',
                public: false,
                files: {
                    'rfcp-progress.json': {
                        content: JSON.stringify(initialData, null, 2)
                    }
                }
            })
        });

        if (!response.ok) {
            const body = await response.text().catch(() => '');
            const info = this._parseRateLimitInfo(response, body);
            if (info.isRateLimit) {
                this._setRateLimited(info.resetDate);
                const resetMsg = info.resetDate ? ` (resets at ${info.resetDate.toISOString()})` : '';
                console.error('createGist failed: rate limit exceeded' + resetMsg, body);
                throw new Error(`Rate limit excedido${resetMsg}`);
            }

            console.error('createGist failed:', response.status, body);
            throw new Error(`Erro ao criar gist: ${response.status} ${body}`);
        }

        const json = await response.json();
        this._clearRateLimit();
        return json;
    }

    // Sincronizar progresso local com remoto
    async sync(localData) {
        if (!this.syncEnabled || this.syncInProgress) {
            return localData;
        }

        this.syncInProgress = true;

        try {
            // Buscar dados remotos
            const remoteData = await this.fetchRemoteProgress();

            // Resolver conflitos (última modificação ganha)
            const mergedData = this.mergeProgress(localData, remoteData);

            // Salvar dados mesclados remotamente
            await this.saveRemoteProgress(mergedData);

            this.lastSync = new Date().toISOString();
            this.syncInProgress = false;

            return mergedData;
        } catch (error) {
            console.error('Erro na sincronização:', error);
            this.syncInProgress = false;
            throw error;
        }
    }

    // Buscar progresso remoto
    async fetchRemoteProgress() {
        // Ensure we have a valid gist id first (will create/find one if necessary)
        if (!this.gistId) {
            await this.ensureGistExists();
            if (!this.gistId) throw new Error('Gist ID não configurado');
        }

        // Try to fetch the gist; if not found, try to recover by ensuring gist exists and retry once
        let response = await fetch(`https://api.github.com/gists/${this.gistId}`, {
            headers: {
                'Authorization': `token ${this.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) {
            const body = await response.text().catch(() => '');
            const info = this._parseRateLimitInfo(response, body);
            if (info.isRateLimit) {
                this._setRateLimited(info.resetDate);
                const resetMsg = info.resetDate ? ` (resets at ${info.resetDate.toISOString()})` : '';
                console.error('fetchRemoteProgress failed: rate limit exceeded' + resetMsg, body);
                throw new Error(`Rate limit excedido${resetMsg}`);
            }

            console.warn('fetchRemoteProgress failed:', response.status, body);

            if (response.status === 404) {
                // ensureGistExists will try to find an existing gist or create one if truly missing
                await this.ensureGistExists();
                response = await fetch(`https://api.github.com/gists/${this.gistId}`, {
                    headers: {
                        'Authorization': `token ${this.token}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                });

                if (!response.ok) {
                    const body2 = await response.text().catch(() => '');
                    throw new Error(`Erro ao buscar progresso remoto (após tentativa): ${response.status} ${body2}`);
                }
            } else {
                throw new Error(`Erro ao buscar progresso remoto: ${response.status} ${body}`);
            }
        }

        const gist = await response.json();
        this._clearRateLimit();
        const content = gist.files['rfcp-progress.json'].content;
        return JSON.parse(content);
    }

    // Salvar progresso remotamente
    async saveRemoteProgress(data) {
        if (!this.gistId) {
            throw new Error('Gist ID não configurado');
        }

        const dataWithTimestamp = {
            ...data,
            lastModified: new Date().toISOString()
        };

        const response = await fetch(`https://api.github.com/gists/${this.gistId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `token ${this.token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                files: {
                    'rfcp-progress.json': {
                        content: JSON.stringify(dataWithTimestamp, null, 2)
                    }
                }
            })
        });
        if (!response.ok) {
            const body = await response.text().catch(() => '');
            const info = this._parseRateLimitInfo(response, body);
            if (info.isRateLimit) {
                this._setRateLimited(info.resetDate);
                const resetMsg = info.resetDate ? ` (resets at ${info.resetDate.toISOString()})` : '';
                console.error('saveRemoteProgress failed: rate limit exceeded' + resetMsg, body);
                throw new Error(`Rate limit excedido${resetMsg}`);
            }

            console.warn('saveRemoteProgress failed:', response.status, body);

            if (response.status === 404 || response.status === 409) {
                // Attempt to recover by ensuring a single gist exists, then retry once
                await this.ensureGistExists();

                const retryResp = await fetch(`https://api.github.com/gists/${this.gistId}`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `token ${this.token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        files: {
                            'rfcp-progress.json': {
                                content: JSON.stringify(dataWithTimestamp, null, 2)
                            }
                        }
                    })
                });

                if (!retryResp.ok) {
                    const retryBody = await retryResp.text().catch(() => '');
                    // Check rate-limit on retry
                    const retryInfo = this._parseRateLimitInfo(retryResp, retryBody);
                    if (retryInfo.isRateLimit) {
                        this._setRateLimited(retryInfo.resetDate);
                        const resetMsg2 = retryInfo.resetDate ? ` (resets at ${retryInfo.resetDate.toISOString()})` : '';
                        console.error('saveRemoteProgress retry failed: rate limit exceeded' + resetMsg2, retryBody);
                        throw new Error(`Rate limit excedido${resetMsg2}`);
                    }

                    console.error('saveRemoteProgress retry failed:', retryResp.status, retryBody);
                    throw new Error(`Erro ao salvar progresso remoto (retry): ${retryResp.status} ${retryBody}`);
                }

                const retryJson = await retryResp.json();
                this._clearRateLimit();
                return retryJson;
            }

            throw new Error(`Erro ao salvar progresso remoto: ${response.status} ${body}`);
        }

        const json = await response.json();
        this._clearRateLimit();
        return json;
    }

    // Mesclar progresso local e remoto
    mergeProgress(local, remote) {
        // Se não houver dados remotos, usar local
        if (!remote || !remote.completedIds) {
            return local;
        }

        // Se não houver dados locais, usar remoto
        if (!local || !local.completedIds) {
            return remote;
        }

        // Mesclar IDs completados (união)
        const allCompletedIds = [...new Set([
            ...local.completedIds,
            ...remote.completedIds
        ])];

        // Mesclar datas de conclusão (mais recente ganha)
        const mergedDates = { ...remote.completionDates };
        
        Object.entries(local.completionDates).forEach(([id, date]) => {
            if (!mergedDates[id] || new Date(date) > new Date(mergedDates[id])) {
                mergedDates[id] = date;
            }
        });

        return {
            completedIds: allCompletedIds,
            completionDates: mergedDates
        };
    }

    // Desabilitar sincronização
    disable() {
        this.syncEnabled = false;
        this.token = null;
        this.gistId = null;
        localStorage.removeItem('rfcp_github_token');
        localStorage.removeItem('rfcp_gist_id');
    }

    // Verificar status da sincronização
    getStatus() {
        return {
            enabled: this.syncEnabled,
            lastSync: this.lastSync,
            gistId: this.gistId,
            inProgress: this.syncInProgress,
            rateLimitedUntil: this._rateLimitedUntil ? this._rateLimitedUntil.toISOString() : null
        };
    }

    // Força sincronização manual
    async forceSyncFromLocal(localData) {
        if (!this.syncEnabled) {
            throw new Error('Sincronização não está habilitada');
        }

        await this.saveRemoteProgress(localData);
        this.lastSync = new Date().toISOString();
        return { success: true, message: 'Sincronização manual concluída!' };
    }

    // Força download do remoto (sobrescreve local)
    async forceSyncFromRemote() {
        if (!this.syncEnabled) {
            throw new Error('Sincronização não está habilitada');
        }

        const remoteData = await this.fetchRemoteProgress();
        this.lastSync = new Date().toISOString();
        return remoteData;
    }
}

// Export singleton instance
window.SyncManager = SyncManager;