import AppError from "../../errors/AppError";
import prisma from "../../database";
import { Contact, ContactCustomFieldCreateWithoutContactInput } from "../../generated/prisma";

/**
 * Interfaz para la información extra (campos personalizados) de un contacto.
 */
interface ExtraInfo {
  /** Nombre del campo personalizado. */
  name: string;
  /** Valor del campo personalizado. */
  value: string;
}

/**
 * Interfaz para los datos de entrada del servicio de creación de contactos.
 */
interface Request {
  /** Nombre del contacto. */
  name: string;
  /** Número de teléfono del contacto. Debe ser único. */
  number: string;
  /** Correo electrónico del contacto (opcional). */
  email?: string;
  /** URL de la foto de perfil del contacto (opcional). */
  profilePicUrl?: string;
  /** Array de campos personalizados para el contacto (opcional). */
  extraInfo?: ExtraInfo[];
}

/**
 * Servicio para crear un nuevo contacto.
 * @param name Nombre del contacto.
 * @param number Número de teléfono del contacto.
 * @param email Correo electrónico del contacto.
 * @param profilePicUrl URL de la foto de perfil.
 * @param extraInfo Campos personalizados del contacto.
 * @returns Una promesa que se resuelve al contacto creado.
 * @throws AppError si el número de contacto ya existe.
 */
const CreateContactService = async ({
  name,
  number,
  email = "",
  profilePicUrl,
  extraInfo = []
}: Request): Promise<Contact> => {
  const numberExists = await prisma.contact.findUnique({
    where: { number }
  });

  if (numberExists) {
    throw new AppError("ERR_DUPLICATED_CONTACT");
  }

  const contactData: any = {
    name,
    number,
    email,
    profilePicUrl
  };

  if (extraInfo.length > 0) {
    contactData.customFields = {
      create: extraInfo.map(
        (info: ExtraInfo): ContactCustomFieldCreateWithoutContactInput => ({
          name: info.name,
          value: info.value
        })
      )
    };
  }

  const contact = await prisma.contact.create({
    data: contactData,
    include: {
      customFields: true // Asegura que los campos personalizados se incluyan en la respuesta.
    }
  });

  return contact;
};

export default CreateContactService;
