import AppError from "../errors/AppError";
import prisma from "../database";
import { Whatsapp as PrismaWhatsapp } from "../../generated/prisma";
import GetDefaultWhatsAppByUser from "./GetDefaultWhatsAppByUser"; // Ya refactorizado

/**
 * Obtiene la conexión de WhatsApp por defecto.
 * Primero intenta obtener la conexión por defecto del usuario especificado.
 * Si el usuario no tiene una o no se especifica un usuario, busca la conexión marcada como global por defecto.
 * @param userId ID del usuario (opcional).
 * @returns Una promesa que se resuelve a la conexión de WhatsApp por defecto.
 * @throws AppError si no se encuentra ninguna conexión de WhatsApp por defecto.
 */
const GetDefaultWhatsApp = async (
  userId?: number
): Promise<PrismaWhatsapp> => {
  if (userId) {
    const whatsappByUser = await GetDefaultWhatsAppByUser(userId);
    if (whatsappByUser) { // No es necesario verificar !== null, ya que el tipo es PrismaWhatsapp | null
      return whatsappByUser;
    }
  }

  const defaultWhatsapp = await prisma.whatsapp.findFirst({
    where: { isDefault: true }
  });

  if (!defaultWhatsapp) {
    // Si no hay un "isDefault", podríamos buscar el primer whatsapp disponible como fallback,
    // o mantener el error estricto. La lógica original era estricta.
    const anyWhatsapp = await prisma.whatsapp.findFirst();
    if(!anyWhatsapp) {
      throw new AppError("ERR_NO_WAPP_FOUND"); // Ningún whatsapp configurado en el sistema
    }
    // logger.warn("No default WhatsApp found, returning the first available one.");
    // return anyWhatsapp;
    // Por ahora, mantenemos el error original si no hay uno explícitamente default.
    throw new AppError("ERR_NO_DEF_WAPP_FOUND");
  }

  return defaultWhatsapp;
};

export default GetDefaultWhatsApp;
