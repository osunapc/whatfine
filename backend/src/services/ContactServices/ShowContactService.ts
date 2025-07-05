import prisma from "../../database";
import AppError from "../../errors/AppError";
import { Contact } from "../../generated/prisma";

/**
 * Servicio para obtener un contacto específico por su ID.
 * @param id El ID del contacto a obtener (puede ser string o number).
 * @returns Una promesa que se resuelve al contacto encontrado, incluyendo sus campos personalizados.
 * @throws AppError si el contacto no se encuentra o el ID es inválido.
 */
const ShowContactService = async (id: string | number): Promise<Contact> => {
  const contactId = typeof id === 'string' ? parseInt(id, 10) : id;

  if (isNaN(contactId)) {
    throw new AppError("ERR_INVALID_CONTACT_ID", 400);
  }

  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    include: { customFields: true } // Incluye los campos personalizados
  });

  if (!contact) {
    throw new AppError("ERR_NO_CONTACT_FOUND", 404);
  }

  return contact;
};

export default ShowContactService;
