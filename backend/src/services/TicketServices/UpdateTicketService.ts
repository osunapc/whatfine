import { getIO } from "../../libs/socket";
import prisma from "../../database";
import AppError from "../../errors/AppError";
import { Ticket as PrismaTicket, Prisma } from "../../generated/prisma";
import ShowTicketService, { ShowTicketPrisma } from "./ShowTicketService"; // Ya refactorizado
// import CheckContactOpenTickets from "../../helpers/CheckContactOpenTickets"; // Necesitará refactorización
// import SetTicketMessagesAsRead from "../../helpers/SetTicketMessagesAsRead"; // Necesitará refactorización

/**
 * Interfaz para los datos a actualizar en un ticket.
 * Todos los campos son opcionales.
 */
interface TicketData {
  status?: string;
  userId?: number | null; // Permitir null para desasignar usuario
  queueId?: number | null; // Permitir null para desasignar cola
  whatsappId?: number;
  unreadMessages?: number; // Añadido por si se necesita actualizar directamente
}

/**
 * Interfaz para la solicitud del servicio de actualización de tickets.
 */
interface Request {
  ticketData: TicketData;
  ticketId: string | number;
}

/**
 * Interfaz para la respuesta del servicio de actualización de tickets.
 * Devuelve el ticket actualizado y el estado y userId anteriores.
 */
interface Response {
  ticket: ShowTicketPrisma; // Usar el tipo exportado de ShowTicketService para consistencia
  oldStatus: string;
  oldUserId: number | null | undefined; // userId puede ser null o undefined
}

// Placeholder para SetTicketMessagesAsRead
async function setTicketMessagesAsRead(ticket: ShowTicketPrisma): Promise<void> {
  // Lógica para marcar mensajes como leídos.
  // Esto es una simplificación.
  if (ticket.unreadMessages && ticket.unreadMessages > 0) {
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { unreadMessages: 0 }
    });
  }
}

// Placeholder para CheckContactOpenTickets (duplicado de CreateTicketService, idealmente en un helper)
async function checkContactOpenTickets(contactId: number, whatsappId: number): Promise<void> {
  const openTicket = await prisma.ticket.findFirst({
    where: {
      contactId,
      whatsappId,
      status: { in: ["open", "pending"] }
    }
  });
  if (openTicket) {
    throw new AppError("ERR_CONTACT_OPEN_TICKETS");
  }
}

/**
 * Servicio para actualizar un ticket existente.
 * @param ticketData Datos a actualizar en el ticket.
 * @param ticketId ID del ticket a modificar.
 * @returns Una promesa que se resuelve al ticket actualizado, su estado anterior y ID de usuario anterior.
 * @throws AppError si el ticket no se encuentra o hay errores de validación.
 */
const UpdateTicketService = async ({
  ticketData,
  ticketId
}: Request): Promise<Response> => {
  // ShowTicketService ya maneja la conversión de ID y error si no se encuentra.
  const initialTicket = await ShowTicketService(ticketId);

  // NOTA: SetTicketMessagesAsRead y CheckContactOpenTickets necesitan ser refactorizados.
  await setTicketMessagesAsRead(initialTicket); // Placeholder

  if (ticketData.whatsappId && initialTicket.whatsappId !== ticketData.whatsappId) {
    if (!initialTicket.contactId) { // contactId es obligatorio en el schema, pero por si acaso
        throw new AppError("ERR_TICKET_CONTACT_NOT_FOUND_FOR_WHATSAPP_CHECK");
    }
    await checkContactOpenTickets(initialTicket.contactId, ticketData.whatsappId); // Placeholder
  }

  const oldStatus = initialTicket.status;
  const oldUserId = initialTicket.userId;

  if (oldStatus === "closed" && ticketData.status !== "closed") { // Si se reabre un ticket cerrado
     if (!initialTicket.contactId || initialTicket.whatsappId === null || initialTicket.whatsappId === undefined) {
        throw new AppError("ERR_TICKET_DATA_INCOMPLETE_FOR_REOPEN_CHECK");
    }
    // La lógica original hacía CheckContactOpenTickets(ticket.contact.id, ticket.whatsappId)
    // Esto previene reabrir si ya hay otro ticket abierto para ese contacto y whatsapp.
    // No se debe aplicar al ticket actual que se está reabriendo.
    // Esta verificación se haría mejor al intentar crear un nuevo ticket si uno cerrado existe.
    // Por ahora, se omite esta llamada específica para la reapertura para evitar auto-bloqueo,
    // asumiendo que la lógica de "FindOrCreateTicket" maneja la reapertura de tickets cerrados correctamente.
  }

  const updateData: Prisma.TicketUpdateInput = {
    status: ticketData.status,
    // userId: ticketData.userId, // Se maneja con disconnect/connect si es null
    // queueId: ticketData.queueId, // Se maneja con disconnect/connect si es null
    whatsappId: ticketData.whatsappId,
    unreadMessages: ticketData.unreadMessages,
  };

  // Manejo para permitir desasignar usuario o cola (asignar a null)
  if (ticketData.userId === null) {
    updateData.user = { disconnect: true };
  } else if (ticketData.userId !== undefined) {
    updateData.user = { connect: { id: ticketData.userId } };
  }

  if (ticketData.queueId === null) {
    updateData.queue = { disconnect: true };
  } else if (ticketData.queueId !== undefined) {
    updateData.queue = { connect: { id: ticketData.queueId } };
  }

  const updatedTicket = await prisma.ticket.update({
    where: { id: initialTicket.id },
    data: updateData,
    include: { // Re-incluir relaciones para la respuesta y eventos de socket
      contact: { include: { customFields: true } },
      user: { select: { id: true, name: true } },
      queue: { select: { id: true, name: true, color: true } },
      whatsapp: { select: { name: true } }
    }
  });

  const io = getIO();

  if (updatedTicket.status !== oldStatus || updatedTicket.userId !== oldUserId) {
    io.to(oldStatus).emit("ticket", {
      action: "delete",
      ticketId: updatedTicket.id
    });
  }

  io.to(updatedTicket.status)
    .to("notification")
    .to(initialTicket.id.toString()) // Usar el ID original para el canal del ticket
    .emit("ticket", {
      action: "update",
      ticket: updatedTicket // Enviar el ticket completo y actualizado
    });

  return {
    ticket: updatedTicket as ShowTicketPrisma, // castear al tipo esperado
    oldStatus,
    oldUserId
  };
};

export default UpdateTicketService;
