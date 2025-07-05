import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp"; // Ya refactorizado
import { getWbot } from "../../libs/wbot"; // Asumimos que funciona
import prisma from "../../database";
import { logger } from "../../utils/logger";

/**
 * Importa contactos desde el teléfono asociado a una conexión de WhatsApp.
 * Solo crea contactos en la base de datos si no existen previamente por su número.
 * @param userId ID del usuario para determinar la conexión de WhatsApp a utilizar.
 */
const ImportContactsService = async (userId: number): Promise<void> => {
  const defaultWhatsapp = await GetDefaultWhatsApp(userId);
  const wbot = getWbot(defaultWhatsapp.id);

  let phoneContacts: Array<{ number?: string; name?: string }> = []; // Tipar el array

  try {
    // Asumimos que wbot.getContacts() devuelve un array de objetos con 'number' y 'name'
    const contactsFromWbot = await wbot.getContacts();
    if (Array.isArray(contactsFromWbot)) {
        phoneContacts = contactsFromWbot;
    } else {
        logger.warn("wbot.getContacts() did not return an array.");
    }
  } catch (err: any) {
    logger.error(
      `Could not get whatsapp contacts from phone (userId: ${userId}, wppId: ${defaultWhatsapp.id}). Err: ${err.message}`
    );
  }

  if (phoneContacts && phoneContacts.length > 0) {
    const contactCreationPromises = phoneContacts.map(async (contact) => {
      // Asegurarse de que 'number' y 'name' no sean undefined en una forma que cause error.
      // La lógica original asignaba 'number' a 'name' si 'name' era undefined.
      let currentNumber = contact.number;
      let currentName = contact.name;

      if (!currentNumber) {
        return null; // No se puede procesar sin número
      }

      // Limpiar el número: quitar caracteres no numéricos, excepto el '+' inicial si existe.
      // Esto es una suposición común, la lógica original no lo hacía.
      // currentNumber = currentNumber.replace(/[^0-9+]/g, "").replace(/^\+/, "TEMPPLUS").replace(/[^0-9]/g, "").replace("TEMPPLUS", "+");
      // Por ahora, mantenemos la lógica original de no limpiar el número aquí.

      if (!currentName) {
        currentName = currentNumber; // Usar número como nombre si el nombre no está definido
      }

      try {
        const numberExists = await prisma.contact.findUnique({
          where: { number: currentNumber }
        });

        if (numberExists) {
          return null; // Contacto ya existe
        }

        return prisma.contact.create({
          data: { number: currentNumber, name: currentName }
        });
      } catch (dbError: any) {
        logger.error(`Error creating contact ${currentNumber} (${currentName}): ${dbError.message}`);
        return null; // No detener todo el proceso por un error individual
      }
    });

    await Promise.all(contactCreationPromises);
    logger.info(`Finished importing contacts for userId: ${userId}, wppId: ${defaultWhatsapp.id}. Processed ${phoneContacts.length} contacts.`);
  } else {
    logger.info(`No contacts to import for userId: ${userId}, wppId: ${defaultWhatsapp.id}.`);
  }
};

export default ImportContactsService;
