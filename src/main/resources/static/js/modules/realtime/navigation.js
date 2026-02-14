// ================================
// Navigation Route Module
// ================================

import {
    currentMeetingData,
    realtimeMap,
    destinationMarker,
    navigationPolyline,
    setNavigationPolyline
} from '../../core/state.js';
import { apiRequest } from '../../core/api.js';

// Fetch navigation route from Kakao Mobility API
export async function fetchNavigationRoute(originLat, originLng, destLat, destLng) {
    try {
        const response = await apiRequest(
            `/api/routes/directions?originLat=${originLat}&originLng=${originLng}&destLat=${destLat}&destLng=${destLng}`
        );

        if (!response.ok) {
            console.error('Failed to fetch navigation route');
            return null;
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Navigation route error:', error);
        return null;
    }
}

// Extract path coordinates from Kakao Mobility API response
function extractRoutePath(response) {
    const path = [];

    if (!response || !response.routes || response.routes.length === 0) {
        return path;
    }

    const route = response.routes[0];

    if (route.result_code !== 0) {
        console.error('Route not found:', route.result_msg);
        return path;
    }

    if (route.sections) {
        route.sections.forEach(section => {
            if (section.roads) {
                section.roads.forEach(road => {
                    const vertexes = road.vertexes;
                    for (let i = 0; i < vertexes.length; i += 2) {
                        path.push(new kakao.maps.LatLng(
                            vertexes[i + 1],  // lat
                            vertexes[i]       // lng
                        ));
                    }
                });
            }
        });
    }

    return path;
}

// Draw navigation route on map
export function drawNavigationRoute(path) {
    if (!realtimeMap || path.length === 0) return;

    clearNavigationRoute();

    const polyline = new kakao.maps.Polyline({
        path: path,
        strokeWeight: 6,
        strokeColor: '#3B82F6',
        strokeOpacity: 0.8,
        strokeStyle: 'solid'
    });

    polyline.setMap(realtimeMap);
    setNavigationPolyline(polyline);

    // Fit map bounds to show the entire route
    const bounds = new kakao.maps.LatLngBounds();
    path.forEach(point => bounds.extend(point));

    if (destinationMarker) {
        bounds.extend(destinationMarker.getPosition());
    }

    realtimeMap.setBounds(bounds);
}

// Clear navigation route from map
export function clearNavigationRoute() {
    if (navigationPolyline) {
        navigationPolyline.setMap(null);
        setNavigationPolyline(null);
    }
}

// Start navigation with route drawing
export async function startNavigationRoute(originLat, originLng) {
    if (!currentMeetingData || !currentMeetingData.lat || !currentMeetingData.lng) {
        console.error('Destination coordinates not available');
        return;
    }

    const destLat = currentMeetingData.lat;
    const destLng = currentMeetingData.lng;

    const routeData = await fetchNavigationRoute(originLat, originLng, destLat, destLng);

    if (routeData) {
        const path = extractRoutePath(routeData);
        if (path.length > 0) {
            drawNavigationRoute(path);

            if (routeData.routes && routeData.routes[0] && routeData.routes[0].summary) {
                const summary = routeData.routes[0].summary;
                const distanceKm = (summary.distance / 1000).toFixed(1);
                const durationMin = Math.round(summary.duration / 60);
                console.log(`Route: ${distanceKm}km, ${durationMin}분`);
            }
        } else {
            console.log('Could not extract route path');
        }
    }
}
