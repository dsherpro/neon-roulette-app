// Этот код должен быть в файле script.js

document.addEventListener('DOMContentLoaded', () => {
    // 1. НАСТРОЙКА API И КОНФИГУРАЦИЯ
    const tg = window.Telegram?.WebApp || {};
    // Для тестирования в обычном браузере, а не в Telegram
    if (!tg.initData) {
        console.warn("Telegram API не найдено, используется mock-объект.");
        window.Telegram = {
            WebApp: {
                initDataUnsafe: {
                    user: { id: 12345, first_name: 'Тестер' }
                },
                showAlert: (m) => alert(m),
                sendData: (d) => console.log('Отправка данных боту:', d),
                ready: () => {},
                expand: () => {}
            }
        };
    }
    
    tg.ready();
    tg.expand();

    const config = {
        minBet: 10,
        minWithdraw: 500,
        // Шанс победы и выплаты должны быть на сервере, но для Frontend демонстрации оставим их здесь
        // ВАЖНО: В реальном проекте это должно рассчитываться на сервере!
        winRateChance: 0.48, // Более реалистичный шанс победы (48%)
        payouts: { red: 2, black: 2, green: 14 },
    };

    // 2. ПОЛУЧЕНИЕ ЭЛЕМЕНТОВ СТРАНИЦЫ
    const elements = {
        loader: document.getElementById('loader'),
        app: document.getElementById('app'),
        balanceAmount: document.getElementById('balance-amount'),
        username: document.getElementById('username'),
        userId: document.getElementById('user-id'),
        
        // Рулетка
        betAmount: document.getElementById('bet-amount'),
        wheel: document.getElementById('wheel'),
        resultMessage: document.getElementById('result-message'),
        spinButton: document.getElementById('spin-button'),
        betButtons: document.querySelectorAll('.bet-btn'),

        // Коробки
        openBoxButton: document.getElementById('open-box-button'),
        luckBox: document.getElementById('luck-box'),
        multiplierInfo: document.getElementById('multiplier'),
        
        // Кошелек
        topUpButton: document.getElementById('top-up-button'),
        withdrawAmount: document.getElementById('withdraw-amount'),
        withdrawButton: document.getElementById('withdraw-button'),

        // Навигация
        navButtons: document.querySelectorAll('.nav-btn'),
        tabContents: document.querySelectorAll('.tab-content')
    };

    // 3. СОСТОЯНИЕ ИГРЫ
    let state = {
        balance: 100,      // Начальный баланс для новых игроков (должен приходить с сервера)
        isSpinning: false,
        currentBetType: null,
        winMultiplier: 1.0, // Множитель от коробки
        isBoxOpening: false
    };

    // 4. ОСНОВНЫЕ ФУНКЦИИ
    const updateBalanceDisplay = () => {
        elements.balanceAmount.textContent = Math.floor(state.balance);
    };
    
    const updateMultiplierDisplay = () => {
        elements.multiplierInfo.textContent = `x${state.winMultiplier.toFixed(1)}`;
        if (state.winMultiplier > 1.0) {
            elements.multiplierInfo.style.color = 'var(--gold)';
            elements.multiplierInfo.style.fontWeight = 'bold';
        } else {
            elements.multiplierInfo.style.color = 'var(--text-color)';
            elements.multiplierInfo.style.fontWeight = 'normal';
        }
    };

    const disableControls = (disabled) => {
        state.isSpinning = disabled;
        elements.spinButton.disabled = disabled;
        elements.betButtons.forEach(b => b.disabled = disabled);
        elements.betAmount.disabled = disabled;
    };
    
    const showResult = (message, color = 'var(--text-color)') => {
        elements.resultMessage.textContent = message;
        elements.resultMessage.style.color = color;
    }

    // 5. ЛОГИКА ИГРЫ

    // -- РУЛЕТКА --
    const spin = () => {
        const amount = parseInt(elements.betAmount.value, 10);
        if (!state.currentBetType) return tg.showAlert("Сначала выберите цвет для ставки!");
        if (isNaN(amount) || amount < config.minBet) return tg.showAlert(`Минимальная ставка: ${config.minBet} ★`);
        if (amount > state.balance) return tg.showAlert("Недостаточно средств на балансе!");

        disableControls(true);
        state.balance -= amount;
        updateBalanceDisplay();
        showResult(`Ставка ${amount} ★ на ${state.currentBetType}...`, 'var(--text-color)');

        // --- ВНИМАНИЕ: ОПАСНАЯ КЛИЕНТСКАЯ ЛОГИКА ---
        // В реальном проекте нужно отправить запрос на сервер, а сервер вернет результат.
        // Сейчас же результат рассчитывается прямо в браузере.
        
        // Имитация задержки ответа сервера (в будущем здесь будет fetch)
        setTimeout(() => {
            // Определяем выигрышный цвет. 'green' имеет гораздо меньший шанс.
            const isWinner = Math.random() < (state.currentBetType === 'green' ? 0.06 : config.winRateChance);
            const winningColor = isWinner 
                ? state.currentBetType 
                : ['red', 'black', 'green'].filter(c => c !== state.currentBetType)[Math.floor(Math.random() * 2)];

            // Анимация рулетки
            const wheelSegments = ['G', 'B', 'R', 'B', 'R', 'B', 'R']; // G-green, B-black, R-red
            const colorMap = { 'green': 'G', 'black': 'B', 'red': 'R' };
            const winningSymbol = colorMap[winningColor];

            const targetIndexes = wheelSegments.map((seg, i) => seg === winningSymbol ? i : -1).filter(i => i !== -1);
            const targetIndex = targetIndexes[Math.floor(Math.random() * targetIndexes.length)];
            const landingPosition = (5 * wheelSegments.length + targetIndex) * 40 + (Math.random() - 0.5) * 32;

            elements.wheel.style.transition = 'none';
            elements.wheel.style.backgroundPositionX = `${(Math.random() * -280)}px`;
            
            setTimeout(() => {
                elements.wheel.style.transition = 'background-position-x 5s cubic-bezier(0.15, 0.7, 0.25, 1)';
                elements.wheel.style.backgroundPositionX = `-${landingPosition}px`;
            }, 50);

            // Обработка результата после анимации
            setTimeout(() => {
                if (isWinner) {
                    const baseWinnings = amount * config.payouts[winningColor];
                    const totalWinnings = baseWinnings * state.winMultiplier;
                    state.balance += totalWinnings;
                    
                    let resultText = `ПОБЕДА! +${Math.floor(totalWinnings)} ★`;
                    if (state.winMultiplier > 1.0) {
                        resultText += ` (с множителем x${state.winMultiplier.toFixed(1)})`;
                        state.winMultiplier = 1.0; // Сбрасываем множитель после использования
                        updateMultiplierDisplay();
                    }
                    showResult(resultText, 'var(--green)');

                } else {
                    showResult(`Проигрыш. Выпал цвет: ${winningColor}`, 'var(--red)');
                }
                updateBalanceDisplay();
                disableControls(false);
                elements.betButtons.forEach(b => b.classList.remove('selected'));
                state.currentBetType = null;
            }, 5200);

        }, 500); // Конец имитации задержки
    };

    // -- КОРОБКИ --
    const openBox = () => {
        if (state.isBoxOpening) return;
        state.isBoxOpening = true;

        elements.luckBox.classList.add('opening');
        
        setTimeout(() => {
            elements.luckBox.classList.remove('opening');
            // Генерируем случайный множитель от 1.1 до 2.0
            const newMultiplier = Math.random() * 0.9 + 1.1;
            state.winMultiplier = newMultiplier;
            updateMultiplierDisplay();
            tg.showAlert(`Поздравляем! Ваш следующий выигрыш будет умножен на x${newMultiplier.toFixed(1)}!`);
            state.isBoxOpening = false;
        }, 1000); // Анимация длится 0.5с, даем еще запас
    };
    
    // -- КОШЕЛЕК --
    const requestWithdrawal = () => {
        const amount = parseInt(elements.withdrawAmount.value, 10);

        if (isNaN(amount) || amount <= 0) {
            return tg.showAlert('Пожалуйста, введите корректную сумму для вывода.');
        }
        if (amount < config.minWithdraw) {
            return tg.showAlert(`Минимальная сумма для вывода: ${config.minWithdraw} ★.`);
        }
        if (amount > state.balance) {
            return tg.showAlert('У вас недостаточно средств на балансе для вывода этой суммы.');
        }

        // Формируем объект данных для отправки на сервер (вашему боту)
        const data = {
            type: 'withdraw_request',
            amount: amount,
            userId: tg.initDataUnsafe?.user?.id
        };

        // Используем встроенный метод Telegram API для отправки данных
        tg.sendData(JSON.stringify(data));
        
        // После отправки данных можно показать пользователю подтверждение
        // В реальном проекте баланс должен списаться только после подтверждения от сервера.
        // Сейчас для наглядности списываем сразу.
        state.balance -= amount;
        updateBalanceDisplay();
        elements.withdrawAmount.value = '';
        tg.showAlert('Ваша заявка на вывод была успешно отправлена администратору!');
    };


    // 6. ПРИВЯЗКА СОБЫТИЙ
    const bindEvents = () => {
        // Навигация по вкладкам
        elements.navButtons.forEach(button => {
            button.addEventListener('click', () => {
                elements.navButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                elements.tabContents.forEach(tab => {
                    tab.classList.remove('active');
                });
                document.getElementById(button.dataset.tab).classList.add('active');
            });
        });

        // Выбор цвета ставки
        elements.betButtons.forEach(button => {
            button.addEventListener('click', () => {
                if (state.isSpinning) return;
                elements.betButtons.forEach(btn => btn.classList.remove('selected'));
                button.classList.add('selected');
                state.currentBetType = button.dataset.bet;
            });
        });

        // Лимит ввода ставки
        elements.betAmount.addEventListener('input', () => {
            let value = parseInt(elements.betAmount.value, 10);
            if (value > state.balance) {
                elements.betAmount.value = state.balance;
            }
        });
        
        // Кнопка вращения рулетки
        elements.spinButton.addEventListener('click', spin);
        
        // Кнопка открытия бесплатной коробки
        elements.openBoxButton.addEventListener('click', openBox);

        // Кнопка запроса на вывод
        elements.withdrawButton.addEventListener('click', requestWithdrawal);
        
        // Кнопка пополнения
        elements.topUpButton.addEventListener('click', () => {
            tg.showAlert('Функция пополнения через Telegram Stars находится в разработке.');
        });
    };
    
    // 7. ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
    const main = () => {
        try {
            // Устанавливаем информацию о пользователе
            elements.username.textContent = tg.initDataUnsafe?.user?.first_name || "User";
            elements.userId.textContent = `ID: ${tg.initDataUnsafe?.user?.id || 'N/A'}`; // ID ТЕПЕРЬ ОТОБРАЖАЕТСЯ
            
            // В будущем баланс нужно будет получать с сервера
            // loadBalanceFromServer(); 
            updateBalanceDisplay();
            updateMultiplierDisplay();

            bindEvents();

        } catch (e) {
            console.error("Критическая ошибка при запуске приложения:", e);
            document.body.innerHTML = `<div style="color: white; padding: 20px; text-align: center;">Произошла критическая ошибка. Пожалуйста, перезапустите Web App.</div>`;
        } finally {
            // Гарантированно убираем загрузчик, даже если была ошибка
            elements.loader.classList.add('hidden');
            elements.app.classList.add('loaded');
        }
    };
    
    main();
});