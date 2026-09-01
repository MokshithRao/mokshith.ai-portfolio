const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'projects.json');

// Ensure data directory and file exist
function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), 'utf8');
  }
}

// Safely read projects from data/projects.json
function readProjects() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Error reading projects.json:', err);
    return [];
  }
}

// Safely write projects to data/projects.json
function writeProjects(projects) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(projects, null, 2), 'utf8');
}

// MIME types map
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};

// URL validator
function isValidUrl(string) {
  try {
    const parsed = new URL(string);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ================= API Endpoints =================

  // GET /api/projects
  if (pathname === '/api/projects' && method === 'GET') {
    const projects = readProjects();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(projects));
    return;
  }

  // POST /api/projects
  if (pathname === '/api/projects' && method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      // Guard against huge payload
      if (body.length > 1e6) {
        req.destroy();
      }
    });

    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const name = (payload.name || '').trim();
        const description = (payload.description || '').trim();
        const github = (payload.github || '').trim();

        // Validation
        if (!name) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Project name is required' }));
          return;
        }

        if (!description) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Project description is required' }));
          return;
        }

        if (!github) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'GitHub link is required' }));
          return;
        }

        if (!isValidUrl(github)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Please provide a valid URL (starting with http:// or https://)' }));
          return;
        }

        // Process tags if provided
        let tags = [];
        if (Array.isArray(payload.tags)) {
          tags = payload.tags.map(t => String(t).trim()).filter(Boolean);
        } else if (typeof payload.tags === 'string' && payload.tags.trim()) {
          tags = payload.tags.split(',').map(t => t.trim()).filter(Boolean);
        }

        const newProject = {
          id: `project-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          name,
          description,
          github,
          tags: tags.length > 0 ? tags : ['AI/ML', 'Python'],
          icon: payload.icon || 'terminal',
          category: payload.category || 'AI/ML',
          createdAt: Date.now()
        };

        const projects = readProjects();
        // Insert at beginning (newest first)
        projects.unshift(newProject);
        writeProjects(projects);

        res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(newProject));
      } catch (err) {
        console.error('Error in POST /api/projects:', err);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
      }
    });
    return;
  }

  // PUT /api/projects/:id (Edit Project)
  if (pathname.startsWith('/api/projects/') && method === 'PUT') {
    const id = pathname.replace('/api/projects/', '').trim();
    if (!id) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Project ID required' }));
      return;
    }

    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 1e6) {
        req.destroy();
      }
    });

    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const name = (payload.name || '').trim();
        const description = (payload.description || '').trim();
        const github = (payload.github || '').trim();

        if (!name) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Project name is required' }));
          return;
        }

        if (!description) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Project description is required' }));
          return;
        }

        if (!github) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'GitHub link is required' }));
          return;
        }

        if (!isValidUrl(github)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Please provide a valid URL (starting with http:// or https://)' }));
          return;
        }

        let tags = [];
        if (Array.isArray(payload.tags)) {
          tags = payload.tags.map(t => String(t).trim()).filter(Boolean);
        } else if (typeof payload.tags === 'string' && payload.tags.trim()) {
          tags = payload.tags.split(',').map(t => t.trim()).filter(Boolean);
        }

        const projects = readProjects();
        const index = projects.findIndex(p => p.id === id);

        if (index === -1) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Project not found' }));
          return;
        }

        // Update project while preserving immutable attributes
        projects[index] = {
          ...projects[index],
          name,
          description,
          github,
          tags: tags.length > 0 ? tags : (projects[index].tags || ['AI/ML', 'Python']),
          updatedAt: Date.now()
        };

        writeProjects(projects);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(projects[index]));
      } catch (err) {
        console.error('Error in PUT /api/projects/:id:', err);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
      }
    });
    return;
  }

  // DELETE /api/projects/:id
  if (pathname.startsWith('/api/projects/') && method === 'DELETE') {
    const id = pathname.replace('/api/projects/', '').trim();
    if (!id) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Project ID required' }));
      return;
    }

    const projects = readProjects();
    const index = projects.findIndex(p => p.id === id);

    if (index === -1) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Project not found' }));
      return;
    }

    const removed = projects.splice(index, 1)[0];
    writeProjects(projects);

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: true, deleted: removed }));
    return;
  }

  // ================= Static File Serving =================

  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);

  // Security: prevent directory traversal
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(__dirname))) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.stat(resolved, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    const ext = path.extname(resolved).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    fs.createReadStream(resolved).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
