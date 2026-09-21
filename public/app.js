const compactNumber = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const fullNumber = new Intl.NumberFormat('en-US');
const $ = (selector) => document.querySelector(selector);
<<<<<<< HEAD
const path = window.location.pathname.replace(/\/$/, '') || '/';
const gameRoute = path.match(/^\/game\/(\d+)\/[^/]+$/);
const pageByPath = { '/': 'about', '/games': 'games', '/experiences': 'games', '/roles': 'roles', '/account': 'account', '/ToS': 'tos', '/PrivacyPolicy': 'privacy' };
const activePage = gameRoute ? 'game' : (pageByPath[path] || 'about');
const titles = { about: 'ReWorked-Games - Roblox', games: 'Games - ReWorked-Games', roles: 'Roles - ReWorked-Games', account: 'Account - ReWorked-Games', tos: 'Terms of Service - ReWorked-Games', privacy: 'Privacy Policy - ReWorked-Games', game: 'Game - ReWorked-Games' };
=======
const pageByPath = { '/': 'about', '/games': 'games', '/experiences': 'games', '/roles': 'roles', '/account': 'account', '/ToS': 'tos', '/PrivacyPolicy': 'privacy' };
const activePage = pageByPath[window.location.pathname.replace(/\/$/, '') || '/'] || 'about';
>>>>>>> 05d67a57d8ee5eb98ddd929ba0b089cf73433800

function text(selector, value) { const element = $(selector); if (element) element.textContent = value; }
function description(value) { return (value || 'No description available.').replace(/[_]{5,}/g, '').replace(/\n{3,}/g, '\n\n').trim(); }
function gamePath(game) { const slug = game.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'game'; return `/game/${game.id}/${slug}`; }

function configurePage() {
  document.title = titles[activePage];
  document.querySelectorAll('[data-page]').forEach((link) => link.classList.toggle('active', link.dataset.page === activePage));
  document.querySelectorAll('[data-view]').forEach((view) => { view.hidden = !view.dataset.view.split(' ').includes(activePage); });
}

function renderGames(games) {
  const grid = $('#games-grid'); const template = $('#game-template');
  if (!grid || !template) return;
  grid.replaceChildren();
  games.forEach((game) => {
    const node = template.content.cloneNode(true);
    const image = node.querySelector('img');
    image.src = game.icon || ''; image.alt = `${game.name} game icon`;
    image.onerror = () => image.closest('.game-thumbnail').classList.add('image-fallback');
    node.querySelector('.game-visit b').textContent = `${compactNumber.format(game.visits)} visits`;
    node.querySelector('h3').textContent = game.name;
    node.querySelector('.game-info p').textContent = description(game.description);
    node.querySelector('.game-playing').textContent = game.playing ? `${fullNumber.format(game.playing)} playing` : 'Game';
    const details = node.querySelector('.game-details-link'); details.href = gamePath(game); details.setAttribute('aria-label', `View ${game.name} details`);
    const play = node.querySelector('.game-play-link'); play.href = game.url; play.setAttribute('aria-label', `Play ${game.name} on Roblox`);
    grid.append(node);
  });
<<<<<<< HEAD
  const empty = $('#no-games'); if (empty) empty.hidden = games.length !== 0;
}

function renderRoles(roles) {
  const roleList = $('#roles'); if (!roleList) return;
  roleList.replaceChildren();
  roles.sort((a, b) => b.rank - a.rank).slice(0, 12).forEach((role) => {
    const item = document.createElement('div'); item.className = 'role';
    const label = document.createElement('span'); const count = document.createElement('b');
    label.textContent = role.name; count.textContent = fullNumber.format(role.memberCount);
    item.append(label, count); roleList.append(item);
  });
}

function renderGameDetail(game) {
  if (activePage !== 'game') return;
  const loading = $('#game-detail-loading'); const detail = $('#game-detail');
  if (!game) { if (loading) loading.textContent = 'This game could not be found in ReWorked-Games.'; return; }
  if (loading) loading.hidden = true;
  if (detail) detail.hidden = false;
  const title = $('#game-detail-title');
  if (title) { title.textContent = game.name; title.classList.toggle('it-lurks-title', /it lurks remake/i.test(game.name)); }
  const icon = $('#game-detail-icon'); if (icon) { icon.src = game.icon || ''; icon.alt = `${game.name} game icon`; }
  text('#game-detail-description', description(game.description));
  text('#game-detail-playing', game.playing ? `${fullNumber.format(game.playing)} playing now` : 'No players online right now');
  text('#game-detail-visits', fullNumber.format(game.visits));
  text('#game-detail-favorites', fullNumber.format(game.favorites));
  text('#game-detail-updated', game.updated ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(game.updated)) : '—');
  const play = $('#game-detail-play'); if (play) play.href = game.url;
  document.title = `${game.name} - ReWorked-Games`;
=======
  const labels = { about: 'ReWorked-Games - Roblox', games: 'Games - ReWorked-Games', roles: 'Roles - ReWorked-Games', account: 'Account - ReWorked-Games', tos: 'Terms of Service - ReWorked-Games', privacy: 'Privacy Policy - ReWorked-Games' };
  document.title = labels[activePage];
>>>>>>> 05d67a57d8ee5eb98ddd929ba0b089cf73433800
}

function render(data) {
  const { group, games, roles } = data;
  text('#group-name', group.name); text('#member-count', fullNumber.format(group.memberCount)); text('#member-count-side', fullNumber.format(group.memberCount));
  text('#owner-name', group.owner?.displayName || group.owner?.username || '—');
  const owner = $('#owner-name'); if (owner && group.owner?.userId) owner.href = `https://www.roblox.com/users/${group.owner.userId}/profile`;
  text('#side-name', group.name); text('#game-count', fullNumber.format(games.length));
  text('#total-visits', compactNumber.format(games.reduce((sum, game) => sum + game.visits, 0))); text('#total-playing', compactNumber.format(games.reduce((sum, game) => sum + game.playing, 0))); text('#role-count', fullNumber.format(roles.length));
  text('#description', description(group.description)); text('#last-updated', `Updated ${new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date(data.fetchedAt))}`);
  document.querySelectorAll('[data-group-link]').forEach((link) => { link.href = group.url; });
  ['#group-icon', '#side-icon'].forEach((selector) => { const icon = $(selector); if (icon) { icon.src = group.icon || ''; icon.hidden = !group.icon; } });
  renderGames(games); renderRoles(roles); renderGameDetail(games.find((game) => game.id === Number(gameRoute?.[1])));
}

function renderMember(result) {
  const box = $('#member-result'); if (!box) return;
  box.replaceChildren();
  if (result.error) { box.className = 'member-result error-result'; box.textContent = result.error; return; }
  box.className = 'member-result';
  const identity = document.createElement('a'); identity.className = 'member-identity'; identity.href = result.user.profile; identity.target = '_blank'; identity.rel = 'noreferrer';
  if (result.user.avatar) { const avatar = document.createElement('img'); avatar.src = result.user.avatar; avatar.alt = ''; identity.append(avatar); }
  const name = document.createElement('span'); name.textContent = result.user.displayName || result.user.name; identity.append(name); box.append(identity);
  const role = document.createElement('div'); role.className = 'member-role'; role.textContent = result.membership ? `${result.membership.role.name} · Rank ${result.membership.role.rank}` : 'Not a member'; box.append(role);
  const note = document.createElement('p'); note.textContent = result.note; box.append(note);
}

async function lookupMember(event) {
  event.preventDefault(); const username = $('#member-username')?.value.trim(); if (!username) return;
  const box = $('#member-result'); box.className = 'member-result'; box.textContent = 'Checking Roblox…';
  try { const response = await fetch(`/api/member?username=${encodeURIComponent(username)}`); renderMember(await response.json()); } catch { renderMember({ error: 'We could not reach Roblox. Please try again.' }); }
}

async function loadAccount() {
  const state = $('#account-state'); const connect = $('#connect-button'); const logout = $('#logout-button'); if (!state || !connect || !logout) return;
  try {
    const data = await (await fetch('/api/account')).json();
    if (data.connected) { state.textContent = `Connected as ${data.profile.displayName || data.profile.name}.`; connect.hidden = true; logout.hidden = false; }
    else if (!data.oauthEnabled) { state.textContent = 'Account connection is being set up by the community owner.'; connect.classList.add('disabled'); connect.removeAttribute('href'); connect.setAttribute('aria-disabled', 'true'); }
    else if (new URLSearchParams(window.location.search).get('error')) state.textContent = 'Roblox could not complete the connection. Please try again.';
    else state.textContent = 'Connect your Roblox account securely through Roblox.';
  } catch { state.textContent = 'Account connection is temporarily unavailable.'; }
  logout.addEventListener('click', async () => { await fetch('/auth/logout', { method: 'POST' }); window.location.assign('/account'); }, { once: true });
}

async function loadCommunity() {
  const refresh = $('#refresh'); if (refresh) { refresh.disabled = true; refresh.textContent = 'Refreshing…'; }
  try { const response = await fetch('/api/community'); if (!response.ok) throw new Error(); render(await response.json()); }
  catch { const grid = $('#games-grid'); if (grid) grid.innerHTML = '<p class="error">We could not reach Roblox right now. Please refresh in a moment.</p>'; }
  finally { if (refresh) { refresh.disabled = false; refresh.textContent = 'Refresh'; } }
}

configurePage();
$('#refresh')?.addEventListener('click', loadCommunity);
$('#member-form')?.addEventListener('submit', lookupMember);
loadAccount();
loadCommunity();
