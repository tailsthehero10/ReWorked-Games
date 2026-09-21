# Enable Roblox account connection

The site already contains the secure OAuth routes. It never accepts a Roblox password; users are sent to Roblox's authorization page and returned after consent.

## 1. Register the app

Sign in with the owner of ReWorked-Games and open [Creator Dashboard credentials](https://create.roblox.com/dashboard/credentials).

1. Select the **ReWorked-Games** group and create an OAuth 2.0 application.
2. Use a unique name such as `ReWorked Games Community Hub`.
3. Choose the account-linking/user-tools category that best describes this site.
4. Add this redirect URL exactly:

   `https://reworked-games.onrender.com/auth/roblox/callback`

5. Add only these identity scopes for the current connection feature:
   - `openid`
   - `profile`
6. Save the **Client ID** and **Client Secret** immediately. Never commit the secret to GitHub.

The app begins private and is suitable for up to ten test users. Roblox review is required before it can be broadly available.

## 2. Add the Render environment variables

In Render, open the web service → **Environment** and add:

| Key | Value |
| --- | --- |
| `ROBLOX_CLIENT_ID` | Client ID from Creator Dashboard |
| `ROBLOX_CLIENT_SECRET` | Client secret from Creator Dashboard; mark as Secret |
| `ROBLOX_REDIRECT_URI` | `https://reworked-games.onrender.com/auth/roblox/callback` |
| `NODE_ENV` | `production` |

Save changes and choose **Manual Deploy → Deploy latest commit**. Visit `/account`; the disabled connection button becomes active.

Render does not read this repository's ignored `.env` file. If `/api/account` still returns `"oauthEnabled":false`, add the four variables above in the Render service's **Environment** page, save them, and redeploy.

## Roles and privacy

`/roles` already looks up a public role by Roblox username through Roblox's public group endpoint. Roblox communities can now assign multiple roles, but that public endpoint exposes only the role Roblox makes public. Do not claim it is the complete role set.

To access a complete multi-role group membership record, the group owner must authorize the newer Open Cloud Groups API with the least-privilege `group:read` scope for group `223811537`. That is privileged data: add it only after deciding who can view it and documenting the purpose in the app privacy policy. Do not use `.ROBLOSECURITY` cookies or ask users to paste credentials.
