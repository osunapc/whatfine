import * as Yup from "yup";
import bcrypt from "bcryptjs";
import AppError from "../../errors/AppError";
import { SerializeUser, SerializedUser } from "../../helpers/SerializeUser"; // Asumiendo que SerializedUser se exporta
import prisma from "../../database";
import { Prisma, User } from "../../generated/prisma"; // Importar tipos de Prisma

// Asumiendo que SerializedUser se exporta o la definimos como en AuthUserService
// interface Response {
//   email: string;
//   name: string;
//   id: number;
//   profile: string;
//   // queues?: Queue[]; // Si SerializeUser devuelve colas
// }

/**
 * Interfaz para la solicitud del servicio de creación de usuarios.
 */
interface Request {
  /** Correo electrónico del usuario. Debe ser único. */
  email: string;
  /** Contraseña del usuario. */
  password: string;
  /** Nombre del usuario. */
  name: string;
  /** IDs de las colas a las que el usuario será asignado (opcional). */
  queueIds?: number[];
  /** Perfil del usuario (opcional, por defecto "admin"). */
  profile?: string;
  /** ID de la instancia de WhatsApp por defecto para el usuario (opcional). */
  whatsappId?: number;
}

/**
 * Servicio para crear un nuevo usuario.
 * @param email Correo electrónico del usuario.
 * @param password Contraseña del usuario.
 * @param name Nombre del usuario.
 * @param queueIds Array de IDs de colas a asignar.
 * @param profile Perfil del usuario.
 * @param whatsappId ID de la conexión de WhatsApp por defecto.
 * @returns Una promesa que se resuelve al usuario serializado creado.
 * @throws AppError si la validación falla o el correo ya existe.
 */
const CreateUserService = async ({
  email,
  password,
  name,
  queueIds = [],
  profile = "admin",
  whatsappId
}: Request): Promise<SerializedUser> => {
  const schema = Yup.object().shape({
    name: Yup.string().required().min(2),
    email: Yup.string()
      .email()
      .required()
      .test(
        "Check-email",
        "An user with this email already exists.",
        async value => {
          if (!value) return false;
          const emailExists = await prisma.user.findUnique({
            where: { email: value }
          });
          return !emailExists;
        }
      ),
    password: Yup.string().required().min(5)
  });

  try {
    await schema.validate({ email, password, name });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const passwordHash = await bcrypt.hash(password, 8);

  const createData: Prisma.UserCreateInput = {
    email,
    passwordHash,
    name,
    profile,
    whatsappId: whatsappId ?? null // Usar whatsappId si se proporciona, sino null
  };

  if (queueIds.length > 0) {
    createData.userQueues = {
      create: queueIds.map(id => ({
        queue: { connect: { id } }
      }))
    };
  }

  const user = await prisma.user.create({
    data: createData,
    include: {
      userQueues: { include: { queue: true } }, // Para obtener las colas
      whatsapp: true // Para obtener la conexión de WhatsApp
    }
  });

  // Adaptar el objeto user para que SerializeUser funcione
  const userWithQueues = {
    ...user,
    queues: user.userQueues.map(uq => uq.queue)
  };

  return SerializeUser(userWithQueues as any); // Puede requerir casteo
};

export default CreateUserService;
