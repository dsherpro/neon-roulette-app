//
// НОВЫЙ SCRIPT.JS С ТАЙМАУТОМ И УЛУЧШЕННОЙ ОБРАБОТКОЙ ОШИБОК
//
(function() {
    'use strict';

    // --- Проверяем, запущено ли приложение в Telegram ---
    const tg = window.Telegram.WebApp || {
        initDataUnsafe: { user: { id: 'test_user_123', first_name: 'Browser User' } },
        ready: () => console.log('Telegram WebApp not found, using fallback.'),
        expand: () => console.log('Telegram WebApp not found, using fallback.'),
        showAlert: (message) => alert(message),
        showConfirm: (message, callback) => { if (confirm(message)) { callback(true); } }
    };
    const isInsideTelegram = window.Telegram.WebApp.initData !== "";

    // --- DOM Elements ---
    const loader = document.getElementById('loader');
    const balanceAmountEl = document.getElementById('balance-amount');
    const userNameEl = document.getElementById('user-name');
    const canvas = document.getElementById('roulette-canvas');
    // ... и остальные DOM элементы

    // --- Configuration ---
    const API_BASE_URL = 'https://roulette-bot-backend.onrender.com'; // ❗️ УБЕДИТЕСЬ, ЧТО ИСПОЛЬЗУЕТЕ ВАШ URL С RENDER

    // ... остальной код (segments, state) без изменений ...

    // --- НОВАЯ ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ---
    async function fetchWithTimeout(resource, options = {}, timeout = 15000) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        const response = await fetch(resource, {
            ...options,
            signal: controller.signal  
        });
        clearTimeout(id);
        return response;
    }

    // --- Initialization ---
    async function initializeApp() {
        if (isInsideTelegram) { tg.ready(); tg.expand(); }
        state.userId = tg.initDataUnsafe?.user?.id;
        drawRouletteWheel();
        addEventListeners();
        try {
            await fetchUserData();
        } catch (error) {
            console.error("Initialization failed:", error);
            balanceAmountEl.textContent = 'Ошибка';
            userNameEl.textContent = 'Нет связи';
            if (error.name === 'AbortError') {
                 tg.showAlert('Сервер не отвечает. Возможно, он запускается. Попробуйте еще раз через минуту.');
            } else {
                 tg.showAlert('Не удалось загрузить данные. Проверьте интернет-соединение или попробуйте позже.');
            }
        } finally {
            loader.classList.add('hidden');
        }
    }

    // --- API Communication (ИЗМЕНЕНО) ---
    async function fetchUserData() {
        if (!state.userId) { throw new Error("User ID is not defined."); }
        // Используем новую функцию с таймаутом
        const response = await fetchWithTimeout(`${API_BASE_URL}/api/user/${state.userId}`);
        if (!response.ok) { throw new Error(`Network response was not ok: ${response.statusText}`); }
        const data = await response.json();
        updateBalance(data.balance);
        userNameEl.textContent = data.name || 'Игрок';
    }

    // ... остальная часть файла script.js (addEventListeners, handleSpin и т.д.) остается БЕЗ ИЗМЕНЕНИЙ ...
    // Скопируйте весь остальной код из предыдущей версии файла, он полностью рабочий.
    
    // Вставьте сюда остаток вашего рабочего `script.js`, начиная с функции `addEventListeners`
    function addEventListeners() {
        const colorButtons = document.querySelectorAll('.color-btn');
        const spinButton = document.getElementById('spin-button');
        const modalCloseBtn = document.getElementById('modal-close-btn');
        const boxButtons = document.querySelectorAll('.box-btn');

        colorButtons.forEach(button => button.addEventListener('click', handleColorSelect));
        spinButton.addEventListener('click', handleSpin);
        modalCloseBtn.addEventListener('click', hideResultModal);
        boxButtons.forEach(button => button.addEventListener('click', handleOpenBox));
    }
    
    function handleColorSelect(event) {
        if (state.isSpinning) return;
        const colorButtons = document.querySelectorAll('.color-btn');
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
                    if (!response.ok) throw new Error(data.error || 'Неизвестная ошибка');
                    updateBalance(data.newBalance);
                    showResultModal("Приз из коробки!", `Поздравляем! Вы выиграли <b>${data.wonAmount} ⭐</b>!`);
                } catch (error) { tg.showAlert(`Ошибка: ${error.message}`); }
            }
        });
    }

    function updateSpinButton(enabled, text) { 
        const spinButton = document.getElementById('spin-button');
        const spinButtonText = spinButton.querySelector('.btn-text');
        spinButton.disabled = !enabled; 
        spinButtonText.textContent = text; 
    }
    function updateBalance(newBalance) { 
        state.balance = newBalance; 
        document.getElementById('balance-amount').textContent = Math.floor(newBalance); 
    }
    function showResultModal(title, text) {
        document.getElementById('modal-title').textContent = title; 
        document.getElementById('modal-text').innerHTML = text; 
        document.getElementById('result-modal').classList.add('visible'); 
    }
    function hideResultModal() { 
        document.getElementById('result-modal').classList.remove('visible'); 
    }

    const drawRouletteWheel = () => {
        const canvasEl = document.getElementById('roulette-canvas');
        if (!canvasEl) return;
        const ctx = canvasEl.getContext('2d');
        const radius = canvasEl.width / 2;
        ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
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
    };

    async function handleSpin() {
        if (state.isSpinning || !state.selectedColor) return;
        const betAmount = parseInt(document.getElementById('bet-amount').value, 10);
        if (isNaN(betAmount) || betAmount <= 0) { tg.showAlert('Некорректная ставка.'); return; }
        if (betAmount > state.balance) { tg.showAlert('Недостаточно средств.'); return; }
        state.isSpinning = true;
        updateSpinButton(false, 'Вращение...');
        try {
            const response = await fetch(`${API_BASE_URL}/api/spin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: state.userId, bet: betAmount, color: state.selectedColor }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Ошибка вращения');
            updateBalance(result.newBalance + result.winAmount);
            startSpinAnimation(result);
        } catch (error) {
            tg.showAlert(`Ошибка: ${error.message}`);
            state.isSpinning = false;
            updateSpinButton(true, 'Крутить!');
            fetchUserData();
        }
    }

    function startSpinAnimation({ winningColor, winAmount, newBalance }) {
        const winningSegmentIndex = segments.findIndex(s => s.name === winningColor) || 0;
        const finalAngle = (5 * (2 * Math.PI)) + (winningSegmentIndex * segmentAngle) + ((Math.random() - 0.5) * segmentAngle * 0.8);
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

    // --- Run App ---
    document.addEventListener('DOMContentLoaded', initializeApp);
})();
