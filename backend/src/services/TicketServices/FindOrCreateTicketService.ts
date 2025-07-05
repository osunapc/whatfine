import { subHours } from "date-fns";
import prisma from "../../database";
import { Contact as PrismaContact, Ticket as PrismaTicket, Prisma } from "../../generated/prisma";
import ShowTicketService, { ShowTicketPrisma } from "./ShowTicketService"; // Ya refactorizado

/**
 * Servicio para encontrar un ticket existente o crear uno nuevo basado en varios criterios.
 * Utilizado principalmente para manejar mensajes entrantes y asociarlos a un ticket.
 * @param contact El contacto principal.
 * @param whatsappId ID de la conexión de WhatsApp.
 * @param unreadMessages Número de mensajes no leídos a actualizar o establecer.
 * @param groupContact Contacto del grupo (opcional, si el mensaje es de un grupo).
 * @returns Una promesa que se resuelve al ticket encontrado o creado.
 */
const FindOrCreateTicketService = async (
  contact: PrismaContact, // Usar tipo Prisma
  whatsappId: number,
  unreadMessages: number,
  groupContact?: PrismaContact // Usar tipo Prisma
): Promise<ShowTicketPrisma> => { // Devolver el tipo ShowTicketPrisma para consistencia
  let ticket: PrismaTicket | null = null;

  const targetContactId = groupContact ? groupContact.id : contact.id;

  // 1. Buscar ticket abierto o pendiente para el contacto y whatsapp
  ticket = await prisma.ticket.findFirst({
    where: {
      status: { in: ["open", "pending"] },
      contactId: targetContactId,
      whatsappId: whatsappId
    }
  });

  if (ticket) {
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { unreadMessages }
    });
  } else {
    // 2. Si es un grupo y no se encontró ticket abierto/pendiente, buscar el más reciente CERRADO para ese grupo.
    if (groupContact) {
      ticket = await prisma.ticket.findFirst({
        where: {
          contactId: targetContactId, // Ya es groupContact.id
          whatsappId: whatsappId
          // No filtramos por status 'closed' aquí, la lógica original no lo hacía explícitamente
          // pero al reabrirlo lo ponía en 'pending'. Buscamos el más reciente.
        },
        orderBy: { updatedAt: "desc" }
      });

      if (ticket) {
        await prisma.ticket.update({
          where: { id: ticket.id },
          data: {
            status: "pending",
            userId: null, // Desasigna usuario
            unreadMessages
          }
        });
      }
    } else {
      // 3. Si NO es un grupo y no se encontró ticket abierto/pendiente,
      // buscar un ticket CERRADO del contacto en las últimas 2 horas.
      ticket = await prisma.ticket.findFirst({
        where: {
          contactId: targetContactId, // Es contact.id
          whatsappId: whatsappId,
          // status: "closed", // La lógica original no filtraba por 'closed' aquí, sino por tiempo
          updatedAt: {
            gte: subHours(new Date(), 2) // 'gte' es "mayor o igual que"
          }
        },
        orderBy: { updatedAt: "desc" }
      });

      if (ticket) {
        await prisma.ticket.update({
          where: { id: ticket.id },
          data: {
            status: "pending",
            userId: null, // Desasigna usuario
            unreadMessages
          }
        });
      }
    }
  }

  // 4. Si después de todos los intentos no se encontró o reabrió un ticket, crear uno nuevo.
  if (!ticket) {
    ticket = await prisma.ticket.create({
      data: {
        contactId: targetContactId,
        status: "pending",
        isGroup: !!groupContact,
        unreadMessages,
        whatsappId
        // userId y queueId por defecto serán null si no se especifican
      }
    });
  }

  // Cargar todas las relaciones como lo hace ShowTicketService
  const finalTicket = await ShowTicketService(ticket.id);
  return finalTicket;
};

export default FindOrCreateTicketService;
