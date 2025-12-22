---
name: frontend-page
description: |
  Criar novas paginas no frontend React/TypeScript. Use quando o usuario pedir para criar pagina nova, adicionar tela, criar componente de pagina, ou implementar nova interface.
---

# Criar Paginas Frontend

Guia para criar novas paginas no frontend React + TypeScript do GestorEnergy.

## Estrutura do Frontend

```
frontend/src/
├── pages/               # Paginas por perfil
│   ├── admin/           # Paginas de admin
│   ├── gestor/          # Paginas de gestor
│   ├── proprietario/    # Paginas de proprietario
│   ├── beneficiario/    # Paginas de beneficiario
│   └── usuario/         # Paginas publicas
├── components/          # Componentes reutilizaveis
├── api/                 # Clientes API
├── contexts/            # Contextos React
├── hooks/               # Hooks customizados
└── types/               # Tipos TypeScript
```

## Criar Nova Pagina

1. Criar arquivo em `pages/{perfil}/NovaPagina.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter } from 'lucide-react';

interface Item {
  id: string;
  nome: string;
  status: string;
  created_at: string;
}

export default function NovaPagina() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState('');

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/items');
      const data = await response.json();
      setItems(data);
    } catch (err) {
      setError('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const itemsFiltrados = items.filter(item =>
    item.nome.toLowerCase().includes(filtro.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Nova Pagina
        </h1>
        <button
          onClick={() => navigate('/novo')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus size={20} />
          Adicionar
        </button>
      </div>

      {/* Filtro */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Buscar..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Lista */}
      <div className="bg-white rounded-lg shadow">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Nome</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Data</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Acoes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {itemsFiltrados.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">{item.nome}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    item.status === 'ATIVO' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {item.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {new Date(item.created_at).toLocaleDateString('pt-BR')}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => navigate(`/item/${item.id}`)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    Ver detalhes
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

2. Adicionar rota em `App.tsx`:

```tsx
import NovaPagina from './pages/gestor/NovaPagina';

// Dentro das rotas
<Route path="/nova-pagina" element={<NovaPagina />} />
```

## Padroes

### Estilizacao
- TailwindCSS para estilos
- Classes utilitarias
- Responsivo com `sm:`, `md:`, `lg:`

### Icones
- Lucide React: `import { Icon } from 'lucide-react'`

### API
- Usar clientes em `api/`: `import { faturasApi } from '../api/faturas'`

### Estado Global
- `useAuth()` - Usuario autenticado
- `usePerfil()` - Perfil atual
- `useTheme()` - Tema claro/escuro

### Componentes Comuns
- `<Button>` - Botoes
- `<Card>` - Cards
- `<Modal>` - Modais
- `<Table>` - Tabelas
- `<Badge>` - Status badges
