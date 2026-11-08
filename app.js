const $ = s => document.querySelector(s);

let device = { mac: '', key: '' };
const API_BASE = 'https://roku-backend-iptv.vercel.app/api/dispositivos';
const ADDON_API_BASE = 'https://roku-backend-iptv.vercel.app/api/addons';

function setStatus(id, msg, ok = false) {
  const el = $(id);
  if (!el) return;
  const prefix = ok ? '✓ ' : '⚠ ';
  el.textContent = prefix + msg;
  el.classList.remove('hidden');
  el.style.color = ok ? '#7ee2b8' : '#ff9aa9';
  el.style.display = 'block';
}

function normalizeMac(value) {
  const raw = String(value || '').trim().toUpperCase();
  const hexOnly = raw.replace(/[^0-9A-F]/g, '');
  if (hexOnly.length === 12) {
    return hexOnly.match(/.{1,2}/g).join(':');
  }
  return raw;
}

function normalizeKey(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 6);
}

function ensureHttpUrl(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  if (!/^https?:\/\//i.test(trimmed)) return 'http://' + trimmed;
  return trimmed;
}

function credentials() {
  return { mac: device.mac, key: device.key };
}

async function parseResponse(r) {
  const text = await r.text();
  let j = {};
  try {
    j = text ? JSON.parse(text) : {};
  } catch {
    throw new Error('El servidor respondió en un formato inesperado.');
  }
  if (!r.ok) throw new Error(j.error || 'Error del servidor');
  return j;
}

async function apiGet() {
  const u = `${API_BASE}?action=get&mac=${encodeURIComponent(device.mac)}&key=${encodeURIComponent(device.key)}&_t=${Date.now()}`;
  const r = await fetch(u, { cache: 'no-store' });
  return parseResponse(r);
}

async function apiPost(body) {
  const r = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return parseResponse(r);
}

function friendlyDeviceError(message) {
  const raw = String(message || '');
  const lower = raw.toLowerCase();

  if (
    lower.includes('no coincide') ||
    lower.includes('does not match') ||
    lower.includes('invalid key') ||
    lower.includes('device key')
  ) {
    return 'La MAC está registrada con otro Device Key. Verifica en Aura TV → Configuración la clave actual de tu TV.';
  }

  return raw || 'No fue posible vincular el dispositivo.';
}

function renderEmptyPlaylists(messageTitle, messageSub) {
  const list = $('#playlistList');
  if (!list) return;
  list.classList.remove('has-items');
  list.innerHTML = `
    <div class="empty-state">
      <div class="empty-art"><i></i><i></i><i></i></div>
      <h4>${messageTitle || 'Aquí comienza tu colección.'}</h4>
      <p>${messageSub || 'Conecta tu TV para ver tus listas<br>y tener todo a mano.'}</p>
      <span>M3U · XTREAM</span>
    </div>`;
}

function renderEmptyAddons(messageTitle, messageSub) {
  const list = $('#addonList');
  if (!list) return;
  list.classList.remove('has-items');
  list.innerHTML = `
    <div class="empty-state">
      <div class="addon-empty-icon">＋</div>
      <h4>${messageTitle || 'Una experiencia más tuya.'}</h4>
      <p>${messageSub || 'Conecta tu TV para consultar<br>y organizar tus add-ons.'}</p>
      <span>CATÁLOGOS · METADATOS</span>
    </div>`;
}

async function loadPlaylists() {
  if (!device.mac || !device.key) return;

  const list = $('#playlistList');
  list.classList.remove('has-items');
  list.innerHTML = `
    <div class="empty-state">
      <div class="empty-art"><i></i><i></i><i></i></div>
      <h4>Sincronizando colección...</h4>
      <p>Consultando las listas vinculadas a tu pantalla.</p>
      <span>CLOUD SYNC</span>
    </div>`;

  try {
    const data = await apiGet();
    render(data.playlists || []);
  } catch (e) {
    renderEmptyPlaylists('No se pudo cargar tu colección', friendlyDeviceError(e.message));
  }
}

function render(items) {
  const list = $('#playlistList');
  if (!list) return;

  if (!items || !items.length) {
    renderEmptyPlaylists(
      'Aún no tienes listas guardadas.',
      'Usa el panel de la izquierda para añadir tu primera cuenta Xtream o enlace M3U.'
    );
    return;
  }

  list.innerHTML = '';
  list.classList.add('has-items');

  items.forEach(p => {
    const card = document.createElement('div');
    card.className = 'collection-card';

    const left = document.createElement('div');
    left.className = 'collection-card-left';

    const icon = document.createElement('div');
    icon.className = 'collection-card-icon';
    icon.textContent = (p.type || 'xtream').toLowerCase() === 'm3u' ? 'M3U' : 'XT';

    const textWrap = document.createElement('div');
    textWrap.className = 'collection-card-text';

    const title = document.createElement('b');
    title.className = 'collection-card-title';
    title.textContent = p.name || 'Mi Lista TV';

    const meta = document.createElement('small');
    meta.className = 'collection-card-meta';
    const srcText = p.url || p.host || '';
    meta.textContent = (p.type || 'xtream').toUpperCase() + (srcText ? ` · ${srcText}` : '');

    textWrap.append(title, meta);
    left.append(icon, textWrap);

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'collection-delete-btn';
    del.textContent = 'Eliminar';
    del.onclick = async () => {
      if (!confirm(`¿Seguro que quieres eliminar "${p.name || 'esta lista'}"?`)) return;
      try {
        del.disabled = true;
        del.textContent = '...';
        await apiPost({ ...credentials(), action: 'delete', id: p.id });
        await loadPlaylists();
      } catch (e) {
        alert(e.message);
        del.disabled = false;
        del.textContent = 'Eliminar';
      }
    };

    card.append(left, del);
    list.append(card);
  });
}

$('#deviceKey').addEventListener('input', e => {
  e.target.value = normalizeKey(e.target.value);
});

$('#mac').addEventListener('blur', e => {
  e.target.value = normalizeMac(e.target.value);
});

$('#connectBtn').onclick = async () => {
  device.mac = normalizeMac($('#mac').value);
  device.key = normalizeKey($('#deviceKey').value);

  $('#mac').value = device.mac;
  $('#deviceKey').value = device.key;

  if (!device.mac || device.key.length !== 6) {
    setStatus('#deviceStatus', 'Ingresa la MAC y el Device Key de 6 dígitos que aparecen en tu TV.');
    return;
  }

  const btn = $('#connectBtn');
  try {
    if (btn) btn.disabled = true;
    setStatus('#deviceStatus', 'Verificando y conectando con tu TV...', true);
    await apiGet();

    setStatus('#deviceStatus', `TV vinculado (${device.mac}). Ya puedes gestionar tus listas abajo.`, true);
    localStorage.setItem('aura_mac', device.mac);
    localStorage.setItem('aura_key', device.key);

    await Promise.all([
      loadPlaylists(),
      loadAddons()
    ]);
  } catch (e) {
    setStatus('#deviceStatus', friendlyDeviceError(e.message));
  } finally {
    if (btn) btn.disabled = false;
  }
};

$('#refreshWebBtn').onclick = () => {
  if (!device.mac || !device.key) {
    setStatus('#deviceStatus', 'Primero vincula tu TV con su MAC y Device Key.');
    document.getElementById('device')?.scrollIntoView({ behavior: 'smooth' });
    return;
  }
  loadPlaylists();
};

$('#playlistForm').onsubmit = async e => {
  e.preventDefault();

  if (!device.mac || !device.key) {
    const typedMac = normalizeMac($('#mac').value);
    const typedKey = normalizeKey($('#deviceKey').value);
    if (typedMac && typedKey.length === 6) {
      device.mac = typedMac;
      device.key = typedKey;
    } else {
      setStatus('#uploadStatus', 'Primero conecta tu TV con su MAC y Device Key en el Paso 01.');
      document.getElementById('device')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
  }

  const isXtream = !$('#xtreamFields').classList.contains('hidden');
  const activeMode = isXtream ? 'xtream' : 'm3u';
  const rawName = $('#playlistName').value.trim();
  const cleanHost = ensureHttpUrl($('#host').value);
  const cleanUrl = ensureHttpUrl($('#playlistUrl').value);

  const playlist = {
    id: 'web-' + Date.now(),
    name: rawName || 'Mi Lista TV',
    type: activeMode,
    host: activeMode === 'xtream' ? cleanHost : '',
    username: $('#username').value.trim(),
    password: $('#password').value,
    url: activeMode === 'm3u' ? cleanUrl : ''
  };

  if (activeMode === 'xtream' && (!playlist.host || !playlist.username || !playlist.password)) {
    setStatus('#uploadStatus', 'Para Cuenta Xtream, completa Servidor, Usuario y Contraseña.');
    return;
  }

  if (activeMode === 'm3u' && !playlist.url) {
    setStatus('#uploadStatus', 'Para Enlace M3U, pega la dirección de tu lista (.m3u / .m3u8).');
    return;
  }

  const submitBtn = $('#savePlaylistBtn');
  try {
    if (submitBtn) submitBtn.disabled = true;
    setStatus('#uploadStatus', 'Guardando y sincronizando con tu TV...', true);
    await apiPost({ ...credentials(), action: 'upsert', playlist });
    setStatus('#uploadStatus', '¡Lista guardada! En menos de 3 segundos aparecerá en tu TV.', true);
    e.target.reset();
    await loadPlaylists();
  } catch (e) {
    setStatus('#uploadStatus', friendlyDeviceError(e.message));
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
};

// Switch entre Cuenta Xtream y Enlace M3U
document.querySelectorAll('.source-switch .tab').forEach(tab => {
  tab.addEventListener('click', e => {
    e.preventDefault();

    document.querySelectorAll('.source-switch .tab').forEach(t => {
      t.classList.remove('active');
    });
    tab.classList.add('active');

    if (tab.dataset.mode === 'xtream') {
      $('#xtreamFields').classList.remove('hidden');
      $('#m3uFields').classList.add('hidden');
    } else {
      $('#xtreamFields').classList.add('hidden');
      $('#m3uFields').classList.remove('hidden');
    }
  });
});

// Selector de Sistema Operativo en Descargas (#downloads)
function selectDownloadOsTab(osName) {
  document.querySelectorAll('.os-tab').forEach(btn => {
    const isTarget = btn.dataset.osTab === osName;
    btn.classList.toggle('active', isTarget);
  });

  ['mobile', 'android', 'samsung', 'roku', 'desktop'].forEach(panelId => {
    const panel = document.querySelector(`#os-panel-${panelId}`);
    if (!panel) return;
    panel.classList.toggle('hidden', panelId !== osName);
  });
}

document.querySelectorAll('.os-tab').forEach(btn => {
  btn.addEventListener('click', e => {
    e.preventDefault();
    selectDownloadOsTab(btn.dataset.osTab);
  });
});

(function autoDetectVisitorOs() {
  const ua = navigator.userAgent || '';
  const isSamsungTv = /Tizen|SMART-TV|SamsungBrowser/i.test(ua);
  const isAndroidTv = /Android.*(TV|AFT|BRAVIA|GoogleTV|MIBOX|Shield)/i.test(ua);
  const isAndroidMobile = /Android/i.test(ua) && !isAndroidTv;
  if (isSamsungTv) {
    selectDownloadOsTab('samsung');
    // En el navegador del TV Samsung, las descargas de archivos (<a download>) están bloqueadas por Tizen ("Esta función no es compatible").
    // Si el usuario hace clic desde el propio TV en un botón de descarga de PC, lo llevamos directo a la app web de Samsung.
    document.querySelectorAll('.pc-only-download').forEach(link => {
      link.removeAttribute('download');
      link.addEventListener('click', ev => {
        ev.preventDefault();
        window.location.href = 'samsung/index.html';
      });
    });
  } else if (/Roku/i.test(ua)) {
    selectDownloadOsTab('roku');
  } else if (isAndroidMobile) {
    selectDownloadOsTab('mobile');
  } else {
    selectDownloadOsTab('android');
  }
})();

// Lectura automática de ?mac=...&key=... desde QR o localStorage
const urlParams = new URLSearchParams(window.location.search);
const qrMac = urlParams.get('mac');
const qrKey = urlParams.get('key');

const savedMac = qrMac || localStorage.getItem('aura_mac');
const savedKey = qrKey || localStorage.getItem('aura_key');

if (savedMac) {
  device.mac = normalizeMac(savedMac);
  $('#mac').value = device.mac;
}

if (savedKey) {
  device.key = normalizeKey(savedKey);
  $('#deviceKey').value = device.key;
}

(async function restoreLinkedDevice() {
  if (!device.mac || device.key.length !== 6) return;

  try {
    await apiGet();
    setStatus('#deviceStatus', `TV conectado (${device.mac}).`, true);
    await Promise.all([
      loadPlaylists(),
      loadAddons()
    ]);
  } catch (e) {
    setStatus('#deviceStatus', friendlyDeviceError(e.message));
  }
})();

async function addonGet(params = {}) {
  const qs = new URLSearchParams({
    mac: device.mac,
    key: device.key,
    _t: String(Date.now()),
    ...params
  });
  const r = await fetch(`${ADDON_API_BASE}?${qs.toString()}`, { cache: 'no-store' });
  return parseResponse(r);
}

async function addonPost(body) {
  const r = await fetch(ADDON_API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...credentials(), ...body })
  });
  return parseResponse(r);
}

async function loadAddons() {
  const list = document.querySelector('#addonList');
  if (!list) return;

  if (!device.mac || !device.key) {
    renderEmptyAddons();
    return;
  }

  list.classList.remove('has-items');
  list.innerHTML = `
    <div class="empty-state">
      <div class="addon-empty-icon">↻</div>
      <h4>Sincronizando add-ons...</h4>
      <p>Consultando catálogos instalados en tu TV.</p>
      <span>CLOUD SYNC</span>
    </div>`;

  try {
    const data = await addonGet({ action: 'list' });
    renderAddons(data.addons || []);
  } catch (e) {
    renderEmptyAddons('No se pudieron cargar tus add-ons', friendlyDeviceError(e.message));
  }
}

function renderAddons(items) {
  const list = document.querySelector('#addonList');
  if (!list) return;

  if (!items || !items.length) {
    renderEmptyAddons(
      'No tienes add-ons instalados.',
      'Pega un enlace terminado en manifest.json a la izquierda para comenzar.'
    );
    return;
  }

  list.innerHTML = '';
  list.classList.add('has-items');

  items.forEach(addon => {
    const card = document.createElement('div');
    card.className = 'collection-card';

    const left = document.createElement('div');
    left.className = 'collection-card-left';

    const logoWrap = document.createElement('div');
    logoWrap.className = 'collection-card-icon';

    if (addon.logo) {
      const img = document.createElement('img');
      img.src = addon.logo;
      img.alt = addon.name || 'Add-on';
      img.referrerPolicy = 'no-referrer';
      img.onerror = function () {
        this.remove();
        logoWrap.textContent = '＋';
      };
      logoWrap.appendChild(img);
    } else {
      logoWrap.textContent = '＋';
    }

    const middle = document.createElement('div');
    middle.className = 'collection-card-text';

    const title = document.createElement('b');
    title.className = 'collection-card-title';
    title.textContent = addon.name || addon.id;

    const meta = document.createElement('small');
    meta.className = 'collection-card-meta';

    if (addon.mode === 'direct' && addon.status === 'pending_client') {
      meta.textContent = 'Acceso directo · validando desde tu TV';
    } else {
      const types = Array.isArray(addon.types) && addon.types.length
        ? addon.types.join(' · ')
        : 'catálogo externo';
      meta.textContent = `${addon.version || 'v1.0'} · ${types}`;
    }

    const cats = document.createElement('span');
    cats.className = 'collection-card-sub';
    if (addon.mode === 'direct' && addon.status === 'pending_client') {
      cats.textContent = 'Aura TV leerá este manifiesto desde la conexión de tu TV.';
    } else {
      cats.textContent = `${Array.isArray(addon.catalogs) ? addon.catalogs.length : 0} catálogo(s)`;
    }

    middle.append(title, meta, cats);
    left.append(logoWrap, middle);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'collection-delete-btn';
    remove.textContent = 'Eliminar';
    remove.onclick = async () => {
      if (!confirm(`¿Eliminar "${addon.name || 'este Add-on'}"?`)) return;
      try {
        remove.disabled = true;
        remove.textContent = '...';
        await addonPost({ action: 'remove', addonId: addon.id });
        await loadAddons();
      } catch (e) {
        alert(e.message);
        remove.disabled = false;
        remove.textContent = 'Eliminar';
      }
    };

    card.append(left, remove);
    list.append(card);
  });
}

async function installAddonFromWeb() {
  if (!device.mac || !device.key) {
    const typedMac = normalizeMac($('#mac').value);
    const typedKey = normalizeKey($('#deviceKey').value);
    if (typedMac && typedKey.length === 6) {
      device.mac = typedMac;
      device.key = typedKey;
    } else {
      setStatus('#addonStatus', 'Primero conecta tu TV con su MAC y Device Key en el Paso 01.');
      document.getElementById('device')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
  }

  const input = document.querySelector('#addonManifestUrl');
  const manifestUrl = ensureHttpUrl(input?.value || '');

  if (!manifestUrl || !/\/manifest\.json(?:[?#].*)?$/i.test(manifestUrl)) {
    setStatus('#addonStatus', 'Ingresa una dirección válida que termine en manifest.json.');
    return;
  }

  const btn = document.querySelector('#installAddonBtn');

  try {
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = 'Instalando... <span>↻</span>';
    }

    setStatus('#addonStatus', 'Validando e instalando add-on en tu TV...', true);

    const data = await addonPost({
      action: 'install',
      manifestUrl
    });

    if (data.directFallback) {
      setStatus(
        '#addonStatus',
        'Guardado para conexión directa desde tu Smart TV.',
        true
      );
    } else {
      setStatus(
        '#addonStatus',
        `Add-on "${data.addon?.name || 'instalado'}" listo y sincronizado.`,
        true
      );
    }

    if (input) input.value = '';
    await loadAddons();
  } catch (e) {
    setStatus(
      '#addonStatus',
      e.message || 'No fue posible instalar el Add-on.'
    );
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = 'Añadir a mi TV <span>＋</span>';
    }
  }
}

const installAddonBtn = document.querySelector('#installAddonBtn');
if (installAddonBtn) {
  installAddonBtn.addEventListener('click', installAddonFromWeb);
}

const addonManifestUrl = document.querySelector('#addonManifestUrl');
if (addonManifestUrl) {
  addonManifestUrl.addEventListener('keydown', async e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      await installAddonFromWeb();
    }
  });
}

const refreshAddonsBtn = document.querySelector('#refreshAddonsBtn');
if (refreshAddonsBtn) {
  refreshAddonsBtn.onclick = () => {
    if (!device.mac || !device.key) {
      setStatus('#deviceStatus', 'Primero vincula tu TV con su MAC y Device Key.');
      document.getElementById('device')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    loadAddons();
  };
}

// Workspace tabs: Mis listas vs Add-ons
const workspaceTabs = [...document.querySelectorAll('[data-panel]')];
function showWorkspacePanel(name, focus = false) {
  workspaceTabs.forEach(button => {
    const selected = button.dataset.panel === name;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
    const panel = document.getElementById(`panel-${button.dataset.panel}`);
    if (panel) panel.hidden = !selected;
    if (selected && focus) button.focus();
  });
}

workspaceTabs.forEach((button, index) => {
  button.addEventListener('click', () => showWorkspacePanel(button.dataset.panel));
  button.addEventListener('keydown', event => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? workspaceTabs.length - 1
        : (index + (event.key === 'ArrowRight' ? 1 : -1) + workspaceTabs.length) % workspaceTabs.length;
    showWorkspacePanel(workspaceTabs[next].dataset.panel, true);
  });
});

function syncWorkspaceHash() {
  if (location.hash === '#addons') {
    showWorkspacePanel('addons');
    document.getElementById('upload')?.scrollIntoView({ behavior: 'smooth' });
  } else if (location.hash === '#upload' || location.hash === '#playlists') {
    showWorkspacePanel('lists');
  }
}

window.addEventListener('hashchange', syncWorkspaceHash);
syncWorkspaceHash();
