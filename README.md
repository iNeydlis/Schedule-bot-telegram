Рабочую версию бота можно найти в Telegram: [@politeh_schedule_bot](https://t.me/politeh_schedule_bot)

## Возможности
- Просмотр расписания на день/неделю
- Автоматические уведомления о парах на следующий день
- Удобный интерфейс для навигации по расписанию
- Поддержка групп и полного ФИО преподавателей

## Требования

Для работы бота необходимо:
- Node.js (версия 20.0.0 или выше)
- npm (устанавливается вместе с Node.js)
- MongoDB (последняя стабильная версия)

## Установка и настройка

### 1. Клонирование репозитория
```bash
git clone https://github.com/iNeydlis/Schedule-bot-telegram.git
cd Schedule-bot-telegram
```

### 2. Установка зависимостей
```bash
npm install
```

### 3. Настройка окружения
1. Скопируйте файл `.env.example` в `.env`
2. Отредактируйте файл `.env`, указав необходимые значения:
```bash
TELEGRAM_TOKEN=BOT_TOKEN
```

Получить токен можно у [@BotFather](https://t.me/BotFather)

## Запуск

1. Сборка проекта:
```bash
npm run build
```

2. Запуск в режиме разработки:
```bash
npm run dev
```

3. Запуск в production режиме:
```bash
npm run start
```