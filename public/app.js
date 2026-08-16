let token = localStorage.getItem('offerflow_token');
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let currentPage = 'dashboard';

async function api(path, opt = {}) {
  const r = await fetch(path, {
    ...opt,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(opt.headers || {})
    }
  });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && path !== '/api/login') {
    localStorage.removeItem('offerflow_token');
    location.reload();
  }
  if (!r.ok) throw Error(d.error || `Erro HTTP ${r.status}`);
  return d;
}

$('#login-form').onsubmit = async e => {
  e.preventDefault();
  $('#login-error').textContent = '';
  const b = Object.fromEntries(new FormData(e.target));
  try {
    const d = await api('/api/login', { method: 'POST', body: JSON.stringify(b) });
    token = d.token;
    localStorage.setItem('offerflow_token', token);
    boot();
  } catch (err) {
    $('#login-error').textContent = err.message || 'Credenciais inválidas';
  }
};

async function boot() {
  if (!token) return;
  $('#login').hidden = true;
  $('#app').hidden = false;
  load('dashboard');
}

document.querySelectorAll('nav button').forEach(b => {
  b.onclick = () => {
    document.querySelectorAll('nav button').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    load(b.dataset.page);
  };
});

async function load(page, isAuto = false) {
  currentPage = page;
  const titles = {
    dashboard: 'Visão geral',
    groups: 'Grupos & rotas',
    settings: 'Integrações',
    messages: 'Processamentos',
    logs: 'Logs do sistema'
  };
  $('#page-title').textContent = titles[page] || page;

  // Não recarrega automaticamente se o usuário estiver digitando em formulários
  if (isAuto && (page === 'settings' || page === 'groups')) return;
  if (isAuto && document.activeElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

  try {
    const html = views[page](await data[page]());
    const container = $('#content');
    if (container && container.innerHTML.trim() !== html.trim()) {
      container.innerHTML = html;
    }
  } catch (e) {
    if (!isAuto) {
      $('#content').innerHTML = `<div class="card bad">${esc(e.message)}</div>`;
    }
  }
}

// Atualização automática em tempo real a cada 3 segundos
setInterval(() => {
  if (token && $('#app') && !$('#app').hidden) {
    load(currentPage, true);
  }
}, 3000);

const data = {
  dashboard: () => api('/api/dashboard'),
  groups: () => Promise.all([api('/api/groups'), api('/api/routes')]),
  settings: () => api('/api/settings'),
  messages: () => api('/api/messages'),
  logs: () => api('/api/logs')
};

const views = {
  dashboard: d => `
    <div class="grid">
      <div class="card metric"><span class="label">MENSAGENS RECEBIDAS</span><strong>${d.metrics.received}</strong></div>
      <div class="card metric accent"><span class="label">OFERTAS PROCESSADAS</span><strong>${d.metrics.processed}</strong></div>
      <div class="card metric"><span class="label">LINKS CONVERTIDOS</span><strong>${d.metrics.converted}</strong></div>
      <div class="card metric"><span class="label">ERROS</span><strong>${d.metrics.errors}</strong></div>
    </div>
    <div class="split">
      <div class="card">
        <p class="section-title">STATUS DOS SERVIÇOS</p>
        <div class="status-row"><span>Evolution API</span><b class="${d.settings.evolution_url ? 'ok' : 'bad'}">${d.settings.evolution_url ? 'configurada' : 'pendente'}</b></div>
        <div class="status-row"><span>Shopee Affiliate API</span><b class="${d.settings.shopee_configured ? 'ok' : 'bad'}">${d.settings.shopee_configured ? 'configurada' : 'pendente'}</b></div>
        <div class="status-row"><span>Bot e Fila</span><b class="${d.settings.bot_active === '1' ? 'ok' : 'bad'}">${d.settings.bot_active === '1' ? 'ativo' : 'inativo'}</b></div>
      </div>
      <div class="card">
        <p class="section-title">FILA AGORA</p>
        <strong style="font-size:40px">${d.metrics.queued}</strong>
        <p class="empty">jobs em fila / processamento</p>
      </div>
    </div>
  `,

  groups: ([gs, rs]) => `
    <div class="split">
      <div class="card">
        <p class="section-title">GRUPOS CADASTRADOS</p>
        <div class="table-wrap">
          <table class="data">
            <tr><th>Nome</th><th>Tipo</th><th>ID WhatsApp</th><th>Status</th><th>Ações</th></tr>
            ${gs.length ? gs.map(g => `
              <tr>
                <td>${esc(g.name)}</td>
                <td><span class="tag">${g.kind === 'source' ? 'Origem' : 'Destino'}</span></td>
                <td><small style="font-family:'DM Mono'">${esc(g.remote_id)}</small></td>
                <td><b class="${g.active ? 'ok' : 'bad'}">${g.active ? 'ativo' : 'inativo'}</b></td>
                <td><button type="button" class="secondary" style="padding:4px 8px;font-size:11px" onclick="deleteGroup(${g.id})">Excluir</button></td>
              </tr>
            `).join('') : '<tr><td colspan="5" class="empty">Nenhum grupo cadastrado ainda.</td></tr>'}
          </table>
        </div>

        <form id="group-form" class="form-grid" style="margin-top:22px">
          <div class="field full">
            <button type="button" class="secondary" id="fetch-evo-groups">🔍 Buscar grupos conectados na Evolution API</button>
            <select id="evo-group-select" class="full" style="display:none;margin-top:6px">
              <option value="">Selecione um grupo retornado...</option>
            </select>
          </div>
          <label class="field">Nome do grupo<input name="name" id="group-name-input" placeholder="Ex: Grupo de Ofertas ML" required></label>
          <label class="field">ID WhatsApp (JID)<input name="remote_id" id="group-id-input" placeholder="120363...@g.us" required></label>
          <label class="field">Tipo
            <select name="kind">
              <option value="source">Origem (monitorar mensagens)</option>
              <option value="destination">Destino (enviar ofertas)</option>
            </select>
          </label>
          <label class="field">Descrição<input name="description" placeholder="Opcional"></label>
          <button class="full">Cadastrar grupo</button>
        </form>
      </div>

      <div class="card">
        <p class="section-title">REGRAS DE ROTEAMENTO (Origem → Destino)</p>
        ${rs.length ? rs.map(r => `
          <div class="status-row">
            <span><b>${esc(r.source_name)}</b> ➔ <b>${esc(r.destination_name)}</b></span>
            <button type="button" class="secondary" style="padding:4px 8px;font-size:11px" onclick="deleteRoute(${r.id})">Remover</button>
          </div>
        `).join('') : '<p class="empty">Nenhuma regra cadastrada. Crie uma regra abaixo para direcionar as ofertas.</p>'}

        <form id="route-form" class="form-grid" style="margin-top:22px">
          <label class="field">Grupo de Origem
            <select name="source_id">
              ${gs.filter(g => g.kind === 'source').map(g => `<option value="${g.id}">${esc(g.name)}</option>`).join('')}
            </select>
          </label>
          <label class="field">Grupo de Destino
            <select name="destination_id">
              ${gs.filter(g => g.kind === 'destination').map(g => `<option value="${g.id}">${esc(g.name)}</option>`).join('')}
            </select>
          </label>
          <button class="full">Criar regra de rota</button>
        </form>
      </div>
    </div>
  `,

  settings: s => `
    <div class="notice">
      <b>Webhook da Evolution API:</b> No painel da Evolution, configure o Webhook para enviar para a URL:<br>
      <code style="background:#fff;padding:2px 6px;border-radius:4px;display:inline-block;margin-top:4px">http://SEU_IP_OU_DOMINIO:3000/webhooks/evolution</code>
    </div>

    <div class="card">
      <p class="section-title">CONFIGURAÇÕES DE INTEGRAÇÃO</p>
      <form id="settings-form" class="form-grid">
        <div class="field full" style="border-bottom:1px solid var(--line);padding-bottom:10px;margin-bottom:6px">
          <h3 style="margin:0;font-size:15px">📱 WhatsApp / Evolution API</h3>
        </div>

        <label class="field">Server URL Evolution<input name="evolution_url" value="${esc(s.evolution_url)}" placeholder="https://api.seuevolution.com"></label>
        <label class="field">Nome da Instância<input name="evolution_instance" value="${esc(s.evolution_instance)}" placeholder="nome_instancia"></label>
        <label class="field full">Global API Key<input name="evolution_key" type="password" placeholder="Chave da Evolution API (deixe vazio se não quiser alterar)"></label>

        <div class="field full" style="border-bottom:1px solid var(--line);padding-bottom:10px;margin-top:14px;margin-bottom:6px">
          <h3 style="margin:0;font-size:15px">🛍️ Shopee Affiliate API</h3>
        </div>

        <label class="field">Shopee App ID<input name="shopee_app_id" value="${esc(s.shopee_app_id)}" placeholder="Ex: 1234567890"></label>
        <label class="field">Shopee Secret<input name="shopee_secret" type="password" placeholder="Chave secreta Shopee (deixe vazio se não quiser alterar)"></label>
        <label class="field">GraphQL API URL<input name="shopee_api_url" value="${esc(s.shopee_api_url)}" placeholder="https://open-api.affiliate.shopee.com.br/graphql"></label>
        <label class="field">Affiliate ID / SubId (opcional)<input name="affiliate_id" value="${esc(s.affiliate_id)}" placeholder="Ex: meu_subid"></label>

        <div class="field full" style="border-bottom:1px solid var(--line);padding-bottom:10px;margin-top:14px;margin-bottom:6px">
          <h3 style="margin:0;font-size:15px">⚙️ Comportamento do Bot & Fila</h3>
        </div>

        <label class="field">Status do Bot
          <select name="bot_active">
            <option value="0" ${s.bot_active !== '1' ? 'selected' : ''}>Inativo (pausar automação)</option>
            <option value="1" ${s.bot_active === '1' ? 'selected' : ''}>Ativo (processar e enviar)</option>
          </select>
        </label>
        <label class="field">Formato de Envio das Ofertas
          <select name="send_mode">
            <option value="preview" ${s.send_mode !== 'media' ? 'selected' : ''}>Preview original do WhatsApp (sendText)</option>
            <option value="media" ${s.send_mode === 'media' ? 'selected' : ''}>Foto do produto + legenda (sendMedia)</option>
          </select>
        </label>
        <label class="field">Enviar mensagens sem link?
          <select name="send_without_link">
            <option value="0" ${s.send_without_link !== '1' ? 'selected' : ''}>Não (ignorar mensagens sem link)</option>
            <option value="1" ${s.send_without_link === '1' ? 'selected' : ''}>Sim (encaminhar mesmo sem link)</option>
          </select>
        </label>
        <label class="field">Timeout das requisições (ms)<input name="request_timeout" value="${esc(s.request_timeout)}" type="number"></label>
        <label class="field">Máximo de tentativas<input name="max_attempts" value="${esc(s.max_attempts)}" type="number"></label>

        <div class="actions full">
          <button>Salvar configurações</button>
          <button type="button" class="secondary" id="test-evo">Testar Evolution API</button>
          <button type="button" class="secondary" id="test-shop">Testar Shopee API</button>
        </div>
      </form>
    </div>
  `,

  messages: ms => `
    <div class="card">
      <p class="section-title">HISTÓRICO DE PROCESSAMENTOS (${ms.length})</p>
      <div class="table-wrap">
        <table class="data">
          <tr><th>Horário</th><th>Origem</th><th>Status</th><th>Link Original</th><th>Link Shopee</th><th>Confiança</th></tr>
          ${ms.length ? ms.map(m => `
            <tr>
              <td>${new Date(m.received_at).toLocaleTimeString()}</td>
              <td><small>${esc(m.source_remote_id)}</small></td>
              <td><span class="tag ${m.status === 'sent' ? 'ok' : (m.status === 'failed' ? 'bad' : '')}">${esc(m.status)}</span></td>
              <td><a href="${esc(m.original_url)}" target="_blank" style="color:var(--ink);max-width:150px;display:inline-block;overflow:hidden;text-overflow:ellipsis">${esc(m.original_url || '-')}</a></td>
              <td><a href="${esc(m.shopee_url)}" target="_blank" style="color:var(--dark);font-weight:700;max-width:150px;display:inline-block;overflow:hidden;text-overflow:ellipsis">${esc(m.shopee_url || '-')}</a></td>
              <td>${m.confidence ? m.confidence + '%' : '-'}</td>
            </tr>
          `).join('') : '<tr><td colspan="6" class="empty">Nenhuma mensagem recebida ainda.</td></tr>'}
        </table>
      </div>
    </div>
  `,

  logs: ls => `
    <div class="card">
      <p class="section-title">LOGS RECENTES DO SISTEMA (${ls.length})</p>
      <div class="table-wrap">
        <table class="data">
          <tr><th>Horário</th><th>Nível</th><th>Evento</th><th>Detalhes</th></tr>
          ${ls.length ? ls.map(l => `
            <tr>
              <td>${new Date(l.created_at).toLocaleTimeString()}</td>
              <td><b class="${l.level === 'error' ? 'bad' : (l.level === 'info' ? 'ok' : '')}">${esc(l.level)}</b></td>
              <td><span class="tag">${esc(l.event)}</span></td>
              <td style="white-space:normal;word-break:break-all">${esc(l.details)}</td>
            </tr>
          `).join('') : '<tr><td colspan="4" class="empty">Nenhum log registrado ainda.</td></tr>'}
        </table>
      </div>
    </div>
  `
};

window.deleteGroup = async id => {
  if (!confirm('Deseja realmente excluir este grupo?')) return;
  try {
    await api(`/api/groups/${id}`, { method: 'DELETE' });
    load('groups');
  } catch (e) {
    alert(e.message);
  }
};

window.deleteRoute = async id => {
  if (!confirm('Deseja realmente remover esta regra de rota?')) return;
  try {
    await api(`/api/routes/${id}`, { method: 'DELETE' });
    load('groups');
  } catch (e) {
    alert(e.message);
  }
};

document.addEventListener('submit', async e => {
  if (e.target.id === 'group-form' || e.target.id === 'route-form' || e.target.id === 'settings-form') {
    e.preventDefault();
    const target = e.target;
    try {
      const isSettings = target.id === 'settings-form';
      const isGroup = target.id === 'group-form';
      const endpoint = isSettings ? '/api/settings' : (isGroup ? '/api/groups' : '/api/routes');
      const method = isSettings ? 'PUT' : 'POST';

      await api(endpoint, {
        method,
        body: JSON.stringify(Object.fromEntries(new FormData(target)))
      });

      if (isSettings) {
        alert('Configurações salvas com sucesso!');
        load('settings');
      } else {
        load('groups');
      }
    } catch (x) {
      alert(x.message);
    }
  }
});

document.addEventListener('click', async e => {
  if (e.target.id === 'test-evo' || e.target.id === 'test-shop') {
    const isEvo = e.target.id === 'test-evo';
    const btn = e.target;
    btn.disabled = true;
    const oldText = btn.textContent;
    btn.textContent = 'Testando...';
    try {
      const d = await api(`/api/test/${isEvo ? 'evolution' : 'shopee'}`, { method: 'POST' });
      if (d.ok) {
        alert(`✅ ${isEvo ? 'Evolution API conectada e aprovada!' : 'Shopee Affiliate API autenticada com sucesso!'}`);
      } else {
        alert(`❌ Falha no teste: ${d.error || 'Não foi possível conectar'}`);
      }
    } catch (x) {
      alert(`❌ Erro: ${x.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = oldText;
    }
  }

  if (e.target.id === 'fetch-evo-groups') {
    const btn = e.target;
    const select = $('#evo-group-select');
    btn.disabled = true;
    btn.textContent = 'Buscando grupos na Evolution...';
    try {
      const data = await api('/api/evolution/groups');
      const groups = Array.isArray(data) ? data : (data.groups || data.data || []);
      if (!groups || groups.length === 0) {
        alert('Nenhum grupo foi retornado pela Evolution API para esta instância.');
        return;
      }
      select.innerHTML = '<option value="">Selecione um grupo encontrado...</option>' + groups.map(g => {
        const id = g.id || g.remoteJid || g.jid || '';
        const name = g.subject || g.name || id;
        return `<option value="${esc(id)}" data-name="${esc(name)}">${esc(name)} (${esc(id)})</option>`;
      }).join('');
      select.style.display = 'block';
    } catch (err) {
      alert(`Erro ao buscar grupos: ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = '🔍 Buscar grupos conectados na Evolution API';
    }
  }
});

document.addEventListener('change', e => {
  if (e.target.id === 'evo-group-select') {
    const opt = e.target.selectedOptions[0];
    if (opt && opt.value) {
      const idInput = $('#group-id-input');
      const nameInput = $('#group-name-input');
      if (idInput) idInput.value = opt.value;
      if (nameInput) nameInput.value = opt.dataset.name || '';
    }
  }
});

boot();
