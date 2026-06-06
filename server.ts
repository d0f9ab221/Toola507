import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { db } from "./server/db";
import { PageId, UserRole } from "./src/types";

// Setup express app
const app = express();
const PORT = 3000;

app.use(express.json());

// Memory-based Auth Store
const sessions = new Map<string, { userId: string; expiresAt: number }>();

// Simple Native Rate Limiter
const ipLimiter = new Map<string, { count: number; resetAt: number }>();
function rateLimiter(limit: number, windowMs: number) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown_ip";
    const now = Date.now();
    const client = ipLimiter.get(ip);

    if (!client || now > client.resetAt) {
      ipLimiter.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }

    client.count++;
    if (client.count > limit) {
      return res.status(429).json({
        error: "Too many requests. Please try again later.",
        resetInSeconds: Math.ceil((client.resetAt - now) / 1000)
      });
    }
    next();
  };
}

// Authentication Middleware
function authenticate(req: express.Request, res: express.Response, next: express.NextFunction) {
  // Check token in headers or query params
  const authHeader = req.headers.authorization;
  let token = "";

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else if (req.query.token && typeof req.query.token === "string") {
    token = req.query.token;
  }

  if (!token) {
    return res.status(411).json({ error: "Access token required" });
  }

  // Validate session token
  const session = sessions.get(token);
  if (session && session.expiresAt > Date.now()) {
    const user = db.getUserById(session.userId);
    if (!user) {
      return res.status(401).json({ error: "Authenticated user no longer exists" });
    }
    if (user.isSuspended) {
      return res.status(403).json({ error: "Your account is suspended. Contact admin." });
    }
    (req as any).user = user;
    (req as any).token = token;
    return next();
  }

  // Fallback: Validate API key token
  const user = db.validateApiToken(token);
  if (user) {
    (req as any).user = user;
    (req as any).token = token;
    return next();
  }

  return res.status(401).json({ error: "Session or token expired. Please log in again." });
}

// Admin privileges assertion helper
function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = (req as any).user;
  if (!user || user.role !== "Admin") {
    return res.status(403).json({ error: "Access denied. Administrative privileges required." });
  }
  next();
}

// Helper methods for user agent parsing
function getDeviceType(userAgent: string = ""): string {
  const ua = userAgent.toLowerCase();
  if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
    return "Mobile";
  }
  if (ua.includes("ipad") || ua.includes("tablet") || ua.includes("playbook") || ua.includes("kindle")) {
    return "Tablet";
  }
  return "Desktop";
}

function getBrowserType(userAgent: string = ""): string {
  const ua = userAgent.toLowerCase();
  if (ua.includes("chrome") || ua.includes("crios")) return "Chrome";
  if (ua.includes("safari") && !ua.includes("chrome")) return "Safari";
  if (ua.includes("firefox")) return "Firefox";
  if (ua.includes("edge") || ua.includes("edg")) return "Edge";
  return "Other";
}

function getCountryCode(req: express.Request): string {
  const geo = req.headers["cf-ipcountry"] || req.headers["x-country-code"] || req.headers["x-vercel-ip-country"];
  if (geo && typeof geo === "string" && geo.length === 2) {
    return geo.toUpperCase();
  }
  // Simulating country fallbacks beautifully for demo simulation
  const pool = ["US", "US", "IN", "IN", "DE", "ID", "BR", "CA", "GB", "AU", "JP", "FR"];
  return pool[Math.floor(Math.random() * pool.length)];
}

// ==========================================
// API REST ENDPOINTS
// ==========================================

// Authenticate user check
app.get("/api/auth/me", authenticate, (req: any, res) => {
  res.json({ user: req.user, token: req.token });
});

// Update current user password
app.post("/api/auth/password", authenticate, (req: any, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.trim().length < 4) {
    return res.status(400).json({ error: "Password must be at least 4 characters long" });
  }
  try {
    db.updateUserPassword(req.user.id, newPassword.trim());
    res.json({ success: true, message: "Password updated successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to update password" });
  }
});

// Create session (Login)
app.post("/api/auth/login", rateLimiter(10, 60 * 1000), (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  const user = db.getUserByUsername(username);
  if (!user || user.passwordHash !== password) {
    return res.status(401).json({ error: "Invalid username or password" });
  }

  if (user.isSuspended) {
    return res.status(403).json({ error: "This user profile is currently suspended. Please contact administrative support." });
  }

  // Create session token
  const token = `bycs_sess_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
  const expiresAt = Date.now() + 24 * 3600 * 1000; // 24 hours
  sessions.set(token, { userId: user.id, expiresAt });

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      isSuspended: user.isSuspended,
      createdAt: user.createdAt
    }
  });
});

// Firebase Google Sign-In verification & Session generation
app.post("/api/auth/google", rateLimiter(15, 60 * 1000), (req, res) => {
  const { email, uid, displayName } = req.body;
  if (!email || !uid) {
    return res.status(400).json({ error: "Missing email or uid from Google profile" });
  }

  // Find or create a user mapped to this Google sign-in
  let user: any = db.getUserByUsername(email);
  if (!user) {
    // If it's the main developer (phagran906@gmail.com), assign Admin role. Otherwise make it dynamic,
    // or if they are the first user in the system. Here we use the developer email.
    const normalizedRole = email.toLowerCase() === "phagran906@gmail.com" ? "Admin" : "User";
    try {
      user = db.createUser(email, `gg_${uid}`, normalizedRole);
    } catch (err: any) {
      user = db.getUserByUsername(email);
    }
  }

  if (!user) {
    return res.status(500).json({ error: "Could not retrieve or register user session" });
  }

  if (user.isSuspended) {
    return res.status(403).json({ error: "This user profile is currently suspended. Please contact administrative support." });
  }

  // Generate session token
  const token = `bycs_sess_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
  const expiresAt = Date.now() + 24 * 3600 * 1000; // 24 hours
  sessions.set(token, { userId: user.id, expiresAt });

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      isSuspended: user.isSuspended,
      createdAt: user.createdAt
    }
  });
});

// Fetch user listing (Admin Only)
app.get("/api/users", authenticate, requireAdmin, (req, res) => {
  res.json({ users: db.getUsers() });
});

// Admin create user
app.post("/api/users", authenticate, requireAdmin, (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ error: "Username, password and role are required fields" });
  }

  const normalizedRole: UserRole = role === "Admin" ? "Admin" : "User";
  const cleanUsername = username.trim().toLowerCase();

  try {
    const newUser = db.createUser(cleanUsername, password, normalizedRole);
    res.json({ success: true, user: newUser });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to register user to the shortener" });
  }
});

// Admin toggle suspension status
app.post("/api/users/:userId/suspend", authenticate, requireAdmin, (req, res) => {
  try {
    const updated = db.toggleSuspendUser(req.params.userId);
    res.json({ success: true, user: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failure toggling user suspension" });
  }
});

// Admin delete user
app.delete("/api/users/:userId", authenticate, requireAdmin, (req, res) => {
  try {
    db.deleteUser(req.params.userId);
    res.json({ success: true, message: "User and all associated links successfully removed" });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to delete user" });
  }
});

// API developer key integration
app.get("/api/settings/tokens", authenticate, (req: any, res) => {
  res.json({ tokens: db.getApiTokens(req.user.id) });
});

app.post("/api/settings/tokens", authenticate, (req: any, res) => {
  const { label } = req.body;
  if (!label || label.trim() === "") {
    return res.status(400).json({ error: "Token reference label is required." });
  }
  const token = db.createApiToken(req.user.id, label);
  res.json({ success: true, token, label });
});

app.delete("/api/settings/tokens/:token", authenticate, (req: any, res) => {
  db.deleteApiToken(req.user.id, req.params.token);
  res.json({ success: true, message: "API Token revoked successfully" });
});

// Public / future developer access to high speed code creation (API Integration)
app.post("/api/v1/shorten", rateLimiter(60, 60 * 1000), (req: any, res) => {
  const authHeader = req.headers.authorization;
  let token = "";

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else if (req.body.token) {
    token = req.body.token;
  }

  if (!token) {
    return res.status(401).json({ error: "Missing API authorization token." });
  }

  const authenticatedUser = db.validateApiToken(token);
  if (!authenticatedUser) {
    return res.status(401).json({ error: "Invalid or revoked API authentication token." });
  }

  const { originalUrl, customAlias, password, expirationDate } = req.body;
  if (!originalUrl) {
    return res.status(400).json({ error: "originalUrl is a required field." });
  }

  // Handle custom alias or random key
  let shortCode = customAlias ? customAlias.trim().toLowerCase() : Math.random().toString(36).substring(2, 8);
  if (customAlias) {
    // Check duplication
    const check = db.getLinkByShortCode(shortCode);
    if (check) {
      return res.status(400).json({ error: `Custom alias '${shortCode}' is already registered.` });
    }
  }

  try {
    const fullLink = db.createLink(
      authenticatedUser.id,
      originalUrl,
      shortCode,
      password,
      expirationDate,
      customAlias
    );

    const fullRedirectUrl = `${process.env.APP_URL || "http://localhost:3000"}/${fullLink.shortCode}`;
    res.json({
      success: true,
      data: {
        id: fullLink.id,
        originalUrl: fullLink.originalUrl,
        shortCode: fullLink.shortCode,
        shortUrl: fullRedirectUrl,
        passwordProtected: !!fullLink.password,
        expirationDate: fullLink.expirationDate,
        createdAt: fullLink.createdAt
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to register shortened path" });
  }
});

// Fetch links with paginations and searching queries
app.get("/api/links", authenticate, (req: any, res) => {
  const search = req.query.search ? String(req.query.search) : undefined;
  const limit = req.query.limit ? parseInt(String(req.query.limit)) : 10;
  const offset = req.query.offset ? parseInt(String(req.query.offset)) : 0;

  const result = db.getLinks(req.user.id, search, limit, offset, req.user.role);
  res.json(result);
});

// Export CSV
app.get("/api/links/export", authenticate, (req: any, res) => {
  // Read all links the user is authorized to read
  let linksList: any[] = [];
  if (req.user.role === "Admin") {
    linksList = db.getAllLinksAdmin();
  } else {
    linksList = db.getLinks(req.user.id, undefined, 100000, 0).links;
  }

  // Construct CSV headers
  let csv = "ID,ShortCode,OriginalURL,CustomAlias,PasswordProtected,ExpirationDate,CreatedAt,Clicks\n";
  for (const link of linksList) {
    const id = link.id;
    const code = link.shortCode;
    // escape commas and double quotes
    const orig = `"${link.originalUrl.replace(/"/g, '""')}"`;
    const alias = link.customAlias || "";
    const pass = link.password ? "Yes" : "No";
    const exp = link.expirationDate || "Never";
    const date = link.createdAt;
    const clicks = link.clicksCount;

    csv += `${id},${code},${orig},${alias},${pass},${exp},${date},${clicks}\n`;
  }

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=by_cs_tools_redirects.csv");
  res.send(csv);
});

// Create Link
app.post("/api/links", authenticate, (req: any, res) => {
  const { originalUrl, customAlias, password, expirationDate } = req.body;

  if (!originalUrl) {
    return res.status(400).json({ error: "Original URL is a required field." });
  }

  // Validate URL pattern briefly
  let cleanUrl = originalUrl.trim();
  if (!cleanUrl.match(/^https?:\/\//i)) {
    cleanUrl = "https://" + cleanUrl;
  }

  let code = customAlias ? customAlias.trim().toLowerCase() : "";
  if (!code) {
    // Generate secure randomized base-36 string
    code = Math.random().toString(36).substring(2, 8);
  }

  // Verify uniqueness of code
  const existing = db.getLinkByShortCode(code);
  if (existing) {
    return res.status(400).json({ error: `Alias or shortcode '${code}' is already reserved.` });
  }

  try {
    const link = db.createLink(
      req.user.id,
      cleanUrl,
      code,
      password,
      expirationDate,
      customAlias
    );
    res.json({ success: true, link });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to generate short path." });
  }
});

// Edit Link
app.put("/api/links/:linkId", authenticate, (req: any, res) => {
  const { originalUrl, customAlias, password, expirationDate, shortCode } = req.body;
  try {
    const updated = db.updateLink(req.user.id, req.user.role, req.params.linkId, {
      originalUrl,
      customAlias,
      password,
      expirationDate,
      shortCode
    });
    res.json({ success: true, link: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to patch link update" });
  }
});

// Delete Link
app.delete("/api/links/:linkId", authenticate, (req: any, res) => {
  try {
    db.deleteLink(req.user.id, req.user.role, req.params.linkId);
    res.json({ success: true, message: "Shortened link removed successfully" });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to delete from inventory" });
  }
});

// Aggregate and individual Click analytics retrieval
app.get("/api/analytics", authenticate, (req: any, res) => {
  const { linkId } = req.query;
  try {
    const { clicks, link } = db.getLinkAnalytics(req.user.id, req.user.role, linkId ? String(linkId) : undefined);
    res.json({ clicks, link });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to query analytical logs" });
  }
});

// Dashboard metrics cards endpoint
app.get("/api/dashboard/stats", authenticate, (req: any, res) => {
  // Retrieve raw logs and links corresponding to access role
  const { clicks } = db.getLinkAnalytics(req.user.id, req.user.role);
  let totalLinks = 0;
  let activeLinksCount = 0;

  if (req.user.role === "Admin") {
    const links = db.getAllLinksAdmin();
    totalLinks = links.length;
    // count links that are not expired yet
    const now = new Date();
    activeLinksCount = links.filter(l => !l.expirationDate || new Date(l.expirationDate).getTime() > now.getTime()).length;
  } else {
    const p = db.getLinks(req.user.id, undefined, 100000, 0);
    totalLinks = p.total;
    const now = new Date();
    activeLinksCount = p.links.filter(l => !l.expirationDate || new Date(l.expirationDate).getTime() > now.getTime()).length;
  }

  // Date sequence over the last 10 days
  const dateMap = new Map<string, number>();
  const now = Date.now();
  for (let i = 9; i >= 0; i--) {
    const dateStr = new Date(now - i * 24 * 3600 * 1000).toISOString().split("T")[0];
    dateMap.set(dateStr, 0);
  }

  // Device sequence
  const deviceCounters: Record<string, number> = { Desktop: 0, Mobile: 0, Tablet: 0 };
  // Country sequence
  const countryCounters: Record<string, number> = {};

  clicks.forEach((clk) => {
    // Click Date
    const d = clk.timestamp.split("T")[0];
    if (dateMap.has(d)) {
      dateMap.set(d, (dateMap.get(d) || 0) + 1);
    }

    // Devices
    const dev = clk.device || "Desktop";
    deviceCounters[dev] = (deviceCounters[dev] || 0) + 1;

    // Countries
    const ctry = clk.country || "US";
    countryCounters[ctry] = (countryCounters[ctry] || 0) + 1;
  });

  const clicksByDate = Array.from(dateMap.entries()).map(([date, count]) => ({
    date,
    clicks: count
  }));

  const deviceStats = Object.entries(deviceCounters).map(([device, count]) => ({
    device,
    count
  }));

  const countryStats = Object.entries(countryCounters)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([country, count]) => ({
      country,
      count
    }));

  res.json({
    totalLinks,
    totalClicks: clicks.length,
    activeLinksCount,
    clicksByDate,
    deviceStats,
    countryStats,
    recentClicks: clicks.slice(-10).reverse()
  });
});

// Admin Panel Analytics: user statistics
app.get("/api/admin/users-summary", authenticate, requireAdmin, (req, res) => {
  const users = db.getUsers();
  const links = db.getAllLinksAdmin();

  const userSummaries = users.map(u => {
    const userLinks = links.filter(l => l.userId === u.id);
    const userClicks = userLinks.reduce((sum, current) => sum + current.clicksCount, 0);
    return {
      id: u.id,
      username: u.username,
      role: u.role,
      isSuspended: u.isSuspended,
      createdAt: u.createdAt,
      linksCreated: userLinks.length,
      clicksCount: userClicks
    };
  });

  res.json({ users: userSummaries });
});


// ==========================================
// REDIRECTION ENGINE ROUTE (The Heart of the shortener)
// ==========================================

// Handle password validation challenge POST
app.post("/r-password/:shortCode", (req, res) => {
  const { shortCode } = req.params;
  const { password } = req.body;

  const link = db.getLinkByShortCode(shortCode);
  if (!link) {
    return res.status(404).send("Link not found");
  }

  if (link.password !== password) {
    // Render password page again with error message
    return servePasswordChallengePage(res, shortCode, "Incorrect Password. Access Denied.");
  }

  // If password matches, perform tracking and forward redirect
  finalizeRedirection(req, res, link);
});

// Serve actual shortcode gateway redirect
app.get("/:shortCode", (req, res, next) => {
  const { shortCode } = req.params;

  // Let API endpoints pass through to downstream routers
  if (shortCode.startsWith("api") || shortCode.includes(".") || shortCode === "assets" || shortCode === "src") {
    return next();
  }

  const link = db.getLinkByShortCode(shortCode);
  if (!link) {
    // Render standard beautiful 404 shortener page
    return serveVisualErrorPage(res, 404, "Shortened Link Not Found", `The alias path '/${shortCode}' does not exist inside our active routing maps.`);
  }

  // Expiration date assertion check
  if (link.expirationDate) {
    const exp = new Date(link.expirationDate);
    if (Date.now() > exp.getTime()) {
      return serveVisualErrorPage(res, 410, "Short Link Expired", `This link expired on ${exp.toLocaleString()}. Access is now turned off by platform rules.`);
    }
  }

  // Password guard check
  if (link.password) {
    return servePasswordChallengePage(res, shortCode);
  }

  // Perform standard tracking redirect
  finalizeRedirection(req, res, link);
});


// Helper to persist click and bounce user off
function finalizeRedirection(req: express.Request, res: express.Response, link: any) {
  try {
    const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
    const referrer = req.headers.referer || req.headers.referrer || "Direct";
    const browser = getBrowserType(req.headers["user-agent"]);
    const device = getDeviceType(req.headers["user-agent"]);
    const country = getCountryCode(req);

    // Track analytics log asynchronously
    db.logClick(link.id, link.shortCode, {
      ip,
      referrer: typeof referrer === "string" ? referrer : "Direct",
      device,
      country,
      browser
    });

    // 301 Permanent Redirect
    res.redirect(301, link.originalUrl);
  } catch (err) {
    console.error("Redirection failure", err);
    res.redirect(link.originalUrl); // safe fallback if analytics log glitches
  }
}

// Render secure password gateway screen
function servePasswordChallengePage(res: express.Response, shortCode: string, errorMessage = "") {
  res.setHeader("Content-Type", "text/html");
  res.status(200).send(`
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BY CS TOOLS - Secure Gateway</title>
  <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
  <style>
    body {
      background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
    }
    .glass {
      background: rgba(255, 255, 255, 0.03);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.07);
    }
  </style>
</head>
<body class="min-h-screen text-slate-100 flex flex-col justify-between items-center px-4 py-8">
  <div></div>
  
  <div class="w-full max-w-md glass p-8 rounded-2xl shadow-2xl relative overflow-hidden">
    <!-- Branding Accent -->
    <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 to-indigo-500"></div>

    <div class="text-center mb-8">
      <h1 class="text-xs tracking-widest text-cyan-400 font-bold uppercase mb-2">BY CS TOOLS</h1>
      <h2 class="text-2xl font-bold tracking-tight text-white mb-2">Password Protected Link</h2>
      <p class="text-xs text-slate-400">This URL shortener node requires a passkey signature lookup to verify entry rights.</p>
    </div>

    ${errorMessage ? `
    <div class="mb-4 p-3 bg-red-950/40 border border-red-500/30 text-red-200 text-xs text-center rounded-lg">
      ${errorMessage}
    </div>
    ` : ""}

    <form method="POST" action="/r-password/${shortCode}" class="space-y-4">
      <div>
        <label for="password" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Enter Destination Password</label>
        <input type="password" id="password" name="password" required autofocus
               placeholder="🔑 •••••••••••••••" 
               class="w-full px-4 py-3 bg-slate-900/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all text-center tracking-widest">
      </div>

      <button type="submit" 
              class="w-full py-3 px-4 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-sm font-semibold rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0 focus:outline-none">
        Decrypt & Decrypt Target
      </button>
    </form>
  </div>

  <div class="text-center text-slate-500 text-xs space-y-1">
    <p class="tracking-widest font-bold uppercase text-cyan-500/60">BY CS TOOLS</p>
    <p>© BY CS TOOLS. All Rights Reserved.</p>
  </div>
</body>
</html>
  `);
}

// Serve structured elegant HTML error screen
function serveVisualErrorPage(res: express.Response, status: number, header: string, desc: string) {
  res.setHeader("Content-Type", "text/html");
  res.status(status).send(`
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BY CS TOOLS - ${status}</title>
  <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
  <style>
    body {
      background: linear-gradient(135deg, #090d16 0%, #111827 100%);
    }
    .glass {
      background: rgba(255, 255, 255, 0.02);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.05);
    }
  </style>
</head>
<body class="min-h-screen text-slate-200 flex flex-col justify-between items-center px-4 py-8">
  <div></div>
  
  <div class="w-full max-w-lg glass p-10 rounded-2xl shadow-2xl relative text-center">
    <div class="absolute top-0 left-1/2 transform -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-red-500 via-pink-500 to-indigo-500"></div>
    <div class="text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-pink-500 mb-4">${status}</div>
    <h1 class="text-2xl font-bold tracking-tight text-white mb-2">${header}</h1>
    <p class="text-slate-400 text-sm max-w-md mx-auto mb-8">${desc}</p>
    
    <a href="/" 
       class="inline-flex items-center px-6 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-sm font-semibold rounded-xl text-white transition-all transform hover:-translate-y-0.5 active:translate-y-0">
      Return to BY CS TOOLS Dashboard
    </a>
  </div>

  <div class="text-center text-slate-600 text-xs space-y-1">
    <p class="tracking-widest font-bold uppercase text-red-400/60">BY CS TOOLS</p>
    <p>© BY CS TOOLS. All Rights Reserved.</p>
  </div>
</body>
</html>
  `);
}


// ==========================================
// INTEGRATING VITE INTERFACE MIDDLEWARES
// ==========================================
async function runServer() {
  if (process.env.NODE_ENV !== "production") {
    // Mount Vite dev server
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`BY CS TOOLS full-stack node engine active on http://localhost:${PORT}`);
  });
}

runServer();
