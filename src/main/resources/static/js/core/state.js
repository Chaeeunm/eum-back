// ================================
// Global State Management
// ================================

// Auth State
export let accessToken = localStorage.getItem('accessToken');
export let currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');

// Meeting State
export let currentMeetingId = null;
export let currentMeetingData = null;

// Kakao Map State
export let createMap = null;
export let createMarker = null;
export let detailMap = null;
export let detailMarker = null;
export let selectedLat = null;
export let selectedLng = null;
export let ps = null; // Places service

// Member Add State
export let selectedUserIds = new Set();
export let currentMeetingUsers = [];

// Pagination State
export let meetingsCurrentPage = 1;
export let meetingsPageSize = 10;
export let hasMoreMeetings = false;
export let isLoadingMore = false;
export let currentMeetingTab = 'upcoming'; // 'upcoming' or 'past'

// WebSocket State
export let stompClient = null;
export let isConnected = false;
export let locationUpdateInterval = null;
export let realtimeMap = null;
export let realtimeMarkers = {};
export let destinationMarker = null;
export let currentMeetingUserId = null;
export let isDepartureMode = false;

// Routing State
export let isUpdatingHash = false;

// Invite State
export let currentInviteCode = null;

// Route State
export let routeMap = null;
export let routeData = [];
export let routePolylines = [];
export let selectedMeetingUserId = null;
export let routeDestinationMarker = null;

// API Base URL
export const API_BASE = '';

// State Setters
export function setAccessToken(token) {
    accessToken = token;
}

export function setCurrentUser(user) {
    currentUser = user;
}

export function setCurrentMeetingId(id) {
    currentMeetingId = id;
}

export function setCurrentMeetingData(data) {
    currentMeetingData = data;
}

export function setCreateMap(map) {
    createMap = map;
}

export function setCreateMarker(marker) {
    createMarker = marker;
}

export function setDetailMap(map) {
    detailMap = map;
}

export function setDetailMarker(marker) {
    detailMarker = marker;
}

export function setSelectedLat(lat) {
    selectedLat = lat;
}

export function setSelectedLng(lng) {
    selectedLng = lng;
}

export function setPs(placesService) {
    ps = placesService;
}

export function setCurrentMeetingUsers(users) {
    currentMeetingUsers = users;
}

export function setMeetingsCurrentPage(page) {
    meetingsCurrentPage = page;
}

export function setHasMoreMeetings(value) {
    hasMoreMeetings = value;
}

export function setIsLoadingMore(value) {
    isLoadingMore = value;
}

export function setCurrentMeetingTab(tab) {
    currentMeetingTab = tab;
}

export function setStompClient(client) {
    stompClient = client;
}

export function setIsConnected(value) {
    isConnected = value;
}

export function setLocationUpdateInterval(interval) {
    locationUpdateInterval = interval;
}

export function setRealtimeMap(map) {
    realtimeMap = map;
}

export function setRealtimeMarkers(markers) {
    realtimeMarkers = markers;
}

export function setDestinationMarker(marker) {
    destinationMarker = marker;
}

export function setCurrentMeetingUserId(id) {
    currentMeetingUserId = id;
}

export function setIsDepartureMode(value) {
    isDepartureMode = value;
}

export function setIsUpdatingHash(value) {
    isUpdatingHash = value;
}

export function setCurrentInviteCode(code) {
    currentInviteCode = code;
}

export function setRouteMap(map) {
    routeMap = map;
}

export function setRouteData(data) {
    routeData = data;
}

export function setRoutePolylines(polylines) {
    routePolylines = polylines;
}

export function setSelectedMeetingUserId(id) {
    selectedMeetingUserId = id;
}

export function setRouteDestinationMarker(marker) {
    routeDestinationMarker = marker;
}

// Clear selected user ids
export function clearSelectedUserIds() {
    selectedUserIds.clear();
}

// Add/remove from selectedUserIds
export function addSelectedUserId(id) {
    selectedUserIds.add(id);
}

export function deleteSelectedUserId(id) {
    selectedUserIds.delete(id);
}