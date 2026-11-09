// Read-only load test: people opening the map and reading spot comments.
// Safe against any environment (it never writes).
//
//   k6 run loadtest/browse.js                                   # light: 50 users, ~4 min
//   k6 run -e BASE_URL=https://api.example.com -e PROFILE=full loadtest/browse.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:8080').replace(/\/+$/, '');

const PROFILES = {
  // Local sanity check: dozens of users
  light: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 50 },
    { duration: '2m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  // Capacity test on the server: thousands of users
  full: [
    { duration: '2m', target: 500 },
    { duration: '3m', target: 1000 },
    { duration: '3m', target: 2000 },
    { duration: '3m', target: 2000 },
    { duration: '2m', target: 0 },
  ],
};

export const options = {
  stages: PROFILES[__ENV.PROFILE || 'light'],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{name:spots_first}': ['p(95)<1500'],
    'http_req_duration{name:spots_revalidate}': ['p(95)<300'],
    'http_req_duration{name:comments}': ['p(95)<500'],
  },
};

const notModified = new Trend('spots_304_share', false);

// Done once: the spot ids to read comments from, and the current ETag
export function setup() {
  const res = http.get(`${BASE_URL}/api/spots`);
  check(res, { 'setup: spots loaded': (r) => r.status === 200 });
  const ids = res.json().map((s) => s.id);
  return { ids, etag: res.headers['Etag'] || res.headers['ETag'] || '' };
}

export default function (data) {
  // Half the visits are a first open (full list), half a return visit with the cached copy
  const returning = Math.random() < 0.5 && data.etag;
  const spots = http.get(`${BASE_URL}/api/spots`, {
    headers: returning ? { 'If-None-Match': data.etag } : {},
    tags: { name: returning ? 'spots_revalidate' : 'spots_first' },
  });
  check(spots, { 'spots ok': (r) => r.status === 200 || r.status === 304 });
  if (returning) notModified.add(spots.status === 304 ? 1 : 0);

  sleep(2 + Math.random() * 4); // looking at the map

  // Open one or two spots
  const opens = 1 + Math.floor(Math.random() * 2);
  for (let i = 0; i < opens; i++) {
    const id = data.ids[Math.floor(Math.random() * data.ids.length)];
    const comments = http.get(`${BASE_URL}/api/spots/${id}/comments`, { tags: { name: 'comments' } });
    check(comments, { 'comments ok': (r) => r.status === 200 });
    sleep(3 + Math.random() * 5); // reading
  }
}
