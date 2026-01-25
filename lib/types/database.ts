export type SegmentoTipo = 'EDUCACAO_INFANTIL' | 'FUNDAMENTAL' | 'MEDIO' | 'EFAF' | 'EFAI' | 'OUTRO'
export type ProdutoTipo = 'PRODUTO' | 'SERVICO' | 'KIT'
export type DisponibilidadeTipo = 'TODOS' | 'SEGMENTO' | 'TURMA' | 'ALUNO'
export type ResponsavelTipo = 'FINANCEIRO' | 'PEDAGOGICO' | 'AMBOS'
export type PedidoStatus = 'PENDENTE' | 'PAGO' | 'CANCELADO' | 'ESTORNADO' | 'ENTREGUE'
export type PagamentoStatus = 'PENDENTE' | 'PROCESSANDO' | 'APROVADO' | 'RECUSADO' | 'ESTORNADO'
export type PagamentoMetodo = 'PIX' | 'CARTAO'
export type NotaTipo = 'NFE' | 'NFSE'
export type NotaStatus = 'PENDENTE' | 'EMITIDA' | 'CANCELADA' | 'ERRO'

export interface ImportacaoLog {
  id: string
  empresa_id: string
  admin_id: string | null
  tipo: 'MANUAL' | 'AGENDADA' | 'API'
  status: 'EM_PROGRESSO' | 'SUCESSO' | 'ERRO' | 'PARCIAL'
  total_registros: number
  registros_processados: number
  registros_criados: number
  registros_atualizados: number
  registros_com_erro: number
  erros: any[] | null
  payload_inicial: any | null
  iniciado_em: string
  finalizado_em: string | null
  created_at: string
  updated_at: string
}

export interface Aluno {
  id: string
  empresa_id: string
  unidade_id: string | null
  turma_id: string | null
  prontuario: string
  nome: string
  situacao: string
  created_at: string
  updated_at: string
}

export interface Usuario {
  id: string
  auth_user_id: string | null
  tipo: ResponsavelTipo
  nome_financeiro: string | null
  cpf_financeiro: string | null
  email_financeiro: string | null
  celular_financeiro: string | null
  nome_pedagogico: string | null
  cpf_pedagogico: string | null
  email_pedagogico: string | null
  celular_pedagogico: string | null
  eh_admin: boolean
  nome: string | null
  empresa_id: string | null
  unidade_id: string | null
  ativo: boolean
  created_at: string
  updated_at: string
}

// Alias para compatibilidade
export type Responsavel = Usuario

export interface Turma {
  id: string
  empresa_id: string
  unidade_id: string | null
  descricao: string
  segmento: SegmentoTipo | null
  tipo_curso: string | null
  situacao: string
  created_at: string
  updated_at: string
}

export interface Produto {
  id: string
  empresa_id: string
  unidade_id: string | null
  tipo: ProdutoTipo
  nome: string
  descricao: string | null
  preco: number
  estoque: number
  compra_unica: boolean
  limite_max_compra_unica: number
  permitir_pix: boolean
  permitir_cartao: boolean
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface ProdutoDisponibilidade {
  id: string
  produto_id: string
  tipo: DisponibilidadeTipo
  segmento: SegmentoTipo | null
  turma_id: string | null
  aluno_id: string | null
  disponivel_de: string | null
  disponivel_ate: string | null
  created_at: string
}

export interface ProdutoComDisponibilidade extends Produto {
  imagem_url?: string | null
  sku?: string | null
  categoria_id?: string | null
  grupo_id?: string | null
  ordem?: number
  disponibilidades: ProdutoDisponibilidade[]
}

export interface Categoria {
  id: string
  empresa_id: string
  nome: string
  descricao: string | null
  ordem: number
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface GrupoProduto {
  id: string
  empresa_id: string
  nome: string
  descricao: string | null
  ordem: number
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface Variacao {
  id: string
  produto_id: string
  nome: string
  tipo: 'TEXTO' | 'NUMERO' | 'COR'
  obrigatorio: boolean
  ordem: number
  created_at: string
  updated_at: string
  valores?: VariacaoValor[]
}

export interface VariacaoValor {
  id: string
  variacao_id: string
  valor: string
  label: string | null
  preco_adicional: number
  estoque: number | null
  ordem: number
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface GrupoOpcional {
  id: string
  produto_id: string
  nome: string
  descricao: string | null
  obrigatorio: boolean
  min_selecoes: number
  max_selecoes: number | null
  ordem: number
  created_at: string
  updated_at: string
  opcionais?: Opcional[]
}

export interface Opcional {
  id: string
  produto_id: string
  grupo_id: string | null
  nome: string
  descricao: string | null
  preco: number
  estoque: number | null
  obrigatorio: boolean
  max_selecoes: number | null
  ordem: number
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface ProdutoCompleto extends Produto {
  categoria_id: string | null
  grupo_id: string | null
  sku: string | null
  imagem_url: string | null
  ordem: number
  categoria?: Categoria
  grupo?: GrupoProduto
  variacoes?: Variacao[]
  grupos_opcionais?: GrupoOpcional[]
  disponibilidades?: ProdutoDisponibilidade[]
}
