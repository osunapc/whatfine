import AppError from "../../errors/AppError";
import prisma from "../../database";
import { Message as PrismaMessage, Ticket as PrismaTicket, Contact as PrismaContact } from "../../generated/prisma";
import ShowTicketService, { ShowTicketPrisma } from "../TicketServices/ShowTicketService"; // Ya refactorizado

/**
 * Interfaz para la solicitud del servicio de listado de mensajes.
 */
interface Request {
  /** ID del ticket para el cual listar mensajes. */
  ticketId: string;
  /** Número de página para la paginación. */
  pageNumber?: string;
}

// Definición del tipo Message para la respuesta, incluyendo relaciones anidadas.
export type MessageWithRelations = PrismaMessage & {
  contact?: PrismaContact | null;
  quotedMsg?: (PrismaMessage & { contact?: PrismaContact | null }) | null;
};

/**
 * Interfaz para la respuesta del servicio de listado de mensajes.
 */
interface Response {
  messages: MessageWithRelations[];
  ticket: ShowTicketPrisma; // Usar el tipo detallado de ShowTicketService
  count: number;
  hasMore: boolean;
}

/**
 * Servicio para listar mensajes de un ticket específico, con paginación.
 * @param ticketId ID del ticket.
 * @param pageNumber Número de página.
 * @returns Una promesa que se resuelve a un objeto con los mensajes, el ticket, el conteo total y si hay más páginas.
 */
const ListMessagesService = async ({
  pageNumber = "1",
  ticketId
}: Request): Promise<Response> => {
  const parsedTicketId = parseInt(ticketId, 10);
  if (isNaN(parsedTicketId)) {
    throw new AppError("ERR_INVALID_TICKET_ID", 400);
  }

  const ticket = await ShowTicketService(ticketId); // ShowTicketService ya maneja el error si no se encuentra

  // La lógica de setMessagesAsRead se manejaría en otro lugar o como un helper separado.
  // await setMessagesAsRead(ticket);

  const limit = 20;
  const offset = limit * (Number(pageNumber) - 1);

  const messages = await prisma.message.findMany({
    where: { ticketId: parsedTicketId },
    include: {
      contact: true, // Incluye el contacto del mensaje
      quotedMsg: { // Incluye el mensaje citado
        include: {
          contact: true // Incluye el contacto del mensaje citado
        }
      }
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset
  });

  const count = await prisma.message.count({
    where: { ticketId: parsedTicketId }
  });

  const hasMore = count > offset + messages.length;

  return {
    messages: messages.reverse() as MessageWithRelations[], // Revertir para orden cronológico ascendente en la UI
    ticket,
    count,
    hasMore
  };
};

export default ListMessagesService;
