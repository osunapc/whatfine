import AppError from "../../errors/AppError";
import prisma from "../../database";
import { Ticket as PrismaTicket, User as PrismaUser, Whatsapp as PrismaWhatsapp, Queue as PrismaQueue } from "../../generated/prisma";
import ShowContactService from "../ContactServices/ShowContactService"; // Ya refactorizado
// import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp"; // Necesitará refactorización o reemplazo
// import CheckContactOpenTickets from "../../helpers/CheckContactOpenTickets"; // Necesitará refactorización o reemplazo

/**
 * Interfaz para la solicitud del servicio de creación de tickets.
 */
interface Request {
  /** ID del contacto para el cual se crea el ticket. */
  contactId: number;
  /** Estado inicial del ticket. */
  status: string;
  /** ID del usuario que crea o al que se asigna inicialmente el ticket. */
  userId: number;
  /** ID de la cola a la que se asignará el ticket (opcional). */
  queueId?: number;
}

// Placeholder para GetDefaultWhatsApp (simulado por ahora)
async function getOrCreateDefaultWhatsapp(userId: number): Promise<PrismaWhatsapp> {
  // Lógica para obtener el WhatsApp por defecto del usuario o el global
  // Esto es una simplificación y necesitará la implementación real.
  let user = await prisma.user.findUnique({ where: { id: userId }, include: { whatsapp: true } });
  if (user?.whatsapp) return user.whatsapp;

  let defaultWhatsapp = await prisma.whatsapp.findFirst({ where: { isDefault: true } });
  if (!defaultWhatsapp) {
    // Si no hay un WhatsApp por defecto, intenta tomar el primero que encuentre o crea uno (lógica de negocio)
    defaultWhatsapp = await prisma.whatsapp.findFirst();
    if (!defaultWhatsapp) throw new AppError("NO_DEFAULT_WHATSAPP_FOUND");
    // Opcionalmente, crear uno si la lógica lo permite:
    // defaultWhatsapp = await prisma.whatsapp.create({ data: { name: "Default", status: "INITIALIZING", isDefault: true }});
  }
  return defaultWhatsapp;
}

// Placeholder para CheckContactOpenTickets (simulado por ahora)
async function checkContactOpenTickets(contactId: number, whatsappId: number): Promise<void> {
  // Lógica para verificar si el contacto ya tiene tickets abiertos para este whatsappId
  // Esto es una simplificación y necesitará la implementación real.
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
 * Servicio para crear un nuevo ticket.
 * @param contactId ID del contacto.
 * @param status Estado inicial del ticket.
 * @param userId ID del usuario.
 * @param queueId ID de la cola (opcional).
 * @returns Una promesa que se resuelve al ticket creado.
 * @throws AppError si ocurre un error durante la creación o validaciones.
 */
const CreateTicketService = async ({
  contactId,
  status,
  userId,
  queueId
}: Request): Promise<PrismaTicket> => {
  // NOTA: GetDefaultWhatsApp y CheckContactOpenTickets son funciones críticas
  // que necesitan ser refactorizadas para usar Prisma.
  // Por ahora, usaré placeholders o una lógica simplificada.
  const defaultWhatsapp = await getOrCreateDefaultWhatsapp(userId); // Placeholder
  await checkContactOpenTickets(contactId, defaultWhatsapp.id); // Placeholder

  const contact = await ShowContactService(contactId); // Ya refactorizado
  const { isGroup } = contact;

  let finalQueueId = queueId;
  if (finalQueueId === undefined) {
    const userWithQueues = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        userQueues: {
          include: { queue: true },
          orderBy: { queue: { name: 'asc' }} // Opcional, para consistencia si se toma la primera
        }
      }
    });
    if (userWithQueues?.userQueues && userWithQueues.userQueues.length === 1) {
      finalQueueId = userWithQueues.userQueues[0].queueId;
    }
    // Si tiene múltiples colas y no se especifica una, podría quedar como null o aplicar otra lógica.
  }

  const createdTicket = await prisma.ticket.create({
    data: {
      contactId,
      status,
      isGroup,
      userId,
      queueId: finalQueueId, // Puede ser null si no se determina una cola única y no se proporciona
      whatsappId: defaultWhatsapp.id,
      // unreadMessages: 0, // Inicializar si es necesario, el schema no lo tiene por defecto
      // lastMessage: "", // Inicializar si es necesario
    },
    include: {
      contact: true // Incluir el contacto en la respuesta como en la versión original
    }
  });

  if (!createdTicket) {
    // Esta comprobación es menos necesaria con Prisma ya que create lanza error si falla.
    throw new AppError("ERR_CREATING_TICKET");
  }

  return createdTicket;
};

export default CreateTicketService;
