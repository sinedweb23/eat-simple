'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { listarLogsImportacao, importarDaAPIExterna } from '@/app/actions/importacao'
import { getAdminData } from '@/app/actions/admin'
import { obterTokenAPIExterna, salvarTokenAPIExterna } from '@/app/actions/configuracoes'
import { CheckCircle2, XCircle, Clock, AlertCircle, Download, Loader2 } from 'lucide-react'
import { Progress } from '@/components/ui/progress'

interface ImportacaoLog {
  id: string
  tipo: string
  status: string
  total_registros: number
  registros_processados: number
  registros_criados: number
  registros_atualizados: number
  registros_com_erro: number
  iniciado_em: string
  finalizado_em: string | null
}

export function ImportacaoManager() {
  const [logs, setLogs] = useState<ImportacaoLog[]>([])
  const [loading, setLoading] = useState(false)
  const [importando, setImportando] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [apiUrl, setApiUrl] = useState('')
  const [apiUrlExterna, setApiUrlExterna] = useState('https://loja.escolamorumbisul.com.br/api/importacao.php')
  const [apiKeyExterna, setApiKeyExterna] = useState('')
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null)
  const [progresso, setProgresso] = useState(0)
  const [statusImportacao, setStatusImportacao] = useState<string>('')

  useEffect(() => {
    carregarDados()
  }, [])

  async function carregarDados() {
    try {
      const adminData = await getAdminData()
      if (adminData && adminData.empresa_id) {
        setEmpresaId(adminData.empresa_id)
        const logsData = await listarLogsImportacao(adminData.empresa_id)
        setLogs(logsData as ImportacaoLog[])
      }
      
      // Carregar token salvo
      const tokenSalvo = await obterTokenAPIExterna()
      if (tokenSalvo) {
        setApiKeyExterna(tokenSalvo)
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'SUCESSO':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />
      case 'ERRO':
        return <XCircle className="h-5 w-5 text-red-500" />
      case 'PARCIAL':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />
      default:
        return <Clock className="h-5 w-5 text-blue-500" />
    }
  }

  function formatarData(data: string | null) {
    if (!data) return '-'
    return new Date(data).toLocaleString('pt-BR')
  }

  async function handleImportarDaAPIExterna() {
    if (!apiUrlExterna || !apiKeyExterna || !empresaId) {
      setMensagem({ tipo: 'error', texto: 'Preencha a URL da API externa e a API Key' })
      return
    }

    setImportando(true)
    setMensagem(null)
    setProgresso(0)
    setStatusImportacao('Iniciando importação...')

    try {
      // Salvar token antes de importar
      setProgresso(10)
      setStatusImportacao('Salvando configurações...')
      await salvarTokenAPIExterna(apiKeyExterna)
      
      // Buscar dados da API externa
      setProgresso(20)
      setStatusImportacao('Buscando dados da API externa...')
      const resultado = await importarDaAPIExterna(apiUrlExterna, apiKeyExterna, empresaId)
      
      if (!resultado) {
        throw new Error('Resposta vazia da importação')
      }

      setProgresso(90)
      setStatusImportacao('Finalizando...')

      const registrosProcessados = resultado.registros_processados ?? resultado.total_registros ?? 0
      const registrosCriados = resultado.registros_criados ?? 0
      const registrosAtualizados = resultado.registros_atualizados ?? 0
      
      setProgresso(100)
      setStatusImportacao('Concluído!')
      
      setMensagem({
        tipo: 'success',
        texto: `Importação realizada com sucesso! ${registrosProcessados} registros processados (${registrosCriados} criados, ${registrosAtualizados} atualizados).`
      })
      
      await carregarDados() // Recarregar logs
      
      // Resetar progresso após 2 segundos
      setTimeout(() => {
        setProgresso(0)
        setStatusImportacao('')
      }, 2000)
    } catch (error: any) {
      console.error('Erro completo na importação:', error)
      const errorMessage = error?.message || error?.toString() || 'Erro desconhecido ao importar dados da API externa'
      setProgresso(0)
      setStatusImportacao('')
      setMensagem({
        tipo: 'error',
        texto: errorMessage
      })
    } finally {
      setImportando(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Importação Manual da API Externa */}
      <Card>
        <CardHeader>
          <CardTitle>Importação da API Externa</CardTitle>
          <CardDescription>
            Consumir dados da API PHP e importar automaticamente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>URL da API Externa (PHP)</Label>
            <Input
              value={apiUrlExterna}
              onChange={(e) => setApiUrlExterna(e.target.value)}
              placeholder="https://loja.escolamorumbisul.com.br/api/importacao.php"
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              URL da API PHP que fornece os dados (método GET)
            </p>
          </div>

          <div>
            <Label>API Key da API Externa</Label>
            <Input
              type="password"
              value={apiKeyExterna}
              onChange={(e) => setApiKeyExterna(e.target.value)}
              placeholder="Bearer token para autenticação"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Token de autenticação (Bearer Token) para acessar a API externa
            </p>
          </div>

          {mensagem && (
            <div className={`p-3 rounded-md ${
              mensagem.tipo === 'success' 
                ? 'bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200' 
                : 'bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-200'
            }`}>
              {mensagem.texto}
            </div>
          )}

          {importando && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{statusImportacao}</span>
                <span className="font-medium">{progresso}%</span>
              </div>
              <Progress value={progresso} />
            </div>
          )}

          <Button 
            onClick={handleImportarDaAPIExterna}
            disabled={importando || !apiUrlExterna || !apiKeyExterna || !empresaId}
            className="w-full"
          >
            {importando ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Importar da API Externa
              </>
            )}
          </Button>

          <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-md">
            <h4 className="font-semibold mb-2">Como funciona:</h4>
            <ol className="text-sm space-y-1 list-decimal list-inside">
              <li>O sistema faz uma requisição GET para a API externa (PHP)</li>
              <li>A API externa retorna os dados no formato de importação</li>
              <li>O sistema processa e importa os dados automaticamente</li>
              <li>Um log é criado com o resultado da importação</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Documentação da API */}
      {/* Documentação da API */}
      <Card>
        <CardHeader>
          <CardTitle>API de Importação</CardTitle>
          <CardDescription>
            Endpoint para importação de dados de alunos, responsáveis e turmas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>URL do Endpoint da Sua Aplicação</Label>
            <Input
              value={apiUrl || (typeof window !== 'undefined' ? `${window.location.origin}/api/importacao` : '/api/importacao')}
              readOnly
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Esta é a URL que a API externa (PHP) deve chamar. Configure no código da API externa.
            </p>
            <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
              ⚠️ A API externa deve fazer POST para esta URL, não o contrário.
            </p>
          </div>

          <div>
            <Label>API Key</Label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Configure no .env.local como IMPORTACAO_API_KEY"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Configure a variável de ambiente IMPORTACAO_API_KEY no servidor
            </p>
          </div>

          <div className="bg-muted p-4 rounded-md">
            <h4 className="font-semibold mb-2">Formato do Payload:</h4>
            <pre className="text-xs overflow-x-auto">
{`POST /api/importacao
Content-Type: application/json
Authorization: Bearer {API_KEY}

{
  "empresa_id": "uuid-da-empresa",
  "api_key": "sua-api-key",
  "registros": [
    {
      "nomealuno": "João Silva",
      "prontuario": "12345",
      "descricaoturma": "Kindergarten 5",
      "tipocurso": "Educação Infantil",
      "situacao": "ATIVO",
      "nomerespfin": "Maria Silva",
      "cpfrespfin": "123.456.789-00",
      "emailrespfin": "maria@email.com",
      "logradourorespfin": "Rua Exemplo",
      "numerorespfin": "123",
      "bairrorespfin": "Centro",
      "cidaderespfin": "São Paulo",
      "estadorespfin": "SP",
      "ceprespfin": "01234-567",
      "celularrespfin": "(11) 98765-4321",
      "nomerespped": "Pedro Silva",
      "cpfrespped": "987.654.321-00",
      "emailrespped": "pedro@email.com",
      "logradourorespped": "Rua Exemplo",
      "numerorespped": "123",
      "bairrorespped": "Centro",
      "cidaderespped": "São Paulo",
      "estadorespped": "SP",
      "ceprespped": "01234-567",
      "celularrespped": "(11) 98765-4321"
    }
  ]
}`}
            </pre>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-md">
            <h4 className="font-semibold mb-2">Resposta de Sucesso:</h4>
            <pre className="text-xs overflow-x-auto">
{`{
  "success": true,
  "log_id": "uuid-do-log",
  "total_registros": 10,
  "registros_processados": 10,
  "registros_criados": 5,
  "registros_atualizados": 5,
  "registros_com_erro": 0
}`}
            </pre>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-950 p-4 rounded-md">
            <h4 className="font-semibold mb-2">Características:</h4>
            <ul className="text-sm space-y-1 list-disc list-inside">
              <li><strong>Idempotente:</strong> Upsert por prontuario + cpf/email do responsável</li>
              <li><strong>Logs:</strong> Todas as importações são registradas com detalhes</li>
              <li><strong>Validação:</strong> Schema Zod valida todos os campos</li>
              <li><strong>Segmento:</strong> Mapeamento automático de tipocurso para segmento</li>
              <li><strong>Responsáveis:</strong> Cria/atualiza responsável financeiro e pedagógico</li>
              <li><strong>Endereços:</strong> Cria/atualiza endereços dos responsáveis</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Histórico de Importações */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Importações</CardTitle>
          <CardDescription>
            Últimas importações realizadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Nenhuma importação realizada ainda
            </p>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => (
                <div key={log.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(log.status)}
                      <span className="font-semibold">{log.status}</span>
                      <span className="text-sm text-muted-foreground">
                        ({log.tipo})
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {formatarData(log.iniciado_em)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Total:</span>
                      <div className="font-semibold">{log.total_registros}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Processados:</span>
                      <div className="font-semibold">{log.registros_processados}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Criados:</span>
                      <div className="font-semibold text-green-600">{log.registros_criados}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Atualizados:</span>
                      <div className="font-semibold text-blue-600">{log.registros_atualizados}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Erros:</span>
                      <div className="font-semibold text-red-600">{log.registros_com_erro}</div>
                    </div>
                  </div>
                  {log.finalizado_em && (
                    <div className="text-xs text-muted-foreground mt-2">
                      Finalizado em: {formatarData(log.finalizado_em)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
