import fs from "fs";
import { MessageMedia, Message as WbotMessage, MessageSendOptions } from "whatsapp-web.js";
import AppError from "../../errors/AppError";
import GetTicketWbot from "../../helpers/GetTicketWbot"; // Necesita ser compatible con PrismaTicket
import prisma from "../../database";
import { Ticket as PrismaTicket, Contact as PrismaContact } from "../../generated/prisma";
import formatBody from "../../helpers/Mustache"; // Asumimos que es compatible

// Usar un tipo más específico para el ticket esperado, incluyendo el contacto
type TicketWithContact = PrismaTicket & { contact: PrismaContact | null };

interface Request {
  media: Express.Multer.File; // Este tipo viene de Express, se mantiene
  ticket: TicketWithContact; // Usar el tipo PrismaTicket con la relación de contacto
  body?: string;
}

/**
 * Envía un mensaje multimedia (imagen, audio, video, documento) a través de WhatsApp.
 * Actualiza el último mensaje del ticket en la base de datos.
 * @param media Archivo multimedia a enviar.
 * @param ticket Ticket asociado al mensaje.
 * @param body Cuerpo del mensaje opcional (usado como pie de foto/caption).
 * @returns Una promesa que se resuelve al objeto WbotMessage enviado.
 * @throws AppError si hay un error al enviar el mensaje.
 */
const SendWhatsAppMedia = async ({
  media,
  ticket,
  body
}: Request): Promise<WbotMessage> => {
  if (!ticket.contact) {
    throw new AppError("ERR_TICKET_CONTACT_NOT_FOUND");
  }

  try {
    // Asumimos que GetTicketWbot está adaptado para recibir PrismaTicket
    const wbot = await GetTicketWbot(ticket as any); // 'as any' temporal si GetTicketWbot no está tipado para PrismaTicket aún

    const newMedia = MessageMedia.fromFilePath(media.path);
    
    const messageBody = body ? formatBody(body, ticket.contact as any) : undefined;
    // 'as any' para ticket.contact si formatBody espera un tipo específico de Sequelize.

    let mediaOptions: MessageSendOptions = {
      caption: messageBody,
      sendAudioAsVoice: true
    };

    // La lógica original para enviar como documento si es imagen pero no tiene extensión común
    if (newMedia.mimetype.startsWith('image/') && !/^.*\.(jpe?g|png|gif)?$/i.exec(media.filename)) {
       mediaOptions.sendMediaAsDocument = true;
    }
    
    const sentMessage = await wbot.sendMessage(
      `${ticket.contact.number}@${ticket.isGroup ? "g" : "c"}.us`,
      newMedia,
      mediaOptions
    );

    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { lastMessage: body || media.filename }
    });

    // Eliminar el archivo local después de enviarlo
    fs.unlinkSync(media.path);

    return sentMessage;
  } catch (err: any) {
    // console.error("Error sending WhatsApp media:", err); // Loguear el error completo
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMedia;
