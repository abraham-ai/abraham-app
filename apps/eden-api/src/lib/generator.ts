import {
  GeneratorParameter,
  GeneratorSchema,
  GeneratorVersionSchema,
} from '../models/Generator'

export const getLatestGeneratorVersion = (generator: GeneratorSchema) =>
  generator.versions[generator.versions.length - 1]

export const getDefaultGeneratorVersion = (generator: GeneratorSchema) =>
  generator.versions.filter(v => v.versionId == generator.defaultVersionId)[0]

const setupSeeds = (config?: any) => {
  if (!config.seed) {
    config.seed = Math.floor(Math.random() * 1e8)
  }

  const nSeeds = Math.max(
    config.interpolation_texts?.length || 0,
    config.interpolation_init_images?.length || 0,
  )

  if (
    nSeeds > 0 &&
    config?.interpolation_seeds &&
    config?.interpolation_seeds.length == 0
  ) {
    config.interpolation_seeds = []
    for (let i = 0; i < nSeeds; i++) {
      config.interpolation_seeds.push(Math.floor(Math.random() * 1e8))
    }
  }

  // cast all seeds as integers
  config.seed = parseInt(config.seed)
  if (config.interpolation_seeds) {
    config.interpolation_seeds = config.interpolation_seeds.map((s: any) =>
      parseInt(s),
    )
  }

  return config
}

export const prepareConfig = (
  generatorVersion: GeneratorVersionSchema,
  config: any = {},
) => {
  const parameters: GeneratorParameter[] = generatorVersion.parameters

  // check config has all required params
  const missingParams: string[] = []
  for (const param of parameters) {
    if (param.isRequired && !(param.name in config)) {
      if (typeof param.minLength !== 'undefined' && param.minLength === 0) {
        continue
      }

      missingParams.push(param.name)
    }
  }
  if (missingParams.length > 0) {
    throw new Error(`Missing required parameters: ${missingParams.join(', ')}`)
  }

  // unify with default params
  for (const param of parameters) {
    if (config[param.name] === undefined) {
      config[param.name] = param.default
    }
  }

  // validate params
  const invalidValues = parameters.filter((p: GeneratorParameter) => {
    if (!p.allowedValues || p.allowedValues.length === 0) {
      return false
    }
    const userValue = config[p.name]
    return !p.allowedValues.includes(userValue)
  })
  const invalidRangeValues = parameters.filter((p: GeneratorParameter) => {
    if (p.minimum === undefined || p.maximum === undefined) {
      return false
    }
    const userValue = config[p.name]
    return userValue < p.minimum || userValue > p.maximum
  })
  if (invalidValues.length > 0 || invalidRangeValues.length > 0) {
    const invalidValueNames = invalidValues.map(
      (p: GeneratorParameter) => p.name,
    )
    const invalidRangeValueNames = invalidRangeValues.map(
      (p: GeneratorParameter) => p.name,
    )
    const invalidValueNamesAll = [
      ...invalidValueNames,
      ...invalidRangeValueNames,
    ]
    throw new Error(
      `Invalid values for parameters: ${invalidValueNamesAll.join(', ')}`,
    )
  }

  // remove any fields which are null
  for (const key in config) {
    if (config[key] === null) {
      delete config[key]
    }
  }

  // randomize seeds if not provided
  if (
    generatorVersion.address === 'edenartlab/eden-sd-pipelines-sdxl' ||
    generatorVersion.address === 'edenartlab/eden-comfyui' ||
    generatorVersion.address === 'philz1337x/clarity-upscaler'
  ) {
    config = setupSeeds(config)
  }

  return config
}
