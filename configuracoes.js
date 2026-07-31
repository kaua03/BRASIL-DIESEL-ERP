// JS/modules/configuracoes.js
import { supabase } from './config.js';

let arquivoLogoPendente = null;

// =========================================================================
// 1. CARREGAMENTO INICIAL DO BANCO DE DADOS
// =========================================================================
window.carregarConfiguracoes = async function() {
    try {
        // Carrega Dados da Empresa
        const { data: emp, error: errEmp } = await supabase.from('empresa_config').select('*').eq('id', 1).single();
        if (!errEmp && emp) {
            document.getElementById('conf-nome-curto').value = emp.nome_fantasia || '';
            document.getElementById('conf-cor').value = emp.cor_primaria || '#1a428a';
            document.getElementById('hex-cor').innerText = emp.cor_primaria || '#1a428a';
            document.getElementById('conf-razao').value = emp.razao_social || '';
            document.getElementById('conf-cnpj').value = emp.cnpj || '';
            document.getElementById('conf-endereco').value = emp.endereco || '';
            document.getElementById('conf-telefone').value = emp.telefone || '';
            document.getElementById('conf-email').value = emp.email || '';

            if (emp.logo_url) {
                document.getElementById('preview-logo').src = emp.logo_url;
                document.getElementById('preview-logo').classList.remove('hidden');
                document.getElementById('placeholder-logo').classList.add('hidden');
            }
        }

        // Atualiza a cor de preview quando o usuário escolhe
        document.getElementById('conf-cor').addEventListener('input', (e) => {
            document.getElementById('hex-cor').innerText = e.target.value;
        });

        // Carrega a Matriz de Cargos
        const { data: cargos, error: errCarg } = await supabase.from('cargos_permissoes').select('*').order('cargo');
        if (!errCarg && cargos) {
            window.renderizarTabelaCargos(cargos);
        }

    } catch (e) {
        console.error("Erro ao carregar configurações:", e);
        if(window.mostrarToast) window.mostrarToast("Erro de comunicação com as configurações.", "erro");
    }
};

window.mudarAbaConfig = function(abaDesejada) {
    document.getElementById('aba-empresa').classList.add('hidden');
    document.getElementById('aba-cargos').classList.add('hidden');
    
    const btnClassesInativas = ['text-gray-500', 'hover:bg-gray-200', 'dark:text-gray-400', 'dark:hover:bg-gray-800'];
    const btnClassesAtivas = ['text-white', 'bg-[#1a428a]', 'dark:bg-[#2563eb]', 'shadow-md'];
    
    const btnEmpresa = document.getElementById('btn-aba-empresa');
    const btnCargos = document.getElementById('btn-aba-cargos');
    
    btnEmpresa.classList.remove(...btnClassesAtivas); btnEmpresa.classList.add(...btnClassesInativas);
    btnCargos.classList.remove(...btnClassesAtivas); btnCargos.classList.add(...btnClassesInativas);

    const containerAba = document.getElementById(`aba-${abaDesejada}`);
    const botaoAba = document.getElementById(`btn-aba-${abaDesejada}`);
    
    if(containerAba) { containerAba.classList.remove('hidden'); containerAba.classList.add('flex'); }
    if(botaoAba) { botaoAba.classList.remove(...btnClassesInativas); botaoAba.classList.add(...btnClassesAtivas); }
};

// =========================================================================
// 2. LÓGICA DE DADOS DA EMPRESA E UPLOAD DE LOGO
// =========================================================================
window.prepararUploadLogo = function(event) {
    const file = event.target.files[0];
    if (!file) return;

    arquivoLogoPendente = file;

    // Mostra o preview local instantaneamente
    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('preview-logo').src = e.target.result;
        document.getElementById('preview-logo').classList.remove('hidden');
        document.getElementById('placeholder-logo').classList.add('hidden');
    }
    reader.readAsDataURL(file);
};

window.salvarDadosEmpresa = async function() {
    const btn = document.getElementById('btn-salvar-empresa');
    btn.innerText = "Salvando..."; btn.disabled = true;

    try {
        let logoFinalUrl = document.getElementById('preview-logo').src;

        // Se houver um arquivo pendente, faz upload pro Supabase Storage
        if (arquivoLogoPendente) {
            const fileExt = arquivoLogoPendente.name.split('.').pop();
            const fileName = `logo_oficina_${Date.now()}.${fileExt}`;
            
            const { error: uploadError } = await supabase.storage.from('logos').upload(fileName, arquivoLogoPendente, { upsert: true });
            if (uploadError) throw uploadError;

            // Pega o Link Público do logo
            const { data: publicUrlData } = supabase.storage.from('logos').getPublicUrl(fileName);
            logoFinalUrl = publicUrlData.publicUrl;
            arquivoLogoPendente = null; // Limpa o pendente
        }

        const dados = {
            nome_fantasia: document.getElementById('conf-nome-curto').value.trim().toUpperCase(),
            cor_primaria: document.getElementById('conf-cor').value,
            razao_social: document.getElementById('conf-razao').value.trim(),
            cnpj: document.getElementById('conf-cnpj').value.trim(),
            endereco: document.getElementById('conf-endereco').value.trim(),
            telefone: document.getElementById('conf-telefone').value.trim(),
            email: document.getElementById('conf-email').value.trim(),
            logo_url: logoFinalUrl !== "" && !logoFinalUrl.startsWith('data:') ? logoFinalUrl : null
        };

        const { error } = await supabase.from('empresa_config').upsert({ id: 1, ...dados });
        if (error) throw error;

        if (window.registrarLog) window.registrarLog('Configurações', 'Atualizou Dados da Oficina/Branding', '');
        if (window.mostrarToast) window.mostrarToast("Identidade da oficina salva! Dê F5 para aplicar as cores.", "sucesso");

    } catch (e) {
        console.error("Erro ao salvar empresa:", e);
        if (window.mostrarToast) window.mostrarToast("Erro ao gravar informações.", "erro");
    } finally {
        btn.innerHTML = `<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> Gravar Alterações`;
        btn.disabled = false;
    }
};

// =========================================================================
// 3. MATRIZ DE PERMISSÕES DINÂMICA
// =========================================================================
window.renderizarTabelaCargos = function(cargos) {
    const tbody = document.getElementById('tabela-permissoes');
    if (!tbody) return;

    tbody.innerHTML = cargos.map(c => {
        // Bloqueia a edição do cargo "Dono" para não nos trancarmos fora do sistema
        const isDono = c.cargo === 'Dono';
        const isTela = c.cargo === 'Tela';
        const bloqueado = (isDono || isTela) ? 'disabled class="opacity-50 cursor-not-allowed"' : '';

        return `
            <tr class="hover:bg-gray-50 dark:hover:bg-[#0f172a] transition-colors" data-cargo="${c.cargo}">
                <td class="p-4 text-[#1a428a] dark:text-blue-400 font-black">${c.cargo}</td>
                
                <td class="p-4 text-center">
                    <input type="checkbox" class="w-5 h-5 cursor-pointer rounded chk-patio" ${c.acesso_patio ? 'checked' : ''} ${bloqueado}>
                </td>
                
                <td class="p-4 text-center">
                    <select class="p-1.5 border rounded text-xs outline-none bg-white dark:bg-gray-800 dark:border-gray-600 sel-os cursor-pointer" ${bloqueado}>
                        <option value="nenhum" ${c.acesso_os === 'nenhum' ? 'selected' : ''}>❌ Sem Acesso</option>
                        <option value="execucao" ${c.acesso_os === 'execucao' ? 'selected' : ''}>⚠️ Só Checklist</option>
                        <option value="total" ${c.acesso_os === 'total' ? 'selected' : ''}>✅ Acesso Total (Valores)</option>
                    </select>
                </td>
                
                <td class="p-4 text-center">
                    <input type="checkbox" class="w-5 h-5 cursor-pointer rounded chk-fin" ${c.acesso_financeiro ? 'checked' : ''} ${bloqueado}>
                </td>

                <td class="p-4 text-center">
                    <input type="checkbox" class="w-5 h-5 cursor-pointer rounded chk-cad" ${c.acesso_cadastros ? 'checked' : ''} ${bloqueado}>
                </td>
                
                <td class="p-4 text-center">
                    <input type="checkbox" class="w-5 h-5 cursor-pointer rounded chk-master" ${c.acesso_master ? 'checked' : ''} ${bloqueado}>
                </td>
            </tr>
        `;
    }).join('');
};

window.salvarPermissoes = async function() {
    const tbody = document.getElementById('tabela-permissoes');
    const linhas = tbody.querySelectorAll('tr[data-cargo]');
    
    let atualizacoes = [];

    linhas.forEach(tr => {
        atualizacoes.push({
            cargo: tr.getAttribute('data-cargo'),
            acesso_patio: tr.querySelector('.chk-patio').checked,
            acesso_os: tr.querySelector('.sel-os').value,
            acesso_financeiro: tr.querySelector('.chk-fin').checked,
            acesso_cadastros: tr.querySelector('.chk-cad').checked,
            acesso_master: tr.querySelector('.chk-master').checked
        });
    });

    try {
        const { error } = await supabase.from('cargos_permissoes').upsert(atualizacoes);
        if (error) throw error;

        if (window.registrarLog) window.registrarLog('Configurações', 'Alterou Matriz de Acessos (RBAC)', '');
        if (window.mostrarToast) window.mostrarToast("Matriz de acessos atualizada e gravada no banco!", "sucesso");

    } catch (e) {
        console.error("Erro ao salvar RBAC:", e);
        if (window.mostrarToast) window.mostrarToast("Erro ao gravar permissões.", "erro");
    }
};
