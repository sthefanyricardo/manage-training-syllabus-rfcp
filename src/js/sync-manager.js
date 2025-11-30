// src/js/sync-manager.js
// GitHub Gist Sync Manager para RFCP Tracker

class SyncManager {
    constructor() {
        this.gistId = localStorage.getItem('rfcp_gist_id');
        this.token = localStorage.getItem('rfcp_github_token');
        this.syncEnabled = !!this.token;
        this.lastSync = null;
        this.syncInProgress = false;
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
        // Primeiro, tentar buscar gist existente
        const gists = await this.fetchGists();
        const existingGist = gists.find(g => 
            g.description === 'RFCP Study Tracker - Progress Data' &&
            g.files['rfcp-progress.json']
        );

        if (existingGist) {
            this.gistId = existingGist.id;
            localStorage.setItem('rfcp_gist_id', this.gistId);
            console.log('Gist existente encontrado:', this.gistId);
            return this.gistId;
        }

        // Se não encontrar, criar novo
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
            console.error('fetchGists failed:', response.status, body);
            throw new Error(`Erro ao buscar gists: ${response.status} ${body}`);
        }

        return await response.json();
    }

    // Criar novo gist
    async createGist() {
        const initialData = {
            completedIds: [],
            completionDates: {},
            lastModified: new Date().toISOString()
        };

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
            console.error('createGist failed:', response.status, body);
            throw new Error(`Erro ao criar gist: ${response.status} ${body}`);
        }

        return await response.json();
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
        if (!this.gistId) {
            throw new Error('Gist ID não configurado');
        }

        const response = await fetch(`https://api.github.com/gists/${this.gistId}`, {
            headers: {
                'Authorization': `token ${this.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) {
            const body = await response.text().catch(() => '');
            console.error('fetchRemoteProgress failed:', response.status, body);

            // If gist not found, try to recreate it and return fresh initial data
            if (response.status === 404) {
                console.warn('Gist not found (404). Creating a new gist and returning initial data.');
                const newGist = await this.createGist();
                this.gistId = newGist.id;
                localStorage.setItem('rfcp_gist_id', this.gistId);
                const content = newGist.files && newGist.files['rfcp-progress.json']
                    ? newGist.files['rfcp-progress.json'].content
                    : JSON.stringify({ completedIds: [], completionDates: {}, lastModified: new Date().toISOString() });
                return JSON.parse(content);
            }

            throw new Error(`Erro ao buscar progresso remoto: ${response.status} ${body}`);
        }

        const gist = await response.json();
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
            console.error('saveRemoteProgress failed:', response.status, body);

            // If update is rejected with Conflict, try to create a fresh gist and continue
            if (response.status === 409) {
                console.warn('PATCH to gist returned 409 Conflict. Creating a new gist as fallback.');
                const newGist = await this.createGist();
                this.gistId = newGist.id;
                localStorage.setItem('rfcp_gist_id', this.gistId);
                return newGist;
            }

            throw new Error(`Erro ao salvar progresso remoto: ${response.status} ${body}`);
        }

        return await response.json();
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
            inProgress: this.syncInProgress
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