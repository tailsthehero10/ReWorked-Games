import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const app = express();
const port = process.env.PORT || 3000;
const groupId = 223811537;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROBLOX = 'https://www.roblox.com';
const cache = { value: null, expiresAt: 0 };
const oauthStates = new Map();
const sessions = new Map();

app.disable('x-powered-by');
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h', extensions: ['html'] }));

async function roblox(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'User-Agent': 'ReWorked-Games-Hub/1.0', Accept: 'application/json', ...options.headers },
    signal: AbortSignal.timeout(9000)
  });
  if (!response.ok) throw new Error(`Roblox returned ${response.status}`);
  return response.json();
}

function cookies(request) {
  return Object.fromEntries((request.headers.cookie || '').split(';').filter(Boolean).map((part) => {
    const [key, ...value] = part.trim().split('=');
    return [key, decodeURIComponent(value.join('='))];
  }));
}

function oauthConfiguration() {
  const { ROBLOX_CLIENT_ID: clientId, ROBLOX_CLIENT_SECRET: clientSecret, ROBLOX_REDIRECT_URI: redirectUri } = process.env;
  return clientId && clientSecret && redirectUri ? { clientId, clientSecret, redirectUri } : null;
}

function pruneAuthData() {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [key, value] of oauthStates) if (value.createdAt < cutoff) oauthStates.delete(key);
  for (const [key, value] of sessions) if (value.createdAt < cutoff) sessions.delete(key);
}

async function getCommunity() {
  if (cache.value && Date.now() < cache.expiresAt) return { ...cache.value, cached: true };

  const [group, rolesPayload, gamesPayload, groupIcons] = await Promise.all([
    roblox(`https://groups.roblox.com/v1/groups/${groupId}`),
    roblox(`https://groups.roblox.com/v1/groups/${groupId}/roles`),
    roblox(`https://games.roblox.com/v2/groups/${groupId}/games?accessFilter=Public&limit=50&sortOrder=Desc`),
    roblox(`https://thumbnails.roblox.com/v1/groups/icons?groupIds=${groupId}&size=420x420&format=Png&isCircular=false`)
  ]);

  const rawGames = gamesPayload.data || [];
  const universeIds = rawGames.map((game) => game.id).join(',');
  const [gameDetails, gameIcons] = universeIds ? await Promise.all([
    roblox(`https://games.roblox.com/v1/games?universeIds=${universeIds}`),
    roblox(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeIds}&size=512x512&format=Png&isCircular=false`)
  ]) : [{ data: [] }, { data: [] }];

  const detailsById = new Map((gameDetails.data || []).map((game) => [game.id, game]));
  const iconsById = new Map((gameIcons.data || []).map((icon) => [icon.targetId, icon.imageUrl]));
  const games = rawGames.map((game) => {
    const details = detailsById.get(game.id) || {};
    return {
      id: game.id,
      name: game.name,
      description: game.description,
      placeId: game.rootPlace?.id,
      visits: details.visits ?? game.placeVisits ?? 0,
      playing: details.playing ?? 0,
      favorites: details.favoritedCount ?? 0,
      created: game.created,
      updated: game.updated,
      icon: iconsById.get(game.id) || null,
      url: game.rootPlace?.id ? `${ROBLOX}/games/${game.rootPlace.id}` : `${ROBLOX}/games/${game.id}`
    };
  });

  const value = {
    group: {
      id: group.id,
      name: group.name,
      description: group.description,
      memberCount: group.memberCount,
      owner: group.owner,
      shout: group.shout,
      publicEntryAllowed: group.publicEntryAllowed,
      icon: groupIcons.data?.[0]?.imageUrl || null,
      url: `${ROBLOX}/communities/${groupId}/ReWorked-Games`
    },
    roles: (rolesPayload.roles || []).filter((role) => role.memberCount > 0),
    games,
    fetchedAt: new Date().toISOString(),
    cached: false
  };
  cache.value = value;
  cache.expiresAt = Date.now() + 4 * 60 * 1000;
  return value;
}

app.get('/api/community', async (_request, response) => {
  try {
    response.set('Cache-Control', 'public, max-age=60, s-maxage=240');
    response.json(await getCommunity());
  } catch (error) {
    console.error('Could not fetch Roblox community data:', error.message);
    if (cache.value) return response.status(200).json({ ...cache.value, stale: true });
    response.status(502).json({ error: 'Live Roblox data is temporarily unavailable. Please try again shortly.' });
  }
});

app.get('/api/health', (_request, response) => response.json({ status: 'ok' }));

app.get('/api/member', async (request, response) => {
  const username = String(request.query.username || '').trim();
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) return response.status(400).json({ error: 'Enter a valid Roblox username.' });
  try {
    const users = await roblox('https://users.roblox.com/v1/usernames/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: [username], excludeBannedUsers: false })
    });
    const user = users.data?.[0];
    if (!user) return response.status(404).json({ error: 'No Roblox account was found with that username.' });
    const [memberships, avatars] = await Promise.all([
      roblox(`https://groups.roblox.com/v2/users/${user.id}/groups/roles`),
      roblox(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${user.id}&size=150x150&format=Png&isCircular=false`)
    ]);
    const membership = memberships.data?.find((entry) => entry.group?.id === groupId);
    response.json({
      user: { id: user.id, name: user.name, displayName: user.displayName, profile: `${ROBLOX}/users/${user.id}/profile`, avatar: avatars.data?.[0]?.imageUrl || null },
      membership: membership ? { role: membership.role, source: 'public' } : null,
      note: membership ? 'This is the public role currently exposed by Roblox. Multiple-role details require authorized Group API access.' : 'This account is not currently listed as a member of ReWorked-Games.'
    });
  } catch (error) {
    console.error('Could not look up group member:', error.message);
    response.status(502).json({ error: 'Roblox member data is temporarily unavailable. Please try again.' });
  }
});

app.get('/auth/roblox', (request, response) => {
  const config = oauthConfiguration();
  if (!config) return response.redirect('/account?error=not_configured');
  pruneAuthData();
  const state = crypto.randomBytes(24).toString('base64url');
  const nonce = crypto.randomBytes(24).toString('base64url');
  oauthStates.set(state, { nonce, createdAt: Date.now() });
  const authorize = new URL('https://apis.roblox.com/oauth/v1/authorize');
  authorize.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri, response_type: 'code', scope: 'openid profile', state, nonce, prompt: 'select_account' }).toString();
  response.redirect(authorize.toString());
});

app.get('/auth/roblox/callback', async (request, response) => {
  const config = oauthConfiguration();
  const state = String(request.query.state || '');
  const pending = oauthStates.get(state);
  oauthStates.delete(state);
  if (!config || !pending || !request.query.code) return response.redirect('/account?error=authorization_failed');
  try {
    const tokenResponse = await fetch('https://apis.roblox.com/oauth/v1/token', {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code: String(request.query.code), redirect_uri: config.redirectUri }),
      signal: AbortSignal.timeout(9000)
    });
    if (!tokenResponse.ok) throw new Error(`Token exchange returned ${tokenResponse.status}`);
    const tokens = await tokenResponse.json();
    const profile = await roblox('https://apis.roblox.com/oauth/v1/userinfo', { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    const sessionId = crypto.randomBytes(32).toString('base64url');
    sessions.set(sessionId, { createdAt: Date.now(), profile: { id: profile.sub, name: profile.preferred_username, displayName: profile.name, profile: profile.profile } });
    response.cookie('rw_session', sessionId, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 1000 });
    response.redirect('/account?connected=1');
  } catch (error) {
    console.error('Roblox OAuth callback failed:', error.message);
    response.redirect('/account?error=authorization_failed');
  }
});

app.get('/api/account', (request, response) => {
  pruneAuthData();
  const session = sessions.get(cookies(request).rw_session);
  response.json({ connected: Boolean(session), profile: session?.profile || null, oauthEnabled: Boolean(oauthConfiguration()) });
});

app.post('/auth/logout', (request, response) => {
  sessions.delete(cookies(request).rw_session);
  response.clearCookie('rw_session');
  response.status(204).end();
});
app.get('*', (_request, response) => response.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(port, () => console.log(`ReWorked Games Hub running on port ${port}`));
