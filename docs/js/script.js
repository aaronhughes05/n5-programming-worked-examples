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

const HINT_MODEL = {
    "example1.html": {
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
        }
    },
    "example2.html": {
        tick1: {
            l1: "Focus on the loop line. How many item entries are required?",
            l2: "Check the worked code: `range(5)` means the loop runs 5 times.",
            l3: "Your answer should be the count of loop repetitions, not the final total.",
            worked: "Because the program asks for 5 items, the loop repeats 5 times."
        },
        parsonsFeedback: {
            l1: "Think setup first, then loop, then update, then final output.",
            l2: "Initialize `total` before the loop starts.",
            l3: "Order pattern: initialize -> loop header -> update inside loop -> print after loop.",
            worked: "Correct order: `total = 0`, `for ...`, `total = total + price`, `print(total)`."
        },
        tick2: {
            l1: "Only the number in the range changes from 5 to 10.",
            l2: "Keep the loop variable and syntax exactly the same.",
            l3: "Write the full line including colon at the end.",
            worked: "Use: `for counter in range(10):`"
        }
    },
    "assessment.html": {
        tick1: { l1: "Look at the required item count.", l2: "The loop count matches the number of prices collected.", l3: "Use the exact numeric count.", worked: "The loop repeats 5 times." },
        tick2: { l1: "Which loop keeps checking until input is valid?", l2: "Validation usually repeats while a bad condition is true.", l3: "Negative-price checking uses `while`.", worked: "Use `while` for repeated validation." },
        tick3: { l1: "Find the variable that accumulates values.", l2: "It starts at zero and is updated each loop.", l3: "Look for `total = total + ...`.", worked: "The running total variable is `total`." },
        tick4: { l1: "Should valid prices be kept for later traversal?", l2: "The program prints each value later, so it must store them.", l3: "The list is required for step D traversal.", worked: "Yes, valid prices should be stored in the list." },
        sgA1Tick: { l1: "This line creates starting state.", l2: "Subgoal A is initialization/setup.", l3: "`total = 0` belongs to setup.", worked: "Answer: A." },
        sgB1Tick: { l1: "Subgoal B is the repeating loop.", l2: "Pick the line that repeats exactly 5 times.", l3: "Look for the `for counter in range(5):` line.", worked: "Correct line: `for counter in range(5):`." },
        sgC1Tick: { l1: "What gets added into total each cycle?", l2: "The blank is the current valid input value.", l3: "Use the same variable read from input.", worked: "Fill with `price`." },
        sgD1Tick: { l1: "This line traverses items for display.", l2: "Traversal/processing list values is subgoal D.", l3: "Map line purpose, not syntax shape.", worked: "Answer: D." },
        sgE1Tick: { l1: "Update total cumulatively row by row.", l2: "Start from 0, then add each new input.", l3: "Totals should be 2, then 5, then 9.", worked: "Running totals: 2, 5, 9." },
        assessmentFeedback: { l1: "Order by problem flow: setup -> input loop -> validate -> store/update -> output.", l2: "Ensure validation (`while`) sits inside the main loop.", l3: "Average is calculated after data collection and before final prints.", worked: "Use the sequence shown in the expected arrangement for each stage." },
        makeOutputTick: { l1: "Compare formatting and values against expected output.", l2: "Check spacing, commas, and order of lines.", l3: "Ensure totals/averages are computed from the chosen test case.", worked: "Match expected output exactly after running your program." }
    }
};

const FEEDBACK_MAP = {
    "example1.html": {
        tick1: {
            correct: "We will need a loop here to repeatedly query the user until they provide a valid input.",
            incorrect: "Try again.",
            next: "Review the subgoals and consider how you would implement them in code."
        },
        tick2: {
            correct: "A while loop is required here, as we want to loop until a condition (valid input has been provided) is met.",
            incorrect: "Try again.",
            next: "Review the subgoals and consider how you would implement them in code."
        }
    },
    "example2.html": {
        tick1: {
            correct: "Good prediction. You matched the fixed loop count.",
            incorrect: "Not quite yet.",
            misconception: "You may be mixing up number of loop runs with the final total value.",
            next: "Re-check the loop header and count how many item entries are required."
        },
        parsonsFeedback: {
            correct: "Great ordering. The logic now flows from setup to output correctly.",
            incorrect: "The sequence is still off.",
            misconception: "A common issue is placing `print(total)` inside the loop or skipping initialization first.",
            next: "Order the blocks as initialize -> loop -> update total -> print."
        },
        tick2: {
            correct: "Correct modification. You adjusted only the loop range target.",
            incorrect: "Close, but the loop line is not exact yet.",
            misconception: "You may have changed the loop structure instead of only changing the range value.",
            next: "Keep the same syntax and replace only `5` with `10`, including the colon."
        }
    },
    "assessment.html": {
        tick1: { correct: "Correct. The loop count matches the number of required inputs.", incorrect: "Not correct yet.", misconception: "You may be counting outputs instead of input iterations.", next: "Use the problem statement to confirm how many prices are entered." },
        tick2: { correct: "Correct. `while` is appropriate for repeated validation.", incorrect: "That loop choice is not best here.", misconception: "You may be choosing `for` when the number of retries is unknown.", next: "Pick the loop that repeats until input is valid." },
        tick3: { correct: "Correct. You identified the accumulator variable.", incorrect: "Not quite.", misconception: "You may be naming the list variable instead of the running total variable.", next: "Find the variable initialized to 0 and updated each iteration." },
        tick4: { correct: "Correct. Valid values should be stored for traversal later.", incorrect: "Not correct yet.", misconception: "You may think total alone is enough, but printing each item requires stored values.", next: "Check the later step that loops through `items`." },
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
    if (attemptCount >= 2 && entry.misconception) {
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
        updatedAt: Date.now(),
        completedChecks,
        inputs,
        makeProgram: programEl ? programEl.value : "",
        makeCase: caseSelect ? caseSelect.value : "case1",
        makeActual: actualEl ? actualEl.textContent : "",
        showWorkedExample: stepperState.showWorkedExample
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
            if (input) {
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
    updateStepperState();
    saveStepperState();
};

const setFeedbackState = (el, correct, message, checkpointId = null) => {
    if (!el) return;
    const effectiveCheckpointId = checkpointId || el.id;
    updateHintCheckpointResult(effectiveCheckpointId, correct);
    el.dataset.correct = correct ? "true" : "false";
    el.textContent = buildTargetedFeedback(effectiveCheckpointId, correct, message);
    el.style.color = correct ? "var(--teal-500)" : "#e63946";
    el.style.fontWeight = "600";
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
        setFeedbackState(feedback, true, "✔ Excellent! The logic is in the correct order.", feedbackId);
    } else {
        setFeedbackState(feedback, false, "✖ Try again. Think: Initialize -> Loop -> Process -> Output.", feedbackId);
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

    const expectedOutputs = {
        case1: "Scores: 2, 3, 4, 5, 6, 7\nTotal: 27\nAverage: 4.5",
        case2: "Scores: 0, 10, 20, 30, 40, 50\nTotal: 150\nAverage: 25.0",
        case3: "Scores: 5, 5, 5, 5, 5, 5\nTotal: 30\nAverage: 5.0"
    };

    const selectedCase = caseSelect.value;
    const expected = expectedOutputs[selectedCase] || "";
    const userOutput = outputEl.value;

    setTickState(tick, normalizeOutput(userOutput) === normalizeOutput(expected), tickId);
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
    document.querySelectorAll("input[type='text']").forEach((input) => {
        input.value = "";
    });
    document.querySelectorAll("input[type='radio'], input[type='checkbox']").forEach((input) => {
        input.checked = false;
    });
    document.querySelectorAll(".rich-feedback").forEach((el) => {
        el.remove();
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
    const inPagesDir = window.location.pathname.includes("/docs/pages/");
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
    let payload = null;
    const lowerSuffixes = (pathSuffixes || []).map((suffix) => String(suffix || "").toLowerCase());
    if (!lowerSuffixes.length) {
        return { hintsUsed: 0, workedRevealed: 0 };
    }

    for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(HINT_STORAGE_PREFIX)) continue;
        const path = key.slice(HINT_STORAGE_PREFIX.length).toLowerCase();
        const matches = lowerSuffixes.some((suffix) => path.endsWith(suffix));
        if (!matches) continue;

        try {
            payload = JSON.parse(localStorage.getItem(key) || "{}");
        } catch {
            payload = null;
        }
        break;
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
        if (el.classList.contains("appbar-resume")) return "Resume your saved progress";
        if (el.hasAttribute("data-print-worksheet")) return "Print this worksheet";
        if (el.hasAttribute("data-download-worksheet")) return "Download this worksheet";

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
    initAdaptiveHints();
    enableRunButton();
    updateExpectedOutput();
    const statusEl = document.getElementById("runStatus");
    if (statusEl) statusEl.textContent = "Python runtime ready when you run.";
    const spinner = document.querySelector(".spinner");
    if (spinner) spinner.classList.add("is-hidden");
    initStepper();
});
