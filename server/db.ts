import fs from "fs";
import path from "path";
import { User, ShortLink, ClickLog } from "../src/types";

const DB_FILE = path.join(process.cwd(), "database.json");

interface DatabaseSchema {
  users: (User & { passwordHash: string })[];
  links: ShortLink[];
  clicks: ClickLog[];
  apiTokens: { token: string; userId: string; label: string; createdAt: string }[];
}

let dbCache: DatabaseSchema | null = null;

function loadDatabase(): DatabaseSchema {
  if (dbCache) return dbCache;

  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, "utf-8");
      dbCache = JSON.parse(raw);
    } catch (e) {
      console.error("Failed to parse database, using defaults", e);
    }
  }

  if (!dbCache) {
    dbCache = {
      users: [
        {
          id: "usr_admin",
          username: "admin",
          passwordHash: "admin123", // Pre-configured admin password
          role: "Admin",
          isSuspended: false,
          createdAt: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
        },
        {
          id: "usr_user1",
          username: "creator",
          passwordHash: "creator123",
          role: "User",
          isSuspended: false,
          createdAt: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString(),
        }
      ],
      links: [
        {
          id: "link_1",
          originalUrl: "https://news.ycombinator.com",
          shortCode: "hn",
          customAlias: "hn",
          createdAt: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
          userId: "usr_user1",
          clicksCount: 142
        },
        {
          id: "link_2",
          originalUrl: "https://github.com/trending",
          shortCode: "ghtrending",
          customAlias: "ghtrending",
          password: "dev",
          createdAt: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(),
          userId: "usr_admin",
          clicksCount: 88
        },
        {
          id: "link_3",
          originalUrl: "https://news.google.com",
          shortCode: "googlenews",
          createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
          userId: "usr_user1",
          clicksCount: 41
        }
      ],
      clicks: [],
      apiTokens: [
        {
          token: "bycs_tok_9218dha2s8da",
          userId: "usr_admin",
          label: "Primary Android Integration Token",
          createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
        }
      ],
    };

    // Seed click logs
    const now = Date.now();
    const count = 271;
    const countries = ["US", "IN", "DE", "ID", "BR", "CA", "GB", "AU", "JP", "FR"];
    const devices = ["Desktop", "Mobile", "Tablet"];
    const referrers = ["https://t.co", "https://facebook.com", "Direct", "https://linkedin.com", "https://youtube.com"];
    const browsers = ["Chrome", "Safari", "Firefox", "Edge"];

    const linkIds = ["link_1", "link_2", "link_3"];
    const codes = { link_1: "hn", link_2: "ghtrending", link_3: "googlenews" };

    for (let i = 0; i < count; i++) {
      const daysAgo = Math.floor(Math.sqrt(Math.random() * 100)) % 10; // cluster in last few days
      const clickTime = new Date(now - daysAgo * 24 * 3600 * 1000 - Math.random() * 24 * 3600 * 1000);
      const randomLink = linkIds[Math.floor(Math.random() * linkIds.length)];

      dbCache.clicks.push({
        id: `click_${i}`,
        linkId: randomLink,
        shortCode: (codes as any)[randomLink],
        timestamp: clickTime.toISOString(),
        ip: `192.168.1.${Math.floor(Math.random() * 254) + 1}`,
        referrer: referrers[Math.floor(Math.random() * referrers.length)],
        device: devices[Math.floor(Math.random() * devices.length)],
        country: countries[Math.floor(Math.random() * countries.length)],
        browser: browsers[Math.floor(Math.random() * browsers.length)]
      });
    }

    // Sync up click counts
    dbCache.links[0].clicksCount = dbCache.clicks.filter(c => c.linkId === "link_1").length;
    dbCache.links[1].clicksCount = dbCache.clicks.filter(c => c.linkId === "link_2").length;
    dbCache.links[2].clicksCount = dbCache.clicks.filter(c => c.linkId === "link_3").length;

    saveDatabase();
  }

  return dbCache;
}

function saveDatabase() {
  if (!dbCache) return;
  try {
    const backupFile = `${DB_FILE}.bak`;
    const tempFile = `${DB_FILE}.tmp`;
    const data = JSON.stringify(dbCache, null, 2);

    // Save atomic write to temp file then rename
    fs.writeFileSync(tempFile, data, "utf-8");
    if (fs.existsSync(DB_FILE)) {
      fs.copyFileSync(DB_FILE, backupFile);
    }
    fs.renameSync(tempFile, DB_FILE);
  } catch (e) {
    console.error("Failed to persist database file", e);
  }
}

export const db = {
  getUsers: (): User[] => {
    const rawUsers = loadDatabase().users;
    return rawUsers.map(({ id, username, role, isSuspended, createdAt }) => ({
      id,
      username,
      role,
      isSuspended,
      createdAt,
    }));
  },

  getUserByUsername: (username: string) => {
    return loadDatabase().users.find((u) => u.username.toLowerCase() === username.toLowerCase());
  },

  getUserById: (id: string): User | undefined => {
    const found = loadDatabase().users.find((u) => u.id === id);
    if (!found) return undefined;
    const { id: uId, username, role, isSuspended, createdAt } = found;
    return { id: uId, username, role, isSuspended, createdAt };
  },

  createUser: (username: string, passwordHash: string, role: "Admin" | "User"): User => {
    const store = loadDatabase();
    if (store.users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
      throw new Error(`User with username '${username}' already exists.`);
    }

    const newUser = {
      id: `usr_${Math.random().toString(36).substring(2, 11)}`,
      username,
      passwordHash,
      role,
      isSuspended: false,
      createdAt: new Date().toISOString(),
    };

    store.users.push(newUser);
    saveDatabase();

    const { id, isSuspended, createdAt } = newUser;
    return { id, username, role, isSuspended, createdAt };
  },

  deleteUser: (userId: string) => {
    const store = loadDatabase();
    const index = store.users.findIndex((u) => u.id === userId);
    if (index === -1) throw new Error("User not found");

    const username = store.users[index].username;
    if (username === "admin") {
      throw new Error("Cannot delete primary system administrator!");
    }

    store.users.splice(index, 1);
    // Delete links from that user as well
    store.links = store.links.filter((l) => l.userId !== userId);
    saveDatabase();
  },

  toggleSuspendUser: (userId: string): User => {
    const store = loadDatabase();
    const user = store.users.find((u) => u.id === userId);
    if (!user) throw new Error("User not found");

    if (user.username === "admin") {
      throw new Error("Cannot suspend system administrator!");
    }

    user.isSuspended = !user.isSuspended;
    saveDatabase();

    const { id, username, role, isSuspended, createdAt } = user;
    return { id, username, role, isSuspended, createdAt };
  },

  updateUserPassword: (userId: string, newPasswordHash: string) => {
    const store = loadDatabase();
    const user = store.users.find((u) => u.id === userId);
    if (!user) throw new Error("User not found");

    user.passwordHash = newPasswordHash;
    saveDatabase();
  },

  getLinks: (userId?: string, search?: string, limit = 10, offset = 0, role?: string): { total: number; links: ShortLink[] } => {
    const store = loadDatabase();
    let filtered = store.links;

    // Users can only see their own links, Admins can view all links inside the system
    if (userId && role !== "Admin") {
      filtered = filtered.filter((l) => l.userId === userId);
    }

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (l) =>
          l.shortCode.toLowerCase().includes(q) ||
          l.originalUrl.toLowerCase().includes(q) ||
          (l.customAlias && l.customAlias.toLowerCase().includes(q))
      );
    }

    // Sort by creation date descending
    filtered = [...filtered].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);

    return { total, links: paginated };
  },

  getAllLinksAdmin: (): ShortLink[] => {
    return loadDatabase().links;
  },

  getLinkByShortCode: (code: string): ShortLink | undefined => {
    const store = loadDatabase();
    return store.links.find((l) => l.shortCode.toLowerCase() === code.toLowerCase());
  },

  getLinkById: (id: string): ShortLink | undefined => {
    return loadDatabase().links.find((l) => l.id === id);
  },

  createLink: (userId: string, originalUrl: string, shortCode: string, password?: string, expirationDate?: string, customAlias?: string): ShortLink => {
    const store = loadDatabase();

    // Uniform URLs
    if (!originalUrl.startsWith("http://") && !originalUrl.startsWith("https://")) {
      originalUrl = "https://" + originalUrl;
    }

    // Check if short code already in use
    const cleanCode = shortCode.trim().toLowerCase();
    if (store.links.some(l => l.shortCode.toLowerCase() === cleanCode)) {
      throw new Error(`Alias/Shortcode '${shortCode}' already exists inside the system.`);
    }

    const newLink: ShortLink = {
      id: `link_${Math.random().toString(36).substring(2, 11)}`,
      originalUrl,
      shortCode: cleanCode,
      customAlias: customAlias ? customAlias.trim() : undefined,
      password: password && password.trim() !== "" ? password.trim() : undefined,
      expirationDate: expirationDate && expirationDate.trim() !== "" ? expirationDate : undefined,
      createdAt: new Date().toISOString(),
      userId,
      clicksCount: 0
    };

    store.links.push(newLink);
    saveDatabase();
    return newLink;
  },

  updateLink: (userId: string, userRole: string, linkId: string, updates: Partial<ShortLink>): ShortLink => {
    const store = loadDatabase();
    const link = store.links.find(l => l.id === linkId);
    if (!link) throw new Error("Link not found");

    if (userRole !== "Admin" && link.userId !== userId) {
      throw new Error("You do not have permission to modify this link.");
    }

    if (updates.shortCode) {
      const cleanCode = updates.shortCode.trim().toLowerCase();
      if (cleanCode !== link.shortCode.toLowerCase() && store.links.some(l => l.shortCode.toLowerCase() === cleanCode)) {
        throw new Error("Shortcode already in use");
      }
      link.shortCode = cleanCode;
    }

    if (updates.originalUrl) {
      let u = updates.originalUrl;
      if (!u.startsWith("http://") && !u.startsWith("https://")) {
        u = "https://" + u;
      }
      link.originalUrl = u;
    }

    if (updates.customAlias !== undefined) {
      link.customAlias = updates.customAlias ? updates.customAlias.trim() : undefined;
    }

    if (updates.password !== undefined) {
      link.password = updates.password ? updates.password.trim() : undefined;
    }

    if (updates.expirationDate !== undefined) {
      link.expirationDate = updates.expirationDate ? updates.expirationDate : undefined;
    }

    saveDatabase();
    return link;
  },

  deleteLink: (userId: string, userRole: string, linkId: string) => {
    const store = loadDatabase();
    const index = store.links.findIndex(l => l.id === linkId);
    if (index === -1) throw new Error("Link not found");

    const link = store.links[index];
    if (userRole !== "Admin" && link.userId !== userId) {
      throw new Error("You do not have permission to delete this link.");
    }

    store.links.splice(index, 1);
    store.clicks = store.clicks.filter((c) => c.linkId !== linkId);
    saveDatabase();
  },

  logClick: (linkId: string, shortCode: string, tracking: { ip: string; referrer: string; device: string; country: string; browser: string }) => {
    const store = loadDatabase();
    const link = store.links.find((l) => l.id === linkId);
    if (link) {
      link.clicksCount += 1;
    }

    const click: ClickLog = {
      id: `click_${Math.random().toString(36).substring(2, 11)}`,
      linkId,
      shortCode,
      timestamp: new Date().toISOString(),
      ip: tracking.ip,
      referrer: tracking.referrer || "Direct",
      device: tracking.device,
      country: tracking.country,
      browser: tracking.browser
    };

    store.clicks.push(click);
    saveDatabase();
    return click;
  },

  getLinkAnalytics: (userId: string, userRole: string, linkId?: string): { clicks: ClickLog[]; link?: ShortLink } => {
    const store = loadDatabase();

    if (linkId) {
      const link = store.links.find((l) => l.id === linkId);
      if (!link) throw new Error("Link not found");

      if (userRole !== "Admin" && link.userId !== userId) {
        throw new Error("Permission denied to view this link's analytics.");
      }

      const clicks = store.clicks.filter((c) => c.linkId === linkId);
      return { clicks, link };
    } else {
      // General analytics for users (or admins)
      let linksList = store.links;
      if (userRole !== "Admin") {
        linksList = store.links.filter((l) => l.userId === userId);
      }
      const activeIds = new Set(linksList.map((l) => l.id));
      const clicks = store.clicks.filter((c) => activeIds.has(c.linkId));

      return { clicks };
    }
  },

  getApiTokens: (userId: string) => {
    return loadDatabase().apiTokens.filter((t) => t.userId === userId);
  },

  createApiToken: (userId: string, label: string): string => {
    const store = loadDatabase();
    const token = `bycs_tok_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
    store.apiTokens.push({
      token,
      userId,
      label,
      createdAt: new Date().toISOString()
    });
    saveDatabase();
    return token;
  },

  deleteApiToken: (userId: string, token: string) => {
    const store = loadDatabase();
    const index = store.apiTokens.findIndex((t) => t.userId === userId && t.token === token);
    if (index !== -1) {
      store.apiTokens.splice(index, 1);
      saveDatabase();
    }
  },

  validateApiToken: (token: string): User | undefined => {
    const store = loadDatabase();
    const foundToken = store.apiTokens.find((t) => t.token === token);
    if (!foundToken) return undefined;

    const user = store.users.find((u) => u.id === foundToken.userId);
    if (!user || user.isSuspended) return undefined;

    const { id, username, role, isSuspended, createdAt } = user;
    return { id, username, role, isSuspended, createdAt };
  }
};
