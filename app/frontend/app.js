// Hotel Reservation Dashboard - Backend Integration
// Enhanced for SAP Fiori UI Dashboard

// ===== Configuration & Constants =====
const CONFIG = {
  // Dynamic backend URL resolution
  BACKEND_URL: (() => {
    // Check for environment-specific URLs
    if (window.location.hostname.includes('github.dev') || window.location.hostname.includes('codespaces')) {
      return `https://${window.location.hostname.replace(/^(https?:\/\/)?/, '').split('-')[0]}-8080.app.github.dev`;
    }
    
    // Check for local development
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:8080';
    }
    
    // Production fallback (adjust as needed)
    return `${window.location.origin}/api`;
  })(),
  
  // API Endpoints
  ENDPOINTS: {
    HEALTH: '/health',
    RESERVATIONS: '/reservations',
    ROOMS: '/rooms',
    GUESTS: '/guests',
    STATS: '/stats',
    NOTIFICATIONS: '/notifications'
  },
  
  // Polling intervals (in milliseconds)
  POLLING: {
    HEALTH: 30000, // 30 seconds
    RESERVATIONS: 60000, // 1 minute
    NOTIFICATIONS: 15000 // 15 seconds
  },
  
  // Retry configuration
  RETRY: {
    MAX_ATTEMPTS: 3,
    INITIAL_DELAY: 1000,
    MAX_DELAY: 10000
  },
  
  // Notification settings
  NOTIFICATIONS: {
    TIMEOUT: 5000,
    MAX_VISIBLE: 5
  }
};

// ===== State Management =====
const APP_STATE = {
  reservations: [],
  healthStatus: null,
  rooms: [],
  guests: [],
  stats: {},
  notifications: [],
  isInitialized: false,
  pendingRequests: 0,
  lastUpdate: null,
  connectionStatus: 'connecting',
  activeFilters: {
    status: 'all',
    dateRange: 'today'
  }
};

// ===== Utility Functions =====
class HttpError extends Error {
  constructor(status, message, data = null) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Enhanced fetch with timeout, retry, and error handling
 */
async function safeFetch(endpoint, options = {}, retryCount = 0) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  
  try {
    const url = `${CONFIG.BACKEND_URL}${endpoint}`;
    APP_STATE.pendingRequests++;
    updateConnectionStatus();
    
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      let errorData = null;
      try {
        errorData = await response.json();
      } catch {
        // Ignore JSON parsing errors for error responses
      }
      
      throw new HttpError(response.status, `HTTP ${response.status}: ${response.statusText}`, errorData);
    }
    
    const data = await response.json();
    return data;
    
  } catch (error) {
    clearTimeout(timeoutId);
    
    // Retry logic for network errors or 5xx errors
    if (retryCount < CONFIG.RETRY.MAX_ATTEMPTS && 
        (error.name === 'AbortError' || error.name === 'TypeError' || 
         (error.status && error.status >= 500))) {
      
      const delay = Math.min(
        CONFIG.RETRY.INITIAL_DELAY * Math.pow(2, retryCount),
        CONFIG.RETRY.MAX_DELAY
      );
      
      console.warn(`Retry ${retryCount + 1}/${CONFIG.RETRY.MAX_ATTEMPTS} for ${endpoint} after ${delay}ms`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return safeFetch(endpoint, options, retryCount + 1);
    }
    
    throw error;
    
  } finally {
    APP_STATE.pendingRequests--;
    updateConnectionStatus();
  }
}

/**
 * Update UI connection status indicator
 */
function updateConnectionStatus() {
  const statusIndicator = document.getElementById('connectionStatus');
  if (!statusIndicator) return;
  
  if (APP_STATE.pendingRequests > 0) {
    APP_STATE.connectionStatus = 'loading';
    statusIndicator.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Syncing...';
    statusIndicator.className = 'status-badge status-pending';
  } else if (APP_STATE.healthStatus?.status === 'healthy') {
    APP_STATE.connectionStatus = 'connected';
    statusIndicator.innerHTML = '<i class="fas fa-check-circle"></i> Connected';
    statusIndicator.className = 'status-badge status-confirmed';
  } else {
    APP_STATE.connectionStatus = 'disconnected';
    statusIndicator.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Disconnected';
    statusIndicator.className = 'status-badge status-checked-out';
  }
}

/**
 * Show notification to user
 */
function showNotification(message, type = 'info', duration = CONFIG.NOTIFICATIONS.TIMEOUT) {
  const notification = {
    id: Date.now(),
    message,
    type,
    timestamp: new Date()
  };
  
  APP_STATE.notifications.unshift(notification);
  
  // Limit number of notifications
  if (APP_STATE.notifications.length > CONFIG.NOTIFICATIONS.MAX_VISIBLE) {
    APP_STATE.notifications.pop();
  }
  
  updateNotificationBadge();
  showToastNotification(message, type, duration);
  
  // Log to console for debugging
  console.log(`[${type.toUpperCase()}] ${message}`);
}

/**
 * Update notification badge count
 */
function updateNotificationBadge() {
  const badge = document.querySelector('.notification-badge .badge');
  if (badge) {
    const unreadCount = APP_STATE.notifications.filter(n => n.type === 'error' || n.type === 'warning').length;
    badge.textContent = unreadCount > 0 ? unreadCount : '';
    badge.style.display = unreadCount > 0 ? 'flex' : 'none';
  }
}

/**
 * Show toast notification
 */
function showToastNotification(message, type = 'info', duration = 5000) {
  const toastContainer = document.getElementById('toastContainer') || createToastContainer();
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-icon">
      <i class="fas ${getIconForType(type)}"></i>
    </div>
    <div class="toast-content">${message}</div>
    <button class="toast-close" onclick="this.parentElement.remove()">
      <i class="fas fa-times"></i>
    </button>
  `;
  
  toastContainer.appendChild(toast);
  
  // Auto-remove after duration
  setTimeout(() => {
    if (toast.parentElement) {
      toast.remove();
    }
  }, duration);
}

function getIconForType(type) {
  switch (type) {
    case 'success': return 'fa-check-circle';
    case 'error': return 'fa-exclamation-circle';
    case 'warning': return 'fa-exclamation-triangle';
    case 'info':
    default: return 'fa-info-circle';
  }
}

function createToastContainer() {
  const container = document.createElement('div');
  container.id = 'toastContainer';
  container.className = 'toast-container';
  document.body.appendChild(container);
  return container;
}

// ===== Health Status Management =====
async function loadHealth() {
  try {
    const data = await safeFetch(CONFIG.ENDPOINTS.HEALTH);
    APP_STATE.healthStatus = data;
    APP_STATE.lastUpdate = new Date();
    
    updateHealthUI(data);
    updateConnectionStatus();
    
    // Show notification if status changed
    if (data.status !== 'healthy') {
      showNotification(`System health: ${data.status}`, 'warning');
    }
    
    return data;
    
  } catch (error) {
    console.error('Health check failed:', error);
    APP_STATE.healthStatus = { status: 'unhealthy', message: error.message };
    
    updateHealthUI({
      status: 'error',
      message: `Connection failed: ${error.message}`,
      timestamp: new Date().toISOString()
    });
    
    showNotification('Unable to connect to server', 'error');
    updateConnectionStatus();
    
    throw error;
  }
}

function updateHealthUI(healthData) {
  const healthIndicator = document.querySelector('.health-indicator');
  const healthTitle = document.querySelector('.health-status h4');
  const healthTimestamp = document.querySelector('.health-status .text-secondary');
  const metricsContainer = document.querySelector('.health-metrics');
  
  if (!healthIndicator || !healthTitle) return;
  
  // Update status indicator
  healthIndicator.className = 'health-indicator';
  healthIndicator.classList.add(healthData.status === 'healthy' ? 'healthy' : 
                               healthData.status === 'degraded' ? 'warning' : 'error');
  
  // Update status text
  healthTitle.textContent = healthData.status === 'healthy' ? 'All systems operational' :
                           healthData.status === 'degraded' ? 'System degraded' :
                           'System issues detected';
  
  // Update timestamp
  if (healthTimestamp && healthData.timestamp) {
    const time = new Date(healthData.timestamp).toLocaleTimeString();
    healthTimestamp.textContent = `Last updated: ${time}`;
  }
  
  // Update metrics if provided
  if (metricsContainer && healthData.metrics) {
    metricsContainer.innerHTML = '';
    
    const metrics = [
      { label: 'Uptime', value: healthData.metrics.uptime || '98.5%' },
      { label: 'Response Time', value: healthData.metrics.responseTime || '24ms' },
      { label: 'Active Users', value: healthData.metrics.activeUsers || '127' },
      { label: 'Errors', value: healthData.metrics.errors || '0' }
    ];
    
    metrics.forEach(metric => {
      const metricEl = document.createElement('div');
      metricEl.className = 'metric';
      metricEl.innerHTML = `
        <div class="metric-value">${metric.value}</div>
        <div class="metric-label">${metric.label}</div>
      `;
      metricsContainer.appendChild(metricEl);
    });
  }
}

// ===== Reservations Management =====
async function loadReservations() {
  try {
    const data = await safeFetch(CONFIG.ENDPOINTS.RESERVATIONS);
    APP_STATE.reservations = data.data || data;
    APP_STATE.lastUpdate = new Date();
    
    updateReservationsUI(APP_STATE.reservations);
    updateStats();
    
    return data;
    
  } catch (error) {
    console.error('Failed to load reservations:', error);
    showNotification('Failed to load reservations', 'error');
    
    // Fallback to sample data if available
    if (APP_STATE.reservations.length > 0) {
      updateReservationsUI(APP_STATE.reservations);
      showNotification('Using cached data', 'warning');
    }
    
    throw error;
  }
}

function updateReservationsUI(reservations) {
  const reservationList = document.getElementById('reservationList');
  if (!reservationList) return;
  
  // Filter reservations based on active filters
  let filteredReservations = filterReservations(reservations);
  
  if (filteredReservations.length === 0) {
    reservationList.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 2rem;">
          <i class="fas fa-calendar-times" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
          <p>No reservations found</p>
        </td>
      </tr>
    `;
    return;
  }
  
  reservationList.innerHTML = '';
  
  filteredReservations.forEach(reservation => {
    const row = document.createElement('tr');
    
    // Format dates for display
    const fromDate = new Date(reservation.fromDate);
    const toDate = new Date(reservation.toDate);
    const fromDateFormatted = fromDate.toLocaleDateString();
    const toDateFormatted = toDate.toLocaleDateString();
    
    // Determine status badge
    const statusClass = getStatusClass(reservation.status);
    const statusText = reservation.status.charAt(0).toUpperCase() + reservation.status.slice(1);
    
    row.innerHTML = `
      <td>${reservation.guestName}</td>
      <td>${reservation.roomNumber}</td>
      <td>${fromDateFormatted}</td>
      <td>${toDateFormatted}</td>
      <td><span class="status-badge ${statusClass}">${statusText}</span></td>
      <td>
        <button class="card-action-btn" onclick="editReservation(${reservation.id})">
          <i class="fas fa-edit"></i>
        </button>
        <button class="card-action-btn" onclick="deleteReservation(${reservation.id})">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    `;
    
    reservationList.appendChild(row);
  });
}

function filterReservations(reservations) {
  const { status, dateRange } = APP_STATE.activeFilters;
  let filtered = [...reservations];
  
  // Filter by status
  if (status !== 'all') {
    filtered = filtered.filter(r => r.status === status);
  }
  
  // Filter by date range
  const now = new Date();
  switch (dateRange) {
    case 'today':
      filtered = filtered.filter(r => {
        const fromDate = new Date(r.fromDate);
        return fromDate.toDateString() === now.toDateString();
      });
      break;
    case 'upcoming':
      filtered = filtered.filter(r => {
        const fromDate = new Date(r.fromDate);
        return fromDate > now;
      });
      break;
    case 'past':
      filtered = filtered.filter(r => {
        const toDate = new Date(r.toDate);
        return toDate < now;
      });
      break;
    case 'current':
      filtered = filtered.filter(r => {
        const fromDate = new Date(r.fromDate);
        const toDate = new Date(r.toDate);
        return fromDate <= now && toDate >= now;
      });
      break;
  }
  
  return filtered;
}

function getStatusClass(status) {
  switch (status) {
    case 'confirmed': return 'status-confirmed';
    case 'pending': return 'status-pending';
    case 'checked-in': return 'status-checked-in';
    case 'checked-out': return 'status-checked-out';
    case 'cancelled': return 'status-checked-out';
    default: return 'status-pending';
  }
}

async function addReservation(reservationData) {
  try {
    const result = await safeFetch(CONFIG.ENDPOINTS.RESERVATIONS, {
      method: 'POST',
      body: JSON.stringify(reservationData)
    });
    
    // Add to local state
    APP_STATE.reservations.unshift(result);
    
    // Update UI
    updateReservationsUI(APP_STATE.reservations);
    updateStats();
    
    showNotification('Reservation added successfully', 'success');
    return result;
    
  } catch (error) {
    console.error('Failed to add reservation:', error);
    
    let errorMessage = 'Failed to add reservation';
    if (error.data?.message) {
      errorMessage += `: ${error.data.message}`;
    } else if (error.message) {
      errorMessage += `: ${error.message}`;
    }
    
    showNotification(errorMessage, 'error');
    throw error;
  }
}

async function editReservation(id) {
  // Find reservation
  const reservation = APP_STATE.reservations.find(r => r.id === id);
  if (!reservation) {
    showNotification('Reservation not found', 'error');
    return;
  }
  
  // Open edit modal or form
  showEditModal(reservation);
}

async function deleteReservation(id) {
  if (!confirm('Are you sure you want to delete this reservation?')) {
    return;
  }
  
  try {
    await safeFetch(`${CONFIG.ENDPOINTS.RESERVATIONS}/${id}`, {
      method: 'DELETE'
    });
    
    // Remove from local state
    APP_STATE.reservations = APP_STATE.reservations.filter(r => r.id !== id);
    
    // Update UI
    updateReservationsUI(APP_STATE.reservations);
    updateStats();
    
    showNotification('Reservation deleted successfully', 'success');
    
  } catch (error) {
    console.error('Failed to delete reservation:', error);
    showNotification('Failed to delete reservation', 'error');
  }
}

function showEditModal(reservation) {
  // Create or show edit modal
  const modal = document.getElementById('editModal') || createEditModal();
  
  // Populate form with reservation data
  document.getElementById('editGuestName').value = reservation.guestName;
  document.getElementById('editRoomNumber').value = reservation.roomNumber;
  document.getElementById('editFromDate').value = reservation.fromDate;
  document.getElementById('editToDate').value = reservation.toDate;
  document.getElementById('editStatus').value = reservation.status;
  document.getElementById('editReservationId').value = reservation.id;
  
  // Show modal
  modal.style.display = 'block';
}

function createEditModal() {
  const modal = document.createElement('div');
  modal.id = 'editModal';
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>Edit Reservation</h3>
        <button class="modal-close" onclick="closeEditModal()">&times;</button>
      </div>
      <div class="modal-body">
        <form id="editReservationForm">
          <input type="hidden" id="editReservationId">
          <div class="form-grid">
            <div class="form-group">
              <label for="editGuestName">Guest Name</label>
              <input type="text" id="editGuestName" required>
            </div>
            <div class="form-group">
              <label for="editRoomNumber">Room Number</label>
              <input type="text" id="editRoomNumber" required>
            </div>
            <div class="form-group">
              <label for="editFromDate">Check-in</label>
              <input type="date" id="editFromDate" required>
            </div>
            <div class="form-group">
              <label for="editToDate">Check-out</label>
              <input type="date" id="editToDate" required>
            </div>
            <div class="form-group">
              <label for="editStatus">Status</label>
              <select id="editStatus" required>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="checked-in">Checked-in</option>
                <option value="checked-out">Checked-out</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Update Reservation</button>
            <button type="button" class="btn btn-secondary" onclick="closeEditModal()">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Handle form submission
  document.getElementById('editReservationForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const updatedReservation = {
      id: parseInt(document.getElementById('editReservationId').value),
      guestName: document.getElementById('editGuestName').value,
      roomNumber: document.getElementById('editRoomNumber').value,
      fromDate: document.getElementById('editFromDate').value,
      toDate: document.getElementById('editToDate').value,
      status: document.getElementById('editStatus').value
    };
    
    try {
      const result = await safeFetch(`${CONFIG.ENDPOINTS.RESERVATIONS}/${updatedReservation.id}`, {
        method: 'PUT',
        body: JSON.stringify(updatedReservation)
      });
      
      // Update local state
      const index = APP_STATE.reservations.findIndex(r => r.id === updatedReservation.id);
      if (index !== -1) {
        APP_STATE.reservations[index] = result;
      }
      
      // Update UI
      updateReservationsUI(APP_STATE.reservations);
      updateStats();
      
      closeEditModal();
      showNotification('Reservation updated successfully', 'success');
      
    } catch (error) {
      console.error('Failed to update reservation:', error);
      showNotification('Failed to update reservation', 'error');
    }
  });
  
  return modal;
}

function closeEditModal() {
  const modal = document.getElementById('editModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// ===== Statistics & Dashboard Updates =====
async function loadStats() {
  try {
    const data = await safeFetch(CONFIG.ENDPOINTS.STATS);
    APP_STATE.stats = data;
    updateStats();
    return data;
  } catch (error) {
    console.error('Failed to load stats:', error);
    // Calculate stats from local data
    calculateLocalStats();
  }
}

function calculateLocalStats() {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  APP_STATE.stats = {
    today: APP_STATE.reservations.filter(r => r.fromDate === today).length,
    thisWeek: APP_STATE.reservations.filter(r => {
      const fromDate = new Date(r.fromDate);
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      return fromDate >= weekStart;
    }).length,
    occupancy: calculateOccupancyRate(),
    checkoutsToday: APP_STATE.reservations.filter(r => r.toDate === today && r.status === 'checked-in').length
  };
  
  updateStats();
}

function calculateOccupancyRate() {
  const totalRooms = 50; // This should come from backend
  const occupiedRooms = APP_STATE.reservations.filter(r => 
    r.status === 'checked-in' || r.status === 'confirmed'
  ).length;
  
  return Math.round((occupiedRooms / totalRooms) * 100);
}

function updateStats() {
  const metricsContainer = document.querySelector('.reservations-overview .health-metrics');
  if (!metricsContainer) return;
  
  metricsContainer.innerHTML = '';
  
  const stats = [
    { label: 'Today', value: APP_STATE.stats.today || 0 },
    { label: 'This Week', value: APP_STATE.stats.thisWeek || 0 },
    { label: 'Occupancy', value: `${APP_STATE.stats.occupancy || 0}%` },
    { label: 'Check-outs', value: APP_STATE.stats.checkoutsToday || 0 }
  ];
  
  stats.forEach(stat => {
    const metricEl = document.createElement('div');
    metricEl.className = 'metric';
    metricEl.innerHTML = `
      <div class="metric-value">${stat.value}</div>
      <div class="metric-label">${stat.label}</div>
    `;
    metricsContainer.appendChild(metricEl);
  });
}

// ===== Form Handling =====
function initializeFormHandlers() {
  const reservationForm = document.getElementById('reservationForm');
  if (reservationForm) {
    reservationForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData(reservationForm);
      const reservationData = {
        guestName: formData.get('guestName'),
        roomNumber: formData.get('roomNumber'),
        fromDate: formData.get('fromDate'),
        toDate: formData.get('toDate'),
        status: formData.get('status') || 'pending'
      };
      
      try {
        await addReservation(reservationData);
        reservationForm.reset();
      } catch (error) {
        // Error already handled by addReservation
      }
    });
  }
}

// ===== Polling & Auto-refresh =====
let pollingIntervals = [];

function startPolling() {
  // Clear any existing intervals
  stopPolling();
  
  // Health check polling
  pollingIntervals.push(setInterval(() => {
    loadHealth().catch(() => {
      // Error already handled by loadHealth
    });
  }, CONFIG.POLLING.HEALTH));
  
  // Reservations polling
  pollingIntervals.push(setInterval(() => {
    loadReservations().catch(() => {
      // Error already handled by loadReservations
    });
  }, CONFIG.POLLING.RESERVATIONS));
  
  // Stats polling
  pollingIntervals.push(setInterval(() => {
    loadStats().catch(() => {
      // Error already handled by loadStats
    });
  }, CONFIG.POLLING.RESERVATIONS * 2));
  
  console.log('Polling started with intervals:', {
    health: CONFIG.POLLING.HEALTH,
    reservations: CONFIG.POLLING.RESERVATIONS
  });
}

function stopPolling() {
  pollingIntervals.forEach(interval => clearInterval(interval));
  pollingIntervals = [];
}

// ===== Initialization =====
async function initializeApp() {
  console.log('Initializing Hotel Reservation Dashboard...');
  console.log('Backend URL:', CONFIG.BACKEND_URL);
  
  // Create connection status indicator if it doesn't exist
  if (!document.getElementById('connectionStatus')) {
    const headerActions = document.querySelector('.header-actions');
    if (headerActions) {
      const statusIndicator = document.createElement('div');
      statusIndicator.id = 'connectionStatus';
      statusIndicator.className = 'status-badge status-pending';
      statusIndicator.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting';
      statusIndicator.style.marginRight = '1rem';
      headerActions.prepend(statusIndicator);
    }
  }
  
  // Initialize form handlers
  initializeFormHandlers();
  
  // Load initial data
  try {
    await Promise.allSettled([
      loadHealth(),
      loadReservations(),
      loadStats()
    ]);
    
    APP_STATE.isInitialized = true;
    showNotification('Dashboard initialized successfully', 'success');
    
    // Start polling
    startPolling();
    
  } catch (error) {
    console.error('Initialization failed:', error);
    showNotification('Dashboard initialization incomplete', 'warning');
  }
  
  // Update last update time periodically
  setInterval(() => {
    const lastUpdateEl = document.getElementById('lastUpdateTime');
    if (lastUpdateEl && APP_STATE.lastUpdate) {
      const now = new Date();
      const diff = Math.floor((now - APP_STATE.lastUpdate) / 1000);
      
      if (diff < 60) {
        lastUpdateEl.textContent = `Updated ${diff} seconds ago`;
      } else if (diff < 3600) {
        lastUpdateEl.textContent = `Updated ${Math.floor(diff / 60)} minutes ago`;
      } else {
        lastUpdateEl.textContent = `Updated ${Math.floor(diff / 3600)} hours ago`;
      }
    }
  }, 10000);
}

// ===== Export functions for global access =====
window.editReservation = editReservation;
window.deleteReservation = deleteReservation;
window.closeEditModal = closeEditModal;

// ===== Initialize on DOM ready =====
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

// ===== Cleanup on page unload =====
window.addEventListener('beforeunload', () => {
  stopPolling();
  console.log('Dashboard cleanup completed');
});

// ===== CSS for toast notifications =====
const toastStyles = `
.toast-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 350px;
}

.toast {
  background: var(--sap-surface-color);
  border: 1px solid var(--sap-surface-border-color);
  border-radius: 6px;
  padding: 12px 16px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  display: flex;
  align-items: center;
  gap: 12px;
  animation: slideIn 0.3s ease-out;
}

.toast-success {
  border-left: 4px solid var(--sap-positive-color);
}

.toast-error {
  border-left: 4px solid var(--sap-negative-color);
}

.toast-warning {
  border-left: 4px solid var(--sap-critical-color);
}

.toast-info {
  border-left: 4px solid var(--sap-primary-color);
}

.toast-icon {
  font-size: 1.2rem;
}

.toast-success .toast-icon {
  color: var(--sap-positive-color);
}

.toast-error .toast-icon {
  color: var(--sap-negative-color);
}

.toast-warning .toast-icon {
  color: var(--sap-critical-color);
}

.toast-info .toast-icon {
  color: var(--sap-primary-color);
}

.toast-content {
  flex-grow: 1;
  font-size: 0.9rem;
}

.toast-close {
  background: none;
  border: none;
  color: var(--sap-text-secondary-color);
  cursor: pointer;
  font-size: 0.9rem;
  padding: 4px;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

/* Modal styles */
.modal {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0,0,0,0.5);
  z-index: 1000;
}

.modal-content {
  background-color: var(--sap-surface-color);
  margin: 5% auto;
  padding: 0;
  width: 90%;
  max-width: 600px;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.2);
}

.modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid var(--sap-surface-border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  color: var(--sap-text-color);
}

.modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--sap-text-secondary-color);
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-body {
  padding: 1.5rem;
}
`;

// Add styles to document
const styleSheet = document.createElement('style');
styleSheet.textContent = toastStyles;
document.head.appendChild(styleSheet);
