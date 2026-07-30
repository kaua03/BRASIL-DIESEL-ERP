from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import requests
from bs4 import BeautifulSoup
import re

app = FastAPI()

# Liberar o CORS para o seu ERP conseguir chamar esta API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Na prática, coloque aqui o link do seu sistema
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/consulta/{placa}")
def consultar_placa(placa: str):
    placa_limpa = placa.upper().replace("-", "").strip()
    url = f"https://placafipe.com/placa/{placa_limpa}"
    
    # Finge ser um navegador real para o site não nos bloquear
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
    }
    
    try:
        response = requests.get(url, headers=headers)
        if response.status_code != 200:
            return {"erro": "Placa não encontrada ou site bloqueou a requisição."}

        soup = BeautifulSoup(response.text, 'html.parser')
        
        # O site PlacaFipe costuma colocar os detalhes num parágrafo ou tabela
        # Baseado no seu print, vamos extrair o texto principal do carro
        texto_detalhes = soup.find(text=re.compile(f"placa {placa_limpa} é de um carro", re.IGNORECASE))
        
        if not texto_detalhes:
            # Alternativa: Buscar por tabelas (<td>) caso o texto mude
            tabelas = soup.find_all('td')
            # ... (aqui entraria a lógica de ler a tabela caso o texto falhe)
            return {"erro": "Estrutura do site mudou, não achei o texto."}
        
        texto_completo = texto_detalhes.parent.text
        
        # Usamos REGEX (Expressões Regulares) para "pescar" a informação no meio da frase
        # Ex de frase no seu print: "A placa RNR4I69 é de um carro GM - CHEVROLET S10 LTZ DD4A 2021 (modelo 2022) de cor Cinza..."
        
        marca_modelo = re.search(r'carro\s+(.*?)\s+\d{4}', texto_completo)
        ano = re.search(r'(\d{4})\s*\(modelo', texto_completo)
        cor = re.search(r'cor\s+([A-Za-z]+)', texto_completo)
        uf = re.search(r'\(([A-Z]{2})\)', texto_completo)

        dados = {
            "placa": placa_limpa,
            "marca_modelo": marca_modelo.group(1).strip() if marca_modelo else "",
            "ano": ano.group(1) if ano else "",
            "cor": cor.group(1).upper() if cor else "",
            "uf": uf.group(1) if uf else ""
        }

        # Opcional: Separar Marca do Modelo (ex: divide no hífen "GM - CHEVROLET S10")
        if " - " in dados["marca_modelo"]:
            partes = dados["marca_modelo"].split(" - ", 1)
            dados["marca"] = partes[0].strip()
            dados["modelo"] = partes[1].strip()
        else:
            dados["marca"] = dados["marca_modelo"].split(" ")[0]
            dados["modelo"] = dados["marca_modelo"].replace(dados["marca"], "").strip()

        return dados

    except Exception as e:
        return {"erro": str(e)}
