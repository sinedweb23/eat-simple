/**
 * Utilitários para gerenciar carrinho no localStorage
 */

export interface ItemCarrinho {
  produto: {
    id: string
    nome: string
    preco: number
    tipo: string
    descricao?: string | null
    imagem_url?: string | null
  }
  alunoId: string
  alunoNome: string
  quantidade: number
}

const CARRINHO_KEY = 'loja_carrinho'

export function salvarCarrinho(carrinho: ItemCarrinho[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(CARRINHO_KEY, JSON.stringify(carrinho))
  }
}

export function carregarCarrinho(): ItemCarrinho[] {
  if (typeof window === 'undefined') return []
  
  try {
    const carrinhoStr = localStorage.getItem(CARRINHO_KEY)
    if (!carrinhoStr) return []
    return JSON.parse(carrinhoStr)
  } catch {
    return []
  }
}

export function limparCarrinho() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(CARRINHO_KEY)
  }
}

export function contarItensCarrinho(): number {
  const carrinho = carregarCarrinho()
  return carrinho.reduce((total, item) => total + item.quantidade, 0)
}
