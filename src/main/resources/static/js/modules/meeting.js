// ================================
// Meeting Module (Orchestrator)
// ================================

// Sub-modules
import {
    loadMeetings,
    switchMeetingTab,
    goToMeetingDetail,
    openDepartureFromList,
    openRealtimeFromList,
    setShowPageHandler as setListShowPageHandler,
    setOpenDepartureModalHandler as setListOpenDepartureModalHandler,
    setOpenRealtimePageHandler as setListOpenRealtimePageHandler
} from './meeting/meetingList.js';

import {
    loadMeetingDetail,
    selectMemberForRoute,
    showAllRoutes
} from './meeting/meetingDetail.js';

import {
    initDatePicker,
    createMeeting,
    setShowPageHandler as setCreateShowPageHandler
} from './meeting/meetingCreate.js';

import {
    toggleMeetingMenu,
    confirmLeaveMeeting,
    confirmHideMeeting,
    leaveMeeting,
    hideMeeting,
    setShowPageHandler as setActionsShowPageHandler
} from './meeting/meetingActions.js';

// Forward declarations (will be set by app.js)
let showPageHandler = null;
let openDepartureModalHandler = null;
let openRealtimePageHandler = null;

export function setShowPageHandler(handler) {
    showPageHandler = handler;
    setListShowPageHandler(handler);
    setCreateShowPageHandler(handler);
    setActionsShowPageHandler(handler);
}

export function setOpenDepartureModalHandler(handler) {
    openDepartureModalHandler = handler;
    setListOpenDepartureModalHandler(handler);
}

export function setOpenRealtimePageHandler(handler) {
    openRealtimePageHandler = handler;
    setListOpenRealtimePageHandler(handler);
}

// Re-export everything for external consumers
export {
    loadMeetings,
    switchMeetingTab,
    goToMeetingDetail,
    openDepartureFromList,
    openRealtimeFromList,
    loadMeetingDetail,
    selectMemberForRoute,
    showAllRoutes,
    initDatePicker,
    createMeeting,
    toggleMeetingMenu,
    confirmLeaveMeeting,
    confirmHideMeeting,
    leaveMeeting,
    hideMeeting
};
