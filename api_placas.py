from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import cloudscraper
from bs4 import BeautifulSoup
import re

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/consulta/{placa}")
def consultar_placa(placa: str):
    placa_limpa = placa.upper().replace("-", "").strip()
    url = f"https://placafipe.com/placa/{placa_limpa}"
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
    }
    
    try:
        # A Mágica: Cloudscraper ignora o bloqueio do site
        scraper = cloudscraper.create_scraper()
        response = scraper.get(url, headers=headers)
        
        if response.status_code != 200:
            return {"erro": f"Erro {response.status_code}: Placa não encontrada ou bloqueio ativo."}

        soup = BeautifulSoup(response.text, 'html.parser')
        
        texto_detalhes = soup.find(text=re.compile(f"placa {placa_limpa} é de um carro", re.IGNORECASE))
        
        if not texto_detalhes:
            return {"erro": "Estrutura do site mudou ou placa inválida."}
        
        texto_completo = texto_detalhes.parent.text
        
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

        if " - " in dados["marca_modelo"]:
            partes = dados["marca_modelo"].split(" - ", 1)
            dados["marca"] = partes[0].strip()
            dados["modelo"] = partes[1].strip()
        else:
            dados["marca"] = dados["marca_modelo"].split(" ")[0] if dados["marca_modelo"] else ""
            dados["modelo"] = dados["marca_modelo"].replace(dados["marca"], "").strip() if dados["marca_modelo"] else ""

        return dados

    except Exception as e:
        return {"erro": str(e)}
