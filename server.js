import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const app = express();
const port = process.env.PORT || 3000;
const groupId = 223811537;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROBLOX = 'https://www.roblox.com';
const ROBLOX_OAUTH = 'https://apis.roblox.com/oauth';
const OAUTH_STATE_COOKIE = 'rw_oauth_state';
const SESSION_COOKIE = 'rw_session';
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 60 * 60 * 1000;
const cache = { value: null, expiresAt: 0 };

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

function cookieOptions(maxAge) {
  return { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge };
}

function clearBrowserCookie(response, name) {
  response.clearCookie(name, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
}

function cookieEncryptionKey(config) {
  return crypto.createHash('sha256').update('rw-oauth-cookie-v1\0').update(config.clientSecret).digest();
}

function encryptCookieValue(config, value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', cookieEncryptionKey(config), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return ['v1', iv, ciphertext, cipher.getAuthTag()].map((part) => part.toString('base64url')).join('.');
}

function decryptCookieValue(config, value) {
  try {
    const parts = String(value || '').split('.');
    if (parts.length !== 4 || parts[0] !== 'v1') return null;
    const iv = Buffer.from(parts[1], 'base64url');
    const ciphertext = Buffer.from(parts[2], 'base64url');
    const tag = Buffer.from(parts[3], 'base64url');
    if (iv.length !== 12 || tag.length !== 16) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', cookieEncryptionKey(config), iv);
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8'));
  } catch {
    return null;
  }
}

function readOauthState(request, config) {
  if (!config) return null;
  const state = String(request.query.state || '');
  const pending = decryptCookieValue(config, cookies(request)[OAUTH_STATE_COOKIE]);
  const age = pending && typeof pending.createdAt === 'number' ? Date.now() - pending.createdAt : null;
  if (!pending || pending.state !== state || age === null || age < 0 || age > OAUTH_STATE_TTL_MS) return null;
  return pending;
}

function readSession(request, config) {
  if (!config) return null;
  const session = decryptCookieValue(config, cookies(request)[SESSION_COOKIE]);
  if (!session || typeof session.createdAt !== 'number' || !session.profile?.id) return null;
  const age = Date.now() - session.createdAt;
  if (age < 0 || age > SESSION_TTL_MS) return null;
  return session;
}

async function verifyRobloxIdToken(idToken, expectedNonce, clientId) {
  if (typeof idToken !== 'string') throw new Error('Roblox token response omitted id_token');
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('Roblox returned an invalid id_token');
  let header;
  let claims;
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    throw new Error('Roblox returned an invalid id_token');
  }
  if (header.alg !== 'ES256' || !header.kid) throw new Error('Roblox id_token has an unsupported signature');
  const jwks = await roblox(`${ROBLOX_OAUTH}/v1/certs`);
  const jwk = jwks.keys?.find((key) => key.kid === header.kid && key.alg === 'ES256');
  if (!jwk) throw new Error('Roblox id_token signing key was not found');
  const verifier = crypto.createVerify('sha256');
  verifier.update(`${parts[0]}.${parts[1]}`);
  verifier.end();
  if (!verifier.verify(crypto.createPublicKey({ key: jwk, format: 'jwk' }), parts[2], 'base64url')) throw new Error('Roblox id_token signature is invalid');
  const audienceMatches = Array.isArray(claims.aud) ? claims.aud.includes(clientId) : claims.aud === clientId;
  const now = Math.floor(Date.now() / 1000);
  if (claims.iss !== `${ROBLOX_OAUTH}/` || !audienceMatches || claims.nonce !== expectedNonce || typeof claims.exp !== 'number' || claims.exp <= now) throw new Error('Roblox id_token claims are invalid');
}

async function getGroupCover() {
  try {
    const profile = await roblox('https://apis.roblox.com/profile-platform-api/v1/profiles/get?urlLocale=en_us', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profileId: groupId,
        profileType: 'Community',
        components: [{ component: 'CoverPhoto' }],
        includeComponentOrdering: false
      })
    });
    const coverPhotoId = profile.components?.CoverPhoto?.coverPhotoId;
    if (!coverPhotoId) return null;
    const thumbnail = await roblox(`https://thumbnails.roblox.com/v1/assets?assetIds=${coverPhotoId}&returnPolicy=PlaceHolder&size=768x432&format=Png&isCircular=false`);
    return thumbnail.data?.[0]?.state === 'Completed' ? thumbnail.data[0].imageUrl : null;
  } catch (error) {
    console.warn('Could not fetch group cover:', error.message);
    return null;
  }
}

async function getCommunity() {
  if (cache.value && Date.now() < cache.expiresAt) return { ...cache.value, cached: true };

  const [group, rolesPayload, gamesPayload, groupIcons, cover] = await Promise.all([
    roblox(`https://groups.roblox.com/v1/groups/${groupId}`),
    roblox(`https://groups.roblox.com/v1/groups/${groupId}/roles`),
    roblox(`https://games.roblox.com/v2/groups/${groupId}/games?accessFilter=Public&limit=50&sortOrder=Desc`),
    roblox(`https://thumbnails.roblox.com/v1/groups/icons?groupIds=${groupId}&size=420x420&format=Png&isCircular=false`),
    getGroupCover()
  ]);

  const rawGames = gamesPayload.data || [];
  const universeIds = rawGames.map((game) => game.id).join(',');
  const [gameDetails, gameIcons, gameThumbnails] = universeIds ? await Promise.all([
    roblox(`https://games.roblox.com/v1/games?universeIds=${universeIds}`),
    roblox(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeIds}&size=512x512&format=Png&isCircular=false`),
    roblox(`https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=${universeIds}&size=768x432&format=Png&isCircular=false`)
  ]) : [{ data: [] }, { data: [] }, { data: [] }];

  const detailsById = new Map((gameDetails.data || []).map((game) => [game.id, game]));
  const iconsById = new Map((gameIcons.data || []).map((icon) => [icon.targetId, icon.imageUrl]));
  const thumbnailsById = new Map((gameThumbnails.data || []).filter((game) => game.thumbnails?.[0]?.state === 'Completed').map((game) => [game.universeId, game.thumbnails[0].imageUrl]));
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
      thumbnail: thumbnailsById.get(game.id) || null,
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
      cover,
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

app.get('/api/games/:gameId', async (request, response) => {
  const gameId = Number(request.params.gameId);
  if (!Number.isSafeInteger(gameId)) return response.status(400).json({ error: 'Invalid game ID.' });
  try {
    const community = await getCommunity();
    const game = community.games.find((entry) => entry.id === gameId);
    if (!game) return response.status(404).json({ error: 'This game is not part of ReWorked-Games.' });
    response.set('Cache-Control', 'public, max-age=60, s-maxage=240');
    response.json({ game, group: { id: community.group.id, name: community.group.name, url: community.group.url }, fetchedAt: community.fetchedAt });
  } catch (error) {
    console.error('Could not fetch game data:', error.message);
    response.status(502).json({ error: 'Live Roblox game data is temporarily unavailable. Please try again.' });
  }
});

app.get('/auth/roblox', (request, response) => {
  const config = oauthConfiguration();
  if (!config) return response.redirect('/account?error=not_configured');
  const state = crypto.randomBytes(24).toString('base64url');
  const nonce = crypto.randomBytes(24).toString('base64url');
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  response.cookie(OAUTH_STATE_COOKIE, encryptCookieValue(config, { state, nonce, codeVerifier, createdAt: Date.now() }), cookieOptions(OAUTH_STATE_TTL_MS));
  const authorize = new URL(`${ROBLOX_OAUTH}/v1/authorize`);
  authorize.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri, response_type: 'code', scope: 'openid profile', state, nonce, code_challenge: codeChallenge, code_challenge_method: 'S256', prompt: 'select_account' }).toString();
  response.redirect(authorize.toString());
});

app.get('/auth/roblox/callback', async (request, response) => {
  const config = oauthConfiguration();
  const pending = readOauthState(request, config);
  clearBrowserCookie(response, OAUTH_STATE_COOKIE);
  if (!config || !pending || !request.query.code) return response.redirect('/account?error=authorization_failed');
  try {
    const tokenResponse = await fetch('https://apis.roblox.com/oauth/v1/token', {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code: String(request.query.code), redirect_uri: config.redirectUri, code_verifier: pending.codeVerifier }),
      signal: AbortSignal.timeout(9000)
    });
    const tokenPayload = await tokenResponse.json().catch(() => null);
    if (!tokenResponse.ok) {
      const detail = tokenPayload?.error_description || tokenPayload?.error || '';
      throw new Error(`Token exchange returned ${tokenResponse.status}${detail ? `: ${detail}` : ''}`);
    }
    await verifyRobloxIdToken(tokenPayload?.id_token, pending.nonce, config.clientId);
    const profile = await roblox('https://apis.roblox.com/oauth/v1/userinfo', { headers: { Authorization: `Bearer ${tokenPayload.access_token}` } });
    if (!profile?.sub) throw new Error('Roblox userinfo response omitted sub');
    response.cookie(SESSION_COOKIE, encryptCookieValue(config, { createdAt: Date.now(), profile: { id: String(profile.sub), name: profile.preferred_username, displayName: profile.name, profile: profile.profile } }), cookieOptions(SESSION_TTL_MS));
    response.redirect('/account?connected=1');
  } catch (error) {
    console.error('Roblox OAuth callback failed:', error.message);
    response.redirect('/account?error=authorization_failed');
  }
});

app.get('/api/account', (request, response) => {
  const config = oauthConfiguration();
  const session = readSession(request, config);
  response.json({ connected: Boolean(session), profile: session?.profile || null, oauthEnabled: Boolean(config) });
});

app.post('/auth/logout', (request, response) => {
  clearBrowserCookie(response, SESSION_COOKIE);
  response.status(204).end();
});
app.get('*', (_request, response) => response.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(port, () => console.log(`ReWorked Games Hub running on port ${port}`));
