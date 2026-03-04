const nextStep = (current, next) => {
    const currentStep = document.getElementById(`step${current}`);
    const nextEl = document.getElementById(next === 'full' ? 'fullCode' : `step${next}`);
    
    if (currentStep) currentStep.classList.add('hidden');
    if (nextEl) {
        nextEl.classList.remove('hidden');
        if (nextEl.id === "fullCode") {
            nextEl.dataset.correct = "true";
            updateStepperState();
        }
    }
};

let stepperState = {
    sections: [],
    index: 0,
    completed: false
};

const STORAGE_NAMESPACE = "assessmentStepperState.v2";
const getStorageKey = () => `${STORAGE_NAMESPACE}:${window.location.pathname}`;

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

const saveStepperState = () => {
    if (!stepperState.sections.length) return;
    const completedChecks = [];
    document.querySelectorAll("[data-correct='true']").forEach((el) => {
        if (el.id) completedChecks.push(el.id);
    });

    const inputs = {};
    document.querySelectorAll("input[type='text']").forEach((input) => {
        if (input.id) {
            inputs[input.id] = input.value;
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
        completedChecks,
        inputs,
        makeProgram: programEl ? programEl.value : "",
        makeCase: caseSelect ? caseSelect.value : "case1",
        makeActual: actualEl ? actualEl.textContent : ""
    };

    writeStorage(getStorageKey(), JSON.stringify(payload));
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
                    if (!el.textContent) {
                        el.textContent = " ✔ Correct";
                    }
                    el.style.color = "var(--teal-500)";
                }
            }
        });
    }

    if (payload.inputs && typeof payload.inputs === "object") {
        Object.entries(payload.inputs).forEach(([id, value]) => {
            const input = document.getElementById(id);
            if (input) {
                input.value = value;
            }
        });
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
        showStep(Math.min(payload.index, stepperState.sections.length - 1));
        stepperState.completed = payload.isComplete === true || payload.completed === true;
        return true;
    }
    return false;
};

const setTickState = (tick, correct) => {
    if (!tick) return;
    tick.dataset.correct = correct ? "true" : "false";
    tick.style.display = "inline";
    tick.textContent = correct ? " ✔ Correct" : " ✖ Try again";
    tick.style.color = correct ? "var(--teal-500)" : "#e63946";
    updateStepperState();
    saveStepperState();
};

const setFeedbackState = (el, correct, message) => {
    if (!el) return;
    el.dataset.correct = correct ? "true" : "false";
    el.textContent = message;
    el.style.color = correct ? "var(--teal-500)" : "#e63946";
    el.style.fontWeight = "700";
    updateStepperState();
    saveStepperState();
};

const checkAnswer = (inputId, correctAnswer, tickId) => {
    const inputField = document.getElementById(inputId);
    const userInput = inputField.value.trim().toLowerCase();
    const tick = document.getElementById(tickId);
    
    const cleanCorrect = correctAnswer.toLowerCase().replace(/\s/g, '');
    const cleanUser = userInput.replace(/\s/g, '');

    setTickState(tick, cleanUser === cleanCorrect);
};

const checkRadioButton = (inputId, tickId) => {
    const inputField = document.getElementById(inputId);
    const tick = document.getElementById(tickId);

    setTickState(tick, inputField.checked);
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
        setFeedbackState(feedback, true, "✔ Excellent! The logic is in the correct order.");
    } else {
        setFeedbackState(feedback, false, "✖ Try again. Think: Initialize -> Loop -> Process -> Output.");
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
    setTickState(tick, selected === correct);
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
    setTickState(tick, selected === correct);
};

const checkTrace = (inputIds, expectedValues, tickId) => {
    const tick = document.getElementById(tickId);
    const isCorrect = inputIds.every((id, idx) => {
        const el = document.getElementById(id);
        if (!el) return false;
        return el.value.trim() === expectedValues[idx];
    });

    setTickState(tick, isCorrect);
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

    const expectedOutputs = {
        case1: "Scores: 2, 3, 4, 5, 6, 7\nTotal: 27\nAverage: 4.5",
        case2: "Scores: 0, 10, 20, 30, 40, 50\nTotal: 150\nAverage: 25.0",
        case3: "Scores: 5, 5, 5, 5, 5, 5\nTotal: 30\nAverage: 5.0"
    };

    const selectedCase = caseSelect.value;
    const expected = expectedOutputs[selectedCase] || "";
    const userOutput = outputEl.value;

    if (normalizeOutput(userOutput) === normalizeOutput(expected)) {
        tick.style.display = "inline";
        tick.textContent = " ✔ Correct";
        tick.style.color = "var(--teal-500)";
    } else {
        tick.style.display = "inline";
        tick.textContent = " ✖ Try again";
        tick.style.color = "#e63946";
    }
};

const updateExpectedOutput = () => {
    const caseSelect = document.getElementById("makeCase");
    const expectedEl = document.getElementById("makeExpected");
    if (!caseSelect || !expectedEl) return;

    const expectedOutputs = {
        case1: "Scores: 2, 3, 4, 5, 6, 7\nTotal: 27\nAverage: 4.5",
        case2: "Scores: 0, 10, 20, 30, 40, 50\nTotal: 150\nAverage: 25.0",
        case3: "Scores: 5, 5, 5, 5, 5, 5\nTotal: 30\nAverage: 5.0"
    };

    expectedEl.textContent = expectedOutputs[caseSelect.value] || "";
};

const checkActualOutput = (caseSelectId, actualOutputId, tickId) => {
    const caseSelect = document.getElementById(caseSelectId);
    const actualEl = document.getElementById(actualOutputId);
    const tick = document.getElementById(tickId);
    if (!caseSelect || !actualEl || !tick) return;

    const expectedOutputs = {
        case1: "Scores: 2, 3, 4, 5, 6, 7\nTotal: 27\nAverage: 4.5",
        case2: "Scores: 0, 10, 20, 30, 40, 50\nTotal: 150\nAverage: 25.0",
        case3: "Scores: 5, 5, 5, 5, 5, 5\nTotal: 30\nAverage: 5.0"
    };

    const expected = expectedOutputs[caseSelect.value] || "";
    const actual = actualEl.textContent || "";

    setTickState(tick, normalizeOutput(actual) === normalizeOutput(expected));
};

const markComplete = (tickId) => {
    const tick = document.getElementById(tickId);
    if (!tick) return;
    tick.dataset.correct = "true";
    tick.style.display = "inline";
    tick.textContent = " ✔ Correct";
    tick.style.color = "var(--teal-500)";
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
};

const showStep = (index) => {
    stepperState.sections.forEach((section, i) => {
        section.classList.toggle("active", i === index);
    });
    stepperState.index = index;

    const progress = document.getElementById("stepperProgress");
    const prevBtn = document.getElementById("stepPrev");
    const nextBtn = document.getElementById("stepNext");
    const completion = document.getElementById("completionScreen");
    const barFill = document.getElementById("stepperBarFill");
    if (progress) {
        progress.textContent = `Step ${index + 1} of ${stepperState.sections.length}`;
    }
    if (prevBtn) prevBtn.disabled = index === 0;
    if (nextBtn) nextBtn.textContent = index === stepperState.sections.length - 1 ? "Finish" : "Next";
    if (completion) completion.classList.remove("is-visible");
    stepperState.completed = false;
    document.body.classList.remove("is-complete");
    if (barFill) {
        const pct = ((index + 1) / stepperState.sections.length) * 100;
        barFill.style.width = `${pct}%`;
    }
    updateStepperState();
    saveStepperState();
};

const initStepper = () => {
    const sections = Array.from(document.querySelectorAll(".step-section"));
    if (!sections.length) return;
    stepperState.sections = sections;
    const restored = loadStepperState();
    if (!restored) {
        showStep(0);
    }

    const prevBtn = document.getElementById("stepPrev");
    const nextBtn = document.getElementById("stepNext");
    if (prevBtn) {
        prevBtn.addEventListener("click", () => {
            if (stepperState.index > 0) {
                showStep(stepperState.index - 1);
            }
        });
    }
    if (nextBtn) {
        nextBtn.addEventListener("click", () => {
            if (!isStepComplete(stepperState.sections[stepperState.index])) return;
            if (stepperState.index < stepperState.sections.length - 1) {
                showStep(stepperState.index + 1);
            } else {
                const completion = document.getElementById("completionScreen");
                if (completion) completion.classList.add("is-visible");
                document.body.classList.add("is-complete");
                stepperState.completed = true;
                const completionCard = document.querySelector("#completionScreen .completion-card");
                if (completionCard) completionCard.scrollIntoView({ behavior: "smooth" });
            }
            saveStepperState();
        });
    }
};

const restartStepper = () => {
    const completion = document.getElementById("completionScreen");
    if (completion) completion.classList.remove("is-visible");
    document.body.classList.remove("is-complete");
    stepperState.completed = false;
    showStep(0);
    const main = document.querySelector("main.content");
    if (main) main.scrollIntoView({ behavior: "smooth" });
    removeStorage(getStorageKey());
};

const resetAssessment = () => {
    removeStorage(getStorageKey());
    document.querySelectorAll("[data-correct='true']").forEach((el) => {
        delete el.dataset.correct;
    });
    document.querySelectorAll(".tick-mark").forEach((tick) => {
        tick.style.display = "none";
        tick.textContent = "";
    });
    document.querySelectorAll("input[type='text']").forEach((input) => {
        input.value = "";
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
    const completion = document.getElementById("completionScreen");
    if (completion) completion.classList.remove("is-visible");
    document.body.classList.remove("is-complete");
    stepperState.completed = false;
    showStep(0);
};

const getMakeInputs = (caseValue) => {
    if (caseValue === "case1") return ["2", "3", "4", "5", "6", "7"];
    if (caseValue === "case2") return ["0", "10", "20", "30", "40", "50"];
    if (caseValue === "case3") return ["5", "5", "5", "5", "5", "5"];
    return [];
};

const enableRunButton = () => {
    const programEl = document.getElementById("makeProgram");
    const runBtn = document.getElementById("runProgramBtn");
    if (!programEl || !runBtn) return;
    runBtn.disabled = programEl.value.trim().length === 0;
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
    const storagePrefix = "assessmentStepperState.v2:";
    let best = null;

    for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(storagePrefix)) continue;
        const path = key.slice(storagePrefix.length);
        if (!path.includes("/pages/")) continue;

        let payload;
        try {
            payload = JSON.parse(localStorage.getItem(key) || "{}");
        } catch {
            continue;
        }

        const stepCount = Number(payload.stepCount || 0);
        const index = Number(payload.index || 0);
        if (stepCount < 2 || index <= 0) continue;

        const progress = index / (stepCount - 1);
        if (!best || progress > best.progress) {
            best = { path, progress };
        }
    }

    if (!best) return;
    const inPagesDir = window.location.pathname.includes("/docs/pages/");
    const docsMarker = "/docs/";
    let href = "pages/example1.html";
    const markerIndex = best.path.lastIndexOf(docsMarker);
    if (markerIndex !== -1) {
        href = best.path.slice(markerIndex + docsMarker.length);
    }
    if (inPagesDir && href.startsWith("pages/")) {
        href = `../${href}`;
    }
    resumeLink.href = href;
    resumeLink.hidden = false;
    resumeLink.title = "Resume your latest progress";
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
            image: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=960&q=80",
            alt: "Numbers and calculator representing totals"
        },
        example3: {
            kicker: "Example 3",
            title: "Array Traversal",
            description: "Work through list data item by item and apply the same logic cleanly across each value.",
            href: "pages/example3.html",
            cta: "Start Example 3",
            image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=960&q=80",
            alt: "Data dashboard representing arrays and values"
        },
        assessment: {
            kicker: "Final Assessment",
            title: "Combining Concepts",
            description: "Bring validation, totals, and traversal together in one mixed challenge to check understanding.",
            href: "pages/assessment.html",
            cta: "Start Assessment",
            image: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=960&q=80",
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
        if (el.classList.contains("appbar-resume")) return "Resume your saved progress";

        if (id === "stepprev") return "Go to previous step";
        if (id === "stepnext") return "Go to next step";
        if (id === "stepreset") return "Restart from step 1";
        if (id === "runprogrambtn") return "Run your code with the selected test case";
        if (id === "examplepreviewlink") return "Open this previewed activity";

        if (el.classList.contains("examples-tab")) {
            const key = (el.dataset.exampleKey || "").toLowerCase();
            if (key === "example1") return "Preview example 1";
            if (key === "example2") return "Preview example 2";
            if (key === "example3") return "Preview example 3";
            if (key === "assessment") return "Preview final assessment";
            return "Preview this activity";
        }

        if (onclick.includes("verifyparsons")) return `Verify your order${sectionLabel}`;
        if (onclick.includes("checkactualoutput")) return "Check your program output";
        if (onclick.includes("checktrace")) return `Check your trace${sectionLabel}`;
        if (onclick.includes("checklinechoice")) return `Check your line choice${sectionLabel}`;
        if (onclick.includes("checkchoice")) return `Check your selected subgoal${sectionLabel}`;
        if (onclick.includes("checkanswer")) return `Check your answer${sectionLabel}`;
        if (onclick.includes("runprogram")) return "Run your code with the selected test case";
        if (onclick.includes("resetassessment")) return "Restart this activity";
        if (onclick.includes("nextstep")) return "Show the next code step";
        if (onclick.includes("show full code")) return "Reveal the full solution";

        if (lower.includes("menu")) return "Show quick links";
        if (lower.includes("home")) return "Go to homepage";
        if (lower.includes("examples")) return "Jump to examples";
        if (lower.includes("assessment")) return "Open assessment";
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
        if (lower.includes("preview")) return "Preview this section";
        if (lower.includes("example 1")) return "Preview example 1";
        if (lower.includes("example 2")) return "Preview example 2";
        if (lower.includes("example 3")) return "Preview example 3";
        if (href.includes("#examples")) return "Jump to examples";
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
    const inPagesDir = window.location.pathname.includes("/docs/pages/");
    const toExampleHref = (fileName) => (inPagesDir ? fileName : `pages/${fileName}`);
    const requiredExamples = [
        { suffix: "/docs/pages/example1.html", label: "Example 1", href: toExampleHref("example1.html") },
        { suffix: "/docs/pages/example2.html", label: "Example 2", href: toExampleHref("example2.html") },
        { suffix: "/docs/pages/example3.html", label: "Example 3", href: toExampleHref("example3.html") }
    ];

    const readExampleCompletion = (suffix) => {
        try {
            for (let i = 0; i < localStorage.length; i += 1) {
                const key = localStorage.key(i);
                if (!key || !key.startsWith(STORAGE_PREFIX)) continue;
                const path = key.slice(STORAGE_PREFIX.length);
                if (!path.endsWith(suffix)) continue;

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
            complete: readExampleCompletion(ex.suffix)
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
    if (event.target && (event.target.matches("input[type='text']") || event.target.id === "makeProgram")) {
        saveStepperState();
    }
});

document.addEventListener("DOMContentLoaded", () => {
    initAppbarEnhancements();
    initBackToTopFab();
    initExamplesShowcase();
    initHomeCardReveal();
    initDefaultTooltipCopy();
    initGlassTooltips();
    initAssessmentGate();
    enableRunButton();
    updateExpectedOutput();
    const statusEl = document.getElementById("runStatus");
    if (statusEl) statusEl.textContent = "Python runtime ready when you run.";
    const spinner = document.querySelector(".spinner");
    if (spinner) spinner.classList.add("is-hidden");
    initStepper();
});
