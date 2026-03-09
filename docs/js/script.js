const nextStep = (current, next) => {
    const currentStep = document.getElementById(`step${current}`);
    const nextEl = document.getElementById(next === 'full' ? 'fullCode' : `step${next}`);
    
    if (currentStep) currentStep.classList.add('hidden');
    if (nextEl) {
        nextEl.classList.remove('hidden');
        if (nextEl.id === "fullCode") {
            nextEl.dataset.correct = "true";
            stepperState.showWorkedExample = true;
            updateStepperState();
        }
    }
};

let stepperState = {
    sections: [],
    index: 0,
    completed: false,
    showWorkedExample: false
};

const STORAGE_NAMESPACE = "assessmentStepperState.v2";
const getStorageKey = () => `${STORAGE_NAMESPACE}:${window.location.pathname}`;
const HINT_STORAGE_NAMESPACE = "adaptiveHintState.v1";
const getHintStorageKey = () => `${HINT_STORAGE_NAMESPACE}:${window.location.pathname}`;
const ACTIVITY_PAGE_NAME = (window.location.pathname.split("/").pop() || "").toLowerCase();

const readStorage = (key) => {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
};

const writeStorage = (key, value) => {
    try {
        localStorage.setItem(key, value);
    } catch {
        // Ignore storage write failures (e.g., privacy mode).
    }
};

const removeStorage = (key) => {
    try {
        localStorage.removeItem(key);
    } catch {
        // Ignore storage removal failures.
    }
};

const hasApiAdapter = () => typeof window !== "undefined" && !!window.N5Api;
const isApiLoggedIn = () => hasApiAdapter() && typeof window.N5Api.isLoggedIn === "function" && window.N5Api.isLoggedIn();
const getApiUser = () => (hasApiAdapter() && typeof window.N5Api.getUser === "function" ? window.N5Api.getUser() : null);
const getApiUserRole = () => {
    const user = getApiUser();
    return String(user?.role || "").toLowerCase();
};
const LOCAL_IMPORT_MARKER_PREFIX = "dbImportDone.v1:";
const importedProgressRuntimeKeys = new Set();

const normalizeActivityKeyFromPath = (pathValue) => {
    const raw = String(pathValue || "").trim().toLowerCase();
    if (!raw) return "";
    const fromPath = raw.includes("/") ? raw.split("/").pop() : raw;
    return fromPath.endsWith(".html") ? fromPath.slice(0, -5) : fromPath;
};

const getImportMarkerKeysForUser = (user) => {
    const keys = [];
    const id = user?.id != null ? String(user.id).trim() : "";
    const username = String(user?.username || "").trim();
    const usernameLower = username.toLowerCase();

    if (id) keys.push(`${LOCAL_IMPORT_MARKER_PREFIX}id:${id}`);
    if (username) keys.push(`${LOCAL_IMPORT_MARKER_PREFIX}user:${username}`);
    if (usernameLower && usernameLower !== username) {
        keys.push(`${LOCAL_IMPORT_MARKER_PREFIX}user:${usernameLower}`);
    }
    if (!keys.length) keys.push(`${LOCAL_IMPORT_MARKER_PREFIX}unknown`);
    return Array.from(new Set(keys));
};

const getPrimaryImportRuntimeKey = (user) => getImportMarkerKeysForUser(user)[0];

const hasImportedLocalProgressForUser = (user) => {
    try {
        const keys = getImportMarkerKeysForUser(user);
        if (keys.some((key) => importedProgressRuntimeKeys.has(key))) return true;
        return keys.some((key) => localStorage.getItem(key) === "1");
    } catch {
        return importedProgressRuntimeKeys.has(getPrimaryImportRuntimeKey(user));
    }
};

const markImportedLocalProgressForUser = (user) => {
    const keys = getImportMarkerKeysForUser(user);
    keys.forEach((key) => importedProgressRuntimeKeys.add(key));
    try {
        keys.forEach((key) => localStorage.setItem(key, "1"));
    } catch {
        // Ignore storage failures.
    }
};

const collectStoredProgressRecords = () => {
    const rows = [];
    try {
        for (let i = 0; i < localStorage.length; i += 1) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith(STORAGE_PREFIX)) continue;
            const path = key.slice(STORAGE_PREFIX.length);
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            try {
                const payload = JSON.parse(raw);
                rows.push({ path, payload });
            } catch {
                // Ignore malformed entries.
            }
        }
    } catch {
        // Ignore storage read failures.
    }
    return rows;
};

const collectStoredHintRecords = () => {
    const rows = [];
    try {
        for (let i = 0; i < localStorage.length; i += 1) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith(HINT_STORAGE_PREFIX)) continue;
            const path = key.slice(HINT_STORAGE_PREFIX.length);
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            try {
                const payload = JSON.parse(raw);
                rows.push({ path, payload });
            } catch {
                // Ignore malformed entries.
            }
        }
    } catch {
        // Ignore storage read failures.
    }
    return rows;
};

const importLocalProgressToDb = async () => {
    if (!isApiLoggedIn()) return { imported: false, reason: "not_logged_in" };
    const user = getApiUser();
    if (!user) return { imported: false, reason: "missing_user" };
    if (hasImportedLocalProgressForUser(user)) return { imported: false, reason: "already_imported" };

    const progressRows = collectStoredProgressRecords();
    const hintRows = collectStoredHintRecords();

    for (const row of progressRows) {
        const payload = row?.payload;
        if (!payload || typeof payload !== "object") continue;
        const activityKey = normalizeActivityKeyFromPath(payload.path || row.path);
        if (!activityKey) continue;

        const mergedInputs = payload.inputs && typeof payload.inputs === "object"
            ? { ...payload.inputs }
            : {};
        if (typeof payload.makeProgram === "string" && !("makeProgram" in mergedInputs)) {
            mergedInputs.makeProgram = payload.makeProgram;
        }
        if (typeof payload.makeCase === "string" && !("makeCase" in mergedInputs)) {
            mergedInputs.makeCase = payload.makeCase;
        }
        if (typeof payload.makeActual === "string" && !("makeActual" in mergedInputs)) {
            mergedInputs.makeActual = payload.makeActual;
        }

        await window.N5Api.putActivityProgress(activityKey, {
            stepIndex: Number(payload.index || 0),
            stepCount: Number(payload.stepCount || 0),
            isComplete: payload.isComplete === true || payload.completed === true,
            completedChecks: Array.isArray(payload.completedChecks) ? payload.completedChecks : [],
            inputs: mergedInputs,
            showWorkedExample: payload.showWorkedExample === true
        });
    }

    for (const row of hintRows) {
        const payload = row?.payload;
        if (!payload || typeof payload !== "object") continue;
        const activityKey = normalizeActivityKeyFromPath(row.path);
        if (!activityKey) continue;
        const checkpoints = payload.checkpoints && typeof payload.checkpoints === "object"
            ? payload.checkpoints
            : {};
        const entries = Object.entries(checkpoints);
        for (const [checkpointId, bucket] of entries) {
            if (!checkpointId || !bucket || typeof bucket !== "object") continue;
            await window.N5Api.postHint(activityKey, checkpointId, {
                attempts: Number(bucket.attempts || 0),
                shownLevel: Number(bucket.shownLevel || 0),
                showCount: Number(bucket.showCount || 0),
                revealCount: Number(bucket.revealCount || 0),
                revealedWorked: bucket.revealedWorked === true,
                lastUsedAt: Number(bucket.lastUsedAt || 0)
            });
        }
    }

    markImportedLocalProgressForUser(user);
    return { imported: true, progressCount: progressRows.length, hintCount: hintRows.length };
};

const toLocalProgressPayload = (remoteProgress, path) => {
    const inputs = remoteProgress?.inputs && typeof remoteProgress.inputs === "object"
        ? remoteProgress.inputs
        : {};
    return {
        path: path || window.location.pathname,
        stepCount: Number(remoteProgress?.stepCount || 0),
        index: Number(remoteProgress?.stepIndex || 0),
        isComplete: remoteProgress?.isComplete === true,
        updatedAt: Date.now(),
        completedChecks: Array.isArray(remoteProgress?.completedChecks) ? remoteProgress.completedChecks : [],
        inputs,
        makeProgram: typeof inputs.makeProgram === "string" ? inputs.makeProgram : "",
        makeCase: typeof inputs.makeCase === "string" ? inputs.makeCase : "case1",
        makeActual: typeof inputs.makeActual === "string" ? inputs.makeActual : "",
        showWorkedExample: remoteProgress?.showWorkedExample === true
    };
};

const syncProgressPayloadToApi = async (payload) => {
    if (!isApiLoggedIn()) return;
    try {
        await window.N5Api.putActivityProgress(payload.path || window.location.pathname, {
            stepIndex: Number(payload.index || 0),
            stepCount: Number(payload.stepCount || 0),
            isComplete: payload.isComplete === true,
            completedChecks: Array.isArray(payload.completedChecks) ? payload.completedChecks : [],
            inputs: payload.inputs && typeof payload.inputs === "object" ? payload.inputs : {},
            showWorkedExample: payload.showWorkedExample === true
        });
    } catch {
        // Keep localStorage as resilient fallback if API sync fails.
    }
};

const syncHintCheckpointToApi = async (checkpointId, bucket) => {
    if (!isApiLoggedIn()) return;
    if (!checkpointId || !bucket || typeof bucket !== "object") return;
    try {
        await window.N5Api.postHint(window.location.pathname, checkpointId, {
            attempts: Number(bucket.attempts || 0),
            shownLevel: Number(bucket.shownLevel || 0),
            showCount: Number(bucket.showCount || 0),
            revealCount: Number(bucket.revealCount || 0),
            revealedWorked: bucket.revealedWorked === true,
            lastUsedAt: Number(bucket.lastUsedAt || 0)
        });
    } catch {
        // Keep local hint state unchanged when API is unavailable.
    }
};

const syncCheckpointResultToApi = async (checkpointId, isCorrect) => {
    if (!isApiLoggedIn()) return;
    if (!checkpointId) return;
    try {
        await window.N5Api.postCheckpoint(window.location.pathname, {
            checkpointId,
            isCorrect: !!isCorrect,
            stepIndex: Number(stepperState?.index || 0),
            stepCount: Number(stepperState?.sections?.length || 0),
            isComplete: !!stepperState?.completed
        });
    } catch {
        // Keep local progression even if checkpoint sync fails.
    }
};

const hydrateProgressFromApi = async () => {
    if (!isApiLoggedIn()) return;
    try {
        const paths = new Set([window.location.pathname, ...ACTIVITY_DEFINITIONS.map((item) => item.path)]);
        for (const path of paths) {
            const remoteProgress = await window.N5Api.getActivityProgress(path);
            if (!remoteProgress) continue;
            writeStorage(`${STORAGE_NAMESPACE}:${path}`, JSON.stringify(toLocalProgressPayload(remoteProgress, path)));
        }
    } catch {
        // Fall back to existing local data without interruption.
    }
};

const TEACHER_MODE_SESSION_KEY = "teacherModeEnabled.v1";
const TEACHER_MODE_PASSCODE = "n5teacher";

const isTruthyFlag = (value) => /^(1|true|yes|on)$/i.test(String(value || "").trim());
const isTeacherDemoFallbackMode = () => {
    const params = new URLSearchParams(window.location.search);
    return isTruthyFlag(params.get("teacherDemo"));
};

const readTeacherModeSession = () => {
    try {
        return sessionStorage.getItem(TEACHER_MODE_SESSION_KEY) === "true";
    } catch {
        return false;
    }
};

const writeTeacherModeSession = (enabled) => {
    try {
        if (enabled) {
            sessionStorage.setItem(TEACHER_MODE_SESSION_KEY, "true");
        } else {
            sessionStorage.removeItem(TEACHER_MODE_SESSION_KEY);
        }
    } catch {
        // Ignore session storage errors.
    }
};

const isTeacherMode = () => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("teacher")) {
        return isTruthyFlag(params.get("teacher"));
    }
    return readTeacherModeSession();
};

const isInPagesDirectory = () => /\/pages\//.test(window.location.pathname);

const getHomeHref = () => (isInPagesDirectory() ? "../index.html" : "index.html");

const getTeacherHref = () => (isInPagesDirectory() ? "teacher.html" : "pages/teacher.html");

const getTeacherDeniedHomeHref = () => {
    const target = new URL(getHomeHref(), window.location.href);
    target.searchParams.set("teacherDenied", "1");
    return target.toString();
};

const applyTeacherModeClasses = (enabled) => {
    const body = document.body;
    if (!body) return;
    body.classList.toggle("is-teacher-mode", !!enabled);
    body.classList.toggle("is-student-mode", !enabled);
};

const initTeacherMode = () => {
    const body = document.body;
    if (!body) return false;

    const params = new URLSearchParams(window.location.search);
    if (params.has("teacher")) {
        writeTeacherModeSession(isTruthyFlag(params.get("teacher")));
    }

    const enabled = isTeacherMode();
    applyTeacherModeClasses(enabled);
    return true;
};

const initTeacherNavEntry = () => {
    // Legacy cleanup: Teacher Mode now lives in the avatar menu.
    document.querySelectorAll(".appbar-nav-actions").forEach((nav) => {
        nav.querySelectorAll('[data-teacher-nav="true"], a[href*="teacher.html"], a[href="/teacher/"], [data-teacher-lock]').forEach((el) => {
            if (el.closest("[data-avatar-menu='true']")) return;
            el.remove();
        });
    });
};

const enforceRoleAccess = () => {
    if (!hasApiAdapter()) return;
    const isTeacher = isApiLoggedIn() && getApiUserRole() === "teacher";
    const isTeacherPage = document.body.classList.contains("page-teacher");

    document.querySelectorAll("[data-teacher-only]").forEach((el) => {
        if (isTeacher) {
            el.removeAttribute("hidden");
            el.removeAttribute("aria-hidden");
        } else {
            el.setAttribute("hidden", "true");
            el.setAttribute("aria-hidden", "true");
        }
    });

    document.querySelectorAll("[data-student-only]").forEach((el) => {
        // Teachers should retain student-side access.
        el.removeAttribute("hidden");
        el.removeAttribute("aria-hidden");
    });

    if (!isTeacherPage || isTeacher) return;

    const lockedCard = document.querySelector("[data-student-only] p");
    if (lockedCard) {
        lockedCard.textContent = isApiLoggedIn()
            ? "Teacher-only area. Your account does not have teacher access."
            : "Please sign in with a teacher account to access this page.";
    }
};

const initAuthUX = () => {
    if (!hasApiAdapter()) return;

    const user = getApiUser();
    const isAuthenticated = isApiLoggedIn();
    const role = getApiUserRole();
    document.body.classList.toggle("is-authenticated", isAuthenticated);
    document.body.classList.toggle("is-role-teacher", isAuthenticated && role === "teacher");
    document.body.classList.toggle("is-role-student", isAuthenticated && role === "student");

    let modal = document.getElementById("authLoginModal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "authLoginModal";
        modal.className = "assessment-gate";
        modal.setAttribute("aria-hidden", "true");
        modal.innerHTML = `
          <div class="assessment-gate__backdrop" data-auth-close="true"></div>
          <div class="assessment-gate__dialog" role="dialog" aria-modal="true" aria-labelledby="authLoginTitle">
            <button type="button" class="assessment-gate__close" aria-label="Close login" data-auth-close="true">&times;</button>
            <h3 id="authLoginTitle">Sign in</h3>
            <p id="authLoginBody">Use your account credentials to load your saved progress.</p>
            <form id="authLoginForm" class="teacher-gate__form">
              <label for="authUsernameInput" class="teacher-gate__label">Username</label>
              <input id="authUsernameInput" class="teacher-gate__input" type="text" name="username" autocomplete="username" required />
              <label for="authPasswordInput" class="teacher-gate__label">Password</label>
              <input id="authPasswordInput" class="teacher-gate__input" type="password" name="password" autocomplete="current-password" required />
              <p id="authLoginError" class="teacher-gate__error" aria-live="polite"></p>
              <div class="assessment-gate__actions">
                <button type="submit" class="check-btn">Login</button>
              </div>
            </form>
          </div>
        `;
        document.body.appendChild(modal);
    }

    const closeModal = () => {
        modal.classList.remove("is-open");
        modal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("is-modal-open");
    };
    const openModal = () => {
        modal.classList.add("is-open");
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("is-modal-open");
        const usernameInput = document.getElementById("authUsernameInput");
        const errorEl = document.getElementById("authLoginError");
        if (errorEl) {
            errorEl.textContent = "";
            errorEl.classList.remove("is-visible");
        }
        if (usernameInput) window.setTimeout(() => usernameInput.focus(), 0);
    };

    modal.querySelectorAll("[data-auth-close='true']").forEach((el) => {
        el.onclick = closeModal;
    });

    const loginForm = document.getElementById("authLoginForm");
    if (loginForm && !loginForm.dataset.bound) {
        loginForm.dataset.bound = "true";
        loginForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            const usernameInput = document.getElementById("authUsernameInput");
            const passwordInput = document.getElementById("authPasswordInput");
            const errorEl = document.getElementById("authLoginError");
            const username = (usernameInput?.value || "").trim();
            const password = passwordInput?.value || "";
            if (!username || !password) return;

            try {
                await window.N5Api.login(username, password);
                closeModal();
                window.location.reload();
            } catch (err) {
                if (errorEl) {
                    errorEl.textContent = err?.message || "Login failed.";
                    errorEl.classList.add("is-visible");
                }
            }
        });
    }

    const navs = Array.from(document.querySelectorAll(".appbar-nav-actions"));
    navs.forEach((nav) => {
        nav.querySelectorAll("[data-auth-state], [data-auth-action], [data-auth-import], [data-teacher-lock]").forEach((el) => el.remove());
        nav.querySelectorAll('[data-teacher-nav="true"], a[href*="teacher.html"], a[href="/teacher/"]').forEach((el) => el.remove());

        let avatarWrap = nav.querySelector("[data-avatar-wrap]");
        if (!avatarWrap) {
            avatarWrap = document.createElement("div");
            avatarWrap.className = "appbar-avatar-wrap";
            avatarWrap.dataset.avatarWrap = "true";
            avatarWrap.innerHTML = `
              <button type="button" class="appbar-avatar-btn" data-avatar-toggle="true" aria-expanded="false" aria-label="Open account menu">
                <span class="appbar-avatar-initial" data-avatar-initial="true">G</span>
              </button>
              <div class="appbar-avatar-panel" data-avatar-menu="true" hidden>
                <p class="appbar-avatar-meta" data-avatar-meta="true"></p>
                <div class="appbar-avatar-actions" data-avatar-actions="true"></div>
              </div>
            `;
            nav.appendChild(avatarWrap);
        }

        const toggleBtn = avatarWrap.querySelector("[data-avatar-toggle='true']");
        const initialEl = avatarWrap.querySelector("[data-avatar-initial='true']");
        const metaEl = avatarWrap.querySelector("[data-avatar-meta='true']");
        const menuEl = avatarWrap.querySelector("[data-avatar-menu='true']");
        const actionsEl = avatarWrap.querySelector("[data-avatar-actions='true']");
        if (!toggleBtn || !initialEl || !metaEl || !menuEl || !actionsEl) return;

        const closeMenu = () => {
            avatarWrap.classList.remove("is-open");
            toggleBtn.setAttribute("aria-expanded", "false");
            menuEl.hidden = true;
        };

        const openMenu = () => {
            document.querySelectorAll(".appbar-avatar-wrap.is-open").forEach((wrap) => {
                if (wrap === avatarWrap) return;
                wrap.classList.remove("is-open");
                const openToggle = wrap.querySelector("[data-avatar-toggle='true']");
                const openMenuEl = wrap.querySelector("[data-avatar-menu='true']");
                if (openToggle) openToggle.setAttribute("aria-expanded", "false");
                if (openMenuEl) openMenuEl.hidden = true;
            });
            avatarWrap.classList.add("is-open");
            toggleBtn.setAttribute("aria-expanded", "true");
            menuEl.hidden = false;
        };

        if (!avatarWrap.dataset.bound) {
            avatarWrap.dataset.bound = "true";
            toggleBtn.addEventListener("click", () => {
                if (avatarWrap.classList.contains("is-open")) {
                    closeMenu();
                } else {
                    openMenu();
                }
            });

            document.addEventListener("click", (event) => {
                if (!avatarWrap.contains(event.target)) closeMenu();
            });

            document.addEventListener("keydown", (event) => {
                if (event.key === "Escape") closeMenu();
            });
        }

        actionsEl.innerHTML = "";
        const userInitial = isAuthenticated && user?.username
            ? user.username.trim().charAt(0).toUpperCase()
            : "G";
        initialEl.textContent = userInitial || "G";
        initialEl.classList.toggle("is-teacher", isAuthenticated && role === "teacher");
        metaEl.textContent = isAuthenticated && user
            ? `${user.username} (${role || "student"})`
            : "Guest account";

        if (isAuthenticated && user) {
            const alreadyImported = hasImportedLocalProgressForUser(user);
            if (role === "teacher") {
                const teacherLink = document.createElement("a");
                teacherLink.className = "appbar-nav-pill";
                teacherLink.href = getTeacherHref();
                teacherLink.textContent = "Teacher Mode";
                if (document.body.classList.contains("page-teacher")) {
                    teacherLink.classList.add("is-active");
                    teacherLink.setAttribute("aria-current", "page");
                }
                actionsEl.appendChild(teacherLink);
            }

            const signOutBtn = document.createElement("button");
            signOutBtn.type = "button";
            signOutBtn.className = "appbar-nav-pill";
            signOutBtn.textContent = "Sign out";
            signOutBtn.onclick = async () => {
                try {
                    await window.N5Api.logout();
                } catch {
                    // Force local unauth state regardless of transport issues.
                }
                writeTeacherModeSession(false);
                applyTeacherModeClasses(false);
                window.location.href = getHomeHref();
            };
            actionsEl.appendChild(signOutBtn);
        } else {
            const loginBtn = document.createElement("button");
            loginBtn.type = "button";
            loginBtn.className = "appbar-nav-pill";
            loginBtn.textContent = "Sign in";
            loginBtn.onclick = () => {
                closeMenu();
                openModal();
            };
            actionsEl.appendChild(loginBtn);
        }
    });
};

const initTeacherAccessNotice = () => {
    const params = new URLSearchParams(window.location.search);
    if (!isTruthyFlag(params.get("teacherDenied"))) return;

    const main = document.querySelector("main.content");
    if (!main) return;

    const notice = document.createElement("section");
    notice.className = "card teacher-access-notice";
    notice.innerHTML = `
      <h2>Teacher Mode Locked</h2>
      <p>Access denied. Sign in with a teacher account to access Teacher Mode.</p>
    `;
    main.prepend(notice);

    params.delete("teacherDenied");
    const nextQuery = params.toString();
    const cleanUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash || ""}`;
    window.history.replaceState(null, "", cleanUrl);
};

const initTeacherPasscodeGate = () => {
    const isDemoFallback = isTeacherDemoFallbackMode();
    if (hasApiAdapter() && !isDemoFallback) {
        const loggedIn = isApiLoggedIn();
        const role = getApiUserRole();
        if (loggedIn && role === "teacher") {
            writeTeacherModeSession(true);
            applyTeacherModeClasses(true);
            return;
        }
        // If account auth is available, require role-based account access rather than passcode.
        writeTeacherModeSession(false);
        applyTeacherModeClasses(false);
        return;
    }

    const allowPasscodeFallback = !hasApiAdapter() || isDemoFallback;
    if (!allowPasscodeFallback) {
        writeTeacherModeSession(false);
        applyTeacherModeClasses(false);
        return;
    }

    const modal = document.getElementById("teacherGate");
    const closeTriggers = modal
        ? Array.from(modal.querySelectorAll("[data-close-teacher-gate='true']"))
        : [];
    const form = document.getElementById("teacherGateForm");
    const input = document.getElementById("teacherPasscodeInput");
    const error = document.getElementById("teacherGateError");
    if (!modal || !form || !input || !error) return;

    const closeGate = () => {
        modal.classList.remove("is-open");
        modal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("is-modal-open");
    };

    const openGate = () => {
        modal.classList.add("is-open");
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("is-modal-open");
        error.textContent = "";
        error.classList.remove("is-visible");
        input.value = "";
        setTimeout(() => input.focus(), 0);
    };

    if (!readTeacherModeSession()) {
        openGate();
    } else {
        applyTeacherModeClasses(true);
    }

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        const attempt = (input.value || "").trim();
        if (attempt === TEACHER_MODE_PASSCODE) {
            writeTeacherModeSession(true);
            applyTeacherModeClasses(true);
            error.textContent = "";
            error.classList.remove("is-visible");
            closeGate();
            return;
        }
        writeTeacherModeSession(false);
        applyTeacherModeClasses(false);
        error.textContent = "Incorrect passcode. Try again.";
        error.classList.add("is-visible");
        input.select();
    });

    closeTriggers.forEach((trigger) => {
        trigger.addEventListener("click", () => {
            writeTeacherModeSession(false);
            applyTeacherModeClasses(false);
            window.location.replace(getTeacherDeniedHomeHref());
        });
    });

    document.querySelectorAll("[data-teacher-lock]").forEach((btn) => {
        btn.addEventListener("click", (event) => {
            event.preventDefault();
            writeTeacherModeSession(false);
            applyTeacherModeClasses(false);
            window.location.replace(getTeacherDeniedHomeHref());
        });
    });
};

const HINT_MODEL = {
    "example1.html": {
        fullCode: {
            l1: "Reveal each implementation step and connect it to subgoals A, B, C, and D.",
            l2: "Check the validation flow: input -> while check -> error -> retry -> final output.",
            l3: "Confirm each line is in the right stage of the process.",
            worked: "Correct sequence: receive input, validate in loop, show error, retry input, print accepted username."
        },
        tick1: {
            l1: "Consider the subgoals. How would you go about implementing Subgoal D?",
            l2: "Consider the subgoals. How would you go about implementing Subgoal D?",
            l3: "Consider the subgoals. How would you go about implementing Subgoal D?",
            worked: "The program needs a loop to repeatedly query the user until they provide a valid input."
        },
        tick2: {
            l1: "Consider when the loop should terminate.",
            l2: "Consider how many times the loop will need to run.",
            l3: "Can we know how many times the loop will need to run?",
            worked: "A while loop is required here, as we want to loop until a condition (valid input has been provided) is met."
        },
        tick3: {
            l1: "Write a condition that is true only when the username is invalid.",
            l2: "The rule says minimum length is 5, so invalid means below 5.",
            l3: "Use len(username) and compare against 5 with the correct operator.",
            worked: "Use len(username) < 5 to detect invalid input."
        },
        tick4: {
            l1: "What action helps the user correct invalid input?",
            l2: "Validation usually gives feedback, then asks again.",
            l3: "Do not accept invalid data and do not terminate immediately.",
            worked: "Show an error message and ask again until valid input is provided."
        },
        ex1SgATick: {
            l1: "Subgoal A is about taking input from the user.",
            l2: "Look for the line where username is assigned from input().",
            l3: "Choose the line that starts the process by receiving data.",
            worked: "username = input(\"Enter username: \") maps to Subgoal A."
        },
        ex1SgBTick: {
            l1: "Subgoal B checks validity conditions.",
            l2: "Find the line that evaluates username length in a loop condition.",
            l3: "The validation condition should use len(username) and 5.",
            worked: "while len(username) < 5: is the Subgoal B validation check."
        },
        ex1SgCTick: {
            l1: "The rule says minimum length is 5.",
            l2: "The blank is the threshold used in len(username) < ___.",
            l3: "Use the exact minimum allowed length.",
            worked: "Fill in 5."
        },
        ex1SgDTick: {
            l1: "Subgoal C is feedback for invalid input.",
            l2: "Find which subgoal matches the error-message line.",
            l3: "Classify by purpose: this line informs the user input is invalid.",
            worked: "The error message line belongs to Subgoal C."
        },
        ex1TraceTick: {
            l1: "sam has length 3, so it fails the minimum-length rule.",
            l2: "alex1 has length 5, so it passes validation.",
            l3: "One failed entry means exactly one retry is needed.",
            worked: "Trace answers: no, yes, 1."
        },
        ex1ModifyTick: {
            l1: "Build the flow in order: input -> validation loop -> error -> retry -> final output.",
            l2: "Keep error+retry inside the loop and final print after the loop.",
            l3: "Do not place the accepted-username print inside the validation loop.",
            worked: "Correct order: input, while invalid, print error, re-input, final success print."
        },
        makeOutputTick: {
            l1: "Compare formatting and values against expected output.",
            l2: "Check commas, spacing, and line order exactly.",
            l3: "For this activity, outputs should reflect 3 accepted scores after validation.",
            worked: "Match expected output exactly after running your program."
        }
    },
    "example2.html": {
        fullCode: {
            l1: "Reveal each implementation step and connect it to subgoals A, B, C, and D.",
            l2: "Check that setup appears before looping and output appears after updates.",
            l3: "Use the full solution block to verify line order and subgoal labels.",
            worked: "Correct flow: A setup -> D loop -> B input -> C update -> D output."
        },
        tick1: {
            l1: "Focus on the loop line. How many item entries are required?",
            l2: "Check the worked code: range(5) means the loop runs 5 times.",
            l3: "Your answer should be the count of loop repetitions, not the final total.",
            worked: "Because the program asks for 5 items, the loop repeats 5 times."
        },
        sgA2Tick: {
            l1: "Subgoal A covers setup/initialization.",
            l2: "Look for the line that creates the starting state.",
            l3: "total = 0 initializes the accumulator before looping.",
            worked: "The line total = 0 belongs to Subgoal A."
        },
        sgB2Tick: {
            l1: "Subgoal B is where a new value is read from the user.",
            l2: "Find the line with input conversion to float.",
            l3: "Choose the line that captures one price into a variable.",
            worked: "The matching line is price = float(input(\"Price: \"))."
        },
        sgC2Tick: {
            l1: "Subgoal C updates the running total each cycle.",
            l2: "The blank should be the current input variable.",
            l3: "Use the same name used when reading each price.",
            worked: "Fill the blank with price."
        },
        sgD2Tick: {
            l1: "Subgoal D controls repetition.",
            l2: "Look for the loop header that repeats a fixed number of times.",
            l3: "Choose the for counter in range(...) line.",
            worked: "The matching line is for counter in range(5):"
        },
        tick2Pred: {
            l1: "Decide whether repetition count is fixed or unknown.",
            l2: "The task always processes exactly 5 values.",
            l3: "Use the loop type that is best for a known number of repetitions.",
            worked: "A for loop is best here because the number of iterations is fixed."
        },
        tick3Pred: {
            l1: "Find the variable that keeps accumulating each new price.",
            l2: "It starts at 0 and is updated each cycle.",
            l3: "Look for the pattern total = total + ...",
            worked: "The running total variable is total."
        },
        tick4Pred: {
            l1: "Think about accumulator initialization before any additions happen.",
            l2: "A running total should start at the identity value for addition.",
            l3: "Starting with any non-zero value shifts every result.",
            worked: "Set total to 0 before entering the loop."
        },
        tick2: {
            l1: "Build the flow in order: setup, loop, input, update, output.",
            l2: "Use range(10) in the loop header, then keep input/update inside that loop.",
            l3: "print(total) should come after the loop, not inside it.",
            worked: "Correct order: total = 0 -> for counter in range(10): -> price input -> total update -> print(total)."
        },
        makeOutputTick: {
            l1: "Compare formatting and values against expected output.",
            l2: "Check spacing, commas, and line order exactly.",
            l3: "Ensure totals and average are calculated from the selected test case.",
            worked: "Match expected output exactly after running your program."
        }
    },
    "assessment.html": {
        tick1: { l1: "Look at the required item count.", l2: "The loop count matches the number of prices collected.", l3: "Use the exact numeric count.", worked: "The loop repeats 5 times." },
        tick2: { l1: "Which loop keeps checking until input is valid?", l2: "Validation usually repeats while a bad condition is true.", l3: "Negative-price checking uses while.", worked: "Use while for repeated validation." },
        tick3: { l1: "Find the variable that accumulates values.", l2: "It starts at zero and is updated each loop.", l3: "Look for total = total + ...", worked: "The running total variable is total." },
        tick4: { l1: "Should valid prices be kept for later traversal?", l2: "The program prints each value later, so it must store them.", l3: "The list is required for step D traversal.", worked: "Yes, valid prices should be stored in the list." },
        sgA1Tick: { l1: "This line creates starting state.", l2: "Subgoal A is initialization/setup.", l3: "total = 0 belongs to setup.", worked: "Answer: A." },
        sgB1Tick: { l1: "Subgoal B is the repeating loop.", l2: "Pick the line that repeats exactly 5 times.", l3: "Look for the for counter in range(5): line.", worked: "Correct line: for counter in range(5):" },
        sgC1Tick: { l1: "What gets added into total each cycle?", l2: "The blank is the current valid input value.", l3: "Use the same variable read from input.", worked: "Fill with price." },
        sgD1Tick: { l1: "This line traverses items for display.", l2: "Traversal/processing list values is subgoal D.", l3: "Map line purpose, not syntax shape.", worked: "Answer: D." },
        sgE1Tick: { l1: "Update total cumulatively row by row.", l2: "Start from 0, then add each new input.", l3: "Totals should be 2, then 5, then 9.", worked: "Running totals: 2, 5, 9." },
        assessmentFeedback: { l1: "Order by problem flow: setup -> input loop -> validate -> store/update -> output.", l2: "Ensure validation (while) sits inside the main loop.", l3: "Average is calculated after data collection and before final prints.", worked: "Use the sequence shown in the expected arrangement for each stage." },
        makeOutputTick: { l1: "Compare formatting and values against expected output.", l2: "Check spacing, commas, and order of lines.", l3: "Ensure totals/averages are computed from the chosen test case.", worked: "Match expected output exactly after running your program." }
    }
};

const FEEDBACK_MAP = {
    "example1.html": {
        fullCode: {
            correct: "Correct. You completed the full step-by-step validation flow.",
            incorrect: "Try again.",
            misconception: "You may be skipping part of the looped validation cycle.",
            next: "Walk through each stage in order, then reveal the full solution."
        },
        tick1: {
            correct: "Correct. A loop is required because the user may need multiple attempts before entering a valid username.",
            incorrect: "Not quite right yet.",
            misconception: "A common mix-up is assuming one input attempt is always enough.",
            next: "Think about Subgoal D: the process repeats until the username meets the rule."
        },
        tick2: {
            correct: "Correct. while is the best fit because retries continue until the input becomes valid.",
            incorrect: "That loop choice is not best here.",
            misconception: "A for loop is for a fixed count, but validation retries are not a fixed number.",
            next: "Choose the loop that keeps running while len(username) < 5 is true."
        },
        tick3: {
            correct: "Correct. len(username) < 5 is the exact invalid condition for this rule.",
            incorrect: "Close, but that condition does not match the validation rule exactly.",
            misconception: "Common mix-ups are reversing the operator (>) or trying to compare the whole username directly to a number.",
            next: "Use the minimum-length rule directly: invalid means length is less than 5."
        },
        tick4: {
            correct: "Correct. The program should display feedback and prompt again until the username is valid.",
            incorrect: "That behavior breaks the validation flow.",
            misconception: "If you accept invalid input or terminate immediately, the user never gets a proper retry cycle.",
            next: "Pick the action that keeps the loop active until a valid username is entered."
        },
        ex1SgATick: {
            correct: "Correct subgoal mapping.",
            incorrect: "That subgoal mapping is off.",
            misconception: "A common mix-up is mapping by line position rather than purpose.",
            next: "Pick the line that receives data from input()."
        },
        ex1SgBTick: {
            correct: "Correct line selection for Subgoal B.",
            incorrect: "That is not the validation line.",
            misconception: "You may be selecting input/output lines instead of the condition check.",
            next: "Choose the line that checks length with len(username) < 5."
        },
        ex1SgCTick: {
            correct: "Correct. 5 is the minimum valid length.",
            incorrect: "Not quite right.",
            misconception: "You may be mixing up valid threshold with an example username length.",
            next: "Use the exact rule threshold in len(username) < ___."
        },
        ex1SgDTick: {
            correct: "Correct. The error message line maps to Subgoal C.",
            incorrect: "That subgoal is not the best match.",
            misconception: "You may be confusing repetition behavior with feedback behavior.",
            next: "Identify the subgoal focused on telling the user their input is invalid."
        },
        ex1TraceTick: {
            correct: "Correct trace. You followed the validation cycle accurately.",
            incorrect: "Trace values are off.",
            misconception: "You may be treating a short username as valid or miscounting retries.",
            next: "Re-check each input against the minimum length of 5."
        },
        ex1ModifyTick: {
            correct: "Correct. The modified validation program logic is in the right order.",
            incorrect: "Try again.",
            misconception: "A common issue is placing the final print inside the loop or moving retry outside it.",
            next: "Rebuild as input -> while invalid -> error -> retry -> final accepted output.",
            alwaysShowMisconception: true
        },
        makeOutputTick: {
            correct: "Output matches expected values and formatting.",
            incorrect: "Output does not match expected yet.",
            misconception: "Likely formatting mismatch, wrong accepted-score set, or incorrect total/average.",
            next: "Compare output line-by-line and ensure only valid scores are included."
        }
    },
    "example2.html": {
        fullCode: {
            correct: "Correct. You completed the full step-by-step implementation flow.",
            incorrect: "Try again.",
            misconception: "You may be skipping a stage or placing output before all updates are complete.",
            next: "Follow the order shown in the worked steps and then reveal the full solution."
        },
        tick1: {
            correct: "Good prediction. You matched the fixed loop count.",
            incorrect: "Not quite yet.",
            misconception: "You may be mixing up number of loop runs with the final total value.",
            next: "Re-check the loop header and count how many item entries are required."
        },
        sgA2Tick: {
            correct: "Correct subgoal mapping.",
            incorrect: "That subgoal mapping is off.",
            misconception: "A common mix-up is mapping by line position rather than line purpose.",
            next: "Ask what the line does first: setup, repetition, process, or output."
        },
        sgB2Tick: {
            correct: "Correct line selection for Subgoal B.",
            incorrect: "That line is not the input stage.",
            misconception: "A common mix-up is choosing setup or processing lines instead of the value-entry line.",
            next: "Pick the line that reads price from the user."
        },
        sgC2Tick: {
            correct: "Correct. That completes the running-total update.",
            incorrect: "Not quite right.",
            misconception: "You may be trying to add the accumulator to itself or using a different variable name.",
            next: "Use the current input value variable in total = total + ___."
        },
        sgD2Tick: {
            correct: "Correct line selection for the repetition subgoal.",
            incorrect: "That line does not represent the repetition stage.",
            misconception: "You may be selecting setup or output code instead of the loop header.",
            next: "Choose the line that controls repeated execution."
        },
        tick2Pred: {
            correct: "Correct. A for loop is the strongest fit for a known number of repeats.",
            incorrect: "That choice does not match this fixed-count problem.",
            misconception: "A while loop is better when repetitions depend on a changing condition rather than a known count.",
            next: "Use the loop type that clearly expresses exactly 5 iterations."
        },
        tick3Pred: {
            correct: "Correct. total is the accumulator for the running sum.",
            incorrect: "Not quite right.",
            misconception: "You may be selecting the current input variable instead of the accumulator variable.",
            next: "Find the variable initialized once and updated on each pass."
        },
        tick4Pred: {
            correct: "Correct. The accumulator should start at 0.",
            incorrect: "That initial value would skew the final total.",
            misconception: "Starting the total at a non-zero value adds an offset to every result.",
            next: "Initialize total to the neutral value for addition before the loop."
        },
        tick2: {
            correct: "Correct. The modified 10-item program logic is in the right order.",
            incorrect: "Try again.",
            misconception: "A common issue is placing print(total) inside the loop or moving setup below the loop.",
            next: "Rebuild as setup -> loop(10) -> input -> update total -> final output.",
            alwaysShowMisconception: true
        },
        makeOutputTick: {
            correct: "Output matches expected values and formatting.",
            incorrect: "Output does not match expected yet.",
            misconception: "Likely formatting mismatch, wrong total/average formula, or missing lines.",
            next: "Compare your output line-by-line with expected output and rerun."
        }
    },
    "assessment.html": {
        tick1: { correct: "Correct. The loop count matches the number of required inputs.", incorrect: "Not correct yet.", misconception: "You may be counting outputs instead of input iterations.", next: "Use the problem statement to confirm how many prices are entered." },
        tick2: { correct: "Correct. while is appropriate for repeated validation.", incorrect: "That loop choice is not best here.", misconception: "You may be choosing for when the number of retries is unknown.", next: "Pick the loop that repeats until input is valid." },
        tick3: { correct: "Correct. You identified the accumulator variable.", incorrect: "Not quite.", misconception: "You may be naming the list variable instead of the running total variable.", next: "Find the variable initialized to 0 and updated each iteration." },
        tick4: { correct: "Correct. Valid values should be stored for traversal later.", incorrect: "Not correct yet.", misconception: "You may think total alone is enough, but printing each item requires stored values.", next: "Check the later step that loops through items." },
        sgA1Tick: { correct: "Correct subgoal mapping.", incorrect: "That subgoal mapping is off.", misconception: "You may be mapping by line position rather than line purpose.", next: "Classify the line by what it does: setup, loop, process, traverse, output." },
        sgB1Tick: { correct: "Correct line selection for Subgoal B.", incorrect: "Wrong line selected.", misconception: "You may be selecting an update line instead of the repetition line.", next: "Find the line that controls repeated execution." },
        sgC1Tick: { correct: "Correct fill-in value.", incorrect: "That value is not right yet.", misconception: "You may be using the total variable on both sides instead of adding the current input.", next: "Use the current validated price variable." },
        sgD1Tick: { correct: "Correct. Traversal belongs to subgoal D.", incorrect: "Not quite right.", misconception: "You may be matching on syntax shape rather than traversal purpose.", next: "Identify which subgoal is about iterating through stored items." },
        sgE1Tick: { correct: "Correct trace values.", incorrect: "Trace values are off.", misconception: "You may be restarting total each row instead of carrying it forward.", next: "Add each new input to the previous running total step by step." },
        assessmentFeedback: { correct: "Excellent. The full logic order is correct.", incorrect: "The program order is still incorrect.", misconception: "A common issue is putting validation/output at the wrong stage of the flow.", next: "Rebuild from pipeline order: setup -> input loop -> validate -> store/update -> compute -> output." },
        makeOutputTick: { correct: "Output matches expected values and formatting.", incorrect: "Output does not match expected yet.", misconception: "Likely formatting mismatch, wrong total/average formula, or missing lines.", next: "Compare your output line-by-line with expected output and rerun." }
    }
};

let hintState = { checkpoints: {} };
let hintPanels = [];

const getSectionRequiredIds = (section) => {
    if (!section) return [];
    const requires = section.dataset.requires || "";
    return requires.split(",").map((id) => id.trim()).filter(Boolean);
};

const readHintState = () => {
    const raw = readStorage(getHintStorageKey());
    if (!raw) return { checkpoints: {} };
    try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && parsed.checkpoints && typeof parsed.checkpoints === "object") {
            return parsed;
        }
    } catch {
        // Ignore parse errors and return default state.
    }
    return { checkpoints: {} };
};

const saveHintState = () => {
    writeStorage(getHintStorageKey(), JSON.stringify(hintState));
};

const getHintBucket = (checkpointId) => {
    if (!hintState.checkpoints[checkpointId]) {
        hintState.checkpoints[checkpointId] = {
            attempts: 0,
            shownLevel: 0,
            showCount: 0,
            revealCount: 0,
            revealedWorked: false,
            lastUsedAt: 0
        };
    }
    return hintState.checkpoints[checkpointId];
};

const getCheckpointHints = (checkpointId, section) => {
    const byPage = HINT_MODEL[ACTIVITY_PAGE_NAME] || {};
    if (byPage[checkpointId]) return byPage[checkpointId];
    const sectionTitle = (section?.querySelector("h2")?.textContent || "this step").trim();
    return {
        l1: `Break ${sectionTitle} into one small check at a time.`,
        l2: "Compare your answer against the worked code and focus on variable/loop purpose.",
        l3: "Trace one concrete example input slowly and verify each intermediate value.",
        worked: "Use the worked example structure: initialize -> loop/validate -> process -> output."
    };
};

const getFeedbackEntry = (checkpointId) => {
    const byPage = FEEDBACK_MAP[ACTIVITY_PAGE_NAME] || {};
    return byPage[checkpointId] || null;
};

const buildTargetedFeedback = (checkpointId, correct, fallbackMessage) => {
    const entry = getFeedbackEntry(checkpointId);
    const attemptCount = Number(hintState?.checkpoints?.[checkpointId]?.attempts || 0);
    if (!entry) {
        return correct
            ? `${fallbackMessage || "Correct."}\nNext: continue to the next checkpoint.`
            : `${fallbackMessage || "Try again."}\nNext: compare your answer with the worked example.`;
    }
    if (correct) {
        return `${entry.correct}\nNext: continue to the next checkpoint.`;
    }
    const lines = [entry.incorrect];
    if (entry.misconception && (attemptCount >= 2 || entry.alwaysShowMisconception === true)) {
        lines.push(`Possible mix-up: ${entry.misconception}`);
    }
    lines.push(`Next: ${entry.next}`);
    return lines.join("\n");
};

const getOrCreateRichFeedbackEl = (anchorEl, checkpointId) => {
    const host = anchorEl?.closest(".question-block") || anchorEl?.parentElement || anchorEl?.closest(".card");
    if (!host) return null;
    let el = host.querySelector(`.rich-feedback[data-feedback-for="${checkpointId}"]`);
    if (!el) {
        el = document.createElement("p");
        el.className = "rich-feedback";
        el.dataset.feedbackFor = checkpointId;
        el.setAttribute("role", "status");
        el.setAttribute("aria-live", "polite");
        host.appendChild(el);
    }
    return el;
};

const renderRichFeedback = (anchorEl, checkpointId, correct, fallbackMessage) => {
    if (!checkpointId) return;
    const feedbackEl = getOrCreateRichFeedbackEl(anchorEl, checkpointId);
    if (!feedbackEl) return;
    feedbackEl.textContent = buildTargetedFeedback(checkpointId, correct, fallbackMessage);
    feedbackEl.classList.toggle("is-correct", !!correct);
    feedbackEl.classList.toggle("is-incorrect", !correct);
};

const getActiveCheckpointId = (section) => {
    const ids = getSectionRequiredIds(section);
    if (!ids.length) return null;
    const firstIncomplete = ids.find((id) => {
        const el = document.getElementById(id);
        return !(el && el.dataset.correct === "true");
    });
    return firstIncomplete || ids[0];
};

const renderHintPanel = (panelData) => {
    const { section, metaEl, hintEl, showBtn, revealBtn } = panelData;
    const checkpointId = getActiveCheckpointId(section);
    if (!checkpointId) {
        panelData.root.classList.add("is-hidden");
        return;
    }

    panelData.root.classList.remove("is-hidden");
    const bucket = getHintBucket(checkpointId);
    const hints = getCheckpointHints(checkpointId, section);
    const unlockedLevel = Math.min(3, bucket.attempts);
    const displayedLevel = Math.min(3, Math.max(0, bucket.shownLevel));

    metaEl.textContent = unlockedLevel > 0
        ? `Attempts: ${bucket.attempts} • Unlocked: Level ${unlockedLevel}`
        : `Attempts: ${bucket.attempts} • Complete one failed attempt to unlock hints`;

    if (displayedLevel > 0) {
        hintEl.innerHTML = `<p><strong>Hint Level ${displayedLevel}:</strong> ${hints[`l${displayedLevel}`]}</p>`;
        if (bucket.revealedWorked) {
            hintEl.innerHTML += `<p class="hint-panel__worked"><strong>Worked hint:</strong> ${hints.worked}</p>`;
        }
    } else {
        hintEl.innerHTML = "<p>Need a nudge? Use Show hint to reveal a guided clue.</p>";
    }

    if (displayedLevel >= 3) {
        showBtn.textContent = "All hint levels used";
    } else {
        showBtn.textContent = displayedLevel > 0 ? "Show stronger hint" : "Show hint";
    }
    showBtn.disabled = unlockedLevel === 0 || displayedLevel >= 3;
    if (bucket.revealedWorked) {
        revealBtn.textContent = "Worked hint revealed";
    } else {
        revealBtn.textContent = "Reveal worked hint";
    }
    revealBtn.disabled = displayedLevel < 2 || bucket.revealedWorked;
};

const syncAdaptiveHintsUI = () => {
    hintPanels.forEach((panelData) => renderHintPanel(panelData));
};

const updateHintCheckpointResult = (checkpointId, correct) => {
    if (!checkpointId) return;
    const bucket = getHintBucket(checkpointId);
    if (!correct) {
        bucket.attempts += 1;
    }
    bucket.lastUsedAt = Date.now();
    saveHintState();
    syncHintCheckpointToApi(checkpointId, bucket);
    syncAdaptiveHintsUI();
};

const initAdaptiveHints = () => {
    if (!document.querySelector(".step-section[data-requires]")) return;

    hintState = readHintState();
    hintPanels = [];

    const sections = Array.from(document.querySelectorAll(".step-section[data-requires]"));
    sections.forEach((section) => {
        const panel = document.createElement("div");
        panel.className = "hint-panel";
        panel.innerHTML = `
          <div class="hint-panel__head">
            <p class="hint-panel__title">Adaptive hints</p>
            <p class="hint-panel__meta"></p>
          </div>
          <div class="hint-panel__body"></div>
          <div class="hint-panel__actions">
            <button type="button" class="check-btn hint-panel__btn-show">Show hint</button>
            <button type="button" class="check-btn hint-panel__btn-reveal">Reveal worked hint</button>
          </div>
        `;
        section.appendChild(panel);

        const panelData = {
            root: panel,
            section,
            metaEl: panel.querySelector(".hint-panel__meta"),
            hintEl: panel.querySelector(".hint-panel__body"),
            showBtn: panel.querySelector(".hint-panel__btn-show"),
            revealBtn: panel.querySelector(".hint-panel__btn-reveal")
        };

        panelData.showBtn.addEventListener("click", () => {
            const checkpointId = getActiveCheckpointId(section);
            if (!checkpointId) return;
            const bucket = getHintBucket(checkpointId);
            const unlockedLevel = Math.min(3, bucket.attempts);
            if (unlockedLevel === 0) return;
            if (bucket.shownLevel >= 3) return;
            const nextLevel = bucket.shownLevel < unlockedLevel
                ? bucket.shownLevel + 1
                : Math.min(3, Math.max(1, bucket.shownLevel));
            bucket.shownLevel = nextLevel;
            bucket.showCount += 1;
            bucket.lastUsedAt = Date.now();
            saveHintState();
            syncHintCheckpointToApi(checkpointId, bucket);
            syncAdaptiveHintsUI();
        });

        panelData.revealBtn.addEventListener("click", () => {
            const checkpointId = getActiveCheckpointId(section);
            if (!checkpointId) return;
            const bucket = getHintBucket(checkpointId);
            if (bucket.shownLevel < 2) return;
            if (bucket.revealedWorked) return;
            bucket.revealedWorked = true;
            bucket.revealCount += 1;
            bucket.lastUsedAt = Date.now();
            saveHintState();
            syncHintCheckpointToApi(checkpointId, bucket);
            syncAdaptiveHintsUI();
        });

        hintPanels.push(panelData);
    });

    syncAdaptiveHintsUI();
};

const saveStepperState = () => {
    if (!stepperState.sections.length) return;
    const completedChecks = [];
    document.querySelectorAll("[data-correct='true']").forEach((el) => {
        if (el.id) completedChecks.push(el.id);
    });

    const inputs = {};
    document.querySelectorAll("input[id], select[id], textarea[id]").forEach((field) => {
        const type = (field.getAttribute("type") || "").toLowerCase();
        if (type === "radio" || type === "checkbox") {
            inputs[field.id] = field.checked ? "__checked__" : "";
        } else {
            inputs[field.id] = field.value;
        }
    });

    const programEl = document.getElementById("makeProgram");
    const caseSelect = document.getElementById("makeCase");
    const actualEl = document.getElementById("makeActual");

    const payload = {
        path: window.location.pathname,
        stepCount: stepperState.sections.length,
        index: stepperState.index,
        isComplete: !!stepperState.completed,
        updatedAt: Date.now(),
        completedChecks,
        inputs,
        makeProgram: programEl ? programEl.value : "",
        makeCase: caseSelect ? caseSelect.value : "case1",
        makeActual: actualEl ? actualEl.textContent : "",
        showWorkedExample: stepperState.showWorkedExample
    };

    writeStorage(getStorageKey(), JSON.stringify(payload));
    syncProgressPayloadToApi(payload);
};

const loadStepperState = () => {
    const raw = readStorage(getStorageKey());
    if (!raw) return false;
    let payload = null;
    try {
        payload = JSON.parse(raw);
    } catch {
        removeStorage(getStorageKey());
        return false;
    }
    if (!payload) return false;
    if (payload.path && payload.path !== window.location.pathname) return false;
    if (typeof payload.stepCount === "number" && payload.stepCount !== stepperState.sections.length) {
        removeStorage(getStorageKey());
        return false;
    }

    const completedChecks = Array.isArray(payload.completedChecks)
        ? payload.completedChecks
        : (Array.isArray(payload.completed) ? payload.completed : []);

    if (completedChecks.length) {
        completedChecks.forEach((id) => {
            const el = document.getElementById(id);
            if (el) {
                el.dataset.correct = "true";
                if (el.classList.contains("tick-mark")) {
                    el.style.display = "inline";
                    el.textContent = "Correct";
                    el.classList.remove("is-incorrect");
                    el.classList.add("is-correct");
                }
            }
        });
    }

    if (payload.inputs && typeof payload.inputs === "object") {
        Object.entries(payload.inputs).forEach(([id, value]) => {
            const input = document.getElementById(id);
            if (!input) return;
            const type = (input.getAttribute("type") || "").toLowerCase();
            if (type === "radio" || type === "checkbox") {
                input.checked = value === "__checked__" || value === true;
            } else {
                input.value = value;
            }
        });
    }

    if (payload.showWorkedExample) {
        stepperState.showWorkedExample = true;
    }

    const programEl = document.getElementById("makeProgram");
    const caseSelect = document.getElementById("makeCase");
    const actualEl = document.getElementById("makeActual");

    if (programEl && typeof payload.makeProgram === "string") {
        programEl.value = payload.makeProgram;
    }
    if (caseSelect && payload.makeCase) {
        caseSelect.value = payload.makeCase;
        updateExpectedOutput();
    }
    if (actualEl && typeof payload.makeActual === "string") {
        actualEl.textContent = payload.makeActual;
    }

    if (typeof payload.index === "number") {
        const restoredIndex = Math.min(payload.index, stepperState.sections.length - 1);
        showStepSection(restoredIndex, { save: false });
        if (payload.isComplete === true || payload.completed === true) {
            showCompletionView({ scroll: false, save: false });
        }
        return true;
    }
    return false;
};

const setTickState = (tick, correct, checkpointId = null) => {
    if (!tick) return;
    const effectiveCheckpointId = checkpointId || tick.id;
    tick.dataset.correct = correct ? "true" : "false";
    tick.style.display = "inline";
    tick.classList.remove("is-correct", "is-incorrect");
    tick.classList.add(correct ? "is-correct" : "is-incorrect");
    tick.textContent = correct ? "Correct" : "Try again";
    updateHintCheckpointResult(effectiveCheckpointId, correct);
    renderRichFeedback(tick, effectiveCheckpointId, correct, correct ? "Correct." : "Try again.");
    syncCheckpointResultToApi(effectiveCheckpointId, correct);
    updateStepperState();
    saveStepperState();
};

const setFeedbackState = (el, correct, message, checkpointId = null) => {
    if (!el) return;
    const effectiveCheckpointId = checkpointId || el.id;
    updateHintCheckpointResult(effectiveCheckpointId, correct);
    el.classList.add("result-feedback");
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.dataset.correct = correct ? "true" : "false";

    const status = document.createElement("span");
    status.className = `tick-mark ${correct ? "is-correct" : "is-incorrect"}`;
    status.style.display = "inline-flex";
    status.textContent = correct ? "Correct" : "Try again";
    status.style.fontSize = "0.86rem";
    status.style.lineHeight = "1.35";

    const statusRow = document.createElement("div");
    statusRow.style.display = "flex";
    statusRow.style.alignItems = "center";
    statusRow.style.gap = "8px";
    statusRow.appendChild(status);

    const detail = document.createElement("div");
    detail.textContent = buildTargetedFeedback(effectiveCheckpointId, correct, message);
    detail.style.whiteSpace = "pre-line";
    detail.style.marginTop = "4px";
    detail.style.fontSize = "0.86rem";
    detail.style.lineHeight = "1.35";

    el.replaceChildren(statusRow, detail);
    el.style.color = correct ? "var(--success-600)" : "#a24f58";
    el.style.fontSize = "0.86rem";
    el.style.fontWeight = "600";
    el.style.lineHeight = "1.35";
    syncCheckpointResultToApi(effectiveCheckpointId, correct);
    updateStepperState();
    saveStepperState();
};

const checkAnswer = (inputId, correctAnswer, tickId) => {
    const inputField = document.getElementById(inputId);
    const userInput = inputField.value.trim().toLowerCase();
    const tick = document.getElementById(tickId);
    
    const cleanCorrect = correctAnswer.toLowerCase().replace(/\s/g, '');
    const cleanUser = userInput.replace(/\s/g, '');

    setTickState(tick, cleanUser === cleanCorrect, tickId);
};

const checkRadioButton = (inputId, tickId) => {
    const inputField = document.getElementById(inputId);
    const tick = document.getElementById(tickId);

    setTickState(tick, inputField.checked);
};

const initExample1PredictionDependency = () => {
    const q1Yes = document.getElementById("tick1-yes");
    const q1No = document.getElementById("tick1-no");
    const q2None = document.getElementById("tick2-none");
    const q2Block = document.getElementById("example1-loop-type-question");
    const q2CheckBtn = document.getElementById("tick2-check-btn");

    if (!q1Yes || !q1No || !q2None || !q2Block || !q2CheckBtn) return;

    const q2Inputs = Array.from(q2Block.querySelectorAll("input[type='radio'][name='tick2']"));

    const clearTick2State = () => {
        const tick2 = document.getElementById("tick2");
        if (!tick2) return;
        delete tick2.dataset.correct;
        tick2.style.display = "none";
        tick2.classList.remove("is-correct", "is-incorrect");
        tick2.textContent = "";

        const rich = q2Block.querySelector('.rich-feedback[data-feedback-for="tick2"]');
        if (rich) rich.remove();
    };

    const applyDependency = () => {
        const disableQ2 = q1No.checked;

        if (disableQ2) {
            q2None.checked = true;
            clearTick2State();
        }

        q2Inputs.forEach((input) => {
            input.disabled = disableQ2;
        });
        q2CheckBtn.disabled = disableQ2;

        updateStepperState();
        saveStepperState();
    };

    if (!q1Yes.dataset.dependencyInit) {
        q1Yes.addEventListener("change", applyDependency);
        q1No.addEventListener("change", applyDependency);
        q1Yes.dataset.dependencyInit = "true";
    }
    applyDependency();
};

function allowDrop(ev) {
    ev.preventDefault();
}

function drag(ev) {
    ev.dataTransfer.setData("text", ev.target.id);
    ev.target.classList.add("dragging");
    ev.target.addEventListener("dragend", () => {
        ev.target.classList.remove("dragging");
    }, { once: true });
}

function drop(ev) {
    ev.preventDefault();
    const data = ev.dataTransfer.getData("text");
    const draggedElement = document.getElementById(data);
    const dropTarget = ev.target.closest('.parsons-container');

    if (dropTarget && draggedElement) {
        const afterElement = getDragAfterElement(dropTarget, ev.clientY);
        if (afterElement == null) {
            dropTarget.appendChild(draggedElement);
        } else {
            dropTarget.insertBefore(draggedElement, afterElement);
        }
    }
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.draggable:not(.dragging)')];

    return draggableElements.reduce(
        (closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            }
            return closest;
        },
        { offset: Number.NEGATIVE_INFINITY, element: null }
    ).element;
}

const verifyParsons = (containerId, correctIds, feedbackId) => {
    const container = document.getElementById(containerId);
    const feedback = document.getElementById(feedbackId);
    
    if (!container || !feedback) {
        console.error("Missing container or feedback element");
        return;
    }

    const items = container.getElementsByClassName('draggable');
    let isCorrect = true;

    if (items.length !== correctIds.length) {
        isCorrect = false;
    } else {
        for (let i = 0; i < correctIds.length; i++) {
            if (items[i].id !== correctIds[i]) {
                isCorrect = false;
                break;
            }
        }
    }

    if (isCorrect) {
        setFeedbackState(feedback, true, "Excellent! The logic is in the correct order.", feedbackId);
    } else {
        setFeedbackState(feedback, false, "Try again. Think: Initialize -> Loop -> Process -> Output.", feedbackId);
    }
};

const setChoice = (groupId, value, buttonEl) => {
    const container = document.querySelector(`[data-choice-group="${groupId}"]`);
    if (!container) return;
    container.dataset.selected = value;
    const buttons = container.querySelectorAll(".mc-buttons button");
    buttons.forEach((btn) => btn.classList.remove("selected"));
    if (buttonEl) buttonEl.classList.add("selected");
};

const checkChoice = (groupId, correctValue, tickId) => {
    const container = document.querySelector(`[data-choice-group="${groupId}"]`);
    if (!container) return;
    const selected = (container.dataset.selected || "").trim().toLowerCase();
    const correct = correctValue.trim().toLowerCase();
    const tick = document.getElementById(tickId);
    setTickState(tick, selected === correct, tickId);
};

const selectLine = (groupId, value, buttonEl) => {
    const container = document.querySelector(`[data-line-group="${groupId}"]`);
    if (!container) return;
    container.dataset.selected = value;
    const lines = container.querySelectorAll(".code-line");
    lines.forEach((btn) => btn.classList.remove("selected"));
    if (buttonEl) buttonEl.classList.add("selected");
};

const checkLineChoice = (groupId, correctValue, tickId) => {
    const container = document.querySelector(`[data-line-group="${groupId}"]`);
    if (!container) return;
    const selected = (container.dataset.selected || "").replace(/\s/g, "").toLowerCase();
    const correct = correctValue.replace(/\s/g, "").toLowerCase();
    const tick = document.getElementById(tickId);
    setTickState(tick, selected === correct, tickId);
};

const checkTrace = (inputIds, expectedValues, tickId) => {
    const tick = document.getElementById(tickId);
    const isCorrect = inputIds.every((id, idx) => {
        const el = document.getElementById(id);
        if (!el) return false;
        return el.value.trim() === expectedValues[idx];
    });

    setTickState(tick, isCorrect, tickId);
};

const normalizeOutput = (text) => {
    return text
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/,\s*/g, ",");
};

const checkOutput = (caseSelectId, outputId, tickId) => {
    const caseSelect = document.getElementById(caseSelectId);
    const outputEl = document.getElementById(outputId);
    const tick = document.getElementById(tickId);

    if (!caseSelect || !outputEl || !tick) return;

    const expectedOutputs = getMakeExpectedOutputs();

    const selectedCase = caseSelect.value;
    const expected = expectedOutputs[selectedCase] || "";
    const userOutput = outputEl.value;

    setTickState(tick, normalizeOutput(userOutput) === normalizeOutput(expected), tickId);
};

const updateExpectedOutput = () => {
    const caseSelect = document.getElementById("makeCase");
    const expectedEl = document.getElementById("makeExpected");
    if (!caseSelect || !expectedEl) return;

    const expectedOutputs = getMakeExpectedOutputs();

    expectedEl.textContent = expectedOutputs[caseSelect.value] || "";
};

const checkActualOutput = (caseSelectId, actualOutputId, tickId) => {
    const caseSelect = document.getElementById(caseSelectId);
    const actualEl = document.getElementById(actualOutputId);
    const tick = document.getElementById(tickId);
    if (!caseSelect || !actualEl || !tick) return;

    const expectedOutputs = getMakeExpectedOutputs();

    const expected = expectedOutputs[caseSelect.value] || "";
    const actual = actualEl.textContent || "";

    setTickState(tick, normalizeOutput(actual) === normalizeOutput(expected), tickId);
};

const markComplete = (tickId) => {
    const tick = document.getElementById(tickId);
    if (!tick) return;
    tick.dataset.correct = "true";
    tick.style.display = "inline";
    tick.classList.remove("is-incorrect");
    tick.classList.add("is-correct");
    tick.textContent = "Correct";
    updateHintCheckpointResult(tickId, true);
    updateStepperState();
    saveStepperState();
};

const isStepComplete = (section) => {
    if (!section) return false;
    const requires = section.dataset.requires;
    if (!requires) return true;
    const ids = requires.split(",").map((id) => id.trim()).filter(Boolean);
    if (!ids.length) return true;
    return ids.every((id) => {
        const el = document.getElementById(id);
        return el && el.dataset.correct === "true";
    });
};

const getIncompleteRequirementCount = (section) => {
    if (!section) return 0;
    const requires = section.dataset.requires;
    if (!requires) return 0;
    const ids = requires.split(",").map((id) => id.trim()).filter(Boolean);
    if (!ids.length) return 0;
    return ids.filter((id) => {
        const el = document.getElementById(id);
        return !(el && el.dataset.correct === "true");
    }).length;
};

const updateStepperState = () => {
    const current = stepperState.sections[stepperState.index];
    const nextBtn = document.getElementById("stepNext");
    const note = document.getElementById("stepperNote");
    if (!current || !nextBtn || !note) return;
    const complete = isStepComplete(current);
    const remaining = getIncompleteRequirementCount(current);
    nextBtn.disabled = !complete;
    nextBtn.setAttribute("aria-disabled", String(!complete));
    if (complete) {
        note.textContent = "Ready to continue.";
    } else if (remaining > 0) {
        note.textContent = `Complete ${remaining} required check${remaining === 1 ? "" : "s"} to continue.`;
    } else {
        note.textContent = "Complete the activity to continue.";
    }
    note.classList.toggle("is-ready", complete);
    note.classList.toggle("is-pending", !complete);

    if (stepperState.showWorkedExample) {
        const example = document.getElementById("workedExample");
        if (example) {
            example.classList.remove("hidden");
        }
    }
};

const showStep = (index) => {
    const completion = document.getElementById("completionScreen");
    if (completion) completion.classList.remove("is-visible");
    document.body.classList.remove("is-complete");
    stepperState.completed = false;
};

const showCompletionView = ({ scroll = false, save = true } = {}) => {
    const completion = document.getElementById("completionScreen");
    if (completion) completion.classList.add("is-visible");
    document.body.classList.add("is-complete");
    stepperState.completed = true;
    if (scroll) {
        const completionCard = document.querySelector("#completionScreen .completion-card");
        if (completionCard) completionCard.scrollIntoView({ behavior: "smooth" });
    }
    if (save) saveStepperState();
    syncAdaptiveHintsUI();
};

const showStepSection = (index, { save = true } = {}) => {
    stepperState.sections.forEach((section, i) => {
        section.classList.toggle("active", i === index);
    });
    stepperState.index = index;

    const progress = document.getElementById("stepperProgress");
    const prevBtn = document.getElementById("stepPrev");
    const nextBtn = document.getElementById("stepNext");
    const barFill = document.getElementById("stepperBarFill");
    showStep(index);
    if (progress) {
        progress.textContent = `Step ${index + 1} of ${stepperState.sections.length}`;
    }
    if (prevBtn) prevBtn.disabled = index === 0;
    if (nextBtn) nextBtn.textContent = index === stepperState.sections.length - 1 ? "Finish" : "Next";
    if (barFill) {
        const pct = ((index + 1) / stepperState.sections.length) * 100;
        barFill.style.width = `${pct}%`;
    }
    updateStepperState();
    if (save) saveStepperState();
};

const initStepper = () => {
    const sections = Array.from(document.querySelectorAll(".step-section"));
    if (!sections.length) return;
    stepperState.sections = sections;
    const restored = loadStepperState();
    if (!restored) {
        showStepSection(0);
    }

    const prevBtn = document.getElementById("stepPrev");
    const nextBtn = document.getElementById("stepNext");
    if (prevBtn) {
        prevBtn.addEventListener("click", () => {
            if (stepperState.index > 0) {
                showStepSection(stepperState.index - 1);
            }
        });
    }
    if (nextBtn) {
        nextBtn.addEventListener("click", () => {
            if (!isStepComplete(stepperState.sections[stepperState.index])) return;
            if (stepperState.index < stepperState.sections.length - 1) {
                showStepSection(stepperState.index + 1);
            } else {
                showCompletionView({ scroll: true, save: false });
            }
            saveStepperState();
            renderCompletionBadges(buildActivitySummaries());
        });
    }
};

const restartStepper = () => {
    showStepSection(0, { save: false });
    const main = document.querySelector("main.content");
    if (main) main.scrollIntoView({ behavior: "smooth" });
    removeStorage(getStorageKey());
};

const resetAssessment = () => {
    removeStorage(getStorageKey());
    stepperState.showWorkedExample = false;
    const workedExample = document.getElementById("workedExample");
    if (workedExample) {
        workedExample.classList.add("hidden");
        workedExample.removeAttribute("open");
    }
    document.querySelectorAll("[data-correct='true']").forEach((el) => {
        delete el.dataset.correct;
    });
    document.querySelectorAll("[data-choice-group], [data-line-group]").forEach((container) => {
        delete container.dataset.selected;
    });
    document.querySelectorAll(".mc-buttons button.selected, .code-line.selected").forEach((btn) => {
        btn.classList.remove("selected");
    });
    document.querySelectorAll(".tick-mark").forEach((tick) => {
        tick.style.display = "none";
        tick.classList.remove("is-correct", "is-incorrect");
        tick.textContent = "";
    });
    document.querySelectorAll("input[type='text'], textarea").forEach((input) => {
        input.value = "";
    });
    document.querySelectorAll("select").forEach((select) => {
        select.selectedIndex = 0;
    });
    document.querySelectorAll("input[type='radio'], input[type='checkbox']").forEach((input) => {
        input.checked = false;
    });
    document.querySelectorAll(".rich-feedback").forEach((el) => {
        el.remove();
    });
    document.querySelectorAll(".result-feedback").forEach((el) => {
        el.textContent = "";
        delete el.dataset.correct;
        el.removeAttribute("style");
    });
    const programEl = document.getElementById("makeProgram");
    if (programEl) programEl.value = "";
    const caseSelect = document.getElementById("makeCase");
    if (caseSelect) {
        caseSelect.value = "case1";
        updateExpectedOutput();
    }
    const actualEl = document.getElementById("makeActual");
    if (actualEl) actualEl.textContent = "Run your program to see the output here.";
    enableRunButton();
    initExample1PredictionDependency();
    showStepSection(0, { save: false });
    removeStorage(getHintStorageKey());
    hintState = { checkpoints: {} };
    syncAdaptiveHintsUI();
    renderCompletionBadges(buildActivitySummaries());
};

const getMakeInputs = (caseValue) => {
    if (caseValue === "case1") return ["2", "3", "4", "5", "6", "7"];
    if (caseValue === "case2") return ["0", "10", "20", "30", "40", "50"];
    if (caseValue === "case3") return ["5", "5", "5", "5", "5", "5"];
    return [];
};

const getMakeExpectedOutputs = () => {
    if (ACTIVITY_PAGE_NAME === "example1.html") {
        return {
            case1: "Scores: 5, 6, 7\nTotal: 18\nAverage: 6.0",
            case2: "Scores: 10, 20, 30\nTotal: 60\nAverage: 20.0",
            case3: "Scores: 5, 5, 5\nTotal: 15\nAverage: 5.0"
        };
    }

    return {
        case1: "Scores: 2, 3, 4, 5, 6, 7\nTotal: 27\nAverage: 4.5",
        case2: "Scores: 0, 10, 20, 30, 40, 50\nTotal: 150\nAverage: 25.0",
        case3: "Scores: 5, 5, 5, 5, 5, 5\nTotal: 30\nAverage: 5.0"
    };
};

const enableRunButton = () => {
    const programEl = document.getElementById("makeProgram");
    const runBtn = document.getElementById("runProgramBtn");
    if (!programEl || !runBtn) return;
    runBtn.disabled = programEl.value.trim().length === 0;
};

const ACTIVITY_DEFINITIONS = [
    { key: "example1", label: "Example 1", title: "Input Validation", path: "/docs/pages/example1.html" },
    { key: "example2", label: "Example 2", title: "Running Total", path: "/docs/pages/example2.html" },
    { key: "example3", label: "Example 3", title: "Array Traversal", path: "/docs/pages/example3.html" },
    { key: "assessment", label: "Assessment", title: "Final Assessment", path: "/docs/pages/assessment.html" }
];
const ACTIVITY_META_BY_KEY = new Map(ACTIVITY_DEFINITIONS.map((item) => [item.key, item]));

const CHECKPOINT_LABELS = {
    example1: {
        fullCode: "Implementation: full solution sequence",
        tick1: "Prediction Q1: Need a loop",
        tick2: "Prediction Q2: Loop type",
        tick3: "Prediction Q3: Validation condition",
        tick4: "Prediction Q4: Retry behavior",
        ex1SgATick: "Subgoal match: input stage",
        ex1SgBTick: "Code identification: validation condition",
        ex1SgCTick: "Fill blank: validation threshold",
        ex1SgDTick: "Subgoal identification: feedback stage",
        ex1TraceTick: "Trace validation behavior",
        ex1ModifyTick: "Modify program: validation ordering",
        makeOutputTick: "Output verification"
    },
    example2: {
        fullCode: "Implementation: full solution sequence",
        tick1: "Prediction Q1: Loop count",
        sgA2Tick: "Subgoal mapping: initialization line",
        sgB2Tick: "Code identification: input line",
        sgC2Tick: "Fill blank: running total update",
        sgD2Tick: "Code identification: repetition line",
        tick2Pred: "Prediction Q2: Loop type",
        tick3Pred: "Prediction Q3: Running total variable",
        tick4Pred: "Prediction Q4: Initial total value",
        tick2: "Modify program: reorder 10-item flow",
        makeOutputTick: "Output verification"
    },
    example3: {},
    assessment: {
        tick1: "Prediction Q1: Loop count",
        tick2: "Prediction Q2: Validation loop",
        tick3: "Prediction Q3: Running total variable",
        tick4: "Prediction Q4: Store valid values",
        sgA1Tick: "Subgoal match A",
        sgB1Tick: "Identify line for subgoal B",
        sgC1Tick: "Fill blank for total update",
        sgD1Tick: "Identify traversal subgoal",
        sgE1Tick: "Trace running total",
        assessmentFeedback: "Modify program ordering",
        makeOutputTick: "Output verification"
    }
};

const STORAGE_PREFIX = `${STORAGE_NAMESPACE}:`;
const HINT_STORAGE_PREFIX = `${HINT_STORAGE_NAMESPACE}:`;

const getActivityPathSuffixes = (activityPath) => {
    const lower = String(activityPath || "").toLowerCase();
    const fileName = lower.split("/").pop() || "";
    const suffixes = new Set();
    if (fileName) suffixes.add(`/${fileName}`);
    if (lower.startsWith("/docs/")) {
        suffixes.add(lower.slice("/docs".length));
    }
    suffixes.add(lower);
    return Array.from(suffixes);
};

const resolveActivityHref = (activityPath) => {
    const inPagesDir = /\/pages\//.test(window.location.pathname);
    const marker = "/docs/";
    const markerIndex = activityPath.lastIndexOf(marker);
    let relative = "pages/example1.html";
    if (markerIndex !== -1) {
        relative = activityPath.slice(markerIndex + marker.length);
    }
    if (inPagesDir && relative.startsWith("pages/")) {
        return `../${relative}`;
    }
    return relative;
};

const getCheckpointLabel = (activityKey, checkpointId) => {
    const byActivity = CHECKPOINT_LABELS[activityKey] || {};
    if (byActivity[checkpointId]) return byActivity[checkpointId];
    return String(checkpointId || "checkpoint")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
};

const getHintPayloadRecency = (payload) => {
    const checkpoints = payload?.checkpoints;
    if (!checkpoints || typeof checkpoints !== "object") return 0;
    return Object.values(checkpoints).reduce((max, bucket) => {
        const stamp = Number(bucket?.lastUsedAt || 0);
        return Math.max(max, stamp);
    }, 0);
};

const readBestHintPayloadForPathSuffixes = (pathSuffixes) => {
    let bestPayload = null;
    let bestRecency = -1;
    const lowerSuffixes = (pathSuffixes || []).map((suffix) => String(suffix || "").toLowerCase());
    if (!lowerSuffixes.length) return null;

    for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(HINT_STORAGE_PREFIX)) continue;
        const path = key.slice(HINT_STORAGE_PREFIX.length).toLowerCase();
        const matches = lowerSuffixes.some((suffix) => path.endsWith(suffix));
        if (!matches) continue;

        let payload = null;
        try {
            payload = JSON.parse(localStorage.getItem(key) || "{}");
        } catch {
            payload = null;
        }

        const recency = getHintPayloadRecency(payload);
        if (recency > bestRecency) {
            bestRecency = recency;
            bestPayload = payload;
        }
    }

    return bestPayload;
};

const clearAllLocalProgress = () => {
    const keys = [];
    for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (key.startsWith(STORAGE_PREFIX) || key.startsWith(HINT_STORAGE_PREFIX)) {
            keys.push(key);
        }
    }
    keys.forEach((key) => removeStorage(key));
};

const seedDemoProgress = () => {
    const now = Date.now();
    const minute = 60 * 1000;
    const saveStep = (path, payload) => {
        writeStorage(`${STORAGE_PREFIX}${path}`, JSON.stringify(payload));
    };
    const saveHint = (path, payload) => {
        writeStorage(`${HINT_STORAGE_PREFIX}${path}`, JSON.stringify(payload));
    };

    saveStep("/docs/pages/example1.html", {
        path: "/docs/pages/example1.html",
        stepCount: 10,
        index: 9,
        isComplete: true,
        updatedAt: now - 24 * minute,
        completedChecks: [
            "tick1", "tick2", "tick3", "tick4",
            "fullCode",
            "ex1SgATick", "ex1SgBTick", "ex1SgCTick", "ex1SgDTick",
            "ex1TraceTick", "ex1ModifyTick", "makeOutputTick"
        ],
        inputs: {
            pred3: "len(username) < 5",
            pred4: "retry",
            ex1SgCInput: "5",
            ex1SgDInput: "C",
            ex1Trace1: "no",
            ex1Trace2: "yes",
            ex1Trace3: "1",
            makeProgram: "scores = []\ntotal = 0\n\nwhile len(scores) < 3:\n    score = int(input(\"Score: \"))\n    while score < 5:\n        score = int(input(\"Enter a valid score: \"))\n    scores.append(score)\n    total = total + score\n\naverage = total / len(scores)\n\nprint(\"Scores:\", \", \".join(str(s) for s in scores))\nprint(\"Total:\", total)\nprint(\"Average:\", average)"
        },
        showWorkedExample: true
    });
    saveHint("/docs/pages/example1.html", {
        checkpoints: {
            tick1: { attempts: 1, shownLevel: 1, showCount: 1, revealCount: 0, revealedWorked: false, lastUsedAt: now - 25 * minute },
            tick2: { attempts: 2, shownLevel: 2, showCount: 2, revealCount: 1, revealedWorked: true, lastUsedAt: now - 24 * minute },
            tick3: { attempts: 1, shownLevel: 1, showCount: 1, revealCount: 0, revealedWorked: false, lastUsedAt: now - 23 * minute },
            ex1SgBTick: { attempts: 2, shownLevel: 2, showCount: 2, revealCount: 0, revealedWorked: false, lastUsedAt: now - 22 * minute },
            ex1ModifyTick: { attempts: 3, shownLevel: 3, showCount: 3, revealCount: 1, revealedWorked: true, lastUsedAt: now - 21 * minute }
        }
    });

    saveStep("/docs/pages/example2.html", {
        path: "/docs/pages/example2.html",
        stepCount: 9,
        index: 5,
        isComplete: false,
        updatedAt: now - 12 * minute,
        completedChecks: ["tick1", "tick2Pred", "tick3Pred", "tick4Pred", "fullCode", "sgA2Tick"],
        inputs: {
            pred1: "5",
            "pred2-for": "__checked__",
            pred3: "total",
            pred4: "0",
            sgC2: ""
        },
        showWorkedExample: false
    });
    saveHint("/docs/pages/example2.html", {
        checkpoints: {
            tick1: { attempts: 3, shownLevel: 2, showCount: 2, revealCount: 0, revealedWorked: false, lastUsedAt: now - 11 * minute },
            sgB2Tick: { attempts: 2, shownLevel: 2, showCount: 2, revealCount: 0, revealedWorked: false, lastUsedAt: now - 10 * minute },
            tick2: { attempts: 1, shownLevel: 1, showCount: 1, revealCount: 0, revealedWorked: false, lastUsedAt: now - 9 * minute }
        }
    });

    saveStep("/docs/pages/example3.html", {
        path: "/docs/pages/example3.html",
        stepCount: 6,
        index: 0,
        isComplete: false,
        updatedAt: now - 6 * minute,
        completedChecks: [],
        inputs: {},
        showWorkedExample: false
    });
    saveHint("/docs/pages/example3.html", { checkpoints: {} });

    saveStep("/docs/pages/assessment.html", {
        path: "/docs/pages/assessment.html",
        stepCount: 10,
        index: 5,
        isComplete: false,
        updatedAt: now - 3 * minute,
        completedChecks: ["tick1", "tick2", "tick3", "tick4", "sgA1Tick", "sgB1Tick"],
        inputs: {
            pred1: "5",
            pred2: "while",
            pred3: "total",
            pred4: "yes"
        },
        showWorkedExample: false
    });
    saveHint("/docs/pages/assessment.html", {
        checkpoints: {
            tick1: { attempts: 1, shownLevel: 1, showCount: 1, revealCount: 0, revealedWorked: false, lastUsedAt: now - 4 * minute },
            sgC1Tick: { attempts: 5, shownLevel: 3, showCount: 3, revealCount: 1, revealedWorked: true, lastUsedAt: now - 2 * minute },
            assessmentFeedback: { attempts: 6, shownLevel: 3, showCount: 3, revealCount: 1, revealedWorked: true, lastUsedAt: now - minute }
        }
    });
};

const readBestPayloadForPathSuffixes = (pathSuffixes) => {
    let bestPayload = null;
    let bestUpdatedAt = -1;
    let bestProgress = -1;
    const lowerSuffixes = (pathSuffixes || []).map((suffix) => String(suffix || "").toLowerCase());
    if (!lowerSuffixes.length) return null;

    for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(STORAGE_PREFIX)) continue;
        const path = key.slice(STORAGE_PREFIX.length).toLowerCase();
        const matches = lowerSuffixes.some((suffix) => path.endsWith(suffix));
        if (!matches) continue;

        let payload;
        try {
            payload = JSON.parse(localStorage.getItem(key) || "{}");
        } catch {
            continue;
        }

        const stepCount = Number(payload.stepCount || 0);
        const index = Number(payload.index || 0);
        const denominator = Math.max(stepCount - 1, 1);
        const progress = Math.min(1, Math.max(0, index / denominator));
        const updatedAt = Number(payload.updatedAt || 0);

        const shouldReplace =
            updatedAt > bestUpdatedAt ||
            (updatedAt === bestUpdatedAt && progress > bestProgress);
        if (!shouldReplace) continue;

        bestPayload = payload;
        bestUpdatedAt = updatedAt;
        bestProgress = progress;
    }

    return bestPayload;
};

const readHintAnalyticsForPathSuffixes = (pathSuffixes) => {
    const payload = readBestHintPayloadForPathSuffixes(pathSuffixes);
    if (!payload) {
        return { hintsUsed: 0, workedRevealed: 0 };
    }

    const checkpoints = payload?.checkpoints;
    if (!checkpoints || typeof checkpoints !== "object") {
        return { hintsUsed: 0, workedRevealed: 0 };
    }

    let hintsUsed = 0;
    let workedRevealed = 0;
    Object.values(checkpoints).forEach((bucket) => {
        if (!bucket || typeof bucket !== "object") return;
        hintsUsed += Number(bucket.showCount || 0);
        workedRevealed += Number(bucket.revealCount || 0);
    });

    return { hintsUsed, workedRevealed };
};

const isPayloadStarted = (payload) => {
    if (!payload || typeof payload !== "object") return false;
    const index = Number(payload.index || 0);
    if (index > 0) return true;
    if (Array.isArray(payload.completedChecks) && payload.completedChecks.length) return true;
    if (payload.inputs && typeof payload.inputs === "object") {
        const hasInput = Object.values(payload.inputs).some((value) => String(value || "").trim().length > 0);
        if (hasInput) return true;
    }
    if (typeof payload.makeProgram === "string" && payload.makeProgram.trim().length > 0) return true;
    if (typeof payload.makeActual === "string" && payload.makeActual.trim().length > 0 && !payload.makeActual.includes("Run your program")) return true;
    return false;
};

const buildActivitySummaries = () => {
    return ACTIVITY_DEFINITIONS.map((activity) => {
        const pathSuffixes = getActivityPathSuffixes(activity.path);
        const payload = readBestPayloadForPathSuffixes(pathSuffixes);
        const hintAnalytics = readHintAnalyticsForPathSuffixes(pathSuffixes);
        const stepCount = Number(payload?.stepCount || 0);
        const index = Number(payload?.index || 0);
        const isComplete = payload?.isComplete === true || payload?.completed === true;
        const started = isComplete || isPayloadStarted(payload);
        const inProgress = started && !isComplete;
        const denominator = Math.max(stepCount - 1, 1);
        let progress = isComplete ? 1 : Math.min(1, Math.max(0, index / denominator));
        if (!isComplete && started && progress === 0) progress = 0.08;

        return {
            ...activity,
            href: resolveActivityHref(activity.path),
            payload,
            started,
            inProgress,
            isComplete,
            progress,
            updatedAt: Number(payload?.updatedAt || 0),
            statusLabel: isComplete ? "Complete" : (inProgress ? "In progress" : "Not started"),
            hintAnalytics
        };
    });
};

const buildBadgeStates = (summaries) => {
    const summaryMap = new Map((summaries || []).map((item) => [item.key, item]));
    const exampleKeys = ["example1", "example2", "example3"];
    const allExamplesComplete = exampleKeys.every((key) => summaryMap.get(key)?.isComplete === true);
    const assessmentComplete = summaryMap.get("assessment")?.isComplete === true;

    return [
        {
            key: "badge-example1",
            label: "Example 1 Complete",
            earned: summaryMap.get("example1")?.isComplete === true
        },
        {
            key: "badge-example2",
            label: "Example 2 Complete",
            earned: summaryMap.get("example2")?.isComplete === true
        },
        {
            key: "badge-example3",
            label: "Example 3 Complete",
            earned: summaryMap.get("example3")?.isComplete === true
        },
        {
            key: "badge-all-examples",
            label: "All Examples Complete",
            earned: allExamplesComplete
        },
        {
            key: "badge-assessment",
            label: "Assessment Complete",
            earned: assessmentComplete
        }
    ];
};

const createBadgeChip = (badge) => {
    const chip = document.createElement("span");
    chip.className = `dashboard-badge${badge.earned ? " is-earned" : ""}`;
    chip.dataset.badgeKey = badge.key;
    chip.textContent = badge.label;
    return chip;
};

const buildBadgeSummaryText = (summaries, badges) => {
    const dateLabel = new Date().toLocaleString();
    const activityLines = summaries.map((item) => (
        `- ${item.label}: ${item.statusLabel} (${Math.round(item.progress * 100)}%)`
    ));
    const earnedBadges = badges.filter((badge) => badge.earned).map((badge) => badge.label);
    const badgeLine = earnedBadges.length
        ? earnedBadges.join(", ")
        : "None yet";

    return [
        "Crack the Code Progress Summary",
        `Generated: ${dateLabel}`,
        "",
        "Activity status:",
        ...activityLines,
        "",
        `Badges unlocked (${earnedBadges.length}/${badges.length}): ${badgeLine}`
    ].join("\n");
};

const copyText = async (text) => {
    if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
    }
    const helper = document.createElement("textarea");
    helper.value = text;
    helper.setAttribute("readonly", "true");
    helper.style.position = "fixed";
    helper.style.left = "-9999px";
    document.body.appendChild(helper);
    helper.select();
    document.execCommand("copy");
    helper.remove();
    return true;
};

const renderDashboardBadges = (summaries) => {
    const root = document.getElementById("dashboardBadges");
    if (!root) return;

    const list = document.getElementById("dashboardBadgeList");
    const summary = document.getElementById("dashboardBadgeSummary");
    const copyBtn = document.getElementById("copyBadgeSummaryBtn");
    const downloadBtn = document.getElementById("downloadBadgeSummaryBtn");
    if (!list || !summary || !copyBtn || !downloadBtn) return;

    const badges = buildBadgeStates(summaries);
    const earnedCount = badges.filter((badge) => badge.earned).length;
    list.innerHTML = "";
    badges.forEach((badge) => list.appendChild(createBadgeChip(badge)));
    summary.textContent = `${earnedCount} of ${badges.length} badges unlocked`;

    const summaryText = buildBadgeSummaryText(summaries, badges);
    copyBtn.onclick = async () => {
        try {
            await copyText(summaryText);
            copyBtn.textContent = "Summary copied";
            window.setTimeout(() => {
                copyBtn.textContent = "Copy summary";
            }, 1400);
        } catch {
            copyBtn.textContent = "Copy failed";
            window.setTimeout(() => {
                copyBtn.textContent = "Copy summary";
            }, 1600);
        }
    };

    downloadBtn.onclick = () => {
        const blob = new Blob([summaryText], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "crack-the-code-progress-summary.txt";
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    };
};

const renderCompletionBadges = (summaries) => {
    const badgeContainers = Array.from(document.querySelectorAll("[data-completion-badges]"));
    const summaryEls = Array.from(document.querySelectorAll("[data-completion-badge-summary]"));
    if (!badgeContainers.length && !summaryEls.length) return;

    const badges = buildBadgeStates(summaries);
    const earnedCount = badges.filter((badge) => badge.earned).length;

    badgeContainers.forEach((container) => {
        container.innerHTML = "";
        badges.forEach((badge) => container.appendChild(createBadgeChip(badge)));
    });
    summaryEls.forEach((el) => {
        el.textContent = `Unlocked: ${earnedCount} of ${badges.length} badges`;
    });
};

const initAppbarEnhancements = () => {
    const menuToggle = document.getElementById("appbarMenuToggle");
    const navActions = document.getElementById("appbarNavActions");
    const resumeLink = document.getElementById("appbarResumeLink");
    const appbar = document.getElementById("appbar");

    if (menuToggle && navActions) {
        menuToggle.addEventListener("click", () => {
            const open = navActions.classList.toggle("is-open");
            menuToggle.setAttribute("aria-expanded", String(open));
        });

        document.addEventListener("click", (event) => {
            if (!appbar || !navActions.classList.contains("is-open")) return;
            if (!appbar.contains(event.target)) {
                navActions.classList.remove("is-open");
                menuToggle.setAttribute("aria-expanded", "false");
            }
        });
    }

    if (!resumeLink) return;
    const summaries = buildActivitySummaries();
    const candidates = summaries.filter((item) => item.inProgress);
    if (!candidates.length) return;
    candidates.sort((a, b) => {
        if (b.updatedAt !== a.updatedAt) return b.updatedAt - a.updatedAt;
        return b.progress - a.progress;
    });
    resumeLink.href = candidates[0].href;
    resumeLink.hidden = false;
    resumeLink.title = "Resume your latest progress";
};

const initLearningDashboard = () => {
    const root = document.getElementById("dashboard");
    const summaries = buildActivitySummaries();
    renderDashboardBadges(summaries);
    renderCompletionBadges(summaries);

    if (!root) return;

    const cards = Array.from(root.querySelectorAll(".dashboard-progress-card[data-activity-key]"));
    const continueCta = document.getElementById("dashboardContinueCta");
    const recommendedText = document.getElementById("dashboardRecommendedText");
    const recommendedBtn = document.getElementById("dashboardRecommendedBtn");
    const summaryMap = new Map(summaries.map((item) => [item.key, item]));

    cards.forEach((card) => {
        const key = card.getAttribute("data-activity-key");
        if (!key) return;
        const summary = summaryMap.get(key);
        if (!summary) return;

        const statusEl = card.querySelector("[data-status]");
        const fillEl = card.querySelector("[data-progress-fill]");
        const actionEl = card.querySelector("[data-card-action]");
        const hintsUsedEl = card.querySelector("[data-hints-used]");
        const workedRevealedEl = card.querySelector("[data-worked-revealed]");

        if (statusEl) {
            statusEl.textContent = summary.statusLabel;
            statusEl.classList.remove("is-not-started", "is-in-progress", "is-complete");
            statusEl.classList.add(
                summary.isComplete ? "is-complete" : (summary.inProgress ? "is-in-progress" : "is-not-started")
            );
        }

        if (fillEl) {
            fillEl.style.width = `${Math.round(summary.progress * 100)}%`;
        }

        if (actionEl) {
            actionEl.href = summary.href;
            actionEl.textContent = summary.isComplete ? "Review" : (summary.inProgress ? "Continue" : "Start");
        }

        if (hintsUsedEl) {
            hintsUsedEl.textContent = `Hints used: ${summary.hintAnalytics.hintsUsed}`;
        }
        if (workedRevealedEl) {
            workedRevealedEl.textContent = `Worked hints revealed: ${summary.hintAnalytics.workedRevealed}`;
        }
    });

    const inProgress = summaries.filter((item) => item.inProgress).sort((a, b) => {
        if (b.updatedAt !== a.updatedAt) return b.updatedAt - a.updatedAt;
        return b.progress - a.progress;
    });

    if (continueCta) {
        if (inProgress.length) {
            continueCta.href = inProgress[0].href;
            continueCta.textContent = `Continue ${inProgress[0].label}`;
        } else {
            const fallback = summaries.find((item) => !item.isComplete) || summaries[summaries.length - 1];
            continueCta.href = fallback.href;
            continueCta.textContent = `Start ${fallback.label}`;
        }
    }

    const exampleOrder = ["example1", "example2", "example3"];
    const nextExample = exampleOrder
        .map((key) => summaryMap.get(key))
        .find((item) => item && !item.isComplete);
    const assessment = summaryMap.get("assessment");

    let recommendation = null;
    if (nextExample) {
        recommendation = {
            href: nextExample.href,
            text: `Recommended next: ${nextExample.label} (${nextExample.title}).`,
            button: `Open ${nextExample.label}`
        };
    } else if (assessment && !assessment.isComplete) {
        recommendation = {
            href: assessment.href,
            text: "You have completed all worked examples. Next recommended step: Final Assessment.",
            button: "Open Assessment"
        };
    } else {
        recommendation = {
            href: assessment ? assessment.href : "pages/assessment.html",
            text: "Everything is complete. You can review any activity whenever needed.",
            button: "Review Assessment"
        };
    }

    if (recommendedText) recommendedText.textContent = recommendation.text;
    if (recommendedBtn) {
        recommendedBtn.href = recommendation.href;
        recommendedBtn.textContent = recommendation.button;
    }
};

const initTeacherSummaryPanel = async () => {
    const root = document.getElementById("teacherSummaryPanel");
    if (!root) return;

    const completeEl = document.getElementById("teacherCountComplete");
    const inProgressEl = document.getElementById("teacherCountInProgress");
    const notStartedEl = document.getElementById("teacherCountNotStarted");
    const hintsUsedEl = document.getElementById("teacherHintsUsed");
    const workedHintsEl = document.getElementById("teacherWorkedHints");
    const listEl = document.getElementById("teacherSummaryList");
    const attemptListEl = document.getElementById("teacherAttemptList");
    const mostMissedEl = document.getElementById("teacherMostMissedList");
    const exportCsvBtn = document.getElementById("teacherExportCsvBtn");
    const exportJsonBtn = document.getElementById("teacherExportJsonBtn");
    const importProgressBtn = document.getElementById("teacherImportProgressBtn");
    const resetProgressBtn = document.getElementById("teacherResetProgressBtn");
    const seedDemoBtn = document.getElementById("teacherSeedDemoBtn");
    const createClassForm = document.getElementById("teacherCreateClassForm");
    const classNameInput = document.getElementById("teacherClassNameInput");
    const createClassFeedback = document.getElementById("teacherCreateClassFeedback");
    const addStudentForm = document.getElementById("teacherAddStudentForm");
    const classSelect = document.getElementById("teacherClassSelect");
    const knownStudentSelect = document.getElementById("teacherKnownStudentSelect");
    const studentUsernameInput = document.getElementById("teacherStudentUsernameInput");
    const studentEmailInput = document.getElementById("teacherStudentEmailInput");
    const studentPasswordInput = document.getElementById("teacherStudentPasswordInput");
    const addStudentFeedback = document.getElementById("teacherAddStudentFeedback");
    const classRosterList = document.getElementById("teacherClassRosterList");
    const resetModal = document.getElementById("teacherResetModal");
    const resetConfirmBtn = document.getElementById("teacherResetConfirmBtn");
    const resetCloseTriggers = resetModal
        ? Array.from(resetModal.querySelectorAll("[data-close-reset-modal='true']"))
        : [];
    const deleteClassModal = document.getElementById("teacherDeleteClassModal");
    const deleteClassConfirmBtn = document.getElementById("teacherDeleteClassConfirmBtn");
    const deleteClassCloseTriggers = deleteClassModal
        ? Array.from(deleteClassModal.querySelectorAll("[data-close-delete-modal='true']"))
        : [];
    const studentModal = document.getElementById("teacherStudentModal");
    const studentModalBody = document.getElementById("teacherStudentBody");
    const studentModalContent = document.getElementById("teacherStudentAnalyticsContent");
    const studentModalCloseTriggers = studentModal
        ? Array.from(studentModal.querySelectorAll("[data-close-student-modal='true']"))
        : [];
    let pendingDeleteClassId = "";
    let pendingDeleteTrigger = null;

    const shouldUseTeacherApi = hasApiAdapter() && isApiLoggedIn() && getApiUserRole() === "teacher";
    const currentUser = getApiUser();
    if (importProgressBtn) {
        importProgressBtn.hidden = true;
        importProgressBtn.onclick = null;
    }
    if (shouldUseTeacherApi) {
        // In DB teacher mode, local-only tools must remain hidden even if analytics endpoints fail.
        if (seedDemoBtn) {
            seedDemoBtn.hidden = true;
            seedDemoBtn.disabled = true;
        }
        if (resetProgressBtn) {
            resetProgressBtn.hidden = true;
            resetProgressBtn.disabled = true;
        }
        if (importProgressBtn) {
            const alreadyImported = !!currentUser && hasImportedLocalProgressForUser(currentUser);
            importProgressBtn.hidden = alreadyImported;
            if (!alreadyImported) {
                importProgressBtn.disabled = false;
                importProgressBtn.title = "Import one-time local progress into your account.";
                importProgressBtn.onclick = async () => {
                    importProgressBtn.disabled = true;
                    const originalLabel = importProgressBtn.textContent;
                    importProgressBtn.textContent = "Importing...";
                    try {
                        const result = await importLocalProgressToDb();
                        // Ensure marker is set and button disappears in all success-ish paths.
                        if (currentUser) markImportedLocalProgressForUser(currentUser);
                        if (result?.imported || result?.reason === "already_imported") {
                            importProgressBtn.textContent = "Imported";
                            window.setTimeout(async () => {
                                importProgressBtn.hidden = true;
                                importProgressBtn.textContent = originalLabel;
                                await initTeacherSummaryPanel();
                                initLearningDashboard();
                            }, 650);
                        } else {
                            importProgressBtn.hidden = true;
                            importProgressBtn.textContent = originalLabel;
                        }
                    } catch {
                        importProgressBtn.disabled = false;
                        importProgressBtn.textContent = "Import failed";
                        window.setTimeout(() => {
                            importProgressBtn.textContent = originalLabel;
                        }, 1100);
                    }
                };
            }
        }

        try {
            const [classSummary, attemptAnalytics] = await Promise.all([
                window.N5Api.getTeacherClassSummary(),
                window.N5Api.getTeacherAttemptAnalytics()
            ]);
            const introEl = root.querySelector(".teacher-summary-intro");
            if (introEl) {
                introEl.textContent = "Snapshot from database-backed class progress data.";
            }

            const overall = classSummary?.overall || {};
            if (completeEl) completeEl.textContent = String(Number(overall.activitiesCompleted || 0));
            if (inProgressEl) inProgressEl.textContent = String(Number(overall.activitiesInProgress || 0));
            if (notStartedEl) notStartedEl.textContent = String(Number(overall.activitiesNotStarted || 0));
            if (hintsUsedEl) hintsUsedEl.textContent = String(Number(overall.hintsUsed || 0));
            if (workedHintsEl) workedHintsEl.textContent = String(Number(overall.workedHintsRevealed || 0));

            if (listEl) {
                listEl.innerHTML = "";
                const classes = Array.isArray(classSummary?.classes) ? classSummary.classes : [];
                classes.forEach((classRow) => {
                    const li = document.createElement("li");
                    li.className = "teacher-summary-list__item";
                    const activityCards = (classRow.activityCounts || [])
                        .map((activity) => {
                            const normalizedKey = String(activity.activityKey || "").toLowerCase();
                            const friendly = ACTIVITY_META_BY_KEY.get(normalizedKey)?.label
                                || normalizedKey
                                || "Activity";
                            return `
                              <article class="teacher-class-breakdown__item">
                                <p class="teacher-class-breakdown__title">${friendly}</p>
                                <div class="teacher-class-breakdown__stats" role="list" aria-label="${friendly} progress counts">
                                  <span class="teacher-class-breakdown__stat teacher-class-breakdown__stat--complete" role="listitem">${activity.completed} complete</span>
                                  <span class="teacher-class-breakdown__stat teacher-class-breakdown__stat--progress" role="listitem">${activity.inProgress} in progress</span>
                                  <span class="teacher-class-breakdown__stat teacher-class-breakdown__stat--not-started" role="listitem">${activity.notStarted} not started</span>
                                </div>
                              </article>
                            `;
                        })
                        .join("");
                    const studentCount = Number(classRow.studentCount || 0);
                    const studentLabel = studentCount === 1 ? "student" : "students";
                    li.innerHTML = `
                      <p class="teacher-summary-list__title">${classRow.classroomName} (${studentCount} ${studentLabel})</p>
                      <div class="teacher-class-breakdown">${activityCards || '<p class="teacher-summary-list__meta">No activity data yet.</p>'}</div>
                    `;
                    listEl.appendChild(li);
                });
                if (!classes.length) {
                    const li = document.createElement("li");
                    li.className = "teacher-summary-list__item";
                    li.innerHTML = `<p class="teacher-summary-list__meta">No classes found for this teacher account yet.</p>`;
                    listEl.appendChild(li);
                }
            }

            const checkpointRows = Array.isArray(attemptAnalytics?.checkpointAnalytics)
                ? attemptAnalytics.checkpointAnalytics
                : [];
            const byActivity = new Map();
            checkpointRows.forEach((row) => {
                const key = String(row.activityKey || "").toLowerCase();
                const existing = byActivity.get(key) || {
                    activityKey: key,
                    attempts: 0,
                    checkpointsTried: 0,
                    missSignals: 0,
                    toughest: null
                };
                existing.attempts += Number(row.attempts || 0);
                existing.checkpointsTried += 1;
                existing.missSignals += Number(row.missSignals || 0);
                if (!existing.toughest || Number(row.missSignals || 0) > Number(existing.toughest.missSignals || 0)) {
                    existing.toughest = row;
                }
                byActivity.set(key, existing);
            });

            if (attemptListEl) {
                attemptListEl.innerHTML = "";
                Array.from(byActivity.values()).forEach((row) => {
                    const li = document.createElement("li");
                    li.className = "teacher-summary-list__item";
                    const meta = ACTIVITY_META_BY_KEY.get(row.activityKey);
                    const label = meta?.label || row.activityKey || "Activity";
                    const title = meta?.title || "";
                    const signal = row.missSignals >= 10
                        ? "High difficulty signal"
                        : row.missSignals >= 4
                            ? "Moderate difficulty signal"
                            : row.missSignals > 0
                                ? "Low difficulty signal"
                                : "No difficulty signal yet";
                    const toughestText = row.toughest
                        ? `${getCheckpointLabel(row.activityKey, row.toughest.checkpointId)} (${row.toughest.missSignals} miss signals)`
                        : "None yet";
                    li.innerHTML = `
                      <p class="teacher-summary-list__title">${label}${title ? `: ${title}` : ""}</p>
                      <p class="teacher-summary-list__meta">Attempts: ${row.attempts} across ${row.checkpointsTried} checkpoints</p>
                      <p class="teacher-summary-list__meta">${signal}</p>
                      <p class="teacher-summary-list__meta">Most missed in this activity: ${toughestText}</p>
                    `;
                    attemptListEl.appendChild(li);
                });
                if (!byActivity.size) {
                    const li = document.createElement("li");
                    li.className = "teacher-summary-list__item";
                    li.innerHTML = `<p class="teacher-summary-list__meta">No checkpoint attempt data yet.</p>`;
                    attemptListEl.appendChild(li);
                }
            }

            if (mostMissedEl) {
                mostMissedEl.innerHTML = "";
                const topMissed = Array.isArray(attemptAnalytics?.mostMissed)
                    ? attemptAnalytics.mostMissed
                        .filter((item) => Number(item?.missSignals || 0) > 0)
                        .slice(0, 5)
                    : [];
                if (!topMissed.length) {
                    const li = document.createElement("li");
                    li.className = "teacher-summary-list__item";
                    li.innerHTML = `<p class="teacher-summary-list__meta">No missed checkpoint data yet.</p>`;
                    mostMissedEl.appendChild(li);
                } else {
                    topMissed.forEach((item) => {
                        const li = document.createElement("li");
                        li.className = "teacher-summary-list__item";
                        const meta = ACTIVITY_META_BY_KEY.get(String(item.activityKey || "").toLowerCase());
                        li.innerHTML = `
                          <p class="teacher-summary-list__title">${meta?.label || item.activityKey}: ${getCheckpointLabel(item.activityKey, item.checkpointId)}</p>
                          <p class="teacher-summary-list__meta">${item.missSignals} miss signals (${item.attempts} attempts)</p>
                        `;
                        mostMissedEl.appendChild(li);
                    });
                }
            }

            if (exportJsonBtn) {
                exportJsonBtn.onclick = () => {
                    window.location.href = "/api/teacher/export.json";
                };
            }
            if (exportCsvBtn) {
                exportCsvBtn.onclick = () => {
                    window.location.href = "/api/teacher/export.csv";
                };
            }
            const setRosterFeedback = (el, message, isError = false) => {
                if (!el) return;
                el.textContent = message || "";
                el.classList.toggle("is-visible", !!message);
                el.classList.toggle("tick-mark", !!message);
                el.classList.toggle("is-incorrect", !!message && isError);
                el.classList.toggle("is-correct", !!message && !isError);
            };

            const closeStudentModal = () => {
                if (!studentModal) return;
                studentModal.classList.remove("is-open");
                studentModal.setAttribute("aria-hidden", "true");
                document.body.classList.remove("is-modal-open");
            };

            const openStudentModal = () => {
                if (!studentModal) return;
                studentModal.classList.add("is-open");
                studentModal.setAttribute("aria-hidden", "false");
                document.body.classList.add("is-modal-open");
            };

            const renderStudentAnalytics = (payload) => {
                if (!studentModalBody || !studentModalContent) return;
                const student = payload?.student || {};
                const summary = payload?.summary || {};
                const activities = Array.isArray(payload?.activities) ? payload.activities : [];
                const mostMissed = Array.isArray(payload?.mostMissed) ? payload.mostMissed.slice(0, 6) : [];

                studentModalBody.textContent = `Progress snapshot for ${student.username || "student"}${student.email ? ` (${student.email})` : ""}.`;
                studentModalContent.innerHTML = "";

                const summaryBlock = document.createElement("article");
                summaryBlock.className = "teacher-student-analytics__block";
                summaryBlock.innerHTML = `
                  <p class="teacher-student-analytics__title">Summary</p>
                  <p class="teacher-student-analytics__meta">Activities started: ${Number(summary.activitiesStarted || 0)} • Completed: ${Number(summary.activitiesCompleted || 0)}</p>
                  <p class="teacher-student-analytics__meta">Hints used: ${Number(summary.hintsUsed || 0)} • Worked hints revealed: ${Number(summary.workedHintsRevealed || 0)} • Attempts: ${Number(summary.attempts || 0)}</p>
                `;
                studentModalContent.appendChild(summaryBlock);

                const activityBlock = document.createElement("article");
                activityBlock.className = "teacher-student-analytics__block";
                const activityLines = activities.map((row) => {
                    const key = String(row.activityKey || "").toLowerCase();
                    const label = ACTIVITY_META_BY_KEY.get(key)?.label || key || "Activity";
                    return `<p class="teacher-student-analytics__meta">${label}: ${row.status || "Not Started"}</p>`;
                }).join("");
                activityBlock.innerHTML = `
                  <p class="teacher-student-analytics__title">Activity status</p>
                  ${activityLines || '<p class="teacher-student-analytics__meta">No activity records yet.</p>'}
                `;
                studentModalContent.appendChild(activityBlock);

                const missedBlock = document.createElement("article");
                missedBlock.className = "teacher-student-analytics__block";
                const missedLines = mostMissed.map((row) => {
                    const key = String(row.activityKey || "").toLowerCase();
                    const label = ACTIVITY_META_BY_KEY.get(key)?.label || key || "Activity";
                    return `<p class="teacher-student-analytics__meta">${label} • ${getCheckpointLabel(key, row.checkpointId)}: ${Number(row.missSignals || 0)} miss signals</p>`;
                }).join("");
                missedBlock.innerHTML = `
                  <p class="teacher-student-analytics__title">Most missed checkpoints</p>
                  ${missedLines || '<p class="teacher-student-analytics__meta">No checkpoint misses recorded.</p>'}
                `;
                studentModalContent.appendChild(missedBlock);
            };

            const loadAndShowStudentAnalytics = async (studentId) => {
                if (!studentModalBody || !studentModalContent) return;
                studentModalBody.textContent = "Loading student activity analytics...";
                studentModalContent.innerHTML = "";
                openStudentModal();
                try {
                    const payload = await window.N5Api.getTeacherStudentAnalytics(studentId);
                    renderStudentAnalytics(payload);
                } catch (err) {
                    studentModalBody.textContent = err?.message || "Unable to load student analytics.";
                }
            };

            const renderClasses = (classes) => {
                const rows = Array.isArray(classes) ? classes : [];
                if (classSelect) {
                    const current = classSelect.value;
                    classSelect.innerHTML = '<option value="">Select class</option>';
                    rows.forEach((item) => {
                        const option = document.createElement("option");
                        option.value = String(item.id);
                        option.textContent = `${item.name} (${item.studentCount} students)`;
                        classSelect.appendChild(option);
                    });
                    if (current && rows.some((item) => String(item.id) === current)) {
                        classSelect.value = current;
                    }
                }

                if (classRosterList) {
                    classRosterList.innerHTML = "";
                    if (!rows.length) {
                        const li = document.createElement("li");
                        li.className = "teacher-summary-list__item";
                        li.innerHTML = `<p class="teacher-summary-list__meta">No classes yet. Create your first class above.</p>`;
                        classRosterList.appendChild(li);
                    } else {
                        rows.forEach((item) => {
                            const li = document.createElement("li");
                            li.className = "teacher-summary-list__item";
                            const students = Array.isArray(item.students) ? item.students : [];
                            const studentsHtml = students.length
                                ? students.map((s) => (
                                    `<span class="teacher-roster-chip teacher-roster-chip--clickable" data-view-student data-student-id="${s.id}" role="button" tabindex="0" title="View student analytics">
                                      <span class="teacher-roster-chip__name">${s.username}</span>
                                      <button type="button" class="teacher-roster-remove-btn" data-remove-student data-class-id="${item.id}" data-student-id="${s.id}" aria-label="Remove student from class" title="Remove student"></button>
                                    </span>`
                                )).join(" ")
                                : "No students enrolled yet.";
                            li.innerHTML = `
                              <p class="teacher-summary-list__title">${item.name} (${item.studentCount} students)</p>
                              <p class="teacher-summary-list__meta">${studentsHtml}</p>
                              <div class="teacher-summary-actions teacher-summary-actions--in-summary">
                                <button type="button" class="teacher-delete-class-btn" data-delete-class data-class-id="${item.id}" aria-label="Delete class" title="Delete class">
                                  <span class="teacher-delete-class-btn__icon" aria-hidden="true"></span>
                                  <span>Delete class</span>
                                </button>
                              </div>
                            `;
                            classRosterList.appendChild(li);
                        });
                    }
                }
            };

            const loadClasses = async () => {
                const payload = await window.N5Api.getTeacherClasses();
                const knownStudents = Array.isArray(payload?.teacherStudents) ? payload.teacherStudents : [];
                if (knownStudentSelect) {
                    const current = knownStudentSelect.value;
                    knownStudentSelect.innerHTML = '<option value="">Choose existing student (optional)</option>';
                    knownStudents.forEach((student) => {
                        const option = document.createElement("option");
                        option.value = String(student.username || "");
                        option.textContent = student.email
                            ? `${student.username} (${student.email})`
                            : String(student.username || "");
                        option.dataset.email = String(student.email || "");
                        knownStudentSelect.appendChild(option);
                    });
                    if (current && knownStudents.some((student) => String(student.username || "") === current)) {
                        knownStudentSelect.value = current;
                    }
                }
                renderClasses(payload?.classes || []);
            };

            if (createClassForm && !createClassForm.dataset.bound) {
                createClassForm.dataset.bound = "true";
                createClassForm.addEventListener("submit", async (event) => {
                    event.preventDefault();
                    const className = (classNameInput?.value || "").trim();
                    if (!className) return;
                    try {
                        await window.N5Api.createTeacherClass(className);
                        if (classNameInput) classNameInput.value = "";
                        setRosterFeedback(createClassFeedback, "Class created.", false);
                        await loadClasses();
                        await initTeacherSummaryPanel();
                    } catch (err) {
                        setRosterFeedback(createClassFeedback, err?.message || "Unable to create class.", true);
                    }
                });
            }

            if (addStudentForm && !addStudentForm.dataset.bound) {
                addStudentForm.dataset.bound = "true";
                addStudentForm.addEventListener("submit", async (event) => {
                    event.preventDefault();
                    const classroomId = (classSelect?.value || "").trim();
                    const username = (studentUsernameInput?.value || "").trim();
                    const email = (studentEmailInput?.value || "").trim();
                    const password = (studentPasswordInput?.value || "").trim();
                    if (!classroomId || !username) return;
                    try {
                        await window.N5Api.addTeacherStudent(classroomId, { username, email, password });
                        if (studentUsernameInput) studentUsernameInput.value = "";
                        if (studentEmailInput) studentEmailInput.value = "";
                        if (studentPasswordInput) studentPasswordInput.value = "";
                        setRosterFeedback(addStudentFeedback, "Student added to class.", false);
                        await loadClasses();
                        await initTeacherSummaryPanel();
                    } catch (err) {
                        setRosterFeedback(addStudentFeedback, err?.message || "Unable to add student.", true);
                    }
                });
            }

            if (knownStudentSelect && knownStudentSelect.dataset.bound !== "true") {
                knownStudentSelect.dataset.bound = "true";
                knownStudentSelect.addEventListener("change", () => {
                    const selectedUsername = String(knownStudentSelect.value || "").trim();
                    const selectedOption = knownStudentSelect.options[knownStudentSelect.selectedIndex];
                    const selectedEmail = String(selectedOption?.dataset?.email || "").trim();
                    if (selectedUsername && studentUsernameInput) {
                        studentUsernameInput.value = selectedUsername;
                    }
                    if (selectedEmail && studentEmailInput) {
                        studentEmailInput.value = selectedEmail;
                    }
                });
            }

            if (classRosterList && !classRosterList.dataset.bound) {
                classRosterList.dataset.bound = "true";
                classRosterList.addEventListener("click", async (event) => {
                    const target = event.target instanceof Element ? event.target : null;
                    if (!target) return;

                    const removeBtn = target.closest("[data-remove-student]");
                    if (removeBtn) {
                        const classId = String(removeBtn.getAttribute("data-class-id") || "").trim();
                        const studentId = String(removeBtn.getAttribute("data-student-id") || "").trim();
                        if (!classId || !studentId) return;
                        removeBtn.setAttribute("disabled", "true");
                        try {
                            await window.N5Api.removeTeacherStudent(classId, studentId);
                            setRosterFeedback(addStudentFeedback, "Student removed from class.", false);
                            await loadClasses();
                            await initTeacherSummaryPanel();
                        } catch (err) {
                            setRosterFeedback(addStudentFeedback, err?.message || "Unable to remove student.", true);
                        } finally {
                            removeBtn.removeAttribute("disabled");
                        }
                        return;
                    }

                    const viewStudentBtn = target.closest("[data-view-student]");
                    if (viewStudentBtn) {
                        const studentId = String(viewStudentBtn.getAttribute("data-student-id") || "").trim();
                        if (!studentId) return;
                        await loadAndShowStudentAnalytics(studentId);
                        return;
                    }

                    const deleteBtn = target.closest("[data-delete-class]");
                    if (deleteBtn) {
                        const classId = String(deleteBtn.getAttribute("data-class-id") || "").trim();
                        if (!classId) return;
                        if (!deleteClassModal || !deleteClassConfirmBtn) {
                            deleteBtn.setAttribute("disabled", "true");
                            try {
                                await window.N5Api.deleteTeacherClass(classId);
                                setRosterFeedback(createClassFeedback, "Class deleted.", false);
                                await loadClasses();
                                await initTeacherSummaryPanel();
                            } catch (err) {
                                setRosterFeedback(createClassFeedback, err?.message || "Unable to delete class.", true);
                            } finally {
                                deleteBtn.removeAttribute("disabled");
                            }
                            return;
                        }
                        pendingDeleteClassId = classId;
                        pendingDeleteTrigger = deleteBtn;
                        deleteClassModal.classList.add("is-open");
                        deleteClassModal.setAttribute("aria-hidden", "false");
                        document.body.classList.add("is-modal-open");
                        window.setTimeout(() => deleteClassConfirmBtn.focus(), 0);
                    }
                });

                classRosterList.addEventListener("keydown", async (event) => {
                    const target = event.target instanceof Element ? event.target : null;
                    if (!target) return;
                    if (event.key !== "Enter" && event.key !== " ") return;
                    const viewStudentBtn = target.closest("[data-view-student]");
                    if (!viewStudentBtn) return;
                    event.preventDefault();
                    const studentId = String(viewStudentBtn.getAttribute("data-student-id") || "").trim();
                    if (!studentId) return;
                    await loadAndShowStudentAnalytics(studentId);
                });
            }

            const closeDeleteClassModal = () => {
                if (!deleteClassModal) return;
                deleteClassModal.classList.remove("is-open");
                deleteClassModal.setAttribute("aria-hidden", "true");
                document.body.classList.remove("is-modal-open");
                pendingDeleteClassId = "";
                pendingDeleteTrigger = null;
            };

            deleteClassCloseTriggers.forEach((el) => {
                if (el.dataset.bound === "true") return;
                el.dataset.bound = "true";
                el.onclick = closeDeleteClassModal;
            });

            studentModalCloseTriggers.forEach((el) => {
                if (el.dataset.bound === "true") return;
                el.dataset.bound = "true";
                el.onclick = closeStudentModal;
            });

            if (deleteClassConfirmBtn && deleteClassConfirmBtn.dataset.bound !== "true") {
                deleteClassConfirmBtn.dataset.bound = "true";
                deleteClassConfirmBtn.onclick = async () => {
                    const classId = String(pendingDeleteClassId || "").trim();
                    if (!classId) {
                        closeDeleteClassModal();
                        return;
                    }
                    if (pendingDeleteTrigger) pendingDeleteTrigger.setAttribute("disabled", "true");
                    deleteClassConfirmBtn.setAttribute("disabled", "true");
                    try {
                        await window.N5Api.deleteTeacherClass(classId);
                        setRosterFeedback(createClassFeedback, "Class deleted.", false);
                        closeDeleteClassModal();
                        await loadClasses();
                        await initTeacherSummaryPanel();
                    } catch (err) {
                        setRosterFeedback(createClassFeedback, err?.message || "Unable to delete class.", true);
                    } finally {
                        deleteClassConfirmBtn.removeAttribute("disabled");
                        if (pendingDeleteTrigger) pendingDeleteTrigger.removeAttribute("disabled");
                    }
                };
            }

            await loadClasses();
            return;
        } catch {
            // Keep DB-mode controls; only data fetch failed.
            const introEl = root.querySelector(".teacher-summary-intro");
            if (introEl) {
                introEl.textContent = "Unable to load teacher analytics from the server right now.";
            }
            if (listEl && !listEl.childElementCount) {
                const li = document.createElement("li");
                li.className = "teacher-summary-list__item";
                li.innerHTML = `<p class="teacher-summary-list__meta">Analytics endpoint unavailable. Try refreshing.</p>`;
                listEl.appendChild(li);
            }
            if (attemptListEl && !attemptListEl.childElementCount) {
                const li = document.createElement("li");
                li.className = "teacher-summary-list__item";
                li.innerHTML = `<p class="teacher-summary-list__meta">Attempt analytics endpoint unavailable.</p>`;
                attemptListEl.appendChild(li);
            }
            if (mostMissedEl && !mostMissedEl.childElementCount) {
                const li = document.createElement("li");
                li.className = "teacher-summary-list__item";
                li.innerHTML = `<p class="teacher-summary-list__meta">Most-missed checkpoint endpoint unavailable.</p>`;
                mostMissedEl.appendChild(li);
            }
            return;
        }
    }

    if (seedDemoBtn) {
        seedDemoBtn.hidden = false;
        seedDemoBtn.disabled = false;
        seedDemoBtn.title = "";
    }
    if (resetProgressBtn) {
        resetProgressBtn.hidden = false;
        resetProgressBtn.disabled = false;
        resetProgressBtn.title = "";
    }

    const summaries = buildActivitySummaries();
    const completeCount = summaries.filter((item) => item.isComplete).length;
    const inProgressCount = summaries.filter((item) => item.inProgress).length;
    const notStartedCount = summaries.filter((item) => !item.started).length;
    const totalHintsUsed = summaries.reduce(
        (sum, item) => sum + Number(item?.hintAnalytics?.hintsUsed || 0),
        0
    );
    const totalWorkedHints = summaries.reduce(
        (sum, item) => sum + Number(item?.hintAnalytics?.workedRevealed || 0),
        0
    );

    if (createClassForm) {
        createClassForm.querySelectorAll("input, button, select").forEach((el) => {
            el.disabled = true;
        });
    }
    if (addStudentForm) {
        addStudentForm.querySelectorAll("input, button, select").forEach((el) => {
            el.disabled = true;
        });
    }
    if (createClassFeedback) {
        createClassFeedback.textContent = "Sign in with a teacher account to manage classes in database mode.";
        createClassFeedback.classList.add("is-visible", "tick-mark", "is-incorrect");
    }
    if (addStudentFeedback) {
        addStudentFeedback.textContent = "Class and student management is disabled in local-only fallback mode.";
        addStudentFeedback.classList.add("is-visible", "tick-mark", "is-incorrect");
    }
    if (classRosterList) {
        classRosterList.innerHTML = "";
        const li = document.createElement("li");
        li.className = "teacher-summary-list__item";
        li.innerHTML = `<p class="teacher-summary-list__meta">Class roster tools are available when backend teacher auth is active.</p>`;
        classRosterList.appendChild(li);
    }

    if (completeEl) completeEl.textContent = String(completeCount);
    if (inProgressEl) inProgressEl.textContent = String(inProgressCount);
    if (notStartedEl) notStartedEl.textContent = String(notStartedCount);
    if (hintsUsedEl) hintsUsedEl.textContent = String(totalHintsUsed);
    if (workedHintsEl) workedHintsEl.textContent = String(totalWorkedHints);

    if (listEl) {
        listEl.innerHTML = "";
        summaries.forEach((item) => {
            const li = document.createElement("li");
            li.className = "teacher-summary-list__item";
            li.innerHTML = `
              <p class="teacher-summary-list__title">${item.label}: ${item.title}</p>
              <p class="teacher-summary-list__meta">${item.statusLabel} (${Math.round(item.progress * 100)}%)</p>
              <p class="teacher-summary-list__meta">Hints used: ${item.hintAnalytics.hintsUsed} • Worked hints: ${item.hintAnalytics.workedRevealed}</p>
            `;
            listEl.appendChild(li);
        });
    }

    const attemptRows = [];
    const missedAgg = new Map();

    summaries.forEach((item) => {
        const pathSuffixes = getActivityPathSuffixes(item.path);
        const hintPayload = readBestHintPayloadForPathSuffixes(pathSuffixes);
        const checkpoints = hintPayload?.checkpoints && typeof hintPayload.checkpoints === "object"
            ? hintPayload.checkpoints
            : {};
        const entries = Object.entries(checkpoints)
            .map(([checkpointId, bucket]) => ({
                checkpointId,
                attempts: Number(bucket?.attempts || 0)
            }))
            .filter((entry) => entry.attempts > 0);

        const totalAttempts = entries.reduce((sum, entry) => sum + entry.attempts, 0);
        const toughest = entries.reduce((best, entry) => (
            !best || entry.attempts > best.attempts ? entry : best
        ), null);
        const signal = totalAttempts >= 10 || (toughest && toughest.attempts >= 5)
            ? "High difficulty signal"
            : totalAttempts >= 4 || (toughest && toughest.attempts >= 3)
                ? "Moderate difficulty signal"
                : totalAttempts > 0
                    ? "Low difficulty signal"
                    : "No difficulty signal yet";

        attemptRows.push({
            activityKey: item.key,
            label: item.label,
            title: item.title,
            totalAttempts,
            checkpointsTried: entries.length,
            signal,
            toughest
        });

        entries.forEach((entry) => {
            const key = `${item.key}:${entry.checkpointId}`;
            const existing = missedAgg.get(key) || {
                activityLabel: item.label,
                checkpointId: entry.checkpointId,
                label: getCheckpointLabel(item.key, entry.checkpointId),
                attempts: 0
            };
            existing.attempts += entry.attempts;
            missedAgg.set(key, existing);
        });
    });

    if (attemptListEl) {
        attemptListEl.innerHTML = "";
        attemptRows.forEach((row) => {
            const li = document.createElement("li");
            li.className = "teacher-summary-list__item";
            const toughestText = row.toughest
                ? `${getCheckpointLabel(
                    row.activityKey,
                    row.toughest.checkpointId
                )} (${row.toughest.attempts} attempts)`
                : "None yet";
            li.innerHTML = `
              <p class="teacher-summary-list__title">${row.label}: ${row.title}</p>
              <p class="teacher-summary-list__meta">Attempts: ${row.totalAttempts} across ${row.checkpointsTried} checkpoints</p>
              <p class="teacher-summary-list__meta">${row.signal}</p>
              <p class="teacher-summary-list__meta">Most missed in this activity: ${toughestText}</p>
            `;
            attemptListEl.appendChild(li);
        });
    }

    if (mostMissedEl) {
        mostMissedEl.innerHTML = "";
        const topMissed = Array.from(missedAgg.values())
            .filter((item) => Number(item?.attempts || 0) > 0)
            .sort((a, b) => b.attempts - a.attempts)
            .slice(0, 5);

        if (!topMissed.length) {
            const li = document.createElement("li");
            li.className = "teacher-summary-list__item";
            li.innerHTML = `<p class="teacher-summary-list__meta">No missed checkpoint data yet.</p>`;
            mostMissedEl.appendChild(li);
        } else {
            topMissed.forEach((item) => {
                const li = document.createElement("li");
                li.className = "teacher-summary-list__item";
                li.innerHTML = `
                  <p class="teacher-summary-list__title">${item.activityLabel}: ${item.label}</p>
                  <p class="teacher-summary-list__meta">${item.attempts} failed attempts recorded</p>
                `;
                mostMissedEl.appendChild(li);
            });
        }
    }

    const reportRows = summaries.map((item) => ({
        key: item.key,
        label: item.label,
        title: item.title,
        status: item.statusLabel,
        progressPercent: Math.round(item.progress * 100),
        hintsUsed: Number(item?.hintAnalytics?.hintsUsed || 0),
        workedHintsRevealed: Number(item?.hintAnalytics?.workedRevealed || 0),
        updatedAt: Number(item?.updatedAt || 0)
    }));

    const reportPayload = {
        generatedAt: new Date().toISOString(),
        totals: {
            complete: completeCount,
            inProgress: inProgressCount,
            notStarted: notStartedCount,
            hintsUsed: totalHintsUsed,
            workedHintsRevealed: totalWorkedHints
        },
        activities: reportRows
    };

    if (exportJsonBtn) {
        exportJsonBtn.onclick = () => {
            const blob = new Blob([JSON.stringify(reportPayload, null, 2)], {
                type: "application/json;charset=utf-8"
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "teacher-progress-report.json";
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
        };
    }

    if (exportCsvBtn) {
        exportCsvBtn.onclick = () => {
            const escapeCsv = (value) => `"${String(value ?? "").replace(/"/g, "\"\"")}"`;
            const headers = [
                "generated_at",
                "activity_key",
                "activity_label",
                "activity_title",
                "status",
                "progress_percent",
                "hints_used",
                "worked_hints_revealed",
                "updated_at"
            ];
            const lines = [headers.join(",")];
            reportRows.forEach((row) => {
                lines.push([
                    escapeCsv(reportPayload.generatedAt),
                    escapeCsv(row.key),
                    escapeCsv(row.label),
                    escapeCsv(row.title),
                    escapeCsv(row.status),
                    row.progressPercent,
                    row.hintsUsed,
                    row.workedHintsRevealed,
                    row.updatedAt || ""
                ].join(","));
            });
            const csv = lines.join("\n");
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "teacher-progress-report.csv";
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
        };
    }

    if (resetProgressBtn) {
        resetProgressBtn.onclick = () => {
            if (!resetModal) return;
            resetModal.classList.add("is-open");
            resetModal.setAttribute("aria-hidden", "false");
            document.body.classList.add("is-modal-open");
            if (resetConfirmBtn) {
                window.setTimeout(() => resetConfirmBtn.focus(), 0);
            }
        };
    }

    if (resetConfirmBtn) {
        resetConfirmBtn.onclick = () => {
            clearAllLocalProgress();
            if (resetModal) {
                resetModal.classList.remove("is-open");
                resetModal.setAttribute("aria-hidden", "true");
            }
            document.body.classList.remove("is-modal-open");
            initTeacherSummaryPanel();
        };
    }

    resetCloseTriggers.forEach((el) => {
        el.onclick = () => {
            if (!resetModal) return;
            resetModal.classList.remove("is-open");
            resetModal.setAttribute("aria-hidden", "true");
            document.body.classList.remove("is-modal-open");
        };
    });

    if (seedDemoBtn) {
        seedDemoBtn.onclick = () => {
            seedDemoProgress();
            initTeacherSummaryPanel();
        };
    }
};

const initBackToTopFab = () => {
    const existing = document.querySelector(".back-to-top-fab");
    if (existing) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "back-to-top-fab";
    button.setAttribute("aria-label", "Back to top");
    button.innerHTML = `<span class="back-to-top-fab__icon" aria-hidden="true"></span>`;
    document.body.appendChild(button);

    const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const showThreshold = Math.max(40, Math.round(window.innerHeight * 0.08));

    const updateVisibility = () => {
        const shouldShow = window.scrollY > showThreshold;
        button.classList.toggle("is-visible", shouldShow);
    };

    button.addEventListener("click", () => {
        window.scrollTo({
            top: 0,
            behavior: reduceMotion ? "auto" : "smooth"
        });
    });

    window.addEventListener("scroll", updateVisibility, { passive: true });
    updateVisibility();
};

const initWorksheetActions = () => {
    const printButtons = Array.from(document.querySelectorAll("[data-print-worksheet]"));
    const downloadLinks = Array.from(document.querySelectorAll("[data-download-worksheet]"));
    if (!printButtons.length && !downloadLinks.length) return;

    printButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            window.print();
        });
    });

    downloadLinks.forEach((link) => {
        link.addEventListener("click", async (event) => {
            const href = link.getAttribute("href");
            if (!href) return;
            const fileName = link.getAttribute("download") || "worksheet.html";
            const targetUrl = new URL(href, window.location.href);

            const forceBlobDownload = (blob) => {
                const blobUrl = URL.createObjectURL(blob);
                const temp = document.createElement("a");
                temp.href = blobUrl;
                temp.download = fileName;
                document.body.appendChild(temp);
                temp.click();
                temp.remove();
                URL.revokeObjectURL(blobUrl);
            };

            // Current page download is generated directly to avoid browser no-op on same-file links.
            if (targetUrl.pathname === window.location.pathname) {
                event.preventDefault();
                const html = `<!DOCTYPE html>\n${document.documentElement.outerHTML}`;
                forceBlobDownload(new Blob([html], { type: "text/html;charset=utf-8" }));
                return;
            }

            event.preventDefault();

            try {
                const response = await fetch(targetUrl.href, { cache: "no-store" });
                if (!response.ok) throw new Error(`Failed to fetch worksheet: ${response.status}`);
                const blob = await response.blob();
                forceBlobDownload(blob);
            } catch {
                window.location.href = targetUrl.href;
            }
        });
    });
};

const initAccessibilityEnhancements = () => {
    const main = document.querySelector("main");
    if (main) {
        if (!main.id) main.id = "main-content";
        if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
    }

    if (!document.querySelector(".skip-link") && main) {
        const skip = document.createElement("a");
        skip.className = "skip-link";
        skip.href = `#${main.id}`;
        skip.textContent = "Skip to main content";
        document.body.insertBefore(skip, document.body.firstChild);
    }

    const menuToggle = document.getElementById("appbarMenuToggle");
    if (menuToggle) {
        menuToggle.setAttribute("aria-label", "Toggle navigation menu");
        menuToggle.setAttribute("aria-haspopup", "true");
    }

    document.querySelectorAll(".appbar-nav-pill.is-active").forEach((el) => {
        el.setAttribute("aria-current", "page");
    });

    // Keyboard fallback for drag-order tasks.
    document.querySelectorAll(".parsons-container").forEach((container) => {
        container.setAttribute("role", "list");
        const items = Array.from(container.querySelectorAll(".draggable"));
        items.forEach((item) => {
            item.setAttribute("tabindex", "0");
            item.setAttribute("role", "listitem");
            item.setAttribute(
                "aria-label",
                `${(item.textContent || "Code line").trim()}. Use Arrow Up and Arrow Down to reorder.`
            );

            item.addEventListener("keydown", (event) => {
                if (!(event.key === "ArrowUp" || event.key === "ArrowDown")) return;
                event.preventDefault();
                const parent = item.parentElement;
                if (!parent) return;

                if (event.key === "ArrowUp") {
                    const prev = item.previousElementSibling;
                    if (prev) parent.insertBefore(item, prev);
                } else {
                    const next = item.nextElementSibling;
                    if (next) parent.insertBefore(next, item);
                }
            });
        });
    });
};

const initExamplesShowcase = () => {
    const root = document.getElementById("examples");
    if (!root) return;

    const preview = root.querySelector(".examples-preview");
    const tabs = Array.from(root.querySelectorAll(".examples-tab"));
    const previewImage = document.getElementById("examplePreviewImage");
    const previewKicker = document.getElementById("examplePreviewKicker");
    const previewTitle = document.getElementById("examplePreviewTitle");
    const previewDescription = document.getElementById("examplePreviewDescription");
    const previewLink = document.getElementById("examplePreviewLink");

    if (!preview || !tabs.length || !previewImage || !previewKicker || !previewTitle || !previewDescription || !previewLink) return;
    preview.id = preview.id || "examplesPreviewPanel";
    preview.setAttribute("role", "tabpanel");

    const content = {
        example1: {
            kicker: "Example 1",
            title: "Input Validation",
            description: "Design checks that keep user input safe, sensible, and in range before processing.",
            href: "pages/example1.html",
            cta: "Start Example 1",
            image: "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=960&q=80",
            alt: "Student coding at a laptop"
        },
        example2: {
            kicker: "Example 2",
            title: "Running Total",
            description: "Use loops and accumulators to build totals step by step while handling multiple inputs.",
            href: "pages/example2.html",
            cta: "Start Example 2",
            image: "https://images.unsplash.com/photo-1551033406-611cf9a28f67?q=80&w=3087&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
            alt: "Numbers and calculator representing totals"
        },
        example3: {
            kicker: "Example 3",
            title: "Array Traversal",
            description: "Work through list data item by item and apply the same logic cleanly across each value.",
            href: "pages/example3.html",
            cta: "Start Example 3",
            image: "https://images.unsplash.com/photo-1516259762381-22954d7d3ad2?q=80&w=2978&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
            alt: "Data dashboard representing arrays and values"
        },
        assessment: {
            kicker: "Final Assessment",
            title: "Combining Concepts",
            description: "Bring validation, totals, and traversal together in one mixed challenge to check understanding.",
            href: "pages/assessment.html",
            cta: "Start Assessment",
            image: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?q=80&w=2938&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
            alt: "Notebook and study materials for assessment"
        }
    };

    // Preload showcase images to keep tab switches instant.
    Object.values(content).forEach((item) => {
        const img = new Image();
        img.src = item.image;
    });

    let activeIndex = 0;
    let timerId = null;
    let swapTimeoutId = null;
    const intervalMs = 5200;
    const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const showTab = (index, animate = true) => {
        const safeIndex = (index + tabs.length) % tabs.length;
        const tab = tabs[safeIndex];
        const key = tab.dataset.exampleKey;
        const item = content[key];
        if (!item) return;

        tabs.forEach((btn, idx) => {
            const isActive = idx === safeIndex;
            btn.classList.toggle("is-active", isActive);
            btn.setAttribute("aria-selected", isActive ? "true" : "false");
        });

        const applyContent = () => {
            previewImage.src = item.image;
            previewImage.alt = item.alt;
            previewKicker.textContent = item.kicker;
            previewTitle.textContent = item.title;
            previewDescription.textContent = item.description;
            previewLink.href = item.href;
            previewLink.textContent = item.cta;
        };

        if (swapTimeoutId) {
            window.clearTimeout(swapTimeoutId);
            swapTimeoutId = null;
        }

        if (reducedMotion || !animate) {
            preview.classList.remove("is-swapping");
            applyContent();
        } else {
            preview.classList.add("is-swapping");
            swapTimeoutId = window.setTimeout(() => {
                applyContent();
                preview.classList.remove("is-swapping");
                swapTimeoutId = null;
            }, 190);
        }

        activeIndex = safeIndex;
    };

    const stopRotation = () => {
        if (timerId) {
            window.clearInterval(timerId);
            timerId = null;
        }
    };

    const startRotation = () => {
        if (reducedMotion || timerId) return;
        timerId = window.setInterval(() => {
            showTab(activeIndex + 1);
        }, intervalMs);
    };

    tabs.forEach((tab, idx) => {
        if (!tab.id) tab.id = `examplesTab${idx + 1}`;
        tab.setAttribute("aria-controls", preview.id);
        tab.addEventListener("click", () => {
            showTab(idx);
            stopRotation();
            startRotation();
        });
    });

    root.addEventListener("mouseenter", stopRotation);
    root.addEventListener("mouseleave", startRotation);
    root.addEventListener("focusin", stopRotation);
    root.addEventListener("focusout", (event) => {
        if (root.contains(event.relatedTarget)) return;
        startRotation();
    });

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) stopRotation();
        else startRotation();
    });

    showTab(0, false);
    startRotation();
};

const initHomeCardReveal = () => {
    if (!document.body.classList.contains("page-home")) return;

    const cards = Array.from(document.querySelectorAll("main.content > .card"));
    if (!cards.length) return;

    cards.forEach((card, idx) => {
        card.classList.add("reveal-card");
        card.style.transitionDelay = `${Math.min(idx * 60, 220)}ms`;
    });

    const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion || !("IntersectionObserver" in window)) {
        cards.forEach((card) => card.classList.add("is-visible"));
        return;
    }

    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-visible");
            obs.unobserve(entry.target);
        });
    }, {
        root: null,
        threshold: 0.18,
        rootMargin: "0px 0px -8% 0px"
    });

    cards.forEach((card) => observer.observe(card));
};

const initDefaultTooltipCopy = () => {
    const buildTip = (el) => {
        const label = (el.textContent || "").trim().replace(/\s+/g, " ");
        const lower = label.toLowerCase();
        const href = ((el.getAttribute && el.getAttribute("href")) || "").toLowerCase();
        const id = (el.id || "").toLowerCase();
        const onclick = (el.getAttribute && (el.getAttribute("onclick") || "").toLowerCase()) || "";
        const sectionTitle = (el.closest("section")?.querySelector("h2")?.textContent || "").trim();
        const sectionLabel = sectionTitle ? ` in ${sectionTitle}` : "";

        if (el.classList.contains("appbar-menu-toggle")) return "Show quick links";
        if (el.classList.contains("appbar-avatar-btn")) return "Open account menu";
        if (el.classList.contains("appbar-resume")) return "Resume your saved progress";
        if (el.classList.contains("hint-panel__btn-show")) return `Show a progressive hint${sectionLabel}`;
        if (el.classList.contains("hint-panel__btn-reveal")) return `Reveal a worked hint${sectionLabel}`;
        if (el.hasAttribute("data-print-worksheet")) return "Print this worksheet";
        if (el.hasAttribute("data-download-worksheet")) return "Download this worksheet";

        if (id === "stepprev") return "Go to previous step";
        if (id === "stepnext") return "Go to next step";
        if (id === "stepreset") return "Restart from step 1";
        if (id === "runprogrambtn") return "Run your code with the selected test case";
        if (id === "examplepreviewlink") return "Open this previewed activity";
        if (id === "copybadgesummarybtn") return "Copy your progress summary to clipboard";
        if (id === "downloadbadgesummarybtn") return "Download your progress summary as a text file";
        if (id === "dashboardcontinuecta") return "Continue your latest in-progress activity";
        if (id === "dashboardrecommendedbtn") return "Open the recommended next activity";
        if (id === "teacherexportcsvbtn") return "Export class progress and hints as CSV";
        if (id === "teacherexportjsonbtn") return "Export class progress and hints as JSON";
        if (id === "teacherimportprogressbtn") return "Import one-time local progress into your account";
        if (id === "authimportbtn") return "Import one-time local progress into your account";
        if (id === "teacherseeddemobtn") return "Insert demo progress data for presentation";
        if (id === "teacherresetprogressbtn") return "Open confirmation to clear all local progress";
        if (id === "teacherresetconfirmbtn") return "Permanently clear all local progress on this device";
        if (id === "teachergateunlock") return "Unlock teacher mode with the passcode";
        if (id === "assessmentgatereview") return "Open the next incomplete example";
        if (id === "assessmentgateproceed") return "Continue to the assessment without prerequisites";

        if (el.classList.contains("teacher-gate__close")) return "Close teacher mode login";
        if (el.classList.contains("teacher-reset-modal__close")) return "Close reset confirmation dialog";
        if (el.classList.contains("assessment-gate__close")) return "Close assessment warning";
        if (el.hasAttribute("data-close-reset-modal")) return "Close reset confirmation dialog";
        if (el.hasAttribute("data-close-gate")) return "Close assessment warning";
        if (el.hasAttribute("data-teacher-lock")) return "Sign out of teacher mode";

        if (el.classList.contains("examples-tab")) {
            const key = (el.dataset.exampleKey || "").toLowerCase();
            if (key === "example1") return "Preview example 1";
            if (key === "example2") return "Preview example 2";
            if (key === "example3") return "Preview example 3";
            if (key === "assessment") return "Preview final assessment";
            return "Preview this activity";
        }

        if (lower.includes("show full code")) return "Reveal the full solution";

        if (onclick.includes("checkradiobutton('tick1-yes', 'tick1')")) return "Check whether a loop is needed";
        if (onclick.includes("checkradiobutton('tick2-while', 'tick2')")) return "Check the best loop type for validation";
        if (onclick.includes("checkanswer('pred3'")) return "Check your validation condition";
        if (onclick.includes("checkanswer('pred4'")) return "Check your retry-behavior prediction";
        if (onclick.includes("checkchoice('ex1sga'")) return "Check your subgoal mapping for the input line";
        if (onclick.includes("checklinechoice('ex1sgb'")) return "Check your line selection for Subgoal B";
        if (onclick.includes("checkanswer('ex1sgcinput'")) return "Check your fill-in value for the threshold";
        if (onclick.includes("checkanswer('ex1sgdinput'")) return "Check your subgoal identification";
        if (onclick.includes("checktrace(['ex1trace1','ex1trace2','ex1trace3']")) return "Check your validation trace answers";
        if (onclick.includes("verifyparsons('ex1-modify-parsons'")) return "Verify your modified validation program order";
        if (onclick.includes("checkactualoutput('makecase', 'makeactual', 'makeoutputtick')")) return "Check output for your custom program";
        if (onclick.includes("setchoice")) return `Select ${label}${sectionLabel}`;
        if (onclick.includes("selectline")) return `Select this line${sectionLabel}`;
        if (onclick.includes("verifyparsons")) return `Verify your order${sectionLabel}`;
        if (onclick.includes("checkactualoutput")) return "Check your program output";
        if (onclick.includes("checktrace")) return `Check your trace${sectionLabel}`;
        if (onclick.includes("checklinechoice")) return `Check your line choice${sectionLabel}`;
        if (onclick.includes("checkchoice")) return `Check your selected subgoal${sectionLabel}`;
        if (onclick.includes("checkanswer")) return `Check your answer${sectionLabel}`;
        if (onclick.includes("runprogram")) return "Run your code with the selected test case";
        if (onclick.includes("resetassessment")) return "Restart this activity";
        if (onclick.includes("nextstep")) return "Show the next code step";

        if (lower.includes("menu")) return "Show quick links";
        if (lower.includes("home")) return "Go to homepage";
        if (lower.includes("examples")) return "Jump to examples";
        if (lower.includes("worksheets")) return "Open worksheets";
        if (lower.includes("teacher mode")) return "Open teacher mode";
        if (lower.includes("assessment")) return "Open assessment";
        if (lower.includes("print worksheet")) return "Print this worksheet";
        if (lower.includes("download worksheet")) return "Download this worksheet";
        if (lower.includes("resume")) return "Resume your saved progress";
        if (lower.includes("start")) return "Start this activity";
        if (lower.includes("try")) return "Open this activity";
        if (lower.includes("next")) return "Go to next step";
        if (lower.includes("back")) return "Go to previous step";
        if (lower.includes("restart")) return "Restart this activity";
        if (lower === "check") return "Check your answer";
        if (lower.includes("check answer")) return "Check your answer";
        if (lower.includes("verify")) return "Verify your solution";
        if (lower.includes("run program")) return "Run your code";
        if (lower.includes("copy summary")) return "Copy your progress summary to clipboard";
        if (lower.includes("download summary")) return "Download your progress summary as a text file";
        if (lower.includes("open recommendation")) return "Open the recommended next activity";
        if (lower.includes("insert test data")) return "Insert demo progress data for presentation";
        if (lower.includes("import local progress")) return "Import one-time local progress into your account";
        if (lower.includes("export csv")) return "Export class progress and hints as CSV";
        if (lower.includes("export json")) return "Export class progress and hints as JSON";
        if (lower.includes("proceed anyway")) return "Continue to the assessment without prerequisites";
        if (lower.includes("go to next incomplete example")) return "Open the next incomplete example";
        if (lower.includes("unlock")) return "Unlock teacher mode with the passcode";
        if (lower.includes("lock")) return "Sign out of teacher mode";
        if (lower.includes("sign out")) return "Sign out of teacher mode";
        if (lower.includes("preview")) return "Preview this section";
        if (lower.includes("example 1")) return "Preview example 1";
        if (lower.includes("example 2")) return "Preview example 2";
        if (lower.includes("example 3")) return "Preview example 3";
        if (href.includes("#examples")) return "Jump to examples";
        if (href.includes("worksheets")) return "Open worksheets";
        if (href.includes("teacher")) return "Open teacher mode";
        if (href.includes("assessment")) return "Open assessment";
        if (href.includes("example1")) return "Open example 1";
        if (href.includes("example2")) return "Open example 2";
        if (href.includes("example3")) return "Open example 3";
        if (el.classList.contains("back-btn")) return "Return to the previous page";
        if (el.classList.contains("reset-btn")) return "Restart this activity";
        if (el.classList.contains("check-btn")) return "Continue with this action";
        return "Select this option";
    };

    const selector = [
        ".appbar-nav-pill",
        ".appbar-avatar-btn",
        ".appbar-menu-toggle",
        ".examples-tab",
        ".check-btn",
        "button:not(.code-line):not(.draggable)"
    ].join(", ");

    const controls = Array.from(document.querySelectorAll(selector));
    const uniqueControls = Array.from(new Set(controls));

    uniqueControls.forEach((el) => {
        if (el.hasAttribute("data-tooltip")) return;
        if (el.classList.contains("back-to-top-fab")) return;
        if (el.getAttribute("aria-hidden") === "true") return;
        if ("disabled" in el && el.disabled) return;
        el.setAttribute("data-tooltip", buildTip(el));
    });
};

const initGlassTooltips = () => {
    const triggers = Array.from(document.querySelectorAll("[data-tooltip]"));
    if (!triggers.length) return;

    const tooltip = document.createElement("div");
    tooltip.className = "glass-tooltip";
    tooltip.id = "globalGlassTooltip";
    tooltip.setAttribute("role", "tooltip");
    tooltip.setAttribute("aria-hidden", "true");
    document.body.appendChild(tooltip);

    let activeTrigger = null;
    let showTimer = null;
    const delayMs = 1700;
    const gap = 10;

    const clearShowTimer = () => {
        if (!showTimer) return;
        window.clearTimeout(showTimer);
        showTimer = null;
    };

    const hideTooltip = () => {
        clearShowTimer();
        if (activeTrigger) activeTrigger.removeAttribute("aria-describedby");
        activeTrigger = null;
        tooltip.classList.remove("is-visible");
        tooltip.setAttribute("aria-hidden", "true");
    };

    const positionTooltip = (trigger) => {
        if (!trigger) return;
        const rect = trigger.getBoundingClientRect();
        tooltip.style.left = "0px";
        tooltip.style.top = "0px";

        const tipRect = tooltip.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        let left = rect.left + (rect.width / 2) - (tipRect.width / 2);
        left = Math.max(12, Math.min(left, vw - tipRect.width - 12));

        let top = rect.bottom + gap;
        if (top + tipRect.height > vh - 12) {
            top = Math.max(12, rect.top - tipRect.height - gap);
        }

        tooltip.style.left = `${Math.round(left)}px`;
        tooltip.style.top = `${Math.round(top)}px`;
    };

    const showTooltip = (trigger) => {
        const text = trigger.getAttribute("data-tooltip");
        if (!text) return;
        activeTrigger = trigger;
        trigger.setAttribute("aria-describedby", tooltip.id);
        tooltip.textContent = text;
        tooltip.classList.remove("is-visible");
        tooltip.setAttribute("aria-hidden", "false");
        positionTooltip(trigger);
        tooltip.classList.add("is-visible");
    };

    const scheduleShow = (trigger) => {
        clearShowTimer();
        showTimer = window.setTimeout(() => {
            showTooltip(trigger);
            showTimer = null;
        }, delayMs);
    };

    triggers.forEach((trigger) => {
        trigger.addEventListener("mouseenter", () => scheduleShow(trigger));
        trigger.addEventListener("focusin", () => scheduleShow(trigger));
        trigger.addEventListener("mouseleave", hideTooltip);
        trigger.addEventListener("focusout", hideTooltip);
    });

    window.addEventListener("scroll", () => {
        if (!activeTrigger) return;
        positionTooltip(activeTrigger);
    }, { passive: true });

    window.addEventListener("resize", () => {
        if (!activeTrigger) return;
        positionTooltip(activeTrigger);
    });
};

const initAssessmentGate = () => {
    const isAssessmentPage = /\/assessment\.html$/i.test(window.location.pathname);
    if (isAssessmentPage) return;

    const STORAGE_PREFIX = "assessmentStepperState.v2:";
    const inPagesDir = /\/pages\//.test(window.location.pathname);
    const toExampleHref = (fileName) => (inPagesDir ? fileName : `pages/${fileName}`);
    const requiredExamples = [
        { path: "/docs/pages/example1.html", label: "Example 1", href: toExampleHref("example1.html") },
        { path: "/docs/pages/example2.html", label: "Example 2", href: toExampleHref("example2.html") },
        { path: "/docs/pages/example3.html", label: "Example 3", href: toExampleHref("example3.html") }
    ];

    const readExampleCompletion = (pathSuffixes) => {
        const lowerSuffixes = (pathSuffixes || []).map((suffix) => String(suffix || "").toLowerCase());
        if (!lowerSuffixes.length) return false;
        try {
            for (let i = 0; i < localStorage.length; i += 1) {
                const key = localStorage.key(i);
                if (!key || !key.startsWith(STORAGE_PREFIX)) continue;
                const path = key.slice(STORAGE_PREFIX.length).toLowerCase();
                const matches = lowerSuffixes.some((suffix) => path.endsWith(suffix));
                if (!matches) continue;

                try {
                    const payload = JSON.parse(localStorage.getItem(key) || "{}");
                    if (payload && (payload.isComplete === true || payload.completed === true)) return true;
                } catch {
                    // Ignore malformed storage records.
                }
            }
        } catch {
            // If storage cannot be read, keep behaviour safe by treating as incomplete.
            return false;
        }
        return false;
    };

    const getCompletionState = () => {
        const withStatus = requiredExamples.map((ex) => ({
            ...ex,
            complete: readExampleCompletion(getActivityPathSuffixes(ex.path))
        }));
        const completedCount = withStatus.filter((ex) => ex.complete).length;
        const missing = withStatus.filter((ex) => !ex.complete);
        return { completedCount, missing, withStatus };
    };

    const modal = document.createElement("div");
    modal.className = "assessment-gate";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
      <div class="assessment-gate__backdrop" data-close-gate="true"></div>
      <div class="assessment-gate__dialog" role="dialog" aria-modal="true" aria-labelledby="assessmentGateTitle" aria-describedby="assessmentGateBody">
        <button type="button" class="assessment-gate__close" aria-label="Close warning" data-close-gate="true">&times;</button>
        <h3 id="assessmentGateTitle">Before You Start The Assessment</h3>
        <p id="assessmentGateBody">
          You can continue now, but finishing all worked examples first is recommended.
          They prepare you for the assessment and help you perform better.
        </p>
        <div class="assessment-gate__progress-wrap">
          <div class="assessment-gate__progress-label" id="assessmentGateProgressLabel"></div>
          <div class="assessment-gate__progress" aria-hidden="true">
            <span id="assessmentGateProgressFill"></span>
          </div>
        </div>
        <p class="assessment-gate__missing-title">Still to complete:</p>
        <div class="assessment-gate__missing-list" id="assessmentGateMissing"></div>
        <div class="assessment-gate__actions">
          <button type="button" class="check-btn reset-btn" id="assessmentGateReview">Go to next incomplete example</button>
          <button type="button" class="check-btn" id="assessmentGateProceed">Proceed anyway</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const dialog = modal.querySelector(".assessment-gate__dialog");
    const proceedBtn = modal.querySelector("#assessmentGateProceed");
    const reviewBtn = modal.querySelector("#assessmentGateReview");
    const missingText = modal.querySelector("#assessmentGateMissing");
    const progressLabel = modal.querySelector("#assessmentGateProgressLabel");
    const progressFill = modal.querySelector("#assessmentGateProgressFill");
    let pendingHref = "";
    let reviewHref = "";
    let returnFocusEl = null;

    const hideModal = () => {
        modal.classList.remove("is-open");
        modal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("is-modal-open");
        if (returnFocusEl) returnFocusEl.focus();
    };

    const showModal = (href, sourceEl, statusArg = null) => {
        const status = statusArg || getCompletionState();
        if (!status.missing.length) {
            window.location.href = href;
            return;
        }

        pendingHref = href;
        reviewHref = status.missing[0]?.href || "";
        returnFocusEl = sourceEl || null;
        progressLabel.textContent = `${status.completedCount} of 3 examples complete`;
        progressFill.style.width = `${Math.round((status.completedCount / 3) * 100)}%`;
        missingText.innerHTML = status.missing
            .map((ex) => `<span class="assessment-gate__chip">${ex.label}</span>`)
            .join("");
        reviewBtn.disabled = !reviewHref;
        reviewBtn.textContent = reviewHref
            ? `Go to ${status.missing[0].label}`
            : "Go to next incomplete example";
        modal.classList.add("is-open");
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("is-modal-open");
        reviewBtn.focus();
    };

    modal.addEventListener("click", (event) => {
        const target = event.target;
        if (target instanceof Element && target.matches("[data-close-gate='true']")) {
            hideModal();
        }
    });

    proceedBtn.addEventListener("click", () => {
        if (!pendingHref) return;
        window.location.href = pendingHref;
    });

    reviewBtn.addEventListener("click", () => {
        if (!reviewHref) return;
        window.location.href = reviewHref;
    });

    document.addEventListener("keydown", (event) => {
        if (!modal.classList.contains("is-open")) return;

        if (event.key === "Escape") {
            event.preventDefault();
            hideModal();
            return;
        }

        if (event.key !== "Tab" || !dialog) return;
        const focusables = Array.from(
            dialog.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")
        ).filter((el) => !el.hasAttribute("disabled") && !el.getAttribute("aria-hidden"));
        if (!focusables.length) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;

        if (event.shiftKey && active === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && active === last) {
            event.preventDefault();
            first.focus();
        }
    });

    document.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const link = target.closest("a[href]");
        if (!link) return;

        const hrefAttr = link.getAttribute("href") || "";
        const hrefResolved = link.href || "";
        const isAssessmentTarget =
            /(^|\/)assessment\.html($|[?#])/i.test(hrefAttr) ||
            /(^|\/)assessment\.html($|[?#])/i.test(hrefResolved);
        if (!isAssessmentTarget) return;

        // Always intercept first so the warning can appear reliably.
        event.preventDefault();
        let status;
        try {
            status = getCompletionState();
        } catch {
            status = { completedCount: 0, missing: requiredExamples, withStatus: [] };
        }

        if (!status.missing.length) {
            window.location.href = link.href;
            return;
        }

        showModal(link.href, link, status);
    });
};

const initExpanderAnimations = () => {
    const expanders = Array.from(document.querySelectorAll("details.expander-card"));
    if (!expanders.length) return;

    const prefersReducedMotion = window.matchMedia
        && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    expanders.forEach((details) => {
        const summary = details.querySelector(":scope > summary");
        if (!summary) return;

        let content = details.querySelector(":scope > .expander-content");
        if (!content) {
            content = document.createElement("div");
            content.className = "expander-content";
            const children = Array.from(details.children).filter((child) => child !== summary);
            children.forEach((child) => content.appendChild(child));
            details.appendChild(content);
        }

        const setExpandedState = () => {
            content.style.height = "auto";
            content.style.opacity = "1";
            content.style.marginTop = "10px";
        };

        const setCollapsedState = () => {
            content.style.height = "0px";
            content.style.opacity = "0";
            content.style.marginTop = "0px";
        };

        if (details.open) setExpandedState();
        else setCollapsedState();

        if (prefersReducedMotion) return;

        let isAnimating = false;

        summary.addEventListener("click", (event) => {
            event.preventDefault();
            if (isAnimating) return;
            isAnimating = true;

            if (details.open) {
                const startHeight = content.scrollHeight;
                content.style.height = `${startHeight}px`;
                content.style.opacity = "1";
                content.style.marginTop = "10px";
                requestAnimationFrame(() => {
                    content.style.height = "0px";
                    content.style.opacity = "0";
                    content.style.marginTop = "0px";
                });

                const onCollapseEnd = (evt) => {
                    if (evt.propertyName !== "height") return;
                    content.removeEventListener("transitionend", onCollapseEnd);
                    details.open = false;
                    isAnimating = false;
                };
                content.addEventListener("transitionend", onCollapseEnd);
                return;
            }

            details.open = true;
            content.style.height = "0px";
            content.style.opacity = "0";
            content.style.marginTop = "0px";
            const targetHeight = content.scrollHeight;
            requestAnimationFrame(() => {
                content.style.height = `${targetHeight}px`;
                content.style.opacity = "1";
                content.style.marginTop = "10px";
            });

            const onExpandEnd = (evt) => {
                if (evt.propertyName !== "height") return;
                content.removeEventListener("transitionend", onExpandEnd);
                content.style.height = "auto";
                isAnimating = false;
            };
            content.addEventListener("transitionend", onExpandEnd);
        });
    });
};

const runProgram = async () => {
    const programEl = document.getElementById("makeProgram");
    const caseSelect = document.getElementById("makeCase");
    const outputEl = document.getElementById("makeActual");
    const runBtn = document.getElementById("runProgramBtn");
    const spinner = document.querySelector(".spinner");

    if (!programEl || !caseSelect || !outputEl || !runBtn) return;
    const statusEl = document.getElementById("runStatus");

    const code = programEl.value;
    if (!code.trim()) return;

    runBtn.disabled = true;
    runBtn.textContent = "Running...";
    if (statusEl) statusEl.textContent = "Running Python...";
    if (spinner) spinner.classList.remove("is-hidden");

    try {
        if (!window.loadPyodide) {
            throw new Error("Python runtime not loaded.");
        }

        if (!window.pyodide) {
            if (statusEl) statusEl.textContent = "Loading Python runtime...";
            window.pyodide = await loadPyodide({
                indexURL: "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/"
            });
            if (statusEl) statusEl.textContent = "Python ready.";
        }

        const inputs = getMakeInputs(caseSelect.value);
        window.pyodide.globals.set("INPUTS", inputs);
        window.pyodide.globals.set("USER_CODE", code);

        const result = await window.pyodide.runPythonAsync(`
import sys, io, builtins
inputs = list(INPUTS)

def input(prompt=""):
    return inputs.pop(0) if inputs else ""

builtins.input = input
_buffer = io.StringIO()
_old = sys.stdout
sys.stdout = _buffer
try:
    exec(USER_CODE, {})
finally:
    sys.stdout = _old
_buffer.getvalue()
        `);

        outputEl.textContent = result || "(no output)";
        if (statusEl) statusEl.textContent = "Python ready.";
    } catch (err) {
        outputEl.textContent = "Error running code: " + err.message;
        if (statusEl) statusEl.textContent = "Python error.";
    } finally {
        runBtn.textContent = "Run Program";
        runBtn.disabled = programEl.value.trim().length === 0;
        if (spinner) spinner.classList.add("is-hidden");
    }
};

document.addEventListener("input", (event) => {
    if (event.target && event.target.id === "makeProgram") {
        enableRunButton();
    }
    if (event.target && (event.target.matches("input[type='text'], textarea") || event.target.id === "makeProgram")) {
        saveStepperState();
    }
});

document.addEventListener("change", (event) => {
    if (!event.target) return;
    if (event.target.matches("input[type='radio'], input[type='checkbox'], select")) {
        saveStepperState();
    }
});

document.addEventListener("DOMContentLoaded", async () => {
    const teacherModeReady = initTeacherMode();
    if (!teacherModeReady) return;
    if (hasApiAdapter()) {
        try {
            await window.N5Api.init();
            await hydrateProgressFromApi();
        } catch {
            // Keep local-only mode when backend auth/API is unavailable.
        }
    }
    initAuthUX();
    initTeacherNavEntry();
    enforceRoleAccess();
    initTeacherAccessNotice();
    if (document.body.classList.contains("page-teacher")) {
        initTeacherPasscodeGate();
        const canUseTeacherPanel = !hasApiAdapter() || (isApiLoggedIn() && getApiUserRole() === "teacher");
        if (hasApiAdapter() && !canUseTeacherPanel) {
            const lockedCard = document.querySelector("[data-student-only] p");
            if (lockedCard) {
                lockedCard.textContent = isApiLoggedIn()
                    ? "A teacher account is required to access this page."
                    : "Please sign in with a teacher account to continue.";
            }
        }
        if (canUseTeacherPanel) initTeacherSummaryPanel();
    }
    initAccessibilityEnhancements();
    initAppbarEnhancements();
    initLearningDashboard();
    initWorksheetActions();
    initBackToTopFab();
    initExamplesShowcase();
    initHomeCardReveal();
    initDefaultTooltipCopy();
    initGlassTooltips();
    initAssessmentGate();
    initExpanderAnimations();
    initAdaptiveHints();
    enableRunButton();
    updateExpectedOutput();
    const statusEl = document.getElementById("runStatus");
    if (statusEl) statusEl.textContent = "Python runtime ready when you run.";
    const spinner = document.querySelector(".spinner");
    if (spinner) spinner.classList.add("is-hidden");
    initExample1PredictionDependency();
    initStepper();
});
