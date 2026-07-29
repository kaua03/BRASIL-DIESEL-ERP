// JS/modules/pagar.js
import { supabase } from './config.js';

window.dadosPagarGerais = [];
window.abaPagarAtual = 'Pendente'; 
window.vigilanciaPagarAtiva = false; 

// Sistema de Memória para Seleção
window.pagarIdsSelecionados = new Set();
window.pagarIdsFiltradosTela = []; 

// Variável para armazenar as parcelas temporárias do XML
window.parcelasXmlTemporarias = [];

// Normalizador para buscas sem acentos
const removerAcentos = (str) => {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

// =========================================================================
// 1. CARREGAMENTO E VIGILÂNCIA REALTIME
// =========================================================================

window.ativarVigilanciaPagar = function() {
    if (window.vigilanciaPagarAtiva) return;
    window.vigilanciaPagarAtiva = true;

    supabase.channel('vigilancia-pagar')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'contas_pagar' }, payload => {
            const tbody = document.getElementById('tabela-dados-pagar');
            if (tbody) {
                console.log('📡 [Tesouraria] Atualização Externa em Contas a Pagar!');
                window.carregarContasPagar(true); 
            }
        })
        .subscribe();
};

window.carregarContasPagar = async function(isSilencioso = false) {
    const tbody = document.getElementById('tabela-dados-pagar');
    if (!tbody) return;

    if (!isSilencioso) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center p-8 text-gray-400 font-bold italic">Sincronizando livro de despesas...</td></tr>';
    }

    window.ativarVigilanciaPagar(); 

    try {
        const { data, error } = await supabase
            .from('contas_pagar')
            .select('*')
            .order('vencimento', { ascending: true }); 

        if (error) throw error;
        
        window.dadosPagarGerais = data || [];
        window.renderizarPagar();

    } catch (err) {
        console.error("ERRO AO CARREGAR FINANCEIRO PAGAR:", err);
        if (!isSilencioso) tbody.innerHTML = '<tr><td colspan="7" class="text-center p-8 text-red-500 font-bold">Erro de conexão ao banco.</td></tr>';
    }
};

// =========================================================================
// 2. NAVEGAÇÃO E MOTOR DE RENDERIZAÇÃO
// =========================================================================

window.mudarAbaPagar = function(status) {
    window.abaPagarAtual = status;
    window.pagarIdsSelecionados.clear(); 
    
    const btnPendente = document.getElementById('btn-tab-pagar-pendente');
    const btnPago = document.getElementById('btn-tab-pagar-pago');

    if (status === 'Pendente') {
        btnPendente.className = "flex-1 sm:flex-initial px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-150 bg-[#1a428a] text-white shadow-sm";
        btnPago.className = "flex-1 sm:flex-initial px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-150 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white bg-transparent";
    } else {
        btnPago.className = "flex-1 sm:flex-initial px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-150 bg-[#1a428a] text-white shadow-sm";
        btnPendente.className = "flex-1 sm:flex-initial px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-150 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white bg-transparent";
    }
    
    window.renderizarPagar();
};

window.renderizarPagar = function() {
    const tbody = document.getElementById('tabela-dados-pagar');
    if (!tbody) return;

    const textoBuscaBruto = (document.getElementById('filtro-busca-pagar')?.value || '').trim();
    const textoBusca = removerAcentos(textoBuscaBruto);
    const contaFiltro = document.getElementById('filtro-conta-pagar')?.value || 'TODAS';

    let totalPendente = 0;
    let totalPago = 0;

    window.dadosPagarGerais.forEach(conta => {
        if (contaFiltro === 'TODAS' || conta.conta_origem === contaFiltro) {
            if (conta.status === 'Pendente') totalPendente += Number(conta.valor);
            if (conta.status === 'Pago') totalPago += Number(conta.valor);
        }
    });

    const elPendente = document.getElementById('card-pagar-pendente');
    const elPago = document.getElementById('card-pagar-pago');
    if(elPendente) elPendente.innerText = `R$ ${totalPendente.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    if(elPago) elPago.innerText = `R$ ${totalPago.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;

    let dadosFiltrados = window.dadosPagarGerais.filter(conta => {
        const bateAba = conta.status === window.abaPagarAtual;
        const bateConta = (contaFiltro === 'TODAS' || conta.conta_origem === contaFiltro);
        
        let bateTexto = true;
        if (textoBusca) {
            const forn = removerAcentos(String(conta.fornecedor || ''));
            const desc = removerAcentos(String(conta.descricao || ''));
            const doc = removerAcentos(String(conta.numero_documento || ''));
            const op = removerAcentos(String(conta.operacao || ''));
            const orig = removerAcentos(String(conta.conta_origem || ''));
            
            bateTexto = forn.includes(textoBusca) || desc.includes(textoBusca) || doc.includes(textoBusca) || op.includes(textoBusca) || orig.includes(textoBusca);
        }
        return bateAba && bateConta && bateTexto;
    });

    window.pagarIdsFiltradosTela = dadosFiltrados.map(c => c.id);
    window.atualizarInterfaceExclusaoMassaPagar();

    if (dadosFiltrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center p-8 text-gray-400 font-bold italic">Nenhuma despesa ${window.abaPagarAtual.toLowerCase()} encontrada.</td></tr>`;
        return;
    }

    tbody.innerHTML = dadosFiltrados.map(conta => {
        const fornecedorFmt = String(conta.fornecedor || '---').toUpperCase();
        const descFmt = String(conta.descricao || '---').toUpperCase();
        const docFmt = String(conta.numero_documento || 'S/N');
        const valorFmt = Number(conta.valor).toLocaleString('pt-BR', {minimumFractionDigits: 2});
        
        // 🔴 MOTOR VISUAL DE ALERTAS DE VENCIMENTO 🔴
        let dataFormatada = '---';
        let statusVencimentoVisual = '<span class="text-gray-600 dark:text-gray-400">---</span>';

        if (conta.vencimento) {
            const hoje = new Date();
            hoje.setHours(0,0,0,0);
            
            const [anoVenc, mesVenc, diaVenc] = conta.vencimento.split('-');
            const dataVenc = new Date(anoVenc, mesVenc - 1, diaVenc); 
            
            dataFormatada = dataVenc.toLocaleDateString('pt-BR');
            
            if (conta.status === 'Pendente') {
                const diffTime = dataVenc.getTime() - hoje.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays < 0) {
                    statusVencimentoVisual = `<span class="text-red-600 dark:text-red-400 font-black animate-pulse flex items-center justify-center gap-1">🚨 ${dataFormatada}</span><span class="text-[9px] text-red-500 block uppercase mt-0.5">Atrasado</span>`;
                } else if (diffDays === 0) {
                    statusVencimentoVisual = `<span class="text-orange-600 dark:text-orange-500 font-black flex items-center justify-center gap-1">⚠️ ${dataFormatada}</span><span class="text-[9px] text-orange-500 block uppercase mt-0.5">Vence Hoje</span>`;
                } else if (diffDays <= 3) {
                    statusVencimentoVisual = `<span class="text-amber-500 dark:text-amber-400 font-bold flex items-center justify-center gap-1">⚠️ ${dataFormatada}</span><span class="text-[9px] text-amber-500 block uppercase mt-0.5">Vence em ${diffDays} d</span>`;
                } else {
                    statusVencimentoVisual = `<span class="text-gray-700 dark:text-gray-300 font-bold">${dataFormatada}</span>`;
                }
            } else {
                statusVencimentoVisual = `<span class="text-gray-500 font-bold">${dataFormatada}</span>`;
            }
        }

        // Botoes Táticos Quadrados e Alinhados
        let btnBaixa = '';
        if (conta.status === 'Pendente') {
            btnBaixa = `
                <button onclick="window.darBaixaPagar(${conta.id}, this)" class="w-8 h-8 flex items-center justify-center bg-emerald-500 hover:bg-emerald-600 text-white rounded transition-all duration-150" title="Liquidar Despesa">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
                </button>
            `;
        } else {
            btnBaixa = `
                <button onclick="window.estornarPagar(${conta.id}, this)" class="w-8 h-8 flex items-center justify-center bg-gray-500 hover:bg-gray-600 text-white rounded transition-all duration-150" title="Estornar">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                </button>
            `;
        }

        const btnEditarIndiv = `
            <button onclick="window.abrirModalEditarPagar(${conta.id})" class="w-8 h-8 flex items-center justify-center bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-800/50 text-amber-600 dark:text-amber-400 rounded transition-all duration-150" title="Editar Despesa">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            </button>
        `;

        const btnExcluirIndiv = `
            <button onclick="window.excluirPagarIndividual(${conta.id}, this)" class="w-8 h-8 flex items-center justify-center bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-800/50 text-red-600 dark:text-red-400 rounded transition-all duration-150" title="Apagar Despesa">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
        `;

        const isChecked = window.pagarIdsSelecionados.has(conta.id) ? 'checked' : '';

        return `
            <tr class="border-b border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-[#0f172a] transition-all duration-150">
                <td class="p-4 text-center border-r border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-[#0f172a]/50">
                    <input type="checkbox" value="${conta.id}" onchange="window.toggleCheckContaPagar(${conta.id}, this)" class="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-600 cursor-pointer bg-white dark:bg-gray-700" ${isChecked}>
                </td>
                <td class="p-4">
                    <span class="block text-xs font-black text-gray-800 dark:text-white uppercase truncate max-w-[250px]" title="${fornecedorFmt}">${fornecedorFmt}</span>
                    <span class="block text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 uppercase truncate max-w-[250px]" title="${descFmt}">${descFmt}</span>
                </td>
                <td class="p-4 text-center font-mono font-bold text-gray-600 dark:text-gray-400 text-xs">${docFmt}</td>
                <td class="p-4 text-center font-mono">
                    ${statusVencimentoVisual}
                </td>
                <td class="p-4 text-center">
                    <span class="block text-xs font-black text-gray-700 dark:text-gray-300 uppercase">${conta.operacao}</span>
                    <span class="block text-[10px] text-gray-500 mt-0.5">${conta.conta_origem}</span>
                </td>
                <td class="p-4 text-right font-mono font-black text-red-600 dark:text-red-400 text-sm whitespace-nowrap">R$ ${valorFmt}</td>
                <td class="p-4 text-center">
                    <div class="flex items-center justify-center gap-1.5">
                        ${btnBaixa}
                        ${btnEditarIndiv}
                        ${btnExcluirIndiv}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
};

// =========================================================================
// 3. SISTEMA DE SELEÇÃO E EXCLUSÃO (MÚLTIPLA E INDIVIDUAL)
// =========================================================================

window.toggleCheckContaPagar = function(id, el) {
    if (el.checked) window.pagarIdsSelecionados.add(id);
    else window.pagarIdsSelecionados.delete(id);
    window.atualizarInterfaceExclusaoMassaPagar();
};

window.atualizarInterfaceExclusaoMassaPagar = function() {
    const btnMassa = document.getElementById('btn-excluir-massa-pagar');
    const spanQtd = document.getElementById('qtd-selecionadas-pagar');
    const totalSelecionado = window.pagarIdsSelecionados.size;

    if (btnMassa && spanQtd) {
        spanQtd.innerText = totalSelecionado;
        if (totalSelecionado > 0) btnMassa.classList.remove('hidden');
        else btnMassa.classList.add('hidden');
    }
};

window.excluirContasPagarMassa = async function() {
    const total = window.pagarIdsSelecionados.size;
    if (total === 0) return;

    const confirmou = await window.abrirConfirmacao("Exclusão em Massa", `Deseja apagar DEFINITIVAMENTE as ${total} despesas selecionadas?`, "perigo");
    if (!confirmou) return;

    const btnMassa = document.getElementById('btn-excluir-massa-pagar');
    if (btnMassa) {
        btnMassa.innerHTML = `<svg class="animate-spin h-4 w-4 text-white inline-block mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> EXCLUINDO...`;
        btnMassa.disabled = true;
        btnMassa.classList.add('opacity-70', 'cursor-not-allowed');
    }

    try {
        const idsArray = Array.from(window.pagarIdsSelecionados);
        const { error } = await supabase.from('contas_pagar').delete().in('id', idsArray);
        if (error) throw error;
        
        window.pagarIdsSelecionados.clear();
        if (window.mostrarToast) window.mostrarToast(`${total} despesas eliminadas!`, "sucesso");
        setTimeout(() => window.carregarContasPagar(true), 600);
    } catch (err) {
        console.error("ERRO NA EXCLUSÃO EM MASSA:", err);
        if (window.mostrarToast) window.mostrarToast("Erro ao excluir despesas.", "erro");
        window.carregarContasPagar(true); 
    }
};

window.excluirPagarIndividual = async function(id, btnElement) {
    const confirmou = await window.abrirConfirmacao("Excluir Lançamento", "Apagar permanentemente esta despesa?", "perigo");
    if (!confirmou) return;

    if (btnElement) {
        btnElement.innerHTML = `<svg class="animate-spin h-4 w-4 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
        const tr = btnElement.closest('tr');
        if (tr) tr.classList.add('bg-red-50', 'dark:bg-red-900/20', 'opacity-50');
    }

    try {
        const { error } = await supabase.from('contas_pagar').delete().eq('id', id);
        if (error) throw error;
        
        window.pagarIdsSelecionados.delete(id);
        if (window.mostrarToast) window.mostrarToast("Lançamento excluído!", "sucesso");
        setTimeout(() => window.carregarContasPagar(true), 600);
    } catch (err) {
        console.error("ERRO AO EXCLUIR:", err);
        if (window.mostrarToast) window.mostrarToast("Erro ao excluir lançamento.", "erro");
        window.carregarContasPagar(true);
    }
};

// =========================================================================
// 4. EDIÇÃO DIRETA NO BANCO DE DADOS
// =========================================================================

window.abrirModalEditarPagar = function(id) {
    const conta = window.dadosPagarGerais.find(c => c.id === id);
    if (!conta) return;

    document.getElementById('edit-pagar-id').value = conta.id;
    document.getElementById('edit-pagar-fornecedor').value = conta.fornecedor || '';
    document.getElementById('edit-pagar-descricao').value = conta.descricao || '';
    document.getElementById('edit-pagar-doc').value = conta.numero_documento || '';
    document.getElementById('edit-pagar-vencimento').value = conta.vencimento;
    document.getElementById('edit-pagar-conta').value = conta.conta_origem;
    document.getElementById('edit-pagar-operacao').value = conta.operacao;
    document.getElementById('edit-pagar-valor').value = Number(conta.valor).toLocaleString('pt-BR', {minimumFractionDigits: 2});
    
    document.getElementById('modal-editar-pagar').classList.remove('hidden');
    document.getElementById('modal-editar-pagar').classList.add('flex');
};

window.salvarEdicaoPagar = async function(event) {
    if (event) event.preventDefault();
    
    const id = document.getElementById('edit-pagar-id').value;
    const valStr = document.getElementById('edit-pagar-valor').value;
    const valNum = parseFloat(valStr.replace(/\./g, '').replace(',', '.')) || 0;

    const payload = {
        fornecedor: document.getElementById('edit-pagar-fornecedor').value.toUpperCase(),
        descricao: document.getElementById('edit-pagar-descricao').value.toUpperCase(),
        numero_documento: document.getElementById('edit-pagar-doc').value.toUpperCase(),
        vencimento: document.getElementById('edit-pagar-vencimento').value,
        conta_origem: document.getElementById('edit-pagar-conta').value,
        operacao: document.getElementById('edit-pagar-operacao').value,
        valor: valNum
    };

    if (window.mostrarToast) window.mostrarToast("Salvando alterações...", "info");

    try {
        const { error } = await supabase.from('contas_pagar').update(payload).eq('id', id);
        if (error) throw error;
        
        if (window.mostrarToast) window.mostrarToast("Despesa atualizada com sucesso!", "sucesso");
        
        document.getElementById('modal-editar-pagar').classList.add('hidden');
        document.getElementById('modal-editar-pagar').classList.remove('flex');
        
        setTimeout(() => window.carregarContasPagar(true), 600);
    } catch (e) {
        console.error("FALHA AO EDITAR:", e);
        if (window.mostrarToast) window.mostrarToast("Erro crítico ao salvar edição.", "erro");
    }
};

// =========================================================================
// 5. AÇÕES DE TESOURARIA COM CONGELAMENTO VISUAL
// =========================================================================

window.darBaixaPagar = async function(id, btnElement) {
    const confirmou = await window.abrirConfirmacao("Confirmar Pagamento", "Deseja liquidar esta despesa no cofre?", "sucesso");
    if (!confirmou) return;

    if (btnElement) {
        btnElement.innerHTML = `<svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
        btnElement.classList.add('opacity-70', 'cursor-not-allowed');
        btnElement.disabled = true;
        const tr = btnElement.closest('tr');
        if (tr) tr.classList.add('bg-emerald-50', 'dark:bg-emerald-900/20');
    }

    try {
        const { error } = await supabase.from('contas_pagar').update({ status: 'Pago' }).eq('id', id);
        if (error) throw error;
        
        if (window.mostrarToast) window.mostrarToast("Despesa liquidada!", "sucesso");
        setTimeout(() => window.carregarContasPagar(true), 800);
    } catch (err) {
        console.error("ERRO AO DAR BAIXA:", err);
        if (window.mostrarToast) window.mostrarToast("Erro ao confirmar pagamento.", "erro");
        window.carregarContasPagar(true); 
    }
};

window.estornarPagar = async function(id, btnElement) {
    const confirmou = await window.abrirConfirmacao("Estornar Despesa", "Deseja voltar esta despesa para o status PENDENTE?", "perigo");
    if (!confirmou) return;

    if (btnElement) {
        btnElement.innerHTML = `<svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
        btnElement.classList.add('opacity-70', 'cursor-not-allowed');
        btnElement.disabled = true;
        const tr = btnElement.closest('tr');
        if (tr) tr.classList.add('bg-red-50', 'dark:bg-red-900/20');
    }

    try {
        const { error } = await supabase.from('contas_pagar').update({ status: 'Pendente' }).eq('id', id);
        if (error) throw error;
        
        if (window.mostrarToast) window.mostrarToast("Estorno realizado com sucesso!", "info");
        setTimeout(() => window.carregarContasPagar(true), 800);
    } catch (err) {
        console.error("ERRO AO ESTORNAR:", err);
        if (window.mostrarToast) window.mostrarToast("Erro ao realizar o estorno.", "erro");
        window.carregarContasPagar(true);
    }
};

// =========================================================================
// 6. GESTÃO DO MODAL DE NOVA DESPESA MANUAL
// =========================================================================
window.abrirModalNovoPagar = function() {
    const form = document.getElementById('form-novo-pagar');
    if (form) form.reset();
    
    const hoje = new Date();
    hoje.setMinutes(hoje.getMinutes() - hoje.getTimezoneOffset());
    const inputVenc = document.getElementById('pagar-vencimento');
    if(inputVenc) inputVenc.value = hoje.toISOString().split('T')[0];

    document.getElementById('modal-pagar').classList.remove('hidden');
    document.getElementById('modal-pagar').classList.add('flex');
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
        
        document.getElementById('modal-pagar').classList.add('hidden');
        document.getElementById('modal-pagar').classList.remove('flex');
        
        setTimeout(() => window.carregarContasPagar(true), 600);
    } catch (err) {
        console.error("FALHA AO INSERIR DESPESA:", err);
        if (window.mostrarToast) window.mostrarToast("Erro ao gravar despesa.", "erro");
    }
};

// =========================================================================
// 7. A MAGIA DO XML: LEITURA E PROCESSAMENTO DE NFE
// =========================================================================

window.processarXmlNfe = function(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (window.mostrarToast) window.mostrarToast("Lendo ficheiro XML...", "info");

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const xmlString = e.target.result;
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlString, "text/xml");

            // Helper para procurar tags (ignora namespaces chatos do XML da NFe)
            const getTag = (tagName, node = xmlDoc) => {
                const els = node.getElementsByTagName(tagName);
                if (els.length > 0) return els[0].textContent;
                // Tenta com namespace explícito
                const elsNS = node.getElementsByTagNameNS("*", tagName);
                return elsNS.length > 0 ? elsNS[0].textContent : '';
            };

            const fornecedor = getTag('xNome');
            const numNF = getTag('nNF');
            const totalNF = getTag('vNF');
            const dataEmissaoStr = getTag('dhEmi') || getTag('dEmi');

            if (!fornecedor) throw new Error("Ficheiro inválido: Não parece ser um XML de NFe brasileira.");

            // Tenta fatiar a cobrança pelas duplicatas (<dup>)
            const dups = xmlDoc.getElementsByTagName('dup');
            if (dups.length === 0 && xmlDoc.getElementsByTagNameNS) {
                // Fallback para namespace
                const dupsNS = xmlDoc.getElementsByTagNameNS("*", 'dup');
                for(let i=0; i<dupsNS.length; i++) dups.push(dupsNS[i]);
            }

            window.parcelasXmlTemporarias = [];

            if (dups && dups.length > 0) {
                // Se a nota foi parcelada/boleto
                for (let i = 0; i < dups.length; i++) {
                    const d = dups[i];
                    window.parcelasXmlTemporarias.push({
                        parcelaInfo: getTag('nDup', d) || `${i+1}/${dups.length}`,
                        vencimento: getTag('dVenc', d),
                        valor: getTag('vDup', d)
                    });
                }
            } else {
                // Se não tem <dup>, é à vista. Usa o total da nota.
                let dataVencFallback = new Date().toISOString().split('T')[0];
                if (dataEmissaoStr) dataVencFallback = dataEmissaoStr.substring(0, 10); // Pega só YYYY-MM-DD
                
                window.parcelasXmlTemporarias.push({
                    parcelaInfo: 'A Vista / Única',
                    vencimento: dataVencFallback,
                    valor: totalNF || '0.00'
                });
            }

            // Injeta dados na interface do Modal de Revisão
            document.getElementById('xml-fornecedor').value = fornecedor;
            document.getElementById('xml-nota').value = numNF;
            
            const tbodyXml = document.getElementById('tabela-xml-parcelas');
            tbodyXml.innerHTML = window.parcelasXmlTemporarias.map((p, index) => {
                const valorNumerico = parseFloat(p.valor) || 0;
                const valorExibicao = valorNumerico.toLocaleString('pt-BR', {minimumFractionDigits: 2});
                
                return `
                    <tr>
                        <td class="p-3 text-center text-xs font-bold text-gray-500">${p.parcelaInfo}</td>
                        <td class="p-3">
                            <input type="date" id="xml-venc-${index}" value="${p.vencimento}" class="w-full bg-transparent text-center font-mono font-bold text-xs text-gray-800 dark:text-white outline-none border border-gray-200 dark:border-gray-700 rounded p-1">
                        </td>
                        <td class="p-3">
                            <input type="text" id="xml-val-${index}" value="${valorExibicao}" oninput="window.mascaraValorItem(this)" class="w-full bg-transparent text-right font-mono font-black text-indigo-600 dark:text-indigo-400 text-xs outline-none border border-gray-200 dark:border-gray-700 rounded p-1">
                        </td>
                    </tr>
                `;
            }).join('');

            // Abre o Modal de Revisão
            document.getElementById('modal-xml-preview').classList.remove('hidden');
            document.getElementById('modal-xml-preview').classList.add('flex');

        } catch (erroXml) {
            console.error(erroXml);
            if (window.mostrarToast) window.mostrarToast("Erro ao processar o arquivo XML da NFe.", "erro");
        }
    };
    
    reader.readAsText(file);
    event.target.value = ''; // Reseta o input de arquivo
};

window.salvarXmlLote = async function() {
    const fornecedor = document.getElementById('xml-fornecedor').value.toUpperCase();
    const documento = document.getElementById('xml-nota').value.toUpperCase();
    const conta = document.getElementById('xml-conta').value;
    const operacao = document.getElementById('xml-operacao').value;

    let payloadLote = [];

    // Monta o payload buscando os valores que o usuário pode ter corrigido nos inputs
    for (let i = 0; i < window.parcelasXmlTemporarias.length; i++) {
        const parc = window.parcelasXmlTemporarias[i];
        const vVenc = document.getElementById(`xml-venc-${i}`).value;
        const vValStr = document.getElementById(`xml-val-${i}`).value;
        const vValNum = parseFloat(vValStr.replace(/\./g, '').replace(',', '.')) || 0;

        // Cria a string da descrição
        let desc = `REFERENTE NFE ${documento}`;
        if (window.parcelasXmlTemporarias.length > 1) {
            desc += ` - PARC ${parc.parcelaInfo}`;
        }

        payloadLote.push({
            fornecedor: fornecedor,
            descricao: desc,
            numero_documento: documento,
            vencimento: vVenc,
            conta_origem: conta,
            operacao: operacao,
            valor: vValNum,
            status: 'Pendente'
        });
    }

    if (window.mostrarToast) window.mostrarToast(`Injetando ${payloadLote.length} despesa(s) no cofre...`, "info");

    try {
        const { error } = await supabase.from('contas_pagar').insert(payloadLote);
        if (error) throw error;

        if (window.mostrarToast) window.mostrarToast(`XML Processado! ${payloadLote.length} despesa(s) gerada(s).`, "sucesso");
        
        document.getElementById('modal-xml-preview').classList.add('hidden');
        document.getElementById('modal-xml-preview').classList.remove('flex');
        
        setTimeout(() => window.carregarContasPagar(true), 600);
    } catch (err) {
        console.error("ERRO AO SALVAR XML EM LOTE:", err);
        if (window.mostrarToast) window.mostrarToast("Erro crítico ao gravar despesas do XML.", "erro");
    }
};

// Utilitário Global
if(typeof window.mascaraValorItem !== 'function') {
    window.mascaraValorItem = function(input) {
        if(!input) return;
        let v = input.value.replace(/\D/g, '');
        if (v === "") { input.value = ""; return; }
        input.value = (parseInt(v, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };
}
