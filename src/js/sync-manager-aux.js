const syncManager = new window.SyncManager();
const form = document.getElementById('sync-form');
const tokenInput = document.getElementById('github-token');
const alertContainer = document.getElementById('alert-container');
const statusBadge = document.getElementById('status-badge');
const syncInfo = document.getElementById('sync-info');
const advancedOptions = document.getElementById('advanced-options');
const loading = document.getElementById('loading');
const instructions = document.getElementById('instructions');

// Mostrar alert
function showAlert(message, type = 'info') {
    alertContainer.innerHTML = `
    <div class="alert alert-${type}">
        ${message}
    </div>
    `;
    setTimeout(() => {
    alertContainer.innerHTML = '';
    }, 5000);
}

// Atualizar UI baseado no status
function updateUI() {
    const status = syncManager.getStatus();
    // If the manager says we're rate-limited, show a prominent banner and
    // disable any remote actions so the user doesn't keep hitting the API.
    if (status.rateLimitedUntil) {
    const resetDate = new Date(status.rateLimitedUntil);
    statusBadge.innerHTML = `<span class="status-badge status-rate-limited">✗ API Rate Limit — reset em ${resetDate.toLocaleString()}</span>`;
    syncInfo.style.display = status.enabled ? 'block' : 'none';
    advancedOptions.style.display = status.enabled ? 'block' : 'none';
    instructions.style.display = 'none';
    tokenInput.value = status.enabled ? '••••••••••••••••••••' : '';
    tokenInput.disabled = true;
    const enableBtn = document.getElementById('enable-btn');
    enableBtn.textContent = status.enabled ? 'Atualizar Token' : 'Ativar Sincronização';
    enableBtn.disabled = true;

    // disable force buttons while rate-limited
    const fu = document.getElementById('force-upload-btn');
    const fd = document.getElementById('force-download-btn');
    if (fu) fu.disabled = true;
    if (fd) fd.disabled = true;

    alertContainer.innerHTML = `\n          <div class="alert alert-error">\n            API rate limit atingida — operações remotas desativadas até <strong>${resetDate.toLocaleString()}</strong>.\n          </div>`;
    // update basic sync info if available
    document.getElementById('last-sync').textContent = status.lastSync ? new Date(status.lastSync).toLocaleString() : 'Nunca';
    document.getElementById('gist-id').textContent = status.gistId || '-';
    return;
    }

    if (status.enabled) {
    statusBadge.innerHTML = '<span class="status-badge status-enabled">✓ Sincronização Ativa</span>';
    syncInfo.style.display = 'block';
    advancedOptions.style.display = 'block';
    instructions.style.display = 'none';
    tokenInput.value = '••••••••••••••••••••';
    tokenInput.disabled = true;
    document.getElementById('enable-btn').textContent = 'Atualizar Token';
    document.getElementById('enable-btn').disabled = true;

    // ensure force buttons are enabled when not rate-limited
    const fu = document.getElementById('force-upload-btn');
    const fd = document.getElementById('force-download-btn');
    if (fu) fu.disabled = false;
    if (fd) fd.disabled = false;
    alertContainer.innerHTML = '';

    // Atualizar informações
    document.getElementById('last-sync').textContent = 
        status.lastSync ? new Date(status.lastSync).toLocaleString() : 'Nunca';
    document.getElementById('gist-id').textContent = status.gistId || '-';
    } else {
    statusBadge.innerHTML = '<span class="status-badge status-disabled">✗ Sincronização Desativada</span>';
    syncInfo.style.display = 'none';
    advancedOptions.style.display = 'none';
    instructions.style.display = 'block';
    tokenInput.disabled = false;
    tokenInput.value = '';
    document.getElementById('enable-btn').textContent = 'Ativar Sincronização';
    document.getElementById('enable-btn').disabled = false;

    // ensure force buttons are disabled when sync is not enabled
    const fu = document.getElementById('force-upload-btn');
    const fd = document.getElementById('force-download-btn');
    if (fu) fu.disabled = true;
    if (fd) fd.disabled = true;
    }
}

// Ativar sincronização
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = tokenInput.value.trim();
    
    if (!token || token === '••••••••••••••••••••') {
    showAlert('Por favor, insira um token válido', 'error');
    return;
    }

    loading.classList.add('active');
    
    try {
    const result = await syncManager.setupSync(token);
    showAlert(result.message, 'success');
    updateUI();
    
    // Sincronizar dados existentes
    const localProgress = localStorage.getItem('rfcpProgressv2');
    if (localProgress) {
        const data = JSON.parse(localProgress);
        await syncManager.forceSyncFromLocal(data);
        showAlert('Progresso local sincronizado com sucesso!', 'success');
    }
    } catch (error) {
    showAlert(error.message, 'error');
    } finally {
    loading.classList.remove('active');
    }
});

// Testar conexão
document.getElementById('test-btn').addEventListener('click', async () => {
    const token = tokenInput.value.trim();
    
    if (!token) {
    showAlert('Por favor, insira um token primeiro', 'error');
    return;
    }

    loading.classList.add('active');
    
    try {
    const response = await fetch('https://api.github.com/user', {
        headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
        }
    });

    if (response.ok) {
        const user = await response.json();
        showAlert(`✓ Conexão bem-sucedida! Autenticado como: ${user.login}`, 'success');
    } else {
        showAlert('✗ Token inválido ou sem permissões adequadas', 'error');
    }
    } catch (error) {
    showAlert('Erro ao testar conexão: ' + error.message, 'error');
    } finally {
    loading.classList.remove('active');
    }
});

// Forçar upload
document.getElementById('force-upload-btn').addEventListener('click', async () => {
    loading.classList.add('active');
    
    try {
    const localProgress = localStorage.getItem('rfcpProgressv2');
    if (!localProgress) {
        showAlert('Nenhum progresso local para sincronizar', 'error');
        return;
    }
    
    const data = JSON.parse(localProgress);
    await syncManager.forceSyncFromLocal(data);
    showAlert('Progresso enviado para o GitHub com sucesso!', 'success');
    updateUI();
    } catch (error) {
    showAlert('Erro ao enviar progresso: ' + error.message, 'error');
    } finally {
    loading.classList.remove('active');
    }
});

// Forçar download
document.getElementById('force-download-btn').addEventListener('click', async () => {
    if (!confirm('Isso irá sobrescrever seu progresso local com os dados do GitHub. Deseja continuar?')) {
    return;
    }

    loading.classList.add('active');
    
    try {
    const remoteData = await syncManager.forceSyncFromRemote();
    localStorage.setItem('rfcpProgressv2', JSON.stringify(remoteData));
    showAlert('Progresso baixado do GitHub com sucesso!', 'success');
    updateUI();
    } catch (error) {
    showAlert('Erro ao baixar progresso: ' + error.message, 'error');
    } finally {
    loading.classList.remove('active');
    }
});

// Desativar sincronização
document.getElementById('disable-btn').addEventListener('click', () => {
    if (!confirm('Deseja realmente desativar a sincronização? Seus dados locais não serão afetados.')) {
    return;
    }

    syncManager.disable();
    showAlert('Sincronização desativada', 'info');
    updateUI();
});

// Inicializar UI
updateUI();