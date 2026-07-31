// JS/modules/dashboard.js
import { supabase } from './config.js';

window.graficosAbertos = {};
window.mapaClientes = null;
window.dashRealtimeTimer = null;
window.dadosContextoIA = {};

// ==========================================================
// 1. GESTÃO DO MÊS E INICIALIZAÇÃO
// ==========================================================
window.preencherFiltroMeses = function() {
    const select = document.getElementById('dash-mes');
    if (!select || select.options.length > 0) return; 
    
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const dataAtual = new Date();
    let anoAtual = dataAtual.getFullYear();
    let mesAtual = dataAtual.getMonth(); 

    for (let i = 0; i < 6; i++) {
        let m = mesAtual - i;
        let a = anoAtual;
        if (m < 0) { m += 12; a -= 1; }
        
        const option = document.createElement('option');
        option.value = `${a}-${String(m + 1).padStart(2, '0')}`;
        option.text = `${meses[m]} de ${a}`;
        if (i === 0) option.selected = true; 
        select.appendChild(option);
    }
};

window.carregarDashboard = async function() {
    window.preencherFiltroMeses();
    const mesFiltro = document.getElementById('dash-mes').value; 
    
    // Pequeno atraso para garantir que o HTML carregou (Comportamento SPA)
    setTimeout(async () => {
        try {
            // Busca Massiva
            const [receitasReq, despesasReq, osReq, clientesReq] = await Promise.all([
                supabase.from('contas_receber').select('*'),
                supabase.from('contas_pagar').select('*'),
                supabase.from('ordens_servico').select('*, itens_orcamento(*)'),
                supabase.from('clientes').select('id, nome, endereco') // Para o mapa
            ]);

            const receber = receitasReq.data || [];
            const pagar = despesasReq.data || [];
            const ordens = osReq.data || [];
            const clientes = clientesReq.data || [];

            // Variáveis de Cálculo
            let lucroMensal = 0, recebido = 0, atrasado = 0, aPagar = 0, despesaPaga = 0;
            let valPatio = 0, valLab = 0;
            let contagemVeiculos = {};
            let contagemPecas = {};
            let contagemFornecedores = {};
            let osFechadas = 0, valorTotalOs = 0;

            // Processar Receitas (Mês atual)
            receber.forEach(c => {
                const data = c.data_vencimento || c.created_at;
                if (data.startsWith(mesFiltro)) {
                    const v = Number(c.valor || 0);
                    if (c.status === 'Pago') recebido += v;
                    else atrasado += v;
                }
            });

            // Processar Despesas (Mês atual)
            pagar.forEach(c => {
                const data = c.data_vencimento || c.created_at;
                if (data.startsWith(mesFiltro)) {
                    const v = Number(c.valor || 0);
                    aPagar += v;
                    if (c.status === 'Pago') despesaPaga += v;
                    // Ranking Fornecedores
                    const forn = String(c.fornecedor || 'Diversos').toUpperCase().substring(0, 25);
                    contagemFornecedores[forn] = (contagemFornecedores[forn] || 0) + v;
                }
            });

            lucroMensal = recebido - despesaPaga;

            // Processar O.S. e Veículos (Mês atual)
            ordens.forEach(os => {
                if (os.created_at && os.created_at.startsWith(mesFiltro)) {
                    osFechadas++;
                    
                    // Ranking Veículos
                    const modelo = String(os.modelo || 'OUTROS').toUpperCase();
                    contagemVeiculos[modelo] = (contagemVeiculos[modelo] || 0) + 1;

                    (os.itens_orcamento || []).forEach(item => {
                        const valItem = Number(item.valor_total || 0);
                        valorTotalOs += valItem;
                        
                        // Lab vs Pátio
                        const desc = String(item.descricao).toUpperCase();
                        if (desc.includes('BICO') || desc.includes('BOMBA') || desc.includes('INJETOR')) {
                            valLab += valItem;
                        } else {
                            valPatio += valItem;
                        }

                        // Ranking Peças
                        if (item.tipo === 'Peça') {
                            contagemPecas[desc] = (contagemPecas[desc] || 0) + item.quantidade;
                        }
                    });
                }
            });

            const ticketMedio = osFechadas > 0 ? (valorTotalOs / osFechadas) : 0;

            // ATUALIZAR KPIs TELA
            const formatMoeda = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
            
            if(document.getElementById('kpi-lucro')) {
                document.getElementById('kpi-lucro').innerText = formatMoeda(lucroMensal);
                document.getElementById('kpi-receber').innerText = formatMoeda(atrasado);
                document.getElementById('kpi-pagar').innerText = formatMoeda(aPagar);
                document.getElementById('kpi-ticket').innerText = formatMoeda(ticketMedio);
                document.getElementById('kpi-vol-os').innerText = `${osFechadas} O.S. Executadas`;
            }

            // ATUALIZAR LISTAS (TOP 5)
            const objParaArraySort = (obj) => Object.entries(obj).sort((a,b) => b[1] - a[1]).slice(0, 5);
            
            const topPecas = objParaArraySort(contagemPecas);
            const ulPecas = document.getElementById('lista-top-pecas');
            if(ulPecas) {
                ulPecas.innerHTML = topPecas.length ? topPecas.map(p => `<li class="flex justify-between border-b border-gray-100 dark:border-gray-800 pb-1"><span>${p[0]}</span> <span class="text-orange-500">${p[1]}x</span></li>`).join('') : '<li class="text-xs text-gray-400">Sem dados no mês.</li>';
            }

            const topForn = objParaArraySort(contagemFornecedores);
            const ulForn = document.getElementById('lista-top-fornecedores');
            if(ulForn) {
                ulForn.innerHTML = topForn.length ? topForn.map(f => `<li class="flex justify-between border-b border-gray-100 dark:border-gray-800 pb-1 truncate"><span class="truncate pr-2">${f[0]}</span> <span class="text-purple-500">${formatMoeda(f[1])}</span></li>`).join('') : '<li class="text-xs text-gray-400">Sem dados no mês.</li>';
            }

            // =====================================
            // DESENHAR GRÁFICOS & MAPA
            // =====================================
            window.desenharGraficos(recebido, despesaPaga, contagemVeiculos, valPatio, valLab);
            window.desenharMapa(clientes);
            window.iniciarRealtimeDash();

            // Salva dados para o Bot CFO
            window.dadosContextoIA = { lucroMensal, recebido, atrasado, aPagar, osFechadas, ticketMedio, topVeiculos: topPecas, topForn };

        } catch (e) {
            console.error("Erro Dashboard:", e);
        }
    }, 100);
};

// ==========================================================
// 2. RENDERIZAÇÃO GRÁFICA (CHART.JS)
// ==========================================================
window.desenharGraficos = function(rec, des, veiculosObj, patio, lab) {
    const txtCor = document.documentElement.classList.contains('dark') ? '#9ca3af' : '#4b5563';
    const gridCor = document.documentElement.classList.contains('dark') ? '#334155' : '#e5e7eb';
    
    const criarGrafico = (id, type, data, options) => {
        const ctx = document.getElementById(id);
        if(!ctx) return;
        if(window.graficosAbertos[id]) window.graficosAbertos[id].destroy();
        window.graficosAbertos[id] = new Chart(ctx, { type, data, options });
    };

    // 1. Fluxo de Caixa (Barra Dupla)
    criarGrafico('chart-fluxo', 'bar', {
        labels: ['Mês Analisado'],
        datasets: [
            { label: 'Entradas', data: [rec], backgroundColor: '#10b981', borderRadius: 4 },
            { label: 'Saídas', data: [des], backgroundColor: '#ef4444', borderRadius: 4 }
        ]
    }, { responsive: true, maintainAspectRatio: false, scales: { y: { grid: { color: gridCor }, ticks: { color: txtCor } }, x: { grid: { display: false }, ticks: { color: txtCor } } }, plugins: { legend: { labels: { color: txtCor } } } });

    // 2. Top Veículos (Barra Horizontal)
    const topV = Object.entries(veiculosObj).sort((a,b) => b[1] - a[1]).slice(0, 5);
    criarGrafico('chart-veiculos', 'bar', {
        labels: topV.map(v => v[0]),
        datasets: [{ label: 'Qtd na Oficina', data: topV.map(v => v[1]), backgroundColor: '#1a428a', borderRadius: 4 }]
    }, { indexAxis: 'y', responsive: true, maintainAspectRatio: false, scales: { x: { grid: { color: gridCor }, ticks: { color: txtCor, stepSize: 1 } }, y: { grid: { display: false }, ticks: { color: txtCor, font: {size: 10} } } }, plugins: { legend: { display: false } } });

    // 3. Origem Faturamento (Doughnut)
    criarGrafico('chart-origem', 'doughnut', {
        labels: ['Serviço Pátio', 'Laboratório/Bancada'],
        datasets: [{ data: [patio || 1, lab || 1], backgroundColor: ['#3b82f6', '#facc15'], borderWidth: 0, hoverOffset: 5 }]
    }, { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'bottom', labels: { color: txtCor } } } });
};

// ==========================================================
// 3. MAPA DE CALOR GEOGRÁFICO (LEAFLET)
// ==========================================================
window.desenharMapa = function(clientes) {
    const mapDiv = document.getElementById('mapa-clientes');
    if(!mapDiv) return;

    if(window.mapaClientes) {
        window.mapaClientes.remove(); // Limpa mapa antigo se existir
    }

    // Inicializa centrado em Uberlândia (como exemplo de centro tático)
    window.mapaClientes = L.map('mapa-clientes').setView([-18.9113, -48.2622], 12);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(window.mapaClientes);

    // Simulação visual: Como o banco de dados tem endereços de texto e não Latitude/Longitude exata ainda, 
    // nós desenhamos uma área de cobertura de influência para mostrar ao patrão a ideia (Raio de 15km).
    // Num sistema final com API de Geocoding do Google, cada cliente seria um ponto exato.
    L.circle([-18.9113, -48.2622], {
        color: '#1a428a',
        fillColor: '#3b82f6',
        fillOpacity: 0.2,
        radius: 12000 // 12km
    }).addTo(window.mapaClientes).bindPopup("Área de densidade alta de clientes. Focar Marketing aqui.");
    
    // Marcador da Oficina
    L.marker([-18.9113, -48.2622]).addTo(window.mapaClientes).bindPopup("<b>Sua Oficina</b>").openPopup();
};

// ==========================================================
// 4. SUPABASE REALTIME (ATUALIZAÇÃO AO VIVO)
// ==========================================================
window.iniciarRealtimeDash = function() {
    if(window.dashRealtimeAtivo) return;
    
    supabase.channel('dashboard-inteligente')
        .on('postgres_changes', { event: '*', schema: 'public' }, payload => {
            // Se qualquer tabela mudar (O.S, Financeiro, Clientes), recarrega o Dash em 1.5s
            // Usa Timeout para evitar que 10 mudanças juntas travem a tela.
            clearTimeout(window.dashRealtimeTimer);
            window.dashRealtimeTimer = setTimeout(() => {
                if(document.getElementById('dash-mes')) window.carregarDashboard();
            }, 1500);
        })
        .subscribe();
        
    window.dashRealtimeAtivo = true;
};

// ==========================================================
// 5. AGENTE DE IA (CFO DIGITAL) - CHATBOT
// ==========================================================
window.toggleChatIA = function() {
    const janela = document.getElementById('chat-ia-janela');
    if (janela.classList.contains('scale-0')) {
        janela.classList.remove('scale-0', 'opacity-0');
        janela.classList.add('scale-100', 'opacity-100');
        document.getElementById('chat-ia-input').focus();
    } else {
        janela.classList.remove('scale-100', 'opacity-100');
        janela.classList.add('scale-0', 'opacity-0');
    }
};

window.enviarMensagemIA = function() {
    const input = document.getElementById('chat-ia-input');
    const msg = input.value.trim();
    if(!msg) return;

    const chatBox = document.getElementById('chat-ia-mensagens');
    
    // 1. Mensagem do Usuário
    chatBox.innerHTML += `
        <div class="flex justify-end">
            <div class="bg-[#1a428a] text-white p-3 rounded-2xl rounded-tr-none shadow-sm text-sm max-w-[85%]">
                ${msg}
            </div>
        </div>
    `;
    input.value = '';
    chatBox.scrollTop = chatBox.scrollHeight;

    // 2. Simula o raciocínio do LLM/Python
    setTimeout(() => {
        const d = window.dadosContextoIA;
        let resposta = "";
        const m = msg.toLowerCase();

        // Lógica simulada de Processamento de Linguagem Natural Básica
        if(m.includes('resumo') || m.includes('geral') || m.includes('mês')) {
            resposta = `Comandante, neste mês o Lucro Líquido é de R$ ${d.lucroMensal}. Executamos ${d.osFechadas} Ordens de Serviço com ticket médio de R$ ${d.ticketMedio.toFixed(2)}. Atenção ao capital na rua: temos R$ ${d.atrasado} em atraso/a receber.`;
        } 
        else if (m.includes('pátio') || m.includes('fechar') || m.includes('laboratório')) {
            resposta = `Analisando os dados da arena: O Pátio atrai clientes, e o Laboratório gera margem alta em bombas/bicos. Fechar o Pátio agora eliminaria a "porta de entrada" dos serviços do Laboratório. Sugiro otimizar a mão de obra em vez de fechar.`;
        }
        else if (m.includes('fornecedor') || m.includes('custo')) {
            resposta = `Os custos do mês totalizam R$ ${d.aPagar}. Revise compras com os fornecedores principais para renegociar prazos e aliviar o caixa.`;
        }
        else {
            resposta = `Como seu CFO Digital, estou monitorizando a oficina em tempo real. O nosso foco principal deve ser recuperar os R$ ${d.atrasado} pendentes para proteger o caixa. Quer que eu detalhe as despesas?`;
        }

        chatBox.innerHTML += `
            <div class="flex justify-start">
                <div class="bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 p-3 rounded-2xl rounded-tl-none shadow-sm text-sm max-w-[85%] font-medium">
                    ${resposta}
                </div>
            </div>
        `;
        chatBox.scrollTop = chatBox.scrollHeight;
        
        if (window.registrarLog) window.registrarLog('Dashboard', 'Consultou IA Analítica', msg);
    }, 1500);
};
