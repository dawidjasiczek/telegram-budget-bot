import TelegramBot from 'node-telegram-bot-api';
import { Message } from 'node-telegram-bot-api';

/**
 * Function that waits for user response.
 * @param {TelegramBot} bot - Telegram bot instance.
 * @param {number} chatId - Chat identifier.
 * @param {function} filter - Message filtering function.
 * @param {number} timeout - Wait time in milliseconds.
 * @returns {Promise<Message | null>} - Message object or null in case of timeout.
 */
export function waitForAnswer(
  bot: TelegramBot,
  chatId: number,
  filter: (message: Message) => boolean,
  timeout: number
): Promise<Message | null> {
  return new Promise((resolve) => {
    const onMessage = (msg: Message) => {
      if (msg.chat.id === chatId && filter(msg)) {
        clearTimeout(timer);
        bot.removeListener('message', onMessage);
        resolve(msg);
      }
    };

    const timer = setTimeout(() => {
      bot.removeListener('message', onMessage);
      resolve(null);
    }, timeout);

    bot.on('message', onMessage);
  });
} 