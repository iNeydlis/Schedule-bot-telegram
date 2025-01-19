## Требования

Для работы бота необходимо:
- Node.js (версия 20.0.0 или выше)
- npm (устанавливается вместе с Node.js)
- MongoDB (последняя стабильная версия)

## Установка

1. Установите зависимости:
```bash
npm install
```

## Настройка

1. Откройте файл `.env.example` и измените значения на свои, далее переименуйте в `.env`:
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