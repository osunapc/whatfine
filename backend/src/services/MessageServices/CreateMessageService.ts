import { getIO } from "../../libs/socket";
import prisma from "../../database";
import { Message as PrismaMessage, Prisma } from "../../generated/prisma";
import { MessageWithRelations } from "./ListMessagesService"; // Reutilizar tipo
import { ShowTicketPrisma } from "../TicketServices/ShowTicketService"; // Para el tipo de ticket en el evento de socket

/**
 * Interfaz para los datos del mensaje a crear o actualizar.
 * El ID es obligatorio para la operación de upsert.
 */
interface MessageData {
  id: string; // ID del mensaje (generalmente de wpp)
  ticketId: number;
  body: string;
  contactId?: number | null; // Permitir null
  fromMe?: boolean;
  read?: boolean;
  mediaType?: string | null; // Permitir null
  mediaUrl?: string | null; // Permitir null
  quotedMsgId?: string | null; // ID del mensaje citado
  // Los campos createdAt y updatedAt son manejados por Prisma (@default(now()) y @updatedAt)
}

/**
 * Interfaz para la solicitud del servicio de creación/actualización de mensajes.
 */
interface Request {
  messageData: MessageData;
}

/**
 * Servicio para crear o actualizar un mensaje (upsert).
 * También emite un evento de socket.io tras la operación.
 * @param messageData Datos del mensaje.
 * @returns Una promesa que se resuelve al mensaje creado/actualizado con sus relaciones.
 * @throws Error si la operación de upsert o la búsqueda posterior fallan.
 */
const CreateMessageService = async ({
  messageData
}: Request): Promise<MessageWithRelations> => {

  const { id, ticketId, body, contactId, fromMe, read, mediaType, mediaUrl, quotedMsgId } = messageData;

  const messageUpsertData: Prisma.MessageUpsertArgs = {
    where: { id },
    create: {
      id,
      body,
      fromMe,
      read,
      mediaType,
      mediaUrl,
      ticket: { connect: { id: ticketId } },
      ...(contactId && { contact: { connect: { id: contactId } } }),
      ...(quotedMsgId && { quotedMsg: { connect: { id: quotedMsgId } } })
    },
    update: {
      body,
      fromMe,
      read,
      mediaType,
      mediaUrl,
      // No actualizamos ticketId, contactId, quotedMsgId en un update simple de mensaje via upsert
      // a menos que la lógica de negocio lo requiera explícitamente.
      // Si se necesita cambiar estas relaciones, sería una operación más compleja.
    },
    include: { // Incluir relaciones para la respuesta y el evento de socket
      contact: true,
      ticket: {
        include: {
          contact: true, // Contacto del ticket
          queue: true,
          whatsapp: { select: { name: true, id: true } } // Incluir id para consistencia
        }
      },
      quotedMsg: {
        include: {
          contact: true
        }
      }
    }
  };

  // Upsert el mensaje
  // const message = await prisma.message.upsert(messageUpsertData);
  // La línea anterior no funciona porque el include no es parte del upsertArgs directamente
  // sino que se aplica al resultado.
  // Haremos create u update, y luego un find para obtener las relaciones deseadas.

  let message: PrismaMessage;
  const existingMessage = await prisma.message.findUnique({ where: {id}});

  if (existingMessage) {
    message = await prisma.message.update({
        where: {id},
        data: messageUpsertData.update
    });
  } else {
    message = await prisma.message.create({
        data: messageUpsertData.create as Prisma.MessageCreateInput // Castear porque create es parte de MessageCreateInput
    });
  }


  // Volver a buscar el mensaje con todas las inclusiones necesarias para el evento de socket
  const messageWithFullDetails = await prisma.message.findUnique({
    where: { id: message.id },
    include: {
      contact: true,
      ticket: {
        include: {
          contact: true,
          queue: true,
          whatsapp: { select: { name: true, id: true } }
        }
      },
      quotedMsg: {
        include: {
          contact: true
        }
      }
    }
  });


  if (!messageWithFullDetails) {
    // Esto no debería ocurrir si el upsert/create/update fue exitoso
    throw new Error("ERR_FETCHING_MESSAGE_AFTER_UPSERT");
  }

  const io = getIO();
  if (messageWithFullDetails.ticket) { // Asegurar que el ticket existe
    io.to(messageWithFullDetails.ticketId.toString())
      .to(messageWithFullDetails.ticket.status) // status del ticket
      .to("notification")
      .emit("appMessage", {
        action: "create", // O "update" si se quiere distinguir, pero la lógica original emitía "create"
        message: messageWithFullDetails,
        ticket: messageWithFullDetails.ticket as ShowTicketPrisma, // Castear al tipo esperado por el frontend
        contact: messageWithFullDetails.ticket.contact // Contacto del ticket
      });
  }

  return messageWithFullDetails as MessageWithRelations;
};

export default CreateMessageService;
