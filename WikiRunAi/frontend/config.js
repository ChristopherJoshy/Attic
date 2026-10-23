const CONFIG = {
    BACKEND_URL: 'https://wikirunai.onrender.com',
    getWebSocketUrl: function() {
        let wsUrl = this.BACKEND_URL.replace(
            /^http(s?):\/\//,
            (match, s) => s ? 'wss://' : 'ws://'
        );
        wsUrl = wsUrl.replace(/\/$/, '');
        return wsUrl + '/ws/run';
    },
    getApiUrl: function(endpoint) {
        return this.BACKEND_URL.replace(/\/$/, '') + endpoint;
    }
};
