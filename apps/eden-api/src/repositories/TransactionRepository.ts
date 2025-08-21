import { TransactionDocument } from '../models/Transaction'
import RestfulRepository from './RestfulRepository'

export default class TransactionRepository extends RestfulRepository<TransactionDocument> {}
