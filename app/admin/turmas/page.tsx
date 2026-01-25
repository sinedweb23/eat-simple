'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { listarTurmas, criarTurma, atualizarTurma, deletarTurma } from '@/app/actions/turmas'
import { listarEmpresas } from '@/app/actions/empresas'
import { listarUnidades } from '@/app/actions/empresas'
import Link from 'next/link'

interface Turma {
  id: string
  descricao: string
  segmento: string | null
  tipo_curso: string | null
  situacao: string
  empresa_id: string
  unidade_id: string | null
  empresas?: { id: string; nome: string }
  unidades?: { id: string; nome: string }
}

export default function TurmasPage() {
  const [turmas, setTurmas] = useState<Turma[]>([])
  const [empresas, setEmpresas] = useState<any[]>([])
  const [unidades, setUnidades] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Modal
  const [showModal, setShowModal] = useState(false)
  const [turmaEditando, setTurmaEditando] = useState<Turma | null>(null)
  const [turmaForm, setTurmaForm] = useState({
    descricao: '',
    segmento: 'none' as string,
    tipo_curso: '',
    situacao: 'ATIVA',
    empresa_id: '',
    unidade_id: 'none' as string,
  })

  useEffect(() => {
    carregarDados()
  }, [])

  useEffect(() => {
    if (turmaForm.empresa_id) {
      carregarUnidades(turmaForm.empresa_id)
    } else {
      setUnidades([])
    }
  }, [turmaForm.empresa_id])

  async function carregarDados() {
    try {
      setLoading(true)
      setError(null)
      const [turmasData, empresasData] = await Promise.all([
        listarTurmas(),
        listarEmpresas(),
      ])
      setTurmas(turmasData)
      setEmpresas(empresasData)
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  async function carregarUnidades(empresaId: string) {
    try {
      const dados = await listarUnidades(empresaId)
      setUnidades(dados)
    } catch (err) {
      console.error('Erro ao carregar unidades:', err)
    }
  }

  function handleNovaTurma() {
    setTurmaEditando(null)
    setTurmaForm({
      descricao: '',
      segmento: 'none',
      tipo_curso: '',
      situacao: 'ATIVA',
      empresa_id: empresas[0]?.id || '',
      unidade_id: 'none',
    })
    setShowModal(true)
  }

  function handleEditarTurma(turma: Turma) {
    setTurmaEditando(turma)
    setTurmaForm({
      descricao: turma.descricao,
      segmento: turma.segmento || 'none',
      tipo_curso: turma.tipo_curso || '',
      situacao: turma.situacao,
      empresa_id: turma.empresa_id,
      unidade_id: turma.unidade_id || 'none',
    })
    if (turma.empresa_id) {
      carregarUnidades(turma.empresa_id)
    }
    setShowModal(true)
  }

  async function handleSalvarTurma() {
    try {
      setError(null)
      const dados = {
        descricao: turmaForm.descricao,
        segmento: turmaForm.segmento === 'none' ? null : turmaForm.segmento,
        tipo_curso: turmaForm.tipo_curso || null,
        situacao: turmaForm.situacao,
        empresa_id: turmaForm.empresa_id,
        unidade_id: turmaForm.unidade_id === 'none' ? null : turmaForm.unidade_id,
      }
      
      if (turmaEditando) {
        await atualizarTurma(turmaEditando.id, dados)
      } else {
        await criarTurma(dados)
      }
      setShowModal(false)
      carregarDados()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar turma')
    }
  }

  async function handleDeletarTurma(id: string) {
    if (!confirm('Tem certeza que deseja deletar esta turma?')) return
    try {
      await deletarTurma(id)
      carregarDados()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao deletar turma')
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

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p>Carregando...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Turmas</h1>
          <p className="text-muted-foreground">
            Gerencie turmas e segmentos
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleNovaTurma}>Nova Turma</Button>
          <Link href="/admin">
            <Button variant="outline">Voltar</Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {turmas.map((turma) => (
          <Card key={turma.id}>
            <CardHeader>
              <CardTitle>{turma.descricao}</CardTitle>
              <CardDescription>
                {turma.empresas?.nome}
                {turma.unidades && ` - ${turma.unidades.nome}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <span className="text-sm text-muted-foreground">Segmento: </span>
                <span className="text-sm font-medium">{formatarSegmento(turma.segmento)}</span>
              </div>
              {turma.tipo_curso && (
                <div>
                  <span className="text-sm text-muted-foreground">Tipo: </span>
                  <span className="text-sm font-medium">{turma.tipo_curso}</span>
                </div>
              )}
              <div>
                <span className={`text-xs px-2 py-1 rounded ${
                  turma.situacao === 'ATIVA' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {turma.situacao}
                </span>
              </div>
              <div className="flex gap-2 mt-4">
                <Button size="sm" variant="outline" onClick={() => handleEditarTurma(turma)} className="flex-1">
                  Editar
                </Button>
                <Button size="sm" variant="destructive" onClick={() => handleDeletarTurma(turma.id)}>
                  Deletar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {turmas.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            Nenhuma turma cadastrada. Clique em "Nova Turma" para começar.
          </CardContent>
        </Card>
      )}

      {/* Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{turmaEditando ? 'Editar Turma' : 'Nova Turma'}</DialogTitle>
            <DialogDescription>
              Preencha os dados da turma
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="descricao">Descrição *</Label>
              <Input
                id="descricao"
                value={turmaForm.descricao}
                onChange={(e) => setTurmaForm({ ...turmaForm, descricao: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="empresa">Empresa *</Label>
              <Select
                value={turmaForm.empresa_id}
                onValueChange={(value) => setTurmaForm({ ...turmaForm, empresa_id: value, unidade_id: 'none' })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((empresa) => (
                    <SelectItem key={empresa.id} value={empresa.id}>
                      {empresa.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {turmaForm.empresa_id && (
              <div>
                <Label htmlFor="unidade">Unidade</Label>
                <Select
                  value={turmaForm.unidade_id}
                  onValueChange={(value) => setTurmaForm({ ...turmaForm, unidade_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a unidade (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem unidade</SelectItem>
                    {unidades.map((unidade) => (
                      <SelectItem key={unidade.id} value={unidade.id}>
                        {unidade.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label htmlFor="segmento">Segmento</Label>
              <Select
                value={turmaForm.segmento}
                onValueChange={(value) => setTurmaForm({ ...turmaForm, segmento: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não informado</SelectItem>
                  <SelectItem value="EDUCACAO_INFANTIL">Educação Infantil</SelectItem>
                  <SelectItem value="FUNDAMENTAL">Fundamental</SelectItem>
                  <SelectItem value="MEDIO">Médio</SelectItem>
                  <SelectItem value="OUTRO">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="tipo_curso">Tipo de Curso</Label>
              <Input
                id="tipo_curso"
                value={turmaForm.tipo_curso}
                onChange={(e) => setTurmaForm({ ...turmaForm, tipo_curso: e.target.value })}
                placeholder="Ex: Kindergarten 5"
              />
            </div>
            <div>
              <Label htmlFor="situacao">Situação</Label>
              <Select
                value={turmaForm.situacao}
                onValueChange={(value) => setTurmaForm({ ...turmaForm, situacao: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ATIVA">Ativa</SelectItem>
                  <SelectItem value="INATIVA">Inativa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSalvarTurma}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
