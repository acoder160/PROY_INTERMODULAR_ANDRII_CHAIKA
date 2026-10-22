# SkateMap Spot MCP Server

This local MCP server exposes `import_skate_spot` and `bulk_import_spots`.
Both tools check PostgreSQL for duplicates, download Google photos in memory,
upload them to Cloudinary, insert spots, and add a random bot rating from 3 to
5.

## Setup

From the repository root:

```powershell
cd mcp-server
npm install
Copy-Item .env.example .env
```

Edit `mcp-server/.env`:

```env
GOOGLE_PLACES_API_KEY=PASTE_YOUR_GOOGLE_PLACES_API_KEY_HERE
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
CLOUDINARY_URL=cloudinary://123456789:your_api_secret@your_cloud_name
```

The Google key goes on the `GOOGLE_PLACES_API_KEY=` line. Enable the Places
API (New) in the Google Cloud project attached to that key and make sure
billing is enabled, as Google requires billing for Places requests.

`CLOUDINARY_URL` is the connection string from the Cloudinary dashboard.
`DATABASE_URL` is the Neon PostgreSQL connection string and should include
`sslmode=require`. Do not commit `.env` or share either credential.
`BOT_USER_ID` identifies the existing user assigned as the creator of imported
spots and ratings. It defaults to `1` when omitted.

## Run

Validate the TypeScript:

```powershell
npm run build
```

Run the MCP server over stdio:

```powershell
npm start
```

The process is intended to be launched by an MCP client, not opened directly
in a browser. Configure the client to run:

```text
Command: npx
Arguments: --prefix C:\Users\Admin\Desktop\Proyecto\mcp-server tsx src/index.ts
Working directory: C:\Users\Admin\Desktop\Proyecto\mcp-server
```

The tool returns:

```json
{
  "status": "success",
  "spot_id": 123,
  "name": "Example Skatepark",
  "media_url": "https://res.cloudinary.com/..."
}
```

Places without a Google photo are rejected and are not returned or uploaded.
Places with a case-insensitive name match or a location within 50 meters of an
existing row return:

```json
{
  "status": "skipped",
  "reason": "Spot already exists in the database."
}
```

Bulk imports accept:

```json
{
  "regions": ["Madrid", "Valencia"]
}
```

and return `total_processed`, `successes`, `skipped_duplicates`,
`added_spot_names`, and an `errors` array for places that could not be
imported.
