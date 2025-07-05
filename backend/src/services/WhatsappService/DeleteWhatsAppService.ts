import prisma from "../../database";
import AppError from "../../errors/AppError";
import { wbotMessageListener, getWbot, removeWbot } from "../../libs/wbot"; // Suponiendo que estas funciones existen y se adaptarán
import { logger } from "../../utils/logger";

/**
 * Servicio para eliminar una conexión de WhatsApp por su ID.
 * Esto también debería desasociar la conexión de los tickets (onDelete: SetNull)
 * y eliminar las entradas en WhatsappQueue (onDelete: Cascade).
 * Adicionalmente, intenta cerrar la sesión de wbot.
 * @param id El ID de la conexión de WhatsApp a eliminar.
 * @returns Una promesa que se resuelve cuando la conexión ha sido eliminada.
 * @throws AppError si la conexión no se encuentra o el ID es inválido.
 */
const DeleteWhatsAppService = async (id: string): Promise<void> => {
  const whatsappId = parseInt(id, 10);

  if (isNaN(whatsappId)) {
    throw new AppError("ERR_INVALID_WAPP_ID", 400);
  }

  const whatsapp = await prisma.whatsapp.findUnique({
    where: { id: whatsappId }
  });

  if (!whatsapp) {
    throw new AppError("ERR_NO_WAPP_FOUND", 404);
  }

  // Intentar cerrar y eliminar la sesión de wbot asociada
  // Esta parte es crítica y depende de la implementación de wbot.ts
  try {
    const wbot = getWbot(whatsapp.id); // Asume que getWbot toma el ID numérico
    await wbot.logout();
    removeWbot(whatsapp.id); // Asume que removeWbot toma el ID numérico
  } catch (err: any) {
    logger.error(`Error al cerrar sesión de wbot para WhatsApp ID ${whatsapp.id}: ${err.message}`);
    // No relanzar el error para permitir la eliminación de la BD si wbot falla
  }

  // Eliminar las asociaciones en WhatsappQueues explícitamente.
  // Aunque `onDelete: Cascade` debería manejarlas, ser explícito puede ser más seguro.
  // El esquema de WhatsappQueue tiene una relación directa con Whatsapp,
  // por lo que Prisma debería eliminarlas en cascada.
  // No es estrictamente necesario si la relación está bien definida con onDelete: Cascade implícito o explícito.
  // await prisma.whatsappQueue.deleteMany({ where: { whatsappId: whatsappId }});

  // La relación con User (whatsappId FK en User) también tiene onDelete: Cascade.
  // La relación con Ticket (whatsappId FK en Ticket) tiene onDelete: SetNull.

  await prisma.whatsapp.delete({
    where: { id: whatsappId }
  });
};

export default DeleteWhatsAppService;
