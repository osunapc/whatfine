import prisma from "../../database";
import AppError from "../../errors/AppError";
import { Ticket as PrismaTicket } from "../../generated/prisma";

/**
 * Servicio para eliminar un ticket por su ID.
 * Se asume que los mensajes asociados se eliminarán en cascada
 * debido a la configuración `onDelete: Cascade` en el schema de Prisma.
 * @param id El ID del ticket a eliminar.
 * @returns Una promesa que se resuelve al ticket eliminado (antes de la eliminación).
 *          Prisma `delete` devuelve el objeto eliminado.
 * @throws AppError si el ticket no se encuentra o el ID es inválido.
 */
const DeleteTicketService = async (id: string): Promise<PrismaTicket> => {
  const ticketId = parseInt(id, 10);

  if (isNaN(ticketId)) {
    throw new AppError("ERR_INVALID_TICKET_ID", 400);
  }

  // Verificar si el ticket existe antes de intentar eliminarlo
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId }
  });

  if (!ticket) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  // Eliminar el ticket. Los mensajes asociados deberían eliminarse en cascada.
  const deletedTicket = await prisma.ticket.delete({
    where: { id: ticketId }
  });

  return deletedTicket;
};

export default DeleteTicketService;
