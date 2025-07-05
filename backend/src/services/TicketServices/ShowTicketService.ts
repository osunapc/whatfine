import prisma from "../../database";
import AppError from "../../errors/AppError";
import {
  Ticket as PrismaTicket,
  Contact as PrismaContact,
  User as PrismaUser,
  Queue as PrismaQueue,
  Whatsapp as PrismaWhatsapp,
  ContactCustomField as PrismaContactCustomField
} from "../../generated/prisma";

// Definición de tipos para mejorar la legibilidad y el autocompletado
type TicketContactWithExtra = PrismaContact & { customFields: PrismaContactCustomField[] };
type TicketUser = Pick<PrismaUser, "id" | "name">; // Solo los campos necesarios
type TicketQueue = Pick<PrismaQueue, "id" | "name" | "color">;
type TicketWhatsapp = Pick<PrismaWhatsapp, "name">;

export type ShowTicketPrisma = PrismaTicket & {
  contact?: TicketContactWithExtra | null;
  user?: TicketUser | null;
  queue?: TicketQueue | null;
  whatsapp?: TicketWhatsapp | null;
};

/**
 * Servicio para obtener un ticket específico por su ID, incluyendo relaciones detalladas.
 * @param id El ID del ticket a obtener (puede ser string o number).
 * @returns Una promesa que se resuelve al ticket encontrado con sus relaciones.
 * @throws AppError si el ticket no se encuentra o el ID es inválido.
 */
const ShowTicketService = async (id: string | number): Promise<ShowTicketPrisma> => {
  const ticketId = typeof id === 'string' ? parseInt(id, 10) : id;

  if (isNaN(ticketId)) {
    throw new AppError("ERR_INVALID_TICKET_ID", 400);
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      contact: {
        include: {
          customFields: true // Anteriormente extraInfo
        }
      },
      user: {
        select: { // Seleccionar solo los campos necesarios para el usuario
          id: true,
          name: true
        }
      },
      queue: {
        select: {
          id: true,
          name: true,
          color: true
        }
      },
      whatsapp: {
        select: {
          name: true
        }
      }
    }
  });

  if (!ticket) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  // Aseguramos que el tipo de retorno coincida con ShowTicketPrisma
  return ticket as ShowTicketPrisma;
};

export default ShowTicketService;
