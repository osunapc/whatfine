import qrCode from "qrcode-terminal";
import { Client, LocalAuth, WAState } from "whatsapp-web.js"; // Importar WAState
import { getIO } from "./socket";
import prisma from "../database"; // Importar Prisma client
import { Whatsapp as PrismaWhatsapp, Queue as PrismaQueue } from "../generated/prisma"; // Usar tipos de Prisma
import AppError from "../errors/AppError";
import { logger } from "../utils/logger";
import { handleMessage } from "../services/WbotServices/wbotMessageListener"; // Ya refactorizado (asumimos)

// Definir un tipo para el objeto whatsapp que incluya las colas mapeadas, para emitir por socket
type WhatsappForSocket = PrismaWhatsapp & { queues?: PrismaQueue[] };

interface Session extends Client {
  id?: number; // Este es el ID de la BD del registro Whatsapp
}

const sessions: Session[] = [];

const syncUnreadMessages = async (wbot: Session) => {
  const chats = await wbot.getChats();

  for (const chat of chats) {
    if (chat.unreadCount > 0) {
      const unreadMessages = await chat.fetchMessages({
        limit: chat.unreadCount
      });

      for (const msg of unreadMessages) {
        // handleMessage espera (msg, wbot) donde wbot tiene la propiedad 'id' de la BD
        await handleMessage(msg, wbot);
      }

      await chat.sendSeen();
    }
  }
};


// Función auxiliar para emitir eventos de socket con el formato esperado
const emitWhatsappSessionEvent = async (whatsappId: number, action: string, statusOverride?: WAState | string) => {
  const io = getIO();
  try {
    const whatsappWithDetails = await prisma.whatsapp.findUnique({
      where: { id: whatsappId },
      include: { whatsappQueues: { include: { queue: true } } }
    });

    if (whatsappWithDetails) {
      const sessionData: WhatsappForSocket = {
        ...whatsappWithDetails,
        queues: whatsappWithDetails.whatsappQueues.map(wq => wq.queue),
        status: statusOverride || whatsappWithDetails.status // Usar override si se proporciona
      };
      io.emit("whatsappSession", {
        action: action,
        session: sessionData
      });
    }
  } catch (e) {
    logger.error(`Error fetching whatsapp ${whatsappId} for socket event: ${e}`);
  }
};


export const initWbot = async (whatsapp: PrismaWhatsapp): Promise<Session> => {
  return new Promise(async (resolve, reject) => { // Marcar la función de new Promise como async
    try {
      const io = getIO();
      const sessionName = whatsapp.name;
      let sessionCfg;

      if (whatsapp.session) {
        try {
          sessionCfg = JSON.parse(whatsapp.session);
        } catch (e) {
          logger.error(`Error parsing session JSON for whatsapp ${whatsapp.id}: ${e}. Session data: ${whatsapp.session}`);
          // Considerar limpiar la sesión si está corrupta
          await prisma.whatsapp.update({
            where: { id: whatsapp.id },
            data: { session: "", status: "DESCONECTADO" } // O un estado de error
          });
          sessionCfg = undefined; // Proceder sin sesión guardada
        }
      }

      const args: string = process.env.CHROME_ARGS || "";

      const wbot: Session = new Client({
        session: sessionCfg,
        authStrategy: new LocalAuth({ clientId: 'bd_' + whatsapp.id }),
        puppeteer: {
          executablePath: process.env.CHROME_BIN || undefined,
          // @ts-ignore
          browserWSEndpoint: process.env.CHROME_WS || undefined,
          args: args.split(' ').filter(Boolean) // Filtrar strings vacíos si CHROME_ARGS está vacío
        }
      });
      wbot.id = whatsapp.id; // Adjuntar el ID de la BD a la instancia de wbot

      wbot.on("qr", async qr => {
        logger.info("Session:", sessionName || `ID ${whatsapp.id}`);
        qrCode.generate(qr, { small: true });
        await prisma.whatsapp.update({
          where: { id: whatsapp.id },
          data: { qrcode: qr, status: "qrcode", retries: 0 }
        });

        const sessionIndex = sessions.findIndex(s => s.id === whatsapp.id);
        if (sessionIndex === -1) {
          sessions.push(wbot);
        }
        await emitWhatsappSessionEvent(whatsapp.id, "update", "qrcode");
      });

      wbot.on("authenticated", async session => { // session aquí es el objeto de sesión de wwa-web
        logger.info(`Session: ${sessionName || `ID ${whatsapp.id}`} AUTHENTICATED`);
        // Podríamos querer guardar la sesión aquí si es necesario,
        // aunque LocalAuth debería manejarlo.
        // La lógica original no guardaba la sesión en este evento.
      });

      wbot.on("auth_failure", async msg => {
        logger.error(
          `Session: ${sessionName || `ID ${whatsapp.id}`} AUTHENTICATION FAILURE! Reason: ${msg}`
        );
        let retries = whatsapp.retries || 0;
        if (retries > 1) { // La lógica original era > 1
          await prisma.whatsapp.update({
            where: { id: whatsapp.id },
            data: { session: "", retries: 0, status: "DISCONNECTED" }
          });
        } else {
          await prisma.whatsapp.update({
            where: { id: whatsapp.id },
            data: { status: "DISCONNECTED", retries: retries + 1 }
          });
        }
        await emitWhatsappSessionEvent(whatsapp.id, "update", "DISCONNECTED");
        reject(new Error("Error starting whatsapp session: Authentication Failure"));
      });

      wbot.on("ready", async () => {
        logger.info(`Session: ${sessionName || `ID ${whatsapp.id}`} READY`);
        await prisma.whatsapp.update({
          where: { id: whatsapp.id },
          data: { status: "CONNECTED", qrcode: "", retries: 0 }
        });

        const sessionIndex = sessions.findIndex(s => s.id === whatsapp.id);
        if (sessionIndex === -1) {
          sessions.push(wbot);
        }
        await emitWhatsappSessionEvent(whatsapp.id, "update", "CONNECTED");

        wbot.sendPresenceAvailable();
        // No esperar a syncUnreadMessages para resolver, puede tardar.
        syncUnreadMessages(wbot).catch(err => logger.error(`Error in syncUnreadMessages for ${whatsapp.id}: ${err.message}`));

        resolve(wbot);
      });

      await wbot.initialize().catch(async err => { // Capturar errores de initialize
          logger.error(`Error during wbot.initialize() for ${whatsapp.id}: ${err.message}`);
          await prisma.whatsapp.update({
              where: { id: whatsapp.id },
              data: { status: "ERROR", session: "" } // Marcar como error y limpiar sesión
          });
          await emitWhatsappSessionEvent(whatsapp.id, "update", "ERROR");
          reject(err); // Rechazar la promesa principal
      });

    } catch (err: any) {
      logger.error(`Outer catch in initWbot for whatsapp ${whatsapp.id}: ${err.message}`);
      reject(err); // Asegurarse de que la promesa sea rechazada
    }
  });
};

export const getWbot = (whatsappId: number): Session => {
  const sessionIndex = sessions.findIndex(s => s.id === whatsappId);

  if (sessionIndex === -1) {
    throw new AppError("ERR_WAPP_NOT_INITIALIZED");
  }
  return sessions[sessionIndex];
};

export const removeWbot = (whatsappId: number): void => {
  try {
    const sessionIndex = sessions.findIndex(s => s.id === whatsappId);
    if (sessionIndex !== -1) {
      sessions[sessionIndex].destroy();
      sessions.splice(sessionIndex, 1);
    }
  } catch (err) {
    logger.error(err);
  }
};