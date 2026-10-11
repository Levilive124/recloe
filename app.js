const $ = (s) => document.querySelector(s);
const toast = (message) => { const el = $('#toast'); el.textContent = message; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2600); };
let hostingKey = '';
const selectedDeployment = () => $('#deployment').value;
const hostingRequest = async (path, method = 'GET', body) => {
  const response = await fetch('/api/hosting', { method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hostingKey}` }, body: JSON.stringify({ path, method, body }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `API-Fehler ${response.status}`);
  return data;
};
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === `page-${name}`));
  document.querySelectorAll('.nav-item[data-page]').forEach(a => a.classList.toggle('active', a.dataset.page === name));
  const link = document.querySelector(`.nav-item[data-page="${name}"]`);
  $('#crumbPage').textContent = link ? link.textContent.trim() : 'Übersicht';
  history.replaceState(null, '', `#${name === 'overview' ? 'overview' : name}`);
}
document.querySelectorAll('.nav-item[data-page]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); showPage(a.dataset.page); }));
document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => showPage(b.dataset.go)));
document.querySelectorAll('.toggle').forEach(t => t.addEventListener('click', () => t.classList.toggle('on')));
document.querySelectorAll('.save-config').forEach(b => b.addEventListener('click', () => toast('Einstellungen für diese Demo gespeichert.')));
document.querySelectorAll('.add-row').forEach(b => b.addEventListener('click', () => toast('Dieses Element kann im Dashboard konfiguriert werden.')));
$('#inviteBtn').addEventListener('click', () => toast('Verbinde zuerst deinen Bot, um den Einladungslink zu erstellen.'));
$('#serverSelect').addEventListener('click', () => toast('Weitere Discord-Server erscheinen nach der OAuth-Anmeldung.'));
$('#showKey').addEventListener('click', () => { const key = $('#apiKey'); key.type = key.type === 'password' ? 'text' : 'password'; });
$('#connectBtn').addEventListener('click', async () => {
  hostingKey = $('#apiKey').value.trim();
  if (!hostingKey) return toast('Bitte gib deinen Bot-Hosting.net API-Key ein.');
  if (!hostingKey.startsWith('bhk_')) return toast('Der API-Key sollte mit bhk_ beginnen.');
  $('#connectBtn').textContent = 'Verbinde…';
  try {
    const data = await hostingRequest('/deployments');
    const deployments = data.deployments || [];
    const select = $('#deployment');
    select.innerHTML = '<option value="">Deployment auswählen…</option>';
    deployments.forEach(d => { const opt = document.createElement('option'); opt.value = d.id; opt.textContent = `${d.name || d.id} · ${d.state || d.status || 'Status unbekannt'}`; select.append(opt); });
    $('#connectionState').textContent = 'VERBUNDEN'; $('#connectionState').classList.add('connected');
    $('#connectBtn').textContent = 'Verbunden ✓';
    if (!deployments.length) toast('Verbindung steht. Für diesen API-Key wurden keine Deployments gefunden.'); else toast(`${deployments.length} Deployment(s) geladen.`);
  } catch (err) { hostingKey = ''; $('#connectBtn').innerHTML = 'Hosting verbinden <span>→</span>'; toast(err.message); }
});
$('#refreshDeployments').addEventListener('click', async () => {
  if (!hostingKey) return toast('Verbinde zuerst dein Hosting.');
  try { const data = await hostingRequest('/deployments'); const select = $('#deployment'); select.innerHTML = '<option value="">Deployment auswählen…</option>'; (data.deployments || []).forEach(d => { const o = document.createElement('option'); o.value = d.id; o.textContent = `${d.name || d.id} · ${d.state || 'Status unbekannt'}`; select.append(o); }); toast('Deployments aktualisiert.'); } catch (e) { toast(e.message); }
});
document.querySelectorAll('[data-power]').forEach(btn => btn.addEventListener('click', async () => {
  if (!hostingKey || !selectedDeployment()) return toast('Verbinde Hosting und wähle ein Deployment.');
  const action = btn.dataset.power;
  try { await hostingRequest(`/deployments/${encodeURIComponent(selectedDeployment())}/power`, 'POST', { action }); toast(`Aktion „${action}“ wurde gesendet.`); } catch (e) { toast(e.message); }
}));
$('#showLogs').addEventListener('click', async () => {
  if (!hostingKey || !selectedDeployment()) return toast('Verbinde Hosting und wähle ein Deployment.');
  $('#logs').textContent = 'Logs werden geladen…';
  try { const data = await hostingRequest(`/deployments/${encodeURIComponent(selectedDeployment())}/logs?size=100`); $('#logs').textContent = (data.lines || []).join('\n') || data.hint || 'Keine Logs verfügbar.'; } catch (e) { $('#logs').textContent = e.message; }
});
$('#saveToken').addEventListener('click', async () => {
  if (!hostingKey || !selectedDeployment()) return toast('Verbinde Hosting und wähle ein Deployment.');
  const token = $('#discordToken').value.trim();
  if (!token) return toast('Bitte gib deinen Discord Bot Token ein.');
  try { await hostingRequest(`/deployments/${encodeURIComponent(selectedDeployment())}/env`, 'POST', { key: 'DISCORD_TOKEN', value: token, secret: true }); $('#discordToken').value = ''; toast('Token als geheime Variable gespeichert. Starte den Bot neu, damit es aktiv wird.'); } catch (e) { toast(e.message); }
});
const initial = location.hash.slice(1); if (initial && document.querySelector(`#page-${initial}`)) showPage(initial);
