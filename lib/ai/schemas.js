import { z } from 'zod'

const difficulty = z.enum(['easy', 'medium', 'hard', 'very_hard'])
const confidence = z.enum(['low', 'medium', 'high'])

export const agentPromptSectionsSchema = z.object({
  task: z.string().describe('Görev: istenen geliştirmenin kısa ve net tanımı'),
  current_problem: z.string().describe('Mevcut problem: neyin yanlış çalıştığı veya eksik olduğu'),
  expected_result: z.string().describe('Beklenen sonuç: geliştirme tamamlandığında neyin değişmesi gerektiği'),
  technical_review: z.array(z.string()).describe('Agentın mevcut kodda araştırması gereken noktalar'),
  implementation_steps: z.array(z.string()).describe('Uygulanabilecek geliştirme adımları'),
  acceptance_criteria: z.array(z.string()),
  test_scenarios: z.array(z.string()).describe('Normal kullanım, sınır durumları ve olası hatalar'),
  cautions: z.array(z.string()).describe('Dikkat edilmesi gerekenler'),
  missing_information: z.array(z.string()).describe('Agentın araştırarak netleştirmesi gereken noktalar'),
})

export const requestAnalysisSchema = z.object({
  summary: z.string().describe('Teknik olmayan birinin anlayacağı 2-3 cümlelik istek özeti'),
  problem: z.string().describe('Mevcut sistemdeki sorun veya eksiklik'),
  current_behavior: z.string().describe('Açıklamaya göre sistemin şu anki davranışı'),
  expected_behavior: z.string().describe('Geliştirme sonrası beklenen davranış'),
  technical_hypotheses: z.array(
    z.object({
      area: z.enum([
        'database',
        'sql_query',
        'reporting',
        'user_interface',
        'backend',
        'api',
        'integration',
        'data_validation',
        'performance',
        'authorization',
        'other',
      ]),
      likelihood: z.enum(['certain', 'likely', 'possible']),
      note: z.string(),
    })
  ),
  steps: z.array(z.string()).describe('İşi gerçekleştirmek için uygulanabilecek adımlar'),
  acceptance_criteria: z.array(z.string()),
  missing_information: z.array(z.string()),
  difficulty,
  estimate_possible: z.boolean().describe('Yeterli bilgi yoksa false'),
  estimated_hours_min: z.number().nullable(),
  estimated_hours_max: z.number().nullable(),
  estimate_confidence: confidence,
  estimate_reason: z.string().describe('Sürenin neleri kapsadığı ve varsayımlar'),
  category: z.string(),
  tags: z.array(z.string()),
  agent_prompt: agentPromptSectionsSchema,
})

export const groupSuggestionsSchema = z.object({
  groups: z.array(
    z.object({
      title: z.string(),
      explanation: z.string().describe('İsteklerin neden aynı teknik çalışmayla çözülebileceği'),
      summary: z.string(),
      category: z.string(),
      difficulty,
      estimated_hours_min: z.number().nullable(),
      estimated_hours_max: z.number().nullable(),
      confidence: z.number().describe('0 ile 1 arasında güven puanı'),
      request_numbers: z.array(z.string()),
    })
  ),
})

export const closingMessageSchema = z.object({
  message: z.string(),
})
