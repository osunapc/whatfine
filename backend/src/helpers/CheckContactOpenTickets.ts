import AppError from "../errors/AppError";
import prisma from "../database";

/**
 * Verifica si un contacto ya tiene tickets abiertos o pendientes para una conexión de WhatsApp específica.
 * Lanza un error si se encuentra algún ticket abierto o pendiente.
 * @param contactId ID del contacto.
 * @param whatsappId ID de la conexión de WhatsApp.
 * @throws AppError con el mensaje "ERR_OTHER_OPEN_TICKET" si existen tickets abiertos/pendientes.
 */
const CheckContactOpenTickets = async (
  contactId: number,
  whatsappId: number
): Promise<void> => {
  const openTicket = await prisma.ticket.findFirst({
    where: {
      contactId,
      whatsappId,
      status: { in: ["open", "pending"] }
    }
  });

  if (openTicket) {
    throw new AppError("ERR_OTHER_OPEN_TICKET");
  }
};

export default CheckContactOpenTickets;
