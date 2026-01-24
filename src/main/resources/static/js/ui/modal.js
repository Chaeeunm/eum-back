// ================================
// Modal Functions
// ================================

export function showModal(type) {
    document.getElementById(`${type}-modal`).classList.remove('hidden');
}

export function hideModal(type) {
    document.getElementById(`${type}-modal`).classList.add('hidden');
}

export function switchModal(from, to) {
    hideModal(from);
    showModal(to);
}