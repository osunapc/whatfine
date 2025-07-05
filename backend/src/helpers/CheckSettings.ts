import prisma from "../database";
import AppError from "../errors/AppError";

/**
 * Obtiene el valor de una configuración específica del sistema por su clave.
 * @param key La clave de la configuración a obtener.
 * @returns Una promesa que se resuelve al valor de la configuración.
 * @throws AppError si la configuración con la clave especificada no se encuentra.
 */
const CheckSettings = async (key: string): Promise<string> => {
  const setting = await prisma.setting.findUnique({
    where: { key }
  });

  if (!setting) {
    throw new AppError("ERR_NO_SETTING_FOUND", 404);
  }

  return setting.value;
};

export default CheckSettings;
