# ReWorked Games Hub

A Render-ready website that displays live public data for the [ReWorked-Games Roblox community](https://www.roblox.com/communities/223811537/ReWorked-Games). It fetches the group, roles, public experiences, icons, visits, and current player counts from Roblox at runtime.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Deploy through GitHub and Render

1. Create a new GitHub repository and push this project.
2. In Render, select **New +** → **Blueprint** and connect the GitHub repository.
3. Render detects `render.yaml`; approve the service and deploy.

Alternatively, create a **Web Service** from the repository and use:

- Build command: `npm ci`
- Start command: `npm start`
- Health check path: `/api/health`

Render supplies `PORT` automatically. No secrets or environment variables are required.

## Data behavior

The `/api/community` endpoint fetches public Roblox data server-side and keeps it cached for four minutes, avoiding browser CORS issues and unnecessary API requests. If Roblox is briefly unavailable, the most recent successful response is served when possible.
