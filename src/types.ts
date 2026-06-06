/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = "Admin" | "User";

export interface User {
  id: string;
  username: string;
  role: UserRole;
  isSuspended: boolean;
  createdAt: string;
}

export interface ShortLink {
  id: string;
  originalUrl: string;
  shortCode: string; // The short code e.g. "bycs-promo"
  customAlias?: string;
  expirationDate?: string; // ISO string or empty
  password?: string; // Optional password to access
  createdAt: string;
  userId: string; // Owner of the link
  clicksCount: number;
}

export interface ClickLog {
  id: string;
  linkId: string;
  shortCode: string;
  timestamp: string;
  ip: string;
  referrer: string;
  device: string; // e.g. Mobile, Desktop, Tablet, Other
  country: string; // e.g. US, IN, ID, BR, DE, etc.
  browser: string;
}

export interface SystemStats {
  totalLinks: number;
  totalClicks: number;
  activeLinksCount: number;
  clicksByDate: { date: string; clicks: number }[];
  deviceStats: { device: string; count: number }[];
  countryStats: { country: string; count: number }[];
}

export type PageId =
  | "login"
  | "dashboard"
  | "create"
  | "links"
  | "analytics"
  | "profile"
  | "settings"
  | "admin"
  | "about"
  | "404"
  | "500";
