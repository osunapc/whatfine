import * as Sentry from "@sentry/node";
import { Client, WAState } from "whatsapp-web.js"; // Importar WAState para tipar newState

import { getIO } from "../../libs/socket";
import prisma from "../../database";
import { Whatsapp as PrismaWhatsapp, Prisma } from "../../generated/prisma"; // Usar PrismaWhatsapp
import { logger } from "../../utils/logger";
import { StartWhatsAppSession } from "./StartWhatsAppSession"; // Ya refactorizado
// Importar el tipo WhatsappWithQueues para asegurar la compatibilidad con lo que espera StartWhatsAppSession
import { WhatsappWithQueues } from "../WhatsappService/ListWhatsAppsService";


interface Session extends Client {
  id?: number; // Este id es el de la base de datos, añadido al objeto wbot en algún punto
}

/**
 * Monitorea eventos de una sesión de wbot (cliente de whatsapp-web.js) y actualiza la BD y emite eventos de socket.
 * @param wbot La instancia del cliente wbot.
 * @param whatsapp El objeto Whatsapp de Prisma correspondiente a esta sesión de wbot.
 */
const wbotMonitor = async (
  wbot: Session, // wbot es el cliente de whatsapp-web.js
  whatsapp: PrismaWhatsapp // whatsapp es el registro de la BD de Prisma
): Promise<void> => {
  const io = getIO();
  const sessionName = whatsapp.name; // name puede ser null según el schema

  try {
    wbot.on("change_state", async (newState: WAState) => {
      logger.info(`Monitor session: ${sessionName || `ID ${whatsapp.id}`}, new state: ${newState}`);
      try {
        await prisma.whatsapp.update({
          where: { id: whatsapp.id },
          data: { status: newState }
        });
      } catch (err: any) {
        Sentry.captureException(err);
        logger.error(`Error updating whatsapp ${whatsapp.id} status to ${newState}: ${err.message}`);
      }

      // Emitir el objeto whatsapp completo (o al menos con el estado actualizado)
      // Para consistencia, es mejor re-leer el objeto o construirlo con las colas si el frontend lo espera
      io.emit("whatsappSession", {
        action: "update",
        session: { ...whatsapp, status: newState } // Enviar el estado actualizado
      });
    });

    wbot.on("change_battery", async batteryInfo => {
      const { battery, plugged } = batteryInfo;
      logger.info(
        `Battery session: ${sessionName || `ID ${whatsapp.id}`} ${battery}% - Charging? ${plugged}`
      );

      try {
        await prisma.whatsapp.update({
          where: { id: whatsapp.id },
          data: { battery: battery.toString(), plugged } // Asegurar que battery sea string si el schema lo espera
        });
      } catch (err: any) {
        Sentry.captureException(err);
        logger.error(`Error updating whatsapp ${whatsapp.id} battery: ${err.message}`);
      }

      io.emit("whatsappSession", {
        action: "update",
        session: { ...whatsapp, battery: battery.toString(), plugged } // Enviar datos actualizados
      });
    });

    wbot.on("disconnected", async reason => {
      logger.info(`Disconnected session: ${sessionName || `ID ${whatsapp.id}`}, reason: ${reason}`);
      let updatedWhatsappForSocket = { ...whatsapp };
      try {
        await prisma.whatsapp.update({
          where: { id: whatsapp.id },
          data: { status: "OPENING", session: "" } // Limpiar sesión al desconectar
        });
        updatedWhatsappForSocket.status = "OPENING";
        updatedWhatsappForSocket.session = "";
      } catch (err: any) {
        Sentry.captureException(err);
        logger.error(`Error updating whatsapp ${whatsapp.id} on disconnect: ${err.message}`);
        updatedWhatsappForSocket.status = "DISCONNECTED_ERROR"; // Un estado para reflejar el problema
      }

      io.emit("whatsappSession", {
        action: "update",
        session: updatedWhatsappForSocket
      });

      // StartWhatsAppSession espera un objeto que incluya 'queues'.
      // Necesitamos obtener el objeto completo o asegurar que `whatsapp` ya lo tenga.
      // Si `whatsapp` es solo PrismaWhatsapp, necesitamos cargarlo con sus colas.
      const fullWhatsappForRestart = await prisma.whatsapp.findUnique({
        where: { id: whatsapp.id },
        include: { whatsappQueues: { include: { queue: true } } }
      });

      if (fullWhatsappForRestart) {
        const mappedWhatsapp: WhatsappWithQueues = {
            ...fullWhatsappForRestart,
            queues: fullWhatsappForRestart.whatsappQueues.map(wq => wq.queue)
        };
        setTimeout(() => StartWhatsAppSession(mappedWhatsapp), 2000);
      } else {
        logger.error(`Whatsapp ${whatsapp.id} not found for restart after disconnect.`);
      }
    });
  } catch (err: any) {
    Sentry.captureException(err);
    logger.error(`Error in wbotMonitor for whatsapp ${whatsapp.id}: ${err.message}`);
  }
};

export default wbotMonitor;
