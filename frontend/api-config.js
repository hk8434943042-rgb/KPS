// Backend API Configuration (Dual mode: Localhost + GitHub Pages)
// Local browser usage  -> http://localhost:5000/api
// GitHub Pages usage   -> PUBLIC_BACKEND_API (set below)

(function configureApiBaseUrl() {
	const LOCAL_BACKEND_API = 'http://localhost:5000/api';

	// ⚠️ FOR GITHUB PAGES DEPLOYMENT:
	// Option 1: Set your public backend URL directly here
	// Example: 'https://your-backend.up.railway.app/api'
	const PUBLIC_BACKEND_API = '';

	// Option 2: Use set-api.html page to set URL dynamically:
	// https://hk8434943042-rgb.github.io/KPS/set-api.html?api=https://your-backend.up.railway.app

	// Option 3: Set GitHub repo secret BACKEND_API_URL and redeploy
	// Go to GitHub → Settings → Secrets → New repository secret
	// Name: BACKEND_API_URL
	// Value: https://your-backend.up.railway.app

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

	// On GitHub Pages, same-origin '/api' points to github.io (not your backend).
	// Use local backend by default unless user configured a public URL/override.
	if (isGitHubPages) {
		window.__API_BASE_URL = LOCAL_BACKEND_API;
		return;
	}

	// Check localStorage override (set via set-api.html)
	const override = localStorage.getItem('API_URL_OVERRIDE');
	if (override) {
		window.__API_BASE_URL = override;
		return;
	}

	// Fallback for custom hosting / same-origin reverse proxy
	window.__API_BASE_URL = `${window.location.protocol}//${host}/api`;
})();
