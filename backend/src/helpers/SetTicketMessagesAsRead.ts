import { getIO } from "../libs/socket";
import prisma from "../database";
import { Ticket as PrismaTicket, Contact as PrismaContact } from "../../generated/prisma"; // Asumiendo que Ticket incluye Contact
import { logger } from "../utils/logger";
import GetTicketWbot from "./GetTicketWbot"; // Necesitará ser compatible con PrismaTicket

// Definir un tipo para el parámetro ticket que espera este helper,
// incluyendo las relaciones necesarias (contact).
// ShowTicketPrisma de ShowTicketService es un buen candidato si ya tiene todo.
import { ShowTicketPrisma } from "../services/TicketServices/ShowTicketService";


/**
 * Marca todos los mensajes no leídos de un ticket como leídos.
 * Actualiza el contador de mensajes no leídos del ticket a 0.
 * Intenta enviar una confirmación de lectura (sendSeen) a través de wbot.
 * Emite un evento de socket para actualizar el estado de no leídos en la UI.
 * @param ticket El objeto Ticket (tipo Prisma, con la relación `contact` incluida).
 */
const SetTicketMessagesAsRead = async (ticket: ShowTicketPrisma): Promise<void> => {
  await prisma.message.updateMany({
    where: {
      ticketId: ticket.id,
      read: false
    },
    data: { read: true }
  });

  await prisma.ticket.update({
    where: { id: ticket.id },
    data: { unreadMessages: 0 }
  });

  // La lógica de GetTicketWbot y wbot.sendSeen necesita ser compatible con PrismaTicket.
  // Asumimos que GetTicketWbot se adaptará.
  if (ticket.contact) { // Contact es necesario para sendSeen
    try {
      const wbot = await GetTicketWbot(ticket); // GetTicketWbot debe poder manejar el ticket de Prisma
      await wbot.sendSeen(
        `${ticket.contact.number}@${ticket.isGroup ? "g" : "c"}.us`
      );
    } catch (err: any) { // Especificar tipo para err
      logger.warn(
        `Could not mark messages as read via wbot. Maybe whatsapp session disconnected? TicketID: ${ticket.id}, Err: ${err.message}`
      );
    }
  } else {
    logger.warn(`Cannot sendSeen for ticket ${ticket.id} because contact is not loaded.`);
  }


  const io = getIO();
  io.to(ticket.status) // ticket.status debería estar disponible
    .to("notification")
    .to(ticket.id.toString()) // Emitir al canal específico del ticket también
    .emit("ticket", {
    action: "updateUnread",
    ticketId: ticket.id
  });
};

export default SetTicketMessagesAsRead;
