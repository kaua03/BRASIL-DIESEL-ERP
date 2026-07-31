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
        // Primeiro dia do mês atual
        const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        inputIni.value = primeiroDia.toISOString().split('T')[0];
        inputFim.value = hoje.toISOString().split('T')[0];
    }
};

window.carregarDashboard = async function() {
    window.inicializarDatas();
    const dataIni = document.getElementById('dash-data-ini').value + "T00:00:00";
    const dataFim = document.getElementById('dash-data-fim').value + "T23:59:59";
    
    setTimeout(async () => {
        try {
            // MÁQUINA DE DADOS
            const [receitasReq, despesasReq, osReq, clientesReq, logsReq] = await Promise.all([
                supabase.from('contas_receber').select('*'),
                supabase.from('contas_pagar').select('*'),
                supabase.from('ordens_servico').select('*, itens_orcamento(*)'),
                supabase.from('clientes').select('id, nome, endereco'),
                supabase.from('auditoria_logs').select('*').gte('created_at', dataIni).lte('created_at', dataFim)
            ]);

            const ordens = osReq.data || [];
            let lucroMensal = 0, recebido = 0, atrasado = 0, aPagar = 0, despesaPaga = 0;
            let osNoPeriodo = 0, valorTotalOs = 0;
            
            // Novos Contadores
            let contagemStatus = {};
            let patioAtivos = [];
            let prodEquipe = {};

            // 1. Financeiro
            (receitasReq.data || []).forEach(c => {
                const d = c.data_vencimento || c.created_at;
                if (d >= dataIni && d <= dataFim) {
                    const v = Number(c.valor || 0);
                    if (c.status === 'Pago') recebido += v; else atrasado += v;
                }
            });

            (despesasReq.data || []).forEach(c => {
                const d = c.data_vencimento || c.created_at;
                if (d >= dataIni && d <= dataFim) {
                    const v = Number(c.valor || 0);
                    aPagar += v;
                    if (c.status === 'Pago') despesaPaga += v;
                }
            });

            lucroMensal = recebido - despesaPaga;

            // 2. O.S. e Veículos no Pátio
            ordens.forEach(os => {
                // Veículos atualmente no Pátio (independente da data do filtro)
                if (os.status !== 'Finalizada' && os.status !== 'Entregue' && os.status !== 'Cancelada') {
                    patioAtivos.push({ os: os.numero_os || os.id, placa: os.placa || 'N/A', modelo: os.modelo || '---', status: os.status });
                }

                // Filtradas pelo período
                if (os.created_at >= dataIni && os.created_at <= dataFim) {
                    osNoPeriodo++;
                    const st = os.status || 'Nova';
                    contagemStatus[st] = (contagemStatus[st] || 0) + 1;

                    (os.itens_orcamento || []).forEach(item => {
                        valorTotalOs += Number(item.valor_total || 0);
                    });
                }
            });

            // 3. Produtividade da Equipe (Lendo os Logs de Auditoria)
            (logsReq.data || []).forEach(log => {
                if (log.modulo === 'Pátio' && log.acao.includes('Checklist')) {
                    const nome = String(log.usuario).toUpperCase().split(' ')[0];
                    prodEquipe[nome] = (prodEquipe[nome] || 0) + 1;
                }
            });

            // ATUALIZAR ZONA 1 (KPIs)
            const formatMoeda = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
            document.getElementById('kpi-lucro').innerText = formatMoeda(lucroMensal);
            document.getElementById('kpi-lucro').className = `text-3xl font-black ${lucroMensal >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`;
            document.getElementById('kpi-receber').innerText = formatMoeda(atrasado);
            document.getElementById('kpi-pagar').innerText = formatMoeda(aPagar);
            document.getElementById('kpi-ticket').innerText = formatMoeda(osNoPeriodo > 0 ? (valorTotalOs / osNoPeriodo) : 0);
            document.getElementById('kpi-vol-os').innerText = `${osNoPeriodo} O.S. no Período`;

            // ATUALIZAR ZONA 2 (Listas)
            const objParaArraySort = (obj) => Object.entries(obj).sort((a,b) => b[1] - a[1]);
            
            // Pátio
            const ulPatio = document.getElementById('lista-patio-ativos');
            ulPatio.innerHTML = patioAtivos.length ? patioAtivos.map(p => `
                <li class="flex justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
                    <div>
                        <span class="text-[#1a428a] dark:text-[#3b82f6] font-black">#${p.os}</span> 
                        <span class="text-xs uppercase ml-1">${p.placa}</span>
                    </div>
                    <span class="text-[9px] px-2 py-0.5 rounded bg-orange-100 text-orange-700 uppercase">${p.status}</span>
                </li>`).join('') : '<li class="text-xs text-gray-400">Pátio limpo e vazio.</li>';

            // Equipe
            const topEq = objParaArraySort(prodEquipe).slice(0, 5);
            const ulEq = document.getElementById('lista-top-equipe');
            ulEq.innerHTML = topEq.length ? topEq.map(e => `
                <li class="flex justify-between border-b border-gray-100 dark:border-gray-800 pb-2 items-center">
                    <span class="uppercase">${e[0]}</span> 
                    <span class="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-black">${e[1]} Ações</span>
                </li>`).join('') : '<li class="text-xs text-gray-400">Sem ações registradas no período.</li>';

            // GRÁFICOS E MAPAS
            window.desenharGraficos(recebido, despesaPaga, contagemStatus);
            if (typeof L !== 'undefined') window.desenharMapa(clientesReq.data || []);

            // Salva Contexto para IA
            window.dadosContextoIA = { lucroMensal, recebido, atrasado, aPagar, osNoPeriodo, patioQtd: patioAtivos.length, melhorFunc: topEq.length ? topEq[0][0] : 'Ninguém' };

        } catch (e) { console.error("Erro Dashboard:", e); }
    }, 200); // 200ms garante que o HTML injetado foi renderizado no SPA
};

// ==========================================================
// 2. GRÁFICOS (Chart.js)
// ==========================================================
window.desenharGraficos = function(rec, des, stObj) {
    if (typeof Chart === 'undefined') return; // Segurança SPA

    const txtCor = document.documentElement.classList.contains('dark') ? '#9ca3af' : '#4b5563';
    const gridCor = document.documentElement.classList.contains('dark') ? '#334155' : '#e5e7eb';
    
    const criarGrafico = (id, type, data, options) => {
        const ctx = document.getElementById(id);
        if(!ctx) return;
        if(window.graficosAbertos[id]) window.graficosAbertos[id].destroy();
        window.graficosAbertos[id] = new Chart(ctx, { type, data, options });
    };

    // Fluxo
    criarGrafico('chart-fluxo', 'bar', {
        labels: ['Período Filtrado'],
        datasets: [
            { label: 'Entradas', data: [rec], backgroundColor: '#10b981', borderRadius: 4 },
            { label: 'Saídas', data: [des], backgroundColor: '#ef4444', borderRadius: 4 }
        ]
    }, { responsive: true, maintainAspectRatio: false, scales: { y: { grid: { color: gridCor }, ticks: { color: txtCor } }, x: { grid: { display: false }, ticks: { color: txtCor } } }, plugins: { legend: { labels: { color: txtCor } } } });

    // Status O.S. (Pizza)
    const stKeys = Object.keys(stObj);
    const stVals = Object.values(stObj);
    criarGrafico('chart-status-os', 'pie', {
        labels: stKeys.length ? stKeys : ['Nenhuma'],
        datasets: [{ data: stVals.length ? stVals : [1], backgroundColor: ['#3b82f6', '#facc15', '#10b981', '#ef4444', '#8b5cf6'], borderWidth: 0 }]
    }, { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: txtCor, font: {size: 10} } } } });
};

// ==========================================================
// 3. MAPA (Leaflet)
// ==========================================================
window.desenharMapa = function(clientes) {
    const mapDiv = document.getElementById('mapa-clientes');
    if(!mapDiv) return;

    if(window.mapaClientes) {
        window.mapaClientes.remove();
    }

    // Inicializa centrado (Ex: Uberlândia)
    window.mapaClientes = L.map('mapa-clientes').setView([-18.9113, -48.2622], 12);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { attribution: '&copy; OpenStreetMap' }).addTo(window.mapaClientes);
    
    // Raio Simulado de 15km
    L.circle([-18.9113, -48.2622], { color: '#1a428a', fillColor: '#3b82f6', fillOpacity: 0.2, radius: 15000 }).addTo(window.mapaClientes).bindPopup("Área de atuação primária.");
    L.marker([-18.9113, -48.2622]).addTo(window.mapaClientes).bindPopup("<b>Base Brasil Diesel</b>").openPopup();
};

// ==========================================================
// 4. AGENTE DE IA
// ==========================================================
window.toggleChatIA = function() {
    const j = document.getElementById('chat-ia-janela');
    if (j.classList.contains('scale-0')) {
        j.classList.remove('scale-0', 'opacity-0');
        j.classList.add('scale-100', 'opacity-100');
    } else {
        j.classList.add('scale-0', 'opacity-0');
        j.classList.remove('scale-100', 'opacity-100');
    }
};

window.enviarMensagemIA = function() {
    const input = document.getElementById('chat-ia-input');
    const msg = input.value.trim();
    if(!msg) return;

    const chatBox = document.getElementById('chat-ia-mensagens');
    chatBox.innerHTML += `<div class="flex justify-end"><div class="bg-[#1a428a] text-white p-3 rounded-2xl rounded-tr-none shadow-sm text-sm max-w-[85%]">${msg}</div></div>`;
    input.value = '';
    chatBox.scrollTop = chatBox.scrollHeight;

    setTimeout(() => {
        const d = window.dadosContextoIA;
        let resposta = "";
        const m = msg.toLowerCase();

        if (m.includes('resumo') || m.includes('mês')) {
            resposta = `Comandante, no período selecionado, fechamos com R$ ${d.lucroMensal} líquidos. Executamos ${d.osNoPeriodo} Ordens. O destaque operacional foi ${d.melhorFunc}, com o maior número de checklists concluídos.`;
        } else if (m.includes('pátio') || m.includes('fechar')) {
            resposta = `Analisando o Pátio: Temos ${d.patioQtd} veículos aguardando/em execução. Encerrar o pátio é arriscado pois é o principal alimentador do laboratório.`;
        } else if (m.includes('ralo') || m.includes('cobrar') || m.includes('inadimplência')) {
            resposta = `O nosso ralo está em R$ ${d.atrasado}. Sugiro que acione o setor de cobrança IMEDIATAMENTE para os clientes com O.S. finalizada que ainda não pagaram.`;
        } else {
            resposta = `Como seu CFO Digital, baseio as minhas respostas na matemática. Com um lucro de R$ ${d.lucroMensal} e R$ ${d.atrasado} na rua, a prioridade é transformar inadimplência em caixa. Quer detalhes dos veículos presos no pátio?`;
        }

        chatBox.innerHTML += `<div class="flex justify-start"><div class="bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 p-3 rounded-2xl rounded-tl-none shadow-sm text-sm max-w-[85%] font-medium">${resposta}</div></div>`;
        chatBox.scrollTop = chatBox.scrollHeight;
    }, 1500);
};
