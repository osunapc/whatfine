import { Message as WbotMessage, Client } from "whatsapp-web.js";
import { Ticket as PrismaTicket, Contact as PrismaContact } from "../generated/prisma";
import GetTicketWbot from "./GetTicketWbot"; // Ya refactorizado
import AppError from "../errors/AppError";
import { logger } from "../utils/logger";

// El ticket necesita incluir el contacto para esta función.
// Usaremos el tipo ShowTicketPrisma que ya define esto.
import { ShowTicketPrisma } from "../services/TicketServices/ShowTicketService";


/**
 * Obtiene un mensaje específico de WhatsApp utilizando la instancia de wbot asociada al ticket.
 * Busca gradualmente en los mensajes del chat hasta encontrar el messageId o alcanzar un límite.
 * @param ticket El objeto Ticket (ShowTicketPrisma) que incluye la relación con el contacto.
 * @param messageId El ID del mensaje de WhatsApp a buscar.
 * @returns Una promesa que se resuelve al objeto WbotMessage encontrado.
 * @throws AppError si el mensaje no se encuentra o hay un error al obtenerlo.
 */
export const GetWbotMessage = async (
  ticket: ShowTicketPrisma, // Usar el tipo que incluye el contacto
  messageId: string
): Promise<WbotMessage> => {
  if (!ticket.contact) {
    logger.error(`Contact not found on ticket ${ticket.id} for GetWbotMessage`);
    throw new AppError("ERR_CONTACT_NOT_FOUND_IN_TICKET");
  }

  // GetTicketWbot espera un tipo compatible con TicketForWbot (Pick<PrismaTicket, "id" | "whatsappId" | "userId">)
  // ShowTicketPrisma es compatible con esto.
  const wbot = await GetTicketWbot(ticket);

  const chatId = `${ticket.contact.number}@${ticket.isGroup ? "g" : "c"}.us`;

  try {
    const wbotChat = await wbot.getChatById(chatId);
    let limit = 20;

  const fetchWbotMessagesGradually = async (): Promise<void | WbotMessage> => {
    const chatMessages = await wbotChat.fetchMessages({ limit });

    const msgFound = chatMessages.find(msg => msg.id.id === messageId);

    if (!msgFound && limit < 100) {
      limit += 20;
      return fetchWbotMessagesGradually();
    }

    return msgFound;
  };

  try {
    const msgFound = await fetchWbotMessagesGradually();

    if (!msgFound) {
      throw new Error("Cannot found message within 100 last messages");
    }

    return msgFound;
  } catch (err) {
    throw new AppError("ERR_FETCH_WAPP_MSG");
  }
};

export default GetWbotMessage;
