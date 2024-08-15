import type { Prisma, PrismaPromise } from '@prisma/client'

import db from './index.js'

enum MODELS {
  TASK_SEND_EMAIL = 'taskSendEmail'
}

type SoftDeleteProps<T> = {
  where: { id: string | string[] } & Omit<T, 'id'>
  deletedBy: string
}

type ExtendedModel<T> = {
  softDeletePrismaPromise(props: SoftDeleteProps<T>): PrismaPromise<any> //returns updated
  softDelete(props: SoftDeleteProps<T>): Promise<number> //returns updated count
}

const createSoftDeleteFunction = <T>(modelName: MODELS): ExtendedModel<T> => {
  const softDeletePrismaPromise = ({ where: { id, ...where }, deletedBy }: SoftDeleteProps<T>): PrismaPromise<any> => {
    const isBulk = Array.isArray(id)
    const updateData = {
      where: {
        id: isBulk ? { in: id } : id,
        ...where
      },
      data: {
        deletedAt: new Date(),
        deletedBy
      }
    }

    return isBulk
      ? (db[modelName].updateMany as any)(updateData) // TODO: remove any
      : (db[modelName].update as any)(updateData)
  }

  const softDelete = async (props: SoftDeleteProps<T>): Promise<number> => {
    const isBulk = Array.isArray(props.where.id)

    const res = await softDeletePrismaPromise(props)

    return isBulk ? res.count : 1
  }

  return {
    softDeletePrismaPromise,
    softDelete
  }
}

export const extendedModels = {
  taskSendEmail: createSoftDeleteFunction<Prisma.TaskSendEmailWhereUniqueInput>(MODELS.TASK_SEND_EMAIL)
}
