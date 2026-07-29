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

// Formatadores para a Auditoria XML
const formatarCnpj = (cnpj) => {
    if (!cnpj) return '---';
    return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*/, '$1.$2.$3/$4-$5');
};

const formatarDataIso = (isoStr) => {
    if (!isoStr) return '---';
    try {
        const data = new Date(isoStr);
        return data.toLocaleDateString('pt-BR') + ' às ' + data.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    } catch {
        return isoStr;
    }
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
            const tipoOp = removerAcentos(String(conta.tipo_operacao || ''));
            
            bateTexto = forn.includes(textoBusca) || desc.includes(textoBusca) || doc.includes(textoBusca) || op.includes(textoBusca) || orig.includes(textoBusca) || tipoOp.includes(textoBusca);
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
        
        // Formatação do Tipo de Operação
        const tipoOperacaoFmt = String(conta.tipo_operacao || 'FINANCEIRO DESPESAS').toUpperCase();
        
        // Formatação da Data e Hora do Lançamento (Auditoria)
        let dataLancamentoFmt = '---';
        if (conta.created_at) {
            const dLanc = new Date(conta.created_at);
            dataLancamentoFmt = dLanc.toLocaleDateString('pt-BR') + ' às ' + dLanc.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
        }

        // MOTOR VISUAL DE ALERTAS DE VENCIMENTO
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

        let btnBaixa = '';
        if (conta.status === 'Pendente') {
            btnBaixa = `<button onclick="window.darBaixaPagar(${conta.id}, this)" class="w-8 h-8 flex items-center justify-center bg-emerald-500 hover:bg-emerald-600 text-white rounded transition-all duration-150" title="Liquidar Despesa"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg></button>`;
        } else {
            btnBaixa = `<button onclick="window.estornarPagar(${conta.id}, this)" class="w-8 h-8 flex items-center justify-center bg-gray-500 hover:bg-gray-600 text-white rounded transition-all duration-150" title="Estornar"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg></button>`;
        }

        const btnEditarIndiv = `<button onclick="window.abrirModalEditarPagar(${conta.id})" class="w-8 h-8 flex items-center justify-center bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-800/50 text-amber-600 dark:text-amber-400 rounded transition-all duration-150" title="Editar Despesa"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>`;
        const btnExcluirIndiv = `<button onclick="window.excluirPagarIndividual(${conta.id}, this)" class="w-8 h-8 flex items-center justify-center bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-800/50 text-red-600 dark:text-red-400 rounded transition-all duration-150" title="Apagar Despesa"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>`;
        const isChecked = window.pagarIdsSelecionados.has(conta.id) ? 'checked' : '';

        return `
            <tr class="border-b border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-[#0f172a] transition-all duration-150">
                <td class="p-4 text-center border-r border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-[#0f172a]/50">
                    <input type="checkbox" value="${conta.id}" onchange="window.toggleCheckContaPagar(${conta.id}, this)" class="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-600 cursor-pointer bg-white dark:bg-gray-700" ${isChecked}>
                </td>
                <td class="p-4">
                    <span class="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded text-[9px] font-black tracking-wider uppercase mb-1">${tipoOperacaoFmt}</span>
                    <span class="block text-xs font-black text-gray-800 dark:text-white uppercase truncate max-w-[250px]" title="${fornecedorFmt}">${fornecedorFmt}</span>
                    <span class="block text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 uppercase truncate max-w-[250px]" title="${descFmt}">${descFmt}</span>
                </td>
                <td class="p-4 text-center font-mono">
                    <span class="block font-bold text-gray-600 dark:text-gray-400 text-xs">${docFmt}</span>
                    <span class="block text-[9px] text-gray-400 mt-1 uppercase" title="Data/Hora do Lançamento no Cofre">Lanç.: ${dataLancamentoFmt}</span>
                </td>
                <td class="p-4 text-center font-mono">
                    ${statusVencimentoVisual}
                </td>
                <td class="p-4 text-center">
                    <span class="block text-xs font-black text-gray-700 dark:text-gray-300 uppercase">${conta.operacao}</span>
                    <span class="block text-[10px] text-gray-500 mt-0.5 uppercase">${conta.conta_origem}</span>
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
// 4. EDIÇÃO E INSERÇÃO DIRETA NO BANCO DE DADOS
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
        tipo_operacao: getVal('pagar-tipo-operacao'), // O novo campo sendo atirado pro banco
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

window.abrirModalEditarPagar = function(id) {
    const conta = window.dadosPagarGerais.find(c => c.id === id);
    if (!conta) return;

    document.getElementById('edit-pagar-id').value = conta.id;
    document.getElementById('edit-pagar-tipo-operacao').value = conta.tipo_operacao || 'Financeiro Despesas'; // Puxa o dado do banco
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
        tipo_operacao: document.getElementById('edit-pagar-tipo-operacao').value,
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
// 7. A MAGIA DO XML: LEITURA, AUDITORIA E PROTEÇÃO CONTRA DUPLICIDADE
// =========================================================================

window.processarXmlNfe = async function(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (window.mostrarToast) window.mostrarToast("Analisando xml da Nota Fiscal...", "info");

    const reader = new FileReader();
    
    reader.onload = async function(e) {
        try {
            const xmlString = e.target.result;
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlString, "text/xml");

            const getTagFromParent = (parent, tag) => {
                if (!parent) return '';
                const els = parent.getElementsByTagName(tag);
                if (els.length > 0) return els[0].textContent;
                const elsNS = parent.getElementsByTagNameNS("*", tag);
                return elsNS.length > 0 ? elsNS[0].textContent : '';
            };

            const emitNode = xmlDoc.getElementsByTagName('emit')[0] || xmlDoc.getElementsByTagNameNS("*", 'emit')[0];
            const destNode = xmlDoc.getElementsByTagName('dest')[0] || xmlDoc.getElementsByTagNameNS("*", 'dest')[0];
            const ideNode = xmlDoc.getElementsByTagName('ide')[0] || xmlDoc.getElementsByTagNameNS("*", 'ide')[0];

            if (!emitNode) throw new Error("Ficheiro inválido: Não parece ser um XML de NFe válida.");

            const emitNome = getTagFromParent(emitNode, 'xNome') || 'NÃO IDENTIFICADO';
            const emitCnpj = getTagFromParent(emitNode, 'CNPJ');
            const destNome = getTagFromParent(destNode, 'xNome') || 'NÃO IDENTIFICADO';
            const destCnpj = getTagFromParent(destNode, 'CNPJ');
            
            const numNF = getTagFromParent(ideNode, 'nNF');
            const dataEmissaoStr = getTagFromParent(ideNode, 'dhEmi') || getTagFromParent(ideNode, 'dEmi');
            
            const totalNode = xmlDoc.getElementsByTagName('total')[0] || xmlDoc.getElementsByTagNameNS("*", 'total')[0];
            const totalNF = getTagFromParent(totalNode, 'vNF') || '0.00';

            const { data: notaExistente, error: erroBusca } = await supabase
                .from('contas_pagar')
                .select('fornecedor')
                .eq('numero_documento', numNF);

            if (notaExistente && notaExistente.length > 0) {
                const trechoFornecedor = emitNome.substring(0, 15).toUpperCase();
                const nfDuplicada = notaExistente.find(nota => 
                    nota.fornecedor && nota.fornecedor.toUpperCase().includes(trechoFornecedor)
                );

                if (nfDuplicada) {
                    if (window.mostrarToast) window.mostrarToast(`Bloqueado: A NFe N° ${numNF} deste fornecedor já foi importada!`, "erro");
                    return; 
                }
            }

            window.parcelasXmlTemporarias = [];

            const dups = xmlDoc.getElementsByTagName('dup');
            const dupsLista = [];
            if (dups.length > 0) {
                for(let i=0; i<dups.length; i++) dupsLista.push(dups[i]);
            } else if (xmlDoc.getElementsByTagNameNS) {
                const dupsNS = xmlDoc.getElementsByTagNameNS("*", 'dup');
                for(let i=0; i<dupsNS.length; i++) dupsLista.push(dupsNS[i]);
            }

            if (dupsLista.length > 0) {
                for (let i = 0; i < dupsLista.length; i++) {
                    const d = dupsLista[i];
                    window.parcelasXmlTemporarias.push({
                        parcelaInfo: getTagFromParent(d, 'nDup') || `${i+1}/${dupsLista.length}`,
                        vencimento: getTagFromParent(d, 'dVenc'),
                        valor: getTagFromParent(d, 'vDup')
                    });
                }
            } else {
                let dataVencFallback = new Date().toISOString().split('T')[0];
                if (dataEmissaoStr) dataVencFallback = dataEmissaoStr.substring(0, 10);
                
                window.parcelasXmlTemporarias.push({
                    parcelaInfo: 'A Vista / Única',
                    vencimento: dataVencFallback,
                    valor: totalNF
                });
            }

            document.getElementById('xml-fornecedor-nome').innerText = emitNome;
            document.getElementById('xml-fornecedor-cnpj').innerText = formatarCnpj(emitCnpj);
            document.getElementById('xml-dest-nome').innerText = destNome;
            document.getElementById('xml-dest-cnpj').innerText = formatarCnpj(destCnpj);
            document.getElementById('xml-nota-numero').innerText = numNF;
            document.getElementById('xml-nota-data').innerText = formatarDataIso(dataEmissaoStr);
            document.getElementById('xml-nota-total').innerText = 'R$ ' + (parseFloat(totalNF)||0).toLocaleString('pt-BR', {minimumFractionDigits: 2});
            
            document.getElementById('xml-fornecedor-nome').dataset.raw = emitNome;
            document.getElementById('xml-nota-numero').dataset.raw = numNF;
            
            const tbodyXml = document.getElementById('tabela-xml-parcelas');
            tbodyXml.innerHTML = window.parcelasXmlTemporarias.map((p, index) => {
                const valorNumerico = parseFloat(p.valor) || 0;
                const valorExibicao = valorNumerico.toLocaleString('pt-BR', {minimumFractionDigits: 2});
                
                return `
                    <tr class="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td class="p-3 text-center text-xs font-bold text-gray-500 border-r border-gray-100 dark:border-gray-800">${p.parcelaInfo}</td>
                        <td class="p-3 border-r border-gray-100 dark:border-gray-800">
                            <input type="date" id="xml-venc-${index}" value="${p.vencimento}" class="w-full bg-transparent text-center font-mono font-bold text-xs text-gray-800 dark:text-white outline-none">
                        </td>
                        <td class="p-3">
                            <input type="text" id="xml-val-${index}" value="${valorExibicao}" oninput="window.mascaraValorItem(this)" class="w-full bg-transparent text-right font-mono font-black text-indigo-600 dark:text-indigo-400 text-sm outline-none">
                        </td>
                    </tr>
                `;
            }).join('');

            document.getElementById('modal-xml-preview').classList.remove('hidden');
            document.getElementById('modal-xml-preview').classList.add('flex');

        } catch (erroXml) {
            console.error(erroXml);
            if (window.mostrarToast) window.mostrarToast("Erro: O arquivo não é um XML de NFe válido.", "erro");
        }
    };
    
    reader.readAsText(file);
    event.target.value = ''; 
};

window.salvarXmlLote = async function() {
    const fornecedor = document.getElementById('xml-fornecedor-nome').dataset.raw.toUpperCase();
    const documento = document.getElementById('xml-nota-numero').dataset.raw.toUpperCase();
    const tipoOp = document.getElementById('xml-tipo-operacao').value; // O Novo Campo do XML
    const conta = document.getElementById('xml-conta').value;
    const operacao = document.getElementById('xml-operacao').value;

    let payloadLote = [];

    for (let i = 0; i < window.parcelasXmlTemporarias.length; i++) {
        const parc = window.parcelasXmlTemporarias[i];
        const vVenc = document.getElementById(`xml-venc-${i}`).value;
        const vValStr = document.getElementById(`xml-val-${i}`).value;
        const vValNum = parseFloat(vValStr.replace(/\./g, '').replace(',', '.')) || 0;

        let desc = `REF. NFE ${documento}`;
        if (window.parcelasXmlTemporarias.length > 1) {
            desc += ` - PARC ${parc.parcelaInfo}`;
        }

        payloadLote.push({
            tipo_operacao: tipoOp,
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

        if (window.mostrarToast) window.mostrarToast(`Sucesso! ${payloadLote.length} despesa(s) gerada(s).`, "sucesso");
        
        document.getElementById('modal-xml-preview').classList.add('hidden');
        document.getElementById('modal-xml-preview').classList.remove('flex');
        
        setTimeout(() => window.carregarContasPagar(true), 600);
    } catch (err) {
        console.error("ERRO AO SALVAR XML EM LOTE:", err);
        if (window.mostrarToast) window.mostrarToast("Erro crítico. Verifique as permissões (RLS) no Supabase.", "erro");
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
