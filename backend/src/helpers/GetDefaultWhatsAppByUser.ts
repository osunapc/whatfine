import prisma from "../database";
import { Whatsapp as PrismaWhatsapp } from "../../generated/prisma";
import { logger } from "../utils/logger";

/**
 * Obtiene la conexión de WhatsApp por defecto asociada a un usuario específico.
 * @param userId ID del usuario.
 * @returns Una promesa que se resuelve a la conexión de WhatsApp por defecto del usuario o null si no tiene una o el usuario no existe.
 */
const GetDefaultWhatsAppByUser = async (
  userId: number
): Promise<PrismaWhatsapp | null> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { whatsapp: true } // Incluye la relación 'whatsapp' definida en el schema de User
  });

  if (!user) {
    logger.warn(`User with ID ${userId} not found for GetDefaultWhatsAppByUser.`);
    return null;
  }

  if (user.whatsapp) {
    logger.info(
      `Found whatsapp linked to user '${user.name}' (ID: ${userId}) is '${user.whatsapp.name}' (ID: ${user.whatsapp.id}).`
    );
  } else {
    logger.info(`User '${user.name}' (ID: ${userId}) has no specific whatsapp linked.`);
  }

  return user.whatsapp; // Esto puede ser null si el usuario no tiene un whatsappId configurado
};

export default GetDefaultWhatsAppByUser;
