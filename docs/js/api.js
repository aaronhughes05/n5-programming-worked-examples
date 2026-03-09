(function () {
    const state = {
        checked: false,
        authenticated: false,
        user: null,
    };

    const jsonFetch = async (url, options) => {
        const response = await fetch(url, {
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
                ...(options?.headers || {}),
            },
            ...options,
        });

        let data = null;
        try {
            data = await response.json();
        } catch {
            data = null;
        }

        if (!response.ok) {
            const message = data?.error || data?.detail || `Request failed (${response.status})`;
            const error = new Error(message);
            error.status = response.status;
            error.payload = data;
            throw error;
        }

        return data;
    };

    const toActivityKey = (activityKeyOrPath) => {
        const raw = String(activityKeyOrPath || "").trim();
        if (!raw) return "";
        if (raw.includes("/")) {
            const parts = raw.split("/").filter(Boolean);
            return parts[parts.length - 1];
        }
        return raw;
    };

    const api = {
        async init() {
            if (state.checked) return state;
            try {
                const payload = await jsonFetch("/auth/me", { method: "GET" });
                state.checked = true;
                state.authenticated = !!payload?.authenticated;
                state.user = payload?.user || null;
            } catch {
                state.checked = true;
                state.authenticated = false;
                state.user = null;
            }
            return state;
        },

        async me() {
            const payload = await jsonFetch("/auth/me", { method: "GET" });
            state.checked = true;
            state.authenticated = !!payload?.authenticated;
            state.user = payload?.user || null;
            return payload;
        },

        async login(username, password) {
            const payload = await jsonFetch("/auth/login", {
                method: "POST",
                body: JSON.stringify({ username, password }),
            });
            state.checked = true;
            state.authenticated = !!payload?.ok;
            state.user = payload?.user || null;
            return payload;
        },

        async logout() {
            await jsonFetch("/auth/logout", { method: "POST", body: JSON.stringify({}) });
            state.checked = true;
            state.authenticated = false;
            state.user = null;
            return { ok: true };
        },

        isLoggedIn() {
            return !!state.authenticated;
        },

        getUser() {
            return state.user;
        },

        async getActivityProgress(activityKeyOrPath) {
            const activityKey = toActivityKey(activityKeyOrPath);
            if (!activityKey) return null;
            const payload = await jsonFetch(`/api/progress/${encodeURIComponent(activityKey)}`, { method: "GET" });
            return payload?.progress || null;
        },

        async putActivityProgress(activityKeyOrPath, progressPayload) {
            const activityKey = toActivityKey(activityKeyOrPath);
            if (!activityKey) return null;
            const payload = await jsonFetch(`/api/progress/${encodeURIComponent(activityKey)}`, {
                method: "PUT",
                body: JSON.stringify(progressPayload || {}),
            });
            return payload?.progress || null;
        },

        async postCheckpoint(activityKeyOrPath, payload) {
            const activityKey = toActivityKey(activityKeyOrPath);
            if (!activityKey) return null;
            const result = await jsonFetch(`/api/progress/${encodeURIComponent(activityKey)}/checkpoint`, {
                method: "POST",
                body: JSON.stringify(payload || {}),
            });
            return result?.progress || null;
        },

        async postHint(activityKeyOrPath, checkpointId, payload) {
            const activityKey = toActivityKey(activityKeyOrPath);
            const cp = String(checkpointId || "").trim();
            if (!activityKey || !cp) return null;
            const result = await jsonFetch(`/api/hints/${encodeURIComponent(activityKey)}/${encodeURIComponent(cp)}`, {
                method: "POST",
                body: JSON.stringify(payload || {}),
            });
            return result?.hint || null;
        },

        async getProgressSummary() {
            const result = await jsonFetch("/api/progress-summary", { method: "GET" });
            return result?.summary || null;
        },
    };

    window.N5Api = api;
})();
