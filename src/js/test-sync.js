// Do not auto-load a token from localStorage on page load — require the user
// to explicitly save/enter a token so tests don't run with an unexpected token.
let testToken = null;
let testResults = {
    total: 0,
    passed: 0,
    failed: 0,
    pending: 0
};

// Definição dos testes
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
        return sm.syncEnabled === false && sm.syncInProgress === false;
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
    }
];

const integrationTests = [
    {
    name: 'API: Testar conexão com GitHub',
    test: async () => {
        if (!testToken) throw new Error('Token não configurado');
        const response = await fetch('https://api.github.com/user', {
        headers: { 'Authorization': `token ${testToken}` }
        });
        return response.ok;
    }
    },
    {
    name: 'API: Criar Gist de teste',
    test: async () => {
        if (!testToken) throw new Error('Token não configurado');
        const sm = new window.SyncManager();
        sm.token = testToken;
        const gist = await sm.createGist();
        localStorage.setItem('test_gist_id', gist.id);
        return gist.id !== null;
    }
    },
    {
    name: 'API: Salvar dados no Gist',
    test: async () => {
        if (!testToken) throw new Error('Token não configurado');
        const gistId = localStorage.getItem('test_gist_id');
        if (!gistId) throw new Error('Gist não criado');
        
        const sm = new window.SyncManager();
        sm.token = testToken;
        sm.gistId = gistId;
        
        const testData = {
        completedIds: ['TEST-1', 'TEST-2'],
        completionDates: { 'TEST-1': new Date().toISOString() }
        };

        // Headless runner for unit tests (returns serializable results)
        async function runUnitTestsHeadless() {
            const results = [];
            for (const t of unitTests) {
                const entry = { name: t.name, passed: false, error: null };
                try {
                    const res = t.test();
                    // allow async tests (in case) — await if promise
                    const final = (res && typeof res.then === 'function') ? await res : res;
                    entry.passed = !!final;
                } catch (e) {
                    entry.passed = false;
                    entry.error = e && e.message ? e.message : String(e);
                }
                results.push(entry);
            }
            return results;
        }

        // Expose runner to other pages (sync-settings.html will call this)
        window.testRunner = window.testRunner || {};
        window.testRunner.runUnitTestsHeadless = runUnitTestsHeadless;

        
        await sm.saveRemoteProgress(testData);
        return true;
    }
    },
    {
    name: 'API: Buscar dados do Gist',
    test: async () => {
        if (!testToken) throw new Error('Token não configurado');
        const gistId = localStorage.getItem('test_gist_id');
        if (!gistId) throw new Error('Gist não criado');
        
        const sm = new window.SyncManager();
        sm.token = testToken;
        sm.gistId = gistId;
        
        const data = await sm.fetchRemoteProgress();
        return data.completedIds && data.completedIds.includes('TEST-1');
    }
    }
];

const e2eTests = [
    {
    name: 'E2E: Fluxo completo - Setup → Save → Load',
    test: async () => {
        if (!testToken) throw new Error('Token não configurado');
        
        // 1. Setup
        const sm = new window.SyncManager();
        await sm.setupSync(testToken);
        
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
        if (!testToken) throw new Error('Token não configurado');
        
        const sm = new window.SyncManager();
        await sm.setupSync(testToken);
        
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
        const gistId = localStorage.getItem('test_gist_id');
        if (!gistId || !testToken) return true;
        
        // Deletar Gist de teste
        const response = await fetch(`https://api.github.com/gists/${gistId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `token ${testToken}` }
        });
        
        localStorage.removeItem('test_gist_id');
        return response.status === 204;
    }
    }
];

// Funções auxiliares
function log(message, type = 'info') {
    const logDiv = document.getElementById('test-log');
    const time = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    entry.innerHTML = `<span class="log-time">[${time}]</span>${message}`;
    logDiv.appendChild(entry);
    logDiv.scrollTop = logDiv.scrollHeight;
}

function saveTestToken() {
    const token = document.getElementById('test-token').value;
    if (token) {
        testToken = token;
        localStorage.setItem('test_github_token', token);
        log('✓ Token salvo com sucesso (será usado pelos testes de integração)', 'info');
    } else {
    log('✗ Token não pode ser vazio', 'error');
    }
}

function clearTestData() {
    localStorage.removeItem('test_github_token');
    localStorage.removeItem('test_gist_id');
    testToken = null;
    log('🗑️ Dados de teste limpos', 'warn');
}

function clearLogs() {
    document.getElementById('test-log').innerHTML = '';
}

function updateSummary() {
    document.getElementById('total-tests').textContent = testResults.total;
    document.getElementById('passed-tests').textContent = testResults.passed;
    document.getElementById('failed-tests').textContent = testResults.failed;
    document.getElementById('pending-tests').textContent = testResults.pending;
}

async function runTest(test, container) {
    const testCase = document.createElement('div');
    testCase.className = 'test-case';
    testCase.innerHTML = `
    <div class="test-name">${test.name}</div>
    <span class="test-status status-running">EXECUTANDO...</span>
    `;
    container.appendChild(testCase);
    
    testResults.total++;
    testResults.pending--;
    updateSummary();
    
    try {
    log(`▶️  Executando: ${test.name}`, 'info');
    const result = await test.test();
    
    if (result) {
        testCase.querySelector('.test-status').className = 'test-status status-pass';
        testCase.querySelector('.test-status').textContent = '✓ PASSOU';
        testResults.passed++;
        log(`✓ Passou: ${test.name}`, 'info');
    } else {
        throw new Error('Teste retornou false');
    }
    } catch (error) {
    testCase.querySelector('.test-status').className = 'test-status status-fail';
    testCase.querySelector('.test-status').textContent = '✗ FALHOU';
    testCase.innerHTML += `<div class="test-error">Erro: ${error.message}</div>`;
    testResults.failed++;
    log(`✗ Falhou: ${test.name} - ${error.message}`, 'error');
    }
    
    updateSummary();
}

async function runTestSuite(tests, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    for (const test of tests) {
    await runTest(test, container);
    }
}

function initTests() {
    testResults = {
    total: 0,
    passed: 0,
    failed: 0,
    pending: unitTests.length + integrationTests.length + e2eTests.length
    };
    
    // Criar placeholders
    [unitTests, integrationTests, e2eTests].forEach((suite, idx) => {
    const containerId = ['unit-tests', 'integration-tests', 'e2e-tests'][idx];
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    suite.forEach(test => {
        const testCase = document.createElement('div');
        testCase.className = 'test-case';
        testCase.innerHTML = `
        <div class="test-name">${test.name}</div>
        <span class="test-status status-pending">PENDENTE</span>
        `;
        container.appendChild(testCase);
    });
    });
    
    updateSummary();
}

async function runAllTests() {
    log('🚀 Iniciando todos os testes...', 'info');
    initTests();
    await runUnitTests();
    await runIntegrationTests();
    await runE2ETests();
    log('✅ Todos os testes concluídos!', 'info');
}

async function runUnitTests() {
    log('🧩 Iniciando testes unitários...', 'info');
    await runTestSuite(unitTests, 'unit-tests');
    log('✓ Testes unitários concluídos', 'info');
}

async function runIntegrationTests() {
    log('🔗 Iniciando testes de integração...', 'info');
    await runTestSuite(integrationTests, 'integration-tests');
    log('✓ Testes de integração concluídos', 'info');
}

async function runE2ETests() {
    log('🎭 Iniciando testes E2E...', 'info');
    await runTestSuite(e2eTests, 'e2e-tests');
    log('✓ Testes E2E concluídos', 'info');
}

// Inicializar
initTests();

// Do not auto-populate or auto-use any saved token. Inform the user that a
// token can be saved for integration tests.
if (localStorage.getItem('test_github_token')) {
    log('⚠️ Um token do GitHub foi detectado no localStorage, mas não é carregado automaticamente. Cole-o e clique em "Salvar Token" para usar nos testes de integração.', 'warn');
} else {
    log('⚠️ Nenhum token configurado. Configure um token para executar testes de integração.', 'warn');
}

// If opened with ?show=unit and there are stored unit test results,
// render them and hide the token/controls to avoid redundant input.
(function() {
    function qs(name) {
    return new URLSearchParams(window.location.search).get(name);
    }

    if (qs('show') === 'unit') {
    const raw = localStorage.getItem('unit_test_results');
    if (!raw) return;
    try {
        const results = JSON.parse(raw);
        // wait for DOM to be ready
        document.addEventListener('DOMContentLoaded', () => {
        // hide token input and controls
        const config = document.querySelector('.config-section');
        if (config) config.style.display = 'none';
        // render results into unit-tests container
        const container = document.getElementById('unit-tests');
        container.innerHTML = '';
        let passed = 0;
        let failed = 0;
        results.forEach(r => {
            const div = document.createElement('div');
            div.className = 'test-case';
            div.innerHTML = `<div class="test-name">${r.name}</div><span class="test-status ${r.passed? 'status-pass': 'status-fail'}">${r.passed? '✓ PASSOU':'✗ FALHOU'}</span>`;
            if (r.error) div.innerHTML += `<div class="test-error">${r.error}</div>`;
            container.appendChild(div);
            if (r.passed) passed++; else failed++;
        });

        // update summary counters
        document.getElementById('total-tests').textContent = results.length;
        document.getElementById('passed-tests').textContent = passed;
        document.getElementById('failed-tests').textContent = failed;
        document.getElementById('pending-tests').textContent = 0;
        });
    } catch (e) {
        console.warn('Failed to parse unit_test_results', e);
    }
    }
})();