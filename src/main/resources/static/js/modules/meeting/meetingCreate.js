// ================================
// Meeting Create Module
// ================================

import { apiRequest } from '../../core/api.js';
import { showToast } from '../../ui/toast.js';

// Forward declaration (set by orchestrator)
let showPageHandler = null;

export function setShowPageHandler(handler) {
    showPageHandler = handler;
}

// Date picker instance
let datePicker = null;

// Initialize date picker for create page
export function initDatePicker() {
    const meetAtInput = document.getElementById('meetAt');
    if (!meetAtInput) return;

    if (datePicker) {
        datePicker.destroy();
    }

    datePicker = flatpickr(meetAtInput, {
        locale: 'ko',
        enableTime: true,
        dateFormat: 'Y-m-d H:i',
        altInput: true,
        altFormat: 'Y년 m월 d일 H:i',
        minDate: 'today',
        time_24hr: true,
        minuteIncrement: 5,
        disableMobile: true,
        onReady: function(selectedDates, dateStr, instance) {
            instance.calendarContainer.classList.add('eum-datepicker');

            const timeContainer = instance.calendarContainer.querySelector('.flatpickr-time');
            if (timeContainer) {
                const hourWrapper = timeContainer.querySelector('.flatpickr-hour')?.closest('.numInputWrapper');
                const minuteWrapper = timeContainer.querySelector('.flatpickr-minute')?.closest('.numInputWrapper');

                if (hourWrapper && !hourWrapper.nextElementSibling?.classList.contains('time-label')) {
                    const hourLabel = document.createElement('span');
                    hourLabel.className = 'time-label';
                    hourLabel.textContent = '시';
                    hourWrapper.parentNode.insertBefore(hourLabel, hourWrapper.nextSibling);
                }

                if (minuteWrapper && !minuteWrapper.nextElementSibling?.classList.contains('time-label')) {
                    const minuteLabel = document.createElement('span');
                    minuteLabel.className = 'time-label';
                    minuteLabel.textContent = '분';
                    minuteWrapper.parentNode.insertBefore(minuteLabel, minuteWrapper.nextSibling);
                }

                const hourInput = timeContainer.querySelector('.flatpickr-hour');
                if (hourInput) {
                    hourInput.setAttribute('min', '0');
                    hourInput.setAttribute('max', '23');
                }

                const minuteInput = timeContainer.querySelector('.flatpickr-minute');
                if (minuteInput) {
                    minuteInput.setAttribute('min', '0');
                    minuteInput.setAttribute('max', '59');
                }
            }
        }
    });
}

// Create meeting
export async function createMeeting(event) {
    event.preventDefault();

    const form = event.target;
    const title = form.title.value;
    const description = form.description.value;
    const meetAtInput = form.meetAt.value;
    const lat = form.lat.value ? parseFloat(form.lat.value) : null;
    const lng = form.lng.value ? parseFloat(form.lng.value) : null;
    const locationName = form.locationName ? form.locationName.value : null;

    const meetAt = meetAtInput || null;

    const payload = {
        title,
        description: description || null,
        meetAt,
        lat,
        lng,
        locationName
    };

    try {
        const response = await apiRequest('/meeting', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to create meeting');
        }

        showToast('Meeting created!', 'success');
        if (showPageHandler) {
            showPageHandler('main');
        }
    } catch (error) {
        showToast(error.message || 'Failed to create meeting', 'error');
    }
}
