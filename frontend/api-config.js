// Backend API Configuration (Dual mode: Localhost + GitHub Pages)
// Local browser usage  -> http://localhost:5000/api
// GitHub Pages usage   -> PUBLIC_BACKEND_API (set below)

(function configureApiBaseUrl() {
	const LOCAL_BACKEND_API = 'http://localhost:5000/api';

	// Set your public backend URL here for GitHub Pages access.
	// Example: 'https://your-backend.onrender.com/api'
	// Keep empty '' if you want only localhost mode.
	const PUBLIC_BACKEND_API = '';

	const host = window.location.hostname;
	const isLocalHost = host === 'localhost' || host === '127.0.0.1';
	const isGitHubPages = host.endsWith('github.io');

	if (isLocalHost) {
		window.__API_BASE_URL = LOCAL_BACKEND_API;
		return;
	}

	if (isGitHubPages && PUBLIC_BACKEND_API) {
		window.__API_BASE_URL = PUBLIC_BACKEND_API.replace(/\/+$/, '');
		return;
	}

	// Fallback for custom hosting / same-origin reverse proxy
	window.__API_BASE_URL = `${window.location.protocol}//${host}/api`;
})();
