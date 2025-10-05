// Wait for the DOM to be fully loaded before running the script
document.addEventListener('DOMContentLoaded', () => {

    // --- STATE MANAGEMENT ---
        // --- LOCAL STORAGE KEYS ---
        const LS_SCORE = 'aware_score';
        const LS_ANSWERED = 'aware_answered';
        const LS_UNLOCKED = 'aware_unlocked';

        // --- STATE MANAGEMENT ---
        let score = 0;
        const tasks = document.querySelectorAll('.task');
        // Correctly counts all individual quiz containers for the total score
        const totalQuestions = document.querySelectorAll('.quiz').length; 
        let answeredCorrectlyCount = 0;
        let answeredQuizIds = new Set(); // stores quiz ids (or indexes) that are answered
        let unlockedTaskIds = new Set(); // stores unlocked task ids

    // --- ELEMENT SELECTORS ---
    const scoreEl = document.getElementById('score');
    const totalQuestionsEl = document.getElementById('total-questions');
    const progressEl = document.getElementById('progress');
    const customAlertOverlay = document.getElementById('custom-alert-overlay');
    const customAlertCloseBtn = document.getElementById('custom-alert-close');
        const resetBtn = document.getElementById('reset-progress');
    
    /**
     * Initializes the game state and sets up event listeners.
     */
    function initializeGame() {
    // Restore state from localStorage
    restoreStateFromLocalStorage();
    totalQuestionsEl.textContent = totalQuestions;
    scoreEl.textContent = score;
    updateProgress();
    setupEventListeners();
    restoreUIState();
    }

    /**
     * Sets up all necessary event listeners for the application.
     */
    function setupEventListeners() {
        tasks.forEach((task, taskIdx) => {
            const header = task.querySelector('.task-header');
            header.addEventListener('click', () => handleTaskHeaderClick(task));

            // Attach listeners to all options within this task
            const options = task.querySelectorAll('.option');
            options.forEach((option, quizIdx) => {
                option.addEventListener('click', () => handleOptionClick(option, task, quizIdx));
            });

            const nextButton = task.querySelector('.btn-next');
            if (nextButton) {
                nextButton.addEventListener('click', () => handleNextButtonClick(task));
            }
        });

        // Listeners for the custom alert modal
        customAlertCloseBtn.addEventListener('click', hideCustomAlert);
        customAlertOverlay.addEventListener('click', (e) => {
             if (e.target === customAlertOverlay) hideCustomAlert();
        });
            // Listener for reset button
            if (resetBtn) {
                resetBtn.addEventListener('click', () => {
                    localStorage.removeItem(LS_SCORE);
                    localStorage.removeItem(LS_ANSWERED);
                    localStorage.removeItem(LS_UNLOCKED);
                    location.reload();
                });
            }
    }
    
    /**
     * Handles clicks on a task header, showing a warning if locked or toggling visibility if unlocked.
     * @param {HTMLElement} task - The task element that was clicked.
     */
    function handleTaskHeaderClick(task) {
        if (task.classList.contains('locked')) {
            showCustomAlert('Task Locked!', 'You must complete the previous tasks to unlock this one.');
        } else {
            // Close other active tasks to keep the UI clean
            document.querySelectorAll('.task.active').forEach(activeTask => {
                if (activeTask !== task) activeTask.classList.remove('active');
            });
            task.classList.toggle('active');
        }
    }

    /**
     * Handles the logic when a user clicks on a quiz option.
     * @param {HTMLElement} selectedOption - The specific option div that was clicked.
     * @param {HTMLElement} currentTask - The parent task element containing the quiz.
     */
    function handleOptionClick(selectedOption, currentTask) {
        const quiz = selectedOption.closest('.quiz');
        // Use a unique quiz id: task id + quiz index
        const quizId = `${currentTask.id}_${Array.from(currentTask.querySelectorAll('.quiz')).indexOf(quiz)}`;
        // Prevent re-answering a single quiz that has already been answered correctly (even after reload)
        if (answeredQuizIds.has(quizId)) return;

        const options = quiz.querySelectorAll('.option');
        const feedbackCorrect = quiz.querySelector('.feedback.correct');
        const feedbackIncorrect = quiz.querySelector('.feedback.incorrect');
        const isCorrect = selectedOption.dataset.correct === 'true';

        // First, reset the state of all options in this quiz
        options.forEach(opt => opt.classList.remove('correct', 'incorrect'));
        feedbackCorrect.style.display = 'none';
        feedbackIncorrect.style.display = 'none';

        if (isCorrect) {
            selectedOption.classList.add('correct');
            feedbackCorrect.style.display = 'block';
            quiz.classList.add('answered'); // Mark this specific question as answered
            options.forEach(opt => opt.style.cursor = 'not-allowed'); // Change cursor to show it's done

            // Update overall score and progress only on the first correct answer
            score++;
            answeredCorrectlyCount++;
            scoreEl.textContent = score;
            updateProgress();

            // Save answered quiz to localStorage
            answeredQuizIds.add(quizId);
            saveStateToLocalStorage();

            // Check if all questions in the CURRENT task are now answered
            const totalInTask = parseInt(currentTask.dataset.questionsTotal);
            const answeredInTask = currentTask.querySelectorAll('.quiz.answered').length;

            if (answeredInTask >= totalInTask) {
                const nextButton = currentTask.querySelector('.btn-next');
                if (nextButton) nextButton.disabled = false; // Enable the "Next Task" button
                // Save unlocked task
                unlockedTaskIds.add(currentTask.id);
                saveStateToLocalStorage();
            }
        } else {
            selectedOption.classList.add('incorrect');
            feedbackIncorrect.style.display = 'block';
        }
    }

    /**
     * Handles moving to the next task or finishing the game.
     * @param {HTMLElement} currentTask - The task being completed.
     */
    function handleNextButtonClick(currentTask) {
        currentTask.classList.remove('active');
        const currentTaskId = parseInt(currentTask.id.replace('task', ''));
        const nextTaskId = `task${currentTaskId + 1}`;
        const nextTask = document.getElementById(nextTaskId);

        if (nextTask) {
            unlockAndActivateTask(nextTask);
            unlockedTaskIds.add(nextTask.id);
            saveStateToLocalStorage();
        } else {
            // This was the last task
            showCustomAlert('Congratulations!', `You've completed the Cyber Trap Room! Your final score is ${score}/${totalQuestions}. Keep an eye out for phishing attempts!`);
        }
    }
    
    /**
     * Unlocks a task, updates its badge, and makes it the active view.
     * @param {HTMLElement} task - The task element to unlock.
     */
    function unlockAndActivateTask(task) {
        task.classList.remove('locked');
        task.classList.add('active');

        const badge = task.querySelector('.locked-badge');
        if (badge) {
            badge.textContent = 'Unlocked';
            badge.classList.remove('locked-badge');
            badge.classList.add('unlocked-badge');
        }
    }

    /**
     * Updates the main progress bar based on the number of correctly answered questions.
     */
    function updateProgress() {
    const percentage = totalQuestions > 0 ? (answeredCorrectlyCount / totalQuestions) * 100 : 0;
    progressEl.style.width = `${percentage}%`;
    }

    /**
     * Displays the custom notification box with a given title and message.
     * @param {string} title - The title for the alert.
     * @param {string} message - The body text for the alert.
     */
    function showCustomAlert(title, message) {
        document.getElementById('custom-alert-title').textContent = title;
        document.getElementById('custom-alert-message').textContent = message;
        customAlertOverlay.classList.remove('hidden');
    }
    
    /**
     * Hides the custom notification box.
     */
    function hideCustomAlert() {
        customAlertOverlay.classList.add('hidden');
    }

    /**
     * Save current state to localStorage
     */
    function saveStateToLocalStorage() {
        localStorage.setItem(LS_SCORE, score);
        localStorage.setItem(LS_ANSWERED, JSON.stringify(Array.from(answeredQuizIds)));
        localStorage.setItem(LS_UNLOCKED, JSON.stringify(Array.from(unlockedTaskIds)));
    }

    /**
     * Restore state from localStorage
     */
    function restoreStateFromLocalStorage() {
        const savedScore = localStorage.getItem(LS_SCORE);
        score = savedScore ? parseInt(savedScore) : 0;
        const savedAnswered = localStorage.getItem(LS_ANSWERED);
        answeredQuizIds = savedAnswered ? new Set(JSON.parse(savedAnswered)) : new Set();
        answeredCorrectlyCount = answeredQuizIds.size;
        const savedUnlocked = localStorage.getItem(LS_UNLOCKED);
        unlockedTaskIds = savedUnlocked ? new Set(JSON.parse(savedUnlocked)) : new Set();
    }

    /**
     * Restore UI state for answered quizzes and unlocked tasks
     */
    function restoreUIState() {
        // Restore answered quizzes
        tasks.forEach((task) => {
            const quizzes = task.querySelectorAll('.quiz');
            quizzes.forEach((quiz, quizIdx) => {
                const quizId = `${task.id}_${quizIdx}`;
                if (answeredQuizIds.has(quizId)) {
                    quiz.classList.add('answered');
                    const options = quiz.querySelectorAll('.option');
                    options.forEach(opt => {
                        if (opt.dataset.correct === 'true') {
                            opt.classList.add('correct');
                        }
                        opt.style.cursor = 'not-allowed';
                    });
                    const feedbackCorrect = quiz.querySelector('.feedback.correct');
                    if (feedbackCorrect) feedbackCorrect.style.display = 'block';
                }
            });
        });
        // Restore unlocked tasks
        tasks.forEach((task) => {
            if (unlockedTaskIds.has(task.id)) {
                task.classList.remove('locked');
                const badge = task.querySelector('.locked-badge');
                if (badge) {
                    badge.textContent = 'Unlocked';
                    badge.classList.remove('locked-badge');
                    badge.classList.add('unlocked-badge');
                }
            }
        });
        // Enable next buttons for completed tasks
        tasks.forEach((task) => {
            const totalInTask = parseInt(task.dataset.questionsTotal);
            const answeredInTask = task.querySelectorAll('.quiz.answered').length;
            if (answeredInTask >= totalInTask) {
                const nextButton = task.querySelector('.btn-next');
                if (nextButton) nextButton.disabled = false;
            }
        });
    }

    // Start the game once the script is loaded
    initializeGame();
});
