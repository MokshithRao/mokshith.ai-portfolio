import initialProjects from '../data/projects.json';
import initialBeyond from '../data/beyond.json';
import initialCertifications from '../data/certifications.json';
import initialSkills from '../data/skills.json';

const SESSION_COOKIE = 'portfolio_admin_session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const LOGIN_LIMIT = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_JSON_BYTES = 20 * 1024 * 1024;

const seedCollections = {
  projects: initialProjects,
  beyond: initialBeyond,
  certifications: initialCertifications,
  skills: initialSkills
};

const protectedMutations = [
  ['PUT', /^\/api\/skills$/],
  ['POST', /^\/api\/projects$/],
  ['PUT', /^\/api\/projects\/[^/]+$/],
  ['DELETE', /^\/api\/projects\/[^/]+$/],
  ['POST', /^\/api\/beyond\/upload$/],
  ['POST', /^\/api\/beyond\/items$/],
  ['PUT', /^\/api\/beyond\/items\/[^/]+$/],
  ['DELETE', /^\/api\/beyond\/items\/[^/]+$/],
  ['POST', /^\/api\/certifications\/upload$/],
  ['POST', /^\/api\/certifications$/],
  ['PUT', /^\/api\/certifications\/[^/]+$/],
  ['DELETE', /^\/api\/certifications\/[^/]+$/]
];

class HttpError extends Error {
  constructor(status, message, headers = {}) {
    super(message);
    this.status = status;
    this.headers = headers;
  }
}

function json(payload, status = 200, headers = {}) {
  return Response.json(payload, {
    status,
    headers: { 'Cache-Control': 'no-store', ...headers }
  });
}

function errorResponse(error) {
  if (error instanceof HttpError) {
    return json({ error: error.message }, error.status, error.headers);
  }
  console.error('Cloudflare Worker request failed:', error);
  return json({ error: 'An unexpected server error occurred.' }, 500);
}

async function readJson(request, limit = MAX_JSON_BYTES) {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > limit) throw new HttpError(413, 'Request body is too large.');
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > limit) {
    throw new HttpError(413, 'Request body is too large.');
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'Invalid JSON payload.');
  }
}

function trim(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isValidUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function equalDigest(left, right) {
  let difference = left.length ^ right.length;
  const maxLength = Math.max(left.length, right.length);
  for (let index = 0; index < maxLength; index += 1) {
    difference |= (left.charCodeAt(index % (left.length || 1)) || 0) ^
      (right.charCodeAt(index % (right.length || 1)) || 0);
  }
  return difference === 0;
}

function cookieValue(request, name) {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator >= 0 && part.slice(0, separator).trim() === name) {
      return part.slice(separator + 1).trim();
    }
  }
  return '';
}

function sessionCookie(request, value, maxAge) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${value}; HttpOnly; Path=/; SameSite=Strict${secure}; Max-Age=${maxAge}`;
}

function isSameOriginRequest(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

async function getSession(request, env) {
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const session = await env.DB.prepare(
    'SELECT expires_at, credential_hash FROM admin_sessions WHERE token_hash = ?'
  ).bind(tokenHash).first();
  if (!session) return null;
  const credentialHash = env.ADMIN_USERNAME && env.ADMIN_PASSWORD
    ? await sha256(`${env.ADMIN_USERNAME}\0${env.ADMIN_PASSWORD}`)
    : '';
  if (session.expires_at <= Date.now() || !equalDigest(session.credential_hash, credentialHash)) {
    await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(tokenHash).run();
    return null;
  }
  return { tokenHash, expiresAt: session.expires_at };
}

async function requireSameOrigin(request) {
  if (!isSameOriginRequest(request)) {
    throw new HttpError(403, 'Cross-origin requests are not allowed.');
  }
}

async function requireAdmin(request, env) {
  await requireSameOrigin(request);
  if (!(await getSession(request, env))) {
    throw new HttpError(401, 'Admin login required.');
  }
}

async function ensureSeeded(env, collection) {
  const seedKey = `seeded:${collection}`;
  const alreadySeeded = await env.DB.prepare(
    'SELECT 1 FROM portfolio_meta WHERE key = ?'
  ).bind(seedKey).first();
  if (alreadySeeded) return;

  const seed = seedCollections[collection];
  const statements = seed.map((value, index) => {
    const id = value.id;
    return env.DB.prepare(
      `INSERT OR IGNORE INTO portfolio_items (collection, id, sort_order, value)
       SELECT ?, ?, ?, ?
       WHERE NOT EXISTS (SELECT 1 FROM portfolio_meta WHERE key = ?)`
    ).bind(collection, id, index, JSON.stringify(value), seedKey);
  });
  statements.push(env.DB.prepare(
    'INSERT OR IGNORE INTO portfolio_meta (key, value) VALUES (?, ?)'
  ).bind(seedKey, '1'));
  await env.DB.batch(statements);
}

async function readCollection(env, collection) {
  await ensureSeeded(env, collection);
  const result = await env.DB.prepare(
    'SELECT value FROM portfolio_items WHERE collection = ? ORDER BY sort_order, id'
  ).bind(collection).all();
  return result.results.map((row) => JSON.parse(row.value));
}

async function findItem(env, collection, id) {
  await ensureSeeded(env, collection);
  const row = await env.DB.prepare(
    'SELECT value, sort_order FROM portfolio_items WHERE collection = ? AND id = ?'
  ).bind(collection, id).first();
  return row ? { value: JSON.parse(row.value), sortOrder: row.sort_order } : null;
}

async function insertItem(env, collection, item) {
  await ensureSeeded(env, collection);
  const result = await env.DB.prepare(
    'SELECT COALESCE(MIN(sort_order), 0) - 1 AS next_order FROM portfolio_items WHERE collection = ?'
  ).bind(collection).first();
  await env.DB.prepare(
    'INSERT INTO portfolio_items (collection, id, sort_order, value) VALUES (?, ?, ?, ?)'
  ).bind(collection, item.id, result.next_order, JSON.stringify(item)).run();
}

async function updateItem(env, collection, id, value) {
  const result = await env.DB.prepare(
    'UPDATE portfolio_items SET value = ? WHERE collection = ? AND id = ?'
  ).bind(JSON.stringify(value), collection, id).run();
  return result.meta.changes > 0;
}

async function removeItem(env, collection, id) {
  const result = await env.DB.prepare(
    'DELETE FROM portfolio_items WHERE collection = ? AND id = ?'
  ).bind(collection, id).run();
  return result.meta.changes > 0;
}

function parseTags(value) {
  if (Array.isArray(value)) return value.map((tag) => String(tag).trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map((tag) => tag.trim()).filter(Boolean);
  }
  return [];
}

function parseSkills(value) {
  if (Array.isArray(value)) return value.map((skill) => String(skill).trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map((skill) => skill.trim()).filter(Boolean);
  }
  return [];
}

function categoryIcon(category) {
  const icons = {
    reading: 'menu_book',
    workshops: 'construction',
    workshop: 'construction',
    events: 'campaign',
    event: 'campaign',
    learning: 'school',
    activities: 'directions_run',
    activity: 'directions_run',
    hobbies: 'palette',
    hobby: 'palette',
    interests: 'track_changes',
    interest: 'track_changes',
    other: 'auto_awesome'
  };
  return icons[category.toLowerCase()] || '';
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${randomToken().slice(0, 7).toLowerCase()}`;
}

async function adminLogin(request, env) {
  const configuredUsername = env.ADMIN_USERNAME;
  const configuredPassword = env.ADMIN_PASSWORD;
  if (!configuredUsername || !configuredPassword || configuredPassword.length < 12) {
    throw new HttpError(503, 'Admin login requires ADMIN_USERNAME and an ADMIN_PASSWORD of at least 12 characters.');
  }
  await requireSameOrigin(request);

  const payload = await readJson(request, 8 * 1024);
  if (!isObject(payload)) throw new HttpError(400, 'Invalid login request.');
  const username = typeof payload.username === 'string' ? payload.username : '';
  const password = typeof payload.password === 'string' ? payload.password : '';
  if (username.length > 200 || password.length > 1024) {
    throw new HttpError(400, 'Invalid login request.');
  }

  const address = request.headers.get('cf-connecting-ip') || 'unknown';
  const addressHash = await sha256(address);
  const now = Date.now();
  await env.DB.prepare('DELETE FROM login_attempts WHERE reset_at <= ?').bind(now).run();
  await env.DB.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').bind(now).run();
  const attempt = await env.DB.prepare(
    'SELECT count, reset_at FROM login_attempts WHERE address_hash = ?'
  ).bind(addressHash).first();
  if (attempt && attempt.count >= LOGIN_LIMIT && attempt.reset_at > now) {
    throw new HttpError(429, 'Too many login attempts. Please try again later.', {
      'Retry-After': String(Math.ceil((attempt.reset_at - now) / 1000))
    });
  }

  const usernameMatches = equalDigest(await sha256(username), await sha256(configuredUsername));
  const passwordMatches = equalDigest(await sha256(password), await sha256(configuredPassword));
  if (!usernameMatches || !passwordMatches) {
    const count = attempt && attempt.reset_at > now ? attempt.count + 1 : 1;
    const resetAt = attempt && attempt.reset_at > now ? attempt.reset_at : now + LOGIN_WINDOW_MS;
    await env.DB.prepare(
      `INSERT INTO login_attempts (address_hash, count, reset_at) VALUES (?, ?, ?)
       ON CONFLICT(address_hash) DO UPDATE SET count = excluded.count, reset_at = excluded.reset_at`
    ).bind(addressHash, count, resetAt).run();
    throw new HttpError(401, 'Invalid username or password.');
  }

  await env.DB.prepare('DELETE FROM login_attempts WHERE address_hash = ?').bind(addressHash).run();
  const token = randomToken();
  const expiresAt = now + SESSION_TTL_MS;
  await env.DB.prepare(
    'INSERT INTO admin_sessions (token_hash, credential_hash, expires_at) VALUES (?, ?, ?)'
  ).bind(
    await sha256(token),
    await sha256(`${configuredUsername}\0${configuredPassword}`),
    expiresAt
  ).run();
  return json({ authenticated: true, expiresAt }, 200, {
    'Set-Cookie': sessionCookie(request, token, SESSION_TTL_MS / 1000)
  });
}

function decodeBase64(value) {
  let binary;
  try {
    binary = atob(value);
  } catch {
    throw new HttpError(400, 'Image data is not valid base64.');
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new HttpError(413, 'Each uploaded file must be 8 MB or smaller.');
  }
  return bytes;
}

function parseUploadData(value, kind) {
  if (typeof value !== 'string' || !value) return null;
  if (/^(assets\/|\/assets\/|https?:\/\/)/i.test(value)) return { existingUrl: value };

  const match = value.match(/^data:([^;,]+);base64,([\s\S]+)$/i);
  const mime = match ? match[1].toLowerCase() : 'image/jpeg';
  const data = match ? match[2] : value.replace(/^data:[^;]+;base64,/i, '');
  const extensions = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'application/pdf': 'pdf'
  };
  if (!extensions[mime] || (kind === 'beyond' && !mime.startsWith('image/'))) {
    throw new HttpError(400, 'Unsupported upload type.');
  }
  return { mime, extension: extensions[mime], bytes: decodeBase64(data) };
}

async function handleUpload(request, env, collection) {
  const payload = await readJson(request, MAX_JSON_BYTES);
  const images = Array.isArray(payload?.images) ? payload.images : (payload?.data ? [payload] : []);
  if (!images.length) throw new HttpError(400, 'No files provided.');

  const urls = [];
  for (const image of images) {
    const data = typeof image === 'string' ? image : image?.data;
    if (!data) continue;
    const upload = parseUploadData(data, collection);
    if (upload.existingUrl) {
      urls.push(upload.existingUrl);
      continue;
    }
    const filename = `${collection === 'beyond' ? 'beyond' : 'cert'}-${Date.now()}-${randomToken().slice(0, 8)}.${upload.extension}`;
    const key = `assets/${collection === 'beyond' ? 'beyond' : 'certs'}/${filename}`;
    await env.UPLOADS.put(key, upload.bytes, {
      httpMetadata: {
        contentType: upload.mime,
        cacheControl: 'public, max-age=31536000, immutable'
      }
    });
    urls.push(key);
  }
  return json({ success: true, urls });
}

async function handleSkills(request, env) {
  if (request.method === 'GET') return json(await readCollection(env, 'skills'));
  if (request.method !== 'PUT') throw new HttpError(405, 'Method not allowed.');
  const payload = await readJson(request, 256 * 1024);
  if (!Array.isArray(payload?.skills)) throw new HttpError(400, 'Skills must be an array.');
  if (payload.skills.length > 20) throw new HttpError(400, 'Skills must contain no more than 20 groups.');

  const ids = new Set();
  const groups = [];
  for (const group of payload.skills) {
    if (!group || typeof group.id !== 'string' || !/^[a-z0-9-]{1,80}$/i.test(group.id) || ids.has(group.id)) {
      throw new HttpError(400, 'Each skill group must have a unique valid ID.');
    }
    const title = trim(group.title);
    if (!title || title.length > 60) throw new HttpError(400, 'Each skill group needs a title of 60 characters or fewer.');
    if (typeof group.icon !== 'string' || !/^[a-z0-9_]{1,40}$/i.test(group.icon)) {
      throw new HttpError(400, 'Each skill group needs a valid Material Symbol name.');
    }
    if (!Array.isArray(group.skills) || group.skills.length > 50) {
      throw new HttpError(400, 'Each group may contain no more than 50 skills.');
    }
    const items = [];
    for (const item of group.skills) {
      if (typeof item !== 'string' || !item.trim() || item.trim().length > 50) {
        throw new HttpError(400, 'Each skill must be between 1 and 50 characters.');
      }
      if (!items.includes(item.trim())) items.push(item.trim());
    }
    ids.add(group.id);
    groups.push({ id: group.id, title, icon: group.icon, skills: items });
  }

  await ensureSeeded(env, 'skills');
  const statements = [env.DB.prepare('DELETE FROM portfolio_items WHERE collection = ?').bind('skills')];
  groups.forEach((group, index) => {
    statements.push(env.DB.prepare(
      'INSERT INTO portfolio_items (collection, id, sort_order, value) VALUES (?, ?, ?, ?)'
    ).bind('skills', group.id, index, JSON.stringify(group)));
  });
  await env.DB.batch(statements);
  return json(groups);
}

async function handleProjects(request, env, url) {
  if (request.method === 'GET' && url.pathname === '/api/projects') {
    return json(await readCollection(env, 'projects'));
  }
  const id = url.pathname === '/api/projects' ? '' : decodeURIComponent(url.pathname.slice('/api/projects/'.length));
  if (request.method === 'POST' && !id) {
    const payload = await readJson(request, 1024 * 1024);
    const name = trim(payload?.name);
    const description = trim(payload?.description);
    const github = trim(payload?.github);
    if (!name) throw new HttpError(400, 'Project name is required.');
    if (!description) throw new HttpError(400, 'Project description is required.');
    if (!github) throw new HttpError(400, 'GitHub link is required.');
    if (!isValidUrl(github)) throw new HttpError(400, 'Please provide a valid URL (starting with http:// or https://).');
    const project = {
      id: makeId('project'), name, description, github,
      tags: parseTags(payload.tags).length ? parseTags(payload.tags) : ['AI/ML', 'Python'],
      icon: payload.icon || 'terminal',
      category: payload.category || 'AI/ML',
      createdAt: Date.now()
    };
    await insertItem(env, 'projects', project);
    return json(project, 201);
  }
  if (request.method === 'PUT' && id) {
    const payload = await readJson(request, 1024 * 1024);
    const name = trim(payload?.name);
    const description = trim(payload?.description);
    const github = trim(payload?.github);
    if (!name) throw new HttpError(400, 'Project name is required.');
    if (!description) throw new HttpError(400, 'Project description is required.');
    if (!github) throw new HttpError(400, 'GitHub link is required.');
    if (!isValidUrl(github)) throw new HttpError(400, 'Please provide a valid URL (starting with http:// or https://).');
    const existing = await findItem(env, 'projects', id);
    if (!existing) throw new HttpError(404, 'Project not found.');
    const tags = parseTags(payload.tags);
    const project = {
      ...existing.value, name, description, github,
      tags: tags.length ? tags : (existing.value.tags || ['AI/ML', 'Python']),
      updatedAt: Date.now()
    };
    await updateItem(env, 'projects', id, project);
    return json(project);
  }
  if (request.method === 'DELETE' && id) {
    const existing = await findItem(env, 'projects', id);
    if (!existing) throw new HttpError(404, 'Project not found.');
    await removeItem(env, 'projects', id);
    return json({ success: true, deleted: existing.value });
  }
  throw new HttpError(404, 'Not found.');
}

async function handleBeyond(request, env, url) {
  if (request.method === 'GET' && url.pathname === '/api/beyond') {
    return json(await readCollection(env, 'beyond'));
  }
  if (request.method === 'POST' && url.pathname === '/api/beyond/upload') {
    return handleUpload(request, env, 'beyond');
  }
  const itemPrefix = '/api/beyond/items/';
  if (request.method === 'POST' && url.pathname === '/api/beyond/items') {
    const payload = await readJson(request);
    const title = trim(payload?.title);
    const category = trim(payload?.category);
    if (!title) throw new HttpError(400, 'Item title is required.');
    if (!category) throw new HttpError(400, 'Category is required.');
    const item = {
      id: makeId('beyond'),
      category,
      categoryIcon: payload.categoryIcon || categoryIcon(category) || 'category',
      title,
      subtitle: trim(payload.subtitle),
      status: trim(payload.status),
      date: trim(payload.date),
      description: trim(payload.description),
      images: Array.isArray(payload.images) ? payload.images.filter(Boolean) : [],
      link: trim(payload.link),
      linkLabel: trim(payload.linkLabel),
      customFields: Array.isArray(payload.customFields)
        ? payload.customFields.filter((field) => field && (field.label || field.value))
        : [],
      createdAt: Date.now()
    };
    await insertItem(env, 'beyond', item);
    return json(item, 201);
  }
  if (url.pathname.startsWith(itemPrefix)) {
    const id = decodeURIComponent(url.pathname.slice(itemPrefix.length));
    if (!id) throw new HttpError(400, 'Item ID required.');
    const existing = await findItem(env, 'beyond', id);
    if (!existing) throw new HttpError(404, 'Item not found.');
    if (request.method === 'DELETE') {
      await removeItem(env, 'beyond', id);
      return json({ success: true, deleted: existing.value });
    }
    if (request.method === 'PUT') {
      const payload = await readJson(request);
      const title = trim(payload?.title);
      const category = trim(payload?.category);
      if (!title) throw new HttpError(400, 'Item title is required.');
      if (!category) throw new HttpError(400, 'Category is required.');
      const item = {
        ...existing.value,
        category,
        categoryIcon: payload.categoryIcon || categoryIcon(category) || existing.value.categoryIcon || 'category',
        title,
        subtitle: trim(payload.subtitle),
        status: trim(payload.status),
        date: trim(payload.date),
        description: trim(payload.description),
        images: Array.isArray(payload.images) ? payload.images.filter(Boolean) : (existing.value.images || []),
        link: trim(payload.link),
        linkLabel: trim(payload.linkLabel),
        customFields: Array.isArray(payload.customFields)
          ? payload.customFields.filter((field) => field && (field.label || field.value))
          : [],
        updatedAt: Date.now()
      };
      await updateItem(env, 'beyond', id, item);
      return json(item);
    }
  }
  throw new HttpError(404, 'Not found.');
}

async function handleCertifications(request, env, url) {
  if (request.method === 'GET' && url.pathname === '/api/certifications') {
    return json(await readCollection(env, 'certifications'));
  }
  if (request.method === 'POST' && url.pathname === '/api/certifications/upload') {
    return handleUpload(request, env, 'certifications');
  }
  const prefix = '/api/certifications/';
  if (request.method === 'POST' && url.pathname === '/api/certifications') {
    const payload = await readJson(request);
    const name = trim(payload?.name);
    if (!name) throw new HttpError(400, 'Certificate name is required.');
    const certification = {
      id: makeId('cert'),
      name,
      issuer: trim(payload.issuer) || 'Independent Certification',
      date: trim(payload.date),
      year: trim(payload.year || payload.date),
      category: trim(payload.category) || 'Other',
      images: Array.isArray(payload.images) ? payload.images.filter(Boolean) : [],
      credentialId: trim(payload.credentialId),
      credentialUrl: trim(payload.credentialUrl),
      skills: parseSkills(payload.skills),
      description: trim(payload.description),
      createdAt: Date.now()
    };
    await insertItem(env, 'certifications', certification);
    return json(certification, 201);
  }
  if (url.pathname.startsWith(prefix)) {
    const id = decodeURIComponent(url.pathname.slice(prefix.length));
    if (!id) throw new HttpError(400, 'Certificate ID required.');
    const existing = await findItem(env, 'certifications', id);
    if (!existing) throw new HttpError(404, 'Certificate not found.');
    if (request.method === 'DELETE') {
      await removeItem(env, 'certifications', id);
      return json({ success: true, deleted: existing.value });
    }
    if (request.method === 'PUT') {
      const payload = await readJson(request);
      const name = trim(payload?.name);
      if (!name) throw new HttpError(400, 'Certificate name is required.');
      const certification = {
        ...existing.value,
        name,
        issuer: trim(payload.issuer) || existing.value.issuer || '',
        date: trim(payload.date !== undefined ? payload.date : existing.value.date),
        year: trim(payload.year !== undefined ? payload.year : existing.value.year),
        category: trim(payload.category) || existing.value.category || 'Other',
        images: Array.isArray(payload.images) ? payload.images.filter(Boolean) : (existing.value.images || []),
        credentialId: trim(payload.credentialId !== undefined ? payload.credentialId : existing.value.credentialId),
        credentialUrl: trim(payload.credentialUrl !== undefined ? payload.credentialUrl : existing.value.credentialUrl),
        skills: Array.isArray(payload.skills) || typeof payload.skills === 'string'
          ? parseSkills(payload.skills) : (existing.value.skills || []),
        description: trim(payload.description !== undefined ? payload.description : existing.value.description),
        updatedAt: Date.now()
      };
      await updateItem(env, 'certifications', id, certification);
      return json(certification);
    }
  }
  throw new HttpError(404, 'Not found.');
}

async function handleApi(request, env, url) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });

  if (url.pathname === '/api/admin/session' && request.method === 'GET') {
    const session = await getSession(request, env);
    return json({ authenticated: Boolean(session), expiresAt: session?.expiresAt ?? null });
  }
  if (url.pathname === '/api/admin/login' && request.method === 'POST') {
    return adminLogin(request, env);
  }
  if (url.pathname === '/api/admin/logout' && request.method === 'POST') {
    await requireSameOrigin(request);
    const session = await getSession(request, env);
    if (session) {
      await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(session.tokenHash).run();
    }
    return json({ authenticated: false }, 200, { 'Set-Cookie': sessionCookie(request, '', 0) });
  }

  if (protectedMutations.some(([method, pattern]) => method === request.method && pattern.test(url.pathname))) {
    await requireAdmin(request, env);
  }

  if (url.pathname === '/api/skills') return handleSkills(request, env);
  if (url.pathname === '/api/projects' || url.pathname.startsWith('/api/projects/')) {
    return handleProjects(request, env, url);
  }
  if (url.pathname === '/api/beyond' || url.pathname.startsWith('/api/beyond/')) {
    return handleBeyond(request, env, url);
  }
  if (url.pathname === '/api/certifications' || url.pathname.startsWith('/api/certifications/')) {
    return handleCertifications(request, env, url);
  }
  throw new HttpError(404, 'Not found.');
}

function contentTypeFor(key) {
  const extension = key.slice(key.lastIndexOf('.') + 1).toLowerCase();
  const contentTypes = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml',
    pdf: 'application/pdf'
  };
  return contentTypes[extension] || 'application/octet-stream';
}

async function handleUploadAsset(request, env, url) {
  const key = decodeURIComponent(url.pathname.slice(1));
  if (!/^assets\/(beyond|certs)\/[a-zA-Z0-9._-]+$/.test(key)) {
    return env.ASSETS.fetch(request);
  }
  const object = await env.UPLOADS.get(key);
  if (!object) return env.ASSETS.fetch(request);
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Content-Type', object.httpMetadata?.contentType || contentTypeFor(key));
  headers.set('Cache-Control', object.httpMetadata?.cacheControl || 'public, max-age=31536000, immutable');
  if (headers.get('Content-Type') === 'image/svg+xml') {
    headers.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  }
  return new Response(object.body, { headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith('/api/')) return await handleApi(request, env, url);
      if (url.pathname.startsWith('/assets/beyond/') || url.pathname.startsWith('/assets/certs/')) {
        return await handleUploadAsset(request, env, url);
      }
      return await env.ASSETS.fetch(request);
    } catch (error) {
      return errorResponse(error);
    }
  }
};
