// JS/modules/pagar.js
import { supabase } from './config.js';

// Variáveis de Memória Tática
window.dadosPagarGerais = [];
window.abaPagarAtual = 'Pendente'; 

// =========================================================================
// 1. CARREGAMENTO DO BANCO DE DADOS
// =========================================================================
window.carregarContasPagar = async function() {
    const tbody = document.getElementById('tabela-dados-pagar');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="text-center p-8 text-gray-400 font-bold italic">Sincronizando livro de despesas...</td></tr>';

    try {
        const { data, error } = await supabase
            .from('contas_pagar')
            .select('*')
            .order('vencimento', { ascending: true }); // Ordena do que vence primeiro

        if (error) throw error;
        
        window.dadosPagarGerais = data || [];
        window.renderizarPagar();

    } catch (err) {
        console.error("ERRO AO CARREGAR CONTAS A PAGAR:", err);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center p-8 text-red-500 font-bold">Erro ao carregar despesas.</td></tr>';
    }
};

// =========================================================================
// 2. MOTOR DE RENDERIZAÇÃO E FILTROS
// =========================================================================
window.mudarAbaPagar = function(status) {
    window.abaPagarAtual = status;
    const btnPendente = document.getElementById('btn-tab-pagar-pendente');
    const btnPago = document.getElementById('btn-tab-pagar-pago');

    if (status === 'Pendente') {
        btnPendente.className = "flex-1 lg:flex-initial px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-150 bg-[#1a428a] text-white shadow-sm";
        btnPago.className = "flex-1 lg:flex-initial px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-150 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white bg-transparent";
    } else {
        btnPago.className = "flex-1 lg:flex-initial px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-150 bg-[#1a428a] text-white shadow-sm";
        btnPendente.className = "flex-1 lg:flex-initial px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-150 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white bg-transparent";
    }
    
    window.renderizarPagar();
};

window.renderizarPagar = function() {
    const tbody = document.getElementById('tabela-dados-pagar');
    if (!tbody) return;

    const textoBusca = (document.getElementById('filtro-busca-pagar')?.value || '').toLowerCase().trim();
    const contaFiltro = document.getElementById('filtro-conta-pagar')?.value || 'TODAS';

    let totalPendente = 0;
    let totalPago = 0;

    // Calcula os totais globais (ignora o filtro de texto, mas respeita a conta)
    window.dadosPagarGerais.forEach(conta => {
        if (contaFiltro === 'TODAS' || conta.conta_origem === contaFiltro) {
            if (conta.status === 'Pendente') totalPendente += Number(conta.valor);
            if (conta.status === 'Pago') totalPago += Number(conta.valor);
        }
    });

    // Atualiza os Cards Superiores
    const elPendente = document.getElementById('card-pagar-pendente');
    const elPago = document.getElementById('card-pagar-pago');
    if(elPendente) elPendente.innerText = `R$ ${totalPendente.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    if(elPago) elPago.innerText = `R$ ${totalPago.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;

    // Filtro da Tabela
    let dadosFiltrados = window.dadosPagarGerais.filter(conta => {
        const bateAba = conta.status === window.abaPagarAtual;
        const bateConta = (contaFiltro === 'TODAS' || conta.conta_origem === contaFiltro);
        
        let bateTexto = true;
        if (textoBusca) {
            const fornecedor = String(conta.fornecedor || '').toLowerCase();
            const desc = String(conta.descricao || '').toLowerCase();
            const doc = String(conta.numero_documento || '').toLowerCase();
            bateTexto = fornecedor.includes(textoBusca) || desc.includes(textoBusca) || doc.includes(textoBusca);
        }

        return bateAba && bateConta && bateTexto;
    });

    if (dadosFiltrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center p-8 text-gray-400 font-bold italic">Nenhuma despesa ${window.abaPagarAtual === 'Pendente' ? 'pendente' : 'paga'} encontrada.</td></tr>`;
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

        const fornecedorFmt = String(conta.fornecedor || '---').toUpperCase();
        const descFmt = String(conta.descricao || '---').toUpperCase();
        const docFmt = String(conta.numero_documento || 'S/N');
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
                <button onclick="window.darBaixaPagar(${conta.id})" class="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black uppercase rounded-lg shadow-sm transition-transform hover:scale-105 duration-150 mr-2">
                    Pagar
                </button>
                <button onclick="window.excluirPagar(${conta.id})" class="text-red-400 hover:text-red-600 font-black text-lg transition-colors p-1" title="Excluir">
                    &times;
                </button>
            `;
        } else {
            btnAcao = `
                <button onclick="window.estornarPagar(${conta.id})" class="px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-black uppercase rounded-lg shadow-sm transition-transform hover:scale-105 duration-150">
                    Estornar
                </button>
            `;
        }

        return `
            <tr class="hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-150 border-b border-gray-100 dark:border-gray-700">
                <td class="p-4">
                    <span class="block text-xs font-black text-gray-800 dark:text-white uppercase">${fornecedorFmt}</span>
                    <span class="block text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 uppercase">${descFmt}</span>
                </td>
                <td class="p-4 text-center font-mono font-bold text-gray-600 dark:text-gray-400 text-xs">${docFmt}</td>
                <td class="p-4 text-center font-mono font-bold text-sm ${corVencimento}">${dataFormatada}</td>
                <td class="p-4 text-center">
                    <span class="block text-xs font-black text-gray-700 dark:text-gray-300 uppercase">${conta.operacao}</span>
                    <span class="block text-[10px] text-gray-500 mt-0.5">${conta.conta_origem}</span>
                </td>
                <td class="p-4 text-right font-mono font-black text-red-600 dark:text-red-400 text-sm">R$ ${valorFmt}</td>
                <td class="p-4 text-center whitespace-nowrap">${btnAcao}</td>
            </tr>
        `;
    }).join('');
};

// =========================================================================
// 3. AÇÕES DE TESOURARIA (BAIXA, ESTORNO E EXCLUSÃO)
// =========================================================================
window.darBaixaPagar = async function(id) {
    const confirmou = await window.abrirConfirmacao("Confirmar Pagamento", "Deseja liquidar esta despesa no sistema?", "sucesso");
    if (!confirmou) return;

    try {
        const { error } = await supabase.from('contas_pagar').update({ status: 'Pago' }).eq('id', id);
        if (error) throw error;
        
        if (window.mostrarToast) window.mostrarToast("Despesa liquidada!", "sucesso");
        window.carregarContasPagar(); 
    } catch (err) {
        console.error("ERRO AO DAR BAIXA:", err);
        if (window.mostrarToast) window.mostrarToast("Erro ao confirmar pagamento.", "erro");
    }
};

window.estornarPagar = async function(id) {
    const confirmou = await window.abrirConfirmacao("Estornar Despesa", "Deseja voltar esta despesa para o status PENDENTE?", "perigo");
    if (!confirmou) return;

    try {
        const { error } = await supabase.from('contas_pagar').update({ status: 'Pendente' }).eq('id', id);
        if (error) throw error;
        
        if (window.mostrarToast) window.mostrarToast("Estorno realizado com sucesso!", "info");
        window.carregarContasPagar(); 
    } catch (err) {
        console.error("ERRO AO ESTORNAR:", err);
        if (window.mostrarToast) window.mostrarToast("Erro ao realizar o estorno.", "erro");
    }
};

window.excluirPagar = async function(id) {
    const confirmou = await window.abrirConfirmacao("Excluir Lançamento", "Tem certeza que deseja apagar este lançamento permanentemente?", "perigo");
    if (!confirmou) return;

    try {
        const { error } = await supabase.from('contas_pagar').delete().eq('id', id);
        if (error) throw error;
        
        if (window.mostrarToast) window.mostrarToast("Lançamento excluído!", "sucesso");
        window.carregarContasPagar(); 
    } catch (err) {
        console.error("ERRO AO EXCLUIR:", err);
        if (window.mostrarToast) window.mostrarToast("Erro ao excluir lançamento.", "erro");
    }
};

// =========================================================================
// 4. GESTÃO DO MODAL DE NOVA DESPESA (LANÇAMENTO AVULSO)
// =========================================================================
window.abrirModalNovoPagar = function() {
    const form = document.getElementById('form-novo-pagar');
    if (form) form.reset();
    
    // Define a data de vencimento como hoje por padrão
    const hoje = new Date();
    hoje.setMinutes(hoje.getMinutes() - hoje.getTimezoneOffset());
    const inputVenc = document.getElementById('pagar-vencimento');
    if(inputVenc) inputVenc.value = hoje.toISOString().split('T')[0];

    const modal = document.getElementById('modal-pagar');
    if(modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
};

window.salvarNovaDespesa = async function(event) {
    event.preventDefault();

    const getVal = (id) => document.getElementById(id)?.value || '';

    const valorRaw = getVal('pagar-valor');
    const valorNum = parseFloat(valorRaw.replace(/\./g, '').replace(',', '.')) || 0;

    if (valorNum <= 0) {
        if (window.mostrarToast) window.mostrarToast("O valor da despesa tem de ser maior que zero.", "aviso");
        return;
    }

    const dadosDespesa = {
        fornecedor: getVal('pagar-fornecedor').trim().toUpperCase(),
        descricao: getVal('pagar-descricao').trim().toUpperCase(),
        numero_documento: getVal('pagar-documento').trim().toUpperCase(),
        vencimento: getVal('pagar-vencimento'),
        conta_origem: getVal('pagar-conta'),
        operacao: getVal('pagar-operacao'),
        valor: valorNum,
        status: 'Pendente'
    };

    try {
        const { error } = await supabase.from('contas_pagar').insert([dadosDespesa]);
        if (error) throw error;

        if (window.mostrarToast) window.mostrarToast("Despesa registada com sucesso!", "sucesso");
        
        const modal = document.getElementById('modal-pagar');
        if(modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
        
        window.carregarContasPagar();
    } catch (err) {
        console.error("FALHA AO INSERIR DESPESA:", err);
        if (window.mostrarToast) window.mostrarToast("Erro ao gravar despesa. Limpe o Cache do Supabase.", "erro");
    }
};

// Se não existir mascaraValorItem global, cria localmente
if(typeof window.mascaraValorItem !== 'function') {
    window.mascaraValorItem = function(input) {
        if(!input) return;
        let v = input.value.replace(/\D/g, '');
        if (v === "") { input.value = ""; return; }
        input.value = (parseInt(v, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };
}
