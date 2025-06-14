(function() {
    'use strict';

    // --- DOM Elements ---
    const tg = window.Telegram.WebApp;
    const loader = document.getElementById('loader');
    const balanceAmountEl = document.getElementById('balance-amount');
    const userNameEl = document.getElementById('user-name');
    const canvas = document.getElementById('roulette-canvas');
    const betAmountInput = document.getElementById('bet-amount');
    const colorButtons = document.querySelectorAll('.color-btn');
    const spinButton = document.getElementById('spin-button');
    const spinButtonText = spinButton.querySelector('.btn-text');
    const boxButtons = document.querySelectorAll('.box-btn');
    const modalOverlay = document.getElementById('result-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalText = document.getElementById('modal-text');
    const modalCloseBtn = document.getElementById('modal-close-btn');

    // --- Configuration ---
    const API_BASE_URL = 'https://roulette-bot-backend.onrender.com'; // ❗️ ЗАМЕНИТЬ НА ШАГЕ 3
    const ctx = canvas.getContext('2d');
    const segments = [
        { color: '#27ae60', name: 'green' }, { color: '#c0392b', name: 'red' }, { color: '#2c3e50', name: 'black' },
        { color: '#c0392b', name: 'red' }, { color: '#2c3e50', name: 'black' }, { color: '#c0392b', name: 'red' },
        { color: '#2c3e50', name: 'black' }, { color: '#c0392b', name: 'red' }, { color: '#2c3e50', name: 'black' },
        { color: '#c0392b', name: 'red' }, { color: '#2c3e50', name: 'black' }, { color: '#c0392b', name: 'red' },
        { color: '#2c3e50', name: 'black' }, { color: '#c0392b', name: 'red' }, { color: '#2c3e50', name: 'black' },
    ];
    const segmentAngle = 2 * Math.PI / segments.length;
    
    // --- State ---
    const state = {
        userId: null,
        isSpinning: false,
        selectedColor: null,
        currentAngle: 0,
        balance: 0,
    };

    // --- Initialization ---
    function initializeApp() {
        tg.ready();
        tg.expand();
        state.userId = tg.initDataUnsafe?.user?.id || 'test_user';
        fetchUserData().then(() => { loader.classList.add('hidden'); });
        drawRouletteWheel();
        addEventListeners();
    }

    // --- API Communication ---
    async function fetchUserData() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/user/${state.userId}`);
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            updateBalance(data.balance);
            userNameEl.textContent = data.name || 'Игрок';
        } catch (error) {
            console.error("Error fetching user data:", error);
            tg.showAlert('Не удалось загрузить данные пользователя.');
        }
    }

    async function postSpinRequest() {
        const betAmount = parseInt(betAmountInput.value, 10);
        if (isNaN(betAmount) || betAmount <= 0) { tg.showAlert('Некорректная сумма ставки.'); return null; }
        if (betAmount > state.balance) { tg.showAlert('Недостаточно средств.'); return null; }

        try {
            const response = await fetch(`${API_BASE_URL}/api/spin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: state.userId, bet: betAmount, color: state.selectedColor }),
            });
            if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || 'Ошибка сервера'); }
            return await response.json();
        } catch (error) { console.error('Spin request failed:', error); tg.showAlert(`Ошибка: ${error.message}`); return null; }
    }

    // --- UI & Event Handlers ---
    function addEventListeners() {
        colorButtons.forEach(button => button.addEventListener('click', handleColorSelect));
        spinButton.addEventListener('click', handleSpin);
        modalCloseBtn.addEventListener('click', hideResultModal);
        boxButtons.forEach(button => button.addEventListener('click', handleOpenBox));
    }
    
    function handleColorSelect(event) {
        if (state.isSpinning) return;
        colorButtons.forEach(btn => btn.classList.remove('selected'));
        event.currentTarget.classList.add('selected');
        state.selectedColor = event.currentTarget.dataset.color;
        updateSpinButton(true, 'Крутить!');
    }

    async function handleOpenBox(event) {
        if (state.isSpinning) return;
        const button = event.currentTarget;
        const boxType = button.dataset.boxtype;
        const boxCost = button.querySelector('.box-cost').textContent;

        tg.showConfirm(`Купить коробку "${boxType}" за ${boxCost}?`, async (confirmed) => {
            if (confirmed) {
                try {
                    const response = await fetch(`${API_BASE_URL}/api/openbox`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: state.userId, boxType: boxType })
                    });
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.error);
                    updateBalance(data.newBalance);
                    showResultModal("Приз из коробки!", `Поздравляем! Вы выиграли <b>${data.wonAmount} ⭐</b>!`);
                } catch (error) { tg.showAlert(`Ошибка: ${error.message}`); }
            }
        });
    }

    function updateSpinButton(enabled, text) { spinButton.disabled = !enabled; spinButtonText.textContent = text; }
    function updateBalance(newBalance) { state.balance = newBalance; balanceAmountEl.textContent = Math.floor(newBalance); }
    function showResultModal(title, text) { modalTitle.textContent = title; modalText.innerHTML = text; modalOverlay.classList.add('visible'); }
    function hideResultModal() { modalOverlay.classList.remove('visible'); }

    // --- Roulette Drawing & Animation ---
    function drawRouletteWheel() {
        const radius = canvas.width / 2;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(radius, radius);
        ctx.rotate(state.currentAngle);
        for (let i = 0; i < segments.length; i++) {
            const startAngle = i * segmentAngle;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, radius - 5, startAngle, startAngle + segmentAngle);
            ctx.closePath();
            ctx.fillStyle = segments[i].color;
            ctx.fill();
        }
        ctx.restore();
    }

    async function handleSpin() {
        if (state.isSpinning || !state.selectedColor) return;
        state.isSpinning = true;
        updateSpinButton(false, 'Вращение...');
        const result = await postSpinRequest();
        if (result) {
            updateBalance(result.newBalance + result.winAmount);
            startSpinAnimation(result);
        } else { state.isSpinning = false; updateSpinButton(true, 'Крутить!'); }
    }

    function startSpinAnimation(result) {
        const { winningColor, winAmount, newBalance } = result;
        const winningSegmentIndex = findFirstSegmentIndex(winningColor);
        const randomOffsetInSegment = (Math.random() - 0.5) * segmentAngle * 0.8;
        const targetAngle = winningSegmentIndex * segmentAngle + randomOffsetInSegment;
        const finalAngle = (5 * (2 * Math.PI)) + targetAngle;
        let startTime = null;

        function animate(timestamp) {
            if (!startTime) startTime = timestamp;
            const elapsedTime = timestamp - startTime;
            if (elapsedTime >= 5000) {
                state.currentAngle = finalAngle % (2 * Math.PI);
                drawRouletteWheel();
                onSpinEnd(winAmount, newBalance, winningColor);
                return;
            }
            const progress = elapsedTime / 5000;
            const easing = 1 - Math.pow(1 - progress, 3);
            state.currentAngle = finalAngle * easing;
            drawRouletteWheel();
            requestAnimationFrame(animate);
        }
        requestAnimationFrame(animate);
    }

    function onSpinEnd(winAmount, newBalance, winningColor) {
        state.isSpinning = false;
        updateSpinButton(true, 'Крутить!');
        updateBalance(newBalance);
        if (winAmount > 0) { showResultModal("Победа!", `Выпало <b>${winningColor}</b>! <br>Ваш выигрыш: ${winAmount} ⭐`);
        } else { showResultModal("Проигрыш", `Выпало <b>${winningColor}</b>. <br>В следующий раз повезет!`); }
    }

    function findFirstSegmentIndex(colorName) { return segments.findIndex(s => s.name === colorName) || 0; }

    // --- Run App ---
    document.addEventListener('DOMContentLoaded', initializeApp);
})();
