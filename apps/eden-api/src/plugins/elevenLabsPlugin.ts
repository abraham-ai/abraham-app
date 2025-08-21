import axios from 'axios'
import type { FastifyInstance } from 'fastify'

// axiosRetry(axios, {
//   retries: 5,
//   retryDelay: retryCount => {
//     return retryCount * 15000 // 15 seconds, 30, 45, 60, 75
//   },
// })

const ELEVENLABS_VOICES = [
  {
    id: '21m00Tcm4TlvDq8ikWAM',
    name: 'Rachel',
    accent: 'american',
    age: 'young',
    gender: 'female',
    description: 'calm',
    preview_url:
      'https://storage.googleapis.com/eleven-public-prod/premade/voices/21m00Tcm4TlvDq8ikWAM/df6788f9-5c96-470d-8312-aab3b3d8f50a.mp3',
    use_case: 'narration',
  },
  {
    id: '29vD33N1CtxCmqQRPOHJ',
    name: 'Drew',
    accent: 'american',
    age: 'middle aged',
    gender: 'male',
    description: 'well-rounded',
    preview_url:
      'https://storage.googleapis.com/eleven-public-prod/premade/voices/29vD33N1CtxCmqQRPOHJ/e8b52a3f-9732-440f-b78a-16d5e26407a1.mp3',
    use_case: 'news',
  },
  {
    id: '2EiwWnXFnvU5JabPnv8n',
    name: 'Clyde',
    accent: 'american',
    age: 'middle aged',
    gender: 'male',
    description: 'war veteran',
    preview_url:
      'https://storage.googleapis.com/eleven-public-prod/premade/voices/2EiwWnXFnvU5JabPnv8n/65d80f52-703f-4cae-a91d-75d4e200ed02.mp3',
    use_case: 'video games',
  },
  {
    id: '5Q0t7uMcjvnagumLfvZi',
    name: 'Paul',
    accent: 'american',
    age: 'middle aged',
    gender: 'male',
    description: 'ground reporter',
    preview_url:
      'https://storage.googleapis.com/eleven-public-prod/premade/voices/5Q0t7uMcjvnagumLfvZi/1094515a-b080-4282-aac7-b1b8a553a3a8.mp3',
    use_case: 'news',
  },
  {
    id: 'AZnzlk1XvdvUeBnXmlld',
    name: 'Domi',
    accent: 'american',
    age: 'young',
    gender: 'female',
    description: 'strong',
    preview_url:
      'https://storage.googleapis.com/eleven-public-prod/premade/voices/AZnzlk1XvdvUeBnXmlld/508e12d0-a7f7-4d86-a0d3-f3884ff353ed.mp3',
    use_case: 'narration',
  },
  {
    id: 'CYw3kZ02Hs0563khs1Fj',
    name: 'Dave',
    accent: 'british-essex',
    age: 'young',
    gender: 'male',
    description: 'conversational',
    preview_url:
      'https://storage.googleapis.com/eleven-public-prod/premade/voices/CYw3kZ02Hs0563khs1Fj/872cb056-45d3-419e-b5c6-de2b387a93a0.mp3',
    use_case: 'video games',
  },
  {
    id: 'D38z5RcWu1voky8WS1ja',
    name: 'Fin',
    accent: 'irish',
    age: 'old',
    gender: 'male',
    description: 'sailor',
    preview_url:
      'https://storage.googleapis.com/eleven-public-prod/premade/voices/D38z5RcWu1voky8WS1ja/a470ba64-1e72-46d9-ba9d-030c4155e2d2.mp3',
    use_case: 'video games',
  },
  {
    id: 'EXAVITQu4vr4xnSDxMaL',
    name: 'Sarah',
    accent: 'american',
    age: 'young',
    gender: 'female',
    description: 'soft',
    preview_url:
      'https://storage.googleapis.com/eleven-public-prod/premade/voices/EXAVITQu4vr4xnSDxMaL/6851ec91-9950-471f-8586-357c52539069.mp3',
    use_case: 'news',
  },
  {
    id: 'ErXwobaYiN019PkySvjV',
    name: 'Antoni',
    accent: 'american',
    age: 'young',
    gender: 'male',
    description: 'well-rounded',
    preview_url:
      'https://storage.googleapis.com/eleven-public-prod/premade/voices/ErXwobaYiN019PkySvjV/ee9ac367-91ee-4a56-818a-2bd1a9dbe83a.mp3',
    use_case: 'narration',
  },
  {
    id: 'GBv7mTt0atIp3Br8iCZE',
    name: 'Thomas',
    accent: 'american',
    age: 'young',
    gender: 'male',
    description: 'calm',
    preview_url:
      'https://storage.googleapis.com/eleven-public-prod/premade/voices/GBv7mTt0atIp3Br8iCZE/98542988-5267-4148-9a9e-baa8c4f14644.mp3',
    use_case: 'meditation',
  },
  {
    id: 'IKne3meq5aSn9XLyUdCD',
    name: 'Charlie',
    accent: 'australian',
    age: 'middle aged',
    gender: 'male',
    description: 'casual',
    preview_url:
      'https://storage.googleapis.com/eleven-public-prod/premade/voices/IKne3meq5aSn9XLyUdCD/102de6f2-22ed-43e0-a1f1-111fa75c5481.mp3',
    use_case: 'conversational',
  },
  {
    id: 'JBFqnCBsd6RMkjVDRZzb',
    name: 'George',
    accent: 'british',
    age: 'middle aged',
    gender: 'male',
    description: 'raspy',
    preview_url:
      'https://storage.googleapis.com/eleven-public-prod/premade/voices/JBFqnCBsd6RMkjVDRZzb/365e8ae8-5364-4b07-9a3b-1bfb4a390248.mp3',
    use_case: 'narration',
  },
  {
    id: 'LcfcDJNUP1GQjkzn1xUU',
    name: 'Emily',
    accent: 'american',
    age: 'young',
    gender: 'female',
    description: 'calm',
    preview_url:
      'https://storage.googleapis.com/eleven-public-prod/premade/voices/LcfcDJNUP1GQjkzn1xUU/e4b994b7-9713-4238-84f3-add8fccaaccd.mp3',
    use_case: 'meditation',
  },
  {
    id: 'MF3mGyEYCl7XYWbV9V6O',
    name: 'Elli',
    accent: 'american',
    age: 'young',
    gender: 'female',
    description: 'emotional',
    preview_url:
      'https://storage.googleapis.com/eleven-public-prod/premade/voices/MF3mGyEYCl7XYWbV9V6O/d8ecadea-9e48-4e5d-868a-2ec3d7397861.mp3',
    use_case: 'narration',
  },
  {
    id: 'N2lVS1w4EtoT3dr4eOWO',
    name: 'Callum',
    accent: 'american',
    age: 'middle aged',
    gender: 'male',
    description: 'hoarse',
    preview_url:
      'https://storage.googleapis.com/eleven-public-prod/premade/voices/N2lVS1w4EtoT3dr4eOWO/ac833bd8-ffda-4938-9ebc-b0f99ca25481.mp3',
    use_case: 'video games',
  },
  {
    id: 'ODq5zmih8GrVes37Dizd',
    name: 'Patrick',
    accent: 'american',
    age: 'middle aged',
    gender: 'male',
    description: 'shouty',
    preview_url:
      'https://storage.googleapis.com/eleven-public-prod/premade/voices/ODq5zmih8GrVes37Dizd/0ebec87a-2569-4976-9ea5-0170854411a9.mp3',
    use_case: 'video games',
  },
  {
    id: 'SOYHLrjzK2X1ezoPC6cr',
    name: 'Harry',
    accent: 'american',
    age: 'young',
    gender: 'male',
    description: 'anxious',
    preview_url:
      'https://storage.googleapis.com/eleven-public-prod/premade/voices/SOYHLrjzK2X1ezoPC6cr/86d178f6-f4b6-4e0e-85be-3de19f490794.mp3',
    use_case: 'video games',
  },
  {
    id: 'TX3LPaxmHKxFdv7VOQHJ',
    name: 'Liam',
    accent: 'american',
    age: 'young',
    gender: 'male',
    preview_url:
      'https://storage.googleapis.com/eleven-public-prod/premade/voices/TX3LPaxmHKxFdv7VOQHJ/63148076-6363-42db-aea8-31424308b92c.mp3',
    use_case: 'narration',
  },
  {
    id: 'ThT5KcBeYPX3keUQqHPh',
    name: 'Dorothy',
    accent: 'british',
    age: 'young',
    gender: 'female',
    description: 'pleasant',
    preview_url:
      'https://storage.googleapis.com/eleven-public-prod/premade/voices/ThT5KcBeYPX3keUQqHPh/981f0855-6598-48d2-9f8f-b6d92fbbe3fc.mp3',
    use_case: "children's stories",
  },
  {
    id: 'TxGEqnHWrfWFTfGW9XjX',
    name: 'Josh',
    accent: 'american',
    age: 'young',
    gender: 'male',
    description: 'deep',
    preview_url:
      'https://storage.googleapis.com/eleven-public-prod/premade/voices/TxGEqnHWrfWFTfGW9XjX/3ae2fc71-d5f9-4769-bb71-2a43633cd186.mp3',
    use_case: 'narration',
  },
  {
    id: 'VR6AewLTigWG4xSOukaG',
    name: 'Arnold',
    accent: 'american',
    age: 'middle aged',
    gender: 'male',
    description: 'crisp',
    preview_url:
      'https://storage.googleapis.com/eleven-public-prod/premade/voices/VR6AewLTigWG4xSOukaG/316050b7-c4e0-48de-acf9-a882bb7fc43b.mp3',
    use_case: 'narration',
  },
  {
    id: 'XB0fDUnXU5powFXDhCwa',
    name: 'Charlotte',
    accent: 'english-swedish',
    age: 'middle aged',
    gender: 'female',
    description: 'seductive',
    preview_url:
      'https://storage.googleapis.com/eleven-public-prod/premade/voices/XB0fDUnXU5powFXDhCwa/942356dc-f10d-4d89-bda5-4f8505ee038b.mp3',
    use_case: 'video games',
  },
  {
    id: 'XrExE9yKIg1WjnnlVkGX',
    name: 'Matilda',
    accent: 'american',
    age: 'young',
    gender: 'female',
    description: 'warm',
    preview_url:
      'https://storage.googleapis.com/eleven-public-prod/premade/voices/XrExE9yKIg1WjnnlVkGX/b930e18d-6b4d-466e-bab2-0ae97c6d8535.mp3',
    use_case: 'audiobook',
  },
  {
    id: 'Yko7PKHZNXotIFUBG7I9',
    name: 'Matthew',
    accent: 'british',
    age: 'middle aged',
    gender: 'male',
    preview_url:
      'https://storage.googleapis.com/eleven-public-prod/premade/voices/Yko7PKHZNXotIFUBG7I9/02c66c93-a237-436f-8a7d-43e8c49bc6a3.mp3',
    use_case: 'audiobook',
  },
  {
    id: 'ZQe5CZNOzWyzPSCn5a3c',
    name: 'James',
    accent: 'australian',
    age: 'old',
    gender: 'male',
    description: 'calm ',
    preview_url:
      'https://storage.googleapis.com/eleven-public-prod/premade/voices/ZQe5CZNOzWyzPSCn5a3c/35734112-7b72-48df-bc2f-64d5ab2f791b.mp3',
    use_case: 'news',
  },
  {
    id: 'Zlb1dXrM653N07WRdFW3',
    name: 'Joseph',
    accent: 'british',
    age: 'middle aged',
    gender: 'male',
    preview_url:
      'https://storage.googleapis.com/eleven-public-prod/premade/voices/Zlb1dXrM653N07WRdFW3/daa22039-8b09-4c65-b59f-c79c48646a72.mp3',
    use_case: 'news',
  },
  {
    id: 'bVMeCyTHy58xNoL34h3p',
    name: 'Jeremy',
    accent: 'american-irish',
    age: 'young',
    gender: 'male',
    description: 'excited',
    preview_url:
      'https://storage.googleapis.com/eleven-public-prod/premade/voices/bVMeCyTHy58xNoL34h3p/66c47d58-26fd-4b30-8a06-07952116a72c.mp3',
    use_case: 'narration',
  },
  {
    id: 'flq6f7yk4E4fJM5XTYuZ',
    name: 'Michael',
    accent: 'american',
    age: 'old',
    gender: 'male',
    preview_url:
      'https://storage.googleapis.com/eleven-public-prod/premade/voices/flq6f7yk4E4fJM5XTYuZ/c6431a82-f7d2-4905-b8a4-a631960633d6.mp3',
    use_case: 'audiobook',
  },
  {
    id: 'g5CIjZEefAph4nQFvHAz',
    name: 'Ethan',
    accent: 'american',
    age: 'young',
    gender: 'male',
    preview_url:
      'https://storage.googleapis.com/eleven-public-prod/premade/voices/g5CIjZEefAph4nQFvHAz/26acfa99-fdec-43b8-b2ee-e49e75a3ac16.mp3',
    use_case: 'ASMR',
  },
  {
    id: 'jBpfuIE2acCO8z3wKNLl',
    name: 'Gigi',
    accent: 'american',
    age: 'young',
    gender: 'female',
    description: 'childlish',
    preview_url:
      'https://storage.googleapis.com/eleven-public-prod/premade/voices/jBpfuIE2acCO8z3wKNLl/3a7e4339-78fa-404e-8d10-c3ef5587935b.mp3',
    use_case: 'animation',
  },
  {
    id: 'jsCqWAovK2LkecY7zXl4',
    name: 'Freya',
    accent: 'american',
    age: 'young',
    gender: 'female',
    preview_url:
      'https://storage.googleapis.com/eleven-public-prod/premade/voices/jsCqWAovK2LkecY7zXl4/8e1f5240-556e-4fd5-892c-25df9ea3b593.mp3',
  },
  {
    id: 'oWAxZDx7w5VEj9dCyTzz',
    name: 'Grace',
    accent: 'american-southern',
    age: 'young',
    gender: 'female',
    preview_url:
      'https://storage.googleapis.com/eleven-public-prod/premade/voices/oWAxZDx7w5VEj9dCyTzz/84a36d1c-e182-41a8-8c55-dbdd15cd6e72.mp3',
    use_case: 'audiobook ',
  },
  {
    id: 'onwK4e9ZLuTAKqWW03F9',
    name: 'Daniel',
    accent: 'british',
    age: 'middle aged',
    gender: 'male',
    description: 'deep',
    preview_url:
      'https://storage.googleapis.com/eleven-public-prod/premade/voices/onwK4e9ZLuTAKqWW03F9/7eee0236-1a72-4b86-b303-5dcadc007ba9.mp3',
    use_case: 'news presenter',
  },
  {
    id: 'pFZP5JQG7iQjIQuC4Bku',
    name: 'Lily',
    accent: 'british',
    age: 'middle aged',
    gender: 'female',
    description: 'raspy',
    preview_url:
      'https://storage.googleapis.com/eleven-public-prod/premade/voices/pFZP5JQG7iQjIQuC4Bku/0ab8bd74-fcd2-489d-b70a-3e1bcde8c999.mp3',
    use_case: 'narration',
  },
  {
    id: 'pMsXgVXv3BLzUgSXRplE',
    name: 'Serena',
    accent: 'american',
    age: 'middle aged',
    gender: 'female',
    description: 'pleasant',
    preview_url:
      'https://storage.googleapis.com/eleven-public-prod/premade/voices/pMsXgVXv3BLzUgSXRplE/d61f18ed-e5b0-4d0b-a33c-5c6e7e33b053.mp3',
    use_case: 'interactive',
  },
  {
    id: 'pNInz6obpgDQGcFmaJgB',
    name: 'Adam',
    accent: 'american',
    age: 'middle aged',
    gender: 'male',
    description: 'deep',
    preview_url:
      'https://storage.googleapis.com/eleven-public-prod/premade/voices/pNInz6obpgDQGcFmaJgB/38a69695-2ca9-4b9e-b9ec-f07ced494a58.mp3',
    use_case: 'narration',
  },
  {
    id: 'piTKgcLEGmPE4e6mEKli',
    name: 'Nicole',
    accent: 'american',
    age: 'young',
    gender: 'female',
    description: 'whisper',
    preview_url:
      'https://storage.googleapis.com/eleven-public-prod/premade/voices/piTKgcLEGmPE4e6mEKli/c269a54a-e2bc-44d0-bb46-4ed2666d6340.mp3',
    use_case: 'audiobook',
  },
  {
    id: 'pqHfZKP75CvOlQylNhV4',
    name: 'Bill',
    accent: 'american',
    age: 'middle aged',
    gender: 'male',
    description: 'strong',
    preview_url:
      'https://storage.googleapis.com/eleven-public-prod/premade/voices/pqHfZKP75CvOlQylNhV4/52f0842a-cf81-4715-8cf0-76cfbd77088e.mp3',
    use_case: 'documentary',
  },
  {
    id: 't0jbNlBVZ17f02VDIeMI',
    name: 'Jessie',
    accent: 'american',
    age: 'old',
    gender: 'male',
    description: 'raspy ',
    preview_url:
      'https://storage.googleapis.com/eleven-public-prod/premade/voices/t0jbNlBVZ17f02VDIeMI/e26939e3-61a4-4872-a41d-33922cfbdcdc.mp3',
    use_case: 'video games',
  },
  {
    id: 'yoZ06aMxZJJ28mfd3POQ',
    name: 'Sam',
    accent: 'american',
    age: 'young',
    gender: 'male',
    description: 'raspy',
    preview_url:
      'https://storage.googleapis.com/eleven-public-prod/premade/voices/yoZ06aMxZJJ28mfd3POQ/ac9d1c91-92ce-4b20-8cc2-3187a7da49ec.mp3',
    use_case: 'narration',
  },
  {
    id: 'z9fAnlkpzviPz146aGWa',
    name: 'Glinda',
    accent: 'american',
    age: 'middle aged',
    gender: 'female',
    description: 'witch',
    preview_url:
      'https://storage.googleapis.com/eleven-public-prod/premade/voices/z9fAnlkpzviPz146aGWa/cbc60443-7b61-4ebb-b8e1-5c03237ea01d.mp3',
    use_case: 'video games',
  },
  {
    id: 'zcAOhNBS3c14rBihAFp1',
    name: 'Giovanni',
    accent: 'english-italian',
    age: 'young',
    gender: 'male',
    description: 'foreigner',
    preview_url:
      'https://storage.googleapis.com/eleven-public-prod/premade/voices/zcAOhNBS3c14rBihAFp1/e7410f8f-4913-4cb8-8907-784abee5aff8.mp3',
    use_case: 'audiobook',
  },
  {
    id: 'zrHiDhphv9ZnVXBqCLjz',
    name: 'Mimi',
    accent: 'english-swedish',
    age: 'young',
    gender: 'female',
    description: 'childish',
    preview_url:
      'https://storage.googleapis.com/eleven-public-prod/premade/voices/zrHiDhphv9ZnVXBqCLjz/decbf20b-0f57-4fac-985b-a4f0290ebfc4.mp3',
    use_case: 'animation',
  },

  //////// custom voices //////////////
  {
    id: 'Aeso74V56QEMYuaJGgsw',
    name: 'Tao',
    accent: 'american',
    age: 'middle aged',
    gender: 'male',
    description: 'Bombay Beach Biennale',
    preview_url: '',
    use_case: 'tao',
  },
  {
    id: 'CWJgNDoO3K8OswjpujkI',
    name: 'chatsubo.z',
    accent: 'american',
    age: 'middle aged',
    gender: 'male',
    description: 'Mars College',
    preview_url: '',
    use_case: 'chatsubo.z',
  },
  {
    id: 'GV911kUjA4mzz0yqTSDX',
    name: 'Sonia',
    accent: 'British-American',
    age: 'older',
    gender: 'female',
    description: 'Bombay Beach',
    preview_url: '',
    use_case: 'Sonia',
  },
  {
    id: '16j0SQzA3kJQvnsWTGSz',
    name: 'David Lynch',
    accent: 'American',
    age: 'older',
    gender: 'male',
    description: 'Weather reports with David Lynch',
    preview_url: '',
    use_case: 'David Lynch',
  },
]

export class ElevenLabs {
  voices: any[]
  headers: {
    accept: string
    'content-type': string
    'xi-api-key': string
  }

  constructor(apiKey: string) {
    this.voices = ELEVENLABS_VOICES
    this.headers = {
      accept: 'audio/mpeg',
      'content-type': 'application/json',
      'xi-api-key': `${apiKey}`,
    }
  }

  runTask = async (voice: string, text: string) => {
    const speechDetails = await axios({
      method: 'POST',
      url: `https://api.elevenlabs.io/v1/text-to-speech/${voice}`,
      headers: this.headers,
      data: { text },
      responseType: 'arraybuffer',
    })
    return speechDetails.data
  }
}

export const registerElevenLabs = async (fastify: FastifyInstance) => {
  try {
    const elevenLabs = new ElevenLabs(fastify.config.ELEVENLABS_API_KEY)
    fastify.decorate('elevenLabs', elevenLabs)
    fastify.log.info('Successfully registered plugin: ElevenLabs')
  } catch (err) {
    fastify.log.error('Plugin: ElevenLabs, error on register', err)
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    elevenLabs?: ElevenLabs
  }
}

export default registerElevenLabs
