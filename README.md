# NerdLab — Loja 3D estática

Site 100% estático (HTML + CSS + JS puro) para a loja NerdLab, pronto para publicar no GitHub Pages. O catálogo é lido automaticamente de uma planilha do Google Sheets — sem backend, sem banco de dados.

```
/
├── index.html
├── style.css
├── script.js
├── README.md
└── assets/
    └── logo.png
```

---

## 1. Antes de publicar: configure a planilha do Google Sheets

O site lê os produtos direto da sua planilha, convertida para CSV. Para isso ela precisa estar **pública para leitura**:

1. Abra sua planilha: `https://docs.google.com/spreadsheets/d/1Cx63e7xOVnNJjTV_JCnW8Xqe18MfdpvxI3AuRwU7DAI/edit`
2. Clique em **Compartilhar** (canto superior direito).
3. Em "Acesso geral", mude para **"Qualquer pessoa com o link"** → papel **Leitor**.
4. Confirme que a primeira aba (a que aparece quando você abre a planilha) contém as colunas, exatamente nesta ordem de nomes (não precisa ser a mesma ordem de colunas, só os nomes do cabeçalho):

   ```
   ID | NOME_PRODUTO | CATEGORIA | DESCRICAO | PRECO | IMAGEM | DESTAQUE | ESTOQUE | STATUS
   ```

   - **PRECO**: pode usar `49,90` ou `49.90` — o site formata sozinho como R$.
   - **DESTAQUE**: escreva `SIM` para o produto aparecer com a etiqueta "Destaque" e subir para o topo do catálogo. Qualquer outro valor (ou vazio) é tratado como não destaque.
   - **ESTOQUE**: número. `0` mostra "Sob encomenda"; de `1` a `3` mostra "Últimas X un."; acima disso não mostra nada.
   - **STATUS**: escreva `ativo` para o produto aparecer na loja. Se escrever `inativo`, `pausado`, `oculto` ou `desativado`, o produto some do site automaticamente (sem precisar apagar a linha).
   - **IMAGEM**: cole o link de compartilhamento do Google Drive (veja o passo 2).

5. **Se você usa outra aba** que não seja a primeira: clique na aba desejada, olhe a URL — ela vai terminar em algo como `#gid=1234567`. Copie esse número e cole no arquivo `script.js`, na linha:

   ```js
   SHEET_GID: '0', // troque '0' pelo número copiado
   ```

Pronto — sempre que você editar a planilha (adicionar produto, mudar preço, tirar de estoque), o site atualiza sozinho no próximo carregamento da página. Não precisa reenviar nenhum arquivo.

---

## 2. Como colocar as imagens (Google Drive)

1. Suba as fotos dos produtos nesta pasta do Drive:
   `https://drive.google.com/drive/folders/1-LOLB0Hcmo0pbcSyYJolA7tsSmNWgeGJ`
2. Clique com o botão direito na imagem → **Compartilhar** → **"Qualquer pessoa com o link"** → **Leitor**. (Isso precisa ser feito para cada imagem, ou selecione todas de uma vez e compartilhe em lote.)
3. Clique com o botão direito → **Copiar link**. Vai vir algo como:
   ```
   https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz1234/view?usp=sharing
   ```
4. Cole esse link exatamente assim, sem editar, na coluna **IMAGEM** da planilha, na linha do produto correspondente.

O `script.js` já converte automaticamente esse link em uma URL de imagem exibível — você não precisa fazer nada além de colar o link de compartilhamento.

Se uma imagem não carregar (arquivo não público, link errado, etc.), o card mostra um espaço reservado com "imagem indisponível" no lugar, sem quebrar o layout.

---

## 3. Publicar no GitHub Pages

1. **Crie um repositório novo** no GitHub (pode ser público ou privado — GitHub Pages funciona nos dois em contas com Pages habilitado; em contas gratuitas normalmente precisa ser público).
2. **Envie os arquivos** deste projeto (`index.html`, `style.css`, `script.js`, a pasta `assets/` com o `logo.png`) para a raiz do repositório. Pode ser:
   - pelo site do GitHub, usando "Add file → Upload files", ou
   - por linha de comando:
     ```bash
     git init
     git add .
     git commit -m "Loja NerdLab"
     git branch -M main
     git remote add origin https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git
     git push -u origin main
     ```
3. **Ative o GitHub Pages**:
   - No repositório, vá em **Settings → Pages**.
   - Em "Build and deployment" → "Source", selecione **Deploy from a branch**.
   - Em "Branch", selecione `main` e a pasta `/ (root)`.
   - Clique em **Save**.
4. Aguarde 1–2 minutos. O GitHub vai mostrar o link do site publicado, algo como:
   ```
   https://SEU-USUARIO.github.io/SEU-REPOSITORIO/
   ```
5. Abra o link — sua loja está no ar. 🎉

Não é preciso nenhuma configuração adicional: não há build step, não há dependências para instalar, o site funciona abrindo o `index.html` diretamente.

---

## 4. Trocar o número de WhatsApp

O número já está configurado como `5521978721561`. Para trocar, edite o topo do `script.js`:

```js
const CONFIG = {
  ...
  WHATSAPP_NUMBER: '55DDXXXXXXXXX', // código do país + DDD + número, só dígitos
};
```

Cada produto tem seu próprio botão "Comprar", que abre o WhatsApp já com a mensagem:
`"Olá, tenho interesse no produto [NOME DO PRODUTO] da NerdLab."`

---

## 5. Categorias de filtro

Os filtros fixos no site são: `Gamer`, `Geek`, `Harry Potter`, `Hollow Knight`, `Suportes`, `Decoração`, `Personalizados`. Preencha a coluna **CATEGORIA** da planilha com um desses nomes (não precisa bater letra por letra — o filtro ignora maiúsculas/minúsculas e acentos) para o produto aparecer no filtro correto.

Se quiser adicionar ou remover categorias do menu de filtros, edite a lista de botões `.chip` dentro de `index.html`, na seção `<div class="filters">`.

---

## 6. Testar localmente antes de publicar

Como o site faz `fetch()` na planilha, alguns navegadores bloqueiam esse tipo de requisição se você só abrir o `index.html` clicando duas vezes (protocolo `file://`). Para testar localmente do jeito certo, rode um servidor simples na pasta do projeto:

```bash
# Python 3
python3 -m http.server 8000
```

Depois abra `http://localhost:8000` no navegador. No GitHub Pages isso não é um problema, pois o site já é servido via `https://`.
