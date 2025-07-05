import AppError from "../../errors/AppError";
import prisma from "../../database";
import { QuickAnswer } from "../../generated/prisma";

/**
 * Interfaz para los datos de entrada del servicio de creación de respuestas rápidas.
 */
interface Request {
  /** Atajo para la respuesta rápida. Debe ser único. */
  shortcut: string;
  /** Mensaje de la respuesta rápida. */
  message: string;
}

/**
 * Servicio para crear una nueva respuesta rápida.
 * @param shortcut Atajo para la respuesta rápida.
 * @param message Mensaje de la respuesta rápida.
 * @returns Una promesa que se resuelve a la respuesta rápida creada.
 * @throws AppError si el atajo (shortcut) ya existe.
 */
const CreateQuickAnswerService = async ({
  shortcut,
  message
}: Request): Promise<QuickAnswer> => {
  const shortcutExists = await prisma.quickAnswer.findFirst({
    where: { shortcut }
  });

  if (shortcutExists) {
    throw new AppError("ERR__SHORTCUT_DUPLICATED");
  }

  const quickAnswer = await prisma.quickAnswer.create({
    data: { shortcut, message }
  });

  return quickAnswer;
};

export default CreateQuickAnswerService;
