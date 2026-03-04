// Backend API Configuration
// Set your backend URL here for local or remote deployment

// LOCAL DEVELOPMENT (Backend running on same machine)
// Use this for testing on localhost before deploying
window.__API_BASE_URL = 'http://localhost:5000/api';

// PRODUCTION DEPLOYMENT via Cloudflare Tunnel
// Your PC is exposed to the internet via Cloudflare Tunnel
// window.__API_BASE_URL = 'https://proteins-comparing-xhtml-des.trycloudflare.com/api';

// ALTERNATIVE DEPLOYMENTS
// For PythonAnywhere:
// window.__API_BASE_URL = 'https://himanshu9008.pythonanywhere.com/api';

// For Render:
// window.__API_BASE_URL = 'https://your-app-name.onrender.com/api';

// For Railway:
// window.__API_BASE_URL = 'https://your-app-name.up.railway.app/api';

// For custom domain:
// window.__API_BASE_URL = 'https://your-domain.com/api';
