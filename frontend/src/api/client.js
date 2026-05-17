import { fallbackBootstrap } from "../data/fallback.js";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const SUPABASE_SESSION_KEY = "dama-supabase-session";
const AUTH_SESSION_KEY = "dama-app-auth-session";
const LEGACY_AUTH_SESSION_KEY = "dama-auth-session";
const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && !SUPABASE_URL.includes("your-project"));
export const supabase = supabaseConfigured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: SUPABASE_SESSION_KEY,
  },
}) : null;

function apiUrl(path) {
  if (!API_URL || path.startsWith("http")) {
    return path;
  }
  return `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function apiWsUrl(path, params = new URLSearchParams()) {
  const base = API_URL || window.location.origin;
  const url = new URL(path, base);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  const nextParams = params instanceof URLSearchParams ? params : new URLSearchParams(params);
  nextParams.forEach((value, key) => url.searchParams.set(key, value));
  return url.toString();
}

export async function getBootstrap(city = "Almaty") {
  try {
    const response = await fetch(apiUrl(`/api/bootstrap?city=${encodeURIComponent(city)}`));
    if (!response.ok) {
      const payload = await readResponsePayload(response);
      throw new ApiError({
        status: response.status,
        message: messageFromPayload(payload, `API returned ${response.status}`),
        details: payload,
      });
    }
    return await response.json();
  } catch (error) {
    console.warn("Using local fallback data because the API is not available.", error);
    return fallbackBootstrap;
  }
}

export class ApiError extends Error {
  constructor({ status = null, message = "Request failed.", details = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

async function readResponsePayload(response) {
  const type = response.headers.get("content-type") || "";
  if (type.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }
  try {
    return await response.text();
  } catch {
    return null;
  }
}

function messageFromPayload(payload, fallback) {
  if (!payload) {
    return fallback;
  }
  if (typeof payload === "string") {
    return payload || fallback;
  }
  const detail = payload.detail || payload.message || payload.error_description || payload.error;
  if (typeof detail === "string") {
    return detail;
  }
  if (Array.isArray(detail) && detail.length) {
    return detail.map((item) => item.msg || item.message || JSON.stringify(item)).join("; ");
  }
  if (detail && typeof detail === "object") {
    return detail.message || detail.reason || JSON.stringify(detail);
  }
  return fallback;
}

async function apiJson(path, options = {}) {
  const { headers, ...fetchOptions } = options;
  const token = await getAccessToken();
  let response;
  try {
    response = await fetch(apiUrl(path), {
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(headers || {}),
      },
      ...fetchOptions,
    });
  } catch (error) {
    throw new ApiError({
      status: null,
      message: "API unavailable. Start the FastAPI backend on port 8000 and check the network connection.",
      details: error,
    });
  }
  if (!response.ok) {
    const payload = await readResponsePayload(response);
    const parsedMessage = messageFromPayload(payload, `API returned ${response.status}`);
    throw new ApiError({
      status: response.status,
      message: response.status >= 500 && parsedMessage === `API returned ${response.status}`
        ? "Backend API crashed while handling this request. Check the FastAPI terminal for the traceback."
        : parsedMessage,
      details: payload,
    });
  }
  if (response.status === 204) {
    return {};
  }
  return response.json();
}

function normalizeAuthSession(payload, fallbackUser = null) {
  const session = payload.session || payload;
  const user = payload.user || session?.user || fallbackUser;
  if (!user?.id) {
    throw new Error("Auth response did not include a user id.");
  }
  return {
    access_token: session.access_token || "",
    refresh_token: session.refresh_token || "",
    expires_at: session.expires_at || null,
    user,
  };
}

export function restoreAuthSession() {
  const cached = readStoredSession(AUTH_SESSION_KEY);
  if (cached) {
    return cached;
  }
  const legacy = readStoredSession(LEGACY_AUTH_SESSION_KEY);
  if (legacy) {
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(legacy));
    localStorage.removeItem(LEGACY_AUTH_SESSION_KEY);
    return legacy;
  }
  return null;
}

function readStoredSession(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    return parsed?.user?.id ? parsed : null;
  } catch {
    return null;
  }
}

export function persistAuthSession(session) {
  if (!session) {
    localStorage.removeItem(AUTH_SESSION_KEY);
    localStorage.removeItem(LEGACY_AUTH_SESSION_KEY);
    return null;
  }
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
  localStorage.removeItem(LEGACY_AUTH_SESSION_KEY);
  return session;
}

export async function signUpCommander({ username, email, password }) {
  if (!supabase || !email || !password) {
    const demo = {
      access_token: "",
      refresh_token: "",
      user: {
        id: getDemoUserId(),
        email: email || "demo@nexus.local",
        user_metadata: { username },
      },
      offline: true,
    };
    return persistAuthSession(demo);
  }
  const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
  });
  if (error) {
    throw error;
  }
  return persistAuthSession(normalizeAuthSession(data, data.user));
}

export async function signInCommander({ email, password }) {
  if (!supabase || !email || !password) {
    const demo = {
      access_token: "",
      refresh_token: "",
      user: {
        id: getDemoUserId(),
        email: email || "demo@nexus.local",
        user_metadata: { username: "VALKYRIE_01" },
      },
      offline: true,
    };
    return persistAuthSession(demo);
  }
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    throw error;
  }
  return persistAuthSession(normalizeAuthSession(data));
}

export async function signOutCommander(session) {
  if (supabase && session?.access_token) {
    await supabase.auth.signOut().catch(() => undefined);
  }
  persistAuthSession(null);
}

export async function refreshCommanderSession() {
  const localSession = restoreAuthSession();
  if (localSession?.offline || localSession?.admin) {
    return localSession;
  }
  if (!supabase) {
    return localSession;
  }
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    return persistAuthSession(normalizeAuthSession(data.session));
  }
  return localSession;
}

export function onCommanderSessionChange(callback) {
  if (!supabase) {
    return () => undefined;
  }
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    if (session) {
      callback(persistAuthSession(normalizeAuthSession(session)));
      return;
    }
    const localSession = restoreAuthSession();
    callback(localSession?.offline || localSession?.admin ? localSession : null);
  });
  return () => data.subscription.unsubscribe();
}

export async function getAccessToken() {
  const localSession = restoreAuthSession();
  if (localSession?.offline || localSession?.admin) {
    return "";
  }
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) {
      persistAuthSession(normalizeAuthSession(data.session));
      return data.session.access_token;
    }
  }
  return localSession?.access_token || "";
}

export function isDemoMode() {
  const session = restoreAuthSession();
  return !supabase || Boolean(session?.offline || session?.admin);
}

export async function getConnectionHealth() {
  const result = {
    api: "offline",
    database: "offline",
    supabase: supabase ? "configured" : "demo",
    apiUrl: API_URL || window.location.origin,
  };
  try {
    const apiResponse = await fetch(apiUrl("/api/health"));
    result.api = apiResponse.ok ? "online" : `error ${apiResponse.status}`;
  } catch {
    result.api = "offline";
  }
  try {
    const token = await getAccessToken();
    const dbResponse = await fetch(apiUrl("/api/database/health"), {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    result.database = dbResponse.ok ? "online" : `error ${dbResponse.status}`;
  } catch {
    result.database = "offline";
  }
  return result;
}

export function getDemoUserId() {
  const key = "dama-demo-user-id";
  const existing = localStorage.getItem(key);
  if (existing) {
    return existing;
  }
  const generated = crypto.randomUUID ? crypto.randomUUID() : "00000000-0000-4000-8000-000000000001";
  localStorage.setItem(key, generated);
  return generated;
}

export async function getProfile(userId) {
  return apiJson(`/api/profiles/${encodeURIComponent(userId)}`);
}

export async function createProfile(profile) {
  return apiJson("/api/profiles", {
    method: "POST",
    body: JSON.stringify(profile),
  });
}

export async function saveProfile(userId, patch) {
  return apiJson(`/api/profiles/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function saveProfileAvatar(userId, profilePictureUrl) {
  return apiJson(`/api/profiles/${encodeURIComponent(userId)}/avatar`, {
    method: "POST",
    body: JSON.stringify({ profile_picture_url: profilePictureUrl }),
  });
}

export async function recordMatch(match) {
  return apiJson("/api/matches", {
    method: "POST",
    body: JSON.stringify(match),
  });
}

export async function getMatchHistory(userId) {
  return apiJson(`/api/matches/${encodeURIComponent(userId)}`);
}

export async function getCampaignProgress(userId, factionId = "nomads") {
  return apiJson(`/api/campaign-progress/${encodeURIComponent(userId)}/${encodeURIComponent(factionId)}`);
}

export async function saveCampaignProgress(userId, factionId, progress) {
  return apiJson(`/api/campaign-progress/${encodeURIComponent(userId)}/${encodeURIComponent(factionId)}`, {
    method: "PUT",
    body: JSON.stringify(progress),
  });
}

export async function getVaultItems(userId) {
  return apiJson(`/api/vault/items?user_id=${encodeURIComponent(userId)}`);
}

export async function purchaseVaultItem(userId, cosmeticId) {
  return apiJson("/api/vault/purchase", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, cosmetic_id: cosmeticId }),
  });
}

export async function getInventory(userId) {
  return apiJson(`/api/inventory/${encodeURIComponent(userId)}`);
}

export async function equipInventoryItem(userId, inventoryItemId) {
  return apiJson("/api/inventory/equip", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, inventory_item_id: inventoryItemId }),
  });
}

export async function grantInventoryItem(userId, cosmeticId, source = "achievement") {
  return apiJson("/api/inventory/grant", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, cosmetic_id: cosmeticId, source }),
  });
}

export async function getLiveLeaderboard(city = "Global", limit = 10) {
  return apiJson(`/api/leaderboard/live?city=${encodeURIComponent(city)}&limit=${encodeURIComponent(limit)}`);
}

export async function createMultiplayerRoom({ userId, mode = "private" }) {
  return apiJson("/api/multiplayer/rooms", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, mode }),
  });
}

export async function getMultiplayerRoom(roomCode) {
  return apiJson(`/api/multiplayer/rooms/${encodeURIComponent(roomCode)}`);
}

export async function joinMultiplayerQueue({ userId, mode = "fast" }) {
  return apiJson(`/api/multiplayer/queue/${encodeURIComponent(mode)}`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId, mode }),
  });
}

export async function getMultiplayerQueueStatus({ userId, mode = "fast", roomCode = "" }) {
  const params = new URLSearchParams({ user_id: userId, mode });
  if (roomCode) {
    params.set("room_code", roomCode);
  }
  return apiJson(`/api/multiplayer/queue/status?${params.toString()}`);
}

export async function cancelMultiplayerQueue(userId) {
  return apiJson(`/api/multiplayer/queue?user_id=${encodeURIComponent(userId)}`, {
    method: "DELETE",
  });
}

export async function analyzeCoach(payload) {
  return apiJson("/api/coach/analyze", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function searchPlayers(username, limit = 8) {
  return apiJson(`/api/players/search?username=${encodeURIComponent(username)}&limit=${encodeURIComponent(limit)}`);
}

export async function getPublicProfile(userId) {
  return apiJson(`/api/players/${encodeURIComponent(userId)}/public`);
}

export async function getFriends(userId) {
  return apiJson(`/api/friends?user_id=${encodeURIComponent(userId)}`);
}

export async function sendFriendRequest(userId, targetUserId) {
  return apiJson("/api/friends/requests", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, target_user_id: targetUserId }),
  });
}

export async function respondFriendRequest(userId, requestId, action) {
  return apiJson(`/api/friends/requests/${encodeURIComponent(requestId)}/${action}?user_id=${encodeURIComponent(userId)}`, {
    method: "POST",
  });
}

export async function inviteFriend(userId, friendId, roomCode) {
  return apiJson(`/api/friends/${encodeURIComponent(friendId)}/invite`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId, room_code: roomCode }),
  });
}

export async function requestProInterest({ userId = null, source = "pro_modal", selectedOffer = "aether_pro" } = {}) {
  return apiJson("/api/pro/interest", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, source, selected_offer: selectedOffer }),
  });
}
