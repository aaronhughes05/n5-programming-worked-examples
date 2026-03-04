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
    index: 0
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
    const completed = [];
    document.querySelectorAll("[data-correct='true']").forEach((el) => {
        if (el.id) completed.push(el.id);
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
        completed,
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

    if (Array.isArray(payload.completed)) {
        payload.completed.forEach((id) => {
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
    enableRunButton();
    updateExpectedOutput();
    const statusEl = document.getElementById("runStatus");
    if (statusEl) statusEl.textContent = "Python runtime ready when you run.";
    const spinner = document.querySelector(".spinner");
    if (spinner) spinner.classList.add("is-hidden");
    initStepper();
});
