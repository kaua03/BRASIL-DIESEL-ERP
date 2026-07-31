// JS/modules/dashboard.js
import { supabase } from './config.js';

// ==========================================================
// 🧠 CÉREBRO INTERNO DA OFICINA (SISTEMA ESPECIALISTA PREDITIVO)
// ==========================================================
class CFOAgent_Engine {
    constructor() {
        this.memoria = []; // Guarda o histórico da conversa
        // Palavras que o motor ignora para entender a frase
        this.stopWords = ['o','a','os','as','um','uma','de','do','da','em','para','com','que','é','são']; 
    }

    // 1. Processamento de Linguagem Natural (Básico)
    tokenizar(texto) {
        const limpo = texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/g, '');
        return limpo.split(' ').filter(w => !this.stopWords.includes(w) && w.length > 1);
    }

    // 2. Formatadores
    moeda(v) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0); }
    percentual(v) { return (v || 0).toFixed(1) + '%'; }

    // 3. Matemática Preditiva (Regressão e Cenários)
    calcularCenarios(dados) {
        const d = dados.financeiro;
        const totalGirante = d.lucro + d.aReceberRisco + d.aPagar;
        const taxaInadimplencia = totalGirante > 0 ? (d.aReceberRisco / totalGirante) * 100 : 0;
        
        // Pior cenário: Paga tudo o que deve, mas não recebe nada do que está na rua
        const cenarioPessimista = d.lucro - d.aPagar;
        // Melhor cenário: Recebe tudo da rua
        const cenarioOtimista = d.lucro + d.aReceberRisco;

        return { taxaInadimplencia, cenarioPessimista, cenarioOtimista };
    }

    // 4. O Analisador de Intenções de Negócio
    processar(mensagem, contexto) {
        const tokens = this.tokenizar(mensagem);
        const f = contexto.financeiro;
        const o = contexto.operacao;
        
        // Se faltar dados
        if (!f) return "Ainda não possuo volume de dados suficiente. Por favor, execute a análise de um período no painel primeiro.";

        const match = (palavras) => palavras.some(p => tokens.includes(p));

        // INTENÇÃO: FUTURO E RISCO
        if (match(['previsao', 'futuro', 'risco', 'cenario', 'falencia', 'projetar'])) {
            const cenarios = this.calcularCenarios(contexto);
            let diagnostico = cenarios.cenarioPessimista < 0 
                ? `🔴 <b>ALERTA DE CAIXA:</b> O risco de rutura é altíssimo. Se os clientes atrasados não pagarem, faltarão ${this.moeda(Math.abs(cenarios.cenarioPessimista))} para honrar os custos.`
                : `🟢 <b>CAIXA BLINDADO:</b> A operação suporta a inadimplência atual. Mesmo no pior cenário, o caixa fecha positivo em ${this.moeda(cenarios.cenarioPessimista)}.`;

            return `<b>⚡ CÁLCULO ESTATÍSTICO DE CENÁRIOS</b><br><br>
            Com base no fluxo da oficina neste período:<br>
            • <b>Risco de Inadimplência:</b> ${this.percentual(cenarios.taxaInadimplencia)} do capital está comprometido.<br>
            • <b>Cenário Otimista (Entrada Total):</b> ${this.moeda(cenarios.cenarioOtimista)}<br>
            • <b>Cenário Pessimista (Calote Máximo):</b> ${this.moeda(cenarios.cenarioPessimista)}<br><br>
            ${diagnostico}<br>
            <i>Ação: Ordene bloqueio de crédito para os inadimplentes.</i>`;
        }
        
        // INTENÇÃO: PRODUÇÃO E PÁTIO
        if (match(['patio', 'laboratorio', 'producao', 'fechar', 'servico'])) {
            const taxaOcupacao = (o.carrosNoPatio / 15) * 100; // Assumindo base 15 carros
            const perdaEstimada = o.carrosNoPatio * o.ticketMedio;
            let conselho = taxaOcupacao > 80 
                ? "Gargalo detetado! O pátio está congestionado. Precisamos aumentar a produtividade da equipa para girar o caixa mais rápido." 
                : "Temos capacidade ociosa no pátio. Encerra-lo agora não cortaria custos fixos e destruiria a nossa entrada de clientes.";

            return `<b>⚙️ ANÁLISE DE ENGENHARIA DE PRODUÇÃO</b><br><br>
            • <b>Status do Pátio:</b> ${o.carrosNoPatio} veículos ocupando espaço.<br>
            • <b>Faturamento Travado no Elevador:</b> Estimativa de ${this.moeda(perdaEstimada)} aguardando conclusão.<br>
            • <b>Eficiência de Entrega:</b> ${o.osFeitas} Ordens concluídas no período.<br>
            • <b>Ticket Médio:</b> ${this.moeda(o.ticketMedio)} por veículo.<br><br>
            <b>Veredito Estratégico:</b> ${conselho}`;
        }

        // INTENÇÃO: COBRANÇA
        if (match(['cobrar', 'ralo', 'deve', 'atrasado', 'inadimplencia'])) {
            return `<b>⚠️ RELATÓRIO DO SANGRAMENTO (A RECEBER)</b><br><br>
            O motor detetou <b>${this.moeda(f.aReceberRisco)}</b> retidos na conta de clientes. Este é o seu ralo operacional.<br><br>
            <b>Protocolo de Contenção de Perdas:</b><br>
            1. Os mecânicos entregaram os veículos, mas o financeiro falhou na retenção.<br>
            2. Este capital é suficiente para cobrir os seus ${this.moeda(f.aPagar)} de despesas pendentes? ${f.aReceberRisco >= f.aPagar ? 'Sim, com folga.' : 'Não, a dívida dos clientes não cobre os nossos custos.'}<br>
            <i>Estratégia: Atribua hoje mesmo um funcionário para fazer régua de cobrança via WhatsApp.</i>`;
        }

        // INTENÇÃO: DESPESAS E CUSTOS
        if (match(['fornecedor', 'pagar', 'despesa', 'custo'])) {
             return `<b>🧾 AUDITORIA DE DESPESAS E PASSIVOS</b><br><br>
             As nossas obrigações registadas (A Pagar) somam <b>${this.moeda(f.aPagar)}</b> no período.<br>
             Se o lucro livre atual é de ${this.moeda(f.lucro)}, os nossos custos representam uma pressão de esmagamento. 
             Revise os contratos com os fornecedores principais listados no gráfico de ranking.`;
        }

        // INTENÇÃO: GERAL / RESUMO (Default)
        return `<b>📊 DIAGNÓSTICO GERAL DA OFICINA</b><br><br>
        Comandante, o motor analítico processou os dados do período:<br><br>
        • <b>Fluxo Real (Caixa):</b> ${this.moeda(f.lucro)}<br>
        • <b>Operação (Entregas):</b> ${o.osFeitas} veículos liberados.<br>
        • <b>Produtividade Campeã:</b> ${contexto.produtividade && contexto.produtividade[0] ? contexto.produtividade[0][0] : 'Nenhum registo'}.<br><br>
        A situação exige foco direcional. Para cálculos profundos, use palavras como: <b>"Cenários de Risco"</b>, <b>"Analisar Pátio"</b>, <b>"Custos"</b> ou <b>"Inadimplência"</b>.`;
    }
}

// Instância Global do Cérebro
const CFOBot = new CFOAgent_Engine();

// ==========================================================
// VARIÁVEIS GLOBAIS DE ESTADO
// ==========================================================
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
            // MÁQUINA DE DADOS: Otimizada para carregar TUDO
            const [receitasReq, despesasReq, osReq, clientesReq, logsReq] = await Promise.all([
                supabase.from('contas_receber').select('*'),
                supabase.from('contas_pagar').select('*'),
                supabase.from('ordens_servico').select('*, itens_orcamento(*)'),
                supabase.from('clientes').select('*'), 
                supabase.from('auditoria_logs').select('*')
            ]);

            const ordens = osReq.data || [];
            let lucroMensal = 0, recebido = 0, atrasado = 0, aPagar = 0, despesaPaga = 0;
            let osNoPeriodo = 0, valorTotalOs = 0;
            
            let contagemStatus = {};
            let patioAtivos = [];
            let prodEquipe = {};
            let valPatio = 0, valLab = 0;

            // Financeiro
            (receitasReq.data || []).forEach(c => {
                const d = (c.data_vencimento || c.created_at || "").substring(0, 10);
                if (d >= dataIniStr && d <= dataFimStr) {
                    const v = Number(c.valor || 0);
                    if (c.status === 'Pago') recebido += v; else atrasado += v;
                }
            });

            (despesasReq.data || []).forEach(c => {
                const d = (c.data_vencimento || c.created_at || "").substring(0, 10);
                if (d >= dataIniStr && d <= dataFimStr) {
                    const v = Number(c.valor || 0);
                    aPagar += v;
                    if (c.status === 'Pago') despesaPaga += v;
                }
            });

            lucroMensal = recebido - despesaPaga;

            // Operacional e Pátio
            ordens.forEach(os => {
                // Sempre lista quem está no pátio agora, independente do filtro de datas
                if (os.status !== 'Finalizada' && os.status !== 'Entregue' && os.status !== 'Cancelada') {
                    patioAtivos.push({ os: String(os.numero_os || os.id).padStart(4, '0'), placa: os.placa || 'N/A', status: os.status });
                    contagemStatus[os.status] = (contagemStatus[os.status] || 0) + 1;
                }

                // KPIs para o período filtrado
                const d = (os.data_entrada || os.created_at || "").substring(0, 10);
                if (d >= dataIniStr && d <= dataFimStr) {
                    osNoPeriodo++;
                    (os.itens_orcamento || []).forEach(item => {
                        const valItem = Number(item.valor_total || 0);
                        valorTotalOs += valItem;
                        // Classificador básico para Arena (Lab vs Pátio)
                        const desc = String(item.descricao).toUpperCase();
                        if (desc.includes('BICO') || desc.includes('BOMBA')) valLab += valItem; else valPatio += valItem;
                    });
                }
            });

            // Auditoria (Equipe)
            (logsReq.data || []).forEach(log => {
                const d = (log.created_at || "").substring(0, 10);
                if (d >= dataIniStr && d <= dataFimStr && log.modulo === 'Pátio') {
                    const nome = String(log.usuario).toUpperCase().split(' ')[0];
                    prodEquipe[nome] = (prodEquipe[nome] || 0) + 1;
                }
            });

            // ==========================================
            // ATUALIZAÇÃO DO FRONTEND
            // ==========================================
            const formatMoeda = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
            
            // Cards de Topo
            const els = ['kpi-lucro', 'kpi-receber', 'kpi-pagar', 'kpi-ticket', 'kpi-vol-os'];
            if(document.getElementById(els[0])) {
                document.getElementById('kpi-lucro').innerText = formatMoeda(lucroMensal);
                document.getElementById('kpi-lucro').className = `text-3xl font-black ${lucroMensal >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`;
                document.getElementById('kpi-receber').innerText = formatMoeda(atrasado);
                document.getElementById('kpi-pagar').innerText = formatMoeda(aPagar);
                document.getElementById('kpi-ticket').innerText = formatMoeda(osNoPeriodo > 0 ? (valorTotalOs / osNoPeriodo) : 0);
                document.getElementById('kpi-vol-os').innerText = `${osNoPeriodo} O.S. no Período`;
            }

            const objParaArraySort = (obj) => Object.entries(obj).sort((a,b) => b[1] - a[1]);
            
            // Listas
            const ulPatio = document.getElementById('lista-patio-ativos');
            if(ulPatio) ulPatio.innerHTML = patioAtivos.length ? patioAtivos.map(p => `
                <li class="flex justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
                    <div><span class="text-[#1a428a] dark:text-[#3b82f6] font-black">#${p.os}</span> <span class="text-xs uppercase ml-1">${p.placa}</span></div>
                    <span class="text-[9px] px-2 py-0.5 rounded bg-orange-100 text-orange-700 uppercase font-black">${p.status}</span>
                </li>`).join('') : '<li class="text-xs text-gray-400">Pátio livre.</li>';

            const topEq = objParaArraySort(prodEquipe).slice(0, 5);
            const ulEq = document.getElementById('lista-top-equipe');
            if(ulEq) ulEq.innerHTML = topEq.length ? topEq.map(e => `
                <li class="flex justify-between border-b border-gray-100 dark:border-gray-800 pb-2 items-center">
                    <span class="uppercase font-bold">${e[0]}</span> 
                    <span class="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-black">${e[1]} Ações</span>
                </li>`).join('') : '<li class="text-xs text-gray-400">Sem ações registradas.</li>';

            // Gráficos e Mapa
            window.desenharGraficos(recebido, despesaPaga, contagemStatus, valPatio, valLab);
            if (typeof L !== 'undefined') window.desenharMapa(clientesReq.data || []);

            // Alimentar Memória do Cérebro Preditivo
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
window.desenharGraficos = function(rec, des, stObj, pVal, lVal) {
    if (typeof Chart === 'undefined') return;

    const txtCor = document.documentElement.classList.contains('dark') ? '#9ca3af' : '#4b5563';
    const gridCor = document.documentElement.classList.contains('dark') ? '#334155' : '#e5e7eb';
    
    const criarGrafico = (id, type, data, options) => {
        const ctx = document.getElementById(id);
        if(!ctx) return;
        if(window.graficosAbertos[id]) window.graficosAbertos[id].destroy();
        window.graficosAbertos[id] = new Chart(ctx, { type, data, options });
    };

    // Fluxo de Caixa (Curva de Sobrevivência)
    criarGrafico('chart-fluxo', 'bar', {
        labels: ['Período Filtrado'],
        datasets: [
            { label: 'Entradas', data: [rec], backgroundColor: '#10b981', borderRadius: 4 },
            { label: 'Saídas', data: [des], backgroundColor: '#ef4444', borderRadius: 4 }
        ]
    }, { responsive: true, maintainAspectRatio: false, scales: { y: { grid: { color: gridCor }, ticks: { color: txtCor } }, x: { grid: { display: false }, ticks: { color: txtCor } } }, plugins: { legend: { labels: { color: txtCor } } } });

    // Status O.S (O Ringue do Pátio)
    const stKeys = Object.keys(stObj);
    const stVals = Object.values(stObj);
    const corMap = { 'ABERTO': '#3b82f6', 'AUTORIZADO': '#10b981', 'EM EXECUÇÃO': '#facc15', 'AGUARDANDO PEÇA': '#ef4444' };
    const bgColors = stKeys.map(k => corMap[k.toUpperCase()] || '#8b5cf6');

    criarGrafico('chart-status-os', 'pie', {
        labels: stKeys.length ? stKeys : ['Pátio Vazio'],
        datasets: [{ data: stVals.length ? stVals : [1], backgroundColor: bgColors, borderWidth: 2, borderColor: document.documentElement.classList.contains('dark') ? '#1e293b' : '#ffffff' }]
    }, { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: txtCor, font: {size: 11, weight: 'bold'} } } } });
};

// ==========================================================
// 3. MAPA GEOGRÁFICO DE INFLUÊNCIA (Leaflet)
// ==========================================================
window.desenharMapa = function(clientes) {
    const mapDiv = document.getElementById('mapa-clientes');
    if(!mapDiv || typeof L === 'undefined') return;
    if(window.mapaClientes) window.mapaClientes.remove();

    window.mapaClientes = L.map('mapa-clientes').setView([-18.9113, -48.2622], 12); 
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { attribution: '&copy; OpenStreetMap' }).addTo(window.mapaClientes);
    
    // Área de Foco
    L.circle([-18.9113, -48.2622], { color: '#1a428a', fillColor: '#3b82f6', fillOpacity: 0.2, radius: 15000 }).addTo(window.mapaClientes).bindPopup("Área de densidade de Marketing.");
    L.marker([-18.9113, -48.2622]).addTo(window.mapaClientes).bindPopup("<b style='color:#1a428a'>Base Brasil Diesel</b>").openPopup();
};

// ==========================================================
// 4. INTERFACE DO CÉREBRO PREDITIVO (CHATBOT)
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

window.enviarMensagemIA = function() {
    // Passa a mensagem para o nosso Cérebro Algorítmico interno (CFOBot)
    const input = document.getElementById('chat-ia-input');
    CFOBot.processar(input.value, window.dadosContextoIA);
};
