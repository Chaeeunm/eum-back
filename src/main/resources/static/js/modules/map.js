// ================================
// Kakao Map Module
// ================================

import {
    createMap,
    createMarker,
    detailMap,
    detailMarker,
    ps,
    setCreateMap,
    setCreateMarker,
    setDetailMap,
    setDetailMarker,
    setSelectedLat,
    setSelectedLng,
    setPs
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
export function placeMarkerOnCreate(lat, lng) {
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
        } else {
            document.getElementById('selected-location').textContent =
                `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
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

    placeMarkerOnCreate(lat, lng);
    createMap.setCenter(new kakao.maps.LatLng(lat, lng));
    createMap.setLevel(3);

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