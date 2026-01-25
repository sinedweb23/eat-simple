'use server'

import { createClient } from '@/lib/supabase/server'
import { verificarSeEhAdmin } from './admin'
import { createAdminClient } from '@/lib/supabase/admin'

export async function listarLogsImportacao(empresaId: string) {
  const ehAdmin = await verificarSeEhAdmin()
  if (!ehAdmin) {
    throw new Error('Não autorizado')
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('importacao_logs')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('iniciado_em', { ascending: false })
    .limit(50)

  if (error) throw error
  return data || []
}

export async function obterLogImportacao(logId: string) {
  const ehAdmin = await verificarSeEhAdmin()
  if (!ehAdmin) {
    throw new Error('Não autorizado')
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('importacao_logs')
    .select('*')
    .eq('id', logId)
    .single()

  if (error) throw error
  return data
}

/**
 * Consome a API externa (PHP) e importa os dados
 */
export async function importarDaAPIExterna(
  apiUrl: string,
  apiKey: string,
  empresaId: string
) {
  const ehAdmin = await verificarSeEhAdmin()
  if (!ehAdmin) {
    throw new Error('Não autorizado')
  }

  try {
    // 1. Buscar dados da API externa
    console.log('[importarDaAPIExterna] Iniciando importação...', { apiUrl, empresaId })
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    console.log('[importarDaAPIExterna] Resposta recebida:', { status: response.status, ok: response.ok })

    if (!response.ok) {
      let errorData: any = {}
      try {
        const text = await response.text()
        errorData = text ? JSON.parse(text) : {}
      } catch {
        errorData = { message: `Erro HTTP ${response.status}` }
      }
      throw new Error(errorData.message || errorData.error || `Erro HTTP ${response.status}: ${response.statusText}`)
    }

    let data: any
    try {
      const text = await response.text()
      data = text ? JSON.parse(text) : null
    } catch (parseError) {
      console.error('[importarDaAPIExterna] Erro ao fazer parse do JSON:', parseError)
      throw new Error('Resposta da API não é um JSON válido')
    }

    console.log('[importarDaAPIExterna] Dados recebidos:', { 
      success: data?.success, 
      total: data?.total,
      registrosCount: data?.registros?.length 
    })

    if (!data) {
      throw new Error('Resposta vazia da API externa')
    }

    if (!data.success) {
      throw new Error(data.message || data.error || 'API externa retornou erro')
    }

    if (!data.registros || !Array.isArray(data.registros)) {
      throw new Error('Resposta inválida: campo "registros" não encontrado ou não é um array')
    }

    if (data.registros.length === 0) {
      throw new Error('Nenhum registro encontrado para importar')
    }

    // 2. Processar importação diretamente
    console.log('[importarDaAPIExterna] Processando importação de', data.registros.length, 'registros')
    const { processarImportacao } = await import('@/app/api/importacao/processar')
    const importResult = await processarImportacao({
      empresa_id: empresaId,
      api_key: process.env.IMPORTACAO_API_KEY || 'default-api-key-change-me',
      registros: data.registros,
    })
    
    console.log('[importarDaAPIExterna] Importação concluída:', importResult)
    return importResult
  } catch (error: any) {
    console.error('Erro ao importar da API externa:', error)
    
    // Se já é um Error, manter a mensagem
    if (error instanceof Error) {
      throw error
    }
    
    // Se é um objeto com mensagem
    if (error?.message) {
      throw new Error(error.message)
    }
    
    // Fallback genérico
    throw new Error(error?.toString() || 'Erro desconhecido ao importar dados da API externa')
  }
}
