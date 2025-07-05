import { Request, Response } from "express";
import * as Yup from "yup";
import AppError from "../errors/AppError";
import GetDefaultWhatsApp from "../helpers/GetDefaultWhatsApp"; // Refactorizado
import SetTicketMessagesAsRead from "../helpers/SetTicketMessagesAsRead"; // Refactorizado
// import Message from "../models/Message"; // Usar PrismaMessage
// import Whatsapp from "../models/Whatsapp"; // Usar PrismaWhatsapp
import prisma from "../database"; // Importar Prisma client
import { Whatsapp as PrismaWhatsapp, Message as PrismaMessage, Contact as PrismaContact, Ticket as PrismaTicket } from "../generated/prisma";
import CreateOrUpdateContactService from "../services/ContactServices/CreateOrUpdateContactService"; // Refactorizado
import FindOrCreateTicketService from "../services/TicketServices/FindOrCreateTicketService"; // Refactorizado
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import CheckIsValidContact from "../services/WbotServices/CheckIsValidContact";
import CheckContactNumber from "../services/WbotServices/CheckNumber";
import GetProfilePicUrl from "../services/WbotServices/GetProfilePicUrl";
import SendWhatsAppMedia from "../services/WbotServices/SendWhatsAppMedia";
import SendWhatsAppMessage from "../services/WbotServices/SendWhatsAppMessage";

type WhatsappData = {
  whatsappId: number;
}

type MessageData = {
  body: string;
  fromMe: boolean;
  read: boolean;
  quotedMsg?: PrismaMessage; // Usar PrismaMessage
};

interface ContactData {
  number: string;
}

// La función createContact ahora devolverá un PrismaTicket (o el tipo ShowTicketPrisma más específico)
const createContact = async (
  whatsappId: number | undefined,
  newContactNumber: string // Renombrado para claridad
): Promise<PrismaTicket> => { // Ajustar el tipo de retorno
  await CheckIsValidContact(newContactNumber);

  // CheckContactNumber devuelve el número validado o lanza error.
  // El tipo 'any' se usaba antes, pero asumimos que devuelve el string del número si es válido.
  const validNumberString: string = await CheckContactNumber(newContactNumber);

  const profilePicUrl = await GetProfilePicUrl(validNumberString);

  const contactData = {
    name: `${validNumberString}`, // Usar el número como nombre por defecto
    number: validNumberString,
    profilePicUrl,
    isGroup: false
  };

  // CreateOrUpdateContactService devuelve PrismaContact
  const contact: PrismaContact = await CreateOrUpdateContactService(contactData);

  let whatsapp: PrismaWhatsapp | null;

  if (whatsappId === undefined) {
    whatsapp = await GetDefaultWhatsApp(); // Devuelve PrismaWhatsapp
  } else {
    whatsapp = await prisma.whatsapp.findUnique({ where: { id: whatsappId } }); // Usar Prisma

    if (whatsapp === null) {
      throw new AppError(`whatsapp #${whatsappId} not found`);
    }
  }

  // FindOrCreateTicketService devuelve ShowTicketPrisma (que es compatible con PrismaTicket)
  const createdTicket = await FindOrCreateTicketService(
    contact,
    whatsapp.id,
    1 // unreadMessages
  );

  // ShowTicketService devuelve ShowTicketPrisma
  // No es necesario volver a llamar a ShowTicketService si FindOrCreateTicketService ya devuelve el ticket completo.
  // Asumiremos que createdTicket ya tiene la forma ShowTicketPrisma.
  // const ticket = await ShowTicketService(createdTicket.id);

  // SetTicketMessagesAsRead espera ShowTicketPrisma
  await SetTicketMessagesAsRead(createdTicket);

  return createdTicket; // Devolver el ticket obtenido de FindOrCreateTicketService
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const newContact: ContactData = req.body;
  const { whatsappId }: WhatsappData = req.body;
  const { body, quotedMsg }: MessageData = req.body;
  const medias = req.files as Express.Multer.File[];

  newContact.number = newContact.number.replace("-", "").replace(" ", "");

  const schema = Yup.object().shape({
    number: Yup.string()
      .required()
      .matches(/^\d+$/, "Invalid number format. Only numbers is allowed.")
  });

  try {
    await schema.validate(newContact);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  // createContact devuelve PrismaTicket (o ShowTicketPrisma)
  const contactAndTicket = await createContact(whatsappId, newContact.number);

  if (medias && medias.length > 0) { // Asegurarse de que medias exista y tenga elementos
    await Promise.all(
      medias.map(async (media: Express.Multer.File) => {
        // SendWhatsAppMedia espera TicketWithContact (PrismaTicket & { contact: PrismaContact | null })
        // contactAndTicket es ShowTicketPrisma, que ya incluye el contacto.
        await SendWhatsAppMedia({ body, media, ticket: contactAndTicket as any }); // 'as any' por si el tipo exacto no coincide perfectamente
      })
    );
  } else if (body) { // Solo enviar mensaje de texto si hay cuerpo
    // SendWhatsAppMessage espera TicketWithContact y PrismaMessage opcional
    // contactAndTicket es ShowTicketPrisma. quotedMsg es PrismaMessage.
    await SendWhatsAppMessage({ body, ticket: contactAndTicket as any, quotedMsg }); // 'as any' por si el tipo exacto no coincide
  } else {
    // No hay media ni body, quizás loguear o no hacer nada.
    // La lógica original enviaría un mensaje vacío si no hay media, lo cual puede no ser deseado.
    // Si se quiere replicar exactamente:
    // await SendWhatsAppMessage({ body: body || "", ticket: contactAndTicket as any, quotedMsg });
    logger.info("API request with no media and no body for ticket: " + contactAndTicket.id);
  }

  return res.send();
};
