import AppError from "../../errors/AppError";
import prisma from "../../database";
import { Setting } from "../../generated/prisma";

/**
 * Interfaz para los datos de entrada del servicio de actualización de configuración.
 */
interface Request {
  /** Clave de la configuración a actualizar. */
  key: string;
  /** Nuevo valor para la configuración. */
  value: string;
}

/**
 * Servicio para actualizar una configuración existente.
 * @param key La clave de la configuración a actualizar.
 * @param value El nuevo valor para la configuración.
 * @returns Una promesa que se resuelve a la configuración actualizada.
 * @throws AppError si la configuración no se encuentra.
 */
const UpdateSettingService = async ({
  key,
  value
}: Request): Promise<Setting> => {
  const setting = await prisma.setting.findUnique({
    where: { key }
  });

  if (!setting) {
    throw new AppError("ERR_NO_SETTING_FOUND", 404);
  }

  const updatedSetting = await prisma.setting.update({
    where: { key },
    data: { value }
  });

  return updatedSetting;
};

export default UpdateSettingService;
