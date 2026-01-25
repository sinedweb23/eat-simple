import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

// Schema de validação do payload da API externa
const registroImportacaoSchema = z.object({
  nomealuno: z.string().min(1),
  prontuario: z.string().min(1),
  descricaoturma: z.string().min(1),
  tipocurso: z.string().optional(),
  situacao: z.string().default('ATIVO'),
  
  // Responsável Financeiro
  nomerespfin: z.string().optional(),
  cpfrespfin: z.string().optional(),
  emailrespfin: z.union([z.string().email(), z.literal('')]).optional(),
  logradourorespfin: z.string().optional(),
  ceprespfin: z.string().optional(),
  numerorespfin: z.string().optional(),
  complementorespfin: z.string().optional(),
  bairrorespfin: z.string().optional(),
  cidaderespfin: z.string().optional(),
  estadorespfin: z.string().optional(),
  celularrespfin: z.string().optional(),
  
  // Responsável Pedagógico
  nomerespped: z.string().optional(),
  cpfrespped: z.string().optional(),
  emailrespped: z.union([z.string().email(), z.literal('')]).optional(),
  logradourorespped: z.string().optional(),
  ceprespped: z.string().optional(),
  numerorespped: z.string().optional(),
  complementorespped: z.string().optional(),
  bairrorespped: z.string().optional(),
  cidaderespped: z.string().optional(),
  estadorespped: z.string().optional(),
  celularrespped: z.string().optional(),
})

const importacaoRequestSchema = z.object({
  empresa_id: z.string().uuid(),
  api_key: z.string().min(1),
  registros: z.array(registroImportacaoSchema).min(1),
})

// Função auxiliar para mapear segmento baseado na descrição da turma
function mapearSegmento(descricaoturma?: string, tipocurso?: string): 'EDUCACAO_INFANTIL' | 'FUNDAMENTAL' | 'MEDIO' | 'EFAF' | 'EFAI' | 'OUTRO' {
  // PRIORIDADE 1: Verificar descrição da turma (regras específicas)
  if (descricaoturma) {
    const descricao = descricaoturma.toUpperCase()
    
    // Se tiver "EM" na descrição → ENSINO MÉDIO
    if (descricao.includes('EM') && !descricao.includes('EFAF') && !descricao.includes('EFAI')) {
      return 'MEDIO'
    }
    
    // Se tiver "EFAF" na descrição → EFAF (Ensino Fundamental Anos Finais)
    if (descricao.includes('EFAF')) {
      return 'EFAF'
    }
    
    // Se tiver "EFAI" na descrição → EFAI (Ensino Fundamental Anos Iniciais)
    if (descricao.includes('EFAI')) {
      return 'EFAI'
    }
  }
  
  // PRIORIDADE 2: Verificar tipo do curso (fallback)
  if (tipocurso) {
    const curso = tipocurso.toUpperCase()
    if (curso.includes('INFANTIL') || curso.includes('EDUCAÇÃO INFANTIL')) return 'EDUCACAO_INFANTIL'
    if (curso.includes('FUNDAMENTAL')) return 'FUNDAMENTAL'
    if (curso.includes('MÉDIO') || curso.includes('MEDIO')) return 'MEDIO'
  }
  
  return 'OUTRO'
}

// Função auxiliar para criar ou atualizar responsável
async function upsertResponsavel(
  supabase: any,
  dados: z.infer<typeof registroImportacaoSchema>,
  tipo: 'FINANCEIRO' | 'PEDAGOGICO'
): Promise<string | null> {
  const nome = tipo === 'FINANCEIRO' ? dados.nomerespfin : dados.nomerespped
  const cpf = tipo === 'FINANCEIRO' ? dados.cpfrespfin : dados.cpfrespped
  const email = tipo === 'FINANCEIRO' ? dados.emailrespfin : dados.emailrespped
  const celular = tipo === 'FINANCEIRO' ? dados.celularrespfin : dados.celularrespped

  // Aceitar responsável se tiver pelo menos nome OU email OU CPF
  if (!nome && !email && !cpf) {
    console.log(`[upsertResponsavel] ${tipo}: Sem nome, email ou CPF, pulando...`)
    return null
  }

  console.log(`[upsertResponsavel] ${tipo}: Processando - nome: ${nome || 'N/A'}, email: ${email || 'N/A'}, cpf: ${cpf || 'N/A'}`)

  // Buscar responsável existente por email ou CPF
  let responsavelId: string | null = null
  
  // Normalizar dados para busca
  const emailNormalizado = email?.trim().toLowerCase() || null
  const cpfLimpo = cpf?.replace(/[^0-9]/g, '') || null
  
  let existente: any = null
  
  // Buscar por email primeiro (mais confiável)
  // IMPORTANTE: Buscar PRIMEIRO no campo específico do tipo (financeiro ou pedagógico)
  // Isso evita encontrar o responsável do outro tipo quando são pessoas diferentes
  if (emailNormalizado) {
    const emailField = tipo === 'FINANCEIRO' ? 'email_financeiro' : 'email_pedagogico'
    
    // Buscar primeiro no campo específico
    const { data: emailData, error: emailError } = await supabase
      .from('usuarios')
      .select('id, tipo, email_financeiro, email_pedagogico, eh_admin')
      .eq(emailField, emailNormalizado)
      .maybeSingle()
    
    if (emailError) {
      console.error(`[upsertResponsavel] ${tipo}: Erro ao buscar por email no campo ${emailField}:`, emailError)
    } else if (emailData) {
      existente = emailData
      console.log(`[upsertResponsavel] ${tipo}: Responsável encontrado por email no campo ${emailField}:`, existente.id, `(tipo: ${existente.tipo}, admin: ${existente.eh_admin || false})`)
    }
    
    // Se não encontrou no campo específico, buscar em ambos (pode ser admin ou tipo AMBOS)
    if (!existente) {
      const { data: emailDataBoth, error: emailErrorBoth } = await supabase
        .from('usuarios')
        .select('id, tipo, email_financeiro, email_pedagogico, eh_admin')
        .or(`email_financeiro.eq.${emailNormalizado},email_pedagogico.eq.${emailNormalizado}`)
        .maybeSingle()
      
      if (!emailErrorBoth && emailDataBoth) {
        existente = emailDataBoth
        console.log(`[upsertResponsavel] ${tipo}: Responsável encontrado por email em qualquer campo:`, existente.id, `(tipo: ${existente.tipo}, admin: ${existente.eh_admin || false})`)
      }
    }
  }
  
  // Se não encontrou por email, buscar por CPF
  // IMPORTANTE: Buscar PRIMEIRO no campo específico do tipo
  if (!existente && cpfLimpo && cpfLimpo.length >= 11) {
    const cpfField = tipo === 'FINANCEIRO' ? 'cpf_financeiro' : 'cpf_pedagogico'
    
    // Buscar primeiro no campo específico
    const { data: cpfData, error: cpfError } = await supabase
      .from('usuarios')
      .select('id, tipo, cpf_financeiro, cpf_pedagogico, eh_admin')
      .eq(cpfField, cpfLimpo)
      .maybeSingle()
    
    if (cpfError) {
      console.error(`[upsertResponsavel] ${tipo}: Erro ao buscar por CPF no campo ${cpfField}:`, cpfError)
    } else if (cpfData) {
      existente = cpfData
      console.log(`[upsertResponsavel] ${tipo}: Responsável encontrado por CPF no campo ${cpfField}:`, existente.id, `(tipo: ${existente.tipo}, admin: ${existente.eh_admin || false})`)
    }
    
    // Se não encontrou no campo específico, buscar em ambos
    if (!existente) {
      const { data: cpfDataBoth, error: cpfErrorBoth } = await supabase
        .from('usuarios')
        .select('id, tipo, cpf_financeiro, cpf_pedagogico, eh_admin')
        .or(`cpf_financeiro.eq.${cpfLimpo},cpf_pedagogico.eq.${cpfLimpo}`)
        .maybeSingle()
      
      if (!cpfErrorBoth && cpfDataBoth) {
        existente = cpfDataBoth
        console.log(`[upsertResponsavel] ${tipo}: Responsável encontrado por CPF em qualquer campo:`, existente.id, `(tipo: ${existente.tipo}, admin: ${existente.eh_admin || false})`)
      }
    }
  }

  if (existente) {
    responsavelId = existente.id
    const ehAdmin = existente.eh_admin === true
    console.log(`[upsertResponsavel] ${tipo}: Usuário existente encontrado (ID: ${responsavelId}, tipo atual: ${existente.tipo}, admin: ${ehAdmin})`)
    
    const updateData: any = {}
    if (tipo === 'FINANCEIRO') {
      if (nome) updateData.nome_financeiro = nome.trim()
      if (cpf) {
        const cpfLimpo = cpf.replace(/[^0-9]/g, '')
        if (cpfLimpo.length >= 11) {
          updateData.cpf_financeiro = cpfLimpo
        }
      }
      if (email) updateData.email_financeiro = email.trim().toLowerCase()
      if (celular) updateData.celular_financeiro = celular.trim()
      // Atualizar tipo: se já é PEDAGOGICO, tornar AMBOS. Se já é FINANCEIRO ou AMBOS, manter.
      if (existente.tipo === 'PEDAGOGICO') {
        updateData.tipo = 'AMBOS'
      } else if (existente.tipo === 'FINANCEIRO' || existente.tipo === 'AMBOS') {
        // Manter o tipo atual
      } else {
        // Se for outro tipo (pode ser admin sem tipo definido), definir como FINANCEIRO
        updateData.tipo = 'FINANCEIRO'
      }
    } else {
      if (nome) updateData.nome_pedagogico = nome.trim()
      if (cpf) {
        const cpfLimpo = cpf.replace(/[^0-9]/g, '')
        if (cpfLimpo.length >= 11) {
          updateData.cpf_pedagogico = cpfLimpo
        }
      }
      if (email) updateData.email_pedagogico = email.trim().toLowerCase()
      if (celular) updateData.celular_pedagogico = celular.trim()
      // Atualizar tipo: se já é FINANCEIRO, tornar AMBOS. Se já é PEDAGOGICO ou AMBOS, manter.
      if (existente.tipo === 'FINANCEIRO') {
        updateData.tipo = 'AMBOS'
      } else if (existente.tipo === 'PEDAGOGICO' || existente.tipo === 'AMBOS') {
        // Manter o tipo atual
      } else {
        // Se for outro tipo (pode ser admin sem tipo definido), definir como PEDAGOGICO
        updateData.tipo = 'PEDAGOGICO'
      }
    }

    updateData.updated_at = new Date().toISOString()

    console.log(`[upsertResponsavel] ${tipo}: Atualizando usuário ${responsavelId} com dados:`, updateData)
    const { error: updateError } = await supabase
      .from('usuarios')
      .update(updateData)
      .eq('id', responsavelId)
    
    if (updateError) {
      console.error(`[upsertResponsavel] ${tipo}: Erro ao atualizar responsável:`, updateError)
      throw new Error(`Erro ao atualizar responsável ${tipo}: ${updateError.message}`)
    } else {
      console.log(`[upsertResponsavel] ${tipo}: ✅ Responsável atualizado com sucesso: ${responsavelId}`)
    }
  } else {
    const insertData: any = {
      tipo: tipo,
    }
    if (tipo === 'FINANCEIRO') {
      if (nome) insertData.nome_financeiro = nome.trim()
      if (cpf) {
        // Remover formatação do CPF
        const cpfLimpo = cpf.replace(/[^0-9]/g, '')
        if (cpfLimpo.length >= 11) {
          insertData.cpf_financeiro = cpfLimpo
        }
      }
      if (email) insertData.email_financeiro = email.trim()
      if (celular) insertData.celular_financeiro = celular.trim()
    } else {
      if (nome) insertData.nome_pedagogico = nome.trim()
      if (cpf) {
        // Remover formatação do CPF
        const cpfLimpo = cpf.replace(/[^0-9]/g, '')
        if (cpfLimpo.length >= 11) {
          insertData.cpf_pedagogico = cpfLimpo
        }
      }
      if (email) insertData.email_pedagogico = email.trim()
      if (celular) insertData.celular_pedagogico = celular.trim()
    }

    console.log(`[upsertResponsavel] ${tipo}: Criando novo responsável com dados:`, insertData)
    const { data: novo, error: insertError } = await supabase
      .from('usuarios')
      .insert(insertData)
      .select('id')
      .single()

    if (insertError) {
      console.error(`[upsertResponsavel] ${tipo}: Erro ao criar responsável:`, insertError)
      throw new Error(`Erro ao criar responsável ${tipo}: ${insertError.message}`)
    }

    if (novo) {
      responsavelId = novo.id
      console.log(`[upsertResponsavel] ${tipo}: Responsável criado com sucesso:`, responsavelId)
    } else {
      console.error(`[upsertResponsavel] ${tipo}: Responsável não foi criado (resposta vazia)`)
    }
  }

  // Criar/atualizar endereço se houver dados
  if (responsavelId) {
    const logradouro = tipo === 'FINANCEIRO' ? dados.logradourorespfin : dados.logradourorespped
    const numero = tipo === 'FINANCEIRO' ? dados.numerorespfin : dados.numerorespped
    const complemento = tipo === 'FINANCEIRO' ? dados.complementorespfin : dados.complementorespped
    const bairro = tipo === 'FINANCEIRO' ? dados.bairrorespfin : dados.bairrorespped
    const cidade = tipo === 'FINANCEIRO' ? dados.cidaderespfin : dados.cidaderespped
    const estado = tipo === 'FINANCEIRO' ? dados.estadorespfin : dados.estadorespped
    const cep = tipo === 'FINANCEIRO' ? dados.ceprespfin : dados.ceprespped

    if (logradouro || cidade) {
      const { data: enderecoExistente } = await supabase
        .from('enderecos')
        .select('id')
        .eq('usuario_id', responsavelId)
        .eq('tipo', 'RESIDENCIAL')
        .maybeSingle()

      const enderecoData: any = {
            usuario_id: responsavelId,
        tipo: 'RESIDENCIAL',
        logradouro: logradouro || null,
        numero: numero || null,
        complemento: complemento || null,
        bairro: bairro || null,
        cidade: cidade || null,
        estado: estado || null,
        cep: cep || null,
      }

      if (enderecoExistente) {
        await supabase
          .from('enderecos')
          .update(enderecoData)
          .eq('id', enderecoExistente.id)
      } else {
        await supabase
          .from('enderecos')
          .insert(enderecoData)
      }
    }
  }

  return responsavelId
}

// Função auxiliar para criar responsável como AMBOS quando só tem dados pedagógicos
async function upsertResponsavelComoAmbos(
  supabase: any,
  dados: z.infer<typeof registroImportacaoSchema>
): Promise<string | null> {
  const nome = dados.nomerespped
  const cpf = dados.cpfrespped
  const email = dados.emailrespped
  const celular = dados.celularrespped

  if (!nome && !email) {
    console.log(`[upsertResponsavelComoAmbos] Sem nome e email, pulando...`)
    return null
  }

  console.log(`[upsertResponsavelComoAmbos] Processando como AMBOS - nome: ${nome || 'N/A'}, email: ${email || 'N/A'}, cpf: ${cpf || 'N/A'}`)

  // Normalizar dados para busca
  const emailNormalizado = email?.trim().toLowerCase() || null
  const cpfLimpo = cpf?.replace(/[^0-9]/g, '') || null
  
  let existente: any = null
  
  // Buscar por email primeiro
  if (emailNormalizado) {
    const { data: emailData, error: emailError } = await supabase
      .from('usuarios')
      .select('id, tipo')
      .or(`email_financeiro.eq.${emailNormalizado},email_pedagogico.eq.${emailNormalizado}`)
      .maybeSingle()
    
    if (emailError) {
      console.error(`[upsertResponsavelComoAmbos] Erro ao buscar por email:`, emailError)
    } else if (emailData) {
      existente = emailData
    }
  }
  
  // Se não encontrou por email, buscar por CPF
  if (!existente && cpfLimpo && cpfLimpo.length >= 11) {
    const { data: cpfData, error: cpfError } = await supabase
      .from('usuarios')
      .select('id, tipo')
      .or(`cpf_financeiro.eq.${cpfLimpo},cpf_pedagogico.eq.${cpfLimpo}`)
      .maybeSingle()
    
    if (cpfError) {
      console.error(`[upsertResponsavelComoAmbos] Erro ao buscar por CPF:`, cpfError)
    } else if (cpfData) {
      existente = cpfData
    }
  }

  let responsavelId: string | null = null

  if (existente) {
    responsavelId = existente.id
    
    // Atualizar para AMBOS e preencher ambos os campos
    const updateData: any = {
      tipo: 'AMBOS',
      updated_at: new Date().toISOString(),
    }
    
    // Preencher campos financeiros com dados pedagógicos
    if (nome) {
      updateData.nome_financeiro = nome.trim()
      updateData.nome_pedagogico = nome.trim()
    }
    if (cpfLimpo && cpfLimpo.length >= 11) {
      updateData.cpf_financeiro = cpfLimpo
      updateData.cpf_pedagogico = cpfLimpo
    }
    if (email) {
      updateData.email_financeiro = email.trim()
      updateData.email_pedagogico = email.trim()
    }
    if (celular) {
      updateData.celular_financeiro = celular.trim()
      updateData.celular_pedagogico = celular.trim()
    }

    const { error: updateError } = await supabase
      .from('usuarios')
      .update(updateData)
      .eq('id', responsavelId)
    
    if (updateError) {
      console.error(`[upsertResponsavelComoAmbos] Erro ao atualizar:`, updateError)
      throw new Error(`Erro ao atualizar responsável: ${updateError.message}`)
    }
  } else {
    // Criar novo como AMBOS
    const insertData: any = {
      tipo: 'AMBOS',
    }
    
    if (nome) {
      insertData.nome_financeiro = nome.trim()
      insertData.nome_pedagogico = nome.trim()
    }
    if (cpfLimpo && cpfLimpo.length >= 11) {
      insertData.cpf_financeiro = cpfLimpo
      insertData.cpf_pedagogico = cpfLimpo
    }
    if (email) {
      insertData.email_financeiro = email.trim()
      insertData.email_pedagogico = email.trim()
    }
    if (celular) {
      insertData.celular_financeiro = celular.trim()
      insertData.celular_pedagogico = celular.trim()
    }

    const { data: novo, error: insertError } = await supabase
      .from('usuarios')
      .insert(insertData)
      .select('id')
      .single()

    if (insertError) {
      console.error(`[upsertResponsavelComoAmbos] Erro ao criar:`, insertError)
      throw new Error(`Erro ao criar responsável: ${insertError.message}`)
    }

    if (novo) {
      responsavelId = novo.id
    }
  }

  // Criar/atualizar endereço se houver dados
  if (responsavelId && (dados.logradourorespped || dados.cidaderespped)) {
    const { data: enderecoExistente } = await supabase
      .from('enderecos')
      .select('id')
      .eq('usuario_id', responsavelId)
      .eq('tipo', 'RESIDENCIAL')
      .maybeSingle()

    const enderecoData: any = {
            usuario_id: responsavelId,
      tipo: 'RESIDENCIAL',
      logradouro: dados.logradourorespped || null,
      numero: dados.numerorespped || null,
      complemento: dados.complementorespped || null,
      bairro: dados.bairrorespped || null,
      cidade: dados.cidaderespped || null,
      estado: dados.estadorespped || null,
      cep: dados.ceprespped || null,
    }

    if (enderecoExistente) {
      await supabase
        .from('enderecos')
        .update(enderecoData)
        .eq('id', enderecoExistente.id)
    } else {
      await supabase
        .from('enderecos')
        .insert(enderecoData)
    }
  }

  return responsavelId
}

export async function processarImportacao(body: any) {
  const validated = importacaoRequestSchema.parse(body)

  // Verificar API key
  const expectedApiKey = process.env.IMPORTACAO_API_KEY || 'default-api-key-change-me'
  if (validated.api_key !== expectedApiKey) {
    throw new Error('API key inválida')
  }

  const supabase = createAdminClient()
  
  // Verificar se empresa existe
  const { data: empresa } = await supabase
    .from('empresas')
    .select('id')
    .eq('id', validated.empresa_id)
    .single()

  if (!empresa) {
    throw new Error('Empresa não encontrada')
  }

  // Criar log de importação
  const { data: log } = await supabase
    .from('importacao_logs')
    .insert({
      empresa_id: validated.empresa_id,
      tipo: 'API',
      status: 'EM_PROGRESSO',
      total_registros: validated.registros.length,
      payload_inicial: body,
    })
    .select('id')
    .single()

  const logId = log?.id
  const erros: any[] = []
  let registrosProcessados = 0
  let registrosCriados = 0
  let registrosAtualizados = 0

  // IMPORTANTE: Agrupar registros por prontuário (como no sistema PHP)
  // Isso garante que todos os responsáveis de um aluno sejam processados juntos
  const alunosAgrupados: Map<string, typeof validated.registros> = new Map()
  
  for (const registro of validated.registros) {
    const prontuario = registro.prontuario?.trim()
    if (!prontuario) {
      console.warn(`[processarImportacao] Registro sem prontuário, pulando...`)
      continue
    }
    
    if (!alunosAgrupados.has(prontuario)) {
      alunosAgrupados.set(prontuario, [])
    }
    alunosAgrupados.get(prontuario)!.push(registro)
  }

  console.log(`[processarImportacao] Total de alunos únicos: ${alunosAgrupados.size}, Total de registros: ${validated.registros.length}`)

  // Processar cada aluno (agrupado por prontuário)
  for (const [prontuario, registros] of alunosAgrupados.entries()) {
    try {
      // Pegar o primeiro registro para dados básicos do aluno
      const primeiroRegistro = registros[0]
      const nomeAluno = primeiroRegistro.nomealuno?.trim()
      const descricaoTurma = primeiroRegistro.descricaoturma?.trim()
      const situacao = primeiroRegistro.situacao || 'ATIVO'
      
      if (!nomeAluno || !descricaoTurma) {
        console.warn(`[processarImportacao] Aluno ${prontuario} sem nome ou turma, pulando...`)
        continue
      }

      // 1. Criar/atualizar turma
      let turmaId: string | null = null
      const { data: turmaExistente } = await supabase
        .from('turmas')
        .select('id')
        .eq('empresa_id', validated.empresa_id)
        .eq('descricao', descricaoTurma)
        .maybeSingle()

      if (turmaExistente) {
        turmaId = turmaExistente.id
        await supabase
          .from('turmas')
          .update({
            segmento: mapearSegmento(descricaoTurma, primeiroRegistro.tipocurso),
            tipo_curso: primeiroRegistro.tipocurso || null,
            situacao: situacao === 'ATIVO' ? 'ATIVA' : 'INATIVA',
            updated_at: new Date().toISOString(),
          })
          .eq('id', turmaId)
      } else {
        const { data: novaTurma } = await supabase
          .from('turmas')
          .insert({
            empresa_id: validated.empresa_id,
            descricao: descricaoTurma,
            segmento: mapearSegmento(descricaoTurma, primeiroRegistro.tipocurso),
            tipo_curso: primeiroRegistro.tipocurso || null,
            situacao: situacao === 'ATIVO' ? 'ATIVA' : 'INATIVA',
          })
          .select('id')
          .single()

        if (novaTurma) {
          turmaId = novaTurma.id
        }
      }

      if (!turmaId) {
        throw new Error('Erro ao criar/atualizar turma')
      }

      // 2. Criar/atualizar aluno
      const { data: alunoExistente } = await supabase
        .from('alunos')
        .select('id')
        .eq('empresa_id', validated.empresa_id)
        .eq('prontuario', prontuario)
        .maybeSingle()

      let alunoId: string
      if (alunoExistente) {
        alunoId = alunoExistente.id
        await supabase
          .from('alunos')
          .update({
            nome: nomeAluno,
            turma_id: turmaId,
            situacao: situacao,
            updated_at: new Date().toISOString(),
          })
          .eq('id', alunoId)
        registrosAtualizados++
      } else {
        const { data: novoAluno } = await supabase
          .from('alunos')
          .insert({
            empresa_id: validated.empresa_id,
            prontuario: prontuario,
            nome: nomeAluno,
            turma_id: turmaId,
            situacao: situacao,
          })
          .select('id')
          .single()

        if (!novoAluno) {
          throw new Error('Erro ao criar aluno')
        }
        alunoId = novoAluno.id
        registrosCriados++
      }

      // 3. Processar TODOS os responsáveis únicos de TODOS os registros do mesmo aluno
      // IMPORTANTE: Como no sistema PHP, coletar todos os responsáveis únicos primeiro
      console.log(`[processarImportacao] Processando responsáveis para aluno ${alunoId} (prontuario: ${prontuario}) - ${registros.length} registro(s)`)
      
      // Função auxiliar para verificar se há dados válidos (não vazios)
      const temDadoValido = (valor: string | undefined | null): boolean => {
        return !!(valor && valor.trim() && valor.trim() !== '' && valor.trim() !== 'null' && valor.trim() !== 'undefined')
      }
      
      // Função auxiliar para normalizar CPF (usar como chave única, como no PHP)
      const normalizarCPF = (cpf: string | undefined | null): string | null => {
        if (!cpf) return null
        const cpfLimpo = cpf.replace(/[^0-9]/g, '')
        return cpfLimpo.length >= 11 ? cpfLimpo : null
      }
      
      // Coletar todos os responsáveis únicos de TODOS os registros (usando CPF como chave, como no PHP)
      const responsaveisUnicos: Map<string, {
        id: string | null
        nome: string
        cpf: string
        email: string | null
        tipos: Set<'FINANCEIRO' | 'PEDAGOGICO'>
        endereco?: any
      }> = new Map()
      
      // Processar TODOS os registros do mesmo aluno
      for (const registro of registros) {
        // Processar responsável financeiro
        const nomeFin = registro.nomerespfin?.trim()
        const cpfFin = normalizarCPF(registro.cpfrespfin)
        const emailFin = registro.emailrespfin?.trim().toLowerCase() || null
        
        if (nomeFin && cpfFin) {
          if (!responsaveisUnicos.has(cpfFin)) {
            responsaveisUnicos.set(cpfFin, {
              id: null,
              nome: nomeFin,
              cpf: cpfFin,
              email: emailFin,
              tipos: new Set(['FINANCEIRO']),
              endereco: {
                logradouro: registro.logradourorespfin?.trim() || null,
                numero: registro.numerorespfin?.trim() || null,
                complemento: registro.complementorespfin?.trim() || null,
                bairro: registro.bairrorespfin?.trim() || null,
                cidade: registro.cidaderespfin?.trim() || null,
                estado: registro.estadorespfin?.trim() || null,
                cep: registro.ceprespfin?.trim() || null,
                celular: registro.celularrespfin?.trim() || null,
              }
            })
          } else {
            // Responsável já existe, adicionar tipo financeiro se não existir
            responsaveisUnicos.get(cpfFin)!.tipos.add('FINANCEIRO')
          }
        }
        
        // Processar responsável pedagógico
        const nomePed = registro.nomerespped?.trim()
        const cpfPed = normalizarCPF(registro.cpfrespped)
        const emailPed = registro.emailrespped?.trim().toLowerCase() || null
        
        if (nomePed && cpfPed) {
          if (!responsaveisUnicos.has(cpfPed)) {
            responsaveisUnicos.set(cpfPed, {
              id: null,
              nome: nomePed,
              cpf: cpfPed,
              email: emailPed,
              tipos: new Set(['PEDAGOGICO']),
              endereco: {
                logradouro: registro.logradourorespped?.trim() || null,
                numero: registro.numerorespped?.trim() || null,
                complemento: registro.complementorespped?.trim() || null,
                bairro: registro.bairrorespped?.trim() || null,
                cidade: registro.cidaderespped?.trim() || null,
                estado: registro.estadorespped?.trim() || null,
                cep: registro.ceprespped?.trim() || null,
                celular: registro.celularrespped?.trim() || null,
              }
            })
          } else {
            // Responsável já existe, adicionar tipo pedagógico se não existir
            responsaveisUnicos.get(cpfPed)!.tipos.add('PEDAGOGICO')
          }
        }
      }
      
      console.log(`[processarImportacao] Responsáveis únicos encontrados: ${responsaveisUnicos.size}`)
      
      // IMPORTANTE: Garantir que só haja 1 responsável financeiro
      // Se houver múltiplos responsáveis com tipo FINANCEIRO, manter apenas o primeiro
      let responsavelFinanceiroUnico: { cpf: string, responsavel: typeof responsaveisUnicos extends Map<string, infer V> ? V : never } | null = null
      const responsaveisPedagogicos: Array<{ cpf: string, responsavel: typeof responsaveisUnicos extends Map<string, infer V> ? V : never }> = []
      
      for (const [cpf, responsavel] of responsaveisUnicos.entries()) {
        const tipos = Array.from(responsavel.tipos)
        
        if (tipos.includes('FINANCEIRO')) {
          // Se já não temos um financeiro, este é o primeiro
          if (!responsavelFinanceiroUnico) {
            responsavelFinanceiroUnico = { cpf, responsavel }
          } else {
            // Se já temos um financeiro, remover o tipo FINANCEIRO deste responsável
            // e manter apenas como PEDAGOGICO (se tiver)
            console.warn(`[processarImportacao] ⚠️ Múltiplos responsáveis financeiros encontrados para aluno ${prontuario}. Mantendo apenas o primeiro (${responsavelFinanceiroUnico.cpf}) e convertendo ${cpf} para apenas pedagógico.`)
            responsavel.tipos.delete('FINANCEIRO')
            if (responsavel.tipos.size > 0) {
              responsaveisPedagogicos.push({ cpf, responsavel })
            }
          }
        }
        
        // Se não é financeiro (ou foi convertido), adicionar aos pedagógicos
        if (!tipos.includes('FINANCEIRO') || (responsavelFinanceiroUnico && responsavelFinanceiroUnico.cpf !== cpf)) {
          if (tipos.includes('PEDAGOGICO')) {
            responsaveisPedagogicos.push({ cpf, responsavel })
          }
        }
      }
      
      // Se não encontrou nenhum financeiro, mas tem pedagógicos, usar o primeiro pedagógico como financeiro também
      if (!responsavelFinanceiroUnico && responsaveisPedagogicos.length > 0) {
        console.log(`[processarImportacao] Nenhum responsável financeiro encontrado, usando o primeiro pedagógico como financeiro também`)
        responsavelFinanceiroUnico = responsaveisPedagogicos[0]
        responsavelFinanceiroUnico.responsavel.tipos.add('FINANCEIRO')
      }
      
      if (!responsavelFinanceiroUnico) {
        console.error(`[processarImportacao] ❌ ERRO CRÍTICO: Nenhum responsável financeiro foi encontrado para o aluno ${alunoId} (prontuario: ${prontuario})`)
        throw new Error(`Não foi possível identificar responsável financeiro para o aluno ${prontuario}. Alunos devem ter pelo menos um responsável financeiro.`)
      }
      
      // Processar cada responsável único e criar/atualizar no banco
      const responsaveisProcessados: Map<string, string> = new Map() // CPF -> ID do usuário
      
      // Função auxiliar para processar um responsável
      const processarResponsavel = async (cpf: string, responsavel: typeof responsaveisUnicos extends Map<string, infer V> ? V : never): Promise<string | null> => {
        const tipos = Array.from(responsavel.tipos)
        const tipoFinal = tipos.includes('FINANCEIRO') && tipos.includes('PEDAGOGICO') 
          ? 'AMBOS' 
          : tipos.includes('FINANCEIRO') 
            ? 'FINANCEIRO' 
            : 'PEDAGOGICO'
        
        console.log(`[processarImportacao] Processando responsável ${responsavel.nome} (CPF: ${cpf}, tipos: ${tipos.join(', ')}, tipo final: ${tipoFinal})`)
        
        // Buscar responsável existente por CPF ou email
        let existente: any = null
        
        if (responsavel.email) {
          const { data: emailData } = await supabase
            .from('usuarios')
            .select('id, tipo, cpf_financeiro, cpf_pedagogico, email_financeiro, email_pedagogico')
            .or(`email_financeiro.eq.${responsavel.email},email_pedagogico.eq.${responsavel.email}`)
            .maybeSingle()
          
          if (emailData) {
            existente = emailData
          }
        }
        
        if (!existente && cpf) {
          const { data: cpfData } = await supabase
            .from('usuarios')
            .select('id, tipo, cpf_financeiro, cpf_pedagogico')
            .or(`cpf_financeiro.eq.${cpf},cpf_pedagogico.eq.${cpf}`)
            .maybeSingle()
          
          if (cpfData) {
            existente = cpfData
          }
        }
        
        let responsavelId: string | null = null
        
        if (existente) {
          // Atualizar responsável existente
          responsavelId = existente.id
          const updateData: any = {
            tipo: tipoFinal,
            updated_at: new Date().toISOString(),
          }
          
          // Atualizar campos baseado nos tipos
          if (tipos.includes('FINANCEIRO')) {
            updateData.nome_financeiro = responsavel.nome
            updateData.cpf_financeiro = cpf
            if (responsavel.email) updateData.email_financeiro = responsavel.email
            if (responsavel.endereco?.celular) updateData.celular_financeiro = responsavel.endereco.celular
          }
          
          if (tipos.includes('PEDAGOGICO')) {
            updateData.nome_pedagogico = responsavel.nome
            updateData.cpf_pedagogico = cpf
            if (responsavel.email) updateData.email_pedagogico = responsavel.email
            if (responsavel.endereco?.celular) updateData.celular_pedagogico = responsavel.endereco.celular
          }
          
          await supabase
            .from('usuarios')
            .update(updateData)
            .eq('id', responsavelId)
          
          console.log(`[processarImportacao] ✅ Responsável ${responsavel.nome} atualizado: ${responsavelId}`)
        } else {
          // Criar novo responsável
          const insertData: any = {
            tipo: tipoFinal,
          }
          
          if (tipos.includes('FINANCEIRO')) {
            insertData.nome_financeiro = responsavel.nome
            insertData.cpf_financeiro = cpf
            if (responsavel.email) insertData.email_financeiro = responsavel.email
            if (responsavel.endereco?.celular) insertData.celular_financeiro = responsavel.endereco.celular
          }
          
          if (tipos.includes('PEDAGOGICO')) {
            insertData.nome_pedagogico = responsavel.nome
            insertData.cpf_pedagogico = cpf
            if (responsavel.email) insertData.email_pedagogico = responsavel.email
            if (responsavel.endereco?.celular) insertData.celular_pedagogico = responsavel.endereco.celular
          }
          
          const { data: novo, error: insertError } = await supabase
            .from('usuarios')
            .insert(insertData)
            .select('id')
            .single()
          
          if (insertError) {
            console.error(`[processarImportacao] Erro ao criar responsável ${responsavel.nome}:`, insertError)
            return null
          }
          
          if (novo) {
            responsavelId = novo.id
            console.log(`[processarImportacao] ✅ Responsável ${responsavel.nome} criado: ${responsavelId}`)
          }
        }
        
        if (responsavelId) {
          // Atualizar endereço se houver dados
          if (responsavel.endereco && (responsavel.endereco.logradouro || responsavel.endereco.cidade)) {
            const { data: enderecoExistente } = await supabase
              .from('enderecos')
              .select('id')
              .eq('usuario_id', responsavelId)
              .eq('tipo', 'RESIDENCIAL')
              .maybeSingle()
            
            const enderecoData: any = {
              usuario_id: responsavelId,
              tipo: 'RESIDENCIAL',
              logradouro: responsavel.endereco.logradouro || null,
              numero: responsavel.endereco.numero || null,
              complemento: responsavel.endereco.complemento || null,
              bairro: responsavel.endereco.bairro || null,
              cidade: responsavel.endereco.cidade || null,
              estado: responsavel.endereco.estado || null,
              cep: responsavel.endereco.cep || null,
            }
            
            if (enderecoExistente) {
              await supabase
                .from('enderecos')
                .update(enderecoData)
                .eq('id', enderecoExistente.id)
            } else {
              await supabase
                .from('enderecos')
                .insert(enderecoData)
            }
          }
        }
        
        return responsavelId
      }
      
      // Processar responsável financeiro primeiro
      const responsavelFinId = await processarResponsavel(responsavelFinanceiroUnico.cpf, responsavelFinanceiroUnico.responsavel)
      if (responsavelFinId) {
        responsaveisProcessados.set(responsavelFinanceiroUnico.cpf, responsavelFinId)
      }
      
      // Processar todos os responsáveis pedagógicos
      for (const { cpf, responsavel } of responsaveisPedagogicos) {
        const responsavelPedId = await processarResponsavel(cpf, responsavel)
        if (responsavelPedId) {
          responsaveisProcessados.set(cpf, responsavelPedId)
        }
      }
      
      if (!responsavelFinId) {
        console.error(`[processarImportacao] ❌ ERRO CRÍTICO: Não foi possível criar/atualizar responsável financeiro para o aluno ${alunoId} (prontuario: ${prontuario})`)
        throw new Error(`Não foi possível criar responsável financeiro para o aluno ${prontuario}. Alunos devem ter pelo menos um responsável financeiro.`)
      }

      console.log(`[processarImportacao] Responsáveis processados - Fin: ${responsavelFinId || 'N/A'}, Total pedagógicos: ${responsaveisPedagogicos.length}, Total único: ${responsaveisProcessados.size}`)

      // IMPORTANTE: Antes de criar novos vínculos, remover vínculos antigos que não devem mais existir
      // Isso garante que a sincronização atualize corretamente os vínculos
      console.log(`[processarImportacao] Removendo vínculos antigos do aluno ${alunoId} antes de criar novos...`)
      const { error: deleteError } = await supabase
        .from('usuario_aluno')
        .delete()
        .eq('aluno_id', alunoId)
      
      if (deleteError) {
        console.error(`[processarImportacao] Erro ao remover vínculos antigos:`, deleteError)
      } else {
        console.log(`[processarImportacao] Vínculos antigos removidos com sucesso`)
      }

      // Vincular TODOS os responsáveis únicos ao aluno (como no PHP: limpar e recriar)
      console.log(`[processarImportacao] Vinculando ${responsaveisProcessados.size} responsável(is) ao aluno ${alunoId}`)
      
      for (const [cpf, usuarioId] of responsaveisProcessados.entries()) {
        const { error: vinculoError } = await supabase
          .from('usuario_aluno')
          .insert({
            usuario_id: usuarioId,
            aluno_id: alunoId,
          })
        
        if (vinculoError) {
          console.error(`[processarImportacao] Erro ao vincular responsável ${cpf}:`, vinculoError)
        } else {
          console.log(`[processarImportacao] ✅ Responsável ${cpf} (${usuarioId}) vinculado ao aluno ${alunoId}`)
        }
      }

      registrosProcessados++
    } catch (error: any) {
      erros.push({
        registro: prontuario,
        erro: error.message || 'Erro desconhecido',
      })
    }
  }

  // Atualizar log
  const status = erros.length === 0 ? 'SUCESSO' : (registrosProcessados > 0 ? 'PARCIAL' : 'ERRO')
  await supabase
    .from('importacao_logs')
    .update({
      status,
      registros_processados: registrosProcessados,
      registros_criados: registrosCriados,
      registros_atualizados: registrosAtualizados,
      registros_com_erro: erros.length,
      erros: erros.length > 0 ? erros : null,
      finalizado_em: new Date().toISOString(),
    })
    .eq('id', logId)

  return {
    success: true,
    log_id: logId,
    total_registros: validated.registros.length,
    registros_processados: registrosProcessados,
    registros_criados: registrosCriados,
    registros_atualizados: registrosAtualizados,
    registros_com_erro: erros.length,
    erros: erros.length > 0 ? erros : undefined,
  }
}
