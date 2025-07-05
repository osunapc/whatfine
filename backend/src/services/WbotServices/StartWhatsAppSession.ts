import { initWbot } from "../../libs/wbot"; // Necesita ser compatible con PrismaWhatsapp
import prisma from "../../database";
import { Whatsapp as PrismaWhatsapp } from "../../generated/prisma";
import { wbotMessageListener } from "./wbotMessageListener"; // Necesita ser compatible
import { getIO } from "../../libs/socket";
import wbotMonitor from "./wbotMonitor"; // Necesita ser compatible
import { logger } from "../../utils/logger";
// Importar el tipo WhatsappWithQueues para asegurar la compatibilidad con lo que devuelve ListWhatsAppsService
import { WhatsappWithQueues } from "../WhatsappService/ListWhatsAppsService";


/**
 * Inicia una sesión de WhatsApp para una conexión específica.
 * Actualiza el estado de la conexión a "OPENING", emite un evento de socket,
 * e inicializa el cliente wbot y sus listeners.
 * @param whatsapp El objeto Whatsapp (tipo Prisma) para el cual iniciar la sesión.
 */
export const StartWhatsAppSession = async (
  whatsapp: WhatsappWithQueues // Usar el tipo que incluye colas, aunque no se usen directamente aquí, por consistencia con ListWhatsAppsService
): Promise<void> => {

  const updatedWhatsapp = await prisma.whatsapp.update({
    where: { id: whatsapp.id },
    data: { status: "OPENING" },
    // Incluir colas para que el objeto emitido por socket sea completo, si es necesario
    include: { whatsappQueues: { include: { queue: true } } }
  });

  const io = getIO();
  // Mapear whatsappQueues a queues para el evento de socket, si el frontend espera 'queues'
  const whatsappForEvent = {
    ...updatedWhatsapp,
    queues: updatedWhatsapp.whatsappQueues.map(wq => wq.queue)
  };

  io.emit("whatsappSession", {
    action: "update",
    session: whatsappForEvent
  });

  try {
    // initWbot, wbotMessageListener, wbotMonitor necesitan ser compatibles con el objeto PrismaWhatsapp.
    // Se usa 'updatedWhatsapp' que es el objeto Prisma puro sin el mapeo de 'queues'.
    const wbot = await initWbot(updatedWhatsapp as any); // 'as any' temporal
    wbotMessageListener(wbot); // Asumimos que wbot es el cliente de whatsapp-web.js
    wbotMonitor(wbot, updatedWhatsapp as any); // 'as any' temporal
  } catch (err: any) {
    logger.error(`Error starting WhatsApp session for ID ${whatsapp.id}: ${err.message}`);
    // Considerar actualizar el estado a "ERROR" o similar si la inicialización falla.
    await prisma.whatsapp.update({
      where: { id: whatsapp.id },
      data: { status: "ERROR" } // O un estado más específico como "STARTUP_ERROR"
    });
    io.emit("whatsappSession", {
      action: "update",
      session: { ...whatsapp, status: "ERROR" } // Emitir el error de estado
    });
  }
};
