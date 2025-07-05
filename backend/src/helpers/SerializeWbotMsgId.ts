// import Message from "../models/Message"; // Usar PrismaMessage
// import Ticket from "../models/Ticket";   // Usar PrismaTicket
import { Ticket as PrismaTicket, Message as PrismaMessage, Contact as PrismaContact } from "../generated/prisma";
import AppError from "../errors/AppError"; // Para lanzar error si falta el contacto

// Definir un tipo para el ticket que espera esta función, asegurando que 'contact' esté presente.
type TicketWithContactRequired = PrismaTicket & {
  contact: PrismaContact; // Contacto es requerido aquí
};


/**
 * Serializa un ID de mensaje de WhatsApp para su uso interno, probablemente para referencias.
 * @param ticket El objeto Ticket de Prisma (debe incluir la relación `contact`).
 * @param message El objeto Message de Prisma.
 * @returns Un string que representa el ID del mensaje serializado.
 * @throws AppError si al ticket le falta la información de contacto.
 */
const SerializeWbotMsgId = (ticket: TicketWithContactRequired, message: PrismaMessage): string => {
  if (!ticket.contact) {
    // Esta comprobación es más para el compilador y robustez, aunque TicketWithContactRequired lo exige.
    throw new AppError("ERR_SERIALIZE_WAPP_MSG_NO_CONTACT");
  }

  const serializedMsgId = `${message.fromMe}_${ticket.contact.number}@${
    ticket.isGroup ? "g" : "c" // ticket.isGroup es un booleano
  }.us_${message.id}`; // message.id es el ID del mensaje de Wbot

  return serializedMsgId;
};

export default SerializeWbotMsgId;
