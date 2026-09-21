const number = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const fullNumber = new Intl.NumberFormat('en-US');
const $ = (selector) => document.querySelector(selector);

function setText(selector, value) { $(selector).textContent = value; }
function cleanDescription(text) { return (text || 'No description available.').replace(/[_]{5,}/g, '').replace(/\n{3,}/g, '\n\n').trim(); }

function render(data) {
  const { group, games, roles } = data;
  document.title = `${group.name} — Roblox Community`;
  setText('#group-name', group.name);
  setText('#member-count', fullNumber.format(group.memberCount));
  setText('#owner-name', group.owner?.displayName || group.owner?.username || '—');
  setText('#game-count', fullNumber.format(games.length));
  setText('#total-visits', number.format(games.reduce((sum, game) => sum + game.visits, 0)));
  setText('#total-playing', number.format(games.reduce((sum, game) => sum + game.playing, 0)));
  setText('#role-count', fullNumber.format(roles.length));
  $('#description').textContent = cleanDescription(group.description);
  $('#last-updated').textContent = `Updated ${new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date(data.fetchedAt))}`;
  document.querySelectorAll('[data-group-link]').forEach((link) => { link.href = group.url; });
  const icon = $('#group-icon');
  if (group.icon) { icon.src = group.icon; icon.hidden = false; } else { icon.hidden = true; }

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
    const link = node.querySelector('a'); link.href = game.url; link.setAttribute('aria-label', `Play ${game.name} on Roblox`);
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
async function load() {
  const refresh = $('#refresh'); refresh.disabled = true; refresh.innerHTML = 'Refreshing <span class="spin">↻</span>';
  try { const response = await fetch('/api/community'); if (!response.ok) throw new Error(); render(await response.json()); }
  catch { $('#games-grid').innerHTML = '<p class="error">We could not reach Roblox right now. Please refresh in a moment.</p>'; }
  finally { refresh.disabled = false; refresh.innerHTML = 'Refresh <span>↻</span>'; }
}
$('#refresh').addEventListener('click', load);
load();
