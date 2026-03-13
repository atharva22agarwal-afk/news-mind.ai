// API Configuration
const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3002/api'
    : '/api';

// API Endpoints
const API = {
    baseURL: API_BASE_URL,
    // Summary endpoints
    summarizeURL: `${API_BASE_URL}/summary/url`,
    summarizeText: `${API_BASE_URL}/summary/text`,
    summarizeFile: `${API_BASE_URL}/summary/file`,
    getSummary: (id) => `${API_BASE_URL}/summary/${id}`,

    // Debate endpoints
    createDebate: `${API_BASE_URL}/debate/create`,
    joinDebate: `${API_BASE_URL}/debate/join`,
    sendMessage: `${API_BASE_URL}/debate/message`,
    getDebate: (roomId) => `${API_BASE_URL}/debate/${roomId}`,
    moderateDebate: `${API_BASE_URL}/debate/moderate`,

    // History endpoints
    getSummaries: `${API_BASE_URL}/history/summaries`,
    getDebates: `${API_BASE_URL}/history/debates`,
    getStats: `${API_BASE_URL}/history/stats`,
    deleteSummary: (id) => `${API_BASE_URL}/history/summary/${id}`,

    // Tools endpoints
    toolsCompare: `${API_BASE_URL}/tools/compare`,

    // Public Feed endpoints
    getPublicFeed: `${API_BASE_URL}/feed/latest`,
    postToFeed: `${API_BASE_URL}/feed/post`
};

// Helper function to make API calls
async function apiCall(url, options = {}) {
    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'API request failed');
        }

        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Helper for file uploads
async function uploadFile(url, formData) {
    try {
        const response = await fetch(url, {
            method: 'POST',
            body: formData
            // Don't set Content-Type header - browser will set it with boundary
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'File upload failed');
        }

        return data;
    } catch (error) {
        console.error('Upload Error:', error);
        throw error;
    }
}

// Expose configuration globally for client scripts
window.API = API;
window.API_BASE_URL = API_BASE_URL;