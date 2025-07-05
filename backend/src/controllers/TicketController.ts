import { Request, Response } from "express";
import { getIO } from "../libs/socket";

import CreateTicketService from "../services/TicketServices/CreateTicketService";
import DeleteTicketService from "../services/TicketServices/DeleteTicketService";
import ListTicketsService from "../services/TicketServices/ListTicketsService";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import UpdateTicketService from "../services/TicketServices/UpdateTicketService";
import SendWhatsAppMessage from "../services/WbotServices/SendWhatsAppMessage";
import ShowWhatsAppService from "../services/WhatsappService/ShowWhatsAppService";
import formatBody from "../helpers/Mustache";

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
  status: string;
  date: string;
  showAll: string;
  withUnreadMessages: string;
  queueIds: string;
};

interface TicketData {
  contactId: number;
  status: string;
  queueId: number;
  userId: number;
}

export const index = async (req: Request, res: Response): Promise<Response> => {
  const {
    pageNumber,
    status,
    date,
    searchParam,
    showAll,
    queueIds: queueIdsStringified,
    withUnreadMessages
  } = req.query as IndexQuery;

  const userId = req.user.id;

  let queueIds: number[] = [];

  if (queueIdsStringified) {
    queueIds = JSON.parse(queueIdsStringified);
  }

  const { tickets, count, hasMore } = await ListTicketsService({
    searchParam,
    pageNumber,
    status,
    date,
    showAll,
    userId,
    queueIds,
    withUnreadMessages
  });

  return res.status(200).json({ tickets, count, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { contactId, status, userId, queueId }: TicketData = req.body; // Incluir queueId si se envía

  // CreateTicketService ya está refactorizado para Prisma y devuelve PrismaTicket
  const ticket = await CreateTicketService({ contactId, status, userId, queueId });

  const io = getIO();
  // Asegurarse de que el ticket tenga las relaciones esperadas por el frontend para el evento de socket.
  // CreateTicketService incluye 'contact'. Si se necesitan más, se debe ajustar allí o hacer un findUnique aquí.
  // Por ahora, asumimos que lo devuelto por CreateTicketService es suficiente.
  io.to(ticket.status).emit("ticket", {
    action: "update", // La acción original era "update", podría ser "create" si es un nuevo ticket.
                     // Mantendremos "update" por consistencia con el original.
    ticket
  });

  return res.status(200).json(ticket);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;

  const contact = await ShowTicketService(ticketId);

  return res.status(200).json(contact);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const ticketData = req.body as Partial<TicketData>; // Permitir actualizaciones parciales, TicketData define campos opcionales

  // UpdateTicketService devuelve { ticket: ShowTicketPrisma, oldStatus, oldUserId }
  const { ticket } = await UpdateTicketService({
    ticketData, // TypeScript inferirá el tipo correcto para el servicio
    ticketId
  });

  if (ticket.status === "closed") {
    if (ticket.whatsappId && ticket.contact) { // Asegurarse de que whatsappId y contact existan
      const whatsapp = await ShowWhatsAppService(ticket.whatsappId); // Devuelve WhatsappWithQueues

      const { farewellMessage } = whatsapp;

      if (farewellMessage) {
        // SendWhatsAppMessage espera TicketWithContact. 'ticket' (ShowTicketPrisma) es compatible.
        await SendWhatsAppMessage({
          body: formatBody(farewellMessage, ticket.contact as any), // ticket.contact es PrismaContact. formatBody podría esperar tipo Sequelize.
          ticket: ticket as any // Usar 'as any' si hay problemas de tipo con los helpers pendientes.
        });
      }
    }
  }

  return res.status(200).json(ticket);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;

  // DeleteTicketService ya está refactorizado y devuelve el PrismaTicket eliminado.
  const deletedTicket = await DeleteTicketService(ticketId);

  const io = getIO();
  // Usar deletedTicket.status y deletedTicket.id (que es un número)
  // El evento original emitía +ticketId (convirtiéndolo a número), lo cual es bueno.
  io.to(deletedTicket.status)
    .to(deletedTicket.id.toString()) // El canal del ticket suele ser su ID como string
    .to("notification")
    .emit("ticket", {
      action: "delete",
      ticketId: deletedTicket.id // Enviar el ID numérico
    });

  return res.status(200).json({ message: "ticket deleted" });
};
