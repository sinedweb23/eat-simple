'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { listarAlunos, obterAlunoDetalhes, buscarAlunos } from '@/app/actions/alunos'
import Link from 'next/link'

interface Aluno {
  id: string
  prontuario: string
  nome: string
  situacao: string
  turma_id: string | null
  turmas?: {
    id: string
    descricao: string
    segmento: string | null
    tipo_curso: string | null
    situacao: string
  } | null
  empresas?: {
    id: string
    nome: string
  } | null
  unidades?: {
    id: string
    nome: string
  } | null
}

interface Responsavel {
  id: string
  usuario_id: string
  usuarios: {
    id: string
    tipo: string
    nome_financeiro: string | null
    cpf_financeiro: string | null
    email_financeiro: string | null
    celular_financeiro: string | null
    nome_pedagogico: string | null
    cpf_pedagogico: string | null
    email_pedagogico: string | null
    celular_pedagogico: string | null
    ativo: boolean
  }
}

export default function AlunosPage() {
  const [alunos, setAlunos] = useState<Aluno[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Filtros
  const [filtroNome, setFiltroNome] = useState('')
  const [filtroProntuario, setFiltroProntuario] = useState('')
  const [buscando, setBuscando] = useState(false)

  // Modal de detalhes
  const [alunoSelecionado, setAlunoSelecionado] = useState<Aluno | null>(null)
  const [detalhes, setDetalhes] = useState<{
    aluno: any
    responsaveis: Responsavel[]
  } | null>(null)
  const [carregandoDetalhes, setCarregandoDetalhes] = useState(false)
  const [modalAberto, setModalAberto] = useState(false)

  useEffect(() => {
    carregarAlunos()
  }, [])

  async function carregarAlunos() {
    try {
      setLoading(true)
      setError(null)
      const dados = await listarAlunos()
      setAlunos(dados)
    } catch (err) {
      console.error('Erro ao carregar alunos:', err)
      setError(err instanceof Error ? err.message : 'Erro ao carregar alunos')
    } finally {
      setLoading(false)
    }
  }

  async function handleBuscar() {
    try {
      setBuscando(true)
      setError(null)
      
      const filtros: any = {}
      if (filtroNome.trim()) filtros.nome = filtroNome.trim()
      if (filtroProntuario.trim()) filtros.prontuario = filtroProntuario.trim()

      const dados = Object.keys(filtros).length > 0 
        ? await buscarAlunos(filtros)
        : await listarAlunos()
      
      setAlunos(dados)
    } catch (err) {
      console.error('Erro ao buscar alunos:', err)
      setError(err instanceof Error ? err.message : 'Erro ao buscar alunos')
    } finally {
      setBuscando(false)
    }
  }

  async function handleAbrirDetalhes(aluno: Aluno) {
    try {
      setAlunoSelecionado(aluno)
      setModalAberto(true)
      setCarregandoDetalhes(true)
      setDetalhes(null)

      const dados = await obterAlunoDetalhes(aluno.id)
      setDetalhes(dados)
    } catch (err) {
      console.error('Erro ao carregar detalhes:', err)
      setError(err instanceof Error ? err.message : 'Erro ao carregar detalhes')
    } finally {
      setCarregandoDetalhes(false)
    }
  }

  function formatarSegmento(segmento: string | null) {
    if (!segmento) return 'Não informado'
    const map: Record<string, string> = {
      EDUCACAO_INFANTIL: 'Educação Infantil',
      FUNDAMENTAL: 'Fundamental',
      MEDIO: 'Médio',
      OUTRO: 'Outro',
    }
    return map[segmento] || segmento
  }

  function formatarTipoResponsavel(tipo: string) {
    const map: Record<string, string> = {
      FINANCEIRO: 'Financeiro',
      PEDAGOGICO: 'Pedagógico',
      AMBOS: 'Financeiro e Pedagógico',
    }
    return map[tipo] || tipo
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p>Carregando alunos...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Alunos</h1>
          <p className="text-muted-foreground">
            Lista de todos os alunos cadastrados
          </p>
        </div>
        <Link href="/admin">
          <Button variant="outline">Voltar</Button>
        </Link>
      </div>

      {/* Filtros */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Buscar Alunos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="filtro-nome">Nome</Label>
              <Input
                id="filtro-nome"
                value={filtroNome}
                onChange={(e) => setFiltroNome(e.target.value)}
                placeholder="Digite o nome..."
                onKeyDown={(e) => e.key === 'Enter' && handleBuscar()}
              />
            </div>
            <div>
              <Label htmlFor="filtro-prontuario">Prontuário</Label>
              <Input
                id="filtro-prontuario"
                value={filtroProntuario}
                onChange={(e) => setFiltroProntuario(e.target.value)}
                placeholder="Digite o prontuário..."
                onKeyDown={(e) => e.key === 'Enter' && handleBuscar()}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={handleBuscar} disabled={buscando} className="flex-1">
                {buscando ? 'Buscando...' : 'Buscar'}
              </Button>
              <Button variant="outline" onClick={carregarAlunos}>
                Limpar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md">
          {error}
        </div>
      )}

      {/* Lista de Alunos */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Alunos ({alunos.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {alunos.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum aluno encontrado
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Prontuário</th>
                    <th className="text-left p-2">Nome</th>
                    <th className="text-left p-2">Turma</th>
                    <th className="text-left p-2">Série/Segmento</th>
                    <th className="text-left p-2">Situação</th>
                    <th className="text-left p-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {alunos.map((aluno) => (
                    <tr key={aluno.id} className="border-b hover:bg-muted/50">
                      <td className="p-2">{aluno.prontuario}</td>
                      <td className="p-2 font-medium">{aluno.nome}</td>
                      <td className="p-2">
                        {aluno.turmas?.descricao || 'Sem turma'}
                      </td>
                      <td className="p-2">
                        {formatarSegmento(aluno.turmas?.segmento || null)}
                      </td>
                      <td className="p-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          aluno.situacao === 'ATIVO' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {aluno.situacao}
                        </span>
                      </td>
                      <td className="p-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAbrirDetalhes(aluno)}
                        >
                          Ver Detalhes
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Detalhes */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Detalhes do Aluno: {alunoSelecionado?.nome}
            </DialogTitle>
            <DialogDescription>
              Prontuário: {alunoSelecionado?.prontuario}
            </DialogDescription>
          </DialogHeader>

          {carregandoDetalhes ? (
            <div className="py-8 text-center">
              <p>Carregando detalhes...</p>
            </div>
          ) : detalhes ? (
            <div className="space-y-6">
              {/* Informações do Aluno */}
              <Card>
                <CardHeader>
                  <CardTitle>Informações do Aluno</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Nome</Label>
                      <p className="font-medium">{detalhes.aluno.nome}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Prontuário</Label>
                      <p className="font-medium">{detalhes.aluno.prontuario}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Situação</Label>
                      <p className="font-medium">{detalhes.aluno.situacao}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Empresa</Label>
                      <p className="font-medium">
                        {detalhes.aluno.empresas?.nome || 'Não informado'}
                      </p>
                    </div>
                    {detalhes.aluno.unidades && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Unidade</Label>
                        <p className="font-medium">{detalhes.aluno.unidades.nome}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Turma e Série */}
              {detalhes.aluno.turmas && (
                <Card>
                  <CardHeader>
                    <CardTitle>Turma e Série</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Turma</Label>
                        <p className="font-medium">{detalhes.aluno.turmas.descricao}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Segmento/Série</Label>
                        <p className="font-medium">
                          {formatarSegmento(detalhes.aluno.turmas.segmento)}
                        </p>
                      </div>
                      {detalhes.aluno.turmas.tipo_curso && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Tipo de Curso</Label>
                          <p className="font-medium">{detalhes.aluno.turmas.tipo_curso}</p>
                        </div>
                      )}
                      <div>
                        <Label className="text-xs text-muted-foreground">Situação da Turma</Label>
                        <p className="font-medium">{detalhes.aluno.turmas.situacao}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Responsáveis */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    Responsáveis ({detalhes.responsaveis.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {detalhes.responsaveis.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                      Nenhum responsável vinculado
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {detalhes.responsaveis.map((relacao) => {
                        const resp = relacao.usuarios
                        return (
                          <div
                            key={relacao.id}
                            className="border rounded-lg p-4 space-y-3"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-semibold">
                                  {formatarTipoResponsavel(resp.tipo)}
                                </h4>
                                {!resp.ativo && (
                                  <span className="text-xs text-destructive">
                                    (Inativo)
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Dados Financeiros */}
                            {(resp.tipo === 'FINANCEIRO' || resp.tipo === 'AMBOS') && (
                              <div className="space-y-2">
                                <h5 className="text-sm font-medium text-muted-foreground">
                                  Dados Financeiros:
                                </h5>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  {resp.nome_financeiro && (
                                    <div>
                                      <span className="text-muted-foreground">Nome: </span>
                                      <span>{resp.nome_financeiro}</span>
                                    </div>
                                  )}
                                  {resp.cpf_financeiro && (
                                    <div>
                                      <span className="text-muted-foreground">CPF: </span>
                                      <span>{resp.cpf_financeiro}</span>
                                    </div>
                                  )}
                                  {resp.email_financeiro && (
                                    <div>
                                      <span className="text-muted-foreground">Email: </span>
                                      <span>{resp.email_financeiro}</span>
                                    </div>
                                  )}
                                  {resp.celular_financeiro && (
                                    <div>
                                      <span className="text-muted-foreground">Celular: </span>
                                      <span>{resp.celular_financeiro}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Dados Pedagógicos */}
                            {(resp.tipo === 'PEDAGOGICO' || resp.tipo === 'AMBOS') && (
                              <div className="space-y-2">
                                <h5 className="text-sm font-medium text-muted-foreground">
                                  Dados Pedagógicos:
                                </h5>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  {resp.nome_pedagogico && (
                                    <div>
                                      <span className="text-muted-foreground">Nome: </span>
                                      <span>{resp.nome_pedagogico}</span>
                                    </div>
                                  )}
                                  {resp.cpf_pedagogico && (
                                    <div>
                                      <span className="text-muted-foreground">CPF: </span>
                                      <span>{resp.cpf_pedagogico}</span>
                                    </div>
                                  )}
                                  {resp.email_pedagogico && (
                                    <div>
                                      <span className="text-muted-foreground">Email: </span>
                                      <span>{resp.email_pedagogico}</span>
                                    </div>
                                  )}
                                  {resp.celular_pedagogico && (
                                    <div>
                                      <span className="text-muted-foreground">Celular: </span>
                                      <span>{resp.celular_pedagogico}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              Erro ao carregar detalhes
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
