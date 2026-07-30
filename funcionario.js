// JS/modules/funcionario.js
import { supabase } from './config.js';

window.dadosFuncionarios = [];

window.carregarFuncionarios = async function() {
    const tbody = document.getElementById('tabela-funcionarios');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="text-center p-8 text-gray-500 font-bold">Consultando equipe...</td></tr>';

    try {
        const { data, error } = await supabase.from('funcionarios').select('*').order('nome_completo');
        if (error) throw error;
        
        window.dadosFuncionarios = data || [];
        window.renderizarFuncionarios();
    } catch (err) {
        console.error("ERRO AO CARREGAR FUNCIONÁRIOS:", err);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center p-8 text-red-500 font-bold">Erro de conexão com o banco.</td></tr>';
    }
};

window.renderizarFuncionarios = function() {
    const tbody = document.getElementById('tabela-funcionarios');
    if (!tbody) return;

    if (window.dadosFuncionarios.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center p-8 text-gray-400 font-bold italic">Nenhum colaborador registrado.</td></tr>`;
        return;
    }

    tbody.innerHTML = window.dadosFuncionarios.map(f => {
        // Cores táticas para Nível de Acesso
        let corNivel = 'bg-gray-100 text-gray-800 border-gray-200';
        if (f.nivel_acesso === 'Admin') corNivel = 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200';
        if (f.nivel_acesso === 'Recepção') corNivel = 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200';
        if (f.nivel_acesso === 'Operacional') corNivel = 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400 border-sky-200';

        // Cores para Status
        const corStatus = f.status === 'Ativo' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-200 text-gray-500 dark:bg-gray-800 dark:text-gray-400';

        return `
            <tr class="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-[#0f172a] transition-all">
                <td class="p-4">
                    <span class="block font-black text-gray-800 dark:text-white uppercase">${f.nome_completo}</span>
                    <span class="block text-xs text-gray-500 dark:text-gray-400">${f.email || 'Sem e-mail'}</span>
                </td>
                <td class="p-4 text-sm font-mono text-gray-600 dark:text-gray-400">${f.telefone || '---'}</td>
                <td class="p-4 text-center font-bold text-gray-700 dark:text-gray-300 text-xs uppercase">${f.cargo}</td>
                <td class="p-4 text-center">
                    <span class="px-3 py-1 text-[10px] uppercase rounded-lg font-black tracking-wider border shadow-sm ${corNivel}">
                        ${f.nivel_acesso}
                    </span>
                </td>
                <td class="p-4 text-center">
                    <span class="px-2 py-1 text-[10px] uppercase rounded font-bold ${corStatus}">
                        ${f.status}
                    </span>
                </td>
                <td class="p-4 text-center">
                    <div class="flex items-center justify-center gap-2">
                        <button onclick="window.editarFuncionario('${f.id}')" class="text-amber-500 hover:text-amber-700 bg-amber-50 dark:bg-gray-800 hover:bg-amber-100 p-2 rounded-lg transition-all" title="Editar">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
};

window.abrirModalFuncionario = function() {
    document.getElementById('func-id').value = '';
    document.getElementById('func-nome').value = '';
    document.getElementById('func-email').value = '';
    document.getElementById('func-telefone').value = '';
    document.getElementById('func-cargo').value = 'Mecânico';
    document.getElementById('func-nivel').value = 'Operacional';
    document.getElementById('func-status').value = 'Ativo';
    
    document.getElementById('titulo-modal-funcionario').innerText = 'CADASTRAR COLABORADOR';
    document.getElementById('modal-funcionario').classList.remove('hidden');
    document.getElementById('modal-funcionario').classList.add('flex');
};

window.editarFuncionario = function(id) {
    const f = window.dadosFuncionarios.find(x => x.id === id);
    if (!f) return;

    document.getElementById('func-id').value = f.id;
    document.getElementById('func-nome').value = f.nome_completo || '';
    document.getElementById('func-email').value = f.email || '';
    document.getElementById('func-telefone').value = f.telefone || '';
    document.getElementById('func-cargo').value = f.cargo || 'Mecânico';
    document.getElementById('func-nivel').value = f.nivel_acesso || 'Operacional';
    document.getElementById('func-status').value = f.status || 'Ativo';

    document.getElementById('titulo-modal-funcionario').innerText = 'EDITAR COLABORADOR';
    document.getElementById('modal-funcionario').classList.remove('hidden');
    document.getElementById('modal-funcionario').classList.add('flex');
};

window.salvarFuncionario = async function(event) {
    event.preventDefault();
    
    const id = document.getElementById('func-id').value;
    const emailStr = document.getElementById('func-email').value.trim().toLowerCase();
    
    const payload = {
        nome_completo: document.getElementById('func-nome').value.trim().toUpperCase(),
        email: emailStr,
        telefone: document.getElementById('func-telefone').value.trim(),
        cargo: document.getElementById('func-cargo').value,
        nivel_acesso: document.getElementById('func-nivel').value,
        status: document.getElementById('func-status').value
    };

    if(window.mostrarToast) window.mostrarToast("Salvando informações...", "info");

    try {
        if (id) {
            // Edição
            const { error } = await supabase.from('funcionarios').update(payload).eq('id', id);
            if (error) throw error;
            if(window.mostrarToast) window.mostrarToast("Colaborador atualizado!", "sucesso");
        } else {
            // Criação
            payload.data_admissao = new Date().toISOString().split('T')[0];
            const { error } = await supabase.from('funcionarios').insert([payload]);
            if (error) throw error;
            if(window.mostrarToast) window.mostrarToast("Colaborador cadastrado!", "sucesso");
        }
        
        document.getElementById('modal-funcionario').classList.add('hidden');
        document.getElementById('modal-funcionario').classList.remove('flex');
        window.carregarFuncionarios();
        
    } catch (err) {
        console.error("ERRO AO SALVAR:", err);
        if(window.mostrarToast) window.mostrarToast("Erro ao salvar dados.", "erro");
    }
};
