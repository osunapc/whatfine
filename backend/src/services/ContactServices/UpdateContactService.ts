import AppError from "../../errors/AppError";
import prisma from "../../database";
import { Contact, Prisma } from "../../generated/prisma";

/**
 * Interfaz para la información extra (campos personalizados) al actualizar un contacto.
 * El ID es opcional; si se proporciona y existe, se actualiza; si no, se crea.
 */
interface ExtraInfo {
  /** ID del campo personalizado (opcional, para actualizaciones). */
  id?: number;
  /** Nombre del campo personalizado. */
  name: string;
  /** Valor del campo personalizado. */
  value: string;
}

/**
 * Interfaz para los datos a actualizar en un contacto.
 * Todos los campos son opcionales.
 */
interface ContactData {
  /** Nuevo correo electrónico del contacto. */
  email?: string;
  /** Nuevo número de teléfono del contacto. */
  number?: string;
  /** Nuevo nombre del contacto. */
  name?: string;
  /** Array de campos personalizados. Si se proporciona, reemplazará los campos existentes. */
  extraInfo?: ExtraInfo[];
}

/**
 * Interfaz para la solicitud del servicio de actualización de contactos.
 */
interface Request {
  /** Datos a actualizar en el contacto. */
  contactData: ContactData;
  /** ID del contacto a actualizar. */
  contactId: string;
}

/**
 * Servicio para actualizar un contacto existente, incluyendo sus campos personalizados.
 * @param contactData Objeto con los campos a actualizar (email, name, number, extraInfo).
 * @param contactId ID del contacto a modificar.
 * @returns Una promesa que se resuelve al contacto actualizado.
 * @throws AppError si el contacto no se encuentra, el ID es inválido, o si el nuevo número de contacto ya existe para otro contacto.
 */
const UpdateContactService = async ({
  contactData,
  contactId
}: Request): Promise<Contact> => {
  const id = parseInt(contactId, 10);

  if (isNaN(id)) {
    throw new AppError("ERR_INVALID_CONTACT_ID", 400);
  }

  const { email, name, number, extraInfo } = contactData;

  // Verificar si el contacto existe
  const existingContact = await prisma.contact.findUnique({
    where: { id }
  });

  if (!existingContact) {
    throw new AppError("ERR_NO_CONTACT_FOUND", 404);
  }

  // Si se intenta actualizar el número, verificar que no exista en otro contacto
  if (number && number !== existingContact.number) {
    const numberExists = await prisma.contact.findUnique({
      where: { number }
    });
    if (numberExists) {
      throw new AppError("ERR_DUPLICATED_CONTACT");
    }
  }

  const updateData: Prisma.ContactUpdateInput = {
    name,
    number,
    email
  };

  if (extraInfo) {
    // Lógica para manejar la actualización de campos personalizados (customFields)
    // 1. IDs de los extraInfo que vienen en la petición (para upsert)
    const currentExtraInfoIds = extraInfo.map(info => info.id).filter(infoId => infoId !== undefined) as number[];

    // 2. Upsert: Actualizar existentes (por ID) o crear nuevos.
    // 3. DeleteMany: Eliminar los que no están en la nueva lista.
    updateData.customFields = {
      deleteMany: {
        contactId: id,
        id: {
          notIn: currentExtraInfoIds // Elimina los que no tienen ID en la nueva lista o los que no vienen
        }
      },
      upsert: extraInfo.map(info => {
        const fieldData = { name: info.name, value: info.value };
        return {
          where: { id: info.id || -1 }, // -1 para asegurar que no encuentre y cree si no hay id
          create: fieldData,
          update: fieldData
        };
      })
    };
  }


  const updatedContact = await prisma.contact.update({
    where: { id },
    data: updateData,
    include: {
      customFields: true
    }
  });

  return updatedContact;
};

export default UpdateContactService;
