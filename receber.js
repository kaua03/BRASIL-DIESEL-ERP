// JS/modules/receber.js
import { supabase } from './config.js';

// Variáveis de Memória Tática
window.dadosReceberGerais = [];
window.abaReceberAtual = 'Pendente'; 

// =========================================================================
// 1. CARREGAMENTO DO BANCO DE DADOS
// =========================================================================
window.carregarContasReceber = async function() {
    const tbody = document.getElementById('tabela-dados-receber');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" class="text-center p-8 text-gray-400 font-bold italic">Sincronizando com o cofre...</td></tr>';

    try {
        const { data, error } = await supabase
            .from('contas_receber')
            .select('*')
            .order('vencimento', { ascending: true }); // Ordena do que vence primeiro

        if (error) throw error;
        
        window.dadosReceberGerais = data || [];
        window.renderizarReceber();

    } catch (err) {
        console.error("ERRO AO CARREGAR FINANCEIRO:", err);
        tbody.innerHTML = '<tr><td colspan="7" class="text-center p-8 text-red-500 font-bold">Erro ao carregar dados financeiros.</td></tr>';
    }
};

// =========================================================================
// 2. MOTOR DE RENDERIZAÇÃO E FILTROS
// =========================================================================
window.mudarAbaReceber = function(status) {
    window.abaReceberAtual = status;
    const btnPendente = document.getElementById('btn-tab-pendente');
    const btnRecebido = document.getElementById('btn-tab-recebido');

    if (status === 'Pendente') {
        btnPendente.className = "flex-1 sm:flex-initial px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-150 bg-[#1a428a] text-white shadow-sm";
        btnRecebido.className = "flex-1 sm:flex-initial px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-150 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white bg-transparent";
    } else {
        btnRecebido.className = "flex-1 sm:flex-initial px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-150 bg-[#1a428a] text-white shadow-sm";
        btnPendente.className = "flex-1 sm:flex-initial px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-150 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white bg-transparent";
    }
    
    window.renderizarReceber();
};

window.renderizarReceber = function() {
    const tbody = document.getElementById('tabela-dados-receber');
    if (!tbody) return;

    const textoBusca = (document.getElementById('filtro-busca-receber')?.value || '').toLowerCase().trim();
    const contaFiltro = document.getElementById('filtro-conta-receber')?.value || 'TODAS';

    let totalPendente = 0;
    let totalRecebido = 0;

    // Calcula os totais globais (ignora o filtro de texto, mas respeita a conta)
    window.dadosReceberGerais.forEach(conta => {
        if (contaFiltro === 'TODAS' || conta.conta_destino === contaFiltro) {
            if (conta.status === 'Pendente') totalPendente += Number(conta.valor);
            if (conta.status === 'Recebido') totalRecebido += Number(conta.valor);
        }
    });

    // Atualiza os Cards Superiores
    const elPendente = document.getElementById('card-total-pendente');
    const elRecebido = document.getElementById('card-total-recebido');
    if(elPendente) elPendente.innerText = `R$ ${totalPendente.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    if(elRecebido) elRecebido.innerText = `R$ ${totalRecebido.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;

    // Filtro da Tabela
    let dadosFiltrados = window.dadosReceberGerais.filter(conta => {
        const bateAba = conta.status === window.abaReceberAtual;
        const bateConta = (contaFiltro === 'TODAS' || conta.conta_destino === contaFiltro);
        
        let bateTexto = true;
        if (textoBusca) {
            const cliente = String(conta.cliente || '').toLowerCase();
            const placa = String(conta.placa || '').toLowerCase();
            const osId = String(conta.os_id || '').toLowerCase();
            bateTexto = cliente.includes(textoBusca) || placa.includes(textoBusca) || osId.includes(textoBusca);
        }

        return bateAba && bateConta && bateTexto;
    });

    if (dadosFiltrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center p-8 text-gray-400 font-bold italic">Nenhum lançamento ${window.abaReceberAtual.toLowerCase()} encontrado.</td></tr>`;
        return;
    }

    tbody.innerHTML = dadosFiltrados.map(conta => {
        // Datas Formatadas
        let dataFormatada = '---';
        if (conta.vencimento) {
            const d = new Date(conta.vencimento);
            d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
            dataFormatada = d.toLocaleDateString('pt-BR');
        }

        const numOs = String(conta.os_id || '---').padStart(4, '0');
        const placaFmt = String(conta.placa || '---');
        const clienteFmt = String(conta.cliente || 'CLIENTE AVULSO');
        const valorFmt = Number(conta.valor).toLocaleString('pt-BR', {minimumFractionDigits: 2});
        
        // Verifica se a data de vencimento já passou para pintar de vermelho
        const hoje = new Date();
        hoje.setHours(0,0,0,0);
        const dataVenc = new Date(conta.vencimento);
        dataVenc.setMinutes(dataVenc.getMinutes() + dataVenc.getTimezoneOffset());
        dataVenc.setHours(0,0,0,0);
        
        const taAtrasado = (conta.status === 'Pendente' && dataVenc < hoje);
        const corVencimento = taAtrasado ? 'text-red-600 dark:text-red-400 animate-pulse' : 'text-gray-600 dark:text-gray-400';

        // Lógica de Botão de Ação Tática
        let btnAcao = '';
        if (conta.status === 'Pendente') {
            btnAcao = `
                <button onclick="window.darBaixaReceber(${conta.id})" class="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black uppercase rounded-lg shadow-sm transition-transform hover:scale-105 duration-150">
                    Dar Baixa
                </button>
            `;
        } else {
            btnAcao = `
                <button onclick="window.estornarReceber(${conta.id})" class="px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-black uppercase rounded-lg shadow-sm transition-transform hover:scale-105 duration-150">
                    Estornar
                </button>
            `;
        }

        return `
            <tr class="hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-150 border-b border-gray-100 dark:border-gray-700">
                <td class="p-4 text-center">
                    <span class="text-xs font-black text-gray-500 dark:text-gray-400">#${numOs}</span>
                    <span class="block text-[9px] text-gray-400 uppercase mt-0.5">Parc: ${conta.numero_parcela}</span>
                </td>
                <td class="p-4 font-bold text-gray-800 dark:text-white text-xs uppercase">${clienteFmt}</td>
                <td class="p-4 text-center font-black text-[#1a428a] dark:text-blue-400 text-sm tracking-widest">${placaFmt}</td>
                <td class="p-4 text-center font-mono font-bold text-sm ${corVencimento}">${dataFormatada}</td>
                <td class="p-4 text-center">
                    <span class="block text-xs font-black text-gray-700 dark:text-gray-300 uppercase">${conta.operacao}</span>
                    <span class="block text-[10px] text-gray-500 mt-0.5">${conta.conta_destino}</span>
                </td>
                <td class="p-4 text-right font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">R$ ${valorFmt}</td>
                <td class="p-4 text-center">${btnAcao}</td>
            </tr>
        `;
    }).join('');
};

// =========================================================================
// 3. AÇÕES DE TESOURARIA (BAIXA E ESTORNO)
// =========================================================================
window.darBaixaReceber = async function(id) {
    const confirmou = await window.abrirConfirmacao("Confirmar Recebimento", "Deseja dar baixa nesta parcela no cofre?", "sucesso");
    if (!confirmou) return;

    try {
        const { error } = await supabase.from('contas_receber').update({ status: 'Recebido' }).eq('id', id);
        if (error) throw error;
        
        if (window.mostrarToast) window.mostrarToast("Recebimento confirmado!", "sucesso");
        window.carregarContasReceber(); // Recarrega os dados e a tabela
    } catch (err) {
        console.error("ERRO AO DAR BAIXA:", err);
        if (window.mostrarToast) window.mostrarToast("Erro ao confirmar recebimento.", "erro");
    }
};

window.estornarReceber = async function(id) {
    const confirmou = await window.abrirConfirmacao("Estornar Parcela", "Deseja remover do cofre e voltar a parcela para PENDENTE?", "perigo");
    if (!confirmou) return;

    try {
        const { error } = await supabase.from('contas_receber').update({ status: 'Pendente' }).eq('id', id);
        if (error) throw error;
        
        if (window.mostrarToast) window.mostrarToast("Estorno realizado com sucesso!", "info");
        window.carregarContasReceber(); // Recarrega os dados e a tabela
    } catch (err) {
        console.error("ERRO AO ESTORNAR:", err);
        if (window.mostrarToast) window.mostrarToast("Erro ao realizar o estorno.", "erro");
    }
};
