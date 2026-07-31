// JS/modules/dashboard.js
import { supabase } from './config.js';

window.graficosAbertos = {};
window.mapaClientes = null;
window.dadosContextoIA = {};

// ==========================================================
// 1. GESTÃO DE DATAS
// ==========================================================
window.inicializarDatas = function() {
    const inputIni = document.getElementById('dash-data-ini');
    const inputFim = document.getElementById('dash-data-fim');
    if (!inputIni.value) {
        const hoje = new Date();
        const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        inputIni.value = primeiroDia.toISOString().split('T')[0];
        inputFim.value = hoje.toISOString().split('T')[0];
    }
};

window.carregarDashboard = async function() {
    window.inicializarDatas();
    const dataIniStr = document.getElementById('dash-data-ini').value;
    const dataFimStr = document.getElementById('dash-data-fim').value;
    
    setTimeout(async () => {
        try {
            // BUSCA MASSIVA NO BANCO
            const [receitasReq, despesasReq, osReq, clientesReq, logsReq] = await Promise.all([
                supabase.from('contas_receber').select('*'),
                supabase.from('contas_pagar').select('*'),
                supabase.from('ordens_servico').select('*, itens_orcamento(*)'),
                supabase.from('clientes').select('*'), // CORREÇÃO DO ERRO 400 (MAPA)
                supabase.from('auditoria_logs').select('*')
            ]);

            const ordens = osReq.data || [];
            let lucroMensal = 0, recebido = 0, atrasado = 0, aPagar = 0, despesaPaga = 0;
            let osNoPeriodo = 0, valorTotalOs = 0;
            
            let contagemStatus = {};
            let patioAtivos = [];
            let prodEquipe = {};

            // 1. Financeiro (Filtro por Data)
            (receitasReq.data || []).forEach(c => {
                const d = c.data_vencimento || c.created_at;
                const apenasData = d ? d.substring(0, 10) : '';
                if (apenasData >= dataIniStr && apenasData <= dataFimStr) {
                    const v = Number(c.valor || 0);
                    if (c.status === 'Pago') recebido += v; else atrasado += v;
                }
            });

            (despesasReq.data || []).forEach(c => {
                const d = c.data_vencimento || c.created_at;
                const apenasData = d ? d.substring(0, 10) : '';
                if (apenasData >= dataIniStr && apenasData <= dataFimStr) {
                    const v = Number(c.valor || 0);
                    aPagar += v;
                    if (c.status === 'Pago') despesaPaga += v;
                }
            });

            lucroMensal = recebido - despesaPaga;

            // 2. O.S. e Veículos no Pátio
            ordens.forEach(os => {
                // A. Alimentar a Tabela do Pátio e o Gráfico de Pizza (Todas as Ativas)
                if (os.status !== 'Finalizada' && os.status !== 'Entregue' && os.status !== 'Cancelada') {
                    patioAtivos.push({ os: String(os.numero_os || os.id).padStart(4, '0'), placa: os.placa || 'N/A', status: os.status });
                    contagemStatus[os.status] = (contagemStatus[os.status] || 0) + 1;
                }

                // B. Filtrar para os KPIs (Período exato)
                const d = os.data_entrada || os.created_at;
                const apenasData = d ? d.substring(0, 10) : '';
                if (apenasData >= dataIniStr && apenasData <= dataFimStr) {
                    osNoPeriodo++;
                    (os.itens_orcamento || []).forEach(item => {
                        valorTotalOs += Number(item.valor_total || 0);
                    });
                }
            });

            // 3. Produtividade da Equipe (Logs do Período)
            (logsReq.data || []).forEach(log => {
                const apenasData = log.created_at ? log.created_at.substring(0, 10) : '';
                if (apenasData >= dataIniStr && apenasData <= dataFimStr) {
                    if (log.modulo === 'Pátio' && log.acao.includes('Checklist')) {
                        const nome = String(log.usuario).toUpperCase().split(' ')[0];
                        prodEquipe[nome] = (prodEquipe[nome] || 0) + 1;
                    }
                }
            });

            // ==========================================
            // ATUALIZAR ZONA 1 (KPIs)
            // ==========================================
            const formatMoeda = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
            document.getElementById('kpi-lucro').innerText = formatMoeda(lucroMensal);
            document.getElementById('kpi-lucro').className = `text-3xl font-black ${lucroMensal >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`;
            document.getElementById('kpi-receber').innerText = formatMoeda(atrasado);
            document.getElementById('kpi-pagar').innerText = formatMoeda(aPagar);
            document.getElementById('kpi-ticket').innerText = formatMoeda(osNoPeriodo > 0 ? (valorTotalOs / osNoPeriodo) : 0);
            document.getElementById('kpi-vol-os').innerText = `${osNoPeriodo} O.S. no Período`;

            // ==========================================
            // ATUALIZAR ZONA 2 (Listas)
            // ==========================================
            const objParaArraySort = (obj) => Object.entries(obj).sort((a,b) => b[1] - a[1]);
            
            // Lista do Pátio
            const ulPatio = document.getElementById('lista-patio-ativos');
            ulPatio.innerHTML = patioAtivos.length ? patioAtivos.map(p => `
                <li class="flex justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
                    <div>
                        <span class="text-[#1a428a] dark:text-[#3b82f6] font-black">#${p.os}</span> 
                        <span class="text-xs uppercase ml-1">${p.placa}</span>
                    </div>
                    <span class="text-[9px] px-2 py-0.5 rounded bg-orange-100 text-orange-700 uppercase font-black">${p.status}</span>
                </li>`).join('') : '<li class="text-xs text-gray-400">Pátio limpo e vazio.</li>';

            // Ranking Equipe
            const topEq = objParaArraySort(prodEquipe).slice(0, 5);
            const ulEq = document.getElementById('lista-top-equipe');
            ulEq.innerHTML = topEq.length ? topEq.map(e => `
                <li class="flex justify-between border-b border-gray-100 dark:border-gray-800 pb-2 items-center">
                    <span class="uppercase font-bold">${e[0]}</span> 
                    <span class="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-black">${e[1]} Ações</span>
                </li>`).join('') : '<li class="text-xs text-gray-400">Sem ações registradas no período.</li>';

            // GRÁFICOS E MAPAS
            window.desenharGraficos(recebido, despesaPaga, contagemStatus);
            if (typeof L !== 'undefined') window.desenharMapa(clientesReq.data || []);

            // Salva Contexto Puro para a IA Real
            window.dadosContextoIA = { 
                periodo: `${dataIniStr} até ${dataFimStr}`,
                financeiro: { lucro: lucroMensal, aReceberRisco: atrasado, aPagar: aPagar }, 
                operacao: { osFeitas: osNoPeriodo, ticketMedio: (osNoPeriodo > 0 ? valorTotalOs / osNoPeriodo : 0), carrosNoPatio: patioAtivos.length },
                produtividade: topEq 
            };

        } catch (e) { console.error("Erro Dashboard:", e); }
    }, 200); 
};

// ==========================================================
// 2. GRÁFICOS (Chart.js)
// ==========================================================
window.desenharGraficos = function(rec, des, stObj) {
    if (typeof Chart === 'undefined') return;

    const txtCor = document.documentElement.classList.contains('dark') ? '#9ca3af' : '#4b5563';
    const gridCor = document.documentElement.classList.contains('dark') ? '#334155' : '#e5e7eb';
    
    const criarGrafico = (id, type, data, options) => {
        const ctx = document.getElementById(id);
        if(!ctx) return;
        if(window.graficosAbertos[id]) window.graficosAbertos[id].destroy();
        window.graficosAbertos[id] = new Chart(ctx, { type, data, options });
    };

    // Gráfico de Fluxo
    criarGrafico('chart-fluxo', 'bar', {
        labels: ['Período Filtrado'],
        datasets: [
            { label: 'Entradas', data: [rec], backgroundColor: '#10b981', borderRadius: 4 },
            { label: 'Saídas', data: [des], backgroundColor: '#ef4444', borderRadius: 4 }
        ]
    }, { responsive: true, maintainAspectRatio: false, scales: { y: { grid: { color: gridCor }, ticks: { color: txtCor } }, x: { grid: { display: false }, ticks: { color: txtCor } } }, plugins: { legend: { labels: { color: txtCor } } } });

    // O NOVO GRÁFICO DE PIZZA (Status do Pátio Atual)
    const stKeys = Object.keys(stObj);
    const stVals = Object.values(stObj);
    
    // Cores dinâmicas para os status
    const corMap = { 'ABERTO': '#3b82f6', 'AUTORIZADO': '#10b981', 'EM EXECUÇÃO': '#facc15', 'AGUARDANDO PEÇA': '#ef4444' };
    const bgColors = stKeys.map(k => corMap[k.toUpperCase()] || '#8b5cf6');

    criarGrafico('chart-status-os', 'pie', {
        labels: stKeys.length ? stKeys : ['Pátio Vazio'],
        datasets: [{ data: stVals.length ? stVals : [1], backgroundColor: bgColors, borderWidth: 2, borderColor: document.documentElement.classList.contains('dark') ? '#1e293b' : '#ffffff' }]
    }, { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: txtCor, font: {size: 11, weight: 'bold'} } } } });
};

// ==========================================================
// 3. MAPA (Leaflet)
// ==========================================================
window.desenharMapa = function(clientes) {
    const mapDiv = document.getElementById('mapa-clientes');
    if(!mapDiv || typeof L === 'undefined') return;

    if(window.mapaClientes) window.mapaClientes.remove();

    window.mapaClientes = L.map('mapa-clientes').setView([-18.9113, -48.2622], 12); // Centro tático
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { attribution: '&copy; OpenStreetMap' }).addTo(window.mapaClientes);
    
    L.circle([-18.9113, -48.2622], { color: '#1a428a', fillColor: '#3b82f6', fillOpacity: 0.2, radius: 12000 }).addTo(window.mapaClientes).bindPopup("Área de densidade de clientes.");
    L.marker([-18.9113, -48.2622]).addTo(window.mapaClientes).bindPopup("<b>Base Brasil Diesel</b>").openPopup();
};

// ==========================================================
// 4. INTEGRAÇÃO COM IA REAL (GOOGLE GEMINI)
// ==========================================================
window.toggleChatIA = function() {
    const j = document.getElementById('chat-ia-janela');
    if (j.classList.contains('scale-0')) {
        j.classList.remove('scale-0', 'opacity-0');
        j.classList.add('scale-100', 'opacity-100');
        document.getElementById('chat-ia-input').focus();
    } else {
        j.classList.add('scale-0', 'opacity-0');
        j.classList.remove('scale-100', 'opacity-100');
    }
};

window.enviarMensagemIA = async function() {
    const input = document.getElementById('chat-ia-input');
    const msg = input.value.trim();
    if(!msg) return;

    const chatBox = document.getElementById('chat-ia-mensagens');
    
    // Mostra mensagem do utilizador
    chatBox.innerHTML += `<div class="flex justify-end"><div class="bg-[#1a428a] text-white p-3 rounded-2xl rounded-tr-none shadow-sm text-sm max-w-[85%]">${msg}</div></div>`;
    input.value = '';
    chatBox.scrollTop = chatBox.scrollHeight;

    const idLoading = 'loading-' + Date.now();
    chatBox.innerHTML += `<div id="${idLoading}" class="flex justify-start"><div class="bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-gray-700 text-gray-400 p-3 rounded-2xl rounded-tl-none shadow-sm text-sm max-w-[85%] font-medium animate-pulse">A extrair inteligência da base de dados...</div></div>`;
    chatBox.scrollTop = chatBox.scrollHeight;

    try {
        // TÁTICA DE ELITE: Busca a chave secreta no Cofre do Banco de Dados
        const { data: cofre, error: errCofre } = await supabase.from('cofre_seguranca').select('gemini_key').eq('id', 1).single();
        
        if (errCofre || !cofre || !cofre.gemini_key || cofre.gemini_key === 'COLOQUE_SUA_CHAVE_AQUI') {
            throw new Error("SEM_CHAVE");
        }

        const contextoJSON = JSON.stringify(window.dadosContextoIA);
        const promptSistema = `Você é o CFO Digital (Consultor de Negócios e Dados) da oficina Brasil Diesel.
        DADOS REAIS DA OFICINA: ${contextoJSON}.
        Regra 1: Responda de forma executiva, objetiva e inteligente.
        Regra 2: Baseie-se apenas nestes dados.
        Regra 3: Escreva em texto limpo (não use asteriscos ** ou símbolos estranhos).
        Pergunta do usuário: "${msg}"`;

        // CORREÇÃO DO ERRO 404: Atualização para a versão "latest" do modelo
        const urlGemini = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${cofre.gemini_key}`;
        
        const response = await fetch(urlGemini, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: promptSistema }] }]
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error("Erro detalhado do Google:", data);
            throw new Error("Erro na API da IA");
        }

        const respostaIA = data.candidates[0].content.parts[0].text;

        document.getElementById(idLoading).remove();
        chatBox.innerHTML += `<div class="flex justify-start"><div class="bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 p-3 rounded-2xl rounded-tl-none shadow-sm text-sm max-w-[85%] font-medium whitespace-pre-wrap">${respostaIA}</div></div>`;
        chatBox.scrollTop = chatBox.scrollHeight;

    } catch (error) {
        console.error(error);
        if(document.getElementById(idLoading)) document.getElementById(idLoading).remove();
        
        let erroMsg = error.message === "SEM_CHAVE" 
            ? "⚠️ Chave de segurança não encontrada. Coloque a sua chave na tabela 'cofre_seguranca' do Supabase." 
            : "Desculpe, os servidores da IA rejeitaram a conexão. Verifique se a sua chave API é válida.";
            
        chatBox.innerHTML += `<div class="flex justify-start"><div class="bg-red-100 text-red-800 p-3 rounded-2xl rounded-tl-none shadow-sm text-sm max-w-[85%] font-medium">${erroMsg}</div></div>`;
        chatBox.scrollTop = chatBox.scrollHeight;
    }
};
