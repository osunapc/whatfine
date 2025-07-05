import { getIO } from "../../libs/socket";
import prisma from "../../database";
import { Contact, Prisma, ContactCustomFieldCreateWithoutContactInput } from "../../generated/prisma";

/**
 * Interfaz para la información extra (campos personalizados) de un contacto.
 */
interface ExtraInfo {
  name: string;
  value: string;
}

/**
 * Interfaz para los datos de entrada del servicio de creación o actualización de contactos.
 */
interface Request {
  name: string;
  number: string;
  isGroup: boolean;
  email?: string;
  profilePicUrl?: string;
  extraInfo?: ExtraInfo[];
}

/**
 * Servicio para crear un nuevo contacto si no existe uno con el número proporcionado,
 * o actualizar el existente (específicamente profilePicUrl y emite evento por socket).
 * Los campos extraInfo se manejan solo en la creación en esta lógica simplificada,
 * para una actualización completa de extraInfo se debería usar UpdateContactService.
 * @param name Nombre del contacto.
 * @param rawNumber Número de teléfono del contacto (puede contener caracteres no numéricos).
 * @param profilePicUrl URL de la foto de perfil.
 * @param isGroup Indica si el contacto es un grupo.
 * @param email Correo electrónico del contacto.
 * @param extraInfo Campos personalizados (se usan principalmente en la creación).
 * @returns Una promesa que se resuelve al contacto creado o actualizado.
 */
const CreateOrUpdateContactService = async ({
  name,
  number: rawNumber,
  profilePicUrl,
  isGroup,
  email = "",
  extraInfo = []
}: Request): Promise<Contact> => {
  const number = isGroup ? rawNumber : rawNumber.replace(/[^0-9]/g, "");
  const io = getIO();

  let contact = await prisma.contact.findUnique({
    where: { number }
  });

  if (contact) {
    // Contacto existente, actualizar profilePicUrl si se proporciona
    if (profilePicUrl !== undefined) {
      contact = await prisma.contact.update({
        where: { number },
        data: { profilePicUrl },
        include: { customFields: true } // Incluir para consistencia del objeto retornado
      });
    }

    io.emit("contact", {
      action: "update",
      contact
    });
  } else {
    // Contacto no existente, crear uno nuevo
    const createData: Prisma.ContactCreateInput = {
      name,
      number,
      profilePicUrl,
      email,
      isGroup,
      customFields: {
        create: extraInfo.map(
          (info: ExtraInfo): ContactCustomFieldCreateWithoutContactInput => ({
            name: info.name,
            value: info.value
          })
        )
      }
    };

    contact = await prisma.contact.create({
      data: createData,
      include: { customFields: true }
    });

    io.emit("contact", {
      action: "create",
      contact
    });
  }

  return contact;
};

export default CreateOrUpdateContactService;
