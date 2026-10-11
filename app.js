const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const toastElement = $('#toast');
let toastTimer;
function toast(message) {
  toastElement.textContent = message;
  toastElement.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastElement.classList.remove('show'), 2400);
}

const roomInfo = {
  lobby: ['lobby', 'Ein bisschen von allem. Genau dafür ist das hier da.'],
  inspiration: ['inspiration', 'Dinge, die den Kopf ein bisschen weiter machen.'],
  screenshots: ['screenshots', 'Zeig, woran du gerade Freude hast.'],
  music: ['now-playing', 'Was läuft bei euch gerade auf Repeat?'],
};
const demoMessages = {
  lobby: [
    ['maya', 'Maya Chen', '10:42', 'Guten Morgen, ihr Lieben ☀️ Hat jemand Lust, heute Abend zusammen was zu zocken?', 'host'],
    ['jonas', 'Jonas Weber', '10:45', 'Bin dabei! Ich hab schon viel zu lange keinen entspannten Spieleabend mehr gehabt.'],
    ['mina', 'mina.mp3', '10:47', 'Same! Ich kann auch einen kleinen Hangout aufmachen, dann können wir erstmal quatschen und schauen worauf alle Lust haben 🫶'],
    ['nina', 'Nina 🌱', '11:03', 'Ich bring Snacks mit (also virtuell, aber die Absicht zählt) 🍿'],
  ],
  inspiration: [
    ['nina', 'Nina 🌱', '09:18', 'Kleiner Reminder: Ihr müsst nicht alles heute schaffen. Ein guter Gedanke reicht erstmal 🌱'],
    ['maya', 'Maya Chen', '09:26', 'Hab gestern dieses kleine Café am Kanal entdeckt. Große Fenster, Pflanzen überall, richtig gemütlich.'],
    ['jonas', 'Jonas Weber', '09:31', 'Das klingt genau nach einem Ort, an dem ich ein viel zu teures Notizbuch kaufen würde.'],
  ],
  screenshots: [
    ['jonas', 'Jonas Weber', '10:14', 'Hab den Sonnenaufgang heute zufällig vom Zug aus erwischt. Die Farben waren komplett unwirklich. 🌅'],
    ['mina', 'mina.mp3', '10:19', 'Das Licht! Sieht aus wie der Anfang von einem richtig guten Film.'],
  ],
  music: [
    ['mina', 'mina.mp3', '08:52', 'Mein aktueller Loop: irgendwas zwischen sanftem Jazz und Regen am Fenster 🎧'],
    ['maya', 'Maya Chen', '09:02', 'Morgens leise Musik und Kaffee ist eigentlich ein ganz eigener Lebensstil.'],
  ],
};
let activeRoom = { type: 'channel', id: 'lobby' };
let appUser = null;
let appSpaces = [];
let appChannels = [];
let appConversations = [];
let activeSpaceId = null;

async function api(path, method = 'GET', body) {
  const response = await fetch(path, { method, credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(data.error || `Anfrage fehlgeschlagen (${response.status}).`); error.status = response.status; throw error; }
  return data;
}
function authError(message) { const box = $('#authError'); box.textContent = message; box.classList.add('show'); }
function setAuthMode(register) {
  $('#authGate').classList.toggle('register', register);
  $('#authTitle').innerHTML = register ? 'Dein Platz ist<br><em>schon vorbereitet.</em>' : 'Schön, dass du<br><em>wieder da bist.</em>';
  $('#authSubtitle').textContent = register ? 'Erstelle dein Konto und finde deine Leute.' : 'Melde dich an und triff deine Leute.';
  $('#authPassword').autocomplete = register ? 'new-password' : 'current-password';
  $('#authSubmit').innerHTML = register ? 'Konto erstellen <span>→</span>' : 'Anmelden <span>→</span>';
  $('#authSwitchText').textContent = register ? 'Schon ein Konto?' : 'Noch kein Konto?';
  $('#authSwitch').textContent = register ? 'Anmelden' : 'Konto erstellen';
  $('#authConfirm').required = register;
  $('#authError').classList.remove('show');
}
$('#authSwitch').addEventListener('click', () => setAuthMode(!$('#authGate').classList.contains('register')));

async function loadChannel(channel) {
  activeRoom = { type: 'channel', id: channel.id, name: channel.name };
  $('#roomName').textContent = channel.name;
  const topic = roomInfo[channel.name]?.[1] || 'Ein neuer kleiner Ort für eure Gespräche.';
  $('#roomTopic').textContent = topic;
  $('#messageInput').placeholder = `Schreibe etwas in #${channel.name}`;
  const messages = $('#messages');
  messages.innerHTML = '<div class="day-divider"><span>HEUTE</span></div>';
  try {
    const { messages: items } = await api(`/api/messages?channelId=${encodeURIComponent(channel.id)}`);
    if (!items.length) {
      const welcome = document.createElement('div'); welcome.className = 'welcome-card';
      welcome.innerHTML = `<div class="welcome-icon">✳</div><div><b>Das hier ist #${escapeHtml(channel.name)}</b><p>${escapeHtml(topic)}</p></div>`;
      messages.append(welcome);
    }
    items.forEach(item => {
      const time = new Date(item.createdAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      const node = messageNode([item.userId === appUser?.id ? 'me' : 'maya', item.displayName, time, item.content], 0, channel.name);
      messages.append(node);
    });
  } catch (error) { toast(error.message); }
  messages.scrollTop = messages.scrollHeight;
}

function renderChannels() {
  const container = $('.voice-title');
  $$('.channel[data-channel]').forEach(button => button.remove());
  appChannels.filter(channel => channel.kind === 'text' && channel.spaceId === activeSpaceId).forEach(channel => {
    const button = document.createElement('button'); button.className = 'channel'; button.dataset.channel = channel.id;
    button.innerHTML = `<span class="channel-hash">#</span><span>${escapeHtml(channel.name)}</span>`;
    button.addEventListener('click', () => { $$('.channel').forEach(item => item.classList.toggle('active', item === button)); $$('.dm-row').forEach(item => item.classList.remove('selected')); loadChannel(channel); });
    container.before(button);
  });
}

function renderConversations() {
  $$('.dm-row').forEach(row => row.remove());
  appConversations.forEach(conversation => {
    const row = document.createElement('button'); row.className = 'dm-row'; row.dataset.conversation = conversation.id;
    const initial = escapeHtml(conversation.displayName?.[0] || conversation.email[0] || '?').toUpperCase();
    row.innerHTML = `<span class="avatar avatar-nina">${initial}</span><span class="dm-name">${escapeHtml(conversation.displayName || conversation.email)}</span>`;
    row.addEventListener('click', () => openConversation(conversation, row)); $('.dm-title').after(row);
  });
}

async function openConversation(conversation, row) {
  activeRoom = { type: 'dm', id: conversation.id, name: conversation.displayName || conversation.email };
  $$('.dm-row').forEach(item => item.classList.toggle('selected', item === row));
  $$('.channel').forEach(item => item.classList.remove('active'));
  $('#roomName').textContent = activeRoom.name; $('#roomTopic').textContent = 'Ein privater Chat nur für euch.'; $('#messageInput').placeholder = `Nachricht an ${activeRoom.name} schreiben`;
  const area = $('#messages'); area.innerHTML = '<div class="day-divider"><span>EUER CHAT</span></div>';
  try {
    const { messages } = await api(`/api/direct-messages?conversationId=${encodeURIComponent(conversation.id)}`);
    if (!messages.length) area.insertAdjacentHTML('beforeend', `<div class="welcome-card"><div class="welcome-icon">♡</div><div><b>Du und ${escapeHtml(activeRoom.name)}</b><p>Hier beginnt euer privater Chat.</p></div></div>`);
    messages.forEach(item => {
      const time = new Date(item.createdAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      area.append(messageNode([item.userId === appUser?.id ? 'me' : 'maya', item.displayName, time, item.content], 0, 'dm'));
    });
    area.scrollTop = area.scrollHeight;
  } catch (error) { toast(error.message); }
}

function renderSpaces() {
  $$('.rail-server').forEach(button => button.remove());
  appSpaces.forEach(space => {
    const button = document.createElement('button'); button.className = `rail-server${space.id === activeSpaceId ? ' selected' : ''}`; button.title = space.name; button.dataset.space = space.id;
    button.innerHTML = `<span class="space-pixel">${escapeHtml(space.name.charAt(0).toUpperCase())}</span>`;
    button.addEventListener('click', () => activateSpace(space)); $('#createSpace').before(button);
  });
}

async function activateSpace(space) {
  activeSpaceId = space.id; $('#spaceName').textContent = space.name; renderSpaces(); renderChannels();
  const first = appChannels.find(channel => channel.spaceId === space.id && channel.kind === 'text');
  if (first) { $$('.channel').forEach(button => button.classList.toggle('active', button.dataset.channel === first.id)); await loadChannel(first); }
}

async function startApp(user) {
  appUser = user;
  $('#loggedInName').textContent = user.displayName || user.email.split('@')[0];
  try {
    const data = await api('/api/bootstrap');
    appSpaces = data.spaces; appChannels = data.channels;
    const dmData = await api('/api/conversations'); appConversations = dmData.conversations;
    if (appSpaces[0]) activeSpaceId = appSpaces[0].id;
    renderSpaces(); renderChannels(); renderConversations();
    $('#authGate').classList.add('hidden'); $('.app-shell').style.visibility = 'visible';
    const initial = appChannels.find(channel => channel.spaceId === activeSpaceId && channel.name === 'lobby') || appChannels.find(channel => channel.spaceId === activeSpaceId);
    if (initial) { const button = $$('.channel').find(item => item.dataset.channel === initial.id); button?.classList.add('active'); await loadChannel(initial); }
  } catch (error) { $('.app-shell').style.visibility = 'hidden'; $('#authGate').classList.remove('hidden'); authError(error.message); }
}

$('#authForm').addEventListener('submit', async event => {
  event.preventDefault();
  const isRegister = $('#authGate').classList.contains('register');
  const email = $('#authEmail').value.trim(); const password = $('#authPassword').value;
  if (isRegister && password !== $('#authConfirm').value) return authError('Die Passwörter stimmen nicht überein.');
  const button = $('#authSubmit'); button.disabled = true; button.textContent = 'Einen Moment …'; $('#authError').classList.remove('show');
  try {
    const result = await api(isRegister ? '/api/auth/register' : '/api/auth/login', 'POST', { email, password, ...(isRegister ? { passwordConfirmation: $('#authConfirm').value } : {}) });
    $('#authPassword').value = ''; $('#authConfirm').value = '';
    await startApp(result.user);
  } catch (error) { authError(error.message); }
  finally { button.disabled = false; button.innerHTML = isRegister ? 'Konto erstellen <span>→</span>' : 'Anmelden <span>→</span>'; }
});
api('/api/auth/me').then(({ user }) => startApp(user)).catch(error => {
  if (error.status === 401) authError('Bitte melde dich an oder erstelle dein recloe-Konto.');
  else authError('Die Datenbank ist noch nicht verbunden. Lege eine MySQL-Datenbank an, führe schema.sql aus und setze DATABASE_URL in Vercel.');
});

function renderRoom(channel) {
  const info = roomInfo[channel] || [channel, 'Ein neuer kleiner Ort für eure Gespräche.'];
  $('#roomName').textContent = info[0];
  $('#roomTopic').textContent = info[1];
  $('#messageInput').placeholder = `Schreibe etwas in #${info[0]}`;
  const messages = $('#messages');
  messages.innerHTML = `<div class="day-divider"><span>HEUTE</span></div><div class="welcome-card"><div class="welcome-icon">✳</div><div><b>Das hier ist #${escapeHtml(info[0])}</b><p>${escapeHtml(info[1])}</p></div><button class="welcome-close" id="welcomeClose">×</button></div>`;
  (demoMessages[channel] || []).forEach((message, index) => messages.append(messageNode(message, index, channel)));
  const typing = document.createElement('div');
  typing.className = 'typing';
  typing.innerHTML = '<span><i></i><i></i><i></i></span> Maya tippt gerade';
  messages.append(typing);
  messages.scrollTop = 0;
  $('#welcomeClose').addEventListener('click', () => $('#welcomeClose').closest('.welcome-card').remove());
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
function messageNode(message, index, channel) {
  const [avatar, name, time, text, role] = message;
  const article = document.createElement('article');
  article.className = 'message';
  article.innerHTML = `<div class="avatar avatar-${avatar}">${avatar === 'nina' ? 'N' : avatar === 'jonas' ? 'J' : avatar === 'maya' ? 'M' : avatar === 'me' ? 'L' : 'M'}</div><div class="message-content"><div class="message-meta"><b>${escapeHtml(name)}</b>${role ? '<span class="role-chip">SPACE HOST</span>' : ''}<time>${escapeHtml(time)}</time></div><p>${escapeHtml(text)}</p>${channel === 'lobby' && (index === 1 || index === 3) ? `<div class="reaction-row"><button class="reaction">${index === 1 ? '🙌' : '🍿'} <span>${index === 1 ? '3' : '4'}</span></button><button class="reaction">${index === 1 ? '🎮' : '💜'} <span>2</span></button><button class="reaction add-reaction">＋</button></div>` : ''}</div>`;
  return article;
}
$('#messages').addEventListener('click', event => {
  const reaction = event.target.closest('.reaction');
  if (!reaction) return;
  if (reaction.classList.contains('add-reaction')) { reaction.textContent = '💜 1'; reaction.classList.remove('add-reaction'); }
  else { const count = reaction.querySelector('span'); if (count) count.textContent = String(Number(count.textContent) + 1); }
});
$$('.channel[data-channel]').forEach(button => button.addEventListener('click', () => {
  activeRoom = { type: 'channel', id: button.dataset.channel };
  $$('.channel[data-channel]').forEach(item => item.classList.toggle('active', item === button));
  $$('.dm-row').forEach(item => item.classList.remove('selected'));
  renderRoom(button.dataset.channel);
}));
async function addOwnMessage(value) {
  const text = value.trim();
  if (!text) return;
  if (activeRoom.type !== 'channel' && activeRoom.type !== 'dm') return;
  const input = $('#messageInput'); input.disabled = true;
  try {
    const result = activeRoom.type === 'channel'
      ? await api('/api/messages', 'POST', { channelId: activeRoom.id, content: text })
      : await api('/api/direct-messages', 'POST', { conversationId: activeRoom.id, content: text });
    const item = result.message;
    const time = new Date(item.createdAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const currentChannel = activeRoom.name || $('.channel.active span:nth-child(2)')?.textContent || 'lobby';
    const node = messageNode(['me', item.displayName, time, item.content], 0, currentChannel);
    $('#messages').append(node);
    input.value = '';
    $('#messages').scrollTop = $('#messages').scrollHeight;
  } catch (error) { toast(error.message); }
  finally { input.disabled = false; input.focus(); }
}
$('#messageForm').addEventListener('submit', event => { event.preventDefault(); addOwnMessage($('#messageInput').value); });
$('#messageInput').addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); $('#messageForm').requestSubmit(); } });
$('#welcomeClose').addEventListener('click', event => event.currentTarget.closest('.welcome-card').remove());

const dialog = $('#createDialog');
let dialogMode = 'space';
function openDialog(mode) {
  dialogMode = mode;
  const config = mode === 'space'
    ? ['ETWAS NEUES BEGINNT', 'Dein Space, deine Regeln.', 'Ein Ort für deine Lieblingsmenschen. Der Rest ergibt sich ganz von selbst.', 'Wie soll dein Space heißen?', 'z. B. The Loft', 'Space erstellen']
    : mode === 'channel'
      ? ['EIN NEUER ORT', 'Ein Kanal für eure Ideen.', 'Jeder gute Space hat Platz für Gespräche, die ihre eigene Ecke brauchen.', 'Wie soll der Kanal heißen?', 'z. B. filmabend', 'Kanal erstellen']
      : mode === 'voice'
        ? ['ZUSAMMEN ABHÄNGEN', 'Ein Hangout für eure Runde.', 'Erstelle einen Ort für spontane Gespräche. In dieser Vorschau ist Audio noch nicht verbunden.', 'Wie soll der Hangout heißen?', 'z. B. Spieleabend', 'Hangout vormerken']
        : ['HALLO, DU ZWEI.', 'Ein Gespräch beginnt hier.', 'Finde jemanden aus deinem Space und schreib los.', 'Wen möchtest du anschreiben?', 'Name eingeben', 'Chat öffnen'];
  $('#dialogKicker').textContent = config[0]; $('#dialogTitle').textContent = config[1]; $('#dialogText').textContent = config[2]; $('#dialogLabel').textContent = config[3]; $('#dialogInput').placeholder = config[4]; $('#dialogSubmit').innerHTML = `${config[5]} <span>→</span>`; $('#dialogInput').value = '';
  dialog.showModal(); setTimeout(() => $('#dialogInput').focus(), 0);
}
$('#createSpace').addEventListener('click', () => openDialog('space'));
$$('[data-add="channel"]').forEach(button => button.addEventListener('click', () => openDialog('channel')));
$$('[data-add="voice"]').forEach(button => button.addEventListener('click', () => openDialog('voice')));
$('#newDm').addEventListener('click', () => openDialog('dm'));
$('#dialogForm').addEventListener('submit', async event => {
  if (event.submitter?.value === 'cancel') return;
  event.preventDefault();
  const name = $('#dialogInput').value.trim(); if (!name) return;
  if (dialogMode === 'space') {
    try {
      const { space } = await api('/api/spaces', 'POST', { name }); appSpaces.push(space);
      const { channels } = await api(`/api/channels?spaceId=${encodeURIComponent(space.id)}`); appChannels.push(...channels);
      await activateSpace(space); toast(`Space „${name}“ wurde in MySQL gespeichert.`);
    } catch (error) { dialog.close(); return toast(error.message); }
  } else if (dialogMode === 'channel') {
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '');
    try {
      const activeSpace = appSpaces.find(space => space.id === activeSpaceId); if (!activeSpace) throw new Error('Erstelle erst einen Space.');
      const { channel: saved } = await api('/api/channels', 'POST', { spaceId: activeSpace.id, name: slug }); appChannels.push(saved);
      const channel = document.createElement('button'); channel.className = 'channel'; channel.dataset.channel = saved.id; channel.innerHTML = `<span class="channel-hash">#</span><span>${escapeHtml(saved.name)}</span>`; channel.addEventListener('click', () => { $$('.channel').forEach(item => item.classList.toggle('active', item === channel)); $$('.dm-row').forEach(item => item.classList.remove('selected')); loadChannel(saved); });
      $('.voice-title').before(channel); toast(`#${slug} wurde in MySQL gespeichert.`);
    } catch (error) { dialog.close(); return toast(error.message); }
  } else if (dialogMode === 'voice') { toast(`„${name}“ ist vorgemerkt — Audio kommt bald.`); }
  else {
    try {
      const { conversation } = await api('/api/conversations', 'POST', { email: name });
      if (!appConversations.some(item => item.id === conversation.id)) appConversations.unshift(conversation);
      renderConversations();
      const row = $$('.dm-row').find(item => item.dataset.conversation === conversation.id);
      await openConversation(conversation, row);
    } catch (error) { dialog.close(); return toast(error.message); }
  }
  dialog.close();
});
$('#voiceRoom').addEventListener('click', () => { $('#voiceLive').classList.remove('hidden'); toast('Hangout-Vorschau: Audio-Anrufe kommen in einem späteren Schritt.'); });
$('#callButton').addEventListener('click', () => { $('#voiceLive').classList.remove('hidden'); toast('Hangouts sind vorbereitet — Voice und Video kommen als nächster Ausbau.'); });
$('#leaveVoice').addEventListener('click', event => { event.stopPropagation(); $('#voiceLive').classList.add('hidden'); toast('Du hast den Hangout verlassen.'); });
$('#membersToggle').addEventListener('click', () => { const panel = $('#membersPanel'); panel.classList.toggle('open'); $('#membersToggle').classList.toggle('selected', panel.classList.contains('open')); });
$('#closeMembers').addEventListener('click', () => $('#membersPanel').classList.remove('open'));
$('#mobileMenu').addEventListener('click', () => { $('#sidebar').classList.add('open'); $('#mobileBackdrop').classList.add('show'); });
$('#mobileBackdrop').addEventListener('click', () => { $('#sidebar').classList.remove('open'); $('#mobileBackdrop').classList.remove('show'); });
$('#inviteButton').addEventListener('click', () => toast('Echte Einladungslinks kommen mit der Anmeldung.'));
$('#spaceSettings').addEventListener('click', () => toast('Space-Einstellungen kommen bald.'));
$('#spaceMenu').addEventListener('click', () => toast('Space-Menü geöffnet.'));
$('#inboxButton').addEventListener('click', () => toast('Du bist auf dem neuesten Stand.'));
$('#profileButton').addEventListener('click', () => toast('Dein Profil: Levi · bereit für alles ✨'));
$('#userCard').addEventListener('click', () => toast(appUser ? `${appUser.email} · deine Sitzung ist gespeichert.` : ''));
$('#logoutButton').addEventListener('click', async () => {
  try { await api('/api/auth/logout', 'POST', {}); }
  catch (error) { toast(error.message); return; }
  appUser = null; $('.app-shell').style.visibility = 'hidden'; $('#authGate').classList.remove('hidden'); setAuthMode(false); $('#authPassword').value = '';
});
$('#giftButton').addEventListener('click', () => toast('Kleine Überraschungen kommen bald.'));
$('#attachButton').addEventListener('click', () => toast('Dateien teilen kommt bald.'));
$('#emojiButton').addEventListener('click', () => { $('#messageInput').value += ' ✨'; $('#messageInput').focus(); });
$('#searchButton').addEventListener('click', () => { $('#quickSearch').focus(); toast('Suche in recloe'); });
$('#moreButton').addEventListener('click', () => toast('Weitere Chat-Optionen kommen bald.'));
$('#quickSearch').addEventListener('keydown', event => { if (event.key === 'Enter' && event.target.value.trim()) toast(`Suche nach „${event.target.value.trim()}“ — bald verfügbar.`); });
$$('[data-toast]').forEach(button => button.addEventListener('click', () => toast(button.dataset.toast)));
document.addEventListener('keydown', event => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); $('#quickSearch').focus(); } });
