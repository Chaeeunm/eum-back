// ================================
// Kakao Map Module
// ================================

import {
    createMap,
    createMarker,
    detailMap,
    detailMarker,
    ps,
    routeMap,
    routeData,
    routePolylines,
    selectedMeetingUserId,
    routeDestinationMarker,
    setCreateMap,
    setCreateMarker,
    setDetailMap,
    setDetailMarker,
    setSelectedLat,
    setSelectedLng,
    setPs,
    setRouteMap,
    setRouteData,
    setRoutePolylines,
    setSelectedMeetingUserId,
    setRouteDestinationMarker
} from '../core/state.js';
import { showToast } from '../ui/toast.js';
import { escapeHtml } from '../utils/helpers.js';

// Initialize Kakao Places service
export function initKakaoPlaces() {
    if (typeof kakao !== 'undefined' && kakao.maps && kakao.maps.services) {
        setPs(new kakao.maps.services.Places());
    }
}

// Initialize map for creating meetings
export function initCreateMap() {
    const container = document.getElementById('create-map');
    if (!container || typeof kakao === 'undefined') return;

    const options = {
        center: new kakao.maps.LatLng(37.5665, 126.9780), // Seoul
        level: 5
    };

    const map = new kakao.maps.Map(container, options);
    setCreateMap(map);

    // Click event to place marker
    kakao.maps.event.addListener(map, 'click', (mouseEvent) => {
        const latlng = mouseEvent.latLng;
        placeMarkerOnCreate(latlng.getLat(), latlng.getLng());
        reverseGeocode(latlng.getLat(), latlng.getLng());
    });
}

// Place marker on create map
export function placeMarkerOnCreate(lat, lng, name=null) {
    const position = new kakao.maps.LatLng(lat, lng);
    const map = createMap;

    if (createMarker) {
        createMarker.setPosition(position);
    } else {
        const marker = new kakao.maps.Marker({
            position: position,
            map: map
        });
        setCreateMarker(marker);
    }

    setSelectedLat(lat);
    setSelectedLng(lng);
    document.getElementById('lat').value = lat;
    document.getElementById('lng').value = lng;
    if (name) {
            document.getElementById('locationName').value = name;
            document.getElementById('selected-location').textContent = name;
        }
}

// Reverse geocode coordinates to address
export function reverseGeocode(lat, lng) {
    if (!kakao.maps.services) return;

    const geocoder = new kakao.maps.services.Geocoder();
    const coord = new kakao.maps.LatLng(lat, lng);

    geocoder.coord2Address(coord.getLng(), coord.getLat(), (result, status) => {
        if (status === kakao.maps.services.Status.OK) {
            const address = result[0].road_address
                ? result[0].road_address.address_name
                : result[0].address.address_name;
            document.getElementById('selected-location').textContent = address;
            document.getElementById('locationName').value = address;
        } else {
         const coordsText = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
          document.getElementById('selected-location').textContent = coordsText;
          document.getElementById('locationName').value = coordsText;
        }
    });
}

// Search location by keyword
export function searchLocation() {
    const keyword = document.getElementById('location-search').value.trim();
    if (!keyword) {
        showToast('Please enter a place name', 'error');
        return;
    }

    if (!ps) {
        showToast('Map service not available', 'error');
        return;
    }

    ps.keywordSearch(keyword, (data, status) => {
        const resultsEl = document.getElementById('search-results');

        if (status === kakao.maps.services.Status.OK) {
            resultsEl.innerHTML = '';
            resultsEl.classList.remove('hidden');

            data.slice(0, 5).forEach(place => {
                const item = document.createElement('div');
                item.className = 'search-result-item';
                item.innerHTML = `
                    <div class="place-name">${escapeHtml(place.place_name)}</div>
                    <div class="place-address">${escapeHtml(place.address_name)}</div>
                `;
                item.onclick = () => selectPlace(place);
                resultsEl.appendChild(item);
            });
        } else if (status === kakao.maps.services.Status.ZERO_RESULT) {
            resultsEl.innerHTML = '<div class="search-result-item"><div class="place-name">No results found</div></div>';
            resultsEl.classList.remove('hidden');
        } else {
            showToast('Search failed', 'error');
        }
    });
}

// Select a place from search results
export function selectPlace(place) {
    const lat = parseFloat(place.y);
    const lng = parseFloat(place.x);
    // 장소 이름(place_name)을 hidden 필드와 화면에 표시
    const locationNameEl = document.getElementById('locationName');
    if (locationNameEl) {
            locationNameEl.value = place.place_name;
        }

    placeMarkerOnCreate(lat, lng);
    createMap.setCenter(new kakao.maps.LatLng(lat, lng));
    createMap.setLevel(3);
// 화면 텍스트 업데이트 (주소 대신 장소 이름으로!)
    document.getElementById('selected-location').textContent = place.place_name;
    document.getElementById('search-results').classList.add('hidden');
    document.getElementById('location-search').value = '';
}

// Reset location selection
export function resetLocationSelection() {
    setSelectedLat(null);
    setSelectedLng(null);
    setCreateMarker(null);
    setCreateMap(null);
    document.getElementById('lat').value = '';
    document.getElementById('lng').value = '';
    document.getElementById('selected-location').textContent = '';
    document.getElementById('search-results').classList.add('hidden');
}

// Initialize map for meeting detail view
export function initDetailMap(lat, lng) {
    const container = document.getElementById('detail-map');
    if (!container || typeof kakao === 'undefined') return;

    const position = new kakao.maps.LatLng(lat, lng);
    const options = {
        center: position,
        level: 3
    };

    const map = new kakao.maps.Map(container, options);
    setDetailMap(map);

    const marker = new kakao.maps.Marker({
        position: position,
        map: map
    });
    setDetailMarker(marker);
}

// Initialize map for route view (past meetings)
export function initRouteMap(lat, lng) {
    const container = document.getElementById('route-map');
    if (!container || typeof kakao === 'undefined') return;

    const position = new kakao.maps.LatLng(lat, lng);
    const options = {
        center: position,
        level: 5
    };

    const map = new kakao.maps.Map(container, options);
    setRouteMap(map);

    // Add destination marker
    const marker = new kakao.maps.Marker({
        position: position,
        map: map
    });
    setRouteDestinationMarker(marker);
}

// Draw routes on map
export function drawRoutes(routes, users) {
    if (!routeMap) return;

    // Clear existing polylines
    clearRoutePolylines();

    const newPolylines = [];
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];

    routes.forEach((routeItem, index) => {
        if (!routeItem.route || routeItem.route.length < 2) return;

        const path = routeItem.route.map(point =>
            new kakao.maps.LatLng(point.lat, point.lng)
        );

        const polyline = new kakao.maps.Polyline({
            path: path,
            strokeWeight: 4,
            strokeColor: colors[index % colors.length],
            strokeOpacity: 0.8,
            strokeStyle: 'solid'
        });

        polyline.meetingUserId = routeItem.meetingUserId;
        polyline.setMap(routeMap);
        newPolylines.push(polyline);
    });

    setRoutePolylines(newPolylines);

    // Fit bounds to show all routes
    fitRouteBounds();
}

// Show only selected user's route
export function showUserRoute(meetingUserId) {
    setSelectedMeetingUserId(meetingUserId);

    routePolylines.forEach(polyline => {
        if (meetingUserId === null) {
            // Show all routes
            polyline.setMap(routeMap);
            polyline.setOptions({ strokeOpacity: 0.8 });
        } else if (polyline.meetingUserId === meetingUserId) {
            // Show selected route with full opacity
            polyline.setMap(routeMap);
            polyline.setOptions({ strokeOpacity: 1.0, strokeWeight: 5 });
        } else {
            // Dim other routes
            polyline.setMap(routeMap);
            polyline.setOptions({ strokeOpacity: 0.2, strokeWeight: 3 });
        }
    });

    // Fit bounds to selected route
    if (meetingUserId !== null) {
        const selectedPolyline = routePolylines.find(p => p.meetingUserId === meetingUserId);
        if (selectedPolyline) {
            const path = selectedPolyline.getPath();
            if (path.length > 0) {
                const bounds = new kakao.maps.LatLngBounds();
                path.forEach(point => bounds.extend(point));
                routeMap.setBounds(bounds);
            }
        }
    } else {
        fitRouteBounds();
    }
}

// Fit map bounds to show all routes
function fitRouteBounds() {
    if (!routeMap || routePolylines.length === 0) return;

    const bounds = new kakao.maps.LatLngBounds();
    let hasPoints = false;

    routePolylines.forEach(polyline => {
        const path = polyline.getPath();
        path.forEach(point => {
            bounds.extend(point);
            hasPoints = true;
        });
    });

    // Include destination marker
    if (routeDestinationMarker) {
        bounds.extend(routeDestinationMarker.getPosition());
        hasPoints = true;
    }

    if (hasPoints) {
        routeMap.setBounds(bounds);
    }
}

// Clear all route polylines
export function clearRoutePolylines() {
    routePolylines.forEach(polyline => polyline.setMap(null));
    setRoutePolylines([]);
    setSelectedMeetingUserId(null);
}

// Reset route map state
export function resetRouteMap() {
    clearRoutePolylines();
    if (routeDestinationMarker) {
        routeDestinationMarker.setMap(null);
        setRouteDestinationMarker(null);
    }
    setRouteMap(null);
    setRouteData([]);
}