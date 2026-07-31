// JS/modules/configuracoes.js
import { supabase } from './config.js';

// =========================================================================
// 1. CARREGAMENTO INICIAL
// =========================================================================
window.carregarConfiguracoes = async function() {
    // Busca os dados da empresa na memória local
    const dadosSalvos = localStorage.getItem('bdp_config_empresa');
    
    if (dadosSalvos) {
        const emp = JSON.parse(dadosSalvos);
        if(document.getElementById('conf-razao')) document.getElementById('conf-razao').value = emp.razao || '';
        if(document.getElementById('conf-cnpj')) document.getElementById('conf-cnpj').value = emp.cnpj || '';
        if(document.getElementById('conf-endereco')) document.getElementById('conf-endereco').value = emp.endereco || '';
        if(document.getElementById('conf-telefone')) document.getElementById('conf-telefone').value = emp.telefone || '';
        if(document.getElementById('conf-email')) document.getElementById('conf-email').value = emp.email || '';
    }
};

// =========================================================================
// 2. GESTOR DE ABAS INTERNAS (UI)
// =========================================================================
window.mudarAbaConfig = function(abaDesejada) {
    // 1. Esconde as abas
    document.getElementById('aba-empresa').classList.add('hidden');
    document.getElementById('aba-cargos').classList.add('hidden');
    
    // 2. Cores base de UI
    const btnClassesInativas = ['text-gray-500', 'hover:bg-gray-200', 'dark:text-gray-400', 'dark:hover:bg-gray-800'];
    const btnClassesAtivas = ['text-white', 'bg-[#1a428a]', 'dark:bg-[#2563eb]', 'shadow-md'];
    
    const btnEmpresa = document.getElementById('btn-aba-empresa');
    const btnCargos = document.getElementById('btn-aba-cargos');
    
    // Reseta visual dos botões
    btnEmpresa.classList.remove(...btnClassesAtivas);
    btnEmpresa.classList.add(...btnClassesInativas);
    
    btnCargos.classList.remove(...btnClassesAtivas);
    btnCargos.classList.add(...btnClassesInativas);

    // 3. Ativa a aba e o botão corretos
    const containerAba = document.getElementById(`aba-${abaDesejada}`);
    const botaoAba = document.getElementById(`btn-aba-${abaDesejada}`);
    
    if(containerAba) {
        containerAba.classList.remove('hidden');
        containerAba.classList.add('block');
    }
    
    if(botaoAba) {
        botaoAba.classList.remove(...btnClassesInativas);
        botaoAba.classList.add(...btnClassesAtivas);
    }
};

// =========================================================================
// 3. GRAVAR DADOS DA EMPRESA
// =========================================================================
window.salvarDadosEmpresa = function() {
    // Coleta os valores do ecrã
    const dados = {
        razao: document.getElementById('conf-razao').value.trim(),
        cnpj: document.getElementById('conf-cnpj').value.trim(),
        endereco: document.getElementById('conf-endereco').value.trim(),
        telefone: document.getElementById('conf-telefone').value.trim(),
        email: document.getElementById('conf-email').value.trim()
    };

    if(!dados.razao) {
        if(window.mostrarToast) window.mostrarToast("A Razão Social é obrigatória.", "aviso");
        return;
    }

    // Grava na memória do sistema
    localStorage.setItem('bdp_config_empresa', JSON.stringify(dados));
    
    // As Câmaras do Painel Master estão a ver tudo!
    if (window.registrarLog) {
        window.registrarLog('Configurações', 'Atualizou Dados da Oficina', `Razão Social definida: ${dados.razao}`);
    }

    if (window.mostrarToast) window.mostrarToast("Identidade da oficina salva com sucesso!", "sucesso");
};
