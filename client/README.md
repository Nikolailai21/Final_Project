# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.

## Telegram add/drop notifications

Add/drop requests are sent by the server's Telegram bot to the student's assigned advisor. The bot token is server-only and must never be placed in the client.

1. Create a bot with Telegram's `@BotFather` and copy its token.
2. Set `TELEGRAM_BOT_TOKEN` in `server/.env` (see `../server/.env.example`) and restart the server.
3. Ask the advisor to open the bot in Telegram and press **Start**. The bot must not have a webhook configured because the admin UI reads recent `/start` messages using `getUpdates`.
4. In the admin dashboard, edit the advisor account and click **Find Telegram chats**. Select the advisor's private chat from recent bot activity and save the account.
5. A student can then use **Withdraw Request** and **Send Withdrawal Request**. The advisor receives the student's reason and course details directly in Telegram.

Keep the bot token private. For production, configure the bot and server over HTTPS and avoid exposing bot tokens in logs or client code.
