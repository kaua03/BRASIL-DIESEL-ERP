// JS/modules/cliente.js
import { supabase } from './config.js';

window.dadosClientesGerais = [];
window.filtroClienteAtual = 'TODOS'; 
window.vigilanciaClienteAtiva = false; 

// Normalizador para buscas sem acentos
const removerAcentos = (str) => {
    if(!str) return '';
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

// =========================================================================
// 0. MÁSCARAS INTELIGENTES (CPF/CNPJ E TELEFONE)
// =========================================================================
window.mascaraCpfCnpj = function(input) {
    let v = input.value.replace(/\D/g, ""); // Remove tudo o que não é dígito

    if (v.length <= 11) { // CPF
        v = v.replace(/(\d{3})(\d)/, "$1.$2");
        v = v.replace(/(\d{3})(\d)/, "$1.$2");
        v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    } else { // CNPJ
        v = v.replace(/^(\d{2})(\d)/, "$1.$2");
        v = v.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
        v = v.replace(/\.(\d{3})(\d)/, ".$1/$2");
        v = v.replace(/(\d{4})(\d)/, "$1-$2");
    }
    
    // Limita a 18 caracteres (tamanho máximo da máscara do CNPJ)
    input.value = v.substring(0, 18);
};

window.mascaraTelefone = function(input) {
    let v = input.value.replace(/\D/g, "");
    
    if (v.length > 10) { // Celular: (11) 90000-0000
        v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
        v = v.replace(/(\d{5})(\d)/, "$1-$2");
    } else { // Fixo: (11) 0000-0000
        v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
        v = v.replace(/(\d{4})(\d)/, "$1-$2");
    }
    
    input.value = v.substring(0, 15);
};

// =========================================================================
// 1. CARREGAMENTO E VIGILÂNCIA REALTIME
// =========================================================================

window.ativarVigilanciaCliente = function() {
    if (window.vigilanciaClienteAtiva) return;
    window.vigilanciaClienteAtiva = true;

    supabase.channel('vigilancia-cliente')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, payload => {
            const tbody = document.getElementById('tabela-dados-clientes');
            if (tbody) {
                console.log('📡 [Central] Alteração de Clientes detectada! Atualizando...');
                window.carregarClientes(true); 
            }
        })
        .subscribe();
};

window.carregarClientes = async function(isSilencioso = false) {
    const tbody = document.getElementById('tabela-dados-clientes');
    if (!tbody) return;

    if (!isSilencioso) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center p-8 text-gray-400 font-bold italic">Buscando registros na central...</td></tr>';
    }

    window.ativarVigilanciaCliente(); 

    try {
        const { data, error } = await supabase
            .from('clientes')
            .select('*')
            .order('nome_razao', { ascending: true }); // Ordem alfabética

        if (error) throw error;
        
        window.dadosClientesGerais = data || [];
        window.renderizarClientes();

    } catch (err) {
        console.error("ERRO AO CARREGAR CLIENTES:", err);
        if (!isSilencioso) tbody.innerHTML = '<tr><td colspan="6" class="text-center p-8 text-red-500 font-bold">Erro de conexão com o banco de clientes.</td></tr>';
    }
};

// =========================================================================
// 2. NAVEGAÇÃO E MOTOR DE RENDERIZAÇÃO
// =========================================================================

window.mudarFiltroCliente = function(status) {
    window.filtroClienteAtual = status;
    
    const btnTodos = document.getElementById('btn-tab-cli-todos');
    const btnPf = document.getElementById('btn-tab-cli-pf');
    const btnPj = document.getElementById('btn-tab-cli-pj');

    const classeAtiva = "flex-1 sm:flex-initial px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-150 bg-[#1a428a] text-white shadow-sm";
    const classeInativa = "flex-1 sm:flex-initial px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-150 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white bg-transparent";

    if(btnTodos) btnTodos.className = status === 'TODOS' ? classeAtiva : classeInativa;
    if(btnPf) btnPf.className = status === 'Física' ? classeAtiva : classeInativa;
    if(btnPj) btnPj.className = status === 'Jurídica' ? classeAtiva : classeInativa;
    
    window.renderizarClientes();
};

window.renderizarClientes = function() {
    const tbody = document.getElementById('tabela-dados-clientes');
    if (!tbody) return;

    const textoBuscaBruto = (document.getElementById('filtro-busca-cliente')?.value || '').trim();
    const textoBusca = removerAcentos(textoBuscaBruto);

    let totalPf = 0;
    let totalPj = 0;

    // Calcula Totais
    window.dadosClientesGerais.forEach(cli => {
        if (cli.tipo_cliente === 'Física') totalPf++;
        if (cli.tipo_cliente === 'Jurídica') totalPj++;
    });

    const elPf = document.getElementById('card-clientes-pf');
    const elPj = document.getElementById('card-clientes-pj');
    if(elPf) elPf.innerText = totalPf;
    if(elPj) elPj.innerText = totalPj;

    let dadosFiltrados = window.dadosClientesGerais.filter(cli => {
        const bateAba = window.filtroClienteAtual === 'TODOS' || cli.tipo_cliente === window.filtroClienteAtual;
        
        let bateTexto = true;
        if (textoBusca) {
            const nome = removerAcentos(String(cli.nome_razao || ''));
            const doc = removerAcentos(String(cli.cpf_cnpj || ''));
            const tel = removerAcentos(String(cli.telefone || ''));
            
            bateTexto = nome.includes(textoBusca) || doc.includes(textoBusca) || tel.includes(textoBusca);
        }
        return bateAba && bateTexto;
    });

    if (dadosFiltrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center p-8 text-gray-400 font-bold italic">Nenhum cliente encontrado com este filtro.</td></tr>`;
        return;
    }

    tbody.innerHTML = dadosFiltrados.map(cli => {
        const nomeFmt = String(cli.nome_razao || '---').toUpperCase();
        const docFmt = String(cli.cpf_cnpj || '---');
        const telFmt = String(cli.telefone || '---');
        const emailFmt = String(cli.email || '').toLowerCase();
        
        const badgeCor = cli.tipo_cliente === 'Física' 
            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' 
            : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400';

        const btnEditar = `
            <button onclick="window.abrirModalEditarCliente(${cli.id})" class="w-8 h-8 flex items-center justify-center bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-800/50 text-amber-600 dark:text-amber-400 rounded transition-all duration-150" title="Editar Ficha">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            </button>
        `;

        const btnExcluir = `
            <button onclick="window.excluirCliente(${cli.id}, this)" class="w-8 h-8 flex items-center justify-center bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-800/50 text-red-600 dark:text-red-400 rounded transition-all duration-150" title="Apagar Cliente">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
        `;

        return `
            <tr class="border-b border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-[#0f172a] transition-all duration-150">
                <td class="p-4 text-center font-mono font-bold text-gray-400 text-xs border-r border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-[#0f172a]/50">
                    ${cli.id}
                </td>
                <td class="p-4">
                    <span class="block font-black text-gray-800 dark:text-white uppercase truncate max-w-[300px]" title="${nomeFmt}">${nomeFmt}</span>
                    <span class="block text-[10px] font-bold text-gray-400 mt-1 uppercase truncate max-w-[300px]">${cli.endereco || 'ENDEREÇO NÃO CADASTRADO'}</span>
                </td>
                <td class="p-4 text-center font-mono font-bold text-[#1a428a] dark:text-blue-400 text-sm tracking-widest">${docFmt}</td>
                <td class="p-4 text-center">
                    <span class="block font-mono font-bold text-gray-700 dark:text-gray-300 text-xs">${telFmt}</span>
                    <span class="block text-[10px] text-gray-500 mt-1">${emailFmt || 'SEM EMAIL'}</span>
                </td>
                <td class="p-4 text-center">
                    <span class="inline-block px-2 py-1 rounded text-[10px] font-black tracking-wider uppercase ${badgeCor}">${cli.tipo_cliente}</span>
                </td>
                <td class="p-4 text-center">
                    <div class="flex items-center justify-center gap-1.5">
                        ${btnEditar}
                        ${btnExcluir}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
};

// =========================================================================
// 3. LÓGICA DO FORMULÁRIO (NOVO E EDIÇÃO)
// =========================================================================

window.trocarTipoClienteUI = function() {
    const isPj = document.querySelector('input[name="cli-tipo"][value="Jurídica"]').checked;
    const lblNome = document.getElementById('lbl-cli-nome');
    const lblDoc = document.getElementById('lbl-cli-doc');
    const inNome = document.getElementById('cli-nome');
    const inDoc = document.getElementById('cli-doc');

    if (isPj) {
        lblNome.innerText = "Razão Social / Nome Fantasia";
        lblDoc.innerText = "CNPJ";
        inNome.placeholder = "EMPRESA LTDA";
        inDoc.placeholder = "00.000.000/0000-00";
    } else {
        lblNome.innerText = "Nome Completo";
        lblDoc.innerText = "CPF";
        inNome.placeholder = "NOME DO CLIENTE";
        inDoc.placeholder = "000.000.000-00";
    }
    window.mascaraCpfCnpj(inDoc);
};

window.abrirModalCliente = function() {
    const form = document.getElementById('form-cliente');
    if (form) form.reset();
    
    document.getElementById('cli-id').value = '';
    document.getElementById('titulo-modal-cliente').innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
        Cadastrar Cliente
    `;
    
    document.querySelector('input[name="cli-tipo"][value="Física"]').checked = true;
    window.trocarTipoClienteUI();

    document.getElementById('modal-cliente').classList.remove('hidden');
    document.getElementById('modal-cliente').classList.add('flex');
};

window.abrirModalEditarCliente = function(id) {
    const cli = window.dadosClientesGerais.find(c => c.id === id);
    if (!cli) return;

    document.getElementById('cli-id').value = cli.id;
    
    document.querySelector(`input[name="cli-tipo"][value="${cli.tipo_cliente}"]`).checked = true;
    window.trocarTipoClienteUI();

    document.getElementById('cli-nome').value = cli.nome_razao || '';
    document.getElementById('cli-doc').value = cli.cpf_cnpj || '';
    document.getElementById('cli-telefone').value = cli.telefone || '';
    document.getElementById('cli-email').value = cli.email || '';
    document.getElementById('cli-endereco').value = cli.endereco || '';
    document.getElementById('cli-obs').value = cli.observacoes || '';

    document.getElementById('titulo-modal-cliente').innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
        Editar Ficha do Cliente
    `;

    document.getElementById('modal-cliente').classList.remove('hidden');
    document.getElementById('modal-cliente').classList.add('flex');
};

window.salvarCliente = async function(event) {
    event.preventDefault();

    const getVal = (id) => document.getElementById(id)?.value || '';
    const id = getVal('cli-id');
    const isPj = document.querySelector('input[name="cli-tipo"][value="Jurídica"]').checked;

    const payload = {
        tipo_cliente: isPj ? 'Jurídica' : 'Física',
        nome_razao: getVal('cli-nome').trim().toUpperCase(),
        cpf_cnpj: getVal('cli-doc').trim(),
        telefone: getVal('cli-telefone').trim(),
        email: getVal('cli-email').trim().toLowerCase(),
        endereco: getVal('cli-endereco').trim().toUpperCase(),
        observacoes: getVal('cli-obs').trim().toUpperCase()
    };

    if (window.mostrarToast) window.mostrarToast("Salvando ficha do cliente...", "sucesso");

    try {
        if (id) {
            const { error } = await supabase.from('clientes').update(payload).eq('id', id);
            if (error) throw error;
            if (window.mostrarToast) window.mostrarToast("Ficha atualizada com sucesso!", "sucesso");
        } else {
            const { error } = await supabase.from('clientes').insert([payload]);
            if (error) throw error;
            if (window.mostrarToast) window.mostrarToast("Novo cliente cadastrado!", "sucesso");
        }
        
        document.getElementById('modal-cliente').classList.add('hidden');
        document.getElementById('modal-cliente').classList.remove('flex');
        
        setTimeout(() => window.carregarClientes(true), 600);
    } catch (err) {
        console.error("ERRO AO SALVAR CLIENTE:", err);
        if (window.mostrarToast) window.mostrarToast("Erro ao gravar ficha no cofre.", "erro");
    }
};

window.excluirCliente = async function(id, btnElement) {
    const confirmou = await window.abrirConfirmacao("Excluir Cliente", "Atenção: Apagar o registro do cliente? Esta ação não pode ser desfeita.", "perigo");
    if (!confirmou) return;

    if (btnElement) {
        btnElement.innerHTML = `<svg class="animate-spin h-4 w-4 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
        const tr = btnElement.closest('tr');
        if (tr) tr.classList.add('bg-red-50', 'dark:bg-red-900/20', 'opacity-50');
    }

    try {
        const { error } = await supabase.from('clientes').delete().eq('id', id);
        if (error) throw error;
        
        if (window.mostrarToast) window.mostrarToast("Registro eliminado!", "sucesso");
        setTimeout(() => window.carregarClientes(true), 600);
    } catch (err) {
        console.error("ERRO AO EXCLUIR CLIENTE:", err);
        if (window.mostrarToast) window.mostrarToast("Falha. Cliente pode estar atrelado a uma O.S.", "erro");
        window.carregarClientes(true);
    }
};
