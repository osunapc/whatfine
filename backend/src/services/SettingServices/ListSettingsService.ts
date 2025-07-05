import prisma from "../../database";
import { Setting } from "../../generated/prisma";

/**
 * Servicio para listar todas las configuraciones del sistema.
 * @returns Una promesa que se resuelve a un array de configuraciones o undefined si ocurre un error.
 */
const ListSettingsService = async (): Promise<Setting[]> => {
  const settings = await prisma.setting.findMany();

  return settings;
};

export default ListSettingsService;
