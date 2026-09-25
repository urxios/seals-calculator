# DMO Wiki — Calculadora de Selos estática

Versão para GitHub Pages da página original de selos. O layout, as abas, os cards e o fluxo visual vêm diretamente do projeto original; apenas a camada de servidor foi substituída por armazenamento local no navegador.

## O que funciona sem servidor

- catálogo com 300 tipos de selo e seus 1.800 níveis;
- calculadora exata por custo, selos ou openers;
- perfis de jogo e servidores LA, NA e KDMO;
- aba **Meus Selos**, quantidades e preços pessoais;
- filtros, busca, tema, visual simplificado e ocultação de selos completos;
- exportação e importação de backup completo, além do PDF escuro de Meus Selos;
- funcionamento offline após o primeiro acesso.

Os dados ficam em `localStorage`. O botão **Exportar**, no painel lateral, baixa perfis, inventários, preços, bloqueios, preferências e uma cópia do catálogo de selos. O nome do arquivo identifica o perfil selecionado e quantos tipos diferentes de selos ele possui no servidor atual, por exemplo `JOGADOR1-258-SELOS.json`; não soma as unidades. Ao importar, escolha combinar ou substituir. Antes de restaurar, o site baixa automaticamente uma cópia de segurança do estado atual.

Recursos que dependiam do servidor, como login, e-mail, administração central e OCR, não fazem parte desta versão estática. Os PDFs de Meus Selos e do plano são gerados no próprio navegador, sem impressão da página.

## Testar

Requer Node.js 20 ou superior.

```bash
npm install
npm test
npm run check
```

Para abrir localmente, você pode dar duplo clique em `index.html`. Para testar nas mesmas condições do GitHub Pages, use:

```bash
npm start
```

O catálogo completo está em `assets/catalog.js`, portanto a página também funciona diretamente por `file://`, sem servidor.

No projeto original, selecione um perfil na aba **Meus Selos** e clique em **Exportar perfil**. O JSON contém os selos e preços desse perfil em todos os servidores e pode ser carregado aqui pelo botão **Importar**. Selos adicionados ao catálogo original também são incluídos. Esse intercâmbio é somente de dados de selos; Digimons e demais dados da conta original não fazem parte do arquivo.

Os dados de cada selo ficam em `data/seals.json`. Depois de alterar esse arquivo, rode `npm run build:catalog`; isso gera o JavaScript estático que o navegador consegue carregar tanto no GitHub Pages quanto por duplo clique.
Para um selo novo, preencha também `createdAt` com a data e hora de cadastro em UTC (por exemplo, `2026-09-21T18:30:00Z`); ela aparece discretamente no card, com o horário convertido para UTC-3 ao passar o mouse.
