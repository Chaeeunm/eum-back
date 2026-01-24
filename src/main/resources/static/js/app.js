// ================================
// Main Entry Point
// ================================

// Import Core
import { setPs } from './core/state.js';
import { initRouter, showPage, navigateTo } from './core/router.js';

// Import UI
import { showToast } from './ui/toast.js';
import { showModal, hideModal, switchModal } from './ui/modal.js';
import { initLandingAnimations } from './ui/animation.js';

// Import Modules
import { login, signup, logout, setShowPageHandler as setAuthShowPageHandler, setCheckPendingInviteCodeHandler } from './modules/auth.js';
import {
    initKakaoPlaces,
    searchLocation,
    selectPlace,
    resetLocationSelection
} from './modules/map.js';
import {
    switchMeetingTab,
    loadMeetings,
    goToMeetingDetail,
    openDepartureFromList,
    openRealtimeFromList,
    loadMeetingDetail,
    createMeeting,
    setShowPageHandler as setMeetingShowPageHandler,
    setOpenDepartureModalHandler,
    setOpenRealtimePageHandler
} from './modules/meeting.js';
import {
    openAddMemberModal,
    searchUsers,
    removeSelectedUser,
    addSelectedMembers,
    setLoadMeetingDetailHandler
} from './modules/member.js';
import {
    openRealtimePage,
    openDepartureModal,
    startDeparture,
    startDepartureFromRealtime,
    toggleDeparture,
    exitRealtimePage,
    setShowPageHandler as setRealtimeShowPageHandler
} from './modules/realtime.js';
import {
    checkInviteCodeFromUrl,
    confirmInvite,
    cancelInvite,
    checkPendingInviteCode,
    copyInviteLink,
    setShowPageHandler as setInviteShowPageHandler
} from './modules/invite.js';

// ================================
// Wire up module dependencies
// ================================

// Set showPage handler for all modules that need it
setAuthShowPageHandler(showPage);
setMeetingShowPageHandler(showPage);
setRealtimeShowPageHandler(showPage);
setInviteShowPageHandler(showPage);

// Set checkPendingInviteCode handler for auth module
setCheckPendingInviteCodeHandler(checkPendingInviteCode);

// Set handlers for meeting module
setOpenDepartureModalHandler(openDepartureModal);
setOpenRealtimePageHandler(openRealtimePage);

// Set loadMeetingDetail handler for member module
setLoadMeetingDetailHandler(loadMeetingDetail);

// ================================
// Expose functions to global scope for HTML onclick handlers
// ================================
window.appModules = {
    // Auth
    login,
    signup,
    logout,

    // Navigation
    showPage,
    navigateTo,

    // Modal
    showModal,
    hideModal,
    switchModal,

    // Toast
    showToast,

    // Map
    searchLocation,

    // Meeting
    switchMeetingTab,
    goToMeetingDetail,
    openDepartureFromList,
    openRealtimeFromList,
    createMeeting,

    // Member
    openAddMemberModal,
    searchUsers,
    removeSelectedUser,
    addSelectedMembers,

    // Realtime
    openRealtimePage,
    openDepartureModal,
    startDeparture,
    startDepartureFromRealtime,
    toggleDeparture,
    exitRealtimePage,

    // Invite
    confirmInvite,
    cancelInvite,
    copyInviteLink
};

// Also expose to window for backward compatibility
window.login = login;
window.signup = signup;
window.logout = logout;
window.showPage = showPage;
window.navigateTo = navigateTo;
window.showModal = showModal;
window.hideModal = hideModal;
window.switchModal = switchModal;
window.showToast = showToast;
window.searchLocation = searchLocation;
window.switchMeetingTab = switchMeetingTab;
window.goToMeetingDetail = goToMeetingDetail;
window.openDepartureFromList = openDepartureFromList;
window.openRealtimeFromList = openRealtimeFromList;
window.createMeeting = createMeeting;
window.openAddMemberModal = openAddMemberModal;
window.searchUsers = searchUsers;
window.removeSelectedUser = removeSelectedUser;
window.addSelectedMembers = addSelectedMembers;
window.openRealtimePage = openRealtimePage;
window.openDepartureModal = openDepartureModal;
window.startDeparture = startDeparture;
window.startDepartureFromRealtime = startDepartureFromRealtime;
window.toggleDeparture = toggleDeparture;
window.exitRealtimePage = exitRealtimePage;
window.confirmInvite = confirmInvite;
window.cancelInvite = cancelInvite;
window.copyInviteLink = copyInviteLink;

// ================================
// Initialize Application
// ================================
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Kakao Places service
    if (typeof kakao !== 'undefined' && kakao.maps && kakao.maps.services) {
        setPs(new kakao.maps.services.Places());
    }

    // Enter key for location search
    const searchInput = document.getElementById('location-search');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                searchLocation();
            }
        });
    }

    // Enter key for user search
    const userSearchInput = document.getElementById('user-search');
    if (userSearchInput) {
        userSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                searchUsers();
            }
        });
    }

    // Initialize router (handles initial page based on URL hash)
    initRouter();

    // Initialize landing page animations
    initLandingAnimations();

    // Check invite code from URL
    checkInviteCodeFromUrl();
});