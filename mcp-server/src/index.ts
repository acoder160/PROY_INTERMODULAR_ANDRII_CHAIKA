import 'dotenv/config';
import { v2 as cloudinary } from 'cloudinary';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Pool, type PoolClient } from 'pg';
import { z } from 'zod';

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required in mcp-server/.env`);
  }
  return value;
}

const GOOGLE_PLACES_API_KEY = requiredEnv('GOOGLE_PLACES_API_KEY');
const GOOGLE_PLACES_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const DATABASE_URL = requiredEnv('DATABASE_URL');
const BOT_USER_ID = process.env.BOT_USER_ID ? BigInt(process.env.BOT_USER_ID) : 1n;
const FULL_PLACE_FIELD_MASK =
  'places.displayName,places.location,places.photos,places.editorialSummary,places.reviews';
const SPOT_TYPES = ['STREET', 'PARK', 'RAMPS', 'RAIL', 'LEDGE'] as const;

requiredEnv('CLOUDINARY_URL');

cloudinary.config();
const pool = new Pool({ connectionString: DATABASE_URL });

type PlaceResponse = {
  places?: Array<{
    displayName?: { text?: string };
    location?: { latitude?: number; longitude?: number };
    editorialSummary?: { text?: string };
    photos?: Array<{ name?: string }>;
    reviews?: Array<{ text?: { text?: string } }>;
  }>;
};

type InsertedSpot = ImportedSpot & {
  spotType: (typeof SPOT_TYPES)[number];
  rating: number;
};

type Place = NonNullable<PlaceResponse['places']>[number];

type ImportedSpot = {
  status: 'success';
  spot_id: number;
  name: string;
  media_url: string;
};

type SkippedSpot = {
  status: 'skipped';
  reason: 'Spot already exists in the database.';
};

type BulkImportSummary = {
  total_processed: number;
  successes: number;
  skipped_duplicates: number;
  added_spot_names: string[];
  errors: Array<{ name: string; reason: string }>;
};

function firstSentences(text: string | undefined): string {
  if (!text?.trim()) {
    return '';
  }

  const sentences = text.trim().match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [];
  return sentences.slice(0, 2).join(' ').trim();
}

function getDescription(place: Place): string {
  const editorialDescription = firstSentences(place.editorialSummary?.text);
  if (editorialDescription) {
    return editorialDescription;
  }

  const reviewDescription = firstSentences(place.reviews?.[0]?.text?.text);
  return reviewDescription || 'No description available.';
}

async function searchPlaces(query: string, fieldMask: string, maxResultCount: number): Promise<Place[]> {
  const response = await fetch(GOOGLE_PLACES_SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': fieldMask,
    },
    body: JSON.stringify({
      textQuery: query,
      maxResultCount,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Google Places search failed (${response.status}): ${details}`);
  }

  const data = (await response.json()) as PlaceResponse;
  const places = data.places ?? [];
  if (places.length === 0) {
    throw new Error(`No place found for query "${query}".`);
  }

  return places;
}

async function findExistingSpotId(
  name: string,
  latitude: number,
  longitude: number,
  db: Pool | PoolClient = pool,
): Promise<number | undefined> {
  const result = await db.query(
    `SELECT id
     FROM spots
     WHERE LOWER(name) = LOWER($1)
        OR ST_DWithin(
             location::geography,
             ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
             50
           )
     LIMIT 1`,
    [name, longitude, latitude],
  );

  return result.rows[0]?.id;
}

async function updateCachedRating(spotId: number, db: Pool | PoolClient = pool): Promise<void> {
  await db.query(
     `UPDATE spots
      SET surface_rating = (
        SELECT AVG(surface_rating)
        FROM ratings
        WHERE spot_id = $1
      )
      WHERE id = $1`,
     [spotId],
  );
}

async function ensureBotRating(spotId: number, db: Pool | PoolClient = pool): Promise<number> {
  const rating = randomSurfaceRating();
  await db.query(
     `INSERT INTO ratings (spot_id, user_id, surface_rating, created_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (user_id, spot_id) DO NOTHING`,
     [spotId, BOT_USER_ID, rating],
  );
  await updateCachedRating(spotId, db);
  const result = await db.query<{ surface_rating: number }>(
     `SELECT surface_rating
      FROM ratings
      WHERE spot_id = $1 AND user_id = $2`,
     [spotId, BOT_USER_ID],
  );
  return result.rows[0]?.surface_rating ?? rating;
}

async function downloadPhoto(photoName: string): Promise<Buffer> {
  const url = new URL(`https://places.googleapis.com/v1/${photoName}/media`);
  url.searchParams.set('maxHeightPx', '800');
  url.searchParams.set('key', GOOGLE_PLACES_API_KEY);

  const response = await fetch(url);
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Google Places photo download failed (${response.status}): ${details}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

function uploadToCloudinary(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'skatemap_spots',
        resource_type: 'image',
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        if (!result?.secure_url) {
          reject(new Error('Cloudinary upload returned no secure_url.'));
          return;
        }
        resolve(result.secure_url);
      },
    );

    uploadStream.end(buffer);
  });
}

function randomSurfaceRating(): number {
  return Math.floor(Math.random() * 3) + 3;
}

function getRandomSpotType(): (typeof SPOT_TYPES)[number] {
  return SPOT_TYPES[Math.floor(Math.random() * SPOT_TYPES.length)];
}

async function insertSpot(place: Place): Promise<InsertedSpot | SkippedSpot> {
  const name = place.displayName?.text?.trim();
  const latitude = place.location?.latitude;
  const longitude = place.location?.longitude;

  if (!name || latitude === undefined || longitude === undefined) {
    throw new Error('Google Places returned a place without a name or coordinates.');
  }

  const existingSpotId = await findExistingSpotId(name, latitude, longitude);
  if (existingSpotId !== undefined) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await ensureBotRating(existingSpotId, client);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    return {
      status: 'skipped',
      reason: 'Spot already exists in the database.',
    };
  }

  const photoName = place.photos?.[0]?.name;
  if (!photoName) {
    throw new Error(`Place "${name}" has no photo and cannot be imported.`);
  }

  const mediaUrl = await uploadToCloudinary(await downloadPhoto(photoName));
  const spotType = getRandomSpotType();
  const rating = randomSurfaceRating();
  const client = await pool.connect();
  let spotId: number | undefined;
  try {
    await client.query('BEGIN');
    const insertResult = await client.query<{ id: number }>(
      `INSERT INTO spots (
         name,
         description,
         location,
         media_url,
         spot_type,
         difficulty_level,
         created_by
       )
       VALUES (
         $1,
         $2,
         ST_SetSRID(ST_MakePoint($3, $4), 4326),
         $5,
         $7,
         'INTERMEDIATE',
         $6
       )
       RETURNING id`,
      [name, getDescription(place), longitude, latitude, mediaUrl, BOT_USER_ID, spotType],
    );

    spotId = insertResult.rows[0]?.id;
    if (spotId === undefined) {
      throw new Error('Spot insert returned no id.');
    }

    await client.query(
      `INSERT INTO ratings (spot_id, user_id, surface_rating, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [spotId, BOT_USER_ID, rating],
    );
    await updateCachedRating(spotId, client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return {
    status: 'success',
    spot_id: spotId,
    name,
    media_url: mediaUrl,
    spotType,
    rating,
  };
}

async function importSkateSpot(query: string): Promise<ImportedSpot | SkippedSpot> {
  const basicPlaces = await searchPlaces(query, 'places.displayName,places.location', 1);
  const basicPlace = basicPlaces[0];
  if (!basicPlace) {
    throw new Error(`No place found for query "${query}".`);
  }

  const basicName = basicPlace.displayName?.text?.trim();
  const basicLatitude = basicPlace.location?.latitude;
  const basicLongitude = basicPlace.location?.longitude;
  if (!basicName || basicLatitude === undefined || basicLongitude === undefined) {
    throw new Error('Google Places returned a place without a name or coordinates.');
  }
  const existingSpotId = await findExistingSpotId(basicName, basicLatitude, basicLongitude);
  if (existingSpotId !== undefined) {
    await ensureBotRating(existingSpotId);
    return {
      status: 'skipped',
      reason: 'Spot already exists in the database.',
    };
  }

  const places = await searchPlaces(
    query,
    FULL_PLACE_FIELD_MASK,
    1,
  );
  const place = places[0];
  if (!place) {
    throw new Error(`No place found for query "${query}".`);
  }
  const result = await insertSpot(place);
  if (result.status === 'skipped') {
    return result;
  }

  const { spotType: _spotType, rating: _rating, ...publicSpot } = result;
  return publicSpot;
}

async function bulkImportSpots(regions: string[]): Promise<BulkImportSummary> {
  const summary: BulkImportSummary = {
    total_processed: 0,
    successes: 0,
    skipped_duplicates: 0,
    added_spot_names: [],
    errors: [],
  };

  for (const region of regions) {
    console.error(`Searching region: ${region}`);
    const places = await searchPlaces(`Skateparks in ${region}`, FULL_PLACE_FIELD_MASK, 20);
    for (const place of places) {
      if (summary.total_processed > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      summary.total_processed += 1;

      const placeName = place.displayName?.text?.trim() || 'Unknown place';
      try {
        const result = await insertSpot(place);
        if (result.status === 'skipped') {
          summary.skipped_duplicates += 1;
          console.error(`[SKIPPED] ${placeName}: Already exists`);
        } else {
          summary.successes += 1;
          summary.added_spot_names.push(result.name);
          console.error(`[ADDED] ${result.name} | Type: ${result.spotType} | Rating: ${result.rating}⭐`);
        }
      } catch (error) {
        summary.errors.push({
          name: placeName,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return summary;
}

const server = new McpServer({
  name: 'skatemap-spot-server',
  version: '0.1.0',
});

server.registerTool(
  'import_skate_spot',
  {
    title: 'Import a single skate spot',
    description: 'Find one place, skip duplicates, upload its first photo, and insert it into PostgreSQL.',
    inputSchema: {
      query: z.string().trim().min(1).describe('A place search query, for example "Pamplona skatepark".'),
    },
  },
  async ({ query }) => {
    const spot = await importSkateSpot(query);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(spot),
        },
      ],
      structuredContent: spot,
    };
  },
);

server.registerTool(
  'bulk_import_spots',
  {
    title: 'Bulk import skate spots',
    description: 'Search regions for skateparks and import unique places sequentially.',
    inputSchema: {
      regions: z.array(z.string().trim().min(1)).min(1).describe('Regions to search, for example ["Madrid", "Valencia"].'),
    },
  },
  async ({ regions }) => {
    const summary = await bulkImportSpots(regions);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(summary),
        },
      ],
      structuredContent: summary,
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
