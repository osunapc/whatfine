import { Ticket as PrismaTicket } from "../../generated/prisma";
// UpdateTicketService ya está refactorizado y debería aceptar PrismaTicket (o un subconjunto compatible)
// y su ticketData debería aceptar { status: string }.
import UpdateTicketService from "../services/TicketServices/UpdateTicketService";
import { logger } from "../utils/logger";


/**
 * Actualiza el estado de una lista de tickets a "pending".
 * Utilizado cuando un usuario es eliminado y sus tickets abiertos necesitan ser desasignados y puestos en pendiente.
 * @param tickets Array de objetos Ticket (tipo Prisma) a actualizar.
 */
const UpdateDeletedUserOpenTicketsStatus = async (
  tickets: PrismaTicket[] // Espera un array de tickets de Prisma
): Promise<void> => {
  // Usar Promise.all para asegurar que todas las actualizaciones se procesen
  // y para manejar errores de forma agrupada si es necesario.
  await Promise.all(
    tickets.map(async t => {
      const ticketId = t.id.toString();
      try {
        await UpdateTicketService({
          ticketData: { status: "pending", userId: null }, // También desasignar el usuario
          ticketId
        });
        logger.info(`Ticket ${ticketId} status updated to pending and user unassigned due to user deletion.`);
      } catch (error: any) {
        logger.error(`Failed to update ticket ${ticketId} during user deletion: ${error.message}`);
        // Considerar si se debe relanzar el error o solo loguearlo
      }
    })
  );
};

export default UpdateDeletedUserOpenTicketsStatus;
