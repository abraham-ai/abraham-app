import { TaskDocument } from '../models/Task'
import RestfulRepository from './RestfulRepository'

export default class TaskRepository extends RestfulRepository<TaskDocument> {}
