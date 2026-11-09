// Mixed load test: browsing + logins + comments + authenticated feed reads. It WRITES comments and logs in many times,
// so run it only against a staging database, with rate limits off for the test:
//
//   backend:  RATE_LIMIT_ENABLED=false
//   k6 run -e BASE_URL=https://staging.example.com -e USERNAME=loadtest -e PASSWORD=... loadtest/mixed.js
//
// The test user must exist beforehand. Comments go through AI moderation, so the
// writer scenario is kept small (it also costs API credits).
import http from 'k6/http';
import { check, sleep } from 'k6';
import browse, { setup as browseSetup } from './browse.js';

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:8080').replace(/\/+$/, '');
const JSON_HEADERS = { 'Content-Type': 'application/json', 'X-Client-Type': 'mobile' };

export const options = {
  scenarios: {
    browsers: {
      executor: 'ramping-vus',
      exec: 'browser',
      stages: [
        { duration: '2m', target: 400 },
        { duration: '5m', target: 1600 },
        { duration: '2m', target: 0 },
      ],
    },
    logins: {
      executor: 'constant-arrival-rate',
      exec: 'login',
      rate: 5, // logins per second
      timeUnit: '1s',
      duration: '8m',
      preAllocatedVUs: 50,
    },
    feed: {
      executor: 'constant-vus',
      exec: 'feedReader',
      vus: 50,
      duration: '8m',
    },
    writers: {
      executor: 'constant-vus',
      exec: 'writer',
      vus: 5,
      duration: '8m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{name:login}': ['p(95)<1000'],
    'http_req_duration{name:feed}': ['p(95)<500'],
    'http_req_duration{name:comment}': ['p(95)<6000'], // includes AI moderation
  },
};

export function setup() {
  if (!__ENV.USERNAME || !__ENV.PASSWORD) {
    throw new Error('Set USERNAME and PASSWORD of an existing test user (staging only).');
  }
  return browseSetup();
}

export function browser(data) {
  browse(data);
}

function loginOnce() {
  const res = http.post(`${BASE_URL}/api/auth/login`,
    JSON.stringify({ username: __ENV.USERNAME, password: __ENV.PASSWORD }),
    { headers: JSON_HEADERS, tags: { name: 'login' } });
  check(res, { 'login ok': (r) => r.status === 200 });
  return res.status === 200 ? res.json('token') : null;
}

export function login() {
  loginOnce();
}

export function writer(data) {
  const token = loginOnce();
  if (!token) { sleep(5); return; }
  const id = data.ids[Math.floor(Math.random() * data.ids.length)];
  const res = http.post(`${BASE_URL}/api/comments/${id}`,
    JSON.stringify({ content: `Load test comment ${Date.now()}: nice ledges and smooth ground` }),
    { headers: { ...JSON_HEADERS, Authorization: `Bearer ${token}` }, tags: { name: 'comment' } });
  check(res, { 'comment ok': (r) => r.status === 200 });
  sleep(10 + Math.random() * 10);
}

// One login per VU, then page through the feed (first page + a keyset page).
let feedToken = null;
export function feedReader() {
  if (!feedToken) {
    feedToken = loginOnce();
    if (!feedToken) { sleep(5); return; }
  }
  const headers = { ...JSON_HEADERS, Authorization: `Bearer ${feedToken}` };
  const first = http.get(`${BASE_URL}/api/feed`, { headers, tags: { name: 'feed' } });
  check(first, { 'feed ok': (r) => r.status === 200 });
  if (first.status === 200) {
    const cursor = first.json('nextCursor');
    if (cursor) {
      const next = http.get(`${BASE_URL}/api/feed?before=${cursor}`, { headers, tags: { name: 'feed' } });
      check(next, { 'feed page 2 ok': (r) => r.status === 200 });
    }
  }
  sleep(3 + Math.random() * 4);
}
