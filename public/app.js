const number = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const fullNumber = new Intl.NumberFormat('en-US');
const $ = (selector) => document.querySelector(selector);
const pageByPath = { '/': 'about', '/experiences': 'experiences', '/roles': 'roles', '/account': 'account' };
const activePage = pageByPath[window.location.pathname.replace(/\/$/, '') || '/'] || 'about';

function setText(selector, value) { $(selector).textContent = value; }
function cleanDescription(text) { return (text || 'No description available.').replace(/[_]{5,}/g, '').replace(/\n{3,}/g, '\n\n').trim(); }

function configurePage() {
  document.querySelectorAll('[data-page]').forEach((link) => link.classList.toggle('active', link.dataset.page === activePage));
  document.querySelectorAll('[data-view]').forEach((element) => {
    element.hidden = !element.dataset.view.split(' ').includes(activePage);
  });
  const labels = { about: 'ReWorked-Games - Roblox', experiences: 'Experiences - ReWorked-Games', roles: 'Roles - ReWorked-Games', account: 'Account - ReWorked-Games' };
  document.title = labels[activePage];
}

function render(data) {
  const { group, games, roles } = data;
  document.title = `${group.name} — Roblox Community`;
  setText('#group-name', group.name);
  setText('#member-count', fullNumber.format(group.memberCount));
  setText('#member-count-side', fullNumber.format(group.memberCount));
  setText('#owner-name', group.owner?.displayName || group.owner?.username || '—');
  $('#owner-name').href = group.owner?.userId ? `https://www.roblox.com/users/${group.owner.userId}/profile` : '#';
  $('#side-name').textContent = group.name;
  setText('#game-count', fullNumber.format(games.length));
  setText('#total-visits', number.format(games.reduce((sum, game) => sum + game.visits, 0)));
  setText('#total-playing', number.format(games.reduce((sum, game) => sum + game.playing, 0)));
  setText('#role-count', fullNumber.format(roles.length));
  $('#description').textContent = cleanDescription(group.description);
  $('#last-updated').textContent = `Updated ${new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date(data.fetchedAt))}`;
  document.querySelectorAll('[data-group-link]').forEach((link) => { link.href = group.url; });
  const icon = $('#group-icon');
  if (group.icon) {
    icon.src = group.icon;
    icon.hidden = false;
    $('#side-icon').src = group.icon;
  } else { icon.hidden = true; }

  const grid = $('#games-grid');
  const template = $('#game-template');
  grid.replaceChildren();
  games.forEach((game) => {
    const node = template.content.cloneNode(true);
    const img = node.querySelector('img');
    img.src = game.icon || '';
    img.alt = `${game.name} game icon`;
    img.onerror = () => img.closest('.game-image').classList.add('image-fallback');
    node.querySelector('.game-visit b').textContent = `${number.format(game.visits)} visits`;
    node.querySelector('h3').textContent = game.name;
    node.querySelector('.game-info p').textContent = cleanDescription(game.description);
    node.querySelector('.game-playing').textContent = game.playing ? `${fullNumber.format(game.playing)} playing` : 'Experience';
    node.querySelectorAll('a').forEach((link) => {
      link.href = game.url;
      link.setAttribute('aria-label', `Play ${game.name} on Roblox`);
    });
    grid.append(node);
  });
  $('#no-games').hidden = games.length !== 0;
  const roleList = $('#roles');
  roleList.replaceChildren();
  roles.sort((a, b) => b.rank - a.rank).slice(0, 9).forEach((role) => {
    const item = document.createElement('div'); item.className = 'role';
    item.innerHTML = `<span>${escapeHtml(role.name)}</span><b>${fullNumber.format(role.memberCount)}</b>`;
    roleList.append(item);
  });
}

function escapeHtml(value) { const el = document.createElement('span'); el.textContent = value; return el.innerHTML; }

function renderMember(result) {
  const box = $('#member-result');
  box.replaceChildren();
  if (result.error) { box.className = 'member-result error-result'; box.textContent = result.error; return; }
  box.className = 'member-result';
  const identity = document.createElement('a');
  identity.className = 'member-identity'; identity.href = result.user.profile; identity.target = '_blank'; identity.rel = 'noreferrer';
  if (result.user.avatar) { const avatar = document.createElement('img'); avatar.src = result.user.avatar; avatar.alt = ''; identity.append(avatar); }
  const name = document.createElement('span'); name.textContent = result.user.displayName || result.user.name; identity.append(name); box.append(identity);
  const role = document.createElement('div'); role.className = 'member-role';
  role.textContent = result.membership ? `${result.membership.role.name} · Rank ${result.membership.role.rank}` : 'Not a member';
  box.append(role);
  const note = document.createElement('p'); note.textContent = result.note; box.append(note);
}

async function lookupMember(event) {
  event.preventDefault();
  const username = $('#member-username').value.trim();
  const box = $('#member-result');
  box.className = 'member-result'; box.textContent = 'Checking Roblox…';
  try {
    const response = await fetch(`/api/member?username=${encodeURIComponent(username)}`);
    const data = await response.json();
    renderMember(data);
  } catch { renderMember({ error: 'We could not reach Roblox. Please try again.' }); }
}

async function loadAccount() {
  const state = $('#account-state');
  const connect = $('#connect-button');
  const logout = $('#logout-button');
  try {
    const response = await fetch('/api/account'); const data = await response.json();
    const query = new URLSearchParams(window.location.search);
    if (data.connected) {
      state.textContent = `Connected as ${data.profile.displayName || data.profile.name}.`;
      connect.hidden = true; logout.hidden = false;
    } else if (!data.oauthEnabled) {
      state.textContent = 'Account connection is being set up by the community owner.';
      connect.classList.add('disabled'); connect.href = '#'; connect.setAttribute('aria-disabled', 'true');
    } else if (query.get('error')) {
      state.textContent = 'Roblox could not complete the connection. Please try again.';
    } else {
      state.textContent = 'Connect your Roblox account securely through Roblox.';
    }
  } catch { state.textContent = 'Account connection is temporarily unavailable.'; }
  logout.addEventListener('click', async () => { await fetch('/auth/logout', { method: 'POST' }); window.location.assign('/account'); }, { once: true });
}
async function load() {
  const refresh = $('#refresh'); refresh.disabled = true; refresh.innerHTML = 'Refreshing <span class="spin">↻</span>';
  try { const response = await fetch('/api/community'); if (!response.ok) throw new Error(); render(await response.json()); }
  catch { $('#games-grid').innerHTML = '<p class="error">We could not reach Roblox right now. Please refresh in a moment.</p>'; }
  finally { refresh.disabled = false; refresh.innerHTML = 'Refresh <span>↻</span>'; }
}
$('#refresh').addEventListener('click', load);
$('#member-form').addEventListener('submit', lookupMember);
configurePage();
loadAccount();
load();
