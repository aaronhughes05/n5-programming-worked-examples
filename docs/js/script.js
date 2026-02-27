const nextStep = (current, next) => {
    const currentStep = document.getElementById(`step${current}`);
    const nextEl = document.getElementById(next === 'full' ? 'fullCode' : `step${next}`);
    
    if (currentStep) currentStep.classList.add('hidden');
    if (nextEl) nextEl.classList.remove('hidden');
};

const checkAnswer = (inputId, correctAnswer, tickId) => {
    const inputField = document.getElementById(inputId);
    const userInput = inputField.value.trim().toLowerCase();
    const tick = document.getElementById(tickId);
    
    const cleanCorrect = correctAnswer.toLowerCase().replace(/\s/g, '');
    const cleanUser = userInput.replace(/\s/g, '');

    if (cleanUser === cleanCorrect) {
        tick.style.display = "inline";
        tick.textContent = " ✔ Correct";
        tick.style.color = "var(--teal-500)";
    } else {
        tick.style.display = "inline";
        tick.textContent = " ✖ Try again";
        tick.style.color = "#e63946";
    }
};

function allowDrop(ev) {
    ev.preventDefault();
}

function drag(ev) {
    ev.dataTransfer.setData("text", ev.target.id);
}

function drop(ev) {
    ev.preventDefault();
    const data = ev.dataTransfer.getData("text");
    const draggedElement = document.getElementById(data);
    const dropTarget = ev.target.closest('.parsons-container');
    
    if (dropTarget) {
        dropTarget.appendChild(draggedElement);
    }
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
        feedback.textContent = "✔ Excellent! The logic is in the correct order.";
        feedback.style.color = "var(--teal-500)";
    } else {
        feedback.textContent = "✖ Try again. Think: Initialize -> Loop -> Process -> Output.";
        feedback.style.color = "#e63946";
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
    if (selected === correct) {
        tick.style.display = "inline";
        tick.textContent = " ✔ Correct";
        tick.style.color = "var(--teal-500)";
    } else {
        tick.style.display = "inline";
        tick.textContent = " ✖ Try again";
        tick.style.color = "#e63946";
    }
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
    if (selected === correct) {
        tick.style.display = "inline";
        tick.textContent = " ✔ Correct";
        tick.style.color = "var(--teal-500)";
    } else {
        tick.style.display = "inline";
        tick.textContent = " ✖ Try again";
        tick.style.color = "#e63946";
    }
};

const checkTrace = (inputIds, expectedValues, tickId) => {
    const tick = document.getElementById(tickId);
    const isCorrect = inputIds.every((id, idx) => {
        const el = document.getElementById(id);
        if (!el) return false;
        return el.value.trim() === expectedValues[idx];
    });

    if (isCorrect) {
        tick.style.display = "inline";
        tick.textContent = " ✔ Correct";
        tick.style.color = "var(--teal-500)";
    } else {
        tick.style.display = "inline";
        tick.textContent = " ✖ Try again";
        tick.style.color = "#e63946";
    }
};
