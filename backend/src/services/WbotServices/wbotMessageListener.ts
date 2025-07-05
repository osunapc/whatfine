import { join } from "path";
import { promisify } from "util";
import { writeFile } from "fs";
import * as Sentry from "@sentry/node";

import {
  Contact as WbotContact,
  Message as WbotMessage,
  MessageAck,
  Client
} from "whatsapp-web.js";

// import Contact from "../../models/Contact"; // Usar Prisma.Contact
// import Ticket from "../../models/Ticket";   // Usar Prisma.Ticket
// import Message from "../../models/Message"; // Usar Prisma.Message
import prisma from "../../database";
import {
  Contact as PrismaContact,
  Ticket as PrismaTicket,
  Message as PrismaMessage,
  Whatsapp as PrismaWhatsapp, // Necesario para ShowWhatsAppService
  Queue as PrismaQueue       // Necesario para ShowWhatsAppService
} from "../../generated/prisma";


import { getIO } from "../../libs/socket";
import CreateMessageService from "../MessageServices/CreateMessageService";
import { logger } from "../../utils/logger";
import CreateOrUpdateContactService from "../ContactServices/CreateOrUpdateContactService";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import { debounce } from "../../helpers/Debounce";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import CreateContactService from "../ContactServices/CreateContactService";
import GetContactService from "../ContactServices/GetContactService";
import formatBody from "../../helpers/Mustache";

interface Session extends Client {
  id?: number;
}

const writeFileAsync = promisify(writeFile);

/**
 * Verifica y crea o actualiza un contacto en la base de datos a partir de un WbotContact.
 * @param msgContact El objeto WbotContact de whatsapp-web.js.
 * @returns Una promesa que se resuelve al contacto de Prisma creado o actualizado.
 */
const verifyContact = async (msgContact: WbotContact): Promise<PrismaContact> => {
  const profilePicUrl = await msgContact.getProfilePicUrl(); // Esto puede ser null

  const contactData = {
    name: msgContact.name || msgContact.pushname || msgContact.id.user,
    number: msgContact.id.user, // Este es el JID, ej: "xxxxxxxxxxx@c.us" o "xxxxxxxxxxx-yyyyyyyyyy@g.us"
                               // CreateOrUpdateContactService limpia el @c.us para números no grupales.
    profilePicUrl: profilePicUrl ?? undefined, // Asegurar que sea undefined si es null
    isGroup: msgContact.isGroup
  };

  // CreateOrUpdateContactService ya está refactorizado y devuelve PrismaContact
  const contact = await CreateOrUpdateContactService(contactData);

  return contact;
};

const verifyQuotedMessage = async (
  msg: WbotMessage
): Promise<PrismaMessage | null> => {
  if (!msg.hasQuotedMsg) return null;

  const wbotQuotedMsg = await msg.getQuotedMessage();

  const quotedMsg = await prisma.message.findUnique({
    where: { id: wbotQuotedMsg.id.id }
  });

  if (!quotedMsg) return null;

  return quotedMsg;
};


// generate random id string for file names, function got from: https://stackoverflow.com/a/1349426/1851801
function makeRandomId(length: number) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < length) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
      counter += 1;
    }
    return result;
}

/**
 * Procesa y guarda un mensaje multimedia.
 * @param msg El mensaje de Wbot (con multimedia).
 * @param ticket El ticket de Prisma asociado.
 * @param contact El contacto de Prisma asociado.
 * @returns Una promesa que se resuelve al mensaje de Prisma creado.
 */
const verifyMediaMessage = async (
  msg: WbotMessage,
  ticket: PrismaTicket, // Usar tipo Prisma
  contact: PrismaContact // Usar tipo Prisma
): Promise<PrismaMessage> => { // Devolver tipo Prisma
  const quotedMsg = await verifyQuotedMessage(msg); // Ya devuelve PrismaMessage | null

  const media = await msg.downloadMedia(); // Esto es de whatsapp-web.js

  if (!media) {
    throw new Error("ERR_WAPP_DOWNLOAD_MEDIA");
  }

  let randomId = makeRandomId(5);

  if (!media.filename) {
    const ext = media.mimetype.split("/")[1].split(";")[0];
    media.filename = `${randomId}-${new Date().getTime()}.${ext}`;
  } else {
    media.filename = media.filename.split('.').slice(0,-1).join('.')+'.'+randomId+'.'+media.filename.split('.').slice(-1);
  }

  try {
    await writeFileAsync(
      join(__dirname, "..", "..", "..", "public", media.filename),
      media.data,
      "base64"
    );
  } catch (err) {
    Sentry.captureException(err);
    logger.error(err);
  }

  const messageData = {
    id: msg.id.id,
    ticketId: ticket.id,
    contactId: msg.fromMe ? undefined : contact.id,
    body: msg.body || media.filename,
    fromMe: msg.fromMe,
    read: msg.fromMe,
    mediaUrl: media.filename,
    mediaType: media.mimetype.split("/")[0],
    quotedMsgId: quotedMsg?.id // quotedMsg es PrismaMessage | null
  };

  await prisma.ticket.update({ // Usar prisma.ticket.update
    where: { id: ticket.id },
    data: { lastMessage: msg.body || media.filename }
  });

  // CreateMessageService ya está refactorizado y devuelve PrismaMessage
  const newMessage = await CreateMessageService({ messageData });

  return newMessage;
};

/**
 * Procesa y guarda un mensaje de texto o localización.
 * @param msg El mensaje de Wbot.
 * @param ticket El ticket de Prisma asociado.
 * @param contact El contacto de Prisma asociado.
 */
const verifyMessage = async (
  msg: WbotMessage,
  ticket: PrismaTicket, // Usar tipo Prisma
  contact: PrismaContact // Usar tipo Prisma
): Promise<void> => { // No devuelve nada explícitamente

  let finalBody = msg.body;
  let lastMessageContent = msg.body;

  if (msg.type === 'location') {
    const leichter = prepareLocation(msg); // prepareLocation modifica msg.body
    finalBody = leichter.body; // el cuerpo modificado para guardar
    // @ts-ignore
    lastMessageContent = msg.location.description ? "Localization - " + msg.location.description.split('\\n')[0] : "Localization";
  }

  const quotedMsg = await verifyQuotedMessage(msg); // Ya devuelve PrismaMessage | null

  const messageData = {
    id: msg.id.id,
    ticketId: ticket.id,
    contactId: msg.fromMe ? undefined : contact.id,
    body: finalBody, // Usar el cuerpo posiblemente modificado por prepareLocation
    fromMe: msg.fromMe,
    mediaType: msg.type,
    read: msg.fromMe,
    quotedMsgId: quotedMsg?.id
  };

  await prisma.ticket.update({ // Usar prisma.ticket.update
    where: { id: ticket.id },
    data: { lastMessage: lastMessageContent }
  });

  // CreateMessageService ya está refactorizado
  await CreateMessageService({ messageData });
};

const prepareLocation = (msg: WbotMessage): WbotMessage => { // Devuelve WbotMessage modificado
  let gmapsUrl = "https://maps.google.com/maps?q=" + msg.location.latitude + "%2C" + msg.location.longitude + "&z=17&hl=pt-BR";

  msg.body = "data:image/png;base64," + msg.body + "|" + gmapsUrl;

  // temporaryly disable ts checks because of type definition bug for Location object
  // @ts-ignore
  msg.body += "|" + (msg.location.description ? msg.location.description : (msg.location.latitude + ", " + msg.location.longitude))

  return msg;
};

/**
 * Maneja la lógica de selección de cola para un ticket si es necesario.
 * @param wbot La instancia de Wbot (cliente de whatsapp-web.js).
 * @param msg El mensaje de Wbot que activó la lógica (usado para obtener la opción del usuario).
 * @param ticket El ticket de Prisma asociado.
 * @param contact El contacto de Prisma asociado.
 */
const verifyQueue = async (
  wbot: Session, // Session extiende Client y tiene id?: number
  msg: WbotMessage,
  ticket: PrismaTicket, // Usar tipo Prisma
  contact: PrismaContact // Usar tipo Prisma
): Promise<void> => {
  // ShowWhatsAppService devuelve WhatsappWithQueues, que tiene .queues como PrismaQueue[]
  // y .greetingMessage
  const whatsapp = await ShowWhatsAppService(wbot.id!); // wbot.id debe estar presente y ser válido

  if (!whatsapp || !whatsapp.queues) {
    logger.error(`WhatsApp o sus colas no encontradas para wbot id: ${wbot.id}`);
    return;
  }
  const { queues, greetingMessage } = whatsapp;


  if (queues.length === 1) {
    await UpdateTicketService({ // Ya refactorizado
      ticketData: { queueId: queues[0].id },
      ticketId: ticket.id.toString() // UpdateTicketService espera string o number
    });
    return;
  }

  const selectedOption = msg.body; // El usuario envía un número correspondiente a la opción de cola
  const choosenQueue = queues[+selectedOption - 1]; // Convierte a número y ajusta índice

  if (choosenQueue) {
    await UpdateTicketService({ // Ya refactorizado
      ticketData: { queueId: choosenQueue.id },
      ticketId: ticket.id.toString()
    });

    // Asegurarse de que choosenQueue.greetingMessage no sea null si se va a usar en formatBody
    const body = formatBody(`\u200e${choosenQueue.greetingMessage || ""}`, contact as any);
    // 'as any' para contact si formatBody espera un tipo específico de Sequelize.

    const sentMessage = await wbot.sendMessage(`${contact.number}@c.us`, body);
    // verifyMessage ya está refactorizado y espera PrismaTicket y PrismaContact
    await verifyMessage(sentMessage, ticket, contact);
  } else {
    let options = "";
    queues.forEach((queue, index) => {
      options += `*${index + 1}* - ${queue.name}\n`;
    });

    // Asegurarse de que greetingMessage no sea null
    const body = formatBody(`\u200e${greetingMessage || ""}\n${options}`, contact as any);
    // 'as any' para contact

    const debouncedSentMessage = debounce(
      async () => {
        const sentMessage = await wbot.sendMessage(
          `${contact.number}@c.us`,
          body
        );
        verifyMessage(sentMessage, ticket, contact);
      },
      3000,
      ticket.id
    );

    debouncedSentMessage();
  }
};

const isValidMsg = (msg: WbotMessage): boolean => {
  if (msg.from === "status@broadcast") return false;
  if (
    msg.type === "chat" ||
    msg.type === "audio" ||
    msg.type === "ptt" ||
    msg.type === "video" ||
    msg.type === "image" ||
    msg.type === "document" ||
    msg.type === "vcard" ||
    //msg.type === "multi_vcard" ||
    msg.type === "sticker" ||
    msg.type === "location"
  )
    return true;
  return false;
};

const handleMessage = async (
const handleMessage = async (
  msg: WbotMessage, // Mensaje de whatsapp-web.js
  wbot: Session     // Cliente de whatsapp-web.js, con `id` de nuestra BD añadido
): Promise<void> => {
  if (!isValidMsg(msg)) {
    return;
  }

  try {
    let msgContact: WbotContact; // Objeto Contacto de whatsapp-web.js
    let groupContact: PrismaContact | undefined; // Contacto de grupo de nuestra BD (Prisma)

    if (msg.fromMe) {
      // messages sent automatically by wbot have a special character in front of it
      // if so, this message was already been stored in database;
      if (/\u200e/.test(msg.body[0])) return;

      // media messages sent from me from cell phone, first comes with "hasMedia = false" and type = "image/ptt/etc"
      // in this case, return and let this message be handled by "media_uploaded" event, when it will have "hasMedia = true"

      if (!msg.hasMedia && msg.type !== "location" && msg.type !== "chat" && msg.type !== "vcard"
        //&& msg.type !== "multi_vcard"
      ) return;

      msgContact = await wbot.getContactById(msg.to);
    } else {
      msgContact = await msg.getContact();
    }

    const chat = await msg.getChat();

    if (chat.isGroup) {
      let msgGroupContact;

      if (msg.fromMe) {
        msgGroupContact = await wbot.getContactById(msg.to);
      } else {
        msgGroupContact = await wbot.getContactById(msg.from);
      }

      groupContact = await verifyContact(msgGroupContact); // Devuelve PrismaContact
    }
    // ShowWhatsAppService devuelve WhatsappWithQueues (que es PrismaWhatsapp & { queues: PrismaQueue[] })
    const whatsapp = await ShowWhatsAppService(wbot.id!);

    const unreadMessages = msg.fromMe ? 0 : chat.unreadCount;

    const contact = await verifyContact(msgContact); // Devuelve PrismaContact

    if (
      unreadMessages === 0 &&
      whatsapp.farewellMessage &&
      formatBody(whatsapp.farewellMessage, contact as any) === msg.body // contact es PrismaContact
    )
      return;

    // FindOrCreateTicketService devuelve ShowTicketPrisma (PrismaTicket con relaciones)
    const ticket = await FindOrCreateTicketService(
      contact,
      wbot.id!, // wbot.id es el whatsappId
      unreadMessages,
      groupContact
    );

    if (msg.hasMedia) {
      // verifyMediaMessage espera PrismaTicket y PrismaContact
      await verifyMediaMessage(msg, ticket, contact);
    } else {
      // verifyMessage espera PrismaTicket y PrismaContact
      await verifyMessage(msg, ticket, contact);
    }

    if (
      !ticket.queueId && // En Prisma, la relación directa es ticket.queue, pero el ID es queueId
      !chat.isGroup &&
      !msg.fromMe &&
      !ticket.userId &&
      whatsapp.queues && whatsapp.queues.length >= 1
    ) {
      // verifyQueue espera PrismaTicket y PrismaContact
      await verifyQueue(wbot, msg, ticket, contact);
    }

    if (msg.type === "vcard") {
      try {
        const array = msg.body.split("\n");
        const obj = [];
        let contact = "";
        for (let index = 0; index < array.length; index++) {
          const v = array[index];
          const values = v.split(":");
          for (let ind = 0; ind < values.length; ind++) {
            if (values[ind].indexOf("+") !== -1) {
              obj.push({ number: values[ind] });
            }
            if (values[ind].indexOf("FN") !== -1) {
              contact = values[ind + 1];
            }
          }
        }
        for await (const ob of obj) {
          const cont = await CreateContactService({
            name: contact,
            number: ob.number.replace(/\D/g, "")
          });
        }
      } catch (error) {
        console.log(error);
      }
    }

    /* if (msg.type === "multi_vcard") {
      try {
        const array = msg.vCards.toString().split("\n");
        let name = "";
        let number = "";
        const obj = [];
        const conts = [];
        for (let index = 0; index < array.length; index++) {
          const v = array[index];
          const values = v.split(":");
          for (let ind = 0; ind < values.length; ind++) {
            if (values[ind].indexOf("+") !== -1) {
              number = values[ind];
            }
            if (values[ind].indexOf("FN") !== -1) {
              name = values[ind + 1];
            }
            if (name !== "" && number !== "") {
              obj.push({
                name,
                number
              });
              name = "";
              number = "";
            }
          }
        }

        // eslint-disable-next-line no-restricted-syntax
        for await (const ob of obj) {
          try {
            const cont = await CreateContactService({
              name: ob.name,
              number: ob.number.replace(/\D/g, "")
            });
            conts.push({
              id: cont.id,
              name: cont.name,
              number: cont.number
            });
          } catch (error) {
            if (error.message === "ERR_DUPLICATED_CONTACT") {
              const cont = await GetContactService({
                name: ob.name,
                number: ob.number.replace(/\D/g, ""),
                email: ""
              });
              conts.push({
                id: cont.id,
                name: cont.name,
                number: cont.number
              });
            }
          }
        }
        msg.body = JSON.stringify(conts);
      } catch (error) {
        console.log(error);
      }
    } */
  } catch (err) {
    Sentry.captureException(err);
    logger.error(`Error handling whatsapp message: Err: ${err}`);
  }
};

const handleMsgAck = async (msg: WbotMessage, ack: MessageAck) => {
  await new Promise(r => setTimeout(r, 500)); // Mantener la pausa

  const io = getIO();

  try {
    // Buscar el mensaje en la BD para actualizar su 'ack'
    // Incluir relaciones necesarias si el evento de socket las espera
    const messageToUpdate = await prisma.message.findUnique({
      where: { id: msg.id.id }, // msg.id.id es el ID del mensaje de Wbot
      include: {
        contact: true, // Contacto que envió este mensaje
        ticket: { // Ticket al que pertenece el mensaje (para el canal de socket.io)
          select: { status: true, id: true } // Solo necesitamos el status y el id del ticket
        },
        quotedMsg: { // Mensaje citado
          include: {
            contact: true // Contacto del mensaje citado
          }
        }
      }
    });

    if (!messageToUpdate) {
      logger.warn(`Message ${msg.id.id} not found in DB for ACK update.`);
      return;
    }

    const updatedMessage = await prisma.message.update({
      where: { id: messageToUpdate.id },
      data: { ack: ack },
      include: { // Re-incluir para el payload del evento, para consistencia con CreateMessage
        contact: true,
        ticket: {
            include: {
                contact: true,
                queue: true,
                whatsapp: {select: {name: true, id: true}}
            }
        },
        quotedMsg: { include: { contact: true } }
      }
    });

    // messageToUpdate.ticketId ya no existe directamente, usamos updatedMessage.ticketId
    io.to(updatedMessage.ticketId.toString()).emit("appMessage", {
      action: "update",
      message: updatedMessage // Enviar el mensaje completo y actualizado
    });
  } catch (err: any) { // Especificar tipo para err
    Sentry.captureException(err);
    logger.error(`Error handling message ack for ${msg.id.id}. Err: ${err.message}`);
  }
};

const wbotMessageListener = (wbot: Session): void => {
  wbot.on("message_create", async msg => {
    handleMessage(msg, wbot);
  });

  wbot.on("media_uploaded", async msg => {
    handleMessage(msg, wbot);
  });

  wbot.on("message_ack", async (msg, ack) => {
    handleMsgAck(msg, ack);
  });
};

export { wbotMessageListener, handleMessage };
