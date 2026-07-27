// cliente.js
import { supabase } from './config.js';

window.dadosClientes = [];

// ==========================================
// 1. CARREGAR E RENDERIZAR CLIENTES
// ==========================================
window.carregarClientes = async function() {
    const tbody = document.getElementById('tabela-clientes');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-gray-400 font-medium">Carregando clientes...</td></tr>`;

    try {
        const { data: clientes, error } = await supabase
            .from('clientes')
            .select('*')
            .order('nome', { ascending: true });

        if (error) throw error;

        window.dadosClientes = clientes || [];
        window.renderizarTabelaClientes(window.dadosClientes);

    } catch (err) {
        console.error("Erro ao carregar clientes:", err);
        tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-red-500 font-bold">Erro ao comunicar com o servidor. Verifique se a tabela 'clientes' existe no Supabase.</td></tr>`;
    }
};

window.renderizarTabelaClientes = function(lista) {
    const tbody = document.getElementById('tabela-clientes');
    if (!tbody) return;

    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-12 text-center text-gray-400 font-medium">Nenhum cliente registado.</td></tr>`;
        return;
    }

    tbody.innerHTML = lista.map(c => `
        <tr class="hover:bg-gray-50/80 dark:hover:bg-[#0f172a]/40 transition-colors">
            <td class="p-4 font-bold text-gray-800 dark:text-white uppercase">${c.nome || '---'}</td>
            <td class="p-4 text-gray-600 dark:text-gray-300 font-mono text-xs">${c.telefone || '---'}</td>
            <td class="p-4 text-gray-600 dark:text-gray-300 font-mono text-xs">${c.documento || '---'}</td>
            <td class="p-4 text-gray-600 dark:text-gray-300 text-xs uppercase">${c.endereco || '---'}</td>
            <td class="p-4 text-center">
                <div class="flex justify-center gap-2">
                    <button onclick="window.editarCliente(${c.id})" class="p-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-[#1a428a] dark:text-blue-400 rounded-lg transition-colors" title="Editar">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    </button>
                    <button onclick="window.excluirCliente(${c.id})" class="p-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg transition-colors" title="Excluir">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
};

// ==========================================
// 2. FILTRAGEM INSTANTÂNEA
// ==========================================
window.filtrarClientes = function(termo) {
    const t = termo.toLowerCase().trim();
    const filtrados = window.dadosClientes.filter(c => 
        (c.nome && c.nome.toLowerCase().includes(t)) ||
        (c.telefone && c.telefone.toLowerCase().includes(t)) ||
        (c.documento && c.documento.toLowerCase().includes(t))
    );
    window.renderizarTabelaClientes(filtrados);
};

// ==========================================
// 3. MODAL (ABRIR, FECHAR, SALVAR, EXCLUIR)
// ==========================================
window.abrirModalCliente = function(id = null) {
    const modal = document.getElementById('modal-cliente');
    const titulo = document.getElementById('modal-cliente-titulo');
    const form = document.getElementById('form-cliente');
    
    if (form) form.reset();
    document.getElementById('cliente-id').value = '';

    if (id) {
        titulo.innerText = "Editar Cliente";
        const cliente = window.dadosClientes.find(c => c.id === id);
        if (cliente) {
            document.getElementById('cliente-id').value = cliente.id;
            document.getElementById('cliente-nome').value = cliente.nome || '';
            document.getElementById('cliente-telefone').value = cliente.telefone || '';
            document.getElementById('cliente-documento').value = cliente.documento || '';
            document.getElementById('cliente-endereco').value = cliente.endereco || '';
        }
    } else {
        titulo.innerText = "Registar Novo Cliente";
    }

    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
};

window.fecharModalCliente = function() {
    const modal = document.getElementById('modal-cliente');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
};

window.salvarCliente = async function(e) {
    e.preventDefault();

    const id = document.getElementById('cliente-id').value;
    const nome = document.getElementById('cliente-nome').value.trim().toUpperCase();
    const telefone = document.getElementById('cliente-telefone').value.trim();
    const documento = document.getElementById('cliente-documento').value.trim();
    const endereco = document.getElementById('cliente-endereco').value.trim().toUpperCase();

    const dados = { nome, telefone, documento, endereco };

    try {
        if (id) {
            const { error } = await supabase.from('clientes').update(dados).eq('id', id);
            if (error) throw error;
            if (window.mostrarToast) window.mostrarToast("Cliente atualizado com sucesso!", "sucesso");
        } else {
            const { error } = await supabase.from('clientes').insert([dados]);
            if (error) throw error;
            if (window.mostrarToast) window.mostrarToast("Cliente registado com sucesso!", "sucesso");
        }

        window.fecharModalCliente();
        window.carregarClientes();

    } catch (err) {
        console.error("Erro ao salvar cliente:", err);
        if (window.mostrarToast) window.mostrarToast("Erro ao salvar cliente no banco.", "erro");
    }
};

window.editarCliente = function(id) {
    window.abrirModalCliente(id);
};

window.excluirCliente = async function(id) {
    const confirmou = window.abrirConfirmacao ? 
        await window.abrirConfirmacao("Excluir Cliente", "Tem certeza que deseja excluir este cliente?", "aviso") :
        confirm("Tem certeza que deseja excluir este cliente?");

    if (!confirmou) return;

    try {
        const { error } = await supabase.from('clientes').delete().eq('id', id);
        if (error) throw error;
        if (window.mostrarToast) window.mostrarToast("Cliente excluído com sucesso!", "sucesso");
        window.carregarClientes();
    } catch (err) {
        console.error("Erro ao excluir cliente:", err);
        if (window.mostrarToast) window.mostrarToast("Erro ao excluir cliente.", "erro");
    }
};
