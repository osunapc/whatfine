import AppError from "../../errors/AppError";
import prisma from "../../database";
import { Contact } from "../../generated/prisma";
import CreateContactService from "./CreateContactService"; // Ya refactorizado

/**
 * Interfaz para la información extra (campos personalizados) de un contacto.
 * Utilizada por CreateContactService.
 */
interface ExtraInfo {
  name: string;
  value: string;
}

/**
 * Interfaz para los datos de entrada del servicio GetContactService.
 * Incluye todos los campos necesarios para crear un contacto si no existe.
 */
interface Request {
  name: string;
  number: string;
  email?: string;
  profilePicUrl?: string;
  extraInfo?: ExtraInfo[];
}

/**
 * Servicio para obtener un contacto por su número.
 * Si el contacto no existe, lo crea utilizando CreateContactService.
 * @param name Nombre del contacto (usado si se necesita crear).
 * @param number Número de teléfono del contacto.
 * @param email Correo electrónico (usado si se necesita crear).
 * @param profilePicUrl URL de la foto de perfil (usado si se necesita crear).
 * @param extraInfo Campos personalizados (usado si se necesita crear).
 * @returns Una promesa que se resuelve al contacto encontrado o creado.
 * @throws AppError si la creación falla y devuelve null (según lógica original).
 */
const GetContactService = async ({
  name,
  number,
  email,
  profilePicUrl,
  extraInfo
}: Request): Promise<Contact> => {
  const existingContact = await prisma.contact.findUnique({
    where: { number },
    include: { customFields: true } // Incluir campos personalizados
  });

  if (!existingContact) {
    // Llama al CreateContactService ya refactorizado
    const newContact = await CreateContactService({
      name,
      number,
      email,
      profilePicUrl,
      extraInfo
    });

    // La lógica original tenía una verificación de nulidad que no debería ocurrir
    // si CreateContactService funciona como se espera (lanza error o devuelve contacto).
    // Se mantiene por fidelidad a la estructura original, aunque Prisma create no devuelve null.
    if (newContact == null) {
        throw new AppError("CONTACT_NOT_FIND"); // O un error más específico de creación.
    }
    return newContact;
  }

  return existingContact;
};

export default GetContactService;