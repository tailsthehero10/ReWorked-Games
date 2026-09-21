import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const port = process.env.PORT || 3000;
const groupId = 223811537;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROBLOX = 'https://www.roblox.com';
const cache = { value: null, expiresAt: 0 };

app.disable('x-powered-by');
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h', extensions: ['html'] }));

async function roblox(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'ReWorked-Games-Hub/1.0', Accept: 'application/json' },
    signal: AbortSignal.timeout(9000)
  });
  if (!response.ok) throw new Error(`Roblox returned ${response.status}`);
  return response.json();
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
app.get('*', (_request, response) => response.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(port, () => console.log(`ReWorked Games Hub running on port ${port}`));
