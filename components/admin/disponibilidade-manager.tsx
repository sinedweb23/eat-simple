'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { listarTurmas, listarAlunos, criarDisponibilidade, deletarDisponibilidade } from '@/app/actions/produtos-admin'
import type { ProdutoDisponibilidade, Turma, Aluno } from '@/lib/types/database'
import type { SegmentoTipo } from '@/lib/types/database'

interface DisponibilidadeManagerProps {
  produtoId?: string
  empresaId: string
  disponibilidades: ProdutoDisponibilidade[]
}

export function DisponibilidadeManager({ produtoId, empresaId, disponibilidades: disponibilidadesIniciais }: DisponibilidadeManagerProps) {
  const [disponibilidades, setDisponibilidades] = useState<ProdutoDisponibilidade[]>(disponibilidadesIniciais)
  const [turmas, setTurmas] = useState<Turma[]>([])
  const [alunos, setAlunos] = useState<Aluno[]>([])
  const [loading, setLoading] = useState(false)
  const [novaDisponibilidade, setNovaDisponibilidade] = useState({
    tipo: 'TODOS' as 'TODOS' | 'SEGMENTO' | 'TURMA' | 'ALUNO',
    segmento: '' as SegmentoTipo | '',
    turma_id: '',
    aluno_id: '',
    disponivel_de: '',
    disponivel_ate: '',
  })

  useEffect(() => {
    if (empresaId) {
      carregarDados()
    }
  }, [empresaId])

  async function carregarDados() {
    try {
      const [turmasData, alunosData] = await Promise.all([
        listarTurmas(empresaId),
        listarAlunos(empresaId),
      ])
      setTurmas(turmasData as Turma[])
      setAlunos(alunosData as Aluno[])
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
    }
  }

  async function handleAdicionar() {
    if (!produtoId) {
      alert('Salve o produto primeiro antes de adicionar disponibilidade')
      return
    }

    if (novaDisponibilidade.tipo === 'SEGMENTO' && !novaDisponibilidade.segmento) {
      alert('Selecione um segmento')
      return
    }
    if (novaDisponibilidade.tipo === 'TURMA' && !novaDisponibilidade.turma_id) {
      alert('Selecione uma turma')
      return
    }
    if (novaDisponibilidade.tipo === 'ALUNO' && !novaDisponibilidade.aluno_id) {
      alert('Selecione um aluno')
      return
    }

    setLoading(true)
    try {
      const nova = await criarDisponibilidade(produtoId, {
        tipo: novaDisponibilidade.tipo,
        segmento: novaDisponibilidade.segmento || undefined,
        turma_id: novaDisponibilidade.turma_id || undefined,
        aluno_id: novaDisponibilidade.aluno_id || undefined,
        disponivel_de: novaDisponibilidade.disponivel_de || undefined,
        disponivel_ate: novaDisponibilidade.disponivel_ate || undefined,
      })
      setDisponibilidades([...disponibilidades, nova as ProdutoDisponibilidade])
      setNovaDisponibilidade({
        tipo: 'TODOS',
        segmento: '',
        turma_id: '',
        aluno_id: '',
        disponivel_de: '',
        disponivel_ate: '',
      })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao criar disponibilidade')
    } finally {
      setLoading(false)
    }
  }

  async function handleRemover(id: string) {
    if (!confirm('Tem certeza que deseja remover esta disponibilidade?')) return

    setLoading(true)
    try {
      await deletarDisponibilidade(id)
      setDisponibilidades(disponibilidades.filter(d => d.id !== id))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao remover disponibilidade')
    } finally {
      setLoading(false)
    }
  }

  function formatarTipo(tipo: string) {
    const tipos: Record<string, string> = {
      TODOS: 'Todos',
      SEGMENTO: 'Segmento',
      TURMA: 'Turma',
      ALUNO: 'Aluno',
    }
    return tipos[tipo] || tipo
  }

  function formatarSegmento(segmento: string | null) {
    if (!segmento) return ''
    const segmentos: Record<string, string> = {
      EDUCACAO_INFANTIL: 'Educação Infantil',
      FUNDAMENTAL: 'Fundamental',
      MEDIO: 'Médio',
      OUTRO: 'Outro',
    }
    return segmentos[segmento] || segmento
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Nova Disponibilidade</CardTitle>
          <CardDescription>
            Configure para quem este produto estará disponível
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Tipo de Disponibilidade *</Label>
            <Select 
              value={novaDisponibilidade.tipo || 'TODOS'} 
              onValueChange={(v: any) => setNovaDisponibilidade({ ...novaDisponibilidade, tipo: v, segmento: '', turma_id: '', aluno_id: '' })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todos</SelectItem>
                <SelectItem value="SEGMENTO">Segmento</SelectItem>
                <SelectItem value="TURMA">Turma</SelectItem>
                <SelectItem value="ALUNO">Aluno</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {novaDisponibilidade.tipo === 'SEGMENTO' && (
            <div>
              <Label>Segmento *</Label>
              <Select 
                value={novaDisponibilidade.segmento || ''} 
                onValueChange={(v: any) => setNovaDisponibilidade({ ...novaDisponibilidade, segmento: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um segmento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EDUCACAO_INFANTIL">Educação Infantil</SelectItem>
                  <SelectItem value="FUNDAMENTAL">Fundamental</SelectItem>
                  <SelectItem value="MEDIO">Médio</SelectItem>
                  <SelectItem value="OUTRO">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {novaDisponibilidade.tipo === 'TURMA' && (
            <div>
              <Label>Turma *</Label>
              <Select 
                value={novaDisponibilidade.turma_id || ''} 
                onValueChange={(v) => setNovaDisponibilidade({ ...novaDisponibilidade, turma_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma turma" />
                </SelectTrigger>
                <SelectContent>
                  {turmas.map(turma => (
                    <SelectItem key={turma.id} value={turma.id}>{turma.descricao}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {novaDisponibilidade.tipo === 'ALUNO' && (
            <div>
              <Label>Aluno *</Label>
              <Select 
                value={novaDisponibilidade.aluno_id || ''} 
                onValueChange={(v) => setNovaDisponibilidade({ ...novaDisponibilidade, aluno_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um aluno" />
                </SelectTrigger>
                <SelectContent>
                  {alunos.map(aluno => (
                    <SelectItem key={aluno.id} value={aluno.id}>{aluno.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Disponível de</Label>
              <Input
                type="datetime-local"
                value={novaDisponibilidade.disponivel_de}
                onChange={(e) => setNovaDisponibilidade({ ...novaDisponibilidade, disponivel_de: e.target.value })}
              />
            </div>
            <div>
              <Label>Disponível até</Label>
              <Input
                type="datetime-local"
                value={novaDisponibilidade.disponivel_ate}
                onChange={(e) => setNovaDisponibilidade({ ...novaDisponibilidade, disponivel_ate: e.target.value })}
              />
            </div>
          </div>

          <Button 
            type="button" 
            onClick={handleAdicionar} 
            disabled={loading || !produtoId || (novaDisponibilidade.tipo === 'SEGMENTO' && !novaDisponibilidade.segmento) || (novaDisponibilidade.tipo === 'TURMA' && !novaDisponibilidade.turma_id) || (novaDisponibilidade.tipo === 'ALUNO' && !novaDisponibilidade.aluno_id)}
          >
            Adicionar Disponibilidade
          </Button>
        </CardContent>
      </Card>

      {/* Lista de disponibilidades */}
      <div className="space-y-2">
        {disponibilidades.map((disp) => (
          <Card key={disp.id}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="font-medium">{formatarTipo(disp.tipo)}</div>
                  {disp.tipo === 'SEGMENTO' && disp.segmento && (
                    <div className="text-sm text-muted-foreground">{formatarSegmento(disp.segmento)}</div>
                  )}
                  {disp.tipo === 'TURMA' && (
                    <div className="text-sm text-muted-foreground">
                      {turmas.find(t => t.id === disp.turma_id)?.descricao || 'Turma não encontrada'}
                    </div>
                  )}
                  {disp.tipo === 'ALUNO' && (
                    <div className="text-sm text-muted-foreground">
                      {alunos.find(a => a.id === disp.aluno_id)?.nome || 'Aluno não encontrado'}
                    </div>
                  )}
                  {(disp.disponivel_de || disp.disponivel_ate) && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {disp.disponivel_de && `De: ${new Date(disp.disponivel_de).toLocaleDateString('pt-BR')}`}
                      {disp.disponivel_de && disp.disponivel_ate && ' • '}
                      {disp.disponivel_ate && `Até: ${new Date(disp.disponivel_ate).toLocaleDateString('pt-BR')}`}
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => handleRemover(disp.id)}
                  disabled={loading}
                >
                  Remover
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {disponibilidades.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            Nenhuma disponibilidade configurada. O produto estará disponível para todos por padrão.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
