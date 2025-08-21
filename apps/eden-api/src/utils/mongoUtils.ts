import { ObjectId } from 'mongodb'

/**
 * Checks if a string is a valid MongoDB ObjectId
 * Validates that the string is exactly 24 hexadecimal characters
 */
export function isValidObjectId(id: string): boolean {
  return /^[0-9a-fA-F]{24}$/.test(id)
}

/**
 * Creates a query that searches by ObjectId if valid, otherwise by username/slug
 * @param id - The ID to check (could be ObjectId or username/slug)
 * @param usernameField - The field name for username/slug lookup (default: 'username')
 */
export function createIdOrSlugQuery(
  id: string,
  usernameField: string = 'username',
) {
  const isId = isValidObjectId(id)
  return isId ? { _id: new ObjectId(id) } : { [usernameField]: id }
}

/**
 * Creates a combined query that searches across multiple fields including ObjectId if valid
 * @param searchTerm - The search term (could be ObjectId, username, or other identifier)
 * @param fields - Array of field names to search in
 */
export function createMultiFieldQuery(searchTerm: string, fields: string[]) {
  const lowerCaseSearchTerm = searchTerm.toLowerCase().trim()
  const conditions: Array<{ [key: string]: any }> = fields.map(field => ({
    [field]: { $regex: new RegExp(`^${lowerCaseSearchTerm}$`, 'i') },
  }))

  if (isValidObjectId(searchTerm)) {
    conditions.push({ _id: new ObjectId(searchTerm) })
  }

  return { $or: conditions }
}
