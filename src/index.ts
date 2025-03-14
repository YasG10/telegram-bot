// src/index.ts
import "reflect-metadata";
import { createConnection } from "typeorm";
import { User } from "./entities/User";
import { Message } from "./entities/Message";
import dotenv from "dotenv";
import { Telegraf } from "telegraf";
import logger from "./logger";

dotenv.config();

import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

// Endpoint para obtener usuarios conectados
app.get("/usuarios-conectados", (req, res) => {
  const usuarios = Array.from(activeUsers).map((id) => ({
    id,
    alias: userAliases.get(id) || "Anónimo",
  }));
  res.json({ usuarios });
});

// Iniciar el servidor Express
app.listen(PORT, () => {
  logger.info(`Servidor Express corriendo en http://localhost:${PORT}`);
});

const activeUsers = new Set<number>();

const aliases = [
  "Fantasma 👻", "Sombra 🕶", "Lobo 🐺", "Misterioso 🤖", "Gato 🐱", "Ángel 😇",
  "Guerrero 🏹", "Espectro 👀", "Dragón 🐉", "Cuervo 🦅", "Viento 🌪", "Centella ⚡",
  "Oculto 🕵️", "Eco 🔊", "Pantera 🐆", "Eclipse 🌑", "Fénix 🔥", "Vikingo ⚔️",
  "Destello ✨", "Sigilo 🐾", "Samurái 🏯", "Errante 🌍", "Silencio 🤫", "Rayo ⚡",
  "Nocturno 🌙", "Nómada 🎒", "Espía 🕶", "Titán 🏛", "Tormenta ⛈", "León 🦁",
  "Serpiente 🐍", "Demonio 😈", "Águila 🦅", "Luz 💡", "Enigma ❓", "Sombrío 🌫",
  "Cazador 🏹", "Trueno ⚡", "Rebelde 🎭", "Forastero 🚶‍♂️", "Magia 🔮", "Cometa ☄️",
  "Explorador 🗺", "Halcón 🦅", "Oculto 🔍", "Camaleón 🦎", "Cazador de Sombras 🌑",
  "Lince 🐆", "Vórtice 🌪", "Desconocido ❌", "Sigiloso 🕵️", "Sombrío 🌘", "Espectro 👁️",
  "Furtivo 🏃", "Invisible 🌀", "Cobra 🐍", "Espejismo 🏜", "Infierno 🔥", "Arcano 📜",
  "Solitario 🚶", "Meteorito ☄", "Ciclón 🌪", "Místico 🧙", "Astro 🌠", "Errante 🌎",
  "Centinela 🛡", "Destructor 💥", "Oculto en las sombras 🔦", "El Susurro 🗣️",
  "Nebulosa 🌌", "Neón 🎆", "Abismo 🌊", "Caos ☠️", "Quimera 🐉", "Lucero 💫",
  "Ladrón de Almas 👁", "Hechicero 🔮", "Jinete de la Noche 🌙", "Anónimo 🤖"
];
const userAliases = new Map<number, string>(); // Mapea el ID de usuario a su alias


async function setBotCommands(bot: Telegraf) {
  await bot.telegram.setMyCommands([
    { command: "start", description: "Iniciar el bot" },
    { command: "chatear", description: "Unirse al chat anónimo" },
    { command: "salir", description: "Salir del chat anónimo" },
    { command: "ayuda", description: "Ver los comandos disponibles" },
  ]);
}

async function start() {
  try {
    const connection = await createConnection({
      type: "postgres",
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      entities: [User, Message],
      synchronize: true,
    });
    logger.info("Conexión a la base de datos establecida");

    const bot = new Telegraf(process.env.BOT_TOKEN as string);

    await setBotCommands(bot);
    logger.info("Comandos del bot configurados correctamente.");

    bot.command("chatear", async (ctx) => {
      const userId = ctx.from?.id;
      if (!userId) return;

      if (!userAliases.has(userId)) {
        const alias = aliases[Math.floor(Math.random() * aliases.length)];
        userAliases.set(userId, alias);
      }

      activeUsers.add(userId);
      try {
        await ctx.reply(`Bienvenido al chat anónimo, *${userAliases.get(userId)}*!`, { parse_mode: "Markdown" });
        logger.info(`Usuario ${userId} (${userAliases.get(userId)}) se unió al chat.`);
      } catch (error) {
        if ((error as any)?.response && (error as any).response.error_code === 403) {
          logger.warn(`No se pudo enviar mensaje a ${userId}: El usuario bloqueó al bot.`);
        } else {
          logger.error(`Error al enviar mensaje a ${userId}: ${(error as Error)?.message}`);
        }
      }
      
    });


    bot.command("salir", (ctx) => {
      const userId = ctx.from?.id;
      if (!userId) return;
      if (activeUsers.has(userId)) {
        activeUsers.delete(userId);
        ctx.reply("Has salido del chat anónimo. Para enviar mensajes nuevamente, únete al chat usando /chatear.");
        logger.info(`Usuario ${userId} salió del chat. Usuarios activos: ${activeUsers.size}`);
      } else {
        ctx.reply("No estabas en el chat.");
      }
    });

    bot.command("ayuda", (ctx) => {
      ctx.reply(
        "🤖 *Comandos disponibles:*\n" +
        "/chatear - Unirse al chat anónimo\n" +
        "/salir - Salir del chat anónimo\n" +
        "/ayuda - Ver esta lista de comandos",
        { parse_mode: "Markdown" }
      );
    });

    function escapeMarkdown(text: string): string {
      return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, "\\$1"); // Escapa caracteres reservados
    }


    bot.on("text", async (ctx) => {
      try {
        const telegramId = ctx.from?.id;
        const usuario = ctx.from?.username;
        if (!telegramId) return;

        if (!activeUsers.has(telegramId)) {
          ctx.reply("Para enviar mensajes, únete al chat usando /chatear");
          return;
        }


        const alias = escapeMarkdown(userAliases.get(telegramId) || "Anónimo");
        const content = escapeMarkdown(ctx.message.text);


        let user = await connection.getRepository(User).findOne({ where: { telegramId: String(telegramId) } });
        if (!user) {
          user = connection.getRepository(User).create({ telegramId: String(telegramId) });
          await connection.getRepository(User).save(user);
        }

        const message = connection.getRepository(Message).create({ content, user });
        await connection.getRepository(Message).save(message);
        logger.info(`Mensaje guardado de usuario ${telegramId}: "${content}", del usuario: ${usuario}`);

        activeUsers.forEach(async (id) => {
          if (id !== telegramId) {
            try {
              await bot.telegram.sendMessage(
                id,
                `🕵️‍♂️ *${alias}:* ${content}`,
                { parse_mode: "MarkdownV2" }
              );
            } catch (error) {
              if ((error as any)?.response?.error_code === 403) {
                logger.warn(`El usuario ${id} bloqueó el bot. Eliminándolo de la lista de usuarios activos.`);
                activeUsers.delete(id); // Remover de la lista de usuarios activos
              } else {
                logger.error(`Error al enviar mensaje a ${id}: ${error}`);
              }
            }
          }
        });

      }
      catch (error) {
        logger.error(`Error al procesar el mensaje: ${error}`);
      }

    });

    // Manejo de fotos 📸 (se reenvían pero no se guardan)
    bot.on("photo", async (ctx) => {
      const telegramId = ctx.from?.id;
      if (!telegramId || !activeUsers.has(telegramId)) return;

      const alias = escapeMarkdown(userAliases.get(telegramId) || "Anónimo");

      activeUsers.forEach((id) => {
        if (id !== telegramId) {
          ctx.telegram.sendPhoto(id, ctx.message.photo[0].file_id, {
            caption: `🕵️‍♂️ *${alias}* envió una imagen`,
            parse_mode: "MarkdownV2",
          });
        }
      });

      logger.info(`${alias} envió una imagen.`);
    });


    // Manejo de audios 🎤 (se reenvían pero no se guardan)
    bot.on("voice", async (ctx) => {
      const telegramId = ctx.from?.id;
      if (!telegramId || !activeUsers.has(telegramId)) return;

      const alias = userAliases.get(telegramId) || "Anónimo";
      bot.on("voice", async (ctx) => {
        const telegramId = ctx.from?.id;
        if (!telegramId || !activeUsers.has(telegramId)) return;

        const alias = escapeMarkdown(userAliases.get(telegramId) || "Anónimo");

        activeUsers.forEach((id) => {
          if (id !== telegramId) {
            ctx.telegram.sendVoice(id, ctx.message.voice.file_id, {
              caption: `🎙 *${alias}* envió un audio`,
              parse_mode: "MarkdownV2",
            });
          }
        });

        logger.info(`${alias} envió un audio.`);
      });
    });


    // Manejo de videos 🎥 (se reenvían pero no se guardan)
    bot.on("video", async (ctx) => {
      const telegramId = ctx.from?.id;
      if (!telegramId || !activeUsers.has(telegramId)) return;

      const alias = escapeMarkdown(userAliases.get(telegramId) || "Anónimo");

      activeUsers.forEach((id) => {
        if (id !== telegramId) {
          ctx.telegram.sendVideo(id, ctx.message.video.file_id, {
            caption: `📹 *${alias}* envió un video`,
            parse_mode: "MarkdownV2",
          });
        }
      });

      logger.info(`${alias} envió un video.`);
    });


    bot.launch();
    logger.info("Bot iniciado");
  } catch (error) {
    logger.error(`Error al iniciar la aplicación: ${error}`);
  }
}

start();
