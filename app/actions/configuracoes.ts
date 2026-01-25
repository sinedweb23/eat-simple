'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const smtpConfigSchema = z.object({
  smtp_enabled: z.boolean(),
  smtp_host: z.string().min(1, 'Host SMTP é obrigatório'),
  smtp_port: z.string().regex(/^\d+$/, 'Porta deve ser um número'),
  smtp_user: z.string().email('Email inválido'),
  smtp_password: z.string().min(1, 'Senha é obrigatória'),
  smtp_sender_email: z.string().email('Email remetente inválido'),
  smtp_sender_name: z.string().min(1, 'Nome do remetente é obrigatório'),
})

/**
 * Obter todas as configurações
 */
export async function obterConfiguracoes() {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('configuracoes')
    .select('*')
    .order('chave')

  if (error) {
    console.error('Erro ao obter configurações:', error)
    throw new Error('Erro ao carregar configurações')
  }

  return data || []
}

/**
 * Obter uma configuração específica
 */
export async function obterConfiguracao(chave: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('configuracoes')
    .select('*')
    .eq('chave', chave)
    .single()

  if (error) {
    console.error('Erro ao obter configuração:', error)
    return null
  }

  return data
}

/**
 * Atualizar configurações SMTP
 */
export async function atualizarConfiguracaoSMTP(config: z.infer<typeof smtpConfigSchema>) {
  const supabase = await createClient()
  
  // Validar dados
  const dadosValidados = smtpConfigSchema.parse(config)

  // Atualizar cada configuração
  const atualizacoes = [
    { chave: 'smtp_enabled', valor: dadosValidados.smtp_enabled.toString() },
    { chave: 'smtp_host', valor: dadosValidados.smtp_host },
    { chave: 'smtp_port', valor: dadosValidados.smtp_port },
    { chave: 'smtp_user', valor: dadosValidados.smtp_user },
    { chave: 'smtp_password', valor: dadosValidados.smtp_password },
    { chave: 'smtp_sender_email', valor: dadosValidados.smtp_sender_email },
    { chave: 'smtp_sender_name', valor: dadosValidados.smtp_sender_name },
  ]

  for (const atualizacao of atualizacoes) {
    const { error } = await supabase
      .from('configuracoes')
      .update({ 
        valor: atualizacao.valor,
        updated_at: new Date().toISOString()
      })
      .eq('chave', atualizacao.chave)

    if (error) {
      console.error(`Erro ao atualizar ${atualizacao.chave}:`, error)
      throw new Error(`Erro ao atualizar configuração ${atualizacao.chave}`)
    }
  }

  // Se SMTP está habilitado, tentar configurar no Supabase
  if (dadosValidados.smtp_enabled) {
    await configurarSMTPNoSupabase(dadosValidados)
  }

  return { success: true }
}

/**
 * Configurar SMTP no Supabase via API Admin
 * Nota: O Supabase não expõe API pública para configurar SMTP,
 * então isso deve ser feito manualmente no dashboard.
 * Esta função apenas valida e prepara os dados.
 */
async function configurarSMTPNoSupabase(config: z.infer<typeof smtpConfigSchema>) {
  // O Supabase requer configuração manual no dashboard:
  // Settings > Auth > SMTP Settings
  // Por enquanto, apenas logamos as informações
  console.log('📧 Configuração SMTP salva. Configure manualmente no Supabase Dashboard:')
  console.log('   Host:', config.smtp_host)
  console.log('   Port:', config.smtp_port)
  console.log('   User:', config.smtp_user)
  console.log('   Sender:', config.smtp_sender_email)
  console.log('   Name:', config.smtp_sender_name)
  console.log('   Dashboard: https://supabase.com/dashboard/project/jznhaioobvjwjdmigxja/settings/auth')
}

/**
 * Obter configurações SMTP formatadas
 */
export async function obterConfiguracaoSMTP() {
  const supabase = await createClient()
  
  // Buscar todas as configurações SMTP
  const { data: configuracoes, error } = await supabase
    .from('configuracoes')
    .select('chave, valor')
    .in('chave', [
      'smtp_enabled',
      'smtp_host',
      'smtp_port',
      'smtp_user',
      'smtp_password',
      'smtp_sender_email',
      'smtp_sender_name'
    ])

  if (error) {
    console.error('Erro ao buscar configurações SMTP:', error)
    return {
      enabled: false,
      host: '',
      port: 587,
      secure: false,
      user: '',
      password: '',
      sender_email: '',
      sender_name: '',
    }
  }

  // Mapear configurações
  const smtpConfig: Record<string, any> = {
    enabled: false,
    host: '',
    port: 587,
    secure: false,
    user: '',
    password: '',
    sender_email: '',
    sender_name: '',
  }

  if (configuracoes) {
    configuracoes.forEach((config: any) => {
      const valor = config.valor || ''
      
      switch (config.chave) {
        case 'smtp_enabled':
          smtpConfig.enabled = valor === 'true' || valor === true
          break
        case 'smtp_host':
          smtpConfig.host = valor
          break
        case 'smtp_port':
          smtpConfig.port = parseInt(valor || '587', 10)
          smtpConfig.secure = smtpConfig.port === 465
          break
        case 'smtp_user':
          smtpConfig.user = valor
          break
        case 'smtp_password':
          smtpConfig.password = valor
          break
        case 'smtp_sender_email':
          smtpConfig.sender_email = valor
          break
        case 'smtp_sender_name':
          smtpConfig.sender_name = valor
          break
      }
    })
  }

  // Se tem host e user, considerar habilitado (mesmo se enabled for false)
  if (smtpConfig.host && smtpConfig.user && smtpConfig.password) {
    smtpConfig.enabled = true
  }

  return smtpConfig
}

/**
 * Schema para configurações de aparência
 */
const aparenciaConfigSchema = z.object({
  loja_nome: z.string().min(1, 'Nome da loja é obrigatório'),
  loja_logo_url: z.string().refine(
    (val) => val === '' || z.string().url().safeParse(val).success,
    { message: 'URL do logo inválida' }
  ),
  loja_favicon_url: z.string().refine(
    (val) => val === '' || z.string().url().safeParse(val).success,
    { message: 'URL do favicon inválida' }
  ),
})

/**
 * Obter configurações de aparência
 */
export async function obterConfiguracaoAparencia() {
  const supabase = await createClient()
  
  const { data: configuracoes, error } = await supabase
    .from('configuracoes')
    .select('chave, valor')
    .in('chave', [
      'loja_nome',
      'loja_logo_url',
      'loja_favicon_url'
    ])

  if (error) {
    console.error('Erro ao buscar configurações de aparência:', error)
    return {
      loja_nome: '',
      loja_logo_url: '',
      loja_favicon_url: '',
    }
  }

  const aparenciaConfig: Record<string, string> = {
    loja_nome: '',
    loja_logo_url: '',
    loja_favicon_url: '',
  }

  if (configuracoes) {
    configuracoes.forEach((config: any) => {
      aparenciaConfig[config.chave] = config.valor || ''
    })
  }

  return aparenciaConfig
}

/**
 * Atualizar configurações de aparência
 */
export async function atualizarConfiguracaoAparencia(config: z.infer<typeof aparenciaConfigSchema>) {
  const supabase = await createClient()
  
  // Validar dados
  const dadosValidados = aparenciaConfigSchema.parse(config)

  // Atualizar cada configuração
  const atualizacoes = [
    { chave: 'loja_nome', valor: dadosValidados.loja_nome },
    { chave: 'loja_logo_url', valor: dadosValidados.loja_logo_url || '' },
    { chave: 'loja_favicon_url', valor: dadosValidados.loja_favicon_url || '' },
  ]

  for (const atualizacao of atualizacoes) {
    const { error } = await supabase
      .from('configuracoes')
      .upsert({ 
        chave: atualizacao.chave,
        valor: atualizacao.valor,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'chave'
      })

    if (error) {
      console.error(`Erro ao atualizar ${atualizacao.chave}:`, error)
      throw new Error(`Erro ao atualizar configuração ${atualizacao.chave}`)
    }
  }

  return { success: true }
}

/**
 * Obter token da API externa de importação
 */
export async function obterTokenAPIExterna() {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('configuracoes')
    .select('valor')
    .eq('chave', 'importacao_api_token')
    .maybeSingle()

  if (error) {
    console.error('Erro ao buscar token da API externa:', error)
    return ''
  }

  return data?.valor || ''
}

/**
 * Salvar token da API externa de importação
 */
export async function salvarTokenAPIExterna(token: string) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('configuracoes')
    .upsert({
      chave: 'importacao_api_token',
      valor: token,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'chave'
    })

  if (error) {
    console.error('Erro ao salvar token da API externa:', error)
    throw new Error('Erro ao salvar token da API externa')
  }

  return { success: true }
}
