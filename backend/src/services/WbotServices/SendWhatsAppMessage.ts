import { Message as WbotMessage } from "whatsapp-web.js";
import AppError from "../../errors/AppError";
import GetTicketWbot from "../../helpers/GetTicketWbot"; // Necesita ser compatible con PrismaTicket
import GetWbotMessage from "../../helpers/GetWbotMessage"; // Necesita ser compatible con PrismaTicket y PrismaMessage
import SerializeWbotMsgId from "../../helpers/SerializeWbotMsgId"; // Necesita ser compatible
import prisma from "../../database";
import { Ticket as PrismaTicket, Message as PrismaMessage, Contact as PrismaContact } from "../../generated/prisma";
import formatBody from "../../helpers/Mustache"; // Asumimos que es compatible

// Usar un tipo más específico para el ticket esperado, incluyendo el contacto
type TicketWithContact = PrismaTicket & { contact: PrismaContact | null };

interface Request {
  body: string;
  ticket: TicketWithContact; // Usar el tipo PrismaTicket con la relación de contacto
  quotedMsg?: PrismaMessage; // Usar el tipo PrismaMessage
}

/**
 * Envía un mensaje de texto a través de WhatsApp.
 * Actualiza el último mensaje del ticket en la base de datos.
 * @param body Cuerpo del mensaje de texto.
 * @param ticket Ticket asociado al mensaje.
 * @param quotedMsg Mensaje original al que se está respondiendo (opcional).
 * @returns Una promesa que se resuelve al objeto WbotMessage enviado.
 * @throws AppError si hay un error al enviar el mensaje.
 */
const SendWhatsAppMessage = async ({
  body,
  ticket,
  quotedMsg
}: Request): Promise<WbotMessage> => {
  if (!ticket.contact) {
    throw new AppError("ERR_TICKET_CONTACT_NOT_FOUND");
  }

  let quotedMsgSerializedId: string | undefined;

  // Asumimos que los helpers GetWbotMessage y SerializeWbotMsgId están adaptados
  if (quotedMsg) {
    // GetWbotMessage podría no ser necesario aquí si SerializeWbotMsgId puede funcionar solo con el ID del mensaje
    // y el ticket. La implementación original lo llamaba, así que lo mantenemos conceptualmente.
    // await GetWbotMessage(ticket as any, quotedMsg.id); // 'as any' temporal
    quotedMsgSerializedId = SerializeWbotMsgId(ticket as any, quotedMsg as any); // 'as any' temporal
  }

  // Asumimos que GetTicketWbot está adaptado
  const wbot = await GetTicketWbot(ticket as any); // 'as any' temporal

  try {
    const sentMessage = await wbot.sendMessage(
      `${ticket.contact.number}@${ticket.isGroup ? "g" : "c"}.us`,
      formatBody(body, ticket.contact as any), // 'as any' para ticket.contact si formatBody espera tipo Sequelize
      {
        quotedMessageId: quotedMsgSerializedId,
        linkPreview: false // Mantener la opción original
      }
    );

    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { lastMessage: body }
    });

    return sentMessage;
  } catch (err: any) {
    // console.error("Error sending WhatsApp message:", err);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMessage;
