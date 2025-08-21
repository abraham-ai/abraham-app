import { ObjectId } from 'mongodb'
import { Aggregate } from 'mongoose'

interface IRepository<T> {
  query(
    query?: Record<
      string,
      string | string[] | ObjectId | object | undefined | unknown
    >,
    options?: { page?: number; limit?: number; sort?: object },
  ): Promise<PaginatedResponse<T>>
  aggregateQuery(
    aggregate: Aggregate<any>,
    options: { page?: number; limit?: number; sort?: object },
  ): Promise<PaginatedResponse<T>>
  create(data: object): Promise<T>
  findOneBy(prop: string, value: string): Promise<T>
  findById(id: string): Promise<T>
  findByIdAndUpdate(id: string, data: object, options?: object): Promise<T>
  deleteById(id: string): Promise<void>
}

interface PaginatedResponse<T> {
  docs: T[]
  total: number
  limit: number
  pages: number
  page: number
  pagingCounter: number
  hasPrevPage: boolean
  hasNextPage: boolean
  prevPage: number
  nextPage: number
}

export type QueryOptions = {
  page?: number
  limit?: number
  sort?: object
  select?: object | string
  populate?: string | object
}

class RestfulRepository<T> implements IRepository<T> {
  constructor(public model: any) {
    // The 'any' type is used here since the 'model' type is not specified in the provided code.
    // Replace it with the appropriate type for your model if possible.
    this.model = model
  }

  async query(
    query: Record<
      string,
      string | string[] | ObjectId | object | undefined | unknown
    >,
    options: QueryOptions = { populate: undefined },
    projection: object = {},
  ): Promise<PaginatedResponse<T>> {
    const labels = {
      totalDocs: 'total',
      totalPages: 'pages',
    }

    const mongooseQuery: Record<string, any> = {
      deleted: false,
    }

    for (const prop in query) {
      if (prop !== '$or' && Array.isArray(query[prop])) {
        mongooseQuery[prop] = { $in: query[prop] }
      } else {
        mongooseQuery[prop] = query[prop]
      }
    }

    // filter any undefined values
    Object.keys(mongooseQuery).forEach(
      key => mongooseQuery[key] === undefined && delete mongooseQuery[key],
    )

    return await this.model.paginate(mongooseQuery, {
      page: options.page ?? 1,
      limit: options.limit ?? 100,
      sort: options.sort ?? { _id: 1 },
      customLabels: labels,
      select: options.select ?? '',
      populate: options.populate,
      projection,
    })
  }

  async aggregateQuery(
    aggregate: Aggregate<any>,
    options: { page?: number; limit?: number; sort?: object } = {},
  ): Promise<PaginatedResponse<T>> {
    const labels = {
      totalDocs: 'total',
      totalPages: 'pages',
    }

    return await this.model.aggregatePaginate(aggregate, {
      page: options.page ?? 1,
      limit: options.limit ?? 100,
      sort: options.sort ?? { _id: 1 },
      customLabels: labels,
    })
  }

  async create(data: object): Promise<T> {
    return await this.model.create(data)
  }

  async findOneBy(prop: string, value: string): Promise<T> {
    if (!prop || !value) {
      throw new Error('Property and value must be specified.')
    }

    return await this.model.findOne({ [prop]: value })
  }

  async findById(id: string): Promise<T> {
    return await this.findOneBy('_id', id)
  }

  async findByIdAndUpdate(
    id: string,
    data: object,
    options: object = {},
  ): Promise<T> {
    const obj = await this.model.findOneAndUpdate({ _id: id }, data, options)
    return obj.save()
  }

  async deleteById(id: string): Promise<void> {
    return await this.model.deleteById(id)
  }
}

export default RestfulRepository
