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

const setTickState = (tick, correct) => {
    if (!tick) return;
    tick.dataset.correct = correct ? "true" : "false";
    tick.style.display = "inline";
    tick.textContent = correct ? " ✔ Correct" : " ✖ Try again";
    tick.style.color = correct ? "var(--teal-500)" : "#e63946";
    updateStepperState();
};

const setFeedbackState = (el, correct, message) => {
    if (!el) return;
    el.dataset.correct = correct ? "true" : "false";
    el.textContent = message;
    el.style.color = correct ? "var(--teal-500)" : "#e63946";
    updateStepperState();
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

const updateStepperState = () => {
    const current = stepperState.sections[stepperState.index];
    const nextBtn = document.getElementById("stepNext");
    const note = document.getElementById("stepperNote");
    if (!current || !nextBtn || !note) return;
    const complete = isStepComplete(current);
    nextBtn.disabled = !complete;
    note.textContent = complete ? "Ready to continue." : "Complete the activity to continue.";
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
    if (progress) {
        progress.textContent = `Step ${index + 1} of ${stepperState.sections.length}`;
    }
    if (prevBtn) prevBtn.disabled = index === 0;
    if (nextBtn) nextBtn.textContent = index === stepperState.sections.length - 1 ? "Finish" : "Next";
    if (completion) completion.classList.remove("is-visible");
    updateStepperState();
};

const initStepper = () => {
    const sections = Array.from(document.querySelectorAll(".step-section"));
    if (!sections.length) return;
    stepperState.sections = sections;
    showStep(0);

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
});

document.addEventListener("DOMContentLoaded", () => {
    enableRunButton();
    updateExpectedOutput();
    const statusEl = document.getElementById("runStatus");
    if (statusEl) statusEl.textContent = "Python runtime ready when you run.";
    const spinner = document.querySelector(".spinner");
    if (spinner) spinner.classList.add("is-hidden");
    initStepper();
});
