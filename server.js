const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'projects.json');
const BEYOND_FILE = path.join(DATA_DIR, 'beyond.json');
const BEYOND_UPLOAD_DIR = path.join(__dirname, 'assets', 'beyond');
const CERTS_FILE = path.join(DATA_DIR, 'certifications.json');
const CERTS_UPLOAD_DIR = path.join(__dirname, 'assets', 'certs');

// Ensure data directory and files exist
function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), 'utf8');
  }
  if (!fs.existsSync(BEYOND_UPLOAD_DIR)) {
    fs.mkdirSync(BEYOND_UPLOAD_DIR, { recursive: true });
  }
  if (!fs.existsSync(BEYOND_FILE)) {
    fs.writeFileSync(BEYOND_FILE, JSON.stringify([], null, 2), 'utf8');
  }
  if (!fs.existsSync(CERTS_UPLOAD_DIR)) {
    fs.mkdirSync(CERTS_UPLOAD_DIR, { recursive: true });
  }
  if (!fs.existsSync(CERTS_FILE)) {
    fs.writeFileSync(CERTS_FILE, JSON.stringify([], null, 2), 'utf8');
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

// Safely read beyond items from data/beyond.json
function readBeyond() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(BEYOND_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Error reading beyond.json:', err);
    return [];
  }
}

// Safely write beyond items to data/beyond.json
function writeBeyond(items) {
  ensureDataFile();
  fs.writeFileSync(BEYOND_FILE, JSON.stringify(items, null, 2), 'utf8');
}

// Safely read certifications from data/certifications.json
function readCerts() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(CERTS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Error reading certifications.json:', err);
    return [];
  }
}

// Safely write certifications to data/certifications.json
function writeCerts(certs) {
  ensureDataFile();
  fs.writeFileSync(CERTS_FILE, JSON.stringify(certs, null, 2), 'utf8');
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

  // ================= Beyond the Resume Endpoints =================

  // GET /api/beyond
  if (pathname === '/api/beyond' && method === 'GET') {
    const items = readBeyond();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(items));
    return;
  }

  // POST /api/beyond/upload (Multiple image upload as Base64)
  if (pathname === '/api/beyond/upload' && method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      // Allow up to 50MB for multiple photos
      if (body.length > 50 * 1024 * 1024) {
        req.destroy();
      }
    });

    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const images = Array.isArray(payload.images) ? payload.images : (payload.data ? [payload] : []);

        if (images.length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'No images provided' }));
          return;
        }

        const savedUrls = [];
        ensureDataFile();

        images.forEach((img, idx) => {
          let base64Data = '';
          let ext = '.jpg';

          if (typeof img === 'string') {
            base64Data = img;
          } else if (img && img.data) {
            base64Data = img.data;
          }

          if (!base64Data) return;

          // Check if it's already a URL / existing path
          if (base64Data.startsWith('assets/') || base64Data.startsWith('/assets/') || base64Data.startsWith('http://') || base64Data.startsWith('https://')) {
            savedUrls.push(base64Data);
            return;
          }

          // Detect MIME / extension
          const matches = base64Data.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
          if (matches) {
            let type = matches[1].toLowerCase();
            if (type === 'jpeg') type = 'jpg';
            if (type === 'svg+xml') type = 'svg';
            ext = `.${type}`;
            base64Data = matches[2];
          } else {
            // Strip any prefix if present
            base64Data = base64Data.replace(/^data:[^;]+;base64,/, '');
          }

          const filename = `beyond-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}${ext}`;
          const filePath = path.join(BEYOND_UPLOAD_DIR, filename);
          const buffer = Buffer.from(base64Data, 'base64');
          fs.writeFileSync(filePath, buffer);
          savedUrls.push(`assets/beyond/${filename}`);
        });

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, urls: savedUrls }));
      } catch (err) {
        console.error('Error in POST /api/beyond/upload:', err);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to process image upload' }));
      }
    });
    return;
  }

  // POST /api/beyond/items
  if (pathname === '/api/beyond/items' && method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 50 * 1024 * 1024) {
        req.destroy();
      }
    });

    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const title = (payload.title || '').trim();
        const category = (payload.category || '').trim();

        if (!title) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Item title is required' }));
          return;
        }

        if (!category) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Category is required' }));
          return;
        }

        // Handle category icon mapping
        const categoryIconMap = {
          'reading': 'menu_book',
          'workshops': 'construction',
          'workshop': 'construction',
          'events': 'campaign',
          'event': 'campaign',
          'learning': 'school',
          'activities': 'directions_run',
          'activity': 'directions_run',
          'hobbies': 'palette',
          'hobby': 'palette',
          'interests': 'track_changes',
          'interest': 'track_changes',
          'other': 'auto_awesome'
        };

        const catKey = category.toLowerCase().trim();
        const categoryIcon = payload.categoryIcon || categoryIconMap[catKey] || 'category';

        const newItem = {
          id: `beyond-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          category,
          categoryIcon,
          title,
          subtitle: (payload.subtitle || '').trim(),
          status: (payload.status || '').trim(),
          date: (payload.date || '').trim(),
          description: (payload.description || '').trim(),
          images: Array.isArray(payload.images) ? payload.images.filter(Boolean) : [],
          link: (payload.link || '').trim(),
          linkLabel: (payload.linkLabel || '').trim(),
          customFields: Array.isArray(payload.customFields)
            ? payload.customFields.filter(f => f && (f.label || f.value))
            : [],
          createdAt: Date.now()
        };

        const items = readBeyond();
        items.unshift(newItem);
        writeBeyond(items);

        res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(newItem));
      } catch (err) {
        console.error('Error in POST /api/beyond/items:', err);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
      }
    });
    return;
  }

  // PUT /api/beyond/items/:id
  if (pathname.startsWith('/api/beyond/items/') && method === 'PUT') {
    const id = pathname.replace('/api/beyond/items/', '').trim();
    if (!id) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Item ID required' }));
      return;
    }

    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 50 * 1024 * 1024) {
        req.destroy();
      }
    });

    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const title = (payload.title || '').trim();
        const category = (payload.category || '').trim();

        if (!title) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Item title is required' }));
          return;
        }

        if (!category) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Category is required' }));
          return;
        }

        const items = readBeyond();
        const index = items.findIndex(item => item.id === id);

        if (index === -1) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Item not found' }));
          return;
        }

        const categoryIconMap = {
          'reading': 'menu_book',
          'workshops': 'construction',
          'workshop': 'construction',
          'events': 'campaign',
          'event': 'campaign',
          'learning': 'school',
          'activities': 'directions_run',
          'activity': 'directions_run',
          'hobbies': 'palette',
          'hobby': 'palette',
          'interests': 'track_changes',
          'interest': 'track_changes',
          'other': 'auto_awesome'
        };

        const catKey = category.toLowerCase().trim();
        const categoryIcon = payload.categoryIcon || categoryIconMap[catKey] || items[index].categoryIcon || 'category';

        items[index] = {
          ...items[index],
          category,
          categoryIcon,
          title,
          subtitle: (payload.subtitle || '').trim(),
          status: (payload.status || '').trim(),
          date: (payload.date || '').trim(),
          description: (payload.description || '').trim(),
          images: Array.isArray(payload.images) ? payload.images.filter(Boolean) : (items[index].images || []),
          link: (payload.link || '').trim(),
          linkLabel: (payload.linkLabel || '').trim(),
          customFields: Array.isArray(payload.customFields)
            ? payload.customFields.filter(f => f && (f.label || f.value))
            : [],
          updatedAt: Date.now()
        };

        writeBeyond(items);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(items[index]));
      } catch (err) {
        console.error('Error in PUT /api/beyond/items/:id:', err);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
      }
    });
    return;
  }

  // DELETE /api/beyond/items/:id
  if (pathname.startsWith('/api/beyond/items/') && method === 'DELETE') {
    const id = pathname.replace('/api/beyond/items/', '').trim();
    if (!id) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Item ID required' }));
      return;
    }

    const items = readBeyond();
    const index = items.findIndex(item => item.id === id);

    if (index === -1) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Item not found' }));
      return;
    }

    const removed = items.splice(index, 1)[0];
    writeBeyond(items);

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: true, deleted: removed }));
    return;
  }

  // ================= Certifications Endpoints =================

  // GET /api/certifications
  if (pathname === '/api/certifications' && method === 'GET') {
    const certs = readCerts();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(certs));
    return;
  }

  // POST /api/certifications/upload (Image upload as Base64)
  if (pathname === '/api/certifications/upload' && method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 50 * 1024 * 1024) {
        req.destroy();
      }
    });

    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const images = Array.isArray(payload.images) ? payload.images : (payload.data ? [payload] : []);

        if (images.length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'No images provided' }));
          return;
        }

        const savedUrls = [];
        ensureDataFile();

        images.forEach((img, idx) => {
          let base64Data = '';
          let ext = '.jpg';

          if (typeof img === 'string') {
            base64Data = img;
          } else if (img && img.data) {
            base64Data = img.data;
          }

          if (!base64Data) return;

          if (base64Data.startsWith('assets/') || base64Data.startsWith('/assets/') || base64Data.startsWith('http://') || base64Data.startsWith('https://')) {
            savedUrls.push(base64Data);
            return;
          }

          const matches = base64Data.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
          if (matches) {
            let type = matches[1].toLowerCase();
            if (type === 'jpeg') type = 'jpg';
            if (type === 'svg+xml') type = 'svg';
            ext = `.${type}`;
            base64Data = matches[2];
          } else {
            base64Data = base64Data.replace(/^data:[^;]+;base64,/, '');
          }

          const filename = `cert-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}${ext}`;
          const filePath = path.join(CERTS_UPLOAD_DIR, filename);
          const buffer = Buffer.from(base64Data, 'base64');
          fs.writeFileSync(filePath, buffer);
          savedUrls.push(`assets/certs/${filename}`);
        });

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, urls: savedUrls }));
      } catch (err) {
        console.error('Error in POST /api/certifications/upload:', err);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to process certificate image upload' }));
      }
    });
    return;
  }

  // POST /api/certifications
  if (pathname === '/api/certifications' && method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 50 * 1024 * 1024) {
        req.destroy();
      }
    });

    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const name = (payload.name || '').trim();
        const issuer = (payload.issuer || '').trim();

        if (!name) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Certificate name is required' }));
          return;
        }

        let skills = [];
        if (Array.isArray(payload.skills)) {
          skills = payload.skills.map(s => String(s).trim()).filter(Boolean);
        } else if (typeof payload.skills === 'string' && payload.skills.trim()) {
          skills = payload.skills.split(',').map(s => s.trim()).filter(Boolean);
        }

        const newCert = {
          id: `cert-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          name,
          issuer: issuer || 'Independent Certification',
          date: (payload.date || '').trim(),
          year: (payload.year || payload.date || '').trim(),
          category: (payload.category || 'Other').trim(),
          images: Array.isArray(payload.images) ? payload.images.filter(Boolean) : [],
          credentialId: (payload.credentialId || '').trim(),
          credentialUrl: (payload.credentialUrl || '').trim(),
          skills,
          description: (payload.description || '').trim(),
          createdAt: Date.now()
        };

        const certs = readCerts();
        certs.unshift(newCert);
        writeCerts(certs);

        res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(newCert));
      } catch (err) {
        console.error('Error in POST /api/certifications:', err);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
      }
    });
    return;
  }

  // PUT /api/certifications/:id
  if (pathname.startsWith('/api/certifications/') && method === 'PUT') {
    const id = pathname.replace('/api/certifications/', '').trim();
    if (!id) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Certificate ID required' }));
      return;
    }

    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 50 * 1024 * 1024) {
        req.destroy();
      }
    });

    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const name = (payload.name || '').trim();

        if (!name) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Certificate name is required' }));
          return;
        }

        const certs = readCerts();
        const index = certs.findIndex(c => c.id === id);

        if (index === -1) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Certificate not found' }));
          return;
        }

        let skills = [];
        if (Array.isArray(payload.skills)) {
          skills = payload.skills.map(s => String(s).trim()).filter(Boolean);
        } else if (typeof payload.skills === 'string' && payload.skills.trim()) {
          skills = payload.skills.split(',').map(s => s.trim()).filter(Boolean);
        } else if (certs[index].skills) {
          skills = certs[index].skills;
        }

        certs[index] = {
          ...certs[index],
          name,
          issuer: (payload.issuer || certs[index].issuer || '').trim(),
          date: (payload.date !== undefined ? payload.date : certs[index].date || '').trim(),
          year: (payload.year !== undefined ? payload.year : certs[index].year || '').trim(),
          category: (payload.category || certs[index].category || 'Other').trim(),
          images: Array.isArray(payload.images) ? payload.images.filter(Boolean) : (certs[index].images || []),
          credentialId: (payload.credentialId !== undefined ? payload.credentialId : certs[index].credentialId || '').trim(),
          credentialUrl: (payload.credentialUrl !== undefined ? payload.credentialUrl : certs[index].credentialUrl || '').trim(),
          skills,
          description: (payload.description !== undefined ? payload.description : certs[index].description || '').trim(),
          updatedAt: Date.now()
        };

        writeCerts(certs);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(certs[index]));
      } catch (err) {
        console.error('Error in PUT /api/certifications/:id:', err);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
      }
    });
    return;
  }

  // DELETE /api/certifications/:id
  if (pathname.startsWith('/api/certifications/') && method === 'DELETE') {
    const id = pathname.replace('/api/certifications/', '').trim();
    if (!id) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Certificate ID required' }));
      return;
    }

    const certs = readCerts();
    const index = certs.findIndex(c => c.id === id);

    if (index === -1) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Certificate not found' }));
      return;
    }

    const removed = certs.splice(index, 1)[0];
    writeCerts(certs);

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
