/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { auth, googleProvider, signInWithPopup } from "./firebase";
import { motion, AnimatePresence } from "motion/react";
import {
  Link2,
  ExternalLink,
  Copy,
  Check,
  Edit2,
  Trash2,
  Search,
  ChevronLeft,
  ChevronRight,
  QrCode,
  Lock,
  LockOpen,
  Calendar,
  BarChart3,
  Users,
  User,
  Settings,
  Info,
  LogOut,
  Moon,
  Sun,
  PlusCircle,
  Menu,
  X,
  TrendingUp,
  Globe,
  Smartphone,
  Laptop,
  TabletIcon,
  Shield,
  ShieldAlert,
  Download,
  AlertTriangle,
  Play,
  Key,
  Database,
  Grid,
  LockKeyhole,
  CheckCircle2,
  Clock,
  Eye,
  FileSpreadsheet,
  Plus,
  Compass,
  AlertCircle
} from "lucide-react";
import { ShortLink, ClickLog, User as SystemUser, SystemStats, PageId } from "./types";

interface Toast {
  id: string;
  type: "success" | "error" | "info";
  message: string;
}

export default function App() {
  // Authn States
  const [token, setToken] = useState<string>(() => localStorage.getItem("bycs_token") || "");
  const [currentUser, setCurrentUser] = useState<SystemUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // App Navigation
  const [activeTab, setActiveTab] = useState<PageId>(() => {
    const hash = window.location.hash.replace("#", "") as PageId;
    return ["dashboard", "create", "links", "analytics", "profile", "settings", "admin", "about"].includes(hash)
      ? hash
      : "dashboard";
  });

  // UI Settings
  const [theme, setTheme] = useState<"light" | "dark">(
    () => (localStorage.getItem("bycs_theme") as "light" | "dark") || "dark"
  );
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Auth Inputs
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  // Dashboard Stats States
  const [stats, setStats] = useState<SystemStats & { recentClicks: ClickLog[] }>({
    totalLinks: 0,
    totalClicks: 0,
    activeLinksCount: 0,
    clicksByDate: [],
    deviceStats: [],
    countryStats: [],
    recentClicks: []
  });
  const [loadingStats, setLoadingStats] = useState(true);

  // Links list states
  const [links, setLinks] = useState<ShortLink[]>([]);
  const [totalLinks, setTotalLinks] = useState(0);
  const [linksLimit, setLinksLimit] = useState(8);
  const [linksOffset, setLinksOffset] = useState(0);
  const [linksSearch, setLinksSearch] = useState("");
  const [loadingLinks, setLoadingLinks] = useState(false);

  // Advanced Analytics States
  const [selectedLinkId, setSelectedLinkId] = useState<string>("");
  const [specificAnalytics, setSpecificAnalytics] = useState<{ clicks: ClickLog[]; link?: ShortLink } | null>(null);
  const [loadingSpecificAnalytics, setLoadingSpecificAnalytics] = useState(false);

  // Create Link state parameters
  const [createOriginalUrl, setCreateOriginalUrl] = useState("");
  const [createCustomAlias, setCreateCustomAlias] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createExpiration, setCreateExpiration] = useState("");
  const [creatingLink, setCreatingLink] = useState(false);
  const [justGeneratedLink, setJustGeneratedLink] = useState<ShortLink | null>(null);

  // Editing Link modal parameters
  const [editingLink, setEditingLink] = useState<ShortLink | null>(null);
  const [editOriginalUrl, setEditOriginalUrl] = useState("");
  const [editShortCode, setEditShortCode] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editExpiration, setEditExpiration] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Manage API Tokens states
  const [apiTokens, setApiTokens] = useState<{ token: string; label: string; createdAt: string }[]>([]);
  const [apiTokenLabel, setApiTokenLabel] = useState("");
  const [generatingApiToken, setGeneratingApiToken] = useState(false);

  // Manage Users admin panel states
  const [usersList, setUsersList] = useState<(SystemUser & { linksCreated: number; clicksCount: number })[]>([]);
  const [createUsername, setCreateUsername] = useState("");
  const [createUserPassword, setCreateUserPassword] = useState("");
  const [createUserRole, setCreateUserRole] = useState<"Admin" | "User">("User");
  const [creatingUser, setCreatingUser] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Profile Change Password parameters
  const [profileNewPassword, setProfileNewPassword] = useState("");
  const [updatingPasswordState, setUpdatingPasswordState] = useState(false);

  // Copy status index track
  const [copiedLinkMap, setCopiedLinkMap] = useState<Record<string, boolean>>({});

  // Dynamic Base URL calculation
  const APP_URL = window.location.origin;

  // Add notification toast alert
  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // Sync route hashes to URL
  useEffect(() => {
    window.location.hash = activeTab;
  }, [activeTab]);

  // Read current theme variables
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
      root.style.backgroundColor = "#090d16";
    } else {
      root.classList.remove("dark");
      root.style.backgroundColor = "#f8fafc";
    }
    localStorage.setItem("bycs_theme", theme);
  }, [theme]);

  // Perform validation of login session Token
  useEffect(() => {
    if (!token) {
      setIsAuthLoading(false);
      return;
    }

    setIsAuthLoading(true);
    fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => {
        if (!res.ok) throw new Error("Session expired");
        return res.json();
      })
      .then((data) => {
        setCurrentUser(data.user);
        setIsAuthLoading(false);
      })
      .catch(() => {
        localStorage.removeItem("bycs_token");
        setToken("");
        setCurrentUser(null);
        setIsAuthLoading(false);
      });
  }, [token]);

  // Refresh statistics triggers
  const fetchDashboardStats = () => {
    if (!token) return;
    setLoadingStats(true);
    fetch("/api/dashboard/stats", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed stats");
        return res.json();
      })
      .then((data) => {
        setStats(data);
        setLoadingStats(false);
      })
      .catch((err) => {
        console.error("Stats fetching failure", err);
        setLoadingStats(false);
      });
  };

  // Fetch Links listing
  const fetchLinks = (offsetVal = linksOffset, searchVal = linksSearch) => {
    if (!token) return;
    setLoadingLinks(true);
    fetch(`/api/links?search=${encodeURIComponent(searchVal)}&limit=${linksLimit}&offset=${offsetVal}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed loading links");
        return res.json();
      })
      .then((data) => {
        setLinks(data.links);
        setTotalLinks(data.total);
        setLoadingLinks(false);
      })
      .catch((err) => {
        console.error("Links fetching failure", err);
        setLoadingLinks(false);
      });
  };

  // Refresh view contents on tab navigation
  useEffect(() => {
    if (!token) return;
    if (activeTab === "dashboard") {
      fetchDashboardStats();
    } else if (activeTab === "links") {
      fetchLinks(linksOffset, linksSearch);
    } else if (activeTab === "analytics") {
      fetchDashboardStats(); // to load click counts and select default
      if (selectedLinkId) {
        fetchSpecificAnalytics(selectedLinkId);
      }
    } else if (activeTab === "settings") {
      fetchApiTokens();
    } else if (activeTab === "admin") {
      fetchUsersAdmin();
    }
  }, [activeTab, token]);

  const fetchSpecificAnalytics = (linkId: string) => {
    if (!token) return;
    setLoadingSpecificAnalytics(true);
    fetch(`/api/analytics?linkId=${linkId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed specific stats");
        return res.json();
      })
      .then((data) => {
        setSpecificAnalytics(data);
        setLoadingSpecificAnalytics(false);
      })
      .catch((err) => {
        console.error("Analytica details loaded failure", err);
        setLoadingSpecificAnalytics(false);
      });
  };

  const fetchApiTokens = () => {
    fetch("/api/settings/tokens", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.json())
      .then((data) => setApiTokens(data.tokens || []))
      .catch((e) => console.error("Tokens load failure", e));
  };

  const fetchUsersAdmin = () => {
    if (!token) return;
    setLoadingUsers(true);
    fetch("/api/admin/users-summary", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.json())
      .then((data) => {
        setUsersList(data.users || []);
        setLoadingUsers(false);
      })
      .catch((err) => {
        console.error("Users list aggregate fault", err);
        setLoadingUsers(false);
      });
  };

  // Trigger login authorization
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput || !passwordInput) return;

    setSigningIn(true);
    setAuthError("");

    fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: usernameInput, password: passwordInput })
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Login unsuccessful");
        }
        return data;
      })
      .then((data) => {
        localStorage.setItem("bycs_token", data.token);
        setToken(data.token);
        setCurrentUser(data.user);
        showToast(`Welcome back, ${data.user.username}! Active credentials signed.`, "success");
        setSigningIn(false);
        setActiveTab("dashboard");
      })
      .catch((err: any) => {
        setAuthError(err.message);
        setSigningIn(false);
      });
  };

  // Google Sign-In with Firebase Auth
  const handleGoogleSignIn = () => {
    setSigningIn(true);
    setAuthError("");

    signInWithPopup(auth, googleProvider)
      .then((result) => {
        const user = result.user;
        if (!user || !user.email) {
          throw new Error("Could not retrieve email address from Google profile.");
        }
        
        return fetch("/api/auth/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: user.email,
            uid: user.uid,
            displayName: user.displayName || ""
          })
        });
      })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Google authorization failed on server");
        }
        return data;
      })
      .then((data) => {
        localStorage.setItem("bycs_token", data.token);
        setToken(data.token);
        setCurrentUser(data.user);
        showToast(`Signed in successfully with Google as ${data.user.username}!`, "success");
        setSigningIn(false);
        setActiveTab("dashboard");
      })
      .catch((err: any) => {
        console.error("Google sign-in error:", err);
        setAuthError(err.message || "An error occurred during Google sign-in.");
        setSigningIn(false);
      });
  };

  const handleLogout = () => {
    localStorage.removeItem("bycs_token");
    setToken("");
    setCurrentUser(null);
    showToast("Session signed out successfully", "info");
  };

  // Generate new Short Link
  const handleCreateLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createOriginalUrl) {
      showToast("Original destination URL is required", "error");
      return;
    }

    setCreatingLink(true);
    setJustGeneratedLink(null);

    fetch("/api/links", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        originalUrl: createOriginalUrl,
        customAlias: createCustomAlias || undefined,
        password: createPassword || undefined,
        expirationDate: createExpiration || undefined
      })
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Generation mismatch");
        return data;
      })
      .then((data) => {
        showToast("Path shortened successfully!", "success");
        setJustGeneratedLink(data.link);
        setCreateOriginalUrl("");
        setCreateCustomAlias("");
        setCreatePassword("");
        setCreateExpiration("");
        setCreatingLink(false);
      })
      .catch((err) => {
        showToast(err.message, "error");
        setCreatingLink(false);
      });
  };

  // Register New Platform User (Admin Panel tool)
  const handleCreateUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createUsername || !createUserPassword) {
      showToast("Provide both username and passphrase to create a profile", "error");
      return;
    }

    setCreatingUser(true);
    fetch("/api/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        username: createUsername,
        password: createUserPassword,
        role: createUserRole
      })
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Profile generation mismatch");
        return data;
      })
      .then(() => {
        showToast(`User account '${createUsername}' created and sealed out!`, "success");
        setCreateUsername("");
        setCreateUserPassword("");
        setCreateUserRole("User");
        setCreatingUser(false);
        fetchUsersAdmin();
      })
      .catch((err) => {
        showToast(err.message, "error");
        setCreatingUser(false);
      });
  };

  // User Suspension controls
  const handleToggleSuspendUser = (userId: string, currentUsername: string) => {
    fetch(`/api/users/${userId}/suspend`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Suspension error");
        return data;
      })
      .then((data) => {
        const state = data.user.isSuspended ? "suspended" : "activated";
        showToast(`User status for ${currentUsername} has been toggle-set to ${state}.`, "info");
        fetchUsersAdmin();
      })
      .catch((err) => showToast(err.message, "error"));
  };

  // User Profile Excision deletion
  const handleDeleteUser = (userId: string, uName: string) => {
    if (!window.confirm(`Are you absolutely sure you want to delete '${uName}' and ALL their shortlinks completely?`)) return;

    fetch(`/api/users/${userId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data;
      })
      .then(() => {
        showToast(`Profile ${uName} expunged successfully.`, "success");
        fetchUsersAdmin();
      })
      .catch((err) => showToast(err.message, "error"));
  };

  // Trigger Save Updates on Link
  const handleSaveEditLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLink) return;

    setSavingEdit(true);
    fetch(`/api/links/${editingLink.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        originalUrl: editOriginalUrl,
        shortCode: editShortCode,
        password: editPassword,
        expirationDate: editExpiration
      })
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Adjustment failure");
        return data;
      })
      .then(() => {
        showToast("Configurations modified successfully!", "success");
        setEditingLink(null);
        setSavingEdit(false);
        fetchLinks(linksOffset, linksSearch);
      })
      .catch((err) => {
        showToast(err.message, "error");
        setSavingEdit(false);
      });
  };

  // Link deletion triggers
  const handleDeleteLink = (linkId: string, labelCode: string) => {
    if (!window.confirm(`Expunge shortlink '/${labelCode}'? This action is permanent and turns off redir routing instantly.`)) return;

    fetch(`/api/links/${linkId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data;
      })
      .then(() => {
        showToast(`Short link '/${labelCode}' expunged successfully.`, "info");
        fetchLinks(linksOffset, linksSearch);
      })
      .catch((err) => showToast(err.message, "error"));
  };

  // Generate new Api Token
  const handleGenerateApiToken = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiTokenLabel.trim()) return;

    setGeneratingApiToken(true);
    fetch("/api/settings/tokens", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ label: apiTokenLabel })
    })
      .then((res) => res.json())
      .then(() => {
        showToast("New integration authentication API Token generated!", "success");
        setApiTokenLabel("");
        setGeneratingApiToken(false);
        fetchApiTokens();
      })
      .catch(() => showToast("Token generation failed", "error"));
  };

  const handleRevokeApiToken = (tokValue: string) => {
    fetch(`/api/settings/tokens/${tokValue}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(() => {
        showToast("API Access Token revoked", "info");
        fetchApiTokens();
      })
      .catch(() => showToast("Token revocation failed", "error"));
  };

  // Update profile Password
  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileNewPassword.trim() || profileNewPassword.length < 4) {
      showToast("Password code must be at least 4 characters long", "error");
      return;
    }

    setUpdatingPasswordState(true);
    fetch("/api/auth/password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ newPassword: profileNewPassword })
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Pass revision fault");
        return data;
      })
      .then(() => {
        showToast("Personal credentials security passcode updated properly!", "success");
        setProfileNewPassword("");
        setUpdatingPasswordState(false);
      })
      .catch((err) => {
        showToast(err.message, "error");
        setUpdatingPasswordState(false);
      });
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLinkMap((prev) => ({ ...prev, [id]: true }));
    showToast("Short link successfully copied to your clipboard!", "success");
    setTimeout(() => {
      setCopiedLinkMap((prev) => ({ ...prev, [id]: false }));
    }, 2000);
  };

  // Search links trigger
  const handleSearchChange = (val: string) => {
    setLinksSearch(val);
    setLinksOffset(0);
    fetchLinks(0, val);
  };

  const handlePageStep = (direction: "prev" | "next") => {
    let nextOffset = linksOffset;
    if (direction === "prev" && linksOffset > 0) {
      nextOffset = Math.max(0, linksOffset - linksLimit);
    } else if (direction === "next" && linksOffset + linksLimit < totalLinks) {
      nextOffset = linksOffset + linksLimit;
    }

    if (nextOffset !== linksOffset) {
      setLinksOffset(nextOffset);
      fetchLinks(nextOffset, linksSearch);
    }
  };

  // Initiates download callback
  const handleExportCSV = () => {
    showToast("Assembling raw logs, launching download frame", "info");
    window.open(`/api/links/export?token=${token}`, "_blank");
  };

  // Render Skeleton pulse blocks safely
  const renderSkeleton = () => (
    <div className="animate-pulse space-y-4">
      <div className="h-12 bg-slate-800/50 rounded-lg w-full"></div>
      <div className="grid grid-cols-3 gap-4">
        <div className="h-32 bg-slate-800/50 rounded-lg col-span-2"></div>
        <div className="h-32 bg-slate-800/50 rounded-lg col-span-1"></div>
      </div>
      <div className="h-40 bg-slate-800/50 rounded-lg w-full"></div>
    </div>
  );

  // Authenticating Loader state screen
  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-slate-950 text-slate-100">
        <div className="p-8 rounded-2xl glass-panel-dark text-center border border-slate-800 flex flex-col items-center max-w-sm space-y-4">
          <Link2 id="load-icon" className="w-12 h-12 text-cyan-400 animate-spin" />
          <h1 className="text-xl font-bold tracking-widest text-cyan-400 font-sans">BY CS TOOLS</h1>
          <p className="text-xs text-slate-400">Loading secure platform configuration profile elements...</p>
        </div>
      </div>
    );
  }

  // ===================================
  // 1. LOGIN GATEWAY (UNAUTHENTICATED)
  // ===================================
  if (!token || !currentUser) {
    return (
      <div className="min-h-screen flex flex-col justify-between items-center bg-slate-950 text-slate-100 px-4 py-8 relative overflow-hidden font-sans">
        {/* Glow Spheres */}
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-5%] w-[455px] h-[455px] rounded-full bg-indigo-500/10 blur-[110px] pointer-events-none"></div>

        <div></div> {/* Visual offset spacer */}

        <div className="w-full max-w-md glass-panel-dark p-8 rounded-2xl shadow-2xl relative border border-slate-800/80 shine-accent-cyan">
          <div className="text-center mb-8">
            <div className="inline-flex p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 mb-3 hover:scale-105 transition-transform">
              <Link2 id="header-brand-icon" className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white mb-1 font-sans">BY CS TOOLS</h1>
            <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold text-cyan-400/80">Private URL Redirect Server</p>
          </div>

          {authError && (
            <div className="mb-4 p-3 bg-red-950/40 border border-red-500/30 text-red-200 text-xs text-center rounded-xl flex items-center justify-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/40 text-xs text-slate-400 mb-6 space-y-2">
            <div className="flex justify-between">
              <span className="font-semibold text-cyan-500/80">🔑 ADMIN CONSOLE:</span>
              <span>admin / admin123</span>
            </div>
            <div className="flex justify-between border-t border-slate-800/30 pt-1.5">
              <span className="font-semibold text-indigo-400/80">👤 USER CONSOLE:</span>
              <span>creator / creator123</span>
            </div>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Username</label>
              <input
                id="login-username"
                type="text"
                required
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="Enter authorized user"
                className="w-full px-4 py-3 bg-slate-900 border border-slate-850 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Password</label>
              <input
                id="login-password"
                type="password"
                required
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-4 py-3 bg-slate-900 border border-slate-850 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors text-sm"
              />
            </div>

            <button
              id="login-btn"
              type="submit"
              disabled={signingIn}
              className="w-full py-3 px-4 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-sm font-semibold rounded-xl shadow-lg hover:shadow-cyan-500/10 transition-all cursor-pointer disabled:opacity-50"
            >
              {signingIn ? "Securing Session Connection..." : "Decrypt Credentials & Enter"}
            </button>
          </form>

          <div className="relative my-6 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800/60" />
            </div>
            <span className="relative bg-[#090d16] px-3 text-[10px] font-bold tracking-widest text-slate-500 uppercase">
              OR CONTINUE WITH
            </span>
          </div>

          <button
            id="google-signin-btn"
            type="button"
            disabled={signingIn}
            onClick={handleGoogleSignIn}
            className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-850 text-white hover:text-cyan-400 text-sm font-semibold rounded-xl border border-slate-800 hover:border-cyan-500/30 transition-all cursor-pointer flex items-center justify-center gap-3 shadow-md hover:shadow-cyan-500/5 duration-200"
          >
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.22-.66-.35-1.36-.35-2.09z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.53 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            {signingIn ? "Partnering session..." : "Sign in with Google"}
          </button>
        </div>

        <div className="text-center text-slate-500 text-xs space-y-1">
          <p className="tracking-widest font-bold uppercase text-cyan-400/60">BY CS TOOLS</p>
          <p>© BY CS TOOLS. All Rights Reserved.</p>
        </div>
      </div>
    );
  }

  // ===================================
  // 2. DASHBOARD SHELL (AUTHENTICATED)
  // ===================================
  return (
    <div className={`min-h-screen flex font-sans ${theme === "dark" ? "bg-[#090d16] text-slate-200" : "bg-slate-50 text-slate-800"}`}>
      
      {/* Dynamic Toast Layer */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 max-w-sm pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className={`p-4 rounded-xl border flex items-start gap-3 shadow-2xl pointer-events-auto ${
                t.type === "success"
                  ? "bg-slate-900 border-cyan-500/20 text-cyan-300"
                  : t.type === "error"
                  ? "bg-slate-900 border-red-500/20 text-red-300"
                  : "bg-slate-900 border-indigo-500/20 text-indigo-300"
              }`}
            >
              {t.type === "success" ? (
                <CheckCircle2 className="w-5 h-5 text-cyan-400 flex-shrink-0" />
              ) : t.type === "error" ? (
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              ) : (
                <Info className="w-5 h-5 text-indigo-400 flex-shrink-0" />
              )}
              <span className="text-xs font-semibold tracking-wide leading-relaxed">{t.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ===================================
          SIDEBAR NAVIGATION RAIL
         =================================== */}
      <aside
        className={`flex-shrink-0 border-r h-screen sticky top-0 transition-all duration-300 flex flex-col justify-between z-10 ${
          theme === "dark" 
            ? "border-slate-850/60 bg-[#0f172a]/80 backdrop-blur-md text-slate-300" 
            : "border-slate-200 bg-white text-slate-600"
        } ${isSidebarExpanded ? "w-64" : "w-16"}`}
      >
        <div className="flex flex-col overflow-y-auto">
          {/* Logo Brand Header */}
          <div className="p-4 border-b border-dashed border-slate-800/10 flex items-center justify-between min-h-[64px]">
            {isSidebarExpanded ? (
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 font-bold border border-cyan-400/20">
                  <Link2 className="w-5 h-5" />
                </div>
                <span className="font-bold tracking-tight font-sans text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-300 to-indigo-400">
                  BY CS TOOLS
                </span>
              </div>
            ) : (
              <div className="p-1 px-2 mx-auto rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-400/20">
                <Link2 className="w-4 h-4" />
              </div>
            )}
            {isSidebarExpanded && (
              <button
                onClick={() => setIsSidebarExpanded(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800/20 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* User badge metadata */}
          {isSidebarExpanded && currentUser && (
            <div className={`p-4 mx-4 mt-4 rounded-xl border flex items-center gap-3 ${
              theme === "dark" ? "bg-slate-900/60 border-slate-800/40" : "bg-slate-50 border-slate-200"
            }`}>
              <div className="p-2 rounded-full bg-cyan-400/10 text-cyan-400">
                <User className="w-4 h-4" />
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-slate-100 dark:text-white truncate">{currentUser.username}</p>
                <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-md tracking-wider ${
                  currentUser.role === "Admin" ? "bg-red-400/10 text-red-400" : "bg-cyan-400/10 text-cyan-400"
                }`}>
                  {currentUser.role}
                </span>
              </div>
            </div>
          )}

          {/* Navigation link arrays */}
          <nav className="p-3 space-y-1.5 mt-4">
            {[
              { id: "dashboard", label: "Dashboard Overview", icon: Grid },
              { id: "create", label: "Create Short Link", icon: PlusCircle },
              { id: "links", label: "My Link Vault", icon: Database },
              { id: "analytics", label: "Advanced Analytica", icon: BarChart3 },
              { id: "profile", label: "Personal Profile", icon: User },
              { id: "settings", label: "API Configuration", icon: Settings },
              { id: "admin", label: "User Admin Control", icon: Users, adminOnly: true },
              { id: "about", label: "Platform About Specs", icon: Info }
            ].map((navItem) => {
              if (navItem.adminOnly && currentUser?.role !== "Admin") return null;
              const Icon = navItem.icon;
              const isActive = activeTab === navItem.id;

              return (
                <button
                  key={navItem.id}
                  onClick={() => setActiveTab(navItem.id as PageId)}
                  className={`w-full flex items-center rounded-xl p-3 text-xs tracking-wide font-medium transition-all cursor-pointer ${
                    isActive
                      ? "bg-gradient-to-r from-cyan-500/10 to-indigo-600/10 text-cyan-400 border-l-4 border-cyan-400"
                      : "hover:bg-slate-800/10 text-slate-400 hover:text-slate-100"
                  } ${isSidebarExpanded ? "gap-3" : "justify-center"}`}
                  title={navItem.label}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-cyan-400" : "text-slate-400"}`} />
                  {isSidebarExpanded && <span>{navItem.label}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Sidebar buttons */}
        <div className="p-3 space-y-1.5 border-t border-slate-800/10">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className={`w-full flex items-center rounded-xl p-3 text-xs text-slate-400 hover:text-slate-100 hover:bg-slate-850/10 transition-all ${
              isSidebarExpanded ? "gap-3" : "justify-center"
            }`}
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {isSidebarExpanded && <span>{theme === "dark" ? "Light Mode Theme" : "Dark Mode Theme"}</span>}
          </button>
          
          {!isSidebarExpanded && (
            <button
              onClick={() => setIsSidebarExpanded(true)}
              className="w-full flex justify-center rounded-xl p-3 text-slate-400 hover:text-white hover:bg-slate-800/10 transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={handleLogout}
            className={`w-full flex items-center rounded-xl p-3 text-xs text-red-400 hover:bg-red-500/5 transition-all outline-none ${
              isSidebarExpanded ? "gap-3" : "justify-center"
            }`}
          >
            <LogOut className="w-4 h-4" />
            {isSidebarExpanded && <span>Sign Out Session</span>}
          </button>
        </div>
      </aside>

      {/* ===================================
          PRIMARY MAIN AREA CANVAS
         =================================== */}
      <main className="flex-1 flex flex-col justify-between min-h-screen max-w-full overflow-x-hidden">
        
        {/* UPPER DYNAMIC HEADER */}
        <header className={`px-6 py-4 border-b flex items-center justify-between min-h-[64px] ${
          theme === "dark" ? "border-slate-850 bg-[#0f172a]/40" : "border-slate-200 bg-white"
        }`}>
          <div className="flex items-center gap-3">
            {!isSidebarExpanded && (
              <button
                onClick={() => setIsSidebarExpanded(true)}
                className={`p-2 rounded-lg border ${
                  theme === "dark" ? "border-slate-800 hover:bg-slate-800" : "border-slate-200 hover:bg-slate-100"
                } text-slate-400 mr-2`}
              >
                <Menu className="w-4 h-4" />
              </button>
            )}
            <h1 className="text-lg font-bold tracking-tight text-slate-100 dark:text-white capitalize">
              BY CS TOOLS - {activeTab === "settings" ? "API Integration Settings" : activeTab === "create" ? "Shorten Domain Link" : activeTab === "links" ? "Shortlinks Inventory Archive" : activeTab}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-semibold tracking-wider text-slate-400 bg-slate-900/60 p-1 px-2.5 rounded-lg border border-slate-850">
              Uptime Node: Online
            </span>
          </div>
        </header>

        {/* CONTAINER CONTENT WRAP */}
        <div className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">

          {/* ===================================
              Reserved sections for future Ads
             =================================== */}
          <div className={`p-4 rounded-xl border border-dashed text-center flex flex-col sm:flex-row items-center justify-between gap-4 ${
            theme === "dark" ? "border-cyan-500/10 bg-slate-950/20" : "border-slate-300 bg-slate-100/50"
          }`}>
            <div className="text-left">
              <span className="text-[10px] font-bold uppercase py-0.5 px-2 rounded-full bg-cyan-400/10 text-cyan-400 border border-cyan-400/20 mb-1 inline-block">
                🔍 Future Integration Placement Slot
              </span>
              <p className="text-xs font-semibold text-slate-300 dark:text-slate-400">Reserved section for Advertising Networks & Placements</p>
              <p className="text-[10px] text-slate-500">This banner slot is reserved for high-paying ad server scripts. No tracking scripts have been loaded for privacy protection.</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="p-2 px-4 rounded-xl bg-slate-900 border border-slate-800 text-[10px] font-mono text-cyan-400 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-ping"></div>
                Ads Offline (Sandbox Mode)
              </div>
            </div>
          </div>

          {/* ===================================
              ACTIVE TAB WINDOW PANEL PORT
             =================================== */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.15 }}
              className="space-y-6"
            >

              {/* ===================================
                  TAB 1: DASHBOARD
                 =================================== */}
              {activeTab === "dashboard" && (
                <div className="space-y-6">
                  {loadingStats ? (
                    renderSkeleton()
                  ) : (
                    <>
                      {/* STATS METRIC GRID CARDS */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        
                        <div className={`p-6 rounded-2xl border relative overflow-hidden flex justify-between items-center ${
                          theme === "dark" ? "glass-panel-dark border-slate-800" : "bg-white border-slate-200 shadow-sm"
                        }`}>
                          <div className="absolute top-0 right-0 p-8 opacity-5">
                            <Link2 className="w-32 h-32" />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Unique Short Links</p>
                            <h3 className="text-3xl font-bold tracking-tight text-white dark:text-slate-100 mt-1 font-sans">{stats.totalLinks}</h3>
                            <button onClick={() => setActiveTab("links")} className="text-[10px] font-semibold text-cyan-400 hover:underline mt-2 inline-flex items-center gap-1 cursor-pointer">
                              Explore vault inventories <ExternalLink className="w-2.5 h-2.5" />
                            </button>
                          </div>
                          <div className="p-3.5 rounded-2xl bg-cyan-400/10 text-cyan-400 flex-shrink-0 animate-pulse">
                            <PlusCircle className="w-6 h-6" />
                          </div>
                        </div>

                        <div className={`p-6 rounded-2xl border relative overflow-hidden flex justify-between items-center ${
                          theme === "dark" ? "glass-panel-dark border-slate-800" : "bg-white border-slate-200 shadow-sm"
                        }`}>
                          <div className="absolute top-0 right-0 p-8 opacity-5">
                            <BarChart3 className="w-32 h-32" />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Aggregated clicks</p>
                            <h3 className="text-3xl font-bold tracking-tight text-white dark:text-slate-100 mt-1 font-sans">{stats.totalClicks}</h3>
                            <button onClick={() => setActiveTab("analytics")} className="text-[10px] font-semibold text-cyan-400 hover:underline mt-2 inline-flex items-center gap-1 cursor-pointer">
                              Inspect deeper analytics <ExternalLink className="w-2.5 h-2.5" />
                            </button>
                          </div>
                          <div className="p-3.5 rounded-2xl bg-indigo-400/10 text-indigo-400 flex-shrink-0">
                            <TrendingUp className="w-6 h-6" />
                          </div>
                        </div>

                        <div className={`p-6 rounded-2xl border relative overflow-hidden flex justify-between items-center ${
                          theme === "dark" ? "glass-panel-dark border-slate-800" : "bg-white border-slate-200 shadow-sm"
                        }`}>
                          <div className="absolute top-0 right-0 p-8 opacity-5">
                            <Clock className="w-32 h-32" />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Routing Nodes</p>
                            <h3 className="text-3xl font-bold tracking-tight text-white dark:text-slate-100 mt-1 font-sans">{stats.activeLinksCount}</h3>
                            <span className="text-[10px] font-semibold text-emerald-400 mt-2 block">100% active operational redirection rate</span>
                          </div>
                          <div className="p-3.5 rounded-2xl bg-emerald-400/10 text-emerald-400 flex-shrink-0">
                            <Globe className="w-6 h-6" />
                          </div>
                        </div>

                      </div>

                      {/* CLINKS TIMELINE TRENDING GRAPH (Pure Custom Responsive SVG Chart) */}
                      <div className={`p-6 rounded-2xl border ${
                        theme === "dark" ? "glass-panel-dark border-slate-800" : "bg-white border-slate-200 shadow-sm"
                      }`}>
                        <div className="flex items-center justify-between mb-6">
                          <div>
                            <h3 className="text-sm font-bold text-slate-200 dark:text-white">Aggregated Traffic Evolution Sequence</h3>
                            <p className="text-[10px] text-slate-400">Click actions tracked across the previous 10 days of service nodes</p>
                          </div>
                          <div className="text-xs bg-slate-900 border border-slate-800 p-2 rounded-xl text-cyan-400 font-mono flex items-center gap-1">
                            <Database className="w-3 h-3" /> System Live Metrics feed
                          </div>
                        </div>

                        {/* Custom SVG Line Chart */}
                        {stats.clicksByDate.length > 0 ? (
                          <div className="relative w-full h-64 select-none">
                            <svg className="w-full h-full overflow-visible" viewBox="0 0 1000 240" preserveAspectRatio="none">
                              {/* Definitions for gradient fills */}
                              <defs>
                                <linearGradient id="glowGradBlue" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.45" />
                                  <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.00" />
                                </linearGradient>
                              </defs>

                              {/* Grid lines styling */}
                              <line x1="0" y1="0" x2="1000" y2="0" stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />
                              <line x1="0" y1="60" x2="1000" y2="60" stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />
                              <line x1="0" y1="120" x2="1000" y2="120" stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />
                              <line x1="0" y1="180" x2="1000" y2="180" stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />
                              <line x1="0" y1="240" x2="1000" y2="240" stroke="#1e293b" strokeWidth="1" />

                              {/* Calculations for points mapping bounds */}
                              {(() => {
                                const maxVal = Math.max(...stats.clicksByDate.map((d) => d.clicks), 5);
                                const pointsCount = stats.clicksByDate.length;
                                const widthStep = 1000 / (pointsCount - 1);
                                
                                // Map heights: higher clicks corresponds to lower Y position (0 is top, 240 is bottom)
                                const coords = stats.clicksByDate.map((item, idx) => {
                                  const x = idx * widthStep;
                                  const y = 240 - (item.clicks / maxVal) * 200; // leaves 40px top padding
                                  return { x, y, clicks: item.clicks, date: item.date };
                                });

                                // Build curved path or polyline
                                const polylinePoints = coords.map(c => `${c.x},${c.y}`).join(" ");
                                const fillPoints = `0,240 ${polylinePoints} 1000,240`;

                                return (
                                  <>
                                    {/* Fill Area gradient under paths */}
                                    <polygon points={fillPoints} fill="url(#glowGradBlue)" />

                                    {/* Colored Path lines */}
                                    <polyline
                                      points={polylinePoints}
                                      fill="none"
                                      stroke="url(#accentLineGrad)"
                                      strokeWidth="4"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      className="pulse-glow"
                                    />
                                    
                                    <defs>
                                      <linearGradient id="accentLineGrad" x1="0" y1="0" x2="1" y2="0">
                                        <stop offset="0%" stopColor="#22d3ee" />
                                        <stop offset="100%" stopColor="#6366f1" />
                                      </linearGradient>
                                    </defs>

                                    {/* Circles on dots with clickable tracking */}
                                    {coords.map((c, i) => (
                                      <g key={i} className="group cursor-pointer">
                                        <circle
                                          cx={c.x}
                                          cy={c.y}
                                          r="6"
                                          fill="#0f172a"
                                          stroke="#22d3ee"
                                          strokeWidth="3"
                                        />
                                        <circle
                                          cx={c.x}
                                          cy={c.y}
                                          r="10"
                                          fill="#22d3ee"
                                          className="opacity-0 group-hover:opacity-20 animate-ping"
                                        />
                                        {/* Floating Label indicators */}
                                        <foreignObject x={c.x - 30} y={c.y - 35} width="60" height="30" className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                          <div className="bg-cyan-500 text-slate-950 font-bold px-1 py-0.5 rounded text-[9px] text-center font-mono">
                                            {c.clicks} clks
                                          </div>
                                        </foreignObject>
                                      </g>
                                    ))}
                                  </>
                                );
                              })()}
                            </svg>

                            {/* X Axis Timestamps Labels */}
                            <div className="flex justify-between mt-3 text-[10px] text-slate-500 font-mono">
                              {stats.clicksByDate.map((item, idx) => (
                                <span key={idx}>{item.date.split("-").slice(1).join("/")}</span>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 text-center py-10">No traffic logs registered yet.</p>
                        )}
                      </div>

                      {/* TWO COLUMN RECENT AUDITS AND PLATFORM ADVERTISERS */}
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        
                        {/* RECENT TRAFFIC EVENTS LOG TABLE */}
                        <div className={`p-6 rounded-2xl border lg:col-span-2 ${
                          theme === "dark" ? "glass-panel-dark border-slate-800" : "bg-white border-slate-200 shadow-sm"
                        }`}>
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <h3 className="text-sm font-bold text-slate-200 dark:text-white">Recent Decrypted Bounces</h3>
                              <p className="text-[10px] text-slate-400">Real-time listing of the previous click events processed by the system</p>
                            </div>
                            <button onClick={() => setActiveTab("analytics")} className="p-1 px-3 rounded-lg border border-slate-800 hover:bg-slate-800 text-[10px] text-slate-300 font-bold">
                              Deep Drill Analytics
                            </button>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="border-b border-slate-800/40 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                                  <th className="py-2.5">Code</th>
                                  <th className="py-2.5">Origin Device</th>
                                  <th className="py-2.5">Region</th>
                                  <th className="py-2.5 text-right">Instant</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-850/30">
                                {stats.recentClicks.length > 0 ? (
                                  stats.recentClicks.map((click, i) => (
                                    <tr key={i} className="hover:bg-slate-900/20 text-slate-300">
                                      <td className="py-3 font-semibold text-cyan-400">/{click.shortCode}</td>
                                      <td className="py-3 flex items-center gap-1.5">
                                        {click.device === "Mobile" ? (
                                          <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
                                        ) : click.device === "Tablet" ? (
                                          <TabletIcon className="w-3.5 h-3.5 text-purple-400" />
                                        ) : (
                                          <Laptop className="w-3.5 h-3.5 text-blue-400" />
                                        )}
                                        <span>{click.device}</span>
                                      </td>
                                      <td className="py-3 font-mono font-medium">{click.country}</td>
                                      <td className="py-3 text-right text-slate-500 font-mono text-[10px]">{new Date(click.timestamp).toLocaleTimeString()}</td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td colSpan={4} className="py-4 text-center text-slate-500">No clicks tracked. Launch nodes to collect traffic!</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* MOCK OFFERWALL SYSTEM (REQUESTED FEATURE PLACEHOLDER) */}
                        <div className={`p-6 rounded-2xl border ${
                          theme === "dark" ? "glass-panel-dark border-slate-800" : "bg-white border-slate-200 shadow-sm"
                        }`}>
                          <div className="mb-4">
                            <span className="text-[10px] font-bold uppercase py-0.5 px-2 rounded-full bg-yellow-400/10 text-yellow-500 border border-yellow-500/20 mb-1 inline-block animate-pulse">
                              🏆 Offerwall & Loyalty Platform Slot
                            </span>
                            <h3 className="text-sm font-bold text-slate-200 dark:text-white mt-1">Monetized Lead Rewards Feed</h3>
                            <p className="text-[10px] text-slate-400">Integrate OfferToro, Wannads, or custom surveys to reward users for redirect clicks.</p>
                          </div>

                          <div className="space-y-3">
                            <div className="p-3 bg-slate-900/60 rounded-xl border border-dashed border-slate-800/80 flex items-center justify-between text-xs">
                              <div>
                                <p className="font-semibold text-slate-300">Completes Profile Survey</p>
                                <span className="text-[10px] text-slate-500">ETA 5 mins • Ad Partner A</span>
                              </div>
                              <span className="font-bold text-green-400 font-mono">+120 Credits</span>
                            </div>

                            <div className="p-3 bg-slate-900/60 rounded-xl border border-dashed border-slate-800/80 flex items-center justify-between text-xs">
                              <div>
                                <p className="font-semibold text-slate-300">Installs Sandbox App</p>
                                <span className="text-[10px] text-slate-500">Android/iOS verified lock</span>
                              </div>
                              <span className="font-bold text-cyan-400 font-mono">+340 Credits</span>
                            </div>

                            <div className="p-3 bg-slate-900/60 rounded-xl border border-dashed border-slate-800/80 flex items-center justify-between text-xs text-center text-slate-500">
                              <p className="text-[10px] leading-relaxed">Integration Ready. Connect custom postback triggers inside settings configuration pages to begin tracking publisher rewards.</p>
                            </div>
                          </div>
                        </div>

                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ===================================
                  TAB 2: CREATE LINK
                 =================================== */}
              {activeTab === "create" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* CREATE FORM CARD */}
                  <div className={`p-6 rounded-2xl border lg:col-span-2 ${
                    theme === "dark" ? "glass-panel-dark border-slate-800" : "bg-white border-slate-200 shadow-sm"
                  }`}>
                    <h3 className="text-sm font-bold text-slate-200 dark:text-white mb-6">Shorten long redirect links</h3>

                    <form onSubmit={handleCreateLinkSubmit} className="space-y-5">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Paste Destination URL (Original)</label>
                        <input
                          id="create-url"
                          type="text"
                          required
                          value={createOriginalUrl}
                          onChange={(e) => setCreateOriginalUrl(e.target.value)}
                          placeholder="https://example.com/deep/path/to/some/awesome/resource"
                          className="w-full px-4 py-3 bg-slate-900 border border-slate-800 focus:border-cyan-400 transition-colors rounded-xl text-xs text-white"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Custom Alias (Optional)</label>
                          <input
                            id="create-alias"
                            type="text"
                            value={createCustomAlias}
                            onChange={(e) => setCreateCustomAlias(e.target.value)}
                            placeholder="e.g. workspace-promo"
                            className="w-full px-4 py-3 bg-slate-900 border border-slate-850 focus:border-cyan-400 transition-colors rounded-xl text-xs text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Passkey Security (Optional)</label>
                          <input
                            id="create-pass"
                            type="text"
                            value={createPassword}
                            onChange={(e) => setCreatePassword(e.target.value)}
                            placeholder="e.g. decryp-771"
                            className="w-full px-4 py-3 bg-slate-900 border border-slate-850 focus:border-cyan-400 transition-colors rounded-xl text-xs text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Expiration Date (Optional)</label>
                          <input
                            id="create-exp"
                            type="date"
                            value={createExpiration}
                            onChange={(e) => setCreateExpiration(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-900 border border-slate-850 focus:border-cyan-400 transition-colors rounded-xl text-xs text-white"
                          />
                        </div>
                      </div>

                      <button
                        id="generate-link-btn"
                        type="submit"
                        disabled={creatingLink}
                        className="w-full py-3 px-4 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg transition-transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer text-center"
                      >
                        {creatingLink ? "Compiling Node Domain Rules..." : "Register & Shorten Destination Address"}
                      </button>
                    </form>
                  </div>

                  {/* HIGH ACCENT QR CODE DISPLAY & QUICK RESULTS CARD */}
                  <div className={`p-6 rounded-2xl border ${
                    theme === "dark" ? "glass-panel-dark border-slate-800" : "bg-white border-slate-200 shadow-sm"
                  }`}>
                    <h3 className="text-sm font-bold text-slate-200 dark:text-white mb-4">Direct Result Nodes</h3>
                    <p className="text-[10px] text-slate-400 mb-6">Your customized shortlink credentials appear instantly following save registers</p>

                    {justGeneratedLink ? (
                      <div className="text-center space-y-5">
                        <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800 inline-block">
                          {/* Fetch QR Code with reliable developer endpoint API */}
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(`${APP_URL}/${justGeneratedLink.shortCode}`)}`}
                            alt="Short link qr code"
                            className="w-40 h-40 mx-auto rounded-lg shadow-md"
                          />
                        </div>

                        <div className="space-y-2">
                          <p className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">Registration Sealed!</p>
                          <p className="font-mono text-xs text-white truncate break-all">{APP_URL}/{justGeneratedLink.shortCode}</p>
                        </div>

                        <div className="flex gap-2.5">
                          <button
                            id="copy-result-btn"
                            onClick={() => copyToClipboard(`${APP_URL}/${justGeneratedLink.shortCode}`, justGeneratedLink.id)}
                            className="flex-1 py-2.5 px-3 bg-slate-800 hover:bg-slate-705 text-white rounded-xl text-xs font-bold border border-slate-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          >
                            {copiedLinkMap[justGeneratedLink.id] ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-cyan-400" /> Copied Path
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-slate-300" /> Copy Path
                              </>
                            )}
                          </button>
                          <a
                            href={`${APP_URL}/${justGeneratedLink.shortCode}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl text-xs font-bold flex items-center justify-center"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="h-64 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-2xl text-slate-500">
                        <QrCode className="w-12 h-12 mb-3 opacity-30 select-none" />
                        <p className="text-xs text-center px-4 leading-relaxed">Fill the parameters left to preview details and acquire QR configurations instantly.</p>
                      </div>
                    )}
                  </div>

                </div>
              )}

              {/* ===================================
                  TAB 3: MY LINKS INVENTORY
                 =================================== */}
              {activeTab === "links" && (
                <div className="space-y-6">
                  {/* BAR CONTROL PANEL OPTIONS */}
                  <div className={`p-4 rounded-xl border flex flex-col sm:flex-row gap-4 items-center justify-between ${
                    theme === "dark" ? "glass-panel-dark border-slate-800" : "bg-white border-slate-200"
                  }`}>
                    <div className="relative w-full sm:max-w-md">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        id="inventory-search"
                        type="text"
                        value={linksSearch}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        placeholder="Filter through shortcodes or destination domains..."
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-550 transition-all placeholder:text-slate-500"
                      />
                    </div>

                    <div className="flex gap-2 w-full sm:w-auto">
                      <button
                        id="export-csv-btn"
                        onClick={handleExportCSV}
                        className="flex-1 sm:flex-initial py-2.5 px-4 bg-gradient-to-r from-cyan-500/10 to-indigo-500/10 hover:from-cyan-500/20 hover:to-indigo-500/20 text-cyan-400 border border-cyan-400/20 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <FileSpreadsheet className="w-4 h-4" /> Export CSV Record
                      </button>
                      <button
                        id="nav-create-btn"
                        onClick={() => setActiveTab("create")}
                        className="flex-1 sm:flex-initial py-2.5 px-4 bg-cyan-500 hover:bg-cyan-450 text-slate-950 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" /> Add Link
                      </button>
                    </div>
                  </div>

                  {/* MAIN TABLE CONTAINER */}
                  <div className={`p-6 rounded-2xl border overflow-hidden ${
                    theme === "dark" ? "glass-panel-dark border-slate-800" : "bg-white border-slate-200"
                  }`}>
                    {loadingLinks ? (
                      renderSkeleton()
                    ) : links.length > 0 ? (
                      <div className="space-y-4">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs min-w-[700px]">
                            <thead>
                              <tr className="border-b border-slate-800/40 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                                <th className="py-3">Shortened Link Nodes</th>
                                <th className="py-3">Original Destination</th>
                                <th className="py-3">Details & Configs</th>
                                <th className="py-3 text-center">Bounces</th>
                                <th className="py-3 text-right">Settings</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-850/20">
                              {links.map((link) => (
                                <tr key={link.id} className="hover:bg-slate-900/10 text-slate-300">
                                  
                                  {/* Shortcode URL column */}
                                  <td className="py-4">
                                    <div className="font-semibold text-white tracking-tight flex items-center gap-1">
                                      <span className="text-cyan-400">/{link.shortCode}</span>
                                    </div>
                                    <span className="text-[10px] text-slate-500 font-mono mt-0.5 block truncate max-w-[200px]">{APP_URL}/{link.shortCode}</span>
                                  </td>

                                  {/* Destination URL column */}
                                  <td className="py-4 max-w-sm">
                                    <div className="truncate text-slate-300 pr-4 font-mono select-all hover:text-cyan-400" title={link.originalUrl}>
                                      {link.originalUrl}
                                    </div>
                                    <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">{new Date(link.createdAt).toDateString()}</span>
                                  </td>

                                  {/* Details / Configurations status Icons */}
                                  <td className="py-4">
                                    <div className="flex items-center gap-2">
                                      
                                      {/* Password Protection status */}
                                      {link.password ? (
                                        <span className="py-0.5 px-2 rounded-md bg-red-400/10 text-red-400 text-[9px] font-bold flex items-center gap-1 border border-red-400/20" title="Password secured layer">
                                          <Lock className="w-3 h-3" /> Secure
                                        </span>
                                      ) : (
                                        <span className="py-0.5 px-2 rounded-md bg-slate-800/40 text-slate-400 text-[9px] font-medium flex items-center gap-1" title="Open redirect layer">
                                          <LockOpen className="w-3 h-3" /> Public
                                        </span>
                                      )}

                                      {/* Expirations alert tag */}
                                      {link.expirationDate ? (
                                        (() => {
                                          const active = new Date(link.expirationDate).getTime() > Date.now();
                                          return active ? (
                                            <span className="py-0.5 px-2 rounded-md bg-emerald-400/10 text-emerald-400 text-[9px] font-semibold border border-emerald-400/20 flex items-center gap-1" title={`Valid until ${new Date(link.expirationDate).toLocaleDateString()}`}>
                                              <Calendar className="w-3 h-3" /> Expiring
                                            </span>
                                          ) : (
                                            <span className="py-0.5 px-2 rounded-md bg-red-950/20 text-red-300 text-[9px] font-semibold border border-red-500/20 flex items-center gap-1" title="Expired link node">
                                              <AlertTriangle className="w-3 h-3" /> Terminated
                                            </span>
                                          );
                                        })()
                                      ) : (
                                        <span className="text-[9px] text-slate-500 font-medium py-0.5 px-2">Lifetime</span>
                                      )}

                                    </div>
                                  </td>

                                  {/* Aggregate Hits Bounces clicks */}
                                  <td className="py-4 text-center">
                                    <div className="font-mono font-bold text-white tracking-wider">{link.clicksCount}</div>
                                    <span className="text-[9px] text-slate-500 uppercase tracking-widest block font-bold">Clicks</span>
                                  </td>

                                  {/* Quick configurations setting controls */}
                                  <td className="py-4 text-right">
                                    <div className="flex justify-end gap-1.5">
                                      
                                      <button
                                        onClick={() => copyToClipboard(`${APP_URL}/${link.shortCode}`, link.id)}
                                        className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-cyan-400 transition-all cursor-pointer"
                                        title="Copy URL"
                                      >
                                        {copiedLinkMap[link.id] ? <Check className="w-3.5 h-3.5 text-cyan-400" /> : <Copy className="w-3.5 h-3.5" />}
                                      </button>

                                      <button
                                        onClick={() => {
                                          setSelectedLinkId(link.id);
                                          setActiveTab("analytics");
                                          fetchSpecificAnalytics(link.id);
                                        }}
                                        className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-indigo-400 transition-all cursor-pointer"
                                        title="Drill Analytics"
                                      >
                                        <BarChart3 className="w-3.5 h-3.5" />
                                      </button>

                                      <button
                                        onClick={() => {
                                          setEditingLink(link);
                                          setEditOriginalUrl(link.originalUrl);
                                          setEditShortCode(link.shortCode);
                                          setEditPassword(link.password || "");
                                          setEditExpiration(link.expirationDate ? link.expirationDate.split("T")[0] : "");
                                        }}
                                        className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-yellow-400 transition-all cursor-pointer"
                                        title="Adjust Configurations"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>

                                      <button
                                        onClick={() => handleDeleteLink(link.id, link.shortCode)}
                                        className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-red-400 transition-all cursor-pointer"
                                        title="Delete Endpoint"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>

                                    </div>
                                  </td>

                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* PAGINATIONS BLOCKS FOOTER */}
                        <div className="flex items-center justify-between border-t border-slate-850/40 pt-4 text-xs text-slate-400">
                          <div>
                            Showing <span className="font-semibold text-white">{linksOffset + 1}</span> to{" "}
                            <span className="font-semibold text-white">{Math.min(linksOffset + linksLimit, totalLinks)}</span> of{" "}
                            <span className="font-semibold text-white">{totalLinks}</span> short links
                          </div>

                          <div className="flex gap-2">
                            <button
                              id="prev-page-btn"
                              onClick={() => handlePageStep("prev")}
                              disabled={linksOffset === 0}
                              className="px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:hover:bg-slate-900 flex items-center gap-1 cursor-pointer"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" /> Prev
                            </button>
                            <button
                              id="next-page-btn"
                              onClick={() => handlePageStep("next")}
                              disabled={linksOffset + linksLimit >= totalLinks}
                              className="px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:hover:bg-slate-900 flex items-center gap-1 cursor-pointer"
                            >
                              Next <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12 text-slate-500">
                        <Database className="w-12 h-12 mx-auto opacity-30 mb-3" />
                        <p className="text-xs">No active matching configurations identified inside link databases.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ===================================
                  TAB 4: ADVANCED ANALVTICA
                 =================================== */}
              {activeTab === "analytics" && (
                <div className="space-y-6">
                  
                  {/* TRAFFIC DRILL TARGET SELECTION DECORATORS */}
                  <div className={`p-4 rounded-xl border flex flex-col md:flex-row items-center justify-between gap-4 ${
                    theme === "dark" ? "glass-panel-dark border-slate-800" : "bg-white border-slate-200"
                  }`}>
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Analytics Scope Target</h4>
                      <p className="text-[10px] text-slate-500">Select an active shortened node to view logs & drill telemetry dashboards</p>
                    </div>

                    <div className="relative w-full md:max-w-xs">
                      <select
                        id="analytics-select-link"
                        value={selectedLinkId}
                        onChange={(e) => {
                          setSelectedLinkId(e.target.value);
                          if (e.target.value) {
                            fetchSpecificAnalytics(e.target.value);
                          } else {
                            setSpecificAnalytics(null);
                          }
                        }}
                        className="w-full px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white outline-none cursor-pointer"
                      >
                        <option value="">-- Complete Aggregated Traffic View --</option>
                        {links.map((l) => (
                          <option key={l.id} value={l.id}>
                            /{l.shortCode} ({l.clicksCount} clks)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* LOADING SPECIFIC SCREEN SPLIT */}
                  {loadingSpecificAnalytics ? (
                    renderSkeleton()
                  ) : (
                    <>
                      {/* STATS OVERVIEW HEADER DETAILED GRID */}
                      {specificAnalytics && specificAnalytics.link ? (
                        <div className={`p-5 rounded-2xl border ${
                          theme === "dark" ? "glass-panel-dark border-slate-800" : "bg-white border-slate-200"
                        }`}>
                          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                              <span className="text-[9px] font-bold uppercase py-0.5 px-2 bg-cyan-400/10 text-cyan-400 border border-cyan-400/20 rounded-md">
                                Monitored Endpoint
                              </span>
                              <h3 className="text-sm font-bold text-slate-100 dark:text-white mt-1.5 flex items-center gap-1.5">
                                /{specificAnalytics.link.shortCode} <span className="text-slate-400 text-xs font-mono">({specificAnalytics.link.clicksCount} clks registered)</span>
                              </h3>
                              <p className="text-[10px] text-slate-400 mt-1 font-mono break-all line-clamp-1">Target original URL: {specificAnalytics.link.originalUrl}</p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => copyToClipboard(`${APP_URL}/${specificAnalytics.link?.shortCode}`, specificAnalytics.link?.id || "")}
                                className="py-2 px-3 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-[10px] text-slate-300 font-bold flex items-center gap-1"
                              >
                                {copiedLinkMap[specificAnalytics.link?.id || ""] ? <Check className="w-3.5 h-3.5 text-cyan-400" /> : <Copy className="w-3.5 h-3.5" />} Copy Node Path
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {/* ANALYSIS PIE PROGRESS STRIP AND GEOGRAPHICS TELEMETRIES */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        
                        {/* DEVICING TELEMETRY GRAPH PROGRESS CHART CARD */}
                        <div className={`p-6 rounded-2xl border ${
                          theme === "dark" ? "glass-panel-dark border-slate-800" : "bg-white border-slate-200 shadow-sm"
                        }`}>
                          <h3 className="text-sm font-bold text-slate-200 dark:text-white mb-4">Device and Client Platforms Distribution</h3>
                          <p className="text-[10px] text-slate-400 mb-6">Device client types parsing matched via remote User-Agent records</p>

                          {/* Dynamic Custom Device comparative rows */}
                          <div className="space-y-4">
                            {(() => {
                              const list = specificAnalytics
                                ? (() => {
                                    const devC: Record<string, number> = { Desktop: 0, Mobile: 0, Tablet: 0 };
                                    specificAnalytics.clicks.forEach((c) => { devC[c.device || "Desktop"]++; });
                                    return Object.entries(devC).map(([device, count]) => ({ device, count }));
                                  })()
                                : stats.deviceStats;

                              const total = list.reduce((s, i) => s + i.count, 0) || 1;

                              return list.map((item) => {
                                const pct = Math.round((item.count / total) * 100);
                                return (
                                  <div key={item.device} className="space-y-2">
                                    <div className="flex justify-between items-center text-xs">
                                      <div className="flex items-center gap-1.5 text-slate-300">
                                        {item.device === "Mobile" ? (
                                          <Smartphone className="w-4 h-4 text-cyan-400" />
                                        ) : item.device === "Tablet" ? (
                                          <TabletIcon className="w-4 h-4 text-purple-400" />
                                        ) : (
                                          <Laptop className="w-4 h-4 text-indigo-400" />
                                        )}
                                        <span className="font-semibold">{item.device}</span>
                                      </div>
                                      <span className="font-mono font-bold text-white tracking-wider">{item.count} [{pct}%]</span>
                                    </div>
                                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                                      <div className="h-full bg-gradient-to-r from-cyan-400 to-indigo-500 rounded-full" style={{ width: `${pct}%` }}></div>
                                    </div>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>

                        {/* GEOGRAPHICS COUNTRY COUNTER CARD */}
                        <div className={`p-6 rounded-2xl border ${
                          theme === "dark" ? "glass-panel-dark border-slate-800" : "bg-white border-slate-200 shadow-sm"
                        }`}>
                          <h3 className="text-sm font-bold text-slate-200 dark:text-white mb-4">Origin Region Geographics metrics</h3>
                          <p className="text-[10px] text-slate-400 mb-4">Top regions recorded by geo-location headers parsed at click triggers</p>

                          <div className="space-y-3.5">
                            {(() => {
                              const list = specificAnalytics
                                ? (() => {
                                    const ctryC: Record<string, number> = {};
                                    specificAnalytics.clicks.forEach((c) => {
                                      const country = c.country || "US";
                                      ctryC[country] = (ctryC[country] || 0) + 1;
                                    });
                                    return Object.entries(ctryC)
                                      .sort((a, b) => b[1] - a[1])
                                      .slice(0, 6)
                                      .map(([country, count]) => ({ country, count }));
                                  })()
                                : stats.countryStats;

                              const firstVal = list[0]?.count || 1;

                              return list.length > 0 ? (
                                list.map((item) => {
                                  return (
                                    <div key={item.country} className="flex items-center justify-between gap-3 text-xs">
                                      <div className="flex items-center gap-2">
                                        <div className="w-6 py-0.5 rounded bg-slate-900 border border-slate-800 text-center text-[9px] font-bold text-cyan-400 font-mono tracking-wider">
                                          {item.country}
                                        </div>
                                        <span className="font-semibold text-slate-300">Region IP Node {item.country}</span>
                                      </div>
                                      <div className="flex items-center gap-3 flex-1 justify-end">
                                        <div className="hidden sm:block w-32 h-1.5 bg-slate-850/60 rounded-full overflow-hidden">
                                          <div className="h-full bg-cyan-400" style={{ width: `${(item.count / firstVal) * 100}%` }}></div>
                                        </div>
                                        <span className="font-mono font-bold text-white block text-right min-w-[50px]">{item.count} bounces</span>
                                      </div>
                                    </div>
                                  );
                                })
                              ) : (
                                <p className="text-xs text-slate-500 text-center py-6">No geo statistics logs recorded.</p>
                              );
                            })()}
                          </div>
                        </div>

                      </div>

                      {/* INDIVIDUAL RECENT DATA TIMEFRAME CLICKS TIMELINE LIST */}
                      <div className={`p-6 rounded-2xl border ${
                        theme === "dark" ? "glass-panel-dark border-slate-800" : "bg-white border-slate-200"
                      }`}>
                        <h3 className="text-sm font-bold text-slate-200 dark:text-white mb-4">Detailed click tracing history</h3>
                        <p className="text-[10px] text-slate-400 mb-6">Chronological tracking list detailing connection properties</p>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs min-w-[700px]">
                            <thead>
                              <tr className="border-b border-slate-800/40 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                                <th className="py-2">Stamp Time</th>
                                <th className="py-2">Client IP</th>
                                <th className="py-2">Device</th>
                                <th className="py-2">Agent Client</th>
                                <th className="py-2">Referrer URL</th>
                                <th className="py-2 text-right">Region</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-850/25">
                              {(() => {
                                const targetLogsList = specificAnalytics ? specificAnalytics.clicks : stats.recentClicks;
                                return targetLogsList.length > 0 ? (
                                  targetLogsList.slice(0, 15).map((log, i) => (
                                    <tr key={i} className="hover:bg-slate-900/10 text-slate-300">
                                      <td className="py-3 font-mono text-[11px] text-slate-400">{new Date(log.timestamp).toLocaleString()}</td>
                                      <td className="py-3 font-mono font-medium">{log.ip}</td>
                                      <td className="py-3 font-semibold text-cyan-400">{log.device}</td>
                                      <td className="py-3 text-slate-400">{log.browser}</td>
                                      <td className="py-3 max-w-xs truncate" title={log.referrer}>{log.referrer}</td>
                                      <td className="py-3 text-right font-bold text-white font-mono">{log.country}</td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td colSpan={6} className="py-4 text-center text-slate-500">No clicks recorded.</td>
                                  </tr>
                                );
                              })()}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}

                </div>
              )}

              {/* ===================================
                  TAB 5: PERSONAL PROFILE
                 =================================== */}
              {activeTab === "profile" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                  {/* IDENTITIES CARD */}
                  <div className={`p-6 rounded-2xl border ${
                    theme === "dark" ? "glass-panel-dark border-slate-800" : "bg-white border-slate-200"
                  }`}>
                    <h3 className="text-sm font-bold text-slate-200 dark:text-white mb-6">Your authorization profile</h3>
                    
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
                          <User className="w-8 h-8" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white">{currentUser.username}</h4>
                          <span className="text-[10px] text-cyan-400 uppercase tracking-widest font-bold">Role: {currentUser.role}</span>
                        </div>
                      </div>

                      <div className="border-t border-slate-800/40 pt-4 space-y-2.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Profile Identifier:</span>
                          <span className="font-mono text-slate-300">{currentUser.id}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Creation Date:</span>
                          <span className="font-mono text-slate-300">{new Date(currentUser.createdAt).toDateString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Assigned Platform Privileges:</span>
                          <span className="text-slate-300">{currentUser.role === "Admin" ? "Administrative Root Control" : "Standard Publisher Access"}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* RESET PASSWORD SECURITY CREDENTIAL CARDS */}
                  <div className={`p-6 rounded-2xl border lg:col-span-2 ${
                    theme === "dark" ? "glass-panel-dark border-slate-800" : "bg-white border-slate-200"
                  }`}>
                    <h3 className="text-sm font-bold text-slate-200 dark:text-white mb-6">Modify system authorization passcode</h3>

                    <form onSubmit={handleUpdatePassword} className="space-y-5">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Create New Passcode Signature</label>
                        <input
                          id="profile-new-pass"
                          type="password"
                          required
                          value={profileNewPassword}
                          onChange={(e) => setProfileNewPassword(e.target.value)}
                          placeholder="••••••••••••"
                          className="w-full px-4 py-3 bg-slate-900 border border-slate-850 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-400 transition-all font-mono tracking-widest"
                        />
                      </div>

                      <button
                        id="update-pass-btn"
                        type="submit"
                        disabled={updatingPasswordState}
                        className="w-full sm:w-auto px-6 py-2.5 bg-cyan-600 hover:bg-cyan-505 text-white rounded-xl text-xs font-bold transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer disabled:opacity-55"
                      >
                        {updatingPasswordState ? "Encrypting new token..." : "Update passcode configurations"}
                      </button>
                    </form>
                  </div>

                </div>
              )}

              {/* ===================================
                  TAB 6: INTEGRATION SETTINGS
                 =================================== */}
              {activeTab === "settings" && (
                <div className="space-y-6">
                  
                  {/* API TOKENS DEVELOPMENT ENGINE BLOCK */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* TOKEN REQUEST CRUDS FORM */}
                    <div className={`p-6 rounded-2xl border ${
                      theme === "dark" ? "glass-panel-dark border-slate-800" : "bg-white border-slate-200"
                    }`}>
                      <h3 className="text-sm font-bold text-slate-200 dark:text-white mb-2">External integration credentials</h3>
                      <p className="text-[10px] text-slate-400 mb-6 font-medium">Issue unique tokens to allow your future Android App or custom applications to shorten redirect links programmaticly over APIs.</p>

                      <form onSubmit={handleGenerateApiToken} className="space-y-4">
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Token label reference</label>
                          <input
                            id="token-label-input"
                            type="text"
                            required
                            value={apiTokenLabel}
                            onChange={(e) => setApiTokenLabel(e.target.value)}
                            placeholder="e.g. Android Mobile App Master API Key"
                            className="w-full px-4 py-3 bg-slate-900 border border-slate-850 focus:border-cyan-400 rounded-xl text-xs text-white"
                          />
                        </div>

                        <button
                          id="generate-token-btn"
                          type="submit"
                          disabled={generatingApiToken}
                          className="w-full py-2.5 px-3 bg-cyan-600 hover:bg-cyan-505 text-white rounded-xl text-xs font-bold font-sans cursor-pointer transition-colors"
                        >
                          Generate Integration Access Token
                        </button>
                      </form>
                    </div>

                    {/* ACTIVE API DECOY LIST */}
                    <div className={`p-6 rounded-2xl border lg:col-span-2 ${
                      theme === "dark" ? "glass-panel-dark border-slate-800" : "bg-white border-slate-200"
                    }`}>
                      <h3 className="text-sm font-bold text-slate-200 dark:text-white mb-4">Active programmatic integrations</h3>

                      {apiTokens.length > 0 ? (
                        <div className="space-y-4">
                          {apiTokens.map((t) => (
                            <div key={t.token} className="p-4 bg-slate-900/60 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                              <div className="space-y-1 max-w-md overflow-hidden">
                                <p className="text-xs font-semibold text-slate-200">{t.label}</p>
                                <span className="font-mono text-[10px] text-cyan-400 break-all select-all font-semibold font-sans">{t.token}</span>
                                <span className="text-[9px] text-slate-500 block">Created profile trigger: {new Date(t.createdAt).toDateString()}</span>
                              </div>

                              <button
                                onClick={() => handleRevokeApiToken(t.token)}
                                className="py-1.5 px-3 rounded-lg bg-red-950/20 hover:bg-red-950/40 text-[10px] font-bold text-red-400 border border-red-500/20 cursor-pointer transition-colors"
                              >
                                Revoke access ID
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-10 text-slate-500 border border-dashed border-slate-800 rounded-xl">
                          <Key className="w-10 h-10 mx-auto opacity-30 mb-2" />
                          <p className="text-xs">No programmatic API tokens have been registered yet.</p>
                        </div>
                      )}
                    </div>

                  </div>

                  {/* FUTURE PLATFORMS LANDING INTEGRATIONS CAPABILITIES SHEILDS */}
                  <div className={`p-6 rounded-2xl border ${
                    theme === "dark" ? "glass-panel-dark border-slate-800" : "bg-white border-slate-200"
                  }`}>
                    <h3 className="text-sm font-bold text-slate-200 dark:text-white mb-2">Programmatic Shortener Endpoint Protocol</h3>
                    <p className="text-[10px] text-slate-400 mb-6 leading-relaxed">Integration developers may post payload queries to request rapid path decript generation over APIs. Headers should append active valid API tokens inside bearer authorization sequences.</p>

                    <div className="p-4 bg-slate-900 border border-slate-850 rounded-xl space-y-3 font-mono text-[10px] select-all">
                      <div className="flex border-b border-slate-850 pb-2">
                        <span className="text-green-400 font-bold mr-2">POST</span>
                        <span className="text-white font-semibold">{APP_URL}/api/v1/shorten</span>
                      </div>
                      
                      <div className="space-y-1">
                        <span className="text-slate-400">// Headers</span>
                        <p className="text-cyan-400">Authorization: Bearer [YOUR_API_TOKEN_KEY]</p>
                        <p className="text-cyan-405">Content-Type: application/json</p>
                      </div>

                      <div className="space-y-1 pt-2">
                        <span className="text-slate-400">// Payload Payload Parameters</span>
                        <p className="text-indigo-300">{"{"}</p>
                        <p className="text-indigo-305 pl-4">"originalUrl": "https://news.ycombinator.com",</p>
                        <p className="text-indigo-305 pl-4">"customAlias": "custom-promo-code" <span className="text-slate-500">// Optional parameter</span></p>
                        <p className="text-indigo-300">{"}"}</p>
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* ===================================
                  TAB 7: USER ADMIN ROOT PANEL
                 =================================== */}
              {activeTab === "admin" && (
                <div className="space-y-6">
                  
                  {/* TWO COLUMN USER CREATION REGISTRATION MODS */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* MANUAL FORM REGISTRY */}
                    <div className={`p-6 rounded-2xl border ${
                      theme === "dark" ? "glass-panel-dark border-slate-800" : "bg-white border-slate-200"
                    }`}>
                      <h3 className="text-sm font-bold text-slate-200 dark:text-white mb-6">Register Authorized platform User</h3>

                      <form onSubmit={handleCreateUserSubmit} className="space-y-4">
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Username profile handle</label>
                          <input
                            id="admin-create-username"
                            type="text"
                            required
                            value={createUsername}
                            onChange={(e) => setCreateUsername(e.target.value)}
                            placeholder="Type unique identifier"
                            className="w-full px-4 py-3 bg-slate-900 border border-slate-850 focus:border-cyan-400 rounded-xl text-xs text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Passcode passphrase seed</label>
                          <input
                            id="admin-create-password"
                            type="password"
                            required
                            value={createUserPassword}
                            onChange={(e) => setCreateUserPassword(e.target.value)}
                            placeholder="Type platform credentials passkey"
                            className="w-full px-4 py-3 bg-slate-900 border border-slate-850 focus:border-cyan-400 rounded-xl text-xs text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Assigned privilege level</label>
                          <select
                            id="admin-create-role"
                            value={createUserRole}
                            onChange={(e) => setCreateUserRole(e.target.value as "Admin" | "User")}
                            className="w-full px-4 py-3 bg-slate-900 border border-slate-850 rounded-xl text-xs text-white outline-none"
                          >
                            <option value="User">Standard User - Path Publisher privileges </option>
                            <option value="Admin">System Administrator - Root Administrative rules</option>
                          </select>
                        </div>

                        <button
                          id="admin-register-btn"
                          type="submit"
                          disabled={creatingUser}
                          className="w-full py-2.5 px-3 bg-indigo-600 hover:bg-indigo-505 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
                        >
                          {creatingUser ? "Signing to core database rules..." : "Seal & register user session keys"}
                        </button>
                      </form>
                    </div>

                    {/* PLATFORM USERS INVENTORY LISTING */}
                    <div className={`p-6 rounded-2xl border lg:col-span-2 ${
                      theme === "dark" ? "glass-panel-dark border-slate-800" : "bg-white border-slate-200"
                    }`}>
                      <h3 className="text-sm font-bold text-slate-200 dark:text-white mb-4">Authorized shortener users directory</h3>
                      <p className="text-[10px] text-slate-400 mb-6">Aggregate links, clicks logs, and admin action panels per user profile</p>

                      {loadingUsers ? (
                        renderSkeleton()
                      ) : usersList.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs min-w-[500px]">
                            <thead>
                              <tr className="border-b border-slate-800/40 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                                <th className="py-2">Identities</th>
                                <th className="py-2 text-center">Links Created</th>
                                <th className="py-2 text-center">Agg clicks</th>
                                <th className="py-2 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-850/20">
                              {usersList.map((usr) => (
                                <tr key={usr.id} className="hover:bg-slate-900/10 text-slate-300">
                                  <td className="py-3.5">
                                    <div className="font-bold text-slate-100">{usr.username}</div>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded-md font-bold ${
                                        usr.role === "Admin" ? "bg-red-400/10 text-red-400" : "bg-cyan-400/10 text-cyan-400"
                                      }`}>
                                        {usr.role}
                                      </span>
                                      {usr.isSuspended && (
                                        <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-yellow-400/10 text-yellow-500 font-bold">
                                          Suspended profile
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  
                                  <td className="py-3.5 text-center font-mono font-semibold text-white">{usr.linksCreated}</td>
                                  <td className="py-3.5 text-center font-mono font-semibold text-white">{usr.clicksCount}</td>
                                  
                                  <td className="py-3.5 text-right">
                                    <div className="flex justify-end gap-1.5">
                                      {usr.username !== "admin" ? (
                                        <>
                                          <button
                                            onClick={() => handleToggleSuspendUser(usr.id, usr.username)}
                                            className={`p-1.5 rounded-lg border text-[10px] font-bold ${
                                              usr.isSuspended
                                                ? "bg-emerald-950/25 border-emerald-500/20 text-emerald-400 hover:bg-emerald-955/35"
                                                : "bg-yellow-950/25 border-yellow-500/20 text-yellow-400 hover:bg-yellow-955/35"
                                            } cursor-pointer transition-colors`}
                                          >
                                            {usr.isSuspended ? "Release Suspend" : "Suspend Action"}
                                          </button>
                                          
                                          <button
                                            onClick={() => handleDeleteUser(usr.id, usr.username)}
                                            className="p-1.5 rounded-lg bg-red-950/20 border border-red-500/20 text-red-400 hover:bg-red-950/40 text-[10px] font-bold cursor-pointer transition-colors"
                                          >
                                            Delete User
                                          </button>
                                        </>
                                      ) : (
                                        <span className="text-[10px] text-slate-500 italic">Protected Super admin Node</span>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-slate-500 text-xs py-4 text-center">No additional shortener users identified.</p>
                      )}
                    </div>

                  </div>

                </div>
              )}

              {/* ===================================
                  TAB 8: ABOUT SYSTEM SPECS
                 =================================== */}
              {activeTab === "about" && (
                <div className="space-y-6">
                  
                  {/* PLATFORM DETAIL SPECS CARDS */}
                  <div className={`p-8 rounded-2xl border relative overflow-hidden ${
                    theme === "dark" ? "glass-panel-dark border-slate-800" : "bg-white border-slate-200"
                  }`}>
                    {/* Glowing highlight accents */}
                    <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-cyan-500/5 blur-[80px] pointer-events-none"></div>

                    <div className="max-w-2xl space-y-6">
                      <div className="space-y-2">
                        <span className="text-[10px] font-mono tracking-widest text-cyan-400 uppercase font-bold">Platform Information Manifest</span>
                        <h2 className="text-2xl font-bold tracking-tight text-white dark:text-white">Developed by BY CS TOOLS</h2>
                        <p className="text-xs text-slate-400 leading-relaxed">A visual production-ready private redirect engine, dashboard, API programmatic layer, and user supervisor admin console customized completely to the rigorous specifications of our secure web utilities.</p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-850/40 text-xs text-slate-300">
                        <div className="space-y-1">
                          <p className="font-bold text-slate-400">Core Engine version:</p>
                          <p className="font-mono text-cyan-400">v1.4.0 (BY CS TOOLS Build Decryptor)</p>
                        </div>
                        <div className="space-y-1">
                          <p className="font-bold text-slate-400">Database Engine Schema:</p>
                          <p className="font-mono text-cyan-400">Persistent atomic JSON File DB</p>
                        </div>
                        <div className="space-y-1">
                          <p className="font-bold text-slate-400">Client Runtime Context:</p>
                          <p className="font-mono text-cyan-400">React 19, Tailwind, Vite compiler</p>
                        </div>
                        <div className="space-y-1">
                          <p className="font-bold text-slate-400">Programmatic Routing Node:</p>
                          <p className="font-mono text-cyan-400">Express & Vite full-stack node</p>
                        </div>
                      </div>

                      <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl text-xs space-y-1">
                        <p className="font-bold text-white mb-2 flex items-center gap-1.5"><Shield className="w-4 h-4 text-cyan-400" /> Platform Security Rules</p>
                        <p className="text-slate-400 leading-relaxed">This node is sealed as a **Private Redirect System**. Registration is restricted. System administrators are solely empowered to provision downstream profile accounts and manage routing domain rules.</p>
                      </div>
                    </div>
                  </div>

                  {/* PREVIEWS SECTIONS TO TEST SERVER ROUTINGS (404, 500 etc) */}
                  <div className={`p-6 rounded-2xl border ${
                    theme === "dark" ? "glass-panel-dark border-slate-800" : "bg-white border-slate-200"
                  }`}>
                    <h3 className="text-sm font-bold text-slate-200 dark:text-white mb-2">Platform Routing Fallback Previews</h3>
                    <p className="text-[10px] text-slate-400 mb-6leading-relaxed">Trigger client-side fallbacks of custom styled server error pages (404 and 500) designed specifically carrying the **BY CS TOOLS** branding patterns.</p>

                    <div className="flex flex-wrap gap-4 select-none">
                      <a
                        href="/wrongcode-placeholder-test"
                        target="_blank"
                        className="p-3 bg-slate-900 hover:bg-slate-850 text-[11px] font-bold text-yellow-400 border border-slate-800 hover:border-yellow-500/20 rounded-xl flex items-center gap-1.5 transition-colors"
                      >
                        <AlertTriangle className="w-4 h-4" /> Preview Custom 404 Shortener Screen
                      </a>
                      <a
                        href="/api/auth/me?token=broken-signature-test"
                        target="_blank"
                        className="p-3 bg-slate-900 hover:bg-slate-850 text-[11px] font-bold text-red-400 border border-slate-800 hover:border-red-500/20 rounded-xl flex items-center gap-1.5 transition-colors"
                      >
                        <ShieldAlert className="w-4 h-4" /> Preview Custom Session Error Trigger
                      </a>
                    </div>
                  </div>

                </div>
              )}

            </motion.div>
          </AnimatePresence>

        </div>

        {/* ===================================
            MODAL WINDOW SHEET: EDITING LINK
           =================================== */}
        {editingLink && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className={`w-full max-w-lg p-6 rounded-2xl shadow-2xl border ${
              theme === "dark" ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-800"
            }`}>
              <div className="flex items-center justify-between mb-6 pb-3 border-b border-dashed border-slate-800/10">
                <h3 className="text-sm font-bold">Edit link credentials</h3>
                <button
                  onClick={() => setEditingLink(null)}
                  className="p-1 px-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono font-bold hover:bg-slate-800"
                >
                  Close
                </button>
              </div>

              <form onSubmit={handleSaveEditLinkSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Destination long URL</label>
                  <input
                    id="edit-url"
                    type="text"
                    required
                    value={editOriginalUrl}
                    onChange={(e) => setEditOriginalUrl(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Shortcode Code Alias (Unique)</label>
                  <input
                    id="edit-code"
                    type="text"
                    required
                    value={editShortCode}
                    onChange={(e) => setEditShortCode(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-955 border border-slate-850 rounded-xl text-xs text-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Passkey Security (Optional)</label>
                    <input
                      id="edit-pass"
                      type="text"
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      placeholder="No passkey password is set"
                      className="w-full px-4 py-3 bg-slate-955 border border-slate-850 rounded-xl text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Expiration Date (Optional)</label>
                    <input
                      id="edit-exp"
                      type="date"
                      value={editExpiration}
                      onChange={(e) => setEditExpiration(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-955 border border-slate-850 rounded-xl text-xs text-white"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-4 justify-end">
                  <button
                    type="button"
                    onClick={() => setEditingLink(null)}
                    className="px-5 py-2.5 bg-slate-900 border border-slate-800 text-xs font-bold rounded-xl hover:bg-slate-800"
                  >
                    Cancel alterations
                  </button>
                  <button
                    id="save-edit-btn"
                    type="submit"
                    disabled={savingEdit}
                    className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-505 text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-55"
                  >
                    {savingEdit ? "Signing records update..." : "Save configurations"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* GLOBAL FIXED WEBSITE FOOTER */}
        <footer className={`px-6 py-4 border-t text-center text-xs tracking-wide select-none ${
          theme === "dark" ? "border-slate-850 bg-[#070b13] text-slate-500" : "border-slate-200 bg-white text-slate-500"
        }`}>
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 font-sans font-medium text-[11px]">
            <p className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-slate-400 via-cyan-400 to-indigo-500 tracking-wider">BY CS TOOLS</p>
            <p>© BY CS TOOLS. All Rights Reserved.</p>
          </div>
        </footer>

      </main>
    </div>
  );
}
