import { Client as WbotSession } from "whatsapp-web.js"; // Renombrar para claridad
import { getWbot } from "../libs/wbot";
import GetDefaultWhatsApp from "./GetDefaultWhatsApp"; // Ya refactorizado
import { Ticket as PrismaTicket, User as PrismaUser } from "../generated/prisma";
import prisma from "../database"; // Necesario para actualizar el ticket
import { logger } from "../utils/logger";

// El ticket que recibe este helper puede no tener todas las relaciones cargadas.
// Necesitamos al menos userId si whatsappId no está presente.
type TicketForWbot = Pick<PrismaTicket, "id" | "whatsappId" | "userId"> & {
    user?: Pick<PrismaUser, "id"> | null; // El usuario podría ser null o solo tener id
};


/**
 * Obtiene la instancia de wbot (cliente de whatsapp-web.js) para un ticket específico.
 * Si el ticket no tiene un whatsappId asignado, intenta asignarle el WhatsApp por defecto
 * del usuario del ticket y guarda este cambio en la base de datos.
 * @param ticket El objeto Ticket (parcial o completo) de Prisma.
 * @returns Una promesa que se resuelve a la instancia de wbot.
 * @throws AppError si no se puede determinar una conexión de WhatsApp para el ticket.
 */
const GetTicketWbot = async (ticket: TicketForWbot): Promise<WbotSession> => {
  let currentWhatsappId = ticket.whatsappId;

  if (!currentWhatsappId) {
    logger.info(`Ticket ${ticket.id} has no whatsappId. Trying to assign default.`);
    // Para obtener el defaultWhatsapp, necesitamos el userId.
    // Si ticket.user no está cargado o no tiene id, esto fallará.
    // Es mejor asegurar que el ticket que se pasa a esta función tenga userId si whatsappId es null.
    if (!ticket.userId) {
        // Si no hay userId en el ticket, no podemos obtener el defaultWhatsapp del usuario.
        // Podríamos intentar con el default global, o lanzar un error.
        // Por ahora, intentaremos el default global si no hay userId.
        logger.warn(`Ticket ${ticket.id} has no userId to fetch user-specific default WhatsApp. Fetching global default.`);
        const defaultWhatsapp = await GetDefaultWhatsApp(); // Sin userId, obtiene el global
        await prisma.ticket.update({
            where: { id: ticket.id },
            data: { whatsappId: defaultWhatsapp.id }
        });
        currentWhatsappId = defaultWhatsapp.id;
        logger.info(`Ticket ${ticket.id} assigned global default whatsappId: ${currentWhatsappId}`);
    } else {
        const defaultWhatsapp = await GetDefaultWhatsApp(ticket.userId); // userId debe estar presente
        // Persistir el whatsappId en el ticket
        await prisma.ticket.update({
            where: { id: ticket.id },
            data: { whatsappId: defaultWhatsapp.id }
        });
        currentWhatsappId = defaultWhatsapp.id;
        logger.info(`Ticket ${ticket.id} assigned user's default whatsappId: ${currentWhatsappId}`);
    }
  }

  if (!currentWhatsappId) {
    // Esto no debería ocurrir si la lógica anterior funciona.
    throw new Error(`Could not determine whatsappId for ticket ${ticket.id}`);
  }

  const wbot = getWbot(currentWhatsappId);
  return wbot;
};

export default GetTicketWbot;
