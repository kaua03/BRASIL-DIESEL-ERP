// JS/modules/dashboard.js
import { supabase } from './config.js';

// Memória dos Gráficos (Para destruir e não bugar no SPA)
window.graficoCaixa = null;
window.graficoArena = null;

// =========================================================================
// 1. INICIALIZAÇÃO E FILTROS
// =========================================================================
window.preencherFiltroMeses = function() {
    const select = document.getElementById('dash-mes');
    if (!select || select.options.length > 0) return; // Só preenche uma vez
    
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const dataAtual = new Date();
    const anoAtual = dataAtual.getFullYear();
    const mesAtual = dataAtual.getMonth(); // 0 a 11

    // Preenche últimos 6 meses e o mês atual
    for (let i = 0; i < 6; i++) {
        let m = mesAtual - i;
        let a = anoAtual;
        if (m < 0) { m += 12; a -= 1; }
        
        const option = document.createElement('option');
        // O valor será formato YYYY-MM para facilitar a busca no banco
        option.value = `${a}-${String(m + 1).padStart(2, '0')}`;
        option.text = `${meses[m]} de ${a}`;
        if (i === 0) option.selected = true; // Seleciona o mês atual por padrão
        
        select.appendChild(option);
    }
};

window.carregarDashboard = async function() {
    window.preencherFiltroMeses();
    const mesFiltro = document.getElementById('dash-mes').value; // Ex: "2026-07"
    
    // Feedback visual
    document.getElementById('kpi-caixa').innerText = "A ler dados...";
    document.getElementById('kpi-receber').innerText = "...";
    document.getElementById('kpi-pagar').innerText = "...";
    document.getElementById('kpi-ticket').innerText = "...";

    try {
        // MÁQUINA DE DADOS: Busca massiva no Supabase
        // 1. Contas a Receber (Para o Caixa e o Ralo)
        const { data: receber, error: errRec } = await supabase.from('contas_receber').select('*');
        // 2. Contas a Pagar
        const { data: pagar, error: errPag } = await supabase.from('contas_pagar').select('*');
        // 3. Ordens de Serviço (Para o Pátio vs Lab e Ticket Médio)
        const { data: ordens, error: errOs } = await supabase.from('ordens_servico').select('*, itens_orcamento(*)');

        // CALCULAR KPIs DO MÊS SELECIONADO
        let totalCaixaRecebido = 0;
        let totalRaloAtrasado = 0;
        let totalPagarMes = 0;
        
        // Filtra e soma Receitas
        (receber || []).forEach(conta => {
            const dataConta = conta.data_vencimento || conta.created_at;
            if (dataConta.startsWith(mesFiltro)) {
                if (conta.status === 'Pago') totalCaixaRecebido += Number(conta.valor || 0);
                else totalRaloAtrasado += Number(conta.valor || 0);
            }
        });

        // Filtra e soma Despesas
        let totalCaixaPago = 0;
        (pagar || []).forEach(conta => {
            const dataConta = conta.data_vencimento || conta.created_at;
            if (dataConta.startsWith(mesFiltro)) {
                totalPagarMes += Number(conta.valor || 0);
                if (conta.status === 'Pago') totalCaixaPago += Number(conta.valor || 0);
            }
        });

        // CAIXA REAL = O que entrou - O que saiu no mês
        const saldoReal = totalCaixaRecebido - totalCaixaPago;
        
        // TICKET MÉDIO DA O.S. (Apenas O.S. finalizadas/pagas)
        let totalValorOs = 0;
        let countOs = 0;
        let receitaPatio = 0;
        let receitaLab = 0;

        (ordens || []).forEach(os => {
            if (os.created_at && os.created_at.startsWith(mesFiltro)) {
                countOs++;
                let valorDestaOs = 0;
                (os.itens_orcamento || []).forEach(item => {
                    const valItem = Number(item.valor_total || 0);
                    valorDestaOs += valItem;
                    
                    // Lógica para a ARENA (Classificação básica: Se for serviço de bancada é Lab, senão Pátio)
                    // Como não temos a coluna exata, fazemos uma inferência estratégica:
                    if (String(item.descricao).toUpperCase().includes('BICO') || String(item.descricao).toUpperCase().includes('BOMBA')) {
                        receitaLab += valItem;
                    } else {
                        receitaPatio += valItem;
                    }
                });
                totalValorOs += valorDestaOs;
            }
        });

        const ticketMedio = countOs > 0 ? (totalValorOs / countOs) : 0;

        // ==========================================
        // ATUALIZAR O ECRÃ (ZONA 1)
        // ==========================================
        const formatarReal = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
        
        document.getElementById('kpi-caixa').innerText = formatarReal(saldoReal);
        const stCaixa = document.getElementById('kpi-caixa-status');
        if (saldoReal >= 0) {
            stCaixa.innerText = "🟢 Operação Saudável"; stCaixa.className = "text-xs font-bold mt-2 text-green-500";
            document.getElementById('kpi-caixa').className = "text-3xl font-black text-green-600 dark:text-green-500";
        } else {
            stCaixa.innerText = "🔴 Sangramento de Caixa"; stCaixa.className = "text-xs font-bold mt-2 text-red-500";
            document.getElementById('kpi-caixa').className = "text-3xl font-black text-red-600 dark:text-red-500";
        }

        document.getElementById('kpi-receber').innerText = formatarReal(totalRaloAtrasado);
        document.getElementById('kpi-pagar').innerText = formatarReal(totalPagarMes);
        document.getElementById('kpi-ticket').innerText = formatarReal(ticketMedio);

        // ==========================================
        // DESENHAR GRÁFICOS (ZONA 2)
        // ==========================================
        window.desenharGraficos(totalCaixaRecebido, totalCaixaPago, receitaPatio, receitaLab);

        // Guarda os dados brutos para o Bot da IA ler
        window.dadosGeraisIA = { saldoReal, totalRaloAtrasado, totalPagarMes, receitaPatio, receitaLab };

    } catch (e) {
        console.error("Erro no Business Intelligence:", e);
        if(window.mostrarToast) window.mostrarToast("Falha ao calcular métricas de BI.", "erro");
    }
};

// =========================================================================
// 3. ENGENHARIA DE GRÁFICOS (CHART.JS)
// =========================================================================
window.desenharGraficos = function(receitas, despesas, patio, lab) {
    // Cores de Acordo com o Tema Claro/Escuro
    const textoCor = document.documentElement.classList.contains('dark') ? '#9ca3af' : '#4b5563';
    const gridCor = document.documentElement.classList.contains('dark') ? '#334155' : '#e5e7eb';

    // 1. Gráfico de Caixa (Barras)
    const ctxCaixa = document.getElementById('grafico-caixa');
    if (window.graficoCaixa) window.graficoCaixa.destroy(); // Destrói o fantasma anterior

    window.graficoCaixa = new Chart(ctxCaixa, {
        type: 'bar',
        data: {
            labels: ['Mês Analisado'], // Numa V2, mapeamos os 6 meses aqui
            datasets: [
                { label: 'Entradas (Faturado)', data: [receitas], backgroundColor: '#10b981', borderRadius: 6 },
                { label: 'Saídas (Custos)', data: [despesas], backgroundColor: '#ef4444', borderRadius: 6 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                y: { grid: { color: gridCor }, ticks: { color: textoCor } },
                x: { grid: { display: false }, ticks: { color: textoCor } }
            },
            plugins: { legend: { labels: { color: textoCor, font: { weight: 'bold' } } } }
        }
    });

    // 2. O Ringue: Pátio vs Lab (Doughnut)
    const ctxArena = document.getElementById('grafico-arena');
    if (window.graficoArena) window.graficoArena.destroy();

    // Se tudo for zero, dá um pequeno valor fantasma só para o gráfico não sumir da tela
    const valPatio = patio === 0 && lab === 0 ? 1 : patio;
    const valLab = patio === 0 && lab === 0 ? 1 : lab;

    window.graficoArena = new Chart(ctxArena, {
        type: 'doughnut',
        data: {
            labels: ['Pátio de Execução', 'Laboratório'],
            datasets: [{
                data: [valPatio, valLab],
                backgroundColor: ['#1a428a', '#facc15'],
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '70%',
            plugins: { legend: { position: 'bottom', labels: { color: textoCor, font: { weight: 'bold' }, padding: 20 } } }
        }
    });
};

// =========================================================================
// 4. O AGENTE DE IA (Preparação para Python / LLM)
// =========================================================================
window.gerarRelatorioIA = function() {
    const btn = document.getElementById('btn-ia');
    const box = document.getElementById('resultado-ia');
    const dados = window.dadosGeraisIA || { saldoReal: 0, totalRaloAtrasado: 0, totalPagarMes: 0, receitaPatio: 0, receitaLab: 0 };
    
    btn.innerText = "A analisar dados...";
    btn.classList.add('animate-pulse');
    box.classList.remove('hidden');
    box.innerHTML = `<span class="text-yellow-500 font-bold animate-pulse">Iniciando motor analítico... Mapeando buracos financeiros...</span>`;

    // Simulação do tempo de resposta de uma API Python/OpenAI (2.5 segundos)
    setTimeout(() => {
        btn.innerText = "Atualizar Diagnóstico";
        btn.classList.remove('animate-pulse');
        
        const raloRatio = dados.totalRaloAtrasado > 0 ? (dados.totalRaloAtrasado / (dados.saldoReal + dados.totalRaloAtrasado)) * 100 : 0;
        let alertaPatio = dados.receitaPatio < dados.receitaLab ? "O Pátio está a faturar menos que o Laboratório." : "O Pátio é o principal trator de receitas desta operação.";
        let conclusao = dados.saldoReal < 0 ? "AÇÃO IMEDIATA: Estancar a sangria. Foque em cobrar os R$ " + dados.totalRaloAtrasado.toLocaleString('pt-BR') + " que estão na rua antes de fechar qualquer setor." : "Operação estabilizada. O fluxo de caixa suporta as obrigações atuais.";

        // Este é o formato que a sua futura API em Python devolverá!
        const textoIA = `
            <div class="space-y-3">
                <p><span class="text-white font-black">DIAGNÓSTICO EXECUTIVO (CFO DIGITAL)</span></p>
                <p>Comandante, os números não mentem. O nosso saldo operacional atual aponta para <b class="${dados.saldoReal < 0 ? 'text-red-400' : 'text-green-400'}">R$ ${dados.saldoReal.toLocaleString('pt-BR')}</b>.</p>
                <p>O foco do seu chefe no encerramento do Pátio pode ser precipitado. Os dados mostram que ${alertaPatio} O verdadeiro "sangramento" invisível está na inadimplência: temos <b class="text-red-400">R$ ${dados.totalRaloAtrasado.toLocaleString('pt-BR')}</b> retidos ("O Ralo").</p>
                <p class="border-l-4 border-yellow-500 pl-3 mt-4 text-white font-medium bg-white/5 py-2 pr-2">${conclusao}</p>
            </div>
        `;

        box.innerHTML = textoIA;
        
        if (window.registrarLog) window.registrarLog('Dashboard', 'Gerou Relatório IA (CFO)', '');
        
    }, 2500);
};
