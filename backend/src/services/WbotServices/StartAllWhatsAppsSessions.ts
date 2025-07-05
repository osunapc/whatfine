import ListWhatsAppsService from "../WhatsappService/ListWhatsAppsService"; // Ya refactorizado
import { StartWhatsAppSession } from "./StartWhatsAppSession"; // Ya refactorizado
import { WhatsappWithQueues } from "../WhatsappService/ListWhatsAppsService"; // Importar tipo
import { logger } from "../../utils/logger";

/**
 * Inicia todas las sesiones de WhatsApp configuradas en el sistema.
 * Itera sobre todas las conexiones de WhatsApp y llama a StartWhatsAppSession para cada una.
 */
export const StartAllWhatsAppsSessions = async (): Promise<void> => {
  try {
    const whatsapps: WhatsappWithQueues[] = await ListWhatsAppsService();
    if (whatsapps && whatsapps.length > 0) {
      logger.info(`Found ${whatsapps.length} WhatsApp session(s) to start.`);
      // Usar Promise.all para iniciar sesiones en paralelo, aunque StartWhatsAppSession es async void.
      // Si StartWhatsAppSession pudiera fallar y quisiéramos manejar errores individuales,
      // un bucle for...of con try/catch individual podría ser mejor.
      // Por ahora, mantenemos la estructura forEach que no espera la finalización individual.
      whatsapps.forEach(whatsapp => {
        StartWhatsAppSession(whatsapp); // StartWhatsAppSession maneja sus propios errores internamente
      });
    } else {
      logger.info("No WhatsApp sessions found to start.");
    }
  } catch (error: any) {
    logger.error(`Failed to start all WhatsApp sessions: ${error.message}`);
    // Considerar cómo manejar este error global, si es necesario.
  }
};
