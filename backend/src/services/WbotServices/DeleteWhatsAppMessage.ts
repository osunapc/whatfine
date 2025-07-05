import AppError from "../../errors/AppError";
import prisma from "../../database";
import { Message as PrismaMessage, Ticket as PrismaTicket, Contact as PrismaContact } from "../../generated/prisma";
import GetWbotMessage from "../../helpers/GetWbotMessage"; // Necesita ser compatible con Prisma
// Asumimos que GetWbotMessage devolverá un objeto compatible con la API de whatsapp-web.js para .delete(true)

// Definir un tipo para el mensaje con su ticket y el contacto del ticket
type MessageWithTicketAndContact = PrismaMessage & {
  ticket: PrismaTicket & {
    contact: PrismaContact | null; // El contacto en el ticket puede ser null si la relación lo permite
  };
};

/**
 * Elimina un mensaje de WhatsApp tanto de la plataforma WhatsApp como de la base de datos local (marcando como eliminado).
 * @param messageId ID del mensaje a eliminar.
 * @returns Una promesa que se resuelve al objeto del mensaje actualizado (marcado como eliminado).
 * @throws AppError si el mensaje no se encuentra o si hay un error al eliminarlo de WhatsApp.
 */
const DeleteWhatsAppMessage = async (messageId: string): Promise<PrismaMessage> => {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: {
      ticket: { // Incluir el ticket asociado al mensaje
        include: {
          contact: true // Incluir el contacto del ticket
        }
      }
    }
  });

  if (!message) {
    throw new AppError("No message found with this ID.");
  }

  // Asegurarse de que ticket y ticket.contact existan si GetWbotMessage los necesita así.
  // El schema actual hace que ticket sea no-nulo en Message, pero contact en Ticket es opcional.
  // GetWbotMessage debe manejar esto o el tipo de ticket debe ser más estricto.
  if (!message.ticket) {
      throw new AppError("ERR_TICKET_NOT_FOUND_OF_MESSAGE");
  }

  // Asumimos que GetWbotMessage está adaptado para recibir PrismaTicket y messageId
  // y que message.ticket es el objeto Ticket de Prisma.
  const messageToDelete = await GetWbotMessage(message.ticket as any, messageId);
  // Se usa 'as any' temporalmente para ticket, ya que GetWbotMessage podría esperar una estructura específica.

  try {
    // Esta parte interactúa con la librería de WhatsApp, no con Prisma directamente.
    await messageToDelete.delete(true); // true para eliminar para todos
  } catch (err: any) {
    // Podríamos querer loguear err.message o err completo para más detalles.
    throw new AppError("ERR_DELETE_WAPP_MSG");
  }

  const updatedMessage = await prisma.message.update({
    where: { id: messageId },
    data: { isDeleted: true }
  });

  return updatedMessage;
};

export default DeleteWhatsAppMessage;
